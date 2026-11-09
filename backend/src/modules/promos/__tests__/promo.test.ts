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
 * Promo kurasi admin (diskon percent-only) + integrasi pembayaran.
 * Uji integrasi HTTP penuh melawan database tes TERPISAH
 * (`aristoteles_test_promo`), TIDAK PERNAH menyentuh database live.
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

async function login(email: string, password = TEST_PASSWORD): Promise<string> {
  const { http, json } = await api<{ accessToken: string }>(
    "POST",
    "/api/v1/auth/login",
    undefined,
    { email, password }
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
    await admin.query("CREATE DATABASE IF NOT EXISTS aristoteles_test_promo");
  } finally {
    await admin.end();
  }
  await migrate(db, { migrationsFolder: path.resolve("drizzle") });

  const hash = await bcrypt.hash(TEST_PASSWORD, 4);
  const mkUser = async (name: string, email: string, role: "admin" | "teacher" | "student") => {
    const [h] = await db.insert(schema.users).values({ name, username: email.split("@")[0] + "-t", email, passwordHash: hash, role, emailVerifiedAt: new Date() });
    return Number((h as unknown as { insertId: number }).insertId);
  };
  ids.admin = await mkUser("Admin Promo", "admin@promo.io", "admin");
  ids.teacher = await mkUser("Guru Promo", "guru@promo.io", "teacher");
  ids.s1 = await mkUser("Siswa Promo Satu", "s1@promo.io", "student");
  ids.s2 = await mkUser("Siswa Promo Dua", "s2@promo.io", "student");

  const mkCourse = async (
    title: string,
    price: number,
    status: "draft" | "published" | "archived" = "published"
  ) => {
    const [h] = await db.insert(schema.courses).values({
      title,
      description: `Deskripsi ${title} yang cukup panjang untuk validasi.`,
      category: "Pengembangan Web",
      level: "Pemula",
      duration: "4 Bulan",
      status,
      priceLabel: price === 0 ? "GRATIS" : `Rp${price}`,
      priceNominal: price,
      period: "ongoing",
      outcomes: ["Hasil belajar pertama yang cukup panjang"],
      tools: ["Laptop"],
      createdBy: ids.teacher,
    });
    return Number((h as unknown as { insertId: number }).insertId);
  };
  ids.paid = await mkCourse("Kursus Berbayar Promo Panjang", 200000);
  ids.paid2 = await mkCourse("Kursus Berbayar Promo Kedua Panjang", 100000);
  ids.draft = await mkCourse("Kursus Draft Promo Panjang", 50000, "draft");
  ids.archived = await mkCourse("Kursus Arsip Promo Panjang Judulnya", 150000, "archived");
  ids.free = await mkCourse("Kursus Gratis Promo Panjang Judulnya", 0);

  const srv = app.listen(0);
  await once(srv, "listening");
  server = srv;
  const addr = srv.address() as AddressInfo;
  base = `http://127.0.0.1:${addr.port}`;
  tokens.admin = await login("admin@promo.io");
  tokens.teacher = await login("guru@promo.io");
  tokens.s1 = await login("s1@promo.io");
  tokens.s2 = await login("s2@promo.io");
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
    await admin.query("DROP DATABASE aristoteles_test_promo");
  } finally {
    await admin.end();
  }
});

