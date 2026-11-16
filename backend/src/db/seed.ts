import dotenv from "dotenv";
import path from "node:path";

// Samakan aturan pemuatan .env dengan koneksi utama (db/index.ts).
dotenv.config({
  path: path.resolve(__dirname, "../../.env"),
});

import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
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
  await pool.end();
}

void main().catch(async (e) => {
  console.error("[seed] gagal:", e);
  await pool.end();
  process.exit(1);
});

