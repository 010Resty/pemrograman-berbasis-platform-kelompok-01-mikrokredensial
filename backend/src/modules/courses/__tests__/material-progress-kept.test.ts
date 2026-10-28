import "./k08-test-env";
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import mysql from "mysql2/promise";
import { migrate } from "drizzle-orm/mysql2/migrator";
import { and, eq } from "drizzle-orm";
import { db, pool } from "../../../db/index";
import * as schema from "../../../db/schema";
import { patchMaterial, patchModule, patchSubModule } from "../curricula.service";
import { getProgress } from "../../progress/progress.service";

/**
 * K-08 (bagian tanpa keputusan): ubah materi/modul/sub-modul TIDAK BOLEH
 * menghapus progres peserta yang sudah tercatat.
 * Uji integrasi langsung ke service + database tes TERPISAH
 * (`aristoteles_test_b10`), TIDAK PERNAH menyentuh database live.
 * Versi/log perubahan + pengulangan selektif belum diputuskan
 * (butuh definisi "penting" + migrasi) sehingga tidak diuji di sini.
 *
 * Jalankan dari folder backend/: npx tsx --test <file-ini>
 */

let userId = 0;
let moduleId = 0;
let subId = 0;
let materialId = 0;

before(async () => {
  const admin = await mysql.createConnection({
    host: "localhost",
    port: 3306,
    user: "root",
    password: "",
  });
  try {
    await admin.query("CREATE DATABASE IF NOT EXISTS aristoteles_test_b10");
  } finally {
    await admin.end();
  }
  await migrate(db, { migrationsFolder: path.resolve("drizzle") });

  const [uH] = await db.insert(schema.users).values({
    name: "Siswa Uji",
    email: "siswa@uji.io",
    passwordHash: "hash-uji",
    role: "student",
  });
  userId = Number((uH as unknown as { insertId: number }).insertId);
  const [cH] = await db.insert(schema.courses).values({
    title: "Kursus Uji K-08 Cukup Panjang",
    description: "Deskripsi kursus uji K-08 yang cukup panjang.",
    category: "Pengembangan Web",
    level: "Pemula",
    duration: "4 Bulan",
    status: "published",
    priceLabel: "GRATIS",
    priceNominal: 0,
    period: "ongoing",
    outcomes: ["Hasil belajar pertama yang cukup panjang"],
    tools: ["Laptop"],
  });
  const courseId = Number((cH as unknown as { insertId: number }).insertId);
  const [mH] = await db.insert(schema.modules).values({
    courseId,
    title: "Modul Uji K-08 Cukup Panjang",
    type: "materi",
    position: 0,
  });
  moduleId = Number((mH as unknown as { insertId: number }).insertId);
  const [sH] = await db.insert(schema.subModules).values({
    moduleId,
    title: "Sub Modul Uji K-08",
    position: 0,
  });
  subId = Number((sH as unknown as { insertId: number }).insertId);
  const [tH] = await db.insert(schema.materials).values({
    moduleId,
    subModuleId: subId,
    title: "Materi Uji K-08 Cukup Panjang",
    type: "materi",
    position: 0,
  });
  materialId = Number((tH as unknown as { insertId: number }).insertId);
  await db.insert(schema.enrollments).values({
    userId,
    courseId,
    source: "free",
    status: "active",
  });
  await db.insert(schema.progress).values({ userId, materialId });
});

after(async () => {
  await pool.end();
  const admin = await mysql.createConnection({
    host: "localhost",
    port: 3306,
    user: "root",
    password: "",
  });
  try {
    await admin.query("DROP DATABASE aristoteles_test_b10");
  } finally {
    await admin.end();
  }
});

const progressCount = async (): Promise<number> => {
  const rows = await db
    .select({ materialId: schema.progress.materialId })
    .from(schema.progress)
    .where(
      and(
        eq(schema.progress.userId, userId),
        eq(schema.progress.materialId, materialId)
      )
    );
  return rows.length;
};

describe("K-08: ubah materi tidak menghapus progres", () => {
  it("PATCH materi (judul) mempertahankan baris progres", async () => {
    assert.equal(await progressCount(), 1);
    await patchMaterial(materialId, { title: "Materi Uji K-08 Diubah Judulnya" });
    assert.equal(await progressCount(), 1);
    assert.notEqual(await getProgress(userId, materialId), null);
  });

  it("PATCH modul dan sub-modul mempertahankan baris progres", async () => {
    await patchModule(moduleId, { title: "Modul Uji K-08 Diubah" });
    await patchSubModule(subId, { title: "Sub Modul Uji K-08 Diubah" });
    assert.equal(await progressCount(), 1);
    assert.notEqual(await getProgress(userId, materialId), null);
  });
});
