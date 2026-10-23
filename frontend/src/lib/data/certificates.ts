import type { Course, CourseModule } from './courses';
import { getModuleMaterials } from './courses';
import { resolveSubModules } from './training';

/** Sertifikat tingkat modul — satu sertifikat per modul yang tuntas. */
export interface ModuleCertificate {
	courseId: number;
	courseTitle: string;
	moduleId: string;
	moduleIndex: number;
	moduleTitle: string;
	/** ID kredensial deterministik, mis. ATS-2026-C1-M1 */
	credentialId: string;
	materialCount: number;
	subModuleCount: number;
}

/** Sertifikat tingkat pelatihan — terbit bila seluruh modul tuntas. */
export interface CourseCertificate {
	courseId: number;
	courseTitle: string;
	credentialId: string;
	moduleCount: number;
	materialCount: number;
}

export type ProgressReader = (id: string) => boolean;

/** ID kredensial modul: stabil, mudah diverifikasi, tanpa random. */
export function moduleCredentialId(courseId: number, moduleIndex: number): string {
	return `ATS-2026-C${courseId}-M${moduleIndex + 1}`;
}

/** ID kredensial pelatihan (akhir). */
export function courseCredentialId(courseId: number): string {
	return `ATS-2026-C${courseId}-FULL`;
}

/** Daftar sertifikat modul untuk satu pelatihan. */
export function getModuleCertificates(course: Course): ModuleCertificate[] {
	return course.modules.map((m, i) => ({
		courseId: course.id,
		courseTitle: course.title,
		moduleId: m.id,
		moduleIndex: i,
		moduleTitle: m.title,
		credentialId: moduleCredentialId(course.id, i),
		materialCount: getModuleMaterials(m).length,
		subModuleCount: resolveSubModules(m).length
	}));
}

/** Sertifikat akhir pelatihan. */
export function getCourseCertificate(course: Course): CourseCertificate {
	const materialCount = course.modules.reduce((n, m) => n + getModuleMaterials(m).length, 0);
	return {
		courseId: course.id,
		courseTitle: course.title,
		credentialId: courseCredentialId(course.id),
		moduleCount: course.modules.length,
		materialCount
	};
}

/** True bila seluruh materi dalam modul sudah selesai. */
export function isModuleComplete(module: CourseModule, isDone: ProgressReader): boolean {
	const mats = getModuleMaterials(module);
	if (mats.length === 0) return false;
	return mats.every((m) => isDone(m.id));
}

/** True bila seluruh materi pelatihan sudah selesai. */
export function isCourseComplete(course: Course, isDone: ProgressReader): boolean {
	const mats = course.modules.flatMap((m) => getModuleMaterials(m));
	if (mats.length === 0) return false;
	return mats.every((m) => isDone(m.id));
}

/** URL publik detail satu modul (learning path). */
export function moduleHref(courseId: number | string, moduleId: string): string {
	return `/modules/${courseId}/${moduleId}`;
}

/** Cari modul berdasarkan id + index. */
export function locateModule(
	course: Course,
	moduleId: string
): { module: CourseModule; moduleIndex: number } | null {
	const moduleIndex = course.modules.findIndex((m) => m.id === moduleId);
	if (moduleIndex < 0) return null;
	return { module: course.modules[moduleIndex], moduleIndex };
}
