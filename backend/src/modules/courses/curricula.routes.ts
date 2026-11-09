import { Router } from "express";
import { authenticate, optionalAuthenticate, requireRole } from "../../middlewares/auth.middleware";
import { publicReadLimiter } from "../../middlewares/rate-limit.middleware";
import {
  createModuleHandler,
  listModulesHandler,
  getModuleHandler,
  patchModuleHandler,
  deleteModuleHandler,
  createSubModuleHandler,
  listSubModulesHandler,
  getSubModuleHandler,
  patchSubModuleHandler,
  deleteSubModuleHandler,
  createMaterialHandler,
  listMaterialsHandler,
  listMaterialsByModuleHandler,
  getMaterialHandler,
  patchMaterialHandler,
  deleteMaterialHandler,
  listMaterialChangesHandler,
} from "./curricula.controller";

const router = Router();

const write = [authenticate, requireRole("teacher", "admin")];

// Modul di bawah kursus
router.get("/courses/:courseId/modules", optionalAuthenticate, publicReadLimiter(), listModulesHandler);
router.post("/courses/:courseId/modules", ...write, createModuleHandler);
router.get("/modules/:mid", optionalAuthenticate, publicReadLimiter(), getModuleHandler);
router.patch("/modules/:mid", ...write, patchModuleHandler);
router.delete("/modules/:mid", ...write, deleteModuleHandler);
router.get("/modules/:mid/submodules", optionalAuthenticate, publicReadLimiter(), listSubModulesHandler);
router.get("/modules/:mid/materials", optionalAuthenticate, publicReadLimiter(), listMaterialsByModuleHandler);

// Sub-modul
router.post("/modules/:mid/submodules", ...write, createSubModuleHandler);
router.get("/submodules/:sid", optionalAuthenticate, publicReadLimiter(), getSubModuleHandler);
router.patch("/submodules/:sid", ...write, patchSubModuleHandler);
router.delete("/submodules/:sid", ...write, deleteSubModuleHandler);
router.get("/submodules/:sid/materials", optionalAuthenticate, publicReadLimiter(), listMaterialsHandler);
router.post("/submodules/:sid/materials", ...write, createMaterialHandler);

// Materi
router.get("/materials/:matId", optionalAuthenticate, publicReadLimiter(), getMaterialHandler);
router.patch("/materials/:matId", ...write, patchMaterialHandler);
router.delete("/materials/:matId", ...write, deleteMaterialHandler);
// Riwayat perubahan resmi materi (K-08) — pengelola kursus saja.
router.get("/materials/:matId/changes", ...write, listMaterialChangesHandler);

export default router;
