import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getTableConfig } from "drizzle-orm/mysql-core";
import { materials } from "../../../db/schema";
import {
  materialInputSchema,
  materialPatchSchema,
} from "../curricula.service";

/**
 * Bagian 1 Batch 1 — ambang kelulusan kuis per materi.
 * Murni validasi skema + zod, tanpa database dan tanpa server.
 */
describe("materials.pass_score (skema Drizzle)", () => {
  it("kolom pass_score ada, NOT NULL, default 70", () => {
    const config = getTableConfig(materials);
    const col = config.columns.find((c) => c.name === "pass_score");
    assert.ok(col, "kolom pass_score harus ada di tabel materials");
    assert.equal(col.notNull, true);
    assert.equal(col.default, 70);
  });
});

const VALID_TIPTAP = JSON.stringify({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "Halo" }] }],
});

const baseInput = {
  title: "Kuis Uji Ambang Cukup Panjang",
  type: "kuis",
  content: VALID_TIPTAP,
  position: 0,
} as const;

describe("materialInputSchema.passScore (0–100, opsional)", () => {
  it("menerima tanpa passScore, 0, 70, dan 100", () => {
    assert.ok(materialInputSchema.safeParse(baseInput).success);
    for (const passScore of [0, 70, 100]) {
      const r = materialInputSchema.safeParse({ ...baseInput, passScore });
      assert.ok(r.success, `passScore ${passScore} harus valid`);
    }
  });

  it("menolak -1, 101, pecahan, string, dan NaN", () => {
    for (const passScore of [-1, 101, 70.5, "80", NaN]) {
      const r = materialInputSchema.safeParse({ ...baseInput, passScore });
      assert.ok(!r.success, `passScore ${String(passScore)} harus ditolak`);
    }
  });

  it("materi non-kuis tetap valid tanpa passScore", () => {
    const r = materialInputSchema.safeParse({ ...baseInput, type: "materi" });
    assert.ok(r.success);
  });
});

describe("materialPatchSchema.passScore", () => {
  it("menerima patch { passScore: 85 }", () => {
    assert.ok(materialPatchSchema.safeParse({ passScore: 85 }).success);
  });

  it("menolak patch { passScore: 101 } dan tetap menolak patch kosong", () => {
    assert.ok(!materialPatchSchema.safeParse({ passScore: 101 }).success);
    assert.ok(!materialPatchSchema.safeParse({}).success);
  });
});
