import "./test-env";
import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import path from "node:path";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";
import { migrate } from "drizzle-orm/mysql2/migrator";
import { and, eq } from "drizzle-orm";
import { db, pool } from "../../../db/index";
import * as schema from "../../../db/schema";
import app from "../../../app";
import { resetRateLimitForTest } from "../../../middlewares/rate-limit.middleware";

/**
 * Grup patungan end-to-end: username tervalidasi, iuran sendiri-sendiri,
 * akses dibuka hanya setelah semua lunas. Database tes TERPISAH
 * (`aristoteles_test_patungan`), TIDAK PERNAH menyentuh database live.
 *
 * Jalankan dari folder backend/: npx tsx --test <file-ini>
 */

const TEST_PASSWORD = "Katasandi123";

interface Envelope<T> {
  status: "success" | "error";
  message?: string;
  code?: string;
  data: T;
  errors?: Array<{ field: string; message: string }> | null;
}

let base = "";
let server: Server | null = null;
const tokens: Record<string, string> = {};
const ids: Record<string, number> = {};
const usernames: Record<string, string> = {
  admin: "admin.patungan",
  creator: "ketua.patungan",
  m1: "anggota.satu",
  m2: "anggota.dua",
  m3: "anggota.tiga",
  outsider: "orang.luar",
  uKetua: "ketua.undang",
  uA: "tamu.satu",
  uB: "tamu.dua",
  uC: "tamu.tiga",
};

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

interface GroupDetail {
  id: number;
  code: string;
  status: string;
  memberCount: number;
  priceNominal: number;
  paidCount: number;
  locked?: boolean;
  expiresAt?: string | null;
  members: Array<{
    userId: number;
    username: string;
    name: string;
    position: number;
    inviteStatus?: string;
    shareAmount: number;
    paymentStatus: string;
  }>;
}

interface PaymentRow {
  id: number;
  invoice: string;
  status: string;
  amountExpected: number;
  patunganGroupId: number | null;
}

before(async () => {
  const admin = await mysql.createConnection({ host: "localhost", port: 3306, user: "root", password: "" });
  try {
    await admin.query("CREATE DATABASE IF NOT EXISTS aristoteles_test_patungan");
  } finally {
    await admin.end();
  }
  await migrate(db, { migrationsFolder: path.resolve("drizzle") });

  const hash = await bcrypt.hash(TEST_PASSWORD, 4);
  const mkUser = async (name: string, username: string, email: string, role: "admin" | "student") => {
    const [h] = await db
      .insert(schema.users)
      .values({ name, username, email, passwordHash: hash, role, emailVerifiedAt: new Date() });
    return Number((h as unknown as { insertId: number }).insertId);
  };
  ids.admin = await mkUser("Admin Patungan", usernames.admin, "admin@patungan.io", "admin");
  ids.creator = await mkUser("Ketua Patungan", usernames.creator, "ketua@patungan.io", "student");
  ids.m1 = await mkUser("Anggota Satu", usernames.m1, "m1@patungan.io", "student");
  ids.m2 = await mkUser("Anggota Dua", usernames.m2, "m2@patungan.io", "student");
  ids.m3 = await mkUser("Anggota Tiga", usernames.m3, "m3@patungan.io", "student");
  ids.outsider = await mkUser("Orang Luar", usernames.outsider, "luar@patungan.io", "student");
  ids.uKetua = await mkUser("Ketua Undang", usernames.uKetua, "ketua@undang.io", "student");
  ids.uA = await mkUser("Tamu Satu", usernames.uA, "tamu1@undang.io", "student");
  ids.uB = await mkUser("Tamu Dua", usernames.uB, "tamu2@undang.io", "student");
  ids.uC = await mkUser("Tamu Tiga", usernames.uC, "tamu3@undang.io", "student");

  const mkCourse = async (title: string, price: number) => {
    const [c] = await db.insert(schema.courses).values({
      title,
      description: "Deskripsi kursus patungan yang cukup panjang untuk validasi.",
      category: "Bisnis",
      level: "Pemula",
      duration: "4 Bulan",
      status: "published",
      priceLabel: `Rp${price}`,
      priceNominal: price,
      period: "ongoing",
      outcomes: ["Hasil belajar pertama yang cukup panjang"],
      tools: ["Laptop"],
      createdBy: ids.admin,
    });
    return Number((c as unknown as { insertId: number }).insertId);
  };
  ids.paid = await mkCourse("Kursus Patungan Berbayar Panjang", 150000);
  ids.plain = await mkCourse("Kursus Tanpa Promo Patungan Panjang", 100000);

  const srv = app.listen(0);
  await once(srv, "listening");
  server = srv;
  const addr = srv.address() as AddressInfo;
  base = `http://127.0.0.1:${addr.port}`;
  for (const [key, email] of Object.entries({
    admin: "admin@patungan.io",
    creator: "ketua@patungan.io",
    m1: "m1@patungan.io",
    m2: "m2@patungan.io",
    m3: "m3@patungan.io",
    outsider: "luar@patungan.io",
    uKetua: "ketua@undang.io",
    uA: "tamu1@undang.io",
    uB: "tamu2@undang.io",
    uC: "tamu3@undang.io",
  })) {
    tokens[key] = await login(email);
  }

  // Kampanye patungan aktif berisi kursus paid (bukan plain).
  const camp = await api("POST", "/api/v1/admin/promos", tokens.admin, {
    slug: "patungan-uji",
    title: "Patungan Uji Panjang",
    type: "patungan",
    status: "active",
  });
  assert.equal(camp.http, 201, JSON.stringify(camp.json));
  const add = await api("POST", "/api/v1/admin/promos/patungan-uji/courses", tokens.admin, {
    courseId: ids.paid,
  });
  assert.equal(add.http, 201, JSON.stringify(add.json));
});

