import type { Handle } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { env } from '$env/dynamic/public';

/**
 * Content-Security-Policy sebagai pertahanan lapis kedua setelah
 * sanitasi HTML (sanitizeTiptapHtml).
 *
 * - Produksi: ditegakkan (blokir skrip/gaya/obyek tak diizinkan).
 * - Development: Report-Only agar HMR Vite (skrip inline + WebSocket)
 *   tidak terganggu; pelanggaran tercatat di konsol untuk verifikasi
 *   sebelum menaikkan ke enforce.
 *
 * Kebijakan disusun dari inventaris statis: tanpa skrip/inline-handler
 * pihak ketiga, font self-hosted, gambar/media boleh https + data
 * (unggahan), API di https atau localhost:3000 (dev).
 *
 * Origin backend (gambar/audio dari /api/v1/files/...) WAJIB ada di
 * img-src + media-src — tanpa ini foto materi diblokir browser.
 * Diambil dari PUBLIC_API_BASE_URL agar ikut domain production.
 */
function apiOrigin(): string {
	const raw = (env.PUBLIC_API_BASE_URL || '').trim() || 'http://localhost:3000/api/v1';
	try {
		return new URL(raw).origin;
	} catch {
		return 'http://localhost:3000';
	}
}

const API_ORIGIN = apiOrigin();

const POLICY = [
	"default-src 'self'",
	"script-src 'self'",
	"style-src 'self' 'unsafe-inline'",
	`img-src 'self' data: https: ${API_ORIGIN}`,
	"font-src 'self' data:",
	`media-src 'self' https: data: blob: ${API_ORIGIN}`,
	`connect-src 'self' https: ${API_ORIGIN} ws://localhost:5173`,
	"object-src 'none'",
	"base-uri 'self'",
	"form-action 'self'",
	'frame-src https://www.youtube.com https://player.vimeo.com'
].join('; ');

export const handle: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);
	response.headers.set(
		dev ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy',
		POLICY
	);
	return response;
};
