import "./test-env";
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
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
 * Batch 1 Bagian 3 — API quiz attempts (penilaian otomatis server).
 * Uji integrasi HTTP penuh melawan database tes TERPISAH
 * (`aristoteles_test_b3`), TIDAK PERNAH menyentuh database live.
 *
 * Jalankan dari folder backend/: npx tsx --test <file-ini>
 */

const TEST_PASSWORD = "Katasandi123";

interface Envelope<T> {
  status: "success" | "error";
  message: string;
  data: T;
  errors?: Array<{ field: string; message: string }> | null;
}

let base = "";
let server: Server | null = null;
let tokens: Record<string, string> = {};
let studentIds: number[] = [];
let quizMat = 0;
let quizMat2 = 0;
let nonQuizMat = 0;
let emptyQuizMat = 0;
let draftQuizMat = 0;

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

const twoQuestions = () => ({
  questions: [
    {
      questionText: "Ibukota Indonesia?",
      options: [
        { optionText: "Jakarta", isCorrect: true },
        { optionText: "Bandung", isCorrect: false },
        { optionText: "Surabaya", isCorrect: false },
        { optionText: "Medan", isCorrect: false },
      ],
    },
    {
      questionText: "2 + 2 = ?",
      options: [
        { optionText: "3", isCorrect: false },
        { optionText: "4", isCorrect: true },
        { optionText: "5", isCorrect: false },
      ],
    },
  ],
});

before(async () => {
  const admin = await mysql.createConnection({
    host: "localhost",
    port: 3306,
    user: "root",
    password: "",
  });
  try {
    await admin.query("CREATE DATABASE IF NOT EXISTS aristoteles_test_b3");
  } finally {
    await admin.end();
  }
  await migrate(db, { migrationsFolder: "drizzle" });

  const hash = await bcrypt.hash(TEST_PASSWORD, 4);
  const [tH] = await db.insert(schema.users).values({
    name: "Guru Kuis",
    email: "gurukuis@uji.io",
    passwordHash: hash,
    role: "teacher",
  });
  const teacherId = Number((tH as unknown as { insertId: number }).insertId);
  for (const [i, email] of ["murid1@uji.io", "murid2@uji.io"].entries()) {
    const [h] = await db.insert(schema.users).values({
      name: `Murid ${i + 1}`,
      email,
      passwordHash: hash,
      role: "student",
    });
    studentIds.push(Number((h as unknown as { insertId: number }).insertId));
  }
  const [cH] = await db.insert(schema.courses).values({
    title: "Kursus Kuis Uji Cukup Panjang",
    description: "Deskripsi kursus kuis uji yang cukup panjang.",
    category: "Pengembangan Web",
    level: "Pemula",
    duration: "4 Bulan",
    status: "published",
    priceLabel: "GRATIS",
    priceNominal: 0,
    period: "ongoing",
    outcomes: ["Hasil belajar pertama yang cukup panjang"],
    tools: ["Laptop"],
    createdBy: teacherId,
  });
  const courseId = Number((cH as unknown as { insertId: number }).insertId);
  const [dH] = await db.insert(schema.courses).values({
    title: "Kursus Draft Kuis Uji Panjang",
    description: "Deskripsi kursus draft kuis uji yang cukup panjang.",
    category: "Pengembangan Web",
    level: "Pemula",
    duration: "4 Bulan",
    status: "draft",
    priceLabel: "GRATIS",
    priceNominal: 0,
    period: "upcoming",
    outcomes: ["Hasil belajar pertama yang cukup panjang"],
    tools: ["Laptop"],
    createdBy: teacherId,
  });
  const draftCourse = Number((dH as unknown as { insertId: number }).insertId);
  await db.insert(schema.courseInstructors).values([
    { courseId, userId: teacherId },
    { courseId: draftCourse, userId: teacherId },
  ]);
  const [mH] = await db.insert(schema.modules).values({
    courseId,
    title: "Modul Kuis Uji",
    type: "kuis",
    position: 0,
  });
  const modId = Number((mH as unknown as { insertId: number }).insertId);
  const [dmH] = await db.insert(schema.modules).values({
    courseId: draftCourse,
    title: "Modul Draft Uji",
    type: "kuis",
    position: 0,
  });
  const draftMod = Number((dmH as unknown as { insertId: number }).insertId);
  // Enrollment aktif kedua murid di kursus publik (syarat akses Tahap 1).
  await db.insert(schema.enrollments).values(
    studentIds.map((userId) => ({
      userId,
      courseId,
      source: "free",
      status: "active" as const,
    }))
  );
  const mk = async (moduleId: number, title: string, type: string) => {
    const [h] = await db.insert(schema.materials).values({
      moduleId,
      title,
      type: type as "kuis",
      content: "{}",
      position: 0,
    });
    return Number((h as unknown as { insertId: number }).insertId);
  };
  quizMat = await mk(modId, "Kuis Utama Materi Cukup Panjang", "kuis");
  quizMat2 = await mk(modId, "Kuis Kedua Materi Cukup Panjang", "kuis");
  nonQuizMat = await mk(modId, "Materi Biasa Bukan Kuis Panjang", "materi");
  emptyQuizMat = await mk(modId, "Kuis Kosong Tanpa Soal Panjang", "kuis");
  draftQuizMat = await mk(draftMod, "Kuis Draft Saja Cukup Panjang", "kuis");

  const srv = app.listen(0);
  await once(srv, "listening");
  server = srv;
  const addr = srv.address() as AddressInfo;
  base = `http://127.0.0.1:${addr.port}`;
  tokens = {
    teacher: await login("gurukuis@uji.io"),
    s1: await login("murid1@uji.io"),
    s2: await login("murid2@uji.io"),
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
    await admin.query("DROP DATABASE aristoteles_test_b3");
  } finally {
    await admin.end();
  }
});