after(async () => {
  if (server) await new Promise<void>((r) => server?.close(() => r()));
  await pool.end();
  const admin = await mysql.createConnection({ host: "localhost", port: 3306, user: "root", password: "" });
  try {
    await admin.query("DROP DATABASE aristoteles_test_patungan");
  } finally {
    await admin.end();
  }
});

async function enrollmentOf(userId: number, courseId: number) {
  const rows = await db
    .select()
    .from(schema.enrollments)
    .where(and(eq(schema.enrollments.userId, userId), eq(schema.enrollments.courseId, courseId)))
    .limit(1);
  return rows[0] ?? null;
}

describe("patungan: validasi username anggota", () => {
  it("unknown username → ready false + USER_NOT_FOUND", async () => {
    const r = await api("POST", "/api/v1/patungan/members/validate", tokens.creator, {
      courseId: ids.paid,
      usernames: [usernames.m1, "hantu.takterdaftar"],
    });
    assert.equal(r.http, 200);
    assert.equal(r.json.status, "success");
    const data = r.json.data as { ready: boolean; members: Array<{ username: string; exists: boolean }>; error: { code: string } };
    assert.equal(data.ready, false);
    assert.equal(data.error.code, "USER_NOT_FOUND");
    assert.deepEqual(
      data.members.map((m) => [m.username, m.exists]),
      [
        [usernames.m1, true],
        ["hantu.takterdaftar", false],
      ]
    );
  });

  it("semua valid → ready + iuran habis dibagi", async () => {
    const r = await api("POST", "/api/v1/patungan/members/validate", tokens.creator, {
      courseId: ids.paid,
      usernames: [usernames.m1, usernames.m2],
    });
    assert.equal(r.http, 200);
    const data = r.json.data as {
      ready: boolean;
      memberCount: number;
      total: number;
      shares: Record<string, number>;
      creatorShare: number;
    };
    assert.equal(data.ready, true);
    assert.equal(data.memberCount, 3);
    assert.equal(data.total, 150000);
    const sum = data.creatorShare + Object.values(data.shares).reduce((a, b) => a + b, 0);
    assert.equal(sum, 150000);
  });

  it("tanpa login → 401; kursus di luar promo → siap false", async () => {
    const anon = await api("POST", "/api/v1/patungan/members/validate", undefined, {
      courseId: ids.paid,
      usernames: [usernames.m1],
    });
    assert.equal(anon.http, 401);
    const r = await api("POST", "/api/v1/patungan/members/validate", tokens.creator, {
      courseId: ids.plain,
      usernames: [usernames.m1],
    });
    assert.equal(r.http, 200);
    const data = r.json.data as { ready: boolean; error: { code: string } };
    assert.equal(data.ready, false);
    assert.equal(data.error.code, "COURSE_NOT_ELIGIBLE");
  });
});

