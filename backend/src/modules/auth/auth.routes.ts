import { Router } from "express";
import {
  forgotPasswordHandler,
  login,
  me,
  register,
  resendVerificationHandler,
  resetPasswordHandler,
  verifyEmailHandler,
} from "./auth.controller";
import { authenticate } from "../../middlewares/auth.middleware";

const router = Router();

router.post("/register", register);
router.post("/verify-email", verifyEmailHandler);
router.post("/resend-verification", resendVerificationHandler);
router.post("/forgot-password", forgotPasswordHandler);
router.post("/reset-password", resetPasswordHandler);
router.post("/login", login);
router.get("/me", authenticate, me);

export default router;
