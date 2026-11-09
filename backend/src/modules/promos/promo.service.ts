import { z } from "zod";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "../../db";
import {
  auditLogs,
  courses,
  promoCampaigns,
  promoCourses,
} from "../../db/schema";

export class PromoError extends Error {
  readonly http: number;
  readonly code: string;
  constructor(http: number, code: string, message: string) {
    super(message);
    this.http = http;
    this.code = code;
  }
}

// ---------- Skema input (diskon fase 1: percent-only 1–90) ----------

const slugPattern = /^[a-z0-9-]{3,100}$/;

const isoDateTime = z
  .string()
  .trim()
  .max(100)
  .refine((v) => v === "" || !Number.isNaN(new Date(v).getTime()), {
    message: "Format tanggal tidak valid (gunakan ISO, mis. 2026-12-31T23:59:59)",
  })
  .transform((v) => (v === "" ? undefined : v));

export const createCampaignSchema = z
  .object({
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .min(3)
      .max(100)
      .refine((v) => slugPattern.test(v), {
        message: "Slug 3–100 karakter (huruf kecil, angka, tanda -)",
      }),
    title: z.string().trim().min(3).max(200),
    badgeLabel: z.string().trim().min(2).max(100).optional(),
    type: z.enum(["diskon", "kurasi", "patungan"]).default("diskon"),
    discountPercent: z.number().int().min(1).max(90).optional(),
    status: z.enum(["draft", "active", "archived"]).default("draft"),
    startsAt: isoDateTime.optional(),
    endsAt: isoDateTime.optional(),
  })
  .strict()
  .refine((v) => v.type !== "diskon" || v.discountPercent !== undefined, {
    message: "Promo diskon wajib punya discountPercent 1–90",
    path: ["discountPercent"],
  })
  .refine((v) => v.type === "diskon" || v.discountPercent === undefined, {
    message: "Hanya promo diskon yang boleh punya discountPercent",
    path: ["discountPercent"],
  })
  .refine(
    (v) =>
      v.startsAt === undefined ||
      v.endsAt === undefined ||
      new Date(v.startsAt).getTime() <= new Date(v.endsAt).getTime(),
    { message: "startsAt harus sebelum atau sama dengan endsAt", path: ["endsAt"] }
  );

