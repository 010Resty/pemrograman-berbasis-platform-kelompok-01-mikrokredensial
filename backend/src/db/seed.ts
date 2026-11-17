import dotenv from "dotenv";
import path from "node:path";

// Samakan aturan pemuatan .env dengan koneksi utama (db/index.ts).
dotenv.config({
  path: path.resolve(__dirname, "../../.env"),
});

import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import { and, eq, like, or } from "drizzle-orm";
import { db, pool } from "./index";
import {
  users,
  courseCategories,
  instructorInvitations,
  courses,
  courseInstructors,
  modules,
  subModules,
  materials,
  enrollments,
  quizAttempts,
  quizQuestions,
  quizOptions,
  submissions,
  progress,
  vouchers,
  voucherRedemptions,
  certificates,
  promoCampaigns,
} from "./schema";

/**
 * Seeder development ARISTOTELES — satu file, satu seksi per tabel.
 *
 * - ID integer berurutan, selaras dengan id numerik di frontend.
 * - Hanya untuk database development. JANGAN jalankan di production.
 * - Idempoten aman: jika tabel `users` sudah berisi baris, seeder berhenti
 *   tanpa mengubah apa pun (tidak menimpa/menghapus data yang ada).
 * - Password demo dibaca dari `SEED_DEMO_PASSWORD` bila diisi,
 *   jika tidak memakai nilai default khusus development.
 *
 * Cara pakai: `npm run db:seed`
 */

const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD || "Katasandi123";

// --- ID deterministik (integer, selaras frontend) --------------------------
const ADMIN_ID = 1;
const TEACHER_ID = 2;
const STUDENT_ID = 3;

const COURSE_FREE_ID = 1;
const COURSE_PAID_ID = 2;

const MODULE_MATERI_ID = 1;
const MODULE_KUIS_ID = 2;
const MODULE_TUGAS_ID = 3;

const SUB_HTML_ID = 1;

const MATERIAL_TEKS_ID = 1;
const MATERIAL_KUIS_ID = 2;
const MATERIAL_TUGAS_ID = 3;

const INVITATION_ID = 1;
const QUIZ_ATTEMPT_1_ID = 1;
const QUIZ_ATTEMPT_2_ID = 2;
const SUBMISSION_ID = 1;
const CERTIFICATE_ID = 1;

async function seedUsers(passwordHash: string) {
  await db.insert(users).values([
    {
      id: 10,
      name: "Rayyan",
      username: "rayyan",
      email: "rayyan@gmail.com",
      passwordHash,
      role: "student",
      emailVerifiedAt: new Date(),
    },
  ]);
  console.log("[seed] users: 1 (student)");
}

// --- Promo default: 3 kampanye, tanpa anggota (admin yang mengisi) ---------
const DEFAULT_PROMOS = [
  {
    slug: "flash-sale",
    title: "Flash Sale",
    badgeLabel: "Flash Sale",
    type: "diskon" as const,
    discountPercent: 10 as number | null,
    status: "draft" as const,
    note: "contoh 10%; ubah persen + jendela + aktifkan via halaman admin",
  },
  {
    slug: "promo-pilihan",
    title: "Promo Pilihan",
    badgeLabel: "Paling Diminati",
    type: "kurasi" as const,
    discountPercent: null as number | null,
    status: "draft" as const,
    note: "kurasi admin; tambah kursus pilihan via halaman admin",
  },
  {
    slug: "promo-patungan",
    title: "Promo Patungan",
    badgeLabel: "Bayar Bareng",
    type: "patungan" as const,
    discountPercent: null as number | null,
    status: "draft" as const,
    note: "tambah kursus + harga patungan per kursus via halaman admin",
  },
];

async function seedPromos() {
  let added = 0;
  for (const p of DEFAULT_PROMOS) {
    const existing = await db
      .select({ id: promoCampaigns.id })
      .from(promoCampaigns)
      .where(eq(promoCampaigns.slug, p.slug))
      .limit(1);
    if (existing[0]) {
      console.log(`[seed] promos: lewati "${p.slug}" (sudah ada)`);
      continue;
    }
    await db.insert(promoCampaigns).values({
      slug: p.slug,
      title: p.title,
      badgeLabel: p.badgeLabel,
      type: p.type,
      discountPercent: p.discountPercent,
      status: p.status,
    });
    console.log(`[seed] promos: tambah "${p.slug}" (${p.note})`);
    added += 1;
  }
  console.log(`[seed] promos: ${added} baru`);
}

