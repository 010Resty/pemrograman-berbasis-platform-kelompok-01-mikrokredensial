import type { ApiResult, AssignmentSubmission, UploadMeta } from '$lib/types/submission';
import { getAccessToken } from '$lib/stores/auth.svelte';

/**
 * Client pengumpulan tugas PDF via proksi same-origin `/api/assignments/upload`
 * (upload base64 → backend Express → catat submission; tanpa mock).
 */

function buildForm(file: File, meta: UploadMeta): FormData {
	const fd = new FormData();
	fd.append('file', file, file.name);
	fd.append('courseId', meta.courseId);
	fd.append('moduleId', meta.moduleId);
	fd.append('materialId', meta.materialId);
	fd.append('studentName', meta.studentName);
	fd.append('studentNim', meta.studentNim);
	fd.append('note', meta.note);
	return fd;
}

/** Upload dengan progress (XMLHttpRequest agar progress akurat). */
export function uploadAssignmentPdf(
	file: File,
	meta: UploadMeta,
	onProgress?: (pct: number) => void
): Promise<AssignmentSubmission> {
	return new Promise((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		xhr.open('POST', '/api/assignments/upload');
		xhr.responseType = 'json';
		const token = getAccessToken();
		if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

		xhr.upload.onprogress = (e) => {
			if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100));
		};

		xhr.onload = () => {
			const res = xhr.response as ApiResult<AssignmentSubmission> | null;
			if (xhr.status >= 200 && xhr.status < 300 && res && (res as ApiResult<AssignmentSubmission>).status) {
				resolve((res as { data: AssignmentSubmission }).data);
			} else {
				const msg =
					(res as unknown as { message?: string })?.message || `Upload gagal (HTTP ${xhr.status}).`;
				reject(new Error(msg));
			}
		};
		xhr.onerror = () => reject(new Error('Jaringan bermasalah saat mengunggah PDF.'));
		xhr.ontimeout = () => reject(new Error('Upload timeout. Coba file lebih kecil / koneksi stabil.'));
		xhr.timeout = 120_000;
		xhr.send(buildForm(file, meta));
	});
}

export async function fetchSubmissions(materialId?: string): Promise<AssignmentSubmission[]> {
	const q = materialId ? `?materialId=${encodeURIComponent(materialId)}` : '';
	const token = getAccessToken();
	const res = await fetch(`/api/assignments/upload${q}`, {
		headers: {
			accept: 'application/json',
			...(token ? { authorization: `Bearer ${token}` } : {})
		}
	});
	if (!res.ok) throw new Error(`Gagal memuat riwayat (${res.status}).`);
	const json = (await res.json()) as ApiResult<AssignmentSubmission[]>;
	if (!json.status) throw new Error(json.message);
	return json.data;
}

/**
 * Unduh berkas submission milik sendiri sebagai Blob (GET /api/v1/files/:id/content
 * mewajibkan token; tautan <a> biasa tidak membawa Authorization sehingga 403).
 * Pemanggil membuat object URL dan mencabutnya setelah dipakai.
 */
export async function downloadSubmissionFile(url: string): Promise<Blob> {
	const token = getAccessToken();
	const res = await fetch(url, {
		headers: token ? { authorization: `Bearer ${token}` } : {}
	});
	if (!res.ok) {
		throw new Error(
			res.status === 403
				? 'Akses berkas ditolak (bukan pemilik/pengampu).'
				: `Gagal mengunduh berkas (HTTP ${res.status}).`
		);
	}
	return res.blob();
}
