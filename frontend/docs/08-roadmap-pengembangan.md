# 08 — Roadmap Pengembangan ARISTOTELES

> Rencana untuk ditinjau, bukan izin coding. Tiap fase: tujuan, pekerjaan usulan, ketergantungan, risiko, kriteria selesai, persetujuan.

## Fase D — Dokumentasi (ini)

- Tujuan: 9 file konsisten.
- Pekerjaan: tulis `01–09`, selaraskan K-01–K-08 di `06` dan `09`.
- Tergantung: audit + README.
- Risiko: rendah.
- Selesai bila: 9 file ada, tautan jalan, tanpa klaim tanpa bukti, K konsisten.
- Perlu: persetujuan rancangan ini.

## Fase B1 — Fondasi backend

- Tujuan: sesi + progres + riwayat tidak lagi lokal.
- Usulan: auth peran (K-01), progres persisten (K-04/K-07/K-08), riwayat kuis/tugas + terbaik (K-02/K-06).
- Tergantung: detail undangan K-01, rubrik K-06.
- Risiko: sedang — ubah guard semua portal.
- Selesai bila: refresh tidak hilang, nilai terbaik dipakai, bypass localStorage gagal.
- Perlu: setuju model sesi + format riwayat.

## Fase B2 — Voucher + sertifikat

- Tujuan: akses gratis terkendali + lulus otomatis.
- Usulan: voucher atomik sekali pakai (K-03), terbit idempoten + verifikasi/cabut (K-05).
- Tergantung: B1.
- Risiko: tinggi — race condition, idempotensi.
- Selesai bila: uji 07 untuk voucher + sertifikat lolos.
- Perlu: setuju status `Aktif/Digunakan/Dinonaktifkan` + identitas sertifikat.

## Fase F — Selaraskan frontend

- Tujuan: kode sesuai K-07/K-05/K-08.
- Usulan: lepas kunci antar-modul umum, gate sertifikat, versi materi + ulang selektif, unifikasi modal ke `WarningModal.svelte`, perbaiki label/kontras.
- Tergantung: B1/B2.
- Risiko: rendah–sedang.
- Selesai bila: `npm run check` 0 error, cek keyboard lolos, uji K-07 lolos.
- Perlu: daftar sub/materi sekuensial + definisi penting K-08.

## Fase T — Pengujian + integrasi

- Tujuan: semua skenario 07 lolos.
- Usulan: uji-docs, backend, frontend, integrasi.
- Selesai bila: K-01–K-08 teruji end-to-end.
