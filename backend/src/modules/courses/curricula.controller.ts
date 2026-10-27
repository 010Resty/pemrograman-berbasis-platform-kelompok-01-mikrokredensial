import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware";
import {
  moduleInputSchema,
  modulePatchSchema,
  subModuleInputSchema,
  subModulePatchSchema,
  materialInputSchema,
  materialPatchSchema,
  createModule,
  listModules,
  getModule,
  patchModule,
  deleteModule,
  createSubModule,
  listSubModules,
  getSubModule,
  patchSubModule,
  deleteSubModule,
  createMaterial,
  listMaterialsBySub,
  listMaterialsByModule,
  getMaterial,
  patchMaterial,
  deleteMaterial,
  getCourseOfModule,
  getCourseOfSubModule,
  getCourseOfMaterial,
  canReadCourseTree,
} from "./curricula.service";
import { canManageCourse } from "./course.service";
import { hasCourseAccess } from "../enrollments/enrollment.service";

const toFieldErrors = (
  issues: Array<{ path: Array<string | number>; message: string }>
) => issues.map((i) => ({ field: i.path.length > 0 ? String(i.path[0]) : "body", message: i.message }));

/** Struktur materi tanpa isi untuk pengintip katalog tanpa hak akses. */
const stripMaterialContent = <T extends { content?: unknown }>(mat: T): T => ({
  ...mat,
  content: null,
});

/** Hak akses belajar peminta untuk satu kursus (admin/pengelola/enrollment aktif). */
const checkLearningAccess = async (
  req: AuthenticatedRequest,
  courseId: number
): Promise<boolean> => {
  const userId = uid(req);
  if (userId === null) return false;
  return hasCourseAccess(userId, req.user?.role ?? "", courseId);
};

/** 403 terstandar untuk peminta terautentikasi tanpa hak akses kursus. */
const denyNoAccess = (res: Response) =>
  res.status(403).json({
    status: "error",
    message: "Anda tidak memiliki akses ke kursus ini",
    code: "NO_ACCESS",
    data: null,
  });

const uid = (req: AuthenticatedRequest): number | null => {
  const id = Number(req.user?.id);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const fail = (res: Response, kind: "not-found" | "forbidden") =>
  res.status(kind === "not-found" ? 404 : 403).json({
    status: "error",
    message: kind === "not-found" ? "Data tidak ditemukan" : "Akses ditolak untuk peran ini",
    data: null,
  });

async function guardRead(
  req: AuthenticatedRequest,
  res: Response,
  courseId: number | null
): Promise<boolean> {
  if (courseId === null) {
    fail(res, "not-found");
    return false;
  }
  const verdict = await canReadCourseTree(uid(req), req.user?.role ?? "", courseId);
  if (verdict !== "ok") {
    // Selalu 404 agar struktur kursus non-publik tidak bocor (anti-enumerasi).
    fail(res, "not-found");
    return false;
  }
  return true;
}

async function guardWrite(
  req: AuthenticatedRequest,
  res: Response,
  courseId: number | null
): Promise<number | null> {
  if (courseId === null) {
    fail(res, "not-found");
    return null;
  }
  const userId = uid(req);
  const role = req.user?.role ?? "";
  if (userId === null || !(await canManageCourse(userId, role, courseId))) {
    fail(res, "forbidden");
    return null;
  }
  return userId;
}

// ---------- Modules ----------
export const createModuleHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const courseId = Number(req.params.courseId);
    if (!Number.isInteger(courseId) || courseId <= 0) return fail(res, "not-found");
    if ((await guardWrite(req, res, courseId)) === null) return;
    const parsed = moduleInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ status: "error", message: "Data modul tidak valid", errors: toFieldErrors(parsed.error.issues), data: null });
      return;
    }
    const mod = await createModule(courseId, parsed.data);
    res.status(201).json({ status: "success", message: "Modul dibuat", data: mod });
  } catch (e) { next(e); }
};

export const listModulesHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const courseId = Number(req.params.courseId);
    if (!Number.isInteger(courseId) || courseId <= 0) return fail(res, "not-found");
    if (!(await guardRead(req, res, courseId))) return;
    res.status(200).json({ status: "success", message: "Daftar modul", data: await listModules(courseId) });
  } catch (e) { next(e); }
};

