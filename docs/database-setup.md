# Dokumentasi Setup Database Backend — Aristoteles

> Diperbarui 2026-11-24. Kondisi awal (MySQL 8.4.3 via Laragon, DB `aristotle`) tetap berlaku; skema kini ~30 tabel + migrasi s/d `0035`.

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
| Database pengembangan | `aristotle` |
| Database tes (dibuat+DROP otomatis oleh suite) | `aristoteles_test_*` (satu per file tes) |

> Catatan: nama database dev yang dipakai adalah `aristotle`. Pastikan konsisten dengan `.env` dan database anggota tim.

## 3. Environment Variables

File konfigurasi lokal berada di `backend/.env` (contoh: `backend/.env.example`).

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=aristotle
# atau satu DATABASE_URL=mysql://root:@localhost:3306/aristotle (diprioritaskan)
JWT_SECRET=<min. 32 karakter acak — server menolak start tanpanya>
```

Sesuaikan nilai dengan MySQL lokal masing-masing anggota tim. Jangan mengunggah file `.env` yang berisi kredensial atau rahasia ke repository.

## 4. Konfigurasi Drizzle

File konfigurasi Drizzle berada di `backend/drizzle.config.ts` (schema `./src/db/schema.ts`, output `./drizzle`, dialect MySQL). Perintah dijalankan dari direktori `backend`.

## 5. Schema Database (ringkas)

Schema didefinisikan dalam `backend/src/db/schema.ts` (~30 tabel; relasi via foreign key):

- Identitas & akses: `users`, `refresh_tokens`, `email_verification_pending`, `password_reset_otps`, `instructor_invitations`, `instructor_applications`.
- Katalog & kurikulum: `courses`, `course_categories`, `course_instructors`, `modules`, `sub_modules`, `materials`, `files`, `file_variants`.
- Belajar: `enrollments` (PK gabungan `user_id` + `course_id`), `progress` (PK `user_id` + `material_id`), `quiz_questions`, `quiz_options`, `quiz_attempts`, `submissions`.
- Niaga: `vouchers`, `voucher_redemptions`, `payments`, `promo_campaigns`, `promo_courses`, `promo_course_proposals`, `patungan_groups`, `patungan_group_members`, `revenue_settings`, `revenue_ledger`, `payouts`.
- Hasil & audit: `certificates`, `audit_logs`.
- Migrasi `0035` menambah 15 indeks komposit (laporan, eligibility, antrean, voucher, pembayaran).

## 6. Migrasi

Dari direktori `backend`:

```bash
npm run db:generate   # buat file migrasi baru dari schema (jangan edit migrasi lama)
npm run db:migrate     # terapkan ke DB sesuai .env (kini s/d 0035)
npm run db:seed        # DEV SAJA; abort bila tabel users sudah berisi data
```

Periksa file SQL sebelum menerapkan; jangan menjalankan perubahan destruktif tanpa persetujuan tim. Tes backend (`npm test`, 241 hijau) membuat+DROP database `aristoteles_test_*` sendiri — tidak menyentuh DB dev.

## 7. Status Implementasi

- [x] MySQL lokal tersedia melalui Laragon.
- [x] Schema + 15 indeks komposit (migrasi 0035) diterapkan.
- [x] Auth penuh: register OTP → verifikasi → login → refresh rotasi → logout (`aristoteles_test_auth` hijau).
- [x] Pengujian integrasi seluruh modul: `npm test` 241/241 hijau.
- [x] Penyelarasan migrasi untuk seluruh anggota tim (journal `drizzle/meta/_journal.json` — jangan edit manual).

## 8. Catatan

File `.env` bersifat lokal dan tidak boleh di-commit. Dokumentasi ini mencatat kondisi pengembangan saat ini; perubahan schema selanjutnya harus dikoordinasikan agar konsisten dengan repository dan database anggota tim.

## Autentikasi (kondisi kini — menggantikan catatan lama)

- Register: `POST /api/v1/auth/register` `{name, username, email, password}` → 201 + OTP ke email (akun BELUM dibuat; peran selalu `student`).
- Verifikasi: `POST /api/v1/auth/verify-email` `{email, code}` → 201 + `{accessToken (15 mnt), refreshToken, user}`.
- Login: `POST /api/v1/auth/login` → 200 + pasangan token; kredensial salah = generik 400; nonaktif = 403.
- Refresh: `POST /api/v1/auth/refresh` (rotasi sekali pakai + grace window); Logout: `POST /api/v1/auth/logout`.
- Endpoint privat memakai header `Authorization: Bearer <accessToken>`.
- Manual: `GET /health` (server aktif, tanpa auth).
