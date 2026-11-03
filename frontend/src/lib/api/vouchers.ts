import { apiRequest } from './backend';
import { getAccessToken, handlePrivateRequestError } from '$lib/stores/auth.svelte';

/**
 * Penukaran voucher akses kursus (K-03: 1 akun + 1 kursus, 1x pakai,
 * validasi 4 cocok di backend, anti-race).
 * POST /api/v1/vouchers/redeem { code, courseId } → 201 `{status, source, ...}`.
 * Gagal (kode salah/kursus salah/sudah dipakai/dinonaktifkan/2 request
 * bersamaan) dilempar sebagai error dengan pesan backend — UI wajib
 * menampilkannya jujur + tombol coba lagi, tanpa sukses palsu.
 */
export interface RedeemResult {
	status: string;
	source: string;
	courseId: number;
	reactivated?: boolean;
}

export async function redeemVoucher(code: string, courseId: number): Promise<RedeemResult> {
	try {
		return await apiRequest<RedeemResult>('/vouchers/redeem', {
			method: 'POST',
			body: { code: code.trim().toUpperCase(), courseId },
			token: getAccessToken()
		});
	} catch (e) {
		await handlePrivateRequestError(e);
		throw e;
	}
}

/* ---------- Kelola voucher (admin, K-03) ---------- */

/** Status versi server (huruf kecil). */
export type BackendVoucherStatus = 'available' | 'assigned' | 'redeemed' | 'expired' | 'revoked';

/** Jenis versi server (huruf kecil). */
export type BackendVoucherKind = 'personal' | 'umum';

export interface BackendVoucher {
	code: string;
	courseId: number | null;
	courseTitle: string | null;
	kind: string;
	maxUses: number;
	usedCount: number;
	remaining: number;
	assignedUserId: number | null;
	assignedEmail: string | null;
	expiresAt: string | null;
	status: BackendVoucherStatus;
}

export interface CreateVoucherResult {
	code: string;
	courseId: number;
	kind: string;
	maxUses: number;
	usedCount: number;
	status: string;
}

export interface VoucherRedemption {
	id: number;
	userId: number;
	userEmail: string;
	userName: string;
	courseId: number;
	redeemedAt: string;
}

export interface VoucherDetail extends BackendVoucher {
	redemptions: VoucherRedemption[];
	redemptionCount: number;
}

export interface VoucherListParams {
	courseId?: number;
	status?: BackendVoucherStatus;
	kind?: BackendVoucherKind;
	q?: string;
	limit?: number;
	page?: number;
}

async function req<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
	try {
		return await apiRequest<T>(path, { ...options, token: getAccessToken() });
	} catch (e) {
		await handlePrivateRequestError(e);
		throw e;
	}
}

/** Daftar voucher (GET /api/v1/admin/vouchers?...). */
export function fetchVouchers(params: VoucherListParams = {}): Promise<{ items: BackendVoucher[]; total: number }> {
	const sp = new URLSearchParams();
	if (params.courseId !== undefined) sp.set('courseId', String(params.courseId));
	if (params.status) sp.set('status', params.status);
	if (params.kind) sp.set('kind', params.kind);
	if (params.q?.trim()) sp.set('q', params.q.trim());
	if (params.limit !== undefined) sp.set('limit', String(params.limit));
	if (params.page !== undefined) sp.set('page', String(params.page));
	const qs = sp.toString();
	return req<{ items: BackendVoucher[]; total: number }>(`/admin/vouchers${qs ? `?${qs}` : ''}`);
}

/** Buat voucher (POST /api/v1/admin/vouchers). Personal wajib penerima. */
export function createBackendVoucher(input: {
	code?: string;
	courseId: number;
	kind: BackendVoucherKind;
	maxUses?: number;
	assignedUserId?: number;
	assignedEmail?: string;
	expiresAt?: string;
}): Promise<CreateVoucherResult> {
	return req<CreateVoucherResult>('/admin/vouchers', { method: 'POST', body: input });
}

/** Detail + ≤50 penukaran terakhir (GET /api/v1/admin/vouchers/:code). */
export function fetchVoucherDetail(code: string): Promise<VoucherDetail> {
	return req<VoucherDetail>(`/admin/vouchers/${encodeURIComponent(code)}`);
}

/** Nonaktifkan (POST /api/v1/admin/vouchers/:code/disable). */
export function disableVoucher(code: string, reason?: string): Promise<{ code: string; status: string }> {
	return req<{ code: string; status: string }>(
		`/admin/vouchers/${encodeURIComponent(code)}/disable`,
		{ method: 'POST', body: reason?.trim() ? { reason: reason.trim().slice(0, 500) } : {} }
	);
}

/** Aktifkan kembali (POST /api/v1/admin/vouchers/:code/enable). */
export function enableVoucher(code: string): Promise<{ code: string; status: string }> {
	return req<{ code: string; status: string }>(
		`/admin/vouchers/${encodeURIComponent(code)}/enable`,
		{ method: 'POST' }
	);
}
