import { z } from "zod";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../../db";
import {
  auditLogs,
  courses,
  payouts,
  revenueLedger,
  revenueSettings,
  users,
} from "../../db/schema";

export class RevenueError extends Error {
  http: number;
  code: string;
  constructor(http: number, code: string, message: string) {
    super(message);
    this.http = http;
    this.code = code;
    this.message = message;
  }
}

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export const DEFAULT_PERCENT = 70;
export const DEFAULT_MIN_WITHDRAWAL = 100000;

export const settingsSchema = z
  .object({
    instructorPercent: z.number().int().min(1).max(99),
    minWithdrawal: z.number().int().min(0),
  })
  .strict();

export const payoutRequestSchema = z
  .object({
    amount: z.number().int().positive(),
    bankName: z.string().trim().min(1).max(100),
    accountNumber: z
      .string()
      .trim()
      .min(4)
      .max(50)
      .regex(/^[0-9][0-9\s-]*$/, "Nomor rekening hanya boleh berisi angka, spasi, atau strip"),
    accountName: z.string().trim().min(1).max(150),
  })
  .strict();

export const payoutProcessSchema = z
  .object({
    action: z.enum(["setujui", "tolak", "tandai-ditransfer"]),
    reason: z.string().trim().max(500).optional(),
  })
  .strict()
  .refine((v) => v.action !== "tolak" || (v.reason !== undefined && v.reason.length > 0), {
    message: "Alasan penolakan wajib diisi",
    path: ["reason"],
  });

export type PayoutStatus = "diajukan" | "diproses" | "berhasil" | "ditolak";

/** Baca pengaturan (self-heal: buat baris default bila belum ada). */
export async function getSettings(): Promise<{ instructorPercent: number; minWithdrawal: number }> {
  const rows = await db.select().from(revenueSettings).where(eq(revenueSettings.id, 1)).limit(1);
  if (rows[0]) {
    return { instructorPercent: rows[0].instructorPercent, minWithdrawal: rows[0].minWithdrawal };
  }
  await db
    .insert(revenueSettings)
    .values({ id: 1, instructorPercent: DEFAULT_PERCENT, minWithdrawal: DEFAULT_MIN_WITHDRAWAL })
    .onDuplicateKeyUpdate({ set: { id: 1 } });
  return { instructorPercent: DEFAULT_PERCENT, minWithdrawal: DEFAULT_MIN_WITHDRAWAL };
}

async function getSettingsTx(tx: DbTx): Promise<{ instructorPercent: number; minWithdrawal: number }> {
  const rows = await tx.select().from(revenueSettings).where(eq(revenueSettings.id, 1)).limit(1);
  if (rows[0]) {
    return { instructorPercent: rows[0].instructorPercent, minWithdrawal: rows[0].minWithdrawal };
  }
  await tx
    .insert(revenueSettings)
    .values({ id: 1, instructorPercent: DEFAULT_PERCENT, minWithdrawal: DEFAULT_MIN_WITHDRAWAL })
    .onDuplicateKeyUpdate({ set: { id: 1 } });
  return { instructorPercent: DEFAULT_PERCENT, minWithdrawal: DEFAULT_MIN_WITHDRAWAL };
}

export const updateSettings = async (
  adminId: number,
  input: z.infer<typeof settingsSchema>
) => {
  const prev = await getSettings();
  await db
    .insert(revenueSettings)
    .values({
      id: 1,
      instructorPercent: input.instructorPercent,
      minWithdrawal: input.minWithdrawal,
      updatedBy: adminId,
    })
    .onDuplicateKeyUpdate({
      set: { instructorPercent: input.instructorPercent, minWithdrawal: input.minWithdrawal, updatedBy: adminId },
    });
  await db.insert(auditLogs).values({
    actorUserId: adminId,
    action: "revenue.settings.update",
    targetType: "revenue_settings",
    targetIdInt: 1,
    metadata: { before: prev, after: input },
  });
  return { instructorPercent: input.instructorPercent, minWithdrawal: input.minWithdrawal };
};

/**
 * Snapshot hak instruktur untuk satu pembayaran terverifikasi.
 * Dipanggil di dalam transaksi grant (manual + webhook DOKU),
 * idempoten untuk retry webhook (satu baris per paymentId).
 * Mengembalikan null bila kursus tanpa instruktur (createdBy NULL).
 */
