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

const unauthorized = () =>
  new AuthValidationError("Sesi berakhir. Masuk kembali.", null, 401);

/**
 * Rotasi: tukar refresh token valid dengan pasangan sesi baru.
 * Token lama langsung dicabut (tidak bisa dipakai dua kali).
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
    // Pakai ulang token yang sudah dicabut → cabut seluruh sesi user.
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(refreshTokens.userId, row.userId),
          isNull(refreshTokens.revokedAt)
        )
      );
    throw unauthorized();
  }

  if (row.expiresAt.getTime() <= Date.now()) {
    await db.delete(refreshTokens).where(eq(refreshTokens.id, row.id));
    throw unauthorized();
  }

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
    .where(eq(users.id, row.userId))
    .limit(1);
  const user = account[0];
  if (!user || user.isActive === false) {
    await db.delete(refreshTokens).where(eq(refreshTokens.id, row.id));
    throw unauthorized();
  }

  const issued = await db.transaction(async (tx) => {
    await tx
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.id, row.id));
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(
      Date.now() + getRefreshExpiresDays() * 86_400_000
    );
    await tx.insert(refreshTokens).values({
      userId: user.id,
      tokenHash: hashRefreshToken(token),
      expiresAt,
    });
    return { token, expiresAt };
  });

  return {
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
  };
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
