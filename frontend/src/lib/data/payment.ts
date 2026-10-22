/** Katalog metode pembayaran + voucher + kalkulasi harga checkout. */

export type PaymentMethodId = 'qris' | 'va' | 'ewallet' | 'card' | 'retail';

export interface PaymentChannel {
	id: string;
	label: string;
	hint: string;
	icon: string;
}

export interface PaymentMethod {
	id: PaymentMethodId;
	label: string;
	description: string;
	icon: string;
	badge?: string;
	channels?: PaymentChannel[];
}

export const PAYMENT_METHODS: PaymentMethod[] = [
	{
		id: 'qris',
		label: 'QRIS',
		description: 'Scan sekali dari m-banking / e-wallet apa pun',
		icon: 'fa-qrcode',
		badge: 'Paling cepat'
	},
	{
		id: 'va',
		label: 'Virtual Account',
		description: 'Transfer via ATM, m-banking, atau internet banking',
		icon: 'fa-building-columns',
		channels: [
			{ id: 'bca', label: 'BCA', hint: 'Cek otomatis', icon: 'fa-building-columns' },
			{ id: 'bri', label: 'BRI', hint: 'Cek otomatis', icon: 'fa-building-columns' },
			{ id: 'mandiri', label: 'Mandiri', hint: 'Cek otomatis', icon: 'fa-building-columns' },
			{ id: 'bni', label: 'BNI', hint: 'Cek otomatis', icon: 'fa-building-columns' }
		]
	},
	{
		id: 'ewallet',
		label: 'E-Wallet',
		description: 'GoPay, OVO, DANA, ShopeePay',
		icon: 'fa-wallet',
		channels: [
			{ id: 'gopay', label: 'GoPay', hint: 'Otomatis', icon: 'fa-mobile-screen' },
			{ id: 'ovo', label: 'OVO', hint: 'Otomatis', icon: 'fa-mobile-screen' },
			{ id: 'dana', label: 'DANA', hint: 'Otomatis', icon: 'fa-mobile-screen' },
			{ id: 'shopeepay', label: 'SPay', hint: 'Otomatis', icon: 'fa-mobile-screen' }
		]
	},
	{
		id: 'card',
		label: 'Kartu Kredit / Debit',
		description: 'Visa, Mastercard, JCB — 3D Secure',
		icon: 'fa-credit-card'
	},
	{
		id: 'retail',
		label: 'Gerai Retail',
		description: 'Bayar tunai di Indomaret / Alfamart',
		icon: 'fa-store',
		channels: [
			{ id: 'indomaret', label: 'Indomaret', hint: 'Tunai', icon: 'fa-store' },
			{ id: 'alfamart', label: 'Alfamart', hint: 'Tunai', icon: 'fa-store' }
		]
	}
];

export interface Voucher {
	code: string;
	label: string;
	percent: number;
	maxDiscount: number;
}

export const VOUCHERS: Voucher[] = [
	{ code: 'HEMAT20', label: 'Diskon 20% s.d. Rp50rb', percent: 20, maxDiscount: 50000 },
	{ code: 'PELAJAR10', label: 'Diskon 10% s.d. Rp25rb', percent: 10, maxDiscount: 25000 },
	{ code: 'BARU15', label: 'Pengguna baru 15% s.d. Rp30rb', percent: 15, maxDiscount: 30000 }
];

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

/** Biaya layanan per metode (simulasi). Kartu memakai persentase. */
export function serviceFee(method: PaymentMethodId, subtotal: number): number {
	switch (method) {
		case 'qris':
			return 1500;
		case 'va':
			return 4000;
		case 'ewallet':
			return 2500;
		case 'retail':
			return 2500;
		case 'card':
			return Math.round(subtotal * 0.029) + 2000;
	}
}

export function voucherDiscount(price: number, voucher: Voucher | null): number {
	if (!voucher) return 0;
	return Math.min(Math.round((price * voucher.percent) / 100), voucher.maxDiscount);
}

export function findVoucher(code: string): Voucher | null {
	const normalized = code.trim().toUpperCase();
	return VOUCHERS.find((v) => v.code === normalized) ?? null;
}

/** Nomor tujuan pembayaran dummy yang stabil per course + metode. */
export function paymentReference(courseId: number, method: PaymentMethodId, channel: string): string {
	const base = 880000000000 + courseId * 13711 + method.length * 7919 + channel.length * 104729;
	return String(base).slice(0, 16);
}

export function invoiceNumber(courseId: number, when: Date = new Date()): string {
	const ymd = `${when.getFullYear()}${String(when.getMonth() + 1).padStart(2, '0')}${String(
		when.getDate()
	).padStart(2, '0')}`;
	return `INV/${ymd}/${String(courseId).padStart(4, '0')}/${String(
		Math.floor(Math.random() * 9000) + 1000
	)}`;
}

export function methodLabel(method: PaymentMethodId, channel?: string): string {
	const m = PAYMENT_METHODS.find((x) => x.id === method);
	const ch = m?.channels?.find((c) => c.id === channel);
	if (m && ch) return `${m.label} · ${ch.label}`;
	return m?.label ?? method;
}
