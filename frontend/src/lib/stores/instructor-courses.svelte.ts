import { browser } from '$app/environment';
import {
	fetchCourseTree,
	fetchMyCourses,
	type BackendCourse
} from '$lib/api/courses';
import {
	classifyRequestError,
	isContextStale,
	type RequestContext
} from '$lib/api/request-policy';
import {
	currentSessionGeneration,
	getAccessToken,
	getCurrentUser,
	registerPrivateCacheClearer
} from '$lib/stores/auth.svelte';
import type { CourseModule } from '$lib/data/courses';

/**
 * Cache terpusat kursus milik instruktur + pohon kurikulum (optimasi request).
 *
 * Pola: `data / status / error / loaded / inFlight / load / refresh /
 * invalidate / clear` per domain. Memori sesi saja (tanpa localStorage)
 * agar data privat tidak menempel antar-akun dan tidak bocor via SSR
 * (hanya diisi di browser; SSR selalu kosong).
 *
 * - Daftar: 1 request `/instructor/courses`, didedup saat mount ulang/double-effect.
 * - Tree per kursus: didedup per `courseId` (N+1 `fetchCourseTree` hanya sekali).
 * - Cache terikat `ownerId` (= user id sesi): ganti akun/token lain otomatis
 *   invalidasi agar tidak tercampur.
 * - Backend tetap otoritas izin: store tidak mengklaim akses, hanya menyimpan
 *   hasil sukses; error TIDAK diubah menjadi array kosong.
 */

export type CourseCacheStatus = 'idle' | 'loading' | 'ready' | 'error';

let coursesData = $state<BackendCourse[]>([]);
let coursesStatus = $state<CourseCacheStatus>('idle');
let coursesError = $state('');
let coursesLoaded = false;
let coursesInFlight: Promise<BackendCourse[]> | null = null;
let coursesOwner: string | null = null;

interface TreeEntry {
	data: CourseModule[];
	status: CourseCacheStatus;
	error: string;
	loaded: boolean;
	inFlight: Promise<CourseModule[]> | null;
	owner: string | null;
}

const treeCache = new Map<number, TreeEntry>();

/** Daftarkan pembersih ke koordinator sesi: logout/401 otomatis hapus cache ini. */
registerPrivateCacheClearer(clearInstructorCourseCaches);

function captureContext(): RequestContext {
	return {
		generation: currentSessionGeneration(),
		ownerId: getCurrentUser()?.id ?? null,
		token: getAccessToken()
	};
}

function currentContext(): RequestContext {
	return {
		generation: currentSessionGeneration(),
		ownerId: getCurrentUser()?.id ?? null,
		token: getAccessToken()
	};
}

/** Error internal: respons tiba setelah sesi berganti — jangan tulis ke cache. */
function staleError(): Error {
	return new Error('Sesi berubah saat memuat. Silakan coba lagi.');
}

function currentOwner(): string | null {
	// Kunci per akun; token dicek terpisah oleh pemanggil (401 -> clear + relogin).
	return getCurrentUser()?.id ?? null;
}

function requireBrowser(): boolean {
	return browser && getAccessToken() !== null;
}

function ensureListOwner(): void {
	const owner = currentOwner();
	if (coursesOwner !== null && coursesOwner !== owner) {
		clearMyCourses();
	}
	if (owner !== null) coursesOwner = owner;
}

function ensureTreeOwner(courseId: number): TreeEntry {
	let entry = treeCache.get(courseId);
	if (!entry) {
		entry = { data: [], status: 'idle', error: '', loaded: false, inFlight: null, owner: null };
		treeCache.set(courseId, entry);
	}
	const owner = currentOwner();
	if (entry.owner !== null && entry.owner !== owner) {
		entry.data = [];
		entry.status = 'idle';
		entry.error = '';
		entry.loaded = false;
		entry.inFlight = null;
	}
	if (owner !== null) entry.owner = owner;
	return entry;
}

async function fetchListNetwork(): Promise<BackendCourse[]> {
	const sent = captureContext();
	const list = await fetchMyCourses();
	// Respons lama (logout/ganti akun saat request berjalan) dibuang.
	if (isContextStale(sent, currentContext())) throw staleError();
	coursesData = list;
	coursesStatus = 'ready';
	coursesError = '';
	coursesLoaded = true;
	return list;
}

