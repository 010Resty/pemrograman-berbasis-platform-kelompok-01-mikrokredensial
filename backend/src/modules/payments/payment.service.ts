import { z } from "zod";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../../db";
import {
  auditLogs,
  courses,
  enrollments,
  files,
  patunganGroups,
  payments,
  users,
  voucherRedemptions,
  vouchers,
} from "../../db/schema";
import { validateDiscountVoucher } from "../vouchers/voucher.service";
import { getActivePromoForCourse } from "../promos/promo.service";
import {
  PatunganError,
  getPendingGroupForMember,
  setMemberPaymentState,
  tryCompleteGroup,
} from "../patungan/patungan.service";
import {
  buildInvoice,
  computeExpectedTotal,
  isAmountSufficient,
} from "./payment.rules";

export class PaymentError extends Error {
  http: number;
  code: string;
  constructor(http: number, code: string, message: string) {
    super(message);
    this.http = http;
    this.code = code;
  }
}

export const createPaymentSchema = z
  .object({
    method: z.literal("qris").default("qris"),
    proofFileId: z.number().int().positive().optional(),
    voucherCode: z.string().trim().min(1).max(100).optional(),
    // Iuran patungan: wajib anggota grup pending; nominal = iuran anggota,
    // tanpa voucher/promo (non-stack: harga patungan sudah final).
    patunganGroupId: z.number().int().positive().optional(),
  })
  .strict();

export const attachProofSchema = z
  .object({
    proofFileId: z.number().int().positive(),
  })
  .strict();

export const verifyPaymentSchema = z
  .object({
    decision: z.enum(["terima", "tolak"]),
    amountPaid: z.number().int().min(0).optional(),
    reason: z.string().trim().max(500).optional(),
  })
  .strict()
  .refine((v) => v.decision !== "tolak" || (v.reason !== undefined && v.reason.length > 0), {
    message: "Alasan penolakan wajib diisi",
    path: ["reason"],
  })
  .refine((v) => v.decision !== "terima" || v.amountPaid !== undefined, {
    message: "Nominal yang diterima wajib diisi saat menerima",
    path: ["amountPaid"],
  });

const writePaymentAudit = async (
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  entry: {
    actorUserId: number | null;
    action: string;
    targetType: string;
    targetIdInt?: number;
    metadata?: Record<string, unknown>;
  }
) => {
  await tx.insert(auditLogs).values({
    actorUserId: entry.actorUserId,
    action: entry.action,
    targetType: entry.targetType,
    targetIdInt: entry.targetIdInt ?? null,
    metadata: entry.metadata ?? null,
  });
};

async function getPaidCourse(courseId: number) {
  const rows = await db
    .select({
      id: courses.id,
      title: courses.title,
      status: courses.status,
      priceNominal: courses.priceNominal,
    })
    .from(courses)
    .where(eq(courses.id, courseId))
    .limit(1);
  const course = rows[0];
  if (!course || course.status === "draft") {
    throw new PaymentError(404, "COURSE_NOT_FOUND", "Kursus tidak ditemukan");
  }
  if (course.status === "archived") {
    throw new PaymentError(403, "ENROLLMENT_CLOSED", "Pendaftaran kursus ini sudah ditutup");
  }
  if (!course.priceNominal || course.priceNominal <= 0) {
    throw new PaymentError(400, "COURSE_FREE", "Kursus ini gratis — daftar langsung tanpa bayar");
  }
  return course;
}

async function assertOwnProofFile(proofFileId: number, userId: number): Promise<void> {
  const rows = await db
    .select({ id: files.id, ownerUserId: files.ownerUserId, kind: files.kind })
    .from(files)
    .where(eq(files.id, proofFileId))
    .limit(1);
  const f = rows[0];
  if (!f) throw new PaymentError(404, "PROOF_NOT_FOUND", "Bukti bayar tidak ditemukan");
  if (f.ownerUserId !== userId) {
    throw new PaymentError(403, "PROOF_NOT_OWNED", "Berkas bukti bukan milik Anda");
  }
  if (f.kind !== "payment_proof") {
    throw new PaymentError(400, "PROOF_KIND_INVALID", "Berkas harus diunggah sebagai bukti pembayaran");
  }
}

