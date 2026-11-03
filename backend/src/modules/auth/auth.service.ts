import jwt, { SignOptions } from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import {
  emailVerificationPending,
  passwordResetOtps,
  users,
} from "../../db/schema";
import {
  generateOtpCode,
  getOtpCooldownSeconds,
  getOtpExpiresMinutes,
  getOtpMaxAttempts,
  hashOtpCode,
  isOtpExpired,
  otpExpiresAt,
  resendCooldownRemaining,
  verifyOtpCode,
} from "./otp.service";
import {
  sendPasswordResetEmail,
  sendVerificationEmail,
} from "../../utils/mailer";

export class AuthNotImplementedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthNotImplementedError";
  }
}

export interface AuthFieldError {
  field: string;
  message: string;
}

export class AuthValidationError extends Error {
  readonly errors: AuthFieldError[] | null;
  readonly httpStatus: number;

  constructor(
    message: string,
    errors: AuthFieldError[] | null = null,
    httpStatus = 400
  ) {
    super(message);
    this.name = "AuthValidationError";
    this.errors = errors;
    this.httpStatus = httpStatus;
  }
}

/** Kode mesin untuk login yang ditolak karena email belum diverifikasi. */
export const EMAIL_UNVERIFIED_CODE = "EMAIL_UNVERIFIED";

const toFieldErrors = (
  issues: Array<{ path: Array<string | number>; message: string }>
): AuthFieldError[] =>
  issues.map((issue) => ({
    field: issue.path.length > 0 ? String(issue.path[0]) : "body",
    message: issue.message,
  }));

const emailField = z
  .string()
  .trim()
  .email("Format email tidak valid")
  .max(191)
  .transform((value) => value.toLowerCase());

const registerSchema = z.object({
  name: z.string().trim().min(2, "Nama minimal 2 karakter").max(100),
  email: emailField,
  password: z.string().min(8, "Password minimal 8 karakter").max(72),
});

const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, "Password wajib diisi").max(72),
});

export const verifyEmailSchema = z.object({
  email: emailField,
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Kode OTP harus 6 digit angka"),
});

export const resendVerificationSchema = z.object({
  email: emailField,
});

export const forgotPasswordSchema = z.object({
  email: emailField,
});

export const resetPasswordSchema = z.object({
  email: emailField,
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Kode OTP harus 6 digit angka"),
  newPassword: z.string().min(8, "Password minimal 8 karakter").max(72),
});

const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET belum dikonfigurasi dengan aman");
  }

  return secret;
};

export const hashPassword = async (
  password: string
): Promise<string> => {
  return bcrypt.hash(password, 10);
};

export const verifyPassword = async (
  password: string,
  passwordHash: string
): Promise<boolean> => {
  return bcrypt.compare(password, passwordHash);
};

export const createAccessToken = (user: {
  id: string | number;
  email: string;
  role: string;
}): string => {
    const expiresIn: SignOptions["expiresIn"] =
        (process.env.JWT_EXPIRES_IN as SignOptions["expiresIn"]) || "15m";

    return jwt.sign(
        {
            sub: String(user.id),
            email: user.email,
            role: user.role,
        },
        getJwtSecret(),
        {
            expiresIn,
            issuer: "aristoteles-backend",
            audience: "aristoteles-client",
        }
);
};

/** Bentuk respons OTP sesuai kontrak frontend (`OtpRequestResult`). */
const otpResult = (email: string) => ({
  email,
  expiresInSeconds: getOtpExpiresMinutes() * 60,
  resendCooldownSeconds: getOtpCooldownSeconds(),
});

const requirePending = async (email: string) => {
  const rows = await db
    .select()
    .from(emailVerificationPending)
    .where(eq(emailVerificationPending.email, email))
    .limit(1);
  return rows[0] ?? null;
};

/**
 * Langkah 1 registrasi: simpan data sementara + kirim kode OTP.
 * Akun permanen BELUM dibuat di langkah ini (kontrak frontend).
 * Publik hanya boleh mendaftar sebagai student (K-01).
 */
