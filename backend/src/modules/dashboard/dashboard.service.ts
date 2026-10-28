import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../../db";
import {
  courseInstructors,
  courses,
  enrollments,
  materials,
  modules,
  progress,
  submissions,
  users,
} from "../../db/schema";

export interface DashboardCourse {
  id: number;
  title: string;
  status: "draft" | "published" | "archived";
  studentCount: number;
  pendingCount: number;
  avgProgress: number;
}

export interface DashboardPendingReview {
  submissionId: number;
  studentName: string;
  courseId: number;
  courseTitle: string;
  materialId: number;
  materialTitle: string;
  submittedAt: string;
}

export interface DashboardTotals {
  activeCourses: number;
  draftCourses: number;
  totalStudents: number;
  pendingReviews: number;
}

export interface InstructorDashboard {
  courses: DashboardCourse[];
  pendingReviews: DashboardPendingReview[];
  totals: DashboardTotals;
}

const ACTIVE_ENROLLMENT = ["active", "completed"] as const;

/** Id kursus yang dikelola viewer (admin: semua). */
const managedCourseIds = async (
  userId: number,
  role: string | undefined
): Promise<number[]> => {
  if (role === "admin") {
    const all = await db.select({ id: courses.id }).from(courses);
    return all.map((r) => r.id);
  }
  const a = await db
    .select({ id: courseInstructors.courseId })
    .from(courseInstructors)
    .where(eq(courseInstructors.userId, userId));
  const b = await db
    .select({ id: courses.id })
    .from(courses)
    .where(eq(courses.createdBy, userId));
  return [...new Set([...a.map((r) => r.id), ...b.map((r) => r.id)])];
};

const emptyDashboard = (): InstructorDashboard => ({
  courses: [],
  pendingReviews: [],
  totals: { activeCourses: 0, draftCourses: 0, totalStudents: 0, pendingReviews: 0 },
});

/** Ringkasan dasbor instruktur — murni dari database (tanpa data contoh). */
export const getInstructorDashboard = async (
  viewerId: number,
  role: string | undefined
): Promise<InstructorDashboard> => {
  const ids = await managedCourseIds(viewerId, role);
  if (ids.length === 0) return emptyDashboard();

  // Paralel: 5 agregat independen jalan bersamaan, bukan sekuensial (5×RTT -> 1×RTT).
  const [courseRows, studentRows, pendingRows, materialRows, doneRows] = await Promise.all([
    db
      .select({ id: courses.id, title: courses.title, status: courses.status })
      .from(courses)
      .where(inArray(courses.id, ids)),
    // Peserta aktif per kursus.
    db
      .select({
        courseId: enrollments.courseId,
        count: sql<number>`count(*)`,
      })
      .from(enrollments)
      .where(
        and(
          inArray(enrollments.courseId, ids),
          inArray(enrollments.status, [...ACTIVE_ENROLLMENT])
        )
      )
      .groupBy(enrollments.courseId),
    // Tugas menunggu dinilai (status 'submitted') per kursus.
    db
      .select({
        courseId: modules.courseId,
        count: sql<number>`count(*)`,
      })
      .from(submissions)
      .innerJoin(materials, eq(submissions.materialId, materials.id))
      .innerJoin(modules, eq(materials.moduleId, modules.id))
      .where(
        and(
          inArray(modules.courseId, ids),
          eq(submissions.status, "submitted")
        )
      )
      .groupBy(modules.courseId),
    // Jumlah materi per kursus (penyebut progres).
    db
      .select({
        courseId: modules.courseId,
        count: sql<number>`count(*)`,
      })
      .from(materials)
      .innerJoin(modules, eq(materials.moduleId, modules.id))
      .where(inArray(modules.courseId, ids))
      .groupBy(modules.courseId),
    // Materi selesai milik peserta aktif per kursus (pembilang progres).
    db
      .select({
        courseId: modules.courseId,
        count: sql<number>`count(*)`,
      })
      .from(progress)
      .innerJoin(materials, eq(progress.materialId, materials.id))
      .innerJoin(modules, eq(materials.moduleId, modules.id))
      .innerJoin(
        enrollments,
        and(
          eq(enrollments.userId, progress.userId),
          eq(enrollments.courseId, modules.courseId),
          inArray(enrollments.status, [...ACTIVE_ENROLLMENT])
        )
      )
      .where(inArray(modules.courseId, ids))
      .groupBy(modules.courseId),
  ]);
  const studentsByCourse = new Map(studentRows.map((r) => [r.courseId, Number(r.count)]));
  const pendingByCourse = new Map(pendingRows.map((r) => [r.courseId, Number(r.count)]));
  const materialsByCourse = new Map(materialRows.map((r) => [r.courseId, Number(r.count)]));
  const doneByCourse = new Map(doneRows.map((r) => [r.courseId, Number(r.count)]));

  const courseList: DashboardCourse[] = courseRows.map((c) => {
    const students = studentsByCourse.get(c.id) ?? 0;
    const totalMats = materialsByCourse.get(c.id) ?? 0;
    const done = doneByCourse.get(c.id) ?? 0;
    const avgProgress =
      students > 0 && totalMats > 0
        ? Math.round((done / (students * totalMats)) * 100)
        : 0;
    return {
      id: c.id,
      title: c.title,
      status: c.status,
      studentCount: students,
      pendingCount: pendingByCourse.get(c.id) ?? 0,
      avgProgress: Math.min(100, Math.max(0, avgProgress)),
    };
  });
  courseList.sort((x, y) => y.pendingCount - x.pendingCount || y.studentCount - x.studentCount);

  // 5 pengumpulan terbaru yang menunggu dinilai.
  const reviewRows = await db
    .select({
      submissionId: submissions.id,
      studentName: users.name,
      courseId: modules.courseId,
      courseTitle: courses.title,
      materialId: materials.id,
      materialTitle: materials.title,
      submittedAt: submissions.submittedAt,
    })
    .from(submissions)
    .innerJoin(users, eq(submissions.userId, users.id))
    .innerJoin(materials, eq(submissions.materialId, materials.id))
    .innerJoin(modules, eq(materials.moduleId, modules.id))
    .innerJoin(courses, eq(modules.courseId, courses.id))
    .where(
      and(
        inArray(modules.courseId, ids),
        eq(submissions.status, "submitted")
      )
    )
    .orderBy(desc(submissions.submittedAt))
    .limit(5);
  const pendingReviews: DashboardPendingReview[] = reviewRows.map((r) => ({
    submissionId: r.submissionId,
    studentName: r.studentName,
    courseId: r.courseId,
    courseTitle: r.courseTitle,
    materialId: r.materialId,
    materialTitle: r.materialTitle,
    submittedAt:
      r.submittedAt instanceof Date ? r.submittedAt.toISOString() : String(r.submittedAt),
  }));

  const totals: DashboardTotals = {
    activeCourses: courseRows.filter((c) => c.status === "published").length,
    draftCourses: courseRows.filter((c) => c.status === "draft").length,
    totalStudents: [...studentsByCourse.values()].reduce((n, v) => n + v, 0),
    pendingReviews: [...pendingByCourse.values()].reduce((n, v) => n + v, 0),
  };

  return { courses: courseList, pendingReviews, totals };
};
