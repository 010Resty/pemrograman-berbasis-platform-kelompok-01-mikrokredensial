/**
 * Penjaga konten Tiptap saat simpan (server-side, tanpa dependensi).
 *
 * Dipakai backend SEBELUM tulis DB: memvalidasi struktur JSON Tiptap
 * (allowlist node/mark) + keamanan URL atribut (link, gambar, video,
 * audio, lampiran PDF). Murni fungsi sinkron — aman diimpor tes unit
 * tanpa koneksi database.
 *
 * Lapisan klien (`frontend/src/lib/security/sanitize.ts`, DOMPurify)
 * tetap membersihkan saat render; lapis ini memastikan data tersimpan
 * sudah bersih sejak awal (pertahanan berlapis).
 */

export const MAX_CONTENT_CHARS = 1_000_000;

/** Galat validasi Tiptap — controller memetakan menjadi 400 via instanceof (tanpa regex pesan). */
export class TiptapValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TiptapValidationError";
  }
}

const ALLOWED_NODES = new Set([
  "doc", "paragraph", "text", "heading", "bulletList", "orderedList",
  "listItem", "blockquote", "codeBlock", "horizontalRule", "hardBreak",
  "image", "videoEmbed", "audioEmbed", "pdfAttachment",
]);

const ALLOWED_MARKS = new Set([
  "bold", "italic", "underline", "strike", "code", "link",
]);

export interface TiptapNode {
  type?: unknown;
  attrs?: Record<string, unknown>;
  marks?: Array<{ type?: unknown; attrs?: Record<string, unknown> }>;
  content?: TiptapNode[];
  text?: unknown;
}

function assertSafeUrl(value: unknown, field: string): void {
  if (value == null) return;
  if (typeof value !== "string") {
    throw new TiptapValidationError(`Atribut ${field} harus berupa string`);
  }
  // Samakan dengan sanitizer frontend: abaikan ASCII whitespace/kontrol
  // ("java\tscript:"), tolak protocol-relative ("//evil" mewarisi skema).
  let v = "";
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 0;
    if (code <= 0x20 || code === 0x7f) continue;
    v += ch;
  }
  v = v.toLowerCase();
  if (v === "" || v === "#") return;
  if (v.startsWith("//")) {
    throw new TiptapValidationError(`Atribut ${field} tidak boleh URL protocol-relative`);
  }
  if (v.startsWith("data:")) {
    throw new TiptapValidationError(
      `Atribut ${field} tidak boleh dataURL/base64 — unggah berkas via /api/v1/uploads`
    );
  }
  if (!(v.startsWith("http://") || v.startsWith("https://") || v.startsWith("/"))) {
    throw new TiptapValidationError(`Atribut ${field} harus URL http(s) atau path /api/...`);
  }
}

function walkNode(node: TiptapNode, depth: number): void {
  if (depth > 50 || typeof node !== "object" || node === null) {
    throw new TiptapValidationError("Struktur dokumen tidak valid");
  }
  if (typeof node.type !== "string" || !ALLOWED_NODES.has(node.type)) {
    throw new TiptapValidationError(`Tipe node tidak diizinkan: ${String(node.type)}`);
  }
  if (Array.isArray(node.marks)) {
    for (const m of node.marks) {
      if (!m || typeof m !== "object" || typeof m.type !== "string" || !ALLOWED_MARKS.has(m.type)) {
        throw new TiptapValidationError(`Tipe mark tidak diizinkan: ${String((m as { type?: unknown })?.type)}`);
      }
      if (m.type === "link") {
        assertSafeUrl((m.attrs as Record<string, unknown> | undefined)?.href, "link.href");
      }
    }
  }
  const attrs = node.attrs ?? {};
  if (node.type === "image") assertSafeUrl(attrs.src, "image.src");
  if (node.type === "videoEmbed") assertSafeUrl(attrs.src, "videoEmbed.src");
  if (node.type === "audioEmbed") assertSafeUrl(attrs.src, "audioEmbed.src");
  if (node.type === "pdfAttachment") assertSafeUrl(attrs.url, "pdfAttachment.url");
  if (Array.isArray(node.content)) {
    for (const child of node.content) walkNode(child, depth + 1);
  }
}

/** Validasi string JSON Tiptap; melempar TiptapValidationError bila tidak valid. */
export function assertValidTiptap(content: string): void {
  if (content.length > MAX_CONTENT_CHARS) {
    throw new TiptapValidationError("Dokumen melebihi 1 MB — perkecil gambar/media atau pecah materi");
  }
  let doc: unknown;
  try {
    doc = JSON.parse(content);
  } catch {
    throw new TiptapValidationError("Konten harus JSON Tiptap yang valid");
  }
  if (typeof doc !== "object" || doc === null) {
    throw new TiptapValidationError("Dokumen harus berupa objek doc Tiptap");
  }
  walkNode(doc as TiptapNode, 0);
}
