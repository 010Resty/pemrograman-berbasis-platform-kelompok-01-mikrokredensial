/**
 * Kebijakan request terpusat — murni, tanpa Svelte runes, tanpa import SvelteKit.
 *
 * Sengaja bebas dependensi agar dapat diuji dengan `node --test` tanpa
 * browser/bundler. Modul API (`backend.ts`, `courses.ts`, ...) memakai
 * helper ini; tidak ada client kedua.
 */

/** Klasifikasi kegagalan request privat terhadap kontrak backend. */
export type RequestFailureKind =
	| 'unauthorized' // HTTP 401: token hilang/kedaluwarsa/tidak valid
	| 'forbidden' // HTTP 403: peran/izin ditolak — sesi TIDAK dicabut
	| 'timeout' // batas waktu terlampaui — sesi TIDAK dicabut, tanpa retry
	| 'network' // httpStatus 0: backend tidak terjangkau
	| 'server' // HTTP 5xx: kesalahan server
	| 'other'; // selain itu (400/404/dll atau bentuk tak dikenal)

/** Bentuk minimal error yang dibawa dari `apiRequest` (duck-typing). */
export interface HttpStatusLike {
	httpStatus?: unknown;
	code?: unknown;
}

/** Petakan error request menjadi kebijakan penanganan. */
export function classifyRequestError(err: unknown): RequestFailureKind {
	if ((err as HttpStatusLike | null)?.code === 'timeout') return 'timeout';
	const status = (err as HttpStatusLike | null)?.httpStatus;
	if (typeof status !== 'number') return 'other';
	if (status === 0) return 'network';
	if (status === 401) return 'unauthorized';
	if (status === 403) return 'forbidden';
	if (status >= 500) return 'server';
	return 'other';
}

/** Bangun nilai header Authorization — null bila tanpa token (request publik). */
export function authorizationHeader(token: string | null | undefined): string | null {
	if (!token) return null;
	return `Bearer ${token}`;
}

/**
 * True bila URL target boleh menerima token: origin sama dengan base API
 * tepercaya. Mencegah token bocor ke origin asing.
 */
export function isTrustedApiUrl(target: string, trustedBase: string): boolean {
	try {
		const t = new URL(target, trustedBase);
		const b = new URL(trustedBase);
		return t.origin === b.origin;
	} catch {
		return false;
	}
}

/** Konteks pemilik request — ditangkap saat mulai, dicek saat respons tiba. */
export interface RequestContext {
	generation: number;
	ownerId: string | null;
	token: string | null;
}

/**
 * True bila respons TIDAK boleh diterapkan: generasi berganti (logout/login),
 * pemilik akun berbeda, atau token berubah sejak request dikirim.
 */
export function isContextStale(
	captured: RequestContext,
	current: RequestContext
): boolean {
	return (
		captured.generation !== current.generation ||
		captured.ownerId !== current.ownerId ||
		captured.token !== current.token
	);
}

/** Side-effect 401 yang dijalankan sekali (diinjeksikan agar testable). */
export interface UnauthorizedHooks {
	/** Invalidasi sesi + bersihkan cache privat + logout (tanpa redirect). */
	runSideEffects: () => void | Promise<void>;
	/** Navigasi ke alur autentikasi. Dipanggil maksimal sekali per generasi. */
	requestRedirect: () => void;
}

/**
 * Koordinator 401 single-flight: N pemanggil bersamaan → side-effect 1×,
 * redirect 1× per generasi. 403/network/5xx tidak memicu apa pun.
 */
export function createUnauthorizedCoordinator() {
	let inFlight: Promise<void> | null = null;
	let redirectedGeneration = -1;

	async function runOnce(hooks: UnauthorizedHooks): Promise<void> {
		if (inFlight) {
			await inFlight;
			return;
		}
		inFlight = (async () => {
			await hooks.runSideEffects();
		})();
		try {
			await inFlight;
		} finally {
			inFlight = null;
		}
	}

	return {
		/**
		 * Tangani error request privat. Kembalikan klasifikasi; side-effect
		 * hanya untuk 401. Caller tetap melempar error asli agar UI bisa
		 * menampilkan pesan.
		 */
		async handle(
			err: unknown,
			generation: number,
			hooks: UnauthorizedHooks
		): Promise<RequestFailureKind> {
			const kind = classifyRequestError(err);
			if (kind !== 'unauthorized') return kind;
			await runOnce(hooks);
			if (generation !== redirectedGeneration) {
				redirectedGeneration = generation;
				hooks.requestRedirect();
			}
			return kind;
		},
		/** Untuk pengujian: reset status redirect. */
		__resetForTests(): void {
			inFlight = null;
			redirectedGeneration = -1;
		}
	};
}

/** Jenis mutasi kursus untuk keputusan invalidasi cache. */
export type CourseMutationKind =
	| 'create-course'
	| 'update-course'
	| 'delete-course'
	| 'structure-change' // tambah/ubah/hapus/pindah modul, sub-modul, materi
	| 'title-change' // judul/tipe/durasi materi berubah
	| 'quiz-content'; // soal/passScore saja — tidak tersimpan di tree

export interface CourseInvalidationPlan {
	invalidateList: boolean;
	invalidateTree: boolean;
}

/**
 * Rencana invalidasi per jenis mutasi: hanya domain terdampak yang ditandai.
 * Dipakai halaman mutasi setelah server mengonfirmasi sukses.
 */
export function courseMutationInvalidation(kind: CourseMutationKind): CourseInvalidationPlan {
	switch (kind) {
		case 'create-course':
		case 'update-course':
		case 'delete-course':
			return { invalidateList: true, invalidateTree: kind === 'delete-course' };
		case 'structure-change':
		case 'title-change':
			return { invalidateList: false, invalidateTree: true };
		case 'quiz-content':
			return { invalidateList: false, invalidateTree: false };
	}
}

/** Dilempar `fetchWithTimeout` bila batas waktu terlampaui sebelum respons tiba. */
export class RequestTimeoutError extends Error {
	readonly timeoutMs: number;

	constructor(timeoutMs: number) {
		super(`Request timed out after ${timeoutMs} ms`);
		this.name = 'RequestTimeoutError';
		this.timeoutMs = timeoutMs;
	}
}

/** Implementasi fetch yang dapat diinjeksikan (untuk pengujian). */
export type FetchLike = (
	url: string,
	init: RequestInit & { signal?: AbortSignal | null }
) => Promise<Response>;

/**
 * Fetch dengan batas waktu memakai AbortController internal.
 * - Timer selalu dibersihkan (sukses/gagal/batal) via `finally`.
 * - Timeout → `RequestTimeoutError` (bukan error jaringan generik).
 * - Error lain (termasuk abort yang bukan dari timer ini) diteruskan apa adanya.
 * - Tidak ada retry: tepat satu pemanggilan `impl`.
 */
export async function fetchWithTimeout(
	impl: FetchLike,
	url: string,
	init: RequestInit,
	timeoutMs: number
): Promise<Response> {
	const controller = new AbortController();
	let timedOut = false;
	const timer = setTimeout(() => {
		timedOut = true;
		controller.abort();
	}, timeoutMs);
	try {
		return await impl(url, { ...init, signal: controller.signal });
	} catch (err) {
		if (timedOut) throw new RequestTimeoutError(timeoutMs);
		throw err;
	} finally {
		clearTimeout(timer);
	}
}
