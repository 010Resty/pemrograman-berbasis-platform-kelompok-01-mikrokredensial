---
name: flutter-performance-audit
description: "Performance audit for the ARISTOTELES Android app (Flutter, frontend/android). Use when asked to audit, profile, or optimize app performance: widget rebuilds, navigation/memory, network/API usage, image handling, existing ChangeNotifier+setState state management, backend interaction, and app size. Enforces inspect → measure → classify → propose → explicit approval → small-step implementation → verify workflow. Never rewrites architecture or replaces packages without approval."
---

# flutter-performance-audit

Skill audit + optimasi performa khusus aplikasi Android ARISTOTELES
(`frontend/android`, Flutter + Dart, Material 3).

**Bukan tugas implementasi.** Skill ini memandu agen melalui audit
terstruktur. Kode aplikasi **dilarang diubah** sampai pengguna memberi
persetujuan eksplisit atas rekomendasi tertentu.

## 1. Fakta arsitektur proyek (acuan wajib, jangan diasumsikan ulang)

Verifikasi ulang sebelum audit (struktur dapat berubah):

- Entry: `lib/main.dart` → `MaterialApp` → `SplashGate` → `HomeRouter`
  (routing per peran: student/teacher/admin).
- State management: `core/session.dart` (`SessionManager extends
  ChangeNotifier`, access token di memori, refresh token di
  `flutter_secure_storage`) + `setState` lokal + `AnimatedBuilder`.
  **Tidak ada** Riverpod/Bloc/GetX — jangan mengenalkan framework baru
  tanpa persetujuan eksplisit.
- Navigasi: tanpa named routes / go_router. Satu `Navigator` +
  `Navigator.push` + bottom nav `IndexedStack` di
  `features/home/role_home.dart` (dengan `tabsBuilder` untuk pindah tab
  dari Beranda). Semua 5 tab peserta aktif selalu di memori.
- API: `core/api_client.dart` (`http`, envelope ketat
  `{status,message,data}`, timeout 15 detik, 401 → silent-refresh
  single-flight + retry sekali, lalu `onUnauthorized` → hapus sesi).
  Pola panggil: kelas `*_api.dart` per fitur; daftar memakai
  `ListView.builder`; katalog memakai `limit=100` hardcoded.
- Cache: hanya `core/offline_cache.dart` (berkas JSON manual untuk
  daftar katalog + profil + sertifikat, TTL per kunci). Tidak ada cache
  respons HTTP umum.
- Gambar/media: `Image.network` / `NetworkImage` langsung **tanpa**
  pustaka cache (tidak ada `cached_network_image`); upload dipadatkan
  di klien (`image_picker`, `maxWidth: 1024`, `imageQuality: 85`).
  Aset bundel kecil: `assets/logo/aristoteleslogo.png` + `unira.jpeg`.
- Dependensi (tetap ramping — jangan tambah tanpa justifikasi):
  `http`, `flutter_secure_storage`, `image_picker`, `file_picker`,
  `path_provider`, `share_plus`.
- Mutu: `flutter analyze` (hanya `flutter_lints`), ~14 file uji
  (`test/*_test.dart`, mock HTTP via `MockClient`, tanpa backend).
- Backend terpisah (Express + MySQL, di luar repo ini untuk audit):
  tinjau dari sisi klien — pola query endpoint, parameter pagination
  (`limit`/`page`/`status`/`unseen`), ukuran payload, dan frekuensi
  panggilan. Jangan ubah backend dari skill ini.

## 2. Kapan skill ini dipakai

- Pengguna meminta "audit performa", "bikin lebih cepat / ringan",
  "cek jank / boros / bocor", atau menunjuk layar yang lambat.
- Selalu mulai dari Tahap A (inspeksi) walau pengguna sudah menuduh
  penyebabnya ("pasti karena X") — tuduhan tanpa ukuran = asumsi.

