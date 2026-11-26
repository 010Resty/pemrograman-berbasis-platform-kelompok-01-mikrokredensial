import "./test-env-reports";
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
 * Laporan admin (GET /api/v1/admin/reports).
 * Uji integrasi HTTP penuh melawan database tes TERPISAH
 * (`aristoteles_test_admr`), TIDAK PERNAH menyentuh database live.
 *
 * Jalankan dari folder backend/: npx tsx --test <file-ini>
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
let studentToken = "";
let paidCourseId = 0;
let freeCourseId = 0;

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
    await admin.query("CREATE DATABASE IF NOT EXISTS aristoteles_test_admr");
  } finally {
    await admin.end();
  }
  await migrate(db, { migrationsFolder: path.resolve("drizzle") });

  const hash = await bcrypt.hash(TEST_PASSWORD, 4);
  const mkUser = async (name: string, email: string, role: "admin" | "teacher" | "student") => {
    await db.insert(schema.users).values({
      name,
      username: `${email.split("@")[0]}-r`,
      email,
      passwordHash: hash,
      role,
      emailVerifiedAt: new Date(),
    });
  };
  await mkUser("Admin Rapor", "admin@rapor.io", "admin");
  await mkUser("Siswa Rapor", "siswa@rapor.io", "student");

  const [siswa] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, "siswa@rapor.io"))
    .limit(1);
  const [adm] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, "admin@rapor.io"))
    .limit(1);

  const [freeH] = await db.insert(schema.courses).values({
    title: "Kursus Gratis Rapor",
    description: "Deskripsi kursus gratis untuk laporan admin.",
    category: "Umum",
    level: "Pemula",
    duration: "1 Bulan",
    status: "published",
    priceLabel: "GRATIS",
    priceNominal: 0,
    period: "ongoing",
    outcomes: ["Mampu memahami laporan"],
    tools: ["Laptop"],
  });
  freeCourseId = Number((freeH as unknown as { insertId: number }).insertId);

  const [paidH] = await db.insert(schema.courses).values({
    title: "Kursus Berbayar Rapor",
    description: "Deskripsi kursus berbayar untuk laporan admin.",
    category: "Bisnis",
    level: "Menengah",
    duration: "2 Bulan",
    status: "published",
    priceLabel: "Rp150.000",
    priceNominal: 150000,
    period: "ongoing",
    outcomes: ["Mampu membaca pemasukan"],
    tools: ["Laptop"],
  });
  paidCourseId = Number((paidH as unknown as { insertId: number }).insertId);

  await db.insert(schema.enrollments).values({
    userId: siswa.id,
    courseId: freeCourseId,
    source: "free",
    status: "active",
  });

  // Satu antrean menunggu + satu diverifikasi (pendapatan 150rb).
  await db.insert(schema.payments).values({
    userId: siswa.id,
    courseId: paidCourseId,
    invoice: "INV-RAPOR-1",
    method: "qris",
    amountExpected: 150000,
    status: "menunggu",
  });
  await db.insert(schema.payments).values({
    userId: siswa.id,
    courseId: paidCourseId,
    invoice: "INV-RAPOR-2",
    method: "qris",
    amountExpected: 150000,
    amountPaid: 150000,
    status: "diverifikasi",
    verifiedBy: adm.id,
    verifiedAt: new Date(),
  });
  await db.insert(schema.payments).values({
    userId: siswa.id,
    courseId: paidCourseId,
    invoice: "INV-RAPOR-3",
    method: "qris",
    amountExpected: 150000,
    status: "ditolak",
    rejectReason: "Bukti tidak terbaca",
    verifiedBy: adm.id,
    verifiedAt: new Date(),
  });

  const [mH] = await db.insert(schema.modules).values({
    courseId: paidCourseId,
    title: "Modul Rapor",
    type: "materi",
    position: 0,
  });
  const moduleId = Number((mH as unknown as { insertId: number }).insertId);
  await db.insert(schema.certificates).values({
    userId: siswa.id,
    courseId: paidCourseId,
    moduleId,
    code: "ATS-2026-RAPOR01",
    recipientName: "Siswa Rapor",
    status: "issued",
  });

  await db.insert(schema.vouchers).values({
    code: "ARISTO-RAPOR-1",
    courseId: paidCourseId,
    kind: "umum",
    maxUses: 10,
    usedCount: 1,
    status: "available",
  });
  await db.insert(schema.voucherRedemptions).values({
    voucherCode: "ARISTO-RAPOR-1",
    userId: siswa.id,
    courseId: paidCourseId,
  });

  const srv = app.listen(0);
  await once(srv, "listening");
  server = srv;
  const addr = srv.address() as AddressInfo;
  base = `http://127.0.0.1:${addr.port}`;
  adminToken = await login("admin@rapor.io");
  studentToken = await login("siswa@rapor.io");
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
    await admin.query("DROP DATABASE aristoteles_test_admr");
  } finally {
    await admin.end();
  }
});

