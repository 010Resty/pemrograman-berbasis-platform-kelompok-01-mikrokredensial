import "./test-env-categories";
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { once } from "node:events";
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/mysql2/migrator";
import { db, pool } from "../../../db/index";
import * as schema from "../../../db/schema";
import app from "../../../app";

/**
 * Kategori kursus kelola-admin.
 * Uji integrasi HTTP penuh melawan database tes TERPISAH
 * (`aristoteles_test_categories`), TIDAK PERNAH menyentuh database live.
 *
 * - Publik: GET /categories hanya aktif (tanpa login).
 * - Admin: CRUD penuh + audit; non-admin ditolak.
 * - Kursus: create/patch menolak kategori asing & nonaktif (INVALID_CATEGORY);
 *   ganti nama ikut mengubah kursus pemakai.
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
const tokens: Record<string, string> = {};
let newCategoryId = 0;

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
  assert.equal(http, 200, `login ${email}: ${JSON.stringify(json)}`);
  return json.data.accessToken;
}

const validCourse = (category: string) => ({
  title: "Kursus Uji Kategori Cukup Panjang",
  description: "Deskripsi kursus uji kategori yang cukup panjang untuk validasi.",
  category,
  durationMonths: 4,
  startMonth: "September 2026",
  priceNominal: 0,
  outcomes: ["Hasil belajar pertama yang cukup panjang", "Hasil belajar kedua yang cukup panjang"],
  tools: ["Laptop"],
});

before(async () => {
  const admin = await mysql.createConnection({
    host: "localhost",
    port: 3306,
    user: "root",
    password: "",
  });
  try {
    await admin.query("CREATE DATABASE IF NOT EXISTS aristoteles_test_categories");
  } finally {
    await admin.end();
  }
  await migrate(db, { migrationsFolder: path.resolve("drizzle") });

  const hash = await bcrypt.hash(TEST_PASSWORD, 4);
  const mkUser = async (name: string, email: string, role: "admin" | "teacher" | "student") => {
    const [h] = await db.insert(schema.users).values({
      name,
      username: email.split("@")[0] + "-t",
      email,
      passwordHash: hash,
      role,
      emailVerifiedAt: new Date(),
    });
    return Number((h as unknown as { insertId: number }).insertId);
  };
  await mkUser("Admin Kategori", "admin@kategori.io", "admin");
  await mkUser("Guru Kategori", "guru@kategori.io", "teacher");

  const srv = app.listen(0);
  await once(srv, "listening");
  server = srv;
  const addr = srv.address() as AddressInfo;
  base = `http://127.0.0.1:${addr.port}`;
  tokens.admin = await login("admin@kategori.io");
  tokens.teacher = await login("guru@kategori.io");
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
    await admin.query("DROP DATABASE aristoteles_test_categories");
  } finally {
    await admin.end();
  }
});

describe("publik: GET /categories", () => {
  it("tanpa token 200 + 8 bawaan + tanpa flag nonaktif", async () => {
    const r = await api<Array<{ slug: string; name: string; isActive?: boolean }>>(
      "GET",
      "/api/v1/categories"
    );
    assert.equal(r.http, 200);
    assert.equal(r.json.data.length, 8);
    const names = r.json.data.map((c) => c.name);
    assert.ok(names.includes("Pengembangan Web"));
    assert.ok(names.includes("Bisnis"));
    for (const c of r.json.data) assert.equal(c.isActive, undefined);
  });
});

describe("admin: CRUD kategori", () => {
  it("tanpa token 401, teacher 403", async () => {
    assert.equal((await api("GET", "/api/v1/admin/categories")).http, 401);
    assert.equal((await api("GET", "/api/v1/admin/categories", tokens.teacher)).http, 403);
    assert.equal(
      (await api("POST", "/api/v1/admin/categories", tokens.teacher, { name: "X" })).http,
      403
    );
  });

  it("buat + duplikat 409 + validasi 400", async () => {
    const created = await api<{ id: number; slug: string; name: string }>(
      "POST",
      "/api/v1/admin/categories",
      tokens.admin,
      { name: "Fotografi" }
    );
    assert.equal(created.http, 201);
    assert.equal(created.json.data.slug, "fotografi");
    newCategoryId = created.json.data.id;

    const dup = await api("POST", "/api/v1/admin/categories", tokens.admin, {
      name: "Fotografi",
    });
    assert.equal(dup.http, 409);
    assert.equal(dup.json.code, "CATEGORY_TAKEN");

    const bad = await api("POST", "/api/v1/admin/categories", tokens.admin, { name: "A" });
    assert.equal(bad.http, 400);
  });

  it("daftar admin memuat courseCount + detail satu kategori", async () => {
    const r = await api<Array<{ name: string; courseCount: number }>>(
      "GET",
      "/api/v1/admin/categories",
      tokens.admin
    );
    assert.equal(r.http, 200);
    const foto = r.json.data.find((c) => c.name === "Fotografi");
    assert.ok(foto);
    assert.equal(foto.courseCount, 0);

    const one = await api<{ id: number; name: string; courseCount: number }>(
      "GET",
      `/api/v1/admin/categories/${newCategoryId}`,
      tokens.admin
    );
    assert.equal(one.http, 200);
    assert.equal(one.json.data.name, "Fotografi");

    const missing = await api(
      "GET",
      "/api/v1/admin/categories/999999",
      tokens.admin
    );
    assert.equal(missing.http, 404);
    assert.equal(missing.json.code, "CATEGORY_NOT_FOUND");
  });
});

describe("kursus: validasi kategori DB", () => {
  it("kursus baru boleh pakai kategori admin + tolak asing 400", async () => {
    const ok = await api("POST", "/api/v1/courses", tokens.teacher, validCourse("Fotografi"));
    assert.equal(ok.http, 201, JSON.stringify(ok.json));

    const bad = await api("POST", "/api/v1/courses", tokens.teacher, validCourse("Astrologi"));
    assert.equal(bad.http, 400);
    assert.equal(bad.json.code, "INVALID_CATEGORY");
  });

  it("nonaktifkan → kursus baru ditolak, daftar publik hilang", async () => {
    const off = await api("PATCH", `/api/v1/admin/categories/${newCategoryId}`, tokens.admin, {
      isActive: false,
    });
    assert.equal(off.http, 200);
    assert.equal((off.json.data as { isActive: boolean }).isActive, false);

    const rejected = await api(
      "POST",
      "/api/v1/courses",
      tokens.teacher,
      validCourse("Fotografi")
    );
    assert.equal(rejected.http, 400);
    assert.equal(rejected.json.code, "INVALID_CATEGORY");

    const pub = await api<Array<{ name: string }>>("GET", "/api/v1/categories");
    assert.ok(!pub.json.data.some((c) => c.name === "Fotografi"));
  });

  it("hapus kategori dipakai kursus 409; ganti nama ikut mengubah kursus", async () => {
    const del = await api(
      "DELETE",
      `/api/v1/admin/categories/${newCategoryId}`,
      tokens.admin
    );
    assert.equal(del.http, 409);
    assert.equal(del.json.code, "CATEGORY_IN_USE");

    // Aktifkan lagi lalu ganti nama → kursus pemakai ikut berubah.
    await api("PATCH", `/api/v1/admin/categories/${newCategoryId}`, tokens.admin, {
      isActive: true,
    });
    const renamed = await api<{ name: string }>(
      "PATCH",
      `/api/v1/admin/categories/${newCategoryId}`,
      tokens.admin,
      { name: "Fotografi Digital" }
    );
    assert.equal(renamed.http, 200);
    assert.equal(renamed.json.data.name, "Fotografi Digital");

    const rows = await db
      .select({ category: schema.courses.category })
      .from(schema.courses)
      .where(eq(schema.courses.category, "Fotografi Digital"));
    assert.ok(rows.length > 0);
  });

  it("hapus kategori tak dipakai 200 + id asing 404", async () => {
    const made = await api<{ id: number }>(
      "POST",
      "/api/v1/admin/categories",
      tokens.admin,
      { name: "Kategori Sementara" }
    );
    assert.equal(made.http, 201);
    const gone = await api(
      "DELETE",
      `/api/v1/admin/categories/${made.json.data.id}`,
      tokens.admin
    );
    assert.equal(gone.http, 200);

    const missing = await api(
      "DELETE",
      "/api/v1/admin/categories/999999",
      tokens.admin
    );
    assert.equal(missing.http, 404);
    assert.equal(missing.json.code, "CATEGORY_NOT_FOUND");
  });
});
