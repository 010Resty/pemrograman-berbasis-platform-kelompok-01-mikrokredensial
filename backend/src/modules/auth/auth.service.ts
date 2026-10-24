import jwt, { SignOptions } from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { z } from "zod";


export class AuthNotImplementedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthNotImplementedError";
  }
}

export class AuthValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthValidationError";
  }
}


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
  return bcrypt.hash(password, 12);
};

export const verifyPassword = async (
  password: string,
  passwordHash: string
): Promise<boolean> => {
  return bcrypt.compare(password, passwordHash);
};

export const createAccessToken = (user: {
  id: number;
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
    throw new AuthValidationError("Data registrasi tidak valid");
  }

  throw new AuthNotImplementedError(
    "Registrasi belum tersedia: penyimpanan akun belum dikonfigurasi"
  );
};

export const loginUser = async (_input: unknown) => {
  const parsed = loginSchema.safeParse(_input);

  if (!parsed.success) {
    throw new AuthValidationError("Data login tidak valid");
  }

  throw new AuthNotImplementedError(
    "Login belum tersedia: penyimpanan akun belum dikonfigurasi"
  );
};
