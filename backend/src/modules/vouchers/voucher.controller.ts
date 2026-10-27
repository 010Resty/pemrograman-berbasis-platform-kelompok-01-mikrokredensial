import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware";
import {
  VoucherError,
  createVoucher,
  createVoucherSchema,
  getVoucherDetail,
  listRedemptions,
  listVouchers,
  redeemSchema,
  redeemVoucher,
  setVoucherStatus,
} from "./voucher.service";

const uid = (req: AuthenticatedRequest): number | null => {
  const id = Number(req.user?.id);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const needAuth = (req: AuthenticatedRequest, res: Response): number | null => {
  const userId = uid(req);
  if (userId === null) {
    res.status(401).json({
      status: "error",
      message: "Token autentikasi diperlukan",
      data: null,
    });
    return null;
  }
  return userId;
};

const voucherError = (res: Response, e: unknown): boolean => {
  if (e instanceof VoucherError) {
    res.status(e.http).json({
      status: "error",
      message: e.message,
      code: e.code,
      data: null,
    });
    return true;
  }
  return false;
};

const toFieldErrors = (
  issues: Array<{ path: Array<string | number>; message: string }>
) =>
  issues.map((i) => ({
    field: i.path.length > 0 ? String(i.path[0]) : "body",
    message: i.message,
  }));

const num = (v: unknown): number | undefined => {
  if (typeof v !== "string" || v.trim() === "") return undefined;
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : undefined;
};

// POST /api/v1/admin/vouchers — buat voucher (admin).
export const createHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const actorId = needAuth(req, res);
    if (actorId === null) return;
    const parsed = createVoucherSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        status: "error",
        message: "Data voucher tidak valid",
        errors: toFieldErrors(parsed.error.issues),
        data: null,
      });
      return;
    }
    try {
      const result = await createVoucher(actorId, parsed.data);
      res.status(201).json({
        status: "success",
        message: "Voucher berhasil dibuat.",
        data: result,
      });
    } catch (e) {
      if (!voucherError(res, e)) throw e;
    }
  } catch (e) {
    next(e);
  }
};

// GET /api/v1/admin/vouchers — daftar (admin).
export const listHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = needAuth(req, res);
    if (userId === null) return;
    void userId;
    const q = req.query;
    const status =
      typeof q.status === "string" &&
      ["available", "assigned", "redeemed", "expired", "revoked"].includes(q.status)
        ? q.status
        : undefined;
    const kind = q.kind === "personal" || q.kind === "umum" ? q.kind : undefined;
    const { items, total } = await listVouchers({
      courseId: num(q.courseId),
      status,
      kind,
      q: typeof q.q === "string" && q.q.trim() !== "" ? q.q.trim().slice(0, 100) : undefined,
      limit: num(q.limit),
      page: num(q.page),
    });
    res.status(200).json({
      status: "success",
      message: "Daftar voucher",
      data: { items, total },
    });
  } catch (e) {
    next(e);
  }
};

// GET /api/v1/admin/vouchers/:code — detail (admin).
export const detailHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = needAuth(req, res);
    if (userId === null) return;
    void userId;
    try {
      res.status(200).json({
        status: "success",
        message: "Detail voucher",
        data: await getVoucherDetail(String(req.params.code ?? "")),
      });
    } catch (e) {
      if (!voucherError(res, e)) throw e;
    }
  } catch (e) {
    next(e);
  }
};

// GET /api/v1/admin/vouchers/:code/redemptions — riwayat tukar (admin).
export const redemptionsHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = needAuth(req, res);
    if (userId === null) return;
    void userId;
    try {
      const { items, total } = await listRedemptions(String(req.params.code ?? ""), {
        limit: num(req.query.limit),
        page: num(req.query.page),
      });
      res.status(200).json({
        status: "success",
        message: "Riwayat penukaran voucher",
        data: { items, total },
      });
    } catch (e) {
      if (!voucherError(res, e)) throw e;
    }
  } catch (e) {
    next(e);
  }
};

// POST /api/v1/admin/vouchers/:code/disable — nonaktifkan (admin).
export const disableHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const actorId = needAuth(req, res);
    if (actorId === null) return;
    const reason =
      req.body !== null && typeof req.body === "object" && typeof (req.body as Record<string, unknown>).reason === "string"
        ? String((req.body as Record<string, unknown>).reason).slice(0, 500)
        : undefined;
    try {
      res.status(200).json({
        status: "success",
        message: "Voucher dinonaktifkan.",
        data: await setVoucherStatus(actorId, String(req.params.code ?? ""), "revoked", reason),
      });
    } catch (e) {
      if (!voucherError(res, e)) throw e;
    }
  } catch (e) {
    next(e);
  }
};

// POST /api/v1/admin/vouchers/:code/enable — aktifkan kembali (admin).
export const enableHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const actorId = needAuth(req, res);
    if (actorId === null) return;
    try {
      res.status(200).json({
        status: "success",
        message: "Voucher diaktifkan kembali.",
        data: await setVoucherStatus(actorId, String(req.params.code ?? ""), "active"),
      });
    } catch (e) {
      if (!voucherError(res, e)) throw e;
    }
  } catch (e) {
    next(e);
  }
};

// POST /api/v1/vouchers/redeem — tukar kode (peserta).
export const redeemHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = needAuth(req, res);
    if (userId === null) return;
    const parsed = redeemSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        status: "error",
        message: "Data penukaran tidak valid",
        errors: toFieldErrors(parsed.error.issues),
        data: null,
      });
      return;
    }
    try {
      const result = await redeemVoucher(userId, parsed.data.code, parsed.data.courseId);
      res.status(201).json({
        status: "success",
        message: "Voucher berhasil ditukar. Akses kursus dibuka.",
        data: result,
      });
    } catch (e) {
      if (!voucherError(res, e)) throw e;
    }
  } catch (e) {
    next(e);
  }
};
