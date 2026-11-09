import type { PageServerLoad } from './$types';
import { getCatalogServer } from '$lib/server/public-catalog';

/** SSR katalog awal tanpa filter agar crawler menerima daftar kursus di HTML. */
export const load: PageServerLoad = async ({ url }) => {
	return {
		origin: url.origin,
		catalog: await getCatalogServer()
	};
};
