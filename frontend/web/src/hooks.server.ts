import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { building, dev } from '$app/environment';
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
	// `event.url.search` dilarang saat prerender — baca malas hanya bila perlu.
	const pathname = event.url.pathname;

	// Redirect URL lama tanpa prefix bahasa ke padanannya `/id/...`.
	// Hanya GET navigasi (bukan API/aksi): segmen pertama yang bukan locale,
	// portal, berkas statis, atau sitemap.
	if (event.request.method === 'GET') {
		const seg = pathname.split('/')[1] ?? '';
		const reserved = ['id', 'en', 'api', 'user', 'admin', 'instruktur'];
		if (
			seg !== '' &&
			!reserved.includes(seg) &&
			!seg.includes('.') &&
			pathname !== '/sitemap.xml'
		) {
			// `event.url.search` dilarang saat prerender/build — kosongkan saja.
			const search = building ? '' : event.url.search;
			throw redirect(308, `/id${pathname}${search}`);
		}
	}

	const response = await resolve(event, {
		// Bahasa Inggris: <html lang="en"> untuk pembaca layar + SEO.
		transformPageChunk: ({ html }) => {
			if (pathname === '/en' || pathname.startsWith('/en/')) {
				return html.replace('<html lang="id">', '<html lang="en">');
			}
			return html;
		}
	});
	response.headers.set(
		dev ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy',
		POLICY
	);
	return response;
};
