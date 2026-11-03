import { z } from "zod";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "../../db";
import {
  auditLogs,
  courseInstructors,
  courses,
  files,
  materials,
  modules,
  subModules,
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
  /** Nama + ukuran berkas asli (untuk label unduh di klien). */
  originalName: string | null;
  sizeBytes: number | null;
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
  originalName: null,
  sizeBytes: null,
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

/**
 * Lengkapi payload submission dengan metadata berkas (satu query batch).
 * Tanpa ini klien hanya bisa menebak nama/ukuran berkas.
 */
type SubmissionRow = typeof submissions.$inferSelect;
const withFileMeta = async (
  rows: SubmissionRow[]
): Promise<PublicSubmission[]> => {
  const ids = [
    ...new Set(
      rows.map((r) => r.fileId).filter((x): x is number => x !== null)
    ),
  ];
  const meta = new Map<number, { originalName: string; sizeBytes: number }>();
  if (ids.length > 0) {
    const frows = await db
      .select({
        id: files.id,
        originalName: files.originalName,
        sizeBytes: files.sizeBytes,
      })
      .from(files)
      .where(inArray(files.id, ids));
    for (const f of frows) {
      meta.set(f.id, { originalName: f.originalName, sizeBytes: f.sizeBytes });
    }
  }
  return rows.map((r) => ({
    ...toPublicSubmission(r),
    originalName:
      r.fileId !== null ? (meta.get(r.fileId)?.originalName ?? null) : null,
    sizeBytes:
      r.fileId !== null ? (meta.get(r.fileId)?.sizeBytes ?? null) : null,
  }));
};

/** Varian satu baris (map 1:1, tidak pernah mengurangi baris). */
const withFileMetaOne = async (
  row: SubmissionRow
): Promise<PublicSubmission> => (await withFileMeta([row]))[0] as PublicSubmission;

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
  return withFileMetaOne(created[0]);
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
    return { manager: true, rows: await withFileMeta(rows) };
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
  return { manager: false, rows: await withFileMeta(rows) };
};

// ---------- Antrean penilaian instruktur (agregat satu request) ----------

export interface QueueTaskItem {
  materialId: number;
  title: string;
  moduleTitle: string;
  moduleIndex: number;
  duration: string | null;
  pending: number;
  graded: number;
  total: number;
  avgScore: number | null;
}

export interface QueueCourseItem {
  id: number;
  title: string;
  category: string | null;
  image: string | null;
  tasks: QueueTaskItem[];
  pending: number;
  graded: number;
  total: number;
}

export interface ReviewQueueResult {
  courses: QueueCourseItem[];
  pendingTotal: number;
  gradedTotal: number;
  avgScore: number | null;
}

/**
 * Agregat antrean penilaian untuk pengelola: kursus kelola (dibuat +
 * ditugaskan; admin = semua) → materi `tugas` → hitungan pengumpulan.
 * Satu respons menggantikan kipas N request kursus × materi di klien.
 */
