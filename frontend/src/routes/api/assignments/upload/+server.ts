import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

const MAX_PDF_BYTES = 10 * 1024 * 1024;

function backendBase(): string {
	return env.BACKEND_URL || env.PUBLIC_API_BASE_URL || 'http://localhost:3000';
}

function isPdfMagic(buf: Uint8Array): boolean {
	return buf.length >= 5 && buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46 && buf[4] === 0x2d;
}

function mockId(): string {
	return `mock-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export const POST: RequestHandler = async ({ request, fetch }) => {
	let form: FormData;
	try {
		form = await request.formData();
	} catch {
		return json({ status: false, message: 'Body harus multipart/form-data.', data: null }, { status: 400 });
	}

	const file = form.get('file');
	const materialId = String(form.get('materialId') || '').trim();
	const courseId = String(form.get('courseId') || '');
	const moduleId = String(form.get('moduleId') || '');
	const studentName = String(form.get('studentName') || 'Peserta').slice(0, 100);
	const studentNim = String(form.get('studentNim') || '').slice(0, 30);
	const note = String(form.get('note') || '').slice(0, 2000);

	if (!(file instanceof File) || file.size === 0) {
		return json({ status: false, message: 'File PDF wajib dilampirkan (field "file").', data: null }, { status: 400 });
	}
	if (!materialId) {
		return json({ status: false, message: 'materialId wajib diisi.', data: null }, { status: 400 });
	}
	const lower = file.name.toLowerCase();
	if (!lower.endsWith('.pdf') || (file.type && file.type !== 'application/pdf' && file.type !== 'application/octet-stream')) {
		return json({ status: false, message: 'Hanya file PDF (.pdf) yang diterima.', data: null }, { status: 400 });
	}
	if (file.size > MAX_PDF_BYTES) {
		return json({ status: false, message: 'Ukuran PDF melebihi 10 MB.', data: null }, { status: 413 });
	}
	const head = new Uint8Array(await file.slice(0, 8).arrayBuffer());
	if (!isPdfMagic(head)) {
		return json({ status: false, message: 'File tidak valid: header %PDF tidak ditemukan.', data: null }, { status: 400 });
	}

	// 1) Coba teruskan ke backend Express (upload Drive sungguhan / mock terpusat).
	try {
		const fd = new FormData();
		fd.append('file', file, file.name);
		fd.append('courseId', courseId);
		fd.append('moduleId', moduleId);
		fd.append('materialId', materialId);
		fd.append('studentName', studentName);
		fd.append('studentNim', studentNim);
		fd.append('note', note);

		const upstream = await fetch(`${backendBase()}/api/v1/submissions/upload`, {
			method: 'POST',
			body: fd,
			signal: AbortSignal.timeout(110_000)
		});
		const data = await upstream.json();
		return json(data, { status: upstream.status });
	} catch {
		// 2) Backend offline -> mode mock lokal agar UX tetap jalan (siap produksi saat backend + kredensial ada).
		const id = mockId();
		return json(
			{
				status: true,
				message: 'Terkirim (mode MOCK — backend offline). Jalankan backend + isi kredensial Google untuk upload Drive sungguhan.',
				data: {
					id: `sub-${id}`,
					courseId,
					moduleId,
					materialId,
					studentName,
					studentNim,
					note,
					fileName: file.name,
					originalName: file.name,
					fileSize: file.size,
					mimeType: 'application/pdf',
					driveFileId: id,
					driveLink: `https://drive.google.com/file/d/${id}/view?usp=sharing`,
					driveDownload: null,
					driveMode: 'mock',
					status: 'Menunggu',
					score: null,
					createdAt: new Date().toISOString(),
					gradedAt: null
				}
			},
			{ status: 201 }
		);
	}
};

export const GET: RequestHandler = async ({ url, fetch }) => {
	const qs = url.searchParams.toString();
	try {
		const upstream = await fetch(`${backendBase()}/api/v1/submissions${qs ? `?${qs}` : ''}`);
		const data = await upstream.json();
		return json(data, { status: upstream.status });
	} catch {
		return json({ status: true, message: 'Riwayat kosong (backend offline).', data: [] });
	}
};
