# Changelog Kontrak `frontend/shared/`

## 1.6.0 — 2026-11-24 (Agregat 1-query + optimasi batch backend)

- Baru: `GET /admin/vouchers/stats[?courseId=&kind=&q=]` (admin) → 200
  `{total,aktif,habis,kedaluarsa,batal}` dari 1 query `SUM(CASE)`; grup
  status identik dengan filter daftar (`active`/`expired`). Web memakai ini
  untuk kartu statistik (fallback 5× daftar bila backend lama).
- `GET /instructor/review-queue` dukung `?courseId=` opsional: lingkup 1
  kursus + tetap cek kepengelolaan (bukan pengelola → kosong). Web memakai
  ini di halaman penilaian per kursus (ganti kipas N request per materi);
  dashboard ringkasan tetap tanpa filter.
- Backend: 15 indeks komposit baru (migrasi `0035`), proyeksi polling
  pembayaran (tanpa `dokuQrString`), agregat SQL `getBest`/revenue/
  eligibility batch, paginasi daftar milik sendiri, `rawBody` hanya webhook
  DOKU, purge refresh-token kedaluwarsa (fungsi opsional). Suite backend
  241/241 hijau.
- Frontend web: cache GET opt-in untuk bell (`lib/api/cache.ts`, 45 dtk,
  invalidasi per mutasi), hook polling terpadu (`lib/stores/badge-poll.ts`),
  komponen `ModalShell`/`StatusBadge`/`Breadcrumb`, QR auto-refresh sekali
  + banner offline + jeda polling saat tab hidden, srcset responsif,
  prerender 4 halaman statis, `vite build` lolos (kecuali tahap adapter
  Vercel: symlink EPERM khas Windows — pra-eksis, bukan dari kode).

## 1.5.0 — 2026-11-15 (QRIS dinamis DOKU ganti total jalur manual)

- `POST /courses/:id/payments` terima `{gateway: manual|doku}` (default manual
  untuk kompatibilitas). `gateway:"doku"` → generate QR DOKU per invoice
  (nominal = `amountExpected` server, pindai → nominal tampil otomatis),
  antrean `menunggu` + `dokuReferenceId/dokuQrString/dokuExpiresAt`;
  tanpa konfigurasi → 503 `DOKU_NOT_CONFIGURED`, pemetaan endpoint belum
  dikonfirmasi → 503 `DOKU_NOT_WIRED` (tanpa QR palsu). Iuran patungan via
  DOKU → 400 `PATUNGAN_DOKU_PENDING`; bukti + antrean manual → 409.
- Baru: `GET /payments/:id/qr` (PNG QRIS, pemilik/admin, no-store),
  `POST /payments/:id/doku/refresh` (QR baru bila kedaluwarsa/hilang),
  `POST /payments/doku/notify` (publik + signature RSA, idempoten —
  sukses = grant `payment:doku` + hanguskan voucher).
- `POST /admin/payments/:id/verify` kini khusus antrean manual lawas
  (baris doku → 409 `DOKU_MANAGED`). UI baru hanya mengekspos DOKU.
- Kolom `payments.gateway/doku_reference_id/doku_qr_string/doku_expires_at`
  (migrasi 0031); respons list ikut `gateway/dokuExpiresAt` (+ referensi di admin).

## 1.4.0 — 2026-11-14 (Hapus promo + sampul promo + filter level)

- `DELETE /admin/promos/:slug` (admin): hapus kampanye + anggotanya transaksional +
  audit `promo.delete`; 409 `PROMO_IN_USE` bila grup patungan pending atau antrean
  pembayaran menunggu masih menunjuk slug (riwayat selesai tak tersentuh).
- Web `admin/promos`: tombol Hapus per kartu (konfirmasi `WarningModal` danger) +
  formulir tambah pindah ke modal dialog (fokus awal, Escape/backdrop, kunci scroll).
