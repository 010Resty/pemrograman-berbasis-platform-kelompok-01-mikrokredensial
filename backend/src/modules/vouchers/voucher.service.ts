import { randomBytes } from "node:crypto";
import { z } from "zod";
import { and, desc, eq, like, or, sql } from "drizzle-orm";
import { db } from "../../db";
import {
  auditLogs,
  courses,
  enrollments,
  users,
  voucherRedemptions,
  vouchers,
} from "../../db/schema";

export class VoucherError extends Error {
  readonly http: number;
  readonly code: string;
  constructor(http: number, code: string, message: string) {
    super(message);
    this.http = http;
    this.code = code;
  }
}

// ---------- Skema input ----------

const codePattern = /^[A-Z0-9-]{4,32}$/;

export const createVoucherSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(4)
      .max(32)
      .optional()
      .transform((v) => (v === undefined ? v : v.toUpperCase().replace(/\s+/g, "")))
      .refine((v) => v === undefined || codePattern.test(v), {
        message: "Format kode 4–32 karakter (huruf, angka, tanda -)",
      }),
    courseId: z.number().int().positive(),
    kind: z.enum(["personal", "umum"]),
    maxUses: z.number().int().min(1).max(10000).optional(),
    assignedUserId: z.number().int().positive().optional(),
    assignedEmail: z.string().trim().email().max(191).optional(),
    expiresAt: z.string().trim().max(100).optional(),
  })
  .strict()
  .refine((v) => v.kind !== "personal" || v.assignedUserId !== undefined || v.assignedEmail !== undefined, {
    message: "Voucher personal wajib menentukan penerima",
    path: ["assignedUserId"],
  });

export const redeemSchema = z
  .object({
    code: z.string().trim().min(1).max(100),
    courseId: z.number().int().positive(),
  })
  .strict();

// ---------- Helper ----------

const normalizeCode = (code: string): string =>
  code.trim().toUpperCase().replace(/\s+/g, "");

const genCode = (): string =>
  `ATS-${randomBytes(4).toString("hex").toUpperCase()}`;

const writeAuditLog = async (
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  entry: {
    actorUserId: number;
    action: string;
    targetType: string;
    targetIdStr?: string;
    metadata?: Record<string, unknown>;
  }
) => {
  await tx.insert(auditLogs).values({
    actorUserId: entry.actorUserId,
    action: entry.action,
    targetType: entry.targetType,
    targetIdStr: entry.targetIdStr ?? null,
    metadata: entry.metadata ?? null,
  });
};

const resolveUser = async (
  userId?: number,
  email?: string
): Promise<{ id: number; email: string; name: string; role: string } | null> => {
  if (userId !== undefined) {
    const rows = await db
      .select({ id: users.id, email: users.email, name: users.name, role: users.role })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return rows[0] ?? null;
  }
  const rows = await db
    .select({ id: users.id, email: users.email, name: users.name, role: users.role })
    .from(users)
    .where(eq(users.email, email!.toLowerCase()))
    .limit(1);
  return rows[0] ?? null;
};

export interface PublicVoucher {
  code: string;
  courseId: number | null;
  courseTitle: string | null;
  kind: string;
  maxUses: number;
  usedCount: number;
  remaining: number;
  assignedUserId: number | null;
  assignedEmail: string | null;
  expiresAt: Date | null;
  status: string;
}

// ---------- Pembuatan (admin) ----------

