import { Router } from "express";
import { authenticate, requireRole } from "../../middlewares/auth.middleware";
import { publicReadLimiter } from "../../middlewares/rate-limit.middleware";
import {
  adminListHandler,
  createHandler,
  detailHandler,
  listHandler,
  removeHandler,
  updateHandler,
} from "./category.controller";

const router = Router();
const admin = [authenticate, requireRole("admin")];

// Daftar aktif untuk dropdown/filter (publik, tanpa data nonaktif).
router.get("/categories", publicReadLimiter(), listHandler);

// Kelola (admin-only): daftar semua + tambah + ubah + hapus.
router.get("/admin/categories", ...admin, adminListHandler);
router.get("/admin/categories/:id", ...admin, detailHandler);
router.post("/admin/categories", ...admin, createHandler);
router.patch("/admin/categories/:id", ...admin, updateHandler);
router.delete("/admin/categories/:id", ...admin, removeHandler);

export default router;
