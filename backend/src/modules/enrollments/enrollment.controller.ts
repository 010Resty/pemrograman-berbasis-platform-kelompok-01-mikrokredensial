import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware";
import {
  EnrollmentError,
  enrollFree,
  getAccessState,
  grantAccessSchema,
  grantManualAccess,
  listMyEnrollments,
  revokeAccessSchema,
  revokeManualAccess,
} from "./enrollment.service";

const uid = (req: AuthenticatedRequest): number | null => {
  const id = Number(req.user?.id);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const needAuth = (req: AuthenticatedRequest, res: Response): number | null => {
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

const enrollmentError = (res: Response, e: unknown): boolean => {
  if (e instanceof EnrollmentError) {
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

// POST /api/v1/courses/:id/enroll — daftar mandiri (gratis, published, periode terbuka).
export const enrollHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = needAuth(req, res);
    if (userId === null) return;
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
    try {
      const result = await enrollFree(userId, courseId);
      res.status(result.reactivated ? 200 : 201).json({
        status: "success",
        message: result.reactivated
          ? "Pendaftaran diaktifkan kembali."
          : "Berhasil mendaftar kursus.",
        data: result,
      });
    } catch (e) {
      if (!enrollmentError(res, e)) throw e;
    }
  } catch (e) {
    next(e);
  }
};

// GET /api/v1/courses/:id/access — status akses saya untuk kursus ini.
export const accessHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = needAuth(req, res);
    if (userId === null) return;
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
    const state = await getAccessState(userId, req.user?.role ?? "", courseId);
    if (!state) {
      res.status(404).json({
        status: "error",
        message: "Kursus tidak ditemukan",
        code: "COURSE_NOT_FOUND",
        data: null,
      });
      return;
    }
    res.status(200).json({
      status: "success",
      message: "Status akses kursus",
      data: state,
    });
  } catch (e) {
    next(e);
  }
};

// GET /api/v1/me/enrollments — daftar kursus yang saya ikuti.
export const myEnrollmentsHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = needAuth(req, res);
    if (userId === null) return;
    res.status(200).json({
      status: "success",
      message: "Kursus yang saya ikuti",
      data: await listMyEnrollments(userId),
    });
  } catch (e) {
    next(e);
  }
};

// POST /api/v1/admin/courses/:id/grants — admin memberi akses manual + alasan.
export const grantHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const actorId = needAuth(req, res);
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
    const parsed = grantAccessSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        status: "error",
        message: "Data pemberian akses tidak valid",
        errors: toFieldErrors(parsed.error.issues),
        data: null,
      });
      return;
    }
    try {
      const result = await grantManualAccess(actorId, courseId, parsed.data);
      res.status(201).json({
        status: "success",
        message: "Akses kursus diberikan.",
        data: result,
      });
    } catch (e) {
      if (!enrollmentError(res, e)) throw e;
    }
  } catch (e) {
    next(e);
  }
};

// POST /api/v1/admin/courses/:id/revoke — admin mencabut akses + alasan wajib.
export const revokeHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const actorId = needAuth(req, res);
    if (actorId === null) return;
    const courseId = Number(req.params.id);
    const targetUserId = Number(req.params.userId);
    if (
      !Number.isInteger(courseId) ||
      courseId <= 0 ||
      !Number.isInteger(targetUserId) ||
      targetUserId <= 0
    ) {
      res.status(404).json({
        status: "error",
        message: "Data tidak ditemukan",
        code: "NOT_FOUND",
        data: null,
      });
      return;
    }
    const parsed = revokeAccessSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({
        status: "error",
        message: "Alasan pencabutan wajib diisi (min. 5 karakter)",
        errors: toFieldErrors(parsed.error.issues),
        data: null,
      });
      return;
    }
    try {
      const result = await revokeManualAccess(
        actorId,
        courseId,
        targetUserId,
        parsed.data.reason
      );
      res.status(200).json({
        status: "success",
        message: "Akses kursus dicabut.",
        data: result,
      });
    } catch (e) {
      if (!enrollmentError(res, e)) throw e;
    }
  } catch (e) {
    next(e);
  }
};
