import { browser } from '$app/environment';

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

/** Akun demo tiap portal (simulasi sisi klien, tanpa backend). */
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

let currentUser = $state<Session | null>(null);
let initialized = false;

export function getCurrentUser(): Session | null {
	return currentUser;
}

/** Baca sesi tersimpan (localStorage lalu sessionStorage). Sekali panggil per sesi browser. */
export function loadSession(): Session | null {
	if (currentUser) return currentUser;
	if (!browser) return null;
	if (initialized) return currentUser;
	initialized = true;
	for (const storage of [localStorage, sessionStorage]) {
		try {
			const raw = storage.getItem(SESSION_KEY);
			if (!raw) continue;
			const parsed = JSON.parse(raw) as Session;
			if (parsed?.email && parsed?.role && ROLE_HOME[parsed.role]) {
				currentUser = parsed;
				return currentUser;
			}
		} catch {
			// abaikan data korup, lanjut ke penyimpanan berikutnya
		}
	}
	return currentUser;
}

function persist(session: Session, rememberMe: boolean): void {
	if (!browser) return;
	try {
		const raw = JSON.stringify(session);
		(rememberMe ? localStorage : sessionStorage).setItem(SESSION_KEY, raw);
		(rememberMe ? sessionStorage : localStorage).removeItem(SESSION_KEY);
	} catch {
		// penyimpanan tidak tersedia — sesi tetap berlaku di memori
	}
}

/** Login dengan akun demo. Mengembalikan user bila cocok, atau pesan error. */
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
		email: account.email,
		name: account.name,
		role: account.role,
		loginAt: new Date().toISOString()
	};
	currentUser = user;
	persist(user, rememberMe);
	return { ok: true, user };
}

/** Registrasi mandiri (student/teacher). Admin hanya dibuat oleh admin. */
export function register(
	name: string,
	email: string,
	role: Exclude<Role, 'admin'>,
	rememberMe: boolean
): Session {
	const user: Session = {
		email: email.trim(),
		name: name.trim(),
		role,
		loginAt: new Date().toISOString()
	};
	currentUser = user;
	persist(user, rememberMe);
	return user;
}

/** Masuk via SSO UNIRA sebagai student. */
export function loginWithUnita(nim: string, rememberMe = true): Session {
	const user: Session = {
		email: `${nim.trim()}@student.ac.id`,
		name: `Mahasiswa ${nim.trim()}`,
		role: 'student',
		loginAt: new Date().toISOString()
	};
	currentUser = user;
	persist(user, rememberMe);
	return user;
}

export function logout(): void {
	currentUser = null;
	if (!browser) return;
	try {
		localStorage.removeItem(SESSION_KEY);
		sessionStorage.removeItem(SESSION_KEY);
	} catch {
		// abaikan
	}
}

export function homeFor(role: Role): string {
	return ROLE_HOME[role];
}
