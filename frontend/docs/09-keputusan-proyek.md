# 09 — Log Keputusan Proyek ARISTOTELES

> Tanggal pencatatan: 2026-10-24. Status `Disepakati` = dipilih pemilik proyek untuk dokumentasi; implementasi lihat kolom catatan. Jangan baca sebagai sudah selesai di kode.

| ID | Judul | Keputusan | Status | Alasan | Dampak | Catatan implementasi / belum diputuskan |
|---|---|---|---|---|---|---|
| K-01 | Akun instruktur | Hanya admin buat/undang fase awal, tanpa daftar bebas | Disepakati [Keputusan pengguna] | Cegah akun liar | Blokir `register` peran teacher, perlu alur undangan di `05`/`06` | Detail undangan, aktivasi, password [Belum diputuskan]. Gap [Terverifikasi]: kode masih bebas |
| K-02 | Ulang kuis | Tanpa batas, nilai terbaik, default 70 bisa diubah per kuis, lulus bertahan, riwayat backend | Disepakati [Keputusan pengguna] | Adil + fleksibel | Simpan riwayat + validasi server, ubah `quiz-results` | Format riwayat [Belum diputuskan]. Gap: simpan terakhir saja |
| K-03 | Voucher gratis | Resmi, admin saja, 1 akun + 1 kursus, tukar kode, validasi 4 cocok backend, 1x pakai, status Aktif/Digunakan/Dinonaktifkan, tersedia sampai dipakai/dinonaktifkan, catat penerima+kursus+waktu+status, anti-race | Disepakati [Keputusan pengguna] | Akses gratis terkendali | Ganti `VALID_CODES` lokal | Masa berlaku opsional. Gap: lokal saja |
| K-04 | Selesai materi | Biasa via Berikutnya, tanpa tombol terpisah, tidak meluluskan kuis/tugas | Disepakati [Keputusan pengguna] | Sederhana | Pertahankan `markDone` navigasi | Sesuai kode [Terverifikasi] |
| K-05 | Sertifikat modul | Otomatis bila semua materi wajib selesai + kuis wajib lulus + tugas penuhi syarat; per modul 1 sertifikat; identitas/tanggal/verifikasi/cabut sebagai kebutuhan | Disepakati [Keputusan pengguna] | Standar lulus | Gate otomatis + verifikasi | Format identitas [Belum diputuskan]. Gap: UI statis |
| K-06 | Kumpul ulang tugas | Tanpa batas sampai lulus, belum lulus belum penuhi sertifikat, nilai rubrik, riwayat backend berkas+waktu+nilai+feedback+status | Disepakati [Keputusan pengguna] | Kesempatan | Riwayat + rubrik | Rubrik seragam? [Belum diputuskan]. Revisi tanpa batas sudah ada sebagian |
| K-07 | Modul independen | Bisa mulai mana saja setelah akses kursus, sertifikat per modul, kunci hanya sub/materi sekuensial | Disepakati [Keputusan pengguna] | Fleksibel | Lepas kunci antar-modul umum | Daftar sekuensial [Belum diputuskan]. Gap: kode masih kunci |
| K-08 | Ubah materi | Tidak hapus progres otomatis, ulang sengaja terdampak saja, catat perubahan+terdampak+alasan+status | Disepakati [Keputusan pengguna] | Lindungi progres | Versi + log | Definisi penting + kewenangan [Belum diputuskan]. Gap: tanpa versi |
