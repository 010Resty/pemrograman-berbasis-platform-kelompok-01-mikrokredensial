import type { PageServerLoad } from './$types';
import { getSpotServer } from '$lib/server/public-catalog';

/**
 * SSR daftar sorotan agar crawler menerima judul/harga/kategori kursus
 * langsung di HTML (bukan skeleton kosong). Nama pengampu tetap diisi
 * progresif di browser. `origin` dipakai untuk canonical absolut per domain.
 */
export const load: PageServerLoad = async ({ url }) => {
	const [spot, wide] = await getSpotServer();
	return {
		origin: url.origin,
		spot,
		gratis: wide.filter((c) => (c.priceNominal ?? -1) === 0).slice(0, 3)
	};
};