export const registerUser = async (_input: unknown) => {
  const parsed = registerSchema.safeParse(_input);

  if (!parsed.success) {
    throw new AuthValidationError(
      "Data registrasi tidak valid",
      toFieldErrors(parsed.error.issues)
    );
  }

  const { name, email, password } = parsed.data;

  const existingUser = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existingUser.length > 0) {
    throw new AuthValidationError("Email sudah terdaftar", null, 409);
  }

  const pending = await requirePending(email);
  if (pending) {
    const remaining = resendCooldownRemaining(pending.lastSentAt);
    if (remaining > 0) {
      throw new AuthValidationError(
        `Kode sudah dikirim. Tunggu ${remaining} detik sebelum meminta kode baru.`,
        null,
        429
      );
    }
  }

  const code = generateOtpCode();
  const passwordHash = await hashPassword(password);
  const expiresAt = otpExpiresAt();
  const now = new Date();

  if (pending) {
    await db
      .update(emailVerificationPending)
      .set({
        name,
        passwordHash,
        codeHash: hashOtpCode(code),
        expiresAt,
        attempts: 0,
        lastSentAt: now,
      })
      .where(eq(emailVerificationPending.email, email));
  } else {
    await db.insert(emailVerificationPending).values({
      email,
      name,
      passwordHash,
      codeHash: hashOtpCode(code),
      expiresAt,
      attempts: 0,
      lastSentAt: now,
    });
  }

  try {
    await sendVerificationEmail(email, code);
  } catch (error) {
    console.error("Gagal mengirim email verifikasi:", error);
    throw new AuthValidationError(
      "Gagal mengirim kode verifikasi. Coba kirim ulang beberapa saat lagi.",
      null,
      500
    );
  }

  return {
    message: "Kode verifikasi telah dikirim ke email Anda",
    ...otpResult(email),
  };
};

/**
 * Langkah 2 registrasi: verifikasi kode OTP → buat akun permanen
 * dan terbitkan sesi/token (sama seperti login sukses).
 */
export const verifyEmail = async (_input: unknown) => {
  const parsed = verifyEmailSchema.safeParse(_input);

  if (!parsed.success) {
    throw new AuthValidationError(
      "Data verifikasi tidak valid",
      toFieldErrors(parsed.error.issues)
    );
  }

  const { email, code } = parsed.data;
  const pending = await requirePending(email);

  if (!pending) {
    throw new AuthValidationError(
      "Kode verifikasi tidak ditemukan. Minta kode baru lewat halaman verifikasi.",
      null,
      400
    );
  }

  if (isOtpExpired(pending.expiresAt)) {
    await db
      .delete(emailVerificationPending)
      .where(eq(emailVerificationPending.email, email));
    throw new AuthValidationError(
      "Kode verifikasi kedaluwarsa. Minta kode baru.",
      null,
      400
    );
  }

  if (pending.attempts >= getOtpMaxAttempts()) {
    await db
      .delete(emailVerificationPending)
      .where(eq(emailVerificationPending.email, email));
    throw new AuthValidationError(
      "Terlalu banyak percobaan salah. Minta kode baru.",
      null,
      429
    );
  }

  if (!verifyOtpCode(code, pending.codeHash)) {
    await db
      .update(emailVerificationPending)
      .set({ attempts: pending.attempts + 1 })
      .where(eq(emailVerificationPending.email, email));
    throw new AuthValidationError("Kode verifikasi salah.", null, 400);
  }

  const taken = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (taken.length > 0) {
    await db
      .delete(emailVerificationPending)
      .where(eq(emailVerificationPending.email, email));
    throw new AuthValidationError("Email sudah terdaftar", null, 409);
  }

  const created = await db.transaction(async (tx) => {
    const [h] = await tx.insert(users).values({
      name: pending.name,
      email: pending.email,
      passwordHash: pending.passwordHash,
      role: "student",
      emailVerifiedAt: new Date(),
      isActive: true,
    });
    const userId = Number((h as unknown as { insertId: number }).insertId);
    await tx
      .delete(emailVerificationPending)
      .where(eq(emailVerificationPending.email, email));
    return { userId, name: pending.name, email: pending.email };
  });

  const accessToken = createAccessToken({
    id: created.userId,
    email: created.email,
    role: "student",
  });

  return {
    message: "Email terverifikasi. Akun berhasil diaktifkan.",
    accessToken,
    user: {
      id: created.userId,
      name: created.name,
      email: created.email,
      role: "student" as const,
    },
  };
};

