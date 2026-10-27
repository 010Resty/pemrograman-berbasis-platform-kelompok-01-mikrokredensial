import { browser } from '$app/environment';
import {
	BackendRequestError,
	loginRequest,
	meRequest,
	registerRequest,
	type BackendUser
} from '$lib/api/backend';

/** Peran portal: student → /user, teacher → /instruktur, admin → /admin. */
export type Role = 'student' | 'teacher' | 'admin';

export interface PortalAccount {
	email: string;
	password: string;
	name: string;
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
 * Akun demo DEV-ONLY (tanpa backend).
 * Dipakai hanya bila `isDemoAuthEnabled()` true (import.meta.env.DEV).
 * JANGAN tampilkan/pakai di production — lihat login/+page.svelte.
 */
export const DEMO_ACCOUNTS: PortalAccount[] = [
	{
		email: 'farisi@gmail.com',
		password: '1234567',
		name: 'Ahmad Farizi',
		role: 'student',
		home: '/user',
		badge: 'Mahasiswa UNIRA',
		icon: 'fa-user-graduate',
		description: 'Akses kursus, materi, kuis, dan sertifikat.'
	},
	{
		email: 'kevin@aristoteles.ac.id',
		password: '1234567',
		name: 'Kevin Perry',
		role: 'teacher',
		home: '/instruktur',
		badge: 'Instruktur',
		icon: 'fa-chalkboard-user',
		description: 'Kelola kursus, nilai tugas, pantau pendapatan.'
	},
	{
		email: 'admin@aristoteles.ac.id',
		password: '1234567',
		name: 'Admin Aristoteles',
		role: 'admin',
		home: '/admin',
		badge: 'Administrator',
		icon: 'fa-shield-halved',
		description: 'Kelola users, instruktur, dan courses.'
	}
];

export const SESSION_KEY = 'aristoteles-session';
const TOKEN_KEY = 'aristoteles-access-token';

/** Mode demo eksplisit: hanya di `vite dev` / build DEV. Production (preview/prod) selalu false. */
export function isDemoAuthEnabled(): boolean {
	try {
		return import.meta.env.DEV === true;
	} catch {
		return false;
	}
}

let currentUser = $state<Session | null>(null);
let accessToken: string | null = null;
let initialized = false;

export function getCurrentUser(): Session | null {
	return currentUser;
}

/** Token akses backend (memori + storage). TIDAK PERNAH disimpan di kode/dokumen. */
export function getAccessToken(): string | null {
	if (accessToken) return accessToken;
	if (!browser) return null;
	try {
		return (
			sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY)
		);
	} catch {
		return null;
	}
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
 * Baca sesi tersimpan. Sesi lama TANPA `id` (era demo/localStorage) dianggap
 * tidak valid dan dibersihkan — user wajib login ulang via backend.
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
				typeof parsed?.email === 'string' &&
				isValidRole(parsed?.role)
			) {
				currentUser = { ...(parsed as Session), id: String(parsedId) };
				return currentUser;
			}
			// Sesi lama tanpa id -> bersihkan agar tidak dianggap login.
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
 * - Token salah/kedaluwarsa -> logout + 'unauthenticated'.
 * - Backend tidak terjangkau -> 'backend-down' TANPA logout (sesi dipertahankan,
 *   UI wajib menampilkan kondisi ini eksplisit, bukan sukses palsu).
 */
export async function verifySession(): Promise<VerifyResult> {
	const stored = loadSession();
	if (!stored) return { ok: false, reason: 'unauthenticated' };
	const token = getAccessToken();
	if (!token) {
		logout();
		return { ok: false, reason: 'unauthenticated' };
	}
	try {
		const user = await meRequest(token);
		const session = toSession(user);
		currentUser = session;
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

/** Login DEMO dev-only. Jangan dipakai di production; tidak menyentuh backend. */
export function login(
	email: string,
	password: string,
	rememberMe: boolean
): { ok: true; user: Session } | { ok: false; error: string } {
	const account = DEMO_ACCOUNTS.find(
		(a) => a.email.toLowerCase() === email.trim().toLowerCase()
	);
	if (!account || account.password !== password) {
		return { ok: false, error: 'Email atau kata sandi salah. Gunakan akun demo sesuai portal.' };
	}
	const user: Session = {
		id: `demo-${account.role}`,
		email: account.email,
		name: account.name,
		role: account.role,
		loginAt: new Date().toISOString()
	};
	currentUser = user;
	persistAuth(user, `demo-token-${account.role}`, rememberMe);
	return { ok: true, user };
}

/** Registrasi DEMO dev-only (student/teacher). Tidak membuat akun backend. */
export function register(
	name: string,
	email: string,
	role: Exclude<Role, 'admin'>,
	rememberMe: boolean
): Session {
	const user: Session = {
		id: `demo-${role}-${Date.now().toString(36)}`,
		email: email.trim(),
		name: name.trim(),
		role,
		loginAt: new Date().toISOString()
	};
	currentUser = user;
	persistAuth(user, `demo-token-${role}`, rememberMe);
	return user;
}

/** Masuk via SSO UNIRA (simulasi lokal, BUKAN auth backend). */
export function loginWithUnita(nim: string, rememberMe = true): Session {
	const user: Session = {
		id: `demo-unira-${nim.trim()}`,
		email: `${nim.trim()}@student.ac.id`,
		name: `Mahasiswa ${nim.trim()}`,
		role: 'student',
		loginAt: new Date().toISOString()
	};
	currentUser = user;
	persistAuth(user, 'demo-token-unira', rememberMe);
	return user;
}

export function logout(): void {
	currentUser = null;
	accessToken = null;
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

export function homeFor(role: Role): string {
	return ROLE_HOME[role];
}
