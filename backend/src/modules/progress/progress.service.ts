import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "../../db";
import { courses, enrollments, materials, modules, progress } from "../../db/schema";

/** Ambil satu baris progres milik pengguna untuk materi tertentu. */
export const getProgress = async (userId: number, materialId: number) => {
  const rows = await db
    .select()
    .from(progress)
    .where(and(eq(progress.userId, userId), eq(progress.materialId, materialId)))
    .limit(1);
  return rows[0] ?? null;
};

/** Tandai materi selesai — idempoten per (pengguna, materi).
 * Penulisan ulang tidak mengubah makna status; hanya menyegarkan
 * penanda waktu bila baris sudah ada (aman dari balapan via upsert). */
export const markComplete = async (
  userId: number,
  materialId: number
): Promise<{ alreadyCompleted: boolean }> => {
  const existing = await getProgress(userId, materialId);
  await db
    .insert(progress)
    .values({ userId, materialId })
    .onDuplicateKeyUpdate({ set: { completedAt: new Date() } });
  return { alreadyCompleted: existing !== null };
};

/** Batalkan tanda selesai. Idempoten: baris yang tidak ada tetap sukses. */
export const unmarkComplete = async (
  userId: number,
  materialId: number
): Promise<{ removed: boolean }> => {
  const existing = await getProgress(userId, materialId);
  if (!existing) return { removed: false };
  await db
    .delete(progress)
    .where(and(eq(progress.userId, userId), eq(progress.materialId, materialId)));
  return { removed: true };
};

/** Daftar id materi dalam satu kursus (ditelusur via modules, apa pun sub-modulnya). */
export const listMaterialIdsOfCourse = async (courseId: number): Promise<number[]> => {
  const mods = await db
    .select({ id: modules.id })
    .from(modules)
    .where(eq(modules.courseId, courseId));
  if (mods.length === 0) return [];
  const rows = await db
    .select({ id: materials.id })
    .from(materials)
    .where(inArray(materials.moduleId, mods.map((m) => m.id)));
  return rows.map((r) => r.id);
};

/** Id materi yang ditandai selesai oleh pengguna; saring ke kursus bila diminta. */
export const listMine = async (
  userId: number,
  materialIds?: number[]
): Promise<number[]> => {
  if (materialIds && materialIds.length === 0) return [];
  const rows = await db
    .select({ materialId: progress.materialId })
    .from(progress)
    .where(
      materialIds
        ? and(eq(progress.userId, userId), inArray(progress.materialId, materialIds))
        : eq(progress.userId, userId)
    );
  return rows.map((r) => r.materialId);
};

/** Satu desimal, mis. 63.888… → 63.9. Nol bila penyebut nol. */
const round1 = (done: number, total: number): number =>
  total <= 0 ? 0 : Math.round((done / total) * 1000) / 10;

export interface CourseProgressSummary {
  courseId: number;
  courseTitle: string;
  totalMaterials: number;
  completedMaterials: number;
  /** Persen 0–100, satu desimal. */
  percent: number;
}

export interface MyProgressSummary {
  totalCourses: number;
  totalMaterials: number;
  completedMaterials: number;
  /** Persen keseluruhan tertimbang = Σ selesai / Σ materi × 100, satu desimal. */
  percent: number;
  perCourse: CourseProgressSummary[];
}

/** Ringkasan progres keseluruhan milik sendiri ("Progres Keseluruhan" dasbor user).
 * Rumus: persen = Σ materi selesai / Σ materi kursus yang diikuti × 100
 * (satu desimal, mis. 63.9). Hanya kursus yang diikuti (enrollment
 * active/completed); kursus tanpa materi = 0%. Empat query batch, tanpa N+1. */
export const getMyProgressSummary = async (
  userId: number
): Promise<MyProgressSummary> => {
  const enrolled = await db
    .select({ courseId: enrollments.courseId, title: courses.title })
    .from(enrollments)
    .innerJoin(courses, eq(courses.id, enrollments.courseId))
    .where(
      and(
        eq(enrollments.userId, userId),
        inArray(enrollments.status, ["active", "completed"])
      )
    )
    .orderBy(asc(courses.id));
  if (enrolled.length === 0) {
    return {
      totalCourses: 0,
      totalMaterials: 0,
      completedMaterials: 0,
      percent: 0,
      perCourse: [],
    };
  }
  const mods = await db
    .select({ id: modules.id, courseId: modules.courseId })
    .from(modules)
    .where(
      inArray(
        modules.courseId,
        enrolled.map((e) => e.courseId)
      )
    );
  const modToCourse = new Map(mods.map((m) => [m.id, m.courseId]));
  const matRows =
    mods.length > 0
      ? await db
          .select({ id: materials.id, moduleId: materials.moduleId })
          .from(materials)
          .where(
            inArray(
              materials.moduleId,
              mods.map((m) => m.id)
            )
          )
      : [];
  const matToCourse = new Map(
    matRows.map((t) => [t.id, modToCourse.get(t.moduleId)] as const)
  );
  const doneRows =
    matRows.length > 0
      ? await db
          .select({ materialId: progress.materialId })
          .from(progress)
          .where(
            and(
              eq(progress.userId, userId),
              inArray(
                progress.materialId,
                matRows.map((t) => t.id)
              )
            )
          )
      : [];
  const doneSet = new Set(doneRows.map((r) => r.materialId));
  const perCourse: CourseProgressSummary[] = enrolled.map((e) => {
    const ids = matRows
      .filter((t) => matToCourse.get(t.id) === e.courseId)
      .map((t) => t.id);
    const done = ids.filter((id) => doneSet.has(id)).length;
    return {
      courseId: e.courseId,
      courseTitle: e.title,
      totalMaterials: ids.length,
      completedMaterials: done,
      percent: round1(done, ids.length),
    };
  });
  const totalMaterials = perCourse.reduce((n, c) => n + c.totalMaterials, 0);
  const completedMaterials = perCourse.reduce((n, c) => n + c.completedMaterials, 0);
  return {
    totalCourses: enrolled.length,
    totalMaterials,
    completedMaterials,
    percent: round1(completedMaterials, totalMaterials),
    perCourse,
  };
};