// --- Kategori resmi (parity dengan migrasi 0026; idempoten per slug) --------
const DEFAULT_CATEGORIES = [
  { slug: "pengembangan-web", name: "Pengembangan Web", sortOrder: 10 },
  { slug: "basis-data", name: "Basis Data", sortOrder: 20 },
  { slug: "jaringan", name: "Jaringan", sortOrder: 30 },
  { slug: "keamanan", name: "Keamanan", sortOrder: 40 },
  { slug: "ai-data", name: "AI & Data", sortOrder: 50 },
  { slug: "infrastruktur", name: "Infrastruktur", sortOrder: 60 },
  { slug: "desain", name: "Desain", sortOrder: 70 },
  { slug: "bisnis", name: "Bisnis", sortOrder: 80 },
];

async function seedCategories() {
  let added = 0;
  for (const c of DEFAULT_CATEGORIES) {
    const existing = await db
      .select({ id: courseCategories.id })
      .from(courseCategories)
      .where(eq(courseCategories.slug, c.slug))
      .limit(1);
    if (existing[0]) {
      console.log(`[seed] categories: lewati "${c.slug}" (sudah ada)`);
      continue;
    }
    await db.insert(courseCategories).values(c);
    added += 1;
  }
  console.log(`[seed] categories: ${added} baru`);
}

// --- Kursus demo uji fitur (id 9, selaras data statis frontend) ----------------
// Satu kursus published + gratis + ongoing berisi 3 modul, 6 sub-modul,
// 10 materi (video, bacaan, tugas, audio, foto, kuis) + bank soal server.
// Idempoten: pengecekan per judul/posisi; tidak menghapus data lain.
// Tidak menyentuh enrollments/attempts/submissions/progress (milik akun).
const DEMO_COURSE_ID = 9;
const DEMO_COURSE_TITLE = "Uji Coba Fitur Lengkap: Web Dasar";

const DEMO_VIDEO_URL = "https://www.w3schools.com/html/mov_bbb.mp4";
const DEMO_AUDIO_URL = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3";
const DEMO_PHOTO_URL = "https://picsum.photos/seed/anatomi-web-uji/1200/700";

type TipNode = Record<string, unknown>;

function tipDoc(blocks: TipNode[]): string {
  return JSON.stringify({ type: "doc", content: blocks });
}

function tipPara(text: string): TipNode {
  return { type: "paragraph", content: [{ type: "text", text }] };
}

interface DemoMaterial {
  title: string;
  type: "materi" | "tugas" | "kuis" | "video" | "bacaan" | "audio" | "foto";
  duration: string;
  position: number;
  passScore?: number;
  content: string;
}

interface DemoSub {
  title: string;
  description: string;
  position: number;
  materials: DemoMaterial[];
}

interface DemoModule {
  title: string;
  description: string;
  position: number;
  subs: DemoSub[];
}

interface DemoQuizItem {
  position: number;
  questionText: string;
  explanation: string;
  options: Array<{ position: number; optionText: string; isCorrect: boolean }>;
}

