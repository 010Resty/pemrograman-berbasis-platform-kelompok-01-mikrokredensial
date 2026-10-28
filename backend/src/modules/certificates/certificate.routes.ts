import { Router } from "express";
import { authenticate, requireRole } from "../../middlewares/auth.middleware";
import {
  eligibilityHandler,
  globalEligibilityDetailHandler,
  globalEligibilityHandler,
  instructorDetailHandler,
  instructorListHandler,
  instructorSummaryHandler,
  issueHandler,
  moduleCertificateStatusHandler,
  myCertificatesHandler,
  myStatusHandler,
  revokeHandler,
  verifyHandler,
} from "./certificate.controller";

const router = Router();
const manage = [authenticate, requireRole("teacher", "admin")];

// Penerbitan + milik sendiri (peserta berhak akses).
router.post("/modules/:id/certificate", authenticate, issueHandler);
router.get("/me/certificates", authenticate, myCertificatesHandler);
router.get("/me/modules/:id/certificate-status", authenticate, myStatusHandler);

// Verifikasi publik via kode (tanpa auth, minimal aman).
router.get("/certificates/verify/:code", verifyHandler);

// Kelola instruktur/admin (terbatas kursus tanggung jawab).
// Urutan penting: /summary sebelum /:certId agar tidak tertelan param.
router.get("/instructor/certificates/summary", ...manage, instructorSummaryHandler);
router.get("/instructor/certificates", ...manage, instructorListHandler);
router.get("/instructor/certificates/:certId", ...manage, instructorDetailHandler);
router.post("/instructor/certificates/:certId/revoke", ...manage, revokeHandler);
router.get("/instructor/eligibility", ...manage, globalEligibilityHandler);
router.get("/instructor/eligibility/:id", ...manage, globalEligibilityDetailHandler);
router.get("/instructor/modules/:id/certificate-status", ...manage, moduleCertificateStatusHandler);
router.get("/instructor/modules/:id/eligibility", ...manage, eligibilityHandler);

export default router;
