import { Response, NextFunction } from "express";
import { inArray } from "drizzle-orm";
import { db } from "../../db";
import { users } from "../../db/schema";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware";
import { normalizeUsername } from "../../utils/username";
import {
  PatunganError,
  cancelGroupSchema,
  cancelPatunganGroup,
  createPatunganGroup,
  getPatunganGroupDetail,
  listMyPatunganGroups,
  resolveGroupMembers,
  validateMembersSchema,
} from "./patungan.service";

const toFieldErrors = (issues: Array<{ path: Array<string | number>; message: string }>) =>
  issues.map((i) => ({
    field: i.path.length > 0 ? String(i.path[0]) : "body",
    message: i.message,
  }));

const patunganError = (res: Response, e: unknown): boolean => {
  if (e instanceof PatunganError) {
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
      message: "Data patungan tidak valid",
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

// ---------- Cek username anggota (tanpa bocor data sensitif) ----------

export const validateHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const me = uid(req);
    if (me === null) {
      res.status(401).json({ status: "error", message: "Token autentikasi diperlukan", data: null });
      return;
    }
    const parsed = validateMembersSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        status: "error",
        message: "Data patungan tidak valid",
        errors: toFieldErrors(parsed.error.issues),
        data: null,
      });
      return;
    }
    // Best-effort per username (ada/tidak + nama tampil) + status siap.
    const normalized = parsed.data.usernames.map((u) => normalizeUsername(u));
    const rows = await db
      .select({ username: users.username, name: users.name })
      .from(users)
      .where(inArray(users.username, normalized));
    const byUsername = new Map(rows.map((r) => [r.username, r.name]));
    const members = normalized.map((u) => ({
      username: u,
      exists: byUsername.has(u),
      displayName: byUsername.get(u) ?? null,
    }));
    try {
      const resolved = await resolveGroupMembers(me, parsed.data.courseId, parsed.data.usernames);
      const shares: Record<string, number> = {};
      resolved.members.forEach((m, i) => {
        shares[m.username] = resolved.shares[i + 1] as number;
      });
      res.status(200).json({
        status: "success",
        message: "Semua anggota valid",
        data: {
          ready: true as const,
          members: [
            { username: resolved.creator.username, exists: true, displayName: resolved.creator.name },
            ...resolved.members.map((m) => ({ username: m.username, exists: true, displayName: m.name })),
          ],
          creatorShare: resolved.shares[0],
          shares,
          total: resolved.course.priceNominal,
          memberCount: 1 + resolved.members.length,
          course: resolved.course,
          campaign: { slug: resolved.campaign.slug, title: resolved.campaign.title },
        },
      });
    } catch (e) {
      if (e instanceof PatunganError) {
        res.status(200).json({
          status: "success",
          message: "Validasi selesai",
          data: { ready: false as const, members, error: { code: e.code, message: e.message } },
        });
        return;
      }
      throw e;
    }
  } catch (e) {
    if (patunganError(res, e)) return;
    next(e);
  }
};

// ---------- Buat grup ----------

export const createHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const me = uid(req);
    if (me === null) {
      res.status(401).json({ status: "error", message: "Token autentikasi diperlukan", data: null });
      return;
    }
    const parsed = validateMembersSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        status: "error",
        message: "Data patungan tidak valid",
        errors: toFieldErrors(parsed.error.issues),
        data: null,
      });
      return;
    }
    const data = await createPatunganGroup(me, parsed.data.courseId, parsed.data.usernames);
    res.status(201).json({ status: "success", message: "Grup patungan dibuat", data });
  } catch (e) {
    if (patunganError(res, e)) return;
    next(e);
  }
};

// ---------- Baca grup saya / detail ----------

export const myGroupsHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const me = uid(req);
    if (me === null) {
      res.status(401).json({ status: "error", message: "Token autentikasi diperlukan", data: null });
      return;
    }
    const data = await listMyPatunganGroups(me);
    res.status(200).json({ status: "success", message: "Daftar grup patungan saya", data });
  } catch (e) {
    if (patunganError(res, e)) return;
    next(e);
  }
};

export const detailHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const me = uid(req);
    if (me === null) {
      res.status(401).json({ status: "error", message: "Token autentikasi diperlukan", data: null });
      return;
    }
    const groupId = Number(req.params.id);
    if (!Number.isInteger(groupId) || groupId <= 0) {
      res.status(404).json({ status: "error", message: "Grup patungan tidak ditemukan", data: null });
      return;
    }
    const role = typeof req.user?.role === "string" ? req.user.role : "student";
    const data = await getPatunganGroupDetail(me, role, groupId);
    res.status(200).json({ status: "success", message: "Detail grup patungan", data });
  } catch (e) {
    if (patunganError(res, e)) return;
    next(e);
  }
};

// ---------- Batal grup ----------

const cancel = async (req: AuthenticatedRequest, res: Response, next: NextFunction, admin: boolean) => {
  try {
    const me = uid(req);
    if (me === null) {
      res.status(401).json({ status: "error", message: "Token autentikasi diperlukan", data: null });
      return;
    }
    const groupId = Number(req.params.id);
    if (!Number.isInteger(groupId) || groupId <= 0) {
      res.status(404).json({ status: "error", message: "Grup patungan tidak ditemukan", data: null });
      return;
    }
    const parsed = cancelGroupSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({
        status: "error",
        message: "Data pembatalan tidak valid",
        errors: toFieldErrors(parsed.error.issues),
        data: null,
      });
      return;
    }
    const role = admin ? "admin" : typeof req.user?.role === "string" ? req.user.role : "student";
    const data = await cancelPatunganGroup(me, role, groupId, parsed.data.reason);
    res.status(200).json({ status: "success", message: "Grup patungan dibatalkan", data });
  } catch (e) {
    if (patunganError(res, e)) return;
    next(e);
  }
};

export const cancelHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) =>
  cancel(req, res, next, false);

export const adminCancelHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) =>
  cancel(req, res, next, true);
