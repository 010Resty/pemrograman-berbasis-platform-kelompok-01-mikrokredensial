import { Response, NextFunction } from "express";
import { z } from "zod";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware";
import { canReadCourseTree } from "../courses/curricula.service";
import { resolveLearningGuard } from "../enrollments/enrollment.service";
import {
  getMyProgressSummary,
  listMaterialIdsOfCourse,
  listMine,
  markComplete,
  unmarkComplete,
} from "./progress.service";
import { tryAutoIssueForMaterial } from "../certificates/certificate.service";

const uid = (req: AuthenticatedRequest): number | null => {
  const id = Number(req.user?.id);
  return Number.isInteger(id) && id > 0 ? id : null;
};

// Standar AGENTS: validasi Zod untuk param/query (dulu Number() manual).
const materialIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const courseQuerySchema = z.object({
  courseId: z.coerce.number().int().positive(),
});

const notFound = (res: Response) =>
  res.status(404).json({
    status: "error",
    message: "Data tidak ditemukan",
    data: null,
  });

/** Guard tulis progres: materi ada + pohon boleh dibaca + hak akses belajar.
 * Draft asing disamarkan 404; tanpa akses belajar ditolak 403 (NO_ACCESS). */
async function guardMaterial(
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

// POST /api/v1/materials/:id/progress — tandai selesai (idempoten, milik sendiri).
export const markHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const parsed = materialIdParamSchema.safeParse(req.params);
    if (!parsed.success) {
      notFound(res);
      return;
    }
    const materialId = parsed.data.id;
    const userId = await guardMaterial(req, res, materialId);
    if (userId === null) return;
    const { alreadyCompleted } = await markComplete(userId, materialId);
    // Sertifikat terbit otomatis bila modul ini baru saja lengkap.
    // Best-effort: tidak pernah menggagalkan respons progres.
    const auto = await tryAutoIssueForMaterial(userId, materialId);
    res.status(200).json({
      status: "success",
      message: alreadyCompleted ? "Progres sudah tercatat." : "Materi ditandai selesai.",
      data: { materialId, completed: true, alreadyCompleted, certificateIssued: auto.issued },
    });
  } catch (e) {
    next(e);
  }
};

// DELETE /api/v1/materials/:id/progress — batalkan tanda selesai (idempoten).
export const unmarkHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const parsed = materialIdParamSchema.safeParse(req.params);
    if (!parsed.success) {
      notFound(res);
      return;
    }
    const materialId = parsed.data.id;
    const userId = await guardMaterial(req, res, materialId);
    if (userId === null) return;
    const { removed } = await unmarkComplete(userId, materialId);
    res.status(200).json({
      status: "success",
      message: removed ? "Tanda selesai dihapus." : "Progres tidak tercatat.",
      data: null,
    });
  } catch (e) {
    next(e);
  }
};

// GET /api/v1/me/progress/summary — ringkasan "Progres Keseluruhan" dasbor user.
export const summaryHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = uid(req);
    if (userId === null) {
      res.status(401).json({
        status: "error",
        message: "Token autentikasi diperlukan",
        data: null,
      });
      return;
    }
    res.status(200).json({
      status: "success",
      message: "Ringkasan progres saya",
      data: await getMyProgressSummary(userId),
    });
  } catch (e) {
    next(e);
  }
};

// GET /api/v1/me/progress[?courseId=] — progres milik sendiri, opsional per kursus.
export const listHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = uid(req);
    if (userId === null) {
      res.status(401).json({
        status: "error",
        message: "Token autentikasi diperlukan",
        data: null,
      });
      return;
    }
    const rawCourse = req.query.courseId;
    if (rawCourse === undefined) {
      res.status(200).json({
        status: "success",
        message: "Progres saya",
        data: await listMine(userId),
      });
      return;
    }
    const parsedCourse = courseQuerySchema.safeParse({ courseId: rawCourse });
    if (!parsedCourse.success) {
      res.status(400).json({
        status: "error",
        message: "ID kursus tidak valid",
        data: null,
      });
      return;
    }
    const courseId = parsedCourse.data.courseId;
    const verdict = await canReadCourseTree(userId, req.user?.role ?? "", courseId);
    if (verdict !== "ok") {
      notFound(res);
      return;
    }
    const ids = await listMaterialIdsOfCourse(courseId);
    res.status(200).json({
      status: "success",
      message: "Progres saya",
      data: await listMine(userId, ids),
    });
  } catch (e) {
    next(e);
  }
};
