import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import QRCode from "qrcode";

/**
 * Generator PDF sertifikat — modul MURNI + cache disk deterministik.
 *
 * Prinsip atomic (isolasi kegagalan):
 * - Fungsi ini tidak menyentuh database dan tidak dipanggil dari jalur
 *   penerbitan. Sertifikat terbit dulu (sumber kebenaran = baris DB);
 *   PDF hanya dibuat malas saat diunduh (`ensureCertificatePdf`) atau
 *   saat diminta. Gagal di sini → 500 pada request unduh itu saja;
 *   daftar/terbit/verifikasi tetap jalan.
 * - Aset bermasalah (logo hilang/rusak, QR gagal) TIDAK menggagalkan PDF:
 *   degradasi grasius (fallback teks) + log, agar satu titik rusak tidak
 *   menutup seluruh titik unduh.
 *
 * Desain mengikuti struktur teks resmi (ID + subjudul Inggris):
 * kop logo Aristoteles, judul level, penerima, uraian penyelesaian,
 * tanggal + kode, blok tanda tangan tengah (nama instruktur + QR),
 * catatan kaki verifikasi.
 */

export interface CertificatePdfData {
  code: string;
  recipientName: string;
  recipientEmail: string | null;
  courseTitle: string;
  /** null = sertifikat level kursus (Fase B); selain itu level modul. */
  moduleTitle: string | null;
  instructorName: string;
  issuedAt: Date;
  verifyUrl: string;
}

const PAGE_W = 841.89; // A4 landscape (pt)
const PAGE_H = 595.28;

const NAVY = rgb(30 / 255, 58 / 255, 138 / 255);
const GOLD = rgb(180 / 255, 120 / 255, 20 / 255);
const SLATE = rgb(51 / 255, 65 / 255, 85 / 255);
const GRAY = rgb(100 / 255, 116 / 255, 139 / 255);

/** WinAnsi (font standar pdf-lib) hanya mencakup latin; selain itu → '?' + log. */
const WINANSI_EXTRA = new Map<string, string>([
  ["–", "-"],
  ["—", "-"],
  ["‘", "'"],
  ["’", "'"],
  ["‚", ","],
  ["“", '"'],
  ["”", '"'],
  ["„", '"'],
  ["…", "..."],
  ["•", "-"],
  [" ", " "],
]);

function toWinAnsi(s: string): string {
  let out = "";
  for (const ch of s) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp < 0x20 && ch !== " ") {
      out += " ";
      continue;
    }
    if (cp <= 0xff) {
      out += ch;
      continue;
    }
    out += WINANSI_EXTRA.get(ch) ?? "?";
  }
  return out;
}

