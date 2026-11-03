import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware";
import {
  ApplicationError,
  deleteApplication,
  getApplication,
  inviteApplication,
  listApplications,
  reviewApplication,
  submitApplication,
} from "./application.service";

const applicationError = (res: Response, e: unknown): boolean => {
  if (e instanceof ApplicationError) {
    res.status(e.http).json({
      status: "error",
      message: e.message,
      code: e.code,
      errors: e.fieldErrors,
      data: null,
    });
    return true;
  }
  return false;
};

const parseId = (raw: string): number | null => {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const uid = (req: AuthenticatedRequest): number | null => {
  const id = Number(req.user?.id);
  return Number.isInteger(id) && id > 0 ? id : null;
};

// POST /api/v1/instructor-applications — publik, tanpa login (K-01:
// pendaftar belum punya akun). Satu email satu pengajuan.
export const submitHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await submitApplication(req.body);
    res.status(201).json({
      status: "success",
      message: "Pengajuan diterima",
      data: result,
    });
  } catch (error) {
    if (applicationError(res, error)) return;
    next(error);
  }
};

// GET /api/v1/admin/instructor-applications — admin.
export const listHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await listApplications(req.query);
    res.status(200).json({
      status: "success",
      message: "Daftar pengajuan berhasil diambil",
      data: result,
    });
  } catch (error) {
    if (applicationError(res, error)) return;
    next(error);
  }
};

// GET /api/v1/admin/instructor-applications/:id — admin.
export const detailHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const id = parseId(req.params.id);
    if (id === null) {
      res.status(404).json({
        status: "error",
        message: "Pengajuan tidak ditemukan",
        data: null,
      });
      return;
    }
    const result = await getApplication(id);
    res.status(200).json({
      status: "success",
      message: "Detail pengajuan berhasil diambil",
      data: result,
    });
  } catch (error) {
    if (applicationError(res, error)) return;
    next(error);
  }
};

// PATCH /api/v1/admin/instructor-applications/:id — admin.
export const reviewHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const actorId = uid(req);
    const id = parseId(req.params.id);
    if (actorId === null || id === null) {
      res.status(404).json({
        status: "error",
        message: "Pengajuan tidak ditemukan",
        data: null,
      });
      return;
    }
    const result = await reviewApplication(id, req.body, actorId);
    res.status(200).json({
      status: "success",
      message: "Status pengajuan diperbarui",
      data: result,
    });
  } catch (error) {
    if (applicationError(res, error)) return;
    next(error);
  }
};

// DELETE /api/v1/admin/instructor-applications/:id — admin.
export const deleteHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const id = parseId(req.params.id);
    if (id === null) {
      res.status(404).json({
        status: "error",
        message: "Pengajuan tidak ditemukan",
        data: null,
      });
      return;
    }
    const result = await deleteApplication(id);
    res.status(200).json({
      status: "success",
      message: "Pengajuan dihapus",
      data: result,
    });
  } catch (error) {
    if (applicationError(res, error)) return;
    next(error);
  }
};

// POST /api/v1/admin/instructor-applications/:id/invite — admin.
// Setuju + terbitkan undangan resmi (token tampil sekali).
export const inviteHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const actorId = uid(req);
    const id = parseId(req.params.id);
    if (actorId === null || id === null) {
      res.status(404).json({
        status: "error",
        message: "Pengajuan tidak ditemukan",
        data: null,
      });
      return;
    }
    const result = await inviteApplication(id, actorId, req.body ?? {});
    res.status(201).json({
      status: "success",
      message: "Undangan diterbitkan. Salin token berikut — hanya tampil sekali.",
      data: result,
    });
  } catch (error) {
    if (applicationError(res, error)) return;
    next(error);
  }
};
