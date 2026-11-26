import type { PageServerLoad } from './$types';
import { getSpotServer } from '$lib/server/public-catalog';

/**
 * SSR daftar sorotan agar crawler menerima judul/harga/kategori kursus
 * langsung di HTML (bukan skeleton kosong). Nama pengampu tetap diisi
 * progresif di browser. `origin` dipakai untuk canonical absolut per domain.
 */
export const load: PageServerLoad = async ({ url, setHeaders }) => {
	const spot = await getSpotServer();
	// Katalog publik berubah jarang: cache CDN 60 dtk + SWR 5 mnt.
	setHeaders({ 'cache-control': 'public, max-age=60, stale-while-revalidate=300' });
	return {
		origin: url.origin,
		spot
	};
};