export const patchCampaignSchema = z
  .object({
    title: z.string().trim().min(3).max(200).optional(),
    badgeLabel: z.string().trim().min(2).max(100).nullable().optional(),
    type: z.enum(["diskon", "kurasi", "patungan"]).optional(),
    discountPercent: z.number().int().min(1).max(90).nullable().optional(),
    status: z.enum(["draft", "active", "archived"]).optional(),
    startsAt: isoDateTime.nullable().optional(),
    endsAt: isoDateTime.nullable().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, {
    message: "Minimal satu field wajib diisi",
  })
  .refine(
    (v) =>
      v.startsAt === undefined ||
      v.endsAt === undefined ||
      v.startsAt === null ||
      v.endsAt === null ||
      new Date(v.startsAt).getTime() <= new Date(v.endsAt).getTime(),
    { message: "startsAt harus sebelum atau sama dengan endsAt", path: ["endsAt"] }
  );

export const addCourseSchema = z
  .object({
    courseId: z.number().int().positive(),
    position: z.number().int().min(0).max(10000).default(0),
    customBadge: z.string().trim().min(2).max(100).optional(),
  })
  .strict();

// ---------- Helper ----------

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const writePromoAudit = async (
  tx: DbTx,
  entry: {
    actorUserId: number;
    action: string;
    targetIdInt?: number | null;
    targetIdStr?: string | null;
    metadata?: Record<string, unknown>;
  }
) => {
  await tx.insert(auditLogs).values({
    actorUserId: entry.actorUserId,
    action: entry.action,
    targetType: "promo",
    targetIdInt: entry.targetIdInt ?? null,
    targetIdStr: entry.targetIdStr ?? null,
    metadata: entry.metadata ?? null,
  });
};

const toDateOrNull = (v: string | null | undefined): Date | null => {
  if (v === undefined || v === null) return null;
  const t = new Date(v);
  return Number.isNaN(t.getTime()) ? null : t;
};

/** Kampanye dianggap aktif bila status active + di dalam jendela waktu. */
export const isCampaignActive = (
  c: { status: string; startsAt: Date | null; endsAt: Date | null },
  now: Date = new Date()
): boolean => {
  if (c.status !== "active") return false;
  if (c.startsAt !== null && c.startsAt.getTime() > now.getTime()) return false;
  if (c.endsAt !== null && c.endsAt.getTime() < now.getTime()) return false;
  return true;
};

/** Diskon rupiah dari persen (dibulatkan ke bawah, tidak melebihi harga). */
export const promoDiscountAmount = (priceNominal: number, percent: number): number =>
  Math.min(Math.max(0, Math.floor(priceNominal)), Math.floor((Math.max(0, Math.floor(priceNominal)) * percent) / 100));

export interface ActivePromoQuote {
  slug: string;
  title: string;
  badgeLabel: string | null;
  discountPercent: number;
  discountAmount: number;
  endsAt: Date | null;
}

/**
 * Promo diskon aktif terbaik untuk satu kursus (persen terbesar menang).
 * Dipakai pembayaran: pemenang vs voucher (non-stack, terbesar menang).
 */
export const getActivePromoForCourse = async (
  courseId: number,
  priceNominal: number,
  now: Date = new Date()
): Promise<ActivePromoQuote | null> => {
  const rows = await db
    .select({
      slug: promoCampaigns.slug,
      title: promoCampaigns.title,
      badgeLabel: promoCampaigns.badgeLabel,
      discountPercent: promoCampaigns.discountPercent,
      status: promoCampaigns.status,
      startsAt: promoCampaigns.startsAt,
      endsAt: promoCampaigns.endsAt,
    })
    .from(promoCourses)
    .innerJoin(promoCampaigns, eq(promoCampaigns.id, promoCourses.campaignId))
    .where(eq(promoCourses.courseId, courseId));
  let best: ActivePromoQuote | null = null;
  for (const r of rows) {
    if (r.discountPercent === null) continue;
    if (!isCampaignActive({ status: r.status, startsAt: r.startsAt, endsAt: r.endsAt }, now)) continue;
    const amount = promoDiscountAmount(priceNominal, r.discountPercent);
    if (best === null || r.discountPercent > best.discountPercent) {
      best = {
        slug: r.slug,
        title: r.title,
        badgeLabel: r.badgeLabel,
        discountPercent: r.discountPercent,
        discountAmount: amount,
        endsAt: r.endsAt,
      };
    }
  }
  return best;
};

/**
 * Kuote promo publik untuk satu kursus (dipakai pratinjau/pembayaran
 * untuk menampilkan harga promo; sumber diskon tetap server).
 */
export const getPromoQuoteForCourse = async (
  courseId: number,
  now: Date = new Date()
): Promise<(ActivePromoQuote & { promoPrice: number; priceNominal: number }) | null> => {
  const rows = await db
    .select({ priceNominal: courses.priceNominal, status: courses.status })
    .from(courses)
    .where(eq(courses.id, courseId))
    .limit(1);
  const course = rows[0];
  if (!course || course.status !== "published" || course.priceNominal <= 0) return null;
  const best = await getActivePromoForCourse(courseId, course.priceNominal, now);
  if (!best) return null;
  return {
    ...best,
    promoPrice: Math.max(0, course.priceNominal - best.discountAmount),
    priceNominal: course.priceNominal,
  };
};

// ---------- Kelola (admin) ----------

export const createCampaign = async (
  actorId: number,
  input: z.infer<typeof createCampaignSchema>
) => {
  const dup = await db
    .select({ id: promoCampaigns.id })
    .from(promoCampaigns)
    .where(eq(promoCampaigns.slug, input.slug))
    .limit(1);
  if (dup[0]) throw new PromoError(409, "SLUG_TAKEN", "Slug promo sudah digunakan");
  try {
    return await db.transaction(async (tx) => {
      const [h] = await tx.insert(promoCampaigns).values({
        slug: input.slug,
        title: input.title,
        badgeLabel: input.badgeLabel ?? null,
        type: input.type,
        discountPercent: input.type === "diskon" ? (input.discountPercent as number) : null,
        status: input.status,
        startsAt: toDateOrNull(input.startsAt),
        endsAt: toDateOrNull(input.endsAt),
        createdBy: actorId,
      });
      const id = Number((h as unknown as { insertId: number }).insertId);
      await writePromoAudit(tx, {
        actorUserId: actorId,
        action: "promo.create",
        targetIdInt: id,
        targetIdStr: input.slug,
        metadata: { slug: input.slug, type: input.type },
      });
      const rows = await tx.select().from(promoCampaigns).where(eq(promoCampaigns.id, id)).limit(1);
      return rows[0]!;
    });
  } catch (e) {
    if (e !== null && typeof e === "object" && "code" in e && (e as { code: unknown }).code === "ER_DUP_ENTRY") {
      throw new PromoError(409, "SLUG_TAKEN", "Slug promo sudah digunakan");
    }
    throw e;
  }
};

export const patchCampaign = async (
  actorId: number,
  slug: string,
  input: z.infer<typeof patchCampaignSchema>
) => {
  const rows = await db.select().from(promoCampaigns).where(eq(promoCampaigns.slug, slug)).limit(1);
  const cur = rows[0];
  if (!cur) throw new PromoError(404, "PROMO_NOT_FOUND", "Promo tidak ditemukan");
  const nextType = input.type ?? cur.type;
  const nextPercent =
    input.discountPercent !== undefined ? input.discountPercent : cur.discountPercent;
  if (nextType !== "diskon" && nextPercent !== null) {
    throw new PromoError(400, "DISCOUNT_FORBIDDEN", "Hanya promo diskon yang boleh punya discountPercent");
  }
  if (nextType === "diskon" && (nextPercent === null || nextPercent === undefined)) {
    throw new PromoError(400, "DISCOUNT_REQUIRED", "Promo diskon wajib punya discountPercent 1–90");
  }
  const patch: Partial<typeof promoCampaigns.$inferInsert> = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.badgeLabel !== undefined) patch.badgeLabel = input.badgeLabel;
  if (input.type !== undefined) patch.type = input.type;
  if (input.discountPercent !== undefined) {
    patch.discountPercent = nextType === "diskon" ? (input.discountPercent as number) : null;
  }
  if (input.status !== undefined) patch.status = input.status;
  if (input.startsAt !== undefined) patch.startsAt = toDateOrNull(input.startsAt);
  if (input.endsAt !== undefined) patch.endsAt = toDateOrNull(input.endsAt);
  if (nextType !== "diskon") patch.discountPercent = null;
  // Validasi jendela efektif (nilai lama + patch): cegah kampanye mati selamanya.
  const effStarts = patch.startsAt !== undefined ? patch.startsAt : (cur.startsAt as Date | null);
  const effEnds = patch.endsAt !== undefined ? patch.endsAt : (cur.endsAt as Date | null);
  if (effStarts !== null && effEnds !== null && effStarts.getTime() > effEnds.getTime()) {
    throw new PromoError(400, "INVALID_WINDOW", "startsAt harus sebelum atau sama dengan endsAt");
  }
  await db.transaction(async (tx) => {
    await tx.update(promoCampaigns).set(patch).where(eq(promoCampaigns.id, cur.id));
    await writePromoAudit(tx, {
      actorUserId: actorId,
      action: "promo.update",
      targetIdInt: cur.id,
      targetIdStr: cur.slug,
      metadata: { slug: cur.slug, changed: Object.keys(patch) },
    });
  });
  const fresh = await db.select().from(promoCampaigns).where(eq(promoCampaigns.id, cur.id)).limit(1);
  return fresh[0]!;
};

