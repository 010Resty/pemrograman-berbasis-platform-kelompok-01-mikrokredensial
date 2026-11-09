import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
	authorizationHeader,
	classifyRequestError,
	courseMutationInvalidation,
	createUnauthorizedCoordinator,
	isContextStale,
	isTrustedApiUrl,
	type RequestContext
} from '../src/lib/api/request-policy.ts';

function errWith(status: number): unknown {
	return { name: 'BackendRequestError', message: `HTTP ${status}`, httpStatus: status };
}

function ctx(over: Partial<RequestContext> = {}): RequestContext {
	return { generation: 1, ownerId: '7', token: 'tok-1', ...over };
}

describe('header Authorization', () => {
	it('1. request publik tanpa token tidak membawa Authorization', () => {
		assert.equal(authorizationHeader(null), null);
		assert.equal(authorizationHeader(undefined), null);
		assert.equal(authorizationHeader(''), null);
	});

	it('2. request privat membawa Bearer token', () => {
		assert.equal(authorizationHeader('abc123'), 'Bearer abc123');
	});

	it('token tidak dikirim ke origin yang tidak dipercaya', () => {
		const base = 'http://localhost:3000/api/v1';
		assert.equal(isTrustedApiUrl(`${base}/courses`, base), true);
		assert.equal(isTrustedApiUrl('https://evil.example/x', base), false);
		assert.equal(isTrustedApiUrl('http://other:4000/api/v1/me', base), false);
	});
});

describe('klasifikasi error autentikasi', () => {
	it('401 terklasifikasi unauthorized', () => {
		assert.equal(classifyRequestError(errWith(401)), 'unauthorized');
	});

	it('4. 403 terklasifikasi forbidden (bukan sesi dicabut)', () => {
		assert.equal(classifyRequestError(errWith(403)), 'forbidden');
	});

	it('5. network (0) dan 5xx bukan sesi dicabut', () => {
		assert.equal(classifyRequestError(errWith(0)), 'network');
		assert.equal(classifyRequestError(errWith(500)), 'server');
		assert.equal(classifyRequestError(errWith(502)), 'server');
		assert.equal(classifyRequestError(new Error('acak')), 'other');
	});
});

describe('koordinator 401 single-flight', () => {
	it('3. 401 menjalankan invalidasi+clear+logout tepat sekali', async () => {
		const coord = createUnauthorizedCoordinator();
		let sideEffects = 0;
		let redirects = 0;
		const hooks = {
			runSideEffects: () => {
				sideEffects += 1;
			},
			requestRedirect: () => {
				redirects += 1;
			}
		};
		const kind = await coord.handle(errWith(401), 1, hooks);
		assert.equal(kind, 'unauthorized');
		assert.equal(sideEffects, 1);
		assert.equal(redirects, 1);
	});

	it('4. 403 tidak memicu logout/clear/redirect', async () => {
		const coord = createUnauthorizedCoordinator();
		let sideEffects = 0;
		let redirects = 0;
		const kind = await coord.handle(
			errWith(403),
			1,
			{
				runSideEffects: () => {
					sideEffects += 1;
				},
				requestRedirect: () => {
					redirects += 1;
				}
			}
		);
		assert.equal(kind, 'forbidden');
		assert.equal(sideEffects, 0);
		assert.equal(redirects, 0);
	});

	it('5. network/5xx tidak menghapus sesi', async () => {
		const coord = createUnauthorizedCoordinator();
		for (const status of [0, 500]) {
			let sideEffects = 0;
			const kind = await coord.handle(
				errWith(status),
				1,
				{
					runSideEffects: () => {
						sideEffects += 1;
					},
					requestRedirect: () => {}
				}
			);
			assert.equal(sideEffects, 0);
			assert.ok(kind === 'network' || kind === 'server');
		}
	});

	it('6. lima 401 bersamaan: side-effect 1x, redirect 1x', async () => {
		const coord = createUnauthorizedCoordinator();
		let sideEffects = 0;
		let redirects = 0;
		const hooks = {
			runSideEffects: async () => {
				await new Promise((r) => setTimeout(r, 10));
				sideEffects += 1;
			},
			requestRedirect: () => {
				redirects += 1;
			}
		};
		const kinds = await Promise.all(
			Array.from({ length: 5 }, () => coord.handle(errWith(401), 9, hooks))
		);
		assert.ok(kinds.every((k) => k === 'unauthorized'));
		assert.equal(sideEffects, 1);
		assert.equal(redirects, 1);
	});
});

describe('penjagaan race pergantian akun', () => {
	it('7. logout saat request berjalan: konteks basi, respons dibuang', () => {
		const sent = ctx({ generation: 3 });
		const now = ctx({ generation: 4 });
		assert.equal(isContextStale(sent, now), true);
	});

	it('8a. ganti akun (owner berbeda): konteks basi', () => {
		const sent = ctx({ ownerId: '7', token: 'tok-a' });
		const now = ctx({ ownerId: '9', token: 'tok-b' });
		assert.equal(isContextStale(sent, now), true);
	});

	it('8b. konteks sama: tidak basi, respons boleh ditulis', () => {
		assert.equal(isContextStale(ctx(), ctx()), false);
	});

	it('8c. token berubah tanpa ganti generasi: tetap basi', () => {
		const sent = ctx({ token: 'tok-lama' });
		const now = ctx({ token: 'tok-baru' });
		assert.equal(isContextStale(sent, now), true);
	});
});

describe('rencana invalidasi cache kursus', () => {
	it('9a. create/update/delete menginvalidasi daftar; hanya delete yang menyentuh tree', () => {
		assert.deepEqual(courseMutationInvalidation('create-course'), {
			invalidateList: true,
			invalidateTree: false
		});
		assert.deepEqual(courseMutationInvalidation('update-course'), {
			invalidateList: true,
			invalidateTree: false
		});
		assert.deepEqual(courseMutationInvalidation('delete-course'), {
			invalidateList: true,
			invalidateTree: true
		});
	});

	it('9b. perubahan struktur/judul hanya menginvalidasi tree terkait', () => {
		assert.deepEqual(courseMutationInvalidation('structure-change'), {
			invalidateList: false,
			invalidateTree: true
		});
		assert.deepEqual(courseMutationInvalidation('title-change'), {
			invalidateList: false,
			invalidateTree: true
		});
	});

	it('9c. konten kuis saja tidak menginvalidasi apa pun', () => {
		assert.deepEqual(courseMutationInvalidation('quiz-content'), {
			invalidateList: false,
			invalidateTree: false
		});
	});
});
