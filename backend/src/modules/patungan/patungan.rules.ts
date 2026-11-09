/**
 * Aturan murni patungan (tanpa DB) — dapat diuji unit.
 * 1 grup = 1 kursus, total anggota 2–15 termasuk pembuat,
 * iuran habis dibagi (jumlah = nominal kursus).
 */

/** Batas anggota per grup patungan (termasuk pembuat). */
export const PATUNGAN_MIN_MEMBERS = 2;
export const PATUNGAN_MAX_MEMBERS = 15;

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** Kode grup untuk tampilan (mis. PTG-7KQ2XA). */
export function buildGroupCode(): string {
  let rand = "";
  for (let i = 0; i < 6; i++) {
    rand += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return `PTG-${rand}`;
}

/**
 * Bagi nominal menjadi N iuran bilangan bulat yang jumlahnya pas.
 * Sisa pembagian dibebankan ke anggota awal (pembuat dulu).
 */
export function splitShares(totalNominal: number, memberCount: number): number[] {
  if (!Number.isInteger(totalNominal) || totalNominal <= 0) {
    throw new Error("Nominal harus bilangan bulat positif");
  }
  if (!Number.isInteger(memberCount) || memberCount < PATUNGAN_MIN_MEMBERS || memberCount > PATUNGAN_MAX_MEMBERS) {
    throw new Error(`Anggota harus ${PATUNGAN_MIN_MEMBERS}–${PATUNGAN_MAX_MEMBERS} orang`);
  }
  const base = Math.floor(totalNominal / memberCount);
  const remainder = totalNominal % memberCount;
  return Array.from({ length: memberCount }, (_, i) => base + (i < remainder ? 1 : 0));
}
