import { apiRequest } from './backend';
import { getAccessToken, handlePrivateRequestError } from '$lib/stores/auth.svelte';

/**
 * Bagi hasil instruktur + penarikan.
 * Persen global milik admin; snapshot hak dicatat server per pembayaran
 * terverifikasi; instruktur mengajukan penarikan dengan rekening tiap pengajuan.
 */

export interface RevenueSettings {
	instructorPercent: number;
	minWithdrawal: number;
}

export type PayoutStatus = 'diajukan' | 'diproses' | 'berhasil' | 'ditolak';

export interface EarningsCourse {
	courseId: number;
	title: string;
	earned: number;
	payments: number;
}

export interface Earnings {
	totalEarned: number;
	available: number;
	pending: number;
	paid: number;
	percent: number;
	minWithdrawal: number;
	courses: EarningsCourse[];
}

export interface PayoutRow {
	id: number;
	instructorId?: number;
	instructorName?: string;
	instructorEmail?: string;
	amount: number;
	bankName: string;
	accountNumber: string;
	accountName: string;
	status: PayoutStatus;
	rejectReason: string | null;
	createdAt: string;
	decidedAt: string | null;
}

async function req<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
	try {
		return await apiRequest<T>(path, { ...options, token: getAccessToken() });
	} catch (e) {
		await handlePrivateRequestError(e);
		throw e;
	}
}

/** Baca persen global + minimal (admin). */
export function fetchRevenueSettings(): Promise<RevenueSettings> {
	return req<RevenueSettings>('/admin/revenue-settings');
}

/** Ubah persen global + minimal (admin). */
export function updateRevenueSettings(input: { instructorPercent: number; minWithdrawal: number }): Promise<RevenueSettings> {
	return req<RevenueSettings>('/admin/revenue-settings', { method: 'PUT', body: input });
}

export interface PayoutListParams {
	status?: PayoutStatus;
	limit?: number;
	page?: number;
}

function payoutQuery(params: PayoutListParams): string {
	const sp = new URLSearchParams();
	if (params.status) sp.set('status', params.status);
	if (params.limit !== undefined) sp.set('limit', String(params.limit));
	if (params.page !== undefined) sp.set('page', String(params.page));
	const qs = sp.toString();
	return qs ? `?${qs}` : '';
}

/** Antrean penarikan (admin). */
export function fetchAdminPayouts(
	params: PayoutListParams = {}
): Promise<{ items: PayoutRow[]; total: number; page: number }> {
	return req<{ items: PayoutRow[]; total: number; page: number }>(
		`/admin/payouts${payoutQuery(params)}`
	);
}

/** Proses penarikan: setujui / tolak / tandai-ditransfer (admin). */
export function processPayout(
	id: number,
	input: { action: 'setujui' | 'tolak' | 'tandai-ditransfer'; reason?: string }
): Promise<{ id: number; status: PayoutStatus }> {
	return req<{ id: number; status: PayoutStatus }>(`/admin/payouts/${id}/process`, {
		method: 'POST',
		body: input
	});
}

/** Ringkasan pendapatan milik instruktur. */
export function fetchMyEarnings(): Promise<Earnings> {
	return req<Earnings>('/me/earnings');
}

/** Riwayat penarikan milik instruktur. */
export function fetchMyPayouts(
	params: PayoutListParams = {}
): Promise<{ items: PayoutRow[]; total: number; page: number; limit: number }> {
	return req<{ items: PayoutRow[]; total: number; page: number; limit: number }>(
		`/me/payouts${payoutQuery(params)}`
	);
}

/** Ajukan penarikan dengan rekening (instruktur). */
export function requestPayout(input: {
	amount: number;
	bankName: string;
	accountNumber: string;
	accountName: string;
}): Promise<{ id: number; amount: number; status: PayoutStatus; available: number }> {
	return req<{ id: number; amount: number; status: PayoutStatus; available: number }>('/me/payouts', {
		method: 'POST',
		body: input
	});
}
