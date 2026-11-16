import bcrypt from "bcryptjs";
import { allocateUsername } from "../../utils/username";
import { z } from "zod";
import { and, desc, eq, gte, inArray, like, lte, or, sql } from "drizzle-orm";
import { db } from "../../db";
import {
  auditLogs,
  certificates,
  courseInstructors,
  courses,
  enrollments,
  payments,
  users,
  voucherRedemptions,
} from "../../db/schema";
import { getInstructorDashboard } from "../dashboard/dashboard.service";

export class AdminError extends Error {
  readonly http: number;
  readonly code: string;
  constructor(http: number, code: string, message: string) {
    super(message);
    this.http = http;
    this.code = code;
  }
}

// ---------- Skema input ----------

export const createTeacherSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    email: z.string().trim().email().max(191),
    password: z.string().min(8).max(72),
  })
  .strict();

export const updateUserSchema = z
  .object({
    name: z.string().trim().min(2, "Nama minimal 2 karakter").max(100).optional(),
    email: z.string().trim().email("Format email tidak valid").max(191).optional(),
    expertise: z.string().trim().max(100, "Keahlian maksimal 100 karakter").optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine(
    (v) =>
      v.name !== undefined ||
      v.email !== undefined ||
      v.expertise !== undefined ||
      v.isActive !== undefined,
    { message: "Minimal satu field (name/email/expertise/isActive) wajib diisi", path: ["body"] }
  );

export const assignInstructorSchema = z
  .object({
    userId: z.number().int().positive().optional(),
    email: z.string().trim().email().max(191).optional(),
  })
  .strict()
  .refine((v) => v.userId !== undefined || v.email !== undefined, {
    message: "userId atau email wajib diisi",
    path: ["userId"],
  });

// ---------- Helper ----------

/** Escape wildcard LIKE (% _ \) agar pencarian admin tidak melebar. */
const escapeLike = (s: string): string => s.replace(/[\\%_]/g, (m) => `\\${m}`);

const writeAuditLog = async (
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  entry: {
    actorUserId: number;
    action: string;
    targetType: string;
    targetIdInt?: number | null;
    metadata?: Record<string, unknown>;
  }
) => {
  await tx.insert(auditLogs).values({
    actorUserId: entry.actorUserId,
    action: entry.action,
    targetType: entry.targetType,
    targetIdInt: entry.targetIdInt ?? null,
    metadata: entry.metadata ?? null,
  });
};

export interface PublicUser {
  id: number;
  name: string;
  username: string;
  email: string;
  expertise: string | null;
  role: string;
  isActive: boolean;
  /** URL konten avatar milik user atau null (relatif server, publik). */
  avatarUrl: string | null;
  /** URL konten sampul profil atau null (relatif server, publik). */
  coverUrl: string | null;
  createdAt: Date;
}

// ---------- Daftar pengguna ----------

export interface UserListFilter {
  role?: "student" | "teacher" | "admin";
  isActive?: boolean;
  q?: string;
  limit?: number;
  page?: number;
}

export const listUsers = async (
  filter: UserListFilter = {}
): Promise<{ items: PublicUser[]; total: number }> => {
  const conditions = [];
  if (filter.role !== undefined) conditions.push(eq(users.role, filter.role));
  if (filter.isActive !== undefined) conditions.push(eq(users.isActive, filter.isActive));
  if (filter.q) {
    const q = escapeLike(filter.q);
    conditions.push(
      or(like(users.name, `%${q}%`), like(users.email, `%${q}%`), like(users.username, `%${q}%`))
    );
  }
  const limit = Math.min(Math.max(filter.limit ?? 20, 1), 100);
  const page = Math.max(filter.page ?? 1, 1);
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const [countRows, rows] = await Promise.all([
    db.select({ n: sql<number>`count(*)` }).from(users).where(where),
    db
      .select({
        id: users.id,
        name: users.name,
        username: users.username,
        email: users.email,
        expertise: users.expertise,
        role: users.role,
        isActive: users.isActive,
        avatarFileId: users.avatarFileId,
        coverFileId: users.coverFileId,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(where)
      .orderBy(desc(users.id))
      .limit(limit)
      .offset((page - 1) * limit),
  ]);
  return {
    items: rows.map((r) => ({
      id: r.id,
      name: r.name,
      username: r.username,
      email: r.email,
      expertise: r.expertise,
      role: r.role,
      isActive: r.isActive,
      avatarUrl: r.avatarFileId ? `/api/v1/files/${r.avatarFileId}/content` : null,
      coverUrl: r.coverFileId ? `/api/v1/files/${r.coverFileId}/content` : null,
      createdAt: r.createdAt,
    })),
    total: Number(countRows[0]?.n ?? 0),
  };
};

// ---------- Ringkasan badge sidebar admin ----------

export interface AdminOverview {
  totalStudents: number;
  totalTeachers: number;
  totalCourses: number;
  totalCertificates: number;
}

/** Hitungan badge + kartu ringkasan admin: 4 agregat ringan paralel (tanpa daftar). */
export const getAdminOverview = async (): Promise<AdminOverview> => {
  const [userRows, courseRows, certRows] = await Promise.all([
    db
      .select({ role: users.role, n: sql<number>`count(*)` })
      .from(users)
      .groupBy(users.role),
    db.select({ n: sql<number>`count(*)` }).from(courses),
    db
      .select({ n: sql<number>`count(*)` })
      .from(certificates)
      .where(eq(certificates.status, "issued")),
  ]);
  const byRole = new Map(userRows.map((r) => [r.role as string, Number(r.n)]));
  return {
    totalStudents: byRole.get("student") ?? 0,
    totalTeachers: byRole.get("teacher") ?? 0,
    totalCourses: Number(courseRows[0]?.n ?? 0),
    totalCertificates: Number(certRows[0]?.n ?? 0),
  };
};

// ---------- Detail satu pengguna ----------

export interface AdminUserDetail extends PublicUser {
  enrollmentCount: number;
  certificateCount: number;
}

/** Detail pengguna untuk halaman admin (tanpa passwordHash). */
export const getUserById = async (id: number): Promise<AdminUserDetail> => {
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      username: users.username,
      email: users.email,
      expertise: users.expertise,
      role: users.role,
      isActive: users.isActive,
      avatarFileId: users.avatarFileId,
      coverFileId: users.coverFileId,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  const user = rows[0];
  if (!user) {
    throw new AdminError(404, "USER_NOT_FOUND", "Pengguna tidak ditemukan");
  }
  const [enrRows, certRows] = await Promise.all([
    db
      .select({ n: sql<number>`count(*)` })
      .from(enrollments)
      .where(eq(enrollments.userId, id)),
    db
      .select({ n: sql<number>`count(*)` })
      .from(certificates)
      .where(eq(certificates.userId, id)),
  ]);
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    email: user.email,
    expertise: user.expertise,
    role: user.role,
    isActive: user.isActive,
    avatarUrl: user.avatarFileId ? `/api/v1/files/${user.avatarFileId}/content` : null,
    coverUrl: user.coverFileId ? `/api/v1/files/${user.coverFileId}/content` : null,
    createdAt: user.createdAt,
    enrollmentCount: Number(enrRows[0]?.n ?? 0),
    certificateCount: Number(certRows[0]?.n ?? 0),
  };
};

// ---------- Buat akun instruktur ----------

export const createTeacher = async (
  actorId: number,
  input: z.infer<typeof createTeacherSchema>
): Promise<PublicUser> => {
  const email = input.email.toLowerCase();
  const dup = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (dup[0]) {
    throw new AdminError(409, "EMAIL_TAKEN", "Email sudah terdaftar");
  }
  const passwordHash = await bcrypt.hash(input.password, 12);
  // Username dialokasikan otomatis (pembuat tidak memilih).
  // Format: dasar dari nama/email + suffix anti-tabrakan bila perlu.
  const username = await allocateUsername(db, input.name);
  const created = await db.transaction(async (tx) => {
    const [h] = await tx.insert(users).values({
      name: input.name,
      username,
      email,
      passwordHash,
      role: "teacher",
      emailVerifiedAt: new Date(),
      isActive: true,
    });
    const id = Number((h as unknown as { insertId: number }).insertId);
    await writeAuditLog(tx, {
      actorUserId: actorId,
      action: "user.create",
      targetType: "user",
      targetIdInt: id,
      metadata: { userId: id, email, username, role: "teacher" },
    });
    const fresh = await tx
      .select({
        id: users.id,
        name: users.name,
        username: users.username,
        email: users.email,
        expertise: users.expertise,
        role: users.role,
        isActive: users.isActive,
        avatarFileId: users.avatarFileId,
        coverFileId: users.coverFileId,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    const row = fresh[0] ?? null;
    return row
      ? {
          id: row.id,
          name: row.name,
          username: row.username,
          email: row.email,
          expertise: row.expertise,
          role: row.role,
          isActive: row.isActive,
          avatarUrl: row.avatarFileId ? `/api/v1/files/${row.avatarFileId}/content` : null,
          coverUrl: row.coverFileId ? `/api/v1/files/${row.coverFileId}/content` : null,
          createdAt: row.createdAt,
        }
      : null;
  });
  if (!created) throw new Error("Gagal membuat akun instruktur");
  return created;
};

// ---------- Ubah akun (nama/email/status) ----------

export const updateUser = async (
  actorId: number,
  targetId: number,
  input: z.infer<typeof updateUserSchema>
): Promise<PublicUser> => {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, targetId))
    .limit(1);
  if (!rows[0]) {
    throw new AdminError(404, "USER_NOT_FOUND", "Pengguna tidak ditemukan");
  }
  // Kunci pengaman diri sendiri hanya untuk status (anti-lockout);
  // nama/email sendiri boleh diubah.
  if (input.isActive !== undefined && targetId === actorId) {
    throw new AdminError(
      400,
      "CANNOT_SELF",
      "Tidak dapat mengubah status akun sendiri"
    );
  }
  const patch: { name?: string; email?: string; expertise?: string | null; isActive?: boolean } = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.email !== undefined) {
    const email = input.email.toLowerCase();
    const dup = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (dup[0] && dup[0].id !== targetId) {
      throw new AdminError(409, "EMAIL_TAKEN", "Email sudah terdaftar");
    }
    patch.email = email;
    // NOTE 2026-11-04: ganti email TIDAK me-reset emailVerifiedAt agar tidak
    // mengunci akun (belum ada alur OTP ulang untuk email gantian admin).
    // Risiko: status verified lama terbawa ke email baru — admin wajib pastikan
    // kepemilikan email baru di luar sistem; lihat API_CONTRACT §14.
  }
  // Username tidak bisa diubah (identitas stabil untuk patungan/audit).
  // String kosong = hapus keahlian (kembali NULL).
  if (input.expertise !== undefined) {
    patch.expertise = input.expertise === "" ? null : input.expertise;
  }
  if (input.isActive !== undefined) patch.isActive = input.isActive;
  const updated = await db.transaction(async (tx) => {
    await tx.update(users).set(patch).where(eq(users.id, targetId));
    await writeAuditLog(tx, {
      actorUserId: actorId,
      action: "user.update",
      targetType: "user",
      targetIdInt: targetId,
      metadata: { userId: targetId, changed: Object.keys(patch) },
    });
    const fresh = await tx
      .select({
        id: users.id,
        name: users.name,
        username: users.username,
        email: users.email,
        expertise: users.expertise,
        role: users.role,
        isActive: users.isActive,
        avatarFileId: users.avatarFileId,
        coverFileId: users.coverFileId,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, targetId))
      .limit(1);
    const row = fresh[0] ?? null;
    return row
      ? {
          id: row.id,
          name: row.name,
          username: row.username,
          email: row.email,
          expertise: row.expertise,
          role: row.role,
          isActive: row.isActive,
          avatarUrl: row.avatarFileId ? `/api/v1/files/${row.avatarFileId}/content` : null,
          coverUrl: row.coverFileId ? `/api/v1/files/${row.coverFileId}/content` : null,
          createdAt: row.createdAt,
        }
      : null;
  });
  if (!updated) throw new Error("Gagal memperbarui akun");
  return updated;
};

// ---------- Penugasan instruktur ----------

export const assignInstructor = async (
  actorId: number,
  courseId: number,
  input: z.infer<typeof assignInstructorSchema>
) => {
  const course = await db
    .select({ id: courses.id, title: courses.title })
    .from(courses)
    .where(eq(courses.id, courseId))
    .limit(1);
  if (!course[0]) {
    throw new AdminError(404, "COURSE_NOT_FOUND", "Kursus tidak ditemukan");
  }
  const target =
    input.userId !== undefined
      ? (
          await db
            .select({ id: users.id, email: users.email, role: users.role })
            .from(users)
            .where(eq(users.id, input.userId))
            .limit(1)
        )[0]
      : (
          await db
            .select({ id: users.id, email: users.email, role: users.role })
            .from(users)
            .where(eq(users.email, input.email!.toLowerCase()))
            .limit(1)
        )[0];
  if (!target) {
    throw new AdminError(404, "USER_NOT_FOUND", "Pengguna target tidak ditemukan");
  }
  if (target.role !== "teacher" && target.role !== "admin") {
    throw new AdminError(
      400,
      "NOT_TEACHER",
      "Hanya akun teacher/admin yang dapat ditugaskan sebagai pengampu"
    );
  }
  await db.transaction(async (tx) => {
    await tx
      .insert(courseInstructors)
      .values({ courseId, userId: target.id })
      .onDuplicateKeyUpdate({ set: { userId: target.id } });
    await writeAuditLog(tx, {
      actorUserId: actorId,
      action: "instructor.assign",
      targetType: "course",
      targetIdInt: courseId,
      metadata: { courseId, userId: target.id, email: target.email },
    });
  });
  return { courseId, userId: target.id, email: target.email, role: target.role };
};

export const unassignInstructor = async (
  actorId: number,
  courseId: number,
  targetId: number
) => {
  const course = await db
    .select({ id: courses.id })
    .from(courses)
    .where(eq(courses.id, courseId))
    .limit(1);
  if (!course[0]) {
    throw new AdminError(404, "COURSE_NOT_FOUND", "Kursus tidak ditemukan");
  }
  const link = await db
    .select({ userId: courseInstructors.userId })
    .from(courseInstructors)
    .where(
      and(
        eq(courseInstructors.courseId, courseId),
        eq(courseInstructors.userId, targetId)
      )
    )
    .limit(1);
  if (!link[0]) {
    throw new AdminError(
      404,
      "ASSIGNMENT_NOT_FOUND",
      "Penugasan tidak ditemukan"
    );
  }
  await db.transaction(async (tx) => {
    await tx
      .delete(courseInstructors)
      .where(
        and(
          eq(courseInstructors.courseId, courseId),
          eq(courseInstructors.userId, targetId)
        )
      );
    await writeAuditLog(tx, {
      actorUserId: actorId,
      action: "instructor.unassign",
      targetType: "course",
      targetIdInt: courseId,
      metadata: { courseId, userId: targetId },
    });
  });
  return { courseId, userId: targetId, removed: true };
};

// ---------- Laporan admin (read-only agregat) ----------

export interface AdminReportsFilter {
  from?: Date;
  to?: Date;
  courseId?: number;
  limit?: number;
  page?: number;
}

export interface AdminReportCourseRow {
  courseId: number;
  title: string;
  status: string;
  studentCount: number;
  avgProgress: number;
  pendingReviews: number;
  revenueVerified: number;
  paymentsMenunggu: number;
  paymentsDiverifikasi: number;
  paymentsDitolak: number;
  certificatesIssued: number;
  certificatesRevoked: number;
}

export interface AdminReportInsightStage {
  stage: "pendaftar" | "enrollment" | "pembayaran" | "sertifikat";
  label: string;
  /** Lingkup hitungan; seluruh tahap kini selalu "filter" (periode/kursus yang sama). */
  basis: "snapshot" | "filter";
  count: number;
  /** Persen (1 desimal) terhadap tahap pertama; 0 bila penyebut nol. */
  pctOfFirst: number;
  /** Persen (1 desimal) terhadap tahap sebelumnya; null untuk tahap pertama. */
  pctOfPrev: number | null;
}

export interface AdminReportInsights {
  funnel: AdminReportInsightStage[];
  rates: {
    paymentApproval: number;
    paymentRejection: number;
    enrollmentCompletion: number;
    certificatePerEnrollment: number;
    /** Pasangan unik (peserta, kursus) ber-sertifikat terbit / enrollment; selalu 0–100. */
    enrollmentCertified: number;
    certificateRevoke: number;
  };
  note: string;
}

export interface AdminReports {
  summary: {
    totalStudents: number;
    totalTeachers: number;
    totalCourses: number;
    totalCertificates: number;
    activeEnrollments: number;
    completedEnrollments: number;
    paymentsMenunggu: number;
    paymentsDiverifikasi: number;
    paymentsDitolak: number;
    revenueVerified: number;
    voucherRedemptions: number;
  };
  perCourse: AdminReportCourseRow[];
  certificates: { issued: number; revoked: number };
  filters: { from?: string; to?: string; courseId?: number };
  paging: { page: number; limit: number; total: number };
  insights: AdminReportInsights;
}

/**
 * Laporan admin: gabungan agregat ringan yang sudah ada.
 * - `overview`: snapshot saat ini (tanpa filter tanggal).
 * - Keuangan/sertifikat/enrollment: hormati `from`/`to`/`courseId` bila diisi.
 * - `avgProgress`/`pendingReviews` per kursus: snapshot saat ini dari
 *   dasbor instruktur (admin melihat semua kursus); tidak difilter tanggal.
 */
export const getAdminReports = async (
  filter: AdminReportsFilter = {}
): Promise<AdminReports> => {
  const { from, to, courseId } = filter;
  // Paginasi daftar per kursus (risiko: sebelumnya dibatasi 100 tanpa halaman).
  // Default 100 menjaga kompatibilitas klien lama (Android) yang tak mengirim limit.
  const limit = Math.min(Math.max(filter.limit ?? 100, 1), 100);
  const page = Math.max(filter.page ?? 1, 1);
  const courseWhere = courseId !== undefined ? eq(courses.id, courseId) : undefined;

  const payConds = [];
  if (from) payConds.push(gte(payments.createdAt, from));
  if (to) payConds.push(lte(payments.createdAt, to));
  if (courseId !== undefined) payConds.push(eq(payments.courseId, courseId));
  const payWhere = payConds.length > 0 ? and(...payConds) : undefined;

  const certConds = [];
  if (from) certConds.push(gte(certificates.issuedAt, from));
  if (to) certConds.push(lte(certificates.issuedAt, to));
  if (courseId !== undefined) certConds.push(eq(certificates.courseId, courseId));
  const certWhere = certConds.length > 0 ? and(...certConds) : undefined;

  const enrConds = [];
  if (from) enrConds.push(gte(enrollments.enrolledAt, from));
  if (to) enrConds.push(lte(enrollments.enrolledAt, to));
  if (courseId !== undefined) enrConds.push(eq(enrollments.courseId, courseId));
  const enrWhere = enrConds.length > 0 ? and(...enrConds) : undefined;

  const voucherConds = [];
  if (from) voucherConds.push(gte(voucherRedemptions.redeemedAt, from));
  if (to) voucherConds.push(lte(voucherRedemptions.redeemedAt, to));
  if (courseId !== undefined) voucherConds.push(eq(voucherRedemptions.courseId, courseId));
  const voucherWhere = voucherConds.length > 0 ? and(...voucherConds) : undefined;

  const [overview, dash, payRows, enrRows, certRows, voucherRows, courseCountRows, courseRows, certifiedCountRows] =
    await Promise.all([
      getAdminOverview(),
      getInstructorDashboard(0, "admin"),
      db
        .select({
          status: payments.status,
          n: sql<number>`count(*)`,
          revenue: sql<number>`coalesce(sum(case when ${payments.status} = 'diverifikasi' then ${payments.amountPaid} else 0 end), 0)`,
        })
        .from(payments)
        .where(payWhere)
        .groupBy(payments.status),
      db
        .select({ status: enrollments.status, n: sql<number>`count(*)` })
        .from(enrollments)
        .where(enrWhere)
        .groupBy(enrollments.status),
      db
        .select({ status: certificates.status, n: sql<number>`count(*)` })
        .from(certificates)
        .where(certWhere)
        .groupBy(certificates.status),
      db
        .select({ n: sql<number>`count(*)` })
        .from(voucherRedemptions)
        .where(voucherWhere),
      db.select({ n: sql<number>`count(*)` }).from(courses).where(courseWhere),
      db
        .select({ id: courses.id, title: courses.title, status: courses.status })
        .from(courses)
        .where(courseWhere)
        .orderBy(courses.id)
        .limit(limit)
        .offset((page - 1) * limit),
      // Pasangan unik (peserta, kursus) yang punya sertifikat terbit —
      // metrik terbatas 0–100 (sertifikat per modul bisa >100% per enrollment).
      db
        .select({ n: sql<number>`count(*)` })
        .from(
          db
            .selectDistinct({ u: certificates.userId, c: certificates.courseId })
            .from(certificates)
            .where(and(eq(certificates.status, "issued"), certWhere))
            .as("cert_pairs")
        ),
    ]);

  const payByStatus = new Map(payRows.map((r) => [r.status as string, r]));
  const enrByStatus = new Map(enrRows.map((r) => [r.status as string, Number(r.n ?? 0)]));
  const certByStatus = new Map(certRows.map((r) => [r.status as string, Number(r.n ?? 0)]));

  const num = (v: unknown): number => (typeof v === "number" ? v : Number(v ?? 0) || 0);
  const paymentsMenunggu = num(payByStatus.get("menunggu")?.n);
  const paymentsDiverifikasi = num(payByStatus.get("diverifikasi")?.n);
  const paymentsDitolak = num(payByStatus.get("ditolak")?.n);
  const revenueVerified = payRows.reduce((s, r) => s + num(r.revenue), 0);

  // Rincian per kursus mengikuti halaman yang diminta (sudah paginasi server).
  const targetIds = courseRows.map((c) => c.id);
  const [revRows, pendRows, denyRows, certCourseRows] =
    targetIds.length === 0
      ? [
          [],
          [],
          [],
          [] as Array<{ courseId: number; status: string; n: number }>,
        ]
      : await Promise.all([
          db
            .select({
              courseId: payments.courseId,
              n: sql<number>`count(*)`,
              revenue: sql<number>`coalesce(sum(${payments.amountPaid}), 0)`,
            })
            .from(payments)
            .where(
              and(
                inArray(payments.courseId, targetIds),
                eq(payments.status, "diverifikasi"),
                ...(from ? [gte(payments.createdAt, from)] : []),
                ...(to ? [lte(payments.createdAt, to)] : [])
              )
            )
            .groupBy(payments.courseId),
          db
            .select({ courseId: payments.courseId, n: sql<number>`count(*)` })
            .from(payments)
            .where(
              and(
                inArray(payments.courseId, targetIds),
                eq(payments.status, "menunggu"),
                ...(from ? [gte(payments.createdAt, from)] : []),
                ...(to ? [lte(payments.createdAt, to)] : [])
              )
            )
            .groupBy(payments.courseId),
          db
            .select({ courseId: payments.courseId, n: sql<number>`count(*)` })
            .from(payments)
            .where(
              and(
                inArray(payments.courseId, targetIds),
                eq(payments.status, "ditolak"),
                ...(from ? [gte(payments.createdAt, from)] : []),
                ...(to ? [lte(payments.createdAt, to)] : [])
              )
            )
            .groupBy(payments.courseId),
          db
            .select({
              courseId: certificates.courseId,
              status: certificates.status,
              n: sql<number>`count(*)` ,
            })
            .from(certificates)
            .where(
              and(
                inArray(certificates.courseId, targetIds),
                ...(from ? [gte(certificates.issuedAt, from)] : []),
                ...(to ? [lte(certificates.issuedAt, to)] : [])
              )
            )
            .groupBy(certificates.courseId, certificates.status),
        ]);
  const revByCourse = new Map(
    (revRows as Array<{ courseId: number; n: number; revenue: number }>).map((r) => [
      r.courseId,
      { n: num(r.n), revenue: num(r.revenue) },
    ])
  );
  const pendByCourse = new Map(
    (pendRows as Array<{ courseId: number; n: number }>).map((r) => [r.courseId, num(r.n)])
  );
  const denyByCourse = new Map(
    (denyRows as Array<{ courseId: number; n: number }>).map((r) => [r.courseId, num(r.n)])
  );
  const certByCourse = new Map<string, number>();
  for (const r of certCourseRows as Array<{ courseId: number; status: string; n: number }>) {
    certByCourse.set(`${r.courseId}:${r.status}`, num(r.n));
  }
  const dashByCourse = new Map(dash.courses.map((c) => [c.id, c]));

  const perCourse: AdminReportCourseRow[] = courseRows.map((c) => {
    const d = dashByCourse.get(c.id);
    return {
      courseId: c.id,
      title: c.title,
      status: c.status,
      studentCount: d?.studentCount ?? 0,
      avgProgress: d?.avgProgress ?? 0,
      pendingReviews: d?.pendingCount ?? 0,
      revenueVerified: revByCourse.get(c.id)?.revenue ?? 0,
      paymentsMenunggu: pendByCourse.get(c.id) ?? 0,
      paymentsDiverifikasi: revByCourse.get(c.id)?.n ?? 0,
      paymentsDitolak: denyByCourse.get(c.id) ?? 0,
      certificatesIssued: certByCourse.get(`${c.id}:issued`) ?? 0,
      certificatesRevoked: certByCourse.get(`${c.id}:revoked`) ?? 0,
    };
  });

  // Wawasan alur + persentase (dihitung server agar konsisten antar klien).
  // Seluruh tahap memakai LINGKUP FILTER YANG SAMA (risiko basis campur
  // diperbaiki): tahap 1 = pendaftar pada periode filter, atau peserta unik
  // kursus bila filter kursus diisi; tahap 2–4 = enrollment/pembayaran/
  // sertifikat pada lingkup yang sama.
  const pct1 = (n: number, d: number): number => (d > 0 ? Math.round((n / d) * 1000) / 10 : 0);
  let stage1Count: number;
  let stage1Label = "Pendaftar";
  if (courseId !== undefined) {
    stage1Label = "Peserta kursus";
    const scopeConds = [eq(enrollments.courseId, courseId)];
    if (from) scopeConds.push(gte(enrollments.enrolledAt, from));
    if (to) scopeConds.push(lte(enrollments.enrolledAt, to));
    const scopedUsers = db
      .selectDistinct({ u: enrollments.userId })
      .from(enrollments)
      .where(and(...scopeConds))
      .as("stage1_users");
    const scopedRows = await db.select({ n: sql<number>`count(*)` }).from(scopedUsers);
    stage1Count = Number(scopedRows[0]?.n ?? 0);
  } else {
    const scopeConds = [eq(users.role, "student")];
    if (from) scopeConds.push(gte(users.createdAt, from));
    if (to) scopeConds.push(lte(users.createdAt, to));
    const scopedRows = await db
      .select({ n: sql<number>`count(*)` })
      .from(users)
      .where(and(...scopeConds));
    stage1Count = Number(scopedRows[0]?.n ?? 0);
  }
  const totalEnrollments =
    (enrByStatus.get("active") ?? 0) + (enrByStatus.get("completed") ?? 0);
  const totalPayments = paymentsMenunggu + paymentsDiverifikasi + paymentsDitolak;
  const totalCerts = (certByStatus.get("issued") ?? 0) + (certByStatus.get("revoked") ?? 0);
  const funnelCounts = [
    stage1Count,
    totalEnrollments,
    paymentsDiverifikasi,
    certByStatus.get("issued") ?? 0,
  ];
  const funnelMeta = [
    { stage: "pendaftar", label: stage1Label, basis: "filter" },
    { stage: "enrollment", label: "Enrollment", basis: "filter" },
    { stage: "pembayaran", label: "Pembayaran diverifikasi", basis: "filter" },
    { stage: "sertifikat", label: "Sertifikat terbit", basis: "filter" },
  ] as const;
  const funnel: AdminReportInsightStage[] = funnelCounts.map((count, i) => ({
    stage: funnelMeta[i].stage,
    label: funnelMeta[i].label,
    basis: funnelMeta[i].basis,
    count,
    pctOfFirst: pct1(count, funnelCounts[0]),
    // null bila tahap pertama ATAU tahap sebelumnya nol (rasio tak terdefinisi,
    // bukan 0% — mis. sertifikat terbit tanpa pembayaran pada kursus gratis).
    pctOfPrev: i === 0 || funnelCounts[i - 1] === 0 ? null : pct1(count, funnelCounts[i - 1]),
  }));

  const isoDay = (d: Date): string => d.toISOString().slice(0, 10);
  return {
    summary: {
      totalStudents: overview.totalStudents,
      totalTeachers: overview.totalTeachers,
      totalCourses: overview.totalCourses,
      totalCertificates: overview.totalCertificates,
      activeEnrollments: enrByStatus.get("active") ?? 0,
      completedEnrollments: enrByStatus.get("completed") ?? 0,
      paymentsMenunggu,
      paymentsDiverifikasi,
      paymentsDitolak,
      revenueVerified,
      voucherRedemptions: Number(voucherRows[0]?.n ?? 0),
    },
    perCourse,
    certificates: {
      issued: certByStatus.get("issued") ?? 0,
      revoked: certByStatus.get("revoked") ?? 0,
    },
    filters: {
      ...(from ? { from: isoDay(from) } : {}),
      ...(to ? { to: isoDay(to) } : {}),
      ...(courseId !== undefined ? { courseId } : {}),
    },
    paging: {
      page,
      limit,
      total: Number(courseCountRows[0]?.n ?? 0),
    },
    insights: {
      funnel,
      rates: {
        paymentApproval: pct1(paymentsDiverifikasi, totalPayments),
        paymentRejection: pct1(paymentsDitolak, totalPayments),
        enrollmentCompletion: pct1(enrByStatus.get("completed") ?? 0, totalEnrollments),
        certificatePerEnrollment: pct1(certByStatus.get("issued") ?? 0, totalEnrollments),
        enrollmentCertified: pct1(Number(certifiedCountRows[0]?.n ?? 0), totalEnrollments),
        certificateRevoke: pct1(certByStatus.get("revoked") ?? 0, totalCerts),
      },
      note: "Seluruh tahap memakai lingkup filter tanggal/kursus yang sama: tahap 1 = pendaftar periode ini (atau peserta unik kursus bila filter kursus diisi). Tiap tahap dihitung independen dari tabelnya (bukan satu kohort yang sama mengalir), sehingga tahap berikutnya bisa lebih besar — mis. sertifikat terbit tanpa pembayaran pada kursus gratis/voucher.",
    },
  };
};
