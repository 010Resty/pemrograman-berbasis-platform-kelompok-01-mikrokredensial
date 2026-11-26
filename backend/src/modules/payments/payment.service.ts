import { z } from "zod";
import { promises as fs } from "node:fs";
import path from "node:path";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "../../db";
import {
  auditLogs,
  courses,
  enrollments,
  fileVariants,
  files,
  patunganGroupMembers,
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
import { recordRevenueSnapshot } from "../revenues/revenue.service";
import { getUploadsDir } from "../uploads/upload.service";
import { DokuError, createDokuQrisOrder } from "../doku/doku.client";
import { isDokuConfigured, loadDokuConfig } from "../doku/doku.config";
import { mapDokuStatus } from "../doku/doku.status";
import { renderQrPng } from "../doku/doku.qr";

export class PaymentError extends Error {
  http: number;
  code: string;
  constructor(http: number, code: string, message: string) {
    super(message);
    this.http = http;
    this.code = code;
  }
}

/** DOKU error → PaymentError (kode HTTP + code dipertahankan). */
const asPaymentError = (e: unknown): PaymentError => {
  if (e instanceof PaymentError) return e;
  if (e instanceof DokuError) return new PaymentError(e.http, e.code, e.message);
  throw e;
};

export const createPaymentSchema = z
  .object({
    method: z.literal("qris").default("qris"),
    // Gateway: manual (QRIS statis + verifikasi admin, lawas) atau
    // doku (QRIS dinamis DOKU + webhook otomatis).
    gateway: z.enum(["manual", "doku"]).default("manual"),
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

  // Iuran patungan via DOKU menyusul (setelah QRIS individu live).
  if (input.gateway === "doku" && input.patunganGroupId !== undefined) {
    throw new PaymentError(
      400,
      "PATUNGAN_DOKU_PENDING",
      "Iuran patungan via DOKU belum tersedia — ajukan pembayaran individu dulu"
    );
  }
  // QRIS dinamis DOKU tidak memakai bukti bayar — cukup pindai QR.
  if (input.gateway === "doku" && input.proofFileId !== undefined) {
    throw new PaymentError(
      400,
      "DOKU_NO_PROOF",
      "QRIS dinamis DOKU tidak memakai bukti bayar — cukup pindai QR yang tampil"
    );
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

  // Cabang DOKU: QRIS dinamis per invoice (nominal tampil otomatis saat dipindai).
  if (input.gateway === "doku") {
    return createDokuPayment(userId, courseId, {
      voucherCode,
      discountAmount,
      promoSlug,
      expected,
    });
  }

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

/**
 * Batalkan antrean pembayaran milik sendiri (hard delete — tanpa sampah DB).
 * Syarat: milik sendiri + masih `menunggu` (boleh kapan saja: sebelum maupun
 * sesudah bukti dikirim; pengembalian dana mengikuti kebijakan refund).
 * Efek: baris payment dihapus; anggota patungan dikembalikan ke `unpaid`;
 * file bukti ikut dihapus (metadata + byte) bila tidak dipakai antrean lain.
 * Jejak audit `payment.cancel` tetap disimpan.
 */
export const cancelPayment = async (userId: number, paymentId: number) => {
  // Storage key dikumpulkan dalam transaksi, byte dihapus setelah commit (best-effort).
  let staleKeys: string[] = [];
  const result = await db.transaction(async (tx) => {
    const locked = await tx.select().from(payments).where(eq(payments.id, paymentId)).for("update").limit(1);
    const p = locked[0];
    if (!p || p.userId !== userId) {
      throw new PaymentError(404, "PAYMENT_NOT_FOUND", "Pembayaran tidak ditemukan");
    }
    if (p.status !== "menunggu") {
      throw new PaymentError(
        409,
        "PAYMENT_LOCKED",
        "Pembayaran ini sudah diproses admin dan tidak bisa dibatalkan. Hubungi admin bila perlu pengembalian dana."
      );
    }
    // Iuran patungan: kembalikan anggota ke belum bayar + lepas tautan pembayaran.
    if (p.patunganGroupId !== null) {
      const gRows = await tx
        .select({ status: patunganGroups.status })
        .from(patunganGroups)
        .where(eq(patunganGroups.id, p.patunganGroupId))
        .limit(1);
      if (!gRows[0] || gRows[0].status !== "pending") {
        throw new PaymentError(409, "GROUP_NOT_PENDING", "Grup patungan ini sudah selesai/dibatalkan");
      }
      await tx
        .update(patunganGroupMembers)
        .set({ paymentStatus: "unpaid", paymentId: null, paidAt: null })
        .where(and(eq(patunganGroupMembers.groupId, p.patunganGroupId), eq(patunganGroupMembers.userId, userId)));
    }
    const proofFileId = p.proofFileId;
    await tx.delete(payments).where(eq(payments.id, paymentId));
    // Hapus file bukti (metadata + varian) bila tidak dipakai antrean lain.
    if (proofFileId !== null) {
      const refs = await tx
        .select({ id: payments.id })
        .from(payments)
        .where(eq(payments.proofFileId, proofFileId))
        .limit(1);
      const fRows = await tx.select().from(files).where(eq(files.id, proofFileId)).limit(1);
      const f = fRows[0];
      if (!refs[0] && f && f.kind === "payment_proof" && f.ownerUserId === userId) {
        const variants = await tx
          .select({ storageKey: fileVariants.storageKey })
          .from(fileVariants)
          .where(eq(fileVariants.fileId, proofFileId));
        await tx.delete(fileVariants).where(eq(fileVariants.fileId, proofFileId));
        await tx.delete(files).where(eq(files.id, proofFileId));
        staleKeys = [f.storageKey, ...variants.map((v) => v.storageKey)];
        await tx.insert(auditLogs).values({
          actorUserId: userId,
          action: "upload.delete",
          targetType: "file",
          targetIdInt: proofFileId,
          metadata: { fileId: proofFileId, kind: f.kind, via: "payment.cancel" },
        });
      }
    }
    await tx.insert(auditLogs).values({
      actorUserId: userId,
      action: "payment.cancel",
      targetType: "payment",
      targetIdInt: paymentId,
      metadata: { paymentId, courseId: p.courseId, invoice: p.invoice, patunganGroupId: p.patunganGroupId },
    });
    return { id: paymentId, courseId: p.courseId };
  });
  for (const key of staleKeys) {
    try {
      const dir = getUploadsDir();
      const fullPath = path.resolve(dir, key);
      if (fullPath.startsWith(dir + path.sep)) await fs.unlink(fullPath);
    } catch {
      // Byte hilang — metadata sudah terhapus, abaikan.
    }
  }
  return { ...result, cancelled: true as const };
};

/** Status pembayaran terakhir peserta untuk satu kursus (polling). */
export const myPaymentForCourse = async (userId: number, courseId: number) => {
  // Proyeksi eksplisit tanpa dokuQrString (TEXT besar, diambil via GET /payments/:id/qr)
  // dan tanpa dokuReferenceId internal — hemat IO pada polling 5 detik.
  const rows = await db
    .select({
      id: payments.id,
      userId: payments.userId,
      courseId: payments.courseId,
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
      gateway: payments.gateway,
      dokuExpiresAt: payments.dokuExpiresAt,
      verifiedBy: payments.verifiedBy,
      verifiedAt: payments.verifiedAt,
      studentSeenAt: payments.studentSeenAt,
      createdAt: payments.createdAt,
    })
    .from(payments)
    .where(and(eq(payments.userId, userId), eq(payments.courseId, courseId)))
    .orderBy(desc(payments.id))
    .limit(1);
  return rows[0] ?? null;
};

/** Daftar pembayaran milik sendiri (untuk bell/notifikasi peserta). */
export const listMyPayments = async (
  userId: number,
  filter: { status?: "menunggu" | "diverifikasi" | "ditolak"; unseenOnly?: boolean; limit?: number; page?: number }
) => {
  const limit = Math.min(Math.max(filter.limit ?? 20, 1), 100);
  const page = Math.max(filter.page ?? 1, 1);
  const conditions = [eq(payments.userId, userId)];
  if (filter.status !== undefined) conditions.push(eq(payments.status, filter.status));
  if (filter.unseenOnly) {
    // Hanya keputusan yang belum dibaca (bukan antrean menunggu).
    conditions.push(inArray(payments.status, ["diverifikasi", "ditolak"]));
    conditions.push(isNull(payments.studentSeenAt));
  }
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
        gateway: payments.gateway,
        dokuExpiresAt: payments.dokuExpiresAt,
        status: payments.status,
        rejectReason: payments.rejectReason,
        verifiedAt: payments.verifiedAt,
        studentSeenAt: payments.studentSeenAt,
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

/**
 * Tandai keputusan pembayaran milik sendiri sudah dibaca peserta.
 * Hanya baris yang sudah diputuskan (bukan menunggu) dan belum dibaca;
 * opsional dibatasi satu kursus (saat membuka halaman pembayarannya).
 */
export const markMyPaymentsSeen = async (
  userId: number,
  courseId?: number
): Promise<{ seen: number }> => {
  const conditions = [
    eq(payments.userId, userId),
    inArray(payments.status, ["diverifikasi", "ditolak"]),
    isNull(payments.studentSeenAt),
  ];
  if (courseId !== undefined) conditions.push(eq(payments.courseId, courseId));
  const [res] = (await db
    .update(payments)
    .set({ studentSeenAt: new Date() })
    .where(and(...conditions))) as unknown as Array<{ affectedRows?: number }>;
  const affected = Number(res?.affectedRows ?? 0);
  return { seen: Number.isInteger(affected) && affected > 0 ? affected : 0 };
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
  // Antrean admin: seluruh antrean (manual lawas + DOKU). Tanpa gate bukti
  // agar iuran patungan (tanpa bukti) tetap bisa diproses — perilaku sama
  // seperti sebelum DOKU. Baris DOKU diproses otomatis via webhook; tombol
  // verifikasi manual disembunyikan untuk baris DOKU di UI.
  const conditions: Array<ReturnType<typeof eq>> = [];
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
        gateway: payments.gateway,
        dokuReferenceId: payments.dokuReferenceId,
        dokuExpiresAt: payments.dokuExpiresAt,
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

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

interface DokuPricing {
  voucherCode: string | null;
  discountAmount: number;
  promoSlug: string | null;
  expected: number;
}

/**
 * Buat/refresh antrean QRIS dinamis DOKU.
 * - Idempoten per antrean menunggu (sama seperti manual).
 * - Antrean manual yang masih terbuka memblokir (batalkan dulu, 409).
 * - QR hilang/kedaluwarsa → generate ulang via DOKU.
 * - Gagal hubungi DOKU → 503 jujur (tanpa QR palsu); antrean tetap
 *   menunggu dan bisa di-refresh setelah DOKU pulih.
 */
const createDokuPayment = async (
  userId: number,
  courseId: number,
  pricing: DokuPricing
) => {
  const cfg = loadDokuConfig();
  if (!isDokuConfigured(cfg)) {
    throw new PaymentError(
      503,
      "DOKU_NOT_CONFIGURED",
      "Pembayaran DOKU belum dikonfigurasi — hubungi admin"
    );
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
  if (open[0] && open[0].gateway !== "doku") {
    throw new PaymentError(
      409,
      "DOKU_QUEUE_CONFLICT",
      "Masih ada antrean manual untuk kursus ini — batalkan dulu sebelum memakai QRIS dinamis"
    );
  }
  const requestQr = async (invoice: string, paymentId: number) => {
    let order;
    try {
      order = await createDokuQrisOrder(
        { invoice, amount: pricing.expected, expiredMinutes: cfg.qrisExpiredMin },
        cfg
      );
    } catch (e) {
      throw asPaymentError(e);
    }
    await db
      .update(payments)
      .set({
        dokuReferenceId: order.referenceId,
        dokuQrString: order.qrString,
        dokuExpiresAt: order.expiresAt,
        voucherCode: pricing.voucherCode,
        discountAmount: pricing.discountAmount,
        promoSlug: pricing.promoSlug,
        amountExpected: pricing.expected,
      })
      .where(eq(payments.id, paymentId));
    return order;
  };

  if (open[0]) {
    const p = open[0];
    const valid =
      p.dokuQrString !== null &&
      p.dokuExpiresAt !== null &&
      new Date(p.dokuExpiresAt).getTime() > Date.now() + 60_000;
    if (!valid) {
      await requestQr(p.invoice, p.id);
      await db.insert(auditLogs).values({
        actorUserId: userId,
        action: "payment.doku.refresh",
        targetType: "payment",
        targetIdInt: p.id,
        metadata: { paymentId: p.id, courseId, invoice: p.invoice },
      });
    }
    const refreshed = await db.select().from(payments).where(eq(payments.id, p.id)).limit(1);
    return { ...refreshed[0]!, reused: true as const };
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const invoice = buildInvoice(courseId);
    try {
      const [h] = await db.insert(payments).values({
        userId,
        courseId,
        invoice,
        method: "qris",
        gateway: "doku",
        amountExpected: pricing.expected,
        voucherCode: pricing.voucherCode,
        discountAmount: pricing.discountAmount,
        promoSlug: pricing.promoSlug,
        status: "menunggu",
      });
      const id = Number((h as unknown as { insertId: number }).insertId);
      await requestQr(invoice, id);
      await db.insert(auditLogs).values({
        actorUserId: userId,
        action: "payment.create",
        targetType: "payment",
        targetIdInt: id,
        metadata: { paymentId: id, courseId, invoice, gateway: "doku", voucherCode: pricing.voucherCode, promoSlug: pricing.promoSlug },
      });
      const rows = await db.select().from(payments).where(eq(payments.id, id)).limit(1);
      return { ...rows[0]!, reused: false as const };
    } catch (e) {
      if (e instanceof PaymentError) throw e;
      if (e !== null && typeof e === "object" && "code" in e && e.code === "ER_DUP_ENTRY" && attempt < 4) {
        continue;
      }
      throw e;
    }
  }
  throw new PaymentError(503, "RETRY_EXHAUSTED", "Coba lagi dalam beberapa saat");
};

/** Konsumsi voucher diskon atomik (dipakai grant manual + webhook DOKU). */
const consumeDiscountVoucher = async (
  tx: DbTx,
  p: typeof payments.$inferSelect
) => {
  if (p.voucherCode === null) return;
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
};

interface GrantSuccessOpts {
  amountPaid: number;
  /** null = sistem/webhook (bukan admin manusia). */
  actorUserId: number | null;
  via: string;
  auditAction: string;
}

/** Grant sukses individu: voucher + enrollment + status + audit. */
const grantIndividualSuccess = async (
  tx: DbTx,
  p: typeof payments.$inferSelect,
  opts: GrantSuccessOpts
) => {
  await consumeDiscountVoucher(tx, p);
  await tx
    .insert(enrollments)
    .values({ userId: p.userId, courseId: p.courseId, source: opts.via, status: "active" })
    .onDuplicateKeyUpdate({ set: { source: opts.via, status: "active" } });
  await tx
    .update(payments)
    .set({ status: "diverifikasi", amountPaid: opts.amountPaid, verifiedBy: opts.actorUserId, verifiedAt: new Date() })
    .where(eq(payments.id, p.id));
  // Snapshot hak instruktur (persen saat verifikasi; tanpa instruktur = dilewati).
  await recordRevenueSnapshot(tx, p.id, p.courseId, opts.amountPaid);
  await tx.insert(auditLogs).values({
    actorUserId: opts.actorUserId,
    action: opts.auditAction,
    targetType: "payment",
    targetIdInt: p.id,
    metadata: {
      paymentId: p.id,
      amountPaid: opts.amountPaid,
      amountExpected: p.amountExpected,
      voucherCode: p.voucherCode,
      discountAmount: p.discountAmount,
      courseId: p.courseId,
      userId: p.userId,
      via: opts.via,
    },
  });
  return { id: p.id, status: "diverifikasi" as const, amountPaid: opts.amountPaid };
};

/** Grant sukses iuran patungan: anggota diverifikasi + complete grup bila lunas semua. */
const grantPatunganSuccess = async (
  tx: DbTx,
  p: typeof payments.$inferSelect,
  opts: GrantSuccessOpts
) => {
  if (p.patunganGroupId === null) {
    throw new PaymentError(500, "NOT_PATUNGAN", "Pembayaran ini bukan iuran patungan");
  }
  const gRows = await tx
    .select({ status: patunganGroups.status })
    .from(patunganGroups)
    .where(eq(patunganGroups.id, p.patunganGroupId))
    .limit(1);
  if (!gRows[0] || gRows[0].status !== "pending") {
    throw new PaymentError(409, "GROUP_NOT_PENDING", "Grup patungan ini sudah selesai/dibatalkan");
  }
  await tx
    .update(payments)
    .set({ status: "diverifikasi", amountPaid: opts.amountPaid, verifiedBy: opts.actorUserId, verifiedAt: new Date() })
    .where(eq(payments.id, p.id));
  // Snapshot hak instruktur per iuran patungan (persen saat verifikasi).
  await recordRevenueSnapshot(tx, p.id, p.courseId, opts.amountPaid);
  await setMemberPaymentState(tx, p.patunganGroupId, p.userId, { paymentStatus: "diverifikasi", paymentId: p.id });
  const groupCompleted = await tryCompleteGroup(tx, opts.actorUserId, p.patunganGroupId);
  await tx.insert(auditLogs).values({
    actorUserId: opts.actorUserId,
    action: opts.auditAction,
    targetType: "payment",
    targetIdInt: p.id,
    metadata: {
      paymentId: p.id,
      amountPaid: opts.amountPaid,
      amountExpected: p.amountExpected,
      courseId: p.courseId,
      userId: p.userId,
      patunganGroupId: p.patunganGroupId,
      groupCompleted,
      via: opts.via,
    },
  });
  return { id: p.id, status: "diverifikasi" as const, amountPaid: opts.amountPaid, groupCompleted };
};

/**
 * Terapkan notifikasi DOKU (dipanggil webhook setelah signature lolos).
 * Idempoten: baris yang sudah diputus dikembalikan apa adanya (dedupe retry).
 */
export const applyDokuNotification = async (input: {
  referenceId: string;
  outcome: "success" | "failed" | "expired";
  amountPaid?: number;
  rawStatus?: string;
}) => {
  return db.transaction(async (tx) => {
    const locked = await tx
      .select()
      .from(payments)
      .where(eq(payments.dokuReferenceId, input.referenceId))
      .for("update")
      .limit(1);
    let p = locked[0];
    if (!p) {
      // Fallback: referensi = invoice internal (varian payload DOKU).
      const byInvoice = await tx
        .select()
        .from(payments)
        .where(and(eq(payments.invoice, input.referenceId), eq(payments.gateway, "doku")))
        .for("update")
        .limit(1);
      p = byInvoice[0];
    }
    if (!p) {
      throw new PaymentError(404, "DOKU_REFERENCE_UNKNOWN", "Referensi pembayaran DOKU tidak dikenal");
    }
    if (p.status !== "menunggu") {
      return { id: p.id, status: p.status, deduped: true as const };
    }
    if (input.outcome === "success") {
      const amountPaid = input.amountPaid ?? p.amountExpected;
      if (!isAmountSufficient(amountPaid, computeExpectedTotal(p.amountExpected, 0))) {
        throw new PaymentError(400, "AMOUNT_INSUFFICIENT", `Nominal DOKU kurang: diterima ${amountPaid}, tagihan ${p.amountExpected}`);
      }
      const via = "payment:doku";
      if (p.patunganGroupId !== null) {
        const r = await grantPatunganSuccess(tx, p, { amountPaid, actorUserId: null, via, auditAction: "payment.doku.notify" });
        return { ...r, deduped: false as const };
      }
      const r = await grantIndividualSuccess(tx, p, { amountPaid, actorUserId: null, via, auditAction: "payment.doku.notify" });
      return { ...r, deduped: false as const };
    }
    const reason = input.outcome === "expired" ? "QRIS DOKU kedaluwarsa — buat antrean baru" : `Pembayaran DOKU gagal (${input.rawStatus ?? "unknown"})`;
    await tx
      .update(payments)
      .set({ status: "ditolak", rejectReason: reason, verifiedBy: null, verifiedAt: new Date() })
      .where(eq(payments.id, p.id));
    if (p.patunganGroupId !== null) {
      await setMemberPaymentState(tx, p.patunganGroupId, p.userId, { paymentStatus: "ditolak", paymentId: p.id });
    }
    await tx.insert(auditLogs).values({
      actorUserId: null,
      action: "payment.doku.notify",
      targetType: "payment",
      targetIdInt: p.id,
      metadata: { paymentId: p.id, outcome: input.outcome, rawStatus: input.rawStatus ?? null },
    });
    return { id: p.id, status: "ditolak" as const, deduped: false as const };
  });
};

/** Generate ulang QR DOKU yang hilang/kedaluwarsa (pemilik, masih menunggu). */
export const refreshDokuQr = async (userId: number, paymentId: number) => {
  const cfg = loadDokuConfig();
  if (!isDokuConfigured(cfg)) {
    throw new PaymentError(503, "DOKU_NOT_CONFIGURED", "Pembayaran DOKU belum dikonfigurasi");
  }
  const rows = await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
  const p = rows[0];
  if (!p || p.userId !== userId) {
    throw new PaymentError(404, "PAYMENT_NOT_FOUND", "Pembayaran tidak ditemukan");
  }
  if (p.status !== "menunggu" || p.gateway !== "doku") {
    throw new PaymentError(409, "PAYMENT_LOCKED", "Hanya antrean DOKU yang masih menunggu yang bisa direfresh");
  }
  const valid =
    p.dokuQrString !== null &&
    p.dokuExpiresAt !== null &&
    new Date(p.dokuExpiresAt).getTime() > Date.now() + 60_000;
  if (valid) return p;
  let order;
  try {
    order = await createDokuQrisOrder(
      { invoice: p.invoice, amount: p.amountExpected, expiredMinutes: cfg.qrisExpiredMin },
      cfg
    );
  } catch (e) {
    throw asPaymentError(e);
  }
  await db
    .update(payments)
    .set({ dokuReferenceId: order.referenceId, dokuQrString: order.qrString, dokuExpiresAt: order.expiresAt })
    .where(eq(payments.id, paymentId));
  await db.insert(auditLogs).values({
    actorUserId: userId,
    action: "payment.doku.refresh",
    targetType: "payment",
    targetIdInt: paymentId,
    metadata: { paymentId, invoice: p.invoice },
  });
  const updated = await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
  return updated[0]!;
};

/** Ambil PNG QR DOKU (pemilik / admin). 404 bila QR belum tersedia. */
export const paymentQrFor = async (
  userId: number,
  role: string,
  paymentId: number
): Promise<Buffer> => {
  const rows = await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
  const p = rows[0];
  if (!p || (p.userId !== userId && role !== "admin")) {
    throw new PaymentError(404, "PAYMENT_NOT_FOUND", "Pembayaran tidak ditemukan");
  }
  if (!p.dokuQrString) {
    throw new PaymentError(404, "DOKU_QR_MISSING", "QR DOKU belum tersedia untuk pembayaran ini");
  }
  return renderQrPng(p.dokuQrString);
};

/**
 * Verifikasi admin: terima (nominal >= tagihan → grant akses + hanguskan
 * voucher bila ada) atau tolak (wajib alasan). Transaksional + anti-race.
 * Khusus antrean MANUAL lawas — baris DOKU diproses otomatis via webhook.
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
    // Baris DOKU diproses otomatis via webhook — verifikasi manual
    // hanya untuk antrean manual lawas.
    if (p.gateway === "doku") {
      throw new PaymentError(
        409,
        "DOKU_MANAGED",
        "Pembayaran DOKU diproses otomatis — verifikasi manual hanya untuk antrean manual"
      );
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
      return grantPatunganSuccess(tx, p, {
        amountPaid,
        actorUserId: adminId,
        via: "payment:manual",
        auditAction: "payment.verify",
      });
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

    return grantIndividualSuccess(tx, p, {
      amountPaid,
      actorUserId: adminId,
      via: "payment:manual",
      auditAction: "payment.verify",
    });
  });
};
