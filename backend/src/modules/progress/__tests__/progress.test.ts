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
import { db, pool } from "../../../db/index";
import * as schema from "../../../db/schema";
import app from "../../../app";

/**
 * Bagian 2 Batch 1 — API progres belajar.
 * Uji integrasi HTTP penuh melawan database tes TERPISAH
 * (`aristoteles_test_b2`), TIDAK PERNAH menyentuh database live.
 * Mencakup: autentikasi, validasi, idempotensi, isolasi pengguna,
 * filter kursus, dan relasi materi→kursus (termasuk kursus draft).
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
// Id materi fixture, diisi saat setup.
let pubMat = 0;
let pubMat2 = 0;
let draftMat = 0;
let pubCourse = 0;
let draftCourse = 0;

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
  // 1. Buat database tes kosong (koneksi level server, tanpa database).
  const admin = await mysql.createConnection({
    host: "localhost",
    port: 3306,
    user: "root",
    password: "",
  });
  try {
    await admin.query("CREATE DATABASE IF NOT EXISTS aristoteles_test_b2");
  } finally {
    await admin.end();
  }

  // 2. Migrasi skema penuh (0000–0002) ke database tes.
  await migrate(db, { migrationsFolder: path.resolve("drizzle") });

  // 3. Fixture minimal: teacher + 2 student, 1 kursus published + 1 draft.
  const hash = await bcrypt.hash(TEST_PASSWORD, 4);
  const [tH] = await db.insert(schema.users).values({
    name: "Guru Uji",
    email: "guru@uji.io",
    passwordHash: hash,
    role: "teacher",
  });
  const teacherId = Number((tH as unknown as { insertId: number }).insertId);
  const studentIds: number[] = [];
  for (const [i, email] of ["siswa1@uji.io", "siswa2@uji.io"].entries()) {
    const [h] = await db.insert(schema.users).values({
      name: `Siswa ${i + 1}`,
      email,
      passwordHash: hash,
      role: "student",
    });
    studentIds.push(Number((h as unknown as { insertId: number }).insertId));
  }
  const [cH] = await db.insert(schema.courses).values({
    title: "Kursus Publik Uji Progres",
    description: "Deskripsi kursus uji progres yang cukup panjang.",
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
  pubCourse = Number((cH as unknown as { insertId: number }).insertId);
  const [dH] = await db.insert(schema.courses).values({
    title: "Kursus Draft Uji Progres Panjang",
    description: "Deskripsi kursus draft uji progres yang cukup panjang.",
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
  draftCourse = Number((dH as unknown as { insertId: number }).insertId);
  await db.insert(schema.courseInstructors).values([
    { courseId: pubCourse, userId: teacherId },
    { courseId: draftCourse, userId: teacherId },
  ]);
  // Enrollment aktif siswa1 di kursus publik (mendokumentasikan: tidak jadi gate).
  await db.insert(schema.enrollments).values({
    userId: studentIds[0],
    courseId: pubCourse,
    source: "free",
    status: "active",
  });
  const [mH] = await db.insert(schema.modules).values({
    courseId: pubCourse,
    title: "Modul Publik Uji",
    type: "materi",
    position: 0,
  });
  const pubMod = Number((mH as unknown as { insertId: number }).insertId);
  const [dMH] = await db.insert(schema.modules).values({
    courseId: draftCourse,
    title: "Modul Draft Uji",
    type: "materi",
    position: 0,
  });
  const draftMod = Number((dMH as unknown as { insertId: number }).insertId);
  const [aH] = await db.insert(schema.materials).values({
    moduleId: pubMod,
    title: "Materi Publik Satu Cukup Panjang",
    type: "materi",
    content: "{}",
    position: 0,
  });
  pubMat = Number((aH as unknown as { insertId: number }).insertId);
  const [bH] = await db.insert(schema.materials).values({
    moduleId: pubMod,
    title: "Materi Publik Dua Cukup Panjang",
    type: "materi",
    content: "{}",
    position: 1,
  });
  pubMat2 = Number((bH as unknown as { insertId: number }).insertId);
  const [gH] = await db.insert(schema.materials).values({
    moduleId: draftMod,
    title: "Materi Draft Saja Cukup Panjang",
    type: "materi",
    content: "{}",
    position: 0,
  });
  draftMat = Number((gH as unknown as { insertId: number }).insertId);

  // 4. Server ephemeral + token.
  const srv = app.listen(0);
  await once(srv, "listening");
  server = srv;
  const addr = srv.address() as AddressInfo;
  base = `http://127.0.0.1:${addr.port}`;
  tokens = {
    teacher: await login("guru@uji.io"),
    s1: await login("siswa1@uji.io"),
    s2: await login("siswa2@uji.io"),
  };
});

after(async () => {
  if (server) await new Promise<void>((r) => server?.close(() => r()));
  await pool.end();
  // Bersihkan database tes; live tidak tersentuh.
  const admin = await mysql.createConnection({
    host: "localhost",
    port: 3306,
    user: "root",
    password: "",
  });
  try {
    await admin.query("DROP DATABASE aristoteles_test_b2");
  } finally {
    await admin.end();
  }
});

describe("autentikasi & validasi", () => {
  it("401 tanpa token (POST, DELETE, GET)", async () => {
    for (const [m, u] of [
      ["POST", `/api/v1/materials/${pubMat}/progress`],
      ["DELETE", `/api/v1/materials/${pubMat}/progress`],
      ["GET", "/api/v1/me/progress"],
    ] as const) {
      const r = await api(m, u);
      assert.equal(r.http, 401);
      assert.equal(r.json.status, "error");
    }
  });

  it("401 token palsu", async () => {
    const r = await api("POST", `/api/v1/materials/${pubMat}/progress`, "palsu");
    assert.equal(r.http, 401);
  });

  it("404 id materi non-numerik/nol/hilang", async () => {
    for (const id of ["abc", "0", "-5", "999999"]) {
      const r = await api<{ materialId: number }>(
        "POST",
        `/api/v1/materials/${id}/progress`,
        tokens.s1
      );
      assert.equal(r.http, 404, `POST id=${id}`);
      assert.equal(r.json.status, "error");
      const d = await api("DELETE", `/api/v1/materials/${id}/progress`, tokens.s1);
      assert.equal(d.http, 404, `DELETE id=${id}`);
    }
  });

  it("400 courseId kueri tidak valid; 404 kursus hilang", async () => {
    const bad = await api("GET", "/api/v1/me/progress?courseId=abc", tokens.s1);
    assert.equal(bad.http, 400);
    const missing = await api("GET", "/api/v1/me/progress?courseId=999999", tokens.s1);
    assert.equal(missing.http, 404);
  });
});

describe("tandai idempoten & baca milik sendiri", () => {
  it("POST pertama completed, POST kedua alreadyCompleted, satu baris", async () => {
    const r1 = await api<{
      materialId: number;
      completed: boolean;
      alreadyCompleted: boolean;
    }>("POST", `/api/v1/materials/${pubMat}/progress`, tokens.s1);
    assert.equal(r1.http, 200);
    assert.equal(r1.json.status, "success");
    assert.equal(r1.json.data.completed, true);
    assert.equal(r1.json.data.alreadyCompleted, false);
    const r2 = await api<{ alreadyCompleted: boolean }>(
      "POST",
      `/api/v1/materials/${pubMat}/progress`,
      tokens.s1
    );
    assert.equal(r2.http, 200);
    assert.equal(r2.json.data.alreadyCompleted, true);
    const list = await api<number[]>("GET", "/api/v1/me/progress", tokens.s1);
    assert.deepEqual(list.json.data, [pubMat]);
  });

  it("filter courseId hanya kembalikan materi kursus itu", async () => {
    await api("POST", `/api/v1/materials/${pubMat2}/progress`, tokens.s1);
    const all = await api<number[]>("GET", "/api/v1/me/progress", tokens.s1);
    assert.deepEqual(
      [...all.json.data].sort((a, b) => a - b),
      [pubMat, pubMat2].sort((a, b) => a - b)
    );
    const one = await api<number[]>(
      "GET",
      `/api/v1/me/progress?courseId=${pubCourse}`,
      tokens.s1
    );
    assert.deepEqual(
      [...one.json.data].sort((a, b) => a - b),
      [pubMat, pubMat2].sort((a, b) => a - b)
    );
    const draft = await api<number[]>(
      "GET",
      `/api/v1/me/progress?courseId=${draftCourse}`,
      tokens.teacher
    );
    assert.deepEqual(draft.json.data, []);
  });
});

describe("isolasi pengguna", () => {
  it("siswa2 tidak melihat progres siswa1; tulisannya terpisah", async () => {
    const s2 = await api<number[]>("GET", "/api/v1/me/progress", tokens.s2);
    assert.deepEqual(s2.json.data, []);
    await api("POST", `/api/v1/materials/${pubMat}/progress`, tokens.s2);
    const s2b = await api<number[]>("GET", "/api/v1/me/progress", tokens.s2);
    assert.deepEqual(s2b.json.data, [pubMat]);
    const s1 = await api<number[]>("GET", "/api/v1/me/progress", tokens.s1);
    assert.ok(s1.json.data.includes(pubMat) && s1.json.data.includes(pubMat2));
  });

  it("materi kursus draft: siswa asing 404, pengelola 200", async () => {
    const forbidden = await api(
      "POST",
      `/api/v1/materials/${draftMat}/progress`,
      tokens.s2
    );
    assert.equal(forbidden.http, 404);
    const allowed = await api<{ completed: boolean }>(
      "POST",
      `/api/v1/materials/${draftMat}/progress`,
      tokens.teacher
    );
    assert.equal(allowed.http, 200);
    assert.equal(allowed.json.data.completed, true);
  });
});

describe("batalkan tanda (idempoten)", () => {
  it("DELETE menghapus lalu kosong; DELETE ulang tetap 200", async () => {
    const d1 = await api("DELETE", `/api/v1/materials/${pubMat2}/progress`, tokens.s1);
    assert.equal(d1.http, 200);
    const list = await api<number[]>("GET", "/api/v1/me/progress", tokens.s1);
    assert.deepEqual(list.json.data, [pubMat]);
    const d2 = await api("DELETE", `/api/v1/materials/${pubMat2}/progress`, tokens.s1);
    assert.equal(d2.http, 200);
  });
});
