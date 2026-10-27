import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
	classifyRequestError,
	fetchWithTimeout,
	RequestTimeoutError,
	type FetchLike
} from '../src/lib/api/request-policy.ts';

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Mock fetch yang menggantung sampai signal diabort (seperti fetch asli). */
function hangingFetch(calls: { count: number; signal: AbortSignal | null }): FetchLike {
	return (_url, init) => {
		calls.count += 1;
		return new Promise((_resolve, reject) => {
			calls.signal = init.signal ?? null;
			init.signal?.addEventListener('abort', () => {
				reject(new DOMException('Aborted', 'AbortError'));
			});
		});
	};
}

/** Mock fetch sukses instan; merekam init untuk verifikasi pass-through. */
function okFetch(calls: { count: number; signal: AbortSignal | null; init: RequestInit | null }): FetchLike {
	return (_url, init) => {
		calls.count += 1;
		calls.signal = init.signal ?? null;
		calls.init = init;
		return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
	};
}

describe('timeout request login (mock fetch, tanpa backend)', () => {
	it('login sukses dalam batas waktu: resolve + tanpa retry + timer dibersihkan', async () => {
		const calls = { count: 0, signal: null as AbortSignal | null, init: null as RequestInit | null };
		const res = await fetchWithTimeout(okFetch(calls), 'https://api/login', { method: 'POST' }, 50);
		assert.equal(res.status, 200);
		assert.equal(calls.count, 1);
		assert.equal((calls.init?.method as string) ?? '', 'POST');
		// Timer dibersihkan: lewat dari batas waktu, signal tetap tidak diabort.
		await sleep(80);
		assert.equal(calls.signal?.aborted, false);
	});

	it('request timeout: tolak dengan RequestTimeoutError + tepat 1 pemanggilan (tanpa retry)', async () => {
		const calls = { count: 0, signal: null as AbortSignal | null };
		await assert.rejects(
			fetchWithTimeout(hangingFetch(calls), 'https://api/login', { method: 'POST' }, 20),
			(err: unknown) => {
				assert.ok(err instanceof RequestTimeoutError);
				assert.equal((err as RequestTimeoutError).timeoutMs, 20);
				return true;
			}
		);
		assert.equal(calls.count, 1);
		assert.equal(calls.signal?.aborted, true);
	});

	it('error jaringan diteruskan apa adanya (bukan dibungkus timeout)', async () => {
		const boom = new TypeError('fetch failed');
		const impl: FetchLike = () => Promise.reject(boom);
		await assert.rejects(fetchWithTimeout(impl, 'https://api/login', {}, 50), (err: unknown) => {
			assert.equal(err, boom);
			return true;
		});
	});

	it('timer dibersihkan juga saat gagal cepat (tanpa abort susulan)', async () => {
		const seen: { signal: AbortSignal | null } = { signal: null };
		const impl: FetchLike = (_url, init) => {
			seen.signal = init.signal ?? null;
			return Promise.reject(new TypeError('down'));
		};
		await assert.rejects(fetchWithTimeout(impl, 'https://api/login', {}, 20));
		await sleep(60);
		assert.equal(seen.signal?.aborted, false);
	});
});

describe('klasifikasi error login', () => {
	it('timeout dibedakan dari kredensial salah (401), 403, dan network', () => {
		assert.equal(
			classifyRequestError({ name: 'BackendRequestError', httpStatus: 0, code: 'timeout' }),
			'timeout'
		);
		assert.equal(classifyRequestError({ httpStatus: 401 }), 'unauthorized');
		assert.equal(classifyRequestError({ httpStatus: 403 }), 'forbidden');
		assert.equal(classifyRequestError({ httpStatus: 0 }), 'network');
	});

	it('loading selalu berhenti: error timeout/401/403/network semuanya melempar (finally berjalan)', async () => {
		// Pola yang dipakai halaman login: isLoading=false di finally.
		async function withLoading(fn: () => Promise<never>): Promise<string> {
			let loading = true;
			try {
				await fn();
				return 'unexpected';
			} finally {
				loading = false;
				assert.equal(loading, false);
			}
		}
		for (const err of [
			new RequestTimeoutError(20),
			{ httpStatus: 401 },
			{ httpStatus: 403 },
			{ httpStatus: 0 }
		]) {
			await assert.rejects(withLoading(() => Promise.reject(err)));
		}
	});
});
