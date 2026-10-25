# Dokumentasi Setup Database Backend — Aristoteles

## 1. Teknologi

- Database: MySQL 8.4.3
- Local environment: Laragon
- Database client: HeidiSQL
- ORM: Drizzle ORM
- Migration toolkit: Drizzle Kit
- Backend: Node.js + Express + TypeScript

## 2. Konfigurasi Database Lokal

MySQL dijalankan melalui Laragon dengan konfigurasi berikut:

| Konfigurasi | Nilai |
|---|---|
| Host | `localhost` |
| Port | `3306` |
| Username | `root` |
| Database yang berhasil digunakan | `aristotle` |

Database lokal digunakan untuk pengembangan dan pengujian backend.

> Catatan: nama database yang berhasil digunakan pada tahap ini adalah `aristotle`. Pastikan nama tersebut konsisten dengan konfigurasi `.env` dan database yang digunakan anggota tim.

## 3. Environment Variables

File konfigurasi lokal berada di `backend/.env`.

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=aristotle
DATABASE_URL=mysql://root:@localhost:3306/aristotle
```

Sesuaikan nilai variabel dengan konfigurasi MySQL lokal masing-masing anggota tim. Jangan mengunggah file `.env` yang berisi kredensial atau rahasia ke repository.

## 4. Konfigurasi Drizzle

File konfigurasi Drizzle berada di `backend/drizzle.config.ts`.

Konfigurasi menggunakan:

- Schema: `./src/db/schema.ts`
- Output migrasi: `./drizzle`
- Dialect: MySQL
- Environment variables dimuat melalui `dotenv/config`.

Perintah Drizzle dijalankan dari direktori `backend` agar path schema dan output mengacu pada direktori yang benar.

## 5. Schema Database

Schema didefinisikan dalam `backend/src/db/schema.ts`.

Sebanyak 11 tabel telah diterapkan ke database lokal:

1. `users`
2. `instructor_invitations`
3. `courses`
4. `modules`
5. `materials`
6. `enrollments`
7. `quiz_attempts`
8. `submissions`
9. `progress`
10. `vouchers`
11. `certificates`

Relasi antartabel menggunakan foreign key. Tabel `enrollments` menggunakan primary key gabungan antara `user_id` dan `course_id`.

## 6. Pengecekan Schema

Jalankan dari direktori `backend`:

```bash
npx drizzle-kit check:mysql
```

Untuk menghasilkan file migrasi dari perubahan schema:

```bash
npx drizzle-kit generate:mysql
```

Perintah `generate:mysql` menghasilkan file SQL migrasi, sedangkan `push:mysql` menerapkan perubahan schema secara langsung ke database.

Sebelum menerapkan perubahan, periksa file SQL dan pastikan database target sudah benar. Jangan menjalankan perubahan destruktif tanpa persetujuan tim.

## 7. Status Implementasi

- [x] MySQL lokal tersedia melalui Laragon.
- [x] Konfigurasi Drizzle dapat membaca schema.
- [x] Pengecekan schema berhasil.
- [x] Sebelas tabel diterapkan ke database lokal.
- [x] Validasi akhir desain schema bersama ketua tim.
- [x] Pengujian koneksi database dari aplikasi backend.
- [x] Pengujian integrasi database pada fitur autentikasi.
- [x] Penyelarasan migrasi untuk seluruh anggota tim.

## 8. Catatan

File `.env` bersifat lokal dan tidak boleh di-commit. Dokumentasi ini mencatat kondisi pengembangan saat ini; perubahan schema selanjutnya harus dikoordinasikan agar konsisten dengan repository dan database anggota tim.

## Integrasi Database dan Autentikasi

### Database MySQL
Backend menggunakan MySQL dengan Drizzle ORM. Konfigurasi koneksi disimpan pada file `.env` lokal dan tidak boleh di-commit ke repository.

Database yang digunakan pada lingkungan pengembangan adalah `aristotle`. Struktur database terdiri dari 11 tabel sesuai schema pada `backend/src/db/schema.ts`.

### Registrasi
Endpoint: `POST /api/v1/auth/register`

Data yang diperlukan:
- `name`
- `email`
- `password`

Password di-hash sebelum disimpan ke database. Email yang sudah terdaftar ditolak dengan respons `400 Bad Request`. Jika berhasil, endpoint mengembalikan `201 Created` beserta data pengguna dan access token.

### Login
Endpoint: `POST /api/v1/auth/login`

Data yang diperlukan:
- `email`
- `password`

Backend memeriksa akun pada database dan memverifikasi password. Jika berhasil, endpoint mengembalikan `200 OK` beserta data pengguna dan access token. Kredensial yang salah menghasilkan `400 Bad Request`.

### Autentikasi Token
Endpoint yang membutuhkan autentikasi menerima token melalui header:

`Authorization: Bearer <accessToken>`

Middleware memverifikasi JWT, termasuk issuer dan audience. Token yang tidak ada, tidak valid, atau kedaluwarsa ditolak dengan `401 Unauthorized`.

### Pengujian
Pengujian manual menggunakan Thunder Client:
- `GET /health` — memastikan server aktif.
- `POST /api/v1/auth/register` — menguji registrasi pengguna.
- `POST /api/v1/auth/login` — menguji login dan penerbitan token.
- `GET /api/v1/auth/me` — menguji autentikasi token dan mengambil data pengguna.

Pengujian register, login, dan endpoint `/me` telah dilakukan pada lingkungan pengembangan.
