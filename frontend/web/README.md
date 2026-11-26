# Aristoteles — Platform Mikrokredensial (Frontend)

Aplikasi web pembelajaran mikrokredensial berbasis **SvelteKit 2 + Svelte 5 +
TypeScript strict + Tailwind CSS 4 + editor Tiptap**. Portal: publik, peserta (`/user`),
instruktur (`/instruktur`), admin (`/admin`). Semua data nyata dari backend
(lihat `../../../backend/README.md` + `../../../backend/docs/API_CONTRACT.md`).

> Backend wajib jalan untuk login dan data nyata. Tanpa backend, halaman yang butuh
> data menampilkan error jujur + tombol coba lagi (tidak ada sukses palsu).

## Cara Menjalankan

```sh
npm install
npm run dev        # server pengembangan (vite dev)
npm run check      # type-check + validasi Svelte (wajib lolos: 0 errors, 0 warnings)
npm run build      # build produksi (terverifikasi lolos; tahap adapter Vercel butuh symlink OS)
npm run preview    # pratinjau hasil build
npm run lint       # prettier --check + eslint
npm run format     # prettier --write .
```

Variabel env (semua opsional, ada default dev):

| Variabel | Default bila kosong | Keterangan |
|---|---|---|
| `PUBLIC_API_BASE_URL` | `http://localhost:3000/api/v1` | Base URL backend |
| `PUBLIC_LOGIN_TIMEOUT_MS` | `15000` | Batas waktu request login (ms) |

Uji unit ringan (tanpa browser/bundler):

```sh
node --test tests/   # request-policy, login-timeout
```

## Autentikasi (nyata via backend, tanpa akun demo)

- **Register** (`/[lang]/register`): selalu peran student (K-01; pilihan teacher
  hanya informatif) → kode OTP 6 digit ke email → **verifikasi** (`/[lang]/verify-email`)
  + hint email-sama + progress bar cooldown → akun aktif + sesi diterbitkan.
- **Login** (`/[lang]/login`): tab Student/Teacher/Administrator (label mengikuti bahasa);
  salah portal = ditolak dengan pesan peran yang benar. Opsi ingat saya (localStorage)
  vs sesi tab (sessionStorage). Label peran: Mahasiswa/Pengajar (id), Student/Teacher (en).
- **Lupa password** (`/[lang]/lupa-password`) → **reset** (`/[lang]/reset-password`):
  verifikasi kode dulu, lalu password baru. Kode kedaluwarsa 10 menit (hitung mundur
  tampil), maks 5x salah, kirim ulang tersedia.
- **Aktivasi undangan instruktur** (`/[lang]/invite/[token]`): token 1x pakai 7 hari,
  atur password sendiri; halaman kedaluwarsa/terpakai/dibatalkan berbahasa ganda.
- Guard portal memverifikasi sesi ke server (`GET /auth/me`) — peran diambil dari server,
  bukan dari storage. Storage lokal tidak pernah dianggap bukti akses. Hook bell
  terpadu (`lib/stores/badge-poll.ts`): visibility + fokus + event + interval 60 dtk
  (dilewati saat tab hidden).

## Portal & Rute (jalur `[lang]` = `id` | `en`)

Publik: `/` (promo, unggulan, patungan, cara belajar, kelas gratis), `/pelatihan`,
`/modules` (+ detail), `/peringkat`, `/tentang/*`, `/verifikasi`, `/menjadi-instruktur`
(+ `/daftar`), `/kebijakan-privasi`, `/syarat-ketentuan`, `/segera-hadir`.
Halaman statis kebijakan/syarat di-prerender (id+en).

- **Peserta** (`/user`, guard student): Dashboard, Kursusku, Semua Kursus (+ pratinjau
  `[courseId]`), Sertifikat (badge + unduh PDF + QR), Pembayaran
  (`pembayaran` riwayat + `pembayaran/[courseId]` **QRIS dinamis DOKU**: antrean →
  QR → polling 5 dtk + hitung mundur → webhook otomatis; jeda saat tab hidden,
  banner offline + auto-refresh QR sekali saat kedaluwarsa), materi
  (`kursusku/[courseId]/[moduleId]/[materialId]`, 6 tipe via `MaterialRenderer`:
  teks/foto/audio/video/kuis/tugas), promo per jenis, profil.
- **Instruktur** (`/instruktur`, guard teacher): Dashboard, Kursusku (+ tambah/kelola
  kurikulum drill-down, editor Tiptap dimuat dinamis), Penilaian (agregat 1 request
  `GET /instructor/review-queue?courseId=`, rubrik 3 kriteria + riwayat, paginasi),
  Pendapatan (payout + riwayat), Sertifikat (ringkasan, per kursus/modul, kelayakan
  bertab + paginasi, riwayat), Promo (ajukan ke kampanye), profil.
