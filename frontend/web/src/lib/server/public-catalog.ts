/**
 * Helper katalog publik khusus server load (+page.server.ts).
 *
 * Disengaja TIDAK memakai `$lib/api/courses` di sini: modul itu menarik
 * `$lib/stores/auth.svelte` → `$app/navigation` yang tidak aman di server.
 * Hanya `apiRequest` (murni fetch + env) + tipe yang dipakai, tanpa token —
 * semua endpoint di bawah ini publik tanpa login.
 *
 * Timeout SSR 8 detik (bukan 15): backend mati tidak boleh menahan TTFB dan
 * budget crawl. Gagal → array kosong/null; halaman melakukan fallback fetch
 * di browser seperti perilaku semula.
 */
import { apiRequest } from '$lib/api/backend';
import type { BackendCourse } from '$lib/api/courses';

const SSR_TIMEOUT_MS = 8000;

type ListEnvelope = { courses?: BackendCourse[] } | BackendCourse[];

function unwrapList(data: ListEnvelope): BackendCourse[] {
	return Array.isArray(data) ? data : (data.courses ?? []);
}

async function getList(query: string): Promise<BackendCourse[]> {
	try {
		return unwrapList(await apiRequest<ListEnvelope>(`/courses?${query}`, { timeoutMs: SSR_TIMEOUT_MS }));
	} catch {
		return [];
	}
}

/** Beranda: sorotan terbit terbaru (cermin loadSorotan). */
export function getSpotServer(): Promise<BackendCourse[]> {
	return getList('status=published&limit=12&sort=newest');
}

/** /pelatihan: filter default "Semua" (cermin loadModul). */
export function getModulServer(): Promise<BackendCourse[]> {
	return getList('status=published&limit=8&sort=newest');
}

/** /modules: katalog awal tanpa filter (cermin load). */
export function getCatalogServer(): Promise<BackendCourse[]> {
	return getList('limit=100&sort=newest');
}

/**
 * Detail publik satu kursus. Melempar error asli agar caller bisa bedakan
 * 404 (kursus tidak ada) vs backend mati — JANGAN telan jadi null di sini.
 */
export async function fetchCourseDetailServer(id: number): Promise<BackendCourse> {
	const data = await apiRequest<{ course?: BackendCourse } | BackendCourse>(`/courses/${id}`, {
		timeoutMs: SSR_TIMEOUT_MS
	});
	return (data as { course?: BackendCourse }).course ?? (data as BackendCourse);
}