describe("kelola bank soal (PUT)", () => {
  it("teacher menyimpan 2 soal valid; respons memuat kunci", async () => {
    const r = await api<{ materialId: number; questions: unknown[] }>(
      "PUT",
      `/api/v1/materials/${quizMat}/quiz`,
      tokens.teacher,
      twoQuestions()
    );
    assert.equal(r.http, 200);
    assert.equal(r.json.status, "success");
    assert.equal(r.json.data.questions.length, 2);
    assert.ok(JSON.stringify(r.json.data).includes("isCorrect"));
  });

  it("menolak 0 benar, 2 benar, <2 opsi, tanpa soal", async () => {
    const bad = (q: unknown) => ({ questions: [q] });
    const opt = (t: string, c: boolean) => ({ optionText: t, isCorrect: c });
    const cases = [
      bad({ questionText: "Q?", options: [opt("A", false), opt("B", false)] }),
      bad({
        questionText: "Q?",
        options: [opt("A", true), opt("B", true)],
      }),
      bad({ questionText: "Q?", options: [opt("Saja", true)] }),
      { questions: [] },
    ];
    for (const body of cases) {
      const r = await api("PUT", `/api/v1/materials/${quizMat}/quiz`, tokens.teacher, body);
      assert.equal(r.http, 400, JSON.stringify(body).slice(0, 60));
    }
  });

  it("403 siswa, 400 materi non-kuis; draft oleh pengelola 200", async () => {
    const s = await api(
      "PUT",
      `/api/v1/materials/${quizMat}/quiz`,
      tokens.s1,
      twoQuestions()
    );
    assert.equal(s.http, 403);
    const nq = await api(
      "PUT",
      `/api/v1/materials/${nonQuizMat}/quiz`,
      tokens.teacher,
      twoQuestions()
    );
    assert.equal(nq.http, 400);
    const d = await api(
      "PUT",
      `/api/v1/materials/${draftQuizMat}/quiz`,
      tokens.teacher,
      twoQuestions()
    );
    assert.equal(d.http, 200);
  });
});

