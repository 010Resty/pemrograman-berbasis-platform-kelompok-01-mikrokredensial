import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildInvoice,
  computeExpectedTotal,
  isAmountSufficient,
} from "../payment.rules";
// Impor tanpa ekstensi agar lolos `tsc --noEmit` (dijalankan via tsx).

/**
 * Aturan nominal pembayaran QRIS manual (tanpa database).
 * Keputusan: lolos bila nominal >= tagihan (lebih boleh, kurang tolak).
 */
describe("payments.rules", () => {
  it("buildInvoice unik + format INV-YYYYMMDD-<course>-<acak>", () => {
    const a = buildInvoice(7, new Date("2026-03-04T10:00:00Z"));
    const b = buildInvoice(7, new Date("2026-03-04T10:00:00Z"));
    assert.match(a, /^INV-20260304-7-[A-Z0-9]{6}$/);
    assert.notEqual(a, b);
  });

  it("computeExpectedTotal = harga − diskon, tidak negatif", () => {
    assert.equal(computeExpectedTotal(100000, 0), 100000);
    assert.equal(computeExpectedTotal(100000, 25000), 75000);
    assert.equal(computeExpectedTotal(5000, 99999), 0);
  });

  it("isAmountSufficient: pas/labar lolos, kurang ditolak", () => {
    assert.equal(isAmountSufficient(100000, 100000), true);
    assert.equal(isAmountSufficient(150000, 100000), true);
    assert.equal(isAmountSufficient(99999, 100000), false);
    assert.equal(isAmountSufficient(0, 0), true);
    assert.equal(isAmountSufficient(NaN, 100000), false);
  });
});
