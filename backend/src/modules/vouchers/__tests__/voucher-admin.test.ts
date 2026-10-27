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
 * Tahap 4 — Voucher, admin pengguna/instruktur, undangan.
 * Uji integrasi HTTP penuh melawan database tes TERPISAH
 * (`aristoteles_test_b7`), TIDAK PERNAH menyentuh database live.
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
let tokens: Record<string, string> = {};
let ids: Record<string, number> = {};
let inviteToken = "";

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
  assert.equal(json.status, "success");
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
    await admin.query("CREATE DATABASE IF NOT EXISTS aristoteles_test_b7");
  } finally {
    await admin.end();
  }
  await migrate(db, { migrationsFolder: path.resolve("drizzle") });

  const hash = await bcrypt.hash(TEST_PASSWORD, 4);
  const mkUser = async (name: string, email: string, role: "admin" | "teacher" | "student") => {
    const [h] = await db.insert(schema.users).values({ name, email, passwordHash: hash, role });
    return Number((h as unknown as { insertId: number }).insertId);
  };
  ids.admin = await mkUser("Admin Uji", "admin@uji.io", "admin");
  ids.teacher = await mkUser("Guru Pengampu", "guru@uji.io", "teacher");
  ids.teacher2 = await mkUser("Guru Asing", "guruasing@uji.io", "teacher");
  ids.s1 = await mkUser("Siswa Satu", "siswa1@uji.io", "student");
  ids.s2 = await mkUser("Siswa Dua", "siswa2@uji.io", "student");
  ids.s3 = await mkUser("Siswa Tiga", "siswa3@uji.io", "student");
  ids.s4 = await mkUser("Siswa Empat", "siswa4@uji.io", "student");
  ids.s5 = await mkUser("Siswa Lima", "siswa5@uji.io", "student");

  const mkCourse = async (title: string, price: number, status: "draft" | "published" = "published", period = "ongoing") => {
    const [h] = await db.insert(schema.courses).values({
      title,
      description: `Deskripsi ${title} yang cukup panjang untuk validasi.`,
      category: "Pengembangan Web",
      level: "Pemula",
      duration: "4 Bulan",
      status,
      priceLabel: price === 0 ? "GRATIS" : `Rp${price}`,
      priceNominal: price,
      period,
      outcomes: ["Hasil belajar pertama yang cukup panjang"],
      tools: ["Laptop"],
      createdBy: ids.teacher,
    });
    return Number((h as unknown as { insertId: number }).insertId);
  };
  ids.paid = await mkCourse("Kursus Berbayar Voucher Cukup Panjang", 150000);
  ids.paid2 = await mkCourse("Kursus Berbayar Kedua Cukup Panjang", 99000);
  ids.paid3 = await mkCourse("Kursus Berbayar Ketiga Cukup Panjang", 50000);
  ids.free = await mkCourse("Kursus Gratis Voucher Cukup Panjang", 0);
  ids.draft = await mkCourse("Kursus Draft Voucher Cukup Panjang", 0, "draft");
  ids.ended = await mkCourse("Kursus Ended Voucher Cukup Panjang", 0, "published", "ended");
  await db.insert(schema.courseInstructors).values({ courseId: ids.paid, userId: ids.teacher });

  const [mH] = await db.insert(schema.modules).values({
    courseId: ids.paid,
    title: "Modul Kuis Bayar Uji Cukup Panjang",
    type: "kuis",
    position: 0,
  });
  ids.modPaid = Number((mH as unknown as { insertId: number }).insertId);
  const [qH] = await db.insert(schema.materials).values({
    moduleId: ids.modPaid,
    title: "Kuis Bayar Untuk Uji Akses Panjang",
    type: "kuis",
    content: "{}",
    position: 0,
  });
  ids.quizPaid = Number((qH as unknown as { insertId: number }).insertId);

  const srv = app.listen(0);
  await once(srv, "listening");
  server = srv;
  const addr = srv.address() as AddressInfo;
  base = `http://127.0.0.1:${addr.port}`;
  tokens = {
    admin: await login("admin@uji.io"),
    teacher: await login("guru@uji.io"),
    teacher2: await login("guruasing@uji.io"),
    s1: await login("siswa1@uji.io"),
    s2: await login("siswa2@uji.io"),
    s3: await login("siswa3@uji.io"),
    s4: await login("siswa4@uji.io"),
    s5: await login("siswa5@uji.io"),
  };
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
    await admin.query("DROP DATABASE aristoteles_test_b7");
  } finally {
    await admin.end();
  }
});

