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
 * Pengajuan instruktur — uji integrasi HTTP penuh melawan database tes
 * TERPISAH (`aristoteles_test_app`), TIDAK PERNAH menyentuh database live.
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
let adminToken = "";
let studentToken = "";

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

// JPEG minimal valid (magic FFD8FF) + PDF minimal valid (magic %PDF).
const jpegDataUrl =
  "data:image/jpeg;base64," +
  Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(1024, 0)]).toString("base64");
const pdfDataUrl =
  "data:application/pdf;base64," +
  Buffer.from("%PDF-1.4\n%uji pengajuan\n").toString("base64");
const fakePdfDataUrl =
  "data:application/pdf;base64," + Buffer.from("bukan pdf sama sekali").toString("base64");

const submitBody = (email: string, extra: Record<string, unknown> = {}) => ({
  nama: "Calon Mentor Uji",
  email,
  tentang: "Berpengalaman mengajar pemrograman.",
  skill: "Node.js, SQL",
  youtubeTutorial: "https://youtube.com/watch?v=dQw4w9WgXcQ",
  youtubeChannel: "",
  linkedin: "https://linkedin.com/in/calonmentor",
  referralEmail: "",
  ...extra,
});

before(async () => {
  const admin = await mysql.createConnection({
    host: "localhost",
    port: 3306,
    user: "root",
    password: "",
  });
  try {
    await admin.query("CREATE DATABASE IF NOT EXISTS aristoteles_test_app");
  } finally {
    await admin.end();
  }
  await migrate(db, { migrationsFolder: path.resolve("drizzle") });

  const hash = await bcrypt.hash(TEST_PASSWORD, 4);
  await db.insert(schema.users).values({
    name: "Admin Uji",
    username: "admin.uji",
    email: "admin@uji.io",
    passwordHash: hash,
    role: "admin",
    emailVerifiedAt: new Date(),
  });
  await db.insert(schema.users).values({
    name: "Siswa Uji",
    username: "siswa.uji",
    email: "siswa@uji.io",
    passwordHash: hash,
    role: "student",
    emailVerifiedAt: new Date(),
  });

  const srv = app.listen(0);
  await once(srv, "listening");
  server = srv;
  const addr = srv.address() as AddressInfo;
  base = `http://127.0.0.1:${addr.port}`;
  adminToken = await login("admin@uji.io");
  studentToken = await login("siswa@uji.io");
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
    await admin.query("DROP DATABASE aristoteles_test_app");
  } finally {
    await admin.end();
  }
});

describe("pengajuan publik", () => {
  it("submit minimal 201 + kode APL + status submitted", async () => {
    const { http, json } = await api("POST", "/api/v1/instructor-applications", undefined, submitBody("satu@uji.io"));
    assert.equal(http, 201);
    assert.equal(json.status, "success");
    const d = json.data as Record<string, unknown>;
    assert.match(d.code as string, /^APL-[A-HJ-NP-Z2-9]{6}$/);
    assert.equal(d.status, "submitted");
    assert.equal(d.fotoUrl, null);
  });

  it("duplikat email 409 + email user terdaftar 409", async () => {
    const dup = await api("POST", "/api/v1/instructor-applications", undefined, submitBody("satu@uji.io"));
    assert.equal(dup.http, 409);
    assert.equal(dup.json.code, "APPLICATION_EXISTS");
    const taken = await api("POST", "/api/v1/instructor-applications", undefined, submitBody("siswa@uji.io"));
    assert.equal(taken.http, 409);
    assert.equal(taken.json.code, "EMAIL_TAKEN");
  });

  it("host URL salah 400 + PDF palsu 400 + oversize 400", async () => {
    const badUrl = await api("POST", "/api/v1/instructor-applications", undefined, submitBody("dua@uji.io", { youtubeTutorial: "https://vimeo.com/123" }));
    assert.equal(badUrl.http, 400);
    const fakePdf = await api(
      "POST",
      "/api/v1/instructor-applications",
      undefined,
      submitBody("tiga@uji.io", { cv: { filename: "cv.pdf", mimeType: "application/pdf", data: fakePdfDataUrl } })
    );
    assert.equal(fakePdf.http, 400);
    assert.equal(fakePdf.json.code, "FILE_INVALID");
    const big = Buffer.concat([Buffer.from("%PDF-"), Buffer.alloc(6 * 1024 * 1024, 0)]).toString("base64");
    const oversize = await api(
      "POST",
      "/api/v1/instructor-applications",
      undefined,
      submitBody("empat@uji.io", { cv: { filename: "besar.pdf", mimeType: "application/pdf", data: big } })
    );
    assert.equal(oversize.http, 400);
  });
});

