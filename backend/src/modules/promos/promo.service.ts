import { z } from "zod";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "../../db";
import {
  auditLogs,
  courses,
  courseInstructors,
  patunganGroups,
  payments,
  promoCampaigns,
  promoCourseProposals,
  promoCourses,
  users,
} from "../../db/schema";

export class PromoError extends Error {
  readonly http: number;
  readonly code: string;
  constructor(http: number, code: string, message: string) {
    super(message);
    this.http = http;
    this.code = code;
  }
}

// ---------- Skema input (diskon fase 1: percent-only 1–90) ----------

const slugPattern = /^[a-z0-9-]{3,100}$/;

const isoDateTime = z
  .string()
  .trim()
  .max(100)
  .refine((v) => v === "" || !Number.isNaN(new Date(v).getTime()), {
    message: "Format tanggal tidak valid (gunakan ISO, mis. 2026-12-31T23:59:59)",
  })
  .transform((v) => (v === "" ? undefined : v));

const coverImageUrl = z
  .string()
  .trim()
  .max(500)
  .refine(
    (v) =>
      v === "" ||
      v.startsWith("/") ||
      /^https?:\/\/.+/i.test(v),
    { message: "Sampul harus URL http(s) atau path /api/..." },
  )
  .transform((v) => (v === "" ? undefined : v));

export const createCampaignSchema = z
  .object({
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .min(3)
      .max(100)
      .refine((v) => slugPattern.test(v), {
        message: "Slug 3–100 karakter (huruf kecil, angka, tanda -)",
      }),
    title: z.string().trim().min(3).max(200),
    badgeLabel: z.string().trim().min(2).max(100).optional(),
    coverImage: coverImageUrl.optional(),
    type: z.enum(["diskon", "kurasi", "patungan"]).default("diskon"),
    discountPercent: z.number().int().min(1).max(90).optional(),
    status: z.enum(["draft", "active", "archived"]).default("draft"),
    startsAt: isoDateTime.optional(),
    endsAt: isoDateTime.optional(),
  })
  .strict()
  .refine((v) => v.type !== "diskon" || v.discountPercent !== undefined, {
    message: "Promo diskon wajib punya discountPercent 1–90",
    path: ["discountPercent"],
  })
  .refine((v) => v.type === "diskon" || v.discountPercent === undefined, {
    message: "Hanya promo diskon yang boleh punya discountPercent",
    path: ["discountPercent"],
  })
  .refine(
    (v) =>
      v.startsAt === undefined ||
      v.endsAt === undefined ||
      new Date(v.startsAt).getTime() <= new Date(v.endsAt).getTime(),
    { message: "startsAt harus sebelum atau sama dengan endsAt", path: ["endsAt"] }
  );

