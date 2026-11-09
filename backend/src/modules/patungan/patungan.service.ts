import { z } from "zod";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "../../db";
import {
  auditLogs,
  courses,
  enrollments,
  patunganGroupMembers,
  patunganGroups,
  payments,
  promoCampaigns,
  promoCourses,
  users,
} from "../../db/schema";
import { hasCourseAccess } from "../enrollments/enrollment.service";
import { isCampaignActive } from "../promos/promo.service";
import { isValidUsername, normalizeUsername } from "../../utils/username";
import {
  PATUNGAN_MAX_MEMBERS,
  PATUNGAN_MIN_MEMBERS,
  buildGroupCode,
  splitShares,
} from "./patungan.rules";

export class PatunganError extends Error {
  readonly http: number;
  readonly code: string;
  readonly details: { usernames?: string[] } | null;
  constructor(http: number, code: string, message: string, details: { usernames?: string[] } | null = null) {
    super(message);
    this.http = http;
    this.code = code;
    this.details = details;
  }
}

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// ---------- Skema input ----------

const usernameList = z
  .array(z.string().trim().min(1).max(30))
  .min(1)
  .max(PATUNGAN_MAX_MEMBERS - 1);

export const validateMembersSchema = z
  .object({
    courseId: z.number().int().positive(),
    usernames: usernameList,
  })
  .strict();

export const createGroupSchema = validateMembersSchema;

export const cancelGroupSchema = z
  .object({
    reason: z.string().trim().max(500).optional(),
  })
  .strict();

// ---------- Kampanye patungan aktif untuk satu kursus ----------

export interface PatunganCampaignRef {
  id: number;
  slug: string;
  title: string;
  badgeLabel: string | null;
  endsAt: Date | null;
}

/**
 * Sumber kebenaran eligibility: kursus harus anggota kampanye patungan
 * yang aktif (status active + dalam jendela waktu), published, dan berbayar.
 */
export const getActivePatunganForCourse = async (
  courseId: number,
  now: Date = new Date()
): Promise<PatunganCampaignRef | null> => {
  const rows = await db
    .select({
      id: promoCampaigns.id,
      slug: promoCampaigns.slug,
      title: promoCampaigns.title,
      badgeLabel: promoCampaigns.badgeLabel,
      status: promoCampaigns.status,
      startsAt: promoCampaigns.startsAt,
      endsAt: promoCampaigns.endsAt,
      priceNominal: courses.priceNominal,
      courseStatus: courses.status,
    })
    .from(promoCourses)
    .innerJoin(promoCampaigns, eq(promoCampaigns.id, promoCourses.campaignId))
    .innerJoin(courses, eq(courses.id, promoCourses.courseId))
    .where(and(eq(promoCourses.courseId, courseId), eq(promoCampaigns.type, "patungan")));
  for (const r of rows.sort((a, b) => b.id - a.id)) {
    if (r.courseStatus !== "published" || r.priceNominal <= 0) continue;
    if (!isCampaignActive({ status: r.status, startsAt: r.startsAt, endsAt: r.endsAt }, now)) continue;
    return { id: r.id, slug: r.slug, title: r.title, badgeLabel: r.badgeLabel, endsAt: r.endsAt };
  }
  return null;
};

// ---------- Resolusi anggota (dipakai validate + create) ----------

export interface ResolvedMember {
  userId: number;
  username: string;
  name: string;
  role: string;
}

export interface ResolvedGroup {
  course: { id: number; title: string; priceLabel: string; priceNominal: number };
  campaign: PatunganCampaignRef;
  creator: ResolvedMember;
  members: ResolvedMember[];
  shares: number[];
}

const toBadRequest = (usernames: string[], code: string, message: string, http = 400) => {
  throw new PatunganError(http, code, message, { usernames });
};

