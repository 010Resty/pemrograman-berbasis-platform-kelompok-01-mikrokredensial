# 05 — Kebutuhan Backend ARISTOTELES

> Status tiap bagian: `[Terpenuhi]` = endpoint/logika ada di backend + dipakai frontend (kontrak: `backend/docs/API_CONTRACT.md`); `[Keputusan pengguna]` = aturan target. Diperbarui 2026-11-24. Jangan baca usulan lama di bawah sebagai belum ada — baca penanda statusnya.

## Auth dan peran (K-01) [Terpenuhi]

- Backend: `POST /auth/register` (selalu student, OTP 6 digit, cooldown 60 dtk, maks 5 salah) → `POST /auth/verify-email` (terbit sesi) → `POST /auth/login` (bcrypt, blokir nonaktif) → `POST /auth/refresh` (rotasi sekali pakai + grace reuse) → `POST /auth/logout` (1/semua sesi); `GET /auth/me` (identitas dari DB). Rate-limit OTP 30x/15 mnt/IP.
- Undangan: `POST /admin/invitations` (token hash, 7 hari, email SMTP, gagal email tidak gagalkan buat) → `GET /invitations/validate` → `POST /invitations/accept` (transaksional buat teacher + audit); kirim-ulang terbitkan token baru (lama hangus); pakai ulang → 409.
- Frontend: register/login/verify/forgot/reset/invite end-to-end; guard verifikasi server; label peran per bahasa. Tidak ada akun demo.

## Kuis dan riwayat (K-02) [Terpenuhi]

- Backend: bank soal (`PUT /materials/:id/quiz`, snapshot per percobaan) + `POST .../quiz-attempts` (grading 100% server) + `GET .../quiz-attempts` (riwayat) + `GET .../quiz-best` (MAX, lulus bertahan); agregat SQL 1 baris; kunci tidak keluar ke peserta.
- Frontend: `QuizMaterial` (terbaik + pratinjau), halaman hasil, editor `QuizBuilder` + ambang per kuis (default 70).

## Voucher (K-03) [Terpenuhi]

- Backend: `POST/GET /admin/vouchers` (+ disable/enable + detail + 50 redemptions), `POST /vouchers/redeem` (atomik `FOR UPDATE` + UNIQUE + retry; Personal 1 akun 1x), `POST /vouchers/validate` (tanpa hangus), `GET /admin/vouchers/stats` (1-query: total/aktif/habis/kedaluarsa/batal), konsumsi atomik saat verifikasi bayar. Jenis `diskon` (opsi A [Keputusan pengguna 2026-11-04]): persen 1–100/nominal, non-stack vs promo (terbesar menang), hangus saat disetujui.
- Frontend: kelola admin + statistik + tukar + bayar pakai voucher + error jujur + retry.

## Progres (K-04, K-07, K-08) [Terpenuhi]

- Backend: `POST/DELETE /materials/:id/progress` (idempoten) + `GET /me/progress` (+ summary); auto-issue sertifikat; K-08 `expectedUpdatedAt` + 409 + audit + `GET /materials/:id/changes`.
- Frontend: `markDone` navigasi; kunci hanya dalam sub-modul sama; editor tampilkan riwayat perubahan.

## Tugas (K-06) [Terpenuhi]

- Backend: `POST /materials/:id/submissions` (wajib `fileId` kind=assignment milik sendiri + magic-bytes; resubmit = baris baru) + daftar/status/detail + `POST .../:subId/grade` (skor atau rubrik wajib salah satu; rubrik 3 kriteria tetap Kelengkapan/Ketepatan isi/Kerapian, rata-rata server) + `GET /instructor/review-queue[?courseId=]`.
- Frontend: `AssignmentMaterial` (validasi PDF + status server + riwayat), penilaian (keputusan eksplisit + unduh per-baris + paginasi).

## Sertifikat (K-05) [Terpenuhi]

- Backend: gate per-tipe (biasa=progres, kuis=lulus, tugas=lulus) + terbit otomatis + idempoten + level kursus (`moduleId NULL`, supersede modul) + PDF malas + QR + verify publik + revoke terminal 409.
- Frontend: daftar + kartu + unduh + verify + badge + lightbox; instruktur: ringkasan/eligibility/riwayat/cabut.

## Materi berubah (K-08) [Terpenuhi]

- Lihat bagian Progres. Penting = ubah isi kuis/tugas/ambang/hapus; ringan = typo/format/sampul/judul; diputus instruktur pemilik; catat perubahan + terdampak + alasan + status.

## Admin + audit [Terpenuhi]

- CRUD user/kursus/kurikulum + nonaktif + grant/revoke + laporan scoped + audit semua tulis sensitif (`audit_logs`).

## Pembayaran QRIS dinamis DOKU [Keputusan pengguna 2026-11]

**Bagi hasil instruktur + penarikan [Terverifikasi 2026-11-18]:** persen global (`revenue_settings`, default 70%) + minimal (default Rp100rb) diatur admin (`GET/PUT /admin/revenue-settings`); snapshot hak per pembayaran terverifikasi ke `revenue_ledger` (manual + webhook, idempoten, floor nominal×persen); instruktur (`GET /me/earnings`, `GET/POST /me/payouts`) lihat total/tersedia/diproses/dibayar + rincian per kursus, ajukan penarikan dengan rekening tiap pengajuan (validasi norek, anti double-spend via kunci per instruktur); admin (`GET /admin/payouts`, `POST /admin/payouts/:id/process`) setujui → tandai-ditransfer / tolak beralasan + audit. Transfer dana manual di luar sistem.

- Alur DOKU [Terpenuhi kecuali transport]: antrean (`POST /courses/:id/payments {gateway:"doku"}`, idempoten) → QR (`GET /payments/:id/qr`, PNG) → polling → webhook (`POST /payments/doku/notify`, RSA, idempoten, grant `payment:doku` + hanguskan voucher) → akses dibuka + audit. `refreshQr`, `cancel`, `verify` manual (tolak baris DOKU: `DOKU_MANAGED`).
- Nominal otoritatif server; tanpa konfigurasi → 503 `DOKU_NOT_CONFIGURED`; pemetaan endpoint belum dikonfirmasi → 503 `DOKU_NOT_WIRED` (transport `throw` sengaja); tanpa QR/sukses palsu.
- Kwitansi: unduh HTML sisi klien.
- Fase 1b (butuh API spec DOKU): kunci pemetaan endpoint + skema header/signature di `backend/src/modules/doku/` (satu tempat).