export const patchCampaignSchema = z
  .object({
    title: z.string().trim().min(3).max(200).optional(),
    badgeLabel: z.string().trim().min(2).max(100).nullable().optional(),
    coverImage: coverImageUrl.nullable().optional(),
    type: z.enum(["diskon", "kurasi", "patungan"]).optional(),
    discountPercent: z.number().int().min(1).max(90).nullable().optional(),
    status: z.enum(["draft", "active", "archived"]).optional(),
    startsAt: isoDateTime.nullable().optional(),
    endsAt: isoDateTime.nullable().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, {
    message: "Minimal satu field wajib diisi",
  })
  .refine(
    (v) =>
      v.startsAt === undefined ||
      v.endsAt === undefined ||
      v.startsAt === null ||
      v.endsAt === null ||
      new Date(v.startsAt).getTime() <= new Date(v.endsAt).getTime(),
    { message: "startsAt harus sebelum atau sama dengan endsAt", path: ["endsAt"] }
  );

export const addCourseSchema = z
  .object({
    courseId: z.number().int().positive(),
    position: z.number().int().min(0).max(10000).default(0),
    customBadge: z.string().trim().min(2).max(100).optional(),
    // Harga khusus patungan (total grup) untuk kursus ini.
    // Hanya bermakna bila kampanye bertipe patungan.
    patunganPrice: z.number().int().min(1000).max(1000000000).optional(),
  })
  .strict();

/** Usulan instruktur: kursus miliknya + badge/harga patungan usulan + catatan. */
export const proposePromoSchema = z
  .object({
    courseId: z.number().int().positive(),
    customBadge: z.string().trim().min(2).max(100).optional(),
    // Hanya bermakna bila kampanye bertipe patungan (ditegakkan di service).
    patunganPrice: z.number().int().min(1000).max(1000000000).optional(),
    note: z.string().trim().max(500).optional(),
  })
  .strict();

export const decideProposalSchema = z
  .object({
    note: z.string().trim().max(500).optional(),
  })
  .strict();

// ---------- Helper ----------

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const writePromoAudit = async (
  tx: DbTx,
  entry: {
    actorUserId: number;
    action: string;
    targetIdInt?: number | null;
    targetIdStr?: string | null;
    metadata?: Record<string, unknown>;
  }
) => {
  await tx.insert(auditLogs).values({
    actorUserId: entry.actorUserId,
    action: entry.action,
    targetType: "promo",
    targetIdInt: entry.targetIdInt ?? null,
    targetIdStr: entry.targetIdStr ?? null,
    metadata: entry.metadata ?? null,
  });
};

const toDateOrNull = (v: string | null | undefined): Date | null => {
  if (v === undefined || v === null) return null;
  const t = new Date(v);
  return Number.isNaN(t.getTime()) ? null : t;
};

/** Kampanye dianggap aktif bila status active + di dalam jendela waktu. */
export const isCampaignActive = (
  c: { status: string; startsAt: Date | null; endsAt: Date | null },
  now: Date = new Date()
): boolean => {
  if (c.status !== "active") return false;
  if (c.startsAt !== null && c.startsAt.getTime() > now.getTime()) return false;
  if (c.endsAt !== null && c.endsAt.getTime() < now.getTime()) return false;
  return true;
};

/** Diskon rupiah dari persen (dibulatkan ke bawah, tidak melebihi harga). */
export const promoDiscountAmount = (priceNominal: number, percent: number): number =>
  Math.min(Math.max(0, Math.floor(priceNominal)), Math.floor((Math.max(0, Math.floor(priceNominal)) * percent) / 100));

export interface ActivePromoQuote {
  slug: string;
  title: string;
  badgeLabel: string | null;
  discountPercent: number;
  discountAmount: number;
  endsAt: Date | null;
}

/**
 * Promo diskon aktif terbaik untuk satu kursus (persen terbesar menang).
 * Dipakai pembayaran: pemenang vs voucher (non-stack, terbesar menang).
 */
export const getActivePromoForCourse = async (
  courseId: number,
  priceNominal: number,
  now: Date = new Date()
): Promise<ActivePromoQuote | null> => {
  const rows = await db
    .select({
      slug: promoCampaigns.slug,
      title: promoCampaigns.title,
      badgeLabel: promoCampaigns.badgeLabel,
      discountPercent: promoCampaigns.discountPercent,
      status: promoCampaigns.status,
      startsAt: promoCampaigns.startsAt,
      endsAt: promoCampaigns.endsAt,
    })
    .from(promoCourses)
    .innerJoin(promoCampaigns, eq(promoCampaigns.id, promoCourses.campaignId))
    .where(eq(promoCourses.courseId, courseId));
  let best: ActivePromoQuote | null = null;
  for (const r of rows) {
    if (r.discountPercent === null) continue;
    if (!isCampaignActive({ status: r.status, startsAt: r.startsAt, endsAt: r.endsAt }, now)) continue;
    const amount = promoDiscountAmount(priceNominal, r.discountPercent);
    if (best === null || r.discountPercent > best.discountPercent) {
      best = {
        slug: r.slug,
        title: r.title,
        badgeLabel: r.badgeLabel,
        discountPercent: r.discountPercent,
        discountAmount: amount,
        endsAt: r.endsAt,
      };
    }
  }
  return best;
};

/**
 * Kuote promo publik untuk satu kursus (dipakai pratinjau/pembayaran
 * untuk menampilkan harga promo; sumber diskon tetap server).
 */
export const getPromoQuoteForCourse = async (
  courseId: number,
  now: Date = new Date()
): Promise<(ActivePromoQuote & { promoPrice: number; priceNominal: number }) | null> => {
  const rows = await db
    .select({ priceNominal: courses.priceNominal, status: courses.status })
    .from(courses)
    .where(eq(courses.id, courseId))
    .limit(1);
  const course = rows[0];
  if (!course || course.status !== "published" || course.priceNominal <= 0) return null;
  const best = await getActivePromoForCourse(courseId, course.priceNominal, now);
  if (!best) return null;
  return {
    ...best,
    promoPrice: Math.max(0, course.priceNominal - best.discountAmount),
    priceNominal: course.priceNominal,
  };
};

// ---------- Kelola (admin) ----------

export const createCampaign = async (
  actorId: number,
  input: z.infer<typeof createCampaignSchema>
) => {
  const dup = await db
    .select({ id: promoCampaigns.id })
    .from(promoCampaigns)
    .where(eq(promoCampaigns.slug, input.slug))
    .limit(1);
  if (dup[0]) throw new PromoError(409, "SLUG_TAKEN", "Slug promo sudah digunakan");
  try {
    return await db.transaction(async (tx) => {
      const [h] = await tx.insert(promoCampaigns).values({
        slug: input.slug,
        title: input.title,
        badgeLabel: input.badgeLabel ?? null,
        coverImage: input.coverImage ?? null,
        type: input.type,
        discountPercent: input.type === "diskon" ? (input.discountPercent as number) : null,
        status: input.status,
        startsAt: toDateOrNull(input.startsAt),
        endsAt: toDateOrNull(input.endsAt),
        createdBy: actorId,
      });
      const id = Number((h as unknown as { insertId: number }).insertId);
      await writePromoAudit(tx, {
        actorUserId: actorId,
        action: "promo.create",
        targetIdInt: id,
        targetIdStr: input.slug,
        metadata: { slug: input.slug, type: input.type },
      });
      const rows = await tx.select().from(promoCampaigns).where(eq(promoCampaigns.id, id)).limit(1);
      return rows[0]!;
    });
  } catch (e) {
    if (e !== null && typeof e === "object" && "code" in e && (e as { code: unknown }).code === "ER_DUP_ENTRY") {
      throw new PromoError(409, "SLUG_TAKEN", "Slug promo sudah digunakan");
    }
    throw e;
  }
};

export const patchCampaign = async (
  actorId: number,
  slug: string,
  input: z.infer<typeof patchCampaignSchema>
) => {
  const rows = await db.select().from(promoCampaigns).where(eq(promoCampaigns.slug, slug)).limit(1);
  const cur = rows[0];
  if (!cur) throw new PromoError(404, "PROMO_NOT_FOUND", "Promo tidak ditemukan");
  const nextType = input.type ?? cur.type;
  const nextPercent =
    input.discountPercent !== undefined ? input.discountPercent : cur.discountPercent;
  if (nextType !== "diskon" && nextPercent !== null) {
    throw new PromoError(400, "DISCOUNT_FORBIDDEN", "Hanya promo diskon yang boleh punya discountPercent");
  }
  if (nextType === "diskon" && (nextPercent === null || nextPercent === undefined)) {
    throw new PromoError(400, "DISCOUNT_REQUIRED", "Promo diskon wajib punya discountPercent 1–90");
  }
  const patch: Partial<typeof promoCampaigns.$inferInsert> = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.badgeLabel !== undefined) patch.badgeLabel = input.badgeLabel;
  if (input.coverImage !== undefined) patch.coverImage = input.coverImage;
  if (input.type !== undefined) patch.type = input.type;
  if (input.discountPercent !== undefined) {
    patch.discountPercent = nextType === "diskon" ? (input.discountPercent as number) : null;
  }
  if (input.status !== undefined) patch.status = input.status;
  if (input.startsAt !== undefined) patch.startsAt = toDateOrNull(input.startsAt);
  if (input.endsAt !== undefined) patch.endsAt = toDateOrNull(input.endsAt);
  if (nextType !== "diskon") patch.discountPercent = null;
  // Validasi jendela efektif (nilai lama + patch): cegah kampanye mati selamanya.
  const effStarts = patch.startsAt !== undefined ? patch.startsAt : (cur.startsAt as Date | null);
  const effEnds = patch.endsAt !== undefined ? patch.endsAt : (cur.endsAt as Date | null);
  if (effStarts !== null && effEnds !== null && effStarts.getTime() > effEnds.getTime()) {
    throw new PromoError(400, "INVALID_WINDOW", "startsAt harus sebelum atau sama dengan endsAt");
  }
  await db.transaction(async (tx) => {
    await tx.update(promoCampaigns).set(patch).where(eq(promoCampaigns.id, cur.id));
    await writePromoAudit(tx, {
      actorUserId: actorId,
      action: "promo.update",
      targetIdInt: cur.id,
      targetIdStr: cur.slug,
      metadata: { slug: cur.slug, changed: Object.keys(patch) },
    });
  });
  const fresh = await db.select().from(promoCampaigns).where(eq(promoCampaigns.id, cur.id)).limit(1);
  return fresh[0]!;
};