export const getModuleHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const mid = Number(req.params.mid);
    if (!Number.isInteger(mid) || mid <= 0) return fail(res, "not-found");
    const courseId = await getCourseOfModule(mid);
    if (!(await guardRead(req, res, courseId))) return;
    const mod = await getModule(mid);
    if (!mod) return fail(res, "not-found");
    res.status(200).json({ status: "success", message: "Detail modul", data: mod });
  } catch (e) { next(e); }
};

export const patchModuleHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const mid = Number(req.params.mid);
    if (!Number.isInteger(mid) || mid <= 0) return fail(res, "not-found");
    const courseId = await getCourseOfModule(mid);
    if ((await guardWrite(req, res, courseId)) === null) return;
    const parsed = modulePatchSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ status: "error", message: "Data modul tidak valid", errors: toFieldErrors(parsed.error.issues), data: null });
      return;
    }
    res.status(200).json({ status: "success", message: "Modul diubah", data: await patchModule(mid, parsed.data) });
  } catch (e) { next(e); }
};

export const deleteModuleHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const mid = Number(req.params.mid);
    if (!Number.isInteger(mid) || mid <= 0) return fail(res, "not-found");
    const courseId = await getCourseOfModule(mid);
    if ((await guardWrite(req, res, courseId)) === null) return;
    await deleteModule(mid);
    res.status(200).json({ status: "success", message: "Modul dihapus", data: null });
  } catch (e) { next(e); }
};

// ---------- Sub-modules ----------
export const createSubModuleHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const mid = Number(req.params.mid);
    if (!Number.isInteger(mid) || mid <= 0) return fail(res, "not-found");
    const courseId = await getCourseOfModule(mid);
    if ((await guardWrite(req, res, courseId)) === null) return;
    if (!(await getModule(mid))) return fail(res, "not-found");
    const parsed = subModuleInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ status: "error", message: "Data sub-modul tidak valid", errors: toFieldErrors(parsed.error.issues), data: null });
      return;
    }
    const sub = await createSubModule(mid, parsed.data);
    res.status(201).json({ status: "success", message: "Sub-modul dibuat", data: sub });
  } catch (e) { next(e); }
};

export const listSubModulesHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const mid = Number(req.params.mid);
    if (!Number.isInteger(mid) || mid <= 0) return fail(res, "not-found");
    const courseId = await getCourseOfModule(mid);
    if (!(await guardRead(req, res, courseId))) return;
    res.status(200).json({ status: "success", message: "Daftar sub-modul", data: await listSubModules(mid) });
  } catch (e) { next(e); }
};

export const getSubModuleHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const sid = Number(req.params.sid);
    if (!Number.isInteger(sid) || sid <= 0) return fail(res, "not-found");
    const courseId = await getCourseOfSubModule(sid);
    if (!(await guardRead(req, res, courseId))) return;
    const sub = await getSubModule(sid);
    if (!sub) return fail(res, "not-found");
    res.status(200).json({ status: "success", message: "Detail sub-modul", data: sub });
  } catch (e) { next(e); }
};

export const patchSubModuleHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const sid = Number(req.params.sid);
    if (!Number.isInteger(sid) || sid <= 0) return fail(res, "not-found");
    const courseId = await getCourseOfSubModule(sid);
    if ((await guardWrite(req, res, courseId)) === null) return;
    const parsed = subModulePatchSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ status: "error", message: "Data sub-modul tidak valid", errors: toFieldErrors(parsed.error.issues), data: null });
      return;
    }
    res.status(200).json({ status: "success", message: "Sub-modul diubah", data: await patchSubModule(sid, parsed.data) });
  } catch (e) { next(e); }
};

export const deleteSubModuleHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const sid = Number(req.params.sid);
    if (!Number.isInteger(sid) || sid <= 0) return fail(res, "not-found");
    const courseId = await getCourseOfSubModule(sid);
    if ((await guardWrite(req, res, courseId)) === null) return;
    await deleteSubModule(sid);
    res.status(200).json({ status: "success", message: "Sub-modul dihapus", data: null });
  } catch (e) { next(e); }
};

