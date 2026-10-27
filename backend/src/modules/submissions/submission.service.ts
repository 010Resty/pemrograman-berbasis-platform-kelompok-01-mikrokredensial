import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../../db";
import {
  auditLogs,
  files,
  materials,
  modules,
  submissions,
  users,
} from "../../db/schema";
import { canManageCourse } from "../courses/course.service";
import { getMaterial } from "../courses/curricula.service";
import { resolveLearningGuard } from "../enrollments/enrollment.service";

// ---------- Skema input ----------

export const submitInputSchema = z
  .object({
    fileId: z.number().int().positive(),
    studentNim: z.string().trim().min(1).max(30).nullable().optional(),
    note: z.string().trim().max(2000).nullable().optional(),
  })
  .strict();

export const gradeInputSchema = z
  .object({
    score: z.number().int().min(0).max(100),
    decision: z.enum(["passed", "failed", "revision_requested"]),
    feedback: z.string().trim().max(2000).nullable().optional(),
  })
  .strict();

export class SubmissionError extends Error {
  readonly http: number;
  readonly code: string;
  constructor(http: number, code: string, message: string) {
    super(message);
    this.http = http;
    this.code = code;
  }
}

// ---------- Bentuk baca ----------

export interface PublicSubmission {
  id: number;
  materialId: number;
  userId: number;
  fileId: number | null;
  fileUrl: string;
  studentName: string | null;
  studentNim: string | null;
  note: string | null;
  score: number | null;
  feedback: string | null;
  status: string;
  gradedBy: number | null;
  gradedAt: Date | null;
  submittedAt: Date;
}

const toPublicSubmission = (row: typeof submissions.$inferSelect): PublicSubmission => ({
  id: row.id,
  materialId: row.materialId,
  userId: row.userId,
  fileId: row.fileId,
  fileUrl: row.filePath,
  studentName: row.studentName,
  studentNim: row.studentNim,
  note: row.note,
  score: row.score,
  feedback: row.feedback,
  status: row.status,
  gradedBy: row.gradedBy,
  gradedAt: row.gradedAt,
  submittedAt: row.submittedAt,
});

// ---------- Helper internal ----------

const requireTaskMaterial = async (materialId: number) => {
  const mat = await getMaterial(materialId);
  if (!mat) {
    throw new SubmissionError(404, "MATERIAL_NOT_FOUND", "Materi tidak ditemukan");
  }
  if (mat.type !== "tugas") {
    throw new SubmissionError(400, "NOT_TASK", "Materi bukan tugas");
  }
  return mat;
};

/** Pengelola kursus dari suatu materi (admin selalu lolos via canManageCourse). */
export const isCourseManagerOfMaterial = async (
  userId: number,
  role: string,
  materialId: number
): Promise<number | null> => {
  const rows = await db
    .select({ moduleId: materials.moduleId })
    .from(materials)
    .where(eq(materials.id, materialId))
    .limit(1);
  if (!rows[0]) return null;
  const mods = await db
    .select({ courseId: modules.courseId })
    .from(modules)
    .where(eq(modules.id, rows[0].moduleId))
    .limit(1);
  if (!mods[0]) return null;
  if (!(await canManageCourse(userId, role, mods[0].courseId))) return null;
  return mods[0].courseId;
};

/** Teacher boleh membaca berkas assignment bila mengampu kursus yang
 * mempunyai submission menautkan berkas tersebut. */
export const teacherCanAccessFile = async (
  teacherId: number,
  role: string,
  fileId: number
): Promise<boolean> => {
  const rows = await db
    .select({ courseId: modules.courseId })
    .from(submissions)
    .innerJoin(materials, eq(materials.id, submissions.materialId))
    .innerJoin(modules, eq(modules.id, materials.moduleId))
    .where(eq(submissions.fileId, fileId));
  for (const r of rows) {
    if (await canManageCourse(teacherId, role, r.courseId)) return true;
  }
  return false;
};

// ---------- Pengumpulan ----------