- `GET /courses` dukung `?level=` (Pemula/Menengah/Lanjutan; nilai asing diabaikan).
- `promo_campaigns.cover_image` (URL http(s)/`/api…`, nullable): sampul promo
  untuk highlight katalog; dikelola via create/patch admin + tampil di
  `GET /promos` dan `GET /promos/:slug`.

## 1.3.0 — 2026-11-14 (Harga patungan per kursus + seed 3 promo default)

- `promo_courses.patungan_price` (total grup, opsional): menimpa nominal kursus
  saat hitung iuran patungan; hanya untuk kampanye tipe patungan
  (`400 PATUNGAN_PRICE_FORBIDDEN` bila tipe lain). Terlihat di detail admin,
  publik (`GET /promos`, `GET /promos/:slug`), dan validasi grup
  (`course.effectivePrice`, `course.patunganPrice`, `total` = harga efektif).
- Seed development: 3 kampanye default `flash-sale` (diskon 10% contoh),
  `promo-pilihan` (kurasi), `promo-patungan` (patungan) — semua `draft`,
  tanpa anggota; idempoten per slug; persen/jendela/anggota diatur admin.
- Klien lama yang mengabaikan field tak dikenal tetap jalan (aditif).

- `admin.reports`: tambah `perCourse[].paymentsDitolak` + blok `insights`
  (`funnel` 4 tahap pendaftar→enrollment→pembayaran→sertifikat berisi
  `count/pctOfFirst/pctOfPrev/basis`, `rates` persetujuan/penolakan bayar,
  penyelesaian enrollment, sertifikat per enrollment, enrollment bersertifikat
  0–100%, pencabutan, plus `note`). Seluruh tahap SATU lingkup filter
  (tahap 1 = pendaftar periode / peserta unik kursus) — tanpa basis campur.
  Aditif: klien lama (Android) yang mengabaikan field tak dikenal tetap jalan.
- Web `admin/laporan`: tabel insight alur (corong + bar), tabel persentase
  kunci, tabel konversi per kursus; CSV ikut memuat baris funnel + rates
  dan kebal formula-injection (`= + - @` diawali kutip satu).

## 1.1.0 — 2026-11-11 (Laporan admin)

- Tambah `admin.reports` (`GET /admin/reports?from=&to=&courseId=`):
  ringkasan + per kursus read-only (`summary`, `perCourse`, `certificates`,
  `filters`). `avgProgress`/`pendingReviews` snapshot saat ini dari dasbor;
  keuangan/sertifikat/enrollment hormati filter tanggal.
- Backend: `admin.service:getAdminReports`, `admin.controller:reportsHandler`,
  `GET /admin/reports`, uji `admin-reports.test.ts` (DB `aristoteles_test_admr`).
- Android: `ReportApi` + `AdminReportsPage` (Ringkasan/Keuangan/Kursus +
  filter 7h/30h/Semua + bagi CSV) + menu Laporan + uji kontrak mock.
- Perbaikan risiko: `perCourse` dipaginasi server (`limit` 1–100 default 100,
  `page`, `paging.total`; sebelumnya mentok 100 tanpa halaman).
  `avgProgress`/`pendingReviews` ditegaskan snapshot saat ini (tak terfilter
  tanggal) di kontrak + label UI web/Android.

## 1.0.0 — 2026-11-10 (Tahap 2 multi-platform)

- Awal: `contract/envelope.md`, `contract/endpoints.json` (±80 endpoint),
  `scenarios/k-01-k-08.md`.
- Diselaraskan dengan backend pasca refresh-token (migrasi 0020) dan
  K-08 materi (`expectedUpdatedAt`/`MATERIAL_CONFLICT`,
  `changeSignificance`/`changeReason`, `GET /materials/:id/changes`).
- Skenario K-01–K-08 ditulis level HTTP agar dapat diimplementasikan
  identik oleh web (SvelteKit/TS) dan Android (Flutter/Dart).
