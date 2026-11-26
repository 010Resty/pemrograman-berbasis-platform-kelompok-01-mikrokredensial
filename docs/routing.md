# Peta Rute ARISTOTELES (ringkas)

> Peta rinci per portal: `frontend/web/docs/02-peta-rute-dan-alur.md`. Kontrak
> endpoint: `backend/docs/API_CONTRACT.md` + `frontend/shared/contract/endpoints.json`.

## Web (`frontend/web`, SvelteKit)

- Publik: `/` → redirect `/id`; `/[lang]/` (landing), `/[lang]/pelatihan`,
  `/[lang]/modules/[courseId]/[moduleId]/[subId]`, `/[lang]/promo/**`,
  `/[lang]/patungan/**`, `/[lang]/peringkat`, `/[lang]/tentang/**`,
  `/[lang]/verifikasi`, `/[lang]/login|register|verify-email|lupa-password|reset-password`,
  `/[lang]/invite/[token]`, `/[lang]/menjadi-instruktur/**`,
  `/[lang]/kebijakan-privasi`, `/[lang]/syarat-ketentuan`,
  `/[lang]/segera-hadir`, `/[lang]/with_UNIRA`.
- Peserta: `/user` (+`kursusku/**`, `semua-kursus/**`, `sertifikat/**`,
  `pembayaran/**`, `promo/**`, `profile`).
- Instruktur: `/instruktur` (+`kursusku/**`, `penilaian/**`, `pendapatan`,
  `sertifikat/**`, `promo`, `profile`).
- Admin: `/admin` (+`laporan`, `pembayaran`, `bagi-hasil`, `promos`,
  `vouchers`, `invitations`, `courses`, `kategori`, `peserta`,
  `instrukturs`, `pengajuan-instruktur`, `profile`).
- Proksi: `/api/assignments/upload`, `/api/assignments/grade/[id]` (fail-closed).

## Backend (`backend`, Express, prefix `/api/v1`)

Auth (`/auth/*` + `/me`), profil (`/me/profile`), kursus + kurikulum
(`/courses`, `/modules`, `/submodules`, `/materials`), kategori, progres,
kuis, enrollment, submissions (+`review-queue`), sertifikat (+verify publik),
voucher (+`/admin/vouchers/stats`), admin (+`/admin/reports`), undangan,
pengajuan instruktur, dasbor instruktur, uploads/files, payments
(+webhook DOKU `/payments/doku/notify`), promo, patungan, revenues.