describe("pembuatan & kelola voucher (admin)", () => {
  it("buat umum + personal; validasi ketat; non-admin 403", async () => {
    const umum = await api("POST", "/api/v1/admin/vouchers", tokens.admin, {
      code: "UMUM-B7-01",
      courseId: ids.paid,
      kind: "umum",
      maxUses: 2,
    });
    assert.equal(umum.http, 201);

    const dup = await api("POST", "/api/v1/admin/vouchers", tokens.admin, {
      code: "UMUM-B7-01",
      courseId: ids.paid,
      kind: "umum",
      maxUses: 2,
    });
    assert.equal(dup.http, 409);

    const personal = await api<{ code: string; status: string }>(
      "POST",
      "/api/v1/admin/vouchers",
      tokens.admin,
      { code: "PERSONAL-B7-S2", courseId: ids.paid, kind: "personal", assignedEmail: "siswa2@uji.io" }
    );
    assert.equal(personal.http, 201);
    assert.equal(personal.json.data.status, "assigned");

    for (const [body, note] of [
      [{ courseId: ids.paid, kind: "personal", maxUses: 1 }, "personal tanpa penerima"],
      [{ code: "X1", courseId: ids.paid, kind: "personal", assignedEmail: "siswa2@uji.io", maxUses: 5 }, "personal maxUses>1"],
      [{ code: "X2", courseId: ids.paid, kind: "umum", assignedEmail: "siswa2@uji.io", maxUses: 2 }, "umum ber-penerima"],
      [{ code: "X3", courseId: 999999, kind: "umum", maxUses: 2 }, "kursus hilang"],
      [{ code: "jelek!", courseId: ids.paid, kind: "umum", maxUses: 2 }, "format kode"],
      [{ code: "X4", courseId: ids.paid, kind: "umum" }, "umum tanpa maxUses"],
    ] as const) {
      const r = await api("POST", "/api/v1/admin/vouchers", tokens.admin, body);
      assert.equal(r.http, [400, 404].includes(r.http) ? r.http : -1, note as string);
      assert.ok(r.http === 400 || r.http === 404, note as string);
    }

    const auto = await api<{ code: string }>("POST", "/api/v1/admin/vouchers", tokens.admin, {
      courseId: ids.paid,
      kind: "umum",
      maxUses: 5,
    });
    assert.equal(auto.http, 201);
    assert.match(auto.json.data.code, /^ATS-[0-9A-F]{8}$/);

    const byTeacher = await api("POST", "/api/v1/admin/vouchers", tokens.teacher, {
      code: "X5",
      courseId: ids.paid,
      kind: "umum",
      maxUses: 1,
    });
    assert.equal(byTeacher.http, 403);
  });

  it("list + detail + redemptions kosong", async () => {
    const list = await api<{ items: Array<{ code: string }>; total: number }>(
      "GET",
      `/api/v1/admin/vouchers?courseId=${ids.paid}`,
      tokens.admin
    );
    assert.equal(list.http, 200);
    assert.ok(list.json.data.total >= 3);
    const detail = await api<{ redemptions: unknown[]; remaining: number }>(
      "GET",
      "/api/v1/admin/vouchers/UMUM-B7-01",
      tokens.admin
    );
    assert.equal(detail.json.data.remaining, 2);
    assert.deepEqual(detail.json.data.redemptions, []);
    const miss = await api("GET", "/api/v1/admin/vouchers/TIDAK-ADA", tokens.admin);
    assert.equal(miss.http, 404);
  });
});

