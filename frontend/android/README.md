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
  widgets/
    app_logo.dart      # logo + wordmark (cermin web Logo.svelte)
    auth_background.dart # gradien biru + bercak (latar semua layar auth)
    app_top_bar.dart   # TopAppBar peserta + SectionHeader (judul + aksi)
    course_card.dart   # kartu kursus bersama (tanpa rating/instruktur palsu)
    activity_tile.dart # baris timeline aktivitas (tanpa skor/kejadian palsu)
    google_g_icon.dart # ikon "G" multicolor (tanpa dep baru)
    section_header.dart # judul section + aksi "Lihat Semua"
  shared_ui.dart       # state loading/error/kosong, formatIDR, konfirmasi
  features/
    auth/              # splash, login, register, verify OTP, lupa/reset
    home/              # router + home per peran + beranda peserta + top bar
    catalog/           # Semua Kursus (Jelajahi), Kursusku, detail kursus,
                       # materi, kuis, tugas + progres per kursus (real)
    activity/          # timeline pembayaran + sertifikat (+ filter)
    promo/             # daftar + detail kampanye promo (tanpa kuota palsu)
    payment/           # bayar QRIS, unggah bukti, polling
    certificate/       # sertifikat saya, unduh PDF, verifikasi publik
    profile/           # lihat + ubah profil (+ avatar, kata sandi, keluar)
    instructor/        # kursusku, antrean penilaian + rubrik, sertifikat
    admin/             # dasbor, laporan, peserta, undangan, voucher, verifikasi bayar
test/
  envelope_test.dart   # unit parser envelope + model (tanpa jaringan)
  api_contract_test.dart # kontrak endpoint vs mock HTTP (tanpa backend)
  bottom_nav_test.dart # widget bottom nav per peran + menu "Lainnya" (tanpa jaringan)
  activity_feed_test.dart # gabung + urut + label grup timeline (tanpa backend)
  promo_api_test.dart  # parsing promo + detail 404 → null (tanpa backend)
  student_dashboard_test.dart # render beranda + pintasan redirect tab (mock HTTP)
  ...
```

Kontrak acuan: `frontend/shared/` (envelope, 92 endpoint, skenario K-01–K-08, contractVersion 1.6.0).

Aset brand (`assets/logo/`, disalin dari `frontend/web/src/lib/assets/logo/`;
tiap platform membundel asetnya sendiri):
- `aristoteleslogo.png` — logo utama (dipakai `AppLogo` di splash + auth).
- `unira.jpeg` — logo ko-branding UNIRA (siap dipakai bila layar butuh).

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

## Status penyelesaian batasan sebelumnya

- ✅ Avatar profil dapat diubah dari aplikasi: pilih dari galeri
  (`image_picker`, downscale klien) → validasi JPG/PNG/WebP ≤2MB →
  `POST /uploads {kind: avatar}` → `PATCH /me/profile {avatarFileId}`.
  Hapus via `DELETE /me/profile/avatar`. Cermin web
  (`ProfileEditor.svelte` + `uploads.ts` + `profile.ts`).
- ✅ Cache offline (tanpa dep baru, `path_provider`):
  `lib/core/offline_cache.dart` menyimpan JSON `{savedAt, data}` per kunci
  dengan TTL (katalog 15 mnt, profil 30 mnt). Katalog + Profil menampilkan
  data tersimpan + spanduk "Offline" bila backend tak terjangkau.
  Cache dibersihkan saat logout agar data akun tak tertinggal.
- ✅ Notifikasi: polling lokal tiap 60 detik selama halaman Notifikasi aktif
  + pull-to-refresh + lencana BARU jujur via `lib/core/notification_center.dart`
  (diff vs terakhir dilihat di secure storage). Tanpa Firebase.
- ✅ Keluar semua perangkat: dialog keluar menawarkan "Perangkat ini" vs
  "Semua perangkat" (`POST /auth/logout` tanpa body mencabut semua sesi,
  cermin kontrak `API_CONTRACT.md` §2 + `SessionManager.logout(allDevices)`).

## Batasan tersisa (disengaja)

- Push FCM asli (Firebase project + `google-services.json` +
  `firebase_messaging`) belum dipasang — butuh setup native + kredensial
  Firebase yang belum diputuskan. Polling + lencana lokal di atas adalah
  pengganti sementara yang jujur.
- Online-first: tulis (bayar, kumpul tugas, kuis) tetap butuh koneksi;
  yang di-cache hanya baca (katalog, profil).
