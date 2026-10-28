import { randomBytes } from "node:crypto";
import { z } from "zod";
import { and, asc, desc, eq, gte, inArray, like, lte, or, sql } from "drizzle-orm";
import { db } from "../../db";
import {
  auditLogs,
  certificates,
  courseInstructors,
  courses,
  enrollments,
  materials,
  modules,
  progress,
  quizAttempts,
  submissions,
  users,
} from "../../db/schema";
import { canManageCourse } from "../courses/course.service";
import {
  canReadCourseTree,
  getModule,
  listMaterialsByModule,
} from "../courses/curricula.service";
import { getBest } from "../quiz/quiz.service";
import { getProgress } from "../progress/progress.service";
import { getTaskStatus } from "../submissions/submission.service";
import { hasCourseAccess } from "../enrollments/enrollment.service";

// ---------- Skema input ----------

export const issueInputSchema = z
  .object({
    displayName: z.string().trim().min(2).max(100).optional(),
  })
  .strict();

export const revokeInputSchema = z.object({
  reason: z.string().trim().min(5).max(500),
});

export class CertificateError extends Error {
  readonly http: number;
  readonly code: string;
  readonly details: unknown;
  constructor(http: number, code: string, message: string, details?: unknown) {
    super(message);
    this.http = http;
    this.code = code;
    this.details = details;
  }
}

// ---------- Bentuk baca ----------

export type RequirementState =
  | "selesai"
  | "belum"
  | "lulus"
  | "belum_lulus"
  | "menunggu";

export interface RequirementItem {
  materialId: number;
  title: string;
  type: string;
  state: RequirementState;
  extra: string | null;
}

export interface Eligibility {
  moduleId: number;
  courseId: number;
  eligible: boolean;
  requirements: RequirementItem[];
  failReasons: string[];
  certificate: {
    id: number;
    code: string;
    status: string;
  } | null;
}

export interface PublicCertificate {
  id: number;
  code: string;
  recipientName: string;
  courseId: number;
  courseTitle: string;
  moduleId: number;
  moduleTitle: string;
  status: string;
  issuedAt: Date;
  revokedAt: Date | null;
  revokeReason: string | null;
}

const toPublicCertificate = (row: {
  id: number;
  code: string;
  recipientName: string;
  courseId: number;
  courseTitle: string;
  moduleId: number;
  moduleTitle: string;
  status: string;
  issuedAt: Date;
  revokedAt: Date | null;
  revokeReason: string | null;
}): PublicCertificate => ({ ...row });

const certWithTitles = async (certId: number): Promise<PublicCertificate | null> => {
  const rows = await db
    .select({
      id: certificates.id,
      code: certificates.code,
      recipientName: certificates.recipientName,
      courseId: certificates.courseId,
      courseTitle: courses.title,
      moduleId: certificates.moduleId,
      moduleTitle: modules.title,
      status: certificates.status,
      issuedAt: certificates.issuedAt,
      revokedAt: certificates.revokedAt,
      revokeReason: certificates.revokeReason,
    })
    .from(certificates)
    .innerJoin(courses, eq(courses.id, certificates.courseId))
    .innerJoin(modules, eq(modules.id, certificates.moduleId))
    .where(eq(certificates.id, certId))
    .limit(1);
  return rows[0] ? toPublicCertificate(rows[0]) : null;
};

// ---------- Kelayakan ----------

/** Evaluasi kelayakan satu peserta pada satu modul (semua materi = wajib). */
export const getModuleEligibility = async (
  userId: number,
  role: string,
  moduleId: number
): Promise<Eligibility> => {
  const mod = await getModule(moduleId);
  if (!mod) {
    throw new CertificateError(404, "MODULE_NOT_FOUND", "Modul tidak ditemukan");
  }
  const courseId = mod.courseId;
  const verdict = await canReadCourseTree(userId, role, courseId);
  if (verdict !== "ok") {
    throw new CertificateError(404, "MODULE_NOT_FOUND", "Modul tidak ditemukan");
  }
  if (!(await hasCourseAccess(userId, role, courseId))) {
    throw new CertificateError(
      403,
      "NO_ACCESS",
      "Anda tidak memiliki akses ke kursus ini"
    );
  }
  const mats = await listMaterialsByModule(moduleId);
  const existing = await db
    .select({ id: certificates.id, code: certificates.code, status: certificates.status })
    .from(certificates)
    .where(
      and(
        eq(certificates.userId, userId),
        eq(certificates.moduleId, moduleId)
      )
    )
    .limit(1);
  const certificate = existing[0] ?? null;

  const requirements: RequirementItem[] = [];
  const failReasons: string[] = [];
  if (mats.length === 0) {
    failReasons.push("Modul belum memiliki materi");
  }
  for (const m of mats) {
    if (m.type === "kuis") {
      const best = await getBest(userId, m.id);
      const passed = best.attempts > 0 && best.passed;
      requirements.push({
        materialId: m.id,
        title: m.title,
        type: m.type,
        state: passed ? "lulus" : best.attempts > 0 ? "belum_lulus" : "belum",
        extra: best.attempts > 0 ? `Terbaik ${best.bestScore}` : null,
      });
      if (!passed) failReasons.push(`Kuis belum lulus: ${m.title}`);
    } else if (m.type === "tugas") {
      const st = await getTaskStatus(userId, role, m.id);
      const waiting =
        !st.passed &&
        st.attempts > 0 &&
        st.lastStatus !== null &&
        ["submitted", "reviewed"].includes(st.lastStatus);
      requirements.push({
        materialId: m.id,
        title: m.title,
        type: m.type,
        state: st.passed ? "lulus" : waiting ? "menunggu" : "belum_lulus",
        extra:
          st.attempts > 0
            ? `${st.attempts}x kumpul${st.bestScore !== null ? `, skor ${st.bestScore}` : ""}`
            : null,
      });
      if (!st.passed) {
        failReasons.push(
          waiting
            ? `Tugas menunggu penilaian: ${m.title}`
            : `Tugas belum lulus: ${m.title}`
        );
      }
    } else {
      const done = (await getProgress(userId, m.id)) !== null;
      requirements.push({
        materialId: m.id,
        title: m.title,
        type: m.type,
        state: done ? "selesai" : "belum",
        extra: null,
      });
      if (!done) failReasons.push(`Materi belum selesai: ${m.title}`);
    }
  }
  return {
    moduleId,
    courseId,
    eligible: mats.length > 0 && failReasons.length === 0,
    requirements,
    failReasons,
    certificate,
  };
};

