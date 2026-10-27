import { randomBytes } from "node:crypto";
import { z } from "zod";
import { and, asc, desc, eq, inArray, like, or, sql } from "drizzle-orm";
import { db } from "../../db";
import {
  auditLogs,
  certificates,
  courseInstructors,
  courses,
  enrollments,
  modules,
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

export interface CertificateListFilter {
  courseId?: number;
  moduleId?: number;
  status?: "issued" | "revoked";
  q?: string;
  limit?: number;
  page?: number;
}

/** Riwayat sertifikat untuk admin / instruktur pemilik (termasuk yang dicabut). */
export const listCertificates = async (
  viewerId: number,
  role: string,
  filter: CertificateListFilter = {}
): Promise<{ items: PublicCertificate[]; total: number }> => {
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
  if (filter.status !== undefined) conditions.push(eq(certificates.status, filter.status));
  if (filter.q) {
    conditions.push(
      or(
        like(certificates.recipientName, `%${filter.q}%`),
        like(certificates.code, `%${filter.q}%`)
      )
    );
  }
  const limit = Math.min(Math.max(filter.limit ?? 20, 1), 100);
  const page = Math.max(filter.page ?? 1, 1);
  const base = db
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
    .innerJoin(modules, eq(modules.id, certificates.moduleId));
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
    items: rows.map(toPublicCertificate),
    total: Number(countRows[0]?.n ?? 0),
  };
};

/** Detail satu sertifikat (pengelola kursus / admin). */
export const getCertificateDetail = async (
  viewerId: number,
  role: string,
  certId: number
): Promise<PublicCertificate & { requirementsSnapshot: unknown; revokedBy: number | null }> => {
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
  const cert = await certWithTitles(certId);
  if (!cert) {
    throw new CertificateError(404, "CERT_NOT_FOUND", "Sertifikat tidak ditemukan");
  }
  return {
    ...cert,
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
): Promise<PublicCertificate> => {
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
  return cert;
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

  const quizMats = mats.filter((m) => m.type === "kuis");
  const taskMats = mats.filter((m) => m.type === "tugas");
  const plainMats = mats.filter((m) => m.type !== "kuis" && m.type !== "tugas");

  const out: ParticipantEligibility[] = [];
  for (const p of parts) {
    let done = 0;
    for (const m of plainMats) {
      if ((await getProgress(p.userId, m.id)) !== null) done++;
    }
    let quizPassed = 0;
    for (const m of quizMats) {
      if ((await getBest(p.userId, m.id)).passed) quizPassed++;
    }
    let taskPassed = 0;
    let waiting = false;
    for (const m of taskMats) {
      const st = await getTaskStatus(p.userId, "student", m.id);
      if (st.passed) taskPassed++;
      else if (st.attempts > 0 && st.lastStatus && ["submitted", "reviewed"].includes(st.lastStatus)) {
        waiting = true;
      }
    }
    const certRows = await db
      .select({ status: certificates.status })
      .from(certificates)
      .where(
        and(
          eq(certificates.userId, p.userId),
          eq(certificates.moduleId, moduleId)
        )
      )
      .limit(1);
    const certStatus = certRows[0]?.status ?? null;
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