/**
 * Hapus kampanye promo beserta keanggotaannya (transaksional + audit).
 * Riwayat pembayaran/grup patungan tidak ikut terhapus (hanya menyimpan
 * snapshot slug sebagai string) — tetapi penghapusan ditolak bila masih ada
 * grup patungan pending atau antrean pembayaran menunggu yang menunjuk slug
 * ini, agar alur berjalan tidak yatim.
 */
export const deleteCampaign = async (actorId: number, slug: string) => {
  const rows = await db.select().from(promoCampaigns).where(eq(promoCampaigns.slug, slug)).limit(1);
  const c = rows[0];
  if (!c) throw new PromoError(404, "PROMO_NOT_FOUND", "Promo tidak ditemukan");

  const [pendingGroups, waitingPayments] = await Promise.all([
    db
      .select({ id: patunganGroups.id })
      .from(patunganGroups)
      .where(and(eq(patunganGroups.promoSlug, c.slug), eq(patunganGroups.status, "pending")))
      .limit(1),
    db
      .select({ id: payments.id })
      .from(payments)
      .where(and(eq(payments.promoSlug, c.slug), eq(payments.status, "menunggu")))
      .limit(1),
  ]);
  if (pendingGroups[0] || waitingPayments[0]) {
    throw new PromoError(
      409,
      "PROMO_IN_USE",
      "Promo masih dipakai antrean aktif (grup patungan pending / pembayaran menunggu). Selesaikan atau batalkan dulu."
    );
  }

  const memberRows = await db
    .select({ n: sql<number>`count(*)` })
    .from(promoCourses)
    .where(eq(promoCourses.campaignId, c.id));
  await db.transaction(async (tx) => {
    await tx.delete(promoCourses).where(eq(promoCourses.campaignId, c.id));
    await tx.delete(promoCampaigns).where(eq(promoCampaigns.id, c.id));
    await writePromoAudit(tx, {
      actorUserId: actorId,
      action: "promo.delete",
      targetIdInt: c.id,
      targetIdStr: c.slug,
      metadata: { slug: c.slug, type: c.type, removedMembers: Number(memberRows[0]?.n ?? 0) },
    });
  });
  return { slug: c.slug, removed: true as const };
};