## 3. Alur kerja wajib (10 tahap, berurutan, tanpa lompat)

### Tahap A — Inspeksi codebase (read-only, tanpa ubah file apa pun)

Petakan area yang disentuh laporan pengguna:

1. Struktur layar yang dikeluhkan: entry point → widget tree →
   pemicu rebuild (`setState`, `notifyListeners`, `AnimatedBuilder`,
   `FutureBuilder`).
2. Navigasi: rute `push` vs tab `IndexedStack`; halaman apa saja yang
   ikut dibangun saat startup/tab pertama dibuka; apakah semua tab
   diinisialisasi sekaligus.
3. State: cakupan `notifyListeners` (global vs lokal); `AnimatedBuilder`
   mendengarkan `SessionManager` utuh atau secukupnya.
4. Jaringan: daftar endpoint yang dipanggil per layar (termasuk
   pemanggilan berantai/`Future.wait` fan-out, mis. per-kursus);
   ada/tidaknya pagination (`limit`/`page`); pemanggilan ulang saat
   rebuild; polling `Timer.periodic` (interval, cancel saat dispose?).
5. Gambar: `Image.network`/`NetworkImage` di daftar; ukuran file yang
   diunduh vs ukuran tampil; ada/tidaknya cache; `CustomPainter`
   per-frame vs sekali gambar.
6. Siklus hidup: `dispose()` untuk `TextEditingController`,
   `Timer`, `ScrollController`, `AnimationController`, stream/listener.
7. Ukuran: daftar dependensi di `pubspec.yaml` vs pemakaian aktual;
   ukuran aset di `assets/`; catatan ukuran APK terakhir bila ada.

### Tahap B — Tetapkan baseline terukur

Tanpa angka awal, klaim perbaikan dilarang. Pilih yang relevan:

- `flutter analyze` → catat jumlah issue (target: 0).
- `flutter test` → catat lulus/gagal (target: semua hijau).
- Mode profile (`flutter run --profile`): uji skenario yang dikeluhkan
  (mis. buka Beranda, scroll Katalog, pindah tab) sambil merekam
  DevTools → Performance (frame time, jank >16ms, rebuild counts
  via "Track widget rebuilds").
- Ukuran rilis: `flutter build apk --analyze-size` (atau
  `--split-per-abi` bila relevan); catat total + kontributor besar.
- Inventaris jaringan per layar: daftar endpoint + frekuensi + estimasi
  payload (dari kontrak `frontend/shared/contract/endpoints.json`
  dan bentuk respons aktual). Boleh tambah logging sementara **hanya**
  untuk pengukuran, dan hapus kembali sebelum selesai.

### Tahap C — Identifikasi masalah nyata (bukti, bukan teori)

Setiap temuan WAJIB menunjuk bukti: potongan kode + jalur pemicu
(mis. "setState di X membangun ulang Y karena Z") atau angka DevTools.
Daftar periksa khusus ARISTOTELES (telusuri, jangan diasumsikan ada):

- Widget: `build()` yang memanggil API/membuat objek berat; widget
  raksasa monolitik (>~300 baris UI campur logika); `setState`
  lingkup halaman untuk perubahan kecil (badge, counter, countdown);
  `const` yang hilang di subtree statis; `ListView` berisi anak
  berat tanpa `itemExtent`/tanpa `RepaintBoundary` di area animasi.
- Navigasi/memori: semua tab `IndexedStack` memuat data saat startup
  (vs malas saat tab dibuka); `Timer.periodic` tanpa cancel di
  `dispose`; controller/listener tidak di-`dispose`; halaman detail
  memuat ulang data yang sudah ada di cache/offline.
- Jaringan/API: request ganda endpoint sama dalam satu alur
  (mis. profil + ringkasan + feed masing-masing hit endpoint terkait);
  fan-out N+1 (mis. tree kurikulum per kursus + progres per kursus);
  `limit=100` tanpa paginasi lanjutan; polling interval pendek tanpa
  backoff; fetch ulang penuh saat `RefreshIndicator` padahal data
  sebagian masih segar; request saat offline yang langsung gagal
  tanpa memakai cache.