describe("penukaran voucher", () => {
  it("umum 2x sukses → redeemed; ke-3 ditolak kuota", async () => {
    const r1 = await api("POST", "/api/v1/vouchers/redeem", tokens.s1, {
      code: "umum-b7-01",
      courseId: ids.paid,
    });
    assert.equal(r1.http, 201);
    const r2 = await api("POST", "/api/v1/vouchers/redeem", tokens.s2, {
      code: "UMUM-B7-01",
      courseId: ids.paid,
    });
    assert.equal(r2.http, 201);
    const r3 = await api("POST", "/api/v1/vouchers/redeem", tokens.s3, {
      code: "UMUM-B7-01",
      courseId: ids.paid,
    });
    assert.equal(r3.http, 403);
    assert.equal(r3.json.code, "QUOTA_EXHAUSTED");
    const detail = await api<{ status: string; usedCount: number }>(
      "GET",
      "/api/v1/admin/vouchers/UMUM-B7-01",
      tokens.admin
    );
    assert.equal(detail.json.data.status, "redeemed");
    assert.equal(detail.json.data.usedCount, 2);
    // Akses benar-benar terbuka via redeem.
    const access = await api<{ hasAccess: boolean }>(
      "GET",
      `/api/v1/courses/${ids.paid}/access`,
      tokens.s1
    );
    assert.equal(access.json.data.hasAccess, true);
  });

  it("personal: pemilik bisa, orang lain 403, ganda 409 presisi", async () => {
    const ok = await api("POST", "/api/v1/vouchers/redeem", tokens.s2, {
      code: "PERSONAL-B7-S2",
      courseId: ids.paid,
    });
    // s2 sudah enrolled via umum → ditolak enrolled, bukan personal check.
    // (alur personal murni diuji pada voucher PERSONAL-B7-S3 di bawah.)
    assert.equal(ok.http, 409);
    assert.equal(ok.json.code, "ALREADY_ENROLLED");

    await api("POST", "/api/v1/admin/vouchers", tokens.admin, {
      code: "PERSONAL-B7-S3",
      courseId: ids.paid2,
      kind: "personal",
      assignedEmail: "siswa3@uji.io",
    });
    const foreign = await api("POST", "/api/v1/vouchers/redeem", tokens.s4, {
      code: "PERSONAL-B7-S3",
      courseId: ids.paid2,
    });
    assert.equal(foreign.http, 403);
    assert.equal(foreign.json.code, "VOUCHER_FOR_ACCOUNT");
    const mine = await api("POST", "/api/v1/vouchers/redeem", tokens.s3, {
      code: "PERSONAL-B7-S3",
      courseId: ids.paid2,
    });
    assert.equal(mine.http, 201);
    // Batalkan enrollment lalu tukar ulang → ALREADY_REDEEMED (kuota utuh).
    await api("POST", `/api/v1/admin/courses/${ids.paid2}/grants/${ids.s3}/revoke`, tokens.admin, {
      reason: "Uji tukar ulang setelah revoke",
    });
    const again = await api("POST", "/api/v1/vouchers/redeem", tokens.s3, {
      code: "PERSONAL-B7-S3",
      courseId: ids.paid2,
    });
    assert.equal(again.http, 409);
    assert.equal(again.json.code, "ALREADY_REDEEMED");
  });

  it("kode salah 404; kursus salah 403; draft/ended ditolak", async () => {
    assert.equal(
      (await api("POST", "/api/v1/vouchers/redeem", tokens.s1, { code: "TIDAK-ADA", courseId: ids.paid })).http,
      404
    );
    await api("POST", "/api/v1/admin/vouchers", tokens.admin, {
      code: "UMUM-B7-MISMATCH",
      courseId: ids.paid,
      kind: "umum",
      maxUses: 5,
    });
    const mismatch = await api("POST", "/api/v1/vouchers/redeem", tokens.s4, {
      code: "UMUM-B7-MISMATCH",
      courseId: ids.free,
    });
    assert.equal(mismatch.http, 403);
    assert.equal(mismatch.json.code, "COURSE_MISMATCH");
    await api("POST", "/api/v1/admin/vouchers", tokens.admin, {
      code: "UMUM-B7-DRAFT",
      courseId: ids.draft,
      kind: "umum",
      maxUses: 5,
    });
    const draftR = await api("POST", "/api/v1/vouchers/redeem", tokens.s4, {
      code: "UMUM-B7-DRAFT",
      courseId: ids.draft,
    });
    assert.equal(draftR.http, 404);
    await api("POST", "/api/v1/admin/vouchers", tokens.admin, {
      code: "UMUM-B7-ENDED",
      courseId: ids.ended,
      kind: "umum",
      maxUses: 5,
    });
    const endedR = await api("POST", "/api/v1/vouchers/redeem", tokens.s4, {
      code: "UMUM-B7-ENDED",
      courseId: ids.ended,
    });
    assert.equal(endedR.http, 403);
    assert.equal(endedR.json.code, "ENROLLMENT_CLOSED");
  });

  it("kedaluwarsa & nonaktif; enable memulihkan", async () => {
    await db.insert(schema.vouchers).values({
      code: "EXPIRED-B7-01",
      courseId: ids.paid,
      kind: "umum",
      maxUses: 5,
      usedCount: 0,
      expiresAt: new Date(Date.now() - 3600_000),
      status: "available",
    });
    const exp = await api("POST", "/api/v1/vouchers/redeem", tokens.s4, {
      code: "EXPIRED-B7-01",
      courseId: ids.paid,
    });
    assert.equal(exp.http, 403);
    assert.equal(exp.json.code, "VOUCHER_EXPIRED");

    await api("POST", "/api/v1/admin/vouchers", tokens.admin, {
      code: "UMUM-B7-TOGGLE",
      courseId: ids.paid2,
      kind: "umum",
      maxUses: 5,
    });
    const dis = await api("POST", "/api/v1/admin/vouchers/UMUM-B7-TOGGLE/disable", tokens.admin, {
      reason: "Dugaan penyalahgunaan",
    });
    assert.equal(dis.http, 200);
    const blocked = await api("POST", "/api/v1/vouchers/redeem", tokens.s4, {
      code: "UMUM-B7-TOGGLE",
      courseId: ids.paid2,
    });
    assert.equal(blocked.http, 403);
    assert.equal(blocked.json.code, "VOUCHER_DISABLED");
    const dis2 = await api("POST", "/api/v1/admin/vouchers/UMUM-B7-TOGGLE/disable", tokens.admin, {});
    assert.equal(dis2.http, 409);
    const en = await api("POST", "/api/v1/admin/vouchers/UMUM-B7-TOGGLE/enable", tokens.admin, {});
    assert.equal(en.http, 200);
    const afterEnable = await api("POST", "/api/v1/vouchers/redeem", tokens.s4, {
      code: "UMUM-B7-TOGGLE",
      courseId: ids.paid2,
    });
    assert.equal(afterEnable.http, 201);
    const en2 = await api("POST", "/api/v1/admin/vouchers/UMUM-B7-TOGGLE/enable", tokens.admin, {});
    assert.equal(en2.http, 409);
  });

  it("concurrency: 5 paralel pada maxUses=2 → tepat 2 sukses", async () => {
    await api("POST", "/api/v1/admin/vouchers", tokens.admin, {
      code: "UMUM-B7-RACE",
      courseId: ids.paid3,
      kind: "umum",
      maxUses: 2,
    });
    const racers = [tokens.s1, tokens.s2, tokens.s3, tokens.s4, tokens.s5];
    const results = await Promise.all(
      racers.map((t) =>
        api("POST", "/api/v1/vouchers/redeem", t, { code: "UMUM-B7-RACE", courseId: ids.paid3 })
      )
    );
    const okCount = results.filter((r) => r.http === 201).length;
    assert.equal(okCount, 2);
    for (const r of results.filter((r) => r.http !== 201)) {
      assert.equal(r.http, 403);
      assert.equal(r.json.code, "QUOTA_EXHAUSTED");
    }
    const detail = await api<{ status: string; usedCount: number }>(
      "GET",
      "/api/v1/admin/vouchers/UMUM-B7-RACE",
      tokens.admin
    );
    assert.equal(detail.json.data.usedCount, 2);
    assert.equal(detail.json.data.status, "redeemed");
  });
});

