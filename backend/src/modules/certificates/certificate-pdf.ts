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
 * Desain gaya referensi: bingkai navy;
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
  /** Byte PNG tanda tangan instruktur utama (null = fallback nama diketik). */
  signaturePng: Buffer | null;
  issuedAt: Date;
  verifyUrl: string;
}

const PAGE_W = 841.89; // A4 landscape (pt)
const PAGE_H = 595.28;

const NAVY = rgb(30 / 255, 58 / 255, 138 / 255);
const GOLD = rgb(180 / 255, 120 / 255, 20 / 255);
const SLATE = rgb(51 / 255, 65 / 255, 85 / 255);
const GRAY = rgb(100 / 255, 116 / 255, 139 / 255);
const NAVY_DARK = rgb(26 / 255, 39 / 255, 70 / 255);
const BLACK = rgb(0, 0, 0);
const TEAL = rgb(0 / 255, 137 / 255, 123 / 255);
const WHITE = rgb(1, 1, 1);

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

  /** Teks rata kiri pada kolom kiri (x tetap, warna parametrik). */
  const leftText = (text: string, x: number, y: number, size: number, style: TextStyle & { color?: ReturnType<typeof rgb> }): void => {
    const s: TextSeg = { text, bold: style.bold, oblique: style.oblique };
    page.drawText(t(text), { x, y, size, font: fontOf(s), color: style.color ?? SLATE });
  };

  /** Pita penanda kanan: poligon bookmark navy + judul + medali emas/perak. */
  const drawRibbon = async (gold: boolean): Promise<void> => {
    const rx0 = 648;
    const rx1 = 798;
    const top = 569;
    const side = 322;
    const tipX = (rx0 + rx1) / 2;
    const tipY = 280;
    page.drawSvgPath(`M ${rx0},${top} H ${rx1} V ${side} L ${tipX},${tipY} L ${rx0},${side} Z`, {
      color: NAVY,
      borderColor: NAVY,
      borderWidth: 1,
    });
    const cx = tipX;
    const ribbonText = (text: string, y: number): void => {
      const w = helvBold.widthOfTextAtSize(t(text), 11);
      page.drawText(t(text), { x: cx - w / 2, y, size: 11, font: helvBold, color: WHITE });
    };
    ribbonText("SERTIFIKAT", 544);
    ribbonText("KOMPETENSI", 528);
    // Medali raster resmi (emas kursus / perak modul); alfa PNG dipertahankan.
    // Gagal muat = pita tetap tampil tanpa medali (jangan gagalkan unduh).
    try {
      const medal = await loadLogo(gold ? "medali-emas.png" : "medali-perak.png");
      if (medal) {
        const img = await doc.embedPng(medal);
        const w = 136;
        const h = (img.height / img.width) * w;
        page.drawImage(img, { x: cx - w / 2, y: 505 - h, width: w, height: h });
      }
    } catch (e) {
      console.error("[certificate-pdf] Gagal menanam medali, lanjut tanpa medali:", e);
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
  const title = data.moduleTitle ?? data.courseTitle;

  // Latar navy penuh + kartu putih + garis tipis dalam.
  page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: NAVY_DARK });
  page.drawRectangle({ x: 26, y: 26, width: PAGE_W - 52, height: PAGE_H - 52, color: WHITE });
  page.drawRectangle({ x: 34, y: 34, width: PAGE_W - 68, height: PAGE_H - 68, borderColor: NAVY, borderWidth: 1 });

  await drawRibbon(isCourse);

  // Kiri atas: logo + nama (lanjut tanpa logo bila aset hilang/rusak).
  const headX = 64;
  try {
    const logo = await loadLogo("aristoteleslogo.png");
    if (logo) {
      const img = await doc.embedPng(logo);
      const h = 48;
      const w = (img.width / img.height) * h;
      page.drawImage(img, { x: headX, y: 507, width: w, height: h });
    }
  } catch (e) {
    console.error("[certificate-pdf] Gagal menanam logo, lanjut tanpa logo:", e);
  }
  leftText("ARISTOTELES", headX, 488, 18, { bold: true, color: NAVY });

  // Chip kode unik (tanpa URL tercetak).
  const chipW = 178;
  page.drawRectangle({ x: headX, y: 448, width: chipW, height: 26, color: NAVY });
  const codeW = helvBold.widthOfTextAtSize(t(data.code), 11);
  page.drawText(t(data.code), {
    x: headX + (chipW - codeW) / 2,
    y: 456,
    size: 11,
    font: helvBold,
    color: WHITE,
  });

  leftText("Diberikan kepada", headX, 416, 10.5, { color: BLACK });
  let nameSize = 28;
  while (nameSize > 15 && helvBold.widthOfTextAtSize(t(data.recipientName), nameSize) > 540) nameSize -= 2;
  page.drawText(t(data.recipientName), {
    x: headX,
    y: 380,
    size: nameSize,
    font: helvBold,
    color: BLACK,
  });

  leftText(
    isCourse ? "Atas kelulusannya pada kursus:" : "Atas kelulusannya pada modul:",
    headX,
    348,
    10.5,
    { color: BLACK }
  );

  let y = 318;
  const titleLines = wrap2(title, 19, true, 540);
  for (const ln of titleLines) {
    page.drawText(ln, { x: headX, y, size: 19, font: helvBold, color: BLACK });
    y -= 26;
  }
  y -= 6;
  const desc: TextSeg[] = isCourse
    ? [{ text: "serta telah memenuhi seluruh persyaratan penyelesaian kursus yang ditetapkan." }]
    : [
        { text: "Dalam program kursus " },
        { text: data.courseTitle, bold: true },
        { text: ", serta telah memenuhi seluruh persyaratan penyelesaian modul yang ditetapkan." },
      ];
  const descPlain = desc.map((s) => s.text).join("");
  const descLines = wrap2(descPlain, 10.5, false, 540);
  for (const ln of descLines) {
    if (!isCourse && desc.length === 3) {
      if (descLines.length === 1) {
        const runs = desc.map((s) => ({ s, w: fontOf(s).widthOfTextAtSize(t(s.text), 10.5) }));
        let x = headX;
        for (const r of runs) {
          page.drawText(t(r.s.text), { x, y, size: 10.5, font: fontOf(r.s), color: BLACK });
          x += r.w;
        }
      } else {
        leftText(ln, headX, y, 10.5, { color: BLACK });
      }
    } else {
      leftText(ln, headX, y, 10.5, { color: BLACK });
    }
    y -= 18;
  }

  // Kiri bawah: gambar tanda tangan (bila ada), nama, jabatan, tanggal.
  const sigName = data.instructorName;
  let sigSize = 12;
  while (sigSize > 9 && helvBold.widthOfTextAtSize(t(sigName), sigSize) > 300) sigSize -= 1;
  if (data.signaturePng) {
    try {
      const sig = await doc.embedPng(data.signaturePng);
      const h = 84;
      const w = Math.min((sig.width / sig.height) * h, 260);
      page.drawImage(sig, { x: headX, y: 148, width: w, height: h });
    } catch (e) {
      console.error("[certificate-pdf] Gagal menanam tanda tangan, lanjut tanpa gambar:", e);
    }
  }
  page.drawText(t(sigName), {
    x: headX,
    y: 128,
    size: sigSize,
    font: helvBold,
    color: SLATE,
  });
  leftText("Instruktur Utama", headX, 114, 9, { color: GRAY });
  leftText(formatTanggalID(data.issuedAt), headX, 92, 10, {});

  // Kanan bawah: QR + label + kode unik (tanpa URL tercetak).
  try {
    const qrBytes = await QRCode.toBuffer(data.verifyUrl, {
      type: "png",
      width: 300,
      margin: 1,
      errorCorrectionLevel: "M",
    });
    const qr = await doc.embedPng(qrBytes);
    page.drawImage(qr, { x: 500, y: 64, width: 78, height: 78 });
  } catch (e) {
    // Tanpa QR pun PDF tetap sah (kode tercetak) — jangan gagalkan unduh.
    console.error("[certificate-pdf] Gagal membuat QR, lanjut tanpa QR:", e);
  }
  const qrCx = 539;
  const vtW = helvBold.widthOfTextAtSize(t("Verifikasi Sertifikat"), 9.5);
  page.drawText(t("Verifikasi Sertifikat"), {
    x: qrCx - vtW / 2,
    y: 152,
    size: 9.5,
    font: helvBold,
    color: SLATE,
  });
  const codeW2 = helv.widthOfTextAtSize(t(data.code), 9);
  page.drawText(t(data.code), {
    x: qrCx - codeW2 / 2,
    y: 50,
    size: 9,
    font: helv,
    color: GRAY,
  });

  // Catatan kaki (tanpa URL).
  const foot = "Keaslian sertifikat ini dapat diverifikasi melalui laman resmi ARISTOTELES menggunakan kode sertifikat di atas.";
  const footLines = wrap2(foot, 7.5, false, 620);
  let fy = 34;
  for (let i = footLines.length - 1; i >= 0; i--) {
    center(footLines[i] ?? "", fy, 7.5, { oblique: true });
    fy += 11;
  }

  doc.setTitle(t(`Sertifikat - ${title}`));
  doc.setAuthor("ARISTOTELES");
  doc.setSubject(t(`Sertifikat kelulusan ${level.toLowerCase()} - ${data.code}`));
  return Buffer.from(await doc.save());
}

