import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware";
import {
  PromoError,
  addCourseSchema,
  approveProposal,
  createCampaign,
  createCampaignSchema,
  createProposal,
  decideProposalSchema,
  deleteCampaign,
  getAdminCampaign,
  getPublicCampaign,
  getPromoQuoteForCourse,
  addCourseToCampaign,
  listCampaignsAdmin,
  listInstructorPromoMemberships,
  listMyProposals,
  listProposalsAdmin,
  listPublicCampaigns,
  markProposalsSeen,
  patchCampaign,
  patchCampaignSchema,
  proposePromoSchema,
  rejectProposal,
  removeCourseFromCampaign,
} from "./promo.service";

const toFieldErrors = (
  issues: Array<{ path: Array<string | number>; message: string }>
) =>
  issues.map((i) => ({
    field: i.path.length > 0 ? String(i.path[0]) : "body",
    message: i.message,
  }));

const promoError = (res: Response, e: unknown): boolean => {
  if (e instanceof PromoError) {
    res.status(e.http).json({
      status: "error",
      message: e.message,
      code: e.code,
      data: null,
    });
    return true;
  }
  if (e !== null && typeof e === "object" && "issues" in e) {
    res.status(400).json({
      status: "error",
      message: "Data promo tidak valid",
      errors: toFieldErrors(
        (e as { issues: Array<{ path: Array<string | number>; message: string }> }).issues
      ),
      data: null,
    });
    return true;
  }
  return false;
};

const uid = (req: AuthenticatedRequest): number | null => {
  const id = Number(req.user?.id);
  return Number.isInteger(id) && id > 0 ? id : null;
};

// ---------- Publik ----------

export const listHandler = async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    res.status(200).json({ status: "success", message: "Daftar promo aktif", data: await listPublicCampaigns() });
  } catch (e) {
    next(e);
  }
};

export const courseQuoteHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const courseId = Number(req.params.courseId);
    if (!Number.isInteger(courseId) || courseId <= 0) {
      res.status(404).json({ status: "error", message: "Kursus tidak ditemukan", data: null });
      return;
    }
    const data = await getPromoQuoteForCourse(courseId);
    res.status(200).json({ status: "success", message: "Promo kursus", data });
  } catch (e) {
    if (promoError(res, e)) return;
    next(e);
  }
};

export const adminDetailHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const data = await getAdminCampaign(String(req.params.slug ?? ""));
    res.status(200).json({ status: "success", message: "Detail promo (admin)", data });
  } catch (e) {
    if (promoError(res, e)) return;
    next(e);
  }
};

export const detailHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const data = await getPublicCampaign(String(req.params.slug ?? ""));
    res.status(200).json({ status: "success", message: "Detail promo", data });
  } catch (e) {
    if (promoError(res, e)) return;
    next(e);
  }
};

// ---------- Admin ----------

export const createHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const actorId = uid(req);
    if (actorId === null) {
      res.status(401).json({ status: "error", message: "Token autentikasi diperlukan", data: null });
      return;
    }
    const parsed = createCampaignSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        status: "error",
        message: "Data promo tidak valid",
        errors: toFieldErrors(parsed.error.issues),
        data: null,
      });
      return;
    }
    const data = await createCampaign(actorId, parsed.data);
    res.status(201).json({ status: "success", message: "Promo dibuat", data });
  } catch (e) {
    if (promoError(res, e)) return;
    next(e);
  }
};

export const adminListHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const q = req.query as Record<string, unknown>;
    const data = await listCampaignsAdmin({
      status: typeof q.status === "string" ? q.status : undefined,
      type: typeof q.type === "string" ? q.type : undefined,
    });
    res.status(200).json({ status: "success", message: "Daftar promo (admin)", data });
  } catch (e) {
    next(e);
  }
};

export const patchHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const actorId = uid(req);
    if (actorId === null) {
      res.status(401).json({ status: "error", message: "Token autentikasi diperlukan", data: null });
      return;
    }
    const parsed = patchCampaignSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        status: "error",
        message: "Data promo tidak valid",
        errors: toFieldErrors(parsed.error.issues),
        data: null,
      });
      return;
    }
    const data = await patchCampaign(actorId, String(req.params.slug ?? ""), parsed.data);
    res.status(200).json({ status: "success", message: "Promo diperbarui", data });
  } catch (e) {
    if (promoError(res, e)) return;
    next(e);
  }
};

export const addCourseHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const actorId = uid(req);
    if (actorId === null) {
      res.status(401).json({ status: "error", message: "Token autentikasi diperlukan", data: null });
      return;
    }
    const parsed = addCourseSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        status: "error",
        message: "Data kursus promo tidak valid",
        errors: toFieldErrors(parsed.error.issues),
        data: null,
      });
      return;
    }
    const data = await addCourseToCampaign(actorId, String(req.params.slug ?? ""), parsed.data);
    res.status(201).json({ status: "success", message: "Kursus ditambahkan ke promo", data });
  } catch (e) {
    if (promoError(res, e)) return;
    next(e);
  }
};

