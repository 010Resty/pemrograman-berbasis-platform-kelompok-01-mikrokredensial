import "./test-env-course";
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
 * Fase B — Sertifikat kursus: modul terakhir tuntas → 1 sertifikat kursus
 * terbit otomatis + sertifikat modul disupersede (sembunyi dari daftar,
 * riwayat + verifikasi tetap menjelaskan). Uji integrasi HTTP penuh melawan
 * database tes TERPISAH (`aristoteles_test_cert_course`), TIDAK PERNAH
 * menyentuh database live.
 *
 * Jalankan dari folder backend/: npx tsx --test <file-ini>
 */

const TEST_PASSWORD = "Katasandi123";

interface Envelope<T> {
  status: "success" | "error";
  message?: string;
  code?: string;
  data: T;
}

let base = "";
let server: Server | null = null;
const tokens: Record<string, string> = {};
const ids: Record<string, number> = {};
let modACertId = 0;
let modACode = "";
let courseCode = "";

interface MyCert {
  id: number;
  code: string;
  moduleId: number | null;
  moduleTitle: string | null;
  status: string;
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
  assert.equal(http, 200, `login ${email}: ${JSON.stringify(json)}`);
  return json.data.accessToken;
}

async function myCertificates(token: string): Promise<MyCert[]> {
  const r = await api<MyCert[]>("GET", "/api/v1/me/certificates", token);
  assert.equal(r.http, 200, JSON.stringify(r.json));
  return r.json.data;
}

async function dl(token: string, id: number) {
  const res = await fetch(`${base}/api/v1/me/certificates/${id}/download`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const buf = Buffer.from(await res.arrayBuffer());
  return {
    http: res.status,
    type: res.headers.get("content-type"),
    buf,
    text: res.headers.get("content-type")?.includes("json") ? buf.toString("utf8") : "",
  };
}

before(async () => {
  const admin = await mysql.createConnection({
    host: "localhost",
    port: 3306,
    user: "root",
    password: "",
  });
  try {
    await admin.query("CREATE DATABASE IF NOT EXISTS aristoteles_test_cert_course");
  } finally {
    await admin.end();
  }
  await migrate(db, { migrationsFolder: path.resolve("drizzle") });

  const hash = await bcrypt.hash(TEST_PASSWORD, 4);
  const mkUser = async (name: string, email: string, role: "teacher" | "student") => {
    const [h] = await db
      .insert(schema.users)
      .values({ name, username: email.split("@")[0] + "-t", email, passwordHash: hash, role, emailVerifiedAt: new Date() });
    return Number((h as unknown as { insertId: number }).insertId);
  };
  ids.teacher = await mkUser("Guru Kursus", "guru-kursus@uji.io", "teacher");
  ids.s1 = await mkUser("Siswa Kursus", "siswa-kursus@uji.io", "student");

  const [cH] = await db.insert(schema.courses).values({
    title: "Kursus Dua Modul Uji Panjang",
    description: "Deskripsi kursus dua modul uji yang cukup panjang.",
    category: "Pengembangan Web",
    level: "Pemula",
    duration: "4 Bulan",
    status: "published",
    priceLabel: "GRATIS",
    priceNominal: 0,
    period: "ongoing",
    outcomes: ["Hasil belajar pertama yang cukup panjang"],
    tools: ["Laptop"],
    createdBy: ids.teacher,
  });
  ids.course = Number((cH as unknown as { insertId: number }).insertId);
  await db.insert(schema.courseInstructors).values({ courseId: ids.course, userId: ids.teacher });
  await db.insert(schema.enrollments).values({
    userId: ids.s1,
    courseId: ids.course,
    source: "free",
    status: "active",
  });

  const mkModule = async (title: string, position: number) => {
    const [h] = await db.insert(schema.modules).values({
      courseId: ids.course,
      title,
      type: "materi",
      position,
    });
    return Number((h as unknown as { insertId: number }).insertId);
  };
  ids.modA = await mkModule("Modul Kursus A Cukup Panjang", 0);
  ids.modB = await mkModule("Modul Kursus B Cukup Panjang", 1);
  // Modul kosong: tak pernah bersertifikat, tak boleh menghalangi kursus tuntas.
  await mkModule("Modul Kosong Tanpa Materi Panjang", 2);

  const mkMat = async (moduleId: number, title: string) => {
    const [h] = await db.insert(schema.materials).values({
      moduleId,
      title,
      type: "materi",
      content: JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Halo" }] }] }),
      position: 0,
    });
    return Number((h as unknown as { insertId: number }).insertId);
  };
  ids.matA1 = await mkMat(ids.modA, "Materi Modul A Cukup Panjang");
  ids.matB1 = await mkMat(ids.modB, "Materi Modul B Cukup Panjang");

  const srv = app.listen(0);
  await once(srv, "listening");
  server = srv;
  const addr = srv.address() as AddressInfo;
  base = `http://127.0.0.1:${addr.port}`;
  tokens.teacher = await login("guru-kursus@uji.io");
  tokens.s1 = await login("siswa-kursus@uji.io");
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
    await admin.query("DROP DATABASE aristoteles_test_cert_course");
  } finally {
    await admin.end();
  }
});