/** Buat antrean pembayaran (idempoten per antrean menunggu). */
export const createPayment = async (
  userId: number,
  courseId: number,
  input: z.infer<typeof createPaymentSchema>
) => {
  const course = await getPaidCourse(courseId);

  // Sudah punya akses aktif → tolak seperti redeem (hemat kuota voucher).
  const existing = await db
    .select({ status: enrollments.status })
    .from(enrollments)
    .where(and(eq(enrollments.userId, userId), eq(enrollments.courseId, courseId)))
    .limit(1);
  if (existing[0] && (existing[0].status === "active" || existing[0].status === "completed")) {
    throw new PaymentError(409, "ALREADY_ENROLLED", "Anda sudah terdaftar di kursus ini");
  }

  // Cabang iuran patungan: nominal = iuran anggota, tanpa voucher/promo.
  if (input.patunganGroupId !== undefined) {
    return createPatunganPayment(userId, courseId, input.patunganGroupId, input.proofFileId, input.voucherCode);
  }

  let voucherCode: string | null = null;
  let discountAmount = 0;
  let promoSlug: string | null = null;
  if (input.voucherCode !== undefined) {
    try {
      const q = await validateDiscountVoucher(userId, input.voucherCode, courseId, course.priceNominal);
      voucherCode = q.code;
      discountAmount = q.discountAmount;
    } catch (e) {
      if (e !== null && typeof e === "object" && "http" in e && "message" in e) {
        // Teruskan kode voucher asli (VOUCHER_EXPIRED/QUOTA_EXHAUSTED/...) agar
        // klien bisa membedakan; fallback generik bila bentuk tak dikenal.
        const err = e as { http?: unknown; code?: unknown; message: unknown };
        throw new PaymentError(
          typeof err.http === "number" ? err.http : 500,
          typeof err.code === "string" ? err.code : "VOUCHER_INVALID",
          String(err.message)
        );
      }
      throw e;
    }
  }

  // Promo admin (percent-only): non-stack vs voucher — terbesar menang.
  // Seri dimenangkan promo agar kuota voucher tidak hangus sia-sia.
  // Voucher yang kalah TIDAK dikonsumsi (tetap bisa dipakai di pembayaran lain).
  const promo = await getActivePromoForCourse(courseId, course.priceNominal);
  if (promo !== null && promo.discountAmount >= discountAmount && promo.discountAmount > 0) {
    voucherCode = null;
    discountAmount = promo.discountAmount;
    promoSlug = promo.slug;
  }

  const expected = computeExpectedTotal(course.priceNominal, discountAmount);

  // Antrean menunggu yang masih terbuka dipakai ulang (idempoten).
  const open = await db
    .select()
    .from(payments)
    .where(
      and(
        eq(payments.userId, userId),
        eq(payments.courseId, courseId),
        eq(payments.status, "menunggu")
      )
    )
    .limit(1);
  if (open[0]) {
    const patch: Partial<typeof payments.$inferInsert> = {};
    if (input.proofFileId !== undefined) {
      await assertOwnProofFile(input.proofFileId, userId);
      patch.proofFileId = input.proofFileId;
    }
    // Sinkronkan harga ke hitungan terbaru SELAMA bukti belum diunggah:
    // promo/voucher bisa berubah setelah antrean dibuat; verifikasi memakai
    // nilai tersimpan, jadi tampilan dan verifikasi harus sama.
    const proofLocked = open[0].proofFileId !== null || input.proofFileId !== undefined;
    if (!proofLocked) {
      patch.voucherCode = voucherCode;
      patch.discountAmount = discountAmount;
      patch.promoSlug = promoSlug;
      patch.amountExpected = expected;
    }
    if (Object.keys(patch).length > 0) {
      await db.update(payments).set(patch).where(eq(payments.id, open[0].id));
    }
    const refreshed = await db.select().from(payments).where(eq(payments.id, open[0].id)).limit(1);
    return { ...refreshed[0]!, reused: true as const };
  }

  if (input.proofFileId !== undefined) {
    await assertOwnProofFile(input.proofFileId, userId);
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const invoice = buildInvoice(courseId);
    try {
      await db.insert(payments).values({
        userId,
        courseId,
        invoice,
        method: "qris",
        amountExpected: expected,
        voucherCode,
        discountAmount,
        promoSlug,
        proofFileId: input.proofFileId ?? null,
        status: "menunggu",
      });
      const rows = await db.select().from(payments).where(eq(payments.invoice, invoice)).limit(1);
      await db.insert(auditLogs).values({
        actorUserId: userId,
        action: "payment.create",
        targetType: "payment",
        targetIdInt: rows[0]?.id ?? null,
        metadata: { paymentId: rows[0]?.id ?? null, courseId, invoice, voucherCode, promoSlug },
      });
      return { ...rows[0]!, reused: false as const };
    } catch (e) {
      if (e !== null && typeof e === "object" && "code" in e && e.code === "ER_DUP_ENTRY" && attempt < 4) {
        continue;
      }
      throw e;
    }
  }
  throw new PaymentError(503, "RETRY_EXHAUSTED", "Coba lagi dalam beberapa saat");
};

