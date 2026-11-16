/**
 * Pemetaan status DOKU → status antrean ARISTOTELES.
 *
 * Bentuk notifikasi persis DOKU dikunci di Fase 1b dari API spec; daftar
 * nilai di bawah mencakup ejaan umum agar hanya perlu penyempurnaan kecil:
 * - sukses: SUCCESS / PAID / SETTLEMENT / COMPLETED
 * - gagal final: FAILED / FAIL / DENY / CANCELLED / CANCEL / VOID
 * - kedaluwarsa: EXPIRED
 * Selain itu → "unknown" (webhook ditolak 400 agar DOKU retry, bukan diam).
 */
export type DokuOutcome = "success" | "failed" | "expired" | "unknown";

const SUCCESS = new Set(["SUCCESS", "PAID", "SETTLEMENT", "SETTLED", "COMPLETED", "CAPTURED"]);
const FAILED = new Set(["FAILED", "FAIL", "DENY", "DENIED", "CANCELLED", "CANCEL", "VOID", "VOIDED", "REFUNDED"]);
const EXPIRED = new Set(["EXPIRED"]);

export const mapDokuStatus = (raw: unknown): DokuOutcome => {
  const s = String(raw ?? "").trim().toUpperCase();
  if (!s) return "unknown";
  if (SUCCESS.has(s)) return "success";
  if (EXPIRED.has(s)) return "expired";
  if (FAILED.has(s)) return "failed";
  return "unknown";
};
