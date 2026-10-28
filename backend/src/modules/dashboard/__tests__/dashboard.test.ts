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
 * Dasbor instruktur — uji integrasi HTTP penuh melawan database tes TERPISAH
 * (`aristoteles_test_dash`), TIDAK PERNAH menyentuh database live.
 * Mencakup: ringkasan agregat dari database, 401 tanpa token, 403 non-pengelola.
 *
 * Jalankan dari folder backend/: npx tsx --test <file-ini>
 */

const TEST_PASSWORD = "Katasandi123";
const VALID_TIPTAP = JSON.stringify({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "Halo" }] }],
});

let base = "";
let server: Server | null = null;
const ids: Record<string, number> = {};
let teacherToken = "";
let studentToken = "";

async function api<T>(method: string, url: string, token?: string) {
  const headers: Record<string, string> = { accept: "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(base + url, { method, headers });
  return { http: res.status, json: (await res.json()) as { status: string; data: T } };
}

before(async () => {
  const admin = await mysql.createConnection({ host: "localhost", port: 3306, user: "root", password: "" });
  try {
    // Mulai dari bersih agar run berulang idempoten (DB tes terisolasi, bukan live).
    await admin.query("DROP DATABASE IF EXISTS aristoteles_test_dash");
    await admin.query("CREATE DATABASE aristoteles_test_dash");
  } finally {
    await admin.end();
  }
  await migrate(db, { migrationsFolder: path.resolve("drizzle") });

  const hash = await bcrypt.hash(TEST_PASSWORD, 4);
  const mkUser = async (name: string, email: string, role: "teacher" | "student") => {
    const [h] = await db.insert(schema.users).values({ name, email, passwordHash: hash, role });
    return Number((h as unknown as { insertId: number }).insertId);
  };
  ids.teacher = await mkUser("Guru Dash", "guru@dash.io", "teacher");
  ids.student = await mkUser("Siswa Dash", "siswa@dash.io", "student");

  const [ch] = await db.insert(schema.courses).values({
    title: "Kursus Dasbor Uji Cukup Panjang",
    description: "Deskripsi kursus dasbor yang cukup panjang untuk validasi.",
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
  ids.course = Number((ch as unknown as { insertId: number }).insertId);

  const [mh] = await db.insert(schema.modules).values({
    courseId: ids.course, title: "Modul Dasbor Uji Cukup Panjang", type: "materi", position: 0,
  });
  ids.module = Number((mh as unknown as { insertId: number }).insertId);

  const mkMat = async (title: string, type: "materi" | "tugas") => {
    const [h] = await db.insert(schema.materials).values({
      moduleId: ids.module, title, type, content: VALID_TIPTAP, position: 0,
    });
    return Number((h as unknown as { insertId: number }).insertId);
  };
  ids.taskMat = await mkMat("Tugas Dasbor Uji Cukup Panjang", "tugas");
  ids.plainMat = await mkMat("Materi Dasbor Uji Cukup Panjang", "materi");

  await db.insert(schema.enrollments).values({
    userId: ids.student, courseId: ids.course, source: "free", status: "active",
  });
  await db.insert(schema.submissions).values({
    userId: ids.student, materialId: ids.taskMat, filePath: "/api/v1/files/1/content", status: "submitted",
  });
  await db.insert(schema.progress).values({ userId: ids.student, materialId: ids.plainMat });

  const srv = app.listen(0);
  await once(srv, "listening");
  server = srv;
  const addr = srv.address() as AddressInfo;
  base = `http://127.0.0.1:${addr.port}`;

  const loginRes = await fetch(base + "/api/v1/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "guru@dash.io", password: TEST_PASSWORD }),
  });
  const loginJson = (await loginRes.json()) as { data: { accessToken: string } };
  assert.equal(loginRes.status, 200);
  teacherToken = loginJson.data.accessToken;

  const studentRes = await fetch(base + "/api/v1/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "siswa@dash.io", password: TEST_PASSWORD }),
  });
  const studentJson = (await studentRes.json()) as { data: { accessToken: string } };
  assert.equal(studentRes.status, 200);
  studentToken = studentJson.data.accessToken;
});

after(async () => {
  if (server) await new Promise<void>((r) => server?.close(() => r()));
  await pool.end();
  const admin = await mysql.createConnection({ host: "localhost", port: 3306, user: "root", password: "" });
  try {
    await admin.query("DROP DATABASE aristoteles_test_dash");
  } finally {
    await admin.end();
  }
});

describe("GET /api/v1/instructor/dashboard", () => {
  it("401 tanpa token", async () => {
    const r = await api("GET", "/api/v1/instructor/dashboard");
    assert.equal(r.http, 401);
  });

  it("403 untuk peran student", async () => {
    const r = await api("GET", "/api/v1/instructor/dashboard", studentToken);
    assert.equal(r.http, 403);
  });

  it("200 ringkasan dari database (tanpa data contoh)", async () => {
    const r = await api<{
      courses: Array<{ id: number; title: string; status: string; studentCount: number; pendingCount: number; avgProgress: number }>;
      pendingReviews: Array<{ submissionId: number; studentName: string; courseTitle: string; materialTitle: string }>;
      totals: { activeCourses: number; draftCourses: number; totalStudents: number; pendingReviews: number };
    }>("GET", "/api/v1/instructor/dashboard", teacherToken);
    assert.equal(r.http, 200);
    assert.equal(r.json.status, "success");
    assert.deepEqual(r.json.data.totals, { activeCourses: 1, draftCourses: 0, totalStudents: 1, pendingReviews: 1 });
    assert.equal(r.json.data.courses.length, 1);
    assert.deepEqual(
      { s: r.json.data.courses[0].studentCount, p: r.json.data.courses[0].pendingCount, a: r.json.data.courses[0].avgProgress },
      { s: 1, p: 1, a: 50 }
    );
    assert.equal(r.json.data.pendingReviews.length, 1);
    assert.equal(r.json.data.pendingReviews[0].studentName, "Siswa Dash");
    assert.equal(r.json.data.pendingReviews[0].materialTitle, "Tugas Dasbor Uji Cukup Panjang");
  });
});
