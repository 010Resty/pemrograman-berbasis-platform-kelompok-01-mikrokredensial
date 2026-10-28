import "./summary-test-env";
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
 * Ringkasan "Progres Keseluruhan" dasbor user (GET /me/progress/summary).
 * Uji integrasi HTTP penuh melawan database tes TERPISAH
 * (`aristoteles_test_b8`), TIDAK PERNAH menyentuh database live.
 * Mencakup: 401 tanpa token, ringkasan kosong, persen desimal
 * (Σ selesai / Σ materi × 100, satu desimal), rincian per kursus,
 * dan isolasi antar-peserta.
 *
 * Data sengaja meniru contoh dasbor: 9/12 + 10/10 + 4/8 + 0/6 = 23/36 → 63.9.
 *
 * Jalankan dari folder backend/: npx tsx --test <file-ini>
 */

const TEST_PASSWORD = "Katasandi123";

interface Envelope<T> {
  status: "success" | "error";
  message: string;
  data: T;
}

interface Summary {
  totalCourses: number;
  totalMaterials: number;
  completedMaterials: number;
  percent: number;
  perCourse: Array<{
    courseId: number;
    courseTitle: string;
    totalMaterials: number;
    completedMaterials: number;
    percent: number;
  }>;
}

let base = "";
let server: Server | null = null;
let s1Token = "";
let s2Token = "";
let courseIds: number[] = [];

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

before(async () => {
  const admin = await mysql.createConnection({
    host: "localhost",
    port: 3306,
    user: "root",
    password: "",
  });
  try {
    await admin.query("CREATE DATABASE IF NOT EXISTS aristoteles_test_b8");
  } finally {
    await admin.end();
  }
  await migrate(db, { migrationsFolder: path.resolve("drizzle") });

  const hash = await bcrypt.hash(TEST_PASSWORD, 4);
  const mkUser = async (name: string, email: string) => {
    const [h] = await db.insert(schema.users).values({
      name,
      email,
      passwordHash: hash,
      role: "student",
    });
    return Number((h as unknown as { insertId: number }).insertId);
  };
  const s1 = await mkUser("Siswa Satu", "siswa1@uji.io");
  const s2 = await mkUser("Siswa Dua", "siswa2@uji.io");

  // 4 kursus published: 12 / 10 / 8 / 6 materi (cermin contoh dasbor user).
  const matCounts = [12, 10, 8, 6];
  for (let c = 0; c < 4; c++) {
    const [cH] = await db.insert(schema.courses).values({
      title: `Kursus Uji ${c + 1} Cukup Panjang`,
      description: "Deskripsi kursus uji ringkasan progres yang cukup panjang.",
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
    const courseId = Number((cH as unknown as { insertId: number }).insertId);
    courseIds.push(courseId);
    const [mH] = await db.insert(schema.modules).values({
      courseId,
      title: `Modul Uji ${c + 1} Cukup Panjang`,
      type: "materi",
      position: 0,
    });
    const moduleId = Number((mH as unknown as { insertId: number }).insertId);
    for (let m = 0; m < matCounts[c]; m++) {
      const [tH] = await db.insert(schema.materials).values({
        moduleId,
        title: `Materi ${m + 1} Kursus ${c + 1} Cukup Panjang`,
        type: "materi",
        position: m,
      });
      const matId = Number((tH as unknown as { insertId: number }).insertId);
      // s1: 9/12 + 10/10 + 4/8 + 0/6 = 23/36 → 63.9.
      const doneCounts = [9, 10, 4, 0];
      if (m < doneCounts[c]) {
        await db.insert(schema.progress).values({ userId: s1, materialId: matId });
      }
    }
    await db.insert(schema.enrollments).values({
      userId: s1,
      courseId,
      source: "free",
      status: "active",
    });
  }
  // s2 hanya ikut kursus pertama, tanpa progres apa pun.
  await db.insert(schema.enrollments).values({
    userId: s2,
    courseId: courseIds[0],
    source: "free",
    status: "active",
  });

  const srv = app.listen(0);
  await once(srv, "listening");
  server = srv;
  const addr = srv.address() as AddressInfo;
  base = `http://127.0.0.1:${addr.port}`;

  for (const [email, set] of [
    ["siswa1@uji.io", (t: string) => (s1Token = t)],
    ["siswa2@uji.io", (t: string) => (s2Token = t)],
  ] as const) {
    const login = await fetch(base + "/api/v1/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ email, password: TEST_PASSWORD }),
    });
    const json = (await login.json()) as Envelope<{ accessToken: string }>;
    assert.equal(login.status, 200);
    set(json.data.accessToken);
  }
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
    await admin.query("DROP DATABASE aristoteles_test_b8");
  } finally {
    await admin.end();
  }
});

describe("GET /me/progress/summary", () => {
  it("401 tanpa token", async () => {
    const r = await api("GET", "/api/v1/me/progress/summary");
    assert.equal(r.http, 401);
  });

  it("persen desimal 63.9 + rincian per kursus untuk s1", async () => {
    const r = await api<Summary>("GET", "/api/v1/me/progress/summary", s1Token);
    assert.equal(r.http, 200);
    assert.equal(r.json.status, "success");
    const d = r.json.data;
    assert.equal(d.totalCourses, 4);
    assert.equal(d.totalMaterials, 36);
    assert.equal(d.completedMaterials, 23);
    assert.equal(d.percent, 63.9);
    assert.deepEqual(
      d.perCourse.map((c) => c.percent),
      [75.0, 100.0, 50.0, 0.0]
    );
    assert.deepEqual(
      d.perCourse.map((c) => [c.completedMaterials, c.totalMaterials]),
      [
        [9, 12],
        [10, 10],
        [4, 8],
        [0, 6],
      ]
    );
  });

  it("isolasi: s2 hanya melihat kursusnya sendiri", async () => {
    const r = await api<Summary>("GET", "/api/v1/me/progress/summary", s2Token);
    assert.equal(r.http, 200);
    const d = r.json.data;
    assert.equal(d.totalCourses, 1);
    assert.equal(d.totalMaterials, 12);
    assert.equal(d.completedMaterials, 0);
    assert.equal(d.percent, 0);
  });
});