- **Admin** (`/admin`, guard admin): Dasbor, Laporan (tab Ringkasan/Tren/Per kursus,
  CSV + peringatan 100 baris), Peserta, Pengajuan instruktur, Undangan (token
  sekali-tampil + salin), Instruktur (+ubah), Kategori, Kursus, Voucher (buat
  Personal/Umum/Diskon, statistik 1-query, nonaktif/aktifkan, riwayat),
  Promo, Pembayaran (verify manual antrean lawas; DOKU otomatis via webhook),
  Bagi hasil (persen + minimal + payout).

## Sumber Data

- `src/lib/api/` — klien per domain (`backend.ts`, `courses.ts`, `progress.ts`, `quiz.ts`,
  `submissions.ts` (+`review-queue?courseId=`), `certificates.ts`, `vouchers.ts` (+stats),
  `invitations.ts`, `admin.ts`, `dashboard.ts`, `enrollments.ts`, `uploads.ts`,
  `applications.ts`, `grading-queue.ts`, `promos.ts`, `patungan.ts`, `revenues.ts`,
  `profile.ts`, `categories.ts`, `cache.ts` (GET cache opt-in 45–60 dtk khusus bell,
  invalidasi per mutasi, clear saat logout), `responsive.ts` (srcset `?w=`).
- `src/lib/stores/` — sesi (`auth.svelte.ts`, label peran per bahasa), enrollment
  (`enrollment.svelte.ts`, server sebagai kebenaran + cache), progres (`progress.svelte.ts`,
  sinkron server + persist), `badge-poll.ts` (hook polling bell), draf kurikulum/kuis/tugas
  (+ indeks memori passScore), toast.
- `src/lib/data/` — data statis/fallback (kursus, meta, materi, pembayaran).
- Mock hanya di `tests/` dan label `driveMode` lama sudah diganti wording netral
  ("tersimpan lokal — menunggu sinkronisasi"); tidak ada sukses palsu.
- Proksi tugas (`src/routes/api/assignments/`): upload validasi PDF (tipe + magic bytes +
  maks 10 MB) dan wajib token; nilai wajib token; backend offline = 502 jujur.
- Komponen bersama: `ModalShell` (dialog `<dialog>` standar), `StatusBadge`
  (payment/submission/invitation/certificate), `Breadcrumb`, `Pagination`,
  `WarningModal`, `EmptyState`, `PageHeader`, `AsyncMaterialEditor` (split chunk Tiptap).

## Struktur Proyek (ringkas)

```
src/
  routes/
    +page.svelte +layout.svelte
    [lang]/  # login/ register/ verify-email/ lupa-password/ reset-password/
             # invite/[token]/ verifikasi/ peringkat/ pelatihan/ promo/[slug]/
             # patungan/setup|saya|[groupId]/ tentang/* / menjadi-instruktur/
             # kebijakan-privasi/ syarat-ketentuan/ segera-hadir/ with_UNIRA/
             # modules/[courseId]/[moduleId]/[subId]/ (publik, sebagian SSR + cache)
    user/          # +layout (guard student) +page kursusku/ semua-kursus/
                   # sertifikat/ pembayaran/ promo/ profile/
    instruktur/    # +layout (guard teacher) +page kursusku/ penilaian/
                   # pendapatan/ sertifikat/ promo/ profile/
    admin/         # +layout (guard admin) +page laporan/ peserta/ pengajuan-instruktur/
                   # invitations/ instrukturs/ courses/ kategori/ vouchers/ promos/
                   # pembayaran/ bagi-hasil/ profile/
    api/assignments/   # proksi upload + grade (fail-closed)
  lib/
    api/ stores/ data/ components/ (public/, training/, materials/, ui/)
    actions/ seo/ server/ tiptap/ types/ assets/
  app.css app.html
tests/   # node --test (request-policy, login-timeout)
docs/    # 01 ringkasan, 02 rute, 03 arsitektur, 04 status fitur,
         # 05 kebutuhan backend, 06 aturan bisnis K-01–K-08,
         # 07 risiko & validasi, 08 roadmap, 09 keputusan
```

## Kualitas & Batasan Diketahui

- `npm run check`: 0 errors, 0 warnings (dipertahankan tiap perubahan).
- `npm run build`: lolos kompilasi + prerender (4 halaman statis). Tahap adapter Vercel
  butuh symlink OS (gagal `EPERM` di Windows tanpa Developer Mode — lingkungan, bukan kode).
- Aksesibilitas: skip link, `aria-*`/`role` status/alert, label form, `focus-visible`,
  target sentuh ≥44px, `prefers-reduced-motion`, focus-trap dialog + lightbox.
- Batasan jujur: pembayaran DOKU live menunggu API spec (`503 DOKU_NOT_WIRED` tanpa
  config); push FCM belum ada (polling 60 dtk); transfer payout manual di luar sistem;
  rate-limit backend in-memory (multi-instance butuh Redis); cache bell 45–60 dtk.
  Acuan status: `docs/04-inventaris-fitur.md`; skenario uji:
  `docs/07-risiko-dan-validasi.md`; aturan target: `docs/06-aturan-bisnis.md`.
