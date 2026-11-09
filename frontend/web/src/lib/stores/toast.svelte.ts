import { browser } from '$app/environment';

/**
 * Toast notification terpusat ARISTOTELES (Svelte 5 runes + TypeScript).
 *
 * - Dipakai: `toast.success('Pesan')`, `toast.error(...)`, `toast.warning(...)`, `toast.info(...)`.
 * - Aman SSR: `push()` no-op bila `!browser`, sehingga tidak ada state yang
 *   bocor antar-request di server. Jangan panggil dari `load()` server.
 * - Batas tampil: 4 toast; yang terlama disingkirkan saat penuh.
 * - Duplikat identik yang masih tampil tidak ditumpuk — timernya di-reset.
 * - Timeout dibersihkan saat toast dihapus; tidak ada timer menggantung.
 */

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
	id: number;
	type: ToastType;
	title: string;
	message: string;
	leaving: boolean;
}

export interface ToastOptions {
	/** Judul kustom; default sesuai tipe (Berhasil/Gagal/Peringatan/Info). */
	title?: string;
	/** Durasi tampil (ms); default success/info 4000, warning 5000, error 6000. */
	duration?: number;
}

const DEFAULT_DURATION: Record<ToastType, number> = {
	success: 4000,
	info: 4000,
	warning: 5000,
	error: 6000
};

const DEFAULT_TITLE: Record<ToastType, string> = {
	success: 'Berhasil',
	error: 'Gagal',
	warning: 'Peringatan',
	info: 'Info'
};

/** Jumlah maksimum toast tampil bersamaan. */
const MAX_VISIBLE = 4;
/** Jeda animasi keluar sebelum elemen dihapus (sinkron dengan CSS). */
const EXIT_MS = 180;

let seq = 0;
const items = $state<ToastItem[]>([]);
const timers = new Map<number, ReturnType<typeof setTimeout>>();

/** Daftar toast aktif (reaktif). Dirender oleh ToastViewport. */
export function toasts(): ToastItem[] {
	return items;
}

function clearTimer(id: number): void {
	const t = timers.get(id);
	if (t !== undefined) {
		clearTimeout(t);
		timers.delete(id);
	}
}

function remove(id: number): void {
	const i = items.findIndex((t) => t.id === id);
	if (i >= 0) items.splice(i, 1);
	clearTimer(id);
}

function scheduleDismiss(id: number, duration: number): void {
	clearTimer(id);
	timers.set(
		id,
		setTimeout(() => {
			const it = items.find((t) => t.id === id);
			if (!it) return;
			it.leaving = true;
			timers.set(
				id,
				setTimeout(() => remove(id), EXIT_MS)
			);
		}, duration)
	);
}

function push(type: ToastType, message: string, options: ToastOptions = {}): number | null {
	if (!browser) return null;
	const text = message.trim();
	if (!text) return null;
	const title = options.title?.trim() || DEFAULT_TITLE[type];
	const duration = options.duration ?? DEFAULT_DURATION[type];

	const dup = items.find(
		(t) => !t.leaving && t.type === type && t.title === title && t.message === text
	);
	if (dup) {
		scheduleDismiss(dup.id, duration);
		return dup.id;
	}
	while (items.length >= MAX_VISIBLE) {
		const oldest = items.find((t) => !t.leaving) ?? items[0];
		if (!oldest) break;
		remove(oldest.id);
	}
	const id = ++seq;
	items.push({ id, type, title, message: text, leaving: false });
	scheduleDismiss(id, duration);
	return id;
}

/** Tutup satu toast manual (dengan animasi keluar). */
export function dismissToast(id: number): void {
	const it = items.find((t) => t.id === id);
	if (!it || it.leaving) return;
	clearTimer(id);
	it.leaving = true;
	timers.set(id, setTimeout(() => remove(id), EXIT_MS));
}

/** Tutup semua toast yang tampil. */
export function clearToasts(): void {
	for (const t of [...items]) dismissToast(t.id);
}

export const toast = {
	success: (message: string, options?: ToastOptions) => push('success', message, options),
	error: (message: string, options?: ToastOptions) => push('error', message, options),
	warning: (message: string, options?: ToastOptions) => push('warning', message, options),
	info: (message: string, options?: ToastOptions) => push('info', message, options),
	dismiss: dismissToast,
	clear: clearToasts
};
