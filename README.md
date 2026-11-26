# JUDUL PROJECT
## Aristoteles (Artificial Intelligence Research, Innovation, Science, Technology, and Engineering Laboratory for Education and Systems)

# ANGGOTA
1. Rayyan (2024520047)
2. Ahmad Farizi (2024520011)
3. Mohammad Khoirun Nizam (2024520069)
4. Resty Amylia Margareta (2024520010)

# PEMBAGIAN PERAN

# TENTANG APLIKASI

ARISTOTELES adalah platform pembelajaran mikrokredensial: katalog pelatihan publik,
portal belajar peserta, pengelolaan kursus instruktur, dan administrasi (pengguna,
instruktur, kursus, voucher, undangan, sertifikat, pembayaran, promo/patungan,
bagi hasil). Aturan bisnis K-01–K-08 disepakati 2026-10-24 (diperbarui 2026-11-02);
status implementasi per fitur lihat
`frontend/web/docs/04-inventaris-fitur.md` — keputusan bukan bukti sudah selesai di kode.

# STRUKTUR REPO

| Direktori | Isi |
|---|---|
| `frontend/web/` | SvelteKit 2 + Svelte 5 + TypeScript + Tailwind CSS 4 (aplikasi web). Lihat `frontend/web/README.md`. |
| `frontend/shared/` | Kontrak API + skenario uji K-01–K-08 dipakai bersama web + Android. Lihat `frontend/shared/README.md`. |
| `frontend/android/` | (berikutnya, Tahap 3+ multi-platform) Aplikasi Flutter, login-first tanpa landing page. |
| `backend/` | Express + TypeScript + Drizzle ORM + MySQL, prefix API `/api/v1`. Lihat `backend/README.md`. |
| `frontend/web/docs/` | Dokumentasi proyek: ringkasan (`01`), rute (`02`), arsitektur (`03`), status fitur (`04`), kebutuhan backend (`05`), aturan bisnis K-01–K-08 (`06`), risiko (`07`), keputusan (`09`). |

# CARA MENJALANKAN (RINGKAS)

Prasyarat: Node.js, MySQL berjalan, backend dulu baru frontend.

```sh
# 1) Backend
cd backend
cp .env.example .env   # isi DB_* / DATABASE_URL dan JWT_SECRET (min. 32 karakter acak)
npm install
npm run db:migrate
npm run dev            # http://localhost:3000

# 2) Frontend web (terminal lain)
cd frontend/web
npm install
npm run dev            # http://localhost:5173
npm run check          # type-check + validasi Svelte
```

Opsional: `PUBLIC_API_BASE_URL` (frontend) bila backend tidak di `http://localhost:3000`;
tanpa SMTP, email OTP/undangan hanya tercatat di log konsol backend (`MAIL_PROVIDER=log`).

# STATUS JUJUR (audit statis + uji 2026-11-24)

- Autentikasi nyata via backend (JWT + OTP email + undangan instruktur + refresh
  rotasi). Tidak ada akun demo di bundle; pendaftaran publik selalu peran student (K-01).
- Backend: 20 modul, ~150 endpoint `/api/v1`, 241/241 tes integrasi hijau
  (`npm test`), 15 indeks komposit baru (migrasi 0035). Kecuali transport DOKU,
  semua logika bisnis inti nyata (transaksional + Zod + audit).
- Pembayaran via **QRIS dinamis DOKU** (`frontend/web/src/routes/user/pembayaran/`,
  `frontend/android/lib/features/payment/`): pindai QR → nominal tampil otomatis
  → webhook memverifikasi → akses dibuka. Tanpa konfigurasi DOKU, backend
  menjawab 503 jujur (tanpa QR palsu); pemetaan endpoint live menunggu API spec
  DOKU (`backend/src/modules/doku/` + `backend/src/modules/payments/README.md`).
- Frontend web: `npm run check` 0 errors 0 warnings; semua portal memanggil
  backend nyata (tanpa `DEMO_ACCOUNTS`/`VALID_CODES`/`purchaseCourse`); proxy tugas
  502 jujur bila backend offline. Lihat `frontend/web/README.md`.
- Detail per fitur (sudah jalan / sebagian / mock / belum ada) dan skenario uji K-01–K-08:
  `frontend/web/docs/04-inventaris-fitur.md` dan `frontend/web/docs/07-risiko-dan-validasi.md`.
- Kontrak bersama web+Android: `frontend/shared/` (contractVersion 1.6.0, sinkron
  dengan backend; bila beda, perilaku backend aktual yang menang).
