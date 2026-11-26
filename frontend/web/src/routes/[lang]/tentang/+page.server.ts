import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/** /tentang dilebur menjadi sub-halaman; induk mengarah permanen ke Arti Nama. */
export const load: PageServerLoad = async () => {
	throw redirect(308, '/tentang/arti-nama');
};
