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
 * Tahap 3 — Sertifikat per modul.
 * Uji integrasi HTTP penuh melawan database tes TERPISAH
 * (`aristoteles_test_b6`), TIDAK PERNAH menyentuh database live.
 * Mencakup: kelayakan per-tipe materi, penerbitan idempoten + snapshot nama,
 * verifikasi publik minimal, pencabutan + audit, isolasi peran, dan
 * penerbitan bersamaan (concurrency).
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
  failReasons?: string[];
}

let base = "";
let server: Server | null = null;
let tokens: Record<string, string> = {};
let ids: Record<string, number> = {};
let certCodeS1 = "";

const VALID_TIPTAP = JSON.stringify({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "Halo" }] }],
});

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

async function uploadPdf(token: string, filename: string) {
  const r = await api<{ id: number }>("POST", "/api/v1/uploads", token, {
    filename,
    mimeType: "application/pdf",
    kind: "assignment",
    data: tinyPdfBase64(),
  });
  assert.equal(r.http, 201);
  return r.json.data.id;
}

/** Lengkapi satu peserta: progres + kuis lulus + tugas lulus. */
async function completeAll(token: string, loginEmail: string) {
  void loginEmail;
  await api("POST", `/api/v1/materials/${ids.matMateri}/progress`, token);
  const quiz = await api<{ questions: { id: number; options: { id: number }[] }[] }>(
    "GET",
    `/api/v1/materials/${ids.matKuis}/quiz`,
    token
  );
  assert.equal(quiz.http, 200);
  const q = quiz.json.data.questions[0];
  const rows = await db
    .select()
    .from(schema.quizOptions)
    .where(eq(schema.quizOptions.questionId, q.id));
  const right = rows.find((o) => o.isCorrect)!;
  const att = await api("POST", `/api/v1/materials/${ids.matKuis}/quiz-attempts`, token, {
    answers: [{ questionId: q.id, optionId: right.id }],
  });
  assert.equal(att.http, 201);
  const fileId = await uploadPdf(token, `tugas-${Date.now()}.pdf`);
  const sub = await api<{ id: number }>(
    "POST",
    `/api/v1/materials/${ids.matTugas}/submissions`,
    token,
    { fileId }
  );
  assert.equal(sub.http, 201);
  return sub.json.data.id;
}

async function gradePassed(teacherToken: string, submissionId: number) {
  const g = await api(
    "POST",
    `/api/v1/materials/${ids.matTugas}/submissions/${submissionId}/grade`,
    teacherToken,
    { score: 90, decision: "passed", feedback: "Baik." }
  );
  assert.equal(g.http, 200);
}