describe("promo: kelola kampanye (admin-only)", () => {
  it("buat diskon 20% + validasi ketat; non-admin 403", async () => {
    const ok = await api("POST", "/api/v1/admin/promos", tokens.admin, {
      slug: "promo-akhir-tahun",
      title: "Promo Akhir Tahun Panjang",
      badgeLabel: "Promo Akhir Tahun",
      type: "diskon",
      discountPercent: 20,
      status: "draft",
    });
    assert.equal(ok.http, 201, JSON.stringify(ok.json));

    const dup = await api("POST", "/api/v1/admin/promos", tokens.admin, {
      slug: "promo-akhir-tahun",
      title: "Duplikat Slug Panjang",
      type: "kurasi",
    });
    assert.equal(dup.http, 409);

    for (const body of [
      { slug: "AB", title: "Terlalu Pendek Judulnya", type: "diskon", discountPercent: 10 },
      { slug: "promo-tanpa-persen", title: "Diskon Tanpa Persen Panjang", type: "diskon" },
      { slug: "promo-persen-0", title: "Persen Nol Panjang Judulnya", type: "diskon", discountPercent: 0 },
      { slug: "promo-persen-91", title: "Persen Sembilan Satu Panjang", type: "diskon", discountPercent: 91 },
      { slug: "kurasi-berdiskon", title: "Kurasi Berdiskon Panjang Judul", type: "kurasi", discountPercent: 10 },
    ]) {
      const bad = await api("POST", "/api/v1/admin/promos", tokens.admin, body);
      assert.equal(bad.http, 400, `${JSON.stringify(body)}: ${bad.http}`);
    }

    const forbidden = await api("POST", "/api/v1/admin/promos", tokens.teacher, {
      slug: "promo-guru",
      title: "Promo Guru Panjang Judulnya",
      type: "kurasi",
    });
    assert.equal(forbidden.http, 403);

    const anon = await api("POST", "/api/v1/admin/promos", undefined, {
      slug: "promo-anon",
      title: "Promo Anon Panjang Judulnya",
      type: "kurasi",
    });
    assert.equal(anon.http, 401);
  });

  it("tambah/hapus kursus: draft ditolak, ganda 409, hapus idempoten", async () => {
    const add = await api("POST", "/api/v1/admin/promos/promo-akhir-tahun/courses", tokens.admin, {
      courseId: ids.paid,
    });
    assert.equal(add.http, 201, JSON.stringify(add.json));

    const dup = await api("POST", "/api/v1/admin/promos/promo-akhir-tahun/courses", tokens.admin, {
      courseId: ids.paid,
    });
    assert.equal(dup.http, 409);

    const draft = await api("POST", "/api/v1/admin/promos/promo-akhir-tahun/courses", tokens.admin, {
      courseId: ids.draft,
    });
    assert.equal(draft.http, 400);

    const missing = await api("POST", "/api/v1/admin/promos/promo-akhir-tahun/courses", tokens.admin, {
      courseId: 999999,
    });
    assert.equal(missing.http, 404);

    const del = await api("DELETE", `/api/v1/admin/promos/promo-akhir-tahun/courses/${ids.paid}`, tokens.admin);
    assert.equal(del.http, 200);
    // Tambah lagi untuk dipakai uji publik/pembayaran.
    const readd = await api("POST", "/api/v1/admin/promos/promo-akhir-tahun/courses", tokens.admin, {
      courseId: ids.paid,
    });
    assert.equal(readd.http, 201);
  });

  it("aktifkan promo; publik hanya lihat active dalam jendela", async () => {
    const activate = await api("PATCH", "/api/v1/admin/promos/promo-akhir-tahun", tokens.admin, {
      status: "active",
    });
    assert.equal(activate.http, 200);

    // Kampanye kedaluwarsa tidak tampil publik.
    const expired = await api("POST", "/api/v1/admin/promos", tokens.admin, {
      slug: "promo-kedaluwarsa",
      title: "Promo Kedaluwarsa Panjang Judul",
      type: "diskon",
      discountPercent: 50,
      status: "active",
      startsAt: "2020-01-01T00:00:00",
      endsAt: "2020-12-31T23:59:59",
    });
    assert.equal(expired.http, 201);
    await api("POST", "/api/v1/admin/promos/promo-kedaluwarsa/courses", tokens.admin, { courseId: ids.paid2 });

    const list = await api<Array<{ slug: string; courses: unknown[] }>>("GET", "/api/v1/promos");
    assert.equal(list.http, 200);
    const slugs = list.json.data.map((c) => c.slug);
    assert.ok(slugs.includes("promo-akhir-tahun"), JSON.stringify(slugs));
    assert.ok(!slugs.includes("promo-kedaluwarsa"), JSON.stringify(slugs));

    const draftDetail = await api("GET", "/api/v1/promos/promo-kedaluwarsa");
    assert.equal(draftDetail.http, 404);

    const detail = await api<{
      slug: string;
      discountPercent: number;
      courses: Array<{ courseId: number; promoPrice: number; badgeLabel: string | null }>;
    }>("GET", "/api/v1/promos/promo-akhir-tahun");
    assert.equal(detail.http, 200);
    assert.equal(detail.json.data.discountPercent, 20);
    const row = detail.json.data.courses.find((c) => c.courseId === ids.paid);
    assert.ok(row, JSON.stringify(detail.json.data.courses));
    assert.equal(row!.promoPrice, 160000);
    assert.equal(row!.badgeLabel, "Promo Akhir Tahun");
  });
});