export const addCourseToCampaign = async (
  actorId: number,
  slug: string,
  input: z.infer<typeof addCourseSchema>
) => {  const camp = await db.select().from(promoCampaigns).where(eq(promoCampaigns.slug, slug)).limit(1);
  const c = camp[0];
  if (!c) throw new PromoError(404, "PROMO_NOT_FOUND", "Promo tidak ditemukan");
  const course = await db
    .select({ id: courses.id, status: courses.status, priceNominal: courses.priceNominal })
    .from(courses)
    .where(eq(courses.id, input.courseId))
    .limit(1);
  if (!course[0]) throw new PromoError(404, "COURSE_NOT_FOUND", "Kursus tidak ditemukan");
  if (course[0].status === "draft") {
    throw new PromoError(400, "COURSE_DRAFT", "Kursus draft tidak bisa masuk promo (terbitkan dulu)");
  }
  if (course[0].status === "archived") {
    throw new PromoError(400, "COURSE_ARCHIVED", "Kursus arsip tidak bisa masuk promo");
  }
  if (c.type === "diskon" && (course[0].priceNominal ?? 0) <= 0) {
    throw new PromoError(400, "COURSE_FREE", "Promo diskon hanya untuk kursus berbayar");
  }
  if (input.patunganPrice !== undefined && c.type !== "patungan") {
    throw new PromoError(400, "PATUNGAN_PRICE_FORBIDDEN", "Harga patungan hanya untuk promo bertipe patungan");
  }
  try {
    await db.transaction(async (tx) => {
      await tx.insert(promoCourses).values({
        campaignId: c.id,
        courseId: input.courseId,
        position: input.position,
        customBadge: input.customBadge ?? null,
        patunganPrice: c.type === "patungan" ? (input.patunganPrice ?? null) : null,
      });
      await writePromoAudit(tx, {
        actorUserId: actorId,
        action: "promo.course.add",
        targetIdInt: c.id,
        targetIdStr: c.slug,
        metadata: { slug: c.slug, courseId: input.courseId },
      });
    });
  } catch (e) {
    if (e !== null && typeof e === "object" && "code" in e && (e as { code: unknown }).code === "ER_DUP_ENTRY") {
      throw new PromoError(409, "ALREADY_INCLUDED", "Kursus ini sudah ada di promo tersebut");
    }
    throw e;
  }
  return { slug: c.slug, courseId: input.courseId };
};

export const removeCourseFromCampaign = async (actorId: number, slug: string, courseId: number) => {
  const camp = await db.select().from(promoCampaigns).where(eq(promoCampaigns.slug, slug)).limit(1);
  const c = camp[0];
  if (!c) throw new PromoError(404, "PROMO_NOT_FOUND", "Promo tidak ditemukan");
  await db.transaction(async (tx) => {
    await tx
      .delete(promoCourses)
      .where(and(eq(promoCourses.campaignId, c.id), eq(promoCourses.courseId, courseId)));
    await writePromoAudit(tx, {
      actorUserId: actorId,
      action: "promo.course.remove",
      targetIdInt: c.id,
      targetIdStr: c.slug,
      metadata: { slug: c.slug, courseId },
    });
  });
  return { slug: c.slug, courseId };
};

// ---------- Pengajuan instruktur (butuh approve admin) ----------

/** true bila user boleh mengajukan kursus (admin atau pengampu/pembuat). */
const isCourseManager = async (
  userId: number,
  role: string,
  courseId: number
): Promise<boolean> => {
  if (role === "admin") return true;
  const [course] = await db
    .select({ createdBy: courses.createdBy })
    .from(courses)
    .where(eq(courses.id, courseId))
    .limit(1);
  if (!course) return false;
  if (course.createdBy === userId) return true;
  const link = await db
    .select({ courseId: courseInstructors.courseId })
    .from(courseInstructors)
    .where(
      and(
        eq(courseInstructors.courseId, courseId),
        eq(courseInstructors.userId, userId)
      )
    )
    .limit(1);
  return link.length > 0;
};

