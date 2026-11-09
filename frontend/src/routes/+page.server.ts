import type { PageServerLoad } from './$types';
import { getSpotServer } from '$lib/server/public-catalog';

/**
 * SSR daftar sorotan agar crawler menerima judul/harga/kategori kursus
 * langsung di HTML (bukan skeleton kosong). Nama pengampu tetap diisi
 * progresif di browser. `origin` dipakai untuk canonical absolut per domain.
 */
export const load: PageServerLoad = async ({ url }) => {
	const spot = await getSpotServer();
	return {
		origin: url.origin,
		spot
	};
};