export const addCourseToCampaign = async (
  actorId: number,
  slug: string,
  input: z.infer<typeof addCourseSchema>
) => {
  const camp = await db.select().from(promoCampaigns).where(eq(promoCampaigns.slug, slug)).limit(1);
  const c = camp[0];
  if (!c) throw new PromoError(404, "PROMO_NOT_FOUND", "Promo tidak ditemukan");
  const course = await db
    .select({ id: courses.id, status: courses.status, priceNominal: courses.priceNominal })
    .from(courses)
    .where(eq(courses.id, input.courseId))
    .limit(1);
  if (!course[0]) throw new PromoError(404, "COURSE_NOT_FOUND", "Kursus tidak ditemukan");
  if (course[0].status === "draft") {
    throw new PromoError(400, "COURSE_DRAFT", "Kursus draft tidak bisa masuk promo (terbitkan dulu)");
  }
  if (course[0].status === "archived") {
    throw new PromoError(400, "COURSE_ARCHIVED", "Kursus arsip tidak bisa masuk promo");
  }
  if (c.type === "diskon" && (course[0].priceNominal ?? 0) <= 0) {
    throw new PromoError(400, "COURSE_FREE", "Promo diskon hanya untuk kursus berbayar");
  }
  try {
    await db.transaction(async (tx) => {
      await tx.insert(promoCourses).values({
        campaignId: c.id,
        courseId: input.courseId,
        position: input.position,
        customBadge: input.customBadge ?? null,
      });
      await writePromoAudit(tx, {
        actorUserId: actorId,
        action: "promo.course.add",
        targetIdInt: c.id,
        targetIdStr: c.slug,
        metadata: { slug: c.slug, courseId: input.courseId },
      });
    });
  } catch (e) {
    if (e !== null && typeof e === "object" && "code" in e && (e as { code: unknown }).code === "ER_DUP_ENTRY") {
      throw new PromoError(409, "ALREADY_INCLUDED", "Kursus ini sudah ada di promo tersebut");
    }
    throw e;
  }
  return { slug: c.slug, courseId: input.courseId };
};