before(async () => {
  const admin = await mysql.createConnection({
    host: "localhost",
    port: 3306,
    user: "root",
    password: "",
  });
  try {
    await admin.query("CREATE DATABASE IF NOT EXISTS aristoteles_test_b6");
  } finally {
    await admin.end();
  }
  await migrate(db, { migrationsFolder: path.resolve("drizzle") });

  const hash = await bcrypt.hash(TEST_PASSWORD, 4);
  const mkUser = async (name: string, email: string, role: "admin" | "teacher" | "student") => {
    const [h] = await db.insert(schema.users).values({ name, username: email.split("@")[0] + "-t", email, passwordHash: hash, role, emailVerifiedAt: new Date() });
    return Number((h as unknown as { insertId: number }).insertId);
  };
  ids.admin = await mkUser("Admin Uji", "admin@uji.io", "admin");
  ids.teacher = await mkUser("Guru Pengampu", "guru@uji.io", "teacher");
  ids.teacher2 = await mkUser("Guru Asing", "guruasing@uji.io", "teacher");
  ids.s1 = await mkUser("Siswa Satu", "siswa1@uji.io", "student");
  ids.s2 = await mkUser("Siswa Dua", "siswa2@uji.io", "student");
  ids.s3 = await mkUser("Siswa Tiga", "siswa3@uji.io", "student");
  ids.s4 = await mkUser("Siswa Empat", "siswa4@uji.io", "student");

  const [cH] = await db.insert(schema.courses).values({
    title: "Kursus Sertifikat Uji Cukup Panjang",
    description: "Deskripsi kursus sertifikat uji yang cukup panjang.",
    category: "Pengembangan Web",
    level: "Pemula",
    duration: "4 Bulan",
    status: "published",
    priceLabel: "GRATIS",
    priceNominal: 0,
    period: "ongoing",
    outcomes: ["Hasil belajar pertama yang cukup panjang"],
    tools: ["Laptop"],
    createdBy: ids.teacher,
  });
  ids.course = Number((cH as unknown as { insertId: number }).insertId);
  await db.insert(schema.courseInstructors).values({ courseId: ids.course, userId: ids.teacher });
  for (const sid of [ids.s1, ids.s2, ids.s3, ids.s4]) {
    await db.insert(schema.enrollments).values({
      userId: sid,
      courseId: ids.course,
      source: "free",
      status: "active",
    });
  }

  const [mH] = await db.insert(schema.modules).values({
    courseId: ids.course,
    title: "Modul Sertifikat Uji Cukup Panjang",
    type: "materi",
    position: 0,
  });
  ids.mod = Number((mH as unknown as { insertId: number }).insertId);
  const mkMat = async (title: string, type: "materi" | "kuis" | "tugas") => {
    const [h] = await db.insert(schema.materials).values({
      moduleId: ids.mod,
      title,
      type,
      content: VALID_TIPTAP,
      position: 0,
    });
    return Number((h as unknown as { insertId: number }).insertId);
  };
  ids.matMateri = await mkMat("Materi Wajib Selesai Cukup Panjang", "materi");
  ids.matKuis = await mkMat("Kuis Wajib Lulus Cukup Panjang", "kuis");
  ids.matTugas = await mkMat("Tugas Wajib Lulus Cukup Panjang", "tugas");

  // Modul B: satu materi biasa (untuk uji jalur manual/displayName
  // lewat data lama: progres disisip langsung via DB agar auto-issue
  // tidak terpicu, mensimulasikan baris era sebelum fitur otomatis).
  const [mBH] = await db.insert(schema.modules).values({
    courseId: ids.course,
    title: "Modul Tunggal Uji Manual Panjang",
    type: "materi",
    position: 1,
  });
  ids.modB = Number((mBH as unknown as { insertId: number }).insertId);
  const [mBH1] = await db.insert(schema.materials).values({
    moduleId: ids.modB,
    title: "Materi Tunggal Uji Manual Panjang",
    type: "materi",
    content: VALID_TIPTAP,
    position: 0,
  });
  ids.matB1 = Number((mBH1 as unknown as { insertId: number }).insertId);

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
    s3: await login("siswa3@uji.io"),
    s4: await login("siswa4@uji.io"),
  };

  // Bank 1 soal untuk materi kuis.
  const put = await api("PUT", `/api/v1/materials/${ids.matKuis}/quiz`, tokens.teacher, {
    questions: [
      {
        questionText: "Ibukota Indonesia?",
        options: [
          { optionText: "Jakarta", isCorrect: true },
          { optionText: "Bandung", isCorrect: false },
        ],
      },
    ],
  });
  assert.equal(put.http, 200);

  // s1: lengkap. s2: hanya progres (kurang kuis + tugas).
  const subS1 = await completeAll(tokens.s1, "siswa1@uji.io");
  await gradePassed(tokens.teacher, subS1);
  await api("POST", `/api/v1/materials/${ids.matMateri}/progress`, tokens.s2);
  // s4: lengkap (untuk uji concurrency).
  const subS4 = await completeAll(tokens.s4, "siswa4@uji.io");
  await gradePassed(tokens.teacher, subS4);
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
    await admin.query("DROP DATABASE aristoteles_test_b6");
  } finally {
    await admin.end();
  }
});

