import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware";
import {
  PaymentError,
  attachPaymentProof,
  attachProofSchema,
  createPayment,
  createPaymentSchema,
  listMyPayments,
  listPaymentsAdmin,
  myPaymentForCourse,
  verifyPayment,
  verifyPaymentSchema,
} from "./payment.service";

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
    const limit = typeof q.limit === "string" && /^\d+$/.test(q.limit) ? Number(q.limit) : undefined;
    const page = typeof q.page === "string" && /^\d+$/.test(q.page) ? Number(q.page) : undefined;
    res.status(200).json({
      status: "success",
      message: "Daftar pembayaran saya",
      data: await listMyPayments(userId, { status, limit, page }),
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
    res.status(200).json({
      status: "success",
      message: "Antrean pembayaran",
      data: await listPaymentsAdmin({ status, courseId, limit, page }),
    });
  } catch (e) {
    next(e);
  }
};

// POST /api/v1/admin/payments/:id/verify — setujui/tolak (admin, + audit).
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