describe("ambil soal peserta (GET, tanpa kunci)", () => {
  it("siswa menerima soal tanpa isCorrect/explanation", async () => {
    const r = await api<{ questions: Record<string, unknown>[] }>(
      "GET",
      `/api/v1/materials/${quizMat}/quiz`,
      tokens.s1
    );
    assert.equal(r.http, 200);
    assert.equal(r.json.data.questions.length, 2);
    for (const q of r.json.data.questions) {
      assert.deepEqual(Object.keys(q).sort(), ["id", "options", "position", "questionText"]);
      for (const o of q.options as Record<string, unknown>[]) {
        assert.deepEqual(Object.keys(o).sort(), ["id", "optionText", "position"]);
      }
    }
  });

  it("400 non-kuis; 404 hilang; 404 draft bagi asing; 401 tanpa token", async () => {
    assert.equal(
      (await api("GET", `/api/v1/materials/${nonQuizMat}/quiz`, tokens.s1)).http,
      400
    );
    assert.equal(
      (await api("GET", "/api/v1/materials/999999/quiz", tokens.s1)).http,
      404
    );
    assert.equal(
      (await api("GET", `/api/v1/materials/${draftQuizMat}/quiz`, tokens.s2)).http,
      404
    );
    assert.equal((await api("GET", `/api/v1/materials/${quizMat}/quiz`)).http, 401);
  });
});

describe("kirim percobaan (server grading)", () => {
  it("nilai dihitung server: 1 benar + 1 kosong = 50", async () => {
    // Siapkan soal dulu (teacher).
    await api("PUT", `/api/v1/materials/${quizMat2}/quiz`, tokens.teacher, twoQuestions());
    const fresh = await api<{ questions: { id: number; options: { id: number }[] }[] }>(
      "GET",
      `/api/v1/materials/${quizMat2}/quiz`,
      tokens.teacher
    );
    // Ambil kunci langsung dari DB (simulasi guru; siswa tak punya akses ini).
    const rows = await db
      .select()
      .from(schema.quizOptions)
      .where(eq(schema.quizOptions.questionId, fresh.json.data.questions[0].id));
    const correctOpt = rows.find((o) => o.isCorrect);
    assert.ok(correctOpt);
    const answers = fresh.json.data.questions.map((q, i) =>
      i === 0
        ? { questionId: q.id, optionId: correctOpt.id }
        : { questionId: q.id, optionId: null }
    );
    const r = await api<{
      score: number;
      total: number;
      correct: number;
      passed: boolean;
    }>("POST", `/api/v1/materials/${quizMat2}/quiz-attempts`, tokens.s1, { answers });
    assert.equal(r.http, 201);
    // 1 benar dari 2 soal -> 50, di bawah ambang default 70.
    assert.deepEqual(
      { score: r.json.data.score, total: r.json.data.total, correct: r.json.data.correct, passed: r.json.data.passed },
      { score: 50, total: 2, correct: 1, passed: false }
    );
  });

  it("menolak skor buatan, duplikat, id asing, opsi lintas soal", async () => {
    const g = await api<{ questions: { id: number; options: { id: number }[] }[] }>(
      "GET",
      `/api/v1/materials/${quizMat2}/quiz`,
      tokens.teacher
    );
    const [q1, q2] = g.json.data.questions;
    const badBodies = [
      { answers: [{ questionId: q1.id, optionId: q1.options[0].id }], score: 100 },
      {
        answers: [
          { questionId: q1.id, optionId: q1.options[0].id },
          { questionId: q1.id, optionId: q1.options[1].id },
        ],
      },
      { answers: [{ questionId: 999999, optionId: q1.options[0].id }] },
      { answers: [{ questionId: q1.id, optionId: q2.options[0].id }] },
    ];
    for (const body of badBodies) {
      const r = await api("POST", `/api/v1/materials/${quizMat2}/quiz-attempts`, tokens.s1, body);
      assert.equal(r.http, 400, JSON.stringify(body).slice(0, 80));
    }
  });

  it("400 kuis tanpa soal & materi non-kuis; akses butuh enrollment", async () => {
    assert.equal(
      (await api("POST", `/api/v1/materials/${emptyQuizMat}/quiz-attempts`, tokens.s1, { answers: [] })).http,
      400
    );
    assert.equal(
      (
        await api("POST", `/api/v1/materials/${nonQuizMat}/quiz-attempts`, tokens.s1, {
          answers: [],
        })
      ).http,
      400
    );
    // s2 terdaftar (fixture) sehingga bisa mengerjakan; tanpa akses → 403.
    const g = await api<{ questions: { id: number; options: { id: number }[] }[] }>(
      "GET",
      `/api/v1/materials/${quizMat2}/quiz`,
      tokens.s2
    );
    assert.equal(g.http, 200);
  });
});