/** Ambil daftar kursus milik sendiri; tanpa request bila sudah `ready` + pemilik sama. */
export function loadMyCourses(): Promise<BackendCourse[]> {
	if (!browser) return Promise.resolve([]);
	ensureListOwner();
	if (coursesLoaded && coursesStatus === 'ready') return Promise.resolve(coursesData);
	if (coursesInFlight) return coursesInFlight;
	if (!requireBrowser()) {
		return Promise.reject(new Error('Sesi belum tersedia. Masuk kembali.'));
	}
	coursesStatus = 'loading';
	coursesInFlight = fetchListNetwork().catch((e: unknown) => {
		// 401: sesi dicabut — cache privat sudah dibersihkan terpusat; jangan seed ulang.
		// 403: izin ditolak — sesi tetap valid, PERTAHANKAN data lama (jangan kosongkan).
		// network/5xx: token dipertahankan, tampilkan error + retry manual.
		if (classifyRequestError(e) === 'unauthorized') {
			clearMyCourses();
			coursesStatus = 'error';
			coursesError = e instanceof Error ? e.message : 'Sesi berakhir. Masuk kembali.';
		} else {
			// 403/network/5xx/lainnya: data lama dipertahankan, hanya tandai error.
			coursesStatus = 'error';
			coursesError = e instanceof Error ? e.message : 'Gagal memuat kursus.';
		}
		throw e;
	});
	const p = coursesInFlight;
	void p.finally(() => {
		if (coursesInFlight === p) coursesInFlight = null;
	});
	return p;
}

/** Ambil ulang daftar secara eksplisit (tombol retry/refresh). */
export function refreshMyCourses(): Promise<BackendCourse[]> {
	invalidateMyCourses();
	return loadMyCourses();
}

/** Tandai daftar basi — pemanggilan berikutnya request baru (data lama tetap dibaca). */
export function invalidateMyCourses(): void {
	coursesLoaded = false;
	if (coursesStatus === 'ready') coursesStatus = 'idle';
}

/** Hapus cache daftar privat (logout/ganti akun). */
export function clearMyCourses(): void {
	coursesData = [];
	coursesStatus = 'idle';
	coursesError = '';
	coursesLoaded = false;
	coursesInFlight = null;
	coursesOwner = null;
}

export function getMyCoursesData(): BackendCourse[] {
	return coursesData;
}

export function getMyCoursesStatus(): CourseCacheStatus {
	return coursesStatus;
}

export function getMyCoursesError(): string {
	return coursesError;
}

export function isMyCoursesLoaded(): boolean {
	return coursesLoaded;
}

async function fetchTreeNetwork(courseId: number, entry: TreeEntry): Promise<CourseModule[]> {
	const sent = captureContext();
	const tree = await fetchCourseTree(courseId);
	// Respons lama (logout/ganti akun saat request berjalan) dibuang.
	if (isContextStale(sent, currentContext())) throw staleError();
	entry.data = tree;
	entry.status = 'ready';
	entry.error = '';
	entry.loaded = true;
	return tree;
}

/** Ambil pohon kurikulum satu kursus; didedup per courseId + pemilik. */
export function loadCourseTree(courseId: number): Promise<CourseModule[]> {
	if (!browser) return Promise.resolve([]);
	const entry = ensureTreeOwner(courseId);
	if (entry.loaded && entry.status === 'ready') return Promise.resolve(entry.data);
	if (entry.inFlight) return entry.inFlight;
	if (!requireBrowser()) {
		return Promise.reject(new Error('Sesi belum tersedia. Masuk kembali.'));
	}
	entry.status = 'loading';
	entry.inFlight = fetchTreeNetwork(courseId, entry).catch((e: unknown) => {
		// 401: cache privat sudah dibersihkan terpusat. 403/network/5xx:
		// data lama dipertahankan, hanya tandai error (jangan kosongkan).
		if (classifyRequestError(e) === 'unauthorized') {
			entry.data = [];
			entry.loaded = false;
			entry.status = 'error';
			entry.error = e instanceof Error ? e.message : 'Sesi berakhir. Masuk kembali.';
		} else {
			entry.status = 'error';
			entry.error = e instanceof Error ? e.message : 'Gagal memuat kurikulum.';
		}
		throw e;
	});
	const p = entry.inFlight;
	void p.finally(() => {
		if (entry.inFlight === p) entry.inFlight = null;
	});
	return p;
}

/** Ambil ulang pohon satu kursus secara eksplisit. */
export function refreshCourseTree(courseId: number): Promise<CourseModule[]> {
	invalidateCourseTree(courseId);
	return loadCourseTree(courseId);
}

export function invalidateCourseTree(courseId: number): void {
	const entry = treeCache.get(courseId);
	if (entry) {
		entry.loaded = false;
		if (entry.status === 'ready') entry.status = 'idle';
	}
}

export function getCourseTreeData(courseId: number): CourseModule[] {
	return treeCache.get(courseId)?.data ?? [];
}

export function getCourseTreeStatus(courseId: number): CourseCacheStatus {
	return treeCache.get(courseId)?.status ?? 'idle';
}

/** Hapus seluruh cache privat domain ini (wajib dipanggil saat logout/ganti akun). */
export function clearInstructorCourseCaches(): void {
	clearMyCourses();
	treeCache.clear();
}
