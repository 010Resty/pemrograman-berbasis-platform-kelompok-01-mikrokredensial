/**
 * Helper srcset untuk gambar backend — murni, tanpa dependensi SvelteKit,
 * sehingga dapat diuji dengan `node --test`.
 *
 * Backend menyajikan varian responsif via `GET /api/v1/files/:id/content?w=...`
 * (varian terkecil yang >= lebar diminta, jatuh ke berkas asli bila tak ada).
 * Helper ini hanya MEMBANGUN string srcset; pemilihan varian tetap di server.
 */

export const DEFAULT_SRCSET_WIDTHS = [480, 800, 1200] as const;

/** Saring lebar kandidat: bulat positif ≤4000, unik, menaik. */
export function normalizeWidths(widths: readonly number[]): number[] {
  const out = [...new Set(widths)].filter(
    (w) => Number.isInteger(w) && w > 0 && w <= 4000
  );
  out.sort((a, b) => a - b);
  return out;
}

/**
 * Bangun atribut `srcset` dari URL absolut berkas backend.
 * Kembalikan null bila URL kosong/bukan string — caller memakai `src` polos.
 * Catatan: URL absolut WAJIB dibentuk via `fileUrl()` sebelum masuk sini
 * (modul ini sengaja tidak mengimpor env agar tetap testable).
 */
export function buildSrcSet(
  absoluteBaseUrl: string | null | undefined,
  widths: readonly number[] = DEFAULT_SRCSET_WIDTHS
): string | null {
  if (!absoluteBaseUrl || typeof absoluteBaseUrl !== "string") return null;
  const raw = absoluteBaseUrl.trim();
  if (!raw) return null;
  // Hanya berkas backend milik sendiri yang punya varian ?w=.
  // URL luar/relatif lain dibiarkan apa adanya (pakai src polos).
  if (!raw.includes("/api/v1/files/")) return null;
  const valid = normalizeWidths(widths);
  if (valid.length === 0) return null;
  const clean = raw.split("?")[0];
  if (!clean) return null;
  return valid.map((w) => `${clean}?w=${w} ${w}w`).join(", ");
}
