import { apiRequest } from './backend';
import { getAccessToken, handlePrivateRequestError } from '$lib/stores/auth.svelte';

/**
 * Pembayaran QRIS manual + verifikasi admin (tanpa gateway).
 * Alur: ajukan (buat antrean `menunggu`) → unggah bukti → admin verifikasi
 * → akses dibuka (`source: "payment:manual"`). Status jujur dari server;
 * tidak ada sukses lokal tanpa verifikasi.
 */

export type PaymentStatus = 'menunggu' | 'diverifikasi' | 'ditolak';

export interface MyPayment {
	id: number;
	invoice: string;
	courseId: number;
	method: string;
	amountExpected: number;
	amountPaid: number | null;
	voucherCode: string | null;
	discountAmount: number;
	promoSlug: string | null;
	patunganGroupId: number | null;
	proofFileId: number | null;
	status: PaymentStatus;
	rejectReason: string | null;
	verifiedAt: string | null;
	createdAt: string;
	reused?: boolean;
}

export interface ValidateDiscountResult {
	valid: true;
	code: string;
	discountType: 'percent' | 'nominal';
	discountValue: number;
	discountAmount: number;
	priceNominal: number;
}

export async function validateDiscountVoucher(code: string, courseId: number): Promise<ValidateDiscountResult> {
	try {
		return await apiRequest<ValidateDiscountResult>('/vouchers/validate', {
			method: 'POST',
			body: { code: code.trim().toUpperCase(), courseId },
			token: getAccessToken()
		});
	} catch (e) {
		await handlePrivateRequestError(e);
		throw e;
	}
}

export async function createPayment(
	courseId: number,
	input: { proofFileId?: number; voucherCode?: string; patunganGroupId?: number } = {}
): Promise<MyPayment> {
	try {
		return await apiRequest<MyPayment>(`/courses/${courseId}/payments`, {
			method: 'POST',
			body: input,
			token: getAccessToken()
		});
	} catch (e) {
		await handlePrivateRequestError(e);
		throw e;
	}
}

export async function attachPaymentProof(paymentId: number, proofFileId: number): Promise<MyPayment> {
	try {
		return await apiRequest<MyPayment>(`/payments/${paymentId}/proof`, {
			method: 'PATCH',
			body: { proofFileId },
			token: getAccessToken()
		});
	} catch (e) {
		await handlePrivateRequestError(e);
		throw e;
	}
}

export async function fetchMyPayment(courseId: number): Promise<MyPayment | null> {
	try {
		return await apiRequest<MyPayment | null>(`/me/payments?courseId=${courseId}`, {
			token: getAccessToken()
		});
	} catch (e) {
		await handlePrivateRequestError(e);
		throw e;
	}
}

export interface MyPaymentListItem {
	id: number;
	invoice: string;
	courseId: number;
	courseTitle: string | null;
	method: string;
	amountExpected: number;
	amountPaid: number | null;
	voucherCode: string | null;
	discountAmount: number;
	promoSlug: string | null;
	patunganGroupId: number | null;
	proofFileId: number | null;
	status: PaymentStatus;
	rejectReason: string | null;
	verifiedAt: string | null;
	createdAt: string;
}

export interface MyPaymentList {
	items: MyPaymentListItem[];
	total: number;
	page: number;
	limit: number;
}

/** Daftar pembayaran milik sendiri (untuk bell peserta). */
export async function fetchMyPayments(params: {
	status?: PaymentStatus;
	limit?: number;
	page?: number;
} = {}): Promise<MyPaymentList> {
	const qs = new URLSearchParams();
	if (params.status) qs.set('status', params.status);
	if (params.limit !== undefined) qs.set('limit', String(params.limit));
	if (params.page !== undefined) qs.set('page', String(params.page));
	const q = qs.toString();
	try {
		return await apiRequest<MyPaymentList>(`/me/payments${q ? `?${q}` : ''}`, {
			token: getAccessToken()
		});
	} catch (e) {
		await handlePrivateRequestError(e);
		throw e;
	}
}

export interface AdminPaymentRow {
	id: number;
	userId: number;
	userEmail: string;
	userName: string;
	courseId: number;
	courseTitle: string | null;
	invoice: string;
	method: string;
	amountExpected: number;
	amountPaid: number | null;
	voucherCode: string | null;
	discountAmount: number;
	promoSlug: string | null;
	patunganGroupId: number | null;
	proofFileId: number | null;
	status: PaymentStatus;
	rejectReason: string | null;
	verifiedAt: string | null;
	createdAt: string;
}

export async function fetchAdminPayments(params: {
	status?: PaymentStatus;
	courseId?: number;
	limit?: number;
	page?: number;
}): Promise<{ items: AdminPaymentRow[]; total: number; page: number }> {
	const qs = new URLSearchParams();
	if (params.status) qs.set('status', params.status);
	if (params.courseId !== undefined) qs.set('courseId', String(params.courseId));
	if (params.limit !== undefined) qs.set('limit', String(params.limit));
	if (params.page !== undefined) qs.set('page', String(params.page));
	const q = qs.toString();
	try {
		return await apiRequest<{ items: AdminPaymentRow[]; total: number; page: number }>(
			`/admin/payments${q ? `?${q}` : ''}`,
			{ token: getAccessToken() }
		);
	} catch (e) {
		await handlePrivateRequestError(e);
		throw e;
	}
}

export async function verifyPayment(
	paymentId: number,
	input: { decision: 'terima' | 'tolak'; amountPaid?: number; reason?: string }
): Promise<{ id: number; status: PaymentStatus }> {
	try {
		return await apiRequest<{ id: number; status: PaymentStatus }>(
			`/admin/payments/${paymentId}/verify`,
			{ method: 'POST', body: input, token: getAccessToken() }
		);
	} catch (e) {
		await handlePrivateRequestError(e);
		throw e;
	}
}