// ---------- Materials ----------
export const createMaterialHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const sid = Number(req.params.sid);
    if (!Number.isInteger(sid) || sid <= 0) return fail(res, "not-found");
    const courseId = await getCourseOfSubModule(sid);
    if ((await guardWrite(req, res, courseId)) === null) return;
    const sub = await getSubModule(sid);
    if (!sub) return fail(res, "not-found");
    const parsed = materialInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ status: "error", message: "Data materi tidak valid", errors: toFieldErrors(parsed.error.issues), data: null });
      return;
    }
    try {
      const mat = await createMaterial(sid, sub.moduleId, parsed.data);
      res.status(201).json({ status: "success", message: "Materi dibuat", data: mat });
    } catch (err) {
      if (err instanceof Error && /Tiptap|dokumen|base64|URL|node|mark|MB/i.test(err.message)) {
        res.status(400).json({ status: "error", message: err.message, data: null });
        return;
      }
      throw err;
    }
  } catch (e) { next(e); }
};

export const listMaterialsHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const sid = Number(req.params.sid);
    if (!Number.isInteger(sid) || sid <= 0) return fail(res, "not-found");
    const courseId = await getCourseOfSubModule(sid);
    if (!(await guardRead(req, res, courseId))) return;
    const rows = await listMaterialsBySub(sid);
    // Katalog boleh melihat struktur; isi hanya untuk pemegang akses.
    const data =
      courseId !== null && (await checkLearningAccess(req, courseId))
        ? rows
        : rows.map(stripMaterialContent);
    res.status(200).json({ status: "success", message: "Daftar materi", data });
  } catch (e) { next(e); }
};

export const listMaterialsByModuleHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const mid = Number(req.params.mid);
    if (!Number.isInteger(mid) || mid <= 0) return fail(res, "not-found");
    const courseId = await getCourseOfModule(mid);
    if (!(await guardRead(req, res, courseId))) return;
    const rows = await listMaterialsByModule(mid);
    const data =
      courseId !== null && (await checkLearningAccess(req, courseId))
        ? rows
        : rows.map(stripMaterialContent);
    res.status(200).json({ status: "success", message: "Daftar materi", data });
  } catch (e) { next(e); }
};

export const getMaterialHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const matId = Number(req.params.matId);
    if (!Number.isInteger(matId) || matId <= 0) return fail(res, "not-found");
    const courseId = await getCourseOfMaterial(matId);
    if (!(await guardRead(req, res, courseId))) return;
    const mat = await getMaterial(matId);
    if (!mat) return fail(res, "not-found");
    // Isi materi adalah konten belajar: butuh hak akses (401 anonim, 403 tanpa akses).
    if (courseId === null || !(await checkLearningAccess(req, courseId))) {
      if (uid(req) === null) {
        res.status(401).json({ status: "error", message: "Token autentikasi diperlukan", data: null });
        return;
      }
      denyNoAccess(res);
      return;
    }
    res.status(200).json({ status: "success", message: "Detail materi", data: mat });
  } catch (e) { next(e); }
};

export const patchMaterialHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const matId = Number(req.params.matId);
    if (!Number.isInteger(matId) || matId <= 0) return fail(res, "not-found");
    const courseId = await getCourseOfMaterial(matId);
    if ((await guardWrite(req, res, courseId)) === null) return;
    const parsed = materialPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ status: "error", message: "Data materi tidak valid", errors: toFieldErrors(parsed.error.issues), data: null });
      return;
    }
    try {
      const mat = await patchMaterial(matId, parsed.data as Record<string, unknown>);
      res.status(200).json({ status: "success", message: "Materi diubah", data: mat });
    } catch (err) {
      if (err instanceof Error && /Tiptap|dokumen|base64|URL|node|mark|MB/i.test(err.message)) {
        res.status(400).json({ status: "error", message: err.message, data: null });
        return;
      }
      throw err;
    }
  } catch (e) { next(e); }
};

export const deleteMaterialHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const matId = Number(req.params.matId);
    if (!Number.isInteger(matId) || matId <= 0) return fail(res, "not-found");
    const courseId = await getCourseOfMaterial(matId);
    if ((await guardWrite(req, res, courseId)) === null) return;
    await deleteMaterial(matId);
    res.status(200).json({ status: "success", message: "Materi dihapus", data: null });
  } catch (e) { next(e); }
};
