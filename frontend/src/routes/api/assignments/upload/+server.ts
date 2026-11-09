import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Pengumpulan tugas peserta: proksi tipis ke backend nyata.
 * Alur: PDF (multipart) → POST /api/v1/uploads {kind:'assignment', base64}
 * → POST /api/v1/materials/:id/submissions {fileId} → petakan ke bentuk UI.
 * TIDAK ada mock: backend offline = 502 jujur (jangan anggap terkirim).
 */

const MAX_PDF_BYTES = 10 * 1024 * 1024;

function backendBase(): string {
	return process.env.BACKEND_URL || process.env.PUBLIC_API_BASE_URL || 'http://localhost:3000';
}

function isPdfMagic(buf: Uint8Array): boolean {
	return buf.length >= 5 && buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46 && buf[4] === 0x2d;
}

interface BackendFile {
	id: number;
	url: string;
	mimeType: string;
	sizeBytes: number;
}

interface BackendSubmission {
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
	rubricScores: { kelengkapan: number; ketepatan: number; kerapian: number } | null;
	status: string;
	gradedBy: number | null;
	gradedAt: string | null;
	submittedAt: string;
}

interface BackendEnvelope<T> {
	status: 'success' | 'error';
	message: string;
	errors?: Array<{ field: string; message: string }> | null;
	data: T;
}

interface UiSubmission {
	id: string;
	courseId: string;
	moduleId: string;
	materialId: string;
	studentName: string;
	studentNim: string;
	note: string;
	fileName: string;
	originalName: string;
	fileSize: number;
	mimeType: 'application/pdf';
	driveFileId: string;
	driveLink: string;
	driveDownload: string | null;
	driveMode: 'drive';
	status: 'Menunggu' | 'Dinilai';
	score: number | null;
	feedback?: string;
	rubricScores?: { kelengkapan: number; ketepatan: number; kerapian: number } | null;
	createdAt: string;
	gradedAt?: string | null;
}

/** Backend → bentuk yang dimengerti AssignmentMaterial (tanpa mock). */
function toUi(
	row: BackendSubmission,
	ctx: { courseId: string; moduleId: string; materialId: string; fileName: string; fileSize: number },
	base: string
): UiSubmission {
	const graded = row.score !== null || row.status === 'passed' || row.status === 'failed';
	return {
		id: String(row.id),
		courseId: ctx.courseId,
		moduleId: ctx.moduleId,
		materialId: String(ctx.materialId || row.materialId),
		studentName: row.studentName ?? '',
		studentNim: row.studentNim ?? '',
		note: row.note ?? '',
		fileName: row.originalName ?? ctx.fileName,
		originalName: row.originalName ?? ctx.fileName,
		fileSize: row.sizeBytes ?? ctx.fileSize,
		mimeType: 'application/pdf',
		driveFileId: row.fileId !== null ? String(row.fileId) : '',
		driveLink: `${base}${row.fileUrl}`,
		driveDownload: `${base}${row.fileUrl}`,
		driveMode: 'drive',
		status: graded ? 'Dinilai' : 'Menunggu',
		score: row.score,
		feedback: row.feedback ?? undefined,
		rubricScores: row.rubricScores ?? null,
		createdAt: row.submittedAt,
		gradedAt: row.gradedAt ?? null
	};
}

async function readBackend<T>(res: Response): Promise<BackendEnvelope<T>> {
	const text = await res.text();
	if (!text) throw new Error(`Backend merespons kosong (HTTP ${res.status}).`);
	try {
		return JSON.parse(text) as BackendEnvelope<T>;
	} catch {
		throw new Error(`Backend merespons non-JSON (HTTP ${res.status}).`);
	}
}

