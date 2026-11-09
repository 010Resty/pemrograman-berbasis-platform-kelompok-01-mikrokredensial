import { Router } from "express";
import { authenticate, requireRole } from "../../middlewares/auth.middleware";
import {
  patunganSubmitLimiter,
  patunganValidateLimiter,
} from "../../middlewares/rate-limit.middleware";
import {
  adminCancelHandler,
  cancelHandler,
  createHandler,
  detailHandler,
  myGroupsHandler,
  validateHandler,
} from "./patungan.controller";

const router = Router();
const admin = [authenticate, requireRole("admin")];

// Cek username anggota (authenticated, rate-limit anti-enumerasi).
router.post("/patungan/members/validate", authenticate, patunganValidateLimiter(), validateHandler);
// Buat grup (pembuat otomatis anggota #1) + daftar grup saya.
router.post("/patungan/groups", authenticate, patunganSubmitLimiter(), createHandler);
router.get("/patungan/groups/mine", authenticate, myGroupsHandler);
// Detail grup (anggota/admin). Didaftarkan setelah /mine agar tidak tertelan :id.
router.get("/patungan/groups/:id", authenticate, detailHandler);
// Batal: pembuat (selama belum ada iuran masuk) atau admin.
router.post("/patungan/groups/:id/cancel", authenticate, patunganSubmitLimiter(), cancelHandler);
router.post("/admin/patungan/groups/:id/cancel", ...admin, adminCancelHandler);

export default router;