export const resolveGroupMembers = async (
  creatorId: number,
  courseId: number,
  rawUsernames: string[]
): Promise<ResolvedGroup> => {
  const usernames = rawUsernames.map((u) => normalizeUsername(u));
  const invalid = usernames.filter((u) => !isValidUsername(u));
  if (invalid.length > 0) {
    toBadRequest(invalid, "USERNAME_INVALID", `Username tidak valid: ${invalid.join(", ")}`);
  }
  const total = 1 + usernames.length;
  if (total < PATUNGAN_MIN_MEMBERS || total > PATUNGAN_MAX_MEMBERS) {
    throw new PatunganError(
      400,
      "MEMBER_COUNT_INVALID",
      `Jumlah anggota harus ${PATUNGAN_MIN_MEMBERS}–${PATUNGAN_MAX_MEMBERS} orang termasuk pembuat`
    );
  }
  if (new Set(usernames).size !== usernames.length) {
    const dupes = [...new Set(usernames.filter((u, i) => usernames.indexOf(u) !== i))];
    toBadRequest(dupes, "MEMBER_DUPLICATE", `Username ganda: ${dupes.join(", ")}`);
  }

  const courseRows = await db
    .select({
      id: courses.id,
      title: courses.title,
      status: courses.status,
      priceLabel: courses.priceLabel,
      priceNominal: courses.priceNominal,
    })
    .from(courses)
    .where(eq(courses.id, courseId))
    .limit(1);
  const course = courseRows[0];
  if (!course || course.status === "draft") {
    throw new PatunganError(404, "COURSE_NOT_FOUND", "Kursus tidak ditemukan");
  }
  if (course.status === "archived") {
    throw new PatunganError(403, "ENROLLMENT_CLOSED", "Pendaftaran kursus ini sudah ditutup");
  }
  if (course.priceNominal <= 0) {
    throw new PatunganError(400, "COURSE_FREE", "Patungan hanya untuk kursus berbayar");
  }

  const campaign = await getActivePatunganForCourse(courseId);
  if (!campaign) {
    throw new PatunganError(403, "COURSE_NOT_ELIGIBLE", "Kursus ini tidak masuk promo patungan aktif");
  }

  const creatorRows = await db
    .select({ userId: users.id, username: users.username, name: users.name, role: users.role })
    .from(users)
    .where(eq(users.id, creatorId))
    .limit(1);
  const creator = creatorRows[0];
  if (!creator) throw new PatunganError(401, "UNAUTHENTICATED", "Sesi tidak valid. Masuk ulang.");
  if (usernames.includes(creator.username)) {
    toBadRequest([creator.username], "SELF_INCLUDED", "Username sendiri tidak perlu ditulis — pembuat otomatis jadi anggota");
  }

  const userRows = await db
    .select({ userId: users.id, username: users.username, name: users.name, role: users.role })
    .from(users)
    .where(inArray(users.username, usernames));
  const byUsername = new Map(userRows.map((u) => [u.username, u]));
  const missing = usernames.filter((u) => !byUsername.has(u));
  if (missing.length > 0) {
    throw new PatunganError(404, "USER_NOT_FOUND", `Username belum terdaftar: ${missing.join(", ")}`, {
      usernames: missing,
    });
  }
  const members: ResolvedMember[] = usernames.map((u) => byUsername.get(u)!);

  // Blokir yang sudah punya akses (aktif/selesai, pengelola, atau admin).
  const blockedAccess: string[] = [];
  for (const m of [creator, ...members]) {
    if (await hasCourseAccess(m.userId, m.role, courseId)) blockedAccess.push(m.username);
  }
  if (blockedAccess.length > 0) {
    throw new PatunganError(
      409,
      "ALREADY_HAS_ACCESS",
      `Sudah punya akses kursus: ${blockedAccess.join(", ")}`,
      { usernames: blockedAccess }
    );
  }

  // Blokir yang masih punya antrean pembayaran menunggu di kursus ini.
  const allIds = [creator.userId, ...members.map((m) => m.userId)];
  const queued = await db
    .select({ userId: payments.userId })
    .from(payments)
    .where(
      and(eq(payments.courseId, courseId), eq(payments.status, "menunggu"), inArray(payments.userId, allIds))
    );
  if (queued.length > 0) {
    const idToUsername = new Map([creator, ...members].map((m) => [m.userId, m.username]));
    const names = [...new Set(queued.map((q) => idToUsername.get(q.userId) ?? `#${q.userId}`))];
    throw new PatunganError(
      409,
      "PAYMENT_QUEUE_OPEN",
      `Masih ada pembayaran menunggu: ${names.join(", ")}. Selesaikan dulu.`,
      { usernames: names }
    );
  }

  // Satu user maksimal di satu grup non-selesai per kursus.
  const busy = await db
    .select({ userId: patunganGroupMembers.userId })
    .from(patunganGroupMembers)
    .innerJoin(patunganGroups, eq(patunganGroups.id, patunganGroupMembers.groupId))
    .where(
      and(
        eq(patunganGroups.courseId, courseId),
        eq(patunganGroups.status, "pending"),
        inArray(patunganGroupMembers.userId, allIds)
      )
    );
  if (busy.length > 0) {
    const idToUsername = new Map([creator, ...members].map((m) => [m.userId, m.username]));
    const names = [...new Set(busy.map((b) => idToUsername.get(b.userId) ?? `#${b.userId}`))];
    throw new PatunganError(
      409,
      "GROUP_ALREADY_PENDING",
      `Sudah ada di grup patungan pending kursus ini: ${names.join(", ")}`,
      { usernames: names }
    );
  }

  const shares = splitShares(course.priceNominal, total);
  return {
    course: { id: course.id, title: course.title, priceLabel: course.priceLabel, priceNominal: course.priceNominal },
    campaign,
    creator,
    members,
    shares,
  };
};

