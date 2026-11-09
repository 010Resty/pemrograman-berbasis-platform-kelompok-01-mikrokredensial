import { Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware";
import {
  myProfileHandler,
  removeAvatarHandler,
  updateProfileHandler,
} from "./profile.controller";

const router = Router();

// Profil milik sendiri (semua peran yang terautentikasi).
router.get("/me/profile", authenticate, myProfileHandler);
router.patch("/me/profile", authenticate, updateProfileHandler);
router.delete("/me/profile/avatar", authenticate, removeAvatarHandler);

export default router;
