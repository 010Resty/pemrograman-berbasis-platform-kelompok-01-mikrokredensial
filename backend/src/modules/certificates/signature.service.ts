import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "../../db";
import {
  auditLogs,
  certificates,
  courseInstructors,
  courses,
  files,
  users,
} from "../../db/schema";
import { deleteFileById, getUploadsDir } from "../uploads/upload.service";

export class SignatureError extends Error {
  http: number;
  code: string;
  constructor(http: number, code: string, message: string) {
    super(message);
    this.http = http;
    this.code = code;
  }
}

export const setSignatureSchema = z
  .object({
    fileId: z.number().int().positive(),
  })
  .strict();

/** Tanda tangan milik sendiri (untuk pratinjau di menu instruktur). */
export const getMySignature = async (teacherId: number) => {
  const rows = await db
    .select({ signatureFileId: users.signatureFileId })
    .from(users)
    .where(eq(users.id, teacherId))
    .limit(1);
  const fileId = rows[0]?.signatureFileId ?? null;
  if (!fileId) return { fileId: null as number | null, url: null as string | null };
  return { fileId, url: `/api/v1/files/${fileId}/content` };
};

/**
 * Instruktur utama kursus (aturan SAMA seperti nama yang tercetak di PDF):
 * pengampu terawal → pembuat kursus → null (fallback generik).
 */
export const primaryInstructorId = async (courseId: number): Promise<number | null> => {
  try {
    const link = await db
      .select({ userId: courseInstructors.userId })
      .from(courseInstructors)
      .where(eq(courseInstructors.courseId, courseId))
      .orderBy(asc(courseInstructors.assignedAt), asc(courseInstructors.userId))
      .limit(1);
    if (link[0]) return link[0].userId;
    const course = await db
      .select({ createdBy: courses.createdBy })
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1);
    return course[0]?.createdBy ?? null;
  } catch (e) {
    console.error("[certificate] Gagal membaca instruktur utama:", e);
    return null;
  }
};

/** Byte PNG tanda tangan penanda tangan kursus (null = fallback nama diketik). */
export const getSignerSignaturePng = async (courseId: number): Promise<Buffer | null> => {
  try {
    const signerId = await primaryInstructorId(courseId);
    if (!signerId) return null;
    const uRows = await db
      .select({ signatureFileId: users.signatureFileId })
      .from(users)
      .where(eq(users.id, signerId))
      .limit(1);
    const fileId = uRows[0]?.signatureFileId ?? null;
    if (!fileId) return null;
    const fRows = await db.select().from(files).where(eq(files.id, fileId)).limit(1);
    const f = fRows[0];
    if (!f || f.kind !== "signature") return null;
    const dir = getUploadsDir();
    const fullPath = path.resolve(dir, f.storageKey);
    if (!fullPath.startsWith(dir + path.sep)) return null;
    return await fs.readFile(fullPath);
  } catch (e) {
    console.error("[certificate] Gagal memuat tanda tangan:", e);
    return null;
  }
};

/** Hapus cache PDF sertifikat kursus yang ditandatangani guru ini (lazy regen). */
const clearCoursePdfCacheForSigner = async (teacherId: number): Promise<number> => {
  try {
    const linked = await db
      .selectDistinct({ courseId: courseInstructors.courseId })
      .from(courseInstructors)
      .where(eq(courseInstructors.userId, teacherId));
    const created = await db
      .select({ id: courses.id })
      .from(courses)
      .where(eq(courses.createdBy, teacherId));
    const candidates = [...new Set([...linked.map((r) => r.courseId), ...created.map((r) => r.id)])];
    const signed: number[] = [];
    for (const cid of candidates) {
      if ((await primaryInstructorId(cid)) === teacherId) signed.push(cid);
    }
    if (signed.length === 0) return 0;
    const certRows = await db
      .select({ code: certificates.code })
      .from(certificates)
      .where(inArray(certificates.courseId, signed));
    const dir = path.resolve(getUploadsDir(), "..", "certificates");
    let cleared = 0;
    for (const c of certRows) {
      for (const prefix of ["v4", "v3", "v2"]) {
        const fullPath = path.resolve(dir, `${prefix}-${c.code}.pdf`);
        if (!fullPath.startsWith(dir + path.sep)) continue;
        try {
          await fs.unlink(fullPath);
          cleared++;
        } catch {
          // Belum pernah diunduh — abaikan.
        }
      }
    }
    return cleared;
  } catch (e) {
    console.error("[certificate] Gagal membersihkan cache PDF:", e);
    return 0;
  }
};