describe("admin pengguna & penugasan instruktur", () => {
  it("list tanpa hash; buat teacher; nonaktif memblokir login", async () => {
    const list = await api<{ items: Array<Record<string, unknown>>; total: number }>(
      "GET",
      "/api/v1/admin/users?q=siswa1@uji.io",
      tokens.admin
    );
    assert.equal(list.http, 200);
    assert.ok(list.json.data.total >= 1);
    assert.ok(!("passwordHash" in list.json.data.items[0]));

    const created = await api<{ id: number; email: string; role: string }>(
      "POST",
      "/api/v1/admin/users",
      tokens.admin,
      { name: "Guru Baru", email: "gurubaru@uji.io", password: "Katasandi123" }
    );
    assert.equal(created.http, 201);
    assert.equal(created.json.data.role, "teacher");
    const teacherToken = await login("gurubaru@uji.io");
    assert.ok(teacherToken.length > 0);

    const dup = await api("POST", "/api/v1/admin/users", tokens.admin, {
      name: "Duplikat",
      email: "gurubaru@uji.io",
      password: "Katasandi123",
    });
    assert.equal(dup.http, 409);

    const off = await api("PATCH", `/api/v1/admin/users/${ids.s5}`, tokens.admin, {
      isActive: false,
    });
    assert.equal(off.http, 200);
    const blocked = await api("POST", "/api/v1/auth/login", undefined, {
      email: "siswa5@uji.io",
      password: TEST_PASSWORD,
    });
    assert.equal(blocked.http, 403);
    const on = await api("PATCH", `/api/v1/admin/users/${ids.s5}`, tokens.admin, {
      isActive: true,
    });
    assert.equal(on.http, 200);
    tokens.s5 = await login("siswa5@uji.io");

    const self = await api("PATCH", `/api/v1/admin/users/${ids.admin}`, tokens.admin, {
      isActive: false,
    });
    assert.equal(self.http, 400);

    const byTeacher = await api("GET", "/api/v1/admin/users", tokens.teacher);
    assert.equal(byTeacher.http, 403);
  });

  it("assign/unassign pengampu mengubah kewenangan nyata", async () => {
    const before = await api(
      "PUT",
      `/api/v1/materials/${ids.quizPaid}/quiz`,
      tokens.teacher2,
      { questions: [] }
    );
    assert.equal(before.http, 403);

    const asg = await api("POST", `/api/v1/admin/courses/${ids.paid}/instructors`, tokens.admin, {
      email: "guruasing@uji.io",
    });
    assert.equal(asg.http, 201);

    const after = await api("PUT", `/api/v1/materials/${ids.quizPaid}/quiz`, tokens.teacher2, {
      questions: [
        {
          questionText: "2+2?",
          options: [
            { optionText: "4", isCorrect: true },
            { optionText: "5", isCorrect: false },
          ],
        },
      ],
    });
    assert.equal(after.http, 200);

    const asStudent = await api(
      "POST",
      `/api/v1/admin/courses/${ids.paid}/instructors`,
      tokens.admin,
      { userId: ids.s1 }
    );
    assert.equal(asStudent.http, 400);

    const un = await api(
      "DELETE",
      `/api/v1/admin/courses/${ids.paid}/instructors/${ids.teacher2}`,
      tokens.admin
    );
    assert.equal(un.http, 200);
    const afterUn = await api("PUT", `/api/v1/materials/${ids.quizPaid}/quiz`, tokens.teacher2, {
      questions: [],
    });
    assert.equal(afterUn.http, 403);
    const un2 = await api(
      "DELETE",
      `/api/v1/admin/courses/${ids.paid}/instructors/${ids.teacher2}`,
      tokens.admin
    );
    assert.equal(un2.http, 404);
  });
});