// ---------- Penerbitan ----------

const genCode = (): string =>
  `ATS-${new Date().getFullYear()}-${randomBytes(4).toString("hex").toUpperCase()}`;

export interface IssueResult {
  certificate: PublicCertificate;
  created: boolean;
}

/** Terbitkan sertifikat modul (idempoten; anti-ganda via UNIQUE + transaksi). */
export const issueCertificate = async (
  userId: number,
  role: string,
  moduleId: number,
  input: z.infer<typeof issueInputSchema>
): Promise<IssueResult> => {
  const eg = await getModuleEligibility(userId, role, moduleId);
  if (!eg.eligible) {
    throw new CertificateError(
      403,
      "NOT_ELIGIBLE",
      `Belum memenuhi syarat sertifikat: ${eg.failReasons[0] ?? "periksa kembali progres belajar"}`,
      { failReasons: eg.failReasons, requirements: eg.requirements }
    );
  }
  const owners = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const recipientName = input.displayName ?? owners[0]?.name ?? "Peserta";
  const snapshot = {
    evaluatedAt: new Date().toISOString(),
    materials: eg.requirements.map((r) => ({
      materialId: r.materialId,
      title: r.title,
      type: r.type,
      state: r.state,
    })),
  };

  const findExisting = async () => {
    const rows = await db
      .select({ id: certificates.id })
      .from(certificates)
      .where(
        and(
          eq(certificates.userId, userId),
          eq(certificates.moduleId, moduleId)
        )
      )
      .limit(1);
    return rows[0]?.id ?? null;
  };

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const createdId = await db.transaction(async (tx) => {
        const dup = await tx
          .select({ id: certificates.id, status: certificates.status })
          .from(certificates)
          .where(
            and(
              eq(certificates.userId, userId),
              eq(certificates.moduleId, moduleId)
            )
          )
          .limit(1);
        if (dup[0]) return { id: dup[0].id, created: false, status: dup[0].status };
        const [h] = await tx.insert(certificates).values({
          userId,
          courseId: eg.courseId,
          moduleId,
          code: genCode(),
          recipientName,
          requirementsSnapshot: snapshot,
          status: "issued",
        });
        const id = Number((h as unknown as { insertId: number }).insertId);
        await tx.insert(auditLogs).values({
          actorUserId: userId,
          action: "certificate.issue",
          targetType: "certificate",
          targetIdInt: id,
          metadata: { certificateId: id, userId, moduleId, courseId: eg.courseId },
        });
        return { id, created: true as boolean, status: "issued" as string };
      });
      if (!createdId.created) {
        if (createdId.status === "revoked") {
          throw new CertificateError(
            409,
            "CERT_REVOKED",
            "Sertifikat modul ini pernah dicabut; hubungi admin"
          );
        }
        const cert = await certWithTitles(createdId.id);
        if (!cert) throw new Error("Gagal membaca sertifikat");
        return { certificate: cert, created: false };
      }
      const cert = await certWithTitles(createdId.id);
      if (!cert) throw new Error("Gagal membaca sertifikat");
      return { certificate: cert, created: true };
    } catch (e) {
      if (
        e instanceof CertificateError ||
        !(e !== null && typeof e === "object" && "code" in e)
      ) {
        throw e;
      }
      const code = (e as { code?: unknown }).code;
      if (code !== "ER_DUP_ENTRY") throw e;
      // Balapan kode atau baris: baca ulang; bila baris milik sendiri ada → idempoten.
      const id = await findExisting();
      if (id !== null) {
        const cert = await certWithTitles(id);
        if (!cert) throw new Error("Gagal membaca sertifikat");
        if (cert.status === "revoked") {
          throw new CertificateError(
            409,
            "CERT_REVOKED",
            "Sertifikat modul ini pernah dicabut; hubungi admin"
          );
        }
        return { certificate: cert, created: false };
      }
      // Tabrakan kode acak milik orang lain: coba lagi dengan kode baru.
    }
  }
  throw new Error("Gagal menerbitkan sertifikat setelah beberapa percobaan");
};

// ---------- Daftar milik sendiri ----------

export const listMyCertificates = async (
  userId: number
): Promise<PublicCertificate[]> => {
  const rows = await db
    .select({
      id: certificates.id,
      code: certificates.code,
      recipientName: certificates.recipientName,
      courseId: certificates.courseId,
      courseTitle: courses.title,
      moduleId: certificates.moduleId,
      moduleTitle: modules.title,
      status: certificates.status,
      issuedAt: certificates.issuedAt,
      revokedAt: certificates.revokedAt,
      revokeReason: certificates.revokeReason,
    })
    .from(certificates)
    .innerJoin(courses, eq(courses.id, certificates.courseId))
    .innerJoin(modules, eq(modules.id, certificates.moduleId))
    .where(eq(certificates.userId, userId))
    .orderBy(desc(certificates.issuedAt), desc(certificates.id));
  return rows.map(toPublicCertificate);
};

// ---------- Verifikasi publik (minimal, aman) ----------

export interface PublicVerification {
  code: string;
  recipientName: string;
  courseTitle: string;
  moduleTitle: string;
  status: string;
  issuedAt: Date;
  revokedAt: Date | null;
}

export const verifyCertificate = async (
  code: string
): Promise<PublicVerification> => {
  const rows = await db
    .select({
      code: certificates.code,
      recipientName: certificates.recipientName,
      courseTitle: courses.title,
      moduleTitle: modules.title,
      status: certificates.status,
      issuedAt: certificates.issuedAt,
      revokedAt: certificates.revokedAt,
    })
    .from(certificates)
    .innerJoin(courses, eq(courses.id, certificates.courseId))
    .innerJoin(modules, eq(modules.id, certificates.moduleId))
    .where(eq(certificates.code, code.trim().toUpperCase()))
    .limit(1);
  if (!rows[0]) {
    throw new CertificateError(
      404,
      "CODE_NOT_FOUND",
      "Kode sertifikat tidak ditemukan"
    );
  }
  return rows[0];
};