export const createVoucher = async (
  actorId: number,
  input: z.infer<typeof createVoucherSchema>
) => {
  const course = await db
    .select({ id: courses.id, title: courses.title })
    .from(courses)
    .where(eq(courses.id, input.courseId))
    .limit(1);
  if (!course[0]) {
    throw new VoucherError(404, "COURSE_NOT_FOUND", "Kursus tidak ditemukan");
  }
  let assignee: { id: number; email: string; name: string } | null = null;
  if (input.kind === "personal") {
    const found = await resolveUser(input.assignedUserId, input.assignedEmail);
    if (!found) {
      throw new VoucherError(404, "USER_NOT_FOUND", "Penerima voucher tidak ditemukan");
    }
    assignee = found;
  } else if (input.assignedUserId !== undefined || input.assignedEmail !== undefined) {
    throw new VoucherError(
      400,
      "ASSIGNEE_FORBIDDEN",
      "Voucher umum tidak terikat ke akun tertentu"
    );
  }
  const maxUses = input.kind === "personal" ? 1 : (input.maxUses ?? 1);
  if (input.kind === "personal" && input.maxUses !== undefined && input.maxUses !== 1) {
    throw new VoucherError(
      400,
      "PERSONAL_MAX_USES",
      "Voucher personal hanya berlaku satu kali"
    );
  }
  let expiresAt: Date | null = null;
  if (input.expiresAt !== undefined) {
    const t = new Date(input.expiresAt);
    if (Number.isNaN(t.getTime())) {
      throw new VoucherError(400, "INVALID_EXPIRY", "Tanggal kedaluwarsa tidak valid");
    }
    if (t.getTime() <= Date.now()) {
      throw new VoucherError(400, "INVALID_EXPIRY", "Tanggal kedaluwarsa harus di masa depan");
    }
    expiresAt = t;
  }
  const code = input.code ?? genCode();
  const dup = await db
    .select({ code: vouchers.code })
    .from(vouchers)
    .where(eq(vouchers.code, code))
    .limit(1);
  if (dup[0]) {
    throw new VoucherError(409, "CODE_TAKEN", "Kode voucher sudah digunakan");
  }
  await db.transaction(async (tx) => {
    await tx.insert(vouchers).values({
      code,
      courseId: input.courseId,
      kind: input.kind,
      maxUses,
      usedCount: 0,
      assignedUserId: assignee?.id ?? null,
      expiresAt,
      status: input.kind === "personal" ? "assigned" : "available",
    });
    await writeAuditLog(tx, {
      actorUserId: actorId,
      action: "voucher.create",
      targetType: "voucher",
      targetIdStr: code,
      metadata: {
        code,
        courseId: input.courseId,
        kind: input.kind,
        maxUses,
        assignedUserId: assignee?.id ?? null,
      },
    });
  });
  return {
    code,
    courseId: input.courseId,
    kind: input.kind,
    maxUses,
    usedCount: 0,
    status: input.kind === "personal" ? "assigned" : "available",
  };
};

// ---------- Daftar & detail (admin) ----------

export interface VoucherListFilter {
  courseId?: number;
  status?: string;
  kind?: "personal" | "umum";
  q?: string;
  limit?: number;
  page?: number;
}

export const listVouchers = async (
  filter: VoucherListFilter = {}
): Promise<{ items: PublicVoucher[]; total: number }> => {
  const conditions = [];
  if (filter.courseId !== undefined) conditions.push(eq(vouchers.courseId, filter.courseId));
  if (filter.status !== undefined) {
    conditions.push(eq(vouchers.status, filter.status as "available"));
  }
  if (filter.kind !== undefined) conditions.push(eq(vouchers.kind, filter.kind));
  if (filter.q) {
    conditions.push(
      or(
        like(vouchers.code, `%${filter.q}%`),
        like(courses.title, `%${filter.q}%`)
      )
    );
  }
  const limit = Math.min(Math.max(filter.limit ?? 20, 1), 100);
  const page = Math.max(filter.page ?? 1, 1);
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const [countRows, rows] = await Promise.all([
    db
      .select({ n: sql<number>`count(*)` })
      .from(vouchers)
      .leftJoin(courses, eq(courses.id, vouchers.courseId))
      .where(where),
    db
      .select({
        code: vouchers.code,
        courseId: vouchers.courseId,
        courseTitle: courses.title,
        kind: vouchers.kind,
        maxUses: vouchers.maxUses,
        usedCount: vouchers.usedCount,
        assignedUserId: vouchers.assignedUserId,
        expiresAt: vouchers.expiresAt,
        status: vouchers.status,
      })
      .from(vouchers)
      .leftJoin(courses, eq(courses.id, vouchers.courseId))
      .where(where)
      .orderBy(desc(vouchers.code))
      .limit(limit)
      .offset((page - 1) * limit),
  ]);
  const assignedIds = [...new Set(rows.map((r) => r.assignedUserId).filter((id): id is number => id !== null))];
  const emailById = new Map<number, string>();
  if (assignedIds.length > 0) {
    const us = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(
        // drizzle inArray diimpor di bawah bila perlu; pakai or sederhana untuk jumlah kecil
        or(...assignedIds.map((id) => eq(users.id, id)))
      );
    for (const u of us) emailById.set(u.id, u.email);
  }
  return {
    items: rows.map((r) => ({
      ...r,
      assignedEmail: r.assignedUserId !== null ? (emailById.get(r.assignedUserId) ?? null) : null,
      remaining: Math.max(r.maxUses - r.usedCount, 0),
    })),
    total: Number(countRows[0]?.n ?? 0),
  };
};

