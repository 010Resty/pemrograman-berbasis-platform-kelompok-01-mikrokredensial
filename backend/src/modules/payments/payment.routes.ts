import { Router } from "express";
import { authenticate, requireRole } from "../../middlewares/auth.middleware";
import { authOtpLimiter } from "../../middlewares/rate-limit.middleware";
import {
  attachProofHandler,
  cancelHandler,
  createHandler,
  listHandler,
  markPaymentsSeenHandler,
  myPaymentHandler,
  notifyHandler,
  qrHandler,
  refreshHandler,
  verifyHandler,
} from "./payment.controller";

const router = Router();
const admin = [authenticate, requireRole("admin")];

// Pembayaran QRIS: manual lawas (bukti + verifikasi admin) + DOKU dinamis.
// Dibatasi per IP: cegah spam antrean + brute-force paymentId.
router.post("/courses/:id/payments", authenticate, authOtpLimiter(), createHandler);
router.patch("/payments/:id/proof", authenticate, authOtpLimiter(), attachProofHandler);
router.delete("/payments/:id", authenticate, authOtpLimiter(), cancelHandler);
router.get("/payments/:id/qr", authenticate, qrHandler);
router.post("/payments/:id/doku/refresh", authenticate, authOtpLimiter(), refreshHandler);
router.get("/me/payments", authenticate, myPaymentHandler);
router.post("/me/payments/seen", authenticate, markPaymentsSeenHandler);
// Webhook DOKU: publik (tanpa JWT) + verifikasi signature RSA di handler.
router.post("/payments/doku/notify", authOtpLimiter(), notifyHandler);

// Antrean + verifikasi (admin).
router.get("/admin/payments", ...admin, listHandler);
router.post("/admin/payments/:id/verify", ...admin, verifyHandler);

export default router;
