import { browser } from '$app/environment';
import { SvelteSet } from 'svelte/reactivity';
import { getCourseMeta } from '$lib/data/course-meta';

/**
 * Kepemilikan course berbayar (simulasi sisi klien).
 * Course GRATIS selalu terbuka; course berlabel harga terkunci
 * sampai user menyelesaikan pembayaran di /user/pembayaran/[courseId].
 * Course berbayar yang belum dibayar TIDAK tampil di Kursusku.
 * Daftar milik tersimpan di localStorage.
 */
const KEY = 'aristoteles:owned-courses:v2';

export const ownedCourses = new SvelteSet<number>();

function persist(): void {
	if (!browser) return;
	try {
		localStorage.setItem(KEY, JSON.stringify([...ownedCourses]));
	} catch {
		// Penyimpanan penuh/diblokir — kepemilikan tetap berlaku sesi ini.
	}
}

if (browser) {
	try {
		const raw = localStorage.getItem(KEY);
		if (raw) {
			for (const id of JSON.parse(raw) as unknown[]) {
				if (typeof id === 'number') ownedCourses.add(id);
			}
		}
	} catch {
		// Data korup — mulai dari kepemilikan kosong.
	}
}

/** True bila course berlabel harga (bukan GRATIS). */
export function isCoursePaid(courseId: number): boolean {
	const server = serverFlags.get(courseId);
	if (server) return server.paid;
	return getCourseMeta(courseId).price.trim().toUpperCase() !== 'GRATIS';
}

/** True bila batch course belum mulai (periode upcoming). */
export function isPeriodLocked(courseId: number): boolean {
	const server = serverFlags.get(courseId);
	if (server) return server.upcoming;
	return getCourseMeta(courseId).period === 'upcoming';
}

/**
 * Bendera server per kursus (diisi halaman katalog/pratinjau dari baris backend).
 * Tanpa ini, course backend yang tak ada di meta statis selalu dianggap
 * gratis + berjalan. Registri sesi saja; static fallback tetap untuk id lama.
 */
const serverFlags = new Map<number, { paid: boolean; upcoming: boolean }>();

export function setServerCourseFlags(
	courseId: number,
	flags: { paid: boolean; upcoming: boolean }
): void {
	serverFlags.set(courseId, flags);
}

/** True bila user boleh membuka materi course ini. */
export function canAccessCourse(courseId: number): boolean {
	return !isCoursePaid(courseId) || ownedCourses.has(courseId);
}

/**
 * True bila user boleh MEMBUKA MATERI course ini.
 * Syarat ganda: lunas/terdaftar (canAccessCourse) DAN batch sudah berjalan.
 * Course upcoming tetap terkunci walau user sudah mengikutinya.
 */
export function canOpenMaterials(courseId: number): boolean {
	return canAccessCourse(courseId) && !isPeriodLocked(courseId);
}

/** Simulasi pembayaran: langsung membuka akses + menyimpan bukti milik. */
export function purchaseCourse(courseId: number): void {
	ownedCourses.add(courseId);
	persist();
}

/** Hapus kepemilikan satu course (batal ikut / reset demo). */
export function releaseCourse(courseId: number): void {
	ownedCourses.delete(courseId);
	persist();
}

/** Hapus semua kepemilikan (reset demo pembayaran). */
export function resetOwnership(): void {
	ownedCourses.clear();
	persist();
}
