import jwt, { SignOptions } from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { users } from "../../db/schema";


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

const toFieldErrors = (
  issues: Array<{ path: Array<string | number>; message: string }>
): AuthFieldError[] =>
  issues.map((issue) => ({
    field: issue.path.length > 0 ? String(issue.path[0]) : "body",
    message: issue.message,
  }));


const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(191).transform((value) =>
    value.toLowerCase()
  ),
  password: z.string().min(8).max(72),
});

const loginSchema = z.object({
  email: z.string().trim().email().max(191).transform((value) =>
    value.toLowerCase()
  ),
  password: z.string().min(1).max(72),
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

export const registerUser = async (_input: unknown) => {
  const parsed = registerSchema.safeParse(_input);

  if (!parsed.success) {
    throw new AuthValidationError(
      "Data registrasi tidak valid",
      toFieldErrors(parsed.error.issues)
    );
  }

  const { name, email, password } = parsed.data;

  // Cek apakah email sudah terdaftar
  const existingUser = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existingUser.length > 0) {
    throw new AuthValidationError("Email sudah terdaftar");
  }

  // Hash password sebelum disimpan
  const passwordHash = await hashPassword(password);

  // ID integer auto-increment dibuat oleh database (selaras id numerik frontend).
  const user = {
    name,
    email,
    passwordHash,
    role: "student" as const,
  };

  let userId: number;
  try {
    await db.insert(users).values(user);

    // Ambil ID auto-increment lewat email unik (kolom id numerik).
    const created = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!created[0]) {
      throw new Error("Gagal membaca ID pengguna baru");
    }
    userId = created[0].id;
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ER_DUP_ENTRY"
    ) {
      throw new AuthValidationError("Email sudah terdaftar");
    }

    throw error;
  }

  const accessToken = createAccessToken({
    id: userId,
    email: user.email,
    role: user.role,
  });

  return {
    message: "Registrasi berhasil",
    accessToken,
    user: {
      id: userId,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  };
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

  // Pesan dibuat sama agar tidak membocorkan email yang terdaftar
  if (!user) {
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

