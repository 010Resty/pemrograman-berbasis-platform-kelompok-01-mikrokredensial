import { DokuConfig, isDokuWired, loadDokuConfig } from "./doku.config";

export class DokuError extends Error {
  http: number;
  code: string;
  constructor(http: number, code: string, message: string) {
    super(message);
    this.http = http;
    this.code = code;
  }
}

export interface DokuQrisOrderInput {
  /** Invoice internal (dipakai sebagai referensi/merchantOrderNo). */
  invoice: string;
  /** Nominal tagihan final dari server (sudah termasuk diskon). */
  amount: number;
  /** Masa berlaku QR dalam menit. */
  expiredMinutes: number;
}

export interface DokuQrisOrder {
  referenceId: string;
  qrString: string;
  expiresAt: Date;
}

/**
 * Klien DOKU Direct API (QRIS dinamis).
 *
 * Disengaja dua lapis kegagalan jujur (tanpa sukses palsu):
 * - kredensial/base URL kosong → 503 DOKU_NOT_CONFIGURED
 * - `DOKU_QRIS_PATH` kosong (pemetaan endpoint belum dikonfirmasi dari
 *   API spec DOKU) → 503 DOKU_NOT_WIRED
 *
 * Setelah path + skema header dikonfirmasi (Fase 1b), implementasi
 * `fetch`-nya diisi di SATU tempat: `requestCreateQris`.
 */
export const createDokuQrisOrder = async (
  input: DokuQrisOrderInput,
  cfg: DokuConfig = loadDokuConfig()
): Promise<DokuQrisOrder> => {
  if (input.amount <= 0 || !Number.isInteger(input.amount)) {
    throw new DokuError(400, "DOKU_BAD_AMOUNT", "Nominal QRIS harus bilangan bulat positif");
  }
  if (!cfg.baseUrl || !cfg.clientId || !cfg.secretKey) {
    throw new DokuError(
      503,
      "DOKU_NOT_CONFIGURED",
      "Pembayaran DOKU belum dikonfigurasi (isi DOKU_BASE_URL/CLIENT_ID/SECRET_KEY)"
    );
  }
  if (!cfg.qrisPath) {
    throw new DokuError(
      503,
      "DOKU_NOT_WIRED",
      "Pemetaan endpoint DOKU belum dikonfirmasi dari API spec — tidak ada panggilan tebak-tebakan"
    );
  }
  return requestCreateQris(input, cfg);
};

/**
 * Panggilan HTTP live ke DOKU. DOKU-DOKU: diisi di Fase 1b setelah
 * API spec (endpoint, header signature, bentuk payload) dikonfirmasi.
 */
const requestCreateQris = async (
  input: DokuQrisOrderInput,
  cfg: DokuConfig
): Promise<DokuQrisOrder> => {
  void cfg;
  void input;
  // Placeholder jujur: JANGAN kembalikan QR palsu.
  // Fase 1b mengisi fetch ke `${cfg.baseUrl}${cfg.qrisPath}` di sini.
  throw new DokuError(
    503,
    "DOKU_NOT_WIRED",
    `Pemetaan endpoint '${cfg.qrisPath || "(kosong)"}' belum diverifikasi terhadap API spec DOKU`
  );
};
