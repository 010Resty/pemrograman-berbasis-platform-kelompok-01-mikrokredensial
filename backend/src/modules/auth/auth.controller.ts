import { AuthenticatedRequest } from "../../middlewares/auth.middleware";
import { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { users } from "../../db/schema";
import {
  loginUser,
  registerUser,
  requestPasswordReset,
  resendVerification,
  resetPassword,
  verifyEmail,
} from "./auth.service";

export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await registerUser(req.body);

    res.status(201).json({
      status: "success",
      message: "Kode verifikasi telah dikirim",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const verifyEmailHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await verifyEmail(req.body);

    res.status(200).json({
      status: "success",
      message: "Email terverifikasi",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const resendVerificationHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await resendVerification(req.body);

    res.status(200).json({
      status: "success",
      message: "Kode verifikasi baru telah dikirim",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const forgotPasswordHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await requestPasswordReset(req.body);

    res.status(200).json({
      status: "success",
      message: "Permintaan reset password diproses",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const resetPasswordHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await resetPassword(req.body);

    res.status(200).json({
      status: "success",
      message: "Password berhasil diganti",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await loginUser(req.body);

    res.status(200).json({
      status: "success",
      message: "Login berhasil",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const me = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // Respons autentikasi tidak boleh di-cache (hindari 304 basi / data sesi basi).
    res.set("Cache-Control", "no-store");
    if (!req.user?.id) {
      res.status(401).json({
        status: "error",
        message: "Token autentikasi diperlukan",
        data: null,
      });
      return;
    }

    const rows = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
      })
      .from(users)
      .where(eq(users.id, Number(req.user.id)))
      .limit(1);

    const user = rows[0];

    if (!user) {
      res.status(401).json({
        status: "error",
        message: "Token kedaluwarsa atau tidak valid",
        data: null,
      });
      return;
    }

    res.status(200).json({
      status: "success",
      message: "Data user berhasil diambil",
      data: {
        user,
      },
    });
  } catch (error) {
    next(error);
  }
};
