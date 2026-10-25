import { AuthenticatedRequest } from "../../middlewares/auth.middleware";
import { Request, Response, NextFunction } from "express";
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

export const me = (
  req: AuthenticatedRequest,
  res: Response
) => {
  res.status(200).json({
    status: "success",
    message: "Data user berhasil diambil",
    data: {
      user: req.user,
    },
  });
};