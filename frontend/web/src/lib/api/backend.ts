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
	username: string;
	email: string;
	role: 'student' | 'teacher' | 'admin';
	/** Relatif server atau null; absen pada payload lama → null. */
	avatarUrl?: string | null;
}

export interface AuthPayload {
	message: string;
	accessToken: string;
	/** Opaque 64-hex untuk silent refresh; disimpan aman, diputar tiap pakai. */
	refreshToken: string;
	refreshExpiresAt?: string | null;
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
	/**
	 * Lewati silent-refresh + retry saat 401 (dipakai alur refresh/logout
	 * sendiri agar tidak berputar). Default false = ikut silent refresh.
	 */
	noAuthRetry?: boolean;
}

/**
 * Pemulih sesi terpusat (diinjeksikan auth store agar backend.ts tetap
 * bebas import store — anti circular-import). Mengembalikan access token
 * baru bila refresh berhasil, null bila sesi memang sudah mati.
 */
let silentRefresher: (() => Promise<string | null>) | null = null;

/** Daftarkan pemulih sesi; dipanggil sekali saat modul auth store dimuat. */
export function configureSilentRefresh(fn: () => Promise<string | null>): void {
	silentRefresher = fn;
}

/** Endpoint auth tidak ikut silent-refresh (login/register/refresh/logout). */
function isAuthPath(path: string): boolean {
	return path === '/auth' || path.startsWith('/auth/');
}

