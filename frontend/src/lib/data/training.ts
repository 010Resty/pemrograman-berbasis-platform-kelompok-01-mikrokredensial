import type { Course, CourseModule, Material, SubModule } from './courses';
import { getModuleMaterials } from './courses';

/** Level hierarki pelatihan — discriminated union untuk type-safe traversal. */
export type TrainingLevel = 'pelatihan' | 'modul' | 'submodul' | 'materi';

export interface TrainingNodeBase<L extends TrainingLevel> {
	level: L;
	path: string;
}

export type TrainingNode =
	| (TrainingNodeBase<'pelatihan'> & { course: Course })
	| (TrainingNodeBase<'modul'> & { course: Course; module: CourseModule; moduleIndex: number })
	| (TrainingNodeBase<'submodul'> & {
			course: Course;
			module: CourseModule;
			moduleIndex: number;
			sub: SubModule;
			subIndex: number;
	  })
	| (TrainingNodeBase<'materi'> & {
			course: Course;
			module: CourseModule;
			moduleIndex: number;
			sub: SubModule;
			subIndex: number;
			material: Material;
			materialIndex: number;
	  });

export interface TrainingStats {
	moduleCount: number;
	subModuleCount: number;
	materialCount: number;
	byType: Record<Material['type'], number>;
	estimatedLabel: string;
}

/** Fallback: modul lama tanpa subModules dibungkus jadi 1 sub-modul agar UI tetap hierarkis. */
export function resolveSubModules(module: CourseModule): SubModule[] {
	if (module.subModules?.length) return module.subModules;
	return [
		{
			id: `${module.id}-sub1`,
			title: 'Materi Pokok',
			description: module.description,
			materials: module.materials
		}
	];
}

export function flattenTrainingMaterials(course: Course): Material[] {
	return course.modules.flatMap((m) => getModuleMaterials(m));
}

export function getTrainingStats(course: Course): TrainingStats {
	const materials = flattenTrainingMaterials(course);
	const byType: TrainingStats['byType'] = {
		materi: 0,
		video: 0,
		bacaan: 0,
		audio: 0,
		foto: 0,
		kuis: 0,
		tugas: 0
	};
	for (const m of materials) {
		const k = m.type as keyof typeof byType;
		if (k in byType) byType[k] += 1;
		else byType.materi += 1;
	}
	return {
		moduleCount: course.modules.length,
		subModuleCount: course.modules.reduce((n, m) => n + resolveSubModules(m).length, 0),
		materialCount: materials.length,
		byType,
		estimatedLabel: `${course.modules.length} modul · ${course.modules.reduce((n, m) => n + resolveSubModules(m).length, 0)} sub-modul · ${materials.length} materi`
	};
}

export type ProgressReader = (id: string) => boolean;

export function subModuleProgress(
	sub: SubModule,
	isDone: ProgressReader
): { done: number; total: number; percent: number } {
	const done = sub.materials.filter((m) => isDone(m.id)).length;
	const total = sub.materials.length;
	return { done, total, percent: total === 0 ? 0 : Math.round((done / total) * 100) };
}

export function moduleProgress(
	module: CourseModule,
	isDone: ProgressReader
): { done: number; total: number; percent: number } {
	const mats = getModuleMaterials(module);
	const done = mats.filter((m) => isDone(m.id)).length;
	const total = mats.length;
	return { done, total, percent: total === 0 ? 0 : Math.round((done / total) * 100) };
}

export function courseProgress(
	course: Course,
	isDone: ProgressReader
): { done: number; total: number; percent: number } {
	const mats = flattenTrainingMaterials(course);
	const done = mats.filter((m) => isDone(m.id)).length;
	const total = mats.length;
	return { done, total, percent: total === 0 ? 0 : Math.round((done / total) * 100) };
}

/** Cari lokasi materi dalam hierarki (modul + sub-modul + index). */
export function locateMaterial(
	course: Course,
	materialId: string
): Extract<TrainingNode, { level: 'materi' }> | null {
	for (let mi = 0; mi < course.modules.length; mi++) {
		const module = course.modules[mi];
		const subs = resolveSubModules(module);
		for (let si = 0; si < subs.length; si++) {
			const idx = subs[si].materials.findIndex((m) => m.id === materialId);
			if (idx >= 0) {
				return {
					level: 'materi',
					path: `/modules/${course.id}#${module.id}/${subs[si].id}/${materialId}`,
					course,
					module,
					moduleIndex: mi,
					sub: subs[si],
					subIndex: si,
					material: subs[si].materials[idx],
					materialIndex: idx
				};
			}
		}
	}
	return null;
}

