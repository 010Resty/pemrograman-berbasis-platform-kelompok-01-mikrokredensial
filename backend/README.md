# ARISTOTELES Backend

Backend platform mikrokredensial **ARISTOTELES**: Express + TypeScript +
Drizzle ORM + MySQL. Prefix API: `/api/v1`. Auth JWT via header
`Authorization: Bearer <token>`. Kontrak endpoint: `docs/API_CONTRACT.md`.

## Struktur aktual

```
backend/
├── src/
│   ├── app.ts                  # Mount router + middleware + error handler
│   ├── server.ts               # Entry point
│   ├── middlewares/
│   │   └── auth.middleware.ts  # authenticate, requireRole, optionalAuthenticate
│   ├── db/
│   │   ├── schema.ts            # Seluruh tabel Drizzle
│   │   ├── index.ts            # Pool MySQL + DATABASE_URL/DB_HOST… fallback
│   │   ├── migrate.ts          # Runner migrasi (drizzle-orm migrator)
│   │   └── seed.ts             # Data demo dev (JANGAN di production)
│   ├── utils/
│   │   └── response.ts         # Tipe envelope {status,message,data}
│   └── modules/
│       ├── auth/               # register, login, me (role register dikunci student)
│       ├── courses/            # kursus + kurikulum (modul/submodul/materi)
│       ├── progress/           # tandai/batalkan selesai, progres saya
│       ├── quiz/               # bank soal + percobaan (nilai di server)
│       ├── enrollments/        # enroll gratis + grant/revoke admin + audit
│       ├── submissions/        # kumpul tugas + nilai pengelola
│       ├── certificates/       # kelayakan, terbit idempoten, verify publik, cabut
│       ├── vouchers/           # buat/kelola admin + tukar atomik peserta
│       ├── admin/              # kelola user + penugasan instruktur
│       ├── invitations/        # undangan instruktur (token hash) + aktivasi
│       └── uploads/            # upload base64 + serve berkas (assignment privat)
├── drizzle/                    # Migrasi 0000–0007 + meta/_journal.json
├── docs/
│   └── API_CONTRACT.md         # Kontrak endpoint dari kode aktual
├── .env.example
└── package.json
```

> Catatan: direktori kosong `assessments/`, `coupons/`, `course-modules/`,
> `lessons/`, `payments/`, `users/` adalah scaffold tak terpakai — tidak
> di-mount di `app.ts` dan tidak tercakup kontrak.

## Setup environment

```bash
cp .env.example .env   # lalu isi nilai berikut
```

| Variabel | Wajib | Keterangan |
|---|---|---|
| `NODE_ENV`, `PORT`, `APP_URL` | tidak | default development/3000 |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | ya (salah satu) | atau satu `DATABASE_URL=mysql://…` (diprioritaskan) |
| `JWT_SECRET` | ya | ≥32 karakter acak; server menolak start tanpa ini |
| `JWT_EXPIRES_IN` | tidak | default `15m` |
| `CORS_ORIGIN` | tidak | default `http://localhost:5173` |
| `SEED_DEMO_PASSWORD` | tidak | hanya untuk `db:seed` (dev) |

## Migrasi & seed

```bash
npm run db:generate   # buat migrasi baru dari schema (jangan edit 0000–0007)
npm run db:migrate    # terapkan ke DB sesuai .env
npm run db:seed       # DEV SAJA; abort bila tabel users sudah berisi data
```

## Menjalankan server & pengujian

```bash
npm run dev     # tsx watch src/server.ts
npm run build   # tsc → dist/
npm start       # node dist/server.js
npm test        # seluruh suite integrasi (DB test terisolasi, dibuat+DROP otomatis)
```

Setiap file `src/modules/*/__tests__/*.test.ts` memakai `test-env.ts`
(`process.env.DB_NAME = "aristoteles_test_*"` sebelum import DB) ditambah
`CREATE/DROP DATABASE` di hook `before/after` — **tidak pernah menyentuh
database live**. Pola yang sama wajib dipakai untuk skrip ad-hoc yang menulis
DB (set `DB_NAME` sebelum import modul DB, verifikasi `SELECT DATABASE()`).

## Aturan keamanan ringkas

- Identitas selalu dari JWT; skor/nilai/kelulusan tidak pernah dari klien.
- Kunci kuis tidak keluar ke peserta; berkas assignment hanya untuk
  pemilik/pengampu terkait/admin.
- Tulis sensitif (grant, nilai, terbit/cabut sertifikat, voucher, user,
  undangan) dicatat di `audit_logs` dalam transaksi yang sama.
