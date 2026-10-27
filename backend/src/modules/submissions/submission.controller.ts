import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware";
import {
  SubmissionError,
  createSubmission,
  getSubmission,
  getTaskStatus,
  gradeInputSchema,
  gradeSubmission,
  listSubmissions,
  submitInputSchema,
} from "./submission.service";

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

const submissionError = (res: Response, e: unknown): boolean => {
  if (e instanceof SubmissionError) {
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

const validMaterialId = (req: AuthenticatedRequest, res: Response): number | null => {
  const materialId = Number(req.params.id);
  if (!Number.isInteger(materialId) || materialId <= 0) {
    res.status(404).json({
      status: "error",
      message: "Materi tidak ditemukan",
      code: "MATERIAL_NOT_FOUND",
      data: null,
    });
    return null;
  }
  return materialId;
};

// POST /api/v1/materials/:id/submissions — kumpul tugas (baris riwayat baru).
export const submitHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = needAuth(req, res);
    if (userId === null) return;
    const materialId = validMaterialId(req, res);
    if (materialId === null) return;
    const parsed = submitInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        status: "error",
        message: "Data pengumpulan tidak valid",
        errors: toFieldErrors(parsed.error.issues),
        data: null,
      });
      return;
    }
    try {
      const row = await createSubmission(
        userId,
        req.user?.role ?? "",
        materialId,
        parsed.data
      );
      res.status(201).json({
        status: "success",
        message: "Tugas berhasil dikumpulkan.",
        data: row,
      });
    } catch (e) {
      if (!submissionError(res, e)) throw e;
    }
  } catch (e) {
    next(e);
  }
};

// GET /api/v1/materials/:id/submissions[?userId=] — riwayat (milik sendiri / semua bila pengelola).
export const listHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = needAuth(req, res);
    if (userId === null) return;
    const materialId = validMaterialId(req, res);
    if (materialId === null) return;
    const rawUser = req.query.userId;
    const filterUserId =
      typeof rawUser === "string" && rawUser !== "" ? Number(rawUser) : undefined;
    if (filterUserId !== undefined && (!Number.isInteger(filterUserId) || filterUserId <= 0)) {
      res.status(400).json({
        status: "error",
        message: "ID pengguna tidak valid",
        data: null,
      });
      return;
    }
    try {
      const result = await listSubmissions(
        userId,
        req.user?.role ?? "",
        materialId,
        filterUserId !== undefined ? { userId: filterUserId } : {}
      );
      res.status(200).json({
        status: "success",
        message: "Riwayat pengumpulan tugas",
        data: result,
      });
    } catch (e) {
      if (!submissionError(res, e)) throw e;
    }
  } catch (e) {
    next(e);
  }
};

// GET /api/v1/materials/:id/submissions/status — ringkasan kelulusan milik sendiri.
export const statusHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = needAuth(req, res);
    if (userId === null) return;
    const materialId = validMaterialId(req, res);
    if (materialId === null) return;
    try {
      res.status(200).json({
        status: "success",
        message: "Status kelulusan tugas",
        data: await getTaskStatus(userId, req.user?.role ?? "", materialId),
      });
    } catch (e) {
      if (!submissionError(res, e)) throw e;
    }
  } catch (e) {
    next(e);
  }
};

// GET /api/v1/materials/:id/submissions/:subId — detail satu submission.
export const detailHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = needAuth(req, res);
    if (userId === null) return;
    const materialId = validMaterialId(req, res);
    if (materialId === null) return;
    const submissionId = Number(req.params.subId);
    if (!Number.isInteger(submissionId) || submissionId <= 0) {
      res.status(404).json({
        status: "error",
        message: "Submission tidak ditemukan",
        code: "SUBMISSION_NOT_FOUND",
        data: null,
      });
      return;
    }
    try {
      res.status(200).json({
        status: "success",
        message: "Detail submission",
        data: await getSubmission(userId, req.user?.role ?? "", materialId, submissionId),
      });
    } catch (e) {
      if (!submissionError(res, e)) throw e;
    }
  } catch (e) {
    next(e);
  }
};

// POST /api/v1/materials/:id/submissions/:subId/grade — nilai + umpan balik (pengelola).
export const gradeHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = needAuth(req, res);
    if (userId === null) return;
    const materialId = validMaterialId(req, res);
    if (materialId === null) return;
    const submissionId = Number(req.params.subId);
    if (!Number.isInteger(submissionId) || submissionId <= 0) {
      res.status(404).json({
        status: "error",
        message: "Submission tidak ditemukan",
        code: "SUBMISSION_NOT_FOUND",
        data: null,
      });
      return;
    }
    const parsed = gradeInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        status: "error",
        message: "Data penilaian tidak valid",
        errors: toFieldErrors(parsed.error.issues),
        data: null,
      });
      return;
    }
    try {
      const row = await gradeSubmission(
        userId,
        req.user?.role ?? "",
        materialId,
        submissionId,
        parsed.data
      );
      res.status(200).json({
        status: "success",
        message: "Penilaian tersimpan.",
        data: row,
      });
    } catch (e) {
      if (!submissionError(res, e)) throw e;
    }
  } catch (e) {
    next(e);
  }
};