/** Cari satu sub-modul beserta konteks modulnya. Dipakai halaman kumpulan materi. */
export function locateSubModule(
	course: Course,
	moduleId: string,
	subId: string
): Extract<TrainingNode, { level: 'submodul' }> | null {
	for (let mi = 0; mi < course.modules.length; mi++) {
		const module = course.modules[mi];
		if (module.id !== moduleId) continue;
		const subs = resolveSubModules(module);
		for (let si = 0; si < subs.length; si++) {
			if (subs[si].id !== subId) continue;
			return {
				level: 'submodul',
				path: subModuleHref(course.id, module.id, subs[si].id),
				course,
				module,
				moduleIndex: mi,
				sub: subs[si],
				subIndex: si
			};
		}
		return null;
	}
	return null;
}

/** URL kanonis halaman kumpulan materi sebuah sub-modul (route publik modules). */
export function subModuleHref(courseId: number | string, moduleId: string, subId: string): string {
	return `/modules/${courseId}/${moduleId}/${subId}`;
}

/** Sub-modul sebelum/sesudah dalam modul yang sama — untuk navigasi halaman materi. */
export function adjacentSubs(
	course: Course,
	moduleId: string,
	subId: string
): {
	prev: SubModule | null;
	next: SubModule | null;
	module: CourseModule | null;
	moduleIndex: number;
} {
	const moduleIndex = course.modules.findIndex((m) => m.id === moduleId);
	if (moduleIndex < 0) return { prev: null, next: null, module: null, moduleIndex: -1 };
	const module = course.modules[moduleIndex];
	const subs = resolveSubModules(module);
	const idx = subs.findIndex((s) => s.id === subId);
	if (idx < 0) return { prev: null, next: null, module, moduleIndex };
	return {
		prev: idx > 0 ? subs[idx - 1] : null,
		next: idx < subs.length - 1 ? subs[idx + 1] : null,
		module,
		moduleIndex
	};
}

/** Seleksi node roadmap untuk drawer info (modul atau sub-modul). */
export type RoadmapSelection =
	| {
			kind: 'module';
			module: CourseModule;
			moduleIndex: number;
			subCount: number;
			materialCount: number;
	  }
	| {
			kind: 'sub';
			module: CourseModule;
			moduleIndex: number;
			sub: SubModule;
			subIndex: number;
	  };

/** Ubah id node terpilih menjadi konteks info siap tampil. Null bila tak dikenal. */
export function resolveRoadmapSelection(
	modules: CourseModule[],
	id: string | null
): RoadmapSelection | null {
	if (!id) return null;
	for (let mi = 0; mi < modules.length; mi++) {
		const module = modules[mi];
		if (module.id === id) {
			const subs = resolveSubModules(module);
			return {
				kind: 'module',
				module,
				moduleIndex: mi,
				subCount: subs.length,
				materialCount: subs.reduce((n, s) => n + s.materials.length, 0)
			};
		}
		const subs = resolveSubModules(module);
		for (let si = 0; si < subs.length; si++) {
			if (subs[si].id === id)
				return { kind: 'sub', module, moduleIndex: mi, sub: subs[si], subIndex: si };
		}
	}
	return null;
}

/** Breadcrumb label generik untuk setiap node: Pelatihan › Modul n › Sub-modul m › Materi. */
export function nodeBreadcrumb(node: TrainingNode): string[] {
	if (node.level === 'pelatihan') return [node.course.title];
	if (node.level === 'modul')
		return [node.course.title, `Modul ${node.moduleIndex + 1}: ${node.module.title}`];
	if (node.level === 'submodul')
		return [
			node.course.title,
			`Modul ${node.moduleIndex + 1}: ${node.module.title}`,
			`Sub-modul ${node.subIndex + 1}: ${node.sub.title}`
		];
	return [
		node.course.title,
		`Modul ${node.moduleIndex + 1}: ${node.module.title}`,
		`Sub-modul ${node.subIndex + 1}: ${node.sub.title}`,
		node.material.title
	];
}