// ---------- Cakupan instruktur ----------

/** Daftar id kursus yang dikelola (admin: null = semua). */
const managedCourseIds = async (
  userId: number,
  role: string
): Promise<number[] | null> => {
  if (role === "admin") return null;
  // Dihitung langsung (hindari impor sirkular via course.service).
  const a = await db
    .select({ id: courseInstructors.courseId })
    .from(courseInstructors)
    .where(eq(courseInstructors.userId, userId));
  const b = await db
    .select({ id: courses.id })
    .from(courses)
    .where(eq(courses.createdBy, userId));
  return [...new Set([...a.map((r) => r.id), ...b.map((r) => r.id)])];
};

export type InstructorCertificateStatus = "aktif" | "dicabut";

/** Item sertifikat untuk UI instruktur (kontrak frontend certificates.ts). */
export interface InstructorCertificateItem {
  id: number;
  code: string;
  studentName: string;
  printedName: string;
  /** Nama snapshot (kompatibel lama). */
  recipientName: string;
  courseId: number;
  courseTitle: string;
  moduleId: number;
  moduleTitle: string;
  issuedAt: Date;
  status: InstructorCertificateStatus;
  revokedAt: Date | null;
  revokeReason: string | null;
}

const toInstructorItem = (row: {
  id: number;
  code: string;
  recipientName: string;
  studentName: string;
  courseId: number;
  courseTitle: string;
  moduleId: number;
  moduleTitle: string;
  status: string;
  issuedAt: Date;
  revokedAt: Date | null;
  revokeReason: string | null;
}): InstructorCertificateItem => ({
  id: row.id,
  code: row.code,
  studentName: row.studentName,
  printedName: row.recipientName,
  recipientName: row.recipientName,
  courseId: row.courseId,
  courseTitle: row.courseTitle,
  moduleId: row.moduleId,
  moduleTitle: row.moduleTitle,
  issuedAt: row.issuedAt,
  status: row.status === "revoked" ? "dicabut" : "aktif",
  revokedAt: row.revokedAt,
  revokeReason: row.revokeReason,
});

/** Normalisasi status filter frontend (aktif/dicabut) ke nilai DB. */
const normalizeCertStatus = (
  s: string | undefined
): "issued" | "revoked" | undefined => {
  if (s === "issued" || s === "aktif") return "issued";
  if (s === "revoked" || s === "dicabut") return "revoked";
  return undefined;
};

export interface CertificateListFilter {
  courseId?: number;
  moduleId?: number;
  status?: "issued" | "revoked" | "aktif" | "dicabut";
  q?: string;
  from?: string;
  to?: string;
  limit?: number;
  page?: number;
}

/** Riwayat sertifikat untuk admin / instruktur pemilik (termasuk yang dicabut). */
export const listCertificates = async (
  viewerId: number,
  role: string,
  filter: CertificateListFilter = {}
): Promise<{ items: InstructorCertificateItem[]; total: number }> => {
  const managed = await managedCourseIds(viewerId, role);
  if (managed !== null) {
    if (managed.length === 0) return { items: [], total: 0 };
    if (filter.courseId !== undefined && !managed.includes(filter.courseId)) {
      throw new CertificateError(
        403,
        "NOT_MANAGER",
        "Bukan pengelola kursus tersebut"
      );
    }
  }
  const conditions = [];
  if (filter.courseId !== undefined) {
    conditions.push(eq(certificates.courseId, filter.courseId));
  } else if (managed !== null) {
    conditions.push(inArray(certificates.courseId, managed));
  }
  if (filter.moduleId !== undefined) {
    if (managed !== null) {
      const mods = await db
        .select({ courseId: modules.courseId })
        .from(modules)
        .where(eq(modules.id, filter.moduleId))
        .limit(1);
      if (!mods[0] || !managed.includes(mods[0].courseId)) {
        throw new CertificateError(
          403,
          "NOT_MANAGER",
          "Bukan pengelola kursus tersebut"
        );
      }
    }
    conditions.push(eq(certificates.moduleId, filter.moduleId));
  }
  const dbStatus = normalizeCertStatus(filter.status);
  if (dbStatus !== undefined) conditions.push(eq(certificates.status, dbStatus));
  if (filter.q) {
    conditions.push(
      or(
        like(certificates.recipientName, `%${filter.q}%`),
        like(certificates.code, `%${filter.q}%`)
      )
    );
  }
  if (filter.from) {
    const d = new Date(`${filter.from}T00:00:00`);
    if (!Number.isNaN(d.getTime())) conditions.push(gte(certificates.issuedAt, d));
  }
  if (filter.to) {
    const d = new Date(`${filter.to}T23:59:59`);
    if (!Number.isNaN(d.getTime())) conditions.push(lte(certificates.issuedAt, d));
  }
  const limit = Math.min(Math.max(filter.limit ?? 20, 1), 100);
  const page = Math.max(filter.page ?? 1, 1);
  const base = db
    .select({
      id: certificates.id,
      code: certificates.code,
      recipientName: certificates.recipientName,
      studentName: users.name,
      courseId: certificates.courseId,
      courseTitle: courses.title,
      moduleId: certificates.moduleId,
      moduleTitle: modules.title,
      status: certificates.status,
      issuedAt: certificates.issuedAt,
      revokedAt: certificates.revokedAt,
      revokeReason: certificates.revokeReason,
    })
    .from(certificates)
    .innerJoin(courses, eq(courses.id, certificates.courseId))
    .innerJoin(modules, eq(modules.id, certificates.moduleId))
    .innerJoin(users, eq(users.id, certificates.userId));
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const [countRows, rows] = await Promise.all([
    db
      .select({ n: sql<number>`count(*)` })
      .from(certificates)
      .where(where),
    base
      .where(where)
      .orderBy(desc(certificates.issuedAt), desc(certificates.id))
      .limit(limit)
      .offset((page - 1) * limit),
  ]);
  return {
    items: rows.map(toInstructorItem),
    total: Number(countRows[0]?.n ?? 0),
  };
};

