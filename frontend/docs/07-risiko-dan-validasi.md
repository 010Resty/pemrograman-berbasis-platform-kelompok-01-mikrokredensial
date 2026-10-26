# 07 — Risiko dan Validasi ARISTOTELES

> `[Terverifikasi]` bukti kode, `[Keputusan pengguna]` acuan K-01–K-08, `[Rekomendasi]` usulan. Cara cek untuk pemula.

## Risiko keamanan [Terverifikasi]

- Sesi bisa dipalsukan: `SESSION_KEY` + guard `goto()` di `*/+layout.svelte`. Cek: edit `localStorage aristoteles-session` jadi `{"role":"admin"}` → buka `/admin`. Perlu backend [Rekomendasi: cookie HttpOnly + cek server].
- API tanpa auth: `api/assignments/upload/+server.ts`, `grade/[id]/+server.ts` teruskan tanpa cek peran. Cek: POST langsung tanpa login.
- Bayar bypass: `purchaseCourse` di `enrollment.svelte.ts` tambah set lokal. Cek: isi `owned-courses` manual.
- XSS `{@html}`: `MaterialPreview.svelte`, `briefHtml` penilaian/materi dari Tiptap tanpa sanitasi terlihat. [Rekomendasi: DOMPurify + CSP].

## Skenario uji K-01–K-08

- Kuis beda nilai: 60→80 lulus pakai 80; 90→50 tetap lulus. Kode kini overwrite → harus gagal sebelum backend terbaik.
- Voucher akun salah / kursus salah / sudah dipakai / dinonaktifkan / 2 request bersamaan → semua tolak, 1 akses saja. Kode kini lokal → harus gagal.
- Sertifikat 1 syarat kurang → belum terbit. Kode statis → harus gagal.
- Resubmit tugas sampai lulus → boleh tanpa batas. Kode revisi boleh [Terverifikasi sebagian].
- Refresh/navigasi → progres bertahan. Kode memori hilang → harus gagal.
- Ubah ringan → tanpa ulang; ubah penting → ulang terdampak saja. Kode tanpa versi → harus gagal.
- K-04 Berikutnya = selesai materi biasa, tidak meluluskan kuis/tugas. Kode sesuai → harus lolos.
- K-07 mulai modul mana saja. Kode masih kunci → harus gagal sampai diperbaiki.
