import { browser } from '$app/environment';
import { goto } from '$app/navigation';
import {
	BackendRequestError,
	loginRequest,
	meRequest,
	registerRequest,
	type BackendUser
} from '$lib/api/backend';
import {
	classifyRequestError,
	createUnauthorizedCoordinator,
	type RequestFailureKind
} from '$lib/api/request-policy';

/** Peran portal: student → /user, teacher → /instruktur, admin → /admin. */
export type Role = 'student' | 'teacher' | 'admin';

/** Info portal statis (tanpa kredensial). Aman untuk deploy. */
export interface PortalInfo {
	role: Role;
	home: string;
	badge: string;
	icon: string;
	description: string;
}

export interface Session {
	id: string;
	email: string;
	name: string;
	role: Role;
	loginAt: string;
}

export const ROLE_LABEL: Record<Role, string> = {
	student: 'Student',
	teacher: 'Teacher',
	admin: 'Administrator'
};

export const ROLE_HOME: Record<Role, string> = {
	student: '/user',
	teacher: '/instruktur',
	admin: '/admin'
};

/**
 * Info portal untuk UI login (tanpa email/password).
 * Login nyata selalu via backend; tidak ada akun demo di bundle deploy.
 */
export const PORTALS: PortalInfo[] = [
	{
		role: 'student',
		home: '/user',
		badge: 'Mahasiswa UNIRA',
		icon: 'fa-user-graduate',
		description: 'Akses kursus, materi, kuis, dan sertifikat.'
	},
	{
		role: 'teacher',
		home: '/instruktur',
		badge: 'Instruktur',
		icon: 'fa-chalkboard-user',
		description: 'Kelola kursus, nilai tugas, pantau pendapatan.'
	},
	{
		role: 'admin',
		home: '/admin',
		badge: 'Administrator',
		icon: 'fa-shield-halved',
		description: 'Kelola users, instruktur, dan courses.'
	}
];

export const SESSION_KEY = 'aristoteles-session';
const TOKEN_KEY = 'aristoteles-access-token';

let currentUser = $state<Session | null>(null);
let accessToken: string | null = null;
let initialized = false;

/**
 * Cache verifikasi sesi terpusat (optimasi request):
 * - `verifiedSession/verifiedToken`: hasil /me terakhir yang valid.
 * - `verifyInFlight`: single-flight — pemanggilan bersamaan berbagi satu Promise.
 * Navigasi antarrute memakai cache ini tanpa request ulang; verifikasi ulang
 * hanya bila `force`, token berubah, login baru, atau sesi ditolak.
 */
let verifiedSession: Session | null = null;
let verifiedToken: string | null = null;
let verifyInFlight: Promise<VerifyResult> | null = null;

/**
 * Generasi sesi: naik setiap login/register sukses dan setiap logout.
 * Cache privat mencatat generasi saat request dikirim; respons yang tiba
 * setelah generasi berganti (logout/ganti akun) WAJIB dibuang agar data
 * akun lama tidak mengisi cache akun baru.
 */
let sessionGeneration = 0;

/** Pembersih cache privat terdaftar (store domain mendaftarkan `clear`-nya). */
const privateCacheClearers = new Set<() => void>();

export function getCurrentUser(): Session | null {
	return currentUser;
}

/** Token akses backend (memori + storage). TIDAK PERNAH disimpan di kode/dokumen. */
export function getAccessToken(): string | null {
	const raw =
		accessToken ??
		(browser
			? (() => {
					try {
						return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
					} catch {
						return null;
					}
				})()
			: null);
	// Token era demo tidak valid untuk backend — tolak agar guard logout.
	if (raw && raw.startsWith('demo-token-')) return null;
	return raw;
}

function isValidRole(value: unknown): value is Role {
	return value === 'student' || value === 'teacher' || value === 'admin';
}

function toSession(user: BackendUser): Session {
	return {
		// Backend memakai id numerik; frontend menyimpan sebagai string.
		id: String(user.id),
		email: user.email,
		name: user.name,
		role: user.role,
		loginAt: new Date().toISOString()
	};
}

function persistAuth(session: Session, token: string, rememberMe: boolean): void {
	accessToken = token;
	if (!browser) return;
	try {
		const rawSession = JSON.stringify(session);
		if (rememberMe) {
			localStorage.setItem(SESSION_KEY, rawSession);
			localStorage.setItem(TOKEN_KEY, token);
			sessionStorage.removeItem(SESSION_KEY);
			sessionStorage.removeItem(TOKEN_KEY);
		} else {
			sessionStorage.setItem(SESSION_KEY, rawSession);
			sessionStorage.setItem(TOKEN_KEY, token);
			localStorage.removeItem(SESSION_KEY);
			localStorage.removeItem(TOKEN_KEY);
		}
	} catch {
		// penyimpanan tidak tersedia — sesi tetap berlaku di memori
	}
}

