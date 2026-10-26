# 03 — Arsitektur Frontend ARISTOTELES

> `[Terverifikasi]` dari kode. `[Keputusan pengguna]` target K-01–K-08. Bagian backend hanya target, bukan klaim sudah ada.

## Fondasi [Terverifikasi]

- Svelte 5 runes `$state/$derived/$effect`, `SvelteSet/SvelteMap` untuk state reaktif. Bukti: `progress.svelte.ts`, `enrollment.svelte.ts`, `grading.svelte.ts`, `QuizBuilder.svelte`.
- TypeScript strict (`tsconfig.json`), validasi via `svelte-check`.
- Tailwind 4 via `@tailwindcss/vite`, token di `src/app.css`, ikon Font Awesome CDN di `src/routes/+layout.svelte`.

## Data vs store [Terverifikasi]

- `src/lib/data/`: `courses.ts` (kursus + `normalizeMaterialType`, `isModuleLocked/isSubModuleLocked/isMaterialLocked`), `material-details.ts` (override + default per tipe), `course-meta.ts`, `certificates.ts` (`moduleCredentialId`, `isModuleComplete`), `training.ts` (progres + resume), `payment.ts`, `grading.ts`.
- `src/lib/stores/`: `auth.svelte.ts` (`SESSION_KEY`, `DEMO_ACCOUNTS`, `loadSession/login/register/loginWithUnita`), `enrollment.svelte.ts` (`ownedCourses`), `progress.svelte.ts` (memori), `curriculum.ts` (`mem` + `kurikulum-draft-*`, `normalizeModule`, `clonePlain`, `withSyncedFlat`, `curriculumUid`), `material-docs.ts`, `quiz-drafts.ts` (`DEFAULT_PASS_SCORE`, `normalizePassScore`, `findQuizPassScoreByMaterial`), `task-drafts.ts`, `quiz-results.svelte.ts`, `submissions.svelte.ts`, `grading.svelte.ts`, `payment.ts`.

## Komponen [Terverifikasi]

- `materials/`: `MaterialRenderer.svelte` dispatch ke `Text/Photo/Audio/Video/Quiz/AssignmentMaterial.svelte`.
- `training/atoms|molecules|organisms`: `MaterialTypeIcon`, `CountPill`, `ProgressBar`, `MaterialItem`, `ModuleHeader`, `TaskStepsList`, `MaterialEditor`, `MaterialPreview`, `QuizBuilder`, `TaskBriefBuilder`, `LearningPathManager`, `CurriculumEditor` (tidak dipakai rute drill-down — jangan tambah editor baru tanpa hapus duplikasi), `CourseRoadmap`, `TrainingCurriculum`, dll.
- Bersama: `Sidebar.svelte`, `Logo.svelte`, `WarningModal.svelte` (pola modal benar: `role=dialog`, trap Tab, Escape, fokus kembali), `CoursePreview.svelte`, `MonthPicker.svelte`.
- Tiptap: `src/lib/tiptap/extensions.ts` (`createEditorExtensions`, `toEmbedUrl`, `VideoEmbed`, `AudioEmbed`, `PdfAttachment`).

## API proxy [Terverifikasi]

- `src/routes/api/assignments/upload/+server.ts` — validasi `.pdf`/mime/`10MB`/magic `%PDF`, proxy ke `BACKEND_URL` bila ada, fallback mock `driveLink` + `driveMode: mock`.
- `src/routes/api/assignments/grade/[id]/+server.ts` — teruskan `score`, fallback pesan lokal.
- Tidak ada bukti auth server, JWT, cookie HttpOnly di repo frontend.

## Target arsitektur [Keputusan pengguna]

- Server jadi sumber kebenaran untuk sesi, progres, nilai terbaik, voucher, sertifikat, riwayat. Frontend hanya cache + optimistik UI. Detail di `05-kebutuhan-backend.md`.
