import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHmac, createSign, generateKeyPairSync } from "node:crypto";

import { hmacSha256Hex, hmacSha512Base64, verifyRsaSha256 } from "../doku.signature";
import { mapDokuStatus } from "../doku.status";
import { isDokuConfigured, isDokuWired, loadDokuConfig } from "../doku.config";
import { createDokuQrisOrder } from "../doku.client";
import { renderQrPng } from "../doku.qr";

describe("doku.signature — primitif kripto (tanpa DB, tanpa jaringan)", () => {
  it("hmacSha256Hex sama dengan node:crypto langsung", () => {
    const expected = createHmac("sha256", "kunci").update("pesan", "utf8").digest("hex");
    assert.equal(hmacSha256Hex("kunci", "pesan"), expected);
    assert.equal(hmacSha256Hex("kunci", "pesan").length, 64);
  });

  it("hmacSha512Base64 sama dengan node:crypto langsung", () => {
    const expected = createHmac("sha512", "kunci").update("pesan", "utf8").digest("base64");
    assert.equal(hmacSha512Base64("kunci", "pesan"), expected);
  });

  it("RSA round-trip: tanda tangan sendiri → terverifikasi", () => {
    const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const pubPem = publicKey.export({ type: "spki", format: "pem" }).toString();
    const privPem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    const signer = createSign("RSA-SHA256");
    signer.update(Buffer.from("raw-body-webhook", "utf8"));
    const sig = signer.sign(privPem, "base64");
    assert.equal(verifyRsaSha256({ publicKeyPem: pubPem, data: "raw-body-webhook", signatureB64: sig }), true);
  });

  it("RSA: body diubah → verifikasi gagal", () => {
    const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const pubPem = publicKey.export({ type: "spki", format: "pem" }).toString();
    const privPem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    const signer = createSign("RSA-SHA256");
    signer.update(Buffer.from("asli", "utf8"));
    const sig = signer.sign(privPem, "base64");
    assert.equal(verifyRsaSha256({ publicKeyPem: pubPem, data: "diubah", signatureB64: sig }), false);
  });

  it("RSA: kunci kosong/signature rusak → false (bukan throw)", () => {
    assert.equal(verifyRsaSha256({ publicKeyPem: "", data: "x", signatureB64: "abc" }), false);
    assert.equal(verifyRsaSha256({ publicKeyPem: "bukan-pem", data: "x", signatureB64: "!!!" }), false);
  });
});

describe("doku.status — pemetaan status notifikasi", () => {
  it("sukses: SUCCESS/PAID/SETTLEMENT", () => {
    for (const s of ["SUCCESS", "paid", "Settlement"]) assert.equal(mapDokuStatus(s), "success");
  });
  it("kedaluwarsa: EXPIRED", () => {
    assert.equal(mapDokuStatus("expired"), "expired");
  });
  it("gagal final: FAILED/DENY/CANCELLED", () => {
    for (const s of ["FAILED", "deny", "cancelled"]) assert.equal(mapDokuStatus(s), "failed");
  });
  it("tak dikenal/kosong → unknown (webhook ditolak 400 agar retry)", () => {
    assert.equal(mapDokuStatus("PENDING"), "unknown");
    assert.equal(mapDokuStatus(""), "unknown");
    assert.equal(mapDokuStatus(undefined), "unknown");
  });
});

describe("doku.config — gate konfigurasi jujur", () => {
  it("kosong → tidak terkonfigurasi & tidak wired", () => {
    const cfg = loadDokuConfig();
    void cfg;
    assert.equal(isDokuConfigured({ ...loadDokuConfig(), baseUrl: "", clientId: "", secretKey: "" }), false);
    assert.equal(
      isDokuWired({ ...loadDokuConfig(), baseUrl: "https://x", clientId: "c", secretKey: "s", qrisPath: "" }),
      false
    );
  });

  it("create tanpa konfigurasi → 503 DOKU_NOT_CONFIGURED (tanpa panggil jaringan)", async () => {
    await assert.rejects(
      () =>
        createDokuQrisOrder(
          { invoice: "INV-1", amount: 100000, expiredMinutes: 30 },
          { ...loadDokuConfig(), baseUrl: "", clientId: "", secretKey: "" }
        ),
      (e: unknown) => (e as { code?: string }).code === "DOKU_NOT_CONFIGURED"
    );
  });

  it("terkonfigurasi tapi path kosong → 503 DOKU_NOT_WIRED (tanpa QR palsu)", async () => {
    await assert.rejects(
      () =>
        createDokuQrisOrder(
          { invoice: "INV-1", amount: 100000, expiredMinutes: 30 },
          { ...loadDokuConfig(), baseUrl: "https://x", clientId: "c", secretKey: "s", qrisPath: "" }
        ),
      (e: unknown) => (e as { code?: string }).code === "DOKU_NOT_WIRED"
    );
  });

  it("nominal tak valid → 400 sebelum sentuh konfigurasi", async () => {
    await assert.rejects(
      () =>
        createDokuQrisOrder(
          { invoice: "INV-1", amount: 0, expiredMinutes: 30 },
          { ...loadDokuConfig(), baseUrl: "https://x", clientId: "c", secretKey: "s", qrisPath: "/qris" }
        ),
      (e: unknown) => (e as { code?: string }).code === "DOKU_BAD_AMOUNT"
    );
  });
});

describe("doku.qr — render PNG dari string QR (tanpa DB)", () => {
  it("menghasilkan PNG valid (magic bytes)", async () => {
    const buf = await renderQrPng("00020101021226670018ID.CO.EXAMPLE01189360091400000000010215000000000000000303UMI5204541153031505802ID5914ARISTOTELES6013JAKARTA PUSAT61051015062070703A016304BE32");
    assert.ok(buf.length > 100);
    // PNG signature: 89 50 4E 47 0D 0A 1A 0A
    assert.deepEqual(Array.from(buf.subarray(0, 8)), [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  });

  it("string kosong → throw (tanpa PNG palsu)", async () => {
    await assert.rejects(() => renderQrPng("   "), /kosong/);
  });
});
