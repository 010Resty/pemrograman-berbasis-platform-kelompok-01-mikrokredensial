import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/** URL lama Kontak Kami → permanen ke slug baru (dengan prefix bahasa). */
export const load: PageServerLoad = async ({ params }) => {
	const lang = params.lang === 'en' ? 'en' : 'id';
	throw redirect(301, `/${lang}/tentang/kontak`);
};
