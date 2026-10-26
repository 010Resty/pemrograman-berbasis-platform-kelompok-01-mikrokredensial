# 05 — Kebutuhan Backend ARISTOTELES

> Semua di bawah `[Usulan]` kecuali disebut `[Terverifikasi]` atau `[Keputusan pengguna]`. Jangan baca sebagai endpoint/tabel final.

## Auth dan peran (K-01) [Keputusan pengguna: hanya admin buat/undang instruktur]

- Ada [Terverifikasi]: `loadSession/login/register/loginWithUnita` lokal di `auth.svelte.ts`.
- Simulasi: password demo, sesi tanpa expiry, `teacher` bebas daftar.
- Data perlu disimpan [Usulan]: pengguna, peran, undangan, status aktivasi, sesi.
- Operasi kemungkinan [Usulan]: buat/undang instruktur oleh admin, aktivasi + atur password, masuk/keluar, cek peran di server.
- Tergantung: semua guard portal + kepemilikan.
- Belum diputuskan: detail undangan, aktivasi, pengaturan password.

## Kuis dan riwayat (K-02) [Keputusan pengguna: tanpa batas, nilai terbaik, default 70 bisa diubah, lulus bertahan, riwayat persisten]

- Ada [Terverifikasi]: `QuizBuilder`, `quiz-drafts.ts`, `QuizMaterial`, `hasil/+page.svelte`.
- Simulasi: hasil terakhir saja di `quiz-results.svelte.ts`, tanpa terbaik/riwayat.
- Data [Usulan]: tiap percobaan + skor, terbaik per user+kuis, ambang per kuis.
- Operasi [Usulan]: simpan percobaan, hitung terbaik di server, validasi lulus di server.
- Tergantung: progres, sertifikat.

## Voucher (K-03) [Keputusan pengguna: resmi, admin saja, 1 akun + 1 kursus, 1x pakai, validasi 4 cocok, status Aktif/Digunakan/Dinonaktifkan, anti-race]

- Ada [Terverifikasi]: `VALID_CODES` di `kursusku/+page.svelte`, `ownedCourses` + `receipts` lokal.
- Simulasi: tanpa validasi akun/kursus/status/pakai ulang.
- Data [Usulan]: penerima, kursus, kode, status, waktu tukar.
- Operasi [Usulan]: buat/kelola admin, tukar atomik, tolak ganda walau request bersamaan.
- Tergantung: akses kursus. Masa berlaku opsional [Keputusan pengguna].

## Progres (K-04, K-07, K-08)

- Ada [Terverifikasi]: `progress.svelte.ts` memori, `training.ts` persen, `markDone` navigasi.
- Simulasi: hilang refresh.
- Data [Usulan]: status selesai per user+materi persisten.
- Operasi [Usulan]: tandai/baca progres, resume.
- K-04 [Keputusan pengguna] pertahankan perilaku Berikutnya = selesai materi biasa.

## Tugas (K-06) [Keputusan pengguna: kumpul ulang tanpa batas sampai lulus, belum lulus belum penuhi sertifikat, nilai rubrik, riwayat backend]

- Ada [Terverifikasi]: `AssignmentMaterial`, `submission.service.ts`, proxy upload/grade.
- Simulasi: `studentName/NIM` kosong, nilai fallback lokal, mock Drive.
- Data [Usulan]: berkas + waktu + nilai + feedback + status per pengumpulan.
- Operasi [Usulan]: upload validasi server, list per tugas, nilai 0–100 + feedback.
- Rubrik seragam atau beda [Belum diputuskan].

## Sertifikat (K-05) [Keputusan pengguna: otomatis bila semua wajib selesai/lulus]

- Ada [Terverifikasi]: helper `certificates.ts`, UI statis.
- Simulasi: tidak gate otomatis.
- Data [Usulan]: penerbitan per user+modul, identitas, tanggal, status verifikasi/cabut.
- Operasi [Usulan]: terbit idempoten, verifikasi publik, unduh, cabut.
- Tergantung: progres + penilaian.

## Materi berubah (K-08) [Keputusan pengguna: tidak hapus progres otomatis, ulang sengaja terdampak saja, catat perubahan]

- Ada [Terverifikasi]: `curriculum.ts` draf lokal tanpa versi.
- Data [Usulan]: perubahan + terdampak + alasan + status ulang.
- Definisi penting + kewenangan [Belum diputuskan].

## Admin + audit

- Ada [Terverifikasi]: tabel lokal + `flash()` palsu.
- Operasi [Usulan]: CRUD server + nonaktif + reset + audit log operasi admin.
