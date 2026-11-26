# 02 — Peta Rute dan Alur ARISTOTELES

> Penanda: `[Terverifikasi]` dari kode 2026-11-24. Jalur publik memakai prefix bahasa `[lang]` = `id` | `en`. Diperbarui 2026-11-24.

## Publik [Terverifikasi]

| URL | File | Guard / komponen |
|---|---|---|
| `/` | `src/routes/+page.svelte` (+ `+page.server.ts` redirect) | Redirect 307 ke `/id` (cookie bahasa) |
| `/[lang]/` | `src/routes/[lang]/+page.svelte` (+ SSR `+page.server.ts`, cache 60 dtk) | Landing, `PublicHeader`, SeoHead |
| `/[lang]/pelatihan` | `.../pelatihan/+page.svelte` (+ SSR 8 awal) | Katalog + filter kategori/periode/level |
| `/[lang]/modules/[courseId]` (+`[moduleId]`, +`[moduleId]/[subId]`) | `.../modules/...` (detail SSR + cache) | `TrainingHero`, learning path, kunci sekuensial dalam sub-modul |
| `/[lang]/peringkat` | `.../peringkat/+page.svelte` | Peringkat publik real (`GET /courses/rankings`) |
| `/[lang]/promo`, `/[lang]/promo/[slug]`, `/[lang]/promo/diskon\|kurasi\|patungan` | `.../promo/*` | Indeks kampanye aktif + detail (harga server, CTA) |
| `/[lang]/patungan/setup/[courseId]`, `/[lang]/patungan/saya`, `/[lang]/patungan/[groupId]` | `.../patungan/*` | Buat/kelola grup patungan (hanya kursus promo patungan aktif) |
| `/[lang]/login`, `/[lang]/register`, `/[lang]/verify-email`, `/[lang]/lupa-password`, `/[lang]/reset-password` | auth pages | OTP + guard peran, label peran per bahasa |
| `/[lang]/invite/[token]` | `.../invite/[token]/+page.svelte` | Aktivasi undangan (token 1x pakai), tema token portal |
| `/[lang]/verifikasi` | `.../verifikasi/+page.svelte` | Verifikasi sertifikat publik (`?code=`) |
| `/[lang]/menjadi-instruktur` (+`/daftar`), `/[lang]/tentang/*`, `/[lang]/kebijakan-privasi`, `/[lang]/syarat-ketentuan`, `/[lang]/segera-hadir`, `/[lang]/with_UNIRA` | statis/formulir | Kebijakan/syarat di-prerender (id+en) |

## Peserta [Terverifikasi]

- Shell: `src/routes/user/+layout.svelte` — guard student (verifikasi server), bell notifikasi (`useBadgePolling` + cache 45 dtk), `Sidebar.svelte` (Promo = grup collapsible 3 jenis).
- `user/+page.svelte` — dashboard dari backend.
- `user/kursusku/+page.svelte` — enrollment server; `user/kursusku/[courseId]/+page.svelte` — akses + progres server, kunci hanya dalam sub-modul.
- `user/kursusku/[courseId]/[moduleId]/[materialId]/+page.svelte` — `MaterialRenderer` 6 tipe; kuis via `QuizMaterial` (skor server); tugas via `AssignmentMaterial` (status server).
- `.../hasil/+page.svelte` — ringkasan hasil (terbaik + riwayat server).
- `user/semua-kursus/` (+`[courseId]`), `user/promo/*`, `user/pembayaran/` (riwayat + `StatusBadge`), `user/pembayaran/[courseId]` (QRIS DOKU: polling 5 dtk + countdown + banner offline + auto-refresh QR), `user/sertifikat/` (badge + unduh PDF), `user/profile/`.

Alur peserta: Kursusku → detail kursus → materi via `MaterialRenderer` → kuis lulus di server → progres tercatat → sertifikat modul terbit otomatis bila syarat penuh.

## Instruktur [Terverifikasi]

- Shell: `src/routes/instruktur/+layout.svelte` — guard teacher, bell (`useBadgePolling`).
- `kursusku/` — daftar kelola; `kursusku/[courseId]/…/[materialId]/+page.svelte` — drill-down + `QuizBuilder` / `TaskBriefBuilder` / `MaterialEditor` (dinamis via `AsyncMaterialEditor`), `WarningModal` bila kotor.
- `kursusku/tambah/` — tambah kursus (selalu draft).
- `penilaian/` + `penilaian/[courseId]/` (agregat 1 request `review-queue?courseId=` + paginasi klien) + `penilaian/[courseId]/[materialId]/` (rubrik 3 kriteria + placeholder keputusan wajib + unduh per-baris + `StatusBadge`).
- `pendapatan/`, `sertifikat/` (ringkasan, tab eligibility/riwayat + paginasi), `promo/` (usulkan kursus ke kampanye), `profile/`.

## Admin [Terverifikasi]

- Shell: `src/routes/admin/+layout.svelte` — guard admin, bell (`useBadgePolling` + cache).
- `+page` (dasbor), `laporan/` (tab Ringkasan/Tren/Per kursus, filter tanggal + Kursus ID tervalidasi, CSV + peringatan 100 baris), `pembayaran/` (dialog verifikasi `ModalShell`; antrean manual; DOKU otomatis), `bagi-hasil/`, `promos/`, `vouchers/` (statistik 1-query + tabel + `StatusBadge`), `invitations/` (token sekali-tampil + salin), `courses/`, `kategori/`, `peserta/`, `instrukturs/` (+ubah), `pengajuan-instruktur/`, `profile/`.

## Navigasi sidebar [Terverifikasi]

`Sidebar.svelte` dukung item + grup sub-menu (`NavItem.children`); grup `collapsible`; `linkable` menjadikan label tautan (dipakai Promo peserta).

- Peserta: Belajar (Dashboard, Kursusku, Semua Kursus, Riwayat Pembayaran, Sertifikat), Promo collapsible (Flash Sale, Pilihan Unggulan, Promo Patungan), Akun (Profil).
- Instruktur: Mengajar (Dashboard, Kursusku, Ajukan Promo, Penilaian), Hasil (Pendapatan, Sertifikat), Akun (Profil).
- Admin: Ringkasan (Dasbor, Laporan), Pengguna (Peserta, Instruktur, Pengajuan, Undangan), Katalog (Kursus, Kategori, Voucher, Promo, Pembayaran), Akun (Profil).

## Gap vs keputusan

- K-04 [Keputusan pengguna] materi biasa selesai via Berikutnya — tercermin via `markDone` navigasi [Terverifikasi].
- K-07 [Keputusan pengguna] modul independen — tercermin: kunci hanya dalam sub-modul (`isMaterialLocked`) [Terverifikasi].
