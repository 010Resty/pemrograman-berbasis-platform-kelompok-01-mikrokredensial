import {
  mysqlTable,
  varchar,
  int,
  timestamp,
  mysqlEnum,
  index,
  primaryKey,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: varchar("id", { length: 36 }).primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  email: varchar("email", { length: 191 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  role: mysqlEnum("role", ["student", "teacher", "admin"])
    .notNull()
    .default("student"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});


export const instructorInvitations = mysqlTable(
  "instructor_invitations",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    email: varchar("email", { length: 191 }).notNull(),
    tokenHash: varchar("token_hash", { length: 255 }).notNull().unique(),
    status: mysqlEnum("status", [
      "pending",
      "accepted",
      "revoked",
      "expired",
    ])
      .notNull()
      .default("pending"),
    invitedBy: varchar("invited_by", { length: 36 }).references(
      () => users.id,
      { onDelete: "restrict", onUpdate: "cascade" }
    ),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
  emailIdx: index("instructor_invitations_email_idx").on(table.email),
})
);

export const courses = mysqlTable("courses", {
  id: varchar("id", { length: 36 }).primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  priceLabel: varchar("price_label", { length: 100 }).notNull(),
  period: varchar("period", { length: 100 }).notNull(),
});

export const modules = mysqlTable("modules", {
  id: varchar("id", { length: 36 }).primaryKey(),
  courseId: varchar("course_id", { length: 36 })
    .notNull()
    .references(() => courses.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
  title: varchar("title", { length: 255 }).notNull(),
  type: mysqlEnum("type", ["materi", "tugas", "kuis"]).notNull(),
  position: int("position").notNull(),
});

export const materials = mysqlTable("materials", {
  id: varchar("id", { length: 36 }).primaryKey(),
  moduleId: varchar("module_id", { length: 36 })
    .notNull()
    .references(() => modules.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
  title: varchar("title", { length: 255 }).notNull(),
  content: varchar("content", { length: 5000 }),
  position: int("position").notNull(),
});

export const enrollments = mysqlTable(
  "enrollments",
  {
    userId: varchar("user_id", { length: 36 })
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    courseId: varchar("course_id", { length: 36 })
      .notNull()
      .references(() => courses.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    source: varchar("source", { length: 50 }).notNull(),
    enrolledAt: timestamp("enrolled_at").defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({
      columns: [table.userId, table.courseId],
    }),
  })
);

export const quizAttempts = mysqlTable("quiz_attempts", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 36 })
    .notNull()
    .references(() => users.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
  materialId: varchar("material_id", { length: 36 })
    .notNull()
    .references(() => materials.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
  score: int("score").notNull(),
  attemptedAt: timestamp("attempted_at").defaultNow().notNull(),
});

export const submissions = mysqlTable("submissions", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 36 })
    .notNull()
    .references(() => users.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
  materialId: varchar("material_id", { length: 36 })
    .notNull()
    .references(() => materials.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
  filePath: varchar("file_path", { length: 500 }).notNull(),
  status: mysqlEnum("status", [
    "submitted",
    "reviewed",
    "revision_requested",
  ])
    .notNull()
    .default("submitted"),
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
});

export const progress = mysqlTable(
  "progress",
  {
    userId: varchar("user_id", { length: 36 })
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    materialId: varchar("material_id", { length: 36 })
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

export const vouchers = mysqlTable("vouchers", {
  code: varchar("code", { length: 100 }).primaryKey(),
  assignedUserId: varchar("assigned_user_id", { length: 36 }).references(
    () => users.id,
    {
      onDelete: "restrict",
      onUpdate: "cascade",
    }
  ),
  status: mysqlEnum("status", [
    "available",
    "assigned",
    "redeemed",
    "expired",
  ])
    .notNull()
    .default("available"),
});

export const certificates = mysqlTable("certificates", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 36 })
    .notNull()
    .references(() => users.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
  moduleId: varchar("module_id", { length: 36 })
    .notNull()
    .references(() => modules.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
  issuedAt: timestamp("issued_at").defaultNow().notNull(),
});