const assertProposableCourse = (
  camp: { type: string },
  course: { status: string; priceNominal: number },
  patunganPrice: number | undefined
): void => {
  // Aturan sama seperti tambah langsung (fail fast; dicek ulang saat approve).
  if (course.status === "draft") {
    throw new PromoError(400, "COURSE_DRAFT", "Kursus draft tidak bisa masuk promo (terbitkan dulu)");
  }
  if (course.status === "archived") {
    throw new PromoError(400, "COURSE_ARCHIVED", "Kursus arsip tidak bisa masuk promo");
  }
  if (camp.type === "diskon" && (course.priceNominal ?? 0) <= 0) {
    throw new PromoError(400, "COURSE_FREE", "Promo diskon hanya untuk kursus berbayar");
  }
  if (patunganPrice !== undefined && camp.type !== "patungan") {
    throw new PromoError(400, "PATUNGAN_PRICE_FORBIDDEN", "Harga patungan hanya untuk promo bertipe patungan");
  }
};

/** Instruktur mengajukan kursusnya ke sebuah kampanye (status pending). */
export const createProposal = async (
  proposerId: number,
  role: string,
  slug: string,
  input: z.infer<typeof proposePromoSchema>
) => {
  const camp = await db.select().from(promoCampaigns).where(eq(promoCampaigns.slug, slug)).limit(1);
  const c = camp[0];
  if (!c) throw new PromoError(404, "PROMO_NOT_FOUND", "Promo tidak ditemukan");
  const course = await db
    .select({ id: courses.id, status: courses.status, priceNominal: courses.priceNominal })
    .from(courses)
    .where(eq(courses.id, input.courseId))
    .limit(1);
  if (!course[0]) throw new PromoError(404, "COURSE_NOT_FOUND", "Kursus tidak ditemukan");
  if (!(await isCourseManager(proposerId, role, input.courseId))) {
    throw new PromoError(403, "NOT_YOUR_COURSE", "Hanya kursus yang kamu ampu yang bisa diajukan ke promo");
  }
  assertProposableCourse(c, course[0], input.patunganPrice);
  const member = await db
    .select({ courseId: promoCourses.courseId })
    .from(promoCourses)
    .where(and(eq(promoCourses.campaignId, c.id), eq(promoCourses.courseId, input.courseId)))
    .limit(1);
  if (member[0]) throw new PromoError(409, "ALREADY_INCLUDED", "Kursus ini sudah ada di promo tersebut");
  const pending = await db
    .select({ id: promoCourseProposals.id })
    .from(promoCourseProposals)
    .where(
      and(
        eq(promoCourseProposals.campaignId, c.id),
        eq(promoCourseProposals.courseId, input.courseId),
        eq(promoCourseProposals.status, "pending")
      )
    )
    .limit(1);
  if (pending[0]) {
    throw new PromoError(409, "PROPOSAL_EXISTS", "Pengajuan untuk kursus ini masih menunggu keputusan admin");
  }
  const id = await db.transaction(async (tx) => {
    const [h] = await tx.insert(promoCourseProposals).values({
      campaignId: c.id,
      courseId: input.courseId,
      proposedBy: proposerId,
      customBadge: input.customBadge ?? null,
      patunganPrice: c.type === "patungan" ? (input.patunganPrice ?? null) : null,
      note: input.note ?? null,
    });
    const newId = Number((h as unknown as { insertId: number }).insertId);
    await writePromoAudit(tx, {
      actorUserId: proposerId,
      action: "promo.proposal.create",
      targetIdInt: c.id,
      targetIdStr: c.slug,
      metadata: { slug: c.slug, courseId: input.courseId },
    });
    return newId;
  });
  const rows = await db.select().from(promoCourseProposals).where(eq(promoCourseProposals.id, id)).limit(1);
  return rows[0]!;
};

/** Riwayat pengajuan milik instruktur (beserta info kampanye + kursus). */
export const listMyProposals = async (userId: number) => {
  const rows = await db
    .select({
      id: promoCourseProposals.id,
      campaignSlug: promoCampaigns.slug,
      campaignTitle: promoCampaigns.title,
      campaignType: promoCampaigns.type,
      courseId: promoCourseProposals.courseId,
      courseTitle: courses.title,
      customBadge: promoCourseProposals.customBadge,
      patunganPrice: promoCourseProposals.patunganPrice,
      note: promoCourseProposals.note,
      status: promoCourseProposals.status,
      decidedNote: promoCourseProposals.decidedNote,
      seenAt: promoCourseProposals.seenAt,
      createdAt: promoCourseProposals.createdAt,
      decidedAt: promoCourseProposals.decidedAt,
    })
    .from(promoCourseProposals)
    .innerJoin(promoCampaigns, eq(promoCampaigns.id, promoCourseProposals.campaignId))
    .innerJoin(courses, eq(courses.id, promoCourseProposals.courseId))
    .where(eq(promoCourseProposals.proposedBy, userId))
    .orderBy(desc(promoCourseProposals.id));
  return rows;
};

/**
 * Tandai semua keputusan atas pengajuanku sudah dibaca.
 * Hanya baris yang sudah diputuskan (bukan pending) dan belum dibaca.
 * Mengembalikan jumlah yang ditandai (untuk toast/badge).
 */