describe("berkas + akses admin", () => {
  let appId = 0;
  let fotoUrl = "";
  let cvUrl = "";

  it("submit dengan foto+CV 201 + admin baca byte 200, anonim 403", async () => {
    const { http, json } = await api(
      "POST",
      "/api/v1/instructor-applications",
      undefined,
      submitBody("foto@uji.io", {
        foto: { filename: "foto.jpg", mimeType: "image/jpeg", data: jpegDataUrl },
        cv: { filename: "riwayat.pdf", mimeType: "application/pdf", data: pdfDataUrl },
      })
    );
    assert.equal(http, 201);
    const d = json.data as Record<string, unknown>;
    appId = d.id as number;
    fotoUrl = d.fotoUrl as string;
    cvUrl = d.cvUrl as string;
    assert.ok(fotoUrl.startsWith("/api/v1/files/"));
    assert.ok(cvUrl.startsWith("/api/v1/files/"));

    const asAdmin = await fetch(base + fotoUrl, { headers: { authorization: `Bearer ${adminToken}` } });
    assert.equal(asAdmin.status, 200);
    assert.equal(asAdmin.headers.get("content-type"), "image/jpeg");
    const asAnon = await fetch(base + cvUrl);
    assert.equal(asAnon.status, 403);
  });

  it("endpoint admin wajib admin: 401 tanpa token, 403 student", async () => {
    const noToken = await api("GET", "/api/v1/admin/instructor-applications");
    assert.equal(noToken.http, 401);
    const asStudent = await api("GET", "/api/v1/admin/instructor-applications", studentToken);
    assert.equal(asStudent.http, 403);
  });

  it("list + filter + detail", async () => {
    const list = await api<{ items: unknown[]; total: number }>(
      "GET",
      "/api/v1/admin/instructor-applications",
      adminToken
    );
    assert.equal(list.http, 200);
    assert.ok((list.json.data.total as number) >= 2);
    const q = await api<{ items: Array<{ email: string }>; total: number }>(
      "GET",
      "/api/v1/admin/instructor-applications?q=foto@uji.io",
      adminToken
    );
    assert.equal(q.json.data.total, 1);
    assert.equal(q.json.data.items[0].email, "foto@uji.io");
    const detail = await api("GET", `/api/v1/admin/instructor-applications/${appId}`, adminToken);
    assert.equal(detail.http, 200);
    const missing = await api("GET", "/api/v1/admin/instructor-applications/999999", adminToken);
    assert.equal(missing.http, 404);
  });

  it("review under_review → approved; submitted ditolak", async () => {
    const r1 = await api("PATCH", `/api/v1/admin/instructor-applications/${appId}`, adminToken, { status: "under_review" });
    assert.equal(r1.http, 200);
    assert.equal((r1.json.data as { status: string }).status, "under_review");
    const bad = await api("PATCH", `/api/v1/admin/instructor-applications/${appId}`, adminToken, { status: "submitted" });
    assert.equal(bad.http, 400);
    const r2 = await api("PATCH", `/api/v1/admin/instructor-applications/${appId}`, adminToken, { status: "approved", reviewNote: "Bagus" });
    assert.equal(r2.http, 200);
    assert.equal((r2.json.data as { status: string }).status, "approved");
  });

  it("invite terbitkan undangan + hapus bersihkan berkas", async () => {
    const inv = await api<{ application: { status: string }; invitation: { token: string; email: string; emailSent: boolean; inviteUrl: string } }>(
      "POST",
      `/api/v1/admin/instructor-applications/${appId}/invite`,
      adminToken,
      {}
    );
    assert.equal(inv.http, 201);
    assert.equal(inv.json.data.application.status, "approved");
    assert.ok(inv.json.data.invitation.token.length >= 16);
    assert.equal(inv.json.data.invitation.emailSent, true);
    assert.ok(inv.json.data.invitation.inviteUrl.includes("/invite/"));
    const valid = await api(
      "GET",
      `/api/v1/invitations/validate?token=${inv.json.data.invitation.token}`
    );
    assert.equal(valid.http, 200);

    const del = await api("DELETE", `/api/v1/admin/instructor-applications/${appId}`, adminToken);
    assert.equal(del.http, 200);
    const gone = await api("GET", `/api/v1/admin/instructor-applications/${appId}`, adminToken);
    assert.equal(gone.http, 404);
    const fileGone = await fetch(base + fotoUrl, { headers: { authorization: `Bearer ${adminToken}` } });
    assert.equal(fileGone.status, 404);
  });
});