export const recordRevenueSnapshot = async (
  tx: DbTx,
  paymentId: number,
  courseId: number,
  amountPaid: number
): Promise<{ instructorId: number; amount: number } | null> => {
  const cRows = await tx
    .select({ createdBy: courses.createdBy })
    .from(courses)
    .where(eq(courses.id, courseId))
    .limit(1);
  const instructorId = cRows[0]?.createdBy ?? null;
  if (instructorId === null) return null;
  const { instructorPercent } = await getSettingsTx(tx);
  const amount = Math.floor((amountPaid * instructorPercent) / 100);
  await tx
    .insert(revenueLedger)
    .values({ paymentId, instructorId, courseId, amountPaid, percent: instructorPercent, amount })
    .onDuplicateKeyUpdate({ set: { paymentId } });
  return { instructorId, amount };
};

async function sumLedger(instructorId: number): Promise<number> {
  const rows = await db
    .select({ total: sql<number>`coalesce(sum(${revenueLedger.amount}), 0)` })
    .from(revenueLedger)
    .where(eq(revenueLedger.instructorId, instructorId));
  return Number(rows[0]?.total ?? 0);
}

async function sumPayoutBuckets(instructorId: number): Promise<{
  locked: number;
  pending: number;
  paid: number;
}> {
  // Satu query untuk 3 angka payout (dulu 3 query terpisah).
  const rows = await db
    .select({
      locked:
        sql<number>`coalesce(sum(case when ${payouts.status} in ('diajukan','diproses','berhasil') then ${payouts.amount} else 0 end), 0)`,
      pending:
        sql<number>`coalesce(sum(case when ${payouts.status} in ('diajukan','diproses') then ${payouts.amount} else 0 end), 0)`,
      paid: sql<number>`coalesce(sum(case when ${payouts.status} = 'berhasil' then ${payouts.amount} else 0 end), 0)`,
    })
    .from(payouts)
    .where(eq(payouts.instructorId, instructorId));
  return {
    locked: Number(rows[0]?.locked ?? 0),
    pending: Number(rows[0]?.pending ?? 0),
    paid: Number(rows[0]?.paid ?? 0),
  };
}

/** Ringkasan pendapatan instruktur dari snapshot ledger + payout terkunci. */
export const getEarnings = async (instructorId: number) => {
  const settings = await getSettings();
  const [totalEarned, buckets, perCourse] = await Promise.all([
    sumLedger(instructorId),
    sumPayoutBuckets(instructorId),
    db
      .select({
        courseId: revenueLedger.courseId,
        title: courses.title,
        earned: sql<number>`coalesce(sum(${revenueLedger.amount}), 0)`,
        payments: sql<number>`count(*)`,
      })
      .from(revenueLedger)
      .innerJoin(courses, eq(courses.id, revenueLedger.courseId))
      .where(eq(revenueLedger.instructorId, instructorId))
      .groupBy(revenueLedger.courseId, courses.title)
      .orderBy(desc(sql`coalesce(sum(${revenueLedger.amount}), 0)`)),
  ]);
  return {
    totalEarned,
    available: Math.max(0, totalEarned - buckets.locked),
    pending: buckets.pending,
    paid: buckets.paid,
    percent: settings.instructorPercent,
    minWithdrawal: settings.minWithdrawal,
    courses: perCourse.map((r) => ({
      courseId: r.courseId,
      title: r.title,
      earned: Number(r.earned),
      payments: Number(r.payments),
    })),
  };
};

export const requestPayout = async (instructorId: number, input: z.infer<typeof payoutRequestSchema>) => {
  return db.transaction(async (tx) => {
    // Kunci baris instruktur: serialkan pengajuan bersamaan per instruktur.
    await tx.select({ id: users.id }).from(users).where(eq(users.id, instructorId)).for("update");
    const settings = await getSettingsTx(tx);
    const [totalRows, lockedRows] = await Promise.all([
      tx
        .select({ total: sql<number>`coalesce(sum(${revenueLedger.amount}), 0)` })
        .from(revenueLedger)
        .where(eq(revenueLedger.instructorId, instructorId)),
      tx
        .select({ total: sql<number>`coalesce(sum(${payouts.amount}), 0)` })
        .from(payouts)
        .where(
          and(
            eq(payouts.instructorId, instructorId),
            inArray(payouts.status, ["diajukan", "diproses", "berhasil"])
          )
        ),
    ]);
    const total = Number(totalRows[0]?.total ?? 0);
    const locked = Number(lockedRows[0]?.total ?? 0);
    const available = Math.max(0, total - locked);
    if (input.amount < settings.minWithdrawal) {
      throw new RevenueError(
        400,
        "PAYOUT_BELOW_MINIMUM",
        `Nominal kurang dari minimal penarikan Rp ${settings.minWithdrawal.toLocaleString("id-ID")}.`
      );
    }
    if (input.amount > available) {
      throw new RevenueError(400, "PAYOUT_INSUFFICIENT", "Saldo tersedia tidak mencukupi.");
    }
    const [h] = await tx.insert(payouts).values({
      instructorId,
      amount: input.amount,
      bankName: input.bankName,
      accountNumber: input.accountNumber,
      accountName: input.accountName,
      status: "diajukan",
    });
    const id = Number((h as unknown as { insertId: number }).insertId);
    await tx.insert(auditLogs).values({
      actorUserId: instructorId,
      action: "payout.request",
      targetType: "payout",
      targetIdInt: id,
      metadata: { payoutId: id, amount: input.amount, bankName: input.bankName },
    });
    return { id, amount: input.amount, status: "diajukan" as const, available: available - input.amount };
  });
};

