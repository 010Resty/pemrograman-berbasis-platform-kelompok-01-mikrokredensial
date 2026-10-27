import {
	getCourseById,
	normalizeMaterialType,
	type CourseModule,
	type SubModule,
	type Material
} from '$lib/data/courses';

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

/** Normalisasi draf: selaraskan flat materials + tipe materi.
 * Sub-modul default HANYA dibuat bila field subModules belum ada sama sekali
 * (draf lama); array kosong yang disengaja (mis. modul server baru) dibiarkan
 * kosong agar tidak muncul sub hantu. */
export function normalizeModule(mod: CourseModule): CourseModule {
	const hasSubs = Array.isArray(mod.subModules);
	const subs =
		hasSubs && (mod.subModules as SubModule[]).length > 0
			? (mod.subModules as SubModule[]).map((s) => ({
					...s,
					materials: (s.materials ?? []).map((m: Material) => ({
						...m,
						type: normalizeMaterialType(String(m.type))
					}))
				}))
			: hasSubs
				? []
				: [
						{
							id: `${mod.id}-sub1`,
							title: 'Sub-modul 1',
							description: mod.description,
							materials: (mod.materials ?? []).map((m: Material) => ({
								...m,
								type: normalizeMaterialType(String(m.type))
							}))
						}
					];
	return { ...mod, subModules: subs, materials: subs.flatMap((s) => s.materials) };
}

export function curriculumUid(prefix: string): string {
	return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4)}`;
}

/** Salin nilai menjadi data polos yang aman disimpan/diperbandingkan.
 *
 * `structuredClone` langsung pada proxy `$state` Svelte 5 melempar DataCloneError
 * (yang pernah meruntuhkan flush reaktif sehingga editor Tiptap gagal terpasang),
 * jadi selalu sediakan jalur aman JSON. Tidak pernah melempar.
 */
export function clonePlain<T>(value: T): T {
	try {
		return structuredClone(value);
	} catch {
		try {
			return JSON.parse(JSON.stringify(value)) as T;
		} catch {
			return value;
		}
	}
}

/** Muat draf (deep copy). Selalu kembalikan array baru agar aman disunting. */
export function loadCurriculumDraft(courseId: number): CourseModule[] {
	const key = String(courseId);
	if (mem[key]) return clonePlain(mem[key]);
	try {
		if (typeof localStorage !== 'undefined') {
			const raw = localStorage.getItem(storageKey(courseId));
			if (raw) {
				const parsed = JSON.parse(raw) as CourseModule[];
				if (Array.isArray(parsed)) {
					mem[key] = parsed.map(normalizeModule);
					return clonePlain(mem[key]);
				}
			}
		}
	} catch {
		// abaikan storage yang rusak / tidak tersedia
	}
	const course = getCourseById(courseId);
	const seed = course ? clonePlain(course.modules).map(normalizeModule) : [];
	mem[key] = seed;
	return clonePlain(seed);
}

/** Simpan draf (deep copy) ke memori + localStorage. Tidak pernah melempar. */
export function saveCurriculumDraft(courseId: number, modules: CourseModule[]): void {
	const plain = clonePlain(modules);
	const key = String(courseId);
	mem[key] = plain;
	try {
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem(storageKey(courseId), JSON.stringify(plain));
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
