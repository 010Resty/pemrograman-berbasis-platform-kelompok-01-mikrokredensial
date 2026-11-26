/**
 * Locale ARISTOTELES: URL per bahasa (`/id/...`, `/en/...`).
 * URL adalah sumber kebenaran; cookie hanya untuk mengingat preferensi
 * saat pengunjung membuka `/` (redirect). Tanpa dependensi baru.
 */

export const LOCALES = ['id', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'id';

/** Cookie preferensi bahasa (dibaca redirect `/`). */
export const COOKIE_NAME = 'aristoteles-locale';
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isLocale(v: unknown): v is Locale {
	return v === 'id' || v === 'en';
}

export function toLocale(v: unknown): Locale {
	return isLocale(v) ? v : DEFAULT_LOCALE;
}

/**
 * Awali path publik dengan locale: `lp('en', '/pelatihan')` → `'/en/pelatihan'`.
 * Path portal (`/user`, `/admin`, ...) dan API tidak lewat sini.
 */
export function lp(lang: Locale, path: string): string {
	const clean = path.startsWith('/') ? path : `/${path}`;
	return `/${lang}${clean === '/' ? '' : clean}`;
}

/**
 * Tukar segmen locale pertama pathname untuk language switcher:
 * `/id/login?x=1` + `'en'` → `/en/login`. Path tanpa prefix ikut diawali.
 */
export function switchLangPath(pathname: string, search: string, lang: Locale): string {
	const parts = pathname.split('/');
	if (parts.length > 1 && (parts[1] === 'id' || parts[1] === 'en')) {
		parts[1] = lang;
	} else {
		parts.splice(1, 0, lang);
	}
	return `${parts.join('/') || '/'}${search}`;
}

/** Nilai atribut `<html lang>` dan `og:locale` per locale. */
export function htmlLang(lang: Locale): string {
	return lang === 'en' ? 'en' : 'id';
}

export function ogLocale(lang: Locale): string {
	return lang === 'en' ? 'en_US' : 'id_ID';
}

export function jsonLdLang(lang: Locale): string {
	return lang === 'en' ? 'en-US' : 'id-ID';
}
