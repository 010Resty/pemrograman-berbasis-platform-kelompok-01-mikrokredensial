import { apiRequest } from './backend';
import { getAccessToken, handlePrivateRequestError } from '$lib/stores/auth.svelte';

/**
 * Pendaftaran + status akses kursus milik sendiri.
 * Kontrak backend: `backend/docs/API_CONTRACT.md` §5.
 * - POST `/courses/:id/enroll`: daftar mandiri (hanya gratis/published/terbuka).
 * - GET `/courses/:id/access`: status akses saya (sumber kebenaran gerbang materi).
 * - GET `/me/enrollments`: daftar milik (lihat `api/progress.ts`, tidak diduplikasi).
 */

export interface CourseAccessEnrollment {
	status: string;
	source: string;
	enrolledAt: string;
}

export interface CourseAccessState {
	hasAccess: boolean;
	isManager: boolean;
	enrollment: CourseAccessEnrollment | null;
	courseExists: boolean;
}

export interface EnrollResult {
	courseId: number;
	status: string;
	source: string;
	reactivated: boolean;
}

async function req<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
	try {
		return await apiRequest<T>(path, { ...options, token: getAccessToken() });
	} catch (e) {
		await handlePrivateRequestError(e);
		throw e;
	}
}

/** Status akses saya untuk satu kursus (GET /api/v1/courses/:id/access). */
export function fetchCourseAccess(courseId: number): Promise<CourseAccessState> {
	return req<CourseAccessState>(`/courses/${courseId}/access`);
}

/** Daftar mandiri kursus gratis (POST /api/v1/courses/:id/enroll). */
export function enrollFreeCourse(courseId: number): Promise<EnrollResult> {
	return req<EnrollResult>(`/courses/${courseId}/enroll`, { method: 'POST' });
}
