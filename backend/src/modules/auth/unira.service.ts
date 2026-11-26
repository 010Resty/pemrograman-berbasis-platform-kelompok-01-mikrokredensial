import { randomBytes } from "node:crypto";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "../../db";
import { userAuthProviders, users } from "../../db/schema";
import {
  AuthValidationError,
  createAccessToken,
  hashPassword,
} from "./auth.service";
import { issueRefreshToken } from "./refresh.service";
import { resolveAvatarUrl } from "../../utils/avatar";
import {
  extractUniraIdentity,
  fetchUniraProfile,
  getUniraConfig,
  requestUniraToken,
  type UniraProfile,
} from "./unira.client";

/**
 * Login with UNIRA (SIMAT) — backend-to-backend.
 * - Frontend kirim { username: NIM 10 digit, password } ke backend.
 * - Backend tukar ke UNIRA /v1/token (form-urlencoded), lalu verifikasi
 *   profil resmi (default /v1/saya) dengan Bearer token.
 * - JWT UNIRA tidak pernah dikirim ke frontend / disimpan permanen.
 * - Akun baru otomatis role student; role lama dipertahankan; akun
 *   nonaktif ditolak. Password SIMAT tidak disimpan / di-log.
 */

export const uniraLoginSchema = z.object({
  username: z
    .string()
    .trim()
    // Longgar di sini (8–15 digit): kebenaran NIM diputus server UNIRA,
    // bukan regex kita. Aturan 10-digit yang terlalu ketat sebelumnya
    // menolak input sebelum sempat diverifikasi ke kampus.
    .regex(/^\d{8,15}$/, "NIM harus 8–15 digit angka tanpa spasi/huruf"),
  password: z.string().min(1, "Password wajib diisi").max(256),
});

const sanitizeUsername = (nim: string): string => nim.trim();

const SYNTHETIC_EMAIL_DOMAIN = "@students.unira.ac.id";

/**
 * Profil darurat dari klaim token (hanya bila
 * UNIRA_ALLOW_UNVERIFIED_CLAIM_FALLBACK=true — percobaan berizin).
 * Token UNIRA teramati TIDAK memuat nama/email, jadi akun dibuat dengan
 * nama placeholder + email sintetis `<nim>@students.unira.ac.id`.
 * Saat endpoint profil resmi terkonfirmasi, akun ini di-backfill otomatis
 * (lihat tautan by-NIM di bawah) — bukan duplikat.
 */
const buildClaimFallbackProfile = (
  accessToken: string,
  nim: string
): UniraProfile | null => {
  const identity = extractUniraIdentity(accessToken, nim);
  if (!identity) return null;

  return {
    // CATATAN: dat.id teramati menanam jti sesi (`m<jti>h<nim>s`) sehingga
    // berubah tiap login — kunci dedup sesi-fallback adalah email sintetis
    // + tautan provider_username (NIM), bukan nilai ini semata.
    providerUserId: identity.stableId,
    nim: identity.nim,
    name: `Mahasiswa ${identity.nim}`,
    email: `${identity.nim}${SYNTHETIC_EMAIL_DOMAIN}`,
    prodi: identity.prodi,
    fakultas: null,
    status: null,
    photoUrl: null,
    raw: { fallback: "unverified-claim-trial", nim },
  };
};

const isSyntheticEmail = (email: string): boolean =>
  email.toLowerCase().endsWith(SYNTHETIC_EMAIL_DOMAIN);

/**
 * Sinkron foto SIMAT ke akun: upload manual (avatarFileId) selalu menang
 * dan tidak pernah ditimpa; selain itu isi/perbarui photoUrl bila berubah.
 */
const syncUniraPhoto = async (
  userId: number,
  currentFileId: number | null,
  currentPhoto: string | null,
  nextPhoto: string | null
): Promise<void> => {
  if (!nextPhoto || nextPhoto === currentPhoto) return;
  if (currentFileId !== null) return;
  await db.update(users).set({ photoUrl: nextPhoto }).where(eq(users.id, userId));
};

