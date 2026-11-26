/**
 * Cache GET dalam memori (SWR super-sederhana, opt-in per panggilan).
 *
 * Aturan main:
 * - Hanya untuk bacaan yang aman basi sekian detik (badge bell, katalog).
 *   JANGAN dipakai untuk polling status pembayaran, akses kursus, progres,
 *   atau data yang baru saja dimutasi di alur yang sama.
 * - Kunci dibedakan per situs panggil; panggil `invalidateCache(prefix)`
 *   setelah mutasi terkait, dan `clearCache()` saat logout/ganti akun.
 */
interface Entry {
	at: number;
	data: unknown;
}

const mem = new Map<string, Entry>();

export async function cachedGet<T>(key: string, ms: number, fn: () => Promise<T>): Promise<T> {
	const e = mem.get(key);
	if (e && Date.now() - e.at < Math.max(0, ms)) return e.data as T;
	const v = await fn();
	mem.set(key, { at: Date.now(), data: v });
	return v;
}

/** Hapus entri yang kuncinya diawali `prefix` (mis. 'bell:' setelah mutasi terkait). */
export function invalidateCache(prefix: string): void {
	for (const key of [...mem.keys()]) {
		if (key.startsWith(prefix)) mem.delete(key);
	}
}

/** Kosongkan seluruh cache (dipakai saat logout/ganti akun). */
export function clearCache(): void {
	mem.clear();
}
