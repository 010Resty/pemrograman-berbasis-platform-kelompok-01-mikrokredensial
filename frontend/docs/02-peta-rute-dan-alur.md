# 02 — Peta Rute dan Alur ARISTOTELES

> Penanda: `[Terverifikasi]` dari kode, `[Keputusan pengguna]` K-01–K-08, `[Belum diputuskan]` butuh jawaban. Tidak ada nomor baris karangan — hanya path + nama simbol.

## Publik [Terverifikasi]

| URL | File | Guard / komponen |
|---|---|---|
| `/` | `src/routes/+page.svelte` | Publik, `Logo.svelte`, tombol verifikasi tanpa handler |
| `/modules` | `src/routes/modules/+page.svelte` | Filter lokal kategori/periode |
| `/modules/[courseId]` | `src/routes/modules/[courseId]/+page.svelte` | `TrainingHero`, `LearningPathRoadmap`, `ModuleLearningPath`, `TrainingActionCard` |
| `/login`, `/register`, `/with_UNIRA` | `src/routes/login/+page.svelte`, `src/routes/register/+page.svelte`, `src/routes/with_UNIRA/+page.svelte` | `login`, `register`, `loginWithUnita` di `auth.svelte.ts` |

## Peserta [Terverifikasi]

- Shell: `src/routes/user/+layout.svelte` — guard `$effect` + `loadSession()` + `goto('/login')` bila tanpa sesi, `goto(homeFor(role))` bila peran salah, `Sidebar.svelte` kecuali halaman materi full-frame.
- `src/routes/user/+page.svelte` — dashboard statis.
- `src/routes/user/kursusku/+page.svelte` — `courses.filter(canAccessCourse)` via `enrollment.svelte.ts`, voucher `VALID_CODES` lokal.
- `src/routes/user/kursusku/[courseId]/+page.svelte` — `canAccessCourse`, `isPeriodLocked` via `enrollment.svelte.ts`, locking via `isModuleLocked/isSubModuleLocked` di `courses.ts`, progres via `training.ts` + `doneMaterials` di `progress.svelte.ts`.
- `src/routes/user/kursusku/[courseId]/[moduleId]/[materialId]/+page.svelte` — `flat = getModuleMaterials()`, `isMaterialLocked`, `MaterialRenderer` dengan `onComplete=markDone`.
- `.../hasil/+page.svelte` — `getQuizResult` + `normalizePassScore` + `DEFAULT_PASS_SCORE` di `quiz-drafts.ts`.
- `src/routes/user/semua-kursus/+page.svelte`, `semua-kursus/[courseId]/+page.svelte` (`CoursePreview`), `pembayaran/[courseId]/+page.svelte`, `sertifikat/+page.svelte`.

Alur peserta: Kursusku → detail kursus → materi via `MaterialRenderer` → kuis lolos `score >= effectivePass` di `QuizMaterial.svelte` → `hasil` → materi berikut bila `markDone`. Tugas via `AssignmentMaterial.svelte` → `onSubmit=markDone`.

## Instruktur [Terverifikasi]

- Shell: `src/routes/instruktur/+layout.svelte` — guard teacher.
- `kursusku/+page.svelte` — filter ID `[1,5,3,4]`.
- `kursusku/[courseId]/+page.svelte` — `LearningPathManager.svelte` + `CourseRoadmap` preview + `loadCurriculumDraft/saveCurriculumDraft/withSyncedFlat` di `curriculum.ts`.
- `kursusku/[courseId]/[moduleId]/+page.svelte` — CRUD sub-modul inline.
- `kursusku/[courseId]/[moduleId]/[subId]/+page.svelte` — CRUD materi inline + `refreshDocMeta` (`loadQuizDraft/loadTaskDraft/getMaterialDocMeta`).
- `.../[materialId]/+page.svelte` — `normalizeMaterialType` → `QuizBuilder` / `TaskBriefBuilder` / `MaterialEditor`, tab `tulis/pratinjau`, `WarningModal` bila `dirty`.
- `kursusku/tambah/+page.svelte` — simpan `instruktur-draft-course`, `modules: []`.
- `penilaian/+page.svelte`, `penilaian/[courseId]/+page.svelte`, `penilaian/[courseId]/[materialId]/+page.svelte` — `grading.svelte.ts` (`reviewMap`, `ensureGradingLoaded`, `submitReviewScore`) + `grading.ts` (`tasksOfCourse`, `resolveTaskKey`).
- `pendapatan/+page.svelte`, `sertifikat/+page.svelte` — state lokal statis.

## Admin [Terverifikasi]

- `src/routes/admin/+layout.svelte` — guard admin klien.
- `admin/+page.svelte`, `admin/courses/+page.svelte`, `admin/users/+page.svelte`, `admin/users/[userId]/+page.svelte`, `admin/instrukturs/+page.svelte` — tabel/kartu + tambah lokal, aksi Reset/Nonaktifkan hanya `flash()`.

## Gap vs keputusan

- K-04 [Keputusan pengguna] materi biasa selesai via Berikutnya — sudah tercermin via `markDone` navigasi [Terverifikasi].
- K-07 [Keputusan pengguna] modul independen — belum tercermin, kode masih `isModuleLocked` antar-modul di `courses.ts`. Dicatat sebagai pekerjaan lanjutan.
