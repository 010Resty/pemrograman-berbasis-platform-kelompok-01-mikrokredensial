import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { db } from "../../db";
import { auditLogs, instructorInvitations, users } from "../../db/schema";
import { createAccessToken, hashPassword } from "../auth/auth.service";

export class InvitationError extends Error {
  readonly http: number;
  readonly code: string;
  constructor(http: number, code: string, message: string) {
    super(message);
    this.http = http;
    this.code = code;
  }
}

// ---------- Skema input ----------

export const createInvitationSchema = z
  .object({
    email: z.string().trim().email().max(191),
    name: z.string().trim().min(2).max(100).optional(),
    note: z.string().trim().max(2000).nullable().optional(),
    expiresInDays: z.number().int().min(1).max(30).optional(),
  })
  .strict();

export const acceptInvitationSchema = z
  .object({
    token: z.string().trim().min(16).max(256),
    name: z.string().trim().min(2).max(100).optional(),
    password: z.string().min(8).max(72),
  })
  .strict();

const hashToken = (token: string): string =>
  createHash("sha256").update(token).digest("hex");

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

export interface PublicInvitation {
  id: number;
  email: string;
  name: string | null;
  note: string | null;
  status: string;
  invitedBy: number | null;
  expiresAt: Date;
  createdAt: Date;
}

// ---------- Pembuatan (admin) ----------

export const createInvitation = async (
  actorId: number,
  input: z.infer<typeof createInvitationSchema>
): Promise<PublicInvitation & { token: string }> => {
  const email = input.email.toLowerCase();
  const taken = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (taken[0]) {
    throw new InvitationError(
      409,
      "EMAIL_TAKEN",
      "Email sudah terdaftar; tugaskan langsung sebagai pengampu bila perlu"
    );
  }
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(
    Date.now() + (input.expiresInDays ?? 7) * 24 * 3600 * 1000
  );
  const created = await db.transaction(async (tx) => {
    const [h] = await tx.insert(instructorInvitations).values({
      email,
      name: input.name ?? null,
      note: input.note ?? null,
      tokenHash: hashToken(token),
      status: "pending",
      invitedBy: actorId,
      expiresAt,
    });
    const id = Number((h as unknown as { insertId: number }).insertId);
    await writeAuditLog(tx, {
      actorUserId: actorId,
      action: "invitation.create",
      targetType: "invitation",
      targetIdInt: id,
      metadata: { invitationId: id, email },
    });
    const rows = await tx
      .select()
      .from(instructorInvitations)
      .where(eq(instructorInvitations.id, id))
      .limit(1);
    return rows[0] ?? null;
  });
  if (!created) throw new Error("Gagal membuat undangan");
  // Token plaintext hanya muncul sekali di respons ini.
  return {
    id: created.id,
    email: created.email,
    name: created.name,
    note: created.note,
    status: created.status,
    invitedBy: created.invitedBy,
    expiresAt: created.expiresAt,
    createdAt: created.createdAt,
    token,
  };
};

// ---------- Daftar & cabut (admin) ----------

export const listInvitations = async (
  status?: string
): Promise<PublicInvitation[]> => {
  const allowed = ["pending", "accepted", "revoked", "expired"] as const;
  const where =
    status !== undefined && (allowed as readonly string[]).includes(status)
      ? eq(instructorInvitations.status, status as (typeof allowed)[number])
      : undefined;
  const rows = await db
    .select({
      id: instructorInvitations.id,
      email: instructorInvitations.email,
      name: instructorInvitations.name,
      note: instructorInvitations.note,
      status: instructorInvitations.status,
      invitedBy: instructorInvitations.invitedBy,
      expiresAt: instructorInvitations.expiresAt,
      createdAt: instructorInvitations.createdAt,
    })
    .from(instructorInvitations)
    .where(where)
    .orderBy(desc(instructorInvitations.createdAt), desc(instructorInvitations.id));
  return rows;
};

