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
 * Bagi hasil instruktur + penarikan.
 * Uji integrasi HTTP penuh melawan database tes TERPISAH
 * (`aristoteles_test_rev`). Mencakup: settings default 70/100rb,
 * snapshot hak saat verifikasi manual, earnings per kursus,
 * pengajuan di bawah minimal ditolak, pengajuan valid mengunci saldo
 * (double-spend ditolak), perubahan persen tidak mengubah snapshot lama,
 * alur admin setujui → tandai-ditransfer, transisi ilegal 409,
 * peran student ditolak 403.
 *
 * Dijalankan via `npm test` bila berkas ini didaftarkan di package.json,
 * atau langsung: `npx tsx --test src/modules/revenues/__tests__/revenues.test.ts`
 * dari folder backend/.
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
let tokens: Record<string, string> = {};
let ids: Record<string, number> = {};

interface Earnings {
  totalEarned: number;
  available: number;
  pending: number;
  paid: number;
  percent: number;
  minWithdrawal: number;
  courses: Array<{ courseId: number; title: string; earned: number; payments: number }>;
}

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
  const admin = await mysql.createConnection({ host: "localhost", port: 3306, user: "root", password: "" });
  try {
    await admin.query("CREATE DATABASE IF NOT EXISTS aristoteles_test_rev");
  } finally {
    await admin.end();
  }
  await migrate(db, { migrationsFolder: path.resolve("drizzle") });

  const hash = await bcrypt.hash(TEST_PASSWORD, 4);
  const mkUser = async (name: string, email: string, role: "admin" | "teacher" | "student") => {
    const [h] = await db.insert(schema.users).values({
      name,
      username: email.split("@")[0] + "-rv",
      email,
      passwordHash: hash,
      role,
      emailVerifiedAt: new Date(),
    });
    return Number((h as unknown as { insertId: number }).insertId);
  };
  ids.admin = await mkUser("Admin Bagi", "admin-bagi@uji.io", "admin");
  ids.t1 = await mkUser("Guru Bagi", "guru-bagi@uji.io", "teacher");
  ids.s1 = await mkUser("Siswa Bagi", "siswa-bagi@uji.io", "student");
  ids.s2 = await mkUser("Siswa Bagi Dua", "siswa-bagi2@uji.io", "student");

  const [c] = await db.insert(schema.courses).values({
    title: "Kursus Berbayar Bagi Hasil",
    description: "Deskripsi kursus berbayar untuk uji bagi hasil yang cukup panjang.",
    category: "Bisnis",
    level: "Pemula",
    duration: "4 Bulan",
    status: "published",
    priceLabel: "Rp200000",
    priceNominal: 200000,
    period: "ongoing",
    outcomes: ["Hasil belajar pertama yang cukup panjang"],
    tools: ["Laptop"],
    createdBy: ids.t1,
  });
  ids.course = Number((c as unknown as { insertId: number }).insertId);

  const srv = app.listen(0);
  await once(srv, "listening");
  server = srv;
  const addr = srv.address() as AddressInfo;
  base = `http://127.0.0.1:${addr.port}`;
  tokens = {
    admin: await login("admin-bagi@uji.io"),
    t1: await login("guru-bagi@uji.io"),
    s1: await login("siswa-bagi@uji.io"),
    s2: await login("siswa-bagi2@uji.io"),
  };
});

after(async () => {
  if (server) await new Promise<void>((r) => server!.close(() => r()));
  await pool.end();
  const admin = await mysql.createConnection({ host: "localhost", port: 3306, user: "root", password: "" });
  try {
    await admin.query("DROP DATABASE aristoteles_test_rev");
  } finally {
    await admin.end();
  }
});

async function createAndVerify(amountPaid: number, studentToken?: string): Promise<number> {
  const token = studentToken ?? tokens.s1;
  const c = await api<{ id: number }>("POST", `/api/v1/courses/${ids.course}/payments`, token, {});
  assert.equal(c.http, 201);
  const pid = c.json.data.id;
  const v = await api<{ id: number; status: string }>(
    "POST",
    `/api/v1/admin/payments/${pid}/verify`,
    tokens.admin,
    { decision: "terima", amountPaid }
  );
  assert.equal(v.http, 200);
  assert.equal(v.json.data.status, "diverifikasi");
  return pid;
}

