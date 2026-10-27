import { Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware";
import { listHandler, markHandler, unmarkHandler } from "./progress.controller";

const router = Router();

// Semua endpoint progres memakai JWT (semua peran); identitas pengguna
// selalu dari token — tidak ada userId dari klien.
router.post("/materials/:id/progress", authenticate, markHandler);
router.delete("/materials/:id/progress", authenticate, unmarkHandler);
router.get("/me/progress", authenticate, listHandler);

export default router;
