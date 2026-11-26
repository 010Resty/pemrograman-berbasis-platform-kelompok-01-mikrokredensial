# Login with UNIRA — Alur End-to-End

Dokumen ini menjelaskan alur login akun SIMAT Universitas Madura (UNIRA)
di aplikasi ARISTOTELES, dari form hingga sesi terbentuk.
Cakupan: web (SvelteKit) + backend (Express). Android mengikuti kontrak
yang sama (`POST /api/v1/auth/unira/login`).

Prinsip yang dipegang:
- Password SIMAT hanya transit di memori backend selama satu request —
  tidak disimpan, tidak di-log, tidak dikirim ke frontend.
- Token JWT UNIRA tidak pernah dikirim ke frontend / disimpan permanen.
- Yang menentukan benar/salah adalah server UNIRA, bukan validasi lokal.
- Akun baru otomatis `role=student`; role lama (instruktur/admin)
  dipertahankan; akun nonaktif ditolak.

---

## 1. Diagram alur

```
[Form with_UNIRA] -- NIM+password --> [Backend /auth/unira/login]
                                              |
                                              | POST /v1/token (form-urlencoded)
                                              v
                                       [API UNIRA] -- access_token --> [Backend]
                                              |
                                              | GET /v1/saya (Bearer + header browser)
                                              v
                                       [API UNIRA] -- profil mahasiswa --> [Backend]
                                              |
                                              | cocokkan/buat akun (transaksi DB)
                                              v
                                      [DB users + user_auth_providers]
                                              |
                                              | terbitkan JWT Aristoteles + refresh token
                                              v
[Form] <-- { accessToken, refreshToken, user } <-- [Backend]
   |
   | simpan sesi + redirect ke /user
   v
[Dashboard] -- <img avatarUrl --> [Backend /auth/unira/photo/:id]
                                              |
                                              | GET foto SIMAT (server-to-server, cache 1 jam)
                                              v
                                       [API UNIRA img] --> [Browser]
```

## 2. Langkah 1 — Form (frontend)

Halaman: `frontend/web/src/routes/[lang]/with_UNIRA/+page.svelte`

- Input: NIM (8–15 digit, spasi otomatis dibuang) + password SIMAT.
- Validasi lokal hanya format dasar (angka, panjang) dengan pesan
  bahasa ID/EN. `novalidate` dipakai agar pesan error konsisten
  (bukan bubble bawaan browser).
- Submit → `loginWithUniraBackend()` →
  `POST {PUBLIC_API_BASE_URL}/auth/unira/login`:

```http
POST /api/v1/auth/unira/login HTTP/1.1
Content-Type: application/json

{ "username": "2024520011", "password": "••••••••" }
```

- Sukses → sesi disimpan (ingat-saya: localStorage; sesi: sessionStorage),
  redirect ke `homeFor(role)` (`/user` untuk student).
- Gagal → pesan error backend ditampilkan via toast (tanpa detail teknis).

## 3. Langkah 2 — Validasi backend

Route: `POST /api/v1/auth/unira/login`
(`backend/src/modules/auth/auth.routes.ts` + `authOtpLimiter()` 30x/15 mnt/IP)

Schema Zod (`unira.service.ts`):

```json
{ "username": "<8–15 digit>", "password": "<1–256 karakter>" }
```

Gagal validasi → `400 { status:"error", message:"Data login tidak valid", errors:[...] }`

## 4. Langkah 3 — Tukar kredensial ke token UNIRA

`backend/src/modules/auth/unira.client.ts` → `requestUniraToken()`

```http
POST https://api.unira.ac.id/v1/token HTTP/1.1
Content-Type: application/x-www-form-urlencoded
Accept: application/vnd.api+json

username=2024520011&password=••••••••&client=simat
```

Respons sukses (JSON:API, contoh struktur — nilai disensor):

```json
{
  "jsonapi": { "version": "1.0" },
  "meta": { "authors": "unira", "copyright": "(2017) Universitas Madura" },
  "data": {
    "id": 951881,
    "type": "token",
    "attributes": {
      "access": "<JWT 5 menit>",
      "refresh": "<JWT>"
    }
  }
}
```

Isi klaim `access` (hasil decode, tanpa verifikasi signature):

