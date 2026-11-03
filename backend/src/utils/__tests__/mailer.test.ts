import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  checkMailEnvAtBoot,
  getMailFrom,
  getMailProvider,
  getSmtpConfig,
  sendInvitationEmail,
  sendPasswordResetEmail,
  sendVerificationEmail,
} from "../mailer";

/**
 * Validasi konfigurasi SMTP Nodemailer — murni env + zod,
 * tanpa jaringan dan tanpa database.
 */

const KEYS = [
  "MAIL_PROVIDER",
  "MAIL_FROM",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASS",
  "SMTP_SECURE",
  "FRONTEND_URL",
  "NODE_ENV",
] as const;

let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = {};
  for (const k of KEYS) saved[k] = process.env[k];
  for (const k of KEYS) delete process.env[k];
});

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe("smtp provider", () => {
  it("default tanpa SMTP adalah log", () => {
    assert.equal(getMailProvider(), "log");
  });

  it("SMTP_HOST terisi otomatis jadi smtp", () => {
    process.env.SMTP_HOST = "smtp.gmail.com";
    process.env.SMTP_USER = "a@gmail.com";
    assert.equal(getMailProvider(), "smtp");
  });

  it("MAIL_PROVIDER=smtp tanpa host/user langsung gagal jelas", () => {
    process.env.MAIL_PROVIDER = "smtp";
    assert.throws(() => getSmtpConfig(), /SMTP_HOST/);
  });

  it("nilai lama resend fallback tanpa throw", () => {
    process.env.MAIL_PROVIDER = "resend";
    assert.equal(getMailProvider(), "log");
  });
});

describe("pasangan port/secure", () => {
  it("465 + secure=false ditolak", () => {
    process.env.MAIL_PROVIDER = "smtp";
    process.env.SMTP_HOST = "smtp.gmail.com";
    process.env.SMTP_USER = "a@gmail.com";
    process.env.SMTP_PORT = "465";
    process.env.SMTP_SECURE = "false";
    assert.throws(() => getSmtpConfig(), /465.*true|SMTP_SECURE/);
  });

  it("587 + secure=true ditolak", () => {
    process.env.MAIL_PROVIDER = "smtp";
    process.env.SMTP_HOST = "smtp.gmail.com";
    process.env.SMTP_USER = "a@gmail.com";
    process.env.SMTP_PORT = "587";
    process.env.SMTP_SECURE = "true";
    assert.throws(() => getSmtpConfig(), /587.*false|SMTP_SECURE/);
  });

  it("465 + secure=true diterima", () => {
    process.env.MAIL_PROVIDER = "smtp";
    process.env.SMTP_HOST = "smtp.gmail.com";
    process.env.SMTP_USER = "a@gmail.com";
    process.env.SMTP_PORT = "465";
    process.env.SMTP_SECURE = "true";
    assert.equal(getMailProvider(), "smtp");
    assert.equal(getSmtpConfig().port, 465);
    assert.equal(getSmtpConfig().secure, true);
  });

  it("587 + secure=false diterima", () => {
    process.env.SMTP_HOST = "smtp.gmail.com";
    process.env.SMTP_USER = "a@gmail.com";
    const cfg = getSmtpConfig();
    assert.equal(cfg.port, 587);
    assert.equal(cfg.secure, false);
  });
});

describe("gmail app password", () => {
  it("spasi pada App Password dihapus normalisasi", () => {
    process.env.SMTP_HOST = "smtp.gmail.com";
    process.env.SMTP_USER = "a@gmail.com";
    process.env.SMTP_PASS = "abcd abcd abcd abcd";
    assert.equal(getSmtpConfig().pass, "abcdabcdabcdabcd");
  });

  it("MAIL_FROM kosong fallback ke SMTP_USER", () => {
    process.env.SMTP_HOST = "smtp.gmail.com";
    process.env.SMTP_USER = "a@gmail.com";
    assert.equal(getMailFrom(), "a@gmail.com");
  });
});

describe("mode log tidak melempar", () => {
  it("ketiga pengirim log resolve", async () => {
    await sendVerificationEmail("t@t.id", "123456");
    await sendPasswordResetEmail("t@t.id", "654321");
    await sendInvitationEmail("t@t.id", {
      name: "Guru",
      inviteUrl: "http://localhost:5173/invite/abc",
      expiresAt: new Date(Date.now() + 86400000),
    });
  });
});

describe("cek boot", () => {
  it("dev tanpa apa pun lolos (peringatan saja)", () => {
    process.env.NODE_ENV = "development";
    checkMailEnvAtBoot();
  });

  it("production tanpa SMTP menolak start", () => {
    process.env.NODE_ENV = "production";
    assert.throws(() => checkMailEnvAtBoot(), /SMTP/);
  });

  it("production SMTP valid tapi FRONTEND_URL kosong menolak start", () => {
    process.env.NODE_ENV = "production";
    process.env.MAIL_PROVIDER = "smtp";
    process.env.SMTP_HOST = "smtp.gmail.com";
    process.env.SMTP_USER = "a@gmail.com";
    process.env.SMTP_PASS = "abcdabcdabcdabcd";
    assert.throws(() => checkMailEnvAtBoot(), /FRONTEND_URL/);
  });

  it("production lengkap lolos tanpa melempar", () => {
    process.env.NODE_ENV = "production";
    process.env.MAIL_PROVIDER = "smtp";
    process.env.SMTP_HOST = "smtp.gmail.com";
    process.env.SMTP_USER = "a@gmail.com";
    process.env.SMTP_PASS = "abcdabcdabcdabcd";
    process.env.FRONTEND_URL = "https://domain-anda.id";
    checkMailEnvAtBoot();
  });
});
