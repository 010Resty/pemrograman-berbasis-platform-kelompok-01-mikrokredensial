import { z } from "zod";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "../../db";
import { auditLogs, courses, modules, subModules, materials, users } from "../../db/schema";
import { canManageCourse } from "./course.service";
import { assertValidTiptap, MAX_CONTENT_CHARS } from "../../utils/tiptap-guard";

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const writeCurriculaAudit = async (
  tx: DbTx,
  entry: {
    actorUserId: number | null;
    action: string;
    targetIdInt?: number | null;
    metadata?: Record<string, unknown>;
  }
) => {
  await tx.insert(auditLogs).values({
    actorUserId: entry.actorUserId,
    action: entry.action,
    targetType: "curriculum",
    targetIdInt: entry.targetIdInt ?? null,
    metadata: entry.metadata ?? null,
  });
};

// ---------- Skema input ----------

export const moduleInputSchema = z.object({
  title: z.string().trim().min(3).max(255),
  description: z.string().trim().max(5000).nullable().optional(),
  type: z.enum(["materi", "tugas", "kuis"]),
  position: z.number().int().min(0).max(10000),
});

export const modulePatchSchema = moduleInputSchema.partial().refine(
  (v) => Object.keys(v).length > 0,
  { message: "Tidak ada field yang diubah" }
);

export const subModuleInputSchema = z.object({
  title: z.string().trim().min(3).max(255),
  description: z.string().trim().max(5000).nullable().optional(),
  position: z.number().int().min(0).max(10000),
});

export const subModulePatchSchema = subModuleInputSchema.partial().refine(
  (v) => Object.keys(v).length > 0,
  { message: "Tidak ada field yang diubah" }
);

export const MATERIAL_TYPES = [
  "materi", "tugas", "kuis", "video", "bacaan", "audio", "foto",
] as const;

export const materialInputSchema = z.object({
  title: z.string().trim().min(3).max(255),
  type: z.enum(MATERIAL_TYPES),
  duration: z.string().trim().max(50).nullable().optional(),
  content: z.string().min(1).max(MAX_CONTENT_CHARS),
  contentSchemaVersion: z.number().int().min(1).max(99).optional(),
  // Ambang kelulusan khusus materi kuis (0–100). Opsional agar materi lama
  // dan non-kuis tetap valid; tidak menjadi syarat untuk tipe selain kuis.
  passScore: z.number().int().min(0).max(100).optional(),
  position: z.number().int().min(0).max(10000),
});

export const materialPatchSchema = materialInputSchema.partial().extend({
  // Optimistic concurrency (K-08): tolak timpa diam-diam bila materi berubah
  // sejak editor memuatnya. Nilai = `updatedAt` yang diterima saat buka editor.
  expectedUpdatedAt: z.string().trim().min(1).max(64).optional(),
  // Klasifikasi perubahan K-08 (diputus instruktur pemilik; ringan = typo/
  // format/sampul/judul, penting = isi kuis/tugas/ambang lulus atau hapus materi).
  changeSignificance: z.enum(["ringan", "penting"]).optional(),
  changeReason: z.string().trim().max(500).optional(),
}).refine(
  (v) => Object.keys(v).length > 0,
  { message: "Tidak ada field yang diubah" }
);

/** Dilempar bila materi berubah sejak `expectedUpdatedAt` (tulis ulang = 409). */
export class MaterialConflictError extends Error {
  readonly currentUpdatedAt: string | null;
  constructor(currentUpdatedAt: string | null) {
    super("Materi berubah sejak Anda membukanya. Muat ulang sebelum menyimpan.");
    this.name = "MaterialConflictError";
    this.currentUpdatedAt = currentUpdatedAt;
  }
}

// ---------- Resolusi kepemilikan ----------

export const getCourseOfModule = async (moduleId: number) => {
  const rows = await db
    .select({ courseId: modules.courseId })
    .from(modules)
    .where(eq(modules.id, moduleId))
    .limit(1);
  return rows[0]?.courseId ?? null;
};

export const getCourseOfSubModule = async (subId: number) => {
  const rows = await db
    .select({ moduleId: subModules.moduleId })
    .from(subModules)
    .where(eq(subModules.id, subId))
    .limit(1);
  if (!rows[0]) return null;
  return getCourseOfModule(rows[0].moduleId);
};

export const getCourseOfMaterial = async (materialId: number) => {
  const rows = await db
    .select({ moduleId: materials.moduleId, subModuleId: materials.subModuleId })
    .from(materials)
    .where(eq(materials.id, materialId))
    .limit(1);
  if (!rows[0]) return null;
  return getCourseOfModule(rows[0].moduleId);
};

const requireCourse = async (courseId: number) => {
  const rows = await db
    .select({ id: courses.id, status: courses.status })
    .from(courses)
    .where(eq(courses.id, courseId))
    .limit(1);
  return rows[0] ?? null;
};

/** Baca katalog: kursus published DAN archived boleh dibaca publik (arsip read-only).
 * Draft hanya untuk admin/pengelola. */
