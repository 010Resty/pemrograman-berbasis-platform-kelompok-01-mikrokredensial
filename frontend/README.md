# Aristoteles — Platform Mikrokredensial (Frontend)

Aplikasi web pembelajaran mikrokredensial berbasis **SvelteKit 2 + Svelte 5 +
TypeScript strict + Tailwind CSS 4 + editor Tiptap**. Portal: publik, peserta (`/user`),
instruktur (`/instruktur`), admin (`/admin`).

> Backend wajib jalan untuk login dan data nyata. Tanpa backend, halaman yang butuh
> data menampilkan error jujur + tombol coba lagi (tidak ada sukses palsu).

## Cara Menjalankan

```sh
npm install
npm run dev        # server pengembangan (vite dev)
npm run check      # type-check + validasi Svelte (wajib lolos sebelum selesai kerja)
npm run build      # build produksi
npm run preview    # pratinjau hasil build
npm run lint       # prettier --check + eslint
npm run format     # prettier --write .
```

Variabel env (semua opsional, ada default dev):

| Variabel | Default bila kosong | Keterangan |
|---|---|---|
| `PUBLIC_API_BASE_URL` | `http://localhost:3000/api/v1` | Base URL backend |
| `PUBLIC_LOGIN_TIMEOUT_MS` | `15000` | Batas waktu request login (ms) |
| `PUBLIC_QRIS_IMAGE_URL` | *(tidak tampil)* | URL gambar QRIS statis platform untuk halaman pembayaran; kosongkan bila belum ada |

Uji unit ringan (tanpa browser/bundler):

```sh
node --test tests/   # request-policy, login-timeout
```

## Autentikasi (nyata via backend, tanpa akun demo)

- **Register** (`/register`): selalu peran student (K-01) → kode OTP 6 digit ke email →
  **verifikasi** (`/verify-email`) → akun aktif + sesi diterbitkan.
- **Login** (`/login`): tab Student/Teacher/Administrator; salah portal = ditolak dengan
  pesan peran yang benar. Opsi ingat saya (localStorage) vs sesi tab (sessionStorage).
- **Lupa password** (`/lupa-password`) → **reset** (`/reset-password?email=...`) 2 langkah:
  verifikasi kode dulu (`POST /auth/verify-reset-code`), lalu buat password baru.
  Email dari tautan dikunci (tidak bisa diubah); kode kedaluwarsa 10 menit (hitung mundur
  tampil), maks 5x salah, kirim ulang tersedia.
- **Aktivasi undangan instruktur** (`/invite/[token]`): token 1x pakai, atur password sendiri.
- Guard portal memverifikasi sesi ke server (`GET /auth/me`) — peran diambil dari server,
  bukan dari storage. Storage lokal (`aristoteles-session`, `aristoteles-access-token`)
  tidak pernah dianggap bukti akses.

## Portal & Rute

Publik: `/` (promo, unggulan, patungan, cara belajar, kelas gratis), `/pelatihan`,
`/modules` (+ detail), `/peringkat`, `/tentang`, `/verifikasi`, `/menjadi-instruktur`
(+ `/daftar`), `/kebijakan-privasi`, `/syarat-ketentuan`, `/segera-hadir`.

- **Peserta** (`/user`, guard student): Dashboard, Kursusku, Semua Kursus (+ pratinjau
  `[courseId]`), Sertifikat, Pembayaran (`pembayaran/[courseId]`, **simulasi lokal** —
  tanpa gateway, bukan akses resmi), materi (`kursusku/[courseId]/[moduleId]/[materialId]`,
  6 tipe via `MaterialRenderer`: teks/foto/audio/video/kuis/tugas).
- **Instruktur** (`/instruktur`, guard teacher): Dashboard, Kursusku (+ tambah/kelola
  kurikulum drill-down), Penilaian (rubrik 3 kriteria + riwayat), Pendapatan, Sertifikat
  (ringkasan, per kursus/modul, kelayakan, riwayat).
- **Admin** (`/admin`, guard admin): Dasbor, Peserta, Pengajuan instruktur, Undangan,
  Instruktur (+ubah), Kursus, Voucher (buat Personal/Umum, nonaktif/aktifkan, riwayat).

## Sumber Data

- `src/lib/api/` — klien per domain (`backend.ts`, `courses.ts`, `progress.ts`, `quiz.ts`,
  `submissions.ts`, `certificates.ts`, `vouchers.ts`, `invitations.ts`, `admin.ts`,
  `dashboard.ts`, `enrollments.ts`, `uploads.ts`, `applications.ts`, `grading-queue.ts`)
  dengan kebijakan request terpusat (`request-policy.ts`: dedup GET, timeout,
  klasifikasi 401/403/network/server, logout terpusat saat 401).
- `src/lib/stores/` — sesi (`auth.svelte.ts`), enrollment (`enrollment.svelte.ts`,
  server sebagai kebenaran + cache offline), progres memori (`progress.svelte.ts`,
  hilang saat refresh), draf kurikulum/kuis/tugas, toast.
- `src/lib/data/` — data statis/fallback (kursus, meta, materi, pembayaran).
- Mock selalu berlabel: `*.mock.ts`, query `?mock=...` (khusus DEV, banner penanda).
- Proksi tugas (`src/routes/api/assignments/`): upload validasi PDF (tipe + magic bytes +
  maks 10 MB) dan wajib token; nilai wajib token; backend offline = 502 jujur
  (tidak ada sukses palsu).

## Struktur Proyek (ringkas)

```
src/
  routes/
    +page.svelte +layout.svelte
    login/ register/ verify-email/ lupa-password/ reset-password/ invite/[token]/
    modules/ pelatihan/ peringkat/ tentang/ verifikasi/
    menjadi-instruktur/ kebijakan-privasi/ syarat-ketentuan/ segera-hadir/
    user/          # +layout (guard student) +page kursusku/ semua-kursus/
                   # sertifikat/ pembayaran/[courseId]/
    instruktur/    # +layout (guard teacher) +page kursusku/ penilaian/
                   # pendapatan/ sertifikat/
    admin/         # +layout (guard admin) +page peserta/ pengajuan-instruktur/
                   # invitations/ instrukturs/ courses/ vouchers/
    api/assignments/   # proksi upload + grade (fail-closed)
  lib/
    api/ stores/ data/ components/ (public/, training/, materials/)
    actions/ seo/ server/ tiptap/ types/ assets/
  app.css  app.html
tests/   # node --test (request-policy, login-timeout)
docs/    # 01 ringkasan, 02 rute, 03 arsitektur, 04 status fitur,
         # 05 kebutuhan backend, 06 aturan bisnis K-01–K-08,
         # 07 risiko & validasi, 08 (jika ada), 09 keputusan
```

## Kualitas & Batasan Diketahui

- `npm run check`: 0 errors, 0 warnings (wajib dipertahankan).
- Aksesibilitas: skip link, `aria-*`/`role` status, label form, `focus-visible`, target
  sentuh ≥44px, `prefers-reduced-motion`.
- Batasan jujur (bukan bug yang disembunyikan): pembayaran simulasi; search global dan
  bell notifikasi belum berfungsi; sebagian tombol sertifikat/laporan belum ada handler;
  progres belajar hilang saat refresh. Acuan status: `docs/04-inventaris-fitur.md`;
  skenario uji: `docs/07-risiko-dan-validasi.md`; aturan target: `docs/06-aturan-bisnis.md`.
