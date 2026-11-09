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
 * Profil milik sendiri (semua peran): baca + ubah parsial + avatar.
 * Uji integrasi HTTP penuh melawan database tes TERPISAH
 * (`aristoteles_test_profile`), TIDAK PERNAH menyentuh database live.
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

const tinyPngBase64 = () =>
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]).toString("base64");

async function uploadImage(token: string): Promise<number> {
  const r = await api<{ id: number }>("POST", "/api/v1/uploads", token, {
    filename: "avatar.png",
    mimeType: "image/png",
    kind: "avatar",
    data: tinyPngBase64(),
  });
  assert.equal(r.http, 201, JSON.stringify(r.json));
  return r.json.data.id;
}

before(async () => {
  const admin = await mysql.createConnection({
    host: "localhost",
    port: 3306,
    user: "root",
    password: "",
  });
  try {
    await admin.query("CREATE DATABASE IF NOT EXISTS aristoteles_test_profile");
  } finally {
    await admin.end();
  }
  await migrate(db, { migrationsFolder: path.resolve("drizzle") });

  const hash = await bcrypt.hash(TEST_PASSWORD, 4);
  const mkUser = async (name: string, email: string, role: "student" | "teacher") => {
    const [h] = await db.insert(schema.users).values({
      name,
      username: email.split("@")[0] + "-t",
      email,
      passwordHash: hash,
      role,
      emailVerifiedAt: new Date(),
    });
    return Number((h as unknown as { insertId: number }).insertId);
  };
  ids.s1 = await mkUser("Siswa Profil", "siswa-profil@uji.io", "student");
  ids.s2 = await mkUser("Siswa Kedua", "siswa-kedua@uji.io", "student");
  ids.t1 = await mkUser("Guru Profil", "guru-profil@uji.io", "teacher");

  const srv = app.listen(0);
  await once(srv, "listening");
  server = srv;
  const addr = srv.address() as AddressInfo;
  base = `http://127.0.0.1:${addr.port}`;
  tokens.s1 = await login("siswa-profil@uji.io");
  tokens.s2 = await login("siswa-kedua@uji.io");
  tokens.t1 = await login("guru-profil@uji.io");
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
    await admin.query("DROP DATABASE aristoteles_test_profile");
  } finally {
    await admin.end();
  }
});

interface Profile {
  id: number;
  name: string;
  username: string;
  email: string;
  role: string;
  phone: string | null;
  gender: string | null;
  birthPlace: string | null;
  birthDate: string | null;
  avatarFileId: number | null;
  avatarUrl: string | null;
  coverFileId: number | null;
  coverUrl: string | null;
  emailVerified: boolean;
}