// ---------- Buat grup ----------

const writePatunganAudit = async (
  tx: DbTx,
  entry: { actorUserId: number | null; action: string; targetIdInt?: number | null; metadata?: Record<string, unknown> }
) => {
  await tx.insert(auditLogs).values({
    actorUserId: entry.actorUserId ?? null,
    action: entry.action,
    targetType: "patungan",
    targetIdInt: entry.targetIdInt ?? null,
    metadata: entry.metadata ?? null,
  });
};

export const createPatunganGroup = async (creatorId: number, courseId: number, rawUsernames: string[]) => {
  const resolved = await resolveGroupMembers(creatorId, courseId, rawUsernames);
  const all = [resolved.creator, ...resolved.members];
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = buildGroupCode();
    try {
      const groupId = await db.transaction(async (tx) => {
        const [h] = await tx.insert(patunganGroups).values({
          code,
          courseId: resolved.course.id,
          promoSlug: resolved.campaign.slug,
          memberCount: all.length,
          priceNominal: resolved.course.priceNominal,
          status: "pending",
          createdBy: creatorId,
        });
        const id = Number((h as unknown as { insertId: number }).insertId);
        await tx.insert(patunganGroupMembers).values(
          all.map((m, i) => ({
            groupId: id,
            userId: m.userId,
            position: i,
            shareAmount: resolved.shares[i] as number,
            paymentStatus: "unpaid" as const,
          }))
        );
        await writePatunganAudit(tx, {
          actorUserId: creatorId,
          action: "patungan.create",
          targetIdInt: id,
          metadata: {
            code,
            courseId: resolved.course.id,
            promoSlug: resolved.campaign.slug,
            memberCount: all.length,
            memberIds: all.map((m) => m.userId),
          },
        });
        return id;
      });
      return getPatunganGroupDetail(creatorId, "student", groupId);
    } catch (e) {
      if (e !== null && typeof e === "object" && "code" in e && e.code === "ER_DUP_ENTRY") {
        continue;
      }
      throw e;
    }
  }
  throw new PatunganError(503, "RETRY_EXHAUSTED", "Coba lagi dalam beberapa saat");
};

// ---------- Baca grup ----------