function formatTanggalID(d: Date): string {
  try {
    return new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

/** Slug aman untuk nama file: alfanumerik + '-' (diakritik dilucuti). */
function slug(s: string, max: number): string {
  const clean = s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/g, "");
  return clean || "sertifikat";
}

/** Nama file unduhan: Sertifikat-<Judul>-<Nama>.pdf */
export function certificateFileName(title: string, recipientName: string): string {
  return `Sertifikat-${slug(title, 50)}-${slug(recipientName, 40)}.pdf`;
}

const ASSETS_DIR = path.resolve(__dirname, "assets");

async function loadLogo(file: string): Promise<Buffer | null> {
  try {
    return await fs.readFile(path.join(ASSETS_DIR, file));
  } catch (e) {
    console.error(`[certificate-pdf] Logo hilang/rusak (${file}):`, e);
    return null;
  }
}

/** Basis URL frontend untuk QR + teks verifikasi (pola sama seperti undangan). */
export function frontendBaseUrl(): string {
  return (
    process.env.FRONTEND_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    "http://localhost:5173"
  ).replace(/\/+$/, "");
}

export function verifyUrlFor(code: string): string {
  return `${frontendBaseUrl()}/verifikasi?code=${encodeURIComponent(code)}`;
}

interface TextSeg {
  text: string;
  bold?: boolean;
  oblique?: boolean;
}

interface TextStyle {
  bold?: boolean;
  oblique?: boolean;
}

/** Bangun PDF sertifikat dari data (murni: tanpa I/O selain aset logo). */
export async function buildCertificatePdf(data: CertificatePdfData): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const helv = await doc.embedFont(StandardFonts.Helvetica);
  const helvBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const helvOblique = await doc.embedFont(StandardFonts.HelveticaOblique);
  const page = doc.addPage([PAGE_W, PAGE_H]);
  const t = (s: string): string => toWinAnsi(s);
  const fontOf = (s: TextSeg): PDFFont =>
    s.bold ? helvBold : s.oblique ? helvOblique : helv;

  const center = (text: string, y: number, size: number, style?: TextStyle): void => {
    const s: TextSeg = { text, ...style };
    const font = fontOf(s);
    const w = font.widthOfTextAtSize(t(text), size);
    page.drawText(t(text), { x: (PAGE_W - w) / 2, y, size, font, color: SLATE });
  };

  /** Satu baris campuran tebal/miring/biasa, rata tengah. */
  const centerMixed = (segs: TextSeg[], y: number, size: number): void => {
    const runs = segs.map((s) => ({ s, w: fontOf(s).widthOfTextAtSize(t(s.text), size) }));
    let x = (PAGE_W - runs.reduce((n, r) => n + r.w, 0)) / 2;
    for (const r of runs) {
      page.drawText(t(r.s.text), { x, y, size, font: fontOf(r.s), color: SLATE });
      x += r.w;
    }
  };

  /** Bungkus teks ke maksimal 2 baris (baris ke-2 dielipsis bila meluap). */
  const wrap2 = (text: string, size: number, bold: boolean, maxW: number): string[] => {
    const font = bold ? helvBold : helv;
    const words = t(text).split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let cur = "";
    for (const w of words) {
      const trial = cur ? `${cur} ${w}` : w;
      if (font.widthOfTextAtSize(trial, size) <= maxW) {
        cur = trial;
        continue;
      }
      if (cur) lines.push(cur);
      cur = w;
      if (lines.length === 2) break;
    }
    if (cur && lines.length < 2) lines.push(cur);
    const used = lines.join(" ").split(/\s+/).filter(Boolean).length;
    if (used < words.length && lines.length === 2) {
      let l2 = lines[1] ?? "";
      while (l2.includes(" ") && font.widthOfTextAtSize(`${l2}...`, size) > maxW) {
        l2 = l2.split(/\s+/).slice(0, -1).join(" ");
      }
      lines[1] = font.widthOfTextAtSize("...", size) <= maxW ? `${l2}...`.trim() : l2;
    }
    return lines;
  };

  const isCourse = data.moduleTitle === null;
  const level = isCourse ? "KURSUS" : "MODUL";
  const levelEn = isCourse ? "COURSE" : "MODULE";
  const title = data.moduleTitle ?? data.courseTitle;

  // Bingkai ganda.
  page.drawRectangle({ x: 24, y: 24, width: PAGE_W - 48, height: PAGE_H - 48, borderColor: NAVY, borderWidth: 2.5 });
  page.drawRectangle({ x: 32, y: 32, width: PAGE_W - 64, height: PAGE_H - 64, borderColor: GOLD, borderWidth: 1 });

  // Kop: logo Aristoteles tengah; fallback teks bila aset hilang.
  try {
    const logo = await loadLogo("aristoteleslogo.png");
    if (logo) {
      const img = await doc.embedPng(logo);
      const h = 54;
      const w = (img.width / img.height) * h;
      page.drawImage(img, { x: (PAGE_W - w) / 2, y: PAGE_H - 62 - h, width: w, height: h });
    } else {
      center("ARISTOTELES", PAGE_H - 96, 14, { bold: true });
    }
  } catch (e) {
    console.error("[certificate-pdf] Gagal menanam logo, fallback teks:", e);
    center("ARISTOTELES", PAGE_H - 96, 14, { bold: true });
  }

  center(`SERTIFIKAT KELULUSAN ${level}`, 438, 27, { bold: true });
  page.drawText(t(`CERTIFICATE OF ${levelEn} COMPLETION`), {
    x: (PAGE_W - helvOblique.widthOfTextAtSize(t(`CERTIFICATE OF ${levelEn} COMPLETION`), 11)) / 2,
    y: 418,
    size: 11,
    font: helvOblique,
    color: GRAY,
  });

  center("Diberikan kepada", 394, 11, {});
  let nameSize = 30;
  while (nameSize > 16 && helvBold.widthOfTextAtSize(t(data.recipientName), nameSize) > 660) nameSize -= 2;
  const nameW = helvBold.widthOfTextAtSize(t(data.recipientName), nameSize);
  page.drawText(t(data.recipientName), {
    x: (PAGE_W - nameW) / 2,
    y: 358,
    size: nameSize,
    font: helvBold,
    color: NAVY,
  });

  center(
    isCourse ? "Atas keberhasilannya menyelesaikan kursus:" : "Atas keberhasilannya menyelesaikan modul pembelajaran:",
    328,
    11,
    {}
  );

  let y = 300;
  const titleLines = wrap2(title, 19, true, 660);
  for (const ln of titleLines) {
    const w = helvBold.widthOfTextAtSize(ln, 19);
    page.drawText(ln, { x: (PAGE_W - w) / 2, y, size: 19, font: helvBold, color: SLATE });
    y -= 23;
  }
  y -= 6;
  const desc: TextSeg[] = isCourse
    ? [{ text: "serta telah memenuhi seluruh persyaratan penyelesaian kursus yang ditetapkan." }]
    : [
        { text: "Dalam program kursus " },
        { text: data.courseTitle, bold: true },
        { text: ", serta telah memenuhi seluruh persyaratan penyelesaian modul yang ditetapkan." },
      ];
  // Bungkus deskripsi sebagai satu string lalu gambar per-segmen? Sederhana:
  // gabung, bungkus, lalu gambar tiap baris terpusat (tebal hilang pada kursus
  // saja yang tanpa segmen tebal — modul: gambar ulang per baris penuh).
  const descPlain = desc.map((s) => s.text).join("");
  const descLines = wrap2(descPlain, 11, false, 660);
  for (const ln of descLines) {
    if (!isCourse && desc.length === 3) {
      // Pertahankan judul kursus tebal bila muat satu baris.
      if (descLines.length === 1) {
        centerMixed(desc, y, 11);
      } else {
        center(ln, y, 11, {});
      }
    } else {
      center(ln, y, 11, {});
    }
    y -= 15;
  }

  y -= 14;
  centerMixed([{ text: "Tanggal Penerbitan: ", bold: true }, { text: formatTanggalID(data.issuedAt) }], y, 11);
  y -= 18;
  centerMixed([{ text: "Kode Sertifikat: ", bold: true }, { text: data.code }], y, 11);

  // Blok tanda tangan tengah: nama, jabatan, QR verifikasi.
  const sigName = data.instructorName;
  let sigSize = 13;
  while (sigSize > 9 && helvBold.widthOfTextAtSize(t(sigName), sigSize) > 420) sigSize -= 1;
  const sigW = helvBold.widthOfTextAtSize(t(sigName), sigSize);
  page.drawText(t(sigName), {
    x: (PAGE_W - sigW) / 2,
    y: 148,
    size: sigSize,
    font: helvBold,
    color: SLATE,
  });
  center("Instruktur Utama", 132, 11, {});
  try {
    const qrBytes = await QRCode.toBuffer(data.verifyUrl, {
      type: "png",
      width: 300,
      margin: 1,
      errorCorrectionLevel: "M",
    });
    const qr = await doc.embedPng(qrBytes);
    page.drawImage(qr, { x: (PAGE_W - 72) / 2, y: 52, width: 72, height: 72 });
  } catch (e) {
    // Tanpa QR pun PDF tetap sah (kode tercetak) — jangan gagalkan unduh.
    console.error("[certificate-pdf] Gagal membuat QR, lanjut tanpa QR:", e);
  }

  // Catatan kaki + URL ketik (kiri bawah).
  const foot = "Keabsahan sertifikat ini dapat diverifikasi melalui laman resmi ARISTOTELES menggunakan kode sertifikat yang tercantum di atas.";
  const footLines = wrap2(foot, 8.5, false, 620);
  let fy = 34;
  for (let i = footLines.length - 1; i >= 0; i--) {
    center(footLines[i] ?? "", fy, 8.5, { oblique: true });
    fy += 11;
  }
  page.drawText(t(`Verifikasi: ${data.verifyUrl}`), {
    x: 48,
    y: 44,
    size: 7.5,
    font: helv,
    color: GRAY,
  });

  doc.setTitle(t(`Sertifikat - ${title}`));
  doc.setAuthor("ARISTOTELES");
  doc.setSubject(t(`Sertifikat kelulusan ${level.toLowerCase()} - ${data.code}`));
  return Buffer.from(await doc.save());
}

