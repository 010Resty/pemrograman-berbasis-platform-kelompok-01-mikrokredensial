import { apiRequest } from './backend';
import { getAccessToken } from '$lib/stores/auth.svelte';

export type UploadKind = 'image' | 'audio' | 'pdf' | 'cover' | 'assignment';

export interface UploadedFile {
	id: number;
	url: string;
	mimeType: string;
	sizeBytes: number;
}

/** Baca File browser menjadi base64 (tanpa prefix dataURL). */
export function fileToBase64(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => {
			const raw = String(reader.result ?? '');
			const comma = raw.indexOf(',');
			resolve(comma >= 0 ? raw.slice(comma + 1) : raw);
		};
		reader.onerror = () => reject(new Error('Gagal membaca berkas.'));
		reader.readAsDataURL(file);
	});
}

/** Unggah berkas ke backend. Melempar Error dengan pesan server bila gagal. */
export async function uploadFile(
	file: File,
	kind: UploadKind,
	mimeType?: string
): Promise<UploadedFile> {
	const data = await fileToBase64(file);
	const payload = {
		filename: file.name,
		mimeType: mimeType || file.type || 'application/octet-stream',
		kind,
		data
	};
	const res = await apiRequest<{ file?: UploadedFile } | UploadedFile>('/uploads', {
		method: 'POST',
		body: payload,
		token: getAccessToken()
	});
	return (res as { file?: UploadedFile }).file ?? (res as UploadedFile);
}