export interface PatunganGroupDetail {
  id: number;
  code: string;
  status: "pending" | "complete" | "cancelled";
  course: { id: number; title: string; priceLabel: string };
  campaign: { slug: string; title: string } | null;
  memberCount: number;
  priceNominal: number;
  paidCount: number;
  createdBy: number | null;
  cancelReason: string | null;
  completedAt: Date | null;
  createdAt: Date;
  members: Array<{
    userId: number;
    username: string;
    name: string;
    position: number;
    shareAmount: number;
    paymentStatus: "unpaid" | "menunggu" | "diverifikasi" | "ditolak";
    paidAt: Date | null;
    isCreator: boolean;
  }>;
}

const toDetail = (
  g: typeof patunganGroups.$inferSelect,
  course: { id: number; title: string; priceLabel: string },
  memberRows: Array<{
    userId: number;
    username: string;
    name: string;
    position: number;
    shareAmount: number;
    paymentStatus: "unpaid" | "menunggu" | "diverifikasi" | "ditolak";
    paidAt: Date | null;
  }>
): PatunganGroupDetail => ({
  id: g.id,
  code: g.code,
  status: g.status,
  course,
  campaign: g.promoSlug ? { slug: g.promoSlug, title: "" } : null,
  memberCount: g.memberCount,
  priceNominal: g.priceNominal,
  paidCount: memberRows.filter((m) => m.paymentStatus === "diverifikasi").length,
  createdBy: g.createdBy,
  cancelReason: g.cancelReason,
  completedAt: g.completedAt,
  createdAt: g.createdAt,
  members: memberRows
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((m) => ({ ...m, isCreator: m.position === 0 })),
});

const loadGroupDetail = async (groupId: number): Promise<PatunganGroupDetail | null> => {
  const gRows = await db.select().from(patunganGroups).where(eq(patunganGroups.id, groupId)).limit(1);
  const g = gRows[0];
  if (!g) return null;
  const cRows = await db
    .select({ id: courses.id, title: courses.title, priceLabel: courses.priceLabel })
    .from(courses)
    .where(eq(courses.id, g.courseId))
    .limit(1);
  const course = cRows[0] ?? { id: g.courseId, title: "Kursus dihapus", priceLabel: "" };
  const memberRows = await db
    .select({
      userId: patunganGroupMembers.userId,
      username: users.username,
      name: users.name,
      position: patunganGroupMembers.position,
      shareAmount: patunganGroupMembers.shareAmount,
      paymentStatus: patunganGroupMembers.paymentStatus,
      paidAt: patunganGroupMembers.paidAt,
    })
    .from(patunganGroupMembers)
    .innerJoin(users, eq(users.id, patunganGroupMembers.userId))
    .where(eq(patunganGroupMembers.groupId, groupId));
  let campaignTitle = "";
  if (g.promoSlug) {
    const c = await db
      .select({ title: promoCampaigns.title })
      .from(promoCampaigns)
      .where(eq(promoCampaigns.slug, g.promoSlug))
      .limit(1);
    campaignTitle = c[0]?.title ?? "";
  }
  const detail = toDetail(g, course, memberRows);
  if (detail.campaign) detail.campaign.title = campaignTitle;
  return detail;
};

const assertGroupAccess = async (viewerId: number, role: string, groupId: number): Promise<PatunganGroupDetail> => {
  const detail = await loadGroupDetail(groupId);
  if (!detail) throw new PatunganError(404, "GROUP_NOT_FOUND", "Grup patungan tidak ditemukan");
  if (role === "admin") return detail;
  if (!detail.members.some((m) => m.userId === viewerId)) {
    throw new PatunganError(403, "GROUP_FORBIDDEN", "Anda bukan anggota grup ini");
  }
  return detail;
};

export const getPatunganGroupDetail = async (viewerId: number, role: string, groupId: number) =>
  assertGroupAccess(viewerId, role, groupId);

