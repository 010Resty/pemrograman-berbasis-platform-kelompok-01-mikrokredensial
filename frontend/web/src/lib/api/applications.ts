import { apiRequest, BackendRequestError } from './backend';
import { getAccessToken, handlePrivateRequestError } from '$lib/stores/auth.svelte';

/**
 * Pengajuan minat instruktur — API backend nyata (K-01: tanpa pendaftaran bebas).
 * - Publik: POST /api/v1/instructor-applications (rate-limit server, 429 bila spam).
 * - Admin: GET list/detail, PATCH review, DELETE, POST invite (token JWT admin).
 * Gagal request dilempar sebagai BackendRequestError berisi pesan backend —
 * UI wajib menampilkannya jujur, tanpa sukses palsu.
 */

export type ApplicationStatus = 'submitted' | 'under_review' | 'approved' | 'rejected';

export interface PengajuanInstruktur {
	id: number;
	code: string;
	nama: string;
	email: string;
	tentang: string;
	skill: string;
	youtubeTutorial: string;
	youtubeChannel: string;
	linkedin: string;
	referralEmail: string;
	/** URL byte foto (butuh token admin) atau null. */
	fotoUrl: string | null;
	cvName: string;
	cvSize: number;
	/** URL byte CV (butuh token admin) atau null. */
	cvUrl: string | null;
	status: ApplicationStatus;
	reviewNote: string | null;
	reviewedBy: number | null;
	reviewedAt: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface ApplicationList {
	items: PengajuanInstruktur[];
	total: number;
	page: number;
	limit: number;
}

export interface FilePayload {
	filename: string;
	mimeType: string;
	/** DataURL atau base64 mentah. */
	data: string;
}

export interface SubmitApplicationInput {
	nama: string;
	email: string;
	tentang?: string;
	skill?: string;
	youtubeTutorial?: string;
	youtubeChannel?: string;
	linkedin?: string;
	referralEmail?: string;
	foto?: FilePayload;
	cv?: FilePayload;
}

export interface InvitationResult {
	id: number;
	email: string;
	token: string;
	inviteUrl: string;
	expiresAt: string;
	/** false bila email gagal terkirim — admin wajib salin token manual. */
	emailSent: boolean;
}

export async function submitApplicationRequest(
	input: SubmitApplicationInput
): Promise<PengajuanInstruktur> {
	return apiRequest<PengajuanInstruktur>('/instructor-applications', {
		method: 'POST',
		body: input
	});
}

async function authed<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
	try {
		return await apiRequest<T>(path, { ...options, token: getAccessToken() });
	} catch (e) {
		await handlePrivateRequestError(e);
		throw e;
	}
}

export function listApplicationsRequest(params: {
	q?: string;
	status?: ApplicationStatus;
	page?: number;
	limit?: number;
}): Promise<ApplicationList> {
	const search = new URLSearchParams();
	if (params.q?.trim()) search.set('q', params.q.trim());
	if (params.status) search.set('status', params.status);
	if (params.page) search.set('page', String(params.page));
	if (params.limit) search.set('limit', String(params.limit));
	const suffix = search.size > 0 ? `?${search.toString()}` : '';
	return authed<ApplicationList>(`/admin/instructor-applications${suffix}`);
}

export function getApplicationRequest(id: number): Promise<PengajuanInstruktur> {
	return authed<PengajuanInstruktur>(`/admin/instructor-applications/${id}`);
}

export function reviewApplicationRequest(
	id: number,
	input: { status: Exclude<ApplicationStatus, 'submitted'>; reviewNote?: string }
): Promise<PengajuanInstruktur> {
	return authed<PengajuanInstruktur>(`/admin/instructor-applications/${id}`, {
		method: 'PATCH',
		body: input
	});
}

export function deleteApplicationRequest(id: number): Promise<{ id: number }> {
	return authed<{ id: number }>(`/admin/instructor-applications/${id}`, {
		method: 'DELETE'
	});
}

export function inviteApplicationRequest(
	id: number
): Promise<{ application: PengajuanInstruktur; invitation: InvitationResult }> {
	return authed<{ application: PengajuanInstruktur; invitation: InvitationResult }>(
		`/admin/instructor-applications/${id}/invite`,
		{ method: 'POST', body: {} }
	);
}

/** Unduh byte berkas applicant (butuh token admin) sebagai Blob. */
export async function downloadApplicationFile(url: string): Promise<Blob> {
	const { getApiBase } = await import('./backend');
	const res = await fetch(`${getApiBase()}${url}`, {
		headers: { authorization: `Bearer ${getAccessToken() ?? ''}` }
	});
	if (!res.ok) {
		throw new BackendRequestError(
			res.status === 403
				? 'Akses berkas ditolak.'
				: `Gagal mengunduh berkas (HTTP ${res.status}).`,
			res.status
		);
	}
	return res.blob();
}
