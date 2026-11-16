import "./test-env-props";
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
 * Pengajuan instruktur ke promo (approve admin).
 * Uji integrasi HTTP penuh melawan database tes TERPISAH
 * (`aristoteles_test_promo_props`), TIDAK PERNAH menyentuh database live.
 * (DB sendiri agar bisa jalan beriringan dengan promo.test.ts.)
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
    await admin.query("CREATE DATABASE IF NOT EXISTS aristoteles_test_promo_props");
  } finally {
    await admin.end();
  }
  await migrate(db, { migrationsFolder: path.resolve("drizzle") });

  const hash = await bcrypt.hash(TEST_PASSWORD, 4);
  const mkUser = async (name: string, email: string, role: "admin" | "teacher" | "student") => {
    const [h] = await db.insert(schema.users).values({ name, username: email.split("@")[0] + "-pp", email, passwordHash: hash, role, emailVerifiedAt: new Date() });
    return Number((h as unknown as { insertId: number }).insertId);
  };
  ids.admin = await mkUser("Admin Usulan", "admin@usulan.io", "admin");
  ids.teacherA = await mkUser("Guru Usulan A", "gurua@usulan.io", "teacher");
  ids.teacherB = await mkUser("Guru Usulan B", "gurub@usulan.io", "teacher");
  ids.student = await mkUser("Siswa Usulan", "siswa@usulan.io", "student");

  const mkCourse = async (
    title: string,
    price: number,
    ownerId: number,
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
      createdBy: ownerId,
    });
    return Number((h as unknown as { insertId: number }).insertId);
  };
  ids.courseA = await mkCourse("Kursus Milik Guru A Untuk Promo", 200000, ids.teacherA);
  ids.courseB = await mkCourse("Kursus Milik Guru B Untuk Promo", 150000, ids.teacherB);
  ids.draftA = await mkCourse("Kursus Draft Milik Guru A Panjang", 100000, ids.teacherA, "draft");

  const srv = app.listen(0);
  await once(srv, "listening");
  server = srv;
  const addr = srv.address() as AddressInfo;
  base = `http://127.0.0.1:${addr.port}`;
  tokens.admin = await login("admin@usulan.io");
  tokens.teacherA = await login("gurua@usulan.io");
  tokens.teacherB = await login("gurub@usulan.io");
  tokens.student = await login("siswa@usulan.io");
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
    await admin.query("DROP DATABASE aristoteles_test_promo_props");
  } finally {
    await admin.end();
  }
});

