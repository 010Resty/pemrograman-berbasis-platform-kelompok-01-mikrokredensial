import { Router } from "express";
import { authenticate, requireRole } from "../../middlewares/auth.middleware";
import { authOtpLimiter } from "../../middlewares/rate-limit.middleware";
import {
  acceptHandler,
  createHandler,
  listHandler,
  reissueHandler,
  revokeHandler,
  validateHandler,
} from "./invitation.controller";

const router = Router();
const admin = [authenticate, requireRole("admin")];

// Kelola undangan (admin).
router.post("/admin/invitations", ...admin, createHandler);
router.get("/admin/invitations", ...admin, listHandler);
router.post("/admin/invitations/:id/revoke", ...admin, revokeHandler);
router.post("/admin/invitations/:id/reissue", ...admin, reissueHandler);

// Alur aktivasi (publik, dibatasi per IP agar token tidak bisa di-spam).
router.get("/invitations/validate", authOtpLimiter(), validateHandler);
router.post("/invitations/accept", authOtpLimiter(), acceptHandler);

export default router;