export const removeCourseFromCampaign = async (actorId: number, slug: string, courseId: number) => {
  const camp = await db.select().from(promoCampaigns).where(eq(promoCampaigns.slug, slug)).limit(1);
  const c = camp[0];
  if (!c) throw new PromoError(404, "PROMO_NOT_FOUND", "Promo tidak ditemukan");
  await db.transaction(async (tx) => {
    await tx
      .delete(promoCourses)
      .where(and(eq(promoCourses.campaignId, c.id), eq(promoCourses.courseId, courseId)));
    await writePromoAudit(tx, {
      actorUserId: actorId,
      action: "promo.course.remove",
      targetIdInt: c.id,
      targetIdStr: c.slug,
      metadata: { slug: c.slug, courseId },
    });
  });
  return { slug: c.slug, courseId };
};

export const listCampaignsAdmin = async (filter: { status?: string; type?: string } = {}) => {
  const conditions = [];
  if (filter.status !== undefined) conditions.push(eq(promoCampaigns.status, filter.status as "draft"));
  if (filter.type !== undefined) conditions.push(eq(promoCampaigns.type, filter.type as "diskon"));
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const rows = await db
    .select()
    .from(promoCampaigns)
    .where(where)
    .orderBy(desc(promoCampaigns.id));
  const counts = await db
    .select({ campaignId: promoCourses.campaignId, n: sql<number>`count(*)` })
    .from(promoCourses)
    .groupBy(promoCourses.campaignId);
  const byCampaign = new Map(counts.map((r) => [r.campaignId, Number(r.n)]));
  return rows.map((r) => ({ ...r, courseCount: byCampaign.get(r.id) ?? 0 }));
};

// ---------- Baca publik ----------

export interface PublicPromoCourse {
  courseId: number;
  title: string;
  image: string | null;
  priceLabel: string;
  priceNominal: number;
  discountPercent: number | null;
  promoPrice: number | null;
  badgeLabel: string | null;
  promoEndsAt: Date | null;
}

