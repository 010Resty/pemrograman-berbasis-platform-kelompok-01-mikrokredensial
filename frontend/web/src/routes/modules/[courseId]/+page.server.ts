import type { PageServerLoad } from './$types';
import { BackendRequestError } from '$lib/api/backend';
import { fetchCourseDetailServer } from '$lib/server/public-catalog';
import type { BackendCourse } from '$lib/api/courses';

/**
 * SSR detail kursus (judul, deskripsi, harga, pengampu) untuk crawler.
 * Struktur tree + akses + progres tetap dimuat di browser (butuh token).
 * 404 asli backend → flag notFound (UI kustom dipertahankan, bukan error page).
 */
export const load: PageServerLoad = async ({ params, url }) => {
	const id = Number(params.courseId);
	if (!Number.isInteger(id) || id <= 0) {
		return { origin: url.origin, detail: null as BackendCourse | null, notFound: true };
	}
	try {
		const detail = await fetchCourseDetailServer(id);
		return { origin: url.origin, detail, notFound: false };
	} catch (e) {
		const missing = e instanceof BackendRequestError && e.httpStatus === 404;
		return { origin: url.origin, detail: null as BackendCourse | null, notFound: missing };
	}
};