/** Kirim ulang kode OTP registrasi (cooldown + batas kirim). */
export const resendVerification = async (_input: unknown) => {
  const parsed = resendVerificationSchema.safeParse(_input);

  if (!parsed.success) {
    throw new AuthValidationError(
      "Data permintaan tidak valid",
      toFieldErrors(parsed.error.issues)
    );
  }

  const { email } = parsed.data;
  const pending = await requirePending(email);

  if (!pending) {
    throw new AuthValidationError(
      "Tidak ada permintaan verifikasi untuk email ini. Daftar ulang terlebih dahulu.",
      null,
      400
    );
  }

  const taken = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (taken.length > 0) {
    await db
      .delete(emailVerificationPending)
      .where(eq(emailVerificationPending.email, email));
    throw new AuthValidationError("Email sudah terdaftar", null, 409);
  }

  const remaining = resendCooldownRemaining(pending.lastSentAt);
  if (remaining > 0) {
    throw new AuthValidationError(
      `Tunggu ${remaining} detik sebelum meminta kode baru.`,
      null,
      429
    );
  }

  const code = generateOtpCode();
  await db
    .update(emailVerificationPending)
    .set({
      codeHash: hashOtpCode(code),
      expiresAt: otpExpiresAt(),
      attempts: 0,
      lastSentAt: new Date(),
    })
    .where(eq(emailVerificationPending.email, email));

  try {
    await sendVerificationEmail(email, code);
  } catch (error) {
    console.error("Gagal mengirim ulang email verifikasi:", error);
    throw new AuthValidationError(
      "Gagal mengirim kode verifikasi. Coba lagi beberapa saat lagi.",
      null,
      500
    );
  }

  return {
    message: "Kode verifikasi baru telah dikirim ke email Anda",
    ...otpResult(email),
  };
};

/**
 * Langkah 1 lupa password: minta kode OTP reset.
 * Selalu menjawab generik agar tidak membocorkan daftar email.
 */
export const requestPasswordReset = async (_input: unknown) => {
  const parsed = forgotPasswordSchema.safeParse(_input);

  if (!parsed.success) {
    // Tetap generik: jangan bocorkan validitas format ke enumerator.
    return {
      message:
        "Jika email terdaftar, kode reset telah dikirim. Periksa kotak masuk Anda.",
    };
  }

  const { email } = parsed.data;
  const account = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (account.length === 0) {
    return {
      message:
        "Jika email terdaftar, kode reset telah dikirim. Periksa kotak masuk Anda.",
    };
  }

  const existing = await db
    .select()
    .from(passwordResetOtps)
    .where(eq(passwordResetOtps.email, email))
    .limit(1);
  const row = existing[0];

  if (row && resendCooldownRemaining(row.lastSentAt) > 0) {
    return {
      message:
        "Jika email terdaftar, kode reset telah dikirim. Periksa kotak masuk Anda.",
    };
  }

  const code = generateOtpCode();
  const now = new Date();

  if (row) {
    await db
      .update(passwordResetOtps)
      .set({
        codeHash: hashOtpCode(code),
        expiresAt: otpExpiresAt(),
        attempts: 0,
        lastSentAt: now,
      })
      .where(eq(passwordResetOtps.email, email));
  } else {
    await db.insert(passwordResetOtps).values({
      email,
      codeHash: hashOtpCode(code),
      expiresAt: otpExpiresAt(),
      attempts: 0,
      lastSentAt: now,
    });
  }

  try {
    await sendPasswordResetEmail(email, code);
  } catch (error) {
    console.error("Gagal mengirim email reset password:", error);
  }

  return {
    message:
      "Jika email terdaftar, kode reset telah dikirim. Periksa kotak masuk Anda.",
  };
};

