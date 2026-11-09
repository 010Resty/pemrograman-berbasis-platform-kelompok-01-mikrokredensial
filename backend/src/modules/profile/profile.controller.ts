import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware";
import {
  ProfileError,
  getMyProfile,
  removeMyAvatar,
  updateMyProfile,
  updateProfileSchema,
} from "./profile.service";

const needAuth = (req: AuthenticatedRequest, res: Response): number | null => {
  const id = Number(req.user?.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(401).json({
      status: "error",
      message: "Token autentikasi diperlukan",
      data: null,
    });
    return null;
  }
  return id;
};

const profileError = (res: Response, e: unknown): boolean => {
  if (e instanceof ProfileError) {
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

// GET /api/v1/me/profile — profil milik sendiri.
export const myProfileHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = needAuth(req, res);
    if (userId === null) return;
    try {
      res.status(200).json({
        status: "success",
        message: "Profil saya",
        data: await getMyProfile(userId),
      });
    } catch (e) {
      if (!profileError(res, e)) throw e;
    }
  } catch (e) {
    next(e);
  }
};

// PATCH /api/v1/me/profile — ubah profil milik sendiri (parsial).
export const updateProfileHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = needAuth(req, res);
    if (userId === null) return;
    const parsed = updateProfileSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({
        status: "error",
        message: "Data profil tidak valid",
        errors: toFieldErrors(parsed.error.issues),
        data: null,
      });
      return;
    }
    try {
      res.status(200).json({
        status: "success",
        message: "Profil berhasil diperbarui.",
        data: await updateMyProfile(userId, parsed.data),
      });
    } catch (e) {
      if (!profileError(res, e)) throw e;
    }
  } catch (e) {
    next(e);
  }
};

// DELETE /api/v1/me/profile/avatar — lepas foto profil (kembali inisial).
export const removeAvatarHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = needAuth(req, res);
    if (userId === null) return;
    try {
      res.status(200).json({
        status: "success",
        message: "Foto profil dihapus.",
        data: await removeMyAvatar(userId),
      });
    } catch (e) {
      if (!profileError(res, e)) throw e;
    }
  } catch (e) {
    next(e);
  }
};
