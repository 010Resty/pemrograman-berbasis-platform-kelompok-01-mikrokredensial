import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

function backendBase(): string {
	return env.BACKEND_URL || env.PUBLIC_API_BASE_URL || 'http://localhost:3000';
}

const DECISIONS = ['passed', 'failed', 'revision_requested'] as const;

/**
 * PATCH /api/assignments/grade/:id { score, materialId, decision?, feedback? }
 * → POST /api/v1/materials/:materialId/submissions/:id/grade (backend Express).
 * Meneruskan header Authorization agar backend dapat mengotorisasi peran
 * teacher/admin. Tanpa token backend menjawab 401 dan dinilai lokal saja.
 */
export const PATCH: RequestHandler = async ({ params, request, fetch }) => {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ status: false, message: 'Body JSON tidak valid.', data: null }, { status: 400 });
	}
	const b = (body ?? {}) as Record<string, unknown>;
	const score = typeof b.score === 'number' ? b.score : Number(b.score);
	const materialId = Number(b.materialId);
	if (!Number.isFinite(score) || score < 0 || score > 100) {
		return json({ status: false, message: 'Skor harus angka 0–100.', data: null }, { status: 400 });
	}
	if (!Number.isInteger(materialId) || materialId <= 0) {
		return json(
			{
				status: false,
				message: 'materialId materi tugas wajib diisi (pengumpulan contoh tidak dapat dinilai di server).',
				data: null
			},
			{ status: 400 }
		);
	}
	const decision =
		typeof b.decision === 'string' && (DECISIONS as readonly string[]).includes(b.decision)
			? b.decision
			: 'passed';
	const feedback =
		typeof b.feedback === 'string' && b.feedback.trim() !== '' ? b.feedback.slice(0, 2000) : undefined;
	try {
		const headers: Record<string, string> = { 'content-type': 'application/json' };
		const authorization = request.headers.get('authorization');
		if (authorization) headers.authorization = authorization;
		const upstream = await fetch(
			`${backendBase()}/api/v1/materials/${materialId}/submissions/${encodeURIComponent(params.id)}/grade`,
			{ method: 'POST', headers, body: JSON.stringify({ score, decision, feedback }) }
		);
		const data = await upstream.json();
		return json(data, { status: upstream.status });
	} catch {
		return json(
			{ status: false, message: 'Backend offline — nilai disimpan lokal saja.', data: null },
			{ status: 502 }
		);
	}
};