/** Detail satu sertifikat (pengelola kursus / admin). */
export const getCertificateDetail = async (
  viewerId: number,
  role: string,
  certId: number
): Promise<InstructorCertificateItem & { requirementsSnapshot: unknown; revokedBy: number | null }> => {
  const rows = await db
    .select()
    .from(certificates)
    .where(eq(certificates.id, certId))
    .limit(1);
  const row = rows[0];
  if (!row) {
    throw new CertificateError(
      404,
      "CERT_NOT_FOUND",
      "Sertifikat tidak ditemukan"
    );
  }
  const managed = await managedCourseIds(viewerId, role);
  if (managed !== null && !managed.includes(row.courseId)) {
    throw new CertificateError(
      403,
      "NOT_MANAGER",
      "Bukan pengelola kursus tersebut"
    );
  }
  const joined = await db
    .select({
      id: certificates.id,
      code: certificates.code,
      recipientName: certificates.recipientName,
      studentName: users.name,
      courseId: certificates.courseId,
      courseTitle: courses.title,
      moduleId: certificates.moduleId,
      moduleTitle: modules.title,
      status: certificates.status,
      issuedAt: certificates.issuedAt,
      revokedAt: certificates.revokedAt,
      revokeReason: certificates.revokeReason,
    })
    .from(certificates)
    .innerJoin(courses, eq(courses.id, certificates.courseId))
    .innerJoin(modules, eq(modules.id, certificates.moduleId))
    .innerJoin(users, eq(users.id, certificates.userId))
    .where(eq(certificates.id, certId))
    .limit(1);
  const cert = joined[0];
  if (!cert) {
    throw new CertificateError(404, "CERT_NOT_FOUND", "Sertifikat tidak ditemukan");
  }
  return {
    ...toInstructorItem(cert),
    requirementsSnapshot: row.requirementsSnapshot,
    revokedBy: row.revokedBy,
  };
};

// ---------- Pencabutan ----------

export const revokeCertificate = async (
  actorId: number,
  role: string,
  certId: number,
  reason: string
): Promise<InstructorCertificateItem> => {
  const rows = await db
    .select()
    .from(certificates)
    .where(eq(certificates.id, certId))
    .limit(1);
  const row = rows[0];
  if (!row) {
    throw new CertificateError(404, "CERT_NOT_FOUND", "Sertifikat tidak ditemukan");
  }
  const managed = await managedCourseIds(actorId, role);
  if (managed !== null && !managed.includes(row.courseId)) {
    throw new CertificateError(
      403,
      "NOT_MANAGER",
      "Bukan pengelola kursus tersebut"
    );
  }
  if (row.status === "revoked") {
    throw new CertificateError(
      409,
      "ALREADY_REVOKED",
      "Sertifikat sudah dicabut"
    );
  }
  await db.transaction(async (tx) => {
    await tx
      .update(certificates)
      .set({
        status: "revoked",
        revokeReason: reason,
        revokedBy: actorId,
        revokedAt: new Date(),
      })
      .where(eq(certificates.id, certId));
    await tx.insert(auditLogs).values({
      actorUserId: actorId,
      action: "certificate.revoke",
      targetType: "certificate",
      targetIdInt: certId,
      metadata: {
        certificateId: certId,
        userId: row.userId,
        courseId: row.courseId,
        moduleId: row.moduleId,
        reason,
      },
    });
  });
  const cert = await certWithTitles(certId);
  if (!cert) throw new Error("Gagal membaca sertifikat");
  const joined = await db
    .select({
      id: certificates.id,
      code: certificates.code,
      recipientName: certificates.recipientName,
      studentName: users.name,
      courseId: certificates.courseId,
      courseTitle: courses.title,
      moduleId: certificates.moduleId,
      moduleTitle: modules.title,
      status: certificates.status,
      issuedAt: certificates.issuedAt,
      revokedAt: certificates.revokedAt,
      revokeReason: certificates.revokeReason,
    })
    .from(certificates)
    .innerJoin(courses, eq(courses.id, certificates.courseId))
    .innerJoin(modules, eq(modules.id, certificates.moduleId))
    .innerJoin(users, eq(users.id, certificates.userId))
    .where(eq(certificates.id, certId))
    .limit(1);
  if (!joined[0]) throw new Error("Gagal membaca sertifikat");
  return toInstructorItem(joined[0]);
};

// ---------- Kelayakan per peserta (instrukur) ----------

export type ParticipantEligibilityStatus =
  | "belum_memenuhi"
  | "menunggu_penilaian"
  | "memenuhi"
  | "sudah_terbit";

export interface ParticipantEligibility {
  userId: number;
  studentName: string;
  email: string;
  status: ParticipantEligibilityStatus;
  certStatus: string | null;
  materialDone: number;
  materialTotal: number;
  quizPassed: number;
  quizTotal: number;
  taskPassed: number;
  taskTotal: number;
  failReasons: string[];
}

