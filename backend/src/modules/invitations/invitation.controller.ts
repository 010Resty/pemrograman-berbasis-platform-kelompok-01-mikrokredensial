import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware";
import {
  InvitationError,
  acceptInvitation,
  acceptInvitationSchema,
  createInvitation,
  createInvitationSchema,
  listInvitations,
  revokeInvitation,
  validateInvitation,
} from "./invitation.service";

const uid = (req: AuthenticatedRequest): number | null => {
  const id = Number(req.user?.id);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const invitationError = (res: Response, e: unknown): boolean => {
  if (e instanceof InvitationError) {
    res.status(e.http).json({
      status: "error",
      message: e.message,
      code: e.code,
      data: null,
    });
    return true;
  }
  return false;
};

const toFieldErrors = (
  issues: Array<{ path: Array<string | number>; message: string }>
) =>
  issues.map((i) => ({
    field: i.path.length > 0 ? String(i.path[0]) : "body",
    message: i.message,
  }));

const needAdmin = (req: AuthenticatedRequest, res: Response): number | null => {
  const userId = uid(req);
  if (userId === null) {
    res.status(401).json({
      status: "error",
      message: "Token autentikasi diperlukan",
      data: null,
    });
    return null;
  }
  return userId;
};

// POST /api/v1/admin/invitations — buat undangan (token plaintext sekali saja).
export const createHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const actorId = needAdmin(req, res);
    if (actorId === null) return;
    const parsed = createInvitationSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        status: "error",
        message: "Data undangan tidak valid",
        errors: toFieldErrors(parsed.error.issues),
        data: null,
      });
      return;
    }
    try {
      const result = await createInvitation(actorId, parsed.data);
      res.status(201).json({
        status: "success",
        message: "Undangan dibuat. Salin token berikut — hanya tampil sekali.",
        data: result,
      });
    } catch (e) {
      if (!invitationError(res, e)) throw e;
    }
  } catch (e) {
    next(e);
  }
};

// GET /api/v1/admin/invitations[?status=] — daftar (tanpa token hash).
export const listHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = needAdmin(req, res);
    if (userId === null) return;
    void userId;
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    res.status(200).json({
      status: "success",
      message: "Daftar undangan instruktur",
      data: { items: await listInvitations(status) },
    });
  } catch (e) {
    next(e);
  }
};

// POST /api/v1/admin/invitations/:id/revoke — cabut undangan.
export const revokeHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const actorId = needAdmin(req, res);
    if (actorId === null) return;
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(404).json({
        status: "error",
        message: "Undangan tidak ditemukan",
        code: "INVITATION_NOT_FOUND",
        data: null,
      });
      return;
    }
    const reason =
      req.body !== null && typeof req.body === "object" && typeof (req.body as Record<string, unknown>).reason === "string"
        ? String((req.body as Record<string, unknown>).reason).slice(0, 500)
        : undefined;
    try {
      res.status(200).json({
        status: "success",
        message: "Undangan dicabut.",
        data: await revokeInvitation(actorId, id, reason),
      });
    } catch (e) {
      if (!invitationError(res, e)) throw e;
    }
  } catch (e) {
    next(e);
  }
};

// GET /api/v1/invitations/validate?token= — info minimal untuk form aktivasi.
export const validateHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = typeof req.query.token === "string" ? req.query.token.trim() : "";
    if (!token) {
      res.status(404).json({
        status: "error",
        message: "Undangan tidak valid",
        code: "INVITATION_NOT_FOUND",
        data: null,
      });
      return;
    }
    try {
      res.status(200).json({
        status: "success",
        message: "Undangan valid",
        data: await validateInvitation(token),
      });
    } catch (e) {
      if (!invitationError(res, e)) throw e;
    }
  } catch (e) {
    next(e);
  }
};

// POST /api/v1/invitations/accept — aktivasi akun instruktur.
export const acceptHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const parsed = acceptInvitationSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        status: "error",
        message: "Data aktivasi tidak valid",
        errors: toFieldErrors(parsed.error.issues),
        data: null,
      });
      return;
    }
    try {
      const result = await acceptInvitation(parsed.data);
      res.status(201).json({
        status: "success",
        message: result.message,
        data: { accessToken: result.accessToken, user: result.user },
      });
    } catch (e) {
      if (!invitationError(res, e)) throw e;
    }
  } catch (e) {
    next(e);
  }
};
