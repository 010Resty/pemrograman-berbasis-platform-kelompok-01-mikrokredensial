import { z } from "zod";
import { and, asc, eq, ne, sql } from "drizzle-orm";
import { db } from "../../db";
import { auditLogs, courseCategories, courses } from "../../db/schema";

export class CategoryError extends Error {
  readonly http: number;
  readonly code: string;
  constructor(http: number, code: string, message: string) {
    super(message);
    this.http = http;
    this.code = code;
  }
}

// ---------- Skema input ----------

export const createCategorySchema = z
  .object({
    name: z.string().trim().min(2, "Nama kategori minimal 2 karakter").max(100),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .min(3)
      .max(100)
      .refine((v) => /^[a-z0-9-]{3,100}$/.test(v), {
        message: "Slug 3–100 karakter (huruf kecil, angka, tanda -)",
      })
      .optional(),
    sortOrder: z.number().int().min(0).max(1000000).optional(),
  })
  .strict();

export const updateCategorySchema = z
  .object({
    name: z.string().trim().min(2, "Nama kategori minimal 2 karakter").max(100).optional(),
    isActive: z.boolean().optional(),
    sortOrder: z.number().int().min(0).max(1000000).optional(),
  })
  .strict()
  .refine((v) => v.name !== undefined || v.isActive !== undefined || v.sortOrder !== undefined, {
    message: "Minimal satu field (name/isActive/sortOrder) wajib diisi",
    path: ["body"],
  });

// ---------- Bentuk baca ----------

export interface PublicCategory {
  id: number;
  slug: string;
  name: string;
  sortOrder: number;
}

export interface AdminCategory extends PublicCategory {
  isActive: boolean;
  /** Jumlah kursus yang memakai nama kategori ini (nonaktif tetap dihitung). */
  courseCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// ---------- Helper ----------

/** Nama → slug URL: kecil, spasi jadi -, selain a-z/0-9/- dibuang. */
export const slugifyCategory = (name: string): string =>
  name
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

/** Urutan berikut untuk kategori baru (maks + 10, tanpa input manual). */
const nextSortOrder = async (
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0]
): Promise<number> => {
  const rows = await tx
    .select({ m: sql<number>`max(${courseCategories.sortOrder})` })
    .from(courseCategories);
  return Number(rows[0]?.m ?? 0) + 10;
};

const toPublic = (r: typeof courseCategories.$inferSelect): PublicCategory => ({
  id: r.id,
  slug: r.slug,
  name: r.name,
  sortOrder: r.sortOrder,
});

/** Jumlah kursus per nama kategori (satu agregat, bukan N+1). */
const courseCountByName = async (): Promise<Map<string, number>> => {
  const rows = await db
    .select({ category: courses.category, n: sql<number>`count(*)` })
    .from(courses)
    .groupBy(courses.category);
  const out = new Map<string, number>();
  for (const r of rows) {
    if (r.category !== null) out.set(r.category, Number(r.n ?? 0));
  }
  return out;
};

// ---------- Daftar ----------

/** Kategori aktif untuk dropdown/filter publik (tanpa data nonaktif). */
export const listActiveCategories = async (): Promise<PublicCategory[]> => {
  const rows = await db
    .select()
    .from(courseCategories)
    .where(eq(courseCategories.isActive, true))
    .orderBy(asc(courseCategories.sortOrder), asc(courseCategories.id));
  return rows.map(toPublic);
};

