import { z } from "zod";
import { and, eq, ne } from "drizzle-orm";
import { db } from "../../db";
import { auditLogs, files, users } from "../../db/schema";

/**
 * Profil milik sendiri (semua peran). Dibaca/diubah pemilik akun;
 * email + role tak dapat diubah dari sini (identitas & otorisasi).
 * Avatar = berkas kind=image milik sendiri (diunggah via POST /uploads).
 */

export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(2, "Nama minimal 2 karakter").max(100).optional(),
    username: z
      .string()
      .trim()
      .min(3, "Username minimal 3 karakter")
      .max(30)
      .toLowerCase()
      .regex(/^[a-z0-9_.-]+$/, "Username hanya huruf kecil, angka, _ . -")
      .optional(),
    phone: z
      .string()
      .trim()
      .max(30)
      .refine((v) => v === "" || /^[+\d][\d\s\-()]{5,29}$/.test(v), {
        message: "Format nomor telepon tidak valid",
      })
      .nullish(),
    gender: z.enum(["L", "P"]).nullish(),
    birthPlace: z.string().trim().max(100).nullish(),
    birthDate: z
      .string()
      .trim()
      .max(10)
      .refine(
        (v) => {
          if (v === "") return true; // dikosongkan → null di service
          if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
          const d = new Date(`${v}T00:00:00`);
          if (Number.isNaN(d.getTime())) return false;
          const now = new Date();
          const min = new Date("1900-01-01T00:00:00");
          return d <= now && d >= min;
        },
        { message: "Tanggal lahir tidak valid" }
      )
      .nullish(),
    avatarFileId: z.number().int().positive().nullish(),
    coverFileId: z.number().int().positive().nullish(),
  })
  .strict();

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export class ProfileError extends Error {
  readonly http: number;
  readonly code: string;
  constructor(http: number, code: string, message: string) {
    super(message);
    this.http = http;
    this.code = code;
  }
}

export interface PublicProfile {
  id: number;
  name: string;
  username: string;
  email: string;
  role: string;
  phone: string | null;
  gender: "L" | "P" | null;
  birthPlace: string | null;
  /** YYYY-MM-DD atau null. */
  birthDate: string | null;
  avatarFileId: number | null;
  /** URL konten avatar atau null (relatif server, absolutkan saat render). */
  avatarUrl: string | null;
  coverFileId: number | null;
  /** URL konten sampul atau null (relatif server). */
  coverUrl: string | null;
  emailVerified: boolean;
  createdAt: Date;
}

const emptyToNull = (v: string | null | undefined): string | null =>
  v === undefined || v === null || v.trim() === "" ? null : v.trim();

const toPublicProfile = (row: {
  id: number;
  name: string;
  username: string;
  email: string;
  role: string;
  phone: string | null;
  gender: "L" | "P" | null;
  birthPlace: string | null;
  birthDate: Date | null;
  avatarFileId: number | null;
  coverFileId: number | null;
  emailVerifiedAt: Date | null;
  createdAt: Date;
}): PublicProfile => ({
  id: row.id,
  name: row.name,
  username: row.username,
  email: row.email,
  role: row.role,
  phone: row.phone,
  gender: row.gender,
  birthPlace: row.birthPlace,
  birthDate: row.birthDate ? toISODate(row.birthDate) : null,
  avatarFileId: row.avatarFileId,
  avatarUrl: row.avatarFileId ? `/api/v1/files/${row.avatarFileId}/content` : null,
  coverFileId: row.coverFileId,
  coverUrl: row.coverFileId ? `/api/v1/files/${row.coverFileId}/content` : null,
  emailVerified: row.emailVerifiedAt !== null,
  createdAt: row.createdAt,
});

/** Date DB → YYYY-MM-DD (kontrak API stabil, bebas zona waktu). */
const toISODate = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