// ---------- Cache disk deterministik (tanpa migrasi DB) ----------

const certDir = (): string => path.resolve(__dirname, "../../../uploads/certificates");

/**
 * Path absolut PDF untuk satu kode (guard traversal; kode server aman by-design).
 * Prefix v4: spasi blok teks direnggangkan + tanda tangan diperbesar —
 * desain lama (v3 ke bawah) diinvalidasi agar ter-generate ulang saat diunduh.
 */
export function pdfPathFor(code: string): string {
  if (!/^[A-Z0-9-]{1,64}$/.test(code)) throw new Error("Kode sertifikat tidak valid");
  const dir = certDir();
  const full = path.resolve(dir, `v4-${code}.pdf`);
  if (full !== path.join(dir, `v4-${code}.pdf`)) throw new Error("Kode sertifikat tidak valid");
  return full;
}

/**
 * Pastikan PDF ada di disk (buat bila belum). Tulis atomik (tmp + rename)
 * agar unduhan paralel pertama tak membaca berkas setengah jadi.
 * Berkas desain lama (v3-*, v2-*) dibersihkan malas saat desain baru dibuat.
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
  for (const legacy of [`v3-${data.code}.pdf`, `v2-${data.code}.pdf`, `v1-${data.code}.pdf`]) {
    try {
      await fs.unlink(path.join(certDir(), legacy));
    } catch {
      // Tidak ada / sudah bersih — abaikan.
    }
  }
  return target;
}
