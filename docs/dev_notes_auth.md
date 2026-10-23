# Development Notes — Backend ARISTOTELES

## 1. Tujuan Pengerjaan

Menyiapkan fondasi autentikasi backend menggunakan TypeScript dan Express, serta menguji middleware JWT tanpa memerlukan koneksi database. Implementasi registrasi dan login menunggu persetujuan skema database dari ketua kelompok.

## 2. Pekerjaan yang Dilakukan

- Menyiapkan modul autentikasi: `auth.routes.ts`, `auth.controller.ts`, dan `auth.service.ts`.
- Membuat `auth.middleware.ts` untuk memverifikasi JWT.
- Menambahkan endpoint registrasi dan login pada `/api/v1/auth`.
- Menambahkan validasi input menggunakan Zod.
- Menyiapkan fungsi hash dan verifikasi password menggunakan bcrypt.
- Menambahkan penanganan khusus untuk fitur autentikasi yang belum diimplementasikan.
- Menghapus endpoint sementara `/api/v1/auth-test` setelah pengujian middleware.

## 3. Hasil Pengujian

| Pengujian | Hasil |
|---|---|
| GET `/health` | HTTP 200 OK |
| Request tanpa token | HTTP 401 Unauthorized |
| Request dengan token tidak valid | HTTP 401 Unauthorized |
| Request dengan JWT valid | HTTP 200 OK |
| `npm run build` | Berhasil |

Pengujian JWT dilakukan menggunakan token khusus untuk pengujian, tanpa mengakses database.

## 4. Kondisi Saat Ini

- Middleware JWT berhasil diuji untuk token kosong, token tidak valid, dan token valid.
- Registrasi dan login belum terhubung ke penyimpanan akun.
- Skema database masih menunggu peninjauan ketua kelompok.
- Error validasi Zod masih perlu dipetakan ke respons HTTP 400.
- Perubahan Git belum melalui pemeriksaan akhir untuk commit dan Pull Request.

## 5. Rencana Berikutnya

1. Memeriksa status dan perubahan Git.
2. Memastikan `.env` dan secret tidak ikut masuk commit.
3. Meninjau kesesuaian struktur kode dengan standar kelompok.
4. Memperbaiki kekurangan yang disepakati sebelum PR.
5. Membuat commit dan Pull Request untuk ditinjau ketua kelompok.

## 6. Catatan

Registrasi dan login sengaja belum diaktifkan karena integrasi database dan skema akun masih menunggu persetujuan kelompok. Implementasi autentikasi belum dianggap selesai sepenuhnya.
