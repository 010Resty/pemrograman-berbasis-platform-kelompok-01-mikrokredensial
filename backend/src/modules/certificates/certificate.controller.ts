import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware";
import {
  CertificateError,
  getCertificateDetail,
  getModuleEligibility,
  issueCertificate,
  issueInputSchema,
  listCertificates,
  listModuleEligibility,
  listMyCertificates,
  revokeCertificate,
  revokeInputSchema,
  verifyCertificate,
  type ParticipantEligibilityStatus,
} from "./certificate.service";

const uid = (req: AuthenticatedRequest): number | null => {
  const id = Number(req.user?.id);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const needAuth = (req: AuthenticatedRequest, res: Response): number | null => {
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

const certError = (res: Response, e: unknown): boolean => {
  if (e instanceof CertificateError) {
    const body: Record<string, unknown> = {
      status: "error",
      message: e.message,
      code: e.code,
      data: null,
    };
    if (e.http === 403 && e.code === "NOT_ELIGIBLE") {
      body.failReasons =
        (e.details as { failReasons?: string[] } | undefined)?.failReasons ?? [];
      body.requirements =
        (e.details as { requirements?: unknown } | undefined)?.requirements ?? [];
    }
    res.status(e.http).json(body);
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

const validModuleId = (req: AuthenticatedRequest, res: Response): number | null => {
  const moduleId = Number(req.params.id);
  if (!Number.isInteger(moduleId) || moduleId <= 0) {
    res.status(404).json({
      status: "error",
      message: "Modul tidak ditemukan",
      code: "MODULE_NOT_FOUND",
      data: null,
    });
    return null;
  }
  return moduleId;
};

// POST /api/v1/modules/:id/certificate — terbitkan (idempoten).
export const issueHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = needAuth(req, res);
    if (userId === null) return;
    const moduleId = validModuleId(req, res);
    if (moduleId === null) return;
    const parsed = issueInputSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({
        status: "error",
        message: "Data penerbitan tidak valid",
        errors: toFieldErrors(parsed.error.issues),
        data: null,
      });
      return;
    }
    try {
      const result = await issueCertificate(
        userId,
        req.user?.role ?? "",
        moduleId,
        parsed.data
      );
      res.status(result.created ? 201 : 200).json({
        status: "success",
        message: result.created
          ? "Sertifikat berhasil diterbitkan."
          : "Sertifikat sudah pernah diterbitkan.",
        data: result.certificate,
      });
    } catch (e) {
      if (!certError(res, e)) throw e;
    }
  } catch (e) {
    next(e);
  }
};

// GET /api/v1/me/certificates — daftar milik sendiri.
export const myCertificatesHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = needAuth(req, res);
    if (userId === null) return;
    res.status(200).json({
      status: "success",
      message: "Sertifikat saya",
      data: await listMyCertificates(userId),
    });
  } catch (e) {
    next(e);
  }
};

// GET /api/v1/me/modules/:id/certificate-status — kelayakan milik sendiri.
export const myStatusHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = needAuth(req, res);
    if (userId === null) return;
    const moduleId = validModuleId(req, res);
    if (moduleId === null) return;
    try {
      res.status(200).json({
        status: "success",
        message: "Status kelayakan sertifikat",
        data: await getModuleEligibility(userId, req.user?.role ?? "", moduleId),
      });
    } catch (e) {
      if (!certError(res, e)) throw e;
    }
  } catch (e) {
    next(e);
  }
};

// GET /api/v1/certificates/verify/:code — verifikasi publik (minimal, aman).
export const verifyHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const code = typeof req.params.code === "string" ? req.params.code.trim() : "";
    if (!code) {
      res.status(404).json({
        status: "error",
        message: "Kode sertifikat tidak ditemukan",
        code: "CODE_NOT_FOUND",
        data: null,
      });
      return;
    }
    try {
      res.status(200).json({
        status: "success",
        message: "Hasil verifikasi sertifikat",
        data: await verifyCertificate(code),
      });
    } catch (e) {
      if (!certError(res, e)) throw e;
    }
  } catch (e) {
    next(e);
  }
};

