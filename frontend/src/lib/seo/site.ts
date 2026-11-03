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
	{ path: '/modules', changefreq: 'daily', priority: 0.9 },
	{ path: '/tentang', changefreq: 'monthly', priority: 0.7 },
	{ path: '/menjadi-instruktur', changefreq: 'monthly', priority: 0.7 },
	{ path: '/peringkat', changefreq: 'weekly', priority: 0.6 },
	{ path: '/verifikasi', changefreq: 'monthly', priority: 0.6 },
	{ path: '/kebijakan-privasi', changefreq: 'yearly', priority: 0.3 },
	{ path: '/syarat-ketentuan', changefreq: 'yearly', priority: 0.3 }
];
