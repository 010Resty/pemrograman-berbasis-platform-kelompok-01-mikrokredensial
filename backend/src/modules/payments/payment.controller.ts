import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware";
import {
  PaymentError,
  applyDokuNotification,
  attachPaymentProof,
  attachProofSchema,
  cancelPayment,
  createPayment,
  createPaymentSchema,
  listMyPayments,
  listPaymentsAdmin,
  markMyPaymentsSeen,
  myPaymentForCourse,
  paymentQrFor,
  refreshDokuQr,
  verifyPayment,
  verifyPaymentSchema,
} from "./payment.service";
import { isDokuConfigured, loadDokuConfig } from "../doku/doku.config";
import { verifyRsaSha256 } from "../doku/doku.signature";
import { mapDokuStatus } from "../doku/doku.status";

const toFieldErrors = (
  issues: Array<{ path: Array<string | number>; message: string }>
) =>
  issues.map((i) => ({
    field: i.path.length > 0 ? String(i.path[0]) : "body",
    message: i.message,
  }));

const needAuth = (req: AuthenticatedRequest, res: Response): number | null => {
  const id = Number(req.user?.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(401).json({ status: "error", message: "Token autentikasi diperlukan", data: null });
    return null;
  }
  return id;
};

const paymentError = (res: Response, e: unknown): boolean => {
  if (e instanceof PaymentError) {
    res.status(e.http).json({ status: "error", message: e.message, code: e.code, data: null });
    return true;
  }
  return false;
};

// POST /api/v1/courses/:id/payments — ajukan pembayaran QRIS (peserta).
export const createHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = needAuth(req, res);
    if (userId === null) return;
    const courseId = Number(req.params.id);
    if (!Number.isInteger(courseId) || courseId <= 0) {
      res.status(404).json({ status: "error", message: "Kursus tidak ditemukan", data: null });
      return;
    }
    const parsed = createPaymentSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({
        status: "error",
        message: "Data pembayaran tidak valid",
        errors: parsed.error.issues.map((i) => ({ field: i.path.length > 0 ? String(i.path[0]) : "body", message: i.message })),
        data: null,
      });
      return;
    }
    try {
      const result = await createPayment(userId, courseId, parsed.data);
      res.status(201).json({ status: "success", message: "Pengajuan pembayaran dibuat.", data: result });
    } catch (e) {
      if (!paymentError(res, e)) throw e;
    }
  } catch (e) {
    next(e);
  }
};

// PATCH /api/v1/payments/:id/proof — lampirkan/ganti bukti bayar (pemilik, status menunggu).
export const attachProofHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = needAuth(req, res);
    if (userId === null) return;
    const paymentId = Number(req.params.id);
    if (!Number.isInteger(paymentId) || paymentId <= 0) {
      res.status(404).json({ status: "error", message: "Pembayaran tidak ditemukan", data: null });
      return;
    }
    const parsed = attachProofSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ status: "error", message: "Data bukti tidak valid", errors: toFieldErrors(parsed.error.issues), data: null });
      return;
    }
    try {
      const result = await attachPaymentProof(userId, paymentId, parsed.data.proofFileId);
      res.status(200).json({ status: "success", message: "Bukti bayar tersimpan.", data: result });
    } catch (e) {
      if (!paymentError(res, e)) throw e;
    }
  } catch (e) {
    next(e);
  }
};

// DELETE /api/v1/payments/:id — batalkan antrean menunggu milik sendiri (hard delete).
export const cancelHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = needAuth(req, res);
    if (userId === null) return;
    const paymentId = Number(req.params.id);
    if (!Number.isInteger(paymentId) || paymentId <= 0) {
      res.status(404).json({ status: "error", message: "Pembayaran tidak ditemukan", data: null });
      return;
    }
    try {
      const result = await cancelPayment(userId, paymentId);
      res.status(200).json({ status: "success", message: "Pengajuan pembayaran dibatalkan.", data: result });
    } catch (e) {
      if (!paymentError(res, e)) throw e;
    }
  } catch (e) {
    next(e);
  }
};