describe("patungan: buat grup + aturan", () => {
  let groupId = 0;

  it("buat grup sukses, pembuat otomatis anggota #1", async () => {
    const r = await api<GroupDetail>("POST", "/api/v1/patungan/groups", tokens.creator, {
      courseId: ids.paid,
      usernames: [usernames.m1, usernames.m2],
    });
    assert.equal(r.http, 201, JSON.stringify(r.json));
    assert.equal(r.json.data.memberCount, 3);
    assert.equal(r.json.data.status, "pending");
    assert.match(r.json.data.code, /^PTG-/);
    assert.equal(r.json.data.members[0]?.username, usernames.creator);
    assert.equal(r.json.data.members[0]?.position, 0);
    const sum = r.json.data.members.reduce((a, m) => a + m.shareAmount, 0);
    assert.equal(sum, 150000);
    groupId = r.json.data.id;
  });

  it("username ganda / diri sendiri / tak dikenal ditolak", async () => {
    const dup = await api("POST", "/api/v1/patungan/groups", tokens.creator, {
      courseId: ids.paid,
      usernames: [usernames.m1, usernames.m1],
    });
    assert.equal(dup.http, 400);
    assert.equal(dup.json.code, "MEMBER_DUPLICATE");

    const self = await api("POST", "/api/v1/patungan/groups", tokens.creator, {
      courseId: ids.paid,
      usernames: [usernames.creator],
    });
    assert.equal(self.http, 400);
    assert.equal(self.json.code, "SELF_INCLUDED");

    const ghost = await api("POST", "/api/v1/patungan/groups", tokens.creator, {
      courseId: ids.paid,
      usernames: ["hantu.takterdaftar"],
    });
    assert.equal(ghost.http, 404);
    assert.equal(ghost.json.code, "USER_NOT_FOUND");
  });

  it("16 orang ditolak; kursus tanpa promo ditolak", async () => {
    const many = await api("POST", "/api/v1/patungan/groups", tokens.creator, {
      courseId: ids.paid,
      usernames: Array.from({ length: 15 }, (_, i) => `calon.${i}`),
    });
    assert.equal(many.http, 400);

    const plain = await api("POST", "/api/v1/patungan/groups", tokens.creator, {
      courseId: ids.plain,
      usernames: [usernames.m1],
    });
    assert.equal(plain.http, 403);
    assert.equal(plain.json.code, "COURSE_NOT_ELIGIBLE");
  });

  it("bukan anggota tidak boleh intip detail; daftar grup saya benar", async () => {
    const peek = await api("GET", `/api/v1/patungan/groups/${groupId}`, tokens.outsider);
    assert.equal(peek.http, 403);
    assert.equal(peek.json.code, "GROUP_FORBIDDEN");

    const mine = await api<Array<{ id: number }>>("GET", "/api/v1/patungan/groups/mine", tokens.m1);
    assert.equal(mine.http, 200);
    assert.ok(mine.json.data.some((g) => g.id === groupId));

    const outsiderMine = await api<Array<{ id: number }>>("GET", "/api/v1/patungan/groups/mine", tokens.outsider);
    assert.ok(!outsiderMine.json.data.some((g) => g.id === groupId));
  });

  it("grup pending kedua di kursus sama ditolak", async () => {
    const r = await api("POST", "/api/v1/patungan/groups", tokens.m3, {
      courseId: ids.paid,
      usernames: [usernames.m1],
    });
    assert.equal(r.http, 409);
    assert.equal(r.json.code, "GROUP_ALREADY_PENDING");
  });
});

