# Envelope, Auth, dan Konvensi

Acuan ringkas untuk penulis klien (web maupun Android).
Normatif lengkap: `backend/docs/API_CONTRACT.md`.

## Base URL

- Prefix global: `/api/v1` (kecuali `GET /health`).
- Web memakai `PUBLIC_API_BASE_URL` (default `http://localhost:3000`).
- Android memakai konfigurasi environment sendiri (dev/staging/prod).

## Auth

- Header: `Authorization: Bearer <JWT access token>`.
- JWT: `sub` = id numerik, `email`, `role`; kedaluwarsa 15 menit.
- Refresh: token opaque 64-heksadesimal, sekali pakai (rotasi).
  Disimpan aman di klien (Android: secure storage, BUKAN shared preferences
  biasa). Umur default 30 hari (`REFRESH_EXPIRES_DAYS`).
- Pakai ulang refresh token yang sudah dicabut → `401` + seluruh sesi
  user ikut dicabut (deteksi pencurian).
- Tanpa token di endpoint privat → `401`. Peran tidak cocok → `403`.

## Bentuk respons

Sukses:

```json
{ "status": "success", "message": "...", "data": {} }
```

Gagal:

```json
{ "status": "error", "message": "...", "code": "MATERIAL_CONFLICT", "data": null }
```

atau validasi Zod:

```json
{ "status": "error", "message": "...", "errors": [{ "field": "title", "message": "..." }], "data": null }
```

Klien TIDAK BOLEH menganggap sukses dari status HTTP saja;
`status !== "success"` atau HTTP error = gagal (tidak ada sukses palsu).

## Kode galat bisnis utama (tidak lengkap — lihat API_CONTRACT)

| Kode | Arti |
|---|---|
| `EMAIL_UNVERIFIED` | Login ditolak, email belum verifikasi (HTTP 403 + `errors`) |
| `NO_ACCESS` | Tanpa hak akses kursus (HTTP 403) |
| `NEEDS_MANUAL_GRANT` | Kursus berbayar, daftar langsung ditolak |
| `ALREADY_ENROLLED` | Sudah terdaftar |
| `MATERIAL_CONFLICT` | Materi berubah sejak dibuka (`data.currentUpdatedAt`), kirim ulang dengan cap baru |
| `NOT_ELIGIBLE` | Belum memenuhi syarat sertifikat (`failReasons` + `requirements`) |
| `CERT_REVOKED` / `ALREADY_REVOKED` | Aksi pada sertifikat yang dicabut ditolak |
| `CERT_SUPERSEDED` | Sertifikat modul digantikan sertifikat kursus |
| `PAYMENT_LOCKED` | Pembayaran sudah diproses admin |
| `AMOUNT_INSUFFICIENT` | Nominal diterima < tagihan |

## Rate limit (per IP, default)

- Auth/OTP/voucher/redeem/invitation/quiz/payments/uploads: 30x/15 mnt.
- Baca publik (katalog, verifikasi sertifikat, berkas): 600x/15 mnt.
- Pengajuan publik: 10x/15 mnt.
- Klien WAJIB menampilkan pesan 429 apa adanya + tombol coba lagi.
