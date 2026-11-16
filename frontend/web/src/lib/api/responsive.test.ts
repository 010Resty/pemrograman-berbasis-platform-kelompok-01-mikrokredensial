import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildSrcSet, normalizeWidths } from './responsive.ts';

/**
 * Helper srcset murni — tanpa dependensi browser/bundler.
 * Jalankan: node --test src/lib/api/responsive.test.ts
 */
describe('normalizeWidths', () => {
	it('menyaring, dedup, dan mengurutkan', () => {
		assert.deepEqual(normalizeWidths([1600, 480, 480, 800]), [480, 800, 1600]);
		assert.deepEqual(normalizeWidths([0, -4, 3.5, NaN, 5000, 4001]), []);
		assert.deepEqual(normalizeWidths([1200, 320]), [320, 1200]);
	});
});

describe('buildSrcSet', () => {
	const base = 'http://localhost:3000/api/v1/files/9/content';

	it('membangun daftar w descriptor', () => {
		assert.equal(
			buildSrcSet(base, [800, 480]),
			'http://localhost:3000/api/v1/files/9/content?w=480 480w, http://localhost:3000/api/v1/files/9/content?w=800 800w'
		);
	});

	it('mengembalikan null untuk input tak valid', () => {
		assert.equal(buildSrcSet(null), null);
		assert.equal(buildSrcSet(''), null);
		assert.equal(buildSrcSet('   '), null);
		assert.equal(buildSrcSet(base, []), null);
		assert.equal(buildSrcSet(base, [0, -1]), null);
	});

	it('memakai lebar default bila tak disebut', () => {
		const out = buildSrcSet(base);
		assert.ok(out?.includes('?w=480 480w'));
		assert.ok(out?.includes('?w=800 800w'));
		assert.ok(out?.includes('?w=1200 1200w'));
	});

	it('hanya untuk URL berkas backend (bukan URL luar)', () => {
		assert.equal(buildSrcSet('https://images.unsplash.com/photo?w=800', [400]), null);
		assert.equal(buildSrcSet('/gambar/lokal.png', [400]), null);
	});

	it('memotong query lama agar tidak ganda', () => {
		assert.equal(
			buildSrcSet(`${base}?w=999`, [480]),
			'http://localhost:3000/api/v1/files/9/content?w=480 480w'
		);
	});
});
