import { Router } from "express";
import { authenticate, requireRole } from "../../middlewares/auth.middleware";
import { publicReadLimiter } from "../../middlewares/rate-limit.middleware";
import {
  addCourseHandler,
  adminDetailHandler,
  adminListHandler,
  adminProposalsHandler,
  approveProposalHandler,
  courseQuoteHandler,
  createHandler,
  detailHandler,
  listHandler,
  markSeenHandler,
  myPromosHandler,
  myProposalsHandler,
  patchHandler,
  proposeHandler,
  rejectProposalHandler,
  removeCourseHandler,
  removeHandler,
} from "./promo.controller";

const router = Router();
const admin = [authenticate, requireRole("admin")];
const instructor = [authenticate, requireRole("teacher", "admin")];

// Baca publik (landing + katalog): hanya kampanye aktif dalam jendela waktu,
// kursus published saja. Rute spesifik didaftarkan sebelum :slug.
router.get("/promos/course/:courseId", publicReadLimiter(), courseQuoteHandler);
router.get("/promos", publicReadLimiter(), listHandler);
router.get("/promos/:slug", publicReadLimiter(), detailHandler);

// Instruktur: ajukan kursus ke promo + lihat miliknya.
// Didaftarkan sebelum /promos/:slug agar tidak tertangkap rute publik.
router.post("/instructor/promos/:slug/proposals", ...instructor, proposeHandler);
router.get("/instructor/promo-proposals", ...instructor, myProposalsHandler);
router.post("/instructor/promo-proposals/seen", ...instructor, markSeenHandler);
router.get("/instructor/promos", ...instructor, myPromosHandler);

// Kelola (admin-only): CRUD kampanye + keanggotaan kursus per promo.
router.post("/admin/promos", ...admin, createHandler);
router.get("/admin/promos", ...admin, adminListHandler);
router.get("/admin/promos/:slug", ...admin, adminDetailHandler);
router.patch("/admin/promos/:slug", ...admin, patchHandler);
router.delete("/admin/promos/:slug", ...admin, removeHandler);
router.post("/admin/promos/:slug/courses", ...admin, addCourseHandler);
router.delete("/admin/promos/:slug/courses/:courseId", ...admin, removeCourseHandler);
// Antrean pengajuan instruktur (approve = kursus masuk promo).
router.get("/admin/promo-proposals", ...admin, adminProposalsHandler);
router.post("/admin/promo-proposals/:id/approve", ...admin, approveProposalHandler);
router.post("/admin/promo-proposals/:id/reject", ...admin, rejectProposalHandler);

export default router;
