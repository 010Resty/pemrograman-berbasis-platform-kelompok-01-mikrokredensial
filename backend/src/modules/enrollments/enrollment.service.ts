import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../../db";
import {
  auditLogs,
  courses,
  enrollments,
  users,
} from "../../db/schema";
import { canManageCourse } from "../courses/course.service";
import {
  canReadCourseTree,
  getCourseOfMaterial,
  getMaterial,
} from "../courses/curricula.service";

// ---------- Tipe & skema ----------

/** Status enrollment yang sah (selaras enum DB). */
export const ENROLLMENT_STATUSES = [
  "active",
  "completed",
  "expired",
  "cancelled",
] as const;

/** Status yang memberi hak akses materi belajar. */
const ACCESS_STATUSES: ReadonlyArray<string> = ["active", "completed"];

export const grantAccessSchema = z.object({
  userId: z.number().int().positive().optional(),
  email: z.string().trim().email().max(191).optional(),
  reason: z.string().trim().min(5).max(500),
}).refine((v) => v.userId !== undefined || v.email !== undefined, {
  message: "userId atau email wajib diisi",
  path: ["userId"],
});

export const revokeAccessSchema = z.object({
  reason: z.string().trim().min(5).max(500),
});

export class EnrollmentError extends Error {
  readonly http: number;
  readonly code: string;
  constructor(http: number, code: string, message: string) {
    super(message);
    this.http = http;
    this.code = code;
  }
}

// ---------- Helper akses ----------

export interface AccessState {
  hasAccess: boolean;
  isManager: boolean;
  enrollment: {
    status: string;
    source: string;
    enrolledAt: Date;
  } | null;
}

/** Hak akses belajar: admin / pengelola kursus / enrollment aktif (active/completed). */
export const hasCourseAccess = async (
  userId: number | null,
  role: string,
  courseId: number
): Promise<boolean> => {
  if (userId === null) return false;
  if (role === "admin") return true;
  if (await canManageCourse(userId, role, courseId)) return true;
  const rows = await db
    .select({ status: enrollments.status })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.userId, userId),
        eq(enrollments.courseId, courseId)
      )
    )
    .limit(1);
  const status = rows[0]?.status;
  return status !== undefined && ACCESS_STATUSES.includes(status);
};

/** Status akses rinci untuk endpoint GET /courses/:id/access. */
export const getAccessState = async (
  userId: number,
  role: string,
  courseId: number
): Promise<(AccessState & { courseExists: boolean }) | null> => {
  const course = await db
    .select({ id: courses.id })
    .from(courses)
    .where(eq(courses.id, courseId))
    .limit(1);
  if (!course[0]) return null;
  const isManager =
    role === "admin" || (await canManageCourse(userId, role, courseId));
  const rows = await db
    .select()
    .from(enrollments)
    .where(
      and(
        eq(enrollments.userId, userId),
        eq(enrollments.courseId, courseId)
      )
    )
    .limit(1);
  const enrollment = rows[0]
    ? {
        status: rows[0].status,
        source: rows[0].source,
        enrolledAt: rows[0].enrolledAt,
      }
    : null;
  const hasAccess =
    isManager ||
    (enrollment !== null && ACCESS_STATUSES.includes(enrollment.status));
  return { hasAccess, isManager, enrollment, courseExists: true };
};

// ---------- Pendaftaran mandiri (kursus gratis) ----------

export interface EnrollResult {
  courseId: number;
  status: string;
  source: string;
  reactivated: boolean;
}

/** Pendaftaran mandiri: hanya kursus published + gratis + periode pendaftaran terbuka. */
export const enrollFree = async (
  userId: number,
  courseId: number
): Promise<EnrollResult> => {
  const rows = await db
    .select()
    .from(courses)
    .where(eq(courses.id, courseId))
    .limit(1);
  const course = rows[0];
  // Draft disamarkan sebagai 404 agar tidak bocor (anti-enumerasi).
  if (!course || course.status === "draft") {
    throw new EnrollmentError(404, "COURSE_NOT_FOUND", "Kursus tidak ditemukan");
  }
  if (course.status === "archived" || course.period === "ended") {
    throw new EnrollmentError(
      403,
      "ENROLLMENT_CLOSED",
      "Pendaftaran kursus ini sudah ditutup"
    );
  }
  if ((course.priceNominal ?? 0) > 0) {
    throw new EnrollmentError(
      403,
      "NEEDS_MANUAL_GRANT",
      "Kursus berbayar memerlukan pemberian akses oleh admin"
    );
  }
  const existing = await db
    .select({ status: enrollments.status })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.userId, userId),
        eq(enrollments.courseId, courseId)
      )
    )
    .limit(1);
  if (existing[0] && ACCESS_STATUSES.includes(existing[0].status)) {
    throw new EnrollmentError(
      409,
      "ALREADY_ENROLLED",
      "Anda sudah terdaftar di kursus ini"
    );
  }
  const reactivated = existing.length > 0;
  await db
    .insert(enrollments)
    .values({ userId, courseId, source: "free", status: "active" })
    .onDuplicateKeyUpdate({
      set: { source: "free", status: "active" },
    });
  return { courseId, status: "active", source: "free", reactivated };
};

// ---------- Daftar kursus saya ----------