- Gambar/media: `Image.network` resolusi penuh untuk thumbnail kecil;
  tanpa `cacheWidth`/`cacheHeight`; avatar di header dimuat ulang
  tiap rebuild; tidak ada placeholder/error yang ringan.
- State: `notifyListeners` global untuk perubahan lokal (mis. badge
  bell memicu rebuild seluruh header/pohon); `ApiClient` tanpa
  `tokenProvider` (pernah jadi bug logout massal — pastikan tetap
  ter-wire di `main.dart`).
- Backend (dari sisi klien): endpoint tanpa pagination yang dipakai
  untuk daftar berpotensi besar; field respons besar yang tidak
  dipakai UI (mis. konten penuh saat hanya butuh judul); polling
  status pembayaran tiap 5 detik setelah sukses (harus berhenti).

### Tahap D — Klasifikasikan temuan menurut severity

- **Kritis**: crash, ANR/jank parah terukur, kebocoran memori,
  pengurasan baterai/kuota nyata, logout massal, data hilang/rusak.
- **Tinggi**: pemborosan terukur di jalur panas (startup, tab utama,
  scroll daftar, polling) — mis. N+1 request, rebuild massal per
  detik, unduhan gambar berulang megabyte.
- **Sedang**: higiene performa (const hilang, widget monolitik,
  cache belum ada tapi dampak kecil, pagination belum dipakai tapi
  data masih kecil).
- **Rendah**: nit (penamaan, micro-style tanpa dampak terukur).

Satu temuan = satu baris: lokasi file + bukti + severity. Temuan
tanpa bukti turun minimal satu tingkat atau dibuang.

### Tahap E — Jelaskan sebab + solusi yang diusulkan

Untuk tiap temuan (Kritis/Tinggi wajib; Sedang/Rendah ringkas):

- Penyebab: mekanisme persisnya (bukan "mungkin").
- Solusi: langkah konkret terkecil yang memperbaiki, tetap dalam
  arsitektur yang ada (ChangeNotifier + setState + ApiClient +
  IndexedStack + OfflineCache).
- Alternatif yang dipertimbangkan dan alasan tidak dipilih
  (terutama bila alternatif = ganti arsitektur/paket).

### Tahap F — Sajikan rekomendasi ke pengguna dan BERHENTI

Tampilkan ringkasan audit (format di Bagian 5). **Jangan sentuh kode
aplikasi.** Tunggu persetujuan eksplisit per rekomendasi
("setuju nomor 1 dan 3", dsb.). Penolakan = rekomendasi dibatalkan,
bukan dilaksanakan diam-diam.

### Tahap G — Implementasi kecil bertahap (hanya yang disetujui)

- Satu rekomendasi = satu perubahan kecil + verifikasi langsung.
- Jangan campur beberapa rekomendasi dalam satu edit.
- Jangan ubah perilaku aplikasi, teks UI, atau kontrak API sebagai
  efek samping. Bila tak terhindarkan, minta persetujuan dulu.

### Tahap H — Jalankan analisis + uji terkait

- `flutter analyze` harus 0 issue.
- `flutter test` penuh harus hijau; tambah/ubah uji bila perilaku
  (bukan performa) ikut tersentuh.

### Tahap I — Bandingkan pengukuran sebelum vs sesudah

Ulangi pengukuran Tahap B yang sama (skenario, perangkat/mode,
dan kondisi jaringan sebanding). Laporkan delta angka, bukan kesan.

### Tahap J — Tutup dengan laporan akhir (format Bagian 5)

## 4. Batasan keamanan dan mutu (mengikat, tidak bisa ditawar)

