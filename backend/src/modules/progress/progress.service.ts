import { and, eq, inArray } from "drizzle-orm";
import { db } from "../../db";
import { materials, modules, progress } from "../../db/schema";

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