export const revokeInvitation = async (
  actorId: number,
  id: number,
  reason?: string
): Promise<PublicInvitation> => {
  const updated = await db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(instructorInvitations)
      .where(eq(instructorInvitations.id, id))
      .limit(1);
    const inv = rows[0];
    if (!inv) return null;
    if (inv.status !== "pending") {
      throw new InvitationError(
        409,
        "STATUS_FINAL",
        `Undangan berstatus ${inv.status}, tidak dapat dicabut`
      );
    }
    await tx
      .update(instructorInvitations)
      .set({ status: "revoked" })
      .where(eq(instructorInvitations.id, id));
    await writeAuditLog(tx, {
      actorUserId: actorId,
      action: "invitation.revoke",
      targetType: "invitation",
      targetIdInt: id,
      metadata: { invitationId: id, email: inv.email, reason: reason ?? null },
    });
    const fresh = await tx
      .select()
      .from(instructorInvitations)
      .where(eq(instructorInvitations.id, id))
      .limit(1);
    return fresh[0] ?? null;
  });
  if (!updated) {
    throw new InvitationError(404, "INVITATION_NOT_FOUND", "Undangan tidak ditemukan");
  }
  const { tokenHash: _drop, ...publicRow } = updated;
  void _drop;
  return publicRow;
};

// ---------- Validasi publik (untuk form aktivasi) ----------

export const validateInvitation = async (
  token: string
): Promise<{ email: string; name: string | null; expiresAt: Date }> => {
  const rows = await db
    .select()
    .from(instructorInvitations)
    .where(eq(instructorInvitations.tokenHash, hashToken(token)))
    .limit(1);
  const inv = rows[0];
  if (!inv || inv.status === "revoked") {
    throw new InvitationError(404, "INVITATION_NOT_FOUND", "Undangan tidak valid");
  }
  if (inv.status === "accepted") {
    throw new InvitationError(409, "ALREADY_ACCEPTED", "Undangan sudah digunakan");
  }
  if (inv.expiresAt.getTime() <= Date.now()) {
    await db
      .update(instructorInvitations)
      .set({ status: "expired" })
      .where(eq(instructorInvitations.id, inv.id));
    throw new InvitationError(410, "INVITATION_EXPIRED", "Undangan sudah kedaluwarsa");
  }
  return { email: inv.email, name: inv.name, expiresAt: inv.expiresAt };
};

// ---------- Terima undangan (publik) ----------

export const acceptInvitation = async (
  input: z.infer<typeof acceptInvitationSchema>
) => {
  const accepted = await db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(instructorInvitations)
      .where(eq(instructorInvitations.tokenHash, hashToken(input.token)))
      .limit(1);
    const inv = rows[0];
    if (!inv || inv.status === "revoked") {
      throw new InvitationError(404, "INVITATION_NOT_FOUND", "Undangan tidak valid");
    }
    if (inv.status === "accepted") {
      throw new InvitationError(409, "ALREADY_ACCEPTED", "Undangan sudah digunakan");
    }
    if (inv.status === "expired" || inv.expiresAt.getTime() <= Date.now()) {
      await tx
        .update(instructorInvitations)
        .set({ status: "expired" })
        .where(eq(instructorInvitations.id, inv.id));
      throw new InvitationError(410, "INVITATION_EXPIRED", "Undangan sudah kedaluwarsa");
    }
    const taken = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, inv.email))
      .limit(1);
    if (taken[0]) {
      throw new InvitationError(
        409,
        "EMAIL_TAKEN",
        "Email sudah terdaftar; masuk dengan akun tersebut"
      );
    }
    const name = input.name ?? inv.name ?? "Pengajar Baru";
    const [h] = await tx.insert(users).values({
      name,
      email: inv.email,
      passwordHash: await hashPassword(input.password),
      role: "teacher",
      isActive: true,
    });
    const userId = Number((h as unknown as { insertId: number }).insertId);
    await tx
      .update(instructorInvitations)
      .set({ status: "accepted" })
      .where(eq(instructorInvitations.id, inv.id));
    await writeAuditLog(tx, {
      actorUserId: userId,
      action: "invitation.accept",
      targetType: "invitation",
      targetIdInt: inv.id,
      metadata: { invitationId: inv.id, userId, email: inv.email },
    });
    return { userId, name, email: inv.email };
  });
  const accessToken = createAccessToken({
    id: accepted.userId,
    email: accepted.email,
    role: "teacher",
  });
  return {
    message: "Undangan diterima. Akun instruktur aktif.",
    accessToken,
    user: { id: accepted.userId, name: accepted.name, email: accepted.email, role: "teacher" as const },
  };
}
