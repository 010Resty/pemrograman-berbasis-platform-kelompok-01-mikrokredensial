import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/** URL lama Kontak Kami — permanen ke slug baru. */
export const load: PageServerLoad = async () => {
	throw redirect(301, '/tentang/kontak');
};