/** Kumpul tugas: satu baris baru per pengumpulan (riwayat tidak ditimpa). */
export const createSubmission = async (
  userId: number,
  role: string,
  materialId: number,
  input: z.infer<typeof submitInputSchema>
): Promise<PublicSubmission> => {
  const guard = await resolveLearningGuard(userId, role, materialId);
  if (guard.status === "not-found") {
    throw new SubmissionError(404, "MATERIAL_NOT_FOUND", "Materi tidak ditemukan");
  }
  if (guard.status === "no-access") {
    throw new SubmissionError(
      403,
      "NO_ACCESS",
      "Anda tidak memiliki akses ke kursus ini"
    );
  }
  await requireTaskMaterial(materialId);

  const fileRows = await db
    .select()
    .from(files)
    .where(eq(files.id, input.fileId))
    .limit(1);
  const file = fileRows[0];
  if (!file) {
    throw new SubmissionError(404, "FILE_NOT_FOUND", "Berkas tidak ditemukan");
  }
  if (file.kind !== "assignment") {
    throw new SubmissionError(
      400,
      "INVALID_FILE_KIND",
      "Berkas harus berjenis assignment (PDF tugas)"
    );
  }
  // Berkas milik pengumpul — cegah memakai berkas peserta lain.
  if (file.ownerUserId !== userId) {
    throw new SubmissionError(
      403,
      "FILE_FORBIDDEN",
      "Berkas tersebut bukan milik Anda"
    );
  }

  const owners = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const fileUrl = `/api/v1/files/${file.id}/content`;
  const [h] = await db.insert(submissions).values({
    userId,
    materialId,
    fileId: file.id,
    filePath: fileUrl,
    studentName: owners[0]?.name ?? null,
    studentNim: input.studentNim ?? null,
    note: input.note ?? null,
  });
  const id = Number((h as unknown as { insertId: number }).insertId);
  const created = await db
    .select()
    .from(submissions)
    .where(eq(submissions.id, id))
    .limit(1);
  if (!created[0]) throw new Error("Gagal menyimpan submission");
  return toPublicSubmission(created[0]);
};

// ---------- Daftar & detail ----------

export interface ListSubmissionsFilter {
  userId?: number;
}

/** Daftar submission: pengelola melihat semua (opsional saring peserta),
 * peserta melihat milik sendiri. */
export const listSubmissions = async (
  viewerId: number,
  role: string,
  materialId: number,
  filter: ListSubmissionsFilter = {}
): Promise<{ manager: boolean; rows: PublicSubmission[] }> => {
  await requireTaskMaterial(materialId);
  const courseId = await isCourseManagerOfMaterial(viewerId, role, materialId);
  if (courseId !== null || role === "admin") {
    const conditions = [eq(submissions.materialId, materialId)];
    if (filter.userId !== undefined) {
      conditions.push(eq(submissions.userId, filter.userId));
    }
    const rows = await db
      .select()
      .from(submissions)
      .where(and(...conditions))
      .orderBy(desc(submissions.submittedAt), desc(submissions.id));
    return { manager: true, rows: rows.map(toPublicSubmission) };
  }
  // Peserta: butuh hak akses belajar, lalu hanya baris milik sendiri.
  const guard = await resolveLearningGuard(viewerId, role, materialId);
  if (guard.status === "not-found") {
    throw new SubmissionError(404, "MATERIAL_NOT_FOUND", "Materi tidak ditemukan");
  }
  if (guard.status === "no-access") {
    throw new SubmissionError(
      403,
      "NO_ACCESS",
      "Anda tidak memiliki akses ke kursus ini"
    );
  }
  const rows = await db
    .select()
    .from(submissions)
    .where(
      and(
        eq(submissions.materialId, materialId),
        eq(submissions.userId, viewerId)
      )
    )
    .orderBy(desc(submissions.submittedAt), desc(submissions.id));
  return { manager: false, rows: rows.map(toPublicSubmission) };
};

/** Detail satu submission: pengelola boleh membaca semua; peserta hanya miliknya
 * (asing disamarkan 404 agar tidak bocor). */
export const getSubmission = async (
  viewerId: number,
  role: string,
  materialId: number,
  submissionId: number
): Promise<PublicSubmission> => {
  await requireTaskMaterial(materialId);
  const rows = await db
    .select()
    .from(submissions)
    .where(
      and(
        eq(submissions.id, submissionId),
        eq(submissions.materialId, materialId)
      )
    )
    .limit(1);
  const row = rows[0];
  if (!row) {
    throw new SubmissionError(
      404,
      "SUBMISSION_NOT_FOUND",
      "Submission tidak ditemukan"
    );
  }
  const managerCourse = await isCourseManagerOfMaterial(viewerId, role, materialId);
  if (managerCourse !== null || role === "admin") return toPublicSubmission(row);
  if (row.userId !== viewerId) {
    throw new SubmissionError(
      404,
      "SUBMISSION_NOT_FOUND",
      "Submission tidak ditemukan"
    );
  }
  // Peserta pemilik: tetap butuh hak akses belajar yang berlaku.
  const guard = await resolveLearningGuard(viewerId, role, materialId);
  if (guard.status === "not-found") {
    throw new SubmissionError(
      404,
      "SUBMISSION_NOT_FOUND",
      "Submission tidak ditemukan"
    );
  }
  if (guard.status === "no-access") {
    throw new SubmissionError(
      403,
      "NO_ACCESS",
      "Anda tidak memiliki akses ke kursus ini"
    );
  }
  return toPublicSubmission(row);
};