/** Daftar kelayakan seluruh peserta kursus pada satu modul (pengelola/admin). */
export const listModuleEligibility = async (
  viewerId: number,
  role: string,
  moduleId: number,
  onlyStatus?: ParticipantEligibilityStatus
): Promise<ParticipantEligibility[]> => {
  const mod = await getModule(moduleId);
  if (!mod) {
    throw new CertificateError(404, "MODULE_NOT_FOUND", "Modul tidak ditemukan");
  }
  const managed = await managedCourseIds(viewerId, role);
  if (managed !== null && !managed.includes(mod.courseId)) {
    throw new CertificateError(
      403,
      "NOT_MANAGER",
      "Bukan pengelola kursus tersebut"
    );
  }
  const mats = await listMaterialsByModule(moduleId);
  const parts = await db
    .select({
      userId: enrollments.userId,
      status: enrollments.status,
      name: users.name,
      email: users.email,
    })
    .from(enrollments)
    .innerJoin(users, eq(users.id, enrollments.userId))
    .where(
      and(
        eq(enrollments.courseId, mod.courseId),
        inArray(enrollments.status, ["active", "completed"])
      )
    )
    .orderBy(asc(users.name), asc(users.id));

  if (parts.length === 0) return [];

  const quizMats = mats.filter((m) => m.type === "kuis");
  const taskMats = mats.filter((m) => m.type === "tugas");
  const plainMats = mats.filter((m) => m.type !== "kuis" && m.type !== "tugas");

  const userIds = parts.map((p) => p.userId);

  // Batch: 4 query total, bukan P×M (drizzle skill: hindari N+1, pakai inArray).
  const [progressRows, attemptRows, submissionRows, certRows] = await Promise.all([
    plainMats.length > 0
      ? db
          .select({ userId: progress.userId, materialId: progress.materialId })
          .from(progress)
          .where(
            and(
              inArray(progress.materialId, plainMats.map((m) => m.id)),
              inArray(progress.userId, userIds)
            )
          )
      : Promise.resolve([] as Array<{ userId: number; materialId: number }>),
    quizMats.length > 0
      ? db
          .select({
            userId: quizAttempts.userId,
            materialId: quizAttempts.materialId,
            score: quizAttempts.score,
            passScore: quizAttempts.passScore,
          })
          .from(quizAttempts)
          .where(
            and(
              inArray(quizAttempts.materialId, quizMats.map((m) => m.id)),
              inArray(quizAttempts.userId, userIds)
            )
          )
      : Promise.resolve(
          [] as Array<{ userId: number; materialId: number; score: number; passScore: number }>
        ),
    taskMats.length > 0
      ? db
          .select({
            userId: submissions.userId,
            materialId: submissions.materialId,
            status: submissions.status,
            submittedAt: submissions.submittedAt,
            id: submissions.id,
          })
          .from(submissions)
          .where(
            and(
              inArray(submissions.materialId, taskMats.map((m) => m.id)),
              inArray(submissions.userId, userIds)
            )
          )
          .orderBy(desc(submissions.submittedAt), desc(submissions.id))
      : Promise.resolve(
          [] as Array<{
            userId: number;
            materialId: number;
            status: string;
            submittedAt: Date;
            id: number;
          }>
        ),
    db
      .select({ userId: certificates.userId, status: certificates.status })
      .from(certificates)
      .where(
        and(
          eq(certificates.moduleId, moduleId),
          inArray(certificates.userId, userIds)
        )
      ),
  ]);

  const doneSet = new Set(progressRows.map((r) => `${r.userId}:${r.materialId}`));
  const quizByKey = new Map<string, Array<{ score: number; passScore: number }>>();
  for (const r of attemptRows) {
    const k = `${r.userId}:${r.materialId}`;
    const arr = quizByKey.get(k);
    if (arr) arr.push({ score: r.score, passScore: r.passScore });
    else quizByKey.set(k, [{ score: r.score, passScore: r.passScore }]);
  }
  // submissionRows sudah terurut terbaru dulu; ambil status terakhir + flag lulus.
  const taskLast = new Map<string, string>();
  const taskPassedSet = new Set<string>();
  for (const r of submissionRows) {
    const k = `${r.userId}:${r.materialId}`;
    if (!taskLast.has(k)) taskLast.set(k, r.status);
    if (r.status === "passed") taskPassedSet.add(k);
  }
  const certByUser = new Map(certRows.map((r) => [r.userId, r.status]));

  const out: ParticipantEligibility[] = [];
  for (const p of parts) {
    let done = 0;
    for (const m of plainMats) {
      if (doneSet.has(`${p.userId}:${m.id}`)) done++;
    }
    let quizPassed = 0;
    for (const m of quizMats) {
      const atts = quizByKey.get(`${p.userId}:${m.id}`);
      if (atts && atts.some((a) => a.score >= a.passScore)) quizPassed++;
    }
    let taskPassed = 0;
    let waiting = false;
    for (const m of taskMats) {
      const k = `${p.userId}:${m.id}`;
      if (taskPassedSet.has(k)) taskPassed++;
      else {
        const last = taskLast.get(k);
        if (last && ["submitted", "reviewed"].includes(last)) waiting = true;
      }
    }
    const certStatus = certByUser.get(p.userId) ?? null;
    const failReasons: string[] = [];
    if (done < plainMats.length) failReasons.push(`${plainMats.length - done} materi belum selesai`);
    if (quizPassed < quizMats.length) failReasons.push(`${quizMats.length - quizPassed} kuis belum lulus`);
    if (taskPassed < taskMats.length) failReasons.push(`${taskMats.length - taskPassed} tugas belum lulus`);
    const meets = failReasons.length === 0 && mats.length > 0;
    const status: ParticipantEligibilityStatus =
      certStatus === "issued"
        ? "sudah_terbit"
        : meets
          ? "memenuhi"
          : waiting
            ? "menunggu_penilaian"
            : "belum_memenuhi";
    if (onlyStatus !== undefined && status !== onlyStatus) continue;
    out.push({
      userId: p.userId,
      studentName: p.name,
      email: p.email,
      status,
      certStatus,
      materialDone: done,
      materialTotal: plainMats.length,
      quizPassed,
      quizTotal: quizMats.length,
      taskPassed,
      taskTotal: taskMats.length,
      failReasons,
    });
  }
  return out;
};

// ---------- Ringkasan & status modul (kontrak frontend instruktur/sertifikat) ----------

export interface SummaryCourseRow {
  courseId: number;
  courseTitle: string;
  eligibleCount: number;
  issuedActiveCount: number;
  notEligibleCount: number;
  revokedCount: number;
}

export interface RecentlyEligible {
  eligibilityId: string;
  studentName: string;
  courseTitle: string;
  moduleTitle: string;
}

export interface InstructorCertificateSummary {
  eligibleCount: number;
  issuedActiveCount: number;
  notEligibleCount: number;
  revokedCount: number;
  perCourse: SummaryCourseRow[];
  recentlyEligible: RecentlyEligible[];
}

