# 03 — Arsitektur Frontend ARISTOTELES

> `[Terverifikasi]` dari kode 2026-11-24. Bagian backend hanya target yang sudah terpenuhi — detail kontrak: `backend/docs/API_CONTRACT.md`. Diperbarui 2026-11-24.

## Fondasi [Terverifikasi]

- Svelte 5 runes `$state/$derived/$effect`, `SvelteSet/SvelteMap` untuk state reaktif. Bukti: `progress.svelte.ts`, `enrollment.svelte.ts`, `badge-poll.ts`, penilaian `[materialId]/+page.svelte`.
- TypeScript strict (`tsconfig.json`), validasi via `npm run check` (0 errors, 0 warnings).
- Tailwind 4 via `@tailwindcss/vite`, token di `src/app.css` (`--color-primary`, `--font-heading/body`, dsb.), ikon Font Awesome self-hosted, font woff2 preload (Manrope/Inter latin).
- Prerender halaman statis (`kebijakan-privasi`, `syarat-ketentuan`, id+en) + `Cache-Control` SSR katalog/detail (60 dtk + SWR 300 dtk); portal memakai `noindex`.

## Data vs store [Terverifikasi]

- `src/lib/api/`: `backend.ts` (envelope ketat, silent-refresh 401, dedup in-flight, timeout), `cache.ts` (GET cache opt-in + invalidasi + clear saat logout), `courses.ts`, `progress.ts`, `quiz.ts`, `submissions.ts` (termasuk `fetchReviewQueue(courseId?)`), `certificates.ts`, `vouchers.ts` (termasuk stats 1-query + fallback), `invitations.ts`, `admin.ts` (laporan scoped), `dashboard.ts`, `enrollments.ts`, `uploads.ts`, `applications.ts`, `grading-queue.ts`, `promos.ts`, `patungan.ts`, `revenues.ts`, `profile.ts`, `categories.ts`, `responsive.ts` (`buildSrcSet` untuk `?w=`), `request-policy.ts` (klasifikasi 401/403/network/server, logout terpusat).
- `src/lib/stores/`: `auth.svelte.ts` (sesi server + `roleLabelFor` per bahasa + logout bersih cache), `enrollment.svelte.ts` (cermin server), `progress.svelte.ts` (sinkron + persist server), `badge-poll.ts` (hook polling bell), `curriculum.ts` (draf editor + `withSyncedFlat`), `material-docs.ts`, `quiz-drafts.ts` (`DEFAULT_PASS_SCORE`, `normalizePassScore`, indeks memori), `task-drafts.ts`, `toast.svelte.ts`. Tidak ada akun demo; `DEMO_ACCOUNTS`/`VALID_CODES`/`purchaseCourse` tidak ada di bundle.
- `src/lib/data/`: kursus/meta/materi/pembayaran statis sebagai fallback tampilan; kebenaran milik server.
- `src/lib/server/public-catalog.ts`: SSR katalog (timeout 8 dtk, gagal → daftar kosong jujur).

## Komponen [Terverifikasi]

- `materials/`: `MaterialRenderer.svelte` dispatch ke `Text/Photo/Audio/Video/Quiz/AssignmentMaterial.svelte` (srcset responsif, status server + banner offline).
- `training/organisms`: `MaterialEditor` (Tiptap, toolbar sticky, dimuat dinamis via `AsyncMaterialEditor`), `MaterialPreview`, `QuizBuilder`, `TaskBriefBuilder`, `LearningPathManager`, `CurriculumEditor` (warisan, tidak dipakai rute drill-down — jangan tambah editor baru tanpa hapus duplikat), `CourseRoadmap`, `TrainingCurriculum`.
- Bersama: `Sidebar.svelte`, `Logo.svelte`, `ModalShell.svelte` (pola `<dialog>` standar: fokus, Escape, backdrop, kembalikan fokus), `WarningModal.svelte`, `RevokeDialog.svelte` (di atas ModalShell), `StatusBadge.svelte`, `Breadcrumb.svelte`, `Pagination.svelte`, `CoursePreview.svelte`, `CertificateLightbox.svelte` (focus-trap + kembalikan fokus).
- Tiptap: `src/lib/tiptap/extensions.ts` (`createEditorExtensions`, `toEmbedUrl`, `VideoEmbed`, `AudioEmbed`, `PdfAttachment`); sanitasi `{@html}` via `src/lib/security/sanitize.ts` + CSP `hooks.server.ts`.

## API proxy [Terverifikasi]

- `src/routes/api/assignments/upload/+server.ts` — validasi `.pdf`/mime/`10MB`/magic `%PDF`, wajib token, teruskan ke backend; backend offline = 502 jujur (tidak ada sukses palsu).
- `src/routes/api/assignments/grade/[id]/+server.ts` — teruskan nilai, wajib token; tanpa token = 401 fail-closed.
- Tidak ada logika auth/bisnis di proxy — otorisasi penuh di backend.

## Arsitektur target [Keputusan pengguna — terpenuhi]

- Server sebagai sumber kebenaran untuk sesi, progres, nilai terbaik, voucher, sertifikat, riwayat — frontend hanya cache + UI optimistik. Detail kontrak: `backend/docs/API_CONTRACT.md`; status per fitur: `04-inventaris-fitur.md`.