/**
 * Baca sesi tersimpan. Sesi lama era demo (id `demo-*`, token `demo-token-*`,
 * atau tanpa `id`) dianggap tidak valid dan dibersihkan — user wajib login
 * ulang via backend. Guard portal wajib memakai `verifySession()` (/me),
 * bukan hanya fungsi ini.
 */
export function loadSession(): Session | null {
	if (currentUser) return currentUser;
	if (!browser) return null;
	if (initialized) return currentUser;
	initialized = true;
	for (const storage of [localStorage, sessionStorage]) {
		try {
			const raw = storage.getItem(SESSION_KEY);
			if (!raw) continue;
			const parsed = JSON.parse(raw) as Partial<Session>;
			const parsedId = parsed?.id;
			if (
				(typeof parsedId === 'string' || typeof parsedId === 'number') &&
				String(parsedId).length > 0 &&
				!String(parsedId).startsWith('demo-') &&
				typeof parsed?.email === 'string' &&
				isValidRole(parsed?.role)
			) {
				currentUser = { ...(parsed as Session), id: String(parsedId) };
				return currentUser;
			}
			// Sesi lama/demo tanpa id valid -> bersihkan agar tidak dianggap login.
			storage.removeItem(SESSION_KEY);
		} catch {
			// abaikan data korup, lanjut ke penyimpanan berikutnya
		}
	}
	return currentUser;
}

export type BackendAuthResult =
	| { ok: true; user: Session }
	| { ok: false; error: string; fieldErrors?: Array<{ field: string; message: string }> };

function toUserMessage(err: unknown, fallback: string): BackendAuthResult {
	if (err instanceof BackendRequestError) {
		if (err.httpStatus === 0) return { ok: false, error: err.message };
		if (err.httpStatus === 401 || err.httpStatus === 400) {
			return { ok: false, error: err.message, fieldErrors: err.errors ?? undefined };
		}
		return { ok: false, error: err.message || fallback };
	}
	return { ok: false, error: fallback };
}

/**
 * Login nyata via backend (POST /api/v1/auth/login).
 * TIDAK ada fallback sukses lokal: backend gagal = login gagal.
 */
export async function loginWithBackend(
	email: string,
	password: string,
	rememberMe: boolean
): Promise<BackendAuthResult> {
	try {
		const payload = await loginRequest(email.trim(), password);
		const session = toSession(payload.user);
		currentUser = session;
		persistAuth(session, payload.accessToken, rememberMe);
		// Seed cache verifikasi: respons login sudah tervalidasi server,
		// sehingga guard portal setelah login tidak perlu /me tambahan.
		verifiedSession = session;
		verifiedToken = payload.accessToken;
		sessionGeneration += 1;
		return { ok: true, user: session };
	} catch (err) {
		return toUserMessage(err, 'Login gagal. Coba lagi nanti.');
	}
}

/**
 * Registrasi peserta nyata via backend (POST /api/v1/auth/register).
 * Backend selalu membuat role `student` (K-01: tanpa teacher/admin publik).
 */
export async function registerWithBackend(
	name: string,
	email: string,
	password: string,
	rememberMe: boolean
): Promise<BackendAuthResult> {
	try {
		const payload = await registerRequest(name.trim(), email.trim(), password);
		const session = toSession(payload.user);
		currentUser = session;
		persistAuth(session, payload.accessToken, rememberMe);
		// Seed cache verifikasi seperti login (respons register tervalidasi server).
		verifiedSession = session;
		verifiedToken = payload.accessToken;
		sessionGeneration += 1;
		return { ok: true, user: session };
	} catch (err) {
		return toUserMessage(err, 'Registrasi gagal. Coba lagi nanti.');
	}
}

/**
 * Verifikasi sesi ke backend (GET /api/v1/auth/me).
 * 401/kedaluwarsa -> sesi dibersihkan dan null dikembalikan.
 */
export async function fetchCurrentUser(): Promise<Session | null> {
	const res = await verifySession();
	return res.ok ? res.session : null;
}

export type VerifyReason = 'unauthenticated' | 'backend-down';
export type VerifyResult = { ok: true; session: Session } | { ok: false; reason: VerifyReason };

/**
 * Verifikasi sesi tersimpan ke server untuk guard portal.
 * - Sesi valid -> session (peran dari SERVER, bukan tebakan browser).
 * - Token salah/kedaluwarsa/nonaktif -> logout + 'unauthenticated'.
 * - Backend tidak terjangkau -> 'backend-down' TANPA logout (sesi dipertahankan,
 *   UI wajib menampilkan kondisi ini eksplisit, bukan sukses palsu).
 *
 * Optimasi: hasil terverifikasi dipakai ulang tanpa request bila token sama.
 * Pemanggilan bersamaan berbagi satu Promise (single-flight). Tidak ada
 * polling/retry otomatis — retry hanya via `refreshSession()` eksplisit.
 */
