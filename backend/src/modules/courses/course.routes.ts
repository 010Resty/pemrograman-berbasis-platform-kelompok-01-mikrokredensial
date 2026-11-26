import { Router } from "express";
import { authenticate, optionalAuthenticate, requireRole } from "../../middlewares/auth.middleware";
import { publicReadLimiter } from "../../middlewares/rate-limit.middleware";
import { create, listPublic, listRankingsPublic, listMine, detail, update, remove } from "./course.controller";

const router = Router();
const instructorRouter = Router();

// Katalog publik (hanya published).
router.get("/", publicReadLimiter(), listPublic);

// Peringkat publik per jumlah peserta — SEBELUM "/:id" agar tidak tertelan.
router.get("/rankings", publicReadLimiter(), listRankingsPublic);

// Daftar kursus instruktur/admin.
instructorRouter.get(
  "/",
  authenticate,
  requireRole("teacher", "admin"),
  listMine
);

router.post("/", authenticate, requireRole("teacher", "admin"), create);
router.get("/:id", optionalAuthenticate, publicReadLimiter(), detail);
router.patch("/:id", authenticate, requireRole("teacher", "admin"), update);
router.delete("/:id", authenticate, requireRole("teacher", "admin"), remove);

export default router;
export { instructorRouter };
