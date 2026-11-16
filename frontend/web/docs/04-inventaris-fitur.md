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
- Pembayaran QRIS dinamis DOKU + verifikasi otomatis via webhook (`user/pembayaran/[courseId]/+page.svelte`, `api/payments/*`, modul backend `payments` + `doku`) — pindai QR → nominal tampil otomatis → akses dibuka tanpa unggah bukti: buat antrean → QR PNG server + hitung mundur kedaluwarsa/refresh → polling status → grant `payment:doku` + audit. Kwitansi dapat diunduh (HTML).
- Penilaian (`penilaian/*`, `grading.svelte.ts`) — seed + fetch, nilai fallback lokal.
- Sertifikat UI (`user/sertifikat`, `instruktur/sertifikat`) — kartu statis, tombol Unduh/Bagikan tanpa handler.
- Tambah kursus (`tambah/+page.svelte`) — validasi lengkap, simpan `instruktur-draft-course` dengan `modules: []`, tidak masuk daftar.
- Admin tabel (`admin/courses|users|instrukturs`) — tambah array lokal, aksi palsu.
- Undangan instruktur end-to-end (`admin/invitations`, `/invite/[token]`, `api/invitations.ts`) — daftar/buat/batal/kirim-ulang + aktivasi via backend, email SMTP otomatis; token sekali-tampil, kirim-ulang menerbitkan token baru (lama hangus).
- Voucher admin end-to-end (`admin/vouchers`, `api/vouchers.ts`) — daftar/filter, buat Personal/Umum/Diskon (persen/nominal, K-03 opsi A), validasi tanpa hangus, detail + riwayat penukaran asli, nonaktif/aktifkan via backend (K-03).
- Ubah instruktur (`admin/instrukturs/[id]/edit`, PATCH `/admin/users/:id`) — nama/email/keahlian/status tersimpan permanen + audit; keahlian tampil di daftar, detail, dan form.
- Laporan admin (`admin/laporan`, `api/admin.ts:fetchAdminReports`) — ringkasan + keuangan + sertifikat + tabel per kursus dari backend (`GET /admin/reports`), filter tanggal + paginasi server + unduh CSV; progres/antrean dilabeli snapshot saat ini. Insight tampil sebagai diagram: corong konversi pendaftar→enrollment→pembayaran→sertifikat (lebar proporsional + badge penurunan terbesar), meter 6 persentase kunci, donat komposisi pembayaran, bar ganda konversi per kursus; seluruh angka tetap tertulis sebagai teks + `aria-label` (aksesibel, bukan warna saja).
- Promo 3 default (`flash-sale` diskon, `promo-pilihan` kurasi, `promo-patungan`) dari seed; durasi + persen diatur admin; hapus kampanye via tombol Hapus + konfirmasi (ditolak bila antrean aktif menunjuknya); tambah promo lewat modal dialog; harga patungan per kursus menimpa harga katalog saat hitung iuran (fallback ikut harga kursus). Halaman detail per promo di landing (`/promo/[slug]`) dan portal peserta (`/user/promo/[slug]`); sidebar peserta punya dropdown Promo dinamis.

## Simulasi / mock [Terverifikasi]

- `DEMO_ACCOUNTS` password `1234567`, `driveLink` mock, angka dashboard/pendapatan/sertifikat hardcoded, `setTimeout` loading palsu.

## Belum tersedia [Terverifikasi]

- Verifikasi sertifikat publik (tombol tanpa handler di `+page.svelte`).
- Search global / notifikasi bell (form `preventDefault` saja).
- `Unduh PDF` sertifikat.

## Kebutuhan baru dari K-01–K-08 [Keputusan pengguna, belum implementasi]

- K-01 undangan instruktur admin-only — backend `POST /admin/invitations` + email SMTP + aktivasi `/invitations/accept` terverifikasi; `register/+page.svelte` menolak peran teacher; daftar backend tanpa token (salin-ulang tautan lama tak mungkin, pakai kirim-ulang).
- K-02 nilai terbaik + riwayat persisten — terverifikasi: backend simpan tiap percobaan + `GET .../quiz-best` (MAX, lulus bertahan) + riwayat; `QuizMaterial.svelte` tampilkan terbaik + pratinjau 5 (nomor/tanggal/skor/status); cache lokal v2 simpan terbaik (uji kuis 11/11).
- K-03 voucher resmi sekali pakai anti-race — admin kelola via backend (`POST/GET /admin/vouchers`, disable/enable, riwayat penukaran); Personal 1 akun 1x pakai + penukaran peserta atomik terverifikasi.
- K-05 gate sertifikat otomatis — terverifikasi: terbit otomatis per modul + daftar backend (`GET /me/certificates`) + unduh PDF + sertifikat kursus otomatis gantikan modul (supersede); verifikasi publik + QR.
- K-06 rubrik + riwayat tugas backend — belum ada.
- K-07 modul independen — kode masih kunci antar-modul.
- K-08 versi materi + pengulangan selektif — belum ada.