const DEMO_MODULES: DemoModule[] = [
  {
    title: "Modul 1 — Fondasi & Alur Belajar",
    description: "Kenalan dengan alur belajar, format materi, dan cara mengumpulkan tugas.",
    position: 1,
    subs: [
      {
        title: "Mulai di Sini",
        description: "Video pembuka, panduan bacaan, dan tugas perkenalan.",
        position: 1,
        materials: [
          {
            title: "Video: Selamat Datang & Cara Memakai Kursus",
            type: "video",
            duration: "12 mnt",
            position: 1,
            content: tipDoc([
              tipPara(
                "Video pembuka kursus uji coba. Coba kontrol pemutar: play/pause, volume, fullscreen."
              ),
              { type: "videoEmbed", attrs: { src: DEMO_VIDEO_URL, title: "Video pembuka kursus uji coba" } },
              tipPara(
                "Materi biasa selesai dengan tombol Berikutnya (K-04). Catat 1 hal yang ingin kamu uji berikutnya."
              ),
            ]),
          },
          {
            title: "Bacaan: Peta Belajar 3 Minggu",
            type: "bacaan",
            duration: "10 mnt",
            position: 2,
            content: tipDoc([
              tipPara(
                "Minggu 1: selesaikan Modul 1 berurutan (video, bacaan, tugas). Coba muat ulang halaman untuk melihat progres tersimpan di server."
              ),
              tipPara(
                "Minggu 2: masuk Modul 2 dan coba tiap format media — putar audio, buka foto, baca bacaan, lalu kumpulkan tugas PDF dan coba revisi untuk melihat riwayat kiriman."
              ),
              tipPara(
                "Minggu 3: tonton video rangkuman, kerjakan kuis (dinilai server, tanpa batas percobaan, nilai terbaik dipakai — K-02), lalu kumpulkan proyek akhir."
              ),
            ]),
          },
        ],
      },
      {
        title: "Tugas Pembuka",
        description: "Tugas pertama: profil belajar dan target pribadi.",
        position: 2,
        materials: [
          {
            title: "Tugas: Profil & Target Belajarku",
            type: "tugas",
            duration: "30 mnt",
            position: 1,
            content: tipDoc([
              tipPara(
                "Tulis profil belajarmu (latar belakang, tujuan ikut kursus uji coba, dan 1 fitur yang paling ingin kamu coba) dalam 1 halaman PDF, lalu kumpulkan lewat form di bawah."
              ),
              tipPara("Hasil dikumpulkan: satu file PDF profil belajar. Kumpul ulang tanpa batas sampai lulus (K-06)."),
            ]),
          },
        ],
      },
    ],
  },
  {
    title: "Modul 2 — Praktik Media Campuran",
    description: "Coba semua format media: audio, foto, bacaan lanjutan, dan tugas file.",
    position: 2,
    subs: [
      {
        title: "Audio & Visual",
        description: "Simak audio penjelasan dan amati materi bergambar.",
        position: 1,
        materials: [
          {
            title: "Audio: Penjelasan Konsep Lewat Suara",
            type: "audio",
            duration: "15 mnt",
            position: 1,
            content: tipDoc([
              tipPara("Dengarkan penjelasan konsep, putar/jeda, dan baca transkrip di bawah sebagai pembanding."),
              { type: "audioEmbed", attrs: { src: DEMO_AUDIO_URL, title: "Audio penjelasan konsep" } },
              tipPara(
                "Transkrip: halaman web terdiri dari struktur (HTML), tampilan (CSS), dan perilaku (JavaScript). Struktur yang rapi membuat tampilan mudah diatur dan perilaku mudah dipasang."
              ),
            ]),
          },
          {
            title: "Foto: Anatomi Halaman Web",
            type: "foto",
            duration: "10 mnt",
            position: 2,
            content: tipDoc([
              tipPara("Amati diagram anatomi halaman web berikut. Cocokkan tiap area dengan materi bacaan setelah ini."),
              {
                type: "image",
                attrs: { src: DEMO_PHOTO_URL, alt: "Ilustrasi anatomi halaman web", title: "Anatomi halaman web" },
              },
              tipPara("Header: judul + navigasi. Main: konten utama tiap halaman. Footer: info tambahan dan tautan."),
            ]),
          },
        ],
      },
      {
        title: "Bacaan & Tugas File",
        description: "Pendalaman bacaan plus latihan upload file PDF.",
        position: 2,
        materials: [
          {
            title: "Bacaan: Struktur Halaman yang Rapi",
            type: "bacaan",
            duration: "15 mnt",
            position: 1,
            content: tipDoc([
              tipPara(
                "Gunakan satu elemen main per halaman, heading berurutan (h1 lalu h2, bukan lompat ke h4), dan landmark seperti header, nav, main, footer agar pembaca layar mudah melompat antar bagian."
              ),
              tipPara(
                "Formulir wajib punya label yang terhubung ke tiap input. Pesan error diletakkan dekat kolomnya, bukan hanya di atas halaman, agar mudah diperbaiki."
              ),
              tipPara(
                "Gambar informatif wajib punya alt yang menjelaskan isi, sedangkan gambar dekoratif boleh memakai alt kosong agar tidak berisik bagi pembaca layar."
              ),
            ]),
          },
          {
            title: "Tugas: Kumpulkan File PDF Pertama",
            type: "tugas",
            duration: "45 mnt",
            position: 2,
            content: tipDoc([
              tipPara(
                "Latihan upload file: kumpulkan PDF apa pun untuk menguji validasi (ekstensi, tipe, header %PDF, maks 10 MB). Coba juga pilih file non-PDF untuk melihat pesan error yang benar."
              ),
              tipPara("Hasil dikumpulkan: satu file PDF bebas isi, untuk latihan."),
            ]),
          },
        ],
      },
    ],
  },
  {
    title: "Modul 3 — Evaluasi & Proyek Akhir",
    description: "Uji pemahaman lewat kuis, kumpulkan proyek akhir, dan tonton penutup.",
    position: 3,
    subs: [
      {
        title: "Video & Kuis",
        description: "Tonton rangkuman lalu uji pemahaman dengan kuis.",
        position: 1,
        materials: [
          {
            title: "Video: Rangkuman & Demo Proyek",
            type: "video",
            duration: "18 mnt",
            position: 1,
            content: tipDoc([
              tipPara("Rekap dua modul sebelumnya dan demo proyek akhir yang diharapkan."),
              { type: "videoEmbed", attrs: { src: DEMO_VIDEO_URL, title: "Video rangkuman dan demo proyek" } },
              tipPara("Pastikan semua format media sudah dicoba, siapkan PDF proyek akhir, lalu buka halaman kuis."),
            ]),
          },
          {
            title: "Kuis: Pemahaman Dasar Web",
            type: "kuis",
            duration: "20 mnt",
            position: 2,
            passScore: 70,
            content: tipDoc([
              tipPara(
                "Uji pemahaman dasar web. Tanpa batas percobaan — nilai terbaik yang dipakai (K-02). Nilai minimal 70 untuk lolos."
              ),
            ]),
          },
        ],
      },
      {
        title: "Proyek Akhir",
        description: "Tugas penutup sebagai bukti hasil belajar.",
        position: 2,
        materials: [
          {
            title: "Tugas: Proyek Akhir Halaman Profil",
            type: "tugas",
            duration: "90 mnt",
            position: 1,
            content: tipDoc([
              tipPara(
                "Buat satu halaman profil (HTML semantik: header–main–footer + 1 form kontak) dan kumpulkan sebagai PDF — boleh berupa dokumentasi langkah + tangkapan layar."
              ),
              tipPara(
                "Uji cepat sebelum mengumpulkan: heading berurutan, label form terhubung, gambar punya alt. Pantau status kiriman dan coba revisi bila perlu."
              ),
              tipPara("Hasil dikumpulkan: satu file PDF proyek akhir (dokumentasi + tangkapan layar)."),
            ]),
          },
        ],
      },
    ],
  },
];

