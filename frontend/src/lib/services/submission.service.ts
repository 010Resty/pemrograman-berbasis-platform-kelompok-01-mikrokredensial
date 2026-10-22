import type { ApiResult, AssignmentSubmission, UploadMeta } from '$lib/types/submission';

/**
 * Client pengumpulan tugas PDF.
 * Target utama: endpoint same-origin SvelteKit `/api/assignments/upload`
 * (proxy ke backend Express bila tersedia, mock-Drive bila tidak).
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
	const res = await fetch(`/api/assignments/upload${q}`, { headers: { accept: 'application/json' } });
	if (!res.ok) throw new Error(`Gagal memuat riwayat (${res.status}).`);
	const json = (await res.json()) as ApiResult<AssignmentSubmission[]>;
	if (!json.status) throw new Error(json.message);
	return json.data;
}