export async function verifySession(options: { force?: boolean } = {}): Promise<VerifyResult> {
	const stored = loadSession();
	if (!stored) {
		clearVerifiedCache();
		return { ok: false, reason: 'unauthenticated' };
	}
	const token = getAccessToken();
	if (!token) {
		logout();
		return { ok: false, reason: 'unauthenticated' };
	}
	// Cache hit: token sama dan sudah terverifikasi -> tanpa request.
	if (!options.force && verifiedSession && verifiedToken === token) {
		currentUser = verifiedSession;
		return { ok: true, session: verifiedSession };
	}
	// Single-flight: berbagi request yang sedang berjalan.
	if (verifyInFlight) return verifyInFlight;
	verifyInFlight = doVerify(token);
	try {
		return await verifyInFlight;
	} finally {
		verifyInFlight = null;
	}
}

async function doVerify(token: string): Promise<VerifyResult> {
	try {
		const user = await meRequest(token);
		const session = toSession(user);
		currentUser = session;
		verifiedSession = session;
		verifiedToken = token;
		if (browser) {
			try {
				if (localStorage.getItem(TOKEN_KEY)) {
					localStorage.setItem(SESSION_KEY, JSON.stringify(session));
				} else {
					sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
				}
			} catch {
				// abaikan
			}
		}
		return { ok: true, session };
	} catch (err) {
		if (err instanceof BackendRequestError && err.httpStatus === 0) {
			return { ok: false, reason: 'backend-down' };
		}
		logout();
		return { ok: false, reason: 'unauthenticated' };
	}
}

export function logout(): void {
	currentUser = null;
	accessToken = null;
	clearVerifiedCache();
	sessionGeneration += 1;
	clearAllPrivateCaches();
	if (!browser) return;
	try {
		localStorage.removeItem(SESSION_KEY);
		localStorage.removeItem(TOKEN_KEY);
		sessionStorage.removeItem(SESSION_KEY);
		sessionStorage.removeItem(TOKEN_KEY);
	} catch {
		// abaikan
	}
}

/** Tandai cache verifikasi basi — verifikasi berikutnya wajib request baru. */
export function invalidateSession(): void {
	clearVerifiedCache();
}

/** Verifikasi ulang eksplisit ke server (bypass cache, tetap single-flight). */
export function refreshSession(): Promise<VerifyResult> {
	return verifySession({ force: true });
}

/** True bila sesi sudah terverifikasi untuk token aktif (tanpa request). */
export function isSessionVerified(): boolean {
	const token = getAccessToken();
	return token !== null && verifiedSession !== null && verifiedToken === token;
}

function clearVerifiedCache(): void {
	verifiedSession = null;
	verifiedToken = null;
}

/** Generasi sesi saat ini — naik tiap login/register/logout. */
export function currentSessionGeneration(): number {
	return sessionGeneration;
}

/**
 * Daftarkan pembersih cache privat milik store domain (dipanggil sekali
 * saat modul store dimuat). Dieksekusi saat logout dan saat sesi 401.
 */
export function registerPrivateCacheClearer(clear: () => void): () => void {
	privateCacheClearers.add(clear);
	return () => {
		privateCacheClearers.delete(clear);
	};
}

/** Hapus seluruh cache privat terdaftar. Tidak pernah melempar. */
export function clearAllPrivateCaches(): void {
	for (const clear of privateCacheClearers) {
		try {
			clear();
		} catch {
			// satu store gagal dibersihkan tidak boleh menggagalkan yang lain
		}
	}
}

const unauthorizedCoordinator = createUnauthorizedCoordinator();

function isAuthPage(): boolean {
	if (!browser) return true;
	try {
		const p = window.location.pathname;
		return p === '/login' || p === '/register';
	} catch {
		return true;
	}
}

/**
 * Penanganan terpusat error request privat (dipakai wrapper `req()` domain):
 * - 401: sesi tidak valid/kedaluwarsa → invalidasi sesi + bersihkan cache
 *   privat + logout, lalu arahkan ke /login. Single-flight: N request 401
 *   bersamaan → side-effect 1×, redirect 1× per generasi. Tanpa retry.
 * - 403: izin ditolak — sesi tetap valid, TANPA logout/redirect/clear.
 * - network (0)/5xx: token dipertahankan, TANPA logout; caller menampilkan retry.
 * Selalu kembalikan klasifikasi; caller wajib melempar error asli.
 */
export async function handlePrivateRequestError(err: unknown): Promise<RequestFailureKind> {
	const kind = classifyRequestError(err);
	if (kind !== 'unauthorized') return kind;
	const generation = sessionGeneration;
	await unauthorizedCoordinator.handle(
		err,
		generation,
		{
			runSideEffects: () => {
				clearAllPrivateCaches();
				logout();
			},
			requestRedirect: () => {
				if (!browser || isAuthPage()) return;
				void goto('/login');
			}
		}
	);
	return kind;
}

export function homeFor(role: Role): string {
	return ROLE_HOME[role];
}
