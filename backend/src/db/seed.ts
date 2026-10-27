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
      id: ADMIN_ID,
      name: "Admin Aristoteles",
      email: "admin@aristoteles.ac.id",
      passwordHash,
      role: "admin",
    },
    {
      id: TEACHER_ID,
      name: "Kevin Perry",
      email: "kevin@aristoteles.ac.id",
      passwordHash,
      role: "teacher",
    },
    {
      id: STUDENT_ID,
      name: "Ahmad Farizi",
      email: "farisi@gmail.com",
      passwordHash,
      role: "student",
    },
  ]);
  console.log("[seed] users: 3 (admin, teacher, student)");
}

async function seedCourses() {
  await db.insert(courses).values([
    {
      id: COURSE_FREE_ID,
      title: "Pengembangan Web Frontend",
      description: "Kuasai HTML, CSS, JavaScript, dan framework modern.",
      category: "Pengembangan Web",
      level: "Pemula",
      duration: "8 Minggu",
      image: "https://images.unsplash.com/photo-1531403009284-440f080d1e12?auto=format&fit=crop&w=600&q=80",
      status: "published",
      priceLabel: "GRATIS",
      priceNominal: 0,
      period: "ongoing",
      startMonth: null,
      outcomes: ["Membangun halaman web semantik yang aksesibel"],
      requirements: ["Laptop/komputer dengan browser modern"],
      tools: ["Browser modern", "Editor kode"],
      createdBy: TEACHER_ID,
    },
    {
      id: COURSE_PAID_ID,
      title: "Analitik Data & Dashboard",
      description: "Bangun dashboard dan cerita data dengan Python.",
      category: "Sains Data",
      level: "Menengah",
      duration: "6 Minggu",
      image: null,
      status: "published",
      priceLabel: "Rp349.000",
      priceNominal: 349000,
      period: "ongoing",
      startMonth: null,
      outcomes: ["Membangun dashboard Streamlit"],
      requirements: ["Terbiasa memakai spreadsheet"],
      tools: ["Akun Google Colab"],
      createdBy: TEACHER_ID,
    },
  ]);
  console.log("[seed] courses: 2 (gratis + berbayar)");
}

async function seedCourseInstructors() {
  await db.insert(courseInstructors).values([
    { courseId: COURSE_FREE_ID, userId: TEACHER_ID },
    { courseId: COURSE_PAID_ID, userId: TEACHER_ID },
  ]);
  console.log("[seed] course_instructors: 2");
}

async function seedModules() {
  await db.insert(modules).values([
    {
      id: MODULE_MATERI_ID,
      courseId: COURSE_FREE_ID,
      title: "Dasar HTML & Struktur Web",
      description: "Pengenalan dokumen HTML.",
      type: "materi",
      position: 1,
    },
    {
      id: MODULE_KUIS_ID,
      courseId: COURSE_FREE_ID,
      title: "Kuis Dasar HTML",
      description: "Uji pemahaman HTML.",
      type: "kuis",
      position: 2,
    },
    {
      id: MODULE_TUGAS_ID,
      courseId: COURSE_PAID_ID,
      title: "Tugas Dashboard Penjualan",
      description: "Proyek akhir dashboard.",
      type: "tugas",
      position: 1,
    },
  ]);
  console.log("[seed] modules: 3 (materi, kuis, tugas)");
}

async function seedSubModules() {
  await db.insert(subModules).values([
    {
      id: SUB_HTML_ID,
      moduleId: MODULE_MATERI_ID,
      title: "Struktur Dokumen",
      description: "Tag, elemen, dan atribut dasar.",
      position: 1,
    },
  ]);
  console.log("[seed] sub_modules: 1");
}

async function seedMaterials() {
  await db.insert(materials).values([
    {
      id: MATERIAL_TEKS_ID,
      moduleId: MODULE_MATERI_ID,
      subModuleId: SUB_HTML_ID,
      title: "Pengenalan Tag HTML",
      type: "materi",
      duration: "10 menit",
      content: "Materi demo: struktur dasar dokumen HTML.",
      position: 1,
    },
    {
      id: MATERIAL_KUIS_ID,
      moduleId: MODULE_KUIS_ID,
      subModuleId: null,
      title: "Kuis Pilihan Ganda HTML",
      type: "kuis",
      duration: "15 menit",
      content: "Kuis demo: 10 soal pilihan ganda.",
      position: 1,
    },
    {
      id: MATERIAL_TUGAS_ID,
      moduleId: MODULE_TUGAS_ID,
      subModuleId: null,
      title: "Kumpulkan Dashboard Streamlit",
      type: "tugas",
      duration: "1 minggu",
      content: "Tugas demo: unggah berkas PDF.",
      position: 1,
    },
  ]);
  console.log("[seed] materials: 3");
}

