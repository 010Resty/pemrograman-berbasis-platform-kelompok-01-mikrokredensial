# Aristoteles — Platform Mikrokredensial (Frontend)

Aplikasi web pembelajaran mikrokredensial Universitas (UNIRA × Aristoteles) berbasis
**SvelteKit 2 + Svelte 5 + TypeScript + Tailwind CSS 4**. Mencakup landing page publik,
portal user (mahasiswa), panel admin, dan sistem pembelajaran berurutan
(modul → materi → kuis/penugasan → sertifikat).

## Cara Menjalankan

```sh
npm install
npm run dev        # server pengembangan
npm run check      # type-check + validasi Svelte
npm run build      # build produksi
npm run preview    # pratinjau hasil build
```

## Akun Demo & Kode Demo

| Kebutuhan      | Nilai                                                                 |
| -------------- | --------------------------------------------------------------------- |
| Login UNIRA    | `farisi@gmail.com` / `1234567` (ada tombol isi otomatis di halaman login) |
| Kode voucher   | `ARISTOTELES-2026` · `BELAJAR-GRATIS` · `UNIRA-MKM01` (di halaman Kursusku)  |

Login dummy tersimpan di `localStorage`/`sessionStorage` (`aristoteles-session`) lalu
redirect ke `/user`. Sesi dan progres belajar bersifat simulasi sisi klien.

## Fitur

### Landing Page Publik (`/`)
- Navbar responsif anti-tumpuk: logo, 5 link section, search (xl), tombol **Masuk** + **Mulai Belajar**, menu hamburger + panel mobile.
- Hero (foto + badge alumni/modul), fitur bar, modul populer, tabel peringkat, tentang, panel verifikasi sertifikat, footer.
- Tombol **Lihat Semua Modul** → halaman `/modules`.
- Font Awesome + font Inter dimuat global dari layout root.

### Katalog Publik (`/modules`)
- Daftar semua modul: search, filter kategori, filter periode (Berjalan / Akan Datang / Lewat), badge periode + durasi + rating + harga + peserta.
- CTA per kartu → `/login` (detail penuh ada di balik login).

### Autentikasi
- **Login** (`/login`): validasi akun dummy, pesan error `role="alert"`, loading, show/hide password, ingat saya, kotak akun demo sekali klik, tombol SSO "Masuk dengan UNIRA".
- **Register** (`/register`), **Verify** (`/verify`), **with_UNIRA** (`/with_UNIRA`).

### Portal User (`/user`) — sidebar: Dashboard, Kursusku, Semua Kursus, Sertifikat
- **Dashboard** (`/user`): sapaan, 4 kartu statistik, daftar kursus berjalan, aksi cepat, sertifikat terbaru, ringkasan progres.
- **Kursusku** (`/user/kursusku`): filter status, kartu progres + tautan ke detail, **form redeem kode voucher** (validasi format, cegah tukar ganda, pesan sukses/gagal).
- **Semua Kursus** (`/user/semua-kursus`): katalog dari data yang sama (search + kategori + periode), kartu → halaman pratinjau.
- **Pratinjau kursus** (`/user/semua-kursus/[courseId]`): hero + statistik, tentang, learning outcomes, **kurikulum akordeon** (semua modul + materi + durasi), syarat, kartu sticky (harga, CTA ikut/lanjut, benefit).
- **Sertifikat** (`/user/sertifikat`): kartu sertifikat terverifikasi (ID kredensial, skor), unduh/bagikan, CTA verifikasi.
- **Periode pelatihan**: 3 status — *Akan Datang* (badge + bulan mulai, cth. Desember 2026), *Sedang Berjalan*, *Sudah Lewat* (CTA nonaktif di pratinjau).

### Sistem Pembelajaran Berurutan
- **Detail kursus** (`/user/kursusku/[courseId]`): hero + progres, akordeon modul, checklist materi, **modul terkunci** (modul 2+ menunggu modul sebelumnya 100%), **materi terkunci** (gembok + badge "Terkunci") sampai materi atas selesai.
- **Halaman materi** (`.../[moduleId]/[materialId]`, full-frame tanpa sidebar utama):
  - 6 tipe konten via komponen reusable `src/lib/components/materials/` — `TextMaterial`, `PhotoMaterial`, `AudioMaterial` (+transkrip), `VideoMaterial` (+bab), `QuizMaterial` (interaktif + skor + pembahasan + ulangi), `AssignmentMaterial` (brief + form kumpul) — dipilih otomatis oleh `MaterialRenderer`.
  - Aturan buka: video/teks/audio/foto → tombol **Berikutnya** menandai selesai + auto-buka materi lanjut; kuis lulus (≥70) dan tugas terkirim menandai selesai otomatis.
  - Sidebar modul collapsible (animasi 300ms, rel panah `»` saat tertutup), breadcrumb berpanah, navigasi Sebelumnya/Berikutnya/Lanjut-Modul, panel "Materi Terkunci" untuk akses URL langsung.
- **Store progres global** (`src/lib/stores/progress.svelte.ts`, `SvelteSet` reaktif): status selesai sinkron di semua halaman, tidak hilang saat pindah kursus dalam sesi.

### Panel Admin (`/admin`) — sidebar: Dashboard, Users, Instrukturs, Courses
- **Dashboard**: 4 statistik, aksi cepat (tambah user/instruktur/course), users terbaru, courses populer.
- **Users**: tabel + search + filter status (Aktif/Pending/Nonaktif).
- **Instrukturs**: kartu + search (course, siswa, rating).
- **Courses**: tabel + search + filter status (Published/Draft/Archived).

## Struktur Proyek

```
src/
  routes/
    +page.svelte                 # landing page
    +layout.svelte               # layout root (favicon, font, Font Awesome)
    login/ register/ verify/ with_UNIRA/
    modules/                     # katalog publik
    user/
      +layout.svelte             # shell user (full-frame khusus halaman materi)
      +page.svelte               # dashboard
      kursusku/                  # daftar + [courseId] + [moduleId]/[materialId]
      semua-kursus/              # katalog + [courseId] pratinjau
      sertifikat/
    admin/
      +layout.svelte             # shell admin
      +page.svelte               # dashboard admin
      users/ instrukturs/ courses/
  lib/
    components/
      Logo.svelte  Sidebar.svelte  # sidebar generik (user & admin)
      materials/                 # 6 komponen format materi + renderer
    data/
      courses.ts                 # 6 kursus + modul + materi + helper gembok
      course-meta.ts             # rating/peserta/harga/periode/outcome/syarat
      material-details.ts        # konten per materi + default per tipe
    stores/
      progress.svelte.ts         # status selesai global (SvelteSet)
```

## Kualitas

- `npm run check` (svelte-check): **0 errors**.
- `npm run build`: sukses, semua rute termasuk rute dinamis 3 segmen ter-generate.
- Aksesibilitas (WCAG 2.2): skip link, `aria-current`/`aria-expanded`/`aria-pressed`, `role="alert/status/progressbar/radiogroup"`, label form, `focus-visible`, target sentuh ≥36–44px, `prefers-reduced-motion`, kontras teks.
- Dikembangkan dengan panduan autoskills: `frontend-design`, `svelte5-best-practices`, `svelte-code-writer`, `accessibility`.
