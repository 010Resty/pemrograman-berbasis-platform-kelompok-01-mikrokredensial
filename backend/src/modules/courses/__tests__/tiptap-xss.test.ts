import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertValidTiptap, TiptapValidationError } from "../../../utils/tiptap-guard";
// Impor tanpa ekstensi agar lolos `tsc --noEmit` (dijalankan via tsx).

/**
 * Sanitasi-saat-simpan: Tiptap JSON divalidasi struktural sebelum tulis DB
 * (allowlist node/mark + URL aman). Tanpa dependensi baru.
 * Murni validasi, tanpa database dan tanpa server.
 */
const doc = (content: unknown[]) =>
  JSON.stringify({ type: "doc", content });

const para = (text: string) => ({
  type: "paragraph",
  content: [{ type: "text", text }],
});

const linkMark = (href: string) => ({
  type: "text",
  text: "klik",
  marks: [{ type: "link", attrs: { href } }],
});

describe("tiptap save-time sanitization (XSS)", () => {
  it("menerima dokumen bersih", () => {
    assert.doesNotThrow(() =>
      assertValidTiptap(
        doc([para("Halo"), { type: "image", attrs: { src: "/api/v1/files/1/content" } }])
      )
    );
  });

  it("menolak tipe node mentah (script/iframe/html)", () => {
    for (const t of ["script", "iframe", "html", "rawHtml", "embed"]) {
      assert.throws(
        () => assertValidTiptap(doc([{ type: t }])),
        /tidak diizinkan/,
        `node ${t} harus ditolak`
      );
    }
  });

  it("menolak mark tak dikenal (termasuk on* handler sebagai mark)", () => {
    assert.throws(() =>
      assertValidTiptap(
        doc([{ type: "paragraph", content: [{ type: "text", text: "x", marks: [{ type: "onclick" }] }] }])
      )
    );
  });

  it("menolak javascript:/vbscript: di link, gambar, video, audio, pdf", () => {
    const bad = "javascript:alert(1)";
    assert.throws(() =>
      assertValidTiptap(doc([{ type: "paragraph", content: [linkMark(bad)] }]))
    );
    for (const [type, attr] of [
      ["image", "src"],
      ["videoEmbed", "src"],
      ["audioEmbed", "src"],
      ["pdfAttachment", "url"],
    ] as const) {
      assert.throws(
        () =>
          assertValidTiptap(
            doc([{ type, attrs: { [attr]: bad } }])
          ),
        /tidak valid|tidak boleh|harus URL/,
        `${type}.${attr} javascript: harus ditolak`
      );
    }
  });

  it("menolak tab/newline dalam skema (java\\tscript:)", () => {
    assert.throws(() =>
      assertValidTiptap(
        doc([{ type: "paragraph", content: [linkMark("java\tscript:alert(1)")] }])
      )
    );
  });

  it("menolak URL protocol-relative (//evil)", () => {
    assert.throws(() =>
      assertValidTiptap(
        doc([{ type: "paragraph", content: [linkMark("//evil.id/x")] }])
      )
    );
  });

  it("menolak data: URL (harus via /uploads)", () => {
    assert.throws(() =>
      assertValidTiptap(
        doc([
          { type: "image", attrs: { src: "data:image/png;base64,AAA" } },
        ])
      )
    );
  });

  it("menerima http(s) dan path /api; menolak skema lain (mailto/tel/ftp)", () => {
    for (const href of [
      "https://a.id/x",
      "http://a.id/x",
      "/api/v1/files/1/content",
    ]) {
      assert.doesNotThrow(
        () =>
          assertValidTiptap(
            doc([{ type: "paragraph", content: [linkMark(href)] }])
          ),
        `href ${href} seharusnya diterima`
      );
    }
    for (const bad of ["ftp://a.id/x", "mailto:a@b.id", "tel:+621", "data:text/html,x", "#bagian"]) {
      assert.throws(
        () =>
          assertValidTiptap(
            doc([{ type: "paragraph", content: [linkMark(bad)] }])
          ),
        TiptapValidationError,
        `${bad} harus ditolak`
      );
    }
  });

  it("menolak struktur rusak: terlalu dalam, bukan objek, JSON invalid", () => {
    assert.throws(() => assertValidTiptap("bukan json"));
    assert.throws(() => assertValidTiptap(JSON.stringify([1, 2, 3])));
    let deep: Record<string, unknown> = { type: "doc" };
    let cur = deep;
    for (let i = 0; i < 60; i++) {
      const next: Record<string, unknown> = { type: "paragraph" };
      cur.content = [next];
      cur = next;
    }
    assert.throws(() => assertValidTiptap(JSON.stringify(deep)));
  });

  it("menolak dokumen raksasa (>1 MB)", () => {
    assert.throws(() =>
      assertValidTiptap(JSON.stringify({ type: "doc", content: [], pad: "x".repeat(2_000_000) }))
    );
  });
});