describe("patungan: bayar sendiri-sendiri + lunas semua baru akses", () => {
  let groupId = 0;
  let shares: Record<string, number> = {};

  it("iuran per anggota dibuat dengan nominal iuran", async () => {
    const g2 = await api<GroupDetail>("POST", "/api/v1/patungan/groups", tokens.outsider, {
      courseId: ids.paid,
      usernames: [usernames.m3],
    });
    assert.equal(g2.http, 201, JSON.stringify(g2.json));
    groupId = g2.json.data.id;
    for (const m of g2.json.data.members) shares[m.username] = m.shareAmount;

    // Alur baru: undangan harus diterima dulu; bayar sebelum terkunci ditolak.
    const earlyPay = await api(
      "POST",
      `/api/v1/courses/${ids.paid}/payments`,
      tokens.outsider,
      { patunganGroupId: groupId }
    );
    assert.equal(earlyPay.http, 403);
    assert.equal(earlyPay.json.code, "GROUP_NOT_LOCKED");

    const acceptM3 = await api("POST", `/api/v1/patungan/groups/${groupId}/accept`, tokens.m3);
    assert.equal(acceptM3.http, 200, JSON.stringify(acceptM3.json));
    const locked = acceptM3.json.data as GroupDetail;
    assert.equal(
      locked.members.find((m) => m.username === usernames.m3)?.inviteStatus,
      "accepted"
    );

    const pay = await api<PaymentRow>(
      "POST",
      `/api/v1/courses/${ids.paid}/payments`,
      tokens.outsider,
      { patunganGroupId: groupId }
    );
    assert.equal(pay.http, 201, JSON.stringify(pay.json));
    assert.equal(pay.json.data.amountExpected, shares[usernames.outsider]);
    assert.equal(pay.json.data.patunganGroupId, groupId);

    // Voucher tidak boleh digabung iuran patungan.
    const withVoucher = await api(
      "POST",
      `/api/v1/courses/${ids.paid}/payments`,
      tokens.m3,
      { patunganGroupId: groupId, voucherCode: "APA-SAja" }
    );
    assert.equal(withVoucher.http, 400);
    assert.equal(withVoucher.json.code, "PATUNGAN_NO_VOUCHER");
  });

  it("bukan anggota tidak bisa bayar iuran grup", async () => {
    const r = await api("POST", `/api/v1/courses/${ids.paid}/payments`, tokens.m1, {
      patunganGroupId: groupId,
    });
    assert.equal(r.http, 403);
    assert.equal(r.json.code, "PATUNGAN_NOT_MEMBER");
  });

  it("approve sebagian tidak membuka akses siapa pun", async () => {
    const pay = await api<PaymentRow>(
      "POST",
      `/api/v1/courses/${ids.paid}/payments`,
      tokens.m3,
      { patunganGroupId: groupId }
    );
    assert.equal(pay.http, 201);

    const v1 = await api("POST", `/api/v1/admin/payments/${pay.json.data.id}/verify`, tokens.admin, {
      decision: "terima",
      amountPaid: shares[usernames.m3],
    });
    assert.equal(v1.http, 200);
    assert.equal((v1.json.data as { groupCompleted: boolean }).groupCompleted, false);

    assert.equal(await enrollmentOf(ids.m3, ids.paid), null);
    assert.equal(await enrollmentOf(ids.outsider, ids.paid), null);

    const detail = await api<GroupDetail>("GET", `/api/v1/patungan/groups/${groupId}`, tokens.m3);
    assert.equal(detail.json.data.paidCount, 1);
  });

  it("lunas semua → akses semua sekaligus", async () => {
    const outsiderPay = await api<PaymentRow>(
      "POST",
      `/api/v1/courses/${ids.paid}/payments`,
      tokens.outsider,
      { patunganGroupId: groupId }
    );
    assert.equal(outsiderPay.http, 201);
    const v = await api("POST", `/api/v1/admin/payments/${outsiderPay.json.data.id}/verify`, tokens.admin, {
      decision: "terima",
      amountPaid: shares[usernames.outsider],
    });
    assert.equal(v.http, 200);
    assert.equal((v.json.data as { groupCompleted: boolean }).groupCompleted, true);

    for (const uid of [ids.outsider, ids.m3]) {
      const e = await enrollmentOf(uid, ids.paid);
      assert.ok(e, `user ${uid} harus enrolled`);
      assert.equal(e?.status, "active");
      assert.equal(e?.source, "payment:patungan");
    }
    const detail = await api<GroupDetail>("GET", `/api/v1/patungan/groups/${groupId}`, tokens.m3);
    assert.equal(detail.json.data.status, "complete");
  });

  it("verifikasi ganda ditolak (anti-race)", async () => {
    const list = await api<{ items: PaymentRow[] }>(
      "GET",
      `/api/v1/admin/payments?courseId=${ids.paid}`,
      tokens.admin
    );
    const target = list.json.data.items.find((p) => p.patunganGroupId === groupId);
    assert.ok(target);
    const again = await api("POST", `/api/v1/admin/payments/${target!.id}/verify`, tokens.admin, {
      decision: "terima",
      amountPaid: target!.amountExpected,
    });
    assert.equal(again.http, 409);
  });
});