/** Profil milik sendiri (404 bila baris hilang — seharusnya tak terjadi). */
export const getMyProfile = async (userId: number): Promise<PublicProfile> => {
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      username: users.username,
      email: users.email,
      role: users.role,
      phone: users.phone,
      gender: users.gender,
      birthPlace: users.birthPlace,
      birthDate: users.birthDate,
      avatarFileId: users.avatarFileId,
      coverFileId: users.coverFileId,
      emailVerifiedAt: users.emailVerifiedAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!rows[0]) {
    throw new ProfileError(404, "USER_NOT_FOUND", "Akun tidak ditemukan");
  }
  return toPublicProfile(rows[0]);
};

/** Ubah profil milik sendiri (parsial; hanya kunci yang dikirim). */
export const updateMyProfile = async (
  userId: number,
  input: UpdateProfileInput
): Promise<PublicProfile> => {
  const patch: {
    name?: string;
    username?: string;
    phone?: string | null;
    gender?: "L" | "P" | null;
    birthPlace?: string | null;
    birthDate?: Date | null;
    avatarFileId?: number | null;
    coverFileId?: number | null;
  } = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.username !== undefined) {
    const clash = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.username, input.username), ne(users.id, userId)))
      .limit(1);
    if (clash[0]) {
      throw new ProfileError(409, "USERNAME_TAKEN", "Username sudah dipakai akun lain");
    }
    patch.username = input.username;
  }
  if (input.phone !== undefined) patch.phone = emptyToNull(input.phone);
  if (input.gender !== undefined) patch.gender = input.gender;
  if (input.birthPlace !== undefined) patch.birthPlace = emptyToNull(input.birthPlace);
  if (input.birthDate !== undefined) {
    patch.birthDate =
      input.birthDate === null || input.birthDate.trim() === ""
        ? null
        : new Date(`${input.birthDate}T00:00:00`);
  }
  if (input.avatarFileId !== undefined) {
    if (input.avatarFileId === null) {
      patch.avatarFileId = null;
    } else {
      // Avatar wajib berkas kind=avatar milik sendiri (anti rujuk file
      // kursus/tugas orang lain maupun aset teacher/admin).
      const f = await db
        .select({ id: files.id, ownerUserId: files.ownerUserId, kind: files.kind })
        .from(files)
        .where(eq(files.id, input.avatarFileId))
        .limit(1);
      if (!f[0] || f[0].kind !== "avatar" || f[0].ownerUserId !== userId) {
        throw new ProfileError(400, "INVALID_AVATAR", "Berkas avatar tidak valid");
      }
      patch.avatarFileId = input.avatarFileId;
    }
  }
  if (input.coverFileId !== undefined) {
    if (input.coverFileId === null) {
      patch.coverFileId = null;
    } else {
      // Sampul wajib berkas kind=profile_cover milik sendiri.
      const f = await db
        .select({ id: files.id, ownerUserId: files.ownerUserId, kind: files.kind })
        .from(files)
        .where(eq(files.id, input.coverFileId))
        .limit(1);
      if (!f[0] || f[0].kind !== "profile_cover" || f[0].ownerUserId !== userId) {
        throw new ProfileError(400, "INVALID_COVER", "Berkas sampul tidak valid");
      }
      patch.coverFileId = input.coverFileId;
    }
  }
  if (Object.keys(patch).length === 0) return getMyProfile(userId);

  await db.transaction(async (tx) => {
    await tx.update(users).set(patch).where(eq(users.id, userId));
    await tx.insert(auditLogs).values({
      actorUserId: userId,
      action: "profile.update",
      targetType: "user",
      targetIdInt: userId,
      metadata: { fields: Object.keys(patch) },
    });
  });
  // File avatar lama jadi yatim di disk (sengaja tak dihapus: mungkin dirujuk
  // riwayat; pengelola dapat bersih-bersih via modul uploads).
  return getMyProfile(userId);
};

/** Hapus avatar milik sendiri (jalan pintas null eksplisit). */
export const removeMyAvatar = async (userId: number): Promise<PublicProfile> =>
  updateMyProfile(userId, { avatarFileId: null });
