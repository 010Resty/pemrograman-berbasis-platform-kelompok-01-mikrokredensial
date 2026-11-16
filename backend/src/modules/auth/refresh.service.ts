import { createHash, randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db";
import { refreshTokens, users } from "../../db/schema";
import {
  AuthValidationError,
  createAccessToken,
} from "./auth.service";

/**
 * Sesi refresh untuk klien mobile (Flutter, online-only).
 * - Token opaque acak (bukan JWT), hanya hash SHA-256 yang disimpan.
 * - Sekali pakai: setiap `refresh` menerbitkan token baru + mencabut yang lama.
 * - Deteksi pakai-ulang: token yang sudah dicabut dipakai lagi → seluruh
 *   sesi refresh user dicabut (indikasi pencurian token).
 */

export const refreshSchema = z.object({
  refreshToken: z.string().trim().min(1).max(500),
});

export const logoutSchema = z.object({
  refreshToken: z.string().trim().min(1).max(500).optional(),
});

export const getRefreshExpiresDays = (): number => {
  const raw = Number(process.env.REFRESH_EXPIRES_DAYS ?? "30");
  if (!Number.isFinite(raw) || raw <= 0) return 30;
  return Math.floor(raw);
};

export const hashRefreshToken = (token: string): string =>
  createHash("sha256").update(token, "utf8").digest("hex");

/** Terbitkan satu sesi refresh baru untuk user. Token plaintext sekali saja. */
export const issueRefreshToken = async (
  userId: number
): Promise<{ token: string; expiresAt: Date }> => {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(
    Date.now() + getRefreshExpiresDays() * 86_400_000
  );
  await db.insert(refreshTokens).values({
    userId,
    tokenHash: hashRefreshToken(token),
    expiresAt,
  });
  return { token, expiresAt };
};

export const getReuseGraceMs = (): number => {
  const raw = Number(process.env.REFRESH_REUSE_GRACE_MS ?? "60000");
  if (!Number.isFinite(raw) || raw < 0) return 60000;
  return Math.floor(raw);
};

const unauthorized = () =>
  new AuthValidationError("Sesi berakhir. Masuk kembali.", null, 401);

/** Cabut seluruh sesi refresh aktif milik user (respons pencurian token). */
const revokeAllUserSessions = async (userId: number): Promise<void> => {
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)));
};

type RefreshRow = typeof refreshTokens.$inferSelect;

interface RefreshAccount {
  id: number;
  name: string;
  username: string;
  email: string;
  role: string;
  avatarFileId: number | null;
  isActive: boolean;
}

