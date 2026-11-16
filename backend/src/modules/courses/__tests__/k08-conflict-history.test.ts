import "./test-env-k08c";
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
 * K-08: optimistic concurrency + riwayat perubahan materi.
 * - PATCH dengan expectedUpdatedAt basi → 409 MATERIAL_CONFLICT.
 * - PATCH dengan expectedUpdatedAt segar + signifikansi/alasan → 200 + audit.
 * - GET /materials/:id/changes → riwayat resmi dari audit.
 * Database tes TERPISAH (aristoteles_test_k08c), bukan database live.
 */

const TEST_PASSWORD = "Katasandi123";

interface Envelope<T> {
  status: "success" | "error";
  message: string;
  code?: string;
  data: T;
}

let base = "";
let server: Server | null = null;
let adminToken = "";
let courseId = 0;
let materialId = 0;

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
    await admin.query("CREATE DATABASE IF NOT EXISTS aristoteles_test_k08c");
  } finally {
    await admin.end();
  }
  await migrate(db, { migrationsFolder: path.resolve("drizzle") });

  const hash = await bcrypt.hash(TEST_PASSWORD, 4);
  const [u] = await db.insert(schema.users).values({
    name: "Admin K08",
    username: "admink08",
    email: "admin-k08@uji.id",
    passwordHash: hash,
    role: "admin",
    emailVerifiedAt: new Date(),
  });
  void u;

  const [c] = await db.insert(schema.courses).values({
    title: "Kursus K08 Cukup Panjang",
    description: "Deskripsi kursus K08 yang cukup panjang untuk validasi.",
    category: "Bisnis",
    level: "Pemula",
    duration: "1 Bulan",
    status: "published",
    priceLabel: "Gratis",
    priceNominal: 0,
    period: "ongoing",
    outcomes: ["Hasil belajar pertama yang cukup panjang"],
    tools: ["Laptop"],
    createdBy: 1,
  });
  courseId = Number((c as unknown as { insertId: number }).insertId);

  const [m] = await db.insert(schema.modules).values({
    courseId,
    title: "Modul K08",
    type: "materi",
    position: 0,
  });
  const moduleId = Number((m as unknown as { insertId: number }).insertId);

  const [s] = await db.insert(schema.subModules).values({
    moduleId,
    title: "Sub K08",
    position: 0,
  });
  const subId = Number((s as unknown as { insertId: number }).insertId);

  const [mat] = await db.insert(schema.materials).values({
    moduleId,
    subModuleId: subId,
    title: "Materi K08 Awal",
    type: "materi",
    content: JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Halo" }] }] }),
    position: 0,
  });
  materialId = Number((mat as unknown as { insertId: number }).insertId);

  const srv = app.listen(0);
  await once(srv, "listening");
  server = srv;
  const addr = srv.address() as AddressInfo;
  base = `http://127.0.0.1:${addr.port}`;
  adminToken = await login("admin-k08@uji.id");
});

after(async () => {
  if (server) await new Promise<void>((r) => server!.close(() => r()));
  await pool.end();
  const admin = await mysql.createConnection({
    host: "localhost",
    port: 3306,
    user: "root",
    password: "",
  });
  try {
    await admin.query("DROP DATABASE aristoteles_test_k08c");
  } finally {
    await admin.end();
  }
});

describe("K-08: konflik tulis + riwayat perubahan materi", () => {
  it("PATCH tanpa expectedUpdatedAt tetap jalan (kompatibel lama)", async () => {
    const r = await api<{ title: string }>(
      "PATCH",
      `/api/v1/materials/${materialId}`,
      adminToken,
      { title: "Materi K08 Revisi 1" }
    );
    assert.equal(r.http, 200);
    assert.equal(r.json.data.title, "Materi K08 Revisi 1");
  });

  it("PATCH dengan cap basi ditolak 409 + info cap terbaru", async () => {
    const stale = new Date(Date.now() - 3600_000).toISOString();
    const r = await api<{ currentUpdatedAt: string }>(
      "PATCH",
      `/api/v1/materials/${materialId}`,
      adminToken,
      { title: "Materi K08 Tabrakan", expectedUpdatedAt: stale }
    );
    assert.equal(r.http, 409);
    assert.equal(r.json.code, "MATERIAL_CONFLICT");

    // Tulis dengan cap terbaru + signifikansi K-08 → sukses + tercatat.
    const fresh = await api<{ title: string; updatedAt: string }>(
      "GET",
      `/api/v1/materials/${materialId}`,
      adminToken
    );
    assert.equal(fresh.http, 200);
    const r2 = await api<{ title: string }>(
      "PATCH",
      `/api/v1/materials/${materialId}`,
      adminToken,
      {
        title: "Materi K08 Revisi 2",
        expectedUpdatedAt: (fresh.json.data as { updatedAt: string }).updatedAt,
        changeSignificance: "penting",
        changeReason: "Perbaiki judul modul uji",
      }
    );
    assert.equal(r2.http, 200);
    assert.equal(r2.json.data.title, "Materi K08 Revisi 2");
  });

  it("GET /materials/:id/changes memuat riwayat resmi dari audit", async () => {
    const r = await api<
      Array<{
        action: string;
        actorName: string | null;
        metadata: { significance?: string; reason?: string } | null;
      }>
    >("GET", `/api/v1/materials/${materialId}/changes?limit=10`, adminToken);
    assert.equal(r.http, 200);
    assert.ok(Array.isArray(r.json.data));
    assert.ok(r.json.data.length >= 2);
    const withMeta = r.json.data.find(
      (e) => e.metadata?.significance === "penting"
    );
    assert.ok(withMeta, "perubahan penting tercatat di audit");
    assert.equal(withMeta?.metadata?.reason, "Perbaiki judul modul uji");
  });

  it("siswa bukan pengampu ditolak 403 pada riwayat", async () => {
    const hash = await bcrypt.hash(TEST_PASSWORD, 4);
    await db.insert(schema.users).values({
      name: "Siswa Asing",
      username: "siswaasingk08",
      email: "siswa-k08@uji.id",
      passwordHash: hash,
      role: "student",
      emailVerifiedAt: new Date(),
    });
    const token = await login("siswa-k08@uji.id");
    const r = await api("GET", `/api/v1/materials/${materialId}/changes`, token);
    assert.equal(r.http, 403);
  });
});