/* ---------- Geometri canvas roadmap (dipakai ulang publik + user) ---------- */

export const ROADMAP_NODE_W = 200;
export const ROADMAP_NODE_H = 56;

/** Palet editorial per modul — sub-modul mewarisi hue induknya. */
export interface RoadmapHue {
	from: string;
	to: string;
	soft: string;
	ink: string;
	ring: string;
	shadow: string;
}

export const ROADMAP_PALETTE: RoadmapHue[] = [
	{
		from: '#2563eb',
		to: '#1d4ed8',
		soft: '#eff6ff',
		ink: '#1d4ed8',
		ring: 'rgb(37 99 235 / 30%)',
		shadow: 'rgb(29 78 216 / 40%)'
	},
	{
		from: '#0284c7',
		to: '#075985',
		soft: '#f0f9ff',
		ink: '#0369a1',
		ring: 'rgb(2 132 199 / 30%)',
		shadow: 'rgb(7 89 133 / 40%)'
	},
	{
		from: '#1e3a8a',
		to: '#0f172a',
		soft: '#eef2f7',
		ink: '#1e3a8a',
		ring: 'rgb(30 58 138 / 30%)',
		shadow: 'rgb(15 23 42 / 42%)'
	},
	{
		from: '#0ea5e9',
		to: '#0369a1',
		soft: '#f0f9ff',
		ink: '#0284c7',
		ring: 'rgb(14 165 233 / 30%)',
		shadow: 'rgb(3 105 161 / 40%)'
	},
	{
		from: '#475569',
		to: '#1e293b',
		soft: '#f1f5f9',
		ink: '#334155',
		ring: 'rgb(71 85 105 / 30%)',
		shadow: 'rgb(30 41 59 / 42%)'
	},
	{
		from: '#0d9488',
		to: '#115e59',
		soft: '#effaf8',
		ink: '#0f766e',
		ring: 'rgb(13 148 136 / 30%)',
		shadow: 'rgb(17 94 89 / 40%)'
	}
];

export function roadmapHue(index: number): RoadmapHue {
	const n = ROADMAP_PALETTE.length;
	return ROADMAP_PALETTE[((index % n) + n) % n];
}

/** Hijau status untuk node yang sudah tuntas (konsisten di semua hue). */
export const ROADMAP_DONE_HUE: RoadmapHue = {
	from: '#16a34a',
	to: '#15803d',
	soft: '#edf7f0',
	ink: '#15803d',
	ring: 'rgb(22 163 74 / 30%)',
	shadow: 'rgb(21 128 61 / 40%)'
};

export interface RoadmapFlowNode {
	id: string;
	label: string;
	x: number;
	y: number;
	kind: 'module' | 'sub';
}

export interface RoadmapCurve {
	key: string;
	d: string;
}

export interface RoadmapLayout {
	nodes: RoadmapFlowNode[];
	connections: Array<[string, string]>;
	curves: RoadmapCurve[];
	w: number;
	h: number;
}

const ROADMAP_Y0 = 76;
const ROADMAP_PAD = 64;
const ROADMAP_SIDE_GAP = 48;
const ROADMAP_SUB_STEP = 78;
const ROADMAP_MODULE_GAP = 76;
const ROADMAP_ELBOW_R = 14;

/**
 * Hitung posisi node + garis canvas roadmap dari data modul.
 * Modul mengalir vertikal di sumbu tengah: Modul 1 → Modul 2 →
 * seterusnya LANGSUNG tanpa melalui sub-modul.
 * Sub-modul berada di SISI modulnya (genap kanan, ganjil kiri);
 * bila lebih dari satu, tersusun vertikal rapat ke bawah.
 * Tiap sub dijangkau garis putus-putus LANGSUNG dari modulnya
 * (siku melengkung), bukan dari sub pertama. Deterministik.
 */