describe("GET /admin/reports auth & validasi", () => {
  it("401 tanpa token; 403 untuk student", async () => {
    assert.equal((await api("GET", "/api/v1/admin/reports")).http, 401);
    assert.equal((await api("GET", "/api/v1/admin/reports", studentToken)).http, 403);
  });

  it("400 tanggal tak valid / rentang terbalik / courseId tak valid", async () => {
    const badDate = await api("GET", "/api/v1/admin/reports?from=bukan-tanggal", adminToken);
    assert.equal(badDate.http, 400);
    assert.equal(badDate.json.code, "INVALID_DATE");

    const badRange = await api(
      "GET",
      "/api/v1/admin/reports?from=2026-02-01&to=2026-01-01",
      adminToken
    );
    assert.equal(badRange.http, 400);
    assert.equal(badRange.json.code, "INVALID_RANGE");

    const badCourse = await api("GET", "/api/v1/admin/reports?courseId=abc", adminToken);
    assert.equal(badCourse.http, 400);
  });
});

describe("GET /admin/reports isi", () => {
  it("200 ringkasan + per kursus konsisten", async () => {
    const { http, json } = await api<{
      summary: Record<string, number>;
      perCourse: Array<Record<string, number | string>>;
      certificates: { issued: number; revoked: number };
      filters: Record<string, unknown>;
    }>("GET", "/api/v1/admin/reports", adminToken);
    assert.equal(http, 200);
    assert.equal(json.status, "success");
    assert.equal(json.data.summary.totalStudents, 1);
    assert.equal(json.data.summary.paymentsMenunggu, 1);
    assert.equal(json.data.summary.paymentsDiverifikasi, 1);
    assert.equal(json.data.summary.paymentsDitolak, 1);
    assert.equal(json.data.summary.revenueVerified, 150000);
    assert.equal(json.data.summary.voucherRedemptions, 1);
    assert.equal(json.data.certificates.issued, 1);
    assert.ok(Array.isArray(json.data.perCourse));
    assert.equal(json.data.perCourse.length, 2);

    const paid = json.data.perCourse.find((c) => c.courseId === paidCourseId);
    assert.ok(paid);
    assert.equal(paid.revenueVerified, 150000);
    assert.equal(paid.paymentsMenunggu, 1);
    assert.equal(paid.paymentsDitolak, 1);
    assert.equal(paid.certificatesIssued, 1);
  });

  it("200 insights funnel + rates konsisten", async () => {
    const { http, json } = await api<{
      summary: Record<string, number>;
      insights: {
        funnel: Array<{
          stage: string;
          label: string;
          basis: string;
          count: number;
          pctOfFirst: number;
          pctOfPrev: number | null;
        }>;
        rates: Record<string, number>;
        note: string;
      };
    }>("GET", "/api/v1/admin/reports", adminToken);
    assert.equal(http, 200);
    assert.equal(json.data.insights.funnel.length, 4);
    assert.deepEqual(
      json.data.insights.funnel.map((f) => f.stage),
      ["pendaftar", "enrollment", "pembayaran", "sertifikat"]
    );
    assert.deepEqual(
      json.data.insights.funnel.map((f) => f.count),
      [1, 1, 1, 1]
    );
    assert.equal(json.data.insights.funnel[0].basis, "filter");
    assert.equal(json.data.insights.funnel[0].label, "Pendaftar");
    assert.equal(json.data.insights.funnel[0].pctOfPrev, null);
    assert.equal(json.data.insights.funnel[1].basis, "filter");
    assert.deepEqual(
      json.data.insights.funnel.map((f) => f.pctOfFirst),
      [100, 100, 100, 100]
    );
    assert.deepEqual(json.data.insights.rates, {
      paymentApproval: 33.3,
      paymentRejection: 33.3,
      enrollmentCompletion: 0,
      certificatePerEnrollment: 100,
      enrollmentCertified: 100,
      certificateRevoke: 0,
    });
    assert.ok(json.data.insights.note.includes("lingkup filter"));
  });

  it("200 funnel konsisten dalam lingkup filter", async () => {
    // Rentang lebar mencakup seed: tahap 1 = 1 pendaftar periode ini.
    const wide = await api<{
      insights: { funnel: Array<{ stage: string; count: number; pctOfFirst: number }> };
    }>("GET", "/api/v1/admin/reports?from=2000-01-01&to=2099-12-31", adminToken);
    assert.equal(wide.http, 200);
    assert.deepEqual(
      wide.json.data.insights.funnel.map((f) => f.count),
      [1, 1, 1, 1]
    );

    // Rentang masa depan: seluruh tahap nol, persen nol (tanpa NaN).
    const future = await api<{
      summary: { paymentsMenunggu: number; revenueVerified: number };
      insights: {
        funnel: Array<{ count: number; pctOfFirst: number; pctOfPrev: number | null }>;
        rates: Record<string, number>;
      };
    }>("GET", "/api/v1/admin/reports?from=2099-01-01&to=2099-01-31", adminToken);
    assert.equal(future.http, 200);
    assert.equal(future.json.data.summary.paymentsMenunggu, 0);
    assert.equal(future.json.data.summary.revenueVerified, 0);
    assert.deepEqual(
      future.json.data.insights.funnel.map((f) => f.count),
      [0, 0, 0, 0]
    );
    assert.deepEqual(
      future.json.data.insights.funnel.map((f) => f.pctOfFirst),
      [0, 0, 0, 0]
    );
    assert.deepEqual(
      future.json.data.insights.funnel.map((f) => f.pctOfPrev),
      [null, null, null, null]
    );
    assert.deepEqual(future.json.data.insights.rates, {
      paymentApproval: 0,
      paymentRejection: 0,
      enrollmentCompletion: 0,
      certificatePerEnrollment: 0,
      enrollmentCertified: 0,
      certificateRevoke: 0,
    });

    // Lingkup kursus: tahap 1 = peserta unik kursus itu (0 di kursus berbayar,
    // karena enrollment seed ada di kursus gratis) — jujur, bukan snapshot global.
    const scoped = await api<{
      filters: { courseId?: number };
      insights: {
        funnel: Array<{ stage: string; label: string; count: number; pctOfPrev: number | null }>;
      };
    }>(`GET`, `/api/v1/admin/reports?courseId=${paidCourseId}`, adminToken);
    assert.equal(scoped.http, 200);
    assert.equal(scoped.json.data.filters.courseId, paidCourseId);
    assert.deepEqual(
      scoped.json.data.insights.funnel.map((f) => [f.label, f.count]),
      [
        ["Peserta kursus", 0],
        ["Enrollment", 0],
        ["Pembayaran diverifikasi", 1],
        ["Sertifikat terbit", 1],
      ]
    );
    // Tahap berpenyebut nol → rasio "—" (null), bukan 0%.
    assert.deepEqual(
      scoped.json.data.insights.funnel.map((f) => f.pctOfPrev),
      [null, null, null, 100]
    );
  });

  it("200 filter courseId mempersempit cakupan", async () => {
    const one = await api<{
      perCourse: Array<{ courseId: number }>;
      filters: { courseId?: number };
      paging: { page: number; limit: number; total: number };
    }>(`GET`, `/api/v1/admin/reports?courseId=${paidCourseId}`, adminToken);
    assert.equal(one.http, 200);
    assert.equal(one.json.data.perCourse.length, 1);
    assert.equal(one.json.data.perCourse[0].courseId, paidCourseId);
    assert.equal(one.json.data.filters.courseId, paidCourseId);
    assert.deepEqual(one.json.data.paging, { page: 1, limit: 100, total: 1 });
  });

  it("200 paginasi perCourse limit/page", async () => {
    const p1 = await api<{
      perCourse: Array<{ courseId: number }>;
      paging: { page: number; limit: number; total: number };
    }>("GET", "/api/v1/admin/reports?limit=1&page=1", adminToken);
    assert.equal(p1.http, 200);
    assert.equal(p1.json.data.perCourse.length, 1);
    assert.deepEqual(p1.json.data.paging, { page: 1, limit: 1, total: 2 });

    const p2 = await api<{
      perCourse: Array<{ courseId: number }>;
      paging: { page: number; limit: number; total: number };
    }>("GET", "/api/v1/admin/reports?limit=1&page=2", adminToken);
    assert.equal(p2.http, 200);
    assert.equal(p2.json.data.perCourse.length, 1);
    assert.notEqual(
      p2.json.data.perCourse[0].courseId,
      p1.json.data.perCourse[0].courseId
    );

    const p99 = await api<{
      perCourse: Array<unknown>;
    }>("GET", "/api/v1/admin/reports?limit=1&page=99", adminToken);
    assert.equal(p99.http, 200);
    assert.equal(p99.json.data.perCourse.length, 0);
  });

  it("200 deret bulanan 12 bulan + bulan berjalan terisi", async () => {
    const r = await api<{
      monthly: Array<{ month: string; revenue: number; payments: number; enrollments: number; certificates: number }>;
    }>("GET", "/api/v1/admin/reports", adminToken);
    assert.equal(r.http, 200);
    assert.equal(r.json.data.monthly.length, 12);
    for (const m of r.json.data.monthly) {
      assert.match(m.month, /^\d{4}-(0[1-9]|1[0-2])$/);
      assert.ok(m.revenue >= 0 && m.payments >= 0 && m.enrollments >= 0 && m.certificates >= 0);
    }
    // Seed: 1 pembayaran terverifikasi 150rb + 1 sertifikat terbit bulan ini.
    const now = new Date();
    const cur = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const row = r.json.data.monthly.find((m) => m.month === cur);
    assert.ok(row);
    assert.equal(row.revenue, 150000);
    assert.equal(row.payments, 1);
    assert.equal(row.certificates, 1);
  });
});
