import { browser } from '$app/environment';

/**
 * Undangan instruktur — SIMULASI LOKAL (browser saja, demo).
 *
 * Token di sini HANYA untuk demo alur UI (`demo-...`) dan BUKAN token keamanan
 * produksi. Token asli, pengiriman email, validasi kedaluwarsa/pemakaian,
 * dan aktivasi akun wajib dilakukan backend. Jangan pernah menyimpan password
 * di store ini.
 */
export type InvitationStatus = 'Pending' | 'Accepted' | 'Expired' | 'Cancelled';

export interface InstructorInvitation {
	id: string;
	name: string;
	email: string;
	note: string;
	/** Token demo lokal. Backend produksi harus memakai token rahasia acak. */
	token: string;
	status: InvitationStatus;
	createdAt: string;
	expiresAt: string;
	acceptedAt: string | null;
}

export type InvitationView = InstructorInvitation;

const KEY = 'aristoteles:invitations:v1';
const MAX_ITEMS = 50;
const EXPIRY_DAYS = 7;

function uid(): string {
	return `inv-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

function demoToken(): string {
	const rand =
		typeof crypto !== 'undefined' && 'randomUUID' in crypto
			? crypto.randomUUID().replace(/-/g, '').slice(0, 16)
			: Math.random().toString(36).slice(2, 18);
	return `demo-${rand}`;
}

function loadAll(): InstructorInvitation[] {
	if (!browser) return [];
	try {
		const raw = localStorage.getItem(KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw) as InstructorInvitation[];
		if (!Array.isArray(parsed)) return [];
		return parsed.filter((i) => i && typeof i === 'object' && typeof i.id === 'string');
	} catch {
		return [];
	}
}

function persistAll(list: InstructorInvitation[]): void {
	if (!browser) return;
	try {
		localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX_ITEMS)));
	} catch {
		/* penyimpanan penuh/diblokir — perubahan hanya berlaku sesi ini */
	}
}

export function isExpired(inv: Pick<InstructorInvitation, 'expiresAt'>, now = Date.now()): boolean {
	return new Date(inv.expiresAt).getTime() <= now;
}

export function toView(inv: InstructorInvitation): InvitationView {
	if (inv.status !== 'Pending') return { ...inv, status: inv.status };
	return isExpired(inv) ? { ...inv, status: 'Expired' } : { ...inv, status: 'Pending' };
}

export function listInvitations(): InvitationView[] {
	return loadAll().map(toView);
}

export function createInvitation(input: { name: string; email: string; note: string }): InvitationView {
	const now = new Date();
	const inv: InstructorInvitation = {
		id: uid(),
		name: input.name.trim(),
		email: input.email.trim().toLowerCase(),
		note: input.note.trim(),
		token: demoToken(),
		status: 'Pending',
		createdAt: now.toISOString(),
		expiresAt: new Date(now.getTime() + EXPIRY_DAYS * 24 * 3600 * 1000).toISOString(),
		acceptedAt: null
	};
	const list = [inv, ...loadAll()].slice(0, MAX_ITEMS);
	persistAll(list);
	return toView(inv);
}

export function hasPendingForEmail(email: string): boolean {
	const addr = email.trim().toLowerCase();
	return loadAll().some(
		(i) => i.email.toLowerCase() === addr && i.status === 'Pending' && !isExpired(i)
	);
}

export function cancelInvitation(id: string): void {
	persistAll(loadAll().map((i) => (i.id === id ? { ...i, status: 'Cancelled' as const } : i)));
}

export function resendInvitation(id: string): InvitationView | null {
	const now = new Date();
	let found: InvitationView | null = null;
	persistAll(
		loadAll().map((i) => {
			if (i.id !== id) return i;
			const next: InstructorInvitation = {
				...i,
				status: 'Pending',
				token: demoToken(),
				createdAt: now.toISOString(),
				expiresAt: new Date(now.getTime() + EXPIRY_DAYS * 24 * 3600 * 1000).toISOString(),
				acceptedAt: null
			};
			found = toView(next);
			return next;
		})
	);
	return found;
}

export type AcceptResult =
	| { ok: true; invitation: InvitationView }
	| { ok: false; reason: 'not-found' | 'used' | 'expired' | 'cancelled' };

/** Tandai undangan dipakai (simulasi lokal). TIDAK membuat/mengaktifkan akun. */
export function acceptInvitation(token: string): AcceptResult {
	const list = loadAll();
	const inv = list.find((i) => i.token === token);
	if (!inv) return { ok: false, reason: 'not-found' };
	if (inv.status === 'Cancelled') return { ok: false, reason: 'cancelled' };
	if (inv.status === 'Accepted') return { ok: false, reason: 'used' };
	if (isExpired(inv)) return { ok: false, reason: 'expired' };
	const done: InstructorInvitation = { ...inv, status: 'Accepted', acceptedAt: new Date().toISOString() };
	persistAll(list.map((i) => (i.id === inv.id ? done : i)));
	return { ok: true, invitation: toView(done) };
}

export function findByToken(token: string): InvitationView | null {
	const inv = loadAll().find((i) => i.token === token);
	return inv ? toView(inv) : null;
}

export function inviteLink(token: string): string {
	return `/invite/${encodeURIComponent(token)}`;
}
