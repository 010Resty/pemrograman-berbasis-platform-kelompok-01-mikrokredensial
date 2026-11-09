# `frontend/shared/` — Kontrak API + Skenario Uji Multi-Platform

Direktori ini adalah **satu-satunya acuan kontrak** yang dipakai bersama
aplikasi web (`frontend/web`, SvelteKit/TypeScript) dan aplikasi Android
(`frontend/android`, Flutter/Dart).

## Kenapa ada direktori ini

Klien web dan Android ditulis dalam bahasa berbeda sehingga **tidak bisa
berbagi kode** API client. Yang dibagi adalah kontrak:

- `contract/envelope.md` — bentuk respons, skema auth, konvensi umum.
- `contract/endpoints.json` — daftar endpoint yang dipakai aplikasi
  (machine-readable; bisa dipakai generator klien / test).
- `scenarios/k-01-k-08.md` — skenario uji HTTP per aturan bisnis.
  Kedua platform wajib lolos skenario yang sama.

Kontrak normatif lengkap tetap `backend/docs/API_CONTRACT.md`.
Bila keduanya berbeda, yang menang adalah perilaku backend aktual
(verifikasi dengan test integrasi backend).

## Aturan perubahan

1. Backend berubah → perbarui `endpoints.json` + `scenarios/` + `CHANGELOG.md`
   dalam commit yang sama.
2. Jangan menambah endpoint di sini yang tidak ada di backend.
3. Versi kontrak mengikuti versi backend (`package.json` backend).

## Konsumsi

- Web: `frontend/web/src/lib/api/*.ts` sudah mengikuti kontrak ini.
- Android (Flutter, Tahap 3+): tulis `lib/api/*_api.dart` mengikuti
  `endpoints.json`; uji dengan skenario di `scenarios/`.
