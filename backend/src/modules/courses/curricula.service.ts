import { z } from "zod";
import { eq, asc } from "drizzle-orm";
import { db } from "../../db";
import { courses, modules, subModules, materials } from "../../db/schema";
import { canManageCourse } from "./course.service";

// ---------- Validasi konten Tiptap ----------

const MAX_CONTENT_CHARS = 1_000_000;

const ALLOWED_NODES = new Set([
  "doc", "paragraph", "text", "heading", "bulletList", "orderedList",
  "listItem", "blockquote", "codeBlock", "horizontalRule", "hardBreak",
  "image", "videoEmbed", "audioEmbed", "pdfAttachment",
]);

const ALLOWED_MARKS = new Set([
  "bold", "italic", "underline", "strike", "code", "link",
]);

interface TiptapNode {
  type?: unknown;
  attrs?: Record<string, unknown>;
  marks?: Array<{ type?: unknown; attrs?: Record<string, unknown> }>;
  content?: TiptapNode[];
  text?: unknown;
}

function assertSafeUrl(value: unknown, field: string): void {
  if (value == null) return;
  if (typeof value !== "string") {
    throw new Error(`Atribut ${field} harus berupa string`);
  }
  const v = value.trim().toLowerCase();
  if (v.startsWith("data:")) {
    throw new Error(
      `Atribut ${field} tidak boleh dataURL/base64 — unggah berkas via /api/v1/uploads`
    );
  }
  if (
    !(
      v.startsWith("http://") ||
      v.startsWith("https://") ||
      v.startsWith("/") ||
      v === "" ||
      v === "#"
    )
  ) {
    throw new Error(`Atribut ${field} harus URL http(s) atau path /api/...`);
  }
  if (v.startsWith("javascript:")) {
    throw new Error(`Atribut ${field} tidak valid`);
  }
}

function walkNode(node: TiptapNode, depth: number): void {
  if (depth > 50 || typeof node !== "object" || node === null) {
    throw new Error("Struktur dokumen tidak valid");
  }
  if (typeof node.type !== "string" || !ALLOWED_NODES.has(node.type)) {
    throw new Error(`Tipe node tidak diizinkan: ${String(node.type)}`);
  }
  if (Array.isArray(node.marks)) {
    for (const m of node.marks) {
      if (!m || typeof m !== "object" || typeof m.type !== "string" || !ALLOWED_MARKS.has(m.type)) {
        throw new Error(`Tipe mark tidak diizinkan: ${String((m as { type?: unknown })?.type)}`);
      }
      if (m.type === "link") {
        assertSafeUrl((m.attrs as Record<string, unknown> | undefined)?.href, "link.href");
      }
    }
  }
  const attrs = node.attrs ?? {};
  if (node.type === "image") assertSafeUrl(attrs.src, "image.src");
  if (node.type === "videoEmbed") assertSafeUrl(attrs.src, "videoEmbed.src");
  if (node.type === "audioEmbed") assertSafeUrl(attrs.src, "audioEmbed.src");
  if (node.type === "pdfAttachment") assertSafeUrl(attrs.url, "pdfAttachment.url");
  if (Array.isArray(node.content)) {
    for (const child of node.content) walkNode(child, depth + 1);
  }
}

/** Validasi string JSON Tiptap; melempar Error deskriptif bila tidak valid. */
export function assertValidTiptap(content: string): void {
  if (content.length > MAX_CONTENT_CHARS) {
    throw new Error("Dokumen melebihi 1 MB — perkecil gambar/media atau pecah materi");
  }
  let doc: unknown;
  try {
    doc = JSON.parse(content);
  } catch {
    throw new Error("Konten harus JSON Tiptap yang valid");
  }
  if (typeof doc !== "object" || doc === null) {
    throw new Error("Dokumen harus berupa objek doc Tiptap");
  }
  walkNode(doc as TiptapNode, 0);
}

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

