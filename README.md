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
instruktur, kursus, voucher, undangan, sertifikat). Aturan bisnis K-01–K-08 disepakati
2026-10-24 (diperbarui 2026-11-02); status implementasi per fitur lihat
`frontend/docs/04-inventaris-fitur.md` — keputusan bukan bukti sudah selesai di kode.

# STRUKTUR REPO

| Direktori | Isi |
|---|---|
| `frontend/` | SvelteKit 2 + Svelte 5 + TypeScript + Tailwind CSS 4. Lihat `frontend/README.md`. |
| `backend/` | Express + TypeScript + Drizzle ORM + MySQL, prefix API `/api/v1`. Lihat `backend/README.md`. |
| `frontend/docs/` | Dokumentasi proyek: ringkasan (`01`), rute (`02`), arsitektur (`03`), status fitur (`04`), kebutuhan backend (`05`), aturan bisnis K-01–K-08 (`06`), risiko (`07`), keputusan (`09`). |

# CARA MENJALANKAN (RINGKAS)

Prasyarat: Node.js, MySQL berjalan, backend dulu baru frontend.

```sh
# 1) Backend
cd backend
cp .env.example .env   # isi DB_* / DATABASE_URL dan JWT_SECRET (min. 32 karakter acak)
npm install
npm run db:migrate
npm run dev            # http://localhost:3000

# 2) Frontend (terminal lain)
cd frontend
npm install
npm run dev            # http://localhost:5173
npm run check          # type-check + validasi Svelte
```

Opsional: `PUBLIC_API_BASE_URL` (frontend) bila backend tidak di `http://localhost:3000`;
tanpa SMTP, email OTP/undangan hanya tercatat di log konsol backend (`MAIL_PROVIDER=log`).

# STATUS JUJUR

- Autentikasi nyata via backend (JWT + OTP email + undangan instruktur). Tidak ada akun
  demo di bundle; pendaftaran publik selalu peran student (K-01).
- Pembayaran masih **simulasi lokal** tanpa gateway (`frontend/src/routes/user/pembayaran/`);
  akses resmi tetap lewat enrollment/voucher/hibah server. Gateway belum diputuskan
  (`backend/src/modules/payments/README.md`).
- Detail per fitur (sudah jalan / sebagian / mock / belum ada) dan skenario uji K-01–K-08:
  `frontend/docs/04-inventaris-fitur.md` dan `frontend/docs/07-risiko-dan-validasi.md`.
