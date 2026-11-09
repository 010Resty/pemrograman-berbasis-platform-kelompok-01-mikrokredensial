import "./test-env";
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
 * Undangan instruktur: buat → terbitkan ulang → terima.
 * Uji integrasi HTTP penuh melawan database tes TERPISAH
 * (`aristoteles_test_inv`), TIDAK PERNAH menyentuh database live.
 * Email berjalan mode `log` (tidak ada pengiriman asli).
 *
 * Jalankan dari folder backend/: npx tsx --test <file-ini>
 */

const TEST_PASSWORD = "Katasandi123";
const ADMIN_PASSWORD = "AdminKuat123";
const stamp = Date.now().toString(36);
const adminEmail = `admin-inv-${stamp}@uji.io`;
const inviteEmail = `calon-guru-${stamp}@uji.io`;
const inviteEmail2 = `calon-guru-2-${stamp}@uji.io`;

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
let inviteId = 0;
let token1 = "";
let token2 = "";

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
    await admin.query("CREATE DATABASE IF NOT EXISTS aristoteles_test_inv");
  } finally {
    await admin.end();
  }
  await migrate(db, { migrationsFolder: path.resolve("drizzle") });

  const hash = await bcrypt.hash(ADMIN_PASSWORD, 4);
  await db.insert(schema.users).values({
    name: "Admin Undangan",
    username: adminEmail.split("@")[0],
    email: adminEmail,
    passwordHash: hash,
    role: "admin",
    emailVerifiedAt: new Date(),
  });

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
});

describe("undangan: buat + terbitkan ulang + terima", () => {
  it("admin membuat undangan (email mode log tetap emailSent)", async () => {
    const { http, json } = await api<{
      id: number;
      token: string;
      inviteUrl: string;
      emailSent: boolean;
    }>("POST", "/api/v1/admin/invitations", adminToken, {
      email: inviteEmail,
      name: "Calon Guru",
    });
    assert.equal(http, 201);
    assert.equal(json.status, "success");
    assert.equal(json.data.token.length, 64);
    assert.ok(json.data.inviteUrl.includes("/invite/"));
    assert.equal(json.data.emailSent, true);
    inviteId = json.data.id;
    token1 = json.data.token;
  });

  it("terbitkan ulang: token baru, email terkirim", async () => {
    const { http, json } = await api<{
      id: number;
      token: string;
      inviteUrl: string;
      emailSent: boolean;
    }>("POST", `/api/v1/admin/invitations/${inviteId}/reissue`, adminToken);
    assert.equal(http, 200);
    assert.equal(json.status, "success");
    assert.notEqual(json.data.token, token1);
    assert.equal(json.data.emailSent, true);
    token2 = json.data.token;
  });

  it("token lama hangus (validate + accept 404)", async () => {
    const v = await api(
      "GET",
      `/api/v1/invitations/validate?token=${token1}`
    );
    assert.equal(v.http, 404);
    const a = await api("POST", "/api/v1/invitations/accept", undefined, {
      token: token1,
      password: TEST_PASSWORD,
    });
    assert.equal(a.http, 404);
  });

  it("token baru mengaktifkan akun teacher", async () => {
    const { http, json } = await api<{
      accessToken: string;
      user: { email: string; role: string };
    }>("POST", "/api/v1/invitations/accept", undefined, {
      token: token2,
      password: TEST_PASSWORD,
    });
    assert.equal(http, 201);
    assert.equal(json.data.user.role, "teacher");
    assert.equal(json.data.user.email, inviteEmail);
  });

  it("terbitkan ulang undangan terpakai ditolak final", async () => {
    const { http, json } = await api(
      "POST",
      `/api/v1/admin/invitations/${inviteId}/reissue`,
      adminToken
    );
    assert.equal(http, 409);
    assert.equal(json.code, "STATUS_FINAL");
  });

  it("terbitkan ulang undangan dibatalkan ditolak final", async () => {
    const created = await api<{ id: number; token: string }>(
      "POST",
      "/api/v1/admin/invitations",
      adminToken,
      { email: inviteEmail2, name: "Calon Kedua" }
    );
    assert.equal(created.http, 201);
    const revoked = await api(
      "POST",
      `/api/v1/admin/invitations/${created.json.data.id}/revoke`,
      adminToken,
      {}
    );
    assert.equal(revoked.http, 200);
    const { http, json } = await api(
      "POST",
      `/api/v1/admin/invitations/${created.json.data.id}/reissue`,
      adminToken
    );
    assert.equal(http, 409);
    assert.equal(json.code, "STATUS_FINAL");
  });
});