describe("kelayakan & penerbitan", () => {
  it("status s1 eligible; sertifikat sudah terbit otomatis + manual 200 idempoten", async () => {
    const st = await api<{
      eligible: boolean;
      requirements: Array<{ state: string }>;
      certificate: { id: number; code: string } | null;
    }>("GET", `/api/v1/me/modules/${ids.mod}/certificate-status`, tokens.s1);
    assert.equal(st.http, 200);
    assert.equal(st.json.data.eligible, true);
    assert.ok(st.json.data.requirements.every((r) => ["selesai", "lulus"].includes(r.state)));
    // Auto-issue saat gradePassed di fixture: sertifikat sudah ada.
    assert.ok(st.json.data.certificate, "sertifikat s1 harus sudah terbit otomatis");
    certCodeS1 = st.json.data.certificate.code;

    // Jalur manual setelah auto-issue: 200 baris tunggal yang sama.
    const issue = await api<{ id: number; code: string; recipientName: string }>(
      "POST",
      `/api/v1/modules/${ids.mod}/certificate`,
      tokens.s1,
      { displayName: "Siswa Satu Tercetak" }
    );
    assert.equal(issue.http, 200);
    assert.equal(issue.json.data.code, certCodeS1);

    const again = await api<{ id: number; code: string }>(
      "POST",
      `/api/v1/modules/${ids.mod}/certificate`,
      tokens.s1,
      {}
    );
    assert.equal(again.http, 200);
    assert.equal(again.json.data.code, certCodeS1);
    const rows = await db.select().from(schema.certificates);
    assert.equal(rows.filter((r) => r.userId === ids.s1).length, 1);
  });

  it("jalur manual + displayName untuk data lama (tanpa auto-issue)", async () => {
    // Sisip progres langsung via DB: mensimulasikan baris era pra-otomatis
    // sehingga auto-issue tidak terpicu dan jalur manual teruji.
    await db.insert(schema.progress).values({ userId: ids.s2, materialId: ids.matB1 });
    const issue = await api<{ id: number; code: string; recipientName: string }>(
      "POST",
      `/api/v1/modules/${ids.modB}/certificate`,
      tokens.s2,
      { displayName: "Siswa Dua Tercetak" }
    );
    assert.equal(issue.http, 201);
    assert.match(issue.json.data.code, /^ATS-\d{4}-[0-9A-F]{8}$/);
    assert.equal(issue.json.data.recipientName, "Siswa Dua Tercetak");

    // Snapshot nama: ubah profil tidak mengubah sertifikat terbit.
    await db.update(schema.users).set({ name: "Nama Baru Diubah" }).where(eq(schema.users.id, ids.s2));
    const mine = await api<Array<{ recipientName: string; moduleId: number }>>(
      "GET",
      "/api/v1/me/certificates",
      tokens.s2
    );
    const row = mine.json.data.find((c) => c.moduleId === ids.modB);
    assert.ok(row);
    assert.equal(row.recipientName, "Siswa Dua Tercetak");
  });

  it("s2 belum layak: 403 NOT_ELIGIBLE + alasan; s3 tanpa progres pun 403", async () => {
    const st = await api<{ eligible: boolean; failReasons: string[] }>(
      "GET",
      `/api/v1/me/modules/${ids.mod}/certificate-status`,
      tokens.s2
    );
    assert.equal(st.json.data.eligible, false);
    assert.ok(st.json.data.failReasons.length >= 2);
    const issue = await api(
      "POST",
      `/api/v1/modules/${ids.mod}/certificate`,
      tokens.s2,
      {}
    );
    assert.equal(issue.http, 403);
    assert.equal(issue.json.code, "NOT_ELIGIBLE");
    assert.ok((issue.json.failReasons ?? []).length > 0);

    const s3 = await api(
      "POST",
      `/api/v1/modules/${ids.mod}/certificate`,
      tokens.s3,
      {}
    );
    assert.equal(s3.http, 403);
  });

  it("401 tanpa token; modul hilang 404", async () => {
    assert.equal(
      (await api("POST", `/api/v1/modules/${ids.mod}/certificate`)).http,
      401
    );
    assert.equal(
      (await api("POST", "/api/v1/modules/999999/certificate", tokens.s1, {})).http,
      404
    );
  });
});