describe("patungan: batal grup", () => {
  it("pembuat boleh batal selama belum ada iuran; admin setelah ada iuran", async () => {
    // Grup pending pertama (creator+m1+m2) masih pending; batalkan dulu.
    const mine = await api<GroupDetail[]>("GET", "/api/v1/patungan/groups/mine", tokens.creator);
    const pending = mine.json.data.find((x) => x.status === "pending");
    assert.ok(pending, "harus ada grup pending milik creator");
    const c = await api("POST", `/api/v1/patungan/groups/${pending!.id}/cancel`, tokens.creator, {
      reason: "batal uji",
    });
    assert.equal(c.http, 200);
    assert.equal((c.json.data as { status: string }).status, "cancelled");

    // Setelah cancel, anggota bebas bikin grup baru lagi.
    const g3 = await api<GroupDetail>("POST", "/api/v1/patungan/groups", tokens.creator, {
      courseId: ids.paid,
      usernames: [usernames.m1],
    });
    assert.equal(g3.http, 201, JSON.stringify(g3.json));

    // Masukkan iuran menunggu, lalu pembuat tidak boleh cancel sendiri.
    // m1 terima undangan dulu (syarat kunci grup sebelum bayar).
    const acceptM1 = await api("POST", `/api/v1/patungan/groups/${g3.json.data.id}/accept`, tokens.m1);
    assert.equal(acceptM1.http, 200, JSON.stringify(acceptM1.json));
    const pay = await api<PaymentRow>("POST", `/api/v1/courses/${ids.paid}/payments`, tokens.m1, {
      patunganGroupId: g3.json.data.id,
    });
    assert.equal(pay.http, 201);
    const selfCancel = await api("POST", `/api/v1/patungan/groups/${g3.json.data.id}/cancel`, tokens.creator, {});
    assert.equal(selfCancel.http, 403);
    assert.equal(selfCancel.json.code, "CANCEL_NEEDS_ADMIN");

    // Admin wajib menulis alasan bila sudah ada iuran masuk.
    const noReason = await api(
      "POST",
      `/api/v1/admin/patungan/groups/${g3.json.data.id}/cancel`,
      tokens.admin,
      {}
    );
    assert.equal(noReason.http, 400);
    assert.equal(noReason.json.code, "CANCEL_REASON_REQUIRED");

    const adminCancel = await api(
      "POST",
      `/api/v1/admin/patungan/groups/${g3.json.data.id}/cancel`,
      tokens.admin,
      { reason: "dibatalkan admin (uji)" }
    );
    assert.equal(adminCancel.http, 200);
    const cancelled = adminCancel.json.data as { status: string; paidMembers: unknown[] };
    assert.equal(cancelled.status, "cancelled");
    assert.equal(cancelled.paidMembers.length, 1);

    // Grup yang dibatalkan tidak bisa dipakai bayar lagi.
    const afterCancel = await api("POST", `/api/v1/courses/${ids.paid}/payments`, tokens.creator, {
      patunganGroupId: g3.json.data.id,
    });
    assert.equal(afterCancel.http, 404);
    assert.equal(afterCancel.json.code, "GROUP_NOT_FOUND");
  });
});

