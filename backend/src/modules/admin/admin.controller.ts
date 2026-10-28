import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware";
import {
  AdminError,
  assignInstructor,
  assignInstructorSchema,
  createTeacher,
  createTeacherSchema,
  getAdminOverview,
  getUserById,
  listUsers,
  setActiveSchema,
  setUserActive,
  unassignInstructor,
} from "./admin.service";

const uid = (req: AuthenticatedRequest): number | null => {
  const id = Number(req.user?.id);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const adminError = (res: Response, e: unknown): boolean => {
  if (e instanceof AdminError) {
    res.status(e.http).json({
      status: "error",
      message: e.message,
      code: e.code,
      data: null,
    });
    return true;
  }
  return false;
};

const toFieldErrors = (
  issues: Array<{ path: Array<string | number>; message: string }>
) =>
  issues.map((i) => ({
    field: i.path.length > 0 ? String(i.path[0]) : "body",
    message: i.message,
  }));

const needAdmin = (req: AuthenticatedRequest, res: Response): number | null => {
  const userId = uid(req);
  if (userId === null) {
    res.status(401).json({
      status: "error",
      message: "Token autentikasi diperlukan",
      data: null,
    });
    return null;
  }
  return userId;
};

const num = (v: unknown): number | undefined => {
  if (typeof v !== "string" || v.trim() === "") return undefined;
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : undefined;
};

// GET /api/v1/admin/overview — hitungan badge sidebar admin.
export const overviewHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = needAdmin(req, res);
    if (userId === null) return;
    void userId;
    res.status(200).json({
      status: "success",
      message: "Ringkasan admin",
      data: await getAdminOverview(),
    });
  } catch (e) {
    next(e);
  }
};

// GET /api/v1/admin/users — daftar pengguna (tanpa password hash).
export const listUsersHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = needAdmin(req, res);
    if (userId === null) return;
    void userId;
    const q = req.query;
    const role = q.role === "student" || q.role === "teacher" || q.role === "admin" ? q.role : undefined;
    const isActive =
      q.isActive === "true" ? true : q.isActive === "false" ? false : undefined;
    const { items, total } = await listUsers({
      role,
      isActive,
      q: typeof q.q === "string" && q.q.trim() !== "" ? q.q.trim().slice(0, 100) : undefined,
      limit: num(q.limit),
      page: num(q.page),
    });
    res.status(200).json({
      status: "success",
      message: "Daftar pengguna",
      data: { items, total },
    });
  } catch (e) {
    next(e);
  }
};

// POST /api/v1/admin/users — buat akun instruktur.
export const createTeacherHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const actorId = needAdmin(req, res);
    if (actorId === null) return;
    const parsed = createTeacherSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        status: "error",
        message: "Data instruktur tidak valid",
        errors: toFieldErrors(parsed.error.issues),
        data: null,
      });
      return;
    }
    try {
      const user = await createTeacher(actorId, parsed.data);
      res.status(201).json({
        status: "success",
        message: "Akun instruktur berhasil dibuat.",
        data: user,
      });
    } catch (e) {
      if (!adminError(res, e)) throw e;
    }
  } catch (e) {
    next(e);
  }
};

// GET /api/v1/admin/users/:id — detail satu pengguna (tanpa password hash).
export const userDetailHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const adminId = needAdmin(req, res);
    if (adminId === null) return;
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(404).json({
        status: "error",
        message: "Pengguna tidak ditemukan",
        code: "USER_NOT_FOUND",
        data: null,
      });
      return;
    }
    try {
      res.status(200).json({
        status: "success",
        message: "Detail pengguna",
        data: await getUserById(id),
      });
    } catch (e) {
      if (!adminError(res, e)) throw e;
    }
  } catch (e) {
    next(e);
  }
};

// PATCH /api/v1/admin/users/:id — aktif/nonaktif akun.
export const setActiveHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const actorId = needAdmin(req, res);
    if (actorId === null) return;
    const targetId = Number(req.params.id);
    if (!Number.isInteger(targetId) || targetId <= 0) {
      res.status(404).json({
        status: "error",
        message: "Pengguna tidak ditemukan",
        code: "USER_NOT_FOUND",
        data: null,
      });
      return;
    }
    const parsed = setActiveSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        status: "error",
        message: "Data status tidak valid",
        errors: toFieldErrors(parsed.error.issues),
        data: null,
      });
      return;
    }
    try {
      res.status(200).json({
        status: "success",
        message: parsed.data.isActive ? "Akun diaktifkan." : "Akun dinonaktifkan.",
        data: await setUserActive(actorId, targetId, parsed.data.isActive),
      });
    } catch (e) {
      if (!adminError(res, e)) throw e;
    }
  } catch (e) {
    next(e);
  }
};

// POST /api/v1/admin/courses/:id/instructors — tugaskan pengampu.
export const assignHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const actorId = needAdmin(req, res);
    if (actorId === null) return;
    const courseId = Number(req.params.id);
    if (!Number.isInteger(courseId) || courseId <= 0) {
      res.status(404).json({
        status: "error",
        message: "Kursus tidak ditemukan",
        code: "COURSE_NOT_FOUND",
        data: null,
      });
      return;
    }
    const parsed = assignInstructorSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        status: "error",
        message: "Data penugasan tidak valid",
        errors: toFieldErrors(parsed.error.issues),
        data: null,
      });
      return;
    }
    try {
      res.status(201).json({
        status: "success",
        message: "Instruktur ditugaskan ke kursus.",
        data: await assignInstructor(actorId, courseId, parsed.data),
      });
    } catch (e) {
      if (!adminError(res, e)) throw e;
    }
  } catch (e) {
    next(e);
  }
};

// DELETE /api/v1/admin/courses/:id/instructors/:userId — lepas penugasan.
export const unassignHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const actorId = needAdmin(req, res);
    if (actorId === null) return;
    const courseId = Number(req.params.id);
    const targetId = Number(req.params.userId);
    if (
      !Number.isInteger(courseId) ||
      courseId <= 0 ||
      !Number.isInteger(targetId) ||
      targetId <= 0
    ) {
      res.status(404).json({
        status: "error",
        message: "Data tidak ditemukan",
        code: "NOT_FOUND",
        data: null,
      });
      return;
    }
    try {
      res.status(200).json({
        status: "success",
        message: "Penugasan instruktur dilepas.",
        data: await unassignInstructor(actorId, courseId, targetId),
      });
    } catch (e) {
      if (!adminError(res, e)) throw e;
    }
  } catch (e) {
    next(e);
  }
};
