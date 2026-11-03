import nodemailer, { type Transporter } from "nodemailer";
import { z } from "zod";

/**
 * Pengiriman email via Nodemailer SMTP (satu-satunya pengirim asli):
 * OTP verifikasi, OTP reset password, dan undangan instruktur.
 *
 * Driver dipilih lewat `MAIL_PROVIDER`:
 * - `smtp` : SMTP via nodemailer (Gmail / Mailtrap / VPS).
 * - `log`  : cetak ke console (default dev bila SMTP belum diisi).
 *
 * Aturan port/secure yang ditegakkan (fail-fast, pesan Indonesia):
 * - Port 465  → `SMTP_SECURE=true`  (implicit TLS).
 * - Port 587/25 → `SMTP_SECURE=false` (STARTTLS).
 *
 * Gmail wajib memakai App Password 16 huruf + 2-Step Verification aktif
 * (password login biasa selalu ditolak Google). Spasi pada App Password
 * yang disalin dari popup Google otomatis dihapus.
 *
 * Rahasia (SMTP_PASS) hanya dibaca dari environment,
 * tidak pernah di-hardcode di sini dan tidak pernah dikembalikan ke klien.
 */

export type MailProvider = "smtp" | "log";

const booleanFromEnv = z.preprocess((value) => {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return undefined;
  const s = value.trim().toLowerCase();
  if (s === "true") return true;
  if (s === "false") return false;
  return value;
}, z.boolean());

const smtpEnvSchema = z
  .object({
    provider: z.preprocess(
      (value) => {
        if (typeof value !== "string") return value;
        const s = value.trim().toLowerCase();
        // Nilai lama (provider Resend sudah dihapus) — fallback otomatis.
        if (s === "resend") {
          console.warn(
            "[mailer] MAIL_PROVIDER=resend tidak didukung lagi; pakai smtp/log."
          );
          return undefined;
        }
        return s === "" ? undefined : s;
      },
      z.enum(["smtp", "log"]).optional()
    ),
    host: z.string().trim().max(255).optional(),
    port: z.coerce
      .number()
      .int("SMTP_PORT harus bilangan bulat")
      .min(1, "SMTP_PORT harus 1-65535")
      .max(65535, "SMTP_PORT harus 1-65535")
      .default(587),
    user: z.string().trim().max(320).optional(),
    // App Password Google ditampilkan "xxxx xxxx xxxx xxxx" — spasi dihapus.
    pass: z.preprocess(
      (value) => (typeof value === "string" ? value.replace(/\s+/g, "") : value),
      z.string().max(1024).optional()
    ),
    secure: booleanFromEnv.default(false),
    from: z.string().trim().max(320).optional(),
  })
  .superRefine((cfg, ctx) => {
    const wantsSmtp =
      cfg.provider === "smtp" || (!cfg.provider && !!cfg.host);
    if (cfg.provider === "smtp" || (!cfg.provider && (!!cfg.host || !!cfg.user))) {
      if (!cfg.host) {
        ctx.addIssue({
          code: "custom",
          path: ["SMTP_HOST"],
          message: "SMTP_HOST wajib diisi bila MAIL_PROVIDER=smtp",
        });
      }
      if (!cfg.user) {
        ctx.addIssue({
          code: "custom",
          path: ["SMTP_USER"],
          message: "SMTP_USER wajib diisi bila MAIL_PROVIDER=smtp",
        });
      }
    }
    if (!wantsSmtp) return;
    if (cfg.port === 465 && !cfg.secure) {
      ctx.addIssue({
        code: "custom",
        path: ["SMTP_SECURE"],
        message:
          "Port 465 wajib SMTP_SECURE=true (implicit TLS). Pasangan benar: 465+true, 587/25+false.",
      });
    } else if ((cfg.port === 587 || cfg.port === 25) && cfg.secure) {
      ctx.addIssue({
        code: "custom",
        path: ["SMTP_SECURE"],
        message:
          "Port 587/25 wajib SMTP_SECURE=false (STARTTLS). Pasangan benar: 465+true, 587/25+false.",
      });
    }
  });

export type SmtpConfig = z.infer<typeof smtpEnvSchema>;

/** Baca + validasi konfigurasi SMTP dari environment (fail-fast). */
export const getSmtpConfig = (): SmtpConfig => {
  const parsed = smtpEnvSchema.safeParse({
    provider: process.env.MAIL_PROVIDER,
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    secure: process.env.SMTP_SECURE,
    from: process.env.MAIL_FROM,
  });
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((i) => `${i.path.join(".") || "config"}: ${i.message}`)
      .join("; ");
    throw new Error(`Konfigurasi SMTP tidak valid — ${detail}`);
  }
  return parsed.data;
};

