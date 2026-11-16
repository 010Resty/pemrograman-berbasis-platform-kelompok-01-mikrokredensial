import { createHmac, createVerify } from "node:crypto";

/**
 * Primitif kriptografi DOKU (tanpa tebakan skema).
 *
 * Skema header/payload persis DOKU (urutan field signature) dikunci di
 * Fase 1b dari API spec — fungsi di sini generik dan teruji:
 * - HMAC-SHA256/SHA512 untuk menandatangani request ke DOKU
 * - Verifikasi RSA-SHA256 signature webhook memakai DOKU_PUBLIC_KEY
 */

/** HMAC-SHA256 hex (untuk signature request). */
export const hmacSha256Hex = (secret: string, message: string): string =>
  createHmac("sha256", secret).update(message, "utf8").digest("hex");

/** HMAC-SHA512 base64 (varian skema lain — dipakai bila spec memintanya). */
export const hmacSha512Base64 = (secret: string, message: string): string =>
  createHmac("sha512", secret).update(message, "utf8").digest("base64");

export interface RsaVerifyInput {
  publicKeyPem: string;
  /** Byte/TEKS persis yang ditandatangani (untuk webhook: raw body). */
  data: string | Buffer;
  /** Signature dari DOKU (base64). */
  signatureB64: string;
}

/**
 * Verifikasi signature RSA-SHA256. False (bukan throw) bila format tak valid
 * — pemanggil mengubahnya menjadi 401 SIGNATURE_INVALID.
 */
export const verifyRsaSha256 = (input: RsaVerifyInput): boolean => {
  try {
    if (!input.publicKeyPem || !input.signatureB64) return false;
    const verifier = createVerify("RSA-SHA256");
    verifier.update(typeof input.data === "string" ? Buffer.from(input.data, "utf8") : input.data);
    return verifier.verify(input.publicKeyPem, input.signatureB64, "base64");
  } catch {
    return false;
  }
};