/**
 * Buat antrean iuran patungan: pemanggil wajib anggota grup pending,
 * nominal = iuran anggota (tanpa voucher/promo). Satu antrean menunggu
 * per (peserta, kursus) tetap berlaku; antrean individu yang masih terbuka
 * memblokir iuran grup (selesaikan dulu) agar tidak ada tagihan ganda.
 */
const createPatunganPayment = async (
  userId: number,
  courseId: number,
  groupId: number,
  proofFileId?: number,
  voucherCode?: string
) => {
  // Validasi kursus berbayar + terbit (tolak draft/arsip/gratis).
  await getPaidCourse(courseId);
  if (voucherCode !== undefined) {
    throw new PaymentError(400, "PATUNGAN_NO_VOUCHER", "Iuran patungan tidak digabung voucher/promo");
  }
  let shareAmount: number;
  try {
    const ctx = await getPendingGroupForMember(groupId, userId);
    if (ctx.group.courseId !== courseId) {
      throw new PaymentError(400, "PATUNGAN_COURSE_MISMATCH", "Grup ini bukan untuk kursus tersebut");
    }
    shareAmount = ctx.shareAmount;
  } catch (e) {
    if (e instanceof PatunganError) {
      throw new PaymentError(e.http, e.code, e.message);
    }
    throw e;
  }

  const open = await db
    .select()
    .from(payments)
    .where(
      and(
        eq(payments.userId, userId),
        eq(payments.courseId, courseId),
        eq(payments.status, "menunggu")
      )
    )
    .limit(1);
  if (open[0] && open[0].patunganGroupId !== groupId) {
    throw new PaymentError(
      409,
      "PATUNGAN_QUEUE_CONFLICT",
      "Masih ada antrean pembayaran individu kursus ini. Selesaikan dulu sebelum membayar iuran patungan."
    );
  }
  if (open[0]) {
    if (proofFileId !== undefined) {
      await assertOwnProofFile(proofFileId, userId);
    }
    await db.transaction(async (tx) => {
      if (proofFileId !== undefined) {
        await tx.update(payments).set({ proofFileId }).where(eq(payments.id, open[0]!.id));
      }
      await setMemberPaymentState(tx, groupId, userId, { paymentStatus: "menunggu", paymentId: open[0]!.id });
    });
    const refreshed = await db.select().from(payments).where(eq(payments.id, open[0].id)).limit(1);
    return { ...refreshed[0]!, reused: true as const };
  }

  if (proofFileId !== undefined) {
    await assertOwnProofFile(proofFileId, userId);
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const invoice = buildInvoice(courseId);
    try {
      const paymentId = await db.transaction(async (tx) => {
        const [h] = await tx.insert(payments).values({
          userId,
          courseId,
          invoice,
          method: "qris",
          amountExpected: shareAmount,
          voucherCode: null,
          discountAmount: 0,
          promoSlug: null,
          patunganGroupId: groupId,
          proofFileId: proofFileId ?? null,
          status: "menunggu",
        });
        const id = Number((h as unknown as { insertId: number }).insertId);
        await setMemberPaymentState(tx, groupId, userId, { paymentStatus: "menunggu", paymentId: id });
        await tx.insert(auditLogs).values({
          actorUserId: userId,
          action: "payment.create",
          targetType: "payment",
          targetIdInt: id,
          metadata: { paymentId: id, courseId, invoice, patunganGroupId: groupId, shareAmount },
        });
        return id;
      });
      const rows = await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
      return { ...rows[0]!, reused: false as const };
    } catch (e) {
      if (e !== null && typeof e === "object" && "code" in e && e.code === "ER_DUP_ENTRY" && attempt < 4) {
        continue;
      }
      throw e;
    }
  }
  throw new PaymentError(503, "RETRY_EXHAUSTED", "Coba lagi dalam beberapa saat");
};

