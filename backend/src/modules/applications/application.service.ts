import { randomBytes } from "node:crypto";
import { z } from "zod";
import { and, desc, eq, like, or, sql } from "drizzle-orm";
import { db } from "../../db";
import { auditLogs, files, instructorApplications, users } from "../../db/schema";
import {
  UploadValidationError,
  deleteFileById,
  saveUpload,
} from "../uploads/upload.service";
import { buildInviteUrl, insertInvitationRow, trySendInvitation } from "../invitations/invitation.service";

export class ApplicationError extends Error {
  readonly http: number;
  readonly code: string;
  readonly fieldErrors: Array<{ field: string; message: string }> | null;

  constructor(
    http: number,
    code: string,
    message: string,
    fieldErrors: Array<{ field: string; message: string }> | null = null
  ) {
    super(message);
    this.http = http;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

export const APPLICATION_STATUSES = [
  "submitted",
  "under_review",
  "approved",
  "rejected",
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

// ---------- Skema input (nama kolom request mengikuti kontrak frontend:
//    { nama, email, tentang, skill, ... + file foto/CV } ----------

const emailField = z
  .string()
  .trim()
  .email("Format email tidak valid")
  .max(191)
  .transform((value) => value.toLowerCase());

const hostOf = (value: string): string | null => {
  try {
    const u = new URL(value.trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
};

const youtubeField = z
  .string()
  .trim()
  .max(500)
  .optional()
  .refine(
    (v) => {
      if (!v) return true;
      const host = hostOf(v);
      return (
        host !== null &&
        (host === "youtube.com" ||
          host === "youtu.be" ||
          host.endsWith(".youtube.com"))
      );
    },
    { message: "Masukkan tautan YouTube yang valid" }
  );

const linkedinField = z
  .string()
  .trim()
  .max(500)
  .optional()
  .refine(
    (v) => {
      if (!v) return true;
      return hostOf(v) === "linkedin.com";
    },
    { message: "Masukkan tautan profil LinkedIn yang valid" }
  );

/** Berkas JSON+base64 (pola sama seperti POST /api/v1/uploads). */
const filePayloadSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(100),
  // 8MB karakter ≈ 6MB byte — di atas batas CV 5MB, di bawah limit JSON 15MB.
  data: z.string().min(1).max(8 * 1024 * 1024),
});

export const submitApplicationSchema = z
  .object({
    nama: z.string().trim().min(3, "Nama minimal 3 karakter").max(100),
    email: emailField,
    tentang: z.string().trim().max(1000).optional(),
    skill: z.string().trim().max(255).optional(),
    youtubeTutorial: youtubeField,
    youtubeChannel: youtubeField,
    linkedin: linkedinField,
    referralEmail: z
      .string()
      .trim()
      .max(191)
      .optional()
      .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v), {
        message: "Format email referral tidak valid",
      }),
    foto: filePayloadSchema.optional(),
    cv: filePayloadSchema.optional(),
  })
  .strict();

export const listApplicationsSchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(APPLICATION_STATUSES).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const reviewApplicationSchema = z
  .object({
    status: z.enum(["under_review", "approved", "rejected"]),
    reviewNote: z.string().trim().max(2000).optional(),
  })
  .strict();

export const inviteApplicationSchema = z
  .object({
    expiresInDays: z.coerce.number().int().min(1).max(30).optional(),
  })
  .strict();

const toFieldErrors = (
  issues: Array<{ path: Array<string | number>; message: string }>
): Array<{ field: string; message: string }> =>
  issues.map((issue) => ({
    field: issue.path.length > 0 ? String(issue.path[0]) : "body",
    message: issue.message,
  }));

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const generateCode = (): string => {
  const bytes = randomBytes(6);
  let s = "APL-";
  for (let i = 0; i < 6; i += 1) {
    s += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return s;
};

type ApplicationRow = typeof instructorApplications.$inferSelect;

export interface PublicApplication {
  id: number;
  code: string;
  nama: string;
  email: string;
  tentang: string;
  skill: string;
  youtubeTutorial: string;
  youtubeChannel: string;
  linkedin: string;
  referralEmail: string;
  fotoUrl: string | null;
  cvName: string;
  cvSize: number;
  cvUrl: string | null;
  status: ApplicationStatus;
  reviewNote: string | null;
  reviewedBy: number | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export const toPublicApplication = (row: ApplicationRow): PublicApplication => ({
  id: row.id,
  code: row.code,
  nama: row.name,
  email: row.email,
  tentang: row.about ?? "",
  skill: row.skills ?? "",
  youtubeTutorial: row.youtubeTutorial ?? "",
  youtubeChannel: row.youtubeChannel ?? "",
  linkedin: row.linkedin ?? "",
  referralEmail: row.referralEmail ?? "",
  fotoUrl: row.photoFileId ? `/api/v1/files/${row.photoFileId}/content` : null,
  cvName: row.cvName ?? "",
  cvSize: row.cvSize ?? 0,
  cvUrl: row.cvFileId ? `/api/v1/files/${row.cvFileId}/content` : null,
  status: row.status as ApplicationStatus,
  reviewNote: row.reviewNote,
  reviewedBy: row.reviewedBy,
  reviewedAt: row.reviewedAt,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const findById = async (id: number): Promise<ApplicationRow> => {
  const rows = await db
    .select()
    .from(instructorApplications)
    .where(eq(instructorApplications.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) {
    throw new ApplicationError(404, "APPLICATION_NOT_FOUND", "Pengajuan tidak ditemukan");
  }
  return row;
};

const isDupEntry = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  (error as { code: unknown }).code === "ER_DUP_ENTRY";

/** Escape wildcard LIKE (% _ \) agar pencarian tidak melebar. */
const escapeLike = (s: string): string => s.replace(/[\\%_]/g, (m) => `\\${m}`);

const writeAuditLog = async (
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  entry: {
    actorUserId: number | null;
    action: string;
    targetType: string;
    targetIdInt?: number | null;
    metadata?: Record<string, unknown>;
  }
) => {
  await tx.insert(auditLogs).values({
    actorUserId: entry.actorUserId,
    action: entry.action,
    targetType: entry.targetType,
    targetIdInt: entry.targetIdInt ?? null,
    metadata: entry.metadata ?? null,
  });
};

// ---------- Pengajuan publik ----------

export const submitApplication = async (
  input: unknown
): Promise<PublicApplication> => {
  const parsed = submitApplicationSchema.safeParse(input);
  if (!parsed.success) {
    throw new ApplicationError(
      400,
      "VALIDATION_ERROR",
      "Data pengajuan tidak valid",
      toFieldErrors(parsed.error.issues)
    );
  }
  const data = parsed.data;

  const taken = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, data.email))
    .limit(1);
  if (taken[0]) {
    throw new ApplicationError(
      409,
      "EMAIL_TAKEN",
      "Email sudah terdaftar sebagai pengguna. Masuk dengan akun tersebut."
    );
  }

  const existing = await db
    .select({ id: instructorApplications.id })
    .from(instructorApplications)
    .where(eq(instructorApplications.email, data.email))
    .limit(1);
  if (existing[0]) {
    throw new ApplicationError(
      409,
      "APPLICATION_EXISTS",
      "Email ini sudah pernah mengajukan. Satu email satu pengajuan."
    );
  }

  // Simpan berkas dulu (validasi mime/ukuran/magic-bytes di saveUpload).
  let photoFileId: number | null = null;
  let cvFileId: number | null = null;
  try {
    if (data.foto) {
      const saved = await saveUpload(null, {
        ...data.foto,
        kind: "applicant_image",
      });
      photoFileId = saved.id;
    }
    if (data.cv) {
      const saved = await saveUpload(null, {
        ...data.cv,
        kind: "applicant_cv",
      });
      cvFileId = saved.id;
      void saved;
    }

    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        const [h] = await db.insert(instructorApplications).values({
          code: generateCode(),
          name: data.nama,
          email: data.email,
          about: data.tentang || null,
          skills: data.skill || null,
          youtubeTutorial: data.youtubeTutorial || null,
          youtubeChannel: data.youtubeChannel || null,
          linkedin: data.linkedin || null,
          referralEmail: data.referralEmail
            ? data.referralEmail.toLowerCase()
            : null,
          photoFileId,
          cvFileId,
          cvName: data.cv ? data.cv.filename.slice(0, 255) : null,
          cvSize: 0,
          status: "submitted",
        });
        const id = Number((h as unknown as { insertId: number }).insertId);
        if (data.cv && cvFileId) {
          const frows = await db
            .select({ sizeBytes: files.sizeBytes })
            .from(files)
            .where(eq(files.id, cvFileId))
            .limit(1);
          await db
            .update(instructorApplications)
            .set({ cvSize: frows[0]?.sizeBytes ?? 0 })
            .where(eq(instructorApplications.id, id));
        }
        await db.insert(auditLogs).values({
          actorUserId: null,
          action: "application.submit",
          targetType: "instructor_application",
          targetIdInt: id,
          metadata: { applicationId: id, email: data.email },
        });
        return toPublicApplication(await findById(id));
      } catch (error) {
        if (!isDupEntry(error)) throw error;
        // Kemungkinan tabrakan kode acak (sangat jarang) → coba lagi.
        // Bila email ganda karena balapan request, UNIQUE email yang kena.
        const dup = await db
          .select({ id: instructorApplications.id })
          .from(instructorApplications)
          .where(eq(instructorApplications.email, data.email))
          .limit(1);
        if (dup[0]) {
          throw new ApplicationError(
            409,
            "APPLICATION_EXISTS",
            "Email ini sudah pernah mengajukan. Satu email satu pengajuan."
          );
        }
        if (attempt === 4) throw error;
      }
    }
    throw new Error("Gagal membuat kode pengajuan unik");
  } catch (error) {
    if (error instanceof ApplicationError || error instanceof UploadValidationError) {
      if (photoFileId) await deleteFileById(photoFileId);
      if (cvFileId) await deleteFileById(cvFileId);
    }
    if (error instanceof UploadValidationError) {
      throw new ApplicationError(400, "FILE_INVALID", error.message);
    }
    throw error;
  }
};

// ---------- Admin: daftar ----------

export const listApplications = async (
  query: unknown
): Promise<{ items: PublicApplication[]; total: number; page: number; limit: number }> => {
  const parsed = listApplicationsSchema.safeParse(query ?? {});
  if (!parsed.success) {
    throw new ApplicationError(
      400,
      "VALIDATION_ERROR",
      "Parameter daftar tidak valid",
      toFieldErrors(parsed.error.issues)
    );
  }
  const { q, status, page, limit } = parsed.data;
  const term = q?.trim().toLowerCase();

  const conditions = [];
  if (status) conditions.push(eq(instructorApplications.status, status));
  if (term) {
    const t = escapeLike(term);
    conditions.push(
      or(
        like(instructorApplications.email, `%${t}%`),
        like(instructorApplications.name, `%${t}%`),
        like(instructorApplications.code, `%${t.toUpperCase()}%`)
      )
    );
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [countRows, rows] = await Promise.all([
    db
      .select({ n: sql<number>`count(*)` })
      .from(instructorApplications)
      .where(where),
    db
      .select()
      .from(instructorApplications)
      .where(where)
      .orderBy(desc(instructorApplications.createdAt), desc(instructorApplications.id))
      .limit(limit)
      .offset((page - 1) * limit),
  ]);

  return {
    items: rows.map(toPublicApplication),
    total: Number(countRows[0]?.n ?? 0),
    page,
    limit,
  };
};

// ---------- Admin: detail ----------

export const getApplication = async (id: number): Promise<PublicApplication> =>
  toPublicApplication(await findById(id));

// ---------- Admin: peninjauan ----------

export const reviewApplication = async (
  id: number,
  input: unknown,
  reviewerId: number
): Promise<PublicApplication> => {
  const parsed = reviewApplicationSchema.safeParse(input);
  if (!parsed.success) {
    throw new ApplicationError(
      400,
      "VALIDATION_ERROR",
      "Data peninjauan tidak valid",
      toFieldErrors(parsed.error.issues)
    );
  }
  const row = await findById(id);
  if (row.status === parsed.data.status) {
    return toPublicApplication(row);
  }
  await db.transaction(async (tx) => {
    await tx
      .update(instructorApplications)
      .set({
        status: parsed.data.status,
        reviewNote: parsed.data.reviewNote ?? null,
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
      })
      .where(eq(instructorApplications.id, id));
    await writeAuditLog(tx, {
      actorUserId: reviewerId,
      action: "application.review",
      targetType: "instructor_application",
      targetIdInt: id,
      metadata: { applicationId: id, from: row.status, to: parsed.data.status },
    });
  });
  return toPublicApplication(await findById(id));
};

// ---------- Admin: hapus ----------

export const deleteApplication = async (id: number, actorId?: number | null): Promise<{ id: number }> => {
  const row = await findById(id);
  await db.transaction(async (tx) => {
    await tx
      .delete(instructorApplications)
      .where(eq(instructorApplications.id, id));
    await writeAuditLog(tx, {
      actorUserId: actorId ?? null,
      action: "application.delete",
      targetType: "instructor_application",
      targetIdInt: id,
      metadata: { applicationId: id, email: row.email },
    });
  });
  // FK set null + hapus byte best-effort agar storage tidak bocor.
  if (row.photoFileId) await deleteFileById(row.photoFileId, actorId ?? null);
  if (row.cvFileId) await deleteFileById(row.cvFileId, actorId ?? null);
  return { id };
};

// ---------- Admin: setujui + buat undangan (K-01) ----------

export const inviteApplication = async (
  id: number,
  actorId: number,
  input: unknown
): Promise<{
  application: PublicApplication;
  invitation: {
    id: number;
    email: string;
    token: string;
    inviteUrl: string;
    expiresAt: Date;
    /** false bila email gagal terkirim — admin wajib salin token manual. */
    emailSent: boolean;
  };
}> => {
  const parsed = inviteApplicationSchema.safeParse(input ?? {});
  if (!parsed.success) {
    throw new ApplicationError(
      400,
      "VALIDATION_ERROR",
      "Data undangan tidak valid",
      toFieldErrors(parsed.error.issues)
    );
  }
  const row = await findById(id);
  if (row.status === "rejected") {
    throw new ApplicationError(
      409,
      "ALREADY_REJECTED",
      "Pengajuan sudah ditolak. Ubah status dulu bila ingin mengundang."
    );
  }

  // Atomik: undangan + status approved + kedua audit dalam SATU transaksi.
  // Kegagalan di tengah me-rollback semuanya (tidak ada undangan yatim).
  let invitation: { id: number; email: string; token: string; inviteUrl: string; expiresAt: Date };
  try {
    const built = await db.transaction(async (tx) => {
      const made = await insertInvitationRow(tx, actorId, {
        email: row.email,
        name: row.name,
        ...(parsed.data.expiresInDays ? { expiresInDays: parsed.data.expiresInDays } : {}),
      });
      await tx
        .update(instructorApplications)
        .set({ status: "approved", reviewedBy: actorId, reviewedAt: new Date() })
        .where(eq(instructorApplications.id, id));
      await writeAuditLog(tx, {
        actorUserId: actorId,
        action: "application.invite",
        targetType: "instructor_application",
        targetIdInt: id,
        metadata: { applicationId: id, invitationId: made.row.id, email: row.email },
      });
      return made;
    });
    invitation = {
      id: built.row.id,
      email: built.row.email,
      token: built.token,
      inviteUrl: buildInviteUrl(built.token),
      expiresAt: built.expiresAt,
    };
  } catch (e: unknown) {
    // Samakan bentuk error undangan ke kontrak modul ini.
    const err = e as { http?: number; code?: string; message?: string };
    throw new ApplicationError(
      typeof err.http === "number" ? err.http : 500,
      typeof err.code === "string" ? err.code : "INVITATION_FAILED",
      typeof err.message === "string" ? err.message : "Gagal membuat undangan"
    );
  }

  // Email di luar transaksi (efek samping tidak bisa di-rollback).
  const emailSent = await trySendInvitation(invitation.email, {
    name: row.name,
    inviteUrl: invitation.inviteUrl,
    expiresAt: invitation.expiresAt,
  });

  return {
    application: toPublicApplication(await findById(id)),
    invitation: {
      id: invitation.id,
      email: invitation.email,
      token: invitation.token,
      inviteUrl: invitation.inviteUrl,
      expiresAt: invitation.expiresAt,
      emailSent,
    },
  };
};
