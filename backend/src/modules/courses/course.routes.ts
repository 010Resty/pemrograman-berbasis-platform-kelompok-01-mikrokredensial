import { Router } from "express";
import { authenticate, optionalAuthenticate, requireRole } from "../../middlewares/auth.middleware";
import { create, listPublic, listMine, detail, update, remove } from "./course.controller";

const router = Router();
const instructorRouter = Router();

// Katalog publik (hanya published).
router.get("/", listPublic);

// Daftar kursus instruktur/admin.
instructorRouter.get(
  "/",
  authenticate,
  requireRole("teacher", "admin"),
  listMine
);

router.post("/", authenticate, requireRole("teacher", "admin"), create);
router.get("/:id", optionalAuthenticate, detail);
router.patch("/:id", authenticate, requireRole("teacher", "admin"), update);
router.delete("/:id", authenticate, requireRole("teacher", "admin"), remove);

export default router;
export { instructorRouter };
