import { Router } from "express";
import { authenticate, requireRole } from "../../middlewares/auth.middleware";
import { authOtpLimiter } from "../../middlewares/rate-limit.middleware";
import {
  attachProofHandler,
  createHandler,
  listHandler,
  myPaymentHandler,
  verifyHandler,
} from "./payment.controller";

const router = Router();
const admin = [authenticate, requireRole("admin")];

// Pembayaran QRIS manual oleh peserta (bukti diverifikasi admin).
// Dibatasi per IP: cegah spam antrean + brute-force paymentId.
router.post("/courses/:id/payments", authenticate, authOtpLimiter(), createHandler);
router.patch("/payments/:id/proof", authenticate, authOtpLimiter(), attachProofHandler);
router.get("/me/payments", authenticate, myPaymentHandler);

// Antrean + verifikasi (admin).
router.get("/admin/payments", ...admin, listHandler);
router.post("/admin/payments/:id/verify", ...admin, verifyHandler);

export default router;
