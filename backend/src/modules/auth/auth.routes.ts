import { Router } from "express";
import {
  forgotPasswordHandler,
  login,
  me,
  register,
  resendVerificationHandler,
  resetPasswordHandler,
  verifyEmailHandler,
  verifyResetCodeHandler,
} from "./auth.controller";
import { authenticate } from "../../middlewares/auth.middleware";
import { authOtpLimiter } from "../../middlewares/rate-limit.middleware";

const router = Router();

router.post("/register", authOtpLimiter(), register);
router.post("/verify-email", authOtpLimiter(), verifyEmailHandler);
router.post("/resend-verification", authOtpLimiter(), resendVerificationHandler);
router.post("/forgot-password", authOtpLimiter(), forgotPasswordHandler);
router.post("/verify-reset-code", authOtpLimiter(), verifyResetCodeHandler);
router.post("/reset-password", authOtpLimiter(), resetPasswordHandler);
router.post("/login", authOtpLimiter(), login);
router.get("/me", authenticate, me);

export default router;
