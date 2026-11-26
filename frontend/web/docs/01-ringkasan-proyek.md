# 01 — Ringkasan Proyek ARISTOTELES

> Penanda kepastian: `[Terverifikasi]` didukung pemeriksaan kode/dokumen, `[Keputusan pengguna]` ditetapkan pemilik proyek 2026-10-24, `[Rekomendasi]` usulan belum disetujui. Diperbarui 2026-11-24.

## Apa ini [Terverifikasi]

- Frontend LMS mikrokredensial di `frontend/web`.
- Teknologi: Svelte 5 + SvelteKit 2, TypeScript strict, Tailwind CSS 4, editor Tiptap. Bukti: `package.json`, `vite.config.ts`, `tsconfig.json`, `src/app.css`, `src/lib/tiptap/extensions.ts`.
- Portal: publik (`src/routes/[lang]/`), peserta (`src/routes/user/`), instruktur (`src/routes/instruktur/`), admin (`src/routes/admin/`).
- Backend nyata di `backend/` (Express + Drizzle + MySQL, prefix `/api/v1`): 20 modul, ~150 endpoint, 241/241 tes hijau. Rincian: `backend/README.md`, `backend/docs/API_CONTRACT.md`.
- Cara jalan [Terverifikasi dari `README.md` + `package.json`]: `npm install`, `npm run dev`, cek `npm run check` (0 errors, 0 warnings), build `npm run build` (lolos kompilasi + prerender).
- Kontrak bersama web+Android: `frontend/shared/` (contractVersion 1.6.0). Bila beda dengan backend, perilaku backend aktual yang menang.

## Kondisi saat ini [Terverifikasi 2026-11-24]

- Semua portal memanggil backend nyata via `src/lib/api/` + envelope `{status,message,data}`. Tidak ada `DEMO_ACCOUNTS`, `VALID_CODES`, atau `purchaseCourse` di bundle.
- Sesi: token akses di memori + refresh token di storage (`auth.svelte.ts`); guard portal verifikasi ke `GET /auth/me` — peran dari server, bukan storage.
- Kepemilikan kursus: cermin server, disinkronisasi ulang tiap muat (`enrollment.svelte.ts`).
- Kurikulum: draf lokal `kurikulum-draft-{id}` (`curriculum.ts`) sebagai cache editor; kebenaran baca di server + versi K-08 (`expectedUpdatedAt`, riwayat `GET /materials/:id/changes`).
- Kuis: ambang per kuis (`normalizePassScore`, default 70) + editor `QuizBuilder`; nilai terbaik + riwayat persisten di server (`quiz-best`), bukan `quiz-results` lokal.
- Tugas: kirim via proksi backend (`/api/assignments/upload`, 502 jujur bila backend offline); status kelulusan menempel dari server (`getTaskStatus`), bukan nilai lokal.
- Progres: `progress.svelte.ts` disinkronkan dari server saat muat + persist; tandai selesai via `POST /materials/:id/progress`.
- Pembayaran: QRIS dinamis DOKU end-to-end (antrean → QR → polling → webhook → grant). Tanpa config DOKU → 503 jujur, tanpa QR palsu. Manual hanya antrean lawas (backend).
- Voucher: kelola + tukar via backend (`POST /vouchers/redeem` atomik anti-race, `POST /vouchers/validate` tanpa hangus, statistik 1-query).
- Sertifikat: terbit otomatis bersyarat + daftar/unduh PDF/verify publik/QR/cabut via backend; UI kartu + badge + lightbox.
- Polling hemat: jeda saat tab hidden; bell memakai cache GET opt-in 45–60 dtk + invalidasi per mutasi (`lib/api/cache.ts`); hook polling terpadu (`lib/stores/badge-poll.ts`).
- Dialog: satu pola `ModalShell` (native `<dialog>`); badge: `StatusBadge`; navigasi: `Breadcrumb`; editor Tiptap dimuat dinamis (`AsyncMaterialEditor`).

## Target [Keputusan pengguna 2026-10-24]

- K-01–K-08 disepakati sebagai aturan bisnis; implementasi backend + frontend selesai untuk alur utama (detail + bukti uji: `06-aturan-bisnis.md`, `09-keputusan-proyek.md`, `04-inventaris-fitur.md`, `07-risiko-dan-validasi.md`).

## Baca selanjutnya

- Peta klik: `02-peta-rute-dan-alur.md`
- Arsitektur: `03-arsitektur-frontend.md`
- Status jujur tiap fitur: `04-inventaris-fitur.md`
- Kebutuhan backend: `05-kebutuhan-backend.md` (sebagian besar terpenuhi — lihat penanda per bagian)