export const canReadCourseTree = async (
  userId: number | null,
  role: string,
  courseId: number
): Promise<"ok" | "not-found" | "forbidden"> => {
  const course = await requireCourse(courseId);
  if (!course) return "not-found";
  if (course.status === "published" || course.status === "archived") return "ok";
  if (userId !== null && (await canManageCourse(userId, role, courseId))) return "ok";
  return "forbidden";
};

// ---------- CRUD ----------

export const createModule = async (
  courseId: number,
  input: z.infer<typeof moduleInputSchema>,
  actorId: number | null = null
) => {
  return db.transaction(async (tx) => {
    const [header] = await tx.insert(modules).values({
      courseId,
      title: input.title,
      description: input.description ?? null,
      type: input.type,
      position: input.position,
    });
    const id = Number((header as unknown as { insertId: number }).insertId);
    await writeCurriculaAudit(tx, {
      actorUserId: actorId,
      action: "curriculum.module.create",
      targetIdInt: id,
      metadata: { moduleId: id, courseId, title: input.title },
    });
    const rows = await tx.select().from(modules).where(eq(modules.id, id)).limit(1);
    return rows[0] ?? null;
  });
};

export const listModules = async (courseId: number) =>
  db.select().from(modules).where(eq(modules.courseId, courseId)).orderBy(asc(modules.position), asc(modules.id));

export const getModule = async (moduleId: number) => {
  const rows = await db.select().from(modules).where(eq(modules.id, moduleId)).limit(1);
  return rows[0] ?? null;
};

export const patchModule = async (
  moduleId: number,
  input: z.infer<typeof modulePatchSchema>,
  actorId: number | null = null
) => {
  const patch: Partial<typeof modules.$inferInsert> = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.description !== undefined) patch.description = input.description;
  if (input.type !== undefined) patch.type = input.type;
  if (input.position !== undefined) patch.position = input.position;
  await db.transaction(async (tx) => {
    await tx.update(modules).set(patch).where(eq(modules.id, moduleId));
    await writeCurriculaAudit(tx, {
      actorUserId: actorId,
      action: "curriculum.module.update",
      targetIdInt: moduleId,
      metadata: { moduleId, changed: Object.keys(patch) },
    });
  });
  return getModule(moduleId);
};

export const deleteModule = async (moduleId: number, actorId: number | null = null) => {
  await db.transaction(async (tx) => {
    await writeCurriculaAudit(tx, {
      actorUserId: actorId,
      action: "curriculum.module.delete",
      targetIdInt: moduleId,
      metadata: { moduleId },
    });
    await tx.delete(modules).where(eq(modules.id, moduleId));
  });
};

export const createSubModule = async (
  moduleId: number,
  input: z.infer<typeof subModuleInputSchema>,
  actorId: number | null = null
) => {
  return db.transaction(async (tx) => {
    const [header] = await tx.insert(subModules).values({
      moduleId,
      title: input.title,
      description: input.description ?? null,
      position: input.position,
    });
    const id = Number((header as unknown as { insertId: number }).insertId);
    await writeCurriculaAudit(tx, {
      actorUserId: actorId,
      action: "curriculum.submodule.create",
      targetIdInt: id,
      metadata: { subModuleId: id, moduleId, title: input.title },
    });
    const rows = await tx.select().from(subModules).where(eq(subModules.id, id)).limit(1);
    return rows[0] ?? null;
  });
};

export const listSubModules = async (moduleId: number) =>
  db.select().from(subModules).where(eq(subModules.moduleId, moduleId)).orderBy(asc(subModules.position), asc(subModules.id));

export const getSubModule = async (subId: number) => {
  const rows = await db.select().from(subModules).where(eq(subModules.id, subId)).limit(1);
  return rows[0] ?? null;
};

export const patchSubModule = async (
  subId: number,
  input: z.infer<typeof subModulePatchSchema>,
  actorId: number | null = null
) => {
  const patch: Partial<typeof subModules.$inferInsert> = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.description !== undefined) patch.description = input.description;
  if (input.position !== undefined) patch.position = input.position;
  await db.transaction(async (tx) => {
    await tx.update(subModules).set(patch).where(eq(subModules.id, subId));
    await writeCurriculaAudit(tx, {
      actorUserId: actorId,
      action: "curriculum.submodule.update",
      targetIdInt: subId,
      metadata: { subModuleId: subId, changed: Object.keys(patch) },
    });
  });
  return getSubModule(subId);
};

export const deleteSubModule = async (subId: number, actorId: number | null = null) => {
  // Hapus materi di dalamnya dulu agar sesuai janji UI
  // ("beserta N materi di dalamnya akan dihapus").
  // Baris progres/kuis/pengumpulan ikut terhapus via FK cascade.
  const kids = await db
    .select({ id: materials.id })
    .from(materials)
    .where(eq(materials.subModuleId, subId));
  for (const k of kids) {
    await deleteMaterial(k.id, actorId);
  }
  await db.transaction(async (tx) => {
    await writeCurriculaAudit(tx, {
      actorUserId: actorId,
      action: "curriculum.submodule.delete",
      targetIdInt: subId,
      metadata: { subModuleId: subId, materialCount: kids.length },
    });
    await tx.delete(subModules).where(eq(subModules.id, subId));
  });
};

