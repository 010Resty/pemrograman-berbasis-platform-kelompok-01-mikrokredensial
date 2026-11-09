import {
  mysqlTable,
  varchar,
  int,
  boolean,
  timestamp,
  date,
  mysqlEnum,
  text,
  mediumtext,
  json,
  index,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/mysql-core";
import type { AnyMySqlColumn } from "drizzle-orm/mysql-core";

// Konvensi ID: integer auto-increment di semua tabel entitas,
// selaras dengan frontend (mis. Course.id: number).
// Satu-satunya PK non-numerik adalah kode voucher (string final).

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  email: varchar("email", { length: 191 }).notNull().unique(),
  // Username unik untuk identitas publik (mis. anggota patungan).
  // Wajib diisi untuk akun baru; baris lama di-backfill saat migrasi 0014.
  username: varchar("username", { length: 50 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  role: mysqlEnum("role", ["student", "teacher", "admin"])
    .notNull()
    .default("student"),
  // Keahlian instruktur (opsional, dikelola admin; NULL = belum diisi).
  expertise: varchar("expertise", { length: 100 }),
  // Profil peserta (opsional, dikelola pemilik akun via /me/profile).
  // NULL = belum diisi; avatar menunjuk files kind=image milik sendiri.
  phone: varchar("phone", { length: 30 }),
  gender: mysqlEnum("gender", ["L", "P"]),
  birthPlace: varchar("birth_place", { length: 100 }),
  birthDate: date("birth_date"),
  avatarFileId: int("avatar_file_id").references(
    (): AnyMySqlColumn => files.id,
    {
      onDelete: "set null",
      onUpdate: "cascade",
    }
  ),
  // Sampul banner profil (opsional, milik sendiri, kind=profile_cover).
  // Anotasi sama demi siklus inferensi (lihat avatar).
  coverFileId: int("cover_file_id").references(
    (): AnyMySqlColumn => files.id,
    {
      onDelete: "set null",
      onUpdate: "cascade",
    }
  ),
  // Penonaktifan oleh admin; ditegakkan saat login (jendela token ≤15 mnt).
  // Penanda verifikasi email alur OTP. NULL = belum diverifikasi.
  // Baris lama di-backfill saat migrasi 0008.
  emailVerifiedAt: timestamp("email_verified_at"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

// Sesi refresh untuk klien mobile (Flutter): token opaque sekali pakai
// (rotasi), hanya hash SHA-256 yang disimpan — mirip undangan instruktur.
// Akses tetap JWT 15 menit; refresh berlaku REFRESH_EXPIRES_DAYS (default 30).
// Tanpa migrasi tambahan setelah ini: pencabutan = tandai revokedAt.
export const refreshTokens = mysqlTable(
  "refresh_tokens",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
    expiresAt: timestamp("expires_at").notNull(),
    revokedAt: timestamp("revoked_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    refreshUserIdx: index("refresh_tokens_user_idx").on(table.userId),
  })
);

export const instructorInvitations = mysqlTable(
  "instructor_invitations",
  {
    id: int("id").autoincrement().primaryKey(),
    email: varchar("email", { length: 191 }).notNull(),
    // Nama + catatan undangan sesuai alur aktivasi di frontend
    // (routes/admin/invitations, routes/invite/[token]).
    name: varchar("name", { length: 100 }),
    note: text("note"),
    tokenHash: varchar("token_hash", { length: 255 }).notNull().unique(),
    status: mysqlEnum("status", [
      "pending",
      "accepted",
      "revoked",
      "expired",
    ])
      .notNull()
      .default("pending"),
    invitedBy: int("invited_by").references(() => users.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
  emailIdx: index("instructor_invitations_email_idx").on(table.email),
})
);

// Profil kursus sesuai halaman katalog/detail frontend
// (routes/modules, user/semua-kursus, instruktur/kursusku/tambah):
// judul, kategori, level, durasi, deskripsi, sampul, harga, periode,
// hasil belajar (outcomes), syarat (requirements), dan alat (tools).
export const courses = mysqlTable("courses", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 100 }),
  level: varchar("level", { length: 50 }).notNull().default("Pemula"),
  duration: varchar("duration", { length: 100 }),
  image: varchar("image", { length: 500 }),
  status: mysqlEnum("status", ["draft", "published", "archived"])
    .notNull()
    .default("draft"),
  // Label harga tampil ("GRATIS" / "Rp...") + nominal untuk logika berbayar.
  priceLabel: varchar("price_label", { length: 100 }).notNull(),
  priceNominal: int("price_nominal").notNull().default(0),
  period: varchar("period", { length: 100 }).notNull(),
  startMonth: varchar("start_month", { length: 100 }),
  outcomes: json("outcomes").$type<string[]>(),
  requirements: json("requirements").$type<string[]>(),
  tools: json("tools").$type<string[]>(),
  // Pemilik kursus (instruktur pembuat).
  createdBy: int("created_by").references(() => users.id, {
    onDelete: "set null",
    onUpdate: "cascade",
  }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

// Relasi pengampu: satu kursus bisa diampu banyak instruktur dan sebaliknya.
// Dipakai menegakkan "instruktur mengelola kursus tanggung jawabnya".
export const courseInstructors = mysqlTable(
  "course_instructors",
  {
    courseId: int("course_id")
      .notNull()
      .references(() => courses.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    userId: int("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    assignedAt: timestamp("assigned_at").defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({
      columns: [table.courseId, table.userId],
    }),
  })
);

export const modules = mysqlTable("modules", {
  id: int("id").autoincrement().primaryKey(),
  courseId: int("course_id")
    .notNull()
    .references(() => courses.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  type: mysqlEnum("type", ["materi", "tugas", "kuis"]).notNull(),
  position: int("position").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  courseIdx: index("modules_course_idx").on(table.courseId),
}));

// Hierarki frontend: Course -> Modul -> Sub-Modul -> Materi.
// Kolom `materials` flat di UI adalah turunan kompatibilitas, bukan tabel.
export const subModules = mysqlTable("sub_modules", {
  id: int("id").autoincrement().primaryKey(),
  moduleId: int("module_id")
    .notNull()
    .references(() => modules.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  position: int("position").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const materials = mysqlTable("materials", {
  id: int("id").autoincrement().primaryKey(),
  moduleId: int("module_id")
    .notNull()
    .references(() => modules.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
  // Keanggotaan sub-modul. Nullable: materi lama tetap valid tanpa sub-modul.
  subModuleId: int("sub_module_id").references(() => subModules.id, {
    onDelete: "set null",
    onUpdate: "cascade",
  }),
  title: varchar("title", { length: 255 }).notNull(),
  // Jenis materi sesuai UI (7 nilai, dinormalisasi ke materi/tugas/kuis di klien).
  type: mysqlEnum("type", [
    "materi",
    "tugas",
    "kuis",
    "video",
    "bacaan",
    "audio",
    "foto",
  ])
    .notNull()
    .default("materi"),
  duration: varchar("duration", { length: 50 }),
  // Dokumen JSON Tiptap (diserialisasi). MEDIUMTEXT agar muat dokumen kaya;
  // base64 dilarang via validasi aplikasi (lihat modul materials).
  content: mediumtext("content"),
  // Versi skema node konten — pengaman kompatibilitas render.
  contentSchemaVersion: int("content_schema_version").notNull().default(1),
  // Ambang kelulusan kuis (0–100, default 70). Hanya bermakna untuk type='kuis';
  // materi non-kuis mengabaikan kolom ini (bukan persyaratan kelulusan).
  passScore: int("pass_score").notNull().default(70),
  position: int("position").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  moduleIdx: index("materials_module_idx").on(table.moduleId),
}));

// Metadata berkas yang disimpan di disk server (Opsi A).
// Byte berkas TIDAK di database — kolom ini hanya penunjuk + metadata.
export const files = mysqlTable("files", {
  id: int("id").autoincrement().primaryKey(),
  // Pemilik NULL = unggahan publik tanpa akun (mis. pengajuan instruktur).
  // Berkas jenis applicant_* hanya boleh dibaca admin (lihat serveFile).
  ownerUserId: int("owner_user_id").references(() => users.id, {
    onDelete: "cascade",
    onUpdate: "cascade",
  }),
  kind: mysqlEnum("kind", [
    "image",
    "audio",
    "pdf",
    "cover",
    "assignment",
    "applicant_image",
    "applicant_cv",
    "payment_proof",
    "avatar",
    "profile_cover",
  ])
    .notNull()
    .default("image"),
  originalName: varchar("original_name", { length: 255 }).notNull(),
  mimeType: varchar("mime_type", { length: 100 }).notNull(),
  sizeBytes: int("size_bytes").notNull().default(0),
  storageKey: varchar("storage_key", { length: 255 }).notNull().unique(),
  url: varchar("url", { length: 500 }).notNull(),
  sha256: varchar("sha256", { length: 64 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const enrollments = mysqlTable(
  "enrollments",
  {
    userId: int("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    courseId: int("course_id")
      .notNull()
      .references(() => courses.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    // Asal pendaftaran: free | voucher | manual | payment:<gateway>.
    // Nilai sah final diputuskan saat kebijakan pembayaran ditetapkan.
    source: varchar("source", { length: 50 }).notNull(),
    status: mysqlEnum("status", [
      "active",
      "completed",
      "expired",
      "cancelled",
    ])
      .notNull()
      .default("active"),
    enrolledAt: timestamp("enrolled_at").defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({
      columns: [table.userId, table.courseId],
    }),
    // Optimasi daftar peserta per kursus (eligibility/dashboard): filter courseId+status.
    courseStatusIdx: index("enrollments_course_status_idx").on(
      table.courseId,
      table.status
    ),
  })
);

// Riwayat percobaan kuis: tiap baris satu percobaan.
// Nilai terbaik = MAX(score) per user+materi; ambang lulus per percobaan.
// Kolom answers + snapshot diisi server saat menilai (audit); baris lama
// (pra-Batch 1) boleh NULL karena berasal dari era skor demo.
export interface QuizAttemptAnswer {
  questionId: number;
  optionId: number | null;
}

export interface QuizSnapshotOption {
  id: number;
  position: number;
  optionText: string;
  isCorrect: boolean;
}

export interface QuizSnapshotQuestion {
  id: number;
  position: number;
  questionText: string;
  explanation: string | null;
  imageUrl: string | null;
  audioUrl: string | null;
  fileUrl: string | null;
  fileName: string | null;
  options: QuizSnapshotOption[];
}

export interface QuizSnapshot {
  questions: QuizSnapshotQuestion[];
}

export const quizAttempts = mysqlTable("quiz_attempts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id")
    .notNull()
    .references(() => users.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
  materialId: int("material_id")
    .notNull()
    .references(() => materials.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
  score: int("score").notNull(),
  total: int("total"),
  correct: int("correct"),
  passScore: int("pass_score").notNull().default(70),
  // Jawaban mentah peserta per percobaan (selalu diisi server untuk attempt baru).
  answers: json("answers").$type<QuizAttemptAnswer[]>(),
  // Snapshot soal+opsi+kunci saat dinilai — audit tetap valid walau soal berubah.
  snapshot: json("snapshot").$type<QuizSnapshot>(),
  attemptedAt: timestamp("attempted_at").defaultNow().notNull(),
},
(table) => ({
  userMaterialIdx: index("quiz_attempts_user_material_idx").on(
    table.userId,
    table.materialId
  ),
}));

// Bank soal kuis MVP: pilihan ganda, tepat satu benar per soal.
// Soal & kunci hidup di server agar penilaian otomatis aman
// (skor kiriman klien tidak dipercaya).
export const quizQuestions = mysqlTable(
  "quiz_questions",
  {
    id: int("id").autoincrement().primaryKey(),
    materialId: int("material_id")
      .notNull()
      .references(() => materials.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    position: int("position").notNull(),
    questionText: text("question_text").notNull(),
    explanation: text("explanation"),
    // Lampiran opsional per soal (URL berkas server /api/v1/files/...,
    // diunggah via POST /uploads; NULL = tanpa lampiran).
    imageUrl: varchar("image_url", { length: 500 }),
    audioUrl: varchar("audio_url", { length: 500 }),
    fileUrl: varchar("file_url", { length: 500 }),
    fileName: varchar("file_name", { length: 255 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    materialIdx: index("quiz_questions_material_idx").on(table.materialId),
  })
);

export const quizOptions = mysqlTable(
  "quiz_options",
  {
    id: int("id").autoincrement().primaryKey(),
    questionId: int("question_id")
      .notNull()
      .references(() => quizQuestions.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    position: int("position").notNull(),
    optionText: text("option_text").notNull(),
    isCorrect: boolean("is_correct").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    questionIdx: index("quiz_options_question_idx").on(table.questionId),
  })
);

// Riwayat pengumpulan tugas: kumpul ulang tanpa batas (satu baris per kumpul).
// Kolom identitas + Drive mengikuti kontrak proxy frontend
// (/api/assignments/*); integrasi Drive diputuskan terpisah.
// fileId menautkan ke tabel files (kind='assignment') agar proteksi akses
// berkas dapat ditegakkan; filePath menyimpan snapshot URL konten.
// Penilaian: gradedBy/gradedAt + decision eksplisit (passed/failed/
// revision_requested); lulus bersifat menempel (EXISTS passed).
export const submissions = mysqlTable(
  "submissions",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    materialId: int("material_id")
      .notNull()
      .references(() => materials.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    fileId: int("file_id").references(() => files.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    filePath: varchar("file_path", { length: 500 }).notNull(),
    studentName: varchar("student_name", { length: 100 }),
    studentNim: varchar("student_nim", { length: 30 }),
    note: text("note"),
    driveFileId: varchar("drive_file_id", { length: 255 }),
    driveLink: varchar("drive_link", { length: 500 }),
    score: int("score"),
    feedback: text("feedback"),
    // Rincian rubrik K-06 (Kelengkapan/Ketepatan isi/Kerapian, 0–100).
    // NULL = dinilai langsung tanpa rubrik (kompatibel nilai lama).
    // Skor efektif = rata-rata bulat, dihitung SERVER saat rubrik dikirim.
    rubricScores: json("rubric_scores").$type<{
      kelengkapan: number;
      ketepatan: number;
      kerapian: number;
    }>(),
    gradedBy: int("graded_by").references(() => users.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    gradedAt: timestamp("graded_at"),
    status: mysqlEnum("status", [
      "submitted",
      "reviewed",
      "revision_requested",
      "passed",
      "failed",
    ])
      .notNull()
      .default("submitted"),
    submittedAt: timestamp("submitted_at").defaultNow().notNull(),
  },
  (table) => ({
    materialUserIdx: index("submissions_material_user_idx").on(
      table.materialId,
      table.userId
    ),
  })
);

export const progress = mysqlTable(
  "progress",
  {
    userId: int("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    materialId: int("material_id")
      .notNull()
      .references(() => materials.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    completedAt: timestamp("completed_at").defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({
      columns: [table.userId, table.materialId],
    }),
    // Batch progres per materi (eligibility): filter materialId.
    materialIdx: index("progress_material_idx").on(table.materialId),
  })
);

// Voucher resmi: terikat kursus, batas pakai, riwayat penukaran.
// Pemetaan status UI: Aktif~available/assigned, Habis/Digunakan~redeemed,
// Kedaluwarsa~expired, Dinonaktifkan~revoked.
export const vouchers = mysqlTable(
  "vouchers",
  {
    code: varchar("code", { length: 100 }).primaryKey(),
    courseId: int("course_id").references(() => courses.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    kind: mysqlEnum("kind", ["personal", "umum", "diskon"]).notNull().default("umum"),
    maxUses: int("max_uses").notNull().default(1),
    /** Diskon khusus kind="diskon" (K-03 opsi A): percent 1–100 atau nominal rupiah. */
    discountType: mysqlEnum("discount_type", ["percent", "nominal"]),
    discountValue: int("discount_value"),
    usedCount: int("used_count").notNull().default(0),
    assignedUserId: int("assigned_user_id").references(() => users.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    expiresAt: timestamp("expires_at"),
    status: mysqlEnum("status", [
      "available",
      "assigned",
      "redeemed",
      "expired",
      "revoked",
    ])
      .notNull()
      .default("available"),
  },
  (table) => ({
    courseIdx: index("vouchers_course_idx").on(table.courseId),
  })
);

// Jejak audit penukaran: 1 baris per (voucher, akun, kursus) — basis anti-race K-03.
export const voucherRedemptions = mysqlTable(
  "voucher_redemptions",
  {
    id: int("id").autoincrement().primaryKey(),
    voucherCode: varchar("voucher_code", { length: 100 })
      .notNull()
      .references(() => vouchers.code, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    userId: int("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    courseId: int("course_id")
      .notNull()
      .references(() => courses.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    redeemedAt: timestamp("redeemed_at").defaultNow().notNull(),
  },
  (table) => ({
    voucherUserUniq: uniqueIndex("voucher_redemptions_voucher_user_uniq").on(
      table.voucherCode,
      table.userId
    ),
  })
);

// Pembayaran manual QRIS + verifikasi admin (tanpa gateway).
// Alur: peserta ajukan (bukti bayar) → admin setujui/tolak.
// Setuju (nominal >= tagihan) → enrollment source "payment:manual" + audit.
// Satu antrean "menunggu" per (peserta, kursus); bukti boleh diunggah ulang
// selama masih menunggu.
export const payments = mysqlTable(
  "payments",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    courseId: int("course_id")
      .notNull()
      .references(() => courses.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    invoice: varchar("invoice", { length: 50 }).notNull().unique(),
    method: mysqlEnum("method", ["qris"]).notNull().default("qris"),
    amountExpected: int("amount_expected").notNull(),
    amountPaid: int("amount_paid"),
    voucherCode: varchar("voucher_code", { length: 100 }).references(() => vouchers.code, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    discountAmount: int("discount_amount").notNull().default(0),
    // Snapshot slug promo yang menang (non-stack: promo vs voucher, terbesar menang).
    // Tanpa FK agar riwayat tidak ikut berubah bila slug kampanye diubah.
    promoSlug: varchar("promo_slug", { length: 100 }),
    // Tautan grup patungan bila pembayaran ini adalah iuran anggota patungan.
    // FK set-null: riwayat pembayaran tetap utuh bila grup dihapus.
    patunganGroupId: int("patungan_group_id").references(() => patunganGroups.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    proofFileId: int("proof_file_id").references(() => files.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    status: mysqlEnum("status", ["menunggu", "diverifikasi", "ditolak"])
      .notNull()
      .default("menunggu"),
    rejectReason: varchar("reject_reason", { length: 500 }),
    verifiedBy: int("verified_by").references(() => users.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    verifiedAt: timestamp("verified_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    paymentUserCourseIdx: index("payments_user_course_idx").on(
      table.userId,
      table.courseId,
      table.status
    ),
    paymentPatunganGroupIdx: index("payments_patungan_group_idx").on(
      table.patunganGroupId
    ),
  })
);

// Jejak audit tindakan administratif dan perubahan hak akses
// (pemberian/pencabutan akses manual, penerbitan/pencabutan sertifikat, dsb).
export const auditLogs = mysqlTable("audit_logs", {
  id: int("id").autoincrement().primaryKey(),
  actorUserId: int("actor_user_id").references(() => users.id, {
    onDelete: "set null",
    onUpdate: "cascade",
  }),
  action: varchar("action", { length: 100 }).notNull(),
  targetType: varchar("target_type", { length: 50 }).notNull(),
  targetIdInt: int("target_id_int"),
  targetIdStr: varchar("target_id_str", { length: 100 }),
  metadata: json("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Sertifikat per modul (K-05) + satu baris per (peserta, kursus) untuk
// sertifikat tingkat kursus (moduleId NULL; terbit bila semua modul tuntas).
// Kelayakan dievaluasi sekali saat penerbitan; snapshot persyaratan + nama
// penerima diarsipkan agar materi baru belakangan tidak menginvalidasi.
// Modul: UNIQUE(userId, moduleId) + transaksi = idempoten anti-ganda.
// Kursus: keunikan aplikasi (cek-dalam-transaksi + retry tabrakan kode).
export const certificates = mysqlTable(
  "certificates",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    courseId: int("course_id")
      .notNull()
      .references(() => courses.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    moduleId: int("module_id")
      .references(() => modules.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    // NULL = sertifikat level kursus (terbit bila semua modul tuntas,
    // Fase B). Keunikan sertifikat kursus (satu per peserta+kursus)
    // ditegakkan di lapisan aplikasi (cek-dulu-dalam-transaksi +
    // retry tabrakan kode) karena indeks unik tak mencakup NULL.
    // ID kredensial deterministik ala frontend lawas, mis. ATS-2026-C1-M1.
    // Dipertahankan nullable demi kompatibilitas seed lama; kode verifikasi
    // resmi adalah `code` (unik per sertifikat, tak tertebak).
    credentialId: varchar("credential_id", { length: 100 }).unique(),
    // Kode verifikasi unik buatan server, mis. ATS-2026-3F9AC2E1.
    code: varchar("code", { length: 32 }).notNull().unique(),
    // Snapshot nama penerima saat terbit; ganti nama profil tak mengubahnya.
    recipientName: varchar("recipient_name", { length: 100 }).notNull(),
    // Arsip persyaratan saat kelayakan diverifikasi (audit Tahap 3).
    // Sertifikat kursus (moduleId NULL): materials kosong + courseModules.
    requirementsSnapshot: json("requirements_snapshot").$type<{
      evaluatedAt: string;
      materials: Array<{
        materialId: number;
        title: string;
        type: string;
        state: string;
      }>;
      courseModules?: Array<{
        moduleId: number;
        title: string;
        certificateCode: string;
      }>;
    }>(),
    // issued = berlaku; revoked = dicabut pengelola; superseded = modul
    // yang digantikan sertifikat kursus (disembunyikan dari daftar).
    status: mysqlEnum("status", ["issued", "revoked", "superseded"])
      .notNull()
      .default("issued"),
    revokeReason: varchar("revoke_reason", { length: 500 }),
    revokedBy: int("revoked_by").references(() => users.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    revokedAt: timestamp("revoked_at"),
    issuedAt: timestamp("issued_at").defaultNow().notNull(),
  },
  (table) => ({
    userModuleUniq: uniqueIndex("certificates_user_module_uniq").on(
      table.userId,
      table.moduleId
    ),
    // Optimasi baca instruktur: filter courseId+status (riwayat/summary) dan moduleId.
    // Perlu `drizzle-kit generate` + migrasi agar aktif di DB (tanpa migrasi hanya dokumen).
    courseStatusIdx: index("certificates_course_status_idx").on(
      table.courseId,
      table.status
    ),
    moduleIdx: index("certificates_module_idx").on(table.moduleId),
    issuedIdx: index("certificates_issued_idx").on(table.issuedAt),
  })
);

// Registrasi tertunda alur OTP email (K-01: publik hanya student).
// Akun permanen di `users` baru dibuat saat kode diverifikasi
// (POST /auth/verify-email). Satu baris aktif per email.
export const emailVerificationPending = mysqlTable(
  "email_verification_pending",
  {
    email: varchar("email", { length: 191 }).primaryKey(),
    name: varchar("name", { length: 100 }).notNull(),
    // Username pilihan pendaftar; disalin ke `users` saat OTP terverifikasi.
    username: varchar("username", { length: 50 }),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    codeHash: varchar("code_hash", { length: 64 }).notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    attempts: int("attempts").notNull().default(0),
    lastSentAt: timestamp("last_sent_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  }
);

// Pengajuan minat menjadi instruktur (formulir publik /menjadi-instruktur).
// BUKAN akun (K-01): akun resmi tetap lahir dari undangan admin
// (POST /admin/invitations → /invitations/accept). Satu email satu pengajuan.
export const instructorApplications = mysqlTable(
  "instructor_applications",
  {
    id: int("id").autoincrement().primaryKey(),
    // Kode pelacakan pendaftar, mis. APL-7KQ2XA.
    code: varchar("code", { length: 12 }).notNull().unique(),
    name: varchar("name", { length: 100 }).notNull(),
    email: varchar("email", { length: 191 }).notNull().unique(),
    about: text("about"),
    skills: varchar("skills", { length: 255 }),
    youtubeTutorial: varchar("youtube_tutorial", { length: 500 }),
    youtubeChannel: varchar("youtube_channel", { length: 500 }),
    linkedin: varchar("linkedin", { length: 500 }),
    referralEmail: varchar("referral_email", { length: 191 }),
    photoFileId: int("photo_file_id").references(() => files.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    cvFileId: int("cv_file_id").references(() => files.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    cvName: varchar("cv_name", { length: 255 }),
    cvSize: int("cv_size").notNull().default(0),
    status: mysqlEnum("status", [
      "submitted",
      "under_review",
      "approved",
      "rejected",
    ])
      .notNull()
      .default("submitted"),
    reviewNote: text("review_note"),
    reviewedBy: int("reviewed_by").references(() => users.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    reviewedAt: timestamp("reviewed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    emailIdx: index("instructor_applications_email_idx").on(table.email),
    statusIdx: index("instructor_applications_status_idx").on(table.status),
  })
);

// OTP reset password. Respons lupa-password selalu generik agar tidak
// membocorkan daftar email terdaftar. Satu baris aktif per email.
export const passwordResetOtps = mysqlTable("password_reset_otps", {
  email: varchar("email", { length: 191 }).primaryKey(),
  codeHash: varchar("code_hash", { length: 64 }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  attempts: int("attempts").notNull().default(0),
  lastSentAt: timestamp("last_sent_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Promo kurasi admin (diskon persen / pajang / patungan).
// Diskon fase 1: percent-only 1–90 (ditegakkan di Zod, bukan DB).
// `status: pending` + `proposedBy` disiapkan untuk alur usulan instruktur
// (fase 2) tanpa mengubah kontrak publik.
export const promoCampaigns = mysqlTable(
  "promo_campaigns",
  {
    id: int("id").autoincrement().primaryKey(),
    slug: varchar("slug", { length: 100 }).notNull().unique(),
    title: varchar("title", { length: 200 }).notNull(),
    badgeLabel: varchar("badge_label", { length: 100 }),
    type: mysqlEnum("type", ["diskon", "kurasi", "patungan"]).notNull().default("diskon"),
    discountPercent: int("discount_percent"),
    status: mysqlEnum("status", ["draft", "active", "archived"]).notNull().default("draft"),
    startsAt: timestamp("starts_at"),
    endsAt: timestamp("ends_at"),
    proposedBy: int("proposed_by").references(() => users.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    createdBy: int("created_by").references(() => users.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    promoStatusIdx: index("promo_campaigns_status_idx").on(table.status),
  })
);

// Keanggotaan kursus per promo (kurasi per kursus, bukan global).
export const promoCourses = mysqlTable(
  "promo_courses",
  {
    campaignId: int("campaign_id")
      .notNull()
      .references(() => promoCampaigns.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    courseId: int("course_id")
      .notNull()
      .references(() => courses.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    position: int("position").notNull().default(0),
    customBadge: varchar("custom_badge", { length: 100 }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.campaignId, table.courseId] }),
    promoCourseIdx: index("promo_courses_course_idx").on(table.courseId),
  })
);

// Grup patungan: 1 grup = 1 kursus, anggota 2–15 (termasuk pembuat).
// Alur: pending (kumpul iuran sendiri-sendiri) → complete (semua approve
// → akses dibuka untuk semua sekaligus) / cancelled. Tidak ada akses
// parsial: tidak satu pun anggota mendapat akses sebelum grup complete.
export const patunganGroups = mysqlTable(
  "patungan_groups",
  {
    id: int("id").autoincrement().primaryKey(),
    // Kode grup untuk tampilan (mis. PTG-7KQ2XA), unik tak tertebak.
    code: varchar("code", { length: 20 }).notNull().unique(),
    courseId: int("course_id")
      .notNull()
      .references(() => courses.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    // Snapshot slug kampanye patungan yang dipakai saat grup dibuat.
    // Tanpa FK agar riwayat tidak ikut berubah bila slug kampanye diubah.
    promoSlug: varchar("promo_slug", { length: 100 }),
    memberCount: int("member_count").notNull(),
    // Snapshot nominal kursus saat grup dibuat (iuran dihitung dari ini).
    priceNominal: int("price_nominal").notNull(),
    status: mysqlEnum("status", ["pending", "complete", "cancelled"])
      .notNull()
      .default("pending"),
    createdBy: int("created_by").references(() => users.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    cancelledBy: int("cancelled_by").references(() => users.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    cancelReason: varchar("cancel_reason", { length: 500 }),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    patunganGroupCourseIdx: index("patungan_groups_course_idx").on(table.courseId),
    patunganGroupStatusIdx: index("patungan_groups_status_idx").on(table.status),
  })
);

// Anggota grup patungan. `position` 0 = pembuat grup.
// `paymentStatus`: unpaid → menunggu (bukti diunggah) → diverifikasi/ditolak.
// Grup complete hanya bila SEMUA anggota diverifikasi.
export const patunganGroupMembers = mysqlTable(
  "patungan_group_members",
  {
    groupId: int("group_id")
      .notNull()
      .references(() => patunganGroups.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    userId: int("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    position: int("position").notNull().default(0),
    // Iuran anggota ini (total habis dibagi; jumlah = priceNominal grup).
    shareAmount: int("share_amount").notNull(),
    paymentStatus: mysqlEnum("payment_status", [
      "unpaid",
      "menunggu",
      "diverifikasi",
      "ditolak",
    ])
      .notNull()
      .default("unpaid"),
    paymentId: int("payment_id").references(() => payments.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    paidAt: timestamp("paid_at"),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.groupId, table.userId] }),
    patunganMemberUserIdx: index("patungan_members_user_idx").on(table.userId),
  })
);