describe("profil milik sendiri", () => {
  it("tanpa token 401; dengan token 200 + bentuk lengkap", async () => {
    assert.equal((await api("GET", "/api/v1/me/profile")).http, 401);
    const r = await api<Profile>("GET", "/api/v1/me/profile", tokens.s1);
    assert.equal(r.http, 200);
    assert.equal(r.json.data.email, "siswa-profil@uji.io");
    assert.equal(r.json.data.phone, null);
    assert.equal(r.json.data.avatarUrl, null);
    assert.equal(r.json.data.emailVerified, true);
  });

  it("patch valid tersimpan + diaudit; string kosong jadi null", async () => {
    const r = await api<Profile>("PATCH", "/api/v1/me/profile", tokens.s1, {
      name: "Siswa Profil Baru",
      phone: "+62 812-3456-7890",
      gender: "L",
      birthPlace: "Madura",
      birthDate: "2001-05-17",
    });
    assert.equal(r.http, 200, JSON.stringify(r.json));
    assert.equal(r.json.data.name, "Siswa Profil Baru");
    assert.equal(r.json.data.phone, "+62 812-3456-7890");
    assert.equal(r.json.data.gender, "L");
    assert.equal(r.json.data.birthPlace, "Madura");
    assert.equal(r.json.data.birthDate, "2001-05-17");

    const logs = await db
      .select()
      .from(schema.auditLogs)
      .where(eq(schema.auditLogs.action, "profile.update"));
    assert.ok(logs.length >= 1);

    const clear = await api<Profile>("PATCH", "/api/v1/me/profile", tokens.s1, {
      phone: "",
      birthPlace: "   ",
    });
    assert.equal(clear.http, 200);
    assert.equal(clear.json.data.phone, null);
    assert.equal(clear.json.data.birthPlace, null);
  });

  it("validasi ketat: telepon/gender/tanggal/username/body", async () => {
    const badPhone = await api("PATCH", "/api/v1/me/profile", tokens.s1, { phone: "abc" });
    assert.equal(badPhone.http, 400);
    const badGender = await api("PATCH", "/api/v1/me/profile", tokens.s1, { gender: "X" });
    assert.equal(badGender.http, 400);
    const future = await api("PATCH", "/api/v1/me/profile", tokens.s1, { birthDate: "2999-01-01" });
    assert.equal(future.http, 400);
    const badDate = await api("PATCH", "/api/v1/me/profile", tokens.s1, { birthDate: "17-05-2001" });
    assert.equal(badDate.http, 400);
    const badUser = await api("PATCH", "/api/v1/me/profile", tokens.s1, { username: "x!" });
    assert.equal(badUser.http, 400);
    const badEmail = await api("PATCH", "/api/v1/me/profile", tokens.s1, { email: "baru@uji.io" });
    assert.equal(badEmail.http, 400);
    const badRole = await api("PATCH", "/api/v1/me/profile", tokens.s1, { role: "admin" });
    assert.equal(badRole.http, 400);
  });

  it("username milik orang lain 409; milik sendiri boleh", async () => {
    const clash = await api("PATCH", "/api/v1/me/profile", tokens.s1, {
      username: "siswa-kedua-t",
    });
    assert.equal(clash.http, 409);
    assert.equal(clash.json.code, "USERNAME_TAKEN");
    const mine = await api<Profile>("PATCH", "/api/v1/me/profile", tokens.s1, {
      username: "siswa-profil-t",
    });
    assert.equal(mine.http, 200);
  });

  it("avatar: milik sendiri tersimpan; milik orang lain/asing ditolak; hapus null", async () => {
    const fileId = await uploadImage(tokens.s1);
    const ok = await api<Profile>("PATCH", "/api/v1/me/profile", tokens.s1, {
      avatarFileId: fileId,
    });
    assert.equal(ok.http, 200);
    assert.equal(ok.json.data.avatarFileId, fileId);
    assert.equal(ok.json.data.avatarUrl, `/api/v1/files/${fileId}/content`);

    const foreign = await api("PATCH", "/api/v1/me/profile", tokens.s2, {
      avatarFileId: fileId,
    });
    assert.equal(foreign.http, 400);
    assert.equal(foreign.json.code, "INVALID_AVATAR");
    // Berkas kind=image (aset kursus) bukan avatar → tolak juga.
    const img = await api<{ id: number }>("POST", "/api/v1/uploads", tokens.t1, {
      filename: "cover.png",
      mimeType: "image/png",
      kind: "image",
      data: tinyPngBase64(),
    });
    assert.equal(img.http, 201);
    const notAvatar = await api("PATCH", "/api/v1/me/profile", tokens.t1, {
      avatarFileId: img.json.data.id,
    });
    assert.equal(notAvatar.http, 400);
    assert.equal(notAvatar.json.code, "INVALID_AVATAR");
    const missing = await api("PATCH", "/api/v1/me/profile", tokens.s1, {
      avatarFileId: 999999,
    });
    assert.equal(missing.http, 400);

    const del = await api<Profile>("DELETE", "/api/v1/me/profile/avatar", tokens.s1);
    assert.equal(del.http, 200);
    assert.equal(del.json.data.avatarFileId, null);
    assert.equal(del.json.data.avatarUrl, null);
  });

  it("sesi /me ikut membawa avatarUrl setelah dipasang", async () => {
    const fileId = await uploadImage(tokens.s2);
    await api("PATCH", "/api/v1/me/profile", tokens.s2, { avatarFileId: fileId });
    const me = await api<{ user: { avatarUrl: string | null } }>(
      "GET",
      "/api/v1/auth/me",
      tokens.s2
    );
    assert.equal(me.http, 200);
    assert.equal(me.json.data.user.avatarUrl, `/api/v1/files/${fileId}/content`);
  });

  it("sampul: milik sendiri tersimpan; kind salah ditolak; null membersihkan", async () => {
    const up = await api<{ id: number }>("POST", "/api/v1/uploads", tokens.s1, {
      filename: "sampul.png",
      mimeType: "image/png",
      kind: "profile_cover",
      data: tinyPngBase64(),
    });
    assert.equal(up.http, 201, JSON.stringify(up.json));
    const ok = await api<Profile>("PATCH", "/api/v1/me/profile", tokens.s1, {
      coverFileId: up.json.data.id,
    });
    assert.equal(ok.http, 200);
    assert.equal(ok.json.data.coverFileId, up.json.data.id);
    assert.equal(ok.json.data.coverUrl, `/api/v1/files/${up.json.data.id}/content`);

    // Berkas avatar bukan sampul → tolak.
    const av = await api<{ id: number }>("POST", "/api/v1/uploads", tokens.s1, {
      filename: "avatar.png",
      mimeType: "image/png",
      kind: "avatar",
      data: tinyPngBase64(),
    });
    assert.equal(av.http, 201);
    const wrong = await api("PATCH", "/api/v1/me/profile", tokens.s1, {
      coverFileId: av.json.data.id,
    });
    assert.equal(wrong.http, 400);
    assert.equal(wrong.json.code, "INVALID_COVER");

    const clear = await api<Profile>("PATCH", "/api/v1/me/profile", tokens.s1, {
      coverFileId: null,
    });
    assert.equal(clear.http, 200);
    assert.equal(clear.json.data.coverFileId, null);
    assert.equal(clear.json.data.coverUrl, null);
  });

  it("guru juga bisa memakai endpoint yang sama", async () => {
    const r = await api<Profile>("GET", "/api/v1/me/profile", tokens.t1);
    assert.equal(r.http, 200);
    assert.equal(r.json.data.role, "teacher");
  });
});