export const POST: RequestHandler = async ({ request, fetch }) => {
	let form: FormData;
	try {
		form = await request.formData();
	} catch {
		return json(
			{ status: false, message: 'Body harus multipart/form-data.', data: null },
			{ status: 400 }
		);
	}

	const file = form.get('file');
	const materialId = String(form.get('materialId') || '').trim();
	const courseId = String(form.get('courseId') || '');
	const moduleId = String(form.get('moduleId') || '');
	const studentNim = String(form.get('studentNim') || '').trim().slice(0, 30);
	const note = String(form.get('note') || '').trim().slice(0, 2000);

	if (!(file instanceof File) || file.size === 0) {
		return json(
			{ status: false, message: 'File PDF wajib dilampirkan (field "file").', data: null },
			{ status: 400 }
		);
	}
	if (!materialId) {
		return json(
			{ status: false, message: 'materialId wajib diisi.', data: null },
			{ status: 400 }
		);
	}
	const lower = file.name.toLowerCase();
	if (
		!lower.endsWith('.pdf') ||
		(file.type && file.type !== 'application/pdf' && file.type !== 'application/octet-stream')
	) {
		return json(
			{ status: false, message: 'Hanya file PDF (.pdf) yang diterima.', data: null },
			{ status: 400 }
		);
	}
	if (file.size > MAX_PDF_BYTES) {
		return json(
			{ status: false, message: 'Ukuran PDF melebihi 10 MB.', data: null },
			{ status: 413 }
		);
	}
	const head = new Uint8Array(await file.slice(0, 8).arrayBuffer());
	if (!isPdfMagic(head)) {
		return json(
			{ status: false, message: 'File tidak valid: header %PDF tidak ditemukan.', data: null },
			{ status: 400 }
		);
	}

	const auth = request.headers.get('authorization');
	if (!auth) {
		return json(
			{
				status: false,
				message: 'Token autentikasi diperlukan. Masuk kembali lalu coba lagi.',
				data: null
			},
			{ status: 401 }
		);
	}

	const base = backendBase().replace(/\/+$/, '');
	const timeout = { signal: AbortSignal.timeout(110_000) };

	try {
		// 1) Byte PDF → file backend (kind assignment, base64 JSON).
		const bytes = new Uint8Array(await file.arrayBuffer());
		let binary = '';
		for (let i = 0; i < bytes.length; i += 0x8000) {
			binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
		}
		const upRes = await fetch(`${base}/api/v1/uploads`, {
			method: 'POST',
			headers: { 'content-type': 'application/json', authorization: auth },
			body: JSON.stringify({
				filename: file.name,
				mimeType: 'application/pdf',
				kind: 'assignment',
				data: btoa(binary)
			}),
			...timeout
		});
		const upJson = await readBackend<BackendFile>(upRes);
		if (!upRes.ok || upJson.status !== 'success') {
			return json(
				{
					status: false,
					message: upJson.message || 'Gagal mengunggah berkas ke server.',
					errors: upJson.errors ?? null,
					data: null
				},
				{ status: upRes.status }
			);
		}
		const fileId = upJson.data?.id;
		if (!Number.isInteger(fileId)) {
			return json(
				{ status: false, message: 'Respons unggahan server tidak valid.', data: null },
				{ status: 502 }
			);
		}

		// 2) Catat pengumpulan ke materi.
		const subRes = await fetch(`${base}/api/v1/materials/${encodeURIComponent(materialId)}/submissions`, {
			method: 'POST',
			headers: { 'content-type': 'application/json', authorization: auth },
			body: JSON.stringify({
				fileId,
				studentNim: studentNim || null,
				note: note || null
			}),
			...timeout
		});
		const subJson = await readBackend<BackendSubmission>(subRes);
		if (!subRes.ok || subJson.status !== 'success') {
			return json(
				{
					status: false,
					message: subJson.message || 'Gagal mencatat pengumpulan.',
					errors: subJson.errors ?? null,
					data: null
				},
				{ status: subRes.status }
			);
		}

		return json(
			{
				status: true,
				message: 'Tugas berhasil dikumpulkan ke server.',
				data: toUi(
					subJson.data,
					{ courseId, moduleId, materialId, fileName: file.name, fileSize: file.size },
					base
				)
			},
			{ status: 201 }
		);
	} catch (e) {
		return json(
			{
				status: false,
				message:
					e instanceof Error
						? `Backend tidak terjangkau: ${e.message}. Pengumpulan BELUM tersimpan — coba lagi saat backend online.`
						: 'Backend tidak terjangkau. Pengumpulan BELUM tersimpan.',
				data: null
			},
			{ status: 502 }
		);
	}
};

export const GET: RequestHandler = async ({ url, request, fetch }) => {
	const materialId = (url.searchParams.get('materialId') || '').trim();
	if (!materialId) {
		return json(
			{ status: false, message: 'Parameter materialId wajib diisi.', data: null },
			{ status: 400 }
		);
	}
	const auth = request.headers.get('authorization');
	if (!auth) {
		return json(
			{
				status: false,
				message: 'Token autentikasi diperlukan. Masuk kembali lalu coba lagi.',
				data: null
			},
			{ status: 401 }
		);
	}
	const base = backendBase().replace(/\/+$/, '');
	try {
		const upstream = await fetch(
			`${base}/api/v1/materials/${encodeURIComponent(materialId)}/submissions`,
			{
				headers: { accept: 'application/json', authorization: auth },
				signal: AbortSignal.timeout(110_000)
			}
		);
		const data = await readBackend<BackendSubmission[] | { rows?: BackendSubmission[] }>(
			upstream
		);
		if (!upstream.ok || data.status !== 'success') {
			return json(
				{
					status: false,
					message: data.message || 'Gagal memuat riwayat.',
					errors: data.errors ?? null,
					data: null
				},
				{ status: upstream.status }
			);
		}
		const rows = Array.isArray(data.data) ? data.data : (data.data.rows ?? []);
		return json({
			status: true,
			message: 'Riwayat pengumpulan.',
			data: rows.map((r) =>
				toUi(
					r,
					{ courseId: '', moduleId: '', materialId, fileName: `tugas-${r.id}.pdf`, fileSize: 0 },
					base
				)
			)
		});
	} catch (e) {
		return json(
			{
				status: false,
				message:
					e instanceof Error
						? `Backend tidak terjangkau: ${e.message}.`
						: 'Backend tidak terjangkau.',
				data: null
			},
			{ status: 502 }
		);
	}
};