export const loginWithUnira = async (input: unknown) => {
  const parsed = uniraLoginSchema.safeParse(input);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => ({
      field: issue.path.length > 0 ? String(issue.path[0]) : "body",
      message: issue.message,
    }));
    throw new AuthValidationError("Data login tidak valid", issues, 400);
  }

  const nim = parsed.data.username;
  const password = parsed.data.password;

  // 1. Tukar kredensial ke token UNIRA (satu-satunya bukti auth ke kampus).
  const token = await requestUniraToken(nim, password);

  // 2. Verifikasi profil resmi. Wajib berhasil kecuali fallback eksperimen
  // diizinkan eksplisit via env (percobaan dengan izin dosen).
  let profile: UniraProfile;
  try {
    profile = await fetchUniraProfile(token.accessToken, nim);
  } catch (error) {
    const config = getUniraConfig();
    const fallback =
      config.allowClaimFallback
        ? buildClaimFallbackProfile(token.accessToken, nim)
        : null;
    if (fallback) {
      profile = fallback;
    } else {
      throw error;
    }
  }

  // Status akademik SIMAT (teramati: "aktif"). Tolak status yang jelas-jelas
  // non-aktif; status tak dikenal (cuti/lulus/dll) tetap diizinkan — penonaktifan
  // akun Aristoteles tetap lewat isActive + admin.
  const simatStatus = profile.status?.trim().toLowerCase() ?? null;
  if (
    simatStatus !== null &&
    [
      "nonaktif",
      "non-aktif",
      "tidak aktif",
      "keluar",
      "dropout",
      "drop out",
      "do",
      "diberhentikan",
      "dikeluarkan",
    ].includes(simatStatus)
  ) {
    throw new AuthValidationError(
      "Status akademik SIMAT tidak aktif",
      null,
      403
    );
  }

  // Normalisasi defensif: profil resmi wajib punya email+nama.
  if (!profile.email || !profile.name) {
    throw new AuthValidationError(
      "Identitas pengguna tidak dapat diverifikasi melalui UNIRA",
      null,
      502
    );
  }

  const username = sanitizeUsername(profile.nim);

  // 3. Cari atau buat akun lokal dalam transaksi (anti duplikat balapan).
  // Kasus A: provider sudah terhubung → pakai akun lama.
  const linked = await db
    .select()
    .from(userAuthProviders)
    .where(
      and(
        eq(userAuthProviders.provider, "unira"),
        eq(userAuthProviders.providerUserId, profile.providerUserId)
      )
    )
    .limit(1);

  let userId: number;

  if (linked.length > 0 && linked[0]) {
    userId = linked[0].userId;
    const rows = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    const existing = rows[0];
    if (!existing) {
      throw new AuthValidationError(
        "Akun ARISTOTELES dinonaktifkan",
        null,
        403
      );
    }
    if (existing.isActive === false) {
      throw new AuthValidationError(
        "Akun ARISTOTELES dinonaktifkan",
        null,
        403
      );
    }
    // Pertahankan role lama (Kasus E): jangan ubah role di sini.
    // Sinkron foto SIMAT (diabaikan bila user sudah upload manual).
    await syncUniraPhoto(
      existing.id,
      existing.avatarFileId,
      existing.photoUrl ?? null,
      profile.photoUrl
    );
    const accessToken = createAccessToken({
      id: existing.id,
      email: existing.email,
      role: existing.role,
    });
    const { token: refreshToken } = await issueRefreshToken(existing.id);
    return {
      message: "Login berhasil",
      accessToken,
      refreshToken,
      user: {
        id: existing.id,
        name: existing.name,
        username: existing.username,
        email: existing.email,
        role: existing.role,
        avatarUrl: resolveAvatarUrl(
          existing.avatarFileId,
          profile.photoUrl ?? existing.photoUrl ?? null,
          existing.id
        ),
      },
    };
  }

  // Tautan by-NIM (provider_username stabil): menangani dua hal —
  // (a) dat.id sesi-fallback berubah tiap login (`m<jti>h<nim>s`), dan
  // (b) migrasi akun trial (email sintetis) ke profil resmi saat endpoint
  // profil terkonfirmasi: email/nama di-backfill, tanpa akun duplikat.
  const byNimLink = await db
    .select()
    .from(userAuthProviders)
    .where(
      and(
        eq(userAuthProviders.provider, "unira"),
        eq(userAuthProviders.providerUsername, profile.nim)
      )
    )
    .limit(1);
  const nimLink = byNimLink[0];

  if (nimLink) {
    const rows = await db
      .select()
      .from(users)
      .where(eq(users.id, nimLink.userId))
      .limit(1);
    const nimUser = rows[0];
    if (!nimUser || nimUser.isActive === false) {
      throw new AuthValidationError(
        "Akun ARISTOTELES dinonaktifkan",
        null,
        403
      );
    }
    // Segarkan stable id sesi ini + backfill data resmi bila akun masih
    // memakai placeholder trial (email sintetis).
    const backfillName =
      !isSyntheticEmail(nimUser.email) ? nimUser.name : profile.name;
    const backfillEmail =
      !isSyntheticEmail(nimUser.email) &&
      nimUser.email.toLowerCase() !== profile.email.toLowerCase()
        ? nimUser.email
        : profile.email;
    // Foto SIMAT: isi bila kosong/berubah dan user belum upload manual.
    const backfillPhoto =
      nimUser.avatarFileId === null &&
      profile.photoUrl !== null &&
      profile.photoUrl !== nimUser.photoUrl
        ? profile.photoUrl
        : null;
    if (
      nimLink.providerUserId !== profile.providerUserId ||
      backfillEmail !== nimUser.email ||
      backfillName !== nimUser.name ||
      backfillPhoto !== null
    ) {
      try {
        await db.transaction(async (tx) => {
          await tx
            .update(userAuthProviders)
            .set({ providerUserId: profile.providerUserId })
            .where(eq(userAuthProviders.id, nimLink.id));
          if (
            backfillEmail !== nimUser.email ||
            backfillName !== nimUser.name ||
            backfillPhoto !== null
          ) {
            await tx
              .update(users)
              .set({
                name: backfillName.slice(0, 100),
                email: backfillEmail,
                ...(backfillPhoto !== null ? { photoUrl: backfillPhoto } : {}),
              })
              .where(eq(users.id, nimUser.id));
          }
        });
      } catch {
        // Email resmi bentrok dengan akun lain (UNIQUE) — lanjut dengan
        // data lama, jangan gagalkan login yang kredensialnya valid.
      }
    }
    const refreshed = (
      await db.select().from(users).where(eq(users.id, nimUser.id)).limit(1)
    )[0];
    const finalUser = refreshed ?? nimUser;
    const accessTokenNim = createAccessToken({
      id: finalUser.id,
      email: finalUser.email,
      role: finalUser.role,
    });
    const { token: refreshTokenNim } = await issueRefreshToken(finalUser.id);
    return {
      message: "Login berhasil",
      accessToken: accessTokenNim,
      refreshToken: refreshTokenNim,
      user: {
        id: finalUser.id,
        name: finalUser.name,
        username: finalUser.username,
        email: finalUser.email,
        role: finalUser.role,
        avatarUrl: resolveAvatarUrl(
          finalUser.avatarFileId,
          finalUser.photoUrl ?? null,
          finalUser.id
        ),
      },
    };
  }

  // Kasus C/E: email kampus sudah ada → hubungkan provider ke akun lama
  // (email terverifikasi via auth UNIRA + profil resmi), pertahankan role.
  const byEmail = await db
    .select()
    .from(users)
    .where(eq(users.email, profile.email))
    .limit(1);
  const existingByEmail = byEmail[0];

  if (existingByEmail) {
    if (existingByEmail.isActive === false) {
      throw new AuthValidationError(
        "Akun ARISTOTELES dinonaktifkan",
        null,
        403
      );
    }
    try {
      await db.insert(userAuthProviders).values({
        userId: existingByEmail.id,
        provider: "unira",
        providerUserId: profile.providerUserId,
        providerUsername: profile.nim,
      });
    } catch (error) {
      // Balapan dua login bersamaan: UNIQUE(provider, provider_user_id)
      // menolak yang kedua — baca ulang tautan lalu lanjut sebagai Kasus A.
      if (
        error !== null &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "ER_DUP_ENTRY"
      ) {
        const retry = await db
          .select()
          .from(userAuthProviders)
          .where(
            and(
              eq(userAuthProviders.provider, "unira"),
              eq(userAuthProviders.providerUserId, profile.providerUserId)
            )
          )
          .limit(1);
        const row = retry[0];
        if (!row) {
          throw new AuthValidationError(
            "Terjadi kesalahan internal",
            null,
            500
          );
        }
        userId = row.userId;
        const rows = await db
          .select()
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);
        const user = rows[0];
        if (!user || user.isActive === false) {
          throw new AuthValidationError(
            "Akun ARISTOTELES dinonaktifkan",
            null,
            403
          );
        }
        const accessToken = createAccessToken({
          id: user.id,
          email: user.email,
          role: user.role,
        });
        const { token: refreshToken } = await issueRefreshToken(user.id);
        return {
          message: "Login berhasil",
          accessToken,
          refreshToken,
          user: {
            id: user.id,
            name: user.name,
            username: user.username,
            email: user.email,
            role: user.role,
            avatarUrl: resolveAvatarUrl(user.avatarFileId, user.photoUrl ?? null, user.id),
          },
        };
      }
      throw error;
    }
    // Sinkron foto SIMAT (diabaikan bila akun sudah punya upload manual).
    await syncUniraPhoto(
      existingByEmail.id,
      existingByEmail.avatarFileId,
      existingByEmail.photoUrl ?? null,
      profile.photoUrl
    );
    const accessToken = createAccessToken({
      id: existingByEmail.id,
      email: existingByEmail.email,
      role: existingByEmail.role,
    });
    const { token: refreshToken } = await issueRefreshToken(
      existingByEmail.id
    );
    return {
      message: "Login berhasil",
      accessToken,
      refreshToken,
      user: {
        id: existingByEmail.id,
        name: existingByEmail.name,
        username: existingByEmail.username,
        email: existingByEmail.email,
        role: existingByEmail.role,
        avatarUrl: resolveAvatarUrl(
          existingByEmail.avatarFileId,
          profile.photoUrl ?? existingByEmail.photoUrl ?? null,
          existingByEmail.id
        ),
      },
    };
  }

  // Kasus B: buat akun baru role student + relasi provider (transaksi).
  const unusableHash = await hashPassword(
    randomBytes(32).toString("hex") + Date.now().toString(36)
  );

  // Pastikan username unik (NIM pada umumnya bebas; bila tabrakan, tambah sufiks).
  let finalUsername = username;
  const usernameTaken = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, finalUsername))
    .limit(1);
  if (usernameTaken.length > 0) {
    const suffix = randomBytes(2).toString("hex");
    finalUsername = `${username}_${suffix}`.slice(0, 30);
  }

  try {
    const created = await db.transaction(async (tx) => {
      const [inserted] = await tx.insert(users).values({
        name: profile.name.slice(0, 100),
        username: finalUsername,
        email: profile.email,
        passwordHash: unusableHash,
        role: "student",
        emailVerifiedAt: new Date(),
        isActive: true,
        photoUrl: profile.photoUrl,
      });
      const newUserId = Number(
        (inserted as unknown as { insertId: number }).insertId
      );
      await tx.insert(userAuthProviders).values({
        userId: newUserId,
        provider: "unira",
        providerUserId: profile.providerUserId,
        providerUsername: profile.nim,
      });
      return { userId: newUserId };
    });
    userId = created.userId;
  } catch (error) {
    if (
      error !== null &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ER_DUP_ENTRY"
    ) {
      throw new AuthValidationError(
        "Akun sudah terdaftar. Coba masuk kembali.",
        null,
        409
      );
    }
    throw error;
  }

  const rows = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const user = rows[0];
  if (!user) {
    throw new AuthValidationError("Terjadi kesalahan internal", null, 500);
  }

  const accessToken = createAccessToken({
    id: user.id,
    email: user.email,
    role: user.role,
  });
  const { token: refreshToken } = await issueRefreshToken(user.id);

  // Jangan kembalikan profil mentah UNIRA / token kampus ke frontend.

  return {
    message: "Login berhasil",
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      role: user.role,
      avatarUrl: resolveAvatarUrl(user.avatarFileId, user.photoUrl ?? null, user.id),
    },
  };
};
