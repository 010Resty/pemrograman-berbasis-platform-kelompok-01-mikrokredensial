import { Request, Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware";
import {
  createCourseSchema,
  updateCourseSchema,
  courseListQuerySchema,
  createCourse,
  getCourseById,
  listCourses,
  listMyCourses,
  updateCourse,
  deleteCourse,
  parseCoverFileId,
  canManageCourse,
} from "./course.service";
import { deleteFileById } from "../uploads/upload.service";

const toFieldErrors = (
  issues: Array<{ path: Array<string | number>; message: string }>
) => issues.map((i) => ({ field: i.path.length > 0 ? String(i.path[0]) : "body", message: i.message }));

// POST /api/v1/courses — buat kursus (teacher, admin). Selalu draft.
export const create = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = Number(req.user?.id);
    if (!Number.isInteger(userId) || userId <= 0) {
      res.status(401).json({ status: "error", message: "Token autentikasi diperlukan", data: null });
      return;
    }
    const parsed = createCourseSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        status: "error",
        message: "Data kursus tidak valid",
        errors: toFieldErrors(parsed.error.issues),
        data: null,
      });
      return;
    }
    const course = await createCourse(userId, parsed.data);
    res.status(201).json({ status: "success", message: "Kursus berhasil dibuat", data: course });
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/courses — katalog publik (hanya published).
// Mendukung ?category ?period ?q ?limit ?page ?sort (REST pagination).
export const listPublic = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const parsed = courseListQuerySchema.safeParse(req.query);
    const q = parsed.success
      ? parsed.data
      : { limit: 20 as number, page: 1 as number, sort: "newest" as const };
    const data = await listCourses(
      {
        category: typeof req.query.category === "string" ? req.query.category : undefined,
        period: typeof req.query.period === "string" ? req.query.period : undefined,
        q: typeof req.query.q === "string" ? req.query.q : undefined,
      },
      true,
      { limit: q.limit, page: q.page, sort: q.sort }
    );
    res.status(200).json({ status: "success", message: "Daftar kursus", data });
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/instructor/courses — milik saya (teacher) / semua (admin + ?scope=all).
export const listMine = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = Number(req.user?.id);
    const role = req.user?.role;
    if (!Number.isInteger(userId) || userId <= 0) {
      res.status(401).json({ status: "error", message: "Token autentikasi diperlukan", data: null });
      return;
    }
    let data;
    const parsed = courseListQuerySchema.safeParse(req.query);
    const pg = parsed.success
      ? { limit: parsed.data.limit, page: parsed.data.page, sort: parsed.data.sort }
      : undefined;
    if (role === "admin" && req.query.scope !== "mine") {
      const status =
        typeof req.query.status === "string" &&
        ["draft", "published", "archived"].includes(req.query.status)
          ? (req.query.status as "draft" | "published" | "archived")
          : undefined;
      data = await listCourses(
        {
          category: typeof req.query.category === "string" ? req.query.category : undefined,
          period: typeof req.query.period === "string" ? req.query.period : undefined,
          q: typeof req.query.q === "string" ? req.query.q : undefined,
          status,
        },
        false,
        pg
      );
    } else {
      data = await listMyCourses(userId, pg);
    }
    res.status(200).json({ status: "success", message: "Daftar kursus saya", data });
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/courses/:id — detail (+daftar pengampu).
// Non-published: hanya admin/pengelola.
export const detail = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(404).json({ status: "error", message: "Kursus tidak ditemukan", data: null });
      return;
    }
    const course = await getCourseById(id);
    if (!course) {
      res.status(404).json({ status: "error", message: "Kursus tidak ditemukan", data: null });
      return;
    }
    if (course.status !== "published") {
      const userId = Number(req.user?.id);
      const role = req.user?.role ?? "";
      if (!Number.isInteger(userId) || !(await canManageCourse(userId, role, id))) {
        res.status(404).json({ status: "error", message: "Kursus tidak ditemukan", data: null });
        return;
      }
    }
    res.status(200).json({ status: "success", message: "Detail kursus", data: course });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/v1/courses/:id — ubah info + status (admin, pemilik/pengampu).
export const update = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(404).json({ status: "error", message: "Kursus tidak ditemukan", data: null });
      return;
    }
    const userId = Number(req.user?.id);
    const role = req.user?.role ?? "";
    if (!Number.isInteger(userId) || !(await canManageCourse(userId, role, id))) {
      const exists = await getCourseById(id);
      res
        .status(exists ? 403 : 404)
        .json({
          status: "error",
          message: exists ? "Akses ditolak untuk peran ini" : "Kursus tidak ditemukan",
          data: null,
        });
      return;
    }
    const parsed = updateCourseSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        status: "error",
        message: "Data kursus tidak valid",
        errors: toFieldErrors(parsed.error.issues),
        data: null,
      });
      return;
    }
    const course = await updateCourse(id, parsed.data);
    if (!course) {
      res.status(404).json({ status: "error", message: "Kursus tidak ditemukan", data: null });
      return;
    }
    res.status(200).json({ status: "success", message: "Kursus berhasil diubah", data: course });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/v1/courses/:id — hapus kursus + tree (admin, pemilik/pengampu).
// Cover internal ikut dibersihkan best-effort agar tidak yatim di disk.
export const remove = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(404).json({ status: "error", message: "Kursus tidak ditemukan", data: null });
      return;
    }
    const userId = Number(req.user?.id);
    const role = req.user?.role ?? "";
    if (!Number.isInteger(userId) || !(await canManageCourse(userId, role, id))) {
      const exists = await getCourseById(id);
      res
        .status(exists ? 403 : 404)
        .json({
          status: "error",
          message: exists ? "Akses ditolak untuk peran ini" : "Kursus tidak ditemukan",
          data: null,
        });
      return;
    }
    const { coverUrl } = await deleteCourse(id);
    const coverFileId = parseCoverFileId(coverUrl);
    if (coverFileId !== null) {
      await deleteFileById(coverFileId);
    }
    res.status(200).json({ status: "success", message: "Kursus dihapus", data: null });
  } catch (error) {
    next(error);
  }
};
