import { browser } from '$app/environment';
import { SvelteSet } from 'svelte/reactivity';
import { getCourseMeta } from '$lib/data/course-meta';
import { fetchMyEnrollments, type MyEnrollment } from '$lib/api/progress';

/**
 * Kepemilikan course: server backend satu-satunya sumber kebenaran
 * (GET /me/enrollments, status active/completed).
 * `ownedCourses` murni tembusan: ditulis ulang PENUH setiap sinkronisasi
 * berhasil (`syncEnrollmentsFromServer`), tidak pernah ditambah/dihapus
 * dari tempat lain. Tidak ada pembelian lokal, tidak ada buka-kunci manual.
 * localStorage hanya cache sesi (key v3; entri v2 lama yang mungkin berisi
 * kepemilikan palsu otomatis ditinggalkan).
 */
const KEY = 'aristoteles:owned-courses:v3';

export const ownedCourses = new SvelteSet<number>();

function persist(): void {
	if (!browser) return;
	try {
		localStorage.setItem(KEY, JSON.stringify([...ownedCourses]));
	} catch {
		// Penyimpanan penuh/diblokir — kepemilikan tetap berlaku sesi ini.
	}
}

if (browser) {
	try {
		const raw = localStorage.getItem(KEY);
		if (raw) {
			for (const id of JSON.parse(raw) as unknown[]) {
				if (typeof id === 'number') ownedCourses.add(id);
			}
		}
	} catch {
		// Data korup — mulai dari kepemilikan kosong.
	}
}

/** True bila course berlabel harga (bukan GRATIS). */
export function isCoursePaid(courseId: number): boolean {
	const server = serverFlags.get(courseId);
	if (server) return server.paid;
	return getCourseMeta(courseId).price.trim().toUpperCase() !== 'GRATIS';
}

/** True bila batch course belum mulai (periode upcoming). */
export function isPeriodLocked(courseId: number): boolean {
	const server = serverFlags.get(courseId);
	if (server) return server.upcoming;
	return getCourseMeta(courseId).period === 'upcoming';
}

/**
 * Bendera server per kursus (diisi halaman katalog/pratinjau dari baris backend).
 * Tanpa ini, course backend yang tak ada di meta statis selalu dianggap
 * gratis + berjalan. Registri sesi saja; static fallback tetap untuk id lama.
 */
const serverFlags = new Map<number, { paid: boolean; upcoming: boolean }>();

export function setServerCourseFlags(
	courseId: number,
	flags: { paid: boolean; upcoming: boolean }
): void {
	serverFlags.set(courseId, flags);
}

/** True bila user boleh membuka materi course ini. */
export function canAccessCourse(courseId: number): boolean {
	return !isCoursePaid(courseId) || ownedCourses.has(courseId);
}

/**
 * True bila user boleh MEMBUKA MATERI course ini.
 * Syarat ganda: lunas/terdaftar (canAccessCourse) DAN batch sudah berjalan.
 * Course upcoming tetap terkunci walau user sudah mengikutinya.
 */
export function canOpenMaterials(courseId: number): boolean {
	return canAccessCourse(courseId) && !isPeriodLocked(courseId);
}

/** Single-flight: pemanggilan bersamaan berbagi satu request. */
let syncInFlight: Promise<number> | null = null;

/**
 * Tulis ulang `ownedCourses` dari enrollment aktif/completed milik sendiri.
 * Berhasil = ganti total + persist (entri basi/palsu ikut terbuang).
 * Gagal (offline/tanpa sesi) = cache terakhir dipertahankan, kembalikan 0 —
 * bukan sukses palsu. Terima daftar yang sudah diambil (mis. badge layout)
 * agar tidak dobel request.
 */
export function syncEnrollmentsFromServer(prefetched?: MyEnrollment[]): Promise<number> {
	if (syncInFlight) return syncInFlight;
	syncInFlight = (async () => {
		let list: MyEnrollment[];
		try {
			list = prefetched ?? (await fetchMyEnrollments());
		} catch {
			return 0;
		}
		ownedCourses.clear();
		for (const e of list) {
			if (e.status === 'active' || e.status === 'completed') {
				ownedCourses.add(e.courseId);
			}
		}
		persist();
		return ownedCourses.size;
	})().finally(() => {
		syncInFlight = null;
	});
	return syncInFlight;
}
