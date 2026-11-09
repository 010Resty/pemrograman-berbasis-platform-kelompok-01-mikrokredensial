import "./test-env-auto";
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
 * Penerbitan otomatis sertifikat: selesai progres / lulus kuis / lulus tugas
 * langsung menerbitkan sertifikat modul bila seluruh syarat terpenuhi —
 * tanpa klik tombol terbit manual. Uji integrasi HTTP penuh melawan
 * database tes TERPISAH (`aristoteles_test_cert_auto`), TIDAK PERNAH
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

async function myCertificates(token: string): Promise<Array<{ moduleId: number | null; status: string }>> {
  const r = await api<Array<{ moduleId: number; status: string }>>(
    "GET",
    "/api/v1/me/certificates",
    token
  );
  assert.equal(r.http, 200, JSON.stringify(r.json));
  return r.json.data;
}

before(async () => {
  const admin = await mysql.createConnection({
    host: "localhost",
    port: 3306,
    user: "root",
    password: "",
  });
  try {
    await admin.query("CREATE DATABASE IF NOT EXISTS aristoteles_test_cert_auto");
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
  ids.teacher = await mkUser("Guru Oto", "guru-oto@uji.io", "teacher");
  ids.s1 = await mkUser("Siswa Oto Satu", "s1-oto@uji.io", "student");

  const [cH] = await db.insert(schema.courses).values({
    title: "Kursus Oto Uji Cukup Panjang",
    description: "Deskripsi kursus oto uji yang cukup panjang.",
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

  // Modul A: 2 materi biasa (wajib selesai semua).
  const [mA] = await db.insert(schema.modules).values({
    courseId: ids.course,
    title: "Modul Oto Dua Materi Panjang",
    type: "materi",
    position: 0,
  });
  ids.modA = Number((mA as unknown as { insertId: number }).insertId);
  // Modul B: 1 materi biasa (1x progres langsung lengkap).
  const [mB] = await db.insert(schema.modules).values({
    courseId: ids.course,
    title: "Modul Oto Satu Materi Panjang",
    type: "materi",
    position: 1,
  });
  ids.modB = Number((mB as unknown as { insertId: number }).insertId);
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
  ids.matA1 = await mkMat(ids.modA, "Materi A Satu Cukup Panjang");
  ids.matA2 = await mkMat(ids.modA, "Materi A Dua Cukup Panjang");
  ids.matB1 = await mkMat(ids.modB, "Materi B Satu Cukup Panjang");

  const srv = app.listen(0);
  await once(srv, "listening");
  server = srv;
  const addr = srv.address() as AddressInfo;
  base = `http://127.0.0.1:${addr.port}`;
  tokens.teacher = await login("guru-oto@uji.io");
  tokens.s1 = await login("s1-oto@uji.io");
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
    await admin.query("DROP DATABASE aristoteles_test_cert_auto");
  } finally {
    await admin.end();
  }
});

describe("penerbitan otomatis saat syarat modul lengkap", () => {
  it("progres sebagian tidak menerbitkan apa pun", async () => {
    const p = await api<{ completed: boolean; certificateIssued: boolean }>(
      "POST",
      `/api/v1/materials/${ids.matA1}/progress`,
      tokens.s1
    );
    assert.equal(p.http, 200, JSON.stringify(p.json));
    assert.equal(p.json.data.certificateIssued, false);
    const certs = await myCertificates(tokens.s1);
    assert.equal(certs.length, 0);
  });

  it("progres terakhir melengkapi modul → sertifikat langsung terbit", async () => {
    const p = await api<{ completed: boolean; certificateIssued: boolean }>(
      "POST",
      `/api/v1/materials/${ids.matA2}/progress`,
      tokens.s1
    );
    assert.equal(p.http, 200, JSON.stringify(p.json));
    assert.equal(p.json.data.certificateIssued, true);
    const certs = await myCertificates(tokens.s1);
    assert.equal(certs.length, 1);
    assert.equal(certs[0]?.moduleId, ids.modA);
    assert.equal(certs[0]?.status, "issued");
  });

  it("modul satu materi terbit dalam sekali progres; idempoten", async () => {
    const p = await api<{ completed: boolean; certificateIssued: boolean }>(
      "POST",
      `/api/v1/materials/${ids.matB1}/progress`,
      tokens.s1
    );
    assert.equal(p.http, 200);
    assert.equal(p.json.data.certificateIssued, true);

    const again = await api<{ completed: boolean; certificateIssued: boolean }>(
      "POST",
      `/api/v1/materials/${ids.matB1}/progress`,
      tokens.s1
    );
    assert.equal(again.http, 200);
    assert.equal(again.json.data.certificateIssued, false);

    const certs = await myCertificates(tokens.s1);
    // Fase B: kedua modul tuntas → sertifikat kursus terbit otomatis,
    // sertifikat modul disupersede (sembunyi dari daftar).
    assert.equal(certs.length, 1);
    assert.equal(certs[0]?.moduleId, null);
    assert.equal(certs[0]?.status, "issued");
  });
});
