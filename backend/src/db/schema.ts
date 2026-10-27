import {
  mysqlTable,
  varchar,
  int,
  boolean,
  timestamp,
  mysqlEnum,
  text,
  mediumtext,
  json,
  index,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/mysql-core";

// Konvensi ID: integer auto-increment di semua tabel entitas,
// selaras dengan frontend (mis. Course.id: number).
// Satu-satunya PK non-numerik adalah kode voucher (string final).

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  email: varchar("email", { length: 191 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  role: mysqlEnum("role", ["student", "teacher", "admin"])
    .notNull()
    .default("student"),
  // Penonaktifan oleh admin; ditegakkan saat login (jendela token ≤15 mnt).
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

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
});

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
});

// Metadata berkas yang disimpan di disk server (Opsi A).
// Byte berkas TIDAK di database — kolom ini hanya penunjuk + metadata.
export const files = mysqlTable("files", {
  id: int("id").autoincrement().primaryKey(),
  ownerUserId: int("owner_user_id")
    .notNull()
    .references(() => users.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
  kind: mysqlEnum("kind", ["image", "audio", "pdf", "cover", "assignment"])
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
    kind: mysqlEnum("kind", ["personal", "umum"]).notNull().default("umum"),
    maxUses: int("max_uses").notNull().default(1),
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

// Sertifikat per modul (K-05). Sertifikat tingkat kursus adalah turunan
// (terbit bila semua modul tuntas) sehingga tidak disimpan sebagai baris.
// Kelayakan dievaluasi sekali saat penerbitan; snapshot persyaratan + nama
// penerima diarsipkan agar materi baru belakangan tidak menginvalidasi.
// Satu baris per (peserta, modul): UNIQUE(userId, moduleId) + transaksi
// membuat penerbitan idempoten dan anti-ganda saat request bersamaan.
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
      .notNull()
      .references(() => modules.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    // ID kredensial deterministik ala frontend lawas, mis. ATS-2026-C1-M1.
    // Dipertahankan nullable demi kompatibilitas seed lama; kode verifikasi
    // resmi adalah `code` (unik per sertifikat, tak tertebak).
    credentialId: varchar("credential_id", { length: 100 }).unique(),
    // Kode verifikasi unik buatan server, mis. ATS-2026-3F9AC2E1.
    code: varchar("code", { length: 32 }).notNull().unique(),
    // Snapshot nama penerima saat terbit; ganti nama profil tak mengubahnya.
    recipientName: varchar("recipient_name", { length: 100 }).notNull(),
    // Arsip persyaratan saat kelayakan diverifikasi (audit Tahap 3).
    requirementsSnapshot: json("requirements_snapshot").$type<{
      evaluatedAt: string;
      materials: Array<{
        materialId: number;
        title: string;
        type: string;
        state: string;
      }>;
    }>(),
    status: mysqlEnum("status", ["issued", "revoked"])
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
  })
);
