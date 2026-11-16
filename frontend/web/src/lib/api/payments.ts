import { apiRequest, BackendRequestError } from './backend';
import { getAccessToken, handlePrivateRequestError } from '$lib/stores/auth.svelte';

/**
 * Pembayaran QRIS DINAMIS DOKU (ganti total jalur manual).
 * Alur: buat antrean `{gateway:'doku'}` → pindai QR (nominal tampil otomatis)
 * → webhook DOKU memverifikasi → akses dibuka (`source: "payment:doku"`).
 * Status jujur dari server; tidak ada sukses lokal tanpa verifikasi.
 */

export type PaymentStatus = 'menunggu' | 'diverifikasi' | 'ditolak';

/** Gateway: manual (antrean lawas) atau doku (QRIS dinamis). */
export type PaymentGateway = 'manual' | 'doku';

export interface MyPayment {
	id: number;
	invoice: string;
	courseId: number;
	method: string;
	gateway: PaymentGateway;
	amountExpected: number;
	amountPaid: number | null;
	voucherCode: string | null;
	discountAmount: number;
	promoSlug: string | null;
	patunganGroupId: number | null;
	proofFileId: number | null;
	/** Kedaluwarsa QR DOKU (ISO) — null untuk antrean manual lawas. */
	dokuExpiresAt: string | null;
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
	input: { gateway?: PaymentGateway; proofFileId?: number; voucherCode?: string; patunganGroupId?: number } = {}
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
	gateway: PaymentGateway;
	amountExpected: number;
	amountPaid: number | null;
	voucherCode: string | null;
	discountAmount: number;
	promoSlug: string | null;
	patunganGroupId: number | null;
	proofFileId: number | null;
	dokuExpiresAt: string | null;
	status: PaymentStatus;
	rejectReason: string | null;
	verifiedAt: string | null;
	/** Kapan peserta melihat keputusan; null = belum dibaca (badge bell). */
	studentSeenAt: string | null;
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
	/** Hanya keputusan yang belum dibaca (bukan antrean menunggu). */
	unseen?: boolean;
	limit?: number;
	page?: number;
} = {}): Promise<MyPaymentList> {
	const qs = new URLSearchParams();
	if (params.status) qs.set('status', params.status);
	if (params.unseen) qs.set('unseen', '1');
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

/** Tandai keputusan pembayaran sudah dibaca (bell hilang). */
export async function markMyPaymentsSeen(courseId?: number): Promise<{ seen: number }> {
	try {
		return await apiRequest<{ seen: number }>('/me/payments/seen', {
			method: 'POST',
			body: courseId !== undefined ? { courseId } : {},
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
	gateway: PaymentGateway;
	amountExpected: number;
	amountPaid: number | null;
	voucherCode: string | null;
	discountAmount: number;
	promoSlug: string | null;
	patunganGroupId: number | null;
	proofFileId: number | null;
	dokuReferenceId: string | null;
	dokuExpiresAt: string | null;
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

/** Unduh byte bukti bayar privat (pemilik/admin, butuh token) sebagai Blob.
 * Dipakai pratinjau inline karena berkas privat tidak bisa dibuka via
 * tautan langsung (tanpa header Authorization browser = 403). */
export async function downloadProofFile(fileId: number): Promise<Blob> {
	const { getApiBase } = await import('./backend');
	let res: Response;
	try {
		res = await fetch(`${getApiBase()}/files/${fileId}/content`, {
			headers: { authorization: `Bearer ${getAccessToken() ?? ''}` }
		});
	} catch {
		throw new BackendRequestError('Backend tidak terjangkau saat mengunduh bukti.', 0);
	}
	if (!res.ok) {
		const err = new BackendRequestError(
			res.status === 403 || res.status === 401
				? 'Akses bukti ditolak.'
				: `Gagal mengunduh bukti (HTTP ${res.status}).`,
			res.status
		);
		await handlePrivateRequestError(err);
		throw err;
	}
	return res.blob();
}

/** Batalkan antrean menunggu milik sendiri (hard delete di server).
 * Berhasil = baris hilang total; gagal (sudah diputus admin) = pesan error. */
export async function cancelPayment(paymentId: number): Promise<{ id: number; courseId: number; cancelled: boolean }> {
	try {
		return await apiRequest<{ id: number; courseId: number; cancelled: boolean }>(
			`/payments/${paymentId}`,
			{ method: 'DELETE', token: getAccessToken() }
		);
	} catch (e) {
		await handlePrivateRequestError(e);
		throw e;
	}
}

/** Unduh PNG QRIS dinamis DOKU (pemilik/admin) sebagai Blob.
 * Dipakai <img> via object URL — privat, tanpa tautan langsung (butuh token). */
export async function fetchPaymentQr(paymentId: number): Promise<Blob> {
	const { getApiBase } = await import('./backend');
	let res: Response;
	try {
		res = await fetch(`${getApiBase()}/payments/${paymentId}/qr`, {
			headers: { authorization: `Bearer ${getAccessToken() ?? ''}` }
		});
	} catch {
		throw new BackendRequestError('Backend tidak terjangkau saat mengunduh QR.', 0);
	}
	if (!res.ok) {
		const err = new BackendRequestError(
			res.status === 404
				? 'QR DOKU belum tersedia untuk pembayaran ini.'
				: `Gagal mengunduh QR (HTTP ${res.status}).`,
			res.status
		);
		await handlePrivateRequestError(err);
		throw err;
	}
	return res.blob();
}

/** Generate ulang QR DOKU yang hilang/kedaluwarsa (pemilik, masih menunggu). */
export async function refreshDokuQr(paymentId: number): Promise<MyPayment> {
	try {
		return await apiRequest<MyPayment>(`/payments/${paymentId}/doku/refresh`, {
			method: 'POST',
			body: {},
			token: getAccessToken()
		});
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
