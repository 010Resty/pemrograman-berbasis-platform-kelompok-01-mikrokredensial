import type { PageServerLoad } from './$types';

/** Origin untuk canonical absolut; data promo dimuat di browser via API publik. */
export const load: PageServerLoad = async ({ url }) => {
	return { origin: url.origin };
};
