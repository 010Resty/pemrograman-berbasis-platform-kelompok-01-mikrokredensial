
import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    email: string;
    role: string;
  };
}

const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET belum dikonfigurasi dengan aman");
  }

  return secret;
};

export const authenticate = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const authorization = req.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    res.status(401).json({
      status: "error",
      message: "Token autentikasi diperlukan",
    });
    return;
  }

  const token = authorization.slice(7).trim();

  if (!token) {
    res.status(401).json({
      status: "error",
      message: "Token autentikasi tidak valid",
    });
    return;
  }

  try {
    const payload = jwt.verify(token, getJwtSecret(), {
      issuer: "aristoteles-backend",
      audience: "aristoteles-client",
    }) as JwtPayload;

    const id = Number(payload.sub);

    if (
      !Number.isSafeInteger(id) ||
      id <= 0 ||
      typeof payload.email !== "string" ||
      typeof payload.role !== "string"
    ) {
      res.status(401).json({
        status: "error",
        message: "Token autentikasi tidak valid",
      });
      return;
    }

    req.user = {
      id,
      email: payload.email,
      role: payload.role,
    };

    next();
  } catch {
    res.status(401).json({
      status: "error",
      message: "Token kedaluwarsa atau tidak valid",
    });
  }
};
