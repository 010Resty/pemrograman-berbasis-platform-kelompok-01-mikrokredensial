# 04 — Inventaris Fitur ARISTOTELES

> Jangan tandai selesai hanya karena ada di keputusan. Keputusan ≠ implementasi. Penanda: `[Terverifikasi]` (kode + uji 2026-11-24), `[Keputusan pengguna]` (target disepakati), `[Belum dapat diverifikasi]` (belum ada bukti). Backend: 241/241 tes hijau; frontend: `npm run check` 0 errors/warnings.

## Sudah tersedia dan terverifikasi [Terverifikasi]

- **Auth end-to-end**: register OTP (selalu student) → verifikasi → sesi; login tab peran + label bahasa; lupa/reset 2 langkah; undangan → aktivasi teacher; guard server (`GET /auth/me`); logout cabut sesi + bersih cache.
- **Bell notifikasi**: hook terpadu (`badge-poll.ts`) visibility + fokus + event + interval 60 dtk (jeda saat hidden); cache GET 45–60 dtk + invalidasi per mutasi; cap `9+` konsisten.
- **Katalog publik**: SSR + cache 60 dtk, peringkat real (`GET /courses/rankings`), promo + patungan publik, verifikasi sertifikat publik.
- **Belajar peserta**: 6 tipe materi via `MaterialRenderer`; kuis (skor/terbaik/riwayat server); tugas (proxy 502-jujur, status server, revisi tanpa batas); progres persisten + auto-issue sertifikat; K-04/K-07 sesuai (kunci hanya dalam sub-modul).
- **Pembayaran DOKU**: antrean → QR PNG + countdown → polling 5 dtk (jeda saat hidden) + banner offline + auto-refresh sekali → webhook grant; kwitansi HTML; salin nominal.
- **Voucher**: kelola admin + tukar atomik + validasi tanpa hangus + statistik 1-query + detail/riwayat; error backend ditampilkan + retry.
- **Sertifikat**: daftar + kartu + unduh PDF + QR/verify publik + badge status; instruktur: ringkasan, tab eligibility/riwayat + paginasi, kelayakan per modul/peserta, cabut beralasan (`ModalShell`).
- **Penilaian**: agregat 1 request (`review-queue?courseId=`) + paginasi; rubrik 3 kriteria + keputusan wajib eksplisit + unduh per-baris; antrean review terpusat.
- **Undangan**: daftar/buat/batal/kirim-ulang + aktivasi via backend + email SMTP otomatis; token sekali-tampil + peringatan salin.
- **Laporan admin**: tab Ringkasan/Tren/Per kursus, filter tanggal + Kursus ID tervalidasi, paginasi server, CSV + peringatan 100 baris, diagram aksesibel (teks + aria-label).
- **Promo/patungan**: 3 jenis promo + usulan/approve; grup patungan iuran sendiri-sendiri, lunas-semua baru grant.
- **Bagi hasil**: persen + minimal admin; snapshot per bayar; ajukan/tandai-ditransfer/tolak + audit; transfer dana manual di luar sistem (by design).
- **Admin/pengajuan/kategori**: CRUD kategori, kelola user + penugasan instruktur, tinjauan pengajuan + undang, laporan.
- **Upload**: validasi tipe/ukuran/magic-bytes + varian responsif `?w=` + srcset; privat assignment (pemilik/pengampu/admin).
- **Editor**: Tiptap (toolbar sticky, dimuat dinamis), QuizBuilder, TaskBriefBuilder; modal sisipkan di atas `ModalShell`; Enter-to-apply; draft lokal + indeks memori.
- **Aksesibilitas**: skip link, `Breadcrumb`, `StatusBadge` (selalu teks), focus-trap lightbox/dialog, target ≥44px, `prefers-reduced-motion`, noindex portal, prerender 4 halaman statis.

## Tersedia sebagian [Terverifikasi]

- **Pembayaran DOKU live**: endpoint lengkap + `notify` RSA real + idempoten, tetapi transport `createOrder` sengaja `503 DOKU_NOT_WIRED` menunggu API spec Fase 1b (`backend/src/modules/doku/`). Tanpa konfigurasi → `503 DOKU_NOT_CONFIGURED`. Tanpa QR/sukses palsu.
- **Kurikulum draf lokal**: cache editor sah; kebenaran baca + versi K-08 di server. `CurriculumEditor.svelte` warisan tak dipakai — jangan duplikasi.

## Simulasi / mock [Terverifikasi]

- Mock hanya di `tests/` (kontrak mock HTTP) dan label riwayat lama; tidak ada sukses palsu di jalur produksi. Tidak ada `DEMO_ACCOUNTS`/`VALID_CODES`/`purchaseCourse` di bundle.

## Belum tersedia [Terverifikasi]

- Push FCM asli (polling 60 dtk + lencana lokal sebagai pengganti jujur; butuh project Firebase + kredensial).
- Transfer dana payout otomatis (manual di luar sistem, by design).
- Rate-limit backend terpusat/Redis (kini in-memory per instance; multi-instance butuh Redis).
- Endpoint batch `review-queue` tanpa filter dipakai dasbor (ada; halaman kursus sudah pakai `?courseId=`).

## Kebutuhan K-01–K-08 [Keputusan pengguna; status implementasi terverifikasi]

- K-01 undangan admin-only — backend `POST /admin/invitations` + SMTP + aktivasi `/invitations/accept`; register menolak peran teacher; token sekali-tampil + kirim-ulang hanguskan lama.
- K-02 nilai terbaik + riwayat persisten — backend simpan tiap percobaan + `GET .../quiz-best` (MAX, lulus bertahan) + riwayat; agregat SQL; `QuizMaterial` tampilkan terbaik.
- K-03 voucher resmi sekali pakai anti-race — admin kelola via backend (disable/enable, riwayat); Personal 1 akun 1x pakai + penukaran atomik; diskon hangus saat bayar disetujui; statistik 1-query.
- K-04 materi biasa selesai via Berikutnya — `markDone` + progres server; tidak meluluskan kuis/tugas.
- K-05 gate sertifikat otomatis — terbit otomatis per modul + kursus (supersede modul); daftar backend + unduh PDF + verifikasi publik + QR; cabut beralasan + 409 terbit ulang.
- K-06 rubrik + riwayat tugas backend — kumpul ulang tanpa batas; rata-rata 3 kriteria dihitung server; riwayat + status menempel; keputusan eksplisit di UI.
- K-07 modul independen — server tidak kunci antar-modul; aplikasi kunci hanya dalam sub-modul sama.
- K-08 versi materi + pengulangan selektif — `expectedUpdatedAt` + 409 + audit + `GET /materials/:id/changes`; progres tidak terhapus; editor tampilkan riwayat.
