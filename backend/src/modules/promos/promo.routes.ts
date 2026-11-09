import { Router } from "express";
import { authenticate, requireRole } from "../../middlewares/auth.middleware";
import { publicReadLimiter } from "../../middlewares/rate-limit.middleware";
import {
  addCourseHandler,
  adminDetailHandler,
  adminListHandler,
  courseQuoteHandler,
  createHandler,
  detailHandler,
  listHandler,
  patchHandler,
  removeCourseHandler,
} from "./promo.controller";

const router = Router();
const admin = [authenticate, requireRole("admin")];

// Baca publik (landing + katalog): hanya kampanye aktif dalam jendela waktu,
// kursus published saja. Rute spesifik didaftarkan sebelum :slug.
router.get("/promos/course/:courseId", publicReadLimiter(), courseQuoteHandler);
router.get("/promos", publicReadLimiter(), listHandler);
router.get("/promos/:slug", publicReadLimiter(), detailHandler);

// Kelola (admin-only): CRUD kampanye + keanggotaan kursus per promo.
router.post("/admin/promos", ...admin, createHandler);
router.get("/admin/promos", ...admin, adminListHandler);
router.get("/admin/promos/:slug", ...admin, adminDetailHandler);
router.patch("/admin/promos/:slug", ...admin, patchHandler);
router.post("/admin/promos/:slug/courses", ...admin, addCourseHandler);
router.delete("/admin/promos/:slug/courses/:courseId", ...admin, removeCourseHandler);

export default router;
