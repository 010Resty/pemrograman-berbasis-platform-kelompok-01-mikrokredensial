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
const memMeta: Record<string, DraftMeta> = {};

/** K-08: versi + jejak perubahan draf kurikulum.
 *
 * Konteks jujur: ini metadata DRAF LOKAL (memori + localStorage), bukan
 * versi resmi backend. Tiap penyimpanan yang mengubah isi menaikkan versi
 * dan mencatat ringkasan; entri < 2 menit digabung agar log tidak spam
 * tiap ketikan. Klasifikasi penting/ringan + alasan tetap diputus
 * instruktur saat penerbitan (belum ada endpoint backend).
 */
export interface DraftChangeEntry {
	at: string;
	added: number;
	removed: number;
	changed: number;
	summary: string;
	/**
	 * Klasifikasi K-08, diputus instruktur pemilik kursus:
	 * - ringan: typo/format/sampul/judul (tanpa pengulangan progres)
	 * - penting: ubah isi kuis/tugas/ambang lulus atau hapus materi
	 * - belum-diputus: bawaan entri otomatis.
	 */
	kind: 'ringan' | 'penting' | 'belum-diputus';
}

export interface DraftMeta {
	version: number;
	updatedAt: string;
	log: DraftChangeEntry[];
}

function metaKey(courseId: number): string {
	return `kurikulum-draft-meta-${courseId}`;
}

const MAX_LOG = 30;
const COALESCE_MS = 120_000;

function flatIndex(modules: CourseModule[]): Map<string, string> {
	const out = new Map<string, string>();
	for (const m of modules ?? []) {
		out.set(`mod:${m.id}`, m.title ?? '');
		for (const s of m.subModules ?? []) {
			out.set(`sub:${s.id}`, s.title ?? '');
			for (const t of s.materials ?? []) {
				out.set(`mat:${t.id}`, `${t.type ?? ''}|${t.title ?? ''}`);
			}
		}
	}
	return out;
}

function describeDiff(added: number, removed: number, changed: number): string {
	const parts: string[] = [];
	if (added > 0) parts.push(`+${added} item`);
	if (removed > 0) parts.push(`−${removed} item`);
	if (changed > 0) parts.push(`~${changed} diubah`);
	return parts.length > 0 ? parts.join(', ') : 'penyesuaian';
}

function loadMeta(courseId: number): DraftMeta {
	const key = String(courseId);
	if (memMeta[key]) return memMeta[key];
	let meta: DraftMeta = { version: 0, updatedAt: '', log: [] };
	try {
		if (typeof localStorage !== 'undefined') {
			const raw = localStorage.getItem(metaKey(courseId));
			if (raw) {
				const parsed = JSON.parse(raw) as DraftMeta;
				if (parsed && typeof parsed.version === 'number' && Array.isArray(parsed.log)) {
					meta = {
						version: parsed.version,
						updatedAt: parsed.updatedAt ?? '',
						// Normalisasi entri lama (tanpa kind) + buang entri rusak.
						log: parsed.log
							.filter((e) => e && typeof e.at === 'string' && typeof e.summary === 'string')
							.map((e) => ({
								at: e.at,
								added: typeof e.added === 'number' ? e.added : 0,
								removed: typeof e.removed === 'number' ? e.removed : 0,
								changed: typeof e.changed === 'number' ? e.changed : 0,
								summary: e.summary,
								kind: (e.kind === 'ringan' || e.kind === 'penting'
									? e.kind
									: 'belum-diputus') as DraftChangeEntry['kind']
							}))
							.slice(0, MAX_LOG)
					};
				}
			}
		}
	} catch {
		// abaikan storage rusak
	}
	memMeta[key] = meta;
	return meta;
}

/** Baca metadata draf (deep copy). */
export function loadDraftMeta(courseId: number): DraftMeta {
	return clonePlain(loadMeta(courseId));
}

function persistMeta(courseId: number, meta: DraftMeta): void {
	memMeta[String(courseId)] = meta;
	try {
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem(metaKey(courseId), JSON.stringify(meta));
		}
	} catch {
		// abaikan kegagalan storage
	}
}

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

/** Simpan draf (deep copy) ke memori + localStorage. Tidak pernah melempar.
 * K-08: bila isi berubah, versi draf naik + ringkasan masuk log. */