1. Jangan tulis ulang arsitektur (state management, navigasi,
   lapisan API) tanpa persetujuan eksplisit.
2. Jangan ganti/menambah/menghapus package tanpa justifikasi
   kebutuhan + dampak ukuran; `cached_network_image` dkk. hanya bila
   pengukuran membuktikan butuh.
3. Jangan mengoptimasi berdasarkan asumsi — selalu ada baseline dan
   bukti.
4. Jangan menghapus fitur demi angka performa.
5. Jangan mengubah perilaku aplikasi secara tak sengaja (aliran auth,
   polling pembayaran DOKU, verifikasi OTP, idempotensi create).
6. Pertahankan sistem desain UI yang ada (tema terang akademik,
   `AppTopBar`, kartu, tile, `AuthBackground`).
7. Hindari premature optimization; utamakan perbaikan terukur di
   jalur panas.
8. Jangan klaim perbaikan performa tanpa angka sebelum-vs-sesudah.
9. Jangan commit/push apa pun kecuali pengguna meminta eksplisit.
10. Jangan sentuh backend, environment, atau kredensial; scope hanya
    `frontend/android` (dan kontrak `frontend/shared` bila perlu
    dibaca saja).

## 5. Format keluaran wajib

### Ringkasan audit

1–3 paragraf: cakupan, metode pengukuran, kesimpulan umum.

### Temuan

| # | Lokasi (`path:baris`) | Bukti | Severity | Penyebab |
|---|---|---|---|---|
| 1 | ... | ... | Kritis/Tinggi/Sedang/Rendah | ... |

Kelompokkan: Kritis → Tinggi → Sedang → Rendah. Setiap baris harus
bisa dilacak ke kode atau angka.

### Rekomendasi optimasi

Untuk tiap rekomendasi (beri nomor R1, R2, ...):

- **Masalah yang diselesaikan** (rujuk ID temuan).
- **Perubahan yang diusulkan** (file + langkah konkret).
- **Dampak yang diharapkan** (angka: mis. "-N request saat buka
  Beranda", "-X ms frame p95", "-Y KB APK") + cara mengukurnya.
- **Risiko** (regresi perilaku, cakupan uji yang menutupinya).
- **Status persetujuan**: `[ ] menunggu / [x] disetujui / [-] ditolak`.

### Hasil pengujian

- `flutter analyze`: (jumlah issue sebelum → sesudah).
- `flutter test`: (lulus/gagal sebelum → sesudah).
- Uji baru/diubah (bila ada): nama file + yang dicakup.

### Pengukuran sebelum vs sesudah

Tabel per skenario: metrik, sebelum, sesudah, delta, metode ukur,
kondisi uji (perangkat/emulator, profile/debug, jaringan).
Contoh metrik: waktu buka Beranda s.d. idle, frame >16ms saat scroll
katalog 60 detik, jumlah request HTTP per skenario, ukuran APK.

## 6. Catatan khusus ARISTOTELES (jebakan yang sudah diketahui)

- `NetworkImage`/`Image.network` tanpa cache: daftar kursus +
  avatar memicu unduhan ulang tiap rebuild — kandidat utama audit
  gambar.
- `CatalogApi.tree()` bersifat N+1 (modules → submodules →
  materials berurutan); `student_dashboard` + `kursusku` memanggilnya
  per kursus — kandidat utama audit jaringan.
- `PaymentPage` memakai `Timer.periodic` 5 detik — pastikan berhenti
  setelah diverifikasi/ditolak/batal dan di-`dispose`.
- `SessionManager.refreshNow` single-flight: jangan picu refresh
  manual berulang; satu 401 = satu upaya refresh.
- `OfflineCache` hanya untuk katalog/profil/sertifikat — halaman lain
  gagal total saat offline; bedakan "gagal offline wajar" dari bug.
- Lima tab peserta hidup bersamaan di `IndexedStack` — audit inisiasi
  data tiap tab (malas vs langsung).
