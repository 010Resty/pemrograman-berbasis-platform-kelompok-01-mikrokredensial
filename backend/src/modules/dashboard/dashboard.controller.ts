import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware";
import { getInstructorDashboard } from "./dashboard.service";

// GET /api/v1/instructor/dashboard — ringkasan dasbor instruktur/admin.
export const summary = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = Number(req.user?.id);
    if (!Number.isInteger(userId) || userId <= 0) {
      res.status(401).json({ status: "error", message: "Token autentikasi diperlukan", data: null });
      return;
    }
    const data = await getInstructorDashboard(userId, req.user?.role);
    res.status(200).json({ status: "success", message: "Ringkasan dasbor instruktur", data });
  } catch (error) {
    next(error);
  }
};
