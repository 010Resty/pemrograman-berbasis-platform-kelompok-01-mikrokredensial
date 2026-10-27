import { apiRequest, getApiBase } from './backend';
import { getAccessToken } from '$lib/stores/auth.svelte';
import type { Course, CourseModule } from '$lib/data/courses';
import { normalizeMaterialType, type MaterialType } from '$lib/data/courses';

/** Bentuk kursus mentah dari backend. */
export interface BackendCourse {
	id: number;
	title: string;
	description: string | null;
	category: string | null;
	level: string;
	duration: string | null;
	image: string | null;
	status: 'draft' | 'published' | 'archived';
	priceLabel: string;
	priceNominal: number;
	period: string;
	startMonth: string | null;
	outcomes: string[] | null;
	requirements: string[] | null;
	tools: string[] | null;
	createdBy: number | null;
	instructors?: Array<{ id: number; name: string }>;
}

export interface BackendModule {
	id: number;
	courseId: number;
	title: string;
	description: string | null;
	type: 'materi' | 'tugas' | 'kuis';
	position: number;
}

export interface BackendSubModule {
	id: number;
	moduleId: number;
	title: string;
	description: string | null;
	position: number;
}

export interface BackendMaterial {
	id: number;
	moduleId: number;
	subModuleId: number | null;
	title: string;
	type: string;
	duration: string | null;
	content: string | null;
	contentSchemaVersion: number;
	passScore: number | null;
	position: number;
}

function req<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
	return apiRequest<T>(path, { ...options, token: getAccessToken() });
}

export interface CreateCourseInput {
	title: string;
	category: string;
	level: string;
	durationMonths: number;
	description: string;
	coverUrl?: string | null;
	period?: 'upcoming' | 'ongoing' | 'ended';
	startMonth: string;
	priceNominal: number;
	outcomes: string[];
	tools: string[];
}

/** Status publikasi server → label UI halaman instruktur. */
export function publishBadge(status: string): 'Aktif' | 'Draft' {
	return status === 'published' ? 'Aktif' : 'Draft';
}

export async function fetchMyCourses(): Promise<BackendCourse[]> {
	const data = await req<{ courses?: BackendCourse[] } | BackendCourse[]>('/instructor/courses');
	return Array.isArray(data) ? data : (data.courses ?? []);
}

export async function fetchCourseDetail(id: number): Promise<BackendCourse> {
	const data = await req<{ course?: BackendCourse } | BackendCourse>(`/courses/${id}`);
	return (data as { course?: BackendCourse }).course ?? (data as BackendCourse);
}

export async function createCourse(input: CreateCourseInput): Promise<BackendCourse> {
	const data = await req<{ course?: BackendCourse } | BackendCourse>('/courses', {
		method: 'POST',
		body: input
	});
	const course = (data as { course?: BackendCourse }).course ?? (data as BackendCourse);
	return course;
}

export async function updateCourse(
	id: number,
	input: Record<string, unknown>
): Promise<BackendCourse> {
	const data = await req<{ course?: BackendCourse } | BackendCourse>(`/courses/${id}`, {
		method: 'PATCH',
		body: input
	});
	return (data as { course?: BackendCourse }).course ?? (data as BackendCourse);
}

/** Hapus kursus + seluruh tree di server (teacher pemilik/pengampu, admin). */
export async function deleteCourse(id: number): Promise<void> {
	await req(`/courses/${id}`, { method: 'DELETE' });
}

export async function fetchModules(courseId: number): Promise<BackendModule[]> {
	const data = await req<{ modules?: BackendModule[] } | BackendModule[]>(
		`/courses/${courseId}/modules`
	);
	return Array.isArray(data) ? data : (data.modules ?? []);
}

export async function createModule(
	courseId: number,
	input: { title: string; description?: string | null; type: 'materi' | 'tugas' | 'kuis'; position: number }
): Promise<BackendModule> {
	const data = await req<{ module?: BackendModule } | BackendModule>(
		`/courses/${courseId}/modules`,
		{ method: 'POST', body: input }
	);
	return (data as { module?: BackendModule }).module ?? (data as unknown as BackendModule);
}