describe("unduh PDF", () => {
  async function dl(token: string | undefined, id: number | string) {
    const headers: Record<string, string> = {};
    if (token) headers.authorization = `Bearer ${token}`;
    const res = await fetch(`${base}/api/v1/me/certificates/${id}/download`, { headers });
    const buf = Buffer.from(await res.arrayBuffer());
    return {
      http: res.status,
      type: res.headers.get("content-type"),
      disp: res.headers.get("content-disposition"),
      buf,
    };
  }

  async function s1CertId(): Promise<number> {
    const mine = await api<Array<{ id: number; moduleId: number }>>(
      "GET",
      "/api/v1/me/certificates",
      tokens.s1
    );
    const row = mine.json.data.find((c) => c.moduleId === ids.mod);
    assert.ok(row, "sertifikat s1 harus ada");
    return row.id;
  }

  it("pemilik + pengampu unduh PDF asli; cache konsisten", async () => {
    const id = await s1CertId();
    const first = await dl(tokens.s1, id);
    assert.equal(first.http, 200);
    assert.ok(first.type?.includes("application/pdf"));
    assert.ok(first.disp?.includes("attachment"));
    assert.ok(first.disp?.includes('filename="Sertifikat-'));
    assert.equal(first.buf.subarray(0, 5).toString("utf8"), "%PDF-");
    // Pengampu kursus boleh mengunduh milik peserta.
    const byTeacher = await dl(tokens.teacher, id);
    assert.equal(byTeacher.http, 200);
    // Unduh kedua lewat cache disk: sama persis.
    const second = await dl(tokens.s1, id);
    assert.equal(second.http, 200);
    assert.equal(second.buf.length, first.buf.length);
  });

  it("milik orang lain 404; tanpa token 401; id rusak 404", async () => {
    const id = await s1CertId();
    assert.equal((await dl(tokens.s2, id)).http, 404);
    assert.equal((await dl(undefined, id)).http, 401);
    assert.equal((await dl(tokens.s1, 999999)).http, 404);
    assert.equal((await dl(tokens.s1, "abc")).http, 404);
  });
});

describe("verifikasi publik", () => {
  it("kode benar: minimal aman; kode salah 404 tanpa bocor", async () => {
    const v = await api<Record<string, unknown>>(
      "GET",
      `/api/v1/certificates/verify/${certCodeS1}`
    );
    assert.equal(v.http, 200);
    assert.deepEqual(Object.keys(v.json.data).sort(), [
      "code",
      "courseTitle",
      "instructorName",
      "issuedAt",
      "moduleTitle",
      "recipientName",
      "revokeReason",
      "revokedAt",
      "status",
    ]);
    const blob = JSON.stringify(v.json.data);
    assert.ok(!blob.includes("siswa1@uji.io"));
    assert.ok(!blob.includes("userId"));

    const miss = await api("GET", "/api/v1/certificates/verify/ATS-2026-00000000");
    assert.equal(miss.http, 404);
    assert.equal(miss.json.code, "CODE_NOT_FOUND");
  });

  it("qr: PNG asli untuk kode benar; 404 untuk kode salah", async () => {
    const qr = await fetch(`${base}/api/v1/certificates/verify/${certCodeS1}/qr`);
    assert.equal(qr.status, 200);
    assert.ok(qr.headers.get("content-type")?.includes("image/png"));
    const buf = Buffer.from(await qr.arrayBuffer());
    assert.deepEqual([buf[0], buf[1], buf[2], buf[3]], [0x89, 0x50, 0x4e, 0x47]);
    const missQr = await fetch(`${base}/api/v1/certificates/verify/ATS-2026-00000000/qr`);
    assert.equal(missQr.status, 404);
  });
});

