import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware";
import {
  canReadCourseTree,
  getCourseOfMaterial,
  getMaterial,
} from "../courses/curricula.service";
import {
  listMaterialIdsOfCourse,
  listMine,
  markComplete,
  unmarkComplete,
} from "./progress.service";

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

/** Guard baca/tulis progres: materi harus ada dan pohon kursusnya boleh dibaca
 * (published untuk semua peran; draft hanya admin/pengelola).
 * Selalu 404 agar struktur kursus non-publik tidak bocor (anti-enumerasi),
 * selaras pola modul kurikulum. */
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
  const mat = await getMaterial(materialId);
  if (!mat) {
    notFound(res);
    return null;
  }
  const courseId = await getCourseOfMaterial(materialId);
  if (courseId === null) {
    notFound(res);
    return null;
  }
  const verdict = await canReadCourseTree(userId, req.user?.role ?? "", courseId);
  if (verdict !== "ok") {
    notFound(res);
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
    const materialId = Number(req.params.id);
    if (!Number.isInteger(materialId) || materialId <= 0) {
      notFound(res);
      return;
    }
    const userId = await guardMaterial(req, res, materialId);
    if (userId === null) return;
    const { alreadyCompleted } = await markComplete(userId, materialId);
    res.status(200).json({
      status: "success",
      message: alreadyCompleted ? "Progres sudah tercatat." : "Materi ditandai selesai.",
      data: { materialId, completed: true, alreadyCompleted },
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
    const materialId = Number(req.params.id);
    if (!Number.isInteger(materialId) || materialId <= 0) {
      notFound(res);
      return;
    }
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
    const courseId = Number(rawCourse);
    if (!Number.isInteger(courseId) || courseId <= 0) {
      res.status(400).json({
        status: "error",
        message: "ID kursus tidak valid",
        data: null,
      });
      return;
    }
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
