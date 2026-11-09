/**
 * Estimator iuran patungan (klien).
 *
 * Grup patungan resmi kini hidup di server (`POST /patungan/groups`):
 * anggota username tervalidasi, iuran sendiri-sendiri, akses dibuka
 * setelah semua lunas. Modul ini HANYA menghitung estimasi tampilan
 * (harga katalog + fee ÷ anggota); angka resmi selalu dari server
 * saat validasi/buat grup. Tidak ada grup lokal, tidak ada status
 * lunas lokal — jangan menambahkannya lagi di sini.
 */

/** Batas anggota per grup (termasuk pembuat), selaras backend. */
export const PATUNGAN_MIN_ANGGOTA = 2;
export const PATUNGAN_MAX_ANGGOTA = 15;

/** Bagi rata tagihan (total + fee) ke N anggota, dibulatkan ke atas. Estimasi tampilan saja. */
export function hitungPatungan(
	priceNominal: number,
	feeNominal: number,
	anggota: number
): { total: number; perPerson: number } {
	const total = Math.max(0, Math.round(priceNominal) + Math.round(feeNominal));
	const n = Math.min(PATUNGAN_MAX_ANGGOTA, Math.max(PATUNGAN_MIN_ANGGOTA, Math.floor(anggota)));
	return { total, perPerson: Math.ceil(total / n) };
}