export const listMyEnrollments = async (userId: number) => {
  const rows = await db
    .select({
      status: enrollments.status,
      source: enrollments.source,
      enrolledAt: enrollments.enrolledAt,
      courseId: courses.id,
      title: courses.title,
      description: courses.description,
      category: courses.category,
      level: courses.level,
      duration: courses.duration,
      image: courses.image,
      statusCourse: courses.status,
      priceLabel: courses.priceLabel,
      priceNominal: courses.priceNominal,
      period: courses.period,
    })
    .from(enrollments)
    .innerJoin(courses, eq(courses.id, enrollments.courseId))
    .where(eq(enrollments.userId, userId))
    .orderBy(desc(enrollments.enrolledAt));
  return rows;
};

// ---------- Guard akses belajar (materi/kuis/progres) ----------

export type LearningGuard =
  | { status: "ok"; courseId: number }
  | { status: "not-found" }
  | { status: "no-access" };

/**
 * Guard terpadu untuk aksi belajar:
 * materi ada + pohon kursus boleh dibaca (published/archived publik, draft manajer)
 * + peminta mempunyai hak akses belajar (admin/pengelola/enrollment aktif).
 */
export const resolveLearningGuard = async (
  userId: number,
  role: string,
  materialId: number
): Promise<LearningGuard> => {
  const mat = await getMaterial(materialId);
  if (!mat) return { status: "not-found" };
  const courseId = await getCourseOfMaterial(materialId);
  if (courseId === null) return { status: "not-found" };
  const verdict = await canReadCourseTree(userId, role, courseId);
  if (verdict !== "ok") return { status: "not-found" };
  if (!(await hasCourseAccess(userId, role, courseId))) {
    return { status: "no-access" };
  }
  return { status: "ok", courseId };
};

// ---------- Pemberian / pencabutan manual oleh admin ----------

const resolveTargetUser = async (
  userId?: number,
  email?: string
): Promise<{ id: number; email: string; name: string } | null> => {
  if (userId !== undefined) {
    const rows = await db
      .select({ id: users.id, email: users.email, name: users.name })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return rows[0] ?? null;
  }
  const rows = await db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(users)
    .where(eq(users.email, email!.toLowerCase()))
    .limit(1);
  return rows[0] ?? null;
};

const writeAuditLog = async (
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  entry: {
    actorUserId: number;
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

export const grantManualAccess = async (
  actorUserId: number,
  courseId: number,
  input: z.infer<typeof grantAccessSchema>
) => {
  const course = await db
    .select({ id: courses.id, title: courses.title })
    .from(courses)
    .where(eq(courses.id, courseId))
    .limit(1);
  if (!course[0]) {
    throw new EnrollmentError(404, "COURSE_NOT_FOUND", "Kursus tidak ditemukan");
  }
  const target = await resolveTargetUser(input.userId, input.email);
  if (!target) {
    throw new EnrollmentError(
      404,
      "USER_NOT_FOUND",
      "Pengguna target tidak ditemukan"
    );
  }
  // Pengguna tidak dapat memberi akses kepada dirinya sendiri.
  if (target.id === actorUserId) {
    throw new EnrollmentError(
      400,
      "CANNOT_GRANT_SELF",
      "Tidak dapat memberikan akses kepada diri sendiri"
    );
  }
  await db.transaction(async (tx) => {
    await tx
      .insert(enrollments)
      .values({
        userId: target.id,
        courseId,
        source: "manual",
        status: "active",
      })
      .onDuplicateKeyUpdate({
        set: { source: "manual", status: "active" },
      });
    await writeAuditLog(tx, {
      actorUserId,
      action: "enrollment.grant",
      targetType: "enrollment",
      targetIdInt: courseId,
      metadata: {
        targetUserId: target.id,
        targetEmail: target.email,
        courseId,
        reason: input.reason,
      },
    });
  });
  return {
    courseId,
    userId: target.id,
    email: target.email,
    status: "active",
    source: "manual",
  };
};

export const revokeManualAccess = async (
  actorUserId: number,
  courseId: number,
  targetUserId: number,
  reason: string
) => {
  const course = await db
    .select({ id: courses.id })
    .from(courses)
    .where(eq(courses.id, courseId))
    .limit(1);
  if (!course[0]) {
    throw new EnrollmentError(404, "COURSE_NOT_FOUND", "Kursus tidak ditemukan");
  }
  if (targetUserId === actorUserId) {
    throw new EnrollmentError(
      400,
      "CANNOT_GRANT_SELF",
      "Tidak dapat mencabut akses diri sendiri melalui endpoint ini"
    );
  }
  const existing = await db
    .select()
    .from(enrollments)
    .where(
      and(
        eq(enrollments.userId, targetUserId),
        eq(enrollments.courseId, courseId)
      )
    )
    .limit(1);
  if (!existing[0]) {
    throw new EnrollmentError(
      404,
      "ENROLLMENT_NOT_FOUND",
      "Peserta tidak terdaftar di kursus ini"
    );
  }
  if (existing[0].status === "cancelled") {
    throw new EnrollmentError(
      409,
      "ALREADY_CANCELLED",
      "Akses peserta sudah dicabut"
    );
  }
  await db.transaction(async (tx) => {
    await tx
      .update(enrollments)
      .set({ status: "cancelled" })
      .where(
        and(
          eq(enrollments.userId, targetUserId),
          eq(enrollments.courseId, courseId)
        )
      );
    await writeAuditLog(tx, {
      actorUserId,
      action: "enrollment.revoke",
      targetType: "enrollment",
      targetIdInt: courseId,
      metadata: { targetUserId, courseId, reason },
    });
  });
  return { courseId, userId: targetUserId, status: "cancelled" };
};
