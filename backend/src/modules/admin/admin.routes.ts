import { Router } from "express";
import { authenticate, requireRole } from "../../middlewares/auth.middleware";
import {
  assignHandler,
  createTeacherHandler,
  listUsersHandler,
  setActiveHandler,
  unassignHandler,
} from "./admin.controller";

const router = Router();
const admin = [authenticate, requireRole("admin")];

// Manajemen pengguna.
router.get("/admin/users", ...admin, listUsersHandler);
router.post("/admin/users", ...admin, createTeacherHandler);
router.patch("/admin/users/:id", ...admin, setActiveHandler);

// Penugasan instruktur ke kursus.
router.post("/admin/courses/:id/instructors", ...admin, assignHandler);
router.delete("/admin/courses/:id/instructors/:userId", ...admin, unassignHandler);

export default router;
