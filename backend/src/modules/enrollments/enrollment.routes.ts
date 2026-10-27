import { Router } from "express";
import { authenticate, requireRole } from "../../middlewares/auth.middleware";
import {
  accessHandler,
  enrollHandler,
  grantHandler,
  myEnrollmentsHandler,
  revokeHandler,
} from "./enrollment.controller";

const router = Router();

// Pendaftaran mandiri + status akses (peserta terautentikasi).
router.post("/courses/:id/enroll", authenticate, enrollHandler);
router.get("/courses/:id/access", authenticate, accessHandler);
router.get("/me/enrollments", authenticate, myEnrollmentsHandler);

// Pemberian / pencabutan akses manual (admin saja, alasan wajib + audit log).
router.post(
  "/admin/courses/:id/grants",
  authenticate,
  requireRole("admin"),
  grantHandler
);
router.post(
  "/admin/courses/:id/grants/:userId/revoke",
  authenticate,
  requireRole("admin"),
  revokeHandler
);

export default router;