/** Pasang/ganti tanda tangan milik sendiri (file lama dihapus, tanpa yatim). */
export const setMySignature = async (teacherId: number, fileId: number) => {
  const fRows = await db.select().from(files).where(eq(files.id, fileId)).limit(1);
  const f = fRows[0];
  if (!f) throw new SignatureError(404, "FILE_NOT_FOUND", "Berkas tidak ditemukan");
  if (f.kind !== "signature") {
    throw new SignatureError(400, "FILE_INVALID", "Berkas harus diunggah sebagai tanda tangan");
  }
  if (f.ownerUserId !== teacherId) {
    throw new SignatureError(403, "FILE_NOT_OWNED", "Berkas tanda tangan bukan milik Anda");
  }
  const uRows = await db
    .select({ signatureFileId: users.signatureFileId })
    .from(users)
    .where(eq(users.id, teacherId))
    .limit(1);
  const oldId = uRows[0]?.signatureFileId ?? null;
  await db.update(users).set({ signatureFileId: fileId }).where(eq(users.id, teacherId));
  if (oldId && oldId !== fileId) {
    await deleteFileById(oldId, teacherId);
  }
  const cleared = await clearCoursePdfCacheForSigner(teacherId);
  await db.insert(auditLogs).values({
    actorUserId: teacherId,
    action: "certificate.signature_update",
    targetType: "user",
    targetIdInt: teacherId,
    metadata: { fileId, clearedPdfs: cleared },
  });
  return { fileId, url: `/api/v1/files/${fileId}/content`, clearedPdfs: cleared };
};

/** Lepas tanda tangan (kembali ke fallback nama diketik). */
export const removeMySignature = async (teacherId: number) => {
  const uRows = await db
    .select({ signatureFileId: users.signatureFileId })
    .from(users)
    .where(eq(users.id, teacherId))
    .limit(1);
  const oldId = uRows[0]?.signatureFileId ?? null;
  if (!oldId) return { fileId: null as number | null };
  await db.update(users).set({ signatureFileId: null }).where(eq(users.id, teacherId));
  await deleteFileById(oldId, teacherId);
  const cleared = await clearCoursePdfCacheForSigner(teacherId);
  await db.insert(auditLogs).values({
    actorUserId: teacherId,
    action: "certificate.signature_remove",
    targetType: "user",
    targetIdInt: teacherId,
    metadata: { clearedPdfs: cleared },
  });
  return { fileId: null as number | null };
};

/** URL tanda tangan penanda tangan per kursus (batch; null = fallback nama diketik). */
export const signatureUrlsByCourse = async (
  courseIds: number[]
): Promise<Map<number, string | null>> => {
  const out = new Map<number, string | null>();
  await Promise.all(
    [...new Set(courseIds)].map(async (cid) => {
      try {
        const signerId = await primaryInstructorId(cid);
        if (!signerId) {
          out.set(cid, null);
          return;
        }
        const u = await db
          .select({ signatureFileId: users.signatureFileId })
          .from(users)
          .where(eq(users.id, signerId))
          .limit(1);
        const fid = u[0]?.signatureFileId ?? null;
        out.set(cid, fid ? `/api/v1/files/${fid}/content` : null);
      } catch (e) {
        console.error("[certificate] Gagal membaca URL tanda tangan:", e);
        out.set(cid, null);
      }
    })
  );
  return out;
};

/** URL tanda tangan penanda tangan satu kursus (null = fallback nama diketik). */
export const signatureUrlForCourse = async (courseId: number): Promise<string | null> => {
  return (await signatureUrlsByCourse([courseId])).get(courseId) ?? null;
};
