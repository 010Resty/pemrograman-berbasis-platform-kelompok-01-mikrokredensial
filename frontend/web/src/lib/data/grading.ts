import { courses } from './courses';
import { getMaterialDetail } from './material-details';
import { resolveSubModules } from './training';

/** Satu baris antrean penilaian (contoh lokal maupun submission Drive). */
export interface ReviewItem {
	id: number | string;
	student: string;
	nim: string;
	course: string;
	task: string;
	type: 'Tugas' | 'Kuis';
	date: string;
	status: 'Menunggu' | 'Dinilai';
	score: number | null;
	/** Umpan balik instruktur (tersimpan bila backend terjangkau). */
	feedback?: string | null;
	driveLink?: string;
	fileName?: string;
	submissionId?: string;
	/** ID rujukan ke data asli (diisi dari API; data contoh memakai pencocokan nama). */
	courseId?: string | null;
	moduleId?: string | null;
	materialId?: string | null;
}

/** Satu materi yang bisa dinilai (hanya tugas; kuis pilihan ganda dinilai otomatis). */
export interface TaskInfo {
	key: string;
	courseId: number;
	courseTitle: string;
	category: string;
	materialId: string;
	title: string;
	moduleTitle: string;
	moduleIndex: number;
	subTitle: string;
	duration: string;
	brief?: string;
	objectives?: string[];
	steps?: string[];
	deliverable?: string;
	deadline?: string;
}

/** Indeks statis seluruh materi tugas, kunci `${courseId}::${materialId}`. */
export const TASK_INDEX: Map<string, TaskInfo> = new Map();
/** Urutan course yang memiliki materi tugas. */
export const COURSE_ORDER: number[] = [];

for (const course of courses) {
	let hasGradable = false;
	course.modules.forEach((mod, moduleIndex) => {
		for (const sub of resolveSubModules(mod)) {
			for (const mat of sub.materials) {
				if (mat.type !== 'tugas') continue;
				hasGradable = true;
				const key = `${course.id}::${mat.id}`;
				if (TASK_INDEX.has(key)) continue;
				const detail = getMaterialDetail(mat, course, mod.title);
				TASK_INDEX.set(key, {
					key,
					courseId: course.id,
					courseTitle: course.title,
					category: course.category,
					materialId: mat.id,
					title: mat.title,
					moduleTitle: mod.title,
					moduleIndex,
					subTitle: sub.title,
					duration: mat.duration,
					brief: detail.assignment?.brief,
					objectives: detail.assignment?.objectives,
					steps: detail.assignment?.steps,
					deliverable: detail.assignment?.deliverable,
					deadline: detail.assignment?.deadline
				});
			}
		}
	});
	if (hasGradable) COURSE_ORDER.push(course.id);
}

/** Daftar materi tugas satu course, urut sesuai kurikulum. */
export function tasksOfCourse(courseId: number): TaskInfo[] {
	return [...TASK_INDEX.values()].filter((t) => t.courseId === courseId);
}

export function getTaskInfo(courseId: number, materialId: string): TaskInfo | undefined {
	return TASK_INDEX.get(`${courseId}::${materialId}`);
}

/** Petakan satu pengumpulan ke kunci tugas di indeks. Null bila tak dikenal. */
export function resolveTaskKey(r: Pick<ReviewItem, 'course' | 'task' | 'courseId' | 'materialId'>): string | null {
	if (r.materialId) {
		const cid = Number(r.courseId);
		if (Number.isFinite(cid)) {
			const key = `${cid}::${r.materialId}`;
			if (TASK_INDEX.has(key)) return key;
		}
	}
	const course = courses.find((c) => c.title === r.course);
	if (!course) return null;
	for (const info of TASK_INDEX.values()) {
		if (info.courseId === course.id && info.title === r.task) return info.key;
	}
	return null;
}

/** Tautan terdalam untuk sebuah (course, task): halaman tugas, course, atau indeks. */
export function resolveGradingHref(courseTitle: string, taskTitle: string): string {
	const course = courses.find((c) => c.title === courseTitle);
	if (!course) return '/instruktur/penilaian';
	for (const info of TASK_INDEX.values()) {
		if (info.courseId === course.id && info.title === taskTitle) {
			return `/instruktur/penilaian/${course.id}/${info.materialId}`;
		}
	}
	return `/instruktur/penilaian/${course.id}`;
}