export const listMyPatunganGroups = async (userId: number) => {
  const rows = await db
    .select({
      id: patunganGroups.id,
      code: patunganGroups.code,
      status: patunganGroups.status,
      memberCount: patunganGroups.memberCount,
      priceNominal: patunganGroups.priceNominal,
      createdAt: patunganGroups.createdAt,
      completedAt: patunganGroups.completedAt,
      courseId: patunganGroups.courseId,
      courseTitle: courses.title,
      coursePriceLabel: courses.priceLabel,
    })
    .from(patunganGroupMembers)
    .innerJoin(patunganGroups, eq(patunganGroups.id, patunganGroupMembers.groupId))
    .innerJoin(courses, eq(courses.id, patunganGroups.courseId))
    .where(eq(patunganGroupMembers.userId, userId))
    .orderBy(desc(patunganGroups.id));
  const withCounts = await Promise.all(
    rows.map(async (g) => {
      const paid = await db
        .select({ userId: patunganGroupMembers.userId })
        .from(patunganGroupMembers)
        .where(and(eq(patunganGroupMembers.groupId, g.id), eq(patunganGroupMembers.paymentStatus, "diverifikasi")));
      return { ...g, paidCount: paid.length };
    })
  );
  return withCounts;
};

// ---------- Batal grup ----------

export const cancelPatunganGroup = async (
  actorId: number,
  role: string,
  groupId: number,
  reason?: string
) => {
  const gRows = await db.select().from(patunganGroups).where(eq(patunganGroups.id, groupId)).limit(1);
  const g = gRows[0];
  if (!g) throw new PatunganError(404, "GROUP_NOT_FOUND", "Grup patungan tidak ditemukan");
  if (g.status !== "pending") {
    throw new PatunganError(409, "GROUP_NOT_PENDING", "Hanya grup pending yang bisa dibatalkan");
  }
  const isCreator = g.createdBy === actorId;
  if (role !== "admin") {
    if (!isCreator) throw new PatunganError(403, "GROUP_FORBIDDEN", "Hanya pembuat atau admin yang bisa membatalkan");
    // Pembuat hanya boleh cancel bila belum ada iuran masuk sama sekali.
    const progressed = await db
      .select({ userId: patunganGroupMembers.userId })
      .from(patunganGroupMembers)
      .where(
        and(
          eq(patunganGroupMembers.groupId, groupId),
          inArray(patunganGroupMembers.paymentStatus, ["menunggu", "diverifikasi"] as const)
        )
      );
    if (progressed.length > 0) {
      throw new PatunganError(
        403,
        "CANCEL_NEEDS_ADMIN",
        "Sudah ada iuran masuk — pembatalan harus lewat admin"
      );
    }
  }

  // Iuran yang sudah masuk (menunggu/diverifikasi) wajib ditangani manual
  // di luar sistem (tidak ada refund otomatis via QRIS manual): admin wajib
  // menulis alasan + daftarnya dikembalikan agar bisa ditindaklanjuti.
  const paid = await db
    .select({
      userId: patunganGroupMembers.userId,
      username: users.username,
      name: users.name,
      shareAmount: patunganGroupMembers.shareAmount,
      paymentStatus: patunganGroupMembers.paymentStatus,
      paymentId: patunganGroupMembers.paymentId,
    })
    .from(patunganGroupMembers)
    .innerJoin(users, eq(users.id, patunganGroupMembers.userId))
    .where(
      and(
        eq(patunganGroupMembers.groupId, groupId),
        inArray(patunganGroupMembers.paymentStatus, ["menunggu", "diverifikasi"] as const)
      )
    );
  if (paid.length > 0 && (reason === undefined || reason.trim().length === 0)) {
    throw new PatunganError(
      400,
      "CANCEL_REASON_REQUIRED",
      "Grup ini sudah menerima iuran — tulis alasan pembatalan untuk penanganan manual"
    );
  }
  await db.transaction(async (tx) => {
    await tx
      .update(patunganGroups)
      .set({ status: "cancelled", cancelledBy: actorId, cancelReason: reason ?? null })
      .where(eq(patunganGroups.id, groupId));
    await writePatunganAudit(tx, {
      actorUserId: actorId,
      action: "patungan.cancel",
      targetIdInt: groupId,
      metadata: { groupId, role, reason: reason ?? null, paidMembers: paid },
    });
  });
  return {
    id: groupId,
    status: "cancelled" as const,
    paidMembers: paid.map((p) => ({
      username: p.username,
      name: p.name,
      shareAmount: p.shareAmount,
      paymentStatus: p.paymentStatus,
      paymentId: p.paymentId,
    })),
  };
};