const DEMO_QUIZ: DemoQuizItem[] = [
  {
    position: 1,
    questionText: "Elemen semantik HTML yang tepat untuk konten utama halaman adalah …",
    explanation: "Elemen main menandai konten utama dan hanya boleh ada satu per halaman.",
    options: [
      { position: 1, optionText: "<div> dengan id main", isCorrect: false },
      { position: 2, optionText: "<main>", isCorrect: true },
      { position: 3, optionText: "<span> utama", isCorrect: false },
      { position: 4, optionText: "<font> besar", isCorrect: false },
    ],
  },
  {
    position: 2,
    questionText: "Atribut yang menghubungkan <label> dengan kolom input adalah …",
    explanation: "Atribut for pada label harus sama dengan id pada input agar klik label memfokuskan kolom.",
    options: [
      { position: 1, optionText: "name", isCorrect: false },
      { position: 2, optionText: "type", isCorrect: false },
      { position: 3, optionText: "for (pasangan id)", isCorrect: true },
      { position: 4, optionText: "href", isCorrect: false },
    ],
  },
  {
    position: 3,
    questionText: "Arti atribut required pada input form adalah …",
    explanation: "Browser menolak submit dan menampilkan pesan bawaan bila kolom required masih kosong.",
    options: [
      { position: 1, optionText: "Kolom wajib diisi", isCorrect: true },
      { position: 2, optionText: "Kolom hanya-baca", isCorrect: false },
      { position: 3, optionText: "Kolom tersembunyi", isCorrect: false },
      { position: 4, optionText: "Kolom tanpa validasi", isCorrect: false },
    ],
  },
  {
    position: 4,
    questionText: "Target sentuh minimal tombol di layar sentuh menurut panduan aksesibilitas adalah …",
    explanation: "WCAG menargetkan minimal 24px (AA 2.2) dan praktik terbaik 44×44 px agar mudah disentuh.",
    options: [
      { position: 1, optionText: "8 × 8 px", isCorrect: false },
      { position: 2, optionText: "16 × 16 px", isCorrect: false },
      { position: 3, optionText: "44 × 44 px", isCorrect: true },
      { position: 4, optionText: "120 × 120 px", isCorrect: false },
    ],
  },
  {
    position: 5,
    questionText: "Atribut alt kosong (alt=\"\") paling tepat untuk …",
    explanation: "Gambar dekoratif diberi alt kosong agar pembaca layar melewatinya tanpa berisik.",
    options: [
      { position: 1, optionText: "Diagram berisi data penting", isCorrect: false },
      { position: 2, optionText: "Foto produk di katalog", isCorrect: false },
      { position: 3, optionText: "Gambar hiasan dekoratif", isCorrect: true },
      { position: 4, optionText: "Grafik hasil kuis", isCorrect: false },
    ],
  },
];