export async function updateModule(id: number, input: Record<string, unknown>): Promise<BackendModule> {
	const data = await req<{ module?: BackendModule } | BackendModule>(`/modules/${id}`, {
		method: 'PATCH',
		body: input
	});
	return (data as { module?: BackendModule }).module ?? (data as unknown as BackendModule);
}

export async function deleteModule(id: number): Promise<void> {
	await req(`/modules/${id}`, { method: 'DELETE' });
}

export async function fetchSubModules(moduleId: number): Promise<BackendSubModule[]> {
	const data = await req<{ subModules?: BackendSubModule[] } | BackendSubModule[]>(
		`/modules/${moduleId}/submodules`
	);
	return Array.isArray(data)
		? data
		: ((data as { subModules?: BackendSubModule[] }).subModules ?? []);
}

export async function createSubModule(
	moduleId: number,
	input: { title: string; description?: string | null; position: number }
): Promise<BackendSubModule> {
	const data = await req<{ subModule?: BackendSubModule } | BackendSubModule>(
		`/modules/${moduleId}/submodules`,
		{ method: 'POST', body: input }
	);
	return (
		(data as { subModule?: BackendSubModule }).subModule ?? (data as unknown as BackendSubModule)
	);
}

export async function updateSubModule(id: number, input: Record<string, unknown>): Promise<unknown> {
	return req(`/submodules/${id}`, { method: 'PATCH', body: input });
}

export async function deleteSubModule(id: number): Promise<void> {
	await req(`/submodules/${id}`, { method: 'DELETE' });
}

export async function fetchMaterialsBySub(subId: number): Promise<BackendMaterial[]> {
	const data = await req<{ materials?: BackendMaterial[] } | BackendMaterial[]>(
		`/submodules/${subId}/materials`
	);
	return Array.isArray(data) ? data : ((data as { materials?: BackendMaterial[] }).materials ?? []);
}

export async function createMaterial(
	subId: number,
	input: {
		title: string;
		type: string;
		duration?: string | null;
		content: string;
		position: number;
	}
): Promise<BackendMaterial> {
	const data = await req<{ material?: BackendMaterial } | BackendMaterial>(
		`/submodules/${subId}/materials`,
		{ method: 'POST', body: input }
	);
	return (data as { material?: BackendMaterial }).material ?? (data as unknown as BackendMaterial);
}

export async function updateMaterial(id: number, input: Record<string, unknown>): Promise<unknown> {
	return req(`/materials/${id}`, { method: 'PATCH', body: input });
}

/** Detail satu materi (termasuk passScore server untuk kuis). */
export async function fetchMaterialDetail(id: number): Promise<BackendMaterial> {
	const data = await req<{ material?: BackendMaterial } | BackendMaterial>(`/materials/${id}`);
	return (data as { material?: BackendMaterial }).material ?? (data as BackendMaterial);
}

export async function deleteMaterial(id: number): Promise<void> {
	await req(`/materials/${id}`, { method: 'DELETE' });
}

/** Peta tipe backend (string bebas) ke tipe materi UI. */
function toMaterialType(t: unknown): MaterialType {
	const known = ['materi', 'tugas', 'kuis', 'video', 'bacaan', 'audio', 'foto'] as const;
	if (typeof t === 'string' && (known as readonly string[]).includes(t)) return t as MaterialType;
	return normalizeMaterialType(String(t ?? 'materi')) as MaterialType;
}

