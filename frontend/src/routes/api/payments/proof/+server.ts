import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Bukti bayar QRIS (gambar) → backend nyata.
 * Alur: gambar (multipart) → POST /api/v1/uploads {kind:'payment_proof', base64}
 * → kembalikan {id, url}. TIDAK ada mock: backend offline = 502 jujur.
 * Akses berkas: pemilik + admin (diatur backend).
 */

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function backendBase(): string {
	return process.env.BACKEND_URL || process.env.PUBLIC_API_BASE_URL || 'http://localhost:3000';
}

function isImageMagic(buf: Uint8Array): boolean {
	const eq = (sig: number[], off = 0): boolean =>
		sig.every((b, i) => buf[i + off] === b);
	if (eq([0xff, 0xd8, 0xff])) return true; // JPEG
	if (eq([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return true; // PNG
	if (eq([0x52, 0x49, 0x46, 0x46]) && eq([0x57, 0x45, 0x42, 0x50], 8)) return true; // WEBP
	return false;
}

interface BackendFile {
	id: number;
	url: string;
	mimeType: string;
	sizeBytes: number;
}

interface BackendEnvelope<T> {
	status: 'success' | 'error';
	message: string;
	errors?: Array<{ field: string; message: string }> | null;
	data: T;
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
	if (!(file instanceof File) || file.size === 0) {
		return json(
			{ status: false, message: 'File gambar bukti bayar wajib dilampirkan (field "file").', data: null },
			{ status: 400 }
		);
	}
	const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
	if ((file.type && !allowedTypes.includes(file.type)) || !/\.(jpe?g|png|webp)$/i.test(file.name)) {
		return json(
			{ status: false, message: 'Hanya gambar JPG/PNG/WebP yang diterima.', data: null },
			{ status: 400 }
		);
	}
	if (file.size > MAX_IMAGE_BYTES) {
		return json(
			{ status: false, message: 'Ukuran gambar melebihi 5 MB.', data: null },
			{ status: 413 }
		);
	}
	const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
	if (!isImageMagic(head)) {
		return json(
			{ status: false, message: 'File tidak valid: bukan gambar yang didukung.', data: null },
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
				mimeType: file.type || 'image/jpeg',
				kind: 'payment_proof',
				data: btoa(binary)
			}),
			signal: AbortSignal.timeout(110_000)
		});
		const upJson = await readBackend<BackendFile>(upRes);
		if (!upRes.ok || upJson.status !== 'success') {
			return json(
				{
					status: false,
					message: upJson.message || 'Gagal mengunggah bukti ke server.',
					errors: upJson.errors ?? null,
					data: null
				},
				{ status: upRes.status }
			);
		}
		if (!Number.isInteger(upJson.data?.id)) {
			return json(
				{ status: false, message: 'Respons unggahan server tidak valid.', data: null },
				{ status: 502 }
			);
		}
		return json(
			{
				status: true,
				message: 'Bukti bayar terunggah.',
				data: { id: upJson.data.id, url: upJson.data.url }
			},
			{ status: 201 }
		);
	} catch (e) {
		return json(
			{
				status: false,
				message:
					e instanceof Error
						? `Backend tidak terjangkau: ${e.message}. Bukti BELUM tersimpan — coba lagi saat backend online.`
						: 'Backend tidak terjangkau. Bukti BELUM tersimpan.',
				data: null
			},
			{ status: 502 }
		);
	}
};