export interface ModuleCertificateStatus {
  moduleId: number;
  moduleTitle: string;
  courseId: number;
  courseTitle: string;
  eligibleCount: number;
  issuedCount: number;
  notEligibleCount: number;
  revokedCount: number;
}

const managedCoursesWithTitles = async (
  viewerId: number,
  role: string
): Promise<Array<{ id: number; title: string }>> => {
  if (role === "admin") {
    return db.select({ id: courses.id, title: courses.title }).from(courses);
  }
  const ids = await managedCourseIds(viewerId, role);
  if (!ids || ids.length === 0) return [];
  return db
    .select({ id: courses.id, title: courses.title })
    .from(courses)
    .where(inArray(courses.id, ids));
};

/** Agregat ringkasan sertifikat untuk tab ringkasan instruktur. */
export const getCertificateSummary = async (
  viewerId: number,
  role: string
): Promise<InstructorCertificateSummary> => {
  const courseList = await managedCoursesWithTitles(viewerId, role);
  if (courseList.length === 0) {
    return {
      eligibleCount: 0,
      issuedActiveCount: 0,
      notEligibleCount: 0,
      revokedCount: 0,
      perCourse: [],
      recentlyEligible: [],
    };
  }
  const courseIds = courseList.map((c) => c.id);
  const titleByCourse = new Map(courseList.map((c) => [c.id, c.title]));
  const modRows = await db
    .select({ id: modules.id, courseId: modules.courseId, title: modules.title })
    .from(modules)
    .where(inArray(modules.courseId, courseIds));

  let eligibleCount = 0;
  let notEligibleCount = 0;
  const perCourse = new Map<number, SummaryCourseRow>();
  const recent: RecentlyEligible[] = [];

  for (const c of courseList) {
    perCourse.set(c.id, {
      courseId: c.id,
      courseTitle: c.title,
      eligibleCount: 0,
      issuedActiveCount: 0,
      notEligibleCount: 0,
      revokedCount: 0,
    });
  }

  // Paralel: kelayakan per modul + 2 agregat sertifikat jalan bersamaan.
  // listModuleEligibility kini batch (4 query/modul), bukan P×M.
  const [eligibilityByModule, issuedRows, revokedRows] = await Promise.all([
    Promise.all(
      modRows.map(async (m) => ({
        m,
        items: await listModuleEligibility(viewerId, role, m.id),
      }))
    ),
    db
      .select({ courseId: certificates.courseId, n: sql<number>`count(*)` })
      .from(certificates)
      .where(
        and(
          inArray(certificates.courseId, courseIds),
          eq(certificates.status, "issued")
        )
      )
      .groupBy(certificates.courseId),
    db
      .select({ courseId: certificates.courseId, n: sql<number>`count(*)` })
      .from(certificates)
      .where(
        and(
          inArray(certificates.courseId, courseIds),
          eq(certificates.status, "revoked")
        )
      )
      .groupBy(certificates.courseId),
  ]);

  for (const { m, items } of eligibilityByModule) {
    const row = perCourse.get(m.courseId);
    if (!row) continue;
    for (const e of items) {
      if (e.certStatus === "revoked") {
        row.revokedCount += 1;
        continue;
      }
      if (e.status === "memenuhi") {
        eligibleCount += 1;
        row.eligibleCount += 1;
        if (recent.length < 5) {
          recent.push({
            eligibilityId: `${m.id}:${e.userId}`,
            studentName: e.studentName,
            courseTitle: titleByCourse.get(m.courseId) ?? "",
            moduleTitle: m.title,
          });
        }
      } else if (e.status === "sudah_terbit") {
        // Dihitung via tabel sertifikat di bawah agar konsisten dengan riwayat.
      } else {
        notEligibleCount += 1;
        row.notEligibleCount += 1;
      }
    }
  }

  let issuedActiveCount = 0;
  let revokedCount = 0;
  for (const r of issuedRows) {
    issuedActiveCount += Number(r.n);
    const row = perCourse.get(r.courseId);
    if (row) row.issuedActiveCount = Number(r.n);
  }
  for (const r of revokedRows) {
    revokedCount += Number(r.n);
    const row = perCourse.get(r.courseId);
    if (row) row.revokedCount = Number(r.n);
  }

  return {
    eligibleCount,
    issuedActiveCount,
    notEligibleCount,
    revokedCount,
    perCourse: [...perCourse.values()],
    recentlyEligible: recent,
  };
};

/** Status angka satu modul untuk tab kursus instruktur. */
export const getModuleCertificateStatus = async (
  viewerId: number,
  role: string,
  moduleId: number
): Promise<ModuleCertificateStatus> => {
  const mod = await getModule(moduleId);
  if (!mod) {
    throw new CertificateError(404, "MODULE_NOT_FOUND", "Modul tidak ditemukan");
  }
  const managed = await managedCourseIds(viewerId, role);
  if (managed !== null && !managed.includes(mod.courseId)) {
    throw new CertificateError(403, "NOT_MANAGER", "Bukan pengelola kursus tersebut");
  }
  const courseRows = await db
    .select({ title: courses.title })
    .from(courses)
    .where(eq(courses.id, mod.courseId))
    .limit(1);
  const items = await listModuleEligibility(viewerId, role, moduleId);
  let eligibleCount = 0;
  let notEligibleCount = 0;
  for (const e of items) {
    if (e.certStatus === "revoked") continue;
    if (e.status === "memenuhi") eligibleCount += 1;
    else if (e.status !== "sudah_terbit") notEligibleCount += 1;
  }
  const certRows = await db
    .select({ status: certificates.status, n: sql<number>`count(*)` })
    .from(certificates)
    .where(eq(certificates.moduleId, moduleId))
    .groupBy(certificates.status);
  let issuedCount = 0;
  let revokedCount = 0;
  for (const r of certRows) {
    if (r.status === "issued") issuedCount = Number(r.n);
    if (r.status === "revoked") revokedCount = Number(r.n);
  }
  return {
    moduleId: mod.id,
    moduleTitle: mod.title,
    courseId: mod.courseId,
    courseTitle: courseRows[0]?.title ?? "",
    eligibleCount,
    issuedCount,
    notEligibleCount,
    revokedCount,
  };
};

