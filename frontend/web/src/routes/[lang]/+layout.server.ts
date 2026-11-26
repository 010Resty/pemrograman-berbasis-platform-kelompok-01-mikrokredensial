import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { DEFAULT_LOCALE, isLocale } from '$lib/i18n/locale';

/**
 * Gerbang locale URL per bahasa (`/id/...`, `/en/...`).
 * Segmen tak dikenal (mis. `/fr/login`) dialihkan ke padanannya `/id/...`
 * agar tidak 404 sia-sia. `lang` tersedia di `data` semua halaman publik.
 */
export const load: LayoutServerLoad = async ({ params, url }) => {
	if (!isLocale(params.lang)) {
		const rest = url.pathname.split('/').slice(2).join('/');
		throw redirect(308, `/id/${rest}${url.search}`);
	}
	return { lang: params.lang ?? DEFAULT_LOCALE };
};