const coursePromoShape = async (campaignId: number, discountPercent: number | null) => {
  const rows = await db
    .select({
      courseId: promoCourses.courseId,
      position: promoCourses.position,
      customBadge: promoCourses.customBadge,
      title: courses.title,
      image: courses.image,
      priceLabel: courses.priceLabel,
      priceNominal: courses.priceNominal,
      status: courses.status,
    })
    .from(promoCourses)
    .innerJoin(courses, eq(courses.id, promoCourses.courseId))
    .where(eq(promoCourses.campaignId, campaignId))
    .orderBy(asc(promoCourses.position), asc(promoCourses.courseId));
  return rows
    .filter((r) => r.status === "published")
    .map((r) => ({
      courseId: r.courseId,
      title: r.title,
      image: r.image,
      priceLabel: r.priceLabel,
      priceNominal: r.priceNominal,
      discountPercent,
      promoPrice:
        discountPercent === null
          ? null
          : Math.max(0, r.priceNominal - promoDiscountAmount(r.priceNominal, discountPercent)),
      badgeLabel: r.customBadge,
      promoEndsAt: null as Date | null,
    }));
};

export const listPublicCampaigns = async (now: Date = new Date()) => {
  const rows = await db
    .select()
    .from(promoCampaigns)
    .where(eq(promoCampaigns.status, "active"))
    .orderBy(desc(promoCampaigns.id));
  const out = [];
  for (const c of rows) {
    if (!isCampaignActive({ status: c.status, startsAt: c.startsAt, endsAt: c.endsAt }, now)) continue;
    const members = await coursePromoShape(c.id, c.type === "diskon" ? c.discountPercent : null);
    out.push({
      slug: c.slug,
      title: c.title,
      badgeLabel: c.badgeLabel,
      type: c.type,
      discountPercent: c.type === "diskon" ? c.discountPercent : null,
      startsAt: c.startsAt,
      endsAt: c.endsAt,
      courses: members.map((m) => ({ ...m, badgeLabel: m.badgeLabel ?? c.badgeLabel, promoEndsAt: c.endsAt })),
    });
  }
  return out;
};

export const getPublicCampaign = async (slug: string, now: Date = new Date()) => {
  const rows = await db.select().from(promoCampaigns).where(eq(promoCampaigns.slug, slug)).limit(1);
  const c = rows[0];
  if (!c || !isCampaignActive({ status: c.status, startsAt: c.startsAt, endsAt: c.endsAt }, now)) {
    throw new PromoError(404, "PROMO_NOT_FOUND", "Promo tidak ditemukan atau sudah berakhir");
  }
  const members = await coursePromoShape(c.id, c.type === "diskon" ? c.discountPercent : null);
  return {
    slug: c.slug,
    title: c.title,
    badgeLabel: c.badgeLabel,
    type: c.type,
    discountPercent: c.type === "diskon" ? c.discountPercent : null,
    startsAt: c.startsAt,
    endsAt: c.endsAt,
    courses: members.map((m) => ({ ...m, badgeLabel: m.badgeLabel ?? c.badgeLabel, promoEndsAt: c.endsAt })),
  };
};

/**
 * Detail untuk admin: tanpa filter status/jendela agar kampanye draft pun
 * bisa dilengkapi anggotanya sebelum diaktifkan.
 */
export const getAdminCampaign = async (slug: string) => {
  const rows = await db.select().from(promoCampaigns).where(eq(promoCampaigns.slug, slug)).limit(1);
  const c = rows[0];
  if (!c) throw new PromoError(404, "PROMO_NOT_FOUND", "Promo tidak ditemukan");
  const members = await db
    .select({
      courseId: promoCourses.courseId,
      position: promoCourses.position,
      customBadge: promoCourses.customBadge,
      title: courses.title,
      status: courses.status,
      priceNominal: courses.priceNominal,
    })
    .from(promoCourses)
    .innerJoin(courses, eq(courses.id, promoCourses.courseId))
    .where(eq(promoCourses.campaignId, c.id))
    .orderBy(asc(promoCourses.position), asc(promoCourses.courseId));
  return { ...c, courses: members };
};