async function seedInstructorInvitations() {
  const tokenHash = createHash("sha256")
    .update("aristoteles-dev-invite-token-01")
    .digest("hex");

  await db.insert(instructorInvitations).values([
    {
      id: INVITATION_ID,
      email: "instruktur.baru@aristoteles.ac.id",
      name: "Instruktur Baru",
      note: "Undangan demo development.",
      tokenHash,
      status: "pending",
      invitedBy: ADMIN_ID,
      expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
    },
  ]);
  console.log("[seed] instructor_invitations: 1 (pending)");
}

async function seedEnrollments() {
  await db.insert(enrollments).values([
    {
      userId: STUDENT_ID,
      courseId: COURSE_FREE_ID,
      source: "free",
    },
    {
      userId: STUDENT_ID,
      courseId: COURSE_PAID_ID,
      source: "voucher",
    },
  ]);
  console.log("[seed] enrollments: 2 (free + voucher)");
}

async function seedQuizAttempts() {
  await db.insert(quizAttempts).values([
    {
      id: QUIZ_ATTEMPT_1_ID,
      userId: STUDENT_ID,
      materialId: MATERIAL_KUIS_ID,
      score: 60,
      total: 10,
      correct: 6,
      passScore: 70,
    },
    {
      id: QUIZ_ATTEMPT_2_ID,
      userId: STUDENT_ID,
      materialId: MATERIAL_KUIS_ID,
      score: 80,
      total: 10,
      correct: 8,
      passScore: 70,
    },
  ]);
  console.log("[seed] quiz_attempts: 2 (60 lalu 80, untuk uji nilai terbaik)");
}

async function seedSubmissions() {
  await db.insert(submissions).values([
    {
      id: SUBMISSION_ID,
      userId: STUDENT_ID,
      materialId: MATERIAL_TUGAS_ID,
      filePath: "uploads/demo-tugas-01.pdf",
      studentName: "Ahmad Farizi",
      studentNim: "2101020045",
      note: "Pengumpulan demo.",
      driveFileId: null,
      driveLink: null,
      score: null,
      feedback: null,
      status: "submitted",
    },
  ]);
  console.log("[seed] submissions: 1 (submitted)");
}

async function seedProgress() {
  await db.insert(progress).values([
    { userId: STUDENT_ID, materialId: MATERIAL_TEKS_ID },
  ]);
  console.log("[seed] progress: 1 (materi teks selesai)");
}

async function seedVouchers() {
  await db.insert(vouchers).values([
    {
      code: "ARISTOTELES-DEV-01",
      courseId: COURSE_PAID_ID,
      kind: "umum",
      maxUses: 20,
      usedCount: 0,
      assignedUserId: null,
      expiresAt: null,
      status: "available",
    },
    {
      code: "ARISTOTELES-DEV-02",
      courseId: COURSE_PAID_ID,
      kind: "personal",
      maxUses: 1,
      usedCount: 0,
      assignedUserId: STUDENT_ID,
      expiresAt: null,
      status: "assigned",
    },
  ]);
  console.log("[seed] vouchers: 2 (umum + personal)");
}

async function seedVoucherRedemptions() {
  // Jejak contoh: belum ada penukaran (usedCount 0) — tabel siap dipakai.
  console.log("[seed] voucher_redemptions: 0 (skema siap)");
}

async function seedCertificates() {
  await db.insert(certificates).values([
    {
      id: CERTIFICATE_ID,
      userId: STUDENT_ID,
      courseId: COURSE_FREE_ID,
      moduleId: MODULE_MATERI_ID,
      credentialId: "ATS-2026-C1-M1",
      code: "ATS-2026-SEED0001",
      recipientName: "Ahmad Farizi",
      status: "issued",
    },
  ]);
  console.log("[seed] certificates: 1");
}

async function main() {
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .limit(1);

  if (existing.length > 0) {
    console.log("[seed] dibatalkan: tabel users sudah berisi data. Tidak ada baris yang diubah.");
    return;
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  // Urutan mengikuti foreign key: users -> courses -> course_instructors,
  // modules -> sub_modules -> materials, lalu tabel turunan yang merujuknya.
  await seedUsers(passwordHash);
  await seedCourses();
  await seedCourseInstructors();
  await seedModules();
  await seedSubModules();
  await seedMaterials();
  await seedInstructorInvitations();
  await seedEnrollments();
  await seedQuizAttempts();
  await seedSubmissions();
  await seedProgress();
  await seedVouchers();
  await seedVoucherRedemptions();
  await seedCertificates();

  console.log("[seed] selesai. Akun demo: admin/teacher/student (lihat SEED_DEMO_PASSWORD bila dikustom).");
}

main()
  .catch((error: unknown) => {
    console.error("[seed] gagal:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
