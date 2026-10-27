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
import { eq } from "drizzle-orm";
import { db, pool } from "../../../db/index";
import * as schema from "../../../db/schema";
import app from "../../../app";

/**
 * Tahap 2 — Tugas (assignment & submission).
 * Uji integrasi HTTP penuh melawan database tes TERPISAH
 * (`aristoteles_test_b5`), TIDAK PERNAH menyentuh database live.
 * Mencakup: pengumpulan via berkas assignment milik sendiri, resubmit
 * append-only, isolasi peserta, penilaian pengelola + audit, proteksi
 * berkas (teacher asing ditolak), dan regresi aturan akses Tahap 1.
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
let fileS1a = 0;
let fileS1b = 0;
let fileS2 = 0;
let subS1a = 0;
let subS1b = 0;
let subS2 = 0;

const VALID_TIPTAP = JSON.stringify({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "Halo" }] }],
});

// PDF minimal yang lolos deteksi magic-bytes (%PDF).
const tinyPdfBase64 = () =>
  Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n", "utf8").toString("base64");

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

async function uploadPdf(token: string, filename: string, kind = "assignment") {
  const r = await api<{ id: number; url: string }>(
    "POST",
    "/api/v1/uploads",
    token,
    { filename, mimeType: "application/pdf", kind, data: tinyPdfBase64() }
  );
  assert.equal(r.http, 201, `upload ${filename}: ${JSON.stringify(r.json)}`);
  return r.json.data;
}

before(async () => {
  const admin = await mysql.createConnection({
    host: "localhost",
    port: 3306,
    user: "root",
    password: "",
  });
  try {
    await admin.query("CREATE DATABASE IF NOT EXISTS aristoteles_test_b5");
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
  ids.teacher = await mkUser("Guru Pengampu", "guru@uji.io", "teacher");
  ids.teacher2 = await mkUser("Guru Asing", "guruasing@uji.io", "teacher");
  ids.s1 = await mkUser("Siswa Satu", "siswa1@uji.io", "student");
  ids.s2 = await mkUser("Siswa Dua", "siswa2@uji.io", "student");

  const mkCourse = async (title: string, status: "draft" | "published") => {
    const [h] = await db.insert(schema.courses).values({
      title,
      description: `Deskripsi ${title} yang cukup panjang untuk validasi.`,
      category: "Pengembangan Web",
      level: "Pemula",
      duration: "4 Bulan",
      status,
      priceLabel: "GRATIS",
      priceNominal: 0,
      period: "ongoing",
      outcomes: ["Hasil belajar pertama yang cukup panjang"],
      tools: ["Laptop"],
      createdBy: ids.teacher,
    });
    return Number((h as unknown as { insertId: number }).insertId);
  };
  ids.freePub = await mkCourse("Kursus Tugas Gratis Cukup Panjang", "published");
  ids.draft = await mkCourse("Kursus Tugas Draft Cukup Panjang", "draft");

  await db.insert(schema.courseInstructors).values([
    { courseId: ids.freePub, userId: ids.teacher },
    { courseId: ids.draft, userId: ids.teacher },
  ]);
  // teacher2 tidak mengampu apa pun; s1 + s2 terdaftar di kursus publik.
  await db.insert(schema.enrollments).values([
    { userId: ids.s1, courseId: ids.freePub, source: "free", status: "active" },
    { userId: ids.s2, courseId: ids.freePub, source: "free", status: "active" },
  ]);

  const mkModule = async (courseId: number) => {
    const [h] = await db.insert(schema.modules).values({
      courseId,
      title: "Modul Tugas Uji Cukup Panjang",
      type: "tugas",
      position: 0,
    });
    return Number((h as unknown as { insertId: number }).insertId);
  };
  const mkMaterial = async (moduleId: number, title: string, type: "tugas" | "materi") => {
    const [h] = await db.insert(schema.materials).values({
      moduleId,
      title,
      type,
      content: VALID_TIPTAP,
      position: 0,
    });
    return Number((h as unknown as { insertId: number }).insertId);
  };
  ids.modFree = await mkModule(ids.freePub);
  ids.matTugas = await mkMaterial(ids.modFree, "Tugas Merancang Skema Cukup Panjang", "tugas");
  ids.matMateri = await mkMaterial(ids.modFree, "Materi Biasa Bukan Tugas Panjang", "materi");
  ids.modDraft = await mkModule(ids.draft);
  ids.draftTugas = await mkMaterial(ids.modDraft, "Tugas Draft Saja Cukup Panjang", "tugas");

  const srv = app.listen(0);
  await once(srv, "listening");
  server = srv;
  const addr = srv.address() as AddressInfo;
  base = `http://127.0.0.1:${addr.port}`;
  tokens = {
    admin: await login("admin@uji.io"),
    teacher: await login("guru@uji.io"),
    teacher2: await login("guruasing@uji.io"),
    s1: await login("siswa1@uji.io"),
    s2: await login("siswa2@uji.io"),
  };
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
    await admin.query("DROP DATABASE aristoteles_test_b5");
  } finally {
    await admin.end();
  }
});

describe("pengumpulan tugas", () => {
  it("201 baris baru per kumpul; nama dari profil; riwayat tidak ditimpa", async () => {
    fileS1a = (await uploadPdf(tokens.s1, "tugas-s1-a.pdf")).id;
    const r1 = await api<{
      id: number;
      status: string;
      fileId: number;
      fileUrl: string;
      studentName: string;
      score: null;
    }>("POST", `/api/v1/materials/${ids.matTugas}/submissions`, tokens.s1, {
      fileId: fileS1a,
      studentNim: "21010001",
      note: "Pengumpulan pertama",
    });
    assert.equal(r1.http, 201);
    assert.equal(r1.json.data.status, "submitted");
    assert.equal(r1.json.data.studentName, "Siswa Satu");
    assert.equal(r1.json.data.fileUrl, `/api/v1/files/${fileS1a}/content`);
    subS1a = r1.json.data.id;

    fileS1b = (await uploadPdf(tokens.s1, "tugas-s1-b.pdf")).id;
    const r2 = await api<{ id: number }>(
      "POST",
      `/api/v1/materials/${ids.matTugas}/submissions`,
      tokens.s1,
      { fileId: fileS1b }
    );
    assert.equal(r2.http, 201);
    assert.notEqual(r2.json.data.id, subS1a);
    subS1b = r2.json.data.id;

    const mine = await api<{ manager: boolean; rows: Array<{ id: number; fileId: number }> }>(
      "GET",
      `/api/v1/materials/${ids.matTugas}/submissions`,
      tokens.s1
    );
    assert.equal(mine.http, 200);
    assert.equal(mine.json.data.manager, false);
    assert.equal(mine.json.data.rows.length, 2);
    const list = await api<{ manager: boolean; rows: Array<{ id: number; fileId: number }> }>(
      "GET",
      `/api/v1/materials/${ids.matTugas}/submissions`,
      tokens.teacher
    );
    assert.equal(list.json.data.manager, true);
    assert.equal(list.json.data.rows.length, 2);
    // Baris lama utuh: fileId pertama tidak berubah.
    const first = list.json.data.rows.find((r) => r.id === subS1a);
    assert.equal(first?.fileId, fileS1a);
  });

  it("validasi: berkas asing/peserta lain, kind salah, non-tugas, tanpa akses", async () => {
    const other = await uploadPdf(tokens.s2, "milik-s2.pdf");
    fileS2 = other.id;
    const foreign = await api(
      "POST",
      `/api/v1/materials/${ids.matTugas}/submissions`,
      tokens.s1,
      { fileId: fileS2 }
    );
    assert.equal(foreign.http, 403);
    assert.equal(foreign.json.code, "FILE_FORBIDDEN");

    const pdfKind = await uploadPdf(tokens.s1, "salah-kind.pdf", "pdf");
    const wrongKind = await api(
      "POST",
      `/api/v1/materials/${ids.matTugas}/submissions`,
      tokens.s1,
      { fileId: pdfKind.id }
    );
    assert.equal(wrongKind.http, 400);
    assert.equal(wrongKind.json.code, "INVALID_FILE_KIND");

    const notTask = await api(
      "POST",
      `/api/v1/materials/${ids.matMateri}/submissions`,
      tokens.s1,
      { fileId: fileS1a }
    );
    assert.equal(notTask.http, 400);
    assert.equal(notTask.json.code, "NOT_TASK");

    const missing = await api(
      "POST",
      `/api/v1/materials/${ids.matTugas}/submissions`,
      tokens.s1,
      { fileId: 999999 }
    );
    assert.equal(missing.http, 404);
    assert.equal(missing.json.code, "FILE_NOT_FOUND");

    // Skor/kelulusan kiriman klien ditolak skema strict.
    const evil = await api(
      "POST",
      `/api/v1/materials/${ids.matTugas}/submissions`,
      tokens.s1,
      { fileId: fileS1a, score: 100, status: "passed" }
    );
    assert.equal(evil.http, 400);
  });

  it("draft asing 404; 401 tanpa token", async () => {
    const f = await uploadPdf(tokens.s2, "draft-coba.pdf");
    const r = await api(
      "POST",
      `/api/v1/materials/${ids.draftTugas}/submissions`,
      tokens.s2,
      { fileId: f.id }
    );
    assert.equal(r.http, 404);
    assert.equal(
      (await api("POST", `/api/v1/materials/${ids.matTugas}/submissions`)).http,
      401
    );
  });
});

describe("isolasi baca submission", () => {
  it("s1 tidak melihat milik s2 (404); pengelola melihat semua + saring peserta", async () => {
    const s2sub = await api<{ id: number }>(
      "POST",
      `/api/v1/materials/${ids.matTugas}/submissions`,
      tokens.s2,
      { fileId: fileS2 }
    );
    assert.equal(s2sub.http, 201);
    subS2 = s2sub.json.data.id;

    const peek = await api(
      "GET",
      `/api/v1/materials/${ids.matTugas}/submissions/${subS2}`,
      tokens.s1
    );
    assert.equal(peek.http, 404);

    const own = await api<{ id: number }>(
      "GET",
      `/api/v1/materials/${ids.matTugas}/submissions/${subS1a}`,
      tokens.s1
    );
    assert.equal(own.http, 200);

    const all = await api<{ manager: boolean; rows: Array<{ id: number }> }>(
      "GET",
      `/api/v1/materials/${ids.matTugas}/submissions`,
      tokens.teacher
    );
    assert.equal(all.json.data.rows.length, 3);
    const filtered = await api<{ rows: Array<{ id: number }> }>(
      "GET",
      `/api/v1/materials/${ids.matTugas}/submissions?userId=${ids.s2}`,
      tokens.teacher
    );
    assert.equal(filtered.json.data.rows.length, 1);

    // Guru asing (bukan pengampu) tidak lolos sebagai manajer.
    const outsider = await api(
      "GET",
      `/api/v1/materials/${ids.matTugas}/submissions`,
      tokens.teacher2
    );
    assert.equal(outsider.http, 403);
  });
});

describe("penilaian pengelola", () => {
  it("passed + skor + feedback + audit; status menempel walau kumpul ulang", async () => {
    const g = await api<{
      status: string;
      score: number;
      feedback: string;
      gradedBy: number;
    }>(
      "POST",
      `/api/v1/materials/${ids.matTugas}/submissions/${subS1a}/grade`,
      tokens.teacher,
      { score: 85, decision: "passed", feedback: "Bagus, lanjutkan." }
    );
    assert.equal(g.http, 200);
    assert.equal(g.json.data.status, "passed");
    assert.equal(g.json.data.gradedBy, ids.teacher);

    const logs = await db
      .select()
      .from(schema.auditLogs)
      .where(eq(schema.auditLogs.action, "submission.grade"));
    assert.ok(logs.length >= 1);
    assert.equal(
      (logs[logs.length - 1].metadata as Record<string, unknown>).decision,
      "passed"
    );

    const st = await api<{
      attempts: number;
      passed: boolean;
      lastStatus: string;
      bestScore: number;
    }>("GET", `/api/v1/materials/${ids.matTugas}/submissions/status`, tokens.s1);
    assert.equal(st.http, 200);
    assert.equal(st.json.data.passed, true);
    assert.equal(st.json.data.attempts, 2);
    assert.equal(st.json.data.bestScore, 85);

    // Kumpul ulang setelah lulus: baris baru, kelulusan tetap menempel.
    const f = await uploadPdf(tokens.s1, "sesudah-lulus.pdf");
    const r = await api("POST", `/api/v1/materials/${ids.matTugas}/submissions`, tokens.s1, {
      fileId: f.id,
    });
    assert.equal(r.http, 201);
    const st2 = await api<{ passed: boolean; attempts: number }>(
      "GET",
      `/api/v1/materials/${ids.matTugas}/submissions/status`,
      tokens.s1
    );
    assert.equal(st2.json.data.passed, true);
    assert.equal(st2.json.data.attempts, 3);
  });

  it("revision_requested lalu lulus; penolakan peran dan validasi", async () => {
    const rev = await api<{ status: string }>(
      "POST",
      `/api/v1/materials/${ids.matTugas}/submissions/${subS2}/grade`,
      tokens.teacher,
      { score: 50, decision: "revision_requested", feedback: "Perbaiki bab 2." }
    );
    assert.equal(rev.http, 200);
    const st = await api<{ passed: boolean; lastStatus: string }>(
      "GET",
      `/api/v1/materials/${ids.matTugas}/submissions/status`,
      tokens.s2
    );
    assert.equal(st.json.data.passed, false);
    assert.equal(st.json.data.lastStatus, "revision_requested");

    // Siswa menilai: 403 oleh requireRole.
    const byStudent = await api(
      "POST",
      `/api/v1/materials/${ids.matTugas}/submissions/${subS2}/grade`,
      tokens.s1,
      { score: 100, decision: "passed" }
    );
    assert.equal(byStudent.http, 403);

    // Guru bukan pengampu: 403 NOT_MANAGER.
    const byOutsider = await api(
      "POST",
      `/api/v1/materials/${ids.matTugas}/submissions/${subS2}/grade`,
      tokens.teacher2,
      { score: 100, decision: "passed" }
    );
    assert.equal(byOutsider.http, 403);

    // Validasi: skor di luar 0–100, decision tak dikenal, submission hilang.
    for (const body of [
      { score: 101, decision: "passed" },
      { score: 80, decision: "lulus" },
      { decision: "passed" },
    ]) {
      const bad = await api(
        "POST",
        `/api/v1/materials/${ids.matTugas}/submissions/${subS2}/grade`,
        tokens.teacher,
        body
      );
      assert.equal(bad.http, 400, JSON.stringify(body));
    }
    const gone = await api(
      "POST",
      `/api/v1/materials/${ids.matTugas}/submissions/999999/grade`,
      tokens.teacher,
      { score: 80, decision: "passed" }
    );
    assert.equal(gone.http, 404);
  });
});

describe("proteksi berkas assignment", () => {
  it("pemilik + pengampu 200; guru asing/siswa lain/anon ditolak", async () => {
    const as = (t?: string) =>
      fetch(base + `/api/v1/files/${fileS1a}/content`, {
        headers: t ? { authorization: `Bearer ${t}` } : {},
      }).then((r) => r.status);

    assert.equal(await as(tokens.s1), 200);
    assert.equal(await as(tokens.teacher), 200);
    assert.equal(await as(tokens.admin), 200);
    // Celah lama: semua teacher bisa baca — kini guru asing 403.
    assert.equal(await as(tokens.teacher2), 403);
    assert.equal(await as(tokens.s2), 403);
    assert.equal(await as(undefined), 403);
  });
});