describe("promo: pengajuan instruktur + approve admin", () => {
  it("instruktur ajukan kursus miliknya; duplikat & milik orang lain ditolak", async () => {
    const mk = await api("POST", "/api/v1/admin/promos", tokens.admin, {
      slug: "promo-usulan",
      title: "Promo Usulan Instruktur Panjang",
      type: "kurasi",
      status: "active",
    });
    assert.equal(mk.http, 201, JSON.stringify(mk.json));

    const ok = await api("POST", "/api/v1/instructor/promos/promo-usulan/proposals", tokens.teacherA, {
      courseId: ids.courseA,
      customBadge: "Pilihan Guru",
      note: "Cocok untuk pemula.",
    });
    assert.equal(ok.http, 201, JSON.stringify(ok.json));

    const dup = await api("POST", "/api/v1/instructor/promos/promo-usulan/proposals", tokens.teacherA, {
      courseId: ids.courseA,
    });
    assert.equal(dup.http, 409);
    assert.equal(dup.json.code, "PROPOSAL_EXISTS");

    const other = await api("POST", "/api/v1/instructor/promos/promo-usulan/proposals", tokens.teacherB, {
      courseId: ids.courseA,
    });
    assert.equal(other.http, 403);
    assert.equal(other.json.code, "NOT_YOUR_COURSE");

    const student = await api("POST", "/api/v1/instructor/promos/promo-usulan/proposals", tokens.student, {
      courseId: ids.courseB,
    });
    assert.equal(student.http, 403);

    const draft = await api("POST", "/api/v1/instructor/promos/promo-usulan/proposals", tokens.teacherA, {
      courseId: ids.draftA,
    });
    assert.equal(draft.http, 400);
    assert.equal(draft.json.code, "COURSE_DRAFT");
  });

  it("proposal pending tidak tampil publik; approve memasukkan kursus", async () => {
    const before = await api<{ courses: Array<{ courseId: number }> }>(
      "GET",
      "/api/v1/promos/promo-usulan"
    );
    assert.equal(before.http, 200);
    assert.ok(!before.json.data.courses.some((m) => m.courseId === ids.courseA));

    const list = await api<Array<{ id: number }>>(
      "GET",
      "/api/v1/admin/promo-proposals?status=pending",
      tokens.admin
    );
    assert.equal(list.http, 200);
    const proposal = list.json.data.find((p) => p.id !== undefined);
    assert.ok(proposal, "pengajuan pending harus terlihat admin");

    const approve = await api("POST", `/api/v1/admin/promo-proposals/${proposal!.id}/approve`, tokens.admin, {});
    assert.equal(approve.http, 200, JSON.stringify(approve.json));

    const after = await api<{ courses: Array<{ courseId: number; badgeLabel: string | null }> }>(
      "GET",
      "/api/v1/promos/promo-usulan"
    );
    assert.equal(after.http, 200);
    const member = after.json.data.courses.find((m) => m.courseId === ids.courseA);
    assert.ok(member, "kursus harus tampil publik setelah approve");
    assert.equal(member!.badgeLabel, "Pilihan Guru");

    const again = await api("POST", `/api/v1/admin/promo-proposals/${proposal!.id}/approve`, tokens.admin, {});
    assert.equal(again.http, 409);
    assert.equal(again.json.code, "PROPOSAL_DECIDED");

    const rePropose = await api("POST", "/api/v1/instructor/promos/promo-usulan/proposals", tokens.teacherA, {
      courseId: ids.courseA,
    });
    assert.equal(rePropose.http, 409);
    assert.equal(rePropose.json.code, "ALREADY_INCLUDED");
  });

  it("instruktur melihat keanggotaan + riwayat; reject tidak masuk promo", async () => {
    const mk = await api("POST", "/api/v1/admin/promos", tokens.admin, {
      slug: "promo-tolak",
      title: "Promo Tolak Pengajuan Panjang",
      type: "kurasi",
      status: "active",
    });
    assert.equal(mk.http, 201);

    const prop = await api<{ id: number }>(
      "POST",
      "/api/v1/instructor/promos/promo-tolak/proposals",
      tokens.teacherB,
      { courseId: ids.courseB }
    );
    assert.equal(prop.http, 201);

    const reject = await api("POST", `/api/v1/admin/promo-proposals/${prop.json.data.id}/reject`, tokens.admin, {
      note: "Belum sesuai kurasi.",
    });
    assert.equal(reject.http, 200, JSON.stringify(reject.json));

    const pub = await api<{ courses: Array<{ courseId: number }> }>("GET", "/api/v1/promos/promo-tolak");
    assert.equal(pub.http, 200);
    assert.ok(!pub.json.data.courses.some((m) => m.courseId === ids.courseB));

    const mine = await api<Array<{ status: string; campaignSlug: string }>>(
      "GET",
      "/api/v1/instructor/promo-proposals",
      tokens.teacherB
    );
    assert.equal(mine.http, 200);
    assert.ok(mine.json.data.some((p) => p.campaignSlug === "promo-tolak" && p.status === "rejected"));

    const memberships = await api<Array<{ slug: string; courseId: number }>>(
      "GET",
      "/api/v1/instructor/promos",
      tokens.teacherA
    );
    assert.equal(memberships.http, 200);
    assert.ok(
      memberships.json.data.some((m) => m.slug === "promo-usulan" && m.courseId === ids.courseA),
      "kursus yang dimasukkan admin/approve harus terlihat instruktur"
    );
    const other = await api<Array<{ slug: string; courseId: number }>>(
      "GET",
      "/api/v1/instructor/promos",
      tokens.teacherB
    );
    assert.equal(other.http, 200);
    assert.ok(!other.json.data.some((m) => m.slug === "promo-tolak" && m.courseId === ids.courseB));
  });

  it("keputusan yang belum dibaca bisa ditandai dibaca", async () => {
    const mk = await api("POST", "/api/v1/admin/promos", tokens.admin, {
      slug: "promo-baca",
      title: "Promo Tandai Dibaca Panjang",
      type: "kurasi",
      status: "active",
    });
    assert.equal(mk.http, 201);

    const prop = await api<{ id: number }>(
      "POST",
      "/api/v1/instructor/promos/promo-baca/proposals",
      tokens.teacherB,
      { courseId: ids.courseB }
    );
    assert.equal(prop.http, 201);

    const approve = await api("POST", `/api/v1/admin/promo-proposals/${prop.json.data.id}/approve`, tokens.admin, {});
    assert.equal(approve.http, 200);

    const before = await api<Array<{ status: string; seenAt: string | null }>>(
      "GET",
      "/api/v1/instructor/promo-proposals",
      tokens.teacherB
    );
    assert.equal(before.http, 200);
    const row = before.json.data.find((p) => p.status === "approved");
    assert.ok(row && row.seenAt === null, "keputusan baru harus belum dibaca");

    const seen = await api<{ seen: number }>(
      "POST",
      "/api/v1/instructor/promo-proposals/seen",
      tokens.teacherB,
      {}
    );
    assert.equal(seen.http, 200, JSON.stringify(seen.json));
    assert.ok(seen.json.data.seen >= 1, "minimal 1 baris ditandai");

    const after = await api<Array<{ status: string; seenAt: string | null }>>(
      "GET",
      "/api/v1/instructor/promo-proposals",
      tokens.teacherB
    );
    assert.ok(after.json.data.every((p) => p.status === "pending" || p.seenAt !== null));

    const repeat = await api<{ seen: number }>(
      "POST",
      "/api/v1/instructor/promo-proposals/seen",
      tokens.teacherB,
      {}
    );
    assert.equal(repeat.http, 200);
    assert.equal(repeat.json.data.seen, 0, "tidak ada yang tersisa untuk ditandai");
  });
});
