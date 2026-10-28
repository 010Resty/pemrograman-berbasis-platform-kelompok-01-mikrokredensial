import { Response, NextFunction } from "express";
import { z } from "zod";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware";
import {
  CertificateError,
  getCertificateDetail,
  getGlobalEligibilityDetail,
  getModuleCertificateStatus,
  getCertificateSummary,
  getModuleEligibility,
  issueCertificate,
  issueInputSchema,
  listCertificates,
  listGlobalEligibility,
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

const certificateListQuerySchema = z
  .object({
    courseId: z.coerce.number().int().positive().optional(),
    moduleId: z.coerce.number().int().positive().optional(),
    status: z.enum(["issued", "revoked", "aktif", "dicabut"]).optional(),
    q: z.string().trim().max(100).optional(),
    from: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal from YYYY-MM-DD")
      .optional(),
    to: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal to YYYY-MM-DD")
      .optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    page: z.coerce.number().int().min(1).max(1000).optional(),
  })
  .strict();

const eligibilityQuerySchema = z
  .object({
    courseId: z.coerce.number().int().positive().optional(),
    moduleId: z.coerce.number().int().positive().optional(),
    status: z
      .enum(["belum_memenuhi", "menunggu_penilaian", "memenuhi", "sudah_terbit"])
      .optional(),
    q: z.string().trim().max(100).optional(),
  })
  .strict();

const parseListQuery = (req: AuthenticatedRequest) => {
  const parsed = certificateListQuerySchema.safeParse(req.query ?? {});
  if (!parsed.success) {
    // Fallback aman: abaikan query tak valid kecuali status yang dikenali.
    const q = req.query as Record<string, unknown>;
    const num = (v: unknown): number | undefined => {
      if (typeof v !== "string" || v.trim() === "") return undefined;
      const n = Number(v);
      return Number.isInteger(n) && n > 0 ? n : undefined;
    };
    const statusRaw: unknown = q.status;
    const status: "issued" | "revoked" | "aktif" | "dicabut" | undefined =
      statusRaw === "issued" ||
      statusRaw === "revoked" ||
      statusRaw === "aktif" ||
      statusRaw === "dicabut"
        ? statusRaw
        : undefined;
    const dateRe = /^\d{4}-\d{2}-\d{2}$/;
    const dateOrUndef = (v: unknown): string | undefined =>
      typeof v === "string" && dateRe.test(v.trim()) ? v.trim() : undefined;
    return {
      courseId: num(q.courseId),
      moduleId: num(q.moduleId),
      status,
      q:
        typeof q.q === "string" && q.q.trim() !== ""
          ? q.q.trim().slice(0, 100)
          : undefined,
      from: dateOrUndef(q.from),
      to: dateOrUndef(q.to),
      limit: num(q.limit),
      page: num(q.page),
    };
  }
  const d = parsed.data;
  return {
    courseId: d.courseId,
    moduleId: d.moduleId,
    status: d.status,
    q: d.q && d.q.trim() !== "" ? d.q.trim() : undefined,
    from: d.from,
    to: d.to,
    limit: d.limit,
    page: d.page,
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

// GET /api/v1/instructor/certificates/summary — ringkasan tab ringkasan.
export const instructorSummaryHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = needAuth(req, res);
    if (userId === null) return;
    try {
      res.status(200).json({
        status: "success",
        message: "Ringkasan sertifikat instruktur",
        data: await getCertificateSummary(userId, req.user?.role ?? ""),
      });
    } catch (e) {
      if (!certError(res, e)) throw e;
    }
  } catch (e) {
    next(e);
  }
};

// GET /api/v1/instructor/modules/:id/certificate-status — angka satu modul.
export const moduleCertificateStatusHandler = async (
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
        message: "Status sertifikat modul",
        data: await getModuleCertificateStatus(
          userId,
          req.user?.role ?? "",
          moduleId
        ),
      });
    } catch (e) {
      if (!certError(res, e)) throw e;
    }
  } catch (e) {
    next(e);
  }
};

// GET /api/v1/instructor/eligibility — kelayakan lintas modul/kursus.
export const globalEligibilityHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = needAuth(req, res);
    if (userId === null) return;
    const parsed = eligibilityQuerySchema.safeParse(req.query ?? {});
    if (!parsed.success) {
      res.status(400).json({
        status: "error",
        message: "Parameter filter kelayakan tidak valid",
        errors: toFieldErrors(parsed.error.issues),
        data: null,
      });
      return;
    }
    const d = parsed.data;
    try {
      const items = await listGlobalEligibility(userId, req.user?.role ?? "", {
        courseId: d.courseId,
        moduleId: d.moduleId,
        status: d.status,
        q: d.q && d.q.trim() !== "" ? d.q.trim() : undefined,
      });
      res.status(200).json({
        status: "success",
        message: "Kelayakan peserta",
        data: { items, total: items.length },
      });
    } catch (e) {
      if (!certError(res, e)) throw e;
    }
  } catch (e) {
    next(e);
  }
};

// GET /api/v1/instructor/eligibility/:id — rincian satu kelayakan.
export const globalEligibilityDetailHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = needAuth(req, res);
    if (userId === null) return;
    const id = typeof req.params.id === "string" ? req.params.id : "";
    if (!id) {
      res.status(404).json({
        status: "error",
        message: "Data kelayakan tidak ditemukan",
        code: "ELIGIBILITY_NOT_FOUND",
        data: null,
      });
      return;
    }
    try {
      res.status(200).json({
        status: "success",
        message: "Detail kelayakan peserta",
        data: await getGlobalEligibilityDetail(
          userId,
          req.user?.role ?? "",
          decodeURIComponent(id)
        ),
      });
    } catch (e) {
      if (!certError(res, e)) throw e;
    }
  } catch (e) {
    next(e);
  }
};
