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
import { eq } from "drizzle-orm";
import { db, pool } from "../../../db/index";
import * as schema from "../../../db/schema";
import app from "../../../app";

/**
 * Pembayaran QRIS manual + verifikasi admin (tanpa gateway).
 * Uji integrasi HTTP penuh melawan database tes TERPISAH
 * (`aristoteles_test_pay`). Mencakup: buat antrean, idempotensi,
 * bukti bayar, verifikasi terima (>= tagihan → akses + grant + audit),
 * tolak (wajib alasan), nominal kurang ditolak, voucher diskon
 * (validasi tanpa hangus → hangus saat verifikasi), redeem menolak
 * voucher diskon.
 *
 * Dijalankan via `npm test` bila berkas ini didaftarkan di package.json,
 * atau langsung: `npx tsx --test <file-ini>` dari folder backend/.
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

interface PaymentRow {
  id: number;
  invoice: string;
  status: string;
  amountExpected: number;
  amountPaid: number | null;
  voucherCode: string | null;
  discountAmount: number;
  proofFileId: number | null;
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

const PNG_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

async function uploadProof(token: string): Promise<number> {
  const { http, json } = await api<{ id: number }>(
    "POST",
    "/api/v1/uploads",
    token,
    { filename: "bukti.png", mimeType: "image/png", kind: "payment_proof", data: PNG_B64 }
  );
  assert.equal(http, 201);
  return json.data.id;
}

before(async () => {
  const admin = await mysql.createConnection({
    host: "localhost",
    port: 3306,
    user: "root",
    password: "",
  });
  try {
    await admin.query("CREATE DATABASE IF NOT EXISTS aristoteles_test_pay");
  } finally {
    await admin.end();
  }
  await migrate(db, { migrationsFolder: path.resolve("drizzle") });

  const hash = await bcrypt.hash(TEST_PASSWORD, 4);
  const mkUser = async (name: string, email: string, role: "admin" | "teacher" | "student") => {
    const [h] = await db.insert(schema.users).values({ name, username: email.split("@")[0] + "-t", email, passwordHash: hash, role, emailVerifiedAt: new Date() });
    return Number((h as unknown as { insertId: number }).insertId);
  };
  ids.admin = await mkUser("Admin Bayar", "admin-bayar@uji.io", "admin");
  ids.s1 = await mkUser("Siswa Bayar Satu", "siswa-bayar1@uji.io", "student");
  ids.s2 = await mkUser("Siswa Bayar Dua", "siswa-bayar2@uji.io", "student");
  ids.s3 = await mkUser("Siswa Bayar Tiga", "siswa-bayar3@uji.io", "student");

  const [c] = await db.insert(schema.courses).values({
    title: "Kursus Berbayar Cukup Panjang",
    description: "Deskripsi kursus berbayar yang cukup panjang untuk validasi.",
    category: "Bisnis",
    level: "Pemula",
    duration: "4 Bulan",
    status: "published",
    priceLabel: "Rp150000",
    priceNominal: 150000,
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
  tokens = {
    admin: await login("admin-bayar@uji.io"),
    s1: await login("siswa-bayar1@uji.io"),
    s2: await login("siswa-bayar2@uji.io"),
    s3: await login("siswa-bayar3@uji.io"),
  };
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
    await admin.query("DROP DATABASE aristoteles_test_pay");
  } finally {
    await admin.end();
  }
});

describe("alur pembayaran QRIS + verifikasi admin", () => {
  it("buat antrean menunggu + idempoten + polling status", async () => {
    const r = await api<PaymentRow>("POST", `/api/v1/courses/${ids.paid}/payments`, tokens.s1, {});
    assert.equal(r.http, 201);
    assert.equal(r.json.status, "success");
    assert.match(r.json.data.invoice, /^INV-/);
    assert.equal(r.json.data.status, "menunggu");
    assert.equal(r.json.data.amountExpected, 150000);

    const r2 = await api<PaymentRow>("POST", `/api/v1/courses/${ids.paid}/payments`, tokens.s1, {});
    assert.equal(r2.http, 201);
    assert.equal(r2.json.data.invoice, r.json.data.invoice);

    const my = await api<PaymentRow | null>("GET", `/api/v1/me/payments?courseId=${ids.paid}`, tokens.s1);
    assert.equal(my.http, 200);
    assert.equal(my.json.data?.status, "menunggu");
  });

  it("tolak nominal kurang, terima nominal pas + akses terbuka", async () => {
    const my = await api<PaymentRow>("GET", `/api/v1/me/payments?courseId=${ids.paid}`, tokens.s1);
    const pid = my.json.data!.id;

    const kurang = await api("POST", `/api/v1/admin/payments/${pid}/verify`, tokens.admin, {
      decision: "terima",
      amountPaid: 100000,
    });
    assert.equal(kurang.http, 400);

    const ok = await api("POST", `/api/v1/admin/payments/${pid}/verify`, tokens.admin, {
      decision: "terima",
      amountPaid: 150000,
    });
    assert.equal(ok.http, 200);

    const access = await api<{ hasAccess: boolean }>("GET", `/api/v1/courses/${ids.paid}/access`, tokens.s1);
    assert.equal(access.json.data.hasAccess, true);

    const myEnroll = await api<Array<{ source: string }>>("GET", "/api/v1/me/enrollments", tokens.s1);
    assert.ok(myEnroll.json.data.some((e) => e.source === "payment:manual"));
  });

  it("tolak butuh alasan + verifikasi ganda ditolak", async () => {
    const r = await api<PaymentRow>("POST", `/api/v1/courses/${ids.paid}/payments`, tokens.s2, {});
    const pid = (r.json.data as PaymentRow).id;

    const noReason = await api("POST", `/api/v1/admin/payments/${pid}/verify`, tokens.admin, {
      decision: "tolak",
    });
    assert.equal(noReason.http, 400);

    const denied = await api("POST", `/api/v1/admin/payments/${pid}/verify`, tokens.admin, {
      decision: "tolak",
      reason: "Bukti tidak terbaca",
    });
    assert.equal(denied.http, 200);

    const again = await api("POST", `/api/v1/admin/payments/${pid}/verify`, tokens.admin, {
      decision: "terima",
      amountPaid: 150000,
    });
    assert.equal(again.http, 409);
  });

  it("bukti bayar: hanya gambar + milik sendiri", async () => {
    const pdf = await api("POST", "/api/v1/uploads", tokens.s2, {
      filename: "x.pdf",
      mimeType: "application/pdf",
      kind: "payment_proof",
      data: "JVBERi0xLjQK",
    });
    assert.equal(pdf.http, 400);

    // Pembayaran s2 sebelumnya sudah ditolak → buat antrean baru dulu.
    const fresh = await api<PaymentRow>("POST", `/api/v1/courses/${ids.paid}/payments`, tokens.s2, {});
    assert.equal(fresh.http, 201);
    assert.equal(fresh.json.data.status, "menunggu");

    const fid = await uploadProof(tokens.s2);
    const set = await api("PATCH", `/api/v1/payments/${fresh.json.data!.id}/proof`, tokens.s2, {
      proofFileId: fid,
    });
    assert.equal(set.http, 200);
  });
});

describe("voucher diskon (K-03 opsi A)", () => {
  it("buat + validasi tanpa hangus; redeem akses menolak diskon", async () => {
    const created = await api<{ code: string }>(
      "POST",
      "/api/v1/admin/vouchers",
      tokens.admin,
      {
        code: "DISKON-UJI-20",
        courseId: ids.paid,
        kind: "diskon",
        maxUses: 5,
        discountType: "percent",
        discountValue: 20,
      }
    );
    assert.equal(created.http, 201);

    const v = await api<{ discountType: string; discountValue: number; discountAmount: number }>(
      "POST",
      "/api/v1/vouchers/validate",
      tokens.s1,
      { code: "DISKON-UJI-20", courseId: ids.paid }
    );
    assert.equal(v.http, 200);
    assert.equal(v.json.data.discountType, "percent");
    assert.equal(v.json.data.discountValue, 20);

    const redeem = await api("POST", "/api/v1/vouchers/redeem", tokens.s1, {
      code: "DISKON-UJI-20",
      courseId: ids.paid,
    });
    assert.equal(redeem.http, 400);
    assert.equal(redeem.json.message.includes("diskon"), true);
  });

  it("voucher diskon hangus saat pembayaran disetujui (bukan saat validasi)", async () => {
    // Validasi tidak menghanguskan: masih bisa dipakai untuk buat pembayaran.
    const v = await api<{ discountAmount: number }>("POST", "/api/v1/vouchers/validate", tokens.s1, {
      code: "DISKON-UJI-20",
      courseId: ids.paid,
    });
    assert.equal(v.http, 200);
    assert.equal(v.json.data.discountAmount, 30000);

    const created = await api<PaymentRow>("POST", `/api/v1/courses/${ids.paid}/payments`, tokens.s3, {
      voucherCode: "DISKON-UJI-20",
    });
    assert.equal(created.http, 201);
    assert.equal(created.json.data.discountAmount, 30000);
    assert.equal(created.json.data.voucherCode, "DISKON-UJI-20");

    // Nominal kurang dari tagihan setelah diskon (150000-30000) → ditolak.
    const kurang = await api("POST", `/api/v1/admin/payments/${created.json.data.id}/verify`, tokens.admin, {
      decision: "terima",
      amountPaid: 100000,
    });
    assert.equal(kurang.http, 400);

    // Nominal pas → diterima, akses dibuka, voucher hangus 1x pakai.
    const ok = await api("POST", `/api/v1/admin/payments/${created.json.data.id}/verify`, tokens.admin, {
      decision: "terima",
      amountPaid: 120000,
    });
    assert.equal(ok.http, 200);

    const access = await api<{ hasAccess: boolean }>("GET", `/api/v1/courses/${ids.paid}/access`, tokens.s3);
    assert.equal(access.json.data.hasAccess, true);

    // Voucher yang sama untuk akun yang sama tidak bisa dipakai lagi.
    const again = await api("POST", "/api/v1/vouchers/validate", tokens.s3, {
      code: "DISKON-UJI-20",
      courseId: ids.paid,
    });
    assert.equal(again.http, 409);
  });
});
