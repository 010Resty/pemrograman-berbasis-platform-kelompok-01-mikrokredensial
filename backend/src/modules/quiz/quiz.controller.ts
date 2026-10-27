import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware";
import {
  getCourseOfMaterial,
  getMaterial,
} from "../courses/curricula.service";
import { resolveLearningGuard } from "../enrollments/enrollment.service";
import { canManageCourse } from "../courses/course.service";
import {
  QuizInputError,
  getBest,
  getHistory,
  getQuizForTaking,
  gradeAttempt,
  quizAttemptInputSchema,
  quizSetInputSchema,
  replaceQuiz,
} from "./quiz.service";

const uid = (req: AuthenticatedRequest): number | null => {
  const id = Number(req.user?.id);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const notFound = (res: Response) =>
  res.status(404).json({
    status: "error",
    message: "Data tidak ditemukan",
    data: null,
  });

const toFieldErrors = (
  issues: Array<{ path: Array<string | number>; message: string }>
) => issues.map((i) => ({ field: i.path.length > 0 ? String(i.path[0]) : "body", message: i.message }));

/** Guard akses kuis peserta: materi ada + pohon boleh dibaca + hak akses belajar.
 * Draft asing disamarkan 404; tanpa akses belajar ditolak 403 (NO_ACCESS). */
async function guardRead(
  req: AuthenticatedRequest,
  res: Response,
  materialId: number
): Promise<number | null> {
  const userId = uid(req);
  if (userId === null) {
    res.status(401).json({
      status: "error",
      message: "Token autentikasi diperlukan",
      data: null,
    });
    return null;
  }
  const guard = await resolveLearningGuard(
    userId,
    req.user?.role ?? "",
    materialId
  );
  if (guard.status === "not-found") {
    notFound(res);
    return null;
  }
  if (guard.status === "no-access") {
    res.status(403).json({
      status: "error",
      message: "Anda tidak memiliki akses ke kursus ini",
      code: "NO_ACCESS",
      data: null,
    });
    return null;
  }
  return userId;
}

/** Guard tulis soal: teacher/admin pengelola kursus (pola kurikulum). */
async function guardManage(
  req: AuthenticatedRequest,
  res: Response,
  materialId: number
): Promise<number | null> {
  const userId = uid(req);
  const role = req.user?.role ?? "";
  if (userId === null) {
    res.status(401).json({
      status: "error",
      message: "Token autentikasi diperlukan",
      data: null,
    });
    return null;
  }
  const mat = await getMaterial(materialId);
  if (!mat) {
    notFound(res);
    return null;
  }
  const courseId = await getCourseOfMaterial(materialId);
  if (courseId === null || !(await canManageCourse(userId, role, courseId))) {
    const exists = await getMaterial(materialId);
    res.status(exists ? 403 : 404).json({
      status: "error",
      message: exists ? "Akses ditolak untuk peran ini" : "Data tidak ditemukan",
      data: null,
    });
    return null;
  }
  return userId;
}

const quizError = (res: Response, e: unknown): boolean => {
  if (e instanceof QuizInputError) {
    if (e.message === "__NOT_FOUND__") {
      notFound(res);
      return true;
    }
    res.status(400).json({ status: "error", message: e.message, data: null });
    return true;
  }
  return false;
};

// GET /api/v1/materials/:id/quiz — soal untuk peserta (tanpa kunci/pembahasan).
export const getQuizHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const materialId = Number(req.params.id);
    if (!Number.isInteger(materialId) || materialId <= 0) {
      notFound(res);
      return;
    }
    const userId = await guardRead(req, res, materialId);
    if (userId === null) return;
    try {
      const questions = await getQuizForTaking(materialId);
      res.status(200).json({
        status: "success",
        message: "Soal kuis",
        data: { materialId, questions },
      });
    } catch (e) {
      if (!quizError(res, e)) throw e;
    }
  } catch (e) {
    next(e);
  }
};

// PUT /api/v1/materials/:id/quiz — ganti set soal (teacher pengelola/admin).
export const putQuizHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const materialId = Number(req.params.id);
    if (!Number.isInteger(materialId) || materialId <= 0) {
      notFound(res);
      return;
    }
    const userId = await guardManage(req, res, materialId);
    if (userId === null) return;
    const parsed = quizSetInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        status: "error",
        message: "Data soal kuis tidak valid",
        errors: toFieldErrors(parsed.error.issues),
        data: null,
      });
      return;
    }
    try {
      const questions = await replaceQuiz(materialId, parsed.data);
      res.status(200).json({
        status: "success",
        message: "Soal kuis disimpan.",
        data: { materialId, questions },
      });
    } catch (e) {
      if (!quizError(res, e)) throw e;
    }
  } catch (e) {
    next(e);
  }
};

// POST /api/v1/materials/:id/quiz-attempts — kirim jawaban, dinilai server.
export const attemptHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const materialId = Number(req.params.id);
    if (!Number.isInteger(materialId) || materialId <= 0) {
      notFound(res);
      return;
    }
    const userId = await guardRead(req, res, materialId);
    if (userId === null) return;
    const parsed = quizAttemptInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        status: "error",
        message: "Data jawaban tidak valid",
        errors: toFieldErrors(parsed.error.issues),
        data: null,
      });
      return;
    }
    try {
      const result = await gradeAttempt(userId, materialId, parsed.data);
      res.status(201).json({
        status: "success",
        message: result.attempt.passed
          ? "Percobaan tersimpan. Anda lulus."
          : "Percobaan tersimpan.",
        data: {
          attemptId: result.attempt.id,
          materialId,
          score: result.attempt.score,
          total: result.attempt.total,
          correct: result.attempt.correct,
          passScore: result.attempt.passScore,
          passed: result.attempt.passed,
          bestScore: result.bestScore,
          attempts: result.attempts,
          overallPassed: result.overallPassed,
        },
      });
    } catch (e) {
      if (!quizError(res, e)) throw e;
    }
  } catch (e) {
    next(e);
  }
};

// GET /api/v1/materials/:id/quiz-attempts — riwayat milik sendiri.
export const historyHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const materialId = Number(req.params.id);
    if (!Number.isInteger(materialId) || materialId <= 0) {
      notFound(res);
      return;
    }
    const userId = await guardRead(req, res, materialId);
    if (userId === null) return;
    try {
      res.status(200).json({
        status: "success",
        message: "Riwayat percobaan",
        data: await getHistory(userId, materialId),
      });
    } catch (e) {
      if (!quizError(res, e)) throw e;
    }
  } catch (e) {
    next(e);
  }
};

// GET /api/v1/materials/:id/quiz-best — nilai terbaik + status lulus persisten.
export const bestHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const materialId = Number(req.params.id);
    if (!Number.isInteger(materialId) || materialId <= 0) {
      notFound(res);
      return;
    }
    const userId = await guardRead(req, res, materialId);
    if (userId === null) return;
    try {
      res.status(200).json({
        status: "success",
        message: "Nilai terbaik kuis",
        data: await getBest(userId, materialId),
      });
    } catch (e) {
      if (!quizError(res, e)) throw e;
    }
  } catch (e) {
    next(e);
  }
};
