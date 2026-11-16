import "./test-env-seen";
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
 * Tandai-baca keputusan pembayaran oleh peserta (bell tidak menumpuk).
 * Uji integrasi HTTP penuh melawan database tes TERPISAH
 * (`aristoteles_test_pay_seen`), TIDAK PERNAH menyentuh database live.
 *
 * Dijalankan langsung: `npx tsx --test <file-ini>` dari folder backend/.
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
const tokens: Record<string, string> = {};
const ids: Record<string, number> = {};

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

before(async () => {
  const admin = await mysql.createConnection({
    host: "localhost",
    port: 3306,
    user: "root",
    password: "",
  });
  try {
    await admin.query("CREATE DATABASE IF NOT EXISTS aristoteles_test_pay_seen");
  } finally {
    await admin.end();
  }
  await migrate(db, { migrationsFolder: path.resolve("drizzle") });

  const hash = await bcrypt.hash(TEST_PASSWORD, 4);
  const mkUser = async (name: string, email: string, role: "admin" | "student") => {
    const [h] = await db.insert(schema.users).values({ name, username: email.split("@")[0] + "-seen", email, passwordHash: hash, role, emailVerifiedAt: new Date() });
    return Number((h as unknown as { insertId: number }).insertId);
  };
  ids.admin = await mkUser("Admin Lihat", "admin-lihat@uji.io", "admin");
  ids.s1 = await mkUser("Siswa Lihat", "siswa-lihat@uji.io", "student");

  const [c] = await db.insert(schema.courses).values({
    title: "Kursus Lihat Keputusan Cukup Panjang",
    description: "Deskripsi kursus lihat keputusan yang cukup panjang untuk validasi.",
    category: "Bisnis",
    level: "Pemula",
    duration: "4 Bulan",
    status: "published",
    priceLabel: "Rp120000",
    priceNominal: 120000,
    period: "ongoing",
    outcomes: ["Hasil belajar pertama yang cukup panjang"],
    tools: ["Laptop"],
    createdBy: ids.admin,
  });
  ids.paid = Number((c as unknown as { insertId: number }).insertId);

  const srv = app.listen(0);
  await once(srv, "listening");
  server = srv;
  const addr = srv.address() as AddressInfo;
  base = `http://127.0.0.1:${addr.port}`;
  tokens.admin = await login("admin-lihat@uji.io");
  tokens.s1 = await login("siswa-lihat@uji.io");
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
    await admin.query("DROP DATABASE aristoteles_test_pay_seen");
  } finally {
    await admin.end();
  }
});

describe("bell peserta: keputusan pembayaran yang belum dibaca", () => {
  it("menunggu tidak masuk unseen; ditolak masuk unseen lalu hilang setelah dibaca", async () => {
    const created = await api<{ id: number; status: string }>(
      "POST",
      `/api/v1/courses/${ids.paid}/payments`,
      tokens.s1,
      {}
    );
    assert.equal(created.http, 201);

    const whilePending = await api<{ items: unknown[]; total: number }>(
      "GET",
      "/api/v1/me/payments?status=ditolak&unseen=1",
      tokens.s1
    );
    assert.equal(whilePending.http, 200);
    assert.equal(whilePending.json.data.total, 0, "menunggu bukan keputusan");

    const pid = created.json.data.id;
    const reject = await api("POST", `/api/v1/admin/payments/${pid}/verify`, tokens.admin, {
      decision: "tolak",
      reason: "Bukti tidak terbaca, mohon unggah ulang.",
    });
    assert.equal(reject.http, 200, JSON.stringify(reject.json));

    const unseen = await api<{ items: Array<{ studentSeenAt: string | null }>; total: number }>(
      "GET",
      "/api/v1/me/payments?status=ditolak&unseen=1",
      tokens.s1
    );
    assert.equal(unseen.http, 200);
    assert.equal(unseen.json.data.total, 1);
    assert.equal(unseen.json.data.items[0].studentSeenAt, null);

    const seen = await api<{ seen: number }>("POST", "/api/v1/me/payments/seen", tokens.s1, {
      courseId: ids.paid,
    });
    assert.equal(seen.http, 200, JSON.stringify(seen.json));
    assert.equal(seen.json.data.seen, 1);

    const after = await api<{ total: number }>(
      "GET",
      "/api/v1/me/payments?status=ditolak&unseen=1",
      tokens.s1
    );
    assert.equal(after.http, 200);
    assert.equal(after.json.data.total, 0, "sudah dibaca harus hilang dari bell");

    const repeat = await api<{ seen: number }>("POST", "/api/v1/me/payments/seen", tokens.s1, {});
    assert.equal(repeat.http, 200);
    assert.equal(repeat.json.data.seen, 0);

    const bad = await api("POST", "/api/v1/me/payments/seen", tokens.s1, { courseId: -3 });
    assert.equal(bad.http, 400);
  });
});