export function computeRoadmapLayout(modules: CourseModule[]): RoadmapLayout {
	const subsPerModule = modules.map((m) => resolveSubModules(m));
	const hasLeft = subsPerModule.some((subs, i) => i % 2 === 1 && subs.length > 0);
	const hasRight = subsPerModule.some((subs, i) => i % 2 === 0 && subs.length > 0);
	const cx = ROADMAP_PAD + ROADMAP_NODE_W / 2 + (hasLeft ? ROADMAP_SIDE_GAP + ROADMAP_NODE_W : 0);
	const nodes: RoadmapFlowNode[] = [];
	const connections: Array<[string, string]> = [];
	const curves: RoadmapCurve[] = [];
	let cursor = ROADMAP_Y0;
	modules.forEach((m, i) => {
		const modCy = cursor;
		nodes.push({
			id: m.id,
			label: m.title,
			x: cx - ROADMAP_NODE_W / 2,
			y: modCy - ROADMAP_NODE_H / 2,
			kind: 'module'
		});
		if (i > 0) connections.push([modules[i - 1].id, m.id]);
		const leftSide = i % 2 === 1;
		const dir = leftSide ? -1 : 1;
		const modEdge = cx + dir * (ROADMAP_NODE_W / 2);
		const busX = modEdge + dir * (ROADMAP_SIDE_GAP / 2);
		const r = ROADMAP_ELBOW_R;
		let bottom = modCy + ROADMAP_NODE_H / 2;
		subsPerModule[i].forEach((s, j) => {
			const scy = modCy + j * ROADMAP_SUB_STEP;
			// Satu kolom vertikal rapat di sisi modul (tanpa geser horizontal).
			const x = leftSide
				? busX - ROADMAP_SIDE_GAP / 2 - ROADMAP_NODE_W
				: busX + ROADMAP_SIDE_GAP / 2;
			nodes.push({ id: s.id, label: s.title, x, y: scy - ROADMAP_NODE_H / 2, kind: 'sub' });
			if (j === 0) {
				const nearX = leftSide ? x + ROADMAP_NODE_W : x;
				const [x1, x2] = leftSide ? [nearX, modEdge] : [modEdge, nearX];
				curves.push({ key: s.id, d: `M ${x1} ${modCy} H ${x2}` });
			} else {
				const subInner = leftSide ? x + ROADMAP_NODE_W : x;
				curves.push({
					key: s.id,
					d: `M ${modEdge} ${modCy} H ${busX - dir * r} Q ${busX} ${modCy} ${busX} ${modCy + r} V ${scy - r} Q ${busX} ${scy} ${busX + dir * r} ${scy} H ${subInner}`
				});
			}
			bottom = scy + ROADMAP_NODE_H / 2;
		});
		cursor = bottom + ROADMAP_MODULE_GAP + ROADMAP_NODE_H / 2;
	});
	const rightEdge = cx + ROADMAP_NODE_W / 2 + (hasRight ? ROADMAP_SIDE_GAP + ROADMAP_NODE_W : 0);
	return {
		nodes,
		connections,
		curves,
		w: rightEdge + ROADMAP_PAD,
		h: modules.length > 0 ? cursor - ROADMAP_NODE_H / 2 - ROADMAP_MODULE_GAP + ROADMAP_PAD : 200
	};
}
/* ---------- Navigasi belajar (materi pertama yang belum selesai) ---------- */

/** Materi pertama yang belum selesai dalam daftar, atau undefined bila tuntas. */
export function firstUnfinishedMaterial(
	materials: Material[],
	isDone: ProgressReader
): Material | undefined {
	return materials.find((m) => !isDone(m.id));
}

/** Materi pertama yang belum selesai dalam satu modul (urutan flatten). */
export function firstUnfinishedInModule(
	module: CourseModule,
	isDone: ProgressReader
): Material | undefined {
	return firstUnfinishedMaterial(getModuleMaterials(module), isDone);
}

/** Materi pertama yang belum selesai dalam satu kursus + konteks modulnya. */
export function firstUnfinishedInCourse(
	course: Course,
	isDone: ProgressReader
): { module: CourseModule; moduleIndex: number; material: Material } | null {
	return firstUnfinishedInModules(course.modules, isDone);
}

/** Materi pertama yang belum selesai dalam daftar modul + konteks modulnya. */
export function firstUnfinishedInModules(
	modules: CourseModule[],
	isDone: ProgressReader
): { module: CourseModule; moduleIndex: number; material: Material } | null {
	for (let i = 0; i < modules.length; i++) {
		const mat = firstUnfinishedInModule(modules[i], isDone);
		if (mat) return { module: modules[i], moduleIndex: i, material: mat };
	}
	return null;
}