export const getInstructorReviewQueue = async (
  viewerId: number,
  role: string
): Promise<ReviewQueueResult> => {
  const managedIds = async (): Promise<number[]> => {
    if (role === "admin") {
      const all = await db.select({ id: courses.id }).from(courses);
      return all.map((c) => c.id);
    }
    const links = await db
      .select({ courseId: courseInstructors.courseId })
      .from(courseInstructors)
      .where(eq(courseInstructors.userId, viewerId));
    const ids = new Set(links.map((l) => l.courseId));
    const created = await db
      .select({ id: courses.id })
      .from(courses)
      .where(eq(courses.createdBy, viewerId));
    for (const c of created) ids.add(c.id);
    return [...ids];
  };

  const courseIds = await managedIds();
  const empty: ReviewQueueResult = {
    courses: [],
    pendingTotal: 0,
    gradedTotal: 0,
    avgScore: null,
  };
  if (courseIds.length === 0) return empty;

  const courseRows = await db
    .select({
      id: courses.id,
      title: courses.title,
      category: courses.category,
      image: courses.image,
    })
    .from(courses)
    .where(inArray(courses.id, courseIds));

  const modRows = await db
    .select({
      id: modules.id,
      courseId: modules.courseId,
      title: modules.title,
      position: modules.position,
    })
    .from(modules)
    .where(inArray(modules.courseId, courseIds))
    .orderBy(asc(modules.courseId), asc(modules.position), asc(modules.id));
  if (modRows.length === 0) {
    return {
      ...empty,
      courses: courseRows.map((c) => ({
        ...c,
        tasks: [],
        pending: 0,
        graded: 0,
        total: 0,
      })),
    };
  }

  const modIds = modRows.map((m) => m.id);
  const [subRows, matRows] = await Promise.all([
    db
      .select({
        id: subModules.id,
        moduleId: subModules.moduleId,
        title: subModules.title,
        position: subModules.position,
      })
      .from(subModules)
      .where(inArray(subModules.moduleId, modIds))
      .orderBy(asc(subModules.position), asc(subModules.id)),
    db
      .select({
        id: materials.id,
        moduleId: materials.moduleId,
        subModuleId: materials.subModuleId,
        title: materials.title,
        type: materials.type,
        duration: materials.duration,
        position: materials.position,
      })
      .from(materials)
      .where(inArray(materials.moduleId, modIds))
      .orderBy(asc(materials.position), asc(materials.id)),
  ]);

  // Modul tanpa sub-modul tetap jalan: materi subModuleId NULL ikut modulnya.
  const tasksByCourse = new Map<number, QueueTaskItem[]>();
  const taskMats = matRows.filter((m) => m.type === "tugas");
  const modById = new Map(modRows.map((m) => [m.id, m]));
  const byModuleCourse = new Map<number, number>();
  for (const m of modRows) byModuleCourse.set(m.id, m.courseId);
  // Nomor modul terurut per kursus (label "Modul N").
  const modIndex = new Map<number, number>();
  {
    const perCourse = new Map<number, typeof modRows>();
    for (const m of modRows) {
      const list = perCourse.get(m.courseId) ?? [];
      list.push(m);
      perCourse.set(m.courseId, list);
    }
    for (const list of perCourse.values()) {
      list.forEach((m, i) => modIndex.set(m.id, i + 1));
    }
  }
  const taskIds = taskMats.map((m) => m.id);
  const gradeRows = taskIds.length > 0
    ? await db
        .select({
          materialId: submissions.materialId,
          status: submissions.status,
          score: submissions.score,
        })
        .from(submissions)
        .where(inArray(submissions.materialId, taskIds))
    : [];
  const subsByMat = new Map<number, typeof gradeRows>();
  for (const s of gradeRows) {
    const list = subsByMat.get(s.materialId) ?? [];
    list.push(s);
    subsByMat.set(s.materialId, list);
  }

  for (const m of taskMats) {
    const courseId = byModuleCourse.get(m.moduleId);
    const mod = modById.get(m.moduleId);
    if (courseId === undefined || !mod) continue;
    const rows = subsByMat.get(m.id) ?? [];
    const scores = rows.filter((r) => r.score !== null).map((r) => r.score as number);
    const list = tasksByCourse.get(courseId) ?? [];
    list.push({
      materialId: m.id,
      title: m.title,
      moduleTitle: mod.title,
      moduleIndex: modIndex.get(m.moduleId) ?? 0,
      duration: m.duration,
      pending: rows.filter((r) => r.status === "submitted").length,
      graded: scores.length,
      total: rows.length,
      avgScore:
        scores.length > 0
          ? Math.round(scores.reduce((n, s) => n + s, 0) / scores.length)
          : null,
    });
    tasksByCourse.set(courseId, list);
  }

  const courseOrder = new Map(courseIds.map((id, i) => [id, i]));
  const outCourses: QueueCourseItem[] = courseRows
    .map((c) => {
      const tasks = tasksByCourse.get(c.id) ?? [];
      return {
        ...c,
        tasks,
        pending: tasks.reduce((n, t) => n + t.pending, 0),
        graded: tasks.reduce((n, t) => n + t.graded, 0),
        total: tasks.reduce((n, t) => n + t.total, 0),
      };
    })
    .sort((a, b) => (courseOrder.get(a.id) ?? 0) - (courseOrder.get(b.id) ?? 0));

  let wSum = 0;
  let wN = 0;
  for (const c of outCourses) {
    for (const t of c.tasks) {
      if (t.avgScore !== null && t.graded > 0) {
        wSum += t.avgScore * t.graded;
        wN += t.graded;
      }
    }
  }
  return {
    courses: outCourses,
    pendingTotal: outCourses.reduce((n, c) => n + c.pending, 0),
    gradedTotal: outCourses.reduce((n, c) => n + c.graded, 0),
    avgScore: wN > 0 ? Math.round(wSum / wN) : null,
  };
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
  if (managerCourse !== null || role === "admin") return withFileMetaOne(row);
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
  return withFileMetaOne(row);
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
  return withFileMetaOne(updated);
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
  const lastSubmission = rows[0] !== undefined ? await withFileMetaOne(rows[0]) : null;
  return {
    materialId,
    attempts: rows.length,
    graded: rows.filter((r) => r.gradedAt !== null).length,
    passed: rows.some((r) => r.status === "passed"),
    lastStatus: rows[0].status,
    bestScore: scores.length > 0 ? Math.max(...scores) : null,
    lastSubmission,
  };
};
