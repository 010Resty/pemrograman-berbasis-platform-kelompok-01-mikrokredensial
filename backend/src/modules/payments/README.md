# Modul `payments` — QRIS DINAMIS DOKU (gateway) + manual lawas

Keputusan pemilik produk (2026-11): pembayaran pindah total ke QRIS dinamis
DOKU — pindai QR → nominal tampil otomatis. Jalur manual (QRIS statis +
unggah bukti + verifikasi admin) dipertahankan di kode hanya untuk antrean
lawas; UI baru hanya mengekspos DOKU.

Alur DOKU:
1. `POST /api/v1/courses/:id/payments {gateway:"doku", voucherCode?}` —
   nominal = `amountExpected` server (voucher/promo non-stack) → QR DOKU →
   antrean `menunggu` + referensi/QR/kedaluwarsa.
2. Peserta memindai QR (`GET /api/v1/payments/:id/qr` → PNG) — nominal
   tampil otomatis. Polling `GET /me/payments?courseId=`.
3. DOKU memanggil `POST /api/v1/payments/doku/notify` (signature RSA) →
   sukses = grant + hanguskan voucher (idempoten) via `payment:doku`;
   gagal/kedaluwarsa = `ditolak` + alasan. QR kedaluwarsa →
   `POST /api/v1/payments/:id/doku/refresh`.
4. Batalkan antrean menunggu → `DELETE /api/v1/payments/:id` (sama).

Tanpa konfigurasi DOKU → 503 `DOKU_NOT_CONFIGURED`; pemetaan endpoint
belum dikonfirmasi → 503 `DOKU_NOT_WIRED`. Tanpa QR/sukses palsu.

Sumber enrollment: `payment:doku` (DOKU) dan `payment:manual` (antrean lawas).
Lihat modul `doku/` (klien + signature + status) dan `enrollments/` + `vouchers/`.
