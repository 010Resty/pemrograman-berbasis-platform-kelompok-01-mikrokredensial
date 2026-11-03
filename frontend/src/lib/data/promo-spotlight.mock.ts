/**
 * DATA CONTOH — KHUSUS PRATINJAU PENGEMBANGAN. BUKAN DATA NYATA.
 *
 * Backend ARISTOTELES saat ini TIDAK memiliki endpoint/field promo
 * (tidak ada harga coret, persen diskon, tanggal promo, maupun flag unggulan
 * pada kontrak `BackendCourse`). Sampai kontrak itu ada, section "Promo
 * Pelatihan" di beranda memakai daftar contoh di bawah ini.
 *
 * Aturan pakai (wajib):
 * - Hanya aktif bila `import.meta.env.DEV` DAN URL memuat `?mock=promo`.
 * - Halaman WAJIB menampilkan penanda "Mode Pratinjau" saat mock aktif.
 * - DILARANG menampilkan angka di bawah ini sebagai promo nyata.
 * - Di produksi (atau tanpa flag), section promo menampilkan empty state.
 *
 * Kontrak backend yang dibutuhkan agar mock ini bisa dihapus:
 *   GET /api/v1/courses?hasPromo=true  → 200 { items: BackendCourse[] }
 *   dengan tambahan field per kursus: `normalPriceLabel: string | null`
 *   dan `discountPercent: number | null` (1–90), plus `promoEndsAt?: string`.
 * Sampai saat itu, JANGAN mengarang endpoint tersebut.
 */

export interface PromoSpotlightMock {
	/** ID kursus katalog yang ditempeli promo contoh. Baris tanpa pasangan diabaikan. */
	courseId: number;
	/** Harga coret CONTOH (string tampilan, bukan dari backend). */
	normalPriceLabel: string;
	/** Persen diskon CONTOH (1–90). Nilai di luar itu diabaikan oleh UI. */
	discountPercent: number;
	/** Label pita CONTOH, mis. "Promo Akhir Tahun". */
	badgeLabel: string;
}

/**
 * Contoh 3 promo. ID di bawah adalah contoh; bila tidak cocok dengan katalog
 * lokal, UI otomatis memakai 3 kursus terbit pertama sebagai pasangan
 * (tetap dalam mode pratinjau — lihat `resolvePromoSpotlight`).
 */
export const PROMO_SPOTLIGHT_MOCK: PromoSpotlightMock[] = [
	{ courseId: 1, normalPriceLabel: 'Rp349.000', discountPercent: 30, badgeLabel: 'Promo Akhir Tahun' },
	{ courseId: 2, normalPriceLabel: 'Rp249.000', discountPercent: 20, badgeLabel: 'Promo Pelajar Baru' },
	{ courseId: 3, normalPriceLabel: 'Rp199.000', discountPercent: 50, badgeLabel: 'Promo Merdeka Belajar' }
];

/** Batas kewajaran agar tidak ada diskon 0% atau di luar nalar yang tampil. */
export function isValidMockPromo(p: PromoSpotlightMock): boolean {
	return (
		Number.isInteger(p.discountPercent) &&
		p.discountPercent >= 1 &&
		p.discountPercent <= 90 &&
		p.normalPriceLabel.trim().length > 0
	);
}