export const materialPatchSchema = materialInputSchema.partial().refine(
  (v) => Object.keys(v).length > 0,
  { message: "Tidak ada field yang diubah" }
);

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
  input: z.infer<typeof moduleInputSchema>
) => {
  const [header] = await db.insert(modules).values({
    courseId,
    title: input.title,
    description: input.description ?? null,
    type: input.type,
    position: input.position,
  });
  const id = Number((header as unknown as { insertId: number }).insertId);
  const rows = await db.select().from(modules).where(eq(modules.id, id)).limit(1);
  return rows[0] ?? null;
};

export const listModules = async (courseId: number) =>
  db.select().from(modules).where(eq(modules.courseId, courseId)).orderBy(asc(modules.position), asc(modules.id));

export const getModule = async (moduleId: number) => {
  const rows = await db.select().from(modules).where(eq(modules.id, moduleId)).limit(1);
  return rows[0] ?? null;
};

export const patchModule = async (moduleId: number, input: Record<string, unknown>) => {
  await db.update(modules).set(input).where(eq(modules.id, moduleId));
  return getModule(moduleId);
};

export const deleteModule = async (moduleId: number) => {
  await db.delete(modules).where(eq(modules.id, moduleId));
};

export const createSubModule = async (
  moduleId: number,
  input: z.infer<typeof subModuleInputSchema>
) => {
  const [header] = await db.insert(subModules).values({
    moduleId,
    title: input.title,
    description: input.description ?? null,
    position: input.position,
  });
  const id = Number((header as unknown as { insertId: number }).insertId);
  const rows = await db.select().from(subModules).where(eq(subModules.id, id)).limit(1);
  return rows[0] ?? null;
};

export const listSubModules = async (moduleId: number) =>
  db.select().from(subModules).where(eq(subModules.moduleId, moduleId)).orderBy(asc(subModules.position), asc(subModules.id));

export const getSubModule = async (subId: number) => {
  const rows = await db.select().from(subModules).where(eq(subModules.id, subId)).limit(1);
  return rows[0] ?? null;
};

export const patchSubModule = async (subId: number, input: Record<string, unknown>) => {
  await db.update(subModules).set(input).where(eq(subModules.id, subId));
  return getSubModule(subId);
};

export const deleteSubModule = async (subId: number) => {
  // Hapus materi di dalamnya dulu agar sesuai janji UI
  // ("beserta N materi di dalamnya akan dihapus").
  // Baris progres/kuis/pengumpulan ikut terhapus via FK cascade.
  const kids = await db
    .select({ id: materials.id })
    .from(materials)
    .where(eq(materials.subModuleId, subId));
  for (const k of kids) {
    await deleteMaterial(k.id);
  }
  await db.delete(subModules).where(eq(subModules.id, subId));
};

export const createMaterial = async (
  subId: number | null,
  moduleId: number,
  input: z.infer<typeof materialInputSchema>
) => {
  assertValidTiptap(input.content);
  const [header] = await db.insert(materials).values({
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
  const rows = await db.select().from(materials).where(eq(materials.id, id)).limit(1);
  return rows[0] ?? null;
};

export const listMaterialsBySub = async (subId: number) =>
  db.select().from(materials).where(eq(materials.subModuleId, subId)).orderBy(asc(materials.position), asc(materials.id));

export const listMaterialsByModule = async (moduleId: number) =>
  db.select().from(materials).where(eq(materials.moduleId, moduleId)).orderBy(asc(materials.position), asc(materials.id));

export const getMaterial = async (materialId: number) => {
  const rows = await db.select().from(materials).where(eq(materials.id, materialId)).limit(1);
  return rows[0] ?? null;
};

export const patchMaterial = async (materialId: number, input: Record<string, unknown>) => {
  if (typeof input.content === "string") assertValidTiptap(input.content);
  await db.update(materials).set(input).where(eq(materials.id, materialId));
  return getMaterial(materialId);
};

export const deleteMaterial = async (materialId: number) => {
  await db.delete(materials).where(eq(materials.id, materialId));
};