// GET /api/v1/me/payments — daftar milik sendiri, atau satu kursus bila ?courseId=.
// Tanpa courseId: 200 {items,total,page,limit} (filter status/limit/page opsional,
// untuk bell peserta). Dengan courseId: 200 antrean terakhir kursus itu / null.
export const myPaymentHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = needAuth(req, res);
    if (userId === null) return;
    const q = req.query;
    if (q.courseId !== undefined) {
      const courseId = Number(q.courseId);
      if (!Number.isInteger(courseId) || courseId <= 0) {
        res.status(400).json({ status: "error", message: "courseId wajib diisi", data: null });
        return;
      }
      res.status(200).json({
        status: "success",
        message: "Status pembayaran",
        data: await myPaymentForCourse(userId, courseId),
      });
      return;
    }
    const status =
      q.status === "menunggu" || q.status === "diverifikasi" || q.status === "ditolak" ? q.status : undefined;
    const unseenOnly = q.unseen === "1";
    const limit = typeof q.limit === "string" && /^\d+$/.test(q.limit) ? Number(q.limit) : undefined;
    const page = typeof q.page === "string" && /^\d+$/.test(q.page) ? Number(q.page) : undefined;
    res.status(200).json({
      status: "success",
      message: "Daftar pembayaran saya",
      data: await listMyPayments(userId, { status, unseenOnly, limit, page }),
    });
  } catch (e) {
    next(e);
  }
};

// POST /api/v1/me/payments/seen — tandai keputusan pembayaran sudah dibaca.
// Body opsional { courseId }: batasi satu kursus (saat membuka halamannya).
export const markPaymentsSeenHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = needAuth(req, res);
    if (userId === null) return;
    const body = (req.body ?? {}) as { courseId?: unknown };
    let courseId: number | undefined;
    if (body.courseId !== undefined) {
      courseId = Number(body.courseId);
      if (!Number.isInteger(courseId) || (courseId as number) <= 0) {
        res.status(400).json({ status: "error", message: "courseId tidak valid", data: null });
        return;
      }
    }
    res.status(200).json({
      status: "success",
      message: "Keputusan pembayaran ditandai dibaca",
      data: await markMyPaymentsSeen(userId, courseId),
    });
  } catch (e) {
    next(e);
  }
};

// GET /api/v1/admin/payments — antrean verifikasi (admin).
export const listHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const q = req.query;
    const status =
      q.status === "menunggu" || q.status === "diverifikasi" || q.status === "ditolak" ? q.status : undefined;
    const courseId = typeof q.courseId === "string" && /^\d+$/.test(q.courseId) ? Number(q.courseId) : undefined;
    const limit = typeof q.limit === "string" && /^\d+$/.test(q.limit) ? Number(q.limit) : undefined;
    const page = typeof q.page === "string" && /^\d+$/.test(q.page) ? Number(q.page) : undefined;
    const data = await listPaymentsAdmin({ status, courseId, limit, page });
    res.status(200).json({
      status: "success",
      message: "Antrean pembayaran",
      data,
    });
  } catch (e) {
    next(e);
  }
};

// POST /api/v1/admin/payments/:id/verify — setujui/tolak (admin, + audit).
// Khusus antrean MANUAL lawas; baris DOKU ditolak 409 (otomatis via webhook).
export const verifyHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const adminId = needAuth(req, res);
    if (adminId === null) return;
    const paymentId = Number(req.params.id);
    if (!Number.isInteger(paymentId) || paymentId <= 0) {
      res.status(404).json({ status: "error", message: "Pembayaran tidak ditemukan", data: null });
      return;
    }
    const parsed = verifyPaymentSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({
        status: "error",
        message: "Data verifikasi tidak valid",
        errors: toFieldErrors(parsed.error.issues),
        data: null,
      });
      return;
    }
    try {
      const result = await verifyPayment(adminId, paymentId, parsed.data);
      res.status(200).json({ status: "success", message: "Verifikasi tersimpan.", data: result });
    } catch (e) {
      if (!paymentError(res, e)) throw e;
    }
  } catch (e) {
    next(e);
  }
};

