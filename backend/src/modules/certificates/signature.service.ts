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
    // Batch: 1× primaryBatchByCourse (dulu N× primaryInstructorId sekuensial).
    const batch = await primaryBatchByCourse(candidates);
    const signed: number[] = candidates.filter(
      (cid) => batch.get(cid)?.signerId === teacherId
    );
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

/** Hasil resolusi penanda tangan utama per kursus (aturan SAMA seperti
 * `primaryInstructorId` + nama di PDF: pengampu ter awal → pembuat kursus).
 * Satu batch untuk banyak kursus: 3 query total (dulu sampai 6×C query). */
export interface CoursePrimary {
  signerId: number | null;
  name: string | null;
  signatureUrl: string | null;
}

export const primaryBatchByCourse = async (
  courseIds: number[]
): Promise<Map<number, CoursePrimary>> => {
  const uniq = [...new Set(courseIds.filter((id) => Number.isInteger(id) && id > 0))];
  const out = new Map<number, CoursePrimary>();
  for (const cid of courseIds) {
    if (!out.has(cid))
      out.set(cid, { signerId: null, name: null, signatureUrl: null });
  }
  if (uniq.length === 0) return out;
  try {
    const [links, owned] = await Promise.all([
      db
        .select({
          courseId: courseInstructors.courseId,
          userId: courseInstructors.userId,
        })
        .from(courseInstructors)
        .where(inArray(courseInstructors.courseId, uniq))
        .orderBy(
          asc(courseInstructors.courseId),
          asc(courseInstructors.assignedAt),
          asc(courseInstructors.userId)
        ),
      db
        .select({ id: courses.id, createdBy: courses.createdBy })
        .from(courses)
        .where(inArray(courses.id, uniq)),
    ]);
    const firstLink = new Map<number, number>();
    for (const l of links) {
      if (!firstLink.has(l.courseId)) firstLink.set(l.courseId, l.userId);
    }
    const ownerByCourse = new Map(
      owned.map((o) => [o.id, o.createdBy as number | null])
    );
    const signerByCourse = new Map<number, number | null>();
    for (const cid of uniq) {
      signerByCourse.set(cid, firstLink.get(cid) ?? ownerByCourse.get(cid) ?? null);
    }
    const signerIds = [
      ...new Set(
        [...signerByCourse.values()].filter(
          (id): id is number => id !== null
        )
      ),
    ];
    const nameByUser = new Map<number, string>();
    const sigByUser = new Map<number, number | null>();
    if (signerIds.length > 0) {
      const us = await db
        .select({
          id: users.id,
          name: users.name,
          signatureFileId: users.signatureFileId,
        })
        .from(users)
        .where(inArray(users.id, signerIds));
      for (const u of us) {
        nameByUser.set(u.id, u.name);
        sigByUser.set(u.id, u.signatureFileId ?? null);
      }
    }
    for (const cid of uniq) {
      const sid = signerByCourse.get(cid) ?? null;
      const fid = sid !== null ? (sigByUser.get(sid) ?? null) : null;
      out.set(cid, {
        signerId: sid,
        name: sid !== null ? (nameByUser.get(sid) ?? null) : null,
        signatureUrl: fid ? `/api/v1/files/${fid}/content` : null,
      });
    }
  } catch (e) {
    console.error("[certificate] Gagal batch instruktur utama:", e);
  }
  return out;
};

/** URL tanda tangan penanda tangan per kursus (batch; null = fallback nama diketik). */
export const signatureUrlsByCourse = async (
  courseIds: number[]
): Promise<Map<number, string | null>> => {
  const batch = await primaryBatchByCourse(courseIds);
  const out = new Map<number, string | null>();
  for (const [cid, v] of batch) out.set(cid, v.signatureUrl);
  // Pertahankan kunci untuk id tak valid (dulu: null per course).
  for (const cid of courseIds) if (!out.has(cid)) out.set(cid, null);
  return out;
};

/** URL tanda tangan penanda tangan satu kursus (null = fallback nama diketik). */
export const signatureUrlForCourse = async (courseId: number): Promise<string | null> => {
  return (await signatureUrlsByCourse([courseId])).get(courseId) ?? null;
};
