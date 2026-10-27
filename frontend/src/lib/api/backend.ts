import { env } from '$env/dynamic/public';
import {
	authorizationHeader,
	fetchWithTimeout,
	RequestTimeoutError
} from './request-policy';

/** Kontrak respons backend Tahap 1 — perbandingan WAJIB ketat (===). */
export interface BackendSuccess<T> {
	status: 'success';
	message: string;
	data: T;
}

export interface BackendFieldError {
	field: string;
	message: string;
}

export interface BackendFailure {
	status: 'error';
	message: string;
	errors?: BackendFieldError[] | null;
	data: null;
}

export type BackendResponse<T> = BackendSuccess<T> | BackendFailure;

export interface BackendUser {
	id: string | number;
	name: string;
	email: string;
	role: 'student' | 'teacher' | 'admin';
}

export interface AuthPayload {
	message: string;
	accessToken: string;
	user: BackendUser;
}

export class BackendRequestError extends Error {
	readonly httpStatus: number;
	readonly errors: BackendFieldError[] | null;
	/** Kode mesin untuk klasifikasi: 'timeout' bila batas waktu terlampaui. */
	readonly code: string | null;

	constructor(
		message: string,
		httpStatus: number,
		errors: BackendFieldError[] | null = null,
		code: string | null = null
	) {
		super(message);
		this.name = 'BackendRequestError';
		this.httpStatus = httpStatus;
		this.errors = errors;
		this.code = code;
	}
}

/** Batas waktu default request login (ms). Dapat dioverride per pemanggilan. */
export const DEFAULT_LOGIN_TIMEOUT_MS = 15000;

/** Baca batas waktu login dari env; fallback 15 detik bila tak valid. */
export function getLoginTimeoutMs(): number {
	const raw = Number.parseInt(String(env.PUBLIC_LOGIN_TIMEOUT_MS ?? '').trim(), 10);
	if (Number.isFinite(raw) && raw > 0) return raw;
	return DEFAULT_LOGIN_TIMEOUT_MS;
}

/** Opsi request JSON generik. `timeoutMs` opsional per-endpoint (bukan global). */
export interface ApiRequestOptions {
	method?: string;
	body?: unknown;
	token?: string | null;
	/** Batas waktu ms; hanya dipakai bila > 0. Tanpa ini perilaku lama dipertahankan. */
	timeoutMs?: number;
}

/** Base URL API tanpa trailing slash. Prioritas: PUBLIC_API_BASE_URL, fallback dev lokal. */
export function getApiBase(): string {
	const raw = (env.PUBLIC_API_BASE_URL || '').trim() || 'http://localhost:3000/api/v1';
	return raw.replace(/\/+$/, '');
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

/** Parse ketat: hanya terima envelope {status,message,data}. Tolak non-JSON/non-envelope. */
async function parseEnvelope<T>(res: Response): Promise<BackendResponse<T>> {
	const text = await res.text();
	if (!text) {
		throw new BackendRequestError(`Respons kosong dari server (HTTP ${res.status}).`, res.status);
	}
	let json: unknown;
	try {
		json = JSON.parse(text);
	} catch {
		throw new BackendRequestError(
			`Respons server bukan JSON valid (HTTP ${res.status}).`,
			res.status
		);
	}
	if (!isRecord(json) || (json.status !== 'success' && json.status !== 'error')) {
		throw new BackendRequestError(
			`Format respons server tidak dikenali (HTTP ${res.status}).`,
			res.status
		);
	}
	return json as unknown as BackendResponse<T>;
}

/**
 * Request JSON generik dengan header Authorization opsional.
 * - Jaringan gagal -> BackendRequestError(status 0, pesan jelas).
 * - Timeout (bila `timeoutMs` diset) -> BackendRequestError(status 0, code 'timeout').
 * - status !== success atau HTTP error -> BackendRequestError (TIDAK pernah resolve palsu).
 */
export async function apiRequest<T>(
	path: string,
	options: ApiRequestOptions = {}
): Promise<T> {
	const url = `${getApiBase()}${path.startsWith('/') ? path : `/${path}`}`;
	const headers: Record<string, string> = { accept: 'application/json' };
	let payload: string | undefined;
	if (options.body !== undefined) {
		headers['content-type'] = 'application/json';
		payload = JSON.stringify(options.body);
	}
	// Token hanya dikirim ke base API sendiri (same-origin) — lihat request-policy.
	const auth = authorizationHeader(options.token);
	if (auth) headers.authorization = auth;

	const init: RequestInit = {
		method: options.method || 'GET',
		headers,
		body: payload
	};

	let res: Response;
	try {
		res =
			options.timeoutMs !== undefined && options.timeoutMs > 0
				? await fetchWithTimeout(fetch, url, init, options.timeoutMs)
				: await fetch(url, init);
	} catch (err) {
		if (err instanceof RequestTimeoutError) {
			const seconds = Math.max(1, Math.round(err.timeoutMs / 1000));
			throw new BackendRequestError(
				`Waktu permintaan habis (melebihi ${seconds} detik). Periksa koneksi internet lalu coba lagi.`,
				0,
				null,
				'timeout'
			);
		}
		throw new BackendRequestError(
			'Backend tidak terjangkau. Periksa server Express (default http://localhost:3000) dan PUBLIC_API_BASE_URL.',
			0
		);
	}

	const envelope = await parseEnvelope<T>(res);
	if (!res.ok || envelope.status !== 'success') {
		const failure = envelope as BackendFailure;
		throw new BackendRequestError(
			failure.message || `Permintaan gagal (HTTP ${res.status}).`,
			res.status,
			failure.errors ?? null
		);
	}
	return (envelope as BackendSuccess<T>).data;
}

export function loginRequest(
	email: string,
	password: string,
	timeoutMs: number = getLoginTimeoutMs()
): Promise<AuthPayload> {
	return apiRequest<AuthPayload>('/auth/login', {
		method: 'POST',
		body: { email, password },
		timeoutMs
	});
}

export function registerRequest(name: string, email: string, password: string): Promise<AuthPayload> {
	return apiRequest<AuthPayload>('/auth/register', {
		method: 'POST',
		body: { name, email, password }
	});
}

export async function meRequest(token: string): Promise<BackendUser> {
	const data = await apiRequest<{ user: BackendUser }>('/auth/me', { token });
	return data.user;
}
