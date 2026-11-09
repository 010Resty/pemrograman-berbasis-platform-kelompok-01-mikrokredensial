import { eq } from "drizzle-orm";
import { db } from "../db";
import { users } from "../db/schema";

type DbLike = typeof db;

/**
 * Username publik: identitas unik untuk fitur sosial (anggota patungan).
 * Format: 3–30 karakter, huruf kecil, angka, titik, underscore, strip.
 */
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 30;
const USERNAME_PATTERN = /^[a-z0-9._-]{3,30}$/;

/** Normalisasi input: trim + lowercase (perbandingan selalu case-insensitive). */
export const normalizeUsername = (value: string): string => value.trim().toLowerCase();

/** Validasi format (murni, tanpa DB — dapat diuji unit). */
export const isValidUsername = (value: string): boolean => USERNAME_PATTERN.test(value);

/**
 * Alokasi username unik dari basis bebas (nama/email pendaftar jalur
 * undangan/admin yang tidak memilih username sendiri). Murni transliterasi
 * + suffix angka anti-tabrakan; pemanggil yang mewajibkan format ketat
 * (register) memakai `isValidUsername` + cek eksplisit, bukan fungsi ini.
 */
export const allocateUsername = async (adb: DbLike, base: string): Promise<string> => {
  const clean =
    base
      .trim()
      .toLowerCase()
      .replace(/[\s@]+/g, ".")
      .replace(/[^a-z0-9._-]/g, "")
      .replace(/^[._-]+|[._-]+$/g, "")
      .slice(0, 24) || "user";
  for (let attempt = 0; attempt < 100; attempt++) {
    const candidate = attempt === 0 ? clean : `${clean}-${attempt + 1}`.slice(0, 30);
    const rows = await adb.select({ id: users.id }).from(users).where(eq(users.username, candidate)).limit(1);
    if (!rows[0]) return candidate;
  }
  throw new Error("Gagal mengalokasi username unik");
};
