import { z } from "zod";
import { eq, and, or, like, inArray, desc, asc } from "drizzle-orm";
import { db } from "../../db";
import { courses, courseInstructors, users } from "../../db/schema";

export const CATEGORIES = [
  "Pengembangan Web",
  "Basis Data",
  "Jaringan",
  "Keamanan",
  "AI & Data",
  "Infrastruktur",
  "Desain",
  "Bisnis",
] as const;

export const LEVELS = ["Pemula", "Menengah", "Lanjutan"] as const;

/** Query list kursus — koersi string query-param (selalu string) ke angka/enum.
 * Dipakai di boundary controller (validate-early, zod coercion-for-form-data). */
export const courseListQuerySchema = z.object({
  category: z.string().trim().min(1).max(100).optional(),
  period: z.string().trim().min(1).max(100).optional(),
  q: z.string().trim().max(200).optional(),
  status: z.enum(["draft", "published", "archived"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  sort: z.enum(["newest", "oldest"]).default("newest"),
});

export type CourseListQuery = z.infer<typeof courseListQuerySchema>;

const urlOrPath = z
  .string()
  .trim()
  .max(500)
  .refine(
    (v) =>
      v === "" ||
      v.startsWith("/") ||
      /^https?:\/\/.+/i.test(v),
    "Cover harus URL http(s) atau path /api/..."
  );

export const createCourseSchema = z.object({
  title: z.string().trim().min(10).max(120),
  category: z.enum(CATEGORIES),
  level: z.enum(LEVELS).default("Pemula"),
  durationMonths: z.number().int().min(1).max(36),
  description: z.string().trim().min(30).max(5000),
  coverUrl: urlOrPath.optional().nullable(),
  period: z.enum(["upcoming", "ongoing", "ended"]).default("upcoming"),
  startMonth: z.string().trim().min(1).max(100),
  priceNominal: z.number().int().min(0),
  outcomes: z.array(z.string().trim().min(10)).min(2).max(20),
  tools: z.array(z.string().trim().min(1)).min(1).max(20),
});

export const updateCourseSchema = createCourseSchema
  .partial()
  .extend({
    status: z.enum(["draft", "published", "archived"]).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "Tidak ada field yang diubah",
  });

export type CreateCourseInput = z.infer<typeof createCourseSchema>;

const formatIDR = (n: number): string =>
  n === 0 ? "GRATIS" : "Rp" + n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");

const durationLabel = (months: number): string => `${months} Bulan`;

/** true bila user boleh mengelola kursus (admin atau pengampu/pembuat). */
export const canManageCourse = async (
  userId: number,
  role: string,
  courseId: number
): Promise<boolean> => {
  if (role === "admin") return true;
  const [course] = await db
    .select({ createdBy: courses.createdBy })
    .from(courses)
    .where(eq(courses.id, courseId))
    .limit(1);
  if (!course) return false;
  if (course.createdBy === userId) return true;
  const link = await db
    .select({ courseId: courseInstructors.courseId })
    .from(courseInstructors)
    .where(
      and(
        eq(courseInstructors.courseId, courseId),
        eq(courseInstructors.userId, userId)
      )
    )
    .limit(1);
  return link.length > 0;
};

export const createCourse = async (
  ownerUserId: number,
  input: CreateCourseInput
) => {
  // Transaksi multi-step (drizzle skill): kursus + relasi pengampu harus atomik.
  const courseId = await db.transaction(async (tx) => {
    const [header] = await tx.insert(courses).values({
      title: input.title,
      description: input.description,
      category: input.category,
      level: input.level,
      duration: durationLabel(input.durationMonths),
      image: input.coverUrl?.trim() ? input.coverUrl.trim() : null,
      status: "draft",
      priceLabel: formatIDR(input.priceNominal),
      priceNominal: input.priceNominal,
      period: input.period,
      startMonth: input.startMonth,
      outcomes: input.outcomes,
      requirements: [],
      tools: input.tools,
      createdBy: ownerUserId,
    });

    const id = Number((header as unknown as { insertId: number }).insertId);
    if (!Number.isInteger(id) || id <= 0) {
      throw new Error("Gagal membaca kursus baru");
    }

    await tx.insert(courseInstructors).values({
      courseId: id,
      userId: ownerUserId,
    });
    return id;
  });

  return getCourseById(courseId);
};

export const getCourseById = async (courseId: number) => {
  const rows = await db
    .select()
    .from(courses)
    .where(eq(courses.id, courseId))
    .limit(1);
  const course = rows[0];
  if (!course) return null;
  const instructors = await db
    .select({ id: users.id, name: users.name })
    .from(courseInstructors)
    .innerJoin(users, eq(users.id, courseInstructors.userId))
    .where(eq(courseInstructors.courseId, courseId));
  return { ...course, instructors };
};

export interface CourseListFilter {
  category?: string;
  period?: string;
  q?: string;
  status?: "draft" | "published" | "archived";
}

export const listCourses = async (
  filter: CourseListFilter,
  onlyPublished: boolean,
  pagination?: { limit?: number; page?: number; sort?: "newest" | "oldest" }
) => {
  const conditions = [];
  if (onlyPublished || !filter.status) {
    conditions.push(eq(courses.status, "published"));
  } else if (filter.status) {
    conditions.push(eq(courses.status, filter.status));
  }
  if (filter.category) conditions.push(eq(courses.category, filter.category));
  if (filter.period) conditions.push(eq(courses.period, filter.period));
  if (filter.q) {
    conditions.push(
      or(
        like(courses.title, `%${filter.q}%`),
        like(courses.description, `%${filter.q}%`)
      )
    );
  }
  const limit = Math.min(Math.max(pagination?.limit ?? 100, 1), 100);
  const page = Math.max(pagination?.page ?? 1, 1);
  const order =
    pagination?.sort === "oldest" ? asc(courses.id) : desc(courses.id);
  const rows = await db
    .select()
    .from(courses)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(order)
    .limit(limit)
    .offset((page - 1) * limit);
  return rows;
};

export const listMyCourses = async (
  userId: number,
  pagination?: { limit?: number; page?: number; sort?: "newest" | "oldest" }
) => {
  const links = await db
    .select({ courseId: courseInstructors.courseId })
    .from(courseInstructors)
    .where(eq(courseInstructors.userId, userId));
  const owned = new Set(links.map((l) => l.courseId));
  const created = await db
    .select({ id: courses.id })
    .from(courses)
    .where(eq(courses.createdBy, userId));
  for (const c of created) owned.add(c.id);
  if (owned.size === 0) return [];
  const ids = [...owned];
  const limit = Math.min(Math.max(pagination?.limit ?? 100, 1), 100);
  const page = Math.max(pagination?.page ?? 1, 1);
  const order =
    pagination?.sort === "oldest" ? asc(courses.id) : desc(courses.id);
  return db
    .select()
    .from(courses)
    .where(inArray(courses.id, ids))
    .orderBy(order)
    .limit(limit)
    .offset((page - 1) * limit);
};

/** Hapus kursus + seluruh tree (FK cascade) dalam satu transaksi.
 * Mengembalikan URL cover bila menunjuk file internal agar controller
 * bisa bersih-bersih metadata + disk best-effort. */
export const deleteCourse = async (
  courseId: number
): Promise<{ coverUrl: string | null }> => {
  const existing = await getCourseById(courseId);
  const coverUrl =
    typeof existing?.image === "string" && existing.image.trim() !== ""
      ? existing.image.trim()
      : null;
  await db.transaction(async (tx) => {
    await tx.delete(courses).where(eq(courses.id, courseId));
  });
  return { coverUrl };
};

/** Ambil id file cover internal dari URL /api/v1/files/:id/content. */
export const parseCoverFileId = (coverUrl: string | null): number | null => {
  if (!coverUrl) return null;
  const m = coverUrl.match(/\/api\/v1\/files\/(\d+)\/content/);
  if (!m) return null;
  const id = Number(m[1]);
  return Number.isInteger(id) && id > 0 ? id : null;
};

export const updateCourse = async (
  courseId: number,
  input: Partial<CreateCourseInput> & { status?: "draft" | "published" | "archived" }
) => {
  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.category !== undefined) patch.category = input.category;
  if (input.level !== undefined) patch.level = input.level;
  if (input.durationMonths !== undefined) patch.duration = durationLabel(input.durationMonths);
  if (input.description !== undefined) patch.description = input.description;
  if (input.coverUrl !== undefined) patch.image = input.coverUrl?.trim() ? input.coverUrl.trim() : null;
  if (input.period !== undefined) patch.period = input.period;
  if (input.startMonth !== undefined) patch.startMonth = input.startMonth;
  if (input.priceNominal !== undefined) {
    patch.priceNominal = input.priceNominal;
    patch.priceLabel = formatIDR(input.priceNominal);
  }
  if (input.outcomes !== undefined) patch.outcomes = input.outcomes;
  if (input.tools !== undefined) patch.tools = input.tools;
  if (input.status !== undefined) patch.status = input.status;

  await db.update(courses).set(patch).where(eq(courses.id, courseId));
  return getCourseById(courseId);
};
