# AGENTS — ARISTOTELES

Panduan kerja agen coding. Ringkas dan wajib diikuti.

## 1. Identitas dan tujuan

Frontend LMS mikrokredensial. Portal: publik, `/user`, `/instruktur`, `/admin`.
Tujuan: kerjakan permintaan kecil dengan aman, jaga fitur lain, lapor jujur.
Perintah: `npm run dev`, cek: `npm run check`. Jangan install, migrasi, build, deploy tanpa diminta eksplisit.

## 2. Teknologi terverifikasi

Svelte 5 + SvelteKit 2, TypeScript strict, Tailwind 4, Tiptap.
Runes `$state/$derived/$effect`, `SvelteSet/Map`.
`src/lib/data/` statis, `src/lib/stores/` lokal, `materials/* + MaterialRenderer`, `training/atoms|molecules|organisms`, `src/lib/tiptap/extensions.ts`.
Proxy `src/routes/api/assignments/upload/+server.ts` dan `grade/[id]/+server.ts` fallback mock bila backend offline.
Tidak ada bukti JWT, database, gateway, storage file di repo frontend.

## 3. Dokumentasi wajib dibaca

Sebelum coding baca minimal: `docs/01-ringkasan-proyek.md`, `docs/06-aturan-bisnis.md`, `docs/09-keputusan-proyek.md`, lalu `docs/04-inventaris-fitur.md` dan `docs/07-risiko-dan-validasi.md` untuk area yang disentuh.
Jika kode berbeda dari keputusan, catat sebagai gap. Jangan ubah kode agar tampak sesuai.

## 4. Aturan bisnis K-01–K-08

Acuan utama: `docs/06-aturan-bisnis.md` dan `docs/09-keputusan-proyek.md`. Jangan duplikasi tabel ke sini.
Keputusan = target disepakati 2026-10-24, bukan bukti sudah diimplementasikan:
K-01 admin-only undang instruktur; K-02 kuis tanpa batas nilai terbaik default 70; K-03 voucher resmi admin 1 akun + 1 kursus 1x pakai anti-race; K-04 materi biasa selesai via Berikutnya; K-05 sertifikat per modul bersyarat; K-06 tugas boleh ulang tanpa batas pakai rubrik; K-07 modul independen; K-08 ubah materi tidak hapus progres.
Gunakan `docs/04` untuk status implementasi dan gap. Detail undangan, format riwayat, rubrik, daftar sekuensial, definisi penting masih belum diputuskan.

## 5. Keamanan dan data sensitif

Auth dan otorisasi tidak boleh hanya frontend atau `localStorage`.
Jangan percaya `aristoteles-session`, `owned-courses`, `VALID_CODES`, `purchaseCourse` lokal.
Jangan baca atau tulis rahasia, token, password, nilai environment ke kode maupun dokumen.
Sanitasi output `{@html}` dari Tiptap. Validasi file (tipe, ukuran, magic bytes) tetap wajib di server.

## 6. Ruang lingkup perubahan kode

Kerjakan sesuai permintaan saja. Jangan sentuh file, route, config, atau dependensi di luar itu.
Jangan tambah editor duplikat (`CurriculumEditor` vs inline), jangan ganti pola modal selain `WarningModal.svelte` tanpa alasan.
Jangan hapus `markDone`, `normalizePassScore`, `withSyncedFlat` tanpa pengganti.

## 7. Integrasi dan mock

Jangan mengarang API, tabel, payload, atau layanan eksternal.
`docs/05-kebutuhan-backend.md` adalah usulan, bukan bukti endpoint sudah ada.
Mock harus dilabeli mock. Jangan kembalikan sukses palsu (misal 201 mock) sebagai sukses nyata.

## 8. Validasi dan pengujian

Jalankan cek sesuai perubahan, minimal `npm run check` untuk Svelte/TS.
Pilih uji relevan dari `docs/07-risiko-dan-validasi.md` (misal kuis 60→80, voucher salah, refresh progres, K-04, K-07).
Laporkan hasil sebenarnya, termasuk yang gagal.

## 9. Git

Periksa `git status --short` dan diff sebelum dan sesudah kerja.
Jangan menghapus atau menimpa perubahan yang sudah ada. Tugas dokumentasi hanya boleh menyentuh file dokumentasi yang diminta.

## 10. Format laporan akhir

Wajib tulis: file yang berubah dan alasannya, pengujian dan hasil nyata, risiko yang tersisa, pekerjaan belum selesai dan gap K terkait.