const loadActiveAccount = async (userId: number): Promise<RefreshAccount | null> => {
  const account = await db
    .select({
      id: users.id,
      name: users.name,
      username: users.username,
      email: users.email,
      role: users.role,
      avatarFileId: users.avatarFileId,
      isActive: users.isActive,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const user = account[0];
  if (!user || user.isActive === false) return null;
  return user;
};

const buildRefreshResponse = (
  user: RefreshAccount,
  issued: { token: string; expiresAt: Date }
) => ({
  message: "Sesi diperpanjang",
  accessToken: createAccessToken({
    id: user.id,
    email: user.email,
    role: user.role,
  }),
  refreshToken: issued.token,
  refreshExpiresAt: issued.expiresAt.toISOString(),
  user: {
    id: user.id,
    name: user.name,
    username: user.username,
    email: user.email,
    role: user.role,
    avatarUrl: user.avatarFileId
      ? `/api/v1/files/${user.avatarFileId}/content`
      : null,
  },
});

/**
 * Putar token hidup menjadi pasangan baru (atomik: cabut lama + catat
 * penerus + terbitkan baru). Penerus dicatat agar pakai-ulang balapan
 * dalam grace window dapat diputar lagi, bukan dianggap pencurian.
 */
const rotateLiveToken = async (row: RefreshRow, user: RefreshAccount) => {
  const issued = await db.transaction(async (tx) => {
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(
      Date.now() + getRefreshExpiresDays() * 86_400_000
    );
    await tx
      .update(refreshTokens)
      .set({ revokedAt: new Date(), replacedByTokenHash: hashRefreshToken(token) })
      .where(eq(refreshTokens.id, row.id));
    await tx.insert(refreshTokens).values({
      userId: user.id,
      tokenHash: hashRefreshToken(token),
      expiresAt,
    });
    return { token, expiresAt };
  });
  return buildRefreshResponse(user, issued);
};

/**
 * Penerus yang sah untuk pakai-ulang dalam grace window.
 * Berjalan menyusuri rantai pengganti (maks 10 lompatan) selama tiap tautan
 * dicabut dalam grace window: ini menyelamatkan balapan N tab/klien
 * (tab ketiga memakai T1 saat rantai sudah T1→T2→T3 tetap diputar).
 * Rantai basi/terputus = pencurian → null.
 */
const MAX_GRACE_HOPS = 10;

const findGraceSuccessor = async (row: RefreshRow): Promise<RefreshRow | null> => {
  let current = row;
  for (let hop = 0; hop < MAX_GRACE_HOPS; hop++) {
    if (!current.replacedByTokenHash || !current.revokedAt) return null;
    if (current.revokedAt.getTime() + getReuseGraceMs() <= Date.now()) return null;
    const rows = await db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, current.replacedByTokenHash))
      .limit(1);
    const succ = rows[0];
    if (!succ || succ.userId !== row.userId) return null;
    if (!succ.revokedAt) {
      if (succ.expiresAt.getTime() <= Date.now()) return null;
      return succ;
    }
    current = succ; // lanjut satu lompatan
  }
  return null;
};

/**
 * Rotasi: tukar refresh token valid dengan pasangan sesi baru.
 * Token lama langsung dicabut (tidak bisa dipakai dua kali), kecuali
 * pakai-ulang balapan dalam grace window singkat yang diputar dari
 * token penerus (kasus web + Android refresh bersamaan).
 */
export const rotateRefreshToken = async (presented: string) => {
  const rows = await db
    .select()
    .from(refreshTokens)
    .where(eq(refreshTokens.tokenHash, hashRefreshToken(presented.trim())))
    .limit(1);
  const row = rows[0];
  if (!row) throw unauthorized();

  if (row.revokedAt) {
    const successor = await findGraceSuccessor(row);
    if (successor) {
      const user = await loadActiveAccount(successor.userId);
      if (user && successor.expiresAt.getTime() > Date.now()) {
        return rotateLiveToken(successor, user);
      }
    }
    // Pakai ulang token basi/logout di luar grace = pencurian:
    // cabut seluruh sesi refresh user.
    await revokeAllUserSessions(row.userId);
    throw unauthorized();
  }

  if (row.expiresAt.getTime() <= Date.now()) {
    await db.delete(refreshTokens).where(eq(refreshTokens.id, row.id));
    throw unauthorized();
  }

  const user = await loadActiveAccount(row.userId);
  if (!user) {
    await db.delete(refreshTokens).where(eq(refreshTokens.id, row.id));
    throw unauthorized();
  }

  return rotateLiveToken(row, user);
};

/**
 * Cabut sesi refresh: satu token bila diberikan (harus milik user),
 * atau seluruh sesi user bila tanpa token.
 */
export const revokeRefreshTokens = async (
  userId: number,
  presented?: string
): Promise<number> => {
  if (presented !== undefined) {
    const rows = await db
      .select({ id: refreshTokens.id, userId: refreshTokens.userId })
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, hashRefreshToken(presented.trim())))
      .limit(1);
    const row = rows[0];
    if (!row || row.userId !== userId) return 0;
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.id, row.id));
    return 1;
  }
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt))
    );
  return 1;
};