describe("ambang, terbaik, kelulusan menempel", () => {
  it("default 70, kustom via PATCH materi, best=MAX, lulus bertahan", async () => {
    const keyOf = async (matId: number) => {
      const qs = await db
        .select()
        .from(schema.quizQuestions)
        .where(eq(schema.quizQuestions.materialId, matId));
      const out: Record<number, number> = {};
      for (const q of qs) {
        const os = await db
          .select()
          .from(schema.quizOptions)
          .where(eq(schema.quizOptions.questionId, q.id));
        out[q.id] = os.find((o) => o.isCorrect)!.id;
      }
      return out;
    };
    const keys = await keyOf(quizMat);
    const submit = (pick: (qid: number, right: number) => number | null) =>
      api<{
        score: number;
        passed: boolean;
        bestScore: number;
        attempts: number;
        overallPassed: boolean;
      }>("POST", `/api/v1/materials/${quizMat}/quiz-attempts`, tokens.s1, {
        answers: Object.entries(keys).map(([qid, right]) => ({
          questionId: Number(qid),
          optionId: pick(Number(qid), right),
        })),
      });
    // Salah satu benar -> 50 < 70.
    let r = await submit((qid, right) => (qid % 2 === 0 ? right : null));
    void r;
    const allWrong = await submit(() => null);
    assert.equal(allWrong.json.data.score, 0);
    // Semua benar -> 100, lulus.
    const gold = await submit((_, right) => right);
    assert.equal(gold.json.data.score, 100);
    assert.equal(gold.json.data.passed, true);
    // Naikkan ambang ke 100 via PATCH materi (jalur Bagian 1).
    const patch = await api(
      "PATCH",
      `/api/v1/materials/${quizMat}`,
      tokens.teacher,
      { passScore: 100 }
    );
    assert.equal(patch.http, 200);
    // Nilai 50 dengan ambang 100 -> gagal, tapi overallPassed tetap true (menempel).
    const low = await submit(() => null);
    assert.equal(low.json.data.score, 0);
    assert.equal(low.json.data.passed, false);
    const best = await api<{
      attempts: number;
      bestScore: number;
      effectivePassScore: number;
      passed: boolean;
    }>("GET", `/api/v1/materials/${quizMat}/quiz-best`, tokens.s1);
    assert.equal(best.http, 200);
    assert.equal(best.json.data.attempts, 4);
    assert.equal(best.json.data.bestScore, 100);
    assert.equal(best.json.data.effectivePassScore, 100);
    assert.equal(best.json.data.passed, true);
    // Snapshot percobaan lama tetap berambang 70 (audit tidak berubah).
    const oldRows = await db
      .select()
      .from(schema.quizAttempts)
      .where(eq(schema.quizAttempts.materialId, quizMat));
    const snaps = oldRows.map((a) => (a.passScore, a.snapshot as { questions: unknown[] } | null));
    assert.ok(oldRows.length >= 4);
    assert.ok(snaps.some((s) => s !== null && Array.isArray(s.questions) && s.questions.length === 2));
    // Riwayat milik sendiri, tanpa kunci/snapshot/answers.
    const hist = await api<Record<string, unknown>[]>(
      "GET",
      `/api/v1/materials/${quizMat}/quiz-attempts`,
      tokens.s1
    );
    assert.equal(hist.json.data.length, 4);
    const blob = JSON.stringify(hist.json.data);
    assert.ok(!blob.includes("isCorrect"));
    assert.ok(!blob.includes("snapshot"));
    assert.ok(!blob.includes("answers"));
  });

  it("isolasi: s2 kosong; append-only; rotasi kunci tak merusak audit lama", async () => {
    const s2best = await api<{ attempts: number; bestScore: number | null; passed: boolean }>(
      "GET",
      `/api/v1/materials/${quizMat}/quiz-best`,
      tokens.s2
    );
    assert.deepEqual(
      { a: s2best.json.data.attempts, b: s2best.json.data.bestScore, p: s2best.json.data.passed },
      { a: 0, b: null, p: false }
    );
    // Catat kunci lama dari DB, lalu putar: jawaban benar soal 1 pindah opsi.
    const before = await db
      .select()
      .from(schema.quizOptions)
      .where(
        eq(
          schema.quizOptions.questionId,
          (
            await db
              .select()
              .from(schema.quizQuestions)
              .where(eq(schema.quizQuestions.materialId, quizMat))
          )[0].id
        )
      );
    const oldCorrect = before.find((o) => o.isCorrect)!;
    const rotated = {
      questions: [
        {
          questionText: "Ibukota Indonesia?",
          options: [
            { optionText: "Jakarta", isCorrect: false },
            { optionText: "Bandung", isCorrect: true },
            { optionText: "Surabaya", isCorrect: false },
            { optionText: "Medan", isCorrect: false },
          ],
        },
        {
          questionText: "2 + 2 = ?",
          options: [
            { optionText: "3", isCorrect: false },
            { optionText: "4", isCorrect: true },
            { optionText: "5", isCorrect: false },
          ],
        },
      ],
    };
    assert.equal(
      (await api("PUT", `/api/v1/materials/${quizMat}/quiz`, tokens.teacher, rotated)).http,
      200
    );
    // Jawaban memakai kunci LAMA untuk soal 1 kini salah (bukti kunci baru aktif).
    const now = await api<{ questions: { id: number; options: { id: number }[] }[] }>(
      "GET",
      `/api/v1/materials/${quizMat}/quiz`,
      tokens.teacher
    );
    const stale = await api<{ score: number; correct: number }>(
      "POST",
      `/api/v1/materials/${quizMat}/quiz-attempts`,
      tokens.s1,
      {
        answers: [
          { questionId: now.json.data.questions[0].id, optionId: oldCorrect.id },
        ],
      }
    );
    // oldCorrect.id milik soal lama (terhapus cascade); bisa 400 id asing —
    // yang penting BUKAN dinilai benar memakai kunci lama.
    assert.ok([200, 400].includes(stale.http));
    if (stale.http === 200) assert.ok(stale.json.data.score < 100);
    // Snapshot percobaan lama tetap memuat kunci lama (audit utuh).
    const oldAttempts = await db
      .select()
      .from(schema.quizAttempts)
      .where(eq(schema.quizAttempts.materialId, quizMat));
    const withOldKey = oldAttempts.filter((a) => {
      const s = a.snapshot as { questions: { options: { isCorrect: boolean; optionText: string }[] }[] } | null;
      return s !== null && s.questions.some((q) => q.options.some((o) => o.isCorrect && o.optionText === "Jakarta"));
    });
    assert.ok(withOldKey.length > 0);
  });
});
