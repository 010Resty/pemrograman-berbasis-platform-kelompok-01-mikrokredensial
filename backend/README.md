# ARISTOTELES Backend

Backend untuk platform mikrokredensial **ARISTOTELES** dibangun dengan arsitektur **Feature-Based** menggunakan Node.js, Express.js, TypeScript, Drizzle ORM, dan MySQL.

---

## 📁 Struktur Folder

```
backend/
├── src/
│   ├── modules/           # Feature modules (Feature-Based Architecture)
│   │   ├── auth/          # Autentikasi & otorisasi
│   │   ├── users/         # Manajemen pengguna
│   │   ├── courses/       # Manajemen kursus
│   │   ├── course-modules/# Modul dalam kursus
│   │   ├── lessons/       # Materi pembelajaran
│   │   ├── enrollments/   # Pendaftaran kursus
│   │   ├── assessments/   # Penilaian & kuis
│   │   ├── certificates/  # Sertifikat kelulusan
│   │   ├── payments/      # Pembayaran & transaksi
│   │   ├── coupons/       # Kupon diskon
│   │   └── admin/         # Panel admin & manajemen sistem
│   ├── middlewares/       # Middleware global Express
│   ├── config/            # Konfigurasi terpusat
│   ├── db/                # Database connection & schema
│   ├── utils/             # Helper functions reusable
│   ├── app.ts             # Inisialisasi Express app
│   └── server.ts          # Entry point server
├── drizzle/               # Output migrasi Drizzle ORM
├── .env.example           # Template environment variables
├── .gitignore             # File yang diabaikan Git
├── package.json           # Dependencies & scripts
├── tsconfig.json          # Konfigurasi TypeScript
└── drizzle.config.ts      # Konfigurasi Drizzle Kit
```

---

## 📦 Penjelasan Setiap Folder `src/modules/`

Setiap folder di `src/modules/` mewakili **satu fitur bisnis utuh** yang berdiri sendiri (self-contained). Di dalamnya nantinya berisi:

| Folder | Tanggung Jawab |
|--------|----------------|
| **`auth/`** | Login, register, logout, refresh token, reset password, verifikasi email, OAuth (Google/GitHub), JWT access & refresh token management, role-based access control (RBAC). |
| **`users/`** | CRUD profil user, upload avatar, update password, preferensi notifikasi, riwayat aktivitas, soft delete, export data (GDPR). |
| **`courses/`** | CRUD kursus (judul, deskripsi, thumbnail, harga, kategori, level, status publish/draft), pencarian & filter, rating & review, kursus populer/terbaru. |
| **`course-modules/`** | Pembagian kursus ke modul-modul pembelajaran (bab/bagian), urutan modul, prasyarat modul, estimasi waktu. |
| **`lessons/`** | Konten pembelajaran per modul: video, dokumen (PDF), teks, embed (YouTube/Vimeo), quiz interaktif, progress tracking, bookmark, catatan pribadi. |
| **`enrollments/`** | Pendaftaran user ke kursus (gratis/berbayar), status enrollment (active, completed, expired, cancelled), progress kursus, certificate eligibility, batch enrollment. |
| **`assessments/`** | Kuis, tugas, ujian akhir: soal (multiple choice, essay, file upload), timer, passing grade, randomisasi soal, anti-cheat, auto/manual grading, feedback. |
| **`certificates/`** | Generate sertifikat (PDF), template sertifikat, verifikasi keaslian (public verify page), QR code, nomor unik, download/kirim email, blockchain anchor (opsional). |
| **`payments/`** | Integrasi payment gateway (Midtrans/Xendit/Stripe), invoice, checkout, webhook handler, refund, riwayat transaksi, metoda pembayaran (VA, e-wallet, CC), subscription (opsional). |
| **`coupons/`** | CRUD kupon (kode, diskon persen/nominal, masa berlaku, kuota, minimal belanja, kursus tertentu), validasi saat checkout, usage tracking, auto-expire. |
| **`admin/`** | Dashboard admin: statistik user/kursus/pendapatan, manajemen user (ban/unban, role), manajemen kursus (approve/reject), manajemen pembayaran, audit log, export laporan (CSV/Excel/PDF). |