export const markProposalsSeen = async (userId: number): Promise<{ seen: number }> => {
  const [res] = (await db
    .update(promoCourseProposals)
    .set({ seenAt: new Date() })
    .where(
      and(
        eq(promoCourseProposals.proposedBy, userId),
        inArray(promoCourseProposals.status, ["approved", "rejected"]),
        isNull(promoCourseProposals.seenAt)
      )
    )) as unknown as Array<{ affectedRows?: number }>;
  const affected = Number(res?.affectedRows ?? 0);
  return { seen: Number.isInteger(affected) && affected > 0 ? affected : 0 };
};

/**
 * Kursus milik instruktur yang sudah masuk promo (termasuk yang
 * ditambahkan langsung oleh admin) — agar terlihat di portal instruktur.
 */
export const listInstructorPromoMemberships = async (userId: number) => {
  const links = await db
    .select({ courseId: courseInstructors.courseId })
    .from(courseInstructors)
    .where(eq(courseInstructors.userId, userId));
  const created = await db
    .select({ id: courses.id })
    .from(courses)
    .where(eq(courses.createdBy, userId));
  const owned = new Set([...links.map((l) => l.courseId), ...created.map((c) => c.id)]);
  if (owned.size === 0) return [];
  const rows = await db
    .select({
      slug: promoCampaigns.slug,
      title: promoCampaigns.title,
      type: promoCampaigns.type,
      discountPercent: promoCampaigns.discountPercent,
      status: promoCampaigns.status,
      endsAt: promoCampaigns.endsAt,
      courseId: promoCourses.courseId,
      courseTitle: courses.title,
      customBadge: promoCourses.customBadge,
      patunganPrice: promoCourses.patunganPrice,
    })
    .from(promoCourses)
    .innerJoin(promoCampaigns, eq(promoCampaigns.id, promoCourses.campaignId))
    .innerJoin(courses, eq(courses.id, promoCourses.courseId))
    .where(inArray(promoCourses.courseId, [...owned]))
    .orderBy(desc(promoCampaigns.id));
  return rows;
};

/** Antrean pengajuan untuk admin (filter status opsional). */
export const listProposalsAdmin = async (filter: { status?: string } = {}) => {
  const conditions = [];
  if (filter.status === "pending" || filter.status === "approved" || filter.status === "rejected") {
    conditions.push(eq(promoCourseProposals.status, filter.status));
  }
  const rows = await db
    .select({
      id: promoCourseProposals.id,
      campaignSlug: promoCampaigns.slug,
      campaignTitle: promoCampaigns.title,
      campaignType: promoCampaigns.type,
      courseId: promoCourseProposals.courseId,
      courseTitle: courses.title,
      courseStatus: courses.status,
      priceNominal: courses.priceNominal,
      customBadge: promoCourseProposals.customBadge,
      patunganPrice: promoCourseProposals.patunganPrice,
      note: promoCourseProposals.note,
      status: promoCourseProposals.status,
      proposedBy: promoCourseProposals.proposedBy,
      proposerName: users.name,
      decidedNote: promoCourseProposals.decidedNote,
      createdAt: promoCourseProposals.createdAt,
      decidedAt: promoCourseProposals.decidedAt,
    })
    .from(promoCourseProposals)
    .innerJoin(promoCampaigns, eq(promoCampaigns.id, promoCourseProposals.campaignId))
    .innerJoin(courses, eq(courses.id, promoCourseProposals.courseId))
    .leftJoin(users, eq(users.id, promoCourseProposals.proposedBy))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(promoCourseProposals.id));
  return rows;
};

/** Admin menyetujui: kursus masuk promo (aturan sama seperti tambah langsung). */
export const approveProposal = async (adminId: number, proposalId: number) => {
  const rows = await db
    .select()
    .from(promoCourseProposals)
    .where(eq(promoCourseProposals.id, proposalId))
    .limit(1);
  const p = rows[0];
  if (!p) throw new PromoError(404, "PROPOSAL_NOT_FOUND", "Pengajuan tidak ditemukan");
  if (p.status !== "pending") {
    throw new PromoError(409, "PROPOSAL_DECIDED", "Pengajuan ini sudah diputuskan");
  }
  const camp = await db.select().from(promoCampaigns).where(eq(promoCampaigns.id, p.campaignId)).limit(1);
  const c = camp[0];
  if (!c) throw new PromoError(404, "PROMO_NOT_FOUND", "Promo tidak ditemukan");
  const course = await db
    .select({ id: courses.id, status: courses.status, priceNominal: courses.priceNominal })
    .from(courses)
    .where(eq(courses.id, p.courseId))
    .limit(1);
  if (!course[0]) throw new PromoError(404, "COURSE_NOT_FOUND", "Kursus tidak ditemukan");
  assertProposableCourse(c, course[0], p.patunganPrice ?? undefined);
  const member = await db
    .select({ courseId: promoCourses.courseId })
    .from(promoCourses)
    .where(and(eq(promoCourses.campaignId, c.id), eq(promoCourses.courseId, p.courseId)))
    .limit(1);
  if (member[0]) throw new PromoError(409, "ALREADY_INCLUDED", "Kursus ini sudah ada di promo tersebut");
  try {
    await db.transaction(async (tx) => {
      await tx.insert(promoCourses).values({
        campaignId: c.id,
        courseId: p.courseId,
        position: 0,
        customBadge: p.customBadge,
        patunganPrice: c.type === "patungan" ? (p.patunganPrice ?? null) : null,
      });
      await tx
        .update(promoCourseProposals)
        .set({ status: "approved", decidedBy: adminId, decidedAt: new Date() })
        .where(eq(promoCourseProposals.id, p.id));
      await writePromoAudit(tx, {
        actorUserId: adminId,
        action: "promo.proposal.approve",
        targetIdInt: c.id,
        targetIdStr: c.slug,
        metadata: { slug: c.slug, courseId: p.courseId, proposalId: p.id },
      });
    });
  } catch (e) {
    if (e !== null && typeof e === "object" && "code" in e && (e as { code: unknown }).code === "ER_DUP_ENTRY") {
      throw new PromoError(409, "ALREADY_INCLUDED", "Kursus ini sudah ada di promo tersebut");
    }
    throw e;
  }
  const fresh = await db.select().from(promoCourseProposals).where(eq(promoCourseProposals.id, p.id)).limit(1);
  return fresh[0]!;
};