export const removeCourseHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const actorId = uid(req);
    if (actorId === null) {
      res.status(401).json({ status: "error", message: "Token autentikasi diperlukan", data: null });
      return;
    }
    const courseId = Number(req.params.courseId);
    if (!Number.isInteger(courseId) || courseId <= 0) {
      res.status(404).json({ status: "error", message: "Kursus tidak ditemukan", data: null });
      return;
    }
    const data = await removeCourseFromCampaign(actorId, String(req.params.slug ?? ""), courseId);
    res.status(200).json({ status: "success", message: "Kursus dihapus dari promo", data });
  } catch (e) {
    if (promoError(res, e)) return;
    next(e);
  }
};

export const removeHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const actorId = uid(req);
    if (actorId === null) {
      res.status(401).json({ status: "error", message: "Token autentikasi diperlukan", data: null });
      return;
    }
    const data = await deleteCampaign(actorId, String(req.params.slug ?? ""));
    res.status(200).json({ status: "success", message: "Promo dihapus.", data });
  } catch (e) {
    if (promoError(res, e)) return;
    next(e);
  }
};

// ---------- Pengajuan instruktur ----------

const instructorId = (req: AuthenticatedRequest): number | null => uid(req);

export const proposeHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const actorId = instructorId(req);
    if (actorId === null) {
      res.status(401).json({ status: "error", message: "Token autentikasi diperlukan", data: null });
      return;
    }
    const parsed = proposePromoSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        status: "error",
        message: "Data pengajuan promo tidak valid",
        errors: toFieldErrors(parsed.error.issues),
        data: null,
      });
      return;
    }
    const role = String(req.user?.role ?? "");
    const data = await createProposal(actorId, role, String(req.params.slug ?? ""), parsed.data);
    res.status(201).json({ status: "success", message: "Pengajuan terkirim, menunggu persetujuan admin", data });
  } catch (e) {
    if (promoError(res, e)) return;
    next(e);
  }
};

export const myProposalsHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const actorId = instructorId(req);
    if (actorId === null) {
      res.status(401).json({ status: "error", message: "Token autentikasi diperlukan", data: null });
      return;
    }
    const data = await listMyProposals(actorId);
    res.status(200).json({ status: "success", message: "Daftar pengajuanku ke promo", data });
  } catch (e) {
    next(e);
  }
};

/** Tandai keputusan atas pengajuanku sudah dibaca (badge nav hilang). */
export const markSeenHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const actorId = instructorId(req);
    if (actorId === null) {
      res.status(401).json({ status: "error", message: "Token autentikasi diperlukan", data: null });
      return;
    }
    const data = await markProposalsSeen(actorId);
    res.status(200).json({ status: "success", message: "Keputusan promo ditandai dibaca", data });
  } catch (e) {
    next(e);
  }
};

export const myPromosHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const actorId = instructorId(req);
    if (actorId === null) {
      res.status(401).json({ status: "error", message: "Token autentikasi diperlukan", data: null });
      return;
    }
    const data = await listInstructorPromoMemberships(actorId);
    res.status(200).json({ status: "success", message: "Kursusku yang masuk promo", data });
  } catch (e) {
    next(e);
  }
};

export const adminProposalsHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const q = req.query as Record<string, unknown>;
    const data = await listProposalsAdmin({
      status: typeof q.status === "string" ? q.status : undefined,
    });
    res.status(200).json({ status: "success", message: "Daftar pengajuan promo", data });
  } catch (e) {
    next(e);
  }
};

export const approveProposalHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const actorId = instructorId(req);
    if (actorId === null) {
      res.status(401).json({ status: "error", message: "Token autentikasi diperlukan", data: null });
      return;
    }
    const proposalId = Number(req.params.id);
    if (!Number.isInteger(proposalId) || proposalId <= 0) {
      res.status(404).json({ status: "error", message: "Pengajuan tidak ditemukan", data: null });
      return;
    }
    const data = await approveProposal(actorId, proposalId);
    res.status(200).json({ status: "success", message: "Pengajuan disetujui, kursus masuk promo", data });
  } catch (e) {
    if (promoError(res, e)) return;
    next(e);
  }
};

export const rejectProposalHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const actorId = instructorId(req);
    if (actorId === null) {
      res.status(401).json({ status: "error", message: "Token autentikasi diperlukan", data: null });
      return;
    }
    const proposalId = Number(req.params.id);
    if (!Number.isInteger(proposalId) || proposalId <= 0) {
      res.status(404).json({ status: "error", message: "Pengajuan tidak ditemukan", data: null });
      return;
    }
    const parsed = decideProposalSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({
        status: "error",
        message: "Data penolakan tidak valid",
        errors: toFieldErrors(parsed.error.issues),
        data: null,
      });
      return;
    }
    const data = await rejectProposal(actorId, proposalId, parsed.data.note);
    res.status(200).json({ status: "success", message: "Pengajuan ditolak", data });
  } catch (e) {
    if (promoError(res, e)) return;
    next(e);
  }
};
