import { Router } from "express";
import { authenticate, requireRole } from "../../middlewares/auth.middleware";
import {
  assignHandler,
  createTeacherHandler,
  listUsersHandler,
  overviewHandler,
  reportsHandler,
  unassignHandler,
  updateUserHandler,
  userDetailHandler,
} from "./admin.controller";

const router = Router();
const admin = [authenticate, requireRole("admin")];

// Ringkasan badge sidebar (4 agregat ringan, tanpa daftar).
router.get("/admin/overview", ...admin, overviewHandler);

// Laporan agregat read-only (ringkasan + per kursus + filter tanggal).
router.get("/admin/reports", ...admin, reportsHandler);

// Manajemen pengguna.
router.get("/admin/users", ...admin, listUsersHandler);
router.get("/admin/users/:id", ...admin, userDetailHandler);
router.post("/admin/users", ...admin, createTeacherHandler);
router.patch("/admin/users/:id", ...admin, updateUserHandler);

// Penugasan instruktur ke kursus.
router.post("/admin/courses/:id/instructors", ...admin, assignHandler);
router.delete("/admin/courses/:id/instructors/:userId", ...admin, unassignHandler);

export default router;
