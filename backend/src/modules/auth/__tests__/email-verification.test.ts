import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getTableConfig } from "drizzle-orm/mysql-core";
import {
  emailVerificationPending,
  passwordResetOtps,
  users,
} from "../../../db/schema";
import {
  generateOtpCode,
  hashOtpCode,
  isOtpExpired,
  otpExpiresAt,
  resendCooldownRemaining,
  verifyOtpCode,
} from "../otp.service";
import {
  registerSchema,
  resetPasswordSchema,
  resendVerificationSchema,
  verifyEmailSchema,
  verifyResetCodeSchema,
} from "../auth.service";

/**
 * Verifikasi email OTP — murni helper + skema + kolom Drizzle,
 * tanpa database dan tanpa server.
 */
describe("otp helpers", () => {
  it("generateOtpCode menghasilkan 6 digit angka", () => {
    for (let i = 0; i < 20; i++) {
      const code = generateOtpCode();
      assert.match(code, /^\d{6}$/);
    }
  });

  it("hash + verify cocok untuk kode benar, tolak kode salah", () => {
    const hash = hashOtpCode("123456");
    assert.equal(hash.length, 64);
    assert.ok(verifyOtpCode("123456", hash));
    assert.ok(!verifyOtpCode("654321", hash));
    assert.ok(!verifyOtpCode("123456", "0".repeat(64)));
  });

  it("otpExpiresAt 10 menit dari sekarang (default)", () => {
    const now = Date.now();
    const exp = otpExpiresAt(now);
    assert.equal(exp.getTime() - now, 10 * 60 * 1000);
  });

  it("isOtpExpired benar untuk masa lalu dan masa depan", () => {
    assert.ok(isOtpExpired(new Date(Date.now() - 1000)));
    assert.ok(!isOtpExpired(new Date(Date.now() + 60_000)));
  });

  it("resendCooldownRemaining 60 detik default lalu 0", () => {
    const now = Date.now();
    assert.equal(resendCooldownRemaining(new Date(now), now), 60);
    assert.equal(
      resendCooldownRemaining(new Date(now - 61_000), now),
      0
    );
  });
});

describe("auth OTP schemas (zod)", () => {
  it("verifyEmailSchema menerima email+kode 6 digit", () => {
    const r = verifyEmailSchema.safeParse({
      email: "User@Mail.com ",
      code: "123456",
    });
    assert.ok(r.success);
    if (r.success) assert.equal(r.data.email, "user@mail.com");
  });

  it("verifyEmailSchema menolak kode bukan 6 digit", () => {
    for (const code of ["12345", "1234567", "abcdef", " 12 34 "]) {
      assert.ok(
        !verifyEmailSchema.safeParse({ email: "a@b.co", code }).success,
        `kode ${code} harus ditolak`
      );
    }
  });

  it("resendVerificationSchema menolak email tidak valid", () => {
    assert.ok(!resendVerificationSchema.safeParse({ email: "bukan-email" }).success);
    assert.ok(
      resendVerificationSchema.safeParse({ email: "ok@mail.com" }).success
    );
  });

  it("resetPasswordSchema menolak password pendek", () => {
    assert.ok(
      !resetPasswordSchema.safeParse({
        email: "a@b.co",
        code: "123456",
        newPassword: "pendek",
      }).success
    );
    assert.ok(
      resetPasswordSchema.safeParse({
        email: "a@b.co",
        code: "123456",
        newPassword: "Katasandi123",
      }).success
    );
  });

  it("verifyResetCodeSchema menerima email+kode 6 digit, menolak selainnya", () => {
    assert.ok(
      verifyResetCodeSchema.safeParse({ email: "a@b.co", code: "123456" })
        .success
    );
    for (const code of ["12345", "1234567", "abcdef", ""]) {
      assert.ok(
        !verifyResetCodeSchema.safeParse({ email: "a@b.co", code }).success,
        `kode ${code} harus ditolak`
      );
    }
    assert.ok(
      !verifyResetCodeSchema.safeParse({ email: "bukan-email", code: "123456" })
        .success
    );
  });
});

describe("auth OTP tables (skema Drizzle)", () => {
  it("users.email_verified_at nullable (akun lama di-backfill migrasi)", () => {
    const config = getTableConfig(users);
    const col = config.columns.find((c) => c.name === "email_verified_at");
    assert.ok(col, "kolom email_verified_at harus ada di tabel users");
    assert.equal(col.notNull, false);
  });

  it("email_verification_pending ber-PK email + kolom OTP", () => {
    const config = getTableConfig(emailVerificationPending);
    const names = config.columns.map((c) => c.name);
    for (const n of [
      "email",
      "name",
      "username",
      "password_hash",
      "code_hash",
      "expires_at",
      "attempts",
      "last_sent_at",
    ]) {
      assert.ok(names.includes(n), `kolom ${n} harus ada`);
    }
    const pk = config.columns.find((c) => c.name === "email");
    assert.ok(pk?.primary, "email harus primary key");
  });

  it("users.username wajib unik (identitas patungan)", () => {
    const config = getTableConfig(users);
    const col = config.columns.find((c) => c.name === "username");
    assert.ok(col, "kolom username harus ada di tabel users");
    assert.equal(col.notNull, true);
  });

  it("password_reset_otps ber-PK email + kolom OTP", () => {
    const config = getTableConfig(passwordResetOtps);
    const names = config.columns.map((c) => c.name);
    for (const n of [
      "email",
      "code_hash",
      "expires_at",
      "attempts",
      "last_sent_at",
    ]) {
      assert.ok(names.includes(n), `kolom ${n} harus ada`);
    }
  });
});

describe("registerSchema username", () => {
  const base = { name: "Siswa Uji", email: "siswa@uji.io", password: "Katasandi123" };
  it("menerima username valid + normalisasi lowercase/trim", () => {
    const r = registerSchema.safeParse({ ...base, username: "  Budi.Santoso_9 " });
    assert.ok(r.success);
    if (r.success) assert.equal(r.data.username, "budi.santoso_9");
  });

  it("menolak username terlalu pendek/panjang/karakter liar", () => {
    for (const username of ["ab", "a".repeat(31), "budi santoso", "Budi!", "user@x"]) {
      assert.ok(
        !registerSchema.safeParse({ ...base, username }).success,
        `username ${username} harus ditolak`
      );
    }
  });

  it("menolak tanpa username", () => {
    assert.ok(!registerSchema.safeParse(base).success);
  });
});