// ---------- Helper untuk modul payments ----------

export interface PatunganPaymentContext {
  groupId: number;
  shareAmount: number;
}

/** Grup pending + keanggotaan pemanggil (untuk pembuatan iuran). */
export const getPendingGroupForMember = async (
  groupId: number,
  userId: number
): Promise<{ group: typeof patunganGroups.$inferSelect; shareAmount: number }> => {
  const gRows = await db.select().from(patunganGroups).where(eq(patunganGroups.id, groupId)).limit(1);
  const g = gRows[0];
  if (!g || g.status !== "pending") {
    throw new PatunganError(404, "GROUP_NOT_FOUND", "Grup patungan tidak ditemukan atau tidak aktif");
  }
  const mRows = await db
    .select({ shareAmount: patunganGroupMembers.shareAmount })
    .from(patunganGroupMembers)
    .where(and(eq(patunganGroupMembers.groupId, groupId), eq(patunganGroupMembers.userId, userId)))
    .limit(1);
  const m = mRows[0];
  if (!m) throw new PatunganError(403, "PATUNGAN_NOT_MEMBER", "Anda bukan anggota grup ini");
  return { group: g, shareAmount: m.shareAmount };
};

/** Tandai status bayar anggota (dipakai saat buat/lampir/verifikasi iuran). */
export const setMemberPaymentState = async (
  tx: DbTx,
  groupId: number,
  userId: number,
  state: { paymentStatus: "menunggu" | "diverifikasi" | "ditolak"; paymentId?: number | null }
) => {
  const patch: Partial<typeof patunganGroupMembers.$inferInsert> = {
    paymentStatus: state.paymentStatus,
    paidAt: state.paymentStatus === "diverifikasi" ? new Date() : null,
  };
  if (state.paymentId !== undefined) patch.paymentId = state.paymentId;
  await tx
    .update(patunganGroupMembers)
    .set(patch)
    .where(and(eq(patunganGroupMembers.groupId, groupId), eq(patunganGroupMembers.userId, userId)));
};

/**
 * Kunci grup + cek kelengkapan. Bila SEMUA anggota diverifikasi:
 * grant akses ke semua sekaligus lalu tandai complete. Idempoten bila
 * dipanggil ulang (grup bukan pending → false). WAJIB dalam transaksi
 * verifikasi pembayaran (anti-race dua approve bersamaan).
 */
export const tryCompleteGroup = async (tx: DbTx, adminId: number, groupId: number): Promise<boolean> => {
  const locked = await tx.select().from(patunganGroups).where(eq(patunganGroups.id, groupId)).for("update").limit(1);
  const g = locked[0];
  if (!g || g.status !== "pending") return false;
  const members = await tx
    .select({ userId: patunganGroupMembers.userId, paymentStatus: patunganGroupMembers.paymentStatus })
    .from(patunganGroupMembers)
    .where(eq(patunganGroupMembers.groupId, groupId))
    .for("update");
  if (members.length === 0) return false;
  if (members.some((m) => m.paymentStatus !== "diverifikasi")) return false;
  for (const m of members) {
    await tx
      .insert(enrollments)
      .values({ userId: m.userId, courseId: g.courseId, source: "payment:patungan", status: "active" })
      .onDuplicateKeyUpdate({ set: { source: "payment:patungan", status: "active" } });
  }
  await tx.update(patunganGroups).set({ status: "complete", completedAt: new Date() }).where(eq(patunganGroups.id, groupId));
  await writePatunganAudit(tx, {
    actorUserId: adminId,
    action: "patungan.complete",
    targetIdInt: groupId,
    metadata: { groupId, courseId: g.courseId, memberCount: members.length },
  });
  return true;
};
