import { apiRequest } from './backend';
import { getAccessToken, handlePrivateRequestError } from '$lib/stores/auth.svelte';

/**
 * API progres + kepemilikan milik sendiri untuk dasbor user.
 * Seluruh angka dari backend; frontend tidak menghitung kelulusan sendiri.
 * Kontrak backend: docs `backend/docs/API_CONTRACT.md` §6 (progres),
 * §9 (sertifikat milik sendiri), §5 (enrollment milik sendiri).
 */

export interface CourseProgressSummary {
	courseId: number;
	courseTitle: string;
	totalMaterials: number;
	completedMaterials: number;
	/** Persen 0–100, satu desimal. */
	percent: number;
}

export interface MyProgressSummary {
	totalCourses: number;
	totalMaterials: number;
	completedMaterials: number;
	/** Σ selesai / Σ materi × 100, satu desimal. */
	percent: number;
	perCourse: CourseProgressSummary[];
}

export interface MyEnrollment {
	status: 'active' | 'completed' | 'expired' | 'cancelled';
	source: string;
	enrolledAt: string;
	courseId: number;
	title: string;
	description: string | null;
	category: string | null;
	level: string;
	duration: string | null;
	image: string | null;
	statusCourse: string;
	priceLabel: string;
	priceNominal: number;
	period: string;
}

export interface MyCertificate {
	id: number;
	code: string;
	recipientName: string;
	courseId: number;
	courseTitle: string;
	moduleId: number;
	moduleTitle: string;
	status: string;
	issuedAt: string;
	revokedAt: string | null;
	revokeReason: string | null;
}

async function req<T>(path: string, options?: { method?: string; body?: unknown }): Promise<T> {
	try {
		return await apiRequest<T>(path, { ...options, token: getAccessToken() });
	} catch (e) {
		await handlePrivateRequestError(e);
		throw e;
	}
}

/** Id materi yang ditandai selesai milik sendiri, opsional per kursus. */
export function fetchMyProgressIds(courseId?: number): Promise<number[]> {
	const q = courseId !== undefined ? `?courseId=${courseId}` : '';
	return req<number[]>(`/me/progress${q}`);
}

/** Ringkasan "Progres Keseluruhan" (GET /api/v1/me/progress/summary). */
export function fetchMyProgressSummary(): Promise<MyProgressSummary> {
	return req<MyProgressSummary>('/me/progress/summary');
}

/** Tandai materi selesai milik sendiri (POST /api/v1/materials/:id/progress). */
export async function markMaterialComplete(
	materialId: number
): Promise<{ materialId: number; completed: boolean; alreadyCompleted: boolean }> {
	return req<{ materialId: number; completed: boolean; alreadyCompleted: boolean }>(
		`/materials/${materialId}/progress`,
		{ method: 'POST' }
	);
}

/** Kursus yang saya ikuti (GET /api/v1/me/enrollments). */
export function fetchMyEnrollments(): Promise<MyEnrollment[]> {
	return req<MyEnrollment[]>('/me/enrollments');
}

/** Sertifikat milik saya (GET /api/v1/me/certificates). */
export function fetchMyCertificates(): Promise<MyCertificate[]> {
	return req<MyCertificate[]>('/me/certificates');
}
