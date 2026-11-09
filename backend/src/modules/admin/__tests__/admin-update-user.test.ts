import "./test-env-update-user";
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
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
 * PATCH /api/v1/admin/users/:id — ubah nama/email/status.
 * Uji integrasi HTTP penuh melawan database tes TERPISAH
 * (`aristoteles_test_adm`), TIDAK PERNAH menyentuh database live.
 *
 * Jalankan dari folder backend/: npx tsx --test <file-ini>
 */

const ADMIN_PASSWORD = "AdminKuat123";
const stamp = Date.now().toString(36);
const adminEmail = `admin-ubah-${stamp}@uji.io`;
const teacherEmail = `guru-ubah-${stamp}@uji.io`;
const otherEmail = `guru-lain-${stamp}@uji.io`;

interface Envelope<T> {
  status: "success" | "error";
  message: string;
  code?: string;
  data: T;
  errors?: Array<{ field: string; message: string }> | null;
}

let base = "";
let server: Server | null = null;
let adminToken = "";
let teacherId = 0;
let adminId = 0;

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

before(async () => {
  const admin = await mysql.createConnection({
    host: "localhost",
    port: 3306,
    user: "root",
    password: "",
  });
  try {
    await admin.query("CREATE DATABASE IF NOT EXISTS aristoteles_test_adm");
  } finally {
    await admin.end();
  }
  await migrate(db, { migrationsFolder: path.resolve("drizzle") });

  const hash = await bcrypt.hash(ADMIN_PASSWORD, 4);
  const mkUser = async (name: string, email: string, role: "admin" | "teacher") => {
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
  adminId = await mkUser("Admin Ubah", adminEmail, "admin");
  teacherId = await mkUser("Guru Ubah", teacherEmail, "teacher");
  await mkUser("Guru Lain", otherEmail, "teacher");

  const srv = app.listen(0);
  server = srv;
  await new Promise<void>((r) => srv.once("listening", () => r()));
  const addr = srv.address() as AddressInfo;
  base = `http://127.0.0.1:${addr.port}`;

  const login = await api<{ accessToken: string }>(
    "POST",
    "/api/v1/auth/login",
    undefined,
    { email: adminEmail, password: ADMIN_PASSWORD }
  );
  assert.equal(login.http, 200);
  adminToken = login.json.data.accessToken;
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
    await admin.query("DROP DATABASE aristoteles_test_adm");
  } finally {
    await admin.end();
  }
});

describe("PATCH /admin/users/:id", () => {
  it("200 ubah nama; 404 id tak dikenal; body kosong 400", async () => {
    const ok = await api<{ name: string }>(
      "PATCH",
      `/api/v1/admin/users/${teacherId}`,
      adminToken,
      { name: "Guru Baru" }
    );
    assert.equal(ok.http, 200);
    assert.equal(ok.json.status, "success");
    assert.equal(ok.json.data.name, "Guru Baru");

    const missing = await api(
      "PATCH",
      "/api/v1/admin/users/999999",
      adminToken,
      { name: "Siapa" }
    );
    assert.equal(missing.http, 404);

    const empty = await api(
      "PATCH",
      `/api/v1/admin/users/${teacherId}`,
      adminToken,
      {}
    );
    assert.equal(empty.http, 400);
  });

  it("200 ganti email (lowercase); 409 bila dipakai akun lain", async () => {
    const freshEmail = `guru.baru-${stamp}@uji.io`;
    const ok = await api<{ email: string }>(
      "PATCH",
      `/api/v1/admin/users/${teacherId}`,
      adminToken,
      { email: freshEmail.toUpperCase() }
    );
    assert.equal(ok.http, 200);
    assert.equal(ok.json.data.email, freshEmail);

    const dup = await api(
      "PATCH",
      `/api/v1/admin/users/${teacherId}`,
      adminToken,
      { email: otherEmail }
    );
    assert.equal(dup.http, 409);
    assert.equal(dup.json.code, "EMAIL_TAKEN");
  });

  it("expertise: isi lalu hapus kembali null", async () => {
    const set = await api<{ expertise: string | null }>(
      "PATCH",
      `/api/v1/admin/users/${teacherId}`,
      adminToken,
      { expertise: "Sains Data & AI" }
    );
    assert.equal(set.http, 200);
    assert.equal(set.json.data.expertise, "Sains Data & AI");

    const clear = await api<{ expertise: string | null }>(
      "PATCH",
      `/api/v1/admin/users/${teacherId}`,
      adminToken,
      { expertise: "" }
    );
    assert.equal(clear.http, 200);
    assert.equal(clear.json.data.expertise, null);
  });

  it("status: 400 bila target diri sendiri; 200 untuk akun lain", async () => {
    const self = await api(
      "PATCH",
      `/api/v1/admin/users/${adminId}`,
      adminToken,
      { isActive: false }
    );
    assert.equal(self.http, 400);

    const off = await api<{ isActive: boolean }>(
      "PATCH",
      `/api/v1/admin/users/${teacherId}`,
      adminToken,
      { isActive: false }
    );
    assert.equal(off.http, 200);
    assert.equal(off.json.data.isActive, false);

    const on = await api<{ isActive: boolean }>(
      "PATCH",
      `/api/v1/admin/users/${teacherId}`,
      adminToken,
      { isActive: true }
    );
    assert.equal(on.http, 200);
    assert.equal(on.json.data.isActive, true);
  });

  it("nama sendiri boleh diubah; 403 untuk non-admin", async () => {
    const selfName = await api<{ name: string }>(
      "PATCH",
      `/api/v1/admin/users/${adminId}`,
      adminToken,
      { name: "Admin Baru" }
    );
    assert.equal(selfName.http, 200);
    assert.equal(selfName.json.data.name, "Admin Baru");

    const teacherLogin = await api<{ accessToken: string }>(
      "POST",
      "/api/v1/auth/login",
      undefined,
      { email: `guru.baru-${stamp}@uji.io`, password: ADMIN_PASSWORD }
    );
    assert.equal(teacherLogin.http, 200);
    const forbidden = await api(
      "PATCH",
      `/api/v1/admin/users/${teacherId}`,
      teacherLogin.json.data.accessToken,
      { name: "Coba" }
    );
    assert.equal(forbidden.http, 403);
  });
});