// ---------- Kelayakan global (kontrak frontend) ----------

export type FrontendEligibilityStatus =
  | "belum_memenuhi"
  | "menunggu_penilaian"
  | "memenuhi"
  | "sudah_terbit";

export interface FrontendEligibilityEntry {
  id: string;
  studentName: string;
  nim: string | null;
  courseId: number;
  courseTitle: string;
  moduleId: number;
  moduleTitle: string;
  materialDone: number;
  materialTotal: number;
  quizStatus: "lulus" | "belum_lulus" | "tidak_ada";
  taskStatus: "lulus" | "belum_lulus" | "menunggu_penilaian" | "tidak_ada";
  status: FrontendEligibilityStatus;
}

export interface FrontendEligibilityDetail extends FrontendEligibilityEntry {
  certificateId: number | null;
  failReasons: string[];
  materials: Array<{ id: string; title: string; state: string; extra: string | null }>;
  quizzes: Array<{ id: string; title: string; state: string; extra: string | null }>;
  tasks: Array<{ id: string; title: string; state: string; extra: string | null }>;
}

export interface GlobalEligibilityFilter {
  courseId?: number;
  moduleId?: number;
  status?: FrontendEligibilityStatus;
  q?: string;
}

const latestNimByUser = async (userIds: number[]): Promise<Map<number, string | null>> => {
  const out = new Map<number, string | null>();
  const uniq = [...new Set(userIds)];
  if (uniq.length === 0) return out;
  // 1 query untuk semua user (terbaru dulu), lalu ambil pertama per user di memori.
  const rows = await db
    .select({
      userId: submissions.userId,
      nim: submissions.studentNim,
      submittedAt: submissions.submittedAt,
      id: submissions.id,
    })
    .from(submissions)
    .where(inArray(submissions.userId, uniq))
    .orderBy(desc(submissions.submittedAt), desc(submissions.id))
    .limit(Math.min(uniq.length * 5, 2000));
  for (const r of rows) {
    if (out.has(r.userId)) continue;
    const nim = r.nim ?? null;
    out.set(r.userId, typeof nim === "string" && nim.trim() !== "" ? nim : null);
  }
  for (const uid of uniq) {
    if (!out.has(uid)) out.set(uid, null);
  }
  return out;
};

/** Daftar kelayakan lintas modul/kursus untuk filter tab kelayakan. */
export const listGlobalEligibility = async (
  viewerId: number,
  role: string,
  filter: GlobalEligibilityFilter = {}
): Promise<FrontendEligibilityEntry[]> => {
  const courseList = await managedCoursesWithTitles(viewerId, role);
  if (courseList.length === 0) return [];
  const allowedCourseIds = new Set(courseList.map((c) => c.id));
  if (filter.courseId !== undefined && !allowedCourseIds.has(filter.courseId)) {
    throw new CertificateError(403, "NOT_MANAGER", "Bukan pengelola kursus tersebut");
  }
  const titleByCourse = new Map(courseList.map((c) => [c.id, c.title]));
  const targetCourseIds =
    filter.courseId !== undefined ? [filter.courseId] : [...allowedCourseIds];
  let modRows = await db
    .select({ id: modules.id, courseId: modules.courseId, title: modules.title })
    .from(modules)
    .where(inArray(modules.courseId, targetCourseIds));
  if (filter.moduleId !== undefined) {
    modRows = modRows.filter((m) => m.id === filter.moduleId);
    if (modRows.length === 0) {
      const mod = await getModule(filter.moduleId);
      if (!mod) throw new CertificateError(404, "MODULE_NOT_FOUND", "Modul tidak ditemukan");
      throw new CertificateError(403, "NOT_MANAGER", "Bukan pengelola kursus tersebut");
    }
  }

  // Paralel per modul + 1 batch NIM global (hindari N× latestNimByUser).
  const perModule = await Promise.all(
    modRows.map(async (m) => ({
      m,
      items: await listModuleEligibility(viewerId, role, m.id),
    }))
  );
  const allUserIds = [...new Set(perModule.flatMap((r) => r.items.map((e) => e.userId)))];
  const nimByUser = await latestNimByUser(allUserIds);

  const out: FrontendEligibilityEntry[] = [];
  for (const { m, items } of perModule) {
    for (const e of items) {
      if (filter.status !== undefined && e.status !== filter.status) continue;
      if (filter.q) {
        const q = filter.q.toLowerCase();
        if (!e.studentName.toLowerCase().includes(q)) continue;
      }
      const quizStatus =
        e.quizTotal === 0 ? "tidak_ada" : e.quizPassed >= e.quizTotal ? "lulus" : "belum_lulus";
      const taskStatus =
        e.taskTotal === 0
          ? "tidak_ada"
          : e.taskPassed >= e.taskTotal
            ? "lulus"
            : e.status === "menunggu_penilaian"
              ? "menunggu_penilaian"
              : "belum_lulus";
      out.push({
        id: `${m.id}:${e.userId}`,
        studentName: e.studentName,
        nim: nimByUser.get(e.userId) ?? null,
        courseId: m.courseId,
        courseTitle: titleByCourse.get(m.courseId) ?? "",
        moduleId: m.id,
        moduleTitle: m.title,
        materialDone: e.materialDone,
        materialTotal: e.materialTotal,
        quizStatus: quizStatus as FrontendEligibilityEntry["quizStatus"],
        taskStatus: taskStatus as FrontendEligibilityEntry["taskStatus"],
        status: e.status,
      });
      // Batasi kerja sejak awal: berhenti bila sudah 500 (hindari hitung semua baru potong).
      if (out.length >= 500) return out;
    }
  }
  return out.slice(0, 500);
};