describe("promo: diskon real di pembayaran (non-stack)", () => {
  it("pembayaran pakai harga promo tanpa voucher", async () => {
    const pay = await api<{ amountExpected: number; discountAmount: number; promoSlug: string | null }>(
      "POST",
      `/api/v1/courses/${ids.paid}/payments`,
      tokens.s1,
      {}
    );
    assert.equal(pay.http, 201, JSON.stringify(pay.json));
    assert.equal(pay.json.data.amountExpected, 160000);
    assert.equal(pay.json.data.discountAmount, 40000);
    assert.equal(pay.json.data.promoSlug, "promo-akhir-tahun");
  });

  it("voucher lebih besar menang; promo lebih besar menang", async () => {
    // Voucher diskon 10% (lebih kecil dari promo 20%) → promo menang.
    const vSmall = await api("POST", "/api/v1/admin/vouchers", tokens.admin, {
      code: "PROMO-V-10",
      courseId: ids.paid,
      kind: "diskon",
      maxUses: 10,
      discountType: "percent",
      discountValue: 10,
    });
    assert.equal(vSmall.http, 201, JSON.stringify(vSmall.json));

    const paySmall = await api<{ voucherCode: string | null; promoSlug: string | null; discountAmount: number }>(
      "POST",
      `/api/v1/courses/${ids.paid}/payments`,
      tokens.s2,
      { voucherCode: "PROMO-V-10" }
    );
    assert.equal(paySmall.http, 201, JSON.stringify(paySmall.json));
    assert.equal(paySmall.json.data.promoSlug, "promo-akhir-tahun");
    assert.equal(paySmall.json.data.discountAmount, 40000);

    // Voucher diskon 50% (lebih besar) → voucher menang, promoSlug null.
    const vBig = await api("POST", "/api/v1/admin/vouchers", tokens.admin, {
      code: "PROMO-V-50",
      courseId: ids.paid2,
      kind: "diskon",
      maxUses: 10,
      discountType: "percent",
      discountValue: 50,
    });
    assert.equal(vBig.http, 201, JSON.stringify(vBig.json));
    await api("POST", "/api/v1/admin/promos/promo-akhir-tahun/courses", tokens.admin, { courseId: ids.paid2 });

    const payBig = await api<{ voucherCode: string | null; promoSlug: string | null; discountAmount: number }>(
      "POST",
      `/api/v1/courses/${ids.paid2}/payments`,
      tokens.s2,
      { voucherCode: "PROMO-V-50" }
    );
    assert.equal(payBig.http, 201, JSON.stringify(payBig.json));
    assert.equal(payBig.json.data.voucherCode, "PROMO-V-50");
    assert.equal(payBig.json.data.promoSlug, null);
    assert.equal(payBig.json.data.discountAmount, 50000);
  });

  it("kuote promo per kursus untuk display harga", async () => {
    const q = await api<{
      slug: string;
      discountPercent: number;
      promoPrice: number;
      priceNominal: number;
    } | null>("GET", `/api/v1/promos/course/${ids.paid}`);
    assert.equal(q.http, 200);
    assert.ok(q.json.data, "kuote promo ada");
    assert.equal(q.json.data!.slug, "promo-akhir-tahun");
    assert.equal(q.json.data!.discountPercent, 20);
    assert.equal(q.json.data!.promoPrice, 160000);
    assert.equal(q.json.data!.priceNominal, 200000);

    // Tanpa promo aktif (draft / tidak dikenal) → null, bukan error.
    const draft = await api<null>("GET", `/api/v1/promos/course/${ids.draft}`);
    assert.equal(draft.http, 200);
    assert.equal(draft.json.data, null);

    const missing = await api<null>("GET", "/api/v1/promos/course/999999");
    assert.equal(missing.http, 200);
    assert.equal(missing.json.data, null);
  });

  it("detail admin terlihat walau draft; validasi jendela + keanggotaan", async () => {
    const draftCamp = await api("POST", "/api/v1/admin/promos", tokens.admin, {
      slug: "promo-draft-kelola",
      title: "Promo Draft Kelola Panjang",
      type: "kurasi",
      status: "draft",
    });
    assert.equal(draftCamp.http, 201);

    // Admin bisa kelola anggota selagi draft (publik 404).
    const addDraft = await api("POST", "/api/v1/admin/promos/promo-draft-kelola/courses", tokens.admin, {
      courseId: ids.paid2,
    });
    assert.equal(addDraft.http, 201, JSON.stringify(addDraft.json));
    const noAuth = await api("GET", "/api/v1/admin/promos/promo-draft-kelola");
    assert.equal(noAuth.http, 401);

    const detailAuthed = await api<{ slug: string; courses: Array<{ courseId: number }> }>(
      "GET",
      "/api/v1/admin/promos/promo-draft-kelola",
      tokens.admin
    );
    assert.equal(detailAuthed.http, 200);
    assert.equal(detailAuthed.json.data.slug, "promo-draft-kelola");
    assert.ok(detailAuthed.json.data.courses.some((c) => c.courseId === ids.paid2));

    const pubDraft = await api("GET", "/api/v1/promos/promo-draft-kelola");
    assert.equal(pubDraft.http, 404);

    // PATCH jendela terbalik ditolak.
    const badWindow = await api("PATCH", "/api/v1/admin/promos/promo-akhir-tahun", tokens.admin, {
      startsAt: "2026-12-31T00:00:00",
      endsAt: "2026-01-01T00:00:00",
    });
    assert.equal(badWindow.http, 400);

    // Kursus arsip selalu ditolak; gratis ditolak untuk diskon, boleh untuk kurasi.
    const archived = await api("POST", "/api/v1/admin/promos/promo-akhir-tahun/courses", tokens.admin, {
      courseId: ids.archived,
    });
    assert.equal(archived.http, 400);
    const freeDiskon = await api("POST", "/api/v1/admin/promos/promo-akhir-tahun/courses", tokens.admin, {
      courseId: ids.free,
    });
    assert.equal(freeDiskon.http, 400);
    const freeKurasi = await api("POST", "/api/v1/admin/promos/promo-draft-kelola/courses", tokens.admin, {
      courseId: ids.free,
    });
    assert.equal(freeKurasi.http, 201);
  });
});
