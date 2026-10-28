import dotenv from "dotenv";
import path from "node:path";

// Samakan aturan pemuatan .env dengan koneksi utama (db/index.ts).
dotenv.config({
  path: path.resolve(__dirname, "../../.env"),
});

import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import { db, pool } from "./index";
import {
  users,
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
      email: "rayyan@gmail.com",
      passwordHash,
      role: "student",
    },
  ]);
  console.log("[seed] users: 1 (student)");
}