```json
{
  "iat": 1795530663, "jti": 951881, "exp": 1795530963,
  "iss": "unira.ac.id",
  "dat": { "id": "m951881h2024520011s", "prodi": 52, "type": "mhs", "access": null }
}
```

- Token hidup ±5 menit — langsung dipakai langkah 4, tidak disimpan.
- Kredensial salah (401/422/400) → `401 "NIM atau password SIMAT tidak valid"`.
- Timeout/gangguan/5xx UNIRA → `503 "Layanan autentikasi UNIRA sedang tidak tersedia..."`.
- Struktur tak dikenal → `502 "Identitas pengguna tidak dapat diverifikasi..."`.

## 5. Langkah 4 — Ambil profil resmi (`GET /v1/saya`)

`fetchUniraProfile()` — bagian paling sensitif. API menolak request
tanpa header browser (403), sehingga backend meniru persis request
browser SIMAT yang terbukti berhasil:

```http
GET https://api.unira.ac.id/v1/saya HTTP/1.1
Authorization: Bearer <ACCESS_TOKEN>
Accept: */*
Origin: https://simat.unira.ac.id
Referer: https://simat.unira.ac.id/
User-Agent: Mozilla/5.0 (Linux; Android 10; ...) Chrome/126.0.0.0 Mobile Safari/537.36
Accept-Language: id-ID,id;q=0.8
```

Respons sukses (nilai contoh — hanya field bertanda ★ yang dipakai):

```json
{
  "data": {
    "id": "2024520011",            // ★ identifier stabil (NIM)
    "type": "pengguna",
    "attributes": {
      "type": "mhs",
      "prodi": 52,                 // ★ (angka → string "52")
      "nama": "NAMA MAHASISWA",   // ★
      "email": "mhs@example.ac.id", // ★
      "status": "aktif",           // ★ ditolak bila nonaktif/keluar/dropout
      "thumbnail": "img/profil/mhs/abc123.jpg", // ★ foto (relatif)
      "kelas": 0, "alamat": "...", "telepon": "...", "nik": 0
    },
    "relationship": { "dosenwali": { "..." }, "upload": [ "..." ] }
  }
}
```

- Field sensitif (`alamat`, `telepon`, `nik`, `namaibu`, ...) **sengaja
  tidak dibaca** — hanya `id/nama/email/prodi/status/thumbnail`.
- `thumbnail` relatif → diabsolutkan ke `https://api.unira.ac.id/...`
  (host web SIMAT memberi 404 untuk path ini; host API memberi `image/jpeg`).
- Status non-aktif (`nonaktif/keluar/dropout/do/diberhentikan`) →
  `403 "Status akademik SIMAT tidak aktif"`.
- Profil gagal (403/404/struktur asing/NIM ≠ input) → `502`, kecuali mode
  fallback eksperimen aktif (lihat §8).

## 6. Langkah 5 — Cocokkan / buat akun (`unira.service.ts`)

Seluruh tulis DB berjalan dalam transaksi + `UNIQUE(provider, provider_user_id)`
agar dua login bersamaan tidak membuat akun ganda.

| Kasus | Kondisi | Aksi |
|---|---|---|
| A. Provider terhubung | `(unira, provider_user_id)` ada | Pakai akun lama apa adanya |
| B. Link by-NIM | `provider_username = NIM` ada (sesi token baru / migrasi trial) | Pakai akun itu; segarkan stable id; backfill nama/email/foto bila masih placeholder |
| C. Email kampus cocok | `users.email = email profil` | Hubungkan provider ke akun lama |
| D. Baru | tidak ada yang cocok | Buat akun `role=student`, `emailVerifiedAt=now()`, password acak tak-terpakai + relasi provider |
| E. Role lama | akun instructor/admin terhubung | Role **dipertahankan**, tidak diturunkan |

- Akun `isActive=false` → `403 "Akun ARISTOTELES dinonaktifkan"` di semua kasus.
- Foto: `thumbnail` disimpan ke `users.avatar_url`; upload manual
  (`avatar_file_id`) selalu menang dan tidak pernah ditimpa.

## 7. Langkah 6 — Terbitkan sesi Aristoteles

Respons sukses (identik bentuknya dengan login email agar store
frontend, guard portal, dan silent-refresh tidak berubah):

