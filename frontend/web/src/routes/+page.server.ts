import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { COOKIE_NAME, DEFAULT_LOCALE } from '$lib/i18n/locale';

/**
 * `/` bukan halaman — alihkan ke beranda sesuai bahasa.
 * Preferensi dibaca dari cookie (ditulis LanguageSwitcher); default Indonesia.
 */
export const load: PageServerLoad = async ({ cookies, url }) => {
	const pref = cookies.get(COOKIE_NAME);
	const lang = pref === 'en' ? 'en' : DEFAULT_LOCALE;
	throw redirect(307, `/${lang}${url.search}`);
};
