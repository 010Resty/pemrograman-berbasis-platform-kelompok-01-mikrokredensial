import "./test-env-refresh";
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import path from "node:path";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";
import { migrate } from "drizzle-orm/mysql2/migrator";
import { eq, sql } from "drizzle-orm";
import { db, pool } from "../../../db/index";
import * as schema from "../../../db/schema";
import app from "../../../app";

/**
 * Sesi refresh untuk klien mobile (Tahap 0 multi-platform).
 * Uji integrasi HTTP penuh melawan database tes TERPISAH
 * (`aristoteles_test_auth`): login menerbitkan refresh token,
 * rotasi sekali pakai, deteksi pakai-ulang mencabut semua sesi,
 * kedaluwarsa/acak ditolak, logout mencabut sebagian/seluruh.
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
let userId = 0;

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

interface LoginData {
  accessToken: string;
  refreshToken: string;
  user: { id: number; email: string; role: string };
}

interface RefreshData {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: string;
  user: { id: number; email: string; role: string };
}

async function login(): Promise<LoginData> {
  const { http, json } = await api<LoginData>("POST", "/api/v1/auth/login", undefined, {
    email: "siswa-refresh@uji.io",
    password: TEST_PASSWORD,
  });
  assert.equal(http, 200);
  assert.equal(json.status, "success");
  assert.match(json.data.refreshToken, /^[0-9a-f]{64}$/);
  return json.data;
}

before(async () => {
  const admin = await mysql.createConnection({
    host: "localhost",
    port: 3306,
    user: "root",
    password: "",
  });
  try {
    await admin.query("CREATE DATABASE IF NOT EXISTS aristoteles_test_auth");
  } finally {
    await admin.end();
  }
  await migrate(db, { migrationsFolder: path.resolve("drizzle") });

  const hash = await bcrypt.hash(TEST_PASSWORD, 4);
  const [h] = await db.insert(schema.users).values({
    name: "Siswa Refresh",
    username: "siswa-refresh-t",
    email: "siswa-refresh@uji.io",
    passwordHash: hash,
    role: "student",
    emailVerifiedAt: new Date(),
  });
  userId = Number((h as unknown as { insertId: number }).insertId);

  const srv = app.listen(0);
  await once(srv, "listening");
  server = srv;
  const addr = srv.address() as AddressInfo;
  base = `http://127.0.0.1:${addr.port}`;
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
    await admin.query("DROP DATABASE aristoteles_test_auth");
  } finally {
    await admin.end();
  }
});

describe("refresh token (rotasi sekali pakai)", () => {
  it("login menerbitkan refresh token; refresh memutar pasangan baru", async () => {
    const first = await login();
    const r = await api<RefreshData>("POST", "/api/v1/auth/refresh", undefined, {
      refreshToken: first.refreshToken,
    });
    assert.equal(r.http, 200);
    assert.equal(r.json.status, "success");
    assert.notEqual(r.json.data.refreshToken, first.refreshToken);
    assert.ok(r.json.data.accessToken.length > 20);

    // Access token baru berlaku untuk endpoint privat.
    const me = await api<{ user: { id: number } }>(
      "GET",
      "/api/v1/auth/me",
      r.json.data.accessToken
    );
    assert.equal(me.http, 200);
    assert.equal(me.json.data.user.id, userId);

    // Token lama sudah dicabut: pakai lagi = 401.
    const reuse = await api("POST", "/api/v1/auth/refresh", undefined, {
      refreshToken: first.refreshToken,
    });
    assert.equal(reuse.http, 401);
  });

  it("pakai ulang token basi mencabut seluruh sesi (deteksi pencurian)", async () => {
    const first = await login();
    const r = await api<RefreshData>("POST", "/api/v1/auth/refresh", undefined, {
      refreshToken: first.refreshToken,
    });
    assert.equal(r.http, 200);
    const fresh = r.json.data.refreshToken;

    // Token lama dipakai lagi → 401 + seluruh sesi ikut dicabut.
    const reuse = await api("POST", "/api/v1/auth/refresh", undefined, {
      refreshToken: first.refreshToken,
    });
    assert.equal(reuse.http, 401);

    // Token hasil rotasi yang tadinya valid ikut mati.
    const after = await api("POST", "/api/v1/auth/refresh", undefined, {
      refreshToken: fresh,
    });
    assert.equal(after.http, 401);
  });

  it("token acak dan kedaluwarsa ditolak 401", async () => {
    const garbage = await api("POST", "/api/v1/auth/refresh", undefined, {
      refreshToken: "0".repeat(64),
    });
    assert.equal(garbage.http, 401);

    const first = await login();
    await db.execute(
      sql`UPDATE refresh_tokens SET expires_at = DATE_SUB(NOW(), INTERVAL 1 DAY) WHERE user_id = ${userId} AND revoked_at IS NULL`
    );
    const expired = await api("POST", "/api/v1/auth/refresh", undefined, {
      refreshToken: first.refreshToken,
    });
    assert.equal(expired.http, 401);
  });

  it("logout mencabut satu sesi atau seluruh sesi", async () => {
    const a = await login();
    const b = await login();

    // Cabut satu sesi: sesi lain tetap hidup.
    const one = await api("POST", "/api/v1/auth/logout", a.accessToken, {
      refreshToken: a.refreshToken,
    });
    assert.equal(one.http, 200);
    const aliveB = await api<RefreshData>("POST", "/api/v1/auth/refresh", undefined, {
      refreshToken: b.refreshToken,
    });
    assert.equal(aliveB.http, 200);

    // Token lama dipakai lagi = pakai ulang → 401 + seluruh sesi ikut dicabut.
    const deadA = await api("POST", "/api/v1/auth/refresh", undefined, {
      refreshToken: a.refreshToken,
    });
    assert.equal(deadA.http, 401);
    const deadB = await api("POST", "/api/v1/auth/refresh", undefined, {
      refreshToken: aliveB.json.data.refreshToken,
    });
    assert.equal(deadB.http, 401);

    // Tanpa token = cabut semua sesi milik sendiri.
    const c = await login();
    const d = await login();
    const all = await api("POST", "/api/v1/auth/logout", c.accessToken, {});
    assert.equal(all.http, 200);
    const deadC = await api("POST", "/api/v1/auth/refresh", undefined, {
      refreshToken: c.refreshToken,
    });
    assert.equal(deadC.http, 401);
    const deadD = await api("POST", "/api/v1/auth/refresh", undefined, {
      refreshToken: d.refreshToken,
    });
    assert.equal(deadD.http, 401);
  });

  it("akun dinonaktifkan tidak bisa refresh", async () => {
    const first = await login();
    await db
      .update(schema.users)
      .set({ isActive: false })
      .where(eq(schema.users.id, userId));
    const r = await api("POST", "/api/v1/auth/refresh", undefined, {
      refreshToken: first.refreshToken,
    });
    assert.equal(r.http, 401);
    await db
      .update(schema.users)
      .set({ isActive: true })
      .where(eq(schema.users.id, userId));
  });
});
