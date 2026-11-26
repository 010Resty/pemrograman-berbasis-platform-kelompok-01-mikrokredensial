import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	return { origin: url.origin };
};