describe("kelola instruktur & pencabutan", () => {
  it("list + filter + detail; guru asing ditolak", async () => {
    const all = await api<{ items: Array<{ id: number; code: string }>; total: number }>(
      "GET",
      "/api/v1/instructor/certificates",
      tokens.teacher
    );
    assert.equal(all.http, 200);
    // s1 + s4 terbit otomatis di fixture; s2 terbit manual di uji snapshot.
    assert.equal(all.json.data.total, 3);

    const outsider = await api<{ items: unknown[]; total: number }>(
      "GET",
      "/api/v1/instructor/certificates",
      tokens.teacher2
    );
    assert.equal(outsider.http, 200);
    assert.equal(outsider.json.data.total, 0);

    const filtered = await api<{ total: number }>(
      "GET",
      `/api/v1/instructor/certificates?courseId=${ids.course}&status=issued`,
      tokens.teacher
    );
    assert.equal(filtered.json.data.total, 3);

    const wrongScope = await api(
      "GET",
      "/api/v1/instructor/certificates?courseId=999999",
      tokens.teacher
    );
    assert.equal(wrongScope.http, 403);

    const s1Item = all.json.data.items.find((i) => i.code === certCodeS1);
    assert.ok(s1Item, "sertifikat s1 harus ada di daftar");
    const detail = await api<Record<string, unknown>>(
      "GET",
      `/api/v1/instructor/certificates/${s1Item.id}`,
      tokens.teacher
    );
    assert.equal(detail.http, 200);
    assert.ok("requirementsSnapshot" in (detail.json.data as object));
  });

  it("eligibility per peserta: s1 terbit, s2 belum, s3 belum", async () => {
    const eg = await api<{
      items: Array<{ userId: number; status: string }>;
    }>("GET", `/api/v1/instructor/modules/${ids.mod}/eligibility`, tokens.teacher);
    assert.equal(eg.http, 200);
    const byId = new Map(eg.json.data.items.map((e) => [e.userId, e.status]));
    assert.equal(byId.get(ids.s1), "sudah_terbit");
    assert.equal(byId.get(ids.s2), "belum_memenuhi");
    assert.equal(byId.get(ids.s3), "belum_memenuhi");
    // s4 lengkap dan langsung terbit otomatis di fixture.
    assert.equal(byId.get(ids.s4), "sudah_terbit");
  });

  it("revoke: alasan wajib + audit; verify tunjukkan dicabut; ganda 409", async () => {
    const all = await api<{ items: Array<{ id: number; code: string }> }>(
      "GET",
      "/api/v1/instructor/certificates",
      tokens.teacher
    );
    const s1Item = all.json.data.items.find((i) => i.code === certCodeS1);
    assert.ok(s1Item, "sertifikat s1 harus ada di daftar");
    const certId = s1Item.id;

    const noReason = await api(
      "POST",
      `/api/v1/instructor/certificates/${certId}/revoke`,
      tokens.teacher,
      {}
    );
    assert.equal(noReason.http, 400);

    const byStudent = await api(
      "POST",
      `/api/v1/instructor/certificates/${certId}/revoke`,
      tokens.s1,
      { reason: "Siswa mencoba mencabut" }
    );
    assert.equal(byStudent.http, 403);

    const byOutsider = await api(
      "POST",
      `/api/v1/instructor/certificates/${certId}/revoke`,
      tokens.teacher2,
      { reason: "Guru asing mencoba" }
    );
    assert.equal(byOutsider.http, 403);

    const r = await api<{ status: string; revokeReason: string }>(
      "POST",
      `/api/v1/instructor/certificates/${certId}/revoke`,
      tokens.teacher,
      { reason: "Kecurangan terverifikasi panitia" }
    );
    assert.equal(r.http, 200);
    assert.equal(r.json.data.status, "dicabut");

    const logs = await db
      .select()
      .from(schema.auditLogs)
      .where(eq(schema.auditLogs.action, "certificate.revoke"));
    assert.ok(logs.length >= 1);

    const v = await api<{ status: string }>(
      "GET",
      `/api/v1/certificates/verify/${certCodeS1}`
    );
    assert.equal(v.json.data.status, "revoked");

    const again = await api(
      "POST",
      `/api/v1/instructor/certificates/${certId}/revoke`,
      tokens.teacher,
      { reason: "Cabut dua kali" }
    );
    assert.equal(again.http, 409);

    // Terbit ulang setelah dicabut ditolak.
    const reissue = await api(
      "POST",
      `/api/v1/modules/${ids.mod}/certificate`,
      tokens.s1,
      {}
    );
    assert.equal(reissue.http, 409);
    assert.equal(reissue.json.code, "CERT_REVOKED");

    // Unduh setelah dicabut ditolak (PDF lama di disk tak bisa diakses).
    const afterRevoke = await fetch(
      `${base}/api/v1/me/certificates/${certId}/download`,
      { headers: { authorization: `Bearer ${tokens.s1}` } }
    );
    assert.equal(afterRevoke.status, 403);
  });
});

describe("concurrency penerbitan", () => {
  it("2 request paralel s4 (sudah terbit otomatis): keduanya 200, tetap 1 baris", async () => {
    const [a, b] = await Promise.all([
      api<{ code: string }>("POST", `/api/v1/modules/${ids.mod}/certificate`, tokens.s4, {}),
      api<{ code: string }>("POST", `/api/v1/modules/${ids.mod}/certificate`, tokens.s4, {}),
    ]);
    assert.equal(a.http, 200);
    assert.equal(b.http, 200);
    assert.equal(a.json.data.code, b.json.data.code);
    const rows = await db.select().from(schema.certificates);
    assert.equal(rows.filter((r) => r.userId === ids.s4).length, 1);
  });
});
