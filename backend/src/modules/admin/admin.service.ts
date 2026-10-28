import bcrypt from "bcryptjs";
import { z } from "zod";
import { and, desc, eq, like, or, sql } from "drizzle-orm";
import { db } from "../../db";
import {
  auditLogs,
  certificates,
  courseInstructors,
  courses,
  enrollments,
  users,
} from "../../db/schema";

export class AdminError extends Error {
  readonly http: number;
  readonly code: string;
  constructor(http: number, code: string, message: string) {
    super(message);
    this.http = http;
    this.code = code;
  }
}

// ---------- Skema input ----------

export const createTeacherSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    email: z.string().trim().email().max(191),
    password: z.string().min(8).max(72),
  })
  .strict();

export const setActiveSchema = z
  .object({ isActive: z.boolean() })
  .strict();

export const assignInstructorSchema = z
  .object({
    userId: z.number().int().positive().optional(),
    email: z.string().trim().email().max(191).optional(),
  })
  .strict()
  .refine((v) => v.userId !== undefined || v.email !== undefined, {
    message: "userId atau email wajib diisi",
    path: ["userId"],
  });

// ---------- Helper ----------

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

export interface PublicUser {
  id: number;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: Date;
}

// ---------- Daftar pengguna ----------

export interface UserListFilter {
  role?: "student" | "teacher" | "admin";
  isActive?: boolean;
  q?: string;
  limit?: number;
  page?: number;
}

export const listUsers = async (
  filter: UserListFilter = {}
): Promise<{ items: PublicUser[]; total: number }> => {
  const conditions = [];
  if (filter.role !== undefined) conditions.push(eq(users.role, filter.role));
  if (filter.isActive !== undefined) conditions.push(eq(users.isActive, filter.isActive));
  if (filter.q) {
    conditions.push(or(like(users.name, `%${filter.q}%`), like(users.email, `%${filter.q}%`)));
  }
  const limit = Math.min(Math.max(filter.limit ?? 20, 1), 100);
  const page = Math.max(filter.page ?? 1, 1);
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const [countRows, rows] = await Promise.all([
    db.select({ n: sql<number>`count(*)` }).from(users).where(where),
    db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        isActive: users.isActive,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(where)
      .orderBy(desc(users.id))
      .limit(limit)
      .offset((page - 1) * limit),
  ]);
  return { items: rows, total: Number(countRows[0]?.n ?? 0) };
};

// ---------- Ringkasan badge sidebar admin ----------

export interface AdminOverview {
  totalStudents: number;
  totalTeachers: number;
  totalCourses: number;
  totalCertificates: number;
}

/** Hitungan badge + kartu ringkasan admin: 4 agregat ringan paralel (tanpa daftar). */
export const getAdminOverview = async (): Promise<AdminOverview> => {
  const [userRows, courseRows, certRows] = await Promise.all([
    db
      .select({ role: users.role, n: sql<number>`count(*)` })
      .from(users)
      .groupBy(users.role),
    db.select({ n: sql<number>`count(*)` }).from(courses),
    db
      .select({ n: sql<number>`count(*)` })
      .from(certificates)
      .where(eq(certificates.status, "issued")),
  ]);
  const byRole = new Map(userRows.map((r) => [r.role as string, Number(r.n)]));
  return {
    totalStudents: byRole.get("student") ?? 0,
    totalTeachers: byRole.get("teacher") ?? 0,
    totalCourses: Number(courseRows[0]?.n ?? 0),
    totalCertificates: Number(certRows[0]?.n ?? 0),
  };
};

// ---------- Detail satu pengguna ----------

export interface AdminUserDetail extends PublicUser {
  enrollmentCount: number;
  certificateCount: number;
}

/** Detail pengguna untuk halaman admin (tanpa passwordHash). */
export const getUserById = async (id: number): Promise<AdminUserDetail> => {
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      isActive: users.isActive,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  const user = rows[0];
  if (!user) {
    throw new AdminError(404, "USER_NOT_FOUND", "Pengguna tidak ditemukan");
  }
  const [enrRows, certRows] = await Promise.all([
    db
      .select({ n: sql<number>`count(*)` })
      .from(enrollments)
      .where(eq(enrollments.userId, id)),
    db
      .select({ n: sql<number>`count(*)` })
      .from(certificates)
      .where(eq(certificates.userId, id)),
  ]);
  return {
    ...user,
    enrollmentCount: Number(enrRows[0]?.n ?? 0),
    certificateCount: Number(certRows[0]?.n ?? 0),
  };
};

// ---------- Buat akun instruktur ----------