/** Lampirkan/ganti bukti bayar pada antrean menunggu milik sendiri. */
export const attachPaymentProof = async (
  userId: number,
  paymentId: number,
  proofFileId: number
) => {
  await assertOwnProofFile(proofFileId, userId);
  const rows = await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
  const p = rows[0];
  if (!p || p.userId !== userId) {
    throw new PaymentError(404, "PAYMENT_NOT_FOUND", "Pembayaran tidak ditemukan");
  }
  if (p.status !== "menunggu") {
    throw new PaymentError(409, "PAYMENT_LOCKED", "Pembayaran ini sudah diproses admin");
  }
  await db.transaction(async (tx) => {
    await tx.update(payments).set({ proofFileId }).where(eq(payments.id, paymentId));
    // Iuran patungan: bukti baru (termasuk setelah ditolak) → menunggu lagi.
    if (p.patunganGroupId !== null) {
      await setMemberPaymentState(tx, p.patunganGroupId, userId, { paymentStatus: "menunggu", paymentId });
    }
  });
  await db.insert(auditLogs).values({
    actorUserId: userId,
    action: "payment.proof",
    targetType: "payment",
    targetIdInt: paymentId,
    metadata: { paymentId, courseId: p.courseId, proofFileId },
  });
  const updated = await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
  return updated[0]!;
};

/** Status pembayaran terakhir peserta untuk satu kursus (polling). */
export const myPaymentForCourse = async (userId: number, courseId: number) => {
  const rows = await db
    .select()
    .from(payments)
    .where(and(eq(payments.userId, userId), eq(payments.courseId, courseId)))
    .orderBy(desc(payments.id))
    .limit(1);
  return rows[0] ?? null;
};

/** Daftar pembayaran milik sendiri (untuk bell/notifikasi peserta). */
export const listMyPayments = async (
  userId: number,
  filter: { status?: "menunggu" | "diverifikasi" | "ditolak"; limit?: number; page?: number }
) => {
  const limit = Math.min(Math.max(filter.limit ?? 20, 1), 100);
  const page = Math.max(filter.page ?? 1, 1);
  const conditions = [eq(payments.userId, userId)];
  if (filter.status !== undefined) conditions.push(eq(payments.status, filter.status));
  const where = and(...conditions);
  const [countRows, rows] = await Promise.all([
    db
      .select({ n: sql<number>`count(*)` })
      .from(payments)
      .where(where),
    db
      .select({
        id: payments.id,
        invoice: payments.invoice,
        courseId: payments.courseId,
        courseTitle: courses.title,
        method: payments.method,
        amountExpected: payments.amountExpected,
        amountPaid: payments.amountPaid,
        voucherCode: payments.voucherCode,
        discountAmount: payments.discountAmount,
        promoSlug: payments.promoSlug,
        patunganGroupId: payments.patunganGroupId,
        proofFileId: payments.proofFileId,
        status: payments.status,
        rejectReason: payments.rejectReason,
        verifiedAt: payments.verifiedAt,
        createdAt: payments.createdAt,
      })
      .from(payments)
      .leftJoin(courses, eq(courses.id, payments.courseId))
      .where(where)
      .orderBy(desc(payments.id))
      .limit(limit)
      .offset((page - 1) * limit),
  ]);
  return { items: rows, total: Number(countRows[0]?.n ?? 0), page, limit };
};