```http
HTTP/1.1 200 OK

{
  "status": "success",
  "message": "Login berhasil",
  "data": {
    "message": "Login berhasil",
    "accessToken": "<JWT Aristoteles 15 mnt>",
    "refreshToken": "<opaque 64-hex, sekali pakai>",
    "user": {
      "id": 22, "name": "NAMA MAHASISWA", "username": "2024520011",
      "email": "mhs@example.ac.id", "role": "student",
      "avatarUrl": "/api/v1/auth/unira/photo/22"
    }
  }
}
```

JWT UNIRA **tidak ada** di respons ini. Frontend menyimpan pasangan sesi
dan redirect ke portal sesuai role.

## 8. Langkah 7 — Foto profil (proxy same-origin)

`<img src="/api/v1/auth/unira/photo/22">` → `GET /api/v1/auth/unira/photo/:userId`
(publik per-user seperti berkas avatar, rate-limit baca publik):

1. Ambil `avatar_url` dari DB → fetch server-to-server ke UNIRA
   (tanpa referer browser) → validasi `Content-Type: image/*` + magic
   bytes (JPEG/PNG/GIF/WEBP) + maks 512KB.
2. Sajikan dengan `Content-Type` benar + `Cache-Control: public, max-age=3600`
   + `Cross-Origin-Resource-Policy: cross-origin` (wajib: frontend dan API
   beda port sehingga header CORP `same-origin` bawaan Helmet memblokir `<img>`).
3. Cache memori 1 jam per user. Gagal → `404` → frontend menampilkan
   inisial nama (fallback `onerror` di `UserAvatar`/`Sidebar`).

Kenapa tidak hotlink langsung: respons UNIRA di konteks browser diblokir
CORB (bukan JPEG yang dikenali), sehingga proxy adalah satu-satunya cara
yang andal.

## 9. Tabel error

| HTTP | Pesan | Penyebab |
|---|---|---|
| 400 | Data login tidak valid (+`errors`) | NIM bukan 8–15 digit / password kosong |
| 401 | NIM atau password SIMAT tidak valid | Kredensial ditolak `/v1/token` |
| 403 | Status akademik SIMAT tidak aktif | `status` profil non-aktif |
| 403 | Akun ARISTOTELES dinonaktifkan | `users.is_active = false` |
| 409 | Akun sudah terdaftar. Coba masuk kembali. | Race insert bersamaan |
| 429 | Terlalu banyak ... | Rate-limit IP / UNIRA |
| 502 | Identitas pengguna tidak dapat diverifikasi melalui UNIRA | `/v1/saya` 401/403/404 / struktur asing / NIM mismatch |
| 503 | Layanan autentikasi UNIRA sedang tidak tersedia... | Timeout / jaringan / 5xx UNIRA |
| 500 | Terjadi kesalahan internal | Tak terduga (lihat log server) |

Detail diagnosis (langkah + status HTTP, tanpa rahasia/PII) tercatat di
terminal backend dengan prefix `[unira:token]`, `[unira:profile]`,
`[unira:photo]`.

## 10. Konfigurasi & migrasi

Env (`backend/.env`, contoh di `.env.example`):

```env
UNIRA_API_BASE_URL=https://api.unira.ac.id
UNIRA_TIMEOUT_MS=10000
UNIRA_CLIENT=simat
UNIRA_PROFILE_PATH=/v1/saya
UNIRA_ORIGIN=https://simat.unira.ac.id
UNIRA_REFERER=https://simat.unira.ac.id/
UNIRA_PHOTO_BASE_URL=https://api.unira.ac.id
# Eksperimen saja (profil 403): true = izinkan login via klaim token
# dengan akun placeholder (nama + email sintetis).
UNIRA_ALLOW_UNVERIFIED_CLAIM_FALLBACK=false
```

Migrasi (sekali, berurutan):

```bash
cd backend
npm run db:migrate   # 0036_user_auth_providers, 0037_avatar_url
```

Verifikasi:

```bash
npx tsc --noEmit          # backend
npm run check             # frontend (dari frontend/web)
```

Uji manual: logout → login UNIRA (NIM + password SIMAT) → dashboard `/user`
terbuka + foto tampil. Untuk diagnosis sertakan baris log `[unira:...]`
dari terminal backend (tanpa password/token).