/** Admin menolak pengajuan (beserta catatan keputusan opsional). */
export const rejectProposal = async (adminId: number, proposalId: number, decidedNote?: string) => {
  const rows = await db
    .select()
    .from(promoCourseProposals)
    .where(eq(promoCourseProposals.id, proposalId))
    .limit(1);
  const p = rows[0];
  if (!p) throw new PromoError(404, "PROPOSAL_NOT_FOUND", "Pengajuan tidak ditemukan");
  if (p.status !== "pending") {
    throw new PromoError(409, "PROPOSAL_DECIDED", "Pengajuan ini sudah diputuskan");
  }
  await db.transaction(async (tx) => {
    await tx
      .update(promoCourseProposals)
      .set({ status: "rejected", decidedBy: adminId, decidedAt: new Date(), decidedNote: decidedNote ?? null })
      .where(eq(promoCourseProposals.id, p.id));
    await writePromoAudit(tx, {
      actorUserId: adminId,
      action: "promo.proposal.reject",
      targetIdInt: p.campaignId,
      targetIdStr: null,
      metadata: { courseId: p.courseId, proposalId: p.id },
    });
  });
  const fresh = await db.select().from(promoCourseProposals).where(eq(promoCourseProposals.id, p.id)).limit(1);
  return fresh[0]!;
};

export const listCampaignsAdmin = async (filter: { status?: string; type?: string } = {}) => {  const conditions = [];
  if (filter.status !== undefined) conditions.push(eq(promoCampaigns.status, filter.status as "draft"));
  if (filter.type !== undefined) conditions.push(eq(promoCampaigns.type, filter.type as "diskon"));
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const rows = await db
    .select()
    .from(promoCampaigns)
    .where(where)
    .orderBy(desc(promoCampaigns.id));
  const counts = await db
    .select({ campaignId: promoCourses.campaignId, n: sql<number>`count(*)` })
    .from(promoCourses)
    .groupBy(promoCourses.campaignId);
  const byCampaign = new Map(counts.map((r) => [r.campaignId, Number(r.n)]));
  return rows.map((r) => ({ ...r, courseCount: byCampaign.get(r.id) ?? 0 }));
};

// ---------- Baca publik ----------

export interface PublicPromoCourse {
  courseId: number;
  title: string;
  image: string | null;
  priceLabel: string;
  priceNominal: number;
  discountPercent: number | null;
  promoPrice: number | null;
  badgeLabel: string | null;
  promoEndsAt: Date | null;
  /** Harga khusus patungan (total grup); null = ikut harga kursus. */
  patunganPrice: number | null;
}

const coursePromoShape = async (campaignId: number, discountPercent: number | null) => {
  const rows = await db
    .select({
      courseId: promoCourses.courseId,
      position: promoCourses.position,
      customBadge: promoCourses.customBadge,
      patunganPrice: promoCourses.patunganPrice,
      title: courses.title,
      image: courses.image,
      priceLabel: courses.priceLabel,
      priceNominal: courses.priceNominal,
      status: courses.status,
    })
    .from(promoCourses)
    .innerJoin(courses, eq(courses.id, promoCourses.courseId))
    .where(eq(promoCourses.campaignId, campaignId))
    .orderBy(asc(promoCourses.position), asc(promoCourses.courseId));
  return rows
    .filter((r) => r.status === "published")
    .map((r) => ({
      courseId: r.courseId,
      title: r.title,
      image: r.image,
      priceLabel: r.priceLabel,
      priceNominal: r.priceNominal,
      discountPercent,
      promoPrice:
        discountPercent === null
          ? null
          : Math.max(0, r.priceNominal - promoDiscountAmount(r.priceNominal, discountPercent)),
      badgeLabel: r.customBadge,
      promoEndsAt: null as Date | null,
      patunganPrice: r.patunganPrice,
    }));
};

