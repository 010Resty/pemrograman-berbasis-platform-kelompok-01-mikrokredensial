/**
 * Aturan murni pembayaran QRIS manual (tanpa DB) — dapat diuji tanpa database.
 * Aturan nominal [Keputusan pengguna]: bayar >= tagihan lolos; kurang ditolak.
 */

/** Status antrean pembayaran. */
export const PAYMENT_STATUSES = ["menunggu", "diverifikasi", "ditolak"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/** Invoice unik: INV-YYYYMMDD-<courseId>-<6 acak>. */
export function buildInvoice(courseId: number, at: Date = new Date()): string {
  const stamp = `${at.getFullYear()}${String(at.getMonth() + 1).padStart(2, "0")}${String(at.getDate()).padStart(2, "0")}`;
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase().padEnd(6, "0");
  return `INV-${stamp}-${courseId}-${rand}`;
}

/** Total tagihan = harga resmi − diskon (tidak pernah negatif). */
export function computeExpectedTotal(priceNominal: number, discountAmount: number): number {
  return Math.max(0, Math.floor(priceNominal) - Math.max(0, Math.floor(discountAmount)));
}

/** Lolos verifikasi bila nominal diterima >= tagihan (lebih boleh, kurang tolak). */
export function isAmountSufficient(amountPaid: number, expectedTotal: number): boolean {
  if (!Number.isFinite(amountPaid) || !Number.isFinite(expectedTotal)) return false;
  if (expectedTotal <= 0) return amountPaid >= 0;
  return amountPaid >= expectedTotal;
}