export const createMaterial = async (
  subId: number | null,
  moduleId: number,
  input: z.infer<typeof materialInputSchema>,
  actorId: number | null = null
) => {
  assertValidTiptap(input.content);
  return db.transaction(async (tx) => {
    const [header] = await tx.insert(materials).values({
      moduleId,
      subModuleId: subId,
      title: input.title,
      type: input.type,
      duration: input.duration ?? null,
      content: input.content,
      contentSchemaVersion: input.contentSchemaVersion ?? 1,
      // Ambang kuis; default 70 selaras default database bila tidak diisi.
      passScore: input.passScore ?? 70,
      position: input.position,
    });
    const id = Number((header as unknown as { insertId: number }).insertId);
    await writeCurriculaAudit(tx, {
      actorUserId: actorId,
      action: "curriculum.material.create",
      targetIdInt: id,
      metadata: { materialId: id, moduleId, subModuleId: subId, type: input.type },
    });
    const rows = await tx.select().from(materials).where(eq(materials.id, id)).limit(1);
    return rows[0] ?? null;
  });
};

export const listMaterialsBySub = async (subId: number) =>
  db.select().from(materials).where(eq(materials.subModuleId, subId)).orderBy(asc(materials.position), asc(materials.id));

export const listMaterialsByModule = async (moduleId: number) =>
  db.select().from(materials).where(eq(materials.moduleId, moduleId)).orderBy(asc(materials.position), asc(materials.id));

export const getMaterial = async (materialId: number) => {
  const rows = await db.select().from(materials).where(eq(materials.id, materialId)).limit(1);
  return rows[0] ?? null;
};

export const patchMaterial = async (
  materialId: number,
  input: z.infer<typeof materialPatchSchema>,
  actorId: number | null = null
) => {
  if (typeof input.content === "string") assertValidTiptap(input.content);
  const { expectedUpdatedAt, changeSignificance, changeReason, ...rest } = input;
  // Allowlist eksplisit: cegah mass-assignment (mis. moduleId/subModuleId liar).
  const patch: Partial<typeof materials.$inferInsert> = {};
  if (rest.title !== undefined) patch.title = rest.title;
  if (rest.type !== undefined) patch.type = rest.type;
  if (rest.duration !== undefined) patch.duration = rest.duration;
  if (rest.content !== undefined) patch.content = rest.content;
  if (rest.contentSchemaVersion !== undefined) patch.contentSchemaVersion = rest.contentSchemaVersion;
  if (rest.passScore !== undefined) patch.passScore = rest.passScore;
  if (rest.position !== undefined) patch.position = rest.position;
  const current = await getMaterial(materialId);
  if (expectedUpdatedAt !== undefined && current) {
    const clientTs = Math.floor(new Date(expectedUpdatedAt).getTime() / 1000);
    const serverTs = Math.floor(new Date(current.updatedAt as unknown as string).getTime() / 1000);
    if (!Number.isFinite(clientTs) || clientTs !== serverTs) {
      throw new MaterialConflictError(
        current.updatedAt ? new Date(current.updatedAt as unknown as string).toISOString() : null
      );
    }
  }
  await db.transaction(async (tx) => {
    if (Object.keys(patch).length > 0) {
      await tx.update(materials).set(patch).where(eq(materials.id, materialId));
      await writeCurriculaAudit(tx, {
        actorUserId: actorId,
        action: "curriculum.material.update",
        targetIdInt: materialId,
        metadata: {
          materialId,
          changed: Object.keys(patch),
          ...(changeSignificance !== undefined ? { significance: changeSignificance } : {}),
          ...(changeReason !== undefined && changeReason !== "" ? { reason: changeReason } : {}),
        },
      });
    }
  });
  return getMaterial(materialId);
};

/**
 * Riwayat perubahan satu materi dari audit resmi (K-08).
 * Tanpa migrasi: memakai baris audit `curriculum.*` yang menarget materi ini.
 */
export const listMaterialChanges = async (
  materialId: number,
  limit = 20
) => {
  const lim = Math.min(Math.max(limit, 1), 100);
  const rows = await db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      actorUserId: auditLogs.actorUserId,
      actorName: users.name,
      metadata: auditLogs.metadata,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.actorUserId))
    .where(
      and(eq(auditLogs.targetType, "curriculum"), eq(auditLogs.targetIdInt, materialId))
    )
    .orderBy(desc(auditLogs.id))
    .limit(lim);
  return rows;
};

export const deleteMaterial = async (materialId: number, actorId: number | null = null) => {
  await db.transaction(async (tx) => {
    await writeCurriculaAudit(tx, {
      actorUserId: actorId,
      action: "curriculum.material.delete",
      targetIdInt: materialId,
      metadata: { materialId },
    });
    await tx.delete(materials).where(eq(materials.id, materialId));
  });
};
