import { Router } from "express";
import { authenticate, requireRole } from "../../middlewares/auth.middleware";
import {
  acceptHandler,
  createHandler,
  listHandler,
  revokeHandler,
  validateHandler,
} from "./invitation.controller";

const router = Router();
const admin = [authenticate, requireRole("admin")];

// Kelola undangan (admin).
router.post("/admin/invitations", ...admin, createHandler);
router.get("/admin/invitations", ...admin, listHandler);
router.post("/admin/invitations/:id/revoke", ...admin, revokeHandler);

// Alur aktivasi (publik).
router.get("/invitations/validate", validateHandler);
router.post("/invitations/accept", acceptHandler);

export default router;
