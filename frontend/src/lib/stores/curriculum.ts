import { getCourseById, type CourseModule } from '$lib/data/courses';

/**
 * Draf kurikulum sisi klien, dipakai bersama oleh halaman kelola:
 * - /instruktur/kursusku/[courseId] (modul)
 * - /instruktur/kursusku/[courseId]/[moduleId] (sub-modul)
 * - /instruktur/kursusku/[courseId]/[moduleId]/[subId] (materi)
 *
 * Disimpan di memori + localStorage agar navigasi drill-down
 * (modul → sub-modul → materi) tidak menghilangkan suntingan.
 */

const mem: Record<string, CourseModule[]> = {};

function storageKey(courseId: number): string {
	return `kurikulum-draft-${courseId}`;
}

/** Normalisasi draf: tiap modul wajib punya sub-modul + flat materials sinkron. */
export function normalizeModule(mod: CourseModule): CourseModule {
	const subs =
		mod.subModules?.length && mod.subModules.length > 0
			? mod.subModules
			: [
					{
						id: `${mod.id}-sub1`,
						title: 'Sub-modul 1',
						description: mod.description,
						materials: mod.materials
					}
				];
	return { ...mod, subModules: subs, materials: subs.flatMap((s) => s.materials) };
}

export function curriculumUid(prefix: string): string {
	return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4)}`;
}

/** Muat draf (deep copy). Selalu kembalikan array baru agar aman disunting. */
export function loadCurriculumDraft(courseId: number): CourseModule[] {
	const key = String(courseId);
	if (mem[key]) return structuredClone(mem[key]);
	try {
		if (typeof localStorage !== 'undefined') {
			const raw = localStorage.getItem(storageKey(courseId));
			if (raw) {
				const parsed = JSON.parse(raw) as CourseModule[];
				if (Array.isArray(parsed)) {
					mem[key] = parsed.map(normalizeModule);
					return structuredClone(mem[key]);
				}
			}
		}
	} catch {
		// abaikan storage yang rusak / tidak tersedia
	}
	const course = getCourseById(courseId);
	const seed = course ? structuredClone(course.modules).map(normalizeModule) : [];
	mem[key] = seed;
	return structuredClone(seed);
}

/** Simpan draf (deep copy) ke memori + localStorage. */
export function saveCurriculumDraft(courseId: number, modules: CourseModule[]): void {
	const key = String(courseId);
	mem[key] = structuredClone(modules);
	try {
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem(storageKey(courseId), JSON.stringify(modules));
		}
	} catch {
		// abaikan kegagalan storage
	}
}

/** Sinkronkan flat `materials` modul dari sub-modulnya. */
export function withSyncedFlat(mod: CourseModule): CourseModule {
	const subs = mod.subModules ?? [];
	return { ...mod, subModules: subs, materials: subs.flatMap((s) => s.materials) };
}