// GET /api/v1/payments/:id/qr — PNG QRIS dinamis (pemilik/admin).
// Tanpa token yang benar = 401/404; tidak pernah membocorkan string QR.
export const qrHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = needAuth(req, res);
    if (userId === null) return;
    const paymentId = Number(req.params.id);
    if (!Number.isInteger(paymentId) || paymentId <= 0) {
      res.status(404).json({ status: "error", message: "Pembayaran tidak ditemukan", data: null });
      return;
    }
    try {
      const png = await paymentQrFor(userId, req.user?.role ?? "", paymentId);
      res.set("Content-Type", "image/png");
      res.set("Cache-Control", "private, no-store");
      res.status(200).send(png);
    } catch (e) {
      if (!paymentError(res, e)) throw e;
    }
  } catch (e) {
    next(e);
  }
};

// POST /api/v1/payments/:id/doku/refresh — generate ulang QR kedaluwarsa.
export const refreshHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = needAuth(req, res);
    if (userId === null) return;
    const paymentId = Number(req.params.id);
    if (!Number.isInteger(paymentId) || paymentId <= 0) {
      res.status(404).json({ status: "error", message: "Pembayaran tidak ditemukan", data: null });
      return;
    }
    try {
      const result = await refreshDokuQr(userId, paymentId);
      res.status(200).json({ status: "success", message: "QR DOKU diperbarui.", data: result });
    } catch (e) {
      if (!paymentError(res, e)) throw e;
    }
  } catch (e) {
    next(e);
  }
};

const firstString = (body: Record<string, unknown>, keys: string[]): string => {
  for (const k of keys) {
    const v = body[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
};

const firstNumber = (body: Record<string, unknown>, keys: string[]): number | undefined => {
  for (const k of keys) {
    const v = body[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
    if (typeof v === "object" && v !== null) {
      const inner = (v as Record<string, unknown>).value;
      if (typeof inner === "number" && Number.isFinite(inner)) return inner;
      if (typeof inner === "string" && inner.trim() !== "" && Number.isFinite(Number(inner))) return Number(inner);
    }
  }
  return undefined;
};

// POST /api/v1/payments/doku/notify — webhook publik DOKU.
// Keamanan: signature RSA (DOKU_PUBLIC_KEY) atas RAW body; gagal = 401.
// Bentuk field persis DOKU dikunci di Fase 1b — ekstraksi toleran
// beberapa varian kunci + status tak dikenal = 400 agar DOKU retry.
export const notifyHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const cfg = loadDokuConfig();
    if (!isDokuConfigured(cfg) || !cfg.publicKeyPem) {
      res.status(503).json({ status: "error", message: "Webhook DOKU belum dikonfigurasi", code: "DOKU_NOT_CONFIGURED", data: null });
      return;
    }
    const sig =
      req.header("x-signature") ?? req.header("signature") ?? req.header("x-doku-signature") ?? "";
    const raw: Buffer =
      (req as unknown as { rawBody?: Buffer }).rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}), "utf8");
    if (!verifyRsaSha256({ publicKeyPem: cfg.publicKeyPem, data: raw, signatureB64: sig })) {
      res.status(401).json({ status: "error", message: "Signature webhook tidak valid", code: "SIGNATURE_INVALID", data: null });
      return;
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    const reference = firstString(body, [
      "referenceId",
      "partnerReferenceNo",
      "orderId",
      "merchantOrderNo",
      "invoiceNumber",
      "invoice",
    ]);
    const statusRaw = firstString(body, ["status", "transactionStatus", "paymentStatus", "transaction_status"]);
    const outcome = mapDokuStatus(statusRaw);
    if (!reference || outcome === "unknown") {
      res.status(400).json({ status: "error", message: "Format notifikasi DOKU tidak dikenal", code: "DOKU_NOTIFY_UNKNOWN", data: null });
      return;
    }
    try {
      const result = await applyDokuNotification({
        referenceId: reference,
        outcome,
        amountPaid: firstNumber(body, ["amount", "totalAmount", "paidAmount", "grossAmount"]),
        rawStatus: statusRaw || undefined,
      });
      res.status(200).json({ status: "success", message: "Notifikasi diproses.", data: result });
    } catch (e) {
      if (!paymentError(res, e)) throw e;
    }
  } catch (e) {
    next(e);
  }
};
