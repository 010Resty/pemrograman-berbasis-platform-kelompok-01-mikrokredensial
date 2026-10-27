import { AuthenticatedRequest } from "../../middlewares/auth.middleware";
import { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { users } from "../../db/schema";
import { registerUser, loginUser } from "./auth.service";

export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await registerUser(req.body);

    res.status(201).json({
      status: "success",
      message: "Registrasi berhasil",
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