const parseListQuery = (req: AuthenticatedRequest) => {
  const q = req.query;
  const num = (v: unknown): number | undefined => {
    if (typeof v !== "string" || v.trim() === "") return undefined;
    const n = Number(v);
    return Number.isInteger(n) && n > 0 ? n : undefined;
  };
  const statusRaw: unknown = q.status;
  const status: "issued" | "revoked" | undefined =
    statusRaw === "issued" || statusRaw === "revoked" ? statusRaw : undefined;
  return {
    courseId: num(q.courseId),
    moduleId: num(q.moduleId),
    status,
    q: typeof q.q === "string" && q.q.trim() !== "" ? q.q.trim().slice(0, 100) : undefined,
    limit: num(q.limit),
    page: num(q.page),
  };
};

// GET /api/v1/instructor/certificates — riwayat (termasuk dicabut).
export const instructorListHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = needAuth(req, res);
    if (userId === null) return;
    try {
      const { items, total } = await listCertificates(
        userId,
        req.user?.role ?? "",
        parseListQuery(req)
      );
      res.status(200).json({
        status: "success",
        message: "Riwayat sertifikat",
        data: { items, total },
      });
    } catch (e) {
      if (!certError(res, e)) throw e;
    }
  } catch (e) {
    next(e);
  }
};

// GET /api/v1/instructor/certificates/:id — detail + snapshot.
export const instructorDetailHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = needAuth(req, res);
    if (userId === null) return;
    const certId = Number(req.params.certId);
    if (!Number.isInteger(certId) || certId <= 0) {
      res.status(404).json({
        status: "error",
        message: "Sertifikat tidak ditemukan",
        code: "CERT_NOT_FOUND",
        data: null,
      });
      return;
    }
    try {
      res.status(200).json({
        status: "success",
        message: "Detail sertifikat",
        data: await getCertificateDetail(userId, req.user?.role ?? "", certId),
      });
    } catch (e) {
      if (!certError(res, e)) throw e;
    }
  } catch (e) {
    next(e);
  }
};

// POST /api/v1/instructor/certificates/:id/revoke — cabut + alasan wajib.
export const revokeHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = needAuth(req, res);
    if (userId === null) return;
    const certId = Number(req.params.certId);
    if (!Number.isInteger(certId) || certId <= 0) {
      res.status(404).json({
        status: "error",
        message: "Sertifikat tidak ditemukan",
        code: "CERT_NOT_FOUND",
        data: null,
      });
      return;
    }
    const parsed = revokeInputSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({
        status: "error",
        message: "Alasan pencabutan wajib diisi (min. 5 karakter)",
        errors: toFieldErrors(parsed.error.issues),
        data: null,
      });
      return;
    }
    try {
      res.status(200).json({
        status: "success",
        message: "Sertifikat dicabut.",
        data: await revokeCertificate(
          userId,
          req.user?.role ?? "",
          certId,
          parsed.data.reason
        ),
      });
    } catch (e) {
      if (!certError(res, e)) throw e;
    }
  } catch (e) {
    next(e);
  }
};

const ELIGIBILITY_STATUSES: ParticipantEligibilityStatus[] = [
  "belum_memenuhi",
  "menunggu_penilaian",
  "memenuhi",
  "sudah_terbit",
];

// GET /api/v1/instructor/modules/:id/eligibility — kelayakan per peserta.
export const eligibilityHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = needAuth(req, res);
    if (userId === null) return;
    const moduleId = validModuleId(req, res);
    if (moduleId === null) return;
    const raw = req.query.status;
    const onlyStatus = ELIGIBILITY_STATUSES.includes(raw as ParticipantEligibilityStatus)
      ? (raw as ParticipantEligibilityStatus)
      : undefined;
    try {
      res.status(200).json({
        status: "success",
        message: "Kelayakan peserta",
        data: {
          items: await listModuleEligibility(
            userId,
            req.user?.role ?? "",
            moduleId,
            onlyStatus
          ),
        },
      });
    } catch (e) {
      if (!certError(res, e)) throw e;
    }
  } catch (e) {
    next(e);
  }
};