export const getMailProvider = (): MailProvider => {
  const cfg = getSmtpConfig();
  if (cfg.provider) return cfg.provider;
  // Default aman: bila SMTP terisi pakai SMTP, bila tidak pakai log.
  if (cfg.host) return "smtp";
  return "log";
};

export const getMailFrom = (): string => {
  const cfg = getSmtpConfig();
  return cfg.from || cfg.user || "ARISTOTELES <noreply@localhost>";
};

/**
 * Validasi konfigurasi email saat boot (fail-fast di production,
 * peringatan jelas di development). Mengubah risiko ".env belum diisi"
 * dari kegagalan diam-diam saat kirim menjadi pesan startup yang
 * bisa ditindaklanjuti — tanpa pernah mencetak rahasia.
 * Di production, SMTP dan FRONTEND_URL wajib benar: server menolak
 * start bila salah satunya belum diisi (tautan undangan yang salah
 * domain lebih buruk daripada deploy yang tertahan).
 */
export const checkMailEnvAtBoot = (): void => {
  const prod =
    (process.env.NODE_ENV || "development").trim().toLowerCase() === "production";
  try {
    const cfg = getSmtpConfig();
    if (prod && !cfg.host && cfg.provider !== "smtp") {
      throw new Error(
        "SMTP belum dikonfigurasi. Wajib di production: MAIL_PROVIDER=smtp + SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS (+ SMTP_SECURE=true bila port 465). Lihat backend/.env.example."
      );
    }
    if (!cfg.host) {
      console.warn(
        "[mail] SMTP belum diisi → mode log (email hanya dicetak ke console). Isi SMTP_* di backend/.env untuk pengiriman asli."
      );
    } else {
      console.log(`[mail] SMTP aktif (${cfg.host}:${cfg.port}, secure=${cfg.secure})`);
    }
    if (!process.env.FRONTEND_URL?.trim()) {
      if (prod) {
        throw new Error(
          "FRONTEND_URL wajib diisi di production (domain publik frontend, mis. https://domain-anda.id) agar tautan undangan di email benar. Lihat backend/.env.example."
        );
      }
      console.warn(
        "[mail] FRONTEND_URL kosong → tautan undangan fallback ke APP_URL/localhost (cukup untuk dev)."
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (prod) throw new Error(`[mail] ${message}`);
    console.warn(`[mail] ${message} → mode log sampai diperbaiki.`);
  }
};

const isGmailUser = (user: string | undefined): boolean =>
  !!user && /@(gmail|googlemail)\.com$/i.test(user.trim());

/** Peringatan App Password Gmail (tidak throw — provider lain bebas). */
const warnGmailAppPassword = (cfg: SmtpConfig): void => {
  if (!isGmailUser(cfg.user)) return;
  if ((cfg.pass ?? "").length !== 16) {
    console.warn(
      "[mailer] SMTP_USER Gmail terdeteksi tapi SMTP_PASS bukan 16 huruf. " +
        "Gmail menolak password login biasa — aktifkan 2-Step Verification lalu " +
        "buat App Password (Google Account → Keamanan → App passwords) dan isi " +
        "16 hurufnya ke SMTP_PASS."
    );
  }
};

let smtpTransport: Transporter | null = null;
let smtpTransportKey = "";

function getSmtpTransport(): Transporter {
  const cfg = getSmtpConfig();
  if (!cfg.host || !cfg.user) {
    throw new Error("SMTP_HOST/SMTP_USER belum dikonfigurasi");
  }
  warnGmailAppPassword(cfg);
  const key = JSON.stringify({
    h: cfg.host,
    p: cfg.port,
    u: cfg.user,
    w: cfg.pass ?? "",
    s: cfg.secure,
  });
  if (smtpTransport && smtpTransportKey === key) return smtpTransport;
  smtpTransport = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass ?? "" },
  });
  smtpTransportKey = key;
  return smtpTransport;
}

