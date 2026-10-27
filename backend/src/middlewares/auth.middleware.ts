import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
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
      data: null,
    });
    return;
  }

  const token = authorization.slice(7).trim();

  if (!token) {
    res.status(401).json({
      status: "error",
      message: "Token autentikasi tidak valid",
      data: null,
    });
    return;
  }

  // Kegagalan konfigurasi secret adalah 500 (kesalahan server),
  // bukan 401 — jangan samarkan sebagai token tidak valid.
  let secret: string;
  try {
    secret = getJwtSecret();
  } catch {
    res.status(500).json({
      status: "error",
      message: "Konfigurasi autentikasi server tidak valid",
      data: null,
    });
    return;
  }

  try {
    const payload = jwt.verify(token, secret, {
      issuer: "aristoteles-backend",
      audience: "aristoteles-client",
    }) as JwtPayload;

    const id = payload.sub;

    // ID pengguna numerik (auto-increment, selaras id numerik frontend).
    if (
      typeof id !== "string" ||
      !/^[1-9]\d*$/.test(id) ||
      typeof payload.email !== "string" ||
      typeof payload.role !== "string"
    ) {
    res.status(401).json({
      status: "error",
      message: "Token autentikasi tidak valid",
      data: null,
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
      data: null,
    });
  }
};

/**
 * Otorisasi berbasis peran di server (Tahap 1).
 * Guard UI di frontend TIDAK cukup; endpoint sensitif wajib memakai ini.
 * Contoh: router.get("/admin/users", authenticate, requireRole("admin"), handler).
 */
export const requireRole = (...allowed: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        status: "error",
        message: "Token autentikasi diperlukan",
        data: null,
      });
      return;
    }

    if (!allowed.includes(req.user.role)) {
      res.status(403).json({
        status: "error",
        message: "Akses ditolak untuk peran ini",
        data: null,
      });
      return;
    }

    next();
  };
};

/**
 * Seperti authenticate, tetapi TIDAK menolak request tanpa token:
 * mengisi req.user bila token valid, lanjut apa adanya bila tidak.
 * Dipakai endpoint dengan aturan akses campuran (mis. serve berkas:
 * publik untuk aset kursus, terbatas untuk tugas).
 */
export const optionalAuthenticate = (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void => {
  const authorization = req.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    next();
    return;
  }

  const token = authorization.slice(7).trim();
  if (!token) {
    next();
    return;
  }

  try {
    const payload = jwt.verify(token, getJwtSecret(), {
      issuer: "aristoteles-backend",
      audience: "aristoteles-client",
    }) as JwtPayload;

    const id = payload.sub;
    if (
      typeof id !== "string" ||
      !/^[1-9]\d*$/.test(id) ||
      typeof payload.email !== "string" ||
      typeof payload.role !== "string"
    ) {
      next();
      return;
    }

    req.user = { id, email: payload.email, role: payload.role };
    next();
  } catch {
    next();
  }
};
