import { apiRequest } from './backend';
import { getAccessToken, handlePrivateRequestError } from '$lib/stores/auth.svelte';

/**
 * Profil milik sendiri (semua peran).
 * Kontrak backend: `backend/docs/API_CONTRACT.md` §2b.
 */

export type ProfileGender = 'L' | 'P';

export interface UserProfile {
	id: number;
	name: string;
	username: string;
	email: string;
	role: string;
	phone: string | null;
	gender: ProfileGender | null;
	birthPlace: string | null;
	/** YYYY-MM-DD atau null. */
	birthDate: string | null;
	avatarFileId: number | null;
	/** Relatif server (/api/v1/files/...) atau null — absolutkan saat render. */
	avatarUrl: string | null;
	coverFileId: number | null;
	/** Relatif server (/api/v1/files/...) atau null — absolutkan saat render. */
	coverUrl: string | null;
	emailVerified: boolean;
	createdAt: string;
}

export interface UpdateProfileInput {
	name?: string;
	username?: string;
	phone?: string | null;
	gender?: ProfileGender | null;
	birthPlace?: string | null;
	birthDate?: string | null;
	avatarFileId?: number | null;
	coverFileId?: number | null;
}

export interface FieldError {
	field: string;
	message: string;
}

async function req<T>(path: string, options?: { method?: string; body?: unknown }): Promise<T> {
	try {
		return await apiRequest<T>(path, { ...options, token: getAccessToken() });
	} catch (e) {
		await handlePrivateRequestError(e);
		throw e;
	}
}

/** Profil milik sendiri (GET /api/v1/me/profile). */
export function fetchMyProfile(): Promise<UserProfile> {
	return req<UserProfile>('/me/profile');
}

/**
 * Ubah profil milik sendiri (PATCH, parsial). Melempar Error pesan server;
 * detail per-field tersedia via `fieldErrors(err)`.
 */
export function updateMyProfile(input: UpdateProfileInput): Promise<UserProfile> {
	return req<UserProfile>('/me/profile', { method: 'PATCH', body: input });
}

/** Lepas foto profil (DELETE .../avatar). */
export function removeMyAvatar(): Promise<UserProfile> {
	return req<UserProfile>('/me/profile/avatar', { method: 'DELETE' });
}

/** Ekstrak error per-field backend `{errors:[{field,message}]}` bila ada. */
export function fieldErrors(err: unknown): FieldError[] {
	if (typeof err !== 'object' || err === null) return [];
	const errors = (err as { errors?: unknown }).errors;
	if (!Array.isArray(errors)) return [];
	return errors.filter(
		(e): e is FieldError =>
			typeof e === 'object' &&
			e !== null &&
			typeof (e as { field?: unknown }).field === 'string' &&
			typeof (e as { message?: unknown }).message === 'string'
	);
}

/** Label Indonesia untuk gender. */
export function genderLabel(g: ProfileGender | null | undefined): string {
	if (g === 'L') return 'Laki-laki';
	if (g === 'P') return 'Perempuan';
	return 'Belum diisi';
}

/** Label Indonesia untuk peran. */
export function roleLabel(role: string): string {
	if (role === 'admin') return 'Admin';
	if (role === 'teacher') return 'Instruktur';
	return 'Peserta';
}