export const listPublicCampaigns = async (now: Date = new Date()) => {
  const rows = await db
    .select()
    .from(promoCampaigns)
    .where(eq(promoCampaigns.status, "active"))
    .orderBy(desc(promoCampaigns.id));
  const active = rows.filter((c) =>
    isCampaignActive({ status: c.status, startsAt: c.startsAt, endsAt: c.endsAt }, now)
  );
  if (active.length === 0) return [];
  // Batch: 1 query members untuk semua kampanye (dulu N query).
  const mrows = await db
    .select({
      campaignId: promoCourses.campaignId,
      courseId: promoCourses.courseId,
      position: promoCourses.position,
      customBadge: promoCourses.customBadge,
      patunganPrice: promoCourses.patunganPrice,
      title: courses.title,
      image: courses.image,
      priceLabel: courses.priceLabel,
      priceNominal: courses.priceNominal,
      status: courses.status,
    })
    .from(promoCourses)
    .innerJoin(courses, eq(courses.id, promoCourses.courseId))
    .where(
      inArray(
        promoCourses.campaignId,
        active.map((c) => c.id)
      )
    )
    .orderBy(asc(promoCourses.position), asc(promoCourses.courseId));
  const byCampaign = new Map<number, typeof mrows>();
  for (const r of mrows) {
    const arr = byCampaign.get(r.campaignId);
    if (arr) arr.push(r);
    else byCampaign.set(r.campaignId, [r]);
  }
  return active.map((c) => {
    const members = (byCampaign.get(c.id) ?? [])
      .filter((r) => r.status === "published")
      .map((r) => {
        const discountPercent = c.type === "diskon" ? c.discountPercent : null;
        return {
          courseId: r.courseId,
          title: r.title,
          image: r.image,
          priceLabel: r.priceLabel,
          priceNominal: r.priceNominal,
          discountPercent,
          promoPrice:
            discountPercent === null
              ? null
              : Math.max(0, r.priceNominal - promoDiscountAmount(r.priceNominal, discountPercent)),
          badgeLabel: r.customBadge,
          promoEndsAt: null as Date | null,
          patunganPrice: r.patunganPrice,
        };
      });
    return {
      slug: c.slug,
      title: c.title,
      badgeLabel: c.badgeLabel,
      coverImage: c.coverImage ?? null,
      type: c.type,
      discountPercent: c.type === "diskon" ? c.discountPercent : null,
      startsAt: c.startsAt,
      endsAt: c.endsAt,
      courses: members.map((m) => ({ ...m, badgeLabel: m.badgeLabel ?? c.badgeLabel, promoEndsAt: c.endsAt })),
    };
  });
};

export const getPublicCampaign = async (slug: string, now: Date = new Date()) => {
  const rows = await db.select().from(promoCampaigns).where(eq(promoCampaigns.slug, slug)).limit(1);
  const c = rows[0];
  if (!c || !isCampaignActive({ status: c.status, startsAt: c.startsAt, endsAt: c.endsAt }, now)) {
    throw new PromoError(404, "PROMO_NOT_FOUND", "Promo tidak ditemukan atau sudah berakhir");
  }
  const members = await coursePromoShape(c.id, c.type === "diskon" ? c.discountPercent : null);
  return {
    slug: c.slug,
    title: c.title,
    badgeLabel: c.badgeLabel,
    coverImage: c.coverImage ?? null,
    type: c.type,
    discountPercent: c.type === "diskon" ? c.discountPercent : null,
    startsAt: c.startsAt,
    endsAt: c.endsAt,
    courses: members.map((m) => ({ ...m, badgeLabel: m.badgeLabel ?? c.badgeLabel, promoEndsAt: c.endsAt })),
  };
};

/**
 * Detail untuk admin: tanpa filter status/jendela agar kampanye draft pun
 * bisa dilengkapi anggotanya sebelum diaktifkan.
 */
export const getAdminCampaign = async (slug: string) => {
  const rows = await db.select().from(promoCampaigns).where(eq(promoCampaigns.slug, slug)).limit(1);
  const c = rows[0];
  if (!c) throw new PromoError(404, "PROMO_NOT_FOUND", "Promo tidak ditemukan");
  const members = await db
    .select({
      courseId: promoCourses.courseId,
      position: promoCourses.position,
      customBadge: promoCourses.customBadge,
      patunganPrice: promoCourses.patunganPrice,
      title: courses.title,
      status: courses.status,
      priceNominal: courses.priceNominal,
    })
    .from(promoCourses)
    .innerJoin(courses, eq(courses.id, promoCourses.courseId))
    .where(eq(promoCourses.campaignId, c.id))
    .orderBy(asc(promoCourses.position), asc(promoCourses.courseId));
  return { ...c, courses: members };
};