/** Semua kategori + hitungan pemakaian (admin). */
export const listAllCategories = async (): Promise<AdminCategory[]> => {
  const [rows, counts] = await Promise.all([
    db
      .select()
      .from(courseCategories)
      .orderBy(asc(courseCategories.sortOrder), asc(courseCategories.id)),
    courseCountByName(),
  ]);
  return rows.map((r) => ({
    ...toPublic(r),
    isActive: r.isActive,
    courseCount: counts.get(r.name) ?? 0,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
};

// ---------- Kelola (admin) ----------

export const createCategory = async (
  actorId: number,
  input: z.infer<typeof createCategorySchema>
): Promise<AdminCategory> => {
  const name = input.name.trim();
  const slug = (input.slug ?? slugifyCategory(name)).trim().toLowerCase();
  if (!/^[a-z0-9-]{3,100}$/.test(slug)) {
    throw new CategoryError(400, "INVALID_SLUG", "Slug hasil nama tidak valid (butuh 3–100 karakter a-z/0-9/-)");
  }
  const dup = await db
    .select({ id: courseCategories.id })
    .from(courseCategories)
    .where(sql`${courseCategories.slug} = ${slug} OR ${courseCategories.name} = ${name}`)
    .limit(1);
  if (dup[0]) {
    throw new CategoryError(409, "CATEGORY_TAKEN", "Nama/slug kategori sudah dipakai");
  }
  const created = await db.transaction(async (tx) => {
    const [h] = await tx.insert(courseCategories).values({
      slug,
      name,
      sortOrder: input.sortOrder ?? (await nextSortOrder(tx)),
    });
    const id = Number((h as unknown as { insertId: number }).insertId);
    await tx.insert(auditLogs).values({
      actorUserId: actorId,
      action: "category.create",
      targetType: "category",
      targetIdInt: id,
      metadata: { categoryId: id, slug, name },
    });
    const fresh = await tx
      .select()
      .from(courseCategories)
      .where(eq(courseCategories.id, id))
      .limit(1);
    return fresh[0] ?? null;
  });
  if (!created) throw new Error("Gagal membuat kategori");
  return {
    ...toPublic(created),
    isActive: created.isActive,
    courseCount: 0,
    createdAt: created.createdAt,
    updatedAt: created.updatedAt,
  };
};

export const updateCategory = async (
  actorId: number,
  id: number,
  input: z.infer<typeof updateCategorySchema>
): Promise<AdminCategory> => {
  const rows = await db
    .select()
    .from(courseCategories)
    .where(eq(courseCategories.id, id))
    .limit(1);
  const current = rows[0];
  if (!current) {
    throw new CategoryError(404, "CATEGORY_NOT_FOUND", "Kategori tidak ditemukan");
  }
  const patch: { name?: string; isActive?: boolean; sortOrder?: number } = {};
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (name !== current.name) {
      const clash = await db
        .select({ id: courseCategories.id })
        .from(courseCategories)
        .where(and(eq(courseCategories.name, name), ne(courseCategories.id, id)))
        .limit(1);
      if (clash[0]) {
        throw new CategoryError(409, "CATEGORY_TAKEN", "Nama kategori sudah dipakai");
      }
      patch.name = name;
    }
  }
  if (input.isActive !== undefined) patch.isActive = input.isActive;
  if (input.sortOrder !== undefined) patch.sortOrder = input.sortOrder;

  const updated = await db.transaction(async (tx) => {
    if (Object.keys(patch).length > 0) {
      await tx.update(courseCategories).set(patch).where(eq(courseCategories.id, id));
    }
    // Ganti nama ikut mengubah kursus yang memakai nama lama (satu transaksi)
    // agar katalog tak yatim; nonaktif tidak mengubah kursus lama.
    let renamedCount = 0;
    if (patch.name !== undefined) {
      const affected = await tx
        .select({ id: courses.id })
        .from(courses)
        .where(eq(courses.category, current.name));
      renamedCount = affected.length;
      if (renamedCount > 0) {
        await tx
          .update(courses)
          .set({ category: patch.name })
          .where(eq(courses.category, current.name));
      }
    }
    await tx.insert(auditLogs).values({
      actorUserId: actorId,
      action: "category.update",
      targetType: "category",
      targetIdInt: id,
      metadata: { categoryId: id, changed: Object.keys(patch), renamedCourses: renamedCount },
    });
    const fresh = await tx
      .select()
      .from(courseCategories)
      .where(eq(courseCategories.id, id))
      .limit(1);
    return { row: fresh[0] ?? null, renamedCount };
  });
  if (!updated.row) throw new Error("Gagal memperbarui kategori");
  const counts = await courseCountByName();
  return {
    ...toPublic(updated.row),
    isActive: updated.row.isActive,
    courseCount: counts.get(updated.row.name) ?? 0,
    createdAt: updated.row.createdAt,
    updatedAt: updated.row.updatedAt,
  };
};

/** Satu kategori + hitungan pemakaian (admin). */
export const getCategoryById = async (id: number): Promise<AdminCategory> => {
  const rows = await db
    .select()
    .from(courseCategories)
    .where(eq(courseCategories.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) {
    throw new CategoryError(404, "CATEGORY_NOT_FOUND", "Kategori tidak ditemukan");
  }
  const counts = await courseCountByName();
  return {
    ...toPublic(row),
    isActive: row.isActive,
    courseCount: counts.get(row.name) ?? 0,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
};

/** Hapus permanen — ditolak bila masih dipakai kursus (nonaktifkan saja). */
export const deleteCategory = async (
  actorId: number,
  id: number
): Promise<{ id: number; removed: boolean }> => {
  const rows = await db
    .select()
    .from(courseCategories)
    .where(eq(courseCategories.id, id))
    .limit(1);
  const current = rows[0];
  if (!current) {
    throw new CategoryError(404, "CATEGORY_NOT_FOUND", "Kategori tidak ditemukan");
  }
  const used = await db
    .select({ n: sql<number>`count(*)` })
    .from(courses)
    .where(eq(courses.category, current.name));
  if (Number(used[0]?.n ?? 0) > 0) {
    throw new CategoryError(
      409,
      "CATEGORY_IN_USE",
      "Kategori masih dipakai kursus — nonaktifkan saja agar kursus lama tetap tampil"
    );
  }
  await db.transaction(async (tx) => {
    await tx.delete(courseCategories).where(eq(courseCategories.id, id));
    await tx.insert(auditLogs).values({
      actorUserId: actorId,
      action: "category.delete",
      targetType: "category",
      targetIdInt: id,
      metadata: { categoryId: id, slug: current.slug, name: current.name },
    });
  });
  return { id, removed: true };
};

// ---------- Validasi untuk kursus ----------

/** Nama kategori aktif → nama kanonis (NULL bila tak dikenal/nonaktif). */
export const resolveActiveCategoryName = async (name: string): Promise<string | null> => {
  const rows = await db
    .select({ name: courseCategories.name })
    .from(courseCategories)
    .where(and(eq(courseCategories.name, name.trim()), eq(courseCategories.isActive, true)))
    .limit(1);
  return rows[0]?.name ?? null;
};
