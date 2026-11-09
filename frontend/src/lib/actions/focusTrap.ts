import type { Action } from 'svelte/action';

/**
 * focusTrap — kunci fokus keyboard di dalam dialog selagi terpasang.
 *
 * Dipakai modal kustom (tambah voucher/undangan/kursus) agar setara
 * WarningModal: Tab berputar di dalam dialog, Escape memicu `onEscape`,
 * fokus awal ke elemen pertama, fokus dikembalikan ke pemicu saat lepas.
 *
 * Contoh:
 * ```svelte
 * <div role="dialog" aria-modal="true" use:focusTrap={{ onEscape: close }}>
 * ```
 */
export const focusTrap: Action<
	HTMLElement,
	{ onEscape?: (event: KeyboardEvent) => void; initialSelector?: string } | undefined
> = (node, options) => {
	const getOptions = () => options ?? {};
	let lastFocused: Element | null = null;

	function focusables(): HTMLElement[] {
		return [
			...node.querySelectorAll<HTMLElement>(
				'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
			)
		].filter((el) => el.offsetParent !== null || el === document.activeElement);
	}

	function handleKeydown(event: KeyboardEvent): void {
		if (event.key === 'Escape') {
			event.stopPropagation();
			getOptions().onEscape?.(event);
			return;
		}
		if (event.key !== 'Tab') return;
		const items = focusables();
		if (items.length === 0) {
			event.preventDefault();
			return;
		}
		const first = items[0];
		const last = items[items.length - 1];
		if (event.shiftKey && document.activeElement === first) {
			event.preventDefault();
			last.focus();
		} else if (!event.shiftKey && document.activeElement === last) {
			event.preventDefault();
			first.focus();
		}
	}

	lastFocused = document.activeElement;
	// Kunci scroll badan seperti WarningModal; kembalikan saat dialog tutup.
	const prevOverflow = document.body.style.overflow;
	document.body.style.overflow = 'hidden';
	node.addEventListener('keydown', handleKeydown);
	// Fokus awal: selector eksplisit → elemen pertama → dialog itu sendiri.
	queueMicrotask(() => {
		const sel = getOptions().initialSelector;
		const target = (sel ? node.querySelector<HTMLElement>(sel) : null) ?? focusables()[0] ?? node;
		target.focus({ preventScroll: true });
	});

	return {
		update(next) {
			options = next;
		},
		destroy() {
			node.removeEventListener('keydown', handleKeydown);
			document.body.style.overflow = prevOverflow;
			if (lastFocused instanceof HTMLElement) lastFocused.focus({ preventScroll: true });
		}
	};
};
