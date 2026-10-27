import { Router } from "express";
import { authenticate, optionalAuthenticate, requireRole } from "../../middlewares/auth.middleware";
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
} from "./curricula.controller";

const router = Router();

const write = [authenticate, requireRole("teacher", "admin")];

// Modul di bawah kursus
router.get("/courses/:courseId/modules", optionalAuthenticate, listModulesHandler);
router.post("/courses/:courseId/modules", ...write, createModuleHandler);
router.get("/modules/:mid", optionalAuthenticate, getModuleHandler);
router.patch("/modules/:mid", ...write, patchModuleHandler);
router.delete("/modules/:mid", ...write, deleteModuleHandler);
router.get("/modules/:mid/submodules", optionalAuthenticate, listSubModulesHandler);
router.get("/modules/:mid/materials", optionalAuthenticate, listMaterialsByModuleHandler);

// Sub-modul
router.post("/modules/:mid/submodules", ...write, createSubModuleHandler);
router.get("/submodules/:sid", optionalAuthenticate, getSubModuleHandler);
router.patch("/submodules/:sid", ...write, patchSubModuleHandler);
router.delete("/submodules/:sid", ...write, deleteSubModuleHandler);
router.get("/submodules/:sid/materials", optionalAuthenticate, listMaterialsHandler);
router.post("/submodules/:sid/materials", ...write, createMaterialHandler);

// Materi
router.get("/materials/:matId", optionalAuthenticate, getMaterialHandler);
router.patch("/materials/:matId", ...write, patchMaterialHandler);
router.delete("/materials/:matId", ...write, deleteMaterialHandler);

export default router;