/** Antrean untuk admin (filter status/kursus). */
export const listPaymentsAdmin = async (filter: {
  status?: "menunggu" | "diverifikasi" | "ditolak";
  courseId?: number;
  limit?: number;
  page?: number;
}) => {
  const limit = Math.min(Math.max(filter.limit ?? 20, 1), 100);
  const page = Math.max(filter.page ?? 1, 1);
  const conditions = [];
  if (filter.status !== undefined) conditions.push(eq(payments.status, filter.status));
  if (filter.courseId !== undefined) conditions.push(eq(payments.courseId, filter.courseId));
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const [countRows, rows] = await Promise.all([
    db
      .select({ n: sql<number>`count(*)` })
      .from(payments)
      .where(where),
    db
      .select({
        id: payments.id,
        userId: payments.userId,
        userEmail: users.email,
        userName: users.name,
        courseId: payments.courseId,
        courseTitle: courses.title,
        invoice: payments.invoice,
        method: payments.method,
        amountExpected: payments.amountExpected,
        amountPaid: payments.amountPaid,
        voucherCode: payments.voucherCode,
        discountAmount: payments.discountAmount,
        promoSlug: payments.promoSlug,
        patunganGroupId: payments.patunganGroupId,
        proofFileId: payments.proofFileId,
        status: payments.status,
        rejectReason: payments.rejectReason,
        verifiedAt: payments.verifiedAt,
        createdAt: payments.createdAt,
      })
      .from(payments)
      .innerJoin(users, eq(users.id, payments.userId))
      .leftJoin(courses, eq(courses.id, payments.courseId))
      .where(where)
      .orderBy(desc(payments.id))
      .limit(limit)
      .offset((page - 1) * limit),
  ]);
  return { items: rows, total: Number(countRows[0]?.n ?? 0), page, limit };
};

/**
 * Verifikasi admin: terima (nominal >= tagihan → grant akses + hanguskan
 * voucher bila ada) atau tolak (wajib alasan). Transaksional + anti-race.
 */
