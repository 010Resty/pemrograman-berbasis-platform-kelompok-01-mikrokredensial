import { Request, Response, NextFunction } from "express";

/**
 * Rate limiter in-memory per IP (tanpa dependensi tambahan).
 * Cukup untuk instance tunggal/dev; produksi multi-instance
 * wajib diganti store terpusat (mis. Redis).
 *
 * Dipakai endpoint publik rawan spam (mis. pengajuan instruktur)
 * yang belum memakai captcha.
 */

export interface RateLimitOptions {
  windowMs: number;
  max: number; 
  message?: string;
}

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

const now = (): number => Date.now();

const sweepExpired = (): void => {
  if (buckets.size < 5000) return;
  const t = now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= t) buckets.delete(key);
  }
};

export const rateLimit = (options: RateLimitOptions) => {
  const { windowMs, max } = options;
  const message =
    options.message ?? "Terlalu banyak permintaan. Coba lagi nanti.";

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = `${req.ip ?? "unknown"}:${req.path}`;
    const t = now();
    const current = buckets.get(key);

    if (!current || current.resetAt <= t) {
      buckets.set(key, { count: 1, resetAt: t + windowMs });
      sweepExpired();
      next();
      return;
    }

    current.count += 1;
    if (current.count > max) {
      const retryAfter = Math.max(1, Math.ceil((current.resetAt - t) / 1000));
      res.set("Retry-After", String(retryAfter));
      res.status(429).json({
        status: "error",
        message,
        errors: null,
        data: null,
      });
      return;
    }
    next();
  };
};

const intEnv = (name: string, fallback: number): number => {
  const raw = Number.parseInt(process.env[name] || "", 10);
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
};

/** Batas pengajuan publik: default 10x per 15 menit per IP. */
export const publicSubmitLimiter = () =>
  rateLimit({
    windowMs: intEnv("SUBMIT_RATE_LIMIT_WINDOW_MS", 15 * 60 * 1000),
    max: intEnv("SUBMIT_RATE_LIMIT_MAX", 10),
    message:
      "Terlalu banyak pengajuan dari jaringan ini. Coba lagi beberapa menit.",
  });

/** Reset state (dipakai test saja). */
export const resetRateLimitForTest = (): void => {
  buckets.clear();
};
