import { Router } from "express";
import { authenticate, requireRole } from "../../middlewares/auth.middleware";
import { summary } from "./dashboard.controller";

const router = Router();

// Ringkasan dasbor: kursus kelolaan + antrean penilaian + total (tanpa data contoh).
router.get("/", authenticate, requireRole("teacher", "admin"), summary);

export default router;
