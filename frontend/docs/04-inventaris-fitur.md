# 04 — Inventaris Fitur ARISTOTELES

> Jangan tandai selesai hanya karena ada di keputusan. Keputusan ≠ implementasi. Penanda: `[Terverifikasi]`, `[Keputusan pengguna]`, `[Belum dapat diverifikasi]`.

## Sudah tersedia dan terverifikasi [Terverifikasi]

- Baca materi 6 tipe via `MaterialRenderer.svelte` → `Text/Photo/Audio/Video/Quiz/AssignmentMaterial.svelte`.
- Editor kuis + nilai minimum via `QuizBuilder.svelte` + `quiz-drafts.ts` (`DEFAULT_PASS_SCORE`, `normalizePassScore`).
- Editor tugas 3 bagian via `TaskBriefBuilder.svelte` + `task-drafts.ts`.
- Editor materi Tiptap via `MaterialEditor.svelte` + `material-docs.ts` + `extensions.ts`.
- CRUD modul/sub/materi lokal via `LearningPathManager.svelte` + halaman drill-down + `curriculum.ts`.
- Locking sub/materi via `isSubModuleLocked/isMaterialLocked` di `courses.ts`.
- K-04 materi biasa selesai via Berikutnya — perilaku `markDone` navigasi di `user/kursusku/.../+page.svelte` sesuai keputusan.

## Tersedia sebagian [Terverifikasi]

- Auth lokal (`auth.svelte.ts`, 3 layout guard) — jalan tapi bypass via `localStorage`.
- Progres (`progress.svelte.ts`) — jalan dalam sesi, hilang saat refresh.
- Pembayaran simulasi (`pembayaran/+page.svelte`, `payment.ts`, `enrollment.svelte.ts`) — stage jalan, tanpa gateway.
- Penilaian (`penilaian/*`, `grading.svelte.ts`) — seed + fetch, nilai fallback lokal.
- Sertifikat UI (`user/sertifikat`, `instruktur/sertifikat`) — kartu statis, tombol Unduh/Bagikan tanpa handler.
- Tambah kursus (`tambah/+page.svelte`) — validasi lengkap, simpan `instruktur-draft-course` dengan `modules: []`, tidak masuk daftar.
- Admin tabel (`admin/courses|users|instrukturs`) — tambah array lokal, aksi palsu.

## Simulasi / mock [Terverifikasi]

- `DEMO_ACCOUNTS` password `1234567`, `VALID_CODES` voucher statis, `driveLink` mock, angka dashboard/pendapatan/sertifikat hardcoded, `setTimeout` loading palsu.

## Belum tersedia [Terverifikasi]

- Verifikasi sertifikat publik (tombol tanpa handler di `+page.svelte`).
- Search global / notifikasi bell (form `preventDefault` saja).
- `Unduh PDF` sertifikat, `Lihat Laporan` (salah arah ke `/admin/courses`).

## Kebutuhan baru dari K-01–K-08 [Keputusan pengguna, belum implementasi]

- K-01 undangan instruktur admin-only — kode masih izinkan `teacher` bebas di `register/+page.svelte`.
- K-02 nilai terbaik + riwayat persisten — kode simpan hasil terakhir saja di `quiz-results.svelte.ts`.
- K-03 voucher resmi sekali pakai anti-race — kode `VALID_CODES` lokal.
- K-05 gate sertifikat otomatis — UI statis, belum baca `isModuleComplete`.
- K-06 rubrik + riwayat tugas backend — belum ada.
- K-07 modul independen — kode masih kunci antar-modul.
- K-08 versi materi + pengulangan selektif — belum ada.
