import { Router } from "express";
import { authenticate, requireRole } from "../../middlewares/auth.middleware";
import { authOtpLimiter } from "../../middlewares/rate-limit.middleware";
import {
  earningsHandler,
  getSettingsHandler,
  listPayoutsHandler,
  myPayoutsHandler,
  processPayoutHandler,
  requestPayoutHandler,
  updateSettingsHandler,
} from "./revenue.controller";

const router = Router();
const admin = [authenticate, requireRole("admin")];
const teacher = [authenticate, requireRole("teacher")];

// Bagi hasil instruktur: persen global milik admin, pendapatan milik instruktur.
// Penarikan dibatasi per menit: cegah spam antrean ganda.
router.get("/admin/revenue-settings", ...admin, getSettingsHandler);
router.put("/admin/revenue-settings", ...admin, authOtpLimiter(), updateSettingsHandler);
router.get("/admin/payouts", ...admin, listPayoutsHandler);
router.post("/admin/payouts/:id/process", ...admin, authOtpLimiter(), processPayoutHandler);

router.get("/me/earnings", ...teacher, earningsHandler);
router.get("/me/payouts", ...teacher, myPayoutsHandler);
router.post("/me/payouts", ...teacher, authOtpLimiter(), requestPayoutHandler);

export default router;