async function sendViaSmtp(
  to: string,
  subject: string,
  html: string
): Promise<void> {
  await getSmtpTransport().sendMail({ from: getMailFrom(), to, subject, html });
}

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const otpHtml = (title: string, intro: string, code: string): string => `
<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:16px">
  <h2 style="color:#1d4ed8;margin:0 0 8px">${escapeHtml(title)}</h2>
  <p style="color:#475569;font-size:14px">${escapeHtml(intro)}</p>
  <div style="font-size:32px;font-weight:bold;letter-spacing:8px;text-align:center;background:#eff6ff;border-radius:12px;padding:16px;margin:16px 0;color:#1e3a8a">${escapeHtml(code)}</div>
  <p style="color:#94a3b8;font-size:12px">Kode kedaluwarsa dalam 10 menit. Jangan bagikan ke siapa pun.</p>
</div>`;

const invitationHtml = (opts: {
  name: string | null;
  inviteUrl: string;
  expiresAt: Date;
}): string => {
  const greeting = opts.name ? `Halo ${opts.name},` : "Halo,";
  const expiry = opts.expiresAt.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return `
<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:16px">
  <h2 style="color:#1d4ed8;margin:0 0 8px">Undangan Instruktur ARISTOTELES</h2>
  <p style="color:#475569;font-size:14px">${escapeHtml(greeting)} Anda diundang sebagai instruktur ARISTOTELES. Buka tautan berikut untuk mengaktifkan akun dan mengatur password:</p>
  <p style="text-align:center;margin:20px 0"><a href="${escapeHtml(opts.inviteUrl)}" style="display:inline-block;background:#1d4ed8;color:#fff;text-decoration:none;font-weight:bold;font-size:14px;border-radius:12px;padding:12px 24px">Aktifkan Akun Instruktur</a></p>
  <p style="color:#475569;font-size:12px;word-break:break-all">${escapeHtml(opts.inviteUrl)}</p>
  <p style="color:#94a3b8;font-size:12px">Berlaku hingga ${escapeHtml(expiry)}. Tautan sekali pakai — jangan teruskan ke orang lain.</p>
</div>`;
};

export const sendVerificationEmail = async (
  to: string,
  code: string
): Promise<void> => {
  const subject = "Kode verifikasi ARISTOTELES";
  const html = otpHtml(
    "Verifikasi Email",
    "Masukkan kode 6 digit berikut untuk mengaktifkan akun ARISTOTELES Anda.",
    code
  );
  if (getMailProvider() === "smtp") {
    await sendViaSmtp(to, subject, html);
    return;
  }
  console.log(`[mailer:log] verification -> ${to}: ${code}`);
};

export const sendPasswordResetEmail = async (
  to: string,
  code: string
): Promise<void> => {
  const subject = "Kode reset password ARISTOTELES";
  const html = otpHtml(
    "Reset Password",
    "Masukkan kode 6 digit berikut beserta password baru Anda.",
    code
  );
  if (getMailProvider() === "smtp") {
    await sendViaSmtp(to, subject, html);
    return;
  }
  console.log(`[mailer:log] reset -> ${to}: ${code}`);
};

/**
 * Email uji konfigurasi (dipakai `npm run mail:check -- --to=...`).
 * Hanya jalan bila provider smtp; mode log menolak (tanpa sukses palsu).
 */
export const sendTestEmail = async (to: string): Promise<void> => {
  if (getMailProvider() !== "smtp") {
    throw new Error(
      "Mode log aktif — isi SMTP_* di backend/.env dulu sebelum tes kirim."
    );
  }
  const when = new Date().toLocaleString("id-ID");
  await sendViaSmtp(
    to,
    "Tes SMTP ARISTOTELES",
    `
<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:16px">
  <h2 style="color:#1d4ed8;margin:0 0 8px">SMTP Berfungsi</h2>
  <p style="color:#475569;font-size:14px">Email uji konfigurasi ARISTOTELES terkirim pada ${escapeHtml(when)}. OTP verifikasi, reset password, dan undangan instruktur akan memakai pengirim ini.</p>
</div>`
  );
};

/**
 * Email undangan instruktur (dipanggil service undangan setelah baris
 * undangan + audit tersimpan; token plaintext hanya ada di `inviteUrl`).
 */
export const sendInvitationEmail = async (
  to: string,
  opts: { name: string | null; inviteUrl: string; expiresAt: Date }
): Promise<void> => {
  const subject = "Undangan Instruktur ARISTOTELES";
  const html = invitationHtml(opts);
  if (getMailProvider() === "smtp") {
    await sendViaSmtp(to, subject, html);
    return;
  }
  console.log(`[mailer:log] invitation -> ${to}: ${opts.inviteUrl}`);
};
