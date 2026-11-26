# ARISTOTELES Backend

Backend platform mikrokredensial **ARISTOTELES**: Express + TypeScript + Drizzle ORM +
MySQL. Prefix API: `/api/v1`. Auth JWT via header `Authorization: Bearer <token>`.
Kontrak endpoint: `docs/API_CONTRACT.md`.

## Struktur aktual

```
backend/
├── src/
│   ├── app.ts                  # Mount router + middleware + error handler
│   ├── server.ts               # Entry point
│   ├── middlewares/
│   │   ├── auth.middleware.ts  # authenticate, requireRole, optionalAuthenticate
│   │   └── rate-limit.middleware.ts  # in-memory per IP (umum + khusus OTP auth; multi-instance butuh Redis)
│   ├── db/
│   │   ├── schema.ts           # ~30 tabel Drizzle + 40+ indeks (termasuk 15 indeks komposit migrasi 0035)
│   │   ├── index.ts            # Pool MySQL + DATABASE_URL/DB_HOST… fallback
│   │   ├── migrate.ts          # Runner migrasi (drizzle-orm migrator)
│   │   └── seed.ts             # Data demo dev (JANGAN di production; abort bila users terisi)
│   ├── utils/
│   │   ├── response.ts         # Tipe envelope {status,message,data}
│   │   └── mailer.ts           # SMTP Nodemailer (atau mode log bila tanpa SMTP)
│   └── modules/
│       ├── auth/               # register (selalu student), verify-email, login,
│       │                       # forgot/verify-reset-code/reset-password, refresh rotasi + grace, logout, me
│       ├── profile/            # profil milik sendiri (baca/ubah/hapus avatar)
│       ├── courses/            # kursus + kurikulum (modul/submodul/materi, versi K-08 + riwayat)
│       ├── categories/         # kategori kursus (publik + kelola admin)
│       ├── progress/           # tandai/batalkan selesai, progres saya + ringkasan
│       ├── quiz/               # bank soal + percobaan (nilai terbaik di server, agregat SQL)
│       ├── enrollments/        # enroll gratis + grant/revoke admin + audit
│       ├── submissions/        # kumpul tugas + nilai pengelola + antrean review (filter ?courseId=)
│       ├── certificates/       # kelayakan, terbit idempoten, verify publik, unduh PDF, cabut (eligibility batch)
│       ├── vouchers/           # buat/kelola admin + tukar atomik peserta + statistik 1-query (/stats)
│       ├── admin/              # kelola user + penugasan instruktur + laporan (agregat scoped per halaman)
│       ├── invitations/        # undangan instruktur (token hash) + aktivasi + terbit ulang
│       ├── applications/       # pengajuan instruktur publik (rate-limit) + tinjauan admin
│       ├── dashboard/          # ringkasan instruktur (+ helper statistik scoped untuk laporan)
│       ├── uploads/            # upload base64 + serve berkas (assignment privat, varian ?w=)
│       ├── payments/           # QRIS dinamis DOKU (gateway) + manual lawas, lihat README di dalamnya
│       ├── promos/             # promo diskon/kurasi/patungan + usulan instruktur
│       ├── patungan/           # grup iuran patungan (lunas-semua baru grant)
│       └── revenues/           # bagi hasil instruktur (snapshot per bayar) + payout
├── drizzle/                    # Migrasi 0000–0035 + meta/_journal.json
├── docs/
│   └── API_CONTRACT.md         # Kontrak endpoint dari kode aktual
├── uploads/                    # Byte berkas (nama UUID); metadata di tabel files
├── .env.example
└── package.json
```

## Setup environment

```bash
cp .env.example .env   # lalu isi nilai berikut
```

| Variabel | Wajib | Keterangan |
|---|---|---|
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | ya (salah satu) | atau satu `DATABASE_URL=mysql://…` (diprioritaskan) |
| `JWT_SECRET` | ya | ≥32 karakter acak; server menolak start tanpa ini |
| `JWT_EXPIRES_IN` | tidak | default `15m` (access token pendek, untuk web + mobile) |
| `REFRESH_EXPIRES_DAYS` | tidak | default `30`; umur refresh token opaque sekali pakai (web + mobile) |
| `IMAGE_QUALITY_<KIND>`, `IMAGE_QUALITY_<KIND>_ALPHA`, `IMAGE_MAX_SIDE_PIXELS` | tidak | override kualitas WebP per kind (1–100) dan batas sisi px anti decompression-bomb (default 8000) |
| `REFRESH_REUSE_GRACE_MS` | tidak | default `60000`; jendela pakai-ulang refresh token yang masih diputar dari penerus (anti-nuke saat web + aplikasi refresh bersamaan) |
| `CORS_ORIGIN` | tidak | default `http://localhost:5173` |
| `FRONTEND_URL` | ya (production) | basis tautan undangan di email; server production menolak start bila kosong |
| `SEED_DEMO_PASSWORD` | tidak | hanya untuk `db:seed` (dev) |
| `MAIL_PROVIDER`, `SMTP_HOST/PORT/USER/PASS/SECURE`, `MAIL_FROM` | tidak | tanpa SMTP → mode `log` (OTP/undangan hanya ke konsol, untuk dev) |
| `OTP_EXPIRES_MIN`, `OTP_RESEND_COOLDOWN_SEC`, `OTP_MAX_ATTEMPTS` | tidak | default `10`, `60`, `5` |
| `AUTH_OTP_RATE_LIMIT_MAX/WINDOW_MS`, `SUBMIT_RATE_LIMIT_MAX/WINDOW_MS` | tidak | batas per IP (default 30 dan 10 per 15 menit) |

## Migrasi & seed

```bash
npm run db:generate   # buat migrasi baru dari schema (jangan edit 0000–0011)
npm run db:migrate    # terapkan ke DB sesuai .env
npm run db:seed       # DEV SAJA; abort bila tabel users sudah berisi data
```

## Menjalankan server & pengujian

```bash
npm run dev     # tsx watch src/server.ts (http://localhost:3000)
npm run build   # tsc → dist/
npm start       # node dist/server.js
npm test        # seluruh suite (241 tes hijau; DB tes terisolasi per file, dibuat+DROP otomatis)
npm run mail:check  # kirim email tes (butuh SMTP)
```

Catatan: `uploads/` dipakai bersama tes integrasi — file dummy 42-byte berekstensi
`.pdf` di dalamnya adalah sisa upload dari tes (nama UUID acak), bukan data pengguna.

## Kebijakan keamanan ringkas

- Identitas selalu dari JWT (`authenticate`); peran via `requireRole`; skor/nilai/
  kelulusan dihitung server, tidak pernah dari klien.
- OTP: 6 digit, hash SHA-256 di DB, kedaluwarsa 10 menit, cooldown kirim ulang 60 detik,
  maks 5x salah (baris OTP dihapus) — berlaku untuk verifikasi email dan reset password.
- Endpoint reset password (`forgot-password`, `verify-reset-code`, `reset-password`)
  dibatasi 30x per 15 menit per IP; pengajuan publik 10x per 15 menit per IP.
- Kunci kuis tidak keluar ke peserta; berkas assignment hanya untuk
  pemilik/pengampu terkait/admin.
- Tulis sensitif (grant, nilai, terbit/cabut sertifikat, voucher, user,
  undangan) dicatat di `audit_logs` dalam transaksi yang sama.