export const listMyPayouts = async (
  instructorId: number,
  filter: { status?: PayoutStatus; limit?: number; page?: number }
) => {
  const limit = Math.min(Math.max(filter.limit ?? 10, 1), 50);
  const page = Math.max(filter.page ?? 1, 1);
  const cond = filter.status
    ? and(eq(payouts.instructorId, instructorId), eq(payouts.status, filter.status))
    : eq(payouts.instructorId, instructorId);
  const [items, totalRows] = await Promise.all([
    db
      .select()
      .from(payouts)
      .where(cond)
      .orderBy(desc(payouts.id))
      .limit(limit)
      .offset((page - 1) * limit),
    db
      .select({ n: sql<number>`count(*)` })
      .from(payouts)
      .where(cond),
  ]);
  return { items, total: Number(totalRows[0]?.n ?? 0), page, limit };
};

export const listPayoutsAdmin = async (filter: {
  status?: PayoutStatus;
  limit?: number;
  page?: number;
}) => {
  const limit = Math.min(Math.max(filter.limit ?? 10, 1), 50);
  const page = Math.max(filter.page ?? 1, 1);
  const cond = filter.status ? eq(payouts.status, filter.status) : undefined;
  const base = db
    .select({
      id: payouts.id,
      instructorId: payouts.instructorId,
      instructorName: users.name,
      instructorEmail: users.email,
      amount: payouts.amount,
      bankName: payouts.bankName,
      accountNumber: payouts.accountNumber,
      accountName: payouts.accountName,
      status: payouts.status,
      rejectReason: payouts.rejectReason,
      createdAt: payouts.createdAt,
      decidedAt: payouts.decidedAt,
    })
    .from(payouts)
    .innerJoin(users, eq(users.id, payouts.instructorId))
    .$dynamic();
  const [items, totalRows] = await Promise.all([
    (cond ? base.where(cond) : base).orderBy(desc(payouts.id)).limit(limit).offset((page - 1) * limit),
    db
      .select({ n: sql<number>`count(*)` })
      .from(payouts)
      .where(cond),
  ]);
  return { items, total: Number(totalRows[0]?.n ?? 0), page };
};

const TRANSITIONS: Record<PayoutStatus, Array<"setujui" | "tolak" | "tandai-ditransfer">> = {
  diajukan: ["setujui", "tolak"],
  diproses: ["tolak", "tandai-ditransfer"],
  berhasil: [],
  ditolak: [],
};

export const processPayout = async (
  adminId: number,
  payoutId: number,
  input: z.infer<typeof payoutProcessSchema>
) => {
  return db.transaction(async (tx) => {
    const locked = await tx.select().from(payouts).where(eq(payouts.id, payoutId)).for("update").limit(1);
    const p = locked[0];
    if (!p) throw new RevenueError(404, "PAYOUT_NOT_FOUND", "Pengajuan penarikan tidak ditemukan");
    if (!TRANSITIONS[p.status as PayoutStatus].includes(input.action)) {
      throw new RevenueError(
        409,
        "PAYOUT_LOCKED",
        `Aksi ${input.action} tidak berlaku untuk status ${p.status}.`
      );
    }
    const next: PayoutStatus =
      input.action === "setujui" ? "diproses" : input.action === "tandai-ditransfer" ? "berhasil" : "ditolak";
    await tx
      .update(payouts)
      .set({
        status: next,
        rejectReason: input.action === "tolak" ? (input.reason as string) : null,
        decidedBy: adminId,
        decidedAt: new Date(),
      })
      .where(eq(payouts.id, payoutId));
    await tx.insert(auditLogs).values({
      actorUserId: adminId,
      action: "payout.process",
      targetType: "payout",
      targetIdInt: payoutId,
      metadata: { payoutId, from: p.status, to: next, action: input.action, reason: input.reason ?? null },
    });
    return { id: payoutId, status: next };
  });
};
