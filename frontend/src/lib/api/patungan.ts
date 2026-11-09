import { apiRequest } from './backend';
import { getAccessToken, handlePrivateRequestError } from '$lib/stores/auth.svelte';

/**
 * Grup patungan: username tervalidasi, iuran sendiri-sendiri,
 * akses dibuka hanya setelah semua lunas. Semua aturan ditegakkan server;
 * klien hanya cermin.
 */

export type PatunganGroupStatus = 'pending' | 'complete' | 'cancelled';
export type PatunganPaymentStatus = 'unpaid' | 'menunggu' | 'diverifikasi' | 'ditolak';

export interface PatunganMember {
	userId: number;
	username: string;
	name: string;
	position: number;
	shareAmount: number;
	paymentStatus: PatunganPaymentStatus;
	paidAt: string | null;
	isCreator: boolean;
}

export interface PatunganGroupDetail {
	id: number;
	code: string;
	status: PatunganGroupStatus;
	course: { id: number; title: string; priceLabel: string };
	campaign: { slug: string; title: string } | null;
	memberCount: number;
	priceNominal: number;
	paidCount: number;
	createdBy: number | null;
	cancelReason: string | null;
	completedAt: string | null;
	createdAt: string;
	members: PatunganMember[];
}

export interface PatunganGroupSummary {
	id: number;
	code: string;
	status: PatunganGroupStatus;
	memberCount: number;
	priceNominal: number;
	paidCount: number;
	createdAt: string;
	completedAt: string | null;
	courseId: number;
	courseTitle: string | null;
	coursePriceLabel: string | null;
}

export interface ValidateMemberRow {
	username: string;
	exists: boolean;
	displayName: string | null;
}

export interface ValidateMembersResult {
	ready: boolean;
	members: ValidateMemberRow[];
	creatorShare?: number;
	shares?: Record<string, number>;
	total?: number;
	memberCount?: number;
	course?: { id: number; title: string; priceLabel: string; priceNominal: number };
	campaign?: { slug: string; title: string };
	error?: { code: string; message: string };
}

async function authed<T>(path: string, method: string, body?: unknown): Promise<T> {
	try {
		return await apiRequest<T>(path, { method, body, token: getAccessToken() });
	} catch (e) {
		await handlePrivateRequestError(e);
		throw e;
	}
}

/** Cek username anggota (exact-match, tanpa bocor data sensitif). */
export function validatePatunganMembers(
	courseId: number,
	usernames: string[]
): Promise<ValidateMembersResult> {
	return authed<ValidateMembersResult>('/patungan/members/validate', 'POST', { courseId, usernames });
}

/** Buat grup (pembuat otomatis anggota #1). */
export function createPatunganGroup(
	courseId: number,
	usernames: string[]
): Promise<PatunganGroupDetail> {
	return authed<PatunganGroupDetail>('/patungan/groups', 'POST', { courseId, usernames });
}

/** Daftar grup patungan saya (sebagai anggota). */
export function fetchMyPatunganGroups(): Promise<PatunganGroupSummary[]> {
	return authed<PatunganGroupSummary[]>('/patungan/groups/mine', 'GET');
}

/** Detail grup (anggota/admin). */
export function fetchPatunganGroup(groupId: number): Promise<PatunganGroupDetail> {
	return authed<PatunganGroupDetail>(`/patungan/groups/${groupId}`, 'GET');
}

export interface CancelPatunganResult {
	id: number;
	status: PatunganGroupStatus;
	paidMembers: Array<{
		username: string;
		name: string;
		shareAmount: number;
		paymentStatus: PatunganPaymentStatus;
		paymentId: number | null;
	}>;
}

/** Batal grup (pembuat selama belum ada iuran / admin). */
export function cancelPatunganGroup(
	groupId: number,
	reason?: string
): Promise<CancelPatunganResult> {
	return authed(`/patungan/groups/${groupId}/cancel`, 'POST', reason ? { reason } : {});
}

/** Batal grup oleh admin. */
export function adminCancelPatunganGroup(
	groupId: number,
	reason?: string
): Promise<CancelPatunganResult> {
	return authed(`/admin/patungan/groups/${groupId}/cancel`, 'POST', reason ? { reason } : {});
}
