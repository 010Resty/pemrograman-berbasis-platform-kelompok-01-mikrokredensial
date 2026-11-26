import { browser } from '$app/environment';

/**
 * Polling badge bell terpadu untuk 3 portal (user/instruktur/admin).
 *
 * Menyegarkan saat: tab kembali terlihat, window fokus, event keputusan
 * (mis. 'user:notif-refresh'), + interval 60 detik. Interval dilewati saat
 * tab hidden agar hemat kuota/baterai. Dipanggil sekali saat komponen
 * layout diinisialisasi (top-level `<script>`).
 */
export function useBadgePolling(options: {
	/** Pemuatan badge (mis. `() => void loadBadges()`). */
	load: () => void;
	/** Portal siap (mis. `() => phase === 'ready'`). */
	isReady: () => boolean;
	/** Nama CustomEvent keputusan; kosong = tanpa listener event. */
	eventName?: string;
	/** Interval ms (default 60000). */
	intervalMs?: number;
}): void {
	if (!browser) return;
	const interval = options.intervalMs ?? 60000;
	const { load, isReady, eventName } = options;
	$effect(() => {
		const onVisible = () => {
			if (document.visibilityState === 'visible' && isReady()) load();
		};
		const onFocus = () => {
			if (isReady()) load();
		};
		const onDecided = () => {
			if (isReady()) load();
		};
		document.addEventListener('visibilitychange', onVisible);
		window.addEventListener('focus', onFocus);
		if (eventName) window.addEventListener(eventName, onDecided);
		const timer = setInterval(() => {
			if (document.hidden) return;
			if (isReady()) load();
		}, interval);
		return () => {
			document.removeEventListener('visibilitychange', onVisible);
			window.removeEventListener('focus', onFocus);
			if (eventName) window.removeEventListener(eventName, onDecided);
			clearInterval(timer);
		};
	});
}