// ---------- Penilaian ----------

/** Nilai submission: keputusan eksplisit penilai + skor + umpan balik (transaksi + audit). */
export const gradeSubmission = async (
  actorId: number,
  role: string,
  materialId: number,
  submissionId: number,
  input: z.infer<typeof gradeInputSchema>
): Promise<PublicSubmission> => {
  await requireTaskMaterial(materialId);
  const managerCourse = await isCourseManagerOfMaterial(actorId, role, materialId);
  if (managerCourse === null && role !== "admin") {
    const existing = await db
      .select({ id: submissions.id })
      .from(submissions)
      .where(
        and(
          eq(submissions.id, submissionId),
          eq(submissions.materialId, materialId)
        )
      )
      .limit(1);
    if (!existing[0]) {
      throw new SubmissionError(
        404,
        "SUBMISSION_NOT_FOUND",
        "Submission tidak ditemukan"
      );
    }
    throw new SubmissionError(
      403,
      "NOT_MANAGER",
      "Hanya pengampu kursus yang dapat menilai"
    );
  }
  const updated = await db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(submissions)
      .where(
        and(
          eq(submissions.id, submissionId),
          eq(submissions.materialId, materialId)
        )
      )
      .limit(1);
    if (!rows[0]) return null;
    const now = new Date();
    await tx
      .update(submissions)
      .set({
        score: input.score,
        feedback: input.feedback ?? null,
        status: input.decision,
        gradedBy: actorId,
        gradedAt: now,
      })
      .where(eq(submissions.id, submissionId));
    await tx.insert(auditLogs).values({
      actorUserId: actorId,
      action: "submission.grade",
      targetType: "submission",
      targetIdInt: submissionId,
      metadata: {
        submissionId,
        materialId,
        studentId: rows[0].userId,
        score: input.score,
        decision: input.decision,
      },
    });
    const fresh = await tx
      .select()
      .from(submissions)
      .where(eq(submissions.id, submissionId))
      .limit(1);
    return fresh[0] ?? null;
  });
  if (!updated) {
    throw new SubmissionError(
      404,
      "SUBMISSION_NOT_FOUND",
      "Submission tidak ditemukan"
    );
  }
  return toPublicSubmission(updated);
};

// ---------- Status kelulusan per materi (dipakai frontend + Tahap 3 sertifikat) ----------

export interface TaskStatus {
  materialId: number;
  attempts: number;
  graded: number;
  /** Lulus menempel: ada satu saja submission berstatus passed. */
  passed: boolean;
  lastStatus: string | null;
  bestScore: number | null;
  lastSubmission: PublicSubmission | null;
}

export const getTaskStatus = async (
  viewerId: number,
  role: string,
  materialId: number
): Promise<TaskStatus> => {
  await requireTaskMaterial(materialId);
  const guard = await resolveLearningGuard(viewerId, role, materialId);
  if (guard.status === "not-found") {
    throw new SubmissionError(404, "MATERIAL_NOT_FOUND", "Materi tidak ditemukan");
  }
  if (guard.status === "no-access") {
    throw new SubmissionError(
      403,
      "NO_ACCESS",
      "Anda tidak memiliki akses ke kursus ini"
    );
  }
  const rows = await db
    .select()
    .from(submissions)
    .where(
      and(
        eq(submissions.materialId, materialId),
        eq(submissions.userId, viewerId)
      )
    )
    .orderBy(desc(submissions.submittedAt), desc(submissions.id));
  if (rows.length === 0) {
    return {
      materialId,
      attempts: 0,
      graded: 0,
      passed: false,
      lastStatus: null,
      bestScore: null,
      lastSubmission: null,
    };
  }
  const scores = rows.map((r) => r.score).filter((s): s is number => s !== null);
  return {
    materialId,
    attempts: rows.length,
    graded: rows.filter((r) => r.gradedAt !== null).length,
    passed: rows.some((r) => r.status === "passed"),
    lastStatus: rows[0].status,
    bestScore: scores.length > 0 ? Math.max(...scores) : null,
    lastSubmission: toPublicSubmission(rows[0]),
  };
};
