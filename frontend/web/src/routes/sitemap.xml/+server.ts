import type { RequestEvent } from './$types';
import { PUBLIC_SITEMAP_ROUTES } from '$lib/seo/site';

/**
 * Sitemap XML rute publik yang boleh diindeks.
 * Hanya URL kanonis statis — tanpa URL dinamis hasil karangan
 * (detail kursus di-crawl lewat link internal dari / dan /modules).
 * Domain diambil dari request (selalu benar per deployment),
 * bukan asumsi statis.
 */
export function GET({ url }: RequestEvent): Response {
	const today = new Date().toISOString().slice(0, 10);
	const base = url.origin;
	const urls = PUBLIC_SITEMAP_ROUTES.map(
		(r) => `  <url>
    <loc>${base}${r.path}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${r.changefreq}</changefreq>
    <priority>${r.priority.toFixed(1)}</priority>
  </url>`
	).join('\n');

	const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;

	return new Response(xml, {
		headers: {
			'Content-Type': 'application/xml; charset=utf-8',
			'Cache-Control': 'public, max-age=3600'
		}
	});
}
