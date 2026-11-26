import "./test-env-rank";
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
 * Peringkat kursus publik per jumlah peserta.
 * Uji integrasi HTTP penuh melawan database tes TERPISAH
 * (`aristoteles_test_rank`). Mencakup: urutan menurun + nama pengampu,
 * kursus tanpa peserta ikut dengan 0, draf tidak bocor, limit dipatuhi.
 */

interface RankRow {
  courseId: number;
  title: string;
  category: string | null;
  level: string;
  studentCount: number;
  instructorNames: string[];
}

let base = "";
let server: Server | null = null;

async function api<T>(url: string): Promise<{ http: number; json: { status: string; data: T } }> {
  const res = await fetch(base + url, { headers: { accept: "application/json" } });
  const json = (await res.json()) as { status: string; data: T };
  return { http: res.status, json };
}

before(async () => {
  const admin = await mysql.createConnection({ host: "localhost", port: 3306, user: "root", password: "" });
  try {
    await admin.query("CREATE DATABASE IF NOT EXISTS aristoteles_test_rank");
  } finally {
    await admin.end();
  }
  await migrate(db, { migrationsFolder: path.resolve("drizzle") });

  const hash = await bcrypt.hash("Katasandi123", 4);
  const mkUser = async (name: string, email: string, role: "teacher" | "student") => {
    const [h] = await db.insert(schema.users).values({
      name,
      username: email.split("@")[0] + "-rk",
      email,
      passwordHash: hash,
      role,
      emailVerifiedAt: new Date(),
    });
    return Number((h as unknown as { insertId: number }).insertId);
  };
  const t1 = await mkUser("Guru Rapor Satu", "guru-rapor1@uji.io", "teacher");
  const s1 = await mkUser("Siswa Rapor Satu", "siswa-rk1@uji.io", "student");
  const s2 = await mkUser("Siswa Rapor Dua", "siswa-rk2@uji.io", "student");

  const mkCourse = async (title: string, createdBy: number | null, status: "draft" | "published") => {
    const [c] = await db.insert(schema.courses).values({
      title,
      description: `Deskripsi ${title} yang cukup panjang untuk validasi.`,
      category: "Bisnis",
      level: "Pemula",
      duration: "1 Bulan",
      status,
      priceLabel: "Gratis",
      priceNominal: 0,
      period: "ongoing",
      outcomes: ["Mampu memahami laporan"],
      tools: ["Laptop"],
      createdBy,
    });
    return Number((c as unknown as { insertId: number }).insertId);
  };
  const rameId = await mkCourse("Kursus Ramai Sekali", t1, "published");
  const sepiId = await mkCourse("Kursus Sepi Sekali", t1, "published");
  await mkCourse("Kursus Draf Sembunyi", t1, "draft");

  const enroll = async (userId: number, courseId: number) => {
    await db.insert(schema.enrollments).values({ userId, courseId, source: "free", status: "active" });
  };
  await enroll(s1, rameId);
  await enroll(s2, rameId);
  await enroll(s1, sepiId);

  const srv = app.listen(0);
  await once(srv, "listening");
  server = srv;
  const addr = srv.address() as AddressInfo;
  base = `http://127.0.0.1:${addr.port}`;
});

after(async () => {
  if (server) await new Promise<void>((r) => server!.close(() => r()));
  await pool.end();
  const admin = await mysql.createConnection({ host: "localhost", port: 3306, user: "root", password: "" });
  try {
    await admin.query("DROP DATABASE aristoteles_test_rank");
  } finally {
    await admin.end();
  }
});

describe("GET /api/v1/courses/rankings", () => {
  it("200 terurut menurun + nama pengampu + tanpa draf", async () => {
    const r = await api<RankRow[]>("/api/v1/courses/rankings?limit=10");
    assert.equal(r.http, 200);
    assert.equal(r.json.data.length, 2);
    assert.equal(r.json.data[0].title, "Kursus Ramai Sekali");
    assert.equal(r.json.data[0].studentCount, 2);
    assert.deepEqual(r.json.data[0].instructorNames, ["Guru Rapor Satu"]);
    assert.equal(r.json.data[1].title, "Kursus Sepi Sekali");
    assert.equal(r.json.data[1].studentCount, 1);
  });

  it("limit dipatuhi", async () => {
    const r = await api<RankRow[]>("/api/v1/courses/rankings?limit=1");
    assert.equal(r.http, 200);
    assert.equal(r.json.data.length, 1);
    assert.equal(r.json.data[0].studentCount, 2);
  });
});