export const verifyPayment = async (
  adminId: number,
  paymentId: number,
  input: z.infer<typeof verifyPaymentSchema>
) => {
  return db.transaction(async (tx) => {
    const locked = await tx.select().from(payments).where(eq(payments.id, paymentId)).for("update").limit(1);
    const p = locked[0];
    if (!p) throw new PaymentError(404, "PAYMENT_NOT_FOUND", "Pembayaran tidak ditemukan");
    if (p.status !== "menunggu") {
      throw new PaymentError(409, "PAYMENT_LOCKED", "Pembayaran ini sudah diproses");
    }

    // Iuran patungan: tidak grant per pembayaran. Tolak → anggota ditolak;
    // terima → anggota diverifikasi, dan akses dibuka ke SEMUA anggota
    // sekaligus hanya saat seluruh grup lunas (tanpa akses parsial).
    if (p.patunganGroupId !== null) {
      const gRows = await tx
        .select({ status: patunganGroups.status })
        .from(patunganGroups)
        .where(eq(patunganGroups.id, p.patunganGroupId))
        .limit(1);
      if (!gRows[0] || gRows[0].status !== "pending") {
        throw new PaymentError(409, "GROUP_NOT_PENDING", "Grup patungan ini sudah selesai/dibatalkan");
      }
      if (input.decision === "tolak") {
        await tx
          .update(payments)
          .set({ status: "ditolak", rejectReason: input.reason ?? null, verifiedBy: adminId, verifiedAt: new Date() })
          .where(eq(payments.id, paymentId));
        await setMemberPaymentState(tx, p.patunganGroupId, p.userId, { paymentStatus: "ditolak", paymentId });
        await tx.insert(auditLogs).values({
          actorUserId: adminId,
          action: "payment.verify",
          targetType: "payment",
          targetIdInt: paymentId,
          metadata: { paymentId, decision: "ditolak", reason: input.reason ?? null, patunganGroupId: p.patunganGroupId },
        });
        return { id: paymentId, status: "ditolak" as const, groupCompleted: false as const };
      }

      const amountPaid = input.amountPaid as number;
      const expected = computeExpectedTotal(p.amountExpected, 0);
      if (!isAmountSufficient(amountPaid, expected)) {
        throw new PaymentError(
          400,
          "AMOUNT_INSUFFICIENT",
          `Nominal kurang: diterima ${amountPaid}, iuran ${expected}`
        );
      }
      await tx
        .update(payments)
        .set({ status: "diverifikasi", amountPaid, verifiedBy: adminId, verifiedAt: new Date() })
        .where(eq(payments.id, paymentId));
      await setMemberPaymentState(tx, p.patunganGroupId, p.userId, { paymentStatus: "diverifikasi", paymentId });
      const groupCompleted = await tryCompleteGroup(tx, adminId, p.patunganGroupId);
      await tx.insert(auditLogs).values({
        actorUserId: adminId,
        action: "payment.verify",
        targetType: "payment",
        targetIdInt: paymentId,
        metadata: {
          paymentId,
          decision: "terima",
          amountPaid,
          amountExpected: p.amountExpected,
          courseId: p.courseId,
          userId: p.userId,
          patunganGroupId: p.patunganGroupId,
          groupCompleted,
        },
      });
      return { id: paymentId, status: "diverifikasi" as const, amountPaid, groupCompleted };
    }

    if (input.decision === "tolak") {
      await tx
        .update(payments)
        .set({ status: "ditolak", rejectReason: input.reason ?? null, verifiedBy: adminId, verifiedAt: new Date() })
        .where(eq(payments.id, paymentId));
      await tx.insert(auditLogs).values({
        actorUserId: adminId,
        action: "payment.verify",
        targetType: "payment",
        targetIdInt: paymentId,
        metadata: { paymentId, decision: "ditolak", reason: input.reason ?? null },
      });
      return { id: paymentId, status: "ditolak" as const };
    }

    const amountPaid = input.amountPaid as number;
    const expected = computeExpectedTotal(p.amountExpected, 0);
    if (!isAmountSufficient(amountPaid, expected)) {
      throw new PaymentError(
        400,
        "AMOUNT_INSUFFICIENT",
        `Nominal kurang: diterima ${amountPaid}, tagihan ${expected}`
      );
    }

    // Hanguskan voucher diskon (bila ada) dengan pola anti-race yang sama
    // seperti redeem: kunci baris → cek kuota → catat → tambah counter.
    if (p.voucherCode !== null) {
      const vLocked = await tx
        .select()
        .from(vouchers)
        .where(eq(vouchers.code, p.voucherCode))
        .for("update")
        .limit(1);
      const v = vLocked[0];
      if (!v || v.usedCount >= v.maxUses || (v.status !== "available" && v.status !== "assigned")) {
        throw new PaymentError(409, "VOUCHER_EXHAUSTED", "Kuota voucher habis — pembayaran tidak dapat disetujui");
      }
      const dup = await tx
        .select({ id: voucherRedemptions.id })
        .from(voucherRedemptions)
        .where(and(eq(voucherRedemptions.voucherCode, p.voucherCode), eq(voucherRedemptions.userId, p.userId)))
        .limit(1);
      if (dup[0]) {
        throw new PaymentError(409, "VOUCHER_REUSED", "Voucher ini sudah pernah dipakai akun ini");
      }
      await tx.insert(voucherRedemptions).values({ voucherCode: p.voucherCode, userId: p.userId, courseId: p.courseId });
      await tx
        .update(vouchers)
        .set({ usedCount: sql`${vouchers.usedCount} + 1` })
        .where(eq(vouchers.code, p.voucherCode));
      await tx
        .update(vouchers)
        .set({ status: "redeemed" })
        .where(and(eq(vouchers.code, p.voucherCode), sql`${vouchers.usedCount} >= ${vouchers.maxUses}`));
    }

    await tx
      .insert(enrollments)
      .values({ userId: p.userId, courseId: p.courseId, source: "payment:manual", status: "active" })
      .onDuplicateKeyUpdate({ set: { source: "payment:manual", status: "active" } });
    await tx
      .update(payments)
      .set({ status: "diverifikasi", amountPaid, verifiedBy: adminId, verifiedAt: new Date() })
      .where(eq(payments.id, paymentId));
    await tx.insert(auditLogs).values({
      actorUserId: adminId,
      action: "payment.verify",
      targetType: "payment",
      targetIdInt: paymentId,
      metadata: {
        paymentId,
        decision: "terima",
        amountPaid,
        amountExpected: p.amountExpected,
        voucherCode: p.voucherCode,
        discountAmount: p.discountAmount,
        courseId: p.courseId,
        userId: p.userId,
      },
    });
    return { id: paymentId, status: "diverifikasi" as const, amountPaid };
  });
};
