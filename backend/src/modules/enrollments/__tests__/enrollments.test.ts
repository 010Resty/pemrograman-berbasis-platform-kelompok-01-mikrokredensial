import "./test-env";
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import path from "node:path";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";
import { migrate } from "drizzle-orm/mysql2/migrator";
import { and, eq } from "drizzle-orm";
import { db, pool } from "../../../db/index";
import * as schema from "../../../db/schema";
import app from "../../../app";

/**
 * Tahap 1 — enrollment & akses kursus.
 * Uji integrasi HTTP penuh melawan database tes TERPISAH
 * (`aristoteles_test_b4`), TIDAK PERNAH menyentuh database live.
 * Mencakup: pendaftaran mandiri gratis, penolakan kursus berbayar/
 * draft/arsip/berakhir, pemberian & pencabutan manual admin (alasan + audit),
 * gating progres/kuis/materi, katalog publik (published + archived).
 *
 * Jalankan dari folder backend/: npx tsx --test <file-ini>
 */

const TEST_PASSWORD = "Katasandi123";

interface Envelope<T> {
  status: "success" | "error";
  message: string;
  code?: string;
  data: T;
  errors?: Array<{ field: string; message: string }> | null;
}

let base = "";
let server: Server | null = null;
let tokens: Record<string, string> = {};
let ids: Record<string, number> = {};

const VALID_TIPTAP = JSON.stringify({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "Halo" }] }],
});

