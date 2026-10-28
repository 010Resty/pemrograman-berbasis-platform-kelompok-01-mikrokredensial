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
