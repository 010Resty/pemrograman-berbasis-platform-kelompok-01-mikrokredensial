import { en } from './en';
import { id } from './id';
import type { Locale } from './locale';

const dicts = { id, en } as const;

type Nested = Record<string, unknown>;

function lookup(dict: Nested, key: string): unknown {
	let cur: unknown = dict;
	for (const part of key.split('.')) {
		if (!cur || typeof cur !== 'object') return undefined;
		cur = (cur as Nested)[part];
	}
	return cur;
}

/**
 * Ambil string kamus: `t('en', 'nav.pelatihan')`.
 * Fallback ke Indonesia bila key absen; kembalikan key bila tak ada di keduanya.
 * `vars` mengisi placeholder `{nama}`.
 */
export function t(lang: Locale, key: string, vars?: Record<string, string | number>): string {
	const found = lookup(dicts[lang] as Nested, key) ?? lookup(dicts.id as Nested, key);
	if (typeof found !== 'string') return key;
	if (!vars) return found;
	let out = found;
	for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, String(v));
	return out;
}

/** Ambil array string (mis. daftar bullet). Fallback ke Indonesia; [] bila tak ada. */
export function ta(lang: Locale, key: string): string[] {
	const found = lookup(dicts[lang] as Nested, key) ?? lookup(dicts.id as Nested, key);
	return Array.isArray(found)
		? found.filter((s): s is string => typeof s === 'string')
		: [];
}
export function intlLocale(lang: Locale): string {
	return lang === 'en' ? 'en-US' : 'id-ID';
}
