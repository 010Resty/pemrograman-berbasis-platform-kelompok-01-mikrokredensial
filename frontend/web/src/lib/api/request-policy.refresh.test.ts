import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRefreshCoordinator } from './request-policy.ts';

/**
 * Koordinator silent refresh: single-flight agar N 401 bersamaan hanya
 * memicu SATU POST /auth/refresh (refresh token sekali pakai — dua pakai
 * = seluruh sesi dicabut server).
 * Jalankan: node --test src/lib/api/request-policy.refresh.test.ts
 */

describe('createRefreshCoordinator', () => {
	it('satu panggilan → satu refresh, hasil diteruskan', async () => {
		let calls = 0;
		const c = createRefreshCoordinator(async () => {
			calls += 1;
			return { accessToken: 'a1', refreshToken: 'r1' };
		});
		const out = await c.refresh();
		assert.deepEqual(out, { accessToken: 'a1', refreshToken: 'r1' });
		assert.equal(calls, 1);
	});

	it('N panggilan bersamaan → satu refresh, semua dapat hasil sama', async () => {
		let calls = 0;
		let release!: () => void;
		const gate = new Promise<void>((r) => (release = r));
		const c = createRefreshCoordinator(async () => {
			calls += 1;
			await gate;
			return { accessToken: 'a2', refreshToken: 'r2' };
		});
		const all = Promise.all([c.refresh(), c.refresh(), c.refresh(), c.refresh(), c.refresh()]);
		await new Promise((r) => setTimeout(r, 20));
		assert.equal(calls, 1);
		release();
		const outs = await all;
		assert.equal(calls, 1);
		for (const o of outs) assert.deepEqual(o, { accessToken: 'a2', refreshToken: 'r2' });
	});

	it('gagal → null untuk semua, tanpa melempar', async () => {
		let calls = 0;
		const c = createRefreshCoordinator(async () => {
			calls += 1;
			throw new Error('jaringan putus');
		});
		const outs = await Promise.all([c.refresh(), c.refresh(), c.refresh()]);
		assert.equal(calls, 1);
		assert.deepEqual(outs, [null, null, null]);
	});

	it('setelah selesai, panggilan baru memicu refresh lagi', async () => {
		let calls = 0;
		const c = createRefreshCoordinator(async () => {
			calls += 1;
			return { accessToken: `a${calls}`, refreshToken: `r${calls}` };
		});
		assert.deepEqual(await c.refresh(), { accessToken: 'a1', refreshToken: 'r1' });
		assert.deepEqual(await c.refresh(), { accessToken: 'a2', refreshToken: 'r2' });
		assert.equal(calls, 2);
	});

	it('gagal lalu berhasil: percobaan berikutnya jalan lagi', async () => {
		let calls = 0;
		const c = createRefreshCoordinator(async () => {
			calls += 1;
			if (calls === 1) throw new Error('gagal dulu');
			return { accessToken: 'ok', refreshToken: 'ok-r' };
		});
		assert.equal(await c.refresh(), null);
		assert.deepEqual(await c.refresh(), { accessToken: 'ok', refreshToken: 'ok-r' });
		assert.equal(calls, 2);
	});
});