describe("patungan: harga khusus promo (override)", () => {
  it("validasi + grup memakai harga patungan, bukan harga kursus", async () => {
    const [c] = await db.insert(schema.courses).values({
      title: "Kursus Patungan Override Panjang",
      description: "Deskripsi kursus override patungan yang cukup panjang.",
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
    const courseId = Number((c as unknown as { insertId: number }).insertId);

    const camp = await api("POST", "/api/v1/admin/promos", tokens.admin, {
      slug: "patungan-override",
      title: "Patungan Override Panjang Judul",
      type: "patungan",
      status: "active",
    });
    assert.equal(camp.http, 201, JSON.stringify(camp.json));

    const add = await api("POST", "/api/v1/admin/promos/patungan-override/courses", tokens.admin, {
      courseId,
      patunganPrice: 90000,
    });
    assert.equal(add.http, 201, JSON.stringify(add.json));

    const v = await api<{
      ready: boolean;
      total: number;
      creatorShare: number;
      shares: Record<string, number>;
      course: { priceNominal: number; effectivePrice: number; patunganPrice: number | null };
    }>("POST", "/api/v1/patungan/members/validate", tokens.creator, {
      courseId,
      usernames: [usernames.m1, usernames.m2],
    });
    assert.equal(v.http, 200, JSON.stringify(v.json));
    assert.equal(v.json.data.ready, true);
    assert.equal(v.json.data.total, 90000);
    assert.equal(v.json.data.creatorShare, 30000);
    assert.equal(v.json.data.course.priceNominal, 120000);
    assert.equal(v.json.data.course.effectivePrice, 90000);
    assert.equal(v.json.data.course.patunganPrice, 90000);
    const sum = v.json.data.creatorShare + Object.values(v.json.data.shares).reduce((a, b) => a + b, 0);
    assert.equal(sum, 90000);

    const g = await api<GroupDetail>("POST", "/api/v1/patungan/groups", tokens.creator, {
      courseId,
      usernames: [usernames.m1, usernames.m2],
    });
    assert.equal(g.http, 201, JSON.stringify(g.json));
    assert.equal(g.json.data.priceNominal, 90000);
    assert.equal(g.json.data.members.reduce((a, m) => a + m.shareAmount, 0), 90000);
  });
});

describe("patungan: terima/tolak undangan + kunci grup", () => {
  beforeEach(() => resetRateLimitForTest());
  let groupId = 0;

  it("undangan baru berstatus pending; pembuat accepted", async () => {
    const r = await api<GroupDetail>("POST", "/api/v1/patungan/groups", tokens.uKetua, {
      courseId: ids.paid,
      usernames: [usernames.uA, usernames.uB],
    });
    assert.equal(r.http, 201, JSON.stringify(r.json));
    groupId = r.json.data.id;
    const byName = new Map(r.json.data.members.map((m) => [m.username, m]));
    assert.equal(byName.get(usernames.uKetua)?.inviteStatus, "accepted");
    assert.equal(byName.get(usernames.uA)?.inviteStatus, "pending");
    assert.equal(byName.get(usernames.uB)?.inviteStatus, "pending");
    assert.equal(r.json.data.locked, false);
    assert.ok(r.json.data.expiresAt, "expiresAt harus diset");
  });

  it("bukan anggota tidak bisa terima undangan", async () => {
    const r = await api("POST", `/api/v1/patungan/groups/${groupId}/accept`, tokens.uC);
    assert.equal(r.http, 403);
  });

  it("terima undangan mengubah status; tolak menghitung ulang iuran", async () => {
    const a1 = await api<GroupDetail>("POST", `/api/v1/patungan/groups/${groupId}/accept`, tokens.uA);
    assert.equal(a1.http, 200, JSON.stringify(a1.json));
    assert.equal(
      (a1.json.data.members as GroupDetail["members"]).find((m) => m.username === usernames.uA)?.inviteStatus,
      "accepted"
    );

    const d2 = await api<{
      cancelled: boolean;
      group: GroupDetail;
    }>("POST", `/api/v1/patungan/groups/${groupId}/decline`, tokens.uB);
    assert.equal(d2.http, 200, JSON.stringify(d2.json));
    assert.equal(d2.json.data.cancelled, false);
    const members = d2.json.data.group.members;
    assert.equal(members.find((m) => m.username === usernames.uB)?.inviteStatus, "declined");
    // 150000 / 2 anggota aktif = 75000 per orang.
    const active = members.filter((m) => m.inviteStatus !== "declined");
    assert.equal(active.length, 2);
    for (const m of active) assert.equal(m.shareAmount, 75000);
    assert.equal(d2.json.data.group.locked, true);
    const sum = active.reduce((a, m) => a + m.shareAmount, 0);
    assert.equal(sum, 150000);
  });

  it("jawab dua kali ditolak", async () => {
    const again = await api("POST", `/api/v1/patungan/groups/${groupId}/accept`, tokens.uA);
    assert.equal(again.http, 409);
    assert.equal(again.json.code, "INVITE_DECIDED");
  });

  it("rapikan grup uji (batal; belum ada iuran)", async () => {
    const c = await api("POST", `/api/v1/patungan/groups/${groupId}/cancel`, tokens.uKetua, {
      reason: "rapikan uji",
    });
    assert.equal(c.http, 200);
  });
});

describe("patungan: tolak hingga kurang dari 2 → auto-cancel", () => {
  beforeEach(() => resetRateLimitForTest());
  it("grup bubar otomatis dan bisa bikin baru lagi", async () => {
    const r = await api<GroupDetail>("POST", "/api/v1/patungan/groups", tokens.uA, {
      courseId: ids.paid,
      usernames: [usernames.uB],
    });
    assert.equal(r.http, 201, JSON.stringify(r.json));
    const gid = r.json.data.id;

    const d = await api<{ cancelled: boolean; group: GroupDetail }>(
      "POST",
      `/api/v1/patungan/groups/${gid}/decline`,
      tokens.uB
    );
    assert.equal(d.http, 200, JSON.stringify(d.json));
    assert.equal(d.json.data.cancelled, true);
    assert.equal(d.json.data.group.status, "cancelled");
  });
});

describe("patungan: kedaluwarsa grup pending", () => {
  beforeEach(() => resetRateLimitForTest());
  let groupId = 0;

  it("grup lewat batas menjadi expired; terima & bayar ditolak 410", async () => {
    const r = await api<GroupDetail>("POST", "/api/v1/patungan/groups", tokens.uB, {
      courseId: ids.paid,
      usernames: [usernames.uA],
    });
    assert.equal(r.http, 201, JSON.stringify(r.json));
    groupId = r.json.data.id;

    await db
      .update(schema.patunganGroups)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(schema.patunganGroups.id, groupId));

    const detail = await api<GroupDetail>("GET", `/api/v1/patungan/groups/${groupId}`, tokens.uB);
    assert.equal(detail.http, 200);
    assert.equal(detail.json.data.status, "expired");

    const accept = await api("POST", `/api/v1/patungan/groups/${groupId}/accept`, tokens.uA);
    assert.equal(accept.http, 410);
    assert.equal(accept.json.code, "GROUP_EXPIRED");

    const pay = await api("POST", `/api/v1/courses/${ids.paid}/payments`, tokens.uB, {
      patunganGroupId: groupId,
    });
    assert.equal(pay.http, 410);
    assert.equal(pay.json.code, "GROUP_EXPIRED");
  });
});

describe("patungan: tolak dikunci setelah ada iuran", () => {
  beforeEach(() => resetRateLimitForTest());
  it("anggota tidak bisa keluar bila iuran sudah masuk", async () => {
    const r = await api<GroupDetail>("POST", "/api/v1/patungan/groups", tokens.uKetua, {
      courseId: ids.paid,
      usernames: [usernames.uC],
    });
    assert.equal(r.http, 201, JSON.stringify(r.json));
    const gid = r.json.data.id;

    const a = await api("POST", `/api/v1/patungan/groups/${gid}/accept`, tokens.uC);
    assert.equal(a.http, 200);

    const pay = await api<PaymentRow>("POST", `/api/v1/courses/${ids.paid}/payments`, tokens.uKetua, {
      patunganGroupId: gid,
    });
    assert.equal(pay.http, 201, JSON.stringify(pay.json));

    const d = await api("POST", `/api/v1/patungan/groups/${gid}/decline`, tokens.uC);
    assert.equal(d.http, 403);
    assert.equal(d.json.code, "DECLINE_LOCKED");
  });
});
