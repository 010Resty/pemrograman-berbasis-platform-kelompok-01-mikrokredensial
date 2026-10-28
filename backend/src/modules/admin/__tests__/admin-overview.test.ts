import "./test-env";
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import path from "node:path";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/mysql2/migrator";
import { db, pool } from "../../../db/index";
import * as schema from "../../../db/schema";
import app from "../../../app";

/**
 * Ringkasan badge sidebar admin (GET /api/v1/admin/overview).
 * Uji integrasi HTTP penuh melawan database tes TERPISAH
 * (`aristoteles_test_b9`), TIDAK PERNAH menyentuh database live.
 * Mencakup: hitungan peserta/instruktur/kursus, 401 tanpa token,
 * 403 untuk peran non-admin.
 *
 * Jalankan dari folder backend/: npx tsx --test <file-ini>
 */

const TEST_PASSWORD = "Katasandi123";

interface Envelope<T> {
  status: "success" | "error";
  message: string;
  data: T;
}

let base = "";
let server: Server | null = null;
let adminToken = "";
let studentToken = "";

async function api<T>(
  method: string,
  url: string,
  token?: string
): Promise<{ http: number; json: Envelope<T> }> {
  const headers: Record<string, string> = { accept: "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(base + url, { method, headers });
  const json = (await res.json()) as Envelope<T>;
  return { http: res.status, json };
}

async function login(email: string): Promise<string> {
  const res = await fetch(base + "/api/v1/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ email, password: TEST_PASSWORD }),
  });
  const json = (await res.json()) as Envelope<{ accessToken: string }>;
  assert.equal(res.status, 200);
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
    await admin.query("CREATE DATABASE IF NOT EXISTS aristoteles_test_b9");
  } finally {
    await admin.end();
  }
  await migrate(db, { migrationsFolder: path.resolve("drizzle") });

  const hash = await bcrypt.hash(TEST_PASSWORD, 4);
  const mkUser = async (name: string, email: string, role: "admin" | "teacher" | "student") => {
    await db.insert(schema.users).values({ name, email, passwordHash: hash, role });
  };
  await mkUser("Admin Uji", "admin@uji.io", "admin");
  await mkUser("Guru Uji", "guru@uji.io", "teacher");
  await mkUser("Siswa Satu", "siswa1@uji.io", "student");
  await mkUser("Siswa Dua", "siswa2@uji.io", "student");

  for (let i = 1; i <= 2; i++) {
    await db.insert(schema.courses).values({
      title: `Kursus Uji ${i} Cukup Panjang`,
      description: "Deskripsi kursus uji ringkasan admin yang cukup panjang.",
      category: "Pengembangan Web",
      level: "Pemula",
      duration: "4 Bulan",
      status: "published",
      priceLabel: "GRATIS",
      priceNominal: 0,
      period: "ongoing",
      outcomes: ["Hasil belajar pertama yang cukup panjang"],
      tools: ["Laptop"],
    });
  }

  // Satu sertifikat aktif agar totalCertificates teruji bukan nol.
  const [s1] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, "siswa1@uji.io"))
    .limit(1);
  const [c1] = await db
    .select({ id: schema.courses.id })
    .from(schema.courses)
    .orderBy(schema.courses.id)
    .limit(1);
  const [mH] = await db.insert(schema.modules).values({
    courseId: c1.id,
    title: "Modul Sertifikat Uji",
    type: "materi",
    position: 0,
  });
  const moduleId = Number((mH as unknown as { insertId: number }).insertId);
  await db.insert(schema.certificates).values({
    userId: s1.id,
    courseId: c1.id,
    moduleId,
    code: "ATS-2026-TEST0001",
    recipientName: "Siswa Satu",
    status: "issued",
  });
  await db.insert(schema.enrollments).values({
    userId: s1.id,
    courseId: c1.id,
    source: "free",
    status: "active",
  });

  const srv = app.listen(0);
  await once(srv, "listening");
  server = srv;
  const addr = srv.address() as AddressInfo;
  base = `http://127.0.0.1:${addr.port}`;
  adminToken = await login("admin@uji.io");
  studentToken = await login("siswa1@uji.io");
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
    await admin.query("DROP DATABASE aristoteles_test_b9");
  } finally {
    await admin.end();
  }
});

describe("GET /admin/overview", () => {
  it("401 tanpa token; 403 untuk peran student", async () => {
    assert.equal((await api("GET", "/api/v1/admin/overview")).http, 401);
    assert.equal((await api("GET", "/api/v1/admin/overview", studentToken)).http, 403);
  });

  it("200 hitungan peserta/instruktur/kursus/sertifikat", async () => {
    const { http, json } = await api<{
      totalStudents: number;
      totalTeachers: number;
      totalCourses: number;
      totalCertificates: number;
    }>("GET", "/api/v1/admin/overview", adminToken);
    assert.equal(http, 200);
    assert.equal(json.status, "success");
    assert.deepEqual(json.data, { totalStudents: 2, totalTeachers: 1, totalCourses: 2, totalCertificates: 1 });
  });
});

describe("GET /admin/users/:id", () => {
  it("401 tanpa token; 403 untuk peran student; 404 id tak valid", async () => {
    assert.equal((await api("GET", "/api/v1/admin/users/1")).http, 401);
    assert.equal((await api("GET", "/api/v1/admin/users/1", studentToken)).http, 403);
    assert.equal((await api("GET", "/api/v1/admin/users/abc", adminToken)).http, 404);
    assert.equal((await api("GET", "/api/v1/admin/users/999999", adminToken)).http, 404);
  });

  it("200 detail + hitungan kursus/sertifikat milik user", async () => {
    const list = await api<{ items: Array<{ id: number; email: string }> }>(
      "GET",
      "/api/v1/admin/users?role=student&limit=10",
      adminToken
    );
    assert.equal(list.http, 200);
    const target = list.json.data.items.find((u) => u.email === "siswa1@uji.io");
    assert.ok(target);
    const { http, json } = await api<{
      id: number;
      name: string;
      email: string;
      role: string;
      isActive: boolean;
      enrollmentCount: number;
      certificateCount: number;
    }>(`GET`, `/api/v1/admin/users/${target.id}`, adminToken);
    assert.equal(http, 200);
    assert.equal(json.status, "success");
    assert.equal(json.data.email, "siswa1@uji.io");
    assert.equal(json.data.enrollmentCount, 1);
    assert.equal(json.data.certificateCount, 1);
    assert.ok(!("passwordHash" in json.data));
  });
});
