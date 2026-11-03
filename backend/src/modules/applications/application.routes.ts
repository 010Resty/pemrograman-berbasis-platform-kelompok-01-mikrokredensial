import { Router } from "express";
import { authenticate, requireRole } from "../../middlewares/auth.middleware";
import { publicSubmitLimiter } from "../../middlewares/rate-limit.middleware";
import {
  deleteHandler,
  detailHandler,
  inviteHandler,
  listHandler,
  reviewHandler,
  submitHandler,
} from "./application.controller";

const router = Router();
const admin = [authenticate, requireRole("admin")];

// Pengajuan minat (publik, tanpa login — pendaftar belum punya akun).
// Dibatasi rate-limit anti-spam (429 bila berlebihan).
router.post("/instructor-applications", publicSubmitLimiter(), submitHandler);

// Kelola pengajuan (admin).
router.get("/admin/instructor-applications", ...admin, listHandler);
router.get("/admin/instructor-applications/:id", ...admin, detailHandler);
router.patch("/admin/instructor-applications/:id", ...admin, reviewHandler);
router.delete("/admin/instructor-applications/:id", ...admin, deleteHandler);
router.post("/admin/instructor-applications/:id/invite", ...admin, inviteHandler);

export default router;