export const createTeacher = async (
  actorId: number,
  input: z.infer<typeof createTeacherSchema>
): Promise<PublicUser> => {
  const email = input.email.toLowerCase();
  const dup = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (dup[0]) {
    throw new AdminError(409, "EMAIL_TAKEN", "Email sudah terdaftar");
  }
  const passwordHash = await bcrypt.hash(input.password, 12);
  const created = await db.transaction(async (tx) => {
    const [h] = await tx.insert(users).values({
      name: input.name,
      email,
      passwordHash,
      role: "teacher",
      isActive: true,
    });
    const id = Number((h as unknown as { insertId: number }).insertId);
    await writeAuditLog(tx, {
      actorUserId: actorId,
      action: "user.create",
      targetType: "user",
      targetIdInt: id,
      metadata: { userId: id, email, role: "teacher" },
    });
    const fresh = await tx
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        isActive: users.isActive,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    return fresh[0] ?? null;
  });
  if (!created) throw new Error("Gagal membuat akun instruktur");
  return created;
};

// ---------- Aktif / nonaktif akun ----------

export const setUserActive = async (
  actorId: number,
  targetId: number,
  isActive: boolean
): Promise<PublicUser> => {
  if (targetId === actorId) {
    throw new AdminError(
      400,
      "CANNOT_SELF",
      "Tidak dapat mengubah status akun sendiri"
    );
  }
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, targetId))
    .limit(1);
  if (!rows[0]) {
    throw new AdminError(404, "USER_NOT_FOUND", "Pengguna tidak ditemukan");
  }
  const updated = await db.transaction(async (tx) => {
    await tx.update(users).set({ isActive }).where(eq(users.id, targetId));
    await writeAuditLog(tx, {
      actorUserId: actorId,
      action: isActive ? "user.enable" : "user.disable",
      targetType: "user",
      targetIdInt: targetId,
      metadata: { userId: targetId, isActive },
    });
    const fresh = await tx
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        isActive: users.isActive,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, targetId))
      .limit(1);
    return fresh[0] ?? null;
  });
  if (!updated) throw new Error("Gagal memperbarui akun");
  return updated;
};

// ---------- Penugasan instruktur ----------

export const assignInstructor = async (
  actorId: number,
  courseId: number,
  input: z.infer<typeof assignInstructorSchema>
) => {
  const course = await db
    .select({ id: courses.id, title: courses.title })
    .from(courses)
    .where(eq(courses.id, courseId))
    .limit(1);
  if (!course[0]) {
    throw new AdminError(404, "COURSE_NOT_FOUND", "Kursus tidak ditemukan");
  }
  const target =
    input.userId !== undefined
      ? (
          await db
            .select({ id: users.id, email: users.email, role: users.role })
            .from(users)
            .where(eq(users.id, input.userId))
            .limit(1)
        )[0]
      : (
          await db
            .select({ id: users.id, email: users.email, role: users.role })
            .from(users)
            .where(eq(users.email, input.email!.toLowerCase()))
            .limit(1)
        )[0];
  if (!target) {
    throw new AdminError(404, "USER_NOT_FOUND", "Pengguna target tidak ditemukan");
  }
  if (target.role !== "teacher" && target.role !== "admin") {
    throw new AdminError(
      400,
      "NOT_TEACHER",
      "Hanya akun teacher/admin yang dapat ditugaskan sebagai pengampu"
    );
  }
  await db.transaction(async (tx) => {
    await tx
      .insert(courseInstructors)
      .values({ courseId, userId: target.id })
      .onDuplicateKeyUpdate({ set: { userId: target.id } });
    await writeAuditLog(tx, {
      actorUserId: actorId,
      action: "instructor.assign",
      targetType: "course",
      targetIdInt: courseId,
      metadata: { courseId, userId: target.id, email: target.email },
    });
  });
  return { courseId, userId: target.id, email: target.email, role: target.role };
};

export const unassignInstructor = async (
  actorId: number,
  courseId: number,
  targetId: number
) => {
  const course = await db
    .select({ id: courses.id })
    .from(courses)
    .where(eq(courses.id, courseId))
    .limit(1);
  if (!course[0]) {
    throw new AdminError(404, "COURSE_NOT_FOUND", "Kursus tidak ditemukan");
  }
  const link = await db
    .select({ userId: courseInstructors.userId })
    .from(courseInstructors)
    .where(
      and(
        eq(courseInstructors.courseId, courseId),
        eq(courseInstructors.userId, targetId)
      )
    )
    .limit(1);
  if (!link[0]) {
    throw new AdminError(
      404,
      "ASSIGNMENT_NOT_FOUND",
      "Penugasan tidak ditemukan"
    );
  }
  await db.transaction(async (tx) => {
    await tx
      .delete(courseInstructors)
      .where(
        and(
          eq(courseInstructors.courseId, courseId),
          eq(courseInstructors.userId, targetId)
        )
      );
    await writeAuditLog(tx, {
      actorUserId: actorId,
      action: "instructor.unassign",
      targetType: "course",
      targetIdInt: courseId,
      metadata: { courseId, userId: targetId },
    });
  });
  return { courseId, userId: targetId, removed: true };
};