describe("sertifikat kursus + supersede modul", () => {
  it("modul pertama tuntas → sertifikat modul saja", async () => {
    const p = await api<{ completed: boolean; certificateIssued: boolean }>(
      "POST",
      `/api/v1/materials/${ids.matA1}/progress`,
      tokens.s1
    );
    assert.equal(p.http, 200, JSON.stringify(p.json));
    assert.equal(p.json.data.certificateIssued, true);
    const certs = await myCertificates(tokens.s1);
    assert.equal(certs.length, 1);
    assert.equal(certs[0]?.moduleId, ids.modA);
    assert.equal(certs[0]?.status, "issued");
    modACertId = certs[0]?.id ?? 0;
    modACode = certs[0]?.code ?? "";
    assert.ok(modACertId > 0 && modACode);
  });

  it("modul terakhir tuntas → kursus terbit + modul disupersede", async () => {
    const p = await api<{ completed: boolean; certificateIssued: boolean }>(
      "POST",
      `/api/v1/materials/${ids.matB1}/progress`,
      tokens.s1
    );
    assert.equal(p.http, 200, JSON.stringify(p.json));
    // Daftar hanya menampakkan 1 sertifikat kursus (modul disembunyikan).
    const certs = await myCertificates(tokens.s1);
    assert.equal(certs.length, 1);
    assert.equal(certs[0]?.moduleId, null);
    assert.equal(certs[0]?.moduleTitle, null);
    assert.equal(certs[0]?.status, "issued");
    courseCode = certs[0]?.code ?? "";
    assert.ok(courseCode);

    // Verifikasi kode modul lama: superseded + menunjuk pengganti.
    const vMod = await api<{ status: string; moduleTitle: string }> (
      "GET",
      `/api/v1/certificates/verify/${modACode}`
    );
    assert.equal(vMod.http, 200);
    assert.equal(vMod.json.data.status, "superseded");

    // Verifikasi kode kursus: issued level kursus.
    const vCourse = await api<{ status: string; moduleTitle: string | null }>(
      "GET",
      `/api/v1/certificates/verify/${courseCode}`
    );
    assert.equal(vCourse.http, 200);
    assert.equal(vCourse.json.data.status, "issued");
    assert.equal(vCourse.json.data.moduleTitle, null);
  });

  it("unduh: kursus 200 PDF; modul lama 410 + kode pengganti", async () => {
    const certs = await myCertificates(tokens.s1);
    const courseId = certs[0]?.id ?? 0;
    const pdf = await dl(tokens.s1, courseId);
    assert.equal(pdf.http, 200);
    assert.ok(pdf.type?.includes("application/pdf"));
    assert.equal(pdf.buf.subarray(0, 5).toString("utf8"), "%PDF-");

    const old = await dl(tokens.s1, modACertId);
    assert.equal(old.http, 410);
    assert.ok(old.text.includes(courseCode), `pesan harus memuat kode pengganti: ${old.text}`);
  });

  it("idempoten: progres ulang tak gandakan sertifikat kursus", async () => {
    await api("POST", `/api/v1/materials/${ids.matB1}/progress`, tokens.s1);
    const certs = await myCertificates(tokens.s1);
    assert.equal(certs.length, 1);
    assert.equal(certs[0]?.code, courseCode);
    // Riwayat instruktur tetap mencatat 3 baris (2 superseded + 1 issued).
    const all = await api<{ total: number }>(
      "GET",
      `/api/v1/instructor/certificates?courseId=${ids.course}`,
      tokens.teacher
    );
    assert.equal(all.http, 200);
    assert.equal(all.json.data.total, 3);
  });
});
