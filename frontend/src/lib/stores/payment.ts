import { browser } from '$app/environment';
import type { PaymentMethodId } from '$lib/data/payment';

export interface PaymentReceipt {
	invoice: string;
	courseId: number;
	courseTitle: string;
	method: PaymentMethodId;
	channel: string;
	total: number;
	paidAt: string;
}

const KEY = 'aristoteles:payment-receipts:v1';

function load(): PaymentReceipt[] {
	if (!browser) return [];
	try {
		const raw = localStorage.getItem(KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw) as unknown;
		if (!Array.isArray(parsed)) return [];
		return parsed.filter(
			(r): r is PaymentReceipt =>
				typeof r === 'object' &&
				r !== null &&
				typeof (r as PaymentReceipt).invoice === 'string' &&
				typeof (r as PaymentReceipt).courseId === 'number'
		);
	} catch {
		return [];
	}
}

export function saveReceipt(receipt: PaymentReceipt): void {
	if (!browser) return;
	try {
		const all = load();
		all.unshift(receipt);
		localStorage.setItem(KEY, JSON.stringify(all.slice(0, 50)));
	} catch {
		// Penyimpanan penuh — abaikan, akses course tetap aktif via enrollment store.
	}
}

export function getReceipts(): PaymentReceipt[] {
	return load();
}
