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
│   │   └── rate-limit.middleware.ts  # in-memory per IP (umum + khusus OTP auth)
│   ├── db/
│   │   ├── schema.ts           # Seluruh tabel Drizzle
│   │   ├── index.ts            # Pool MySQL + DATABASE_URL/DB_HOST… fallback
│   │   ├── migrate.ts          # Runner migrasi (drizzle-orm migrator)
│   │   └── seed.ts             # Data demo dev (JANGAN di production; abort bila users terisi)
│   ├── utils/
│   │   ├── response.ts         # Tipe envelope {status,message,data}
│   │   └── mailer.ts           # SMTP Nodemailer (atau mode log bila tanpa SMTP)
│   └── modules/
│       ├── auth/               # register (selalu student), verify-email, login, me,
│       │                       # forgot/verify-reset-code/reset-password, rate-limit OTP
│       ├── courses/            # kursus + kurikulum (modul/submodul/materi)
│       ├── progress/           # tandai/batalkan selesai, progres saya
│       ├── quiz/               # bank soal + percobaan (nilai terbaik di server)
│       ├── enrollments/        # enroll gratis + grant/revoke admin + audit
│       ├── submissions/        # kumpul tugas + nilai pengelola
│       ├── certificates/       # kelayakan, terbit idempoten, verify publik, cabut
│       ├── vouchers/           # buat/kelola admin + tukar atomik peserta
│       ├── admin/              # kelola user + penugasan instruktur
│       ├── invitations/        # undangan instruktur (token hash) + aktivasi
│       ├── applications/       # pengajuan instruktur publik (rate-limit)
│       ├── dashboard/          # ringkasan instruktur
│       ├── uploads/            # upload base64 + serve berkas (assignment privat)
│       └── payments/           # PLACEHOLDER — tanpa kode, lihat README di dalamnya
├── drizzle/                    # Migrasi 0000–0011 + meta/_journal.json
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
| `REFRESH_EXPIRES_DAYS` | tidak | default `30`; umur refresh token opaque sekali pakai (khusus klien mobile) |
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
npm test        # seluruh suite (DB tes terisolasi per file, dibuat+DROP otomatis)
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
