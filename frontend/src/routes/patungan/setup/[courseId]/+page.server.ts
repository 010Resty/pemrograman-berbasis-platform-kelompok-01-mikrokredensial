import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const raw = Number(url.searchParams.get('n'));
	const initialCount = Number.isInteger(raw) ? Math.min(15, Math.max(2, raw)) : 3;
	return { origin: url.origin, initialCount };
};
