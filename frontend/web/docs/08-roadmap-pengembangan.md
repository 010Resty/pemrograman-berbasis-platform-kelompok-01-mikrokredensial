# 08 — Roadmap Pengembangan ARISTOTELES

> Rencana untuk ditinjau, bukan izin coding. Tiap fase: tujuan, pekerjaan, ketergantungan, risiko, kriteria selesai, persetujuan. Status diperbarui 2026-11-24.

## Fase D — Dokumentasi (ini, SELESAI)

- Tujuan: 9 file konsisten + akurat vs kode.
- Pekerjaan: tulis/perbarui `01–09` selaras K-01–K-08 + hasil audit + optimasi 2026-11.
- Selesai bila: 9 file ada, tautan jalan, tanpa klaim tanpa bukti, K konsisten. ✅ (dokumen ini bagiannya)

## Fase B1 — Fondasi backend (SELESAI)

- Tujuan: sesi + progres + riwayat tidak lagi lokal.
- Dikerjakan: auth peran + OTP + refresh rotasi (K-01), progres persisten (K-04/K-07/K-08 + versi + riwayat), riwayat kuis/tugas + terbaik (K-02/K-06), guard semua portal via server.
- Selesai: refresh tidak hilang, nilai terbaik dipakai, bypass localStorage gagal. ✅ (241 tes hijau)

## Fase B2 — Voucher + sertifikat (SELESAI)

- Tujuan: akses gratis terkendali + lulus otomatis.
- Dikerjakan: voucher atomik sekali pakai + statistik (K-03), terbit idempoten + verifikasi/cabut + level kursus (K-05).
- Selesai: uji 07 untuk voucher + sertifikat lolos. ✅

## Fase F — Selaraskan frontend (SELESAI inti)

- Tujuan: kode sesuai K-07/K-05/K-08 + kualitas portal.
- Dikerjakan: lepas kunci antar-modul, gate sertifikat, versi materi + ulang selektif, unifikasi modal (`ModalShell`), badge (`StatusBadge`), breadcrumb, cache bell + hook polling, srcset, prerender, noindex portal, a11y + kontras + target sentuh.
- Selesai: `npm run check` 0 errors, `vite build` lolos kompilasi + prerender (adapter Vercel butuh symlink OS — lingkungan). ✅ inti; sisa besar (V2 penuh, virtualisasi penuh, split Tiptap render, cache katalog) ditunda dengan alasan tercatat di laporan.

## Fase T — Pengujian + integrasi (BERJALAN)

- Tujuan: semua skenario 07 lolos.
- Dikerjakan: 241 tes backend hijau; skenario K-01–K-08 HTTP di `frontend/shared/scenarios/` (valid untuk web + Android).
- Sisa: uji end-to-end lintas portal terjadwal + video pengujian (`docs/tautan-video-pengujian.md` masih menunggu tautan).
