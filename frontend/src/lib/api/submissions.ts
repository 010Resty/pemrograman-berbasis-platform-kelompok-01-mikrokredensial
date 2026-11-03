import { apiRequest } from './backend';
import { getAccessToken, handlePrivateRequestError } from '$lib/stores/auth.svelte';

/**
 * Status pengumpulan tugas milik sendiri per materi (server yang menilai).
 * Kontrak backend: GET /api/v1/materials/:id/submissions/status →
 * `{attempts, graded, passed, lastStatus, bestScore, ...}`.
 * `passed` menempel di server; `lastStatus` ∈ submitted/reviewed berarti
 * menunggu penilaian bila belum lulus.
 */
export interface TaskStatus {
	materialId: number;
	attempts: number;
	graded: number;
	passed: boolean;
	lastStatus: string | null;
	bestScore: number | null;
}

export async function fetchTaskStatus(materialId: number): Promise<TaskStatus> {
	try {
		return await apiRequest<TaskStatus>(`/materials/${materialId}/submissions/status`, {
			token: getAccessToken()
		});
	} catch (e) {
		await handlePrivateRequestError(e);
		throw e;
	}
}

/** Satu baris pengumpulan versi backend (untuk penilai pengampu). */
export interface MaterialSubmissionItem {
	id: number;
	materialId: number;
	userId: number;
	fileId: number | null;
	fileUrl: string;
	originalName: string | null;
	sizeBytes: number | null;
	studentName: string | null;
	studentNim: string | null;
	note: string | null;
	score: number | null;
	feedback: string | null;
	status: string;
	gradedBy: number | null;
	gradedAt: string | null;
	submittedAt: string;
}

export interface MaterialSubmissionsResult {
	manager: boolean;
	rows: MaterialSubmissionItem[];
}

/**
 * Daftar pengumpulan satu materi (GET /api/v1/materials/:id/submissions).
 * Pengelola (teacher/admin pengampu) menerima semua baris + `manager: true`.
 */
export async function fetchMaterialSubmissions(
	materialId: number
): Promise<MaterialSubmissionsResult> {
	try {
		return await apiRequest<MaterialSubmissionsResult>(
			`/materials/${materialId}/submissions`,
			{ token: getAccessToken() }
		);
	} catch (e) {
		await handlePrivateRequestError(e);
		throw e;
	}
}

export interface GradeSubmissionInput {
	score: number;
	decision: 'passed' | 'failed' | 'revision_requested';
	feedback?: string;
}

/**
 * Nilai satu pengumpulan (POST /api/v1/materials/:id/submissions/:subId/grade).
 * Hanya teacher pengelola kursus + admin (backend menegakkan).
 */
export async function gradeMaterialSubmission(
	materialId: number,
	submissionId: number,
	input: GradeSubmissionInput
): Promise<MaterialSubmissionItem> {
	try {
		return await apiRequest<MaterialSubmissionItem>(
			`/materials/${materialId}/submissions/${submissionId}/grade`,
			{ method: 'POST', body: input, token: getAccessToken() }
		);
	} catch (e) {
		await handlePrivateRequestError(e);
		throw e;
	}
}

export interface ReviewQueueTask {
	materialId: number;
	title: string;
	moduleTitle: string;
	moduleIndex: number;
	duration: string | null;
	pending: number;
	graded: number;
	total: number;
	avgScore: number | null;
}

export interface ReviewQueueCourse {
	id: number;
	title: string;
	category: string | null;
	image: string | null;
	tasks: ReviewQueueTask[];
	pending: number;
	graded: number;
	total: number;
}

export interface ReviewQueueResult {
	courses: ReviewQueueCourse[];
	pendingTotal: number;
	gradedTotal: number;
	avgScore: number | null;
}

/**
 * Antrean penilaian pengelola dalam satu respons
 * (GET /api/v1/instructor/review-queue). Pengganti kipas N request.
 */
export async function fetchReviewQueue(): Promise<ReviewQueueResult> {
	try {
		return await apiRequest<ReviewQueueResult>('/instructor/review-queue', {
			token: getAccessToken()
		});
	} catch (e) {
		await handlePrivateRequestError(e);
		throw e;
	}
}
