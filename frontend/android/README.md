# ARISTOTELES Android (Tahap 3 multi-platform)

Aplikasi Flutter login-first — **tanpa rute publik, tanpa landing page**.
Pengguna wajib masuk (atau daftar + OTP) sebelum melihat konten apa pun.

## Struktur

```
lib/
  main.dart            # entry point + tumpukan layar auth + SplashGate
  core/
    config.dart        # API_BASE_URL via --dart-define (default emulator)
    api_client.dart    # envelope ketat {status,message,data} + timeout 15 dtk
    models.dart        # AppUser, AppRole, AuthPayload (cermin kontrak shared)
    auth_api.dart      # endpoint auth 1:1 kontrak (tanpa logika bisnis)
    session.dart       # access di memori, refresh di secure storage
  features/
    auth/              # splash, login, register, verify OTP, lupa/reset
    home/              # router per peran + cangkang home (isi Tahap 4-5)
test/
  envelope_test.dart   # unit parser envelope + model (tanpa jaringan)
```

Kontrak acuan: `frontend/shared/` (envelope, 80 endpoint, skenario K-01–K-08).

## Cara jalan

```sh
cd frontend/android
flutter pub get

# Emulator Android (10.0.2.2 = localhost mesin host):
flutter run

# Backend di URL lain:
flutter run --dart-define=API_BASE_URL=https://api.domain.id/api/v1
```

## Verifikasi

```sh
flutter analyze   # 0 issue
flutter test      # unit envelope + model
```

> Windows: bila username Windows mengandung spasi, `flutter test/run`
> bisa gagal membangun native-assets (`objective_c` hook). Solusi:
> pindahkan pub cache ke path tanpa spasi, mis. `C:\pub-cache`, lalu
> `setx PUB_CACHE C:\pub-cache` (permanen, buka terminal baru) dan
> `flutter pub get` ulang.

## Batasan Tahap 3 (disengaja)

- Home per peran masih cangkang: katalog, belajar, pembayaran, dan
  portal instruktur/admin hadir di Tahap 4–5.
- Online-only: tanpa cache offline dan tanpa push notification.
- Logout menghapus sesi perangkat ini; "keluar semua perangkat" menyusul
  bila dibutuhkan (endpoint `/auth/logout` tanpa token sudah didukung).