async function api<T>(
  method: string,
  url: string,
  token?: string,
  body?: unknown
): Promise<{ http: number; json: Envelope<T> }> {
  const headers: Record<string, string> = { accept: "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  let payload: string | undefined;
  if (body !== undefined) {
    headers["content-type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const res = await fetch(base + url, { method, headers, body: payload });
  const json = (await res.json()) as Envelope<T>;
  return { http: res.status, json };
}

async function login(email: string): Promise<string> {
  const { http, json } = await api<{ accessToken: string }>(
    "POST",
    "/api/v1/auth/login",
    undefined,
    { email, password: TEST_PASSWORD }
  );
  assert.equal(http, 200);
  assert.equal(json.status, "success");
  return json.data.accessToken;
}

before(async () => {
  const admin = await mysql.createConnection({
    host: "localhost",
    port: 3306,
    user: "root",
    password: "",
  });
  try {
    await admin.query("CREATE DATABASE IF NOT EXISTS aristoteles_test_b4");
  } finally {
    await admin.end();
  }
  await migrate(db, { migrationsFolder: path.resolve("drizzle") });

  const hash = await bcrypt.hash(TEST_PASSWORD, 4);
  const mkUser = async (name: string, email: string, role: "admin" | "teacher" | "student") => {
    const [h] = await db.insert(schema.users).values({ name, email, passwordHash: hash, role });
    return Number((h as unknown as { insertId: number }).insertId);
  };
  ids.admin = await mkUser("Admin Uji", "admin@uji.io", "admin");
  ids.teacher = await mkUser("Guru Uji", "guru@uji.io", "teacher");
  ids.s1 = await mkUser("Siswa Satu", "siswa1@uji.io", "student");
  ids.s2 = await mkUser("Siswa Dua", "siswa2@uji.io", "student");

  const mkCourse = async (
    title: string,
    status: "draft" | "published" | "archived",
    priceNominal: number,
    period: string
  ) => {
    const [h] = await db.insert(schema.courses).values({
      title,
      description: `Deskripsi ${title} yang cukup panjang untuk validasi.`,
      category: "Pengembangan Web",
      level: "Pemula",
      duration: "4 Bulan",
      status,
      priceLabel: priceNominal === 0 ? "GRATIS" : `Rp${priceNominal}`,
      priceNominal,
      period,
      outcomes: ["Hasil belajar pertama yang cukup panjang"],
      tools: ["Laptop"],
      createdBy: ids.teacher,
    });
    return Number((h as unknown as { insertId: number }).insertId);
  };
  ids.freePub = await mkCourse("Kursus Gratis Publish Cukup Panjang", "published", 0, "ongoing");
  ids.paidPub = await mkCourse("Kursus Berbayar Publish Cukup Panjang", "published", 150000, "ongoing");
  ids.upcoming = await mkCourse("Kursus Gratis Upcoming Cukup Panjang", "published", 0, "upcoming");
  ids.ended = await mkCourse("Kursus Gratis Ended Cukup Panjang", "published", 0, "ended");
  ids.archived = await mkCourse("Kursus Gratis Arsip Cukup Panjang", "archived", 0, "ongoing");
  ids.draft = await mkCourse("Kursus Gratis Draft Cukup Panjang", "draft", 0, "ongoing");

  await db.insert(schema.courseInstructors).values(
    [ids.freePub, ids.paidPub, ids.upcoming, ids.ended, ids.archived, ids.draft].map(
      (courseId) => ({ courseId, userId: ids.teacher })
    )
  );

  const mkModule = async (courseId: number, title: string) => {
    const [h] = await db.insert(schema.modules).values({
      courseId,
      title,
      type: "materi",
      position: 0,
    });
    return Number((h as unknown as { insertId: number }).insertId);
  };
  const mkMaterial = async (moduleId: number, title: string, type: "materi" | "kuis") => {
    const [h] = await db.insert(schema.materials).values({
      moduleId,
      title,
      type,
      content: VALID_TIPTAP,
      position: 0,
    });
    return Number((h as unknown as { insertId: number }).insertId);
  };
  ids.modFree = await mkModule(ids.freePub, "Modul Gratis Uji Cukup Panjang");
  ids.matA = await mkMaterial(ids.modFree, "Materi Belajar Gratis Cukup Panjang", "materi");
  ids.matQ = await mkMaterial(ids.modFree, "Kuis Gratis Materi Cukup Panjang", "kuis");
  ids.modPaid = await mkModule(ids.paidPub, "Modul Berbayar Uji Cukup Panjang");
  ids.matPaid = await mkMaterial(ids.modPaid, "Materi Berbayar Penuh Cukup Panjang", "materi");

  const srv = app.listen(0);
  await once(srv, "listening");
  server = srv;
  const addr = srv.address() as AddressInfo;
  base = `http://127.0.0.1:${addr.port}`;
  tokens = {
    admin: await login("admin@uji.io"),
    teacher: await login("guru@uji.io"),
    s1: await login("siswa1@uji.io"),
    s2: await login("siswa2@uji.io"),
  };

  // Bank soal untuk materi kuis (via teacher pengelola).
  const put = await api(
    "PUT",
    `/api/v1/materials/${ids.matQ}/quiz`,
    tokens.teacher,
    {
      questions: [
        {
          questionText: "Ibukota Indonesia?",
          options: [
            { optionText: "Jakarta", isCorrect: true },
            { optionText: "Bandung", isCorrect: false },
          ],
        },
      ],
    }
  );
  assert.equal(put.http, 200);
});

after(async () => {
  if (server) await new Promise<void>((r) => server?.close(() => r()));
  await pool.end();
  const admin = await mysql.createConnection({
    host: "localhost",
    port: 3306,
    user: "root",
    password: "",
  });
  try {
    await admin.query("DROP DATABASE aristoteles_test_b4");
  } finally {
    await admin.end();
  }
});

describe("pendaftaran mandiri kursus gratis", () => {
  it("201 + status akses + daftar saya; duplikat 409", async () => {
    const r = await api<{ status: string; source: string; reactivated: boolean }>(
      "POST",
      `/api/v1/courses/${ids.freePub}/enroll`,
      tokens.s1
    );
    assert.equal(r.http, 201);
    assert.equal(r.json.status, "success");
    assert.equal(r.json.data.status, "active");
    assert.equal(r.json.data.source, "free");

    const dup = await api(
      "POST",
      `/api/v1/courses/${ids.freePub}/enroll`,
      tokens.s1
    );
    assert.equal(dup.http, 409);
    assert.equal(dup.json.code, "ALREADY_ENROLLED");

    const access = await api<{
      hasAccess: boolean;
      enrollment: { status: string; source: string } | null;
    }>(`GET`, `/api/v1/courses/${ids.freePub}/access`, tokens.s1);
    assert.equal(access.http, 200);
    assert.equal(access.json.data.hasAccess, true);
    assert.equal(access.json.data.enrollment?.status, "active");

    const mine = await api<Array<{ courseId: number }>>(
      "GET",
      "/api/v1/me/enrollments",
      tokens.s1
    );
    assert.equal(mine.http, 200);
    assert.ok(mine.json.data.some((c) => c.courseId === ids.freePub));
  });

  it("401 tanpa token; 404 kursus hilang", async () => {
    assert.equal((await api("POST", `/api/v1/courses/${ids.freePub}/enroll`)).http, 401);
    assert.equal(
      (await api("POST", "/api/v1/courses/999999/enroll", tokens.s1)).http,
      404
    );
    assert.equal(
      (await api("GET", "/api/v1/courses/999999/access", tokens.s1)).http,
      404
    );
  });
});

describe("aturan penolakan pendaftaran", () => {
  it("berbayar 403 NEEDS_MANUAL_GRANT; draft 404; arsip/berakhir 403", async () => {
    const paid = await api(
      "POST",
      `/api/v1/courses/${ids.paidPub}/enroll`,
      tokens.s1
    );
    assert.equal(paid.http, 403);
    assert.equal(paid.json.code, "NEEDS_MANUAL_GRANT");

    const draft = await api(
      "POST",
      `/api/v1/courses/${ids.draft}/enroll`,
      tokens.s1
    );
    assert.equal(draft.http, 404);

    for (const id of [ids.archived, ids.ended]) {
      const r = await api("POST", `/api/v1/courses/${id}/enroll`, tokens.s1);
      assert.equal(r.http, 403, `course ${id}`);
      assert.equal(r.json.code, "ENROLLMENT_CLOSED");
    }
  });

  it("upcoming gratis masih boleh daftar", async () => {
    const r = await api("POST", `/api/v1/courses/${ids.upcoming}/enroll`, tokens.s1);
    assert.equal(r.http, 201);
  });
});

describe("gating akses belajar", () => {
  it("tanpa akses: progres/kuis/materi 403, daftar materi tanpa isi", async () => {
    const p = await api("POST", `/api/v1/materials/${ids.matA}/progress`, tokens.s2);
    assert.equal(p.http, 403);
    assert.equal(p.json.code, "NO_ACCESS");

    const d = await api("DELETE", `/api/v1/materials/${ids.matA}/progress`, tokens.s2);
    assert.equal(d.http, 403);

    const detail = await api<{ content: unknown }>(
      "GET",
      `/api/v1/materials/${ids.matA}`,
      tokens.s2
    );
    assert.equal(detail.http, 403);

    const list = await api<Array<{ id: number; content: unknown }>>(
      "GET",
      `/api/v1/modules/${ids.modFree}/materials`,
      tokens.s2
    );
    assert.equal(list.http, 200);
    assert.ok(list.json.data.length > 0);
    for (const m of list.json.data) assert.equal(m.content, null);

    const quiz = await api("GET", `/api/v1/materials/${ids.matQ}/quiz`, tokens.s2);
    assert.equal(quiz.http, 403);

    const att = await api(
      "POST",
      `/api/v1/materials/${ids.matQ}/quiz-attempts`,
      tokens.s2,
      { answers: [] }
    );
    assert.equal(att.http, 403);

    const anon = await api("GET", `/api/v1/materials/${ids.matA}`);
    assert.equal(anon.http, 401);
  });

  it("setelah mendaftar: progres, detail isi, dan kuis terbuka", async () => {
    const e = await api("POST", `/api/v1/courses/${ids.freePub}/enroll`, tokens.s2);
    assert.equal(e.http, 201);

    const p = await api<{ completed: boolean }>(
      "POST",
      `/api/v1/materials/${ids.matA}/progress`,
      tokens.s2
    );
    assert.equal(p.http, 200);
    assert.equal(p.json.data.completed, true);

    const detail = await api<{ content: unknown }>(
      "GET",
      `/api/v1/materials/${ids.matA}`,
      tokens.s2
    );
    assert.equal(detail.http, 200);
    assert.ok(typeof detail.json.data.content === "string");

    const quiz = await api<{ questions: unknown[] }>(
      "GET",
      `/api/v1/materials/${ids.matQ}/quiz`,
      tokens.s2
    );
    assert.equal(quiz.http, 200);
    assert.equal(quiz.json.data.questions.length, 1);
  });

  it("pengelola (teacher) lolos tanpa enrollment", async () => {
    const p = await api<{ completed: boolean }>(
      "POST",
      `/api/v1/materials/${ids.matA}/progress`,
      tokens.teacher
    );
    assert.equal(p.http, 200);
  });
});

describe("pemberian & pencabutan manual admin", () => {
  it("grant berbayar ke s2: 201 + akses + audit log", async () => {
    const g = await api<{ status: string; source: string }>(
      "POST",
      `/api/v1/admin/courses/${ids.paidPub}/grants`,
      tokens.admin,
      { userId: ids.s2, reason: "Beasiswa prestasi semester ini" }
    );
    assert.equal(g.http, 201);
    assert.equal(g.json.data.source, "manual");

    const access = await api<{ hasAccess: boolean }>(
      "GET",
      `/api/v1/courses/${ids.paidPub}/access`,
      tokens.s2
    );
    assert.equal(access.json.data.hasAccess, true);

    const p = await api("POST", `/api/v1/materials/${ids.matPaid}/progress`, tokens.s2);
    assert.equal(p.http, 200);

    const logs = await db
      .select()
      .from(schema.auditLogs)
      .where(eq(schema.auditLogs.action, "enrollment.grant"));
    assert.ok(logs.length >= 1);
    assert.equal(
      (logs[logs.length - 1].metadata as Record<string, unknown>).targetUserId,
      ids.s2
    );
  });

  it("grant ditolak: tanpa alasan 400; ke diri sendiri 400; non-admin 403; user hilang 404", async () => {
    const noReason = await api(
      "POST",
      `/api/v1/admin/courses/${ids.paidPub}/grants`,
      tokens.admin,
      { userId: ids.s1 }
    );
    assert.equal(noReason.http, 400);

    const self = await api(
      "POST",
      `/api/v1/admin/courses/${ids.paidPub}/grants`,
      tokens.admin,
      { userId: ids.admin, reason: "Mencoba memberi ke diri sendiri" }
    );
    assert.equal(self.http, 400);
    assert.equal(self.json.code, "CANNOT_GRANT_SELF");

    const byTeacher = await api(
      "POST",
      `/api/v1/admin/courses/${ids.paidPub}/grants`,
      tokens.teacher,
      { userId: ids.s1, reason: "Guru mencoba memberi akses" }
    );
    assert.equal(byTeacher.http, 403);

    const missing = await api(
      "POST",
      `/api/v1/admin/courses/${ids.paidPub}/grants`,
      tokens.admin,
      { userId: 999999, reason: "Target tidak ada di database" }
    );
    assert.equal(missing.http, 404);
    assert.equal(missing.json.code, "USER_NOT_FOUND");
  });

  it("revoke: akses hilang + audit; ulang 409; tanpa alasan 400", async () => {
    const noReason = await api(
      "POST",
      `/api/v1/admin/courses/${ids.paidPub}/grants/${ids.s2}/revoke`,
      tokens.admin,
      {}
    );
    assert.equal(noReason.http, 400);

    const r = await api(
      "POST",
      `/api/v1/admin/courses/${ids.paidPub}/grants/${ids.s2}/revoke`,
      tokens.admin,
      { reason: "Pelanggaran tata tertib peserta" }
    );
    assert.equal(r.http, 200);

    const access = await api<{ hasAccess: boolean }>(
      "GET",
      `/api/v1/courses/${ids.paidPub}/access`,
      tokens.s2
    );
    assert.equal(access.json.data.hasAccess, false);

    const p = await api("POST", `/api/v1/materials/${ids.matPaid}/progress`, tokens.s2);
    assert.equal(p.http, 403);

    const again = await api(
      "POST",
      `/api/v1/admin/courses/${ids.paidPub}/grants/${ids.s2}/revoke`,
      tokens.admin,
      { reason: "Mencoba mencabut dua kali" }
    );
    assert.equal(again.http, 409);

    const logs = await db
      .select()
      .from(schema.auditLogs)
      .where(eq(schema.auditLogs.action, "enrollment.revoke"));
    assert.ok(logs.length >= 1);
  });

  it("grant ulang setelah revoke mengaktifkan kembali", async () => {
    const g = await api(
      "POST",
      `/api/v1/admin/courses/${ids.paidPub}/grants`,
      tokens.admin,
      { email: "siswa2@uji.io", reason: "Pemulihan akses peserta" }
    );
    assert.equal(g.http, 201);
    const access = await api<{ hasAccess: boolean }>(
      "GET",
      `/api/v1/courses/${ids.paidPub}/access`,
      tokens.s2
    );
    assert.equal(access.json.data.hasAccess, true);
  });
});

describe("katalog publik dan status completed", () => {
  it("list publik memuat published+archived, bukan draft; filter status", async () => {
    const all = await api<Array<{ id: number; status: string }>>(
      "GET",
      "/api/v1/courses?limit=100"
    );
    const statuses = new Set(all.json.data.map((c) => c.status));
    assert.ok(!statuses.has("draft"));
    assert.ok(all.json.data.some((c) => c.id === ids.freePub));
    assert.ok(all.json.data.some((c) => c.id === ids.archived));

    const arc = await api<Array<{ status: string }>>(
      "GET",
      "/api/v1/courses?status=archived&limit=100"
    );
    assert.ok(arc.json.data.length > 0);
    assert.ok(arc.json.data.every((c) => c.status === "archived"));
  });

  it("detail arsip publik; draft 404 bagi asing, 200 bagi pengelola", async () => {
    assert.equal((await api("GET", `/api/v1/courses/${ids.archived}`)).http, 200);
    assert.equal((await api("GET", `/api/v1/courses/${ids.freePub}`)).http, 200);
    assert.equal((await api("GET", `/api/v1/courses/${ids.draft}`)).http, 404);
    assert.equal(
      (await api("GET", `/api/v1/courses/${ids.draft}`, tokens.teacher)).http,
      200
    );
  });

  it("enrollment completed tetap punya akses", async () => {
    await db
      .update(schema.enrollments)
      .set({ status: "completed" })
      .where(
        and(
          eq(schema.enrollments.userId, ids.s1),
          eq(schema.enrollments.courseId, ids.freePub)
        )
      );
    const access = await api<{ hasAccess: boolean }>(
      "GET",
      `/api/v1/courses/${ids.freePub}/access`,
      tokens.s1
    );
    assert.equal(access.json.data.hasAccess, true);
    const p = await api(
      "POST",
      `/api/v1/materials/${ids.matA}/progress`,
      tokens.s1
    );
    assert.equal(p.http, 200);
  });
});
