import { browser } from '$app/environment';
import { SvelteMap } from 'svelte/reactivity';

/**
 * Grup patungan MOCK — SIMULASI LOKAL SAJA, BUKAN DATA NYATA.
 *
 * Backend ARISTOTELES saat ini TIDAK memiliki endpoint patungan
 * (tidak ada grup, undangan anggota, maupun pembayaran split).
 * Semua grup di bawah tersimpan di `localStorage` browser dan
 * TIDAK membuka akses kursus untuk siapa pun:
 * - JANGAN memanggil `purchaseCourse` / `enrollment` dari grup ini.
 * - JANGAN menampilkan status lunas simulasi sebagai akses nyata.
 * - Akses resmi tetap per akun lewat alur pembayaran backend
 *   (lihat `docs/05-kebutuhan-backend.md`, bagian Pembayaran).
 *
 * Kontrak backend yang dibutuhkan agar mock ini bisa dihapus
 * (usulan, BUKAN endpoint yang sudah ada — jangan mengarang):
 *   POST /api/v1/patungan/groups { courseId, memberNames[] }
 *   POST /api/v1/patungan/groups/:id/pay { memberIndex, proof }
 *   dengan validasi: 1 grup = 1 kursus, anggota 2–5 unik,
 *   lunas semua sebelum akses dibuka, anti-race pembayaran ganda.
 */

export interface PatunganMember {
	name: string;
	/** Lunas versi simulasi lokal — bukan bukti bayar terverifikasi. */
	paid: boolean;
}

export interface PatunganGroup {
	id: string;
	code: string;
	courseId: number;
	courseTitle: string;
	priceNominal: number;
	feeNominal: number;
	totalNominal: number;
	perPerson: number;
	members: PatunganMember[];
	createdAt: string;
}

const KEY = 'aristoteles:patungan-groups:v1';

/** Batas anggota patungan per grup (keputusan UI sementara). */
export const PATUNGAN_MIN_ANGGOTA = 2;
export const PATUNGAN_MAX_ANGGOTA = 5;

export const patunganGroups = new SvelteMap<string, PatunganGroup>();

function persist(): void {
	if (!browser) return;
	try {
		localStorage.setItem(KEY, JSON.stringify([...patunganGroups.values()]));
	} catch {
		// Penyimpanan penuh/diblokir — grup tetap berlaku sesi ini.
	}
}

function isValidGroup(g: unknown): g is PatunganGroup {
	if (typeof g !== 'object' || g === null) return false;
	const o = g as Record<string, unknown>;
	return (
		typeof o['id'] === 'string' &&
		typeof o['code'] === 'string' &&
		typeof o['courseId'] === 'number' &&
		typeof o['courseTitle'] === 'string' &&
		typeof o['totalNominal'] === 'number' &&
		typeof o['perPerson'] === 'number' &&
		Array.isArray(o['members']) &&
		(o['members'] as unknown[]).every(
			(m) => typeof m === 'object' && m !== null && typeof (m as { name?: unknown }).name === 'string'
		)
	);
}

if (browser) {
	try {
		const raw = localStorage.getItem(KEY);
		if (raw) {
			for (const g of JSON.parse(raw) as unknown[]) {
				if (isValidGroup(g)) patunganGroups.set(g.id, g);
			}
		}
	} catch {
		// Data korup — mulai dari daftar kosong.
	}
}

/** Bagi rata tagihan (total + fee) ke N anggota, dibulatkan ke atas. */
export function hitungPatungan(
	priceNominal: number,
	feeNominal: number,
	anggota: number
): { total: number; perPerson: number } {
	const total = Math.max(0, Math.round(priceNominal) + Math.round(feeNominal));
	const n = Math.min(PATUNGAN_MAX_ANGGOTA, Math.max(PATUNGAN_MIN_ANGGOTA, Math.floor(anggota)));
	return { total, perPerson: Math.ceil(total / n) };
}

function kodeGrup(): string {
	const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
	let s = '';
	for (let i = 0; i < 6; i += 1) s += chars[Math.floor(Math.random() * chars.length)];
	return `PTG-${s}`;
}

/**
 * Buat grup patungan simulasi. Mengembalikan grup baru, atau `null`
 * bila validasi gagal (kursus gratis, anggota di luar 2–5, nama kosong/duplikat).
 */
export function createPatunganGroup(input: {
	courseId: number;
	courseTitle: string;
	priceNominal: number;
	feeNominal: number;
	memberNames: string[];
}): PatunganGroup | null {
	const names = input.memberNames.map((n) => n.trim()).filter((n) => n.length > 0);
	const unique = new Set(names.map((n) => n.toLowerCase()));
	if (input.priceNominal <= 0) return null;
	if (names.length < PATUNGAN_MIN_ANGGOTA || names.length > PATUNGAN_MAX_ANGGOTA) return null;
	if (unique.size !== names.length) return null;
	const { total, perPerson } = hitungPatungan(input.priceNominal, input.feeNominal, names.length);
	const group: PatunganGroup = {
		id: `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`,
		code: kodeGrup(),
		courseId: input.courseId,
		courseTitle: input.courseTitle,
		priceNominal: Math.round(input.priceNominal),
		feeNominal: Math.round(input.feeNominal),
		totalNominal: total,
		perPerson,
		members: names.map((name) => ({ name, paid: false })),
		createdAt: new Date().toISOString()
	};
	patunganGroups.set(group.id, group);
	persist();
	return group;
}

/** Tandai iuran anggota (simulasi lokal — bukan verifikasi bayar). */
export function toggleAnggotaLunas(groupId: string, memberIndex: number): void {
	const g = patunganGroups.get(groupId);
	if (!g || memberIndex < 0 || memberIndex >= g.members.length) return;
	const members = g.members.map((m, i) => (i === memberIndex ? { ...m, paid: !m.paid } : m));
	patunganGroups.set(groupId, { ...g, members });
	persist();
}

export function hapusGrupPatungan(groupId: string): void {
	patunganGroups.delete(groupId);
	persist();
}

/** Daftar grup sebagai array (untuk {#each}). */
export function listGrupPatungan(): PatunganGroup[] {
	return [...patunganGroups.values()].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}
