import { apiRequest, type BackendUser } from './backend';
import { getAccessToken, handlePrivateRequestError } from '$lib/stores/auth.svelte';

/**
 * Undangan instruktur — API backend asli (bukan mock).
 * Kontrak: `backend/docs/API_CONTRACT.md` §12.
 * - Admin: POST/GET `/admin/invitations`, POST `/admin/invitations/:id/revoke`.
 * - Publik: GET `/invitations/validate?token=`, POST `/invitations/accept`.
 * Token plaintext hanya kembali sekali saat pembuatan (+ via email SMTP).
 * Daftar tidak memuat token, jadi tautan hanya bisa disalin saat dibuat.
 */

/** Status versi server (huruf kecil). */
export type BackendInvitationStatus = 'pending' | 'accepted' | 'revoked' | 'expired';

export interface BackendInvitation {
	id: number;
	email: string;
	name: string | null;
	note: string | null;
	status: BackendInvitationStatus;
	invitedBy: number | null;
	expiresAt: string;
	createdAt: string;
}

export interface CreateInvitationResult extends BackendInvitation {
	/** Token plaintext — hanya tampil sekali, simpan/salin segera. */
	token: string;
	inviteUrl: string;
	/** False bila email SMTP gagal (undangan tetap dibuat, salin manual). */
	emailSent: boolean;
}

export interface ValidateInvitationResult {
	email: string;
	name: string | null;
	expiresAt: string;
}

export interface AcceptInvitationResult {
	accessToken: string;
	user: BackendUser;
}

async function req<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
	try {
		return await apiRequest<T>(path, { ...options, token: getAccessToken() });
	} catch (e) {
		await handlePrivateRequestError(e);
		throw e;
	}
}

/** Daftar undangan (GET /api/v1/admin/invitations[?status=]). */
export async function fetchInvitations(
	status?: BackendInvitationStatus
): Promise<BackendInvitation[]> {
	const qs = status ? `?status=${encodeURIComponent(status)}` : '';
	const data = await req<{ items: BackendInvitation[] }>(`/admin/invitations${qs}`);
	return data.items ?? [];
}

/** Buat undangan (POST /api/v1/admin/invitations). Mengirim email SMTP. */
export function createBackendInvitation(input: {
	email: string;
	name?: string;
	note?: string;
	expiresInDays?: number;
}): Promise<CreateInvitationResult> {
	return req<CreateInvitationResult>('/admin/invitations', { method: 'POST', body: input });
}

/** Cabut undangan (POST /api/v1/admin/invitations/:id/revoke). */
export function revokeBackendInvitation(id: number, reason?: string): Promise<BackendInvitation> {
	return req<BackendInvitation>(`/admin/invitations/${id}/revoke`, {
		method: 'POST',
		body: reason?.trim() ? { reason: reason.trim().slice(0, 500) } : {}
	});
}

/**
 * Terbitkan ulang undangan (POST /api/v1/admin/invitations/:id/reissue).
 * Menerbitkan token baru (lama hangus) + masa berlaku 7 hari baru dan
 * mengirim emailnya. Token baru kembali sekali seperti saat pembuatan.
 */
export function reissueBackendInvitation(id: number): Promise<CreateInvitationResult> {
	return req<CreateInvitationResult>(`/admin/invitations/${id}/reissue`, { method: 'POST' });
}

/** Validasi publik (GET /api/v1/invitations/validate?token=). Tanpa token admin. */
export function validateBackendInvitation(token: string): Promise<ValidateInvitationResult> {
	return apiRequest<ValidateInvitationResult>(
		`/invitations/validate?token=${encodeURIComponent(token)}`
	);
}

/** Terima undangan (POST /api/v1/invitations/accept). Tanpa token admin. */
export function acceptBackendInvitation(input: {
	token: string;
	password: string;
	name?: string;
}): Promise<AcceptInvitationResult> {
	return apiRequest<AcceptInvitationResult>('/invitations/accept', {
		method: 'POST',
		body: input
	});
}
