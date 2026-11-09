# Modul `payments` — QRIS MANUAL + VERIFIKASI ADMIN (tanpa gateway)

Keputusan pemilik produk (2026): pembayaran berjalan manual — peserta bayar via
QRIS statis platform lalu mengunggah bukti, admin memverifikasi dan akses
diberi via grant. Gateway otomatis (Midtrans/Xendit/Duitku) BELUM diputuskan;
bila kelak diputuskan, webhook ditempel di modul ini tanpa mengubah kontrak
verifikasi manual.

Alur:
1. `POST /api/v1/courses/:id/payments` (peserta) — buat antrean `menunggu`
   (idempoten per antrean terbuka; opsional voucher diskon + bukti awal).
2. Peserta mengunggah bukti gambar (`payment_proof`, pemilik + admin saja).
3. `GET /api/v1/me/payments?courseId=` — status untuk polling peserta.
   `GET /api/v1/me/payments?status=&limit=&page=` — daftar milik sendiri
   (tanpa courseId) untuk bell peserta; tanpa audit (baca frekuensi tinggi).
4. `GET /api/v1/admin/payments` + `POST /api/v1/admin/payments/:id/verify`
   (admin) — terima (nominal >= tagihan, hanguskan voucher bila ada,
   `source: "payment:manual"`, audit `payment.verify`) atau tolak + alasan.

Sumber enrollment untuk jalur ini: `payment:manual` (lihat komentar
kolom `source`; nilai final diputuskan bersama kebijakan pembayaran ini).
Lihat modul `enrollments/` (akses/grant) dan `vouchers/` (diskon).
