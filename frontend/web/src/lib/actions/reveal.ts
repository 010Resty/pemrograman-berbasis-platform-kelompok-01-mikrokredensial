import type { Action } from 'svelte/action';

interface RevealParams {
	/** Jeda animasi dalam ms — untuk efek stagger berurutan. */
	delay?: number;
}

/**
 * Animasi scroll reveal: elemen memudar + naik perlahan saat masuk viewport.
 * - State awal hanya diterapkan lewat JS (tanpa-JS tetap tampil normal).
 * - Menghormati `prefers-reduced-motion`: langsung tampil tanpa animasi.
 * - Observer dilepas setelah terlihat pertama kali + saat destroy.
 */
export const reveal: Action<HTMLElement, RevealParams | undefined> = (node, params) => {
	node.classList.add('reveal');
	if (params?.delay) node.style.setProperty('--reveal-delay', `${params.delay}ms`);

	if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
		node.classList.add('reveal-visible');
		return {};
	}

	const io = new IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				if (entry.isIntersecting) {
					node.classList.add('reveal-visible');
					io.disconnect();
				}
			}
		},
		{ threshold: 0.1, rootMargin: '0px 0px -8% 0px' }
	);
	io.observe(node);

	return {
		destroy() {
			io.disconnect();
		}
	};
};
