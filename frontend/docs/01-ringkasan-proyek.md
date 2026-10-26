# 01 — Ringkasan Proyek ARISTOTELES

> Penanda kepastian: `[Terverifikasi]` didukung pemeriksaan kode/dokumen, `[Keputusan pengguna]` ditetapkan pemilik proyek 2026-10-24, `[Rekomendasi]` usulan belum disetujui, `[Belum diputuskan]` butuh keputusan, `[Belum dapat diverifikasi]` bukti kurang.

## Apa ini [Terverifikasi]

- Frontend LMS mikrokredensial di `frontend/`.
- Teknologi: Svelte 5 + SvelteKit 2, TypeScript strict, Tailwind CSS 4, editor Tiptap. Bukti: `package.json`, `vite.config.ts`, `tsconfig.json`, `src/app.css`, `src/lib/tiptap/extensions.ts`.
- Portal: publik (`src/routes/+page.svelte`, `src/routes/modules/`), peserta (`src/routes/user/`), instruktur (`src/routes/instruktur/`), admin (`src/routes/admin/`).
- Cara jalan [Terverifikasi dari `README.md` + `package.json`]: `npm install`, `npm run dev`, cek `npm run check`, build `npm run build`.

## Kondisi saat ini [Terverifikasi]

- Banyak fitur jalan di browser memakai data statis, mock, state memori, `localStorage`/`sessionStorage`.
- Sesi: `SESSION_KEY = 'aristoteles-session'` di `src/lib/stores/auth.svelte.ts`.
- Kepemilikan kursus: `aristoteles:owned-courses:v2` di `src/lib/stores/enrollment.svelte.ts`.
- Kurikulum: `kurikulum-draft-{courseId}` di `src/lib/stores/curriculum.ts`.
- Kuis: `materi-kuis-*` + `DEFAULT_PASS_SCORE = 70` di `src/lib/stores/quiz-drafts.ts`.
- Hasil kuis: `aristoteles:quiz-results:v1` di `src/lib/stores/quiz-results.svelte.ts`.
- Tugas: `aristoteles:submissions:v1` di `src/lib/stores/submissions.svelte.ts`.
- Progres: `SvelteSet` memori saja di `src/lib/stores/progress.svelte.ts` — hilang saat refresh.
- API proxy `src/routes/api/assignments/upload/+server.ts` dan `src/routes/api/assignments/grade/[id]/+server.ts` fallback mock bila backend offline.
- Backend nyata [Belum dapat diverifikasi]: tidak ada bukti JWT, database, gateway, storage file di repo frontend.

## Target [Keputusan pengguna 2026-10-24]

- K-01–K-08 sudah dipilih sebagai aturan bisnis target. Implementasi belum dianggap selesai. Detail: `06-aturan-bisnis.md`, `09-keputusan-proyek.md`.

## Konflik README yang dicatat (README tidak diubah di sini)

- Klaim 6 kursus vs `src/lib/data/courses.ts` berisi 8 kursus.
- Klaim rute `verify/` vs tidak ada folder `src/routes/verify/`.
- Klaim `QuizMaterial + pembahasan` vs kode peserta tidak menampilkan `explanation`.
- Tidak sebut portal instruktur vs `src/routes/instruktur/` lengkap.

## Baca selanjutnya

- Peta klik: `02-peta-rute-dan-alur.md`
- Arsitektur: `03-arsitektur-frontend.md`
- Status jujur tiap fitur: `04-inventaris-fitur.md`
- Kebutuhan backend: `05-kebutuhan-backend.md`
