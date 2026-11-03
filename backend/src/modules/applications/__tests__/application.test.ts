import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getTableConfig } from "drizzle-orm/mysql-core";
import { instructorApplications } from "../../../db/schema";
import {
  listApplicationsSchema,
  reviewApplicationSchema,
  submitApplicationSchema,
} from "../application.service";

/**
 * Pengajuan instruktur — murni skema Drizzle + validasi zod,
 * tanpa database dan tanpa server.
 */
describe("instructor_applications (skema Drizzle)", () => {
  it("kolom inti ada dengan batasan benar", () => {
    const config = getTableConfig(instructorApplications);
    const byName = new Map(config.columns.map((c) => [c.name, c]));
    for (const name of [
      "code",
      "name",
      "email",
      "photo_file_id",
      "cv_file_id",
      "status",
      "reviewed_by",
    ]) {
      assert.ok(byName.has(name), `kolom ${name} harus ada`);
    }
    assert.equal(byName.get("code")?.notNull, true);
    assert.equal(byName.get("email")?.notNull, true);
    assert.equal(byName.get("status")?.notNull, true);
    assert.equal(byName.get("status")?.default, "submitted");
    assert.equal(byName.get("photo_file_id")?.notNull, false);
    assert.equal(byName.get("cv_file_id")?.notNull, false);
  });
});

const validInput = {
  nama: "Calon Mentor Panjang",
  email: "calon@mentor.id",
  tentang: "Berpengalaman mengajar.",
  skill: "Node.js, SQL",
  youtubeTutorial: "https://youtube.com/watch?v=dQw4w9WgXcQ",
  youtubeChannel: "https://youtube.com/@mentor",
  linkedin: "https://linkedin.com/in/mentor",
  referralEmail: "ref@mentor.id",
};

describe("submitApplicationSchema (zod)", () => {
  it("menerima input minimal valid + menormalkan email", () => {
    const r = submitApplicationSchema.safeParse({
      nama: "Ana",
      email: "  ANA@Mail.ID ",
    });
    assert.ok(r.success);
    if (r.success) assert.equal(r.data.email, "ana@mail.id");
  });

  it("menerima input lengkap valid", () => {
    assert.ok(submitApplicationSchema.safeParse(validInput).success);
  });

  it("menolak nama pendek, email jelek, tentang >1000", () => {
    assert.ok(!submitApplicationSchema.safeParse({ ...validInput, nama: "Al" }).success);
    assert.ok(
      !submitApplicationSchema.safeParse({ ...validInput, email: "bukan-email" }).success
    );
    assert.ok(
      !submitApplicationSchema.safeParse({ ...validInput, tentang: "x".repeat(1001) })
        .success
    );
  });

  it("menolak host URL salah (mirror validasi frontend)", () => {
    assert.ok(
      !submitApplicationSchema.safeParse({
        ...validInput,
        youtubeTutorial: "https://vimeo.com/123",
      }).success
    );
    assert.ok(
      !submitApplicationSchema.safeParse({
        ...validInput,
        linkedin: "https://youtube.com/@x",
      }).success
    );
    assert.ok(
      submitApplicationSchema.safeParse({ ...validInput, youtubeTutorial: "", linkedin: "" })
        .success
    );
  });

  it("menolak kunci tak dikenal (strict)", () => {
    assert.ok(
      !submitApplicationSchema.safeParse({ ...validInput, isAdmin: true }).success
    );
  });
});

describe("listApplicationsSchema + reviewApplicationSchema (zod)", () => {
  it("list: default page 1 limit 20, tolak status asing", () => {
    const r = listApplicationsSchema.safeParse({});
    assert.ok(r.success);
    if (r.success) {
      assert.equal(r.data.page, 1);
      assert.equal(r.data.limit, 20);
    }
    assert.ok(!listApplicationsSchema.safeParse({ status: "diterima" }).success);
    assert.ok(listApplicationsSchema.safeParse({ status: "approved" }).success);
  });

  it("review: hanya under_review/approved/rejected", () => {
    assert.ok(
      reviewApplicationSchema.safeParse({ status: "approved" }).success
    );
    assert.ok(
      !reviewApplicationSchema.safeParse({ status: "submitted" }).success
    );
  });
});