function lastInsertId(h: unknown): number {
  return Number((h as unknown as { insertId: number }).insertId);
}

async function findTeacherKevinId(): Promise<number> {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        eq(users.role, "teacher"),
        or(
          eq(users.username, "kevin"),
          like(users.email, "%kevin%"),
          like(users.name, "%kevin%")
        )
      )
    )
    .limit(1);
  if (!rows[0]) {
    throw new Error(
      "Akun teacher 'kevin' tidak ditemukan di tabel users. Buat/aktifkan dulu akunnya, lalu jalankan seed lagi."
    );
  }
  return rows[0].id;
}

async function ensureDemoModule(courseId: number, m: DemoModule): Promise<number> {
  const rows = await db
    .select({ id: modules.id })
    .from(modules)
    .where(and(eq(modules.courseId, courseId), eq(modules.position, m.position)))
    .limit(1);
  if (rows[0]) {
    await db
      .update(modules)
      .set({ title: m.title, description: m.description, type: "materi" })
      .where(eq(modules.id, rows[0].id));
    return rows[0].id;
  }
  const [h] = await db.insert(modules).values({
    courseId,
    title: m.title,
    description: m.description,
    type: "materi",
    position: m.position,
  });
  return lastInsertId(h);
}

async function ensureDemoSub(moduleId: number, s: DemoSub): Promise<number> {
  const rows = await db
    .select({ id: subModules.id })
    .from(subModules)
    .where(and(eq(subModules.moduleId, moduleId), eq(subModules.position, s.position)))
    .limit(1);
  if (rows[0]) {
    await db
      .update(subModules)
      .set({ title: s.title, description: s.description })
      .where(eq(subModules.id, rows[0].id));
    return rows[0].id;
  }
  const [h] = await db.insert(subModules).values({
    moduleId,
    title: s.title,
    description: s.description,
    position: s.position,
  });
  return lastInsertId(h);
}

async function ensureDemoMaterial(
  moduleId: number,
  subId: number,
  mat: DemoMaterial
): Promise<number> {
  const rows = await db
    .select({ id: materials.id })
    .from(materials)
    .where(
      and(
        eq(materials.moduleId, moduleId),
        eq(materials.subModuleId, subId),
        eq(materials.position, mat.position)
      )
    )
    .limit(1);
  const values = {
    title: mat.title,
    type: mat.type,
    duration: mat.duration,
    content: mat.content,
    contentSchemaVersion: 1,
    passScore: mat.passScore ?? 70,
  };
  if (rows[0]) {
    await db.update(materials).set(values).where(eq(materials.id, rows[0].id));
    return rows[0].id;
  }
  const [h] = await db.insert(materials).values({
    moduleId,
    subModuleId: subId,
    position: mat.position,
    ...values,
  });
  return lastInsertId(h);
}

async function resetDemoQuizBank(quizMaterialId: number): Promise<void> {
  // Opsi ikut terhapus via FK cascade; attempts tetap utuh (snapshot audit).
  await db.delete(quizQuestions).where(eq(quizQuestions.materialId, quizMaterialId));
  for (const q of DEMO_QUIZ) {
    const [h] = await db.insert(quizQuestions).values({
      materialId: quizMaterialId,
      position: q.position,
      questionText: q.questionText,
      explanation: q.explanation,
    });
    const questionId = lastInsertId(h);
    for (const o of q.options) {
      await db.insert(quizOptions).values({
        questionId,
        position: o.position,
        optionText: o.optionText,
        isCorrect: o.isCorrect,
      });
    }
  }
}