export function saveCurriculumDraft(courseId: number, modules: CourseModule[]): void {
	const plain = clonePlain(modules);
	const key = String(courseId);
	const prev = mem[key] ? flatIndex(mem[key]) : null;
	mem[key] = plain;
	try {
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem(storageKey(courseId), JSON.stringify(plain));
		}
	} catch {
		// abaikan kegagalan storage
	}
	if (!prev) {
		const meta = loadMeta(courseId);
		if (meta.version === 0) {
			persistMeta(courseId, {
				version: 1,
				updatedAt: new Date().toISOString(),
				log: [
					{
						at: new Date().toISOString(),
						added: flatIndex(plain).size,
						removed: 0,
						changed: 0,
						summary: 'Draf kurikulum dibuat',
						kind: 'belum-diputus'
					}
				]
			});
		}
		return;
	}
	const next = flatIndex(plain);
	let added = 0;
	let removed = 0;
	let changed = 0;
	for (const [id, sig] of next) {
		if (!prev.has(id)) added++;
		else if (prev.get(id) !== sig) changed++;
	}
	for (const id of prev.keys()) {
		if (!next.has(id)) removed++;
	}
	if (added === 0 && removed === 0 && changed === 0) return;
	const meta = loadMeta(courseId);
	const at = new Date().toISOString();
	const summary = describeDiff(added, removed, changed);
	const last = meta.log[0];
	if (last && at < new Date(new Date(last.at).getTime() + COALESCE_MS).toISOString()) {
		// Gabung ke entri terakhir bila masih dalam jeda coalescing.
		meta.log[0] = {
			at,
			added: last.added + added,
			removed: last.removed + removed,
			changed: last.changed + changed,
			summary: describeDiff(last.added + added, last.removed + removed, last.changed + changed),
			kind: last.kind
		};
		meta.updatedAt = at;
		persistMeta(courseId, meta);
		return;
	}
	persistMeta(courseId, {
		version: meta.version + 1,
		updatedAt: at,
		log: [{ at, added, removed, changed, summary, kind: 'belum-diputus' as const }, ...meta.log].slice(0, MAX_LOG)
	});
}

/** Sinkronkan flat `materials` modul dari sub-modulnya. */
export function withSyncedFlat(mod: CourseModule): CourseModule {
	const subs = mod.subModules ?? [];
	return { ...mod, subModules: subs, materials: subs.flatMap((s) => s.materials) };
}

/** Tandai klasifikasi K-08 satu entri (diputus instruktur pemilik kursus). */
export function setDraftEntryKind(
	courseId: number,
	at: string,
	kind: 'ringan' | 'penting'
): void {
	const meta = loadMeta(courseId);
	const i = meta.log.findIndex((e) => e.at === at);
	if (i < 0) return;
	meta.log[i] = { ...meta.log[i], kind };
	persistMeta(courseId, meta);
}

/** Bentuk berkas cadangan draf (untuk unduh/unggah manual). */
export interface DraftBackup {
	kind: 'aristoteles-curriculum-draft';
	courseId: number;
	exportedAt: string;
	version: number;
	modules: CourseModule[];
	log: DraftChangeEntry[];
}

/** Susun payload cadangan draf + versinya. */
export function exportDraft(courseId: number): DraftBackup {
	return {
		kind: 'aristoteles-curriculum-draft',
		courseId,
		exportedAt: new Date().toISOString(),
		version: loadMeta(courseId).version,
		modules: loadCurriculumDraft(courseId),
		log: loadMeta(courseId).log
	};
}

/**
 * Pulihkan draf dari berkas cadangan. Validasi ketat: tolak bentuk asing.
 * Mengembalikan pesan ringkas untuk UI (bukan throw).
 */
export function importDraft(courseId: number, raw: unknown): { ok: boolean; message: string } {
	if (!raw || typeof raw !== 'object') return { ok: false, message: 'Berkas bukan cadangan draf yang valid.' };
	const data = raw as Partial<DraftBackup>;
	if (data.kind !== 'aristoteles-curriculum-draft' || !Array.isArray(data.modules)) {
		return { ok: false, message: 'Berkas bukan cadangan draf kurikulum ARISTOTELES.' };
	}
	if (typeof data.courseId === 'number' && data.courseId !== courseId) {
		return {
			ok: false,
			message: `Cadangan ini untuk kursus #${data.courseId}, bukan kursus yang sedang dibuka.`
		};
	}
	try {
		const modules = clonePlain(data.modules).map(normalizeModule);
		saveCurriculumDraft(courseId, modules);
		const meta = loadMeta(courseId);
		meta.log = [
			{
				at: new Date().toISOString(),
				added: 0,
				removed: 0,
				changed: 0,
				summary: 'Draf dipulihkan dari berkas cadangan',
				kind: 'belum-diputus' as const
			},
			...meta.log
		].slice(0, MAX_LOG);
		meta.updatedAt = new Date().toISOString();
		persistMeta(courseId, { ...meta, version: meta.version + 1 });
		return { ok: true, message: `Draf dipulihkan (cadangan v${data.version ?? '?'}).` };
	} catch {
		return { ok: false, message: 'Berkas rusak dan tidak dapat dipulihkan.' };
	}
}
