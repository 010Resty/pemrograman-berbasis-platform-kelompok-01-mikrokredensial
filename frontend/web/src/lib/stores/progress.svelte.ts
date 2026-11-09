import { SvelteSet } from 'svelte/reactivity';

/**
 * Cermin progres server untuk sesi ini (bukan sumber kebenaran).
 * - Kebenaran = backend (`GET /me/progress`, `POST /materials/:id/progress`).
 * - Set ini hanya mirror reaktif agar centang/lock konsisten antar halaman
 *   tanpa fetch ulang; setiap halaman memuat ulang dari server lalu
 *   memanggil `syncServerProgress`. Refresh = fetch ulang, tidak hilang.
 * - Tidak ada seed data statis, tidak ada tulis lokal tanpa server.
 */
export const doneMaterials = new SvelteSet<string>();

/** Tambahkan id selesai dari server (aditif; progres hanya bertambah). */
export function syncServerProgress(ids: Iterable<number | string>): void {
	for (const id of ids) doneMaterials.add(String(id));
}