/**
 * Langkah 2 lupa password: kode OTP + password baru.
 * Sukses TIDAK auto-login — user wajib masuk ulang.
 */
export const resetPassword = async (_input: unknown) => {
  const parsed = resetPasswordSchema.safeParse(_input);

  if (!parsed.success) {
    throw new AuthValidationError(
      "Data reset password tidak valid",
      toFieldErrors(parsed.error.issues)
    );
  }

  const { email, code, newPassword } = parsed.data;
  // Pesan dibuat sama untuk semua kegagalan agar tidak membocorkan status.
  const genericFailure = new AuthValidationError(
    "Kode salah atau kedaluwarsa.",
    null,
    400
  );

  const rows = await db
    .select()
    .from(passwordResetOtps)
    .where(eq(passwordResetOtps.email, email))
    .limit(1);
  const row = rows[0];

  if (!row) throw genericFailure;

  if (isOtpExpired(row.expiresAt)) {
    await db
      .delete(passwordResetOtps)
      .where(eq(passwordResetOtps.email, email));
    throw genericFailure;
  }

  if (row.attempts >= getOtpMaxAttempts()) {
    await db
      .delete(passwordResetOtps)
      .where(eq(passwordResetOtps.email, email));
    throw genericFailure;
  }

  if (!verifyOtpCode(code, row.codeHash)) {
    await db
      .update(passwordResetOtps)
      .set({ attempts: row.attempts + 1 })
      .where(eq(passwordResetOtps.email, email));
    throw genericFailure;
  }

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ passwordHash: await hashPassword(newPassword) })
      .where(eq(users.email, email));
    await tx
      .delete(passwordResetOtps)
      .where(eq(passwordResetOtps.email, email));
  });

  return { message: "Password berhasil diganti. Masuk dengan password baru." };
};

export const loginUser = async (_input: unknown) => {
  const parsed = loginSchema.safeParse(_input);

  if (!parsed.success) {
    throw new AuthValidationError(
      "Data login tidak valid",
      toFieldErrors(parsed.error.issues)
    );
  }

  const { email, password } = parsed.data;

  // Cari user berdasarkan email
  const result = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  const user = result[0];

  // Akun dalam masa tunggu verifikasi (belum ada baris users):
  // arahkan ke /verify-email, bukan error buntu.
  if (!user) {
    const pending = await requirePending(email);
    if (pending && !isOtpExpired(pending.expiresAt)) {
      throw new AuthValidationError(
        "Email belum diverifikasi. Masukkan kode OTP yang dikirim ke email Anda.",
        [{ field: "email", message: EMAIL_UNVERIFIED_CODE }],
        403
      );
    }
    // Pesan dibuat sama agar tidak membocorkan email yang terdaftar
    throw new AuthValidationError("Email atau password salah");
  }

  // Akun nonaktif tidak dapat login (penegakan saat login; token lama
  // kedaluwarsa ≤15 menit sesuai JWT_EXPIRES_IN).
  if (user.isActive === false) {
    throw new AuthValidationError(
      "Akun Anda dinonaktifkan. Hubungi admin.",
      null,
      403
    );
  }

  // Verifikasi password dengan hash di database
  const isPasswordValid = await verifyPassword(
    password,
    user.passwordHash
  );

  if (!isPasswordValid) {
    throw new AuthValidationError("Email atau password salah");
  }

  // Akun lama yang belum menuntaskan verifikasi tidak dapat login
  // sampai kode OTP diverifikasi (kontrak EMAIL_UNVERIFIED frontend).
  if (!user.emailVerifiedAt) {
    throw new AuthValidationError(
      "Email belum diverifikasi. Masukkan kode OTP yang dikirim ke email Anda.",
      [{ field: "email", message: EMAIL_UNVERIFIED_CODE }],
      403
    );
  }

  const accessToken = createAccessToken({
    id: user.id,
    email: user.email,
    role: user.role,
  });

  return {
    message: "Login berhasil",
    accessToken,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  };
};
