/**
 * Konfigurasi SEO terpusat ARISTOTELES.
 *
 * SITE_URL: basis absolut untuk canonical / OG / sitemap.
 * Prioritas: env publik `PUBLIC_SITE_URL` (opsional, untuk memaksa satu domain
 * kanonis) → `origin` dari request (selalu benar, termasuk preview deployment)
 * → fallback `https://aristoteles.id` (domain yang sudah dirujuk di
 * `support@aristoteles.id` + label `aristoteles.id/katalog`).
 */
import { env } from '$env/dynamic/public';

const FALLBACK_SITE_URL = 'https://aristoteles.id';

export const SITE_NAME = 'ARISTOTELES';
export const SITE_LOCALE = 'id_ID';
export const SITE_LANGUAGE = 'id';
export const THEME_COLOR = '#102a56';

/** Gambar sosial default 1200×630 untuk semua halaman (tanpa ini tanpa klaim palsu). */
export const DEFAULT_OG_IMAGE = '/og-cover.png';
export const DEFAULT_OG_IMAGE_WIDTH = 1200;
export const DEFAULT_OG_IMAGE_HEIGHT = 630;

export function getSiteUrl(origin?: string): string {
	const fromEnv = (env.PUBLIC_SITE_URL || '').trim();
	const raw = fromEnv || (origin || '').trim() || FALLBACK_SITE_URL;
	return raw.replace(/\/+$/, '');
}

/** Canonical absolut untuk path internal, mis. canonicalPath('/pelatihan', origin). */
export function canonicalPath(path: string, origin?: string): string {
	const clean = path.startsWith('/') ? path : `/${path}`;
	return `${getSiteUrl(origin)}${clean}`;
}

/**
 * Tautan hreflang untuk halaman ber-URL per bahasa.
 * `altUrls('/id/pelatihan', origin)` → id/en/x-default absolut.
 * Path tanpa prefix locale dianggap varian Indonesia lalu dibuatkan pasangannya.
 */
export function altUrls(
	path: string,
	origin?: string
): Array<{ hreflang: string; href: string }> {
	const clean = path.startsWith('/') ? path : `/${path}`;
	const rest = clean.replace(/^\/(id|en)(?=\/|$)/, '') || '/';
	const suffix = rest === '/' ? '' : rest;
	return [
		{ hreflang: 'id', href: canonicalPath(`/id${suffix}`, origin) },
		{ hreflang: 'en', href: canonicalPath(`/en${suffix}`, origin) },
		{ hreflang: 'x-default', href: canonicalPath(`/id${suffix}`, origin) }
	];
}

export interface SitemapEntry {
	path: string;
	changefreq: 'daily' | 'weekly' | 'monthly' | 'yearly';
	priority: number;
}

/**
 * Rute publik yang boleh diindeks. Disengaja statis: rute dinamis
 * /modules/[courseId] butuh backend hidup saat render sitemap, jadi tidak
 * dicantumkan agar tidak mengarang URL (lihat AGENTS §7).
 * Halaman placeholder /segera-hadir + area privat/auth tidak masuk sitemap.
 */
export const PUBLIC_SITEMAP_ROUTES: SitemapEntry[] = [
	{ path: '/', changefreq: 'daily', priority: 1.0 },
	{ path: '/pelatihan', changefreq: 'daily', priority: 0.9 },
	{ path: '/promo/diskon', changefreq: 'daily', priority: 0.8 },
	{ path: '/promo/kurasi', changefreq: 'daily', priority: 0.8 },
	{ path: '/promo/patungan', changefreq: 'daily', priority: 0.8 },
	{ path: '/tentang/arti-nama', changefreq: 'monthly', priority: 0.7 },
	{ path: '/tentang/cara-kerja', changefreq: 'monthly', priority: 0.6 },
	{ path: '/tentang/kontak', changefreq: 'monthly', priority: 0.6 },
	{ path: '/tentang/keunggulan', changefreq: 'monthly', priority: 0.6 },
	{ path: '/menjadi-instruktur', changefreq: 'monthly', priority: 0.7 },
	{ path: '/peringkat', changefreq: 'weekly', priority: 0.6 },
	{ path: '/verifikasi', changefreq: 'monthly', priority: 0.6 },
	{ path: '/kebijakan-privasi', changefreq: 'yearly', priority: 0.3 },
	{ path: '/syarat-ketentuan', changefreq: 'yearly', priority: 0.3 }
];
