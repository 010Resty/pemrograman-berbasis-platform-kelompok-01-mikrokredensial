import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware";
import {
  RevenueError,
  getEarnings,
  getSettings,
  listMyPayouts,
  listPayoutsAdmin,
  payoutProcessSchema,
  payoutRequestSchema,
  processPayout,
  requestPayout,
  settingsSchema,
  updateSettings,
  type PayoutStatus,
} from "./revenue.service";

const toFieldErrors = (issues: Array<{ path: Array<string | number>; message: string }>) =>
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

const revenueError = (res: Response, e: unknown): boolean => {
  if (e instanceof RevenueError) {
    res.status(e.http).json({ status: "error", message: e.message, code: e.code, data: null });
    return true;
  }
  return false;
};

// GET /api/v1/admin/revenue-settings — baca persen global + minimal (admin).
export const getSettingsHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    res.status(200).json({ status: "success", message: "Pengaturan bagi hasil", data: await getSettings() });
  } catch (e) {
    next(e);
  }
};

// PUT /api/v1/admin/revenue-settings — ubah persen global + minimal (admin + audit).
export const updateSettingsHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const adminId = needAuth(req, res);
    if (adminId === null) return;
    const parsed = settingsSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({
        status: "error",
        message: "Pengaturan tidak valid",
        errors: toFieldErrors(parsed.error.issues),
        data: null,
      });
      return;
    }
    try {
      const data = await updateSettings(adminId, parsed.data);
      res.status(200).json({ status: "success", message: "Pengaturan bagi hasil tersimpan.", data });
    } catch (e) {
      if (!revenueError(res, e)) throw e;
    }
  } catch (e) {
    next(e);
  }
};

// GET /api/v1/admin/payouts — antrean penarikan (admin).
export const listPayoutsHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const q = req.query;
    const status =
      q.status === "diajukan" || q.status === "diproses" || q.status === "berhasil" || q.status === "ditolak"
        ? (q.status as PayoutStatus)
        : undefined;
    const limit = typeof q.limit === "string" && /^\d+$/.test(q.limit) ? Number(q.limit) : undefined;
    const page = typeof q.page === "string" && /^\d+$/.test(q.page) ? Number(q.page) : undefined;
    const data = await listPayoutsAdmin({ status, limit, page });
    res.status(200).json({ status: "success", message: "Antrean penarikan", data });
  } catch (e) {
    next(e);
  }
};

// POST /api/v1/admin/payouts/:id/process — setujui/tolak/tandai-ditransfer (admin + audit).
export const processPayoutHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const adminId = needAuth(req, res);
    if (adminId === null) return;
    const payoutId = Number(req.params.id);
    if (!Number.isInteger(payoutId) || payoutId <= 0) {
      res.status(404).json({ status: "error", message: "Pengajuan penarikan tidak ditemukan", data: null });
      return;
    }
    const parsed = payoutProcessSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({
        status: "error",
        message: "Aksi tidak valid",
        errors: toFieldErrors(parsed.error.issues),
        data: null,
      });
      return;
    }
    try {
      const data = await processPayout(adminId, payoutId, parsed.data);
      res.status(200).json({ status: "success", message: "Penarikan diproses.", data });
    } catch (e) {
      if (!revenueError(res, e)) throw e;
    }
  } catch (e) {
    next(e);
  }
};

// GET /api/v1/me/earnings — ringkasan pendapatan milik instruktur.
export const earningsHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = needAuth(req, res);
    if (userId === null) return;
    res.status(200).json({
      status: "success",
      message: "Ringkasan pendapatan",
      data: await getEarnings(userId),
    });
  } catch (e) {
    next(e);
  }
};

// GET /api/v1/me/payouts — riwayat penarikan milik instruktur.
export const myPayoutsHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = needAuth(req, res);
    if (userId === null) return;
    const q = req.query;
    const status =
      q.status === "diajukan" || q.status === "diproses" || q.status === "berhasil" || q.status === "ditolak"
        ? (q.status as PayoutStatus)
        : undefined;
    const limit = typeof q.limit === "string" && /^\d+$/.test(q.limit) ? Number(q.limit) : undefined;
    const page = typeof q.page === "string" && /^\d+$/.test(q.page) ? Number(q.page) : undefined;
    res.status(200).json({
      status: "success",
      message: "Riwayat penarikan",
      data: await listMyPayouts(userId, { status, limit, page }),
    });
  } catch (e) {
    next(e);
  }
};

// POST /api/v1/me/payouts — ajukan penarikan (instruktur, + audit).
export const requestPayoutHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = needAuth(req, res);
    if (userId === null) return;
    const parsed = payoutRequestSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({
        status: "error",
        message: "Data penarikan tidak valid",
        errors: toFieldErrors(parsed.error.issues),
        data: null,
      });
      return;
    }
    try {
      const data = await requestPayout(userId, parsed.data);
      res.status(201).json({ status: "success", message: "Penarikan diajukan.", data });
    } catch (e) {
      if (!revenueError(res, e)) throw e;
    }
  } catch (e) {
    next(e);
  }
};
