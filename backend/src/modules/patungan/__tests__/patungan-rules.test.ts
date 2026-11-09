import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  PATUNGAN_MAX_MEMBERS,
  PATUNGAN_MIN_MEMBERS,
  buildGroupCode,
  splitShares,
} from "../patungan.rules";
import { isValidUsername, normalizeUsername } from "../../../utils/username";

/** Aturan murni patungan — tanpa database. */
describe("patungan rules", () => {
  it("batas anggota 2–15 termasuk pembuat", () => {
    assert.equal(PATUNGAN_MIN_MEMBERS, 2);
    assert.equal(PATUNGAN_MAX_MEMBERS, 15);
  });

  it("splitShares habis dibagi, jumlah = nominal", () => {
    for (const [total, n] of [
      [150000, 3],
      [100000, 3],
      [100001, 3],
      [50000, 2],
      [99999, 15],
      [7, 5],
    ] as Array<[number, number]>) {
      const shares = splitShares(total, n);
      assert.equal(shares.length, n);
      assert.equal(
        shares.reduce((a, b) => a + b, 0),
        total,
        `total ${total} / ${n} orang`
      );
      assert.ok(Math.max(...shares) - Math.min(...shares) <= 1, "selisih maksimal Rp1");
    }
  });

  it("splitShares menolak nominal/jumlah di luar batas", () => {
    for (const fn of [
      () => splitShares(0, 3),
      () => splitShares(-5, 3),
      () => splitShares(100000, 1),
      () => splitShares(100000, 16),
    ]) {
      assert.throws(fn);
    }
  });

  it("buildGroupCode format PTG-XXXXXX", () => {
    const codes = new Set(Array.from({ length: 200 }, () => buildGroupCode()));
    assert.ok(codes.size > 190, "kode harus acak");
    for (const c of codes) assert.match(c, /^PTG-[A-Z2-9]{6}$/);
  });

  it("normalizeUsername trim + lowercase", () => {
    assert.equal(normalizeUsername("  Budi.Santoso_9 "), "budi.santoso_9");
  });

  it("isValidUsername menerima pola 3–30 karakter", () => {
    assert.ok(isValidUsername("budi.santoso_9"));
    assert.ok(isValidUsername("abc"));
    assert.ok(!isValidUsername("ab"));
    assert.ok(!isValidUsername("a".repeat(31)));
    assert.ok(!isValidUsername("budi santoso"));
    assert.ok(!isValidUsername("Budi!"));
    assert.ok(!isValidUsername("user@x"));
  });
});