describe("undangan instruktur", () => {
  it("buat → validate → accept → login; token sekali pakai", async () => {
    const created = await api<{ id: number; token: string; email: string }>(
      "POST",
      "/api/v1/admin/invitations",
      tokens.admin,
      { email: "instruktur.baru@uji.io", name: "Instruktur Baru", note: "Batch 4" }
    );
    assert.equal(created.http, 201);
    assert.equal(created.json.data.token.length, 64);
    inviteToken = created.json.data.token;

    const listed = await api<{ items: Array<Record<string, unknown>> }>(
      "GET",
      "/api/v1/admin/invitations?status=pending",
      tokens.admin
    );
    assert.ok(listed.json.data.items.some((i) => i.email === "instruktur.baru@uji.io"));
    assert.ok(!("tokenHash" in listed.json.data.items[0]));

    const valid = await api<{ email: string }>(
      "GET",
      `/api/v1/invitations/validate?token=${inviteToken}`
    );
    assert.equal(valid.http, 200);
    assert.equal(valid.json.data.email, "instruktur.baru@uji.io");

    const accepted = await api<{ accessToken: string; user: { role: string; email: string } }>(
      "POST",
      "/api/v1/invitations/accept",
      undefined,
      { token: inviteToken, password: "Katasandi123" }
    );
    assert.equal(accepted.http, 201);
    assert.equal(accepted.json.data.user.role, "teacher");

    const again = await api("POST", "/api/v1/invitations/accept", undefined, {
      token: inviteToken,
      password: "Katasandi123",
    });
    assert.equal(again.http, 409);

    const taken = await api("POST", "/api/v1/admin/invitations", tokens.admin, {
      email: "guru@uji.io",
    });
    assert.equal(taken.http, 409);

    const byTeacher = await api("POST", "/api/v1/admin/invitations", tokens.teacher, {
      email: "x@uji.io",
    });
    assert.equal(byTeacher.http, 403);
  });

  it("revoke & kedaluwarsa menolak aktivasi", async () => {
    const c1 = await api<{ id: number; token: string }>(
      "POST",
      "/api/v1/admin/invitations",
      tokens.admin,
      { email: "batal@uji.io" }
    );
    const rev = await api(
      "POST",
      `/api/v1/admin/invitations/${c1.json.data.id}/revoke`,
      tokens.admin,
      { reason: "Salah alamat" }
    );
    assert.equal(rev.http, 200);
    const useRevoked = await api("POST", "/api/v1/invitations/accept", undefined, {
      token: c1.json.data.token,
      password: "Katasandi123",
    });
    assert.equal(useRevoked.http, 404);

    const c2 = await api<{ id: number; token: string }>(
      "POST",
      "/api/v1/admin/invitations",
      tokens.admin,
      { email: "kedaluwarsa@uji.io", expiresInDays: 1 }
    );
    await db
      .update(schema.instructorInvitations)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(schema.instructorInvitations.id, c2.json.data.id));
    const useExpired = await api(
      "GET",
      `/api/v1/invitations/validate?token=${c2.json.data.token}`
    );
    assert.equal(useExpired.http, 410);
    const acceptExpired = await api("POST", "/api/v1/invitations/accept", undefined, {
      token: c2.json.data.token,
      password: "Katasandi123",
    });
    assert.equal(acceptExpired.http, 410);
  });
});