export const getVoucherDetail = async (code: string) => {
  const rows = await db
    .select({
      code: vouchers.code,
      courseId: vouchers.courseId,
      courseTitle: courses.title,
      kind: vouchers.kind,
      maxUses: vouchers.maxUses,
      usedCount: vouchers.usedCount,
      assignedUserId: vouchers.assignedUserId,
      expiresAt: vouchers.expiresAt,
      status: vouchers.status,
    })
    .from(vouchers)
    .leftJoin(courses, eq(courses.id, vouchers.courseId))
    .where(eq(vouchers.code, normalizeCode(code)))
    .limit(1);
  const v = rows[0];
  if (!v) throw new VoucherError(404, "VOUCHER_NOT_FOUND", "Voucher tidak ditemukan");
  const reds = await db
    .select({
      id: voucherRedemptions.id,
      userId: voucherRedemptions.userId,
      userEmail: users.email,
      userName: users.name,
      courseId: voucherRedemptions.courseId,
      redeemedAt: voucherRedemptions.redeemedAt,
    })
    .from(voucherRedemptions)
    .innerJoin(users, eq(users.id, voucherRedemptions.userId))
    .where(eq(voucherRedemptions.voucherCode, v.code))
    .orderBy(desc(voucherRedemptions.redeemedAt), desc(voucherRedemptions.id))
    .limit(50);
  return {
    ...v,
    remaining: Math.max(v.maxUses - v.usedCount, 0),
    redemptions: reds,
    redemptionCount: reds.length,
  };
};

export const listRedemptions = async (
  code: string,
  pagination: { limit?: number; page?: number } = {}
) => {
  const normalized = normalizeCode(code);
  const exists = await db
    .select({ code: vouchers.code })
    .from(vouchers)
    .where(eq(vouchers.code, normalized))
    .limit(1);
  if (!exists[0]) throw new VoucherError(404, "VOUCHER_NOT_FOUND", "Voucher tidak ditemukan");
  const limit = Math.min(Math.max(pagination.limit ?? 20, 1), 100);
  const page = Math.max(pagination.page ?? 1, 1);
  const where = eq(voucherRedemptions.voucherCode, normalized);
  const [countRows, rows] = await Promise.all([
    db.select({ n: sql<number>`count(*)` }).from(voucherRedemptions).where(where),
    db
      .select({
        id: voucherRedemptions.id,
        userId: voucherRedemptions.userId,
        userEmail: users.email,
        userName: users.name,
        courseId: voucherRedemptions.courseId,
        redeemedAt: voucherRedemptions.redeemedAt,
      })
      .from(voucherRedemptions)
      .innerJoin(users, eq(users.id, voucherRedemptions.userId))
      .where(where)
      .orderBy(desc(voucherRedemptions.redeemedAt), desc(voucherRedemptions.id))
      .limit(limit)
      .offset((page - 1) * limit),
  ]);
  return { items: rows, total: Number(countRows[0]?.n ?? 0) };
};

// ---------- Nonaktif / aktifkan (admin) ----------

