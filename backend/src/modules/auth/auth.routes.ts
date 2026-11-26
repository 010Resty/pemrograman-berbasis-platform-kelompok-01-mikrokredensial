import { Router } from "express";
import {
  forgotPasswordHandler,
  login,
  logoutHandler,
  me,
  refreshHandler,
  register,
  resendVerificationHandler,
  resetPasswordHandler,
  uniraLoginHandler,
  uniraPhotoHandler,
  verifyEmailHandler,
  verifyResetCodeHandler,
} from "./auth.controller";
import {
  authenticate,
  optionalAuthenticate,
} from "../../middlewares/auth.middleware";
import { authOtpLimiter, publicReadLimiter } from "../../middlewares/rate-limit.middleware";

const router = Router();

router.post("/register", authOtpLimiter(), register);
router.post("/verify-email", authOtpLimiter(), verifyEmailHandler);
router.post("/resend-verification", authOtpLimiter(), resendVerificationHandler);
router.post("/forgot-password", authOtpLimiter(), forgotPasswordHandler);
router.post("/verify-reset-code", authOtpLimiter(), verifyResetCodeHandler);
router.post("/reset-password", authOtpLimiter(), resetPasswordHandler);
router.post("/login", authOtpLimiter(), login);
router.post("/unira/login", authOtpLimiter(), uniraLoginHandler);
// Foto SIMAT per-user (proxy same-origin anti-CORB; pola keterbukaan sama
// seperti serve berkas avatar /files/:id/content — <img> tanpa token).
router.get(
  "/unira/photo/:userId",
  optionalAuthenticate,
  publicReadLimiter(),
  uniraPhotoHandler
);
router.post("/refresh", authOtpLimiter(), refreshHandler);
router.post("/logout", authenticate, logoutHandler);
router.get("/me", authenticate, me);

export default router;