async function seedDemoCourse(): Promise<void> {
  const kevinId = await findTeacherKevinId();
  const byTitle = await db
    .select({ id: courses.id, title: courses.title })
    .from(courses)
    .where(eq(courses.title, DEMO_COURSE_TITLE))
    .limit(1);

  let courseId: number;
  if (byTitle[0]) {
    courseId = byTitle[0].id;
    console.log(`[seed] demo-course: pakai id ${courseId} (sudah ada)`);
  } else {
    const byId = await db
      .select({ id: courses.id, title: courses.title })
      .from(courses)
      .where(eq(courses.id, DEMO_COURSE_ID))
      .limit(1);
    if (byId[0]) {
      throw new Error(
        `id kursus ${DEMO_COURSE_ID} sudah dipakai "${byId[0].title}" (bukan kursus demo). Batalkan agar tidak menimpa data lain.`
      );
    }
    await db.insert(courses).values({
      id: DEMO_COURSE_ID,
      title: DEMO_COURSE_TITLE,
      description:
        "Kursus contoh untuk uji coba: 3 modul, 6 sub-modul, 10 materi (video, bacaan, audio, foto, kuis, tugas). Gratis dan langsung terbuka agar semua alur belajar bisa dicoba.",
      category: "Pengembangan Web",
      level: "Pemula",
      duration: "3 Minggu",
      image:
        "https://images.unsplash.com/photo-1542831371-29b0f74f9713?auto=format&fit=crop&w=600&q=80",
      status: "published",
      priceLabel: "GRATIS",
      priceNominal: 0,
      period: "ongoing",
      startMonth: null,
      outcomes: [
        "Memahami alur belajar dan format materi (video, bacaan, audio, foto)",
        "Mencoba pengumpulan tugas PDF dan revisi tanpa batas",
        "Mengetahui cara kerja kuis server dan nilai kelulusan",
      ],
      requirements: [
        "Browser modern dan koneksi internet",
        "File PDF contoh untuk latihan upload",
        "Tidak perlu pengalaman sebelumnya",
      ],
      tools: ["Browser modern", "File PDF contoh"],
      createdBy: kevinId,
    });
    courseId = DEMO_COURSE_ID;
    console.log(`[seed] demo-course: kursus "${DEMO_COURSE_TITLE}" (id ${courseId})`);
  }

  const link = await db
    .select({ courseId: courseInstructors.courseId })
    .from(courseInstructors)
    .where(
      and(eq(courseInstructors.courseId, courseId), eq(courseInstructors.userId, kevinId))
    )
    .limit(1);
  if (!link[0]) {
    await db.insert(courseInstructors).values({ courseId, userId: kevinId });
    console.log(`[seed] demo-course: tautkan pengampu kevin (user ${kevinId})`);
  }

  let quizMaterialId = 0;
  for (const m of DEMO_MODULES) {
    const moduleId = await ensureDemoModule(courseId, m);
    for (const s of m.subs) {
      const subId = await ensureDemoSub(moduleId, s);
      for (const mat of s.materials) {
        const matId = await ensureDemoMaterial(moduleId, subId, mat);
        if (mat.type === "kuis") quizMaterialId = matId;
      }
    }
  }
  if (quizMaterialId > 0) {
    await resetDemoQuizBank(quizMaterialId);
    console.log(`[seed] demo-course: bank soal materi kuis ${quizMaterialId} (${DEMO_QUIZ.length} soal)`);
  }
  console.log(`[seed] demo-course: selesai (course ${courseId})`);
}

async function main() {
  const existingUsers = await db.select({ id: users.id }).from(users).limit(1);
  if (existingUsers.length === 0) {
    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
    await seedUsers(passwordHash);
  } else {
    console.log("[seed] users: lewati (sudah berisi)");
  }
  await seedCategories();
  await seedPromos();
  await seedDemoCourse();
  await pool.end();
}

void main().catch(async (e) => {
  console.error("[seed] gagal:", e);
  await pool.end();
  process.exit(1);
});

