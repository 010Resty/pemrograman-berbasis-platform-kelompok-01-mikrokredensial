import { createHash, randomInt, timingSafeEqual } from "node:crypto";

/**
 * Util OTP 6 digit untuk verifikasi email & reset password.
 * Murni fungsi tanpa database agar mudah diuji (node:test).
 *
 * - Kode disimpan sebagai hash SHA-256 (plaintext tidak pernah ke DB).
 * - Perbandingan memakai timingSafeEqual.
 * - Durasi default: kedaluwarsa 10 menit, cooldown kirim ulang 60 detik,
 *   maksimal 5x percobaan salah per kode.
 */

export const OTP_LENGTH = 6;
export const OTP_MAX_ATTEMPTS = 5;

export const getOtpExpiresMinutes = (): number => {
  const raw = Number.parseInt(process.env.OTP_EXPIRES_MIN || "10", 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 10;
};

export const getOtpCooldownSeconds = (): number => {
  const raw = Number.parseInt(process.env.OTP_RESEND_COOLDOWN_SEC || "60", 10);
  return Number.isFinite(raw) && raw >= 0 ? raw : 60;
};

export const getOtpMaxAttempts = (): number => {
  const raw = Number.parseInt(
    process.env.OTP_MAX_ATTEMPTS || String(OTP_MAX_ATTEMPTS),
    10
  );
  return Number.isFinite(raw) && raw > 0 ? raw : OTP_MAX_ATTEMPTS;
};

export const generateOtpCode = (): string =>
  String(randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, "0");

export const hashOtpCode = (code: string): string =>
  createHash("sha256").update(code).digest("hex");

export const verifyOtpCode = (code: string, codeHash: string): boolean => {
  const candidate = hashOtpCode(code.trim());
  const a = Buffer.from(candidate, "hex");
  const b = Buffer.from(codeHash, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
};

export const otpExpiresAt = (now = Date.now()): Date =>
  new Date(now + getOtpExpiresMinutes() * 60 * 1000);

export const isOtpExpired = (expiresAt: Date, now = Date.now()): boolean =>
  expiresAt.getTime() <= now;

/** Sisa detik cooldown kirim ulang; 0 bila boleh kirim sekarang. */
export const resendCooldownRemaining = (
  lastSentAt: Date,
  now = Date.now()
): number => {
  const elapsed = Math.floor((now - lastSentAt.getTime()) / 1000);
  return Math.max(0, getOtpCooldownSeconds() - elapsed);
};
