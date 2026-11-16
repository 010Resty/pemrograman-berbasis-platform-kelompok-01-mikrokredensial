/**
 * Konfigurasi DOKU Direct API (QRIS dinamis).
 *
 * Kredensial HANYA dari environment (tidak pernah di-hardcode):
 * - DOKU_ENV: sandbox | production (default sandbox)
 * - DOKU_BASE_URL: wajib diisi saat DOKU diaktifkan
 *   (contoh sandbox — KONFIRMASI ke dashboard DOKU bila ragu)
 * - DOKU_CLIENT_ID, DOKU_SECRET_KEY: untuk menandatangani request
 * - DOKU_API_KEY: kunci dashboard (bila varian API membutuhkannya)
 * - DOKU_PUBLIC_KEY: kunci publik RSA DOKU (PEM, satu baris `\n`)
 *   untuk memverifikasi signature webhook
 * - DOKU_QRIS_PATH: path endpoint generate QR (tanpa base URL).
 *   KOSONG = pemetaan endpoint belum dikonfirmasi → klien menolak
 *   dengan DOKU_NOT_WIRED (jujur, tanpa panggilan tebak-tebakan).
 * - DOKU_QRIS_EXPIRED_MIN: masa berlaku QR menit (default 30)
 */
export interface DokuConfig {
  env: "sandbox" | "production";
  baseUrl: string;
  clientId: string;
  secretKey: string;
  apiKey: string;
  publicKeyPem: string;
  qrisPath: string;
  qrisExpiredMin: number;
  timeoutMs: number;
}

const clean = (v: string | undefined): string => (v ?? "").trim();

/** Normalisasi PEM satu-baris (`\n` literal) menjadi blok multi-baris. */
export const normalizePem = (raw: string): string => {
  const s = clean(raw);
  if (!s) return "";
  if (s.includes("-----BEGIN")) return s.replace(/\\n/g, "\n");
  return s;
};

export const loadDokuConfig = (): DokuConfig => {
  const envRaw = clean(process.env.DOKU_ENV).toLowerCase();
  const timeoutRaw = Number.parseInt(clean(process.env.DOKU_TIMEOUT_MS), 10);
  const expiredRaw = Number.parseInt(clean(process.env.DOKU_QRIS_EXPIRED_MIN), 10);
  return {
    env: envRaw === "production" ? "production" : "sandbox",
    baseUrl: clean(process.env.DOKU_BASE_URL).replace(/\/+$/, ""),
    clientId: clean(process.env.DOKU_CLIENT_ID),
    secretKey: clean(process.env.DOKU_SECRET_KEY),
    apiKey: clean(process.env.DOKU_API_KEY),
    publicKeyPem: normalizePem(process.env.DOKU_PUBLIC_KEY ?? ""),
    qrisPath: clean(process.env.DOKU_QRIS_PATH),
    qrisExpiredMin:
      Number.isFinite(expiredRaw) && expiredRaw > 0 ? expiredRaw : 30,
    timeoutMs:
      Number.isFinite(timeoutRaw) && timeoutRaw > 0 ? timeoutRaw : 15000,
  };
};

/** True bila kredensial minimum + base URL terisi (belum berarti live). */
export const isDokuConfigured = (cfg: DokuConfig = loadDokuConfig()): boolean =>
  cfg.baseUrl.length > 0 &&
  cfg.clientId.length > 0 &&
  cfg.secretKey.length > 0;

/** True bila pemetaan endpoint sudah dikonfirmasi (siap panggil live). */
export const isDokuWired = (cfg: DokuConfig = loadDokuConfig()): boolean =>
  isDokuConfigured(cfg) && cfg.qrisPath.length > 0;
