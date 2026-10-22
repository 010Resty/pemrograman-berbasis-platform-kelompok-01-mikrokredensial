import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

function backendBase(): string {
	return env.BACKEND_URL || env.PUBLIC_API_BASE_URL || 'http://localhost:3000';
}

/** PATCH /api/assignments/grade/:id  { score, feedback } -> backend Express */
export const PATCH: RequestHandler = async ({ params, request, fetch }) => {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ status: false, message: 'Body JSON tidak valid.', data: null }, { status: 400 });
	}
	try {
		const upstream = await fetch(`${backendBase()}/api/v1/submissions/${encodeURIComponent(params.id)}/grade`, {
			method: 'PATCH',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		});
		const data = await upstream.json();
		return json(data, { status: upstream.status });
	} catch {
		return json(
			{ status: false, message: 'Backend offline — nilai disimpan lokal saja.', data: null },
			{ status: 502 }
		);
	}
};
