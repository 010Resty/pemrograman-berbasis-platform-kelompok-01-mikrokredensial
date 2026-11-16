import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware";
import {
  CategoryError,
  createCategory,
  createCategorySchema,
  deleteCategory,
  getCategoryById,
  listActiveCategories,
  listAllCategories,
  updateCategory,
  updateCategorySchema,
} from "./category.service";

const uid = (req: AuthenticatedRequest): number | null => {
  const id = Number(req.user?.id);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const categoryError = (res: Response, e: unknown): boolean => {
  if (e instanceof CategoryError) {
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

const numId = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};

// GET /api/v1/categories — daftar aktif untuk dropdown/filter (publik).
export const listHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    res.status(200).json({
      status: "success",
      message: "Daftar kategori",
      data: await listActiveCategories(),
    });
  } catch (e) {
    next(e);
  }
};

// GET /api/v1/admin/categories — semua + hitungan pemakaian (admin).
export const adminListHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (needAdmin(req, res) === null) return;
    res.status(200).json({
      status: "success",
      message: "Daftar kategori",
      data: await listAllCategories(),
    });
  } catch (e) {
    next(e);
  }
};

// GET /api/v1/admin/categories/:id — satu kategori (admin).
export const detailHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (needAdmin(req, res) === null) return;
    const id = numId(req.params.id);
    if (id === null) {
      res.status(404).json({
        status: "error",
        message: "Kategori tidak ditemukan",
        code: "CATEGORY_NOT_FOUND",
        data: null,
      });
      return;
    }
    try {
      res.status(200).json({
        status: "success",
        message: "Detail kategori",
        data: await getCategoryById(id),
      });
    } catch (e) {
      if (!categoryError(res, e)) throw e;
    }
  } catch (e) {
    next(e);
  }
};

// POST /api/v1/admin/categories — tambah (admin).
export const createHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const actorId = needAdmin(req, res);
    if (actorId === null) return;
    const parsed = createCategorySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        status: "error",
        message: "Data kategori tidak valid",
        errors: toFieldErrors(parsed.error.issues),
        data: null,
      });
      return;
    }
    try {
      const row = await createCategory(actorId, parsed.data);
      res.status(201).json({
        status: "success",
        message: "Kategori berhasil dibuat.",
        data: row,
      });
    } catch (e) {
      if (!categoryError(res, e)) throw e;
    }
  } catch (e) {
    next(e);
  }
};

// PATCH /api/v1/admin/categories/:id — ubah nama/status/urutan (admin).
export const updateHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const actorId = needAdmin(req, res);
    if (actorId === null) return;
    const id = numId(req.params.id);
    if (id === null) {
      res.status(404).json({
        status: "error",
        message: "Kategori tidak ditemukan",
        code: "CATEGORY_NOT_FOUND",
        data: null,
      });
      return;
    }
    const parsed = updateCategorySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        status: "error",
        message: "Data kategori tidak valid",
        errors: toFieldErrors(parsed.error.issues),
        data: null,
      });
      return;
    }
    try {
      res.status(200).json({
        status: "success",
        message: "Kategori berhasil diubah.",
        data: await updateCategory(actorId, id, parsed.data),
      });
    } catch (e) {
      if (!categoryError(res, e)) throw e;
    }
  } catch (e) {
    next(e);
  }
};

// DELETE /api/v1/admin/categories/:id — hapus permanen bila tak dipakai (admin).
export const removeHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const actorId = needAdmin(req, res);
    if (actorId === null) return;
    const id = numId(req.params.id);
    if (id === null) {
      res.status(404).json({
        status: "error",
        message: "Kategori tidak ditemukan",
        code: "CATEGORY_NOT_FOUND",
        data: null,
      });
      return;
    }
    try {
      res.status(200).json({
        status: "success",
        message: "Kategori dihapus.",
        data: await deleteCategory(actorId, id),
      });
    } catch (e) {
      if (!categoryError(res, e)) throw e;
    }
  } catch (e) {
    next(e);
  }
};