---

## 🛠 Folder Pendukung

| Folder | Isi |
|--------|-----|
| **`src/middlewares/`** | `errorHandler.ts`, `authGuard.ts`, `roleGuard.ts`, `validation.ts`, `rateLimiter.ts`, `requestLogger.ts`, `corsHandler.ts`, `notFound.ts`. |
| **`src/config/`** | `env.ts` (validasi env dengan Zod), `database.ts`, `redis.ts`, `jwt.ts`, `email.ts`, `storage.ts`, `midtrans.ts`, `constants.ts`. |
| **`src/db/`** | `index.ts` (koneksi Drizzle), `schema/` (table definitions per fitur), `migrations/` (auto-generated), `seed.ts` (data dummy), `repository/` (base repository pattern). |
| **`src/utils/`** | `response.ts` (standard API response), `pagination.ts`, `date.ts`, `crypto.ts` (hash, generate token), `file.ts` (upload, delete), `validation.ts` (Zod helpers), `error.ts` (custom error classes). |

---

## 🚀 Memulai

### 1. Install Dependencies
```bash
npm install
```

### 2. Setup Environment
```bash
cp .env.example .env
# Edit .env dengan kredensial database & JWT secret Anda
```

### 3. Database Setup
```bash
# Generate migrasi dari schema
npm run db:generate

# Jalankan migrasi
npm run db:migrate

# Atau push schema langsung (development)
npm run db:push

# Buka Drizzle Studio
npm run db:studio
```

### 4. Jalankan Development Server
```bash
npm run dev
```
Server berjalan di `http://localhost:3000` (health check: `/health`)

### 5. Build Production
```bash
npm run build
npm start
```

---

## 📋 Scripts Tersedia

| Script | Deskripsi |
|--------|-----------|
| `npm run dev` | Jalankan server development dengan hot reload (tsx watch) |
| `npm run build` | Compile TypeScript ke `dist/` |
| `npm start` | Jalankan server production dari `dist/` |
| `npm run db:generate` | Generate file migrasi dari schema Drizzle |
| `npm run db:migrate` | Jalankan migrasi ke database |
| `npm run db:push` | Push schema langsung ke DB (tanpa file migrasi) |
| `npm run db:studio` | Buka Drizzle Studio (GUI database) |

---

## 🔧 Tech Stack

| Kategori | Teknologi |
|----------|-----------|
| Runtime | Node.js 20+ |
| Framework | Express.js 4.18+ |
| Language | TypeScript 5.3+ |
| ORM | Drizzle ORM 0.29+ |
| Database | MySQL 8.0+ |
| Validation | Zod 3.22+ |
| Auth | JWT (jsonwebtoken), bcryptjs |
| Security | Helmet, CORS, Rate Limiter |
| Logging | Morgan |
| Dev Tools | tsx, TypeScript, Drizzle Kit |

---

## 📝 Konvensi Kode

- **Feature-Based**: Semua kode fitur berada di `src/modules/<feature>/`
- **Path Aliases**: Gunakan `@modules/auth`, `@config`, `@db`, `@utils`, `@middlewares`
- **Schema**: Satu file per tabel di `src/db/schema/<feature>.ts`
- **Repository Pattern**: Base repository di `src/db/repository/`, extend per fitur
- **Response Format**: Selalu gunakan `src/utils/response.ts` (success/error/pagination)
- **Error Handling**: Custom error classes di `src/utils/error.ts`, ditangani global di middleware

---

## 🌿 Git Workflow

1. Branch dari `main`: `feature/<nama-fit>`, `fix/<bug>`, `refactor/<area>`
2. Commit message mengikuti [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat: tambah login dengan Google OAuth`
   - `fix: handle null pointer di certificate generator`
   - `refactor: ekstrak base repository class`
3. PR ke `main` dengan review minimal 1 reviewer
4. Squash & merge

---

## 📄 License

MIT License - lihat file [LICENSE](../LICENSE) untuk detail.