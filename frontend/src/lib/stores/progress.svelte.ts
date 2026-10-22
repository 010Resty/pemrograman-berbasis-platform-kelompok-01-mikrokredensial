import { SvelteSet } from 'svelte/reactivity';
import type { Course } from '$lib/data/courses';
import { getModuleMaterials } from '$lib/data/courses';

/**
 * Status penyelesaian materi yang dipakai bersama oleh halaman modul,
 * sidebar materi, kuis, dan penugasan — sehingga membuka materi berikutnya
 * langsung terjadi begitu materi sebelumnya selesai, di halaman mana pun.
 */
export const doneMaterials = new SvelteSet<string>();

/** Kursus yang sudah di-seed — progres user tidak pernah ditimpa/dihapus. */
const seededCourses = new Set<number>();

/** Isi status awal dari data kursus (sekali per kursus, tidak menghapus progres user). */
export function ensureSeeded(course: Course): void {
	if (seededCourses.has(course.id)) return;
	seededCourses.add(course.id);
	for (const m of course.modules) {
		for (const mat of getModuleMaterials(m)) {
			if (mat.completed) doneMaterials.add(mat.id);
		}
	}
}

export function isDone(id: string): boolean {
	return doneMaterials.has(id);
}

export function toggleDone(id: string): void {
	if (doneMaterials.has(id)) doneMaterials.delete(id);
	else doneMaterials.add(id);
}

export function markDone(id: string): void {
	doneMaterials.add(id);
}