/** Rincian kelayakan satu peserta pada satu modul (id gabungan moduleId:userId). */
export const getGlobalEligibilityDetail = async (
  viewerId: number,
  role: string,
  eligibilityId: string
): Promise<FrontendEligibilityDetail> => {
  const parts = eligibilityId.split(":");
  if (parts.length !== 2) {
    throw new CertificateError(404, "ELIGIBILITY_NOT_FOUND", "Data kelayakan tidak ditemukan");
  }
  const moduleId = Number(parts[0]);
  const targetUserId = Number(parts[1]);
  if (!Number.isInteger(moduleId) || moduleId <= 0 || !Number.isInteger(targetUserId) || targetUserId <= 0) {
    throw new CertificateError(404, "ELIGIBILITY_NOT_FOUND", "Data kelayakan tidak ditemukan");
  }
  const mod = await getModule(moduleId);
  if (!mod) throw new CertificateError(404, "MODULE_NOT_FOUND", "Modul tidak ditemukan");
  const managed = await managedCourseIds(viewerId, role);
  if (managed !== null && !managed.includes(mod.courseId)) {
    throw new CertificateError(403, "NOT_MANAGER", "Bukan pengelola kursus tersebut");
  }
  const targetRows = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.id, targetUserId))
    .limit(1);
  if (!targetRows[0]) {
    throw new CertificateError(404, "ELIGIBILITY_NOT_FOUND", "Data kelayakan tidak ditemukan");
  }
  const enrollRows = await db
    .select({ status: enrollments.status })
    .from(enrollments)
    .where(and(eq(enrollments.userId, targetUserId), eq(enrollments.courseId, mod.courseId)))
    .limit(1);
  if (!enrollRows[0] || !["active", "completed"].includes(enrollRows[0].status)) {
    throw new CertificateError(404, "ELIGIBILITY_NOT_FOUND", "Data kelayakan tidak ditemukan");
  }
  const courseRows = await db
    .select({ title: courses.title })
    .from(courses)
    .where(eq(courses.id, mod.courseId))
    .limit(1);
  const mats = await listMaterialsByModule(moduleId);
  const plainMats = mats.filter((m) => m.type !== "kuis" && m.type !== "tugas");
  const quizMats = mats.filter((m) => m.type === "kuis");
  const taskMats = mats.filter((m) => m.type === "tugas");

  let done = 0;
  const materialItems: FrontendEligibilityDetail["materials"] = [];
  for (const m of plainMats) {
    const ok = (await getProgress(targetUserId, m.id)) !== null;
    if (ok) done += 1;
    materialItems.push({
      id: String(m.id),
      title: m.title,
      state: ok ? "selesai" : "belum",
      extra: null,
    });
  }
  let quizPassed = 0;
  const quizItems: FrontendEligibilityDetail["quizzes"] = [];
  for (const m of quizMats) {
    const best = await getBest(targetUserId, m.id);
    if (best.passed) quizPassed += 1;
    quizItems.push({
      id: String(m.id),
      title: m.title,
      state: best.attempts === 0 ? "belum_lulus" : best.passed ? "lulus" : "belum_lulus",
      extra: best.attempts > 0 && best.bestScore !== null ? `Nilai terbaik ${best.bestScore}` : null,
    });
  }
  let taskPassed = 0;
  let waiting = false;
  const taskItems: FrontendEligibilityDetail["tasks"] = [];
  for (const m of taskMats) {
    const st = await getTaskStatus(targetUserId, "student", m.id);
    if (st.passed) taskPassed += 1;
    else if (st.attempts > 0 && st.lastStatus && ["submitted", "reviewed"].includes(st.lastStatus)) {
      waiting = true;
    }
    taskItems.push({
      id: String(m.id),
      title: m.title,
      state: st.passed ? "lulus" : st.attempts > 0 && st.lastStatus && ["submitted", "reviewed"].includes(st.lastStatus) ? "menunggu" : "belum_lulus",
      extra: st.attempts > 0 ? `${st.attempts}x kumpul${st.bestScore !== null ? `, skor ${st.bestScore}` : ""}` : null,
    });
  }
  const certRows = await db
    .select({ id: certificates.id, status: certificates.status })
    .from(certificates)
    .where(and(eq(certificates.userId, targetUserId), eq(certificates.moduleId, moduleId)))
    .limit(1);
  const certStatus = certRows[0]?.status ?? null;
  const failReasons: string[] = [];
  if (done < plainMats.length) failReasons.push(`Materi wajib belum selesai (${done}/${plainMats.length}).`);
  if (quizPassed < quizMats.length) failReasons.push("Kuis wajib belum lulus.");
  if (taskPassed < taskMats.length) {
    failReasons.push(
      waiting ? "Tugas wajib menunggu penilaian instruktur." : "Tugas wajib belum lulus."
    );
  }
  if (mats.length === 0) failReasons.push("Modul belum memiliki materi");
  const meets = failReasons.length === 0 && mats.length > 0;
  const status: FrontendEligibilityStatus =
    certStatus === "issued"
      ? "sudah_terbit"
      : meets
        ? "memenuhi"
        : waiting
          ? "menunggu_penilaian"
          : "belum_memenuhi";
  const quizStatus =
    quizMats.length === 0 ? "tidak_ada" : quizPassed >= quizMats.length ? "lulus" : "belum_lulus";
  const taskStatus =
    taskMats.length === 0
      ? "tidak_ada"
      : taskPassed >= taskMats.length
        ? "lulus"
        : waiting
          ? "menunggu_penilaian"
          : "belum_lulus";
  const nimByUser = await latestNimByUser([targetUserId]);
  return {
    id: `${moduleId}:${targetUserId}`,
    studentName: targetRows[0].name,
    nim: nimByUser.get(targetUserId) ?? null,
    courseId: mod.courseId,
    courseTitle: courseRows[0]?.title ?? "",
    moduleId,
    moduleTitle: mod.title,
    materialDone: done,
    materialTotal: plainMats.length,
    quizStatus: quizStatus as FrontendEligibilityEntry["quizStatus"],
    taskStatus: taskStatus as FrontendEligibilityEntry["taskStatus"],
    status,
    certificateId: certRows[0]?.id ?? null,
    failReasons,
    materials: materialItems,
    quizzes: quizItems,
    tasks: taskItems,
  };
};
