/**
 * Utilitas tampilan harga (dipakai katalog & patungan).
 *
 * Catatan: voucher akses/diskon, nomor referensi, dan invoice TIDAK lagi
 * didefinisikan di sini — semuanya dari backend (modul vouchers/payments).
 * Metode bayar satu-satunya adalah QRIS manual tanpa biaya layanan fiktif.
 * Jangan menambah kode statis di berkas ini.
 */

/** "Rp349.000" -> 349000. "GRATIS" -> 0. */
export function parsePrice(price: string): number {
	const digits = price.replace(/[^0-9]/g, '');
	if (!digits) return 0;
	return Number.parseInt(digits, 10);
}

export function formatIDR(value: number): string {
	return new Intl.NumberFormat('id-ID', {
		style: 'currency',
		currency: 'IDR',
		minimumFractionDigits: 0,
		maximumFractionDigits: 0
	}).format(value);
}
