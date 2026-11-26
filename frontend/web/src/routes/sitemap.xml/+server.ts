import type { RequestEvent } from './$types';
import { PUBLIC_SITEMAP_ROUTES } from '$lib/seo/site';

/**
 * Sitemap XML rute publik yang boleh diindeks — dua varian bahasa.
 * Setiap URL id mendapatkan pasangan en + hreflang silang (id/en/x-default)
 * agar mesin pencari memahami relasi bahasa, sesuai pola URL per bahasa.
 * Hanya URL kanonis statis — tanpa URL dinamis hasil karangan
 * (detail kursus di-crawl lewat link internal dari / dan /pelatihan).
 * Domain diambil dari request (selalu benar per deployment),
 * bukan asumsi statis.
 */
export function GET({ url }: RequestEvent): Response {
	const today = new Date().toISOString().slice(0, 10);
	const base = url.origin;
	const urls = PUBLIC_SITEMAP_ROUTES.map((r) => {
		const idHref = `${base}/id${r.path === '/' ? '' : r.path}`;
		const enHref = `${base}/en${r.path === '/' ? '' : r.path}`;
		return `  <url>
    <loc>${idHref}</loc>
    <xhtml:link rel="alternate" hreflang="id" href="${idHref}" />
    <xhtml:link rel="alternate" hreflang="en" href="${enHref}" />
    <xhtml:link rel="alternate" hreflang="x-default" href="${idHref}" />
    <lastmod>${today}</lastmod>
    <changefreq>${r.changefreq}</changefreq>
    <priority>${r.priority.toFixed(1)}</priority>
  </url>
  <url>
    <loc>${enHref}</loc>
    <xhtml:link rel="alternate" hreflang="id" href="${idHref}" />
    <xhtml:link rel="alternate" hreflang="en" href="${enHref}" />
    <xhtml:link rel="alternate" hreflang="x-default" href="${idHref}" />
    <lastmod>${today}</lastmod>
    <changefreq>${r.changefreq}</changefreq>
    <priority>${r.priority.toFixed(1)}</priority>
  </url>`;
	}).join('\n');

	const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls}\n</urlset>`;

	return new Response(xml, {
		headers: {
			'Content-Type': 'application/xml; charset=utf-8',
			'Cache-Control': 'public, max-age=3600'
		}
	});
}
