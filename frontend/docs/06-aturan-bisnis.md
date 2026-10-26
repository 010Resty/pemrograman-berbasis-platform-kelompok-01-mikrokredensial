# 06 — Aturan Bisnis ARISTOTELES (K-01–K-08)

> Pisahkan fakta kode dari aturan final. `[Terverifikasi]` = perilaku kode saat ini. `[Keputusan pengguna]` = aturan disepakati 2026-10-24. `[Belum diputuskan]` = butuh jawaban.

## Peran [Keputusan pengguna]

- Admin: buat/undang instruktur, buat/kelola voucher, terbit/cabut sertifikat, kelola data.
- Instruktur: kelola kurikulum + materi + ambang kuis + nilai tugas.
- Peserta: belajar, kerjakan kuis/tugas, tukar voucher, terima sertifikat bila syarat terpenuhi.

## K-01 Undangan instruktur [Keputusan pengguna]

- Hanya admin dapat membuat/mengundang instruktur fase awal. Tanpa pendaftaran bebas.
- Detail undangan, aktivasi, pengaturan password [Belum diputuskan].
- Gap [Terverifikasi]: `register/+page.svelte` masih izinkan peran `teacher` bebas → belum sesuai, jangan tandai selesai.

## K-02 Kuis [Keputusan pengguna]

- Tanpa batas percobaan. Acuan = nilai terbaik. Default 70, instruktur dapat ubah per kuis. Lulus bertahan walau coba berikut lebih rendah. Riwayat persisten di backend.
- Uji: coba 60 lalu 80 → lulus pakai 80; coba 90 lalu 50 → tetap lulus.
- Gap [Terverifikasi]: `quiz-results.svelte.ts` simpan terakhir saja, belum terbaik/riwayat. `DEFAULT_PASS_SCORE` + `normalizePassScore` di `quiz-drafts.ts` sudah sesuai untuk ambang per kuis.

## K-03 Voucher [Keputusan pengguna]

- Resmi, hanya admin buat/kelola, 1 voucher = 1 akun + 1 kursus, tukar kode oleh peserta, validasi 4 cocok (akun, kursus, kode, status) di backend, 1x pakai, status `Aktif/Digunakan/Dinonaktifkan`, tetap tersedia sampai dipakai/dinonaktifkan, catat penerima+kursus+waktu+status, anti-race tanpa akses ganda. Masa berlaku opsional.
- Gap [Terverifikasi]: `VALID_CODES` + `ownedCourses` lokal belum validasi apa pun.

## K-04 Materi [Keputusan pengguna + perilaku saat ini sesuai]

- Perilaku [Terverifikasi]: navigasi Berikutnya memanggil `markDone` di `user/kursusku/.../+page.svelte`; kuis via `onPass`, tugas via `onSubmit`.
- Aturan: materi biasa selesai via Berikutnya, tanpa tombol terpisah. Berikutnya tidak meluluskan kuis/tugas.

## K-05 Sertifikat modul [Keputusan pengguna]

- Otomatis hanya bila semua materi wajib selesai + kuis wajib lulus + tugas wajib penuhi syarat. Per modul 1 sertifikat. Identitas/tanggal/verifikasi/pencabutan sebagai kebutuhan sistem.
- Gap [Terverifikasi]: UI sertifikat statis, belum gate `isModuleComplete` di `certificates.ts`.

## K-06 Tugas [Keputusan pengguna]

- Kumpul ulang tanpa batas sampai lulus. Belum lulus = belum penuhi sertifikat. Nilai pakai rubrik. Simpan riwayat berkas+waktu+nilai+feedback+status di backend.
- Rubrik seragam atau beda per tugas [Belum diputuskan].
- Perilaku [Terverifikasi]: `AssignmentMaterial.svelte` izinkan `revising` tanpa batas — sebagian sesuai.

## K-07 Modul independen [Keputusan pengguna]

- Setelah punya akses kursus, bisa mulai modul mana saja. Tiap modul sertifikat sendiri. Kunci berurutan hanya untuk sub/materi sekuensial.
- Gap [Terverifikasi]: `isModuleLocked` di `courses.ts` masih kunci antar-modul → bertentangan, perlu ubah frontend + backend.

## K-08 Perubahan materi [Keputusan pengguna]

- Tidak hapus progres otomatis. Ulang sengaja untuk materi terdampak saja bila perubahan penting. Catat perubahan + terdampak + alasan + status.
- Definisi penting + kewenangan [Belum diputuskan].
- Gap [Terverifikasi]: `curriculum.ts` tanpa versi/log.
