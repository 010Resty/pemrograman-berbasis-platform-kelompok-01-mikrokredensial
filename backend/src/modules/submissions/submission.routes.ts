import { Router } from "express";
import { authenticate, requireRole } from "../../middlewares/auth.middleware";
import {
  detailHandler,
  gradeHandler,
  listHandler,
  statusHandler,
  submitHandler,
} from "./submission.controller";

const router = Router();

const grade = [authenticate, requireRole("teacher", "admin")];

// Pengumpulan + riwayat milik sendiri (peserta berhak akses).
router.post("/materials/:id/submissions", authenticate, submitHandler);
router.get("/materials/:id/submissions", authenticate, listHandler);
// Status kelulusan — daftarkan sebelum :subId agar tidak tertelan.
router.get("/materials/:id/submissions/status", authenticate, statusHandler);
router.get("/materials/:id/submissions/:subId", authenticate, detailHandler);

// Penilaian: hanya teacher pengelola kursus + admin.
router.post("/materials/:id/submissions/:subId/grade", ...grade, gradeHandler);

export default router;
