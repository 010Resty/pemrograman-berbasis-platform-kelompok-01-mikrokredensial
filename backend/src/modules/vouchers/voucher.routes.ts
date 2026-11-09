import { Router } from "express";
import { authenticate, requireRole } from "../../middlewares/auth.middleware";
import { authOtpLimiter } from "../../middlewares/rate-limit.middleware";
import {
  createHandler,
  detailHandler,
  disableHandler,
  enableHandler,
  listHandler,
  redeemHandler,
  redemptionsHandler,
  validateDiscountHandler,
} from "./voucher.controller";

const router = Router();
const admin = [authenticate, requireRole("admin")];

// Penukaran oleh peserta (dibatasi per IP agar kode tidak bisa di-brute-force).
router.post("/vouchers/redeem", authenticate, authOtpLimiter(), redeemHandler);
// Cek voucher diskon tanpa menghanguskan (untuk kalkulasi total checkout).
router.post("/vouchers/validate", authenticate, authOtpLimiter(), validateDiscountHandler);

// Kelola voucher (admin). Daftarkan rute spesifik sebelum :code.
router.post("/admin/vouchers", ...admin, createHandler);
router.get("/admin/vouchers", ...admin, listHandler);
router.get("/admin/vouchers/:code/redemptions", ...admin, redemptionsHandler);
router.post("/admin/vouchers/:code/disable", ...admin, disableHandler);
router.post("/admin/vouchers/:code/enable", ...admin, enableHandler);
router.get("/admin/vouchers/:code", ...admin, detailHandler);

export default router;
