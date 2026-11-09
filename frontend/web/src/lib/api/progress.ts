import { apiRequest, getApiBase } from './backend';
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
	/** null = sertifikat level kursus. */
	moduleId: number | null;
	moduleTitle: string | null;
	/** Nama instruktur utama kursus (untuk sampul). */
	instructorName?: string | null;
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

export interface CertificatePdfDownload {
	blob: Blob;
	filename: string;
}

function filenameFromDisposition(header: string | null, fallback: string): string {
	if (header) {
		const star = /filename\*=UTF-8''([^;]+)/i.exec(header);
		if (star?.[1]) {
			try {
				return decodeURIComponent(star[1].trim());
			} catch {
				/* abaikan, lanjut ke pola biasa */
			}
		}
		const plain = /filename="([^"]+)"/i.exec(header) ?? /filename=([^;]+)/i.exec(header);
		if (plain?.[1]) return plain[1].trim();
	}
	return fallback;
}

/**
 * Unduh PDF sertifikat milik sendiri sebagai Blob
 * (GET /api/v1/me/certificates/:id/download mewajibkan token; tautan <a>
 * biasa tidak membawa Authorization sehingga 403).
 * Pemanggil membuat object URL dan mencabutnya setelah dipakai.
 */
export async function downloadMyCertificatePdf(id: number): Promise<CertificatePdfDownload> {
	const token = getAccessToken();
	const res = await fetch(`${getApiBase()}/me/certificates/${id}/download`, {
		headers: token ? { authorization: `Bearer ${token}` } : {}
	});
	if (!res.ok) {
		let message = `Gagal mengunduh sertifikat (HTTP ${res.status}).`;
		try {
			const json = (await res.json()) as { message?: unknown };
			if (typeof json.message === 'string' && json.message) message = json.message;
		} catch {
			/* respons bukan JSON — pakai pesan default */
		}
		throw new Error(message);
	}
	return {
		blob: await res.blob(),
		filename: filenameFromDisposition(res.headers.get('content-disposition'), `sertifikat-${id}.pdf`)
	};
}