export const setVoucherStatus = async (
  actorId: number,
  code: string,
  target: "revoked" | "active",
  reason?: string
) => {
  const normalized = normalizeCode(code);
  const rows = await db
    .select()
    .from(vouchers)
    .where(eq(vouchers.code, normalized))
    .limit(1);
  const v = rows[0];
  if (!v) throw new VoucherError(404, "VOUCHER_NOT_FOUND", "Voucher tidak ditemukan");
  if (target === "revoked") {
    if (v.status === "revoked") {
      throw new VoucherError(409, "ALREADY_REVOKED", "Voucher sudah dinonaktifkan");
    }
    if (v.status === "redeemed" || v.status === "expired") {
      throw new VoucherError(409, "STATUS_FINAL", "Voucher yang sudah terpakai/kedaluwarsa tidak dapat diubah");
    }
    await db.transaction(async (tx) => {
      await tx.update(vouchers).set({ status: "revoked" }).where(eq(vouchers.code, normalized));
      await writeAuditLog(tx, {
        actorUserId: actorId,
        action: "voucher.disable",
        targetType: "voucher",
        targetIdStr: normalized,
        metadata: { code: normalized, reason: reason ?? null },
      });
    });
    return { code: normalized, status: "revoked" as const };
  }
  if (v.status !== "revoked") {
    throw new VoucherError(409, "NOT_REVOKED", "Hanya voucher nonaktif yang dapat diaktifkan kembali");
  }
  const restored = v.kind === "personal" ? "assigned" : "available";
  await db.transaction(async (tx) => {
    await tx
      .update(vouchers)
      .set({ status: restored as "assigned" })
      .where(eq(vouchers.code, normalized));
    await writeAuditLog(tx, {
      actorUserId: actorId,
      action: "voucher.enable",
      targetType: "voucher",
      targetIdStr: normalized,
      metadata: { code: normalized, reason: reason ?? null },
    });
  });
  return { code: normalized, status: restored };
};

// ---------- Penukaran (peserta) ----------

/** Kelayakan kursus untuk akses via voucher (selaras aturan enrollFree). */
const redeemableCourse = async (courseId: number) => {
  const rows = await db.select().from(courses).where(eq(courses.id, courseId)).limit(1);
  const course = rows[0];
  if (!course || course.status === "draft") {
    throw new VoucherError(404, "COURSE_NOT_FOUND", "Kursus tidak ditemukan");
  }
  if (course.status === "archived" || course.period === "ended") {
    throw new VoucherError(403, "ENROLLMENT_CLOSED", "Pendaftaran kursus ini sudah ditutup");
  }
  return course;
};