// ---------- Cache disk deterministik (tanpa migrasi DB) ----------

const certDir = (): string => path.resolve(__dirname, "../../../uploads/certificates");

/**
 * Path absolut PDF untuk satu kode (guard traversal; kode server aman by-design).
 * Prefix v2: desain lama (pra-struktur teks resmi) diinvalidasi agar semua
 * sertifikat lama ter-generate ulang dalam desain baru saat diunduh.
 */
export function pdfPathFor(code: string): string {
  if (!/^[A-Z0-9-]{1,64}$/.test(code)) throw new Error("Kode sertifikat tidak valid");
  const dir = certDir();
  const full = path.resolve(dir, `v2-${code}.pdf`);
  if (full !== path.join(dir, `v2-${code}.pdf`)) throw new Error("Kode sertifikat tidak valid");
  return full;
}

/**
 * Pastikan PDF ada di disk (buat bila belum). Tulis atomik (tmp + rename)
 * agar unduhan paralel pertama tak membaca berkas setengah jadi.
 */
export async function ensureCertificatePdf(data: CertificatePdfData): Promise<string> {
  const target = pdfPathFor(data.code);
  await fs.mkdir(certDir(), { recursive: true });
  try {
    await fs.stat(target);
    return target;
  } catch {
    // Belum ada → bangun.
  }
  const buffer = await buildCertificatePdf(data);
  const tmp = path.join(certDir(), `${data.code}.${process.pid}.${randomUUID()}.tmp`);
  await fs.writeFile(tmp, buffer);
  await fs.rename(tmp, target);
  return target;
}
