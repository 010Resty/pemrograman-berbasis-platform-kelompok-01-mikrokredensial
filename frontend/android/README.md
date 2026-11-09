# ARISTOTELES Android (Tahap 3–5 multi-platform)

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
  shared_ui.dart       # state loading/error/kosong, formatIDR, konfirmasi
  features/
    auth/              # splash, login, register, verify OTP, lupa/reset
    home/              # router + home per peran (menu navigasi nyata)
    catalog/           # Semua Kursus, Kursusku, detail kursus, materi, kuis, tugas
    payment/           # bayar QRIS, notifikasi, unggah bukti, polling
    certificate/       # sertifikat saya, unduh PDF, verifikasi publik
    profile/           # lihat + ubah profil (termasuk voucher diskon)
    instructor/        # kursusku, antrean penilaian + rubrik, sertifikat
    admin/             # dasbor, peserta, undangan, voucher, verifikasi bayar
test/
  envelope_test.dart   # unit parser envelope + model (tanpa jaringan)
  api_contract_test.dart # kontrak endpoint vs mock HTTP (tanpa backend)
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
flutter test      # unit envelope, model, kontrak endpoint (mock HTTP)
```

> Windows: bila username Windows mengandung spasi, `flutter test/run`
> bisa gagal membangun native-assets (`objective_c` hook). Solusi:
> pindahkan pub cache ke path tanpa spasi, mis. `C:\pub-cache`, lalu
> `setx PUB_CACHE C:\pub-cache` (permanen, buka terminal baru) dan
> `flutter pub get` ulang.

## Batasan (disengaja, sesuai rencana)

- Online-only: tanpa cache offline dan tanpa push notification.
- Logout menghapus sesi perangkat ini; "keluar semua perangkat" menyusul
  bila dibutuhkan (endpoint `/auth/logout` tanpa token sudah didukung).
- Avatar profil belum dapat diubah dari aplikasi (baca/tulis field teks saja).
