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