/** Bangun pohon CourseModule UI dari endpoint tree backend. */
export async function fetchCourseTree(courseId: number): Promise<CourseModule[]> {
	const modules = await fetchModules(courseId);
	const out: CourseModule[] = [];
	for (const m of modules) {
		const subs = await fetchSubModules(m.id);
		const subModules = [];
		for (const s of subs) {
			const mats = await fetchMaterialsBySub(s.id);
			subModules.push({
				id: String(s.id),
				title: s.title,
				description: s.description ?? '',
				materials: mats.map((t) => ({
					id: String(t.id),
					title: t.title,
					type: toMaterialType(t.type),
					duration: t.duration ?? '',
					completed: false
				}))
			});
		}
		// Materi langsung di modul (tanpa sub) ikut sebagai sub sintetis agar UI konsisten.
		const direct = await req<{ materials?: BackendMaterial[] } | BackendMaterial[]>(
			`/modules/${m.id}/materials`
		).then((d) => (Array.isArray(d) ? d : (d.materials ?? [])));
		const directMats = direct.filter((t) => t.subModuleId === null);
		const allSubs =
			directMats.length > 0
				? [
						...subModules,
						{
							id: `${m.id}-direct`,
							title: 'Materi langsung',
							description: '',
							materials: directMats.map((t) => ({
								id: String(t.id),
								title: t.title,
								type: toMaterialType(t.type),
								duration: t.duration ?? '',
								completed: false
							}))
						}
					]
				: subModules;
		out.push({
			id: String(m.id),
			title: m.title,
			description: m.description ?? '',
			materials: allSubs.flatMap((s) => s.materials),
			subModules: allSubs
		});
	}
	return out;
}

/** Adaptasi kursus backend ke bentuk Course UI (untuk daftar & header kelola). */
export function toCourseView(b: BackendCourse): Course & { publishState: string; instructorNames: string } {
	return {
		id: b.id,
		title: b.title,
		category: b.category ?? 'Umum',
		instructor: b.instructors?.[0]?.name ?? 'Instruktur',
		image: b.image ?? '',
		description: b.description ?? '',
		duration: b.duration ?? '',
		level: b.level,
		progress: 0,
		totalMaterials: 0,
		completedMaterials: 0,
		status: 'not-started',
		lastAccessed: '-',
		modules: [],
		publishState: b.status,
		instructorNames: (b.instructors ?? []).map((i) => i.name).join(', ') || 'Instruktur'
	};
}

/** URL absolut berkas untuk <img src> dkk (same backend). */
export function fileUrl(path: string): string {
	if (/^https?:\/\//i.test(path)) return path;
	return `${getApiBase()}${path.startsWith('/') ? path : `/${path}`}`;
}

/** Registry sesi: id kursus server yg sedang dikelola (agar drill-down + back-nav jalan). */
const REG_KEY = 'aristoteles:server-kelola:v1';

function readRegistry(): Set<string> {
	try {
		if (typeof sessionStorage === 'undefined') return new Set();
		const raw = sessionStorage.getItem(REG_KEY);
		if (!raw) return new Set();
		const arr = JSON.parse(raw) as unknown;
		return new Set(Array.isArray(arr) ? arr.map(String) : []);
	} catch {
		return new Set();
	}
}

export function markServerKelola(id: number | string): void {
	try {
		if (typeof sessionStorage === 'undefined') return;
		const set = readRegistry();
		set.add(String(id));
		sessionStorage.setItem(REG_KEY, JSON.stringify([...set]));
	} catch {
		/* abaikan */
	}
}

export function isServerKelola(id: number | string): boolean {
	return readRegistry().has(String(id));
}

/** True bila id berasal dari server (numerik), bukan draf lokal. */
export function isServerId(id: string | number | null | undefined): boolean {
	if (id === null || id === undefined) return false;
	return /^\d+$/.test(String(id));
}

/** Ambil kursus server + tanam draf lokal sekali (agar halaman kelola yg ada langsung jalan). */
export async function resolveServerCourse(
	courseId: number
): Promise<(Course & { publishState: string; instructorNames: string }) | null> {
	try {
		const detail = await fetchCourseDetail(courseId);
		const adapted = toCourseView(detail);
		if (typeof localStorage !== 'undefined' && localStorage.getItem(`kurikulum-draft-${courseId}`) === null) {
			const tree = await fetchCourseTree(courseId).catch(() => []);
			const { saveCurriculumDraft, withSyncedFlat } = await import('$lib/stores/curriculum');
			saveCurriculumDraft(
				courseId,
				tree.map((m) => withSyncedFlat({ ...m, materials: m.materials ?? [] }))
			);
		}
		return adapted;
	} catch {
		return null;
	}
}