describe("bagi hasil instruktur + penarikan", () => {
  it("settings default 70 persen / minimal 100rb", async () => {
    const r = await api<{ instructorPercent: number; minWithdrawal: number }>(
      "GET",
      "/api/v1/admin/revenue-settings",
      tokens.admin
    );
    assert.equal(r.http, 200);
    assert.equal(r.json.data.instructorPercent, 70);
    assert.equal(r.json.data.minWithdrawal, 100000);
  });

  it("snapshot hak 70% saat verifikasi + earnings per kursus", async () => {
    await createAndVerify(200000);
    const r = await api<Earnings>("GET", "/api/v1/me/earnings", tokens.t1);
    assert.equal(r.http, 200);
    assert.equal(r.json.data.totalEarned, 140000);
    assert.equal(r.json.data.available, 140000);
    assert.equal(r.json.data.percent, 70);
    assert.equal(r.json.data.courses.length, 1);
    assert.equal(r.json.data.courses[0].earned, 140000);
  });

  it("student dilarang akses earnings (403)", async () => {
    const r = await api<Earnings>("GET", "/api/v1/me/earnings", tokens.s1);
    assert.equal(r.http, 403);
  });

  it("pengajuan di bawah minimal ditolak", async () => {
    const r = await api<{ id: number }>(
      "POST",
      "/api/v1/me/payouts",
      tokens.t1,
      { amount: 50000, bankName: "BCA", accountNumber: "1234567890", accountName: "Guru Bagi" }
    );
    assert.equal(r.http, 400);
    assert.equal(r.json.code, "PAYOUT_BELOW_MINIMUM");
  });

  it("pengajuan valid mengunci saldo; double-spend ditolak", async () => {
    const ok = await api<{ id: number; available: number }>(
      "POST",
      "/api/v1/me/payouts",
      tokens.t1,
      { amount: 100000, bankName: "BCA", accountNumber: "1234567890", accountName: "Guru Bagi" }
    );
    assert.equal(ok.http, 201);
    ids.wd1 = ok.json.data.id;
    const again = await api<{ id: number }>(
      "POST",
      "/api/v1/me/payouts",
      tokens.t1,
      { amount: 100000, bankName: "BCA", accountNumber: "1234567890", accountName: "Guru Bagi" }
    );
    assert.equal(again.http, 400);
    assert.equal(again.json.code, "PAYOUT_INSUFFICIENT");
    const e = await api<Earnings>("GET", "/api/v1/me/earnings", tokens.t1);
    assert.equal(e.json.data.available, 40000);
    assert.equal(e.json.data.pending, 100000);
  });

  it("norek tidak valid ditolak 400", async () => {
    const r = await api<{ id: number }>(
      "POST",
      "/api/v1/me/payouts",
      tokens.t1,
      { amount: 100000, bankName: "BCA", accountNumber: "ABC", accountName: "Guru Bagi" }
    );
    assert.equal(r.http, 400);
  });

  it("admin setujui lalu tandai-ditransfer; transisi ilegal 409", async () => {
    const bad = await api<{ id: number; status: string }>(
      "POST",
      `/api/v1/admin/payouts/${ids.wd1}/process`,
      tokens.admin,
      { action: "tandai-ditransfer" }
    );
    assert.equal(bad.http, 409);
    const ap = await api<{ id: number; status: string }>(
      "POST",
      `/api/v1/admin/payouts/${ids.wd1}/process`,
      tokens.admin,
      { action: "setujui" }
    );
    assert.equal(ap.http, 200);
    assert.equal(ap.json.data.status, "diproses");
    const done = await api<{ id: number; status: string }>(
      "POST",
      `/api/v1/admin/payouts/${ids.wd1}/process`,
      tokens.admin,
      { action: "tandai-ditransfer" }
    );
    assert.equal(done.http, 200);
    assert.equal(done.json.data.status, "berhasil");
    const e = await api<Earnings>("GET", "/api/v1/me/earnings", tokens.t1);
    assert.equal(e.json.data.paid, 100000);
  });

  it("perubahan persen tidak mengubah snapshot lama", async () => {
    const u = await api<{ instructorPercent: number; minWithdrawal: number }>(
      "PUT",
      "/api/v1/admin/revenue-settings",
      tokens.admin,
      { instructorPercent: 80, minWithdrawal: 100000 }
    );
    assert.equal(u.http, 200);
    assert.equal(u.json.data.instructorPercent, 80);
    await createAndVerify(200000, tokens.s2);
    const e = await api<Earnings>("GET", "/api/v1/me/earnings", tokens.t1);
    // 140rb (70%) + 160rb (80%) = 300rb; sudah berhasil 100rb → tersedia 200rb.
    assert.equal(e.json.data.totalEarned, 300000);
    assert.equal(e.json.data.available, 200000);
  });

  it("tolak wajib alasan; persen di luar 1-99 ditolak", async () => {
    const w = await api<{ id: number }>(
      "POST",
      "/api/v1/me/payouts",
      tokens.t1,
      { amount: 100000, bankName: "BCA", accountNumber: "9988776655", accountName: "Guru Bagi" }
    );
    assert.equal(w.http, 201);
    const noReason = await api<{ id: number; status: string }>(
      "POST",
      `/api/v1/admin/payouts/${w.json.data.id}/process`,
      tokens.admin,
      { action: "tolak" }
    );
    assert.equal(noReason.http, 400);
    const yes = await api<{ id: number; status: string }>(
      "POST",
      `/api/v1/admin/payouts/${w.json.data.id}/process`,
      tokens.admin,
      { action: "tolak", reason: "Data rekening tidak valid" }
    );
    assert.equal(yes.http, 200);
    assert.equal(yes.json.data.status, "ditolak");
    const badPct = await api<{ instructorPercent: number }>(
      "PUT",
      "/api/v1/admin/revenue-settings",
      tokens.admin,
      { instructorPercent: 0, minWithdrawal: 100000 }
    );
    assert.equal(badPct.http, 400);
  });
});