/** Dedup GET in-flight: request identik yang bersamaan hanya 1 fetch (hindari N× modul ganda). */
const inflightGet = new Map<string, Promise<unknown>>();
function inflightKey(url: string, token: string | null | undefined): string {
	return `${url}::${token ?? ''}`;
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
	const method = (options.method || 'GET').toUpperCase();
	const isGet = method === 'GET' && options.body === undefined;
	// Default timeout aman untuk GET agar $effect race tidak gantung (login tetap 15 dtk).
	const timeoutMs = options.timeoutMs ?? (isGet ? 15000 : undefined);

	const doFetchOnce = async (token: string | null | undefined): Promise<T> => {
		const headers: Record<string, string> = { accept: 'application/json' };
		let payload: string | undefined;
		if (options.body !== undefined) {
			headers['content-type'] = 'application/json';
			payload = JSON.stringify(options.body);
		}
		// Token hanya dikirim ke base API sendiri (same-origin) — lihat request-policy.
		const auth = authorizationHeader(token ?? null);
		if (auth) headers.authorization = auth;

		const init: RequestInit = {
			method,
			headers,
			body: payload
		};

		let res: Response;
		try {
			res =
				timeoutMs !== undefined && timeoutMs > 0
					? await fetchWithTimeout(fetch, url, init, timeoutMs)
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
	};

	// 401 + sesi tersimpan: coba silent refresh sekali lalu ulangi request
	// dengan token baru (tanpa logout). Gagal refresh = lempar error asli
	// agar caller (handlePrivateRequestError) menjalankan alur logout normal.
	const runWithSilentRefresh = async (): Promise<T> => {
		try {
			return await doFetchOnce(options.token);
		} catch (err) {
			if (
				err instanceof BackendRequestError &&
				err.httpStatus === 401 &&
				silentRefresher &&
				!options.noAuthRetry &&
				!isAuthPath(path)
			) {
				const fresh = await silentRefresher().catch(() => null);
				if (fresh) return await doFetchOnce(fresh);
			}
			throw err;
		}
	};

	// Hanya GET yang didedup; mutasi tetap jalan tiap panggil.
	if (!isGet) return runWithSilentRefresh();
	const key = inflightKey(`${method}:${url}`, options.token ?? '');
	const pending = inflightGet.get(key);
	if (pending) return pending as Promise<T>;
	const p = runWithSilentRefresh();
	inflightGet.set(key, p);
	try {
		return await p;
	} finally {
		if (inflightGet.get(key) === p) inflightGet.delete(key);
	}
}

/**
 * Hasil pertukaran refresh token: pasangan sesi baru + identitas.
 * Bentuk sama dengan respons login (AuthPayload) agar pemakaian seragam.
 */
export interface RefreshSessionResult {
	message: string;
	accessToken: string;
	refreshToken: string;
	refreshExpiresAt: string;
	user: BackendUser;
}

/**
 * Tukar refresh token menjadi pasangan sesi baru (rotasi sekali pakai).
 * Tanpa token akses (pakai body saja) + TANPA silent-retry agar tidak berputar.
 */
export function refreshSessionTokens(
	refreshToken: string,
	timeoutMs: number = DEFAULT_LOGIN_TIMEOUT_MS
): Promise<RefreshSessionResult> {
	return apiRequest<RefreshSessionResult>('/auth/refresh', {
		method: 'POST',
		body: { refreshToken },
		timeoutMs,
		noAuthRetry: true
	});
}

/**
 * Cabut sesi di server saat logout eksplisit (best-effort: kegagalan
 * jaringan/token kedaluwarsa diabaikan — sesi lokal tetap dibersihkan).
 */
export function revokeSession(
	accessToken: string | null,
	refreshToken?: string | null
): Promise<{ revoked: number }> {
	return apiRequest<{ revoked: number }>('/auth/logout', {
		method: 'POST',
		body: refreshToken ? { refreshToken } : {},
		token: accessToken ?? undefined,
		noAuthRetry: true
	});
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

/**
 * Langkah 1 registrasi: minta kode OTP 6 digit (TANPA membuat akun).
 * Akun permanen baru dibuat server saat POST /auth/verify-email berhasil.
 * Data registrasi hanya tersimpan sementara di server sampai kode diverifikasi.
 */
export function registerRequest(
	name: string,
	username: string,
	email: string,
	password: string
): Promise<OtpRequestResult> {
	return apiRequest<OtpRequestResult>('/auth/register', {
		method: 'POST',
		body: { name, username, email, password }
	});
}

/**
 * Kode mesin backend saat login ditolak karena email belum diverifikasi.
 * Kontrak: backend menjawab HTTP 403 + errors:[{field:'email',message:'EMAIL_UNVERIFIED'}].
 * Frontend memakai ini untuk mengarahkan user ke /verify-email (bukan error buntu).
 */
export const EMAIL_UNVERIFIED_CODE = 'EMAIL_UNVERIFIED';

export function isEmailUnverifiedError(err: unknown): boolean {
	if (!(err instanceof BackendRequestError)) return false;
	if (err.httpStatus !== 403) return false;
	if (
		err.errors?.some((e) => e.field === 'email' && e.message === EMAIL_UNVERIFIED_CODE) === true
	) {
		return true;
	}
	// Toleransi pesan Indonesia bila backend belum memakai kode mesin di atas.
	return /belum\s+(di)?verifikasi/i.test(err.message);
}

/**
 * Hasil permintaan OTP (registrasi / kirim ulang / lupa password).
 * - Registrasi: akun BELUM dibuat — data hanya tersimpan sementara di server
 *   sampai kode diverifikasi (kedaluwarsa mengikuti `expiresInSeconds`).
 * - Lupa password: respons selalu generik agar tidak membocorkan daftar email.
 */
export interface OtpRequestResult {
	message: string;
	email: string;
	expiresInSeconds: number;
	resendCooldownSeconds: number;
}

/** Kirim ulang kode OTP registrasi (rate-limit + cooldown di server). */
export function resendEmailOtp(email: string): Promise<OtpRequestResult> {
	return apiRequest<OtpRequestResult>('/auth/resend-verification', {
		method: 'POST',
		body: { email }
	});
}

/**
 * Langkah 2 registrasi: verifikasi kode OTP → server membuat akun permanen
 * dan menerbitkan sesi/token (payload sama seperti login).
 */
export function verifyEmailRequest(email: string, code: string): Promise<AuthPayload> {
	return apiRequest<AuthPayload>('/auth/verify-email', {
		method: 'POST',
		body: { email, code }
	});
}

/**
 * Langkah 1 lupa password: minta kode OTP reset.
 * Selalu dianggap berhasil di UI (backend menjawab generik).
 */
export function forgotPasswordRequest(email: string): Promise<OtpRequestResult> {
	return apiRequest<OtpRequestResult>('/auth/forgot-password', {
		method: 'POST',
		body: { email }
	});
}

/**
 * Verifikasi kode OTP reset SAJA (tanpa mengubah password).
 * Gerbang layar password-baru: kode salah tidak boleh lanjut.
 * Gagal memakai pesan generik yang sama agar tidak membocorkan status.
 */
export function verifyResetCodeRequest(
	email: string,
	code: string
): Promise<{ message: string }> {
	return apiRequest<{ message: string }>('/auth/verify-reset-code', {
		method: 'POST',
		body: { email, code }
	});
}

/**
 * Langkah 2 lupa password: kode OTP + password baru.
 * Sukses = password diganti; user wajib login ulang (tidak auto-login).
 */
export function resetPasswordRequest(
	email: string,
	code: string,
	newPassword: string
): Promise<{ message: string }> {
	return apiRequest<{ message: string }>('/auth/reset-password', {
		method: 'POST',
		body: { email, code, newPassword }
	});
}

export async function meRequest(token: string): Promise<BackendUser> {
	const data = await apiRequest<{ user: BackendUser }>('/auth/me', { token });
	return data.user;
}