/** Tukar voucher → akses kursus. Atomik anti-race (UNIQUE + UPDATE bersyarat). */
export const redeemVoucher = async (
  userId: number,
  rawCode: string,
  courseId: number
) => {
  const code = normalizeCode(rawCode);
  const vRows = await db.select().from(vouchers).where(eq(vouchers.code, code)).limit(1);
  const v = vRows[0];
  if (!v) {
    throw new VoucherError(404, "CODE_NOT_FOUND", "Kode voucher tidak valid");
  }
  if (v.status === "revoked") {
    throw new VoucherError(403, "VOUCHER_DISABLED", "Voucher ini dinonaktifkan");
  }
  if (v.expiresAt !== null && v.expiresAt.getTime() <= Date.now()) {
    // Tandai kedaluwarsa agar konsisten, lalu tolak.
    await db.update(vouchers).set({ status: "expired" }).where(eq(vouchers.code, code));
    throw new VoucherError(403, "VOUCHER_EXPIRED", "Voucher ini sudah kedaluwarsa");
  }
  if (v.status === "expired") {
    throw new VoucherError(403, "VOUCHER_EXPIRED", "Voucher ini sudah kedaluwarsa");
  }
  // Sudah pernah menukar voucher ini → tolak presisi tanpa sentuh kuota.
  // (Dicek sebelum kuota agar penukar lama tidak menerima QUOTA_EXHAUSTED.)
  const prior = await db
    .select({ id: voucherRedemptions.id })
    .from(voucherRedemptions)
    .where(
      and(
        eq(voucherRedemptions.voucherCode, code),
        eq(voucherRedemptions.userId, userId)
      )
    )
    .limit(1);
  if (prior[0]) {
    throw new VoucherError(
      409,
      "ALREADY_REDEEMED",
      "Voucher ini sudah pernah Anda tukar"
    );
  }
  if (v.status === "redeemed" || v.usedCount >= v.maxUses) {
    throw new VoucherError(403, "QUOTA_EXHAUSTED", "Kuota voucher sudah habis");
  }
  if (v.kind === "personal" && v.assignedUserId !== userId) {
    throw new VoucherError(403, "VOUCHER_FOR_ACCOUNT", "Voucher ini untuk akun lain");
  }
  if (v.courseId === null || v.courseId !== courseId) {
    throw new VoucherError(
      403,
      "COURSE_MISMATCH",
      "Voucher ini tidak berlaku untuk kursus tersebut"
    );
  }
  await redeemableCourse(courseId);

  // Sudah enrolled aktif → tolak tanpa menyentuh kuota.
  const existing = await db
    .select({ status: enrollments.status })
    .from(enrollments)
    .where(and(eq(enrollments.userId, userId), eq(enrollments.courseId, courseId)))
    .limit(1);
  if (existing[0] && ["active", "completed"].includes(existing[0].status)) {
    throw new VoucherError(409, "ALREADY_ENROLLED", "Anda sudah terdaftar di kursus ini");
  }

  // Eksekusi dengan retry deadlock + backoff: baris voucher dikunci dulu
  // (SELECT FOR UPDATE) sehingga balapan antre tertib; sisa deadlock
  // residual diulang dengan jeda acak.
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await db.transaction(async (tx) => {
        // Kunci baris voucher: balapan slot menjadi antrean tertib.
        const locked = await tx
          .select()
          .from(vouchers)
          .where(eq(vouchers.code, code))
          .for("update")
          .limit(1);
        const lv = locked[0];
        if (!lv) {
          throw new VoucherError(404, "CODE_NOT_FOUND", "Kode voucher tidak valid");
        }
        if (
          lv.usedCount >= lv.maxUses ||
          (lv.status !== "available" && lv.status !== "assigned")
        ) {
          throw new VoucherError(403, "QUOTA_EXHAUSTED", "Kuota voucher sudah habis");
        }
        // Baris jejak: UNIQUE(voucher,user) menggagalkan balapan akun sama.
        await tx.insert(voucherRedemptions).values({ voucherCode: code, userId, courseId });
        await tx
          .update(vouchers)
          .set({ usedCount: sql`${vouchers.usedCount} + 1` })
          .where(eq(vouchers.code, code));
        // Transisi ke redeemed bila kuota tepat habis (kondisional, idempoten).
        await tx
          .update(vouchers)
          .set({ status: "redeemed" })
          .where(
            and(
              eq(vouchers.code, code),
              sql`${vouchers.usedCount} >= ${vouchers.maxUses}`
            )
          );
        await tx
          .insert(enrollments)
          .values({ userId, courseId, source: "voucher", status: "active" })
          .onDuplicateKeyUpdate({ set: { source: "voucher", status: "active" } });
        await writeAuditLog(tx, {
          actorUserId: userId,
          action: "voucher.redeem",
          targetType: "voucher",
          targetIdStr: code,
          metadata: { code, userId, courseId },
        });
      });
      return { courseId, status: "active", source: "voucher", voucherCode: code };
    } catch (e) {
      if (isDupEntry(e)) {
        throw new VoucherError(
          409,
          "ALREADY_REDEEMED",
          "Voucher ini sudah pernah Anda tukar"
        );
      }
      if (isDeadlock(e) && attempt < 4) {
        await new Promise((r) => setTimeout(r, 25 * (attempt + 1) + Math.random() * 50));
        continue;
      }
      throw e;
    }
  }
  throw new VoucherError(503, "RETRY_EXHAUSTED", "Coba lagi dalam beberapa saat");
};

const isDupEntry = (e: unknown): boolean =>
  e !== null &&
  typeof e === "object" &&
  "code" in e &&
  (e as { code?: unknown }).code === "ER_DUP_ENTRY";

const isDeadlock = (e: unknown): boolean =>
  e !== null &&
  typeof e === "object" &&
  "code" in e &&
  ((e as { code?: unknown }).code === "ER_LOCK_DEADLOCK" ||
    (e as { code?: unknown }).code === "ER_LOCK_WAIT_TIMEOUT");
