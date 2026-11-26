import type { PageServerLoad } from './$types';
import { getModulServer } from '$lib/server/public-catalog';

/** SSR 8 pelatihan awal (filter "Semua") agar crawler tidak melihat grid kosong. */
export const load: PageServerLoad = async ({ url, setHeaders }) => {
	setHeaders({ 'cache-control': 'public, max-age=60, stale-while-revalidate=300' });
	return {
		origin: url.origin,
		modul: await getModulServer()
	};
};
