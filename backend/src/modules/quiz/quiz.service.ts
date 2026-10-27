import { z } from "zod";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "../../db";
import {
  materials,
  quizAttempts,
  quizOptions,
  quizQuestions,
  type QuizAttemptAnswer,
  type QuizSnapshot,
} from "../../db/schema";
import { getMaterial } from "../courses/curricula.service";

/** Galat validasi bisnis kuis — controller memetakan menjadi 400. */
export class QuizInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuizInputError";
  }
}

// ---------- Skema input ----------

const quizOptionInputSchema = z.object({
  optionText: z.string().trim().min(1).max(2000),
  isCorrect: z.boolean(),
  position: z.number().int().min(0).max(10000).optional(),
});

const quizQuestionInputSchema = z.object({
  questionText: z.string().trim().min(1).max(5000),
  explanation: z.string().trim().max(5000).nullable().optional(),
  position: z.number().int().min(0).max(10000).optional(),
  options: z.array(quizOptionInputSchema).min(2).max(10),
}).refine((q) => q.options.filter((o) => o.isCorrect).length === 1, {
  message: "Setiap soal harus memiliki tepat satu jawaban benar",
});

export const quizSetInputSchema = z.object({
  questions: z.array(quizQuestionInputSchema).min(1).max(200),
});

const attemptAnswerSchema = z
  .object({
    questionId: z.number().int().min(1),
    optionId: z.number().int().min(1).nullable(),
  })
  .strict();

// Strict: field skor/kelulusan buatan klien langsung ditolak (400),
// selaras prinsip "skor klien tidak dipercaya".
export const quizAttemptInputSchema = z
  .object({
    answers: z.array(attemptAnswerSchema).max(500),
  })
  .strict()
  .refine(
    (v) =>
      new Set(v.answers.map((a) => a.questionId)).size === v.answers.length,
    { message: "Jawaban duplikat untuk soal yang sama" }
  );

export type QuizSetInput = z.infer<typeof quizSetInputSchema>;
export type QuizAttemptInput = z.infer<typeof quizAttemptInputSchema>;

// ---------- Bentuk baca ----------

/** Soal untuk peserta: TANPA kunci dan TANPA pembahasan (anti-bocor). */
export interface TakingOption {
  id: number;
  position: number;
  optionText: string;
}

export interface TakingQuestion {
  id: number;
  position: number;
  questionText: string;
  options: TakingOption[];
}

/** Upaya yang aman dikembalikan ke klien: tanpa snapshot/kunci/jawaban mentah. */
export interface PublicAttempt {
  id: number;
  materialId: number;
  score: number;
  total: number | null;
  correct: number | null;
  passScore: number;
  passed: boolean;
  attemptedAt: Date;
}

const toPublicAttempt = (row: {
  id: number;
  materialId: number;
  score: number;
  total: number | null;
  correct: number | null;
  passScore: number;
  attemptedAt: Date;
}): PublicAttempt => ({
  id: row.id,
  materialId: row.materialId,
  score: row.score,
  total: row.total,
  correct: row.correct,
  passScore: row.passScore,
  passed: row.score >= row.passScore,
  attemptedAt: row.attemptedAt,
});

// ---------- Akses data internal ----------

interface OptionRow {
  id: number;
  position: number;
  optionText: string;
  isCorrect: boolean;
}

interface QuestionRow {
  id: number;
  position: number;
  questionText: string;
  explanation: string | null;
  options: OptionRow[];
}

const listQuestionsInternal = async (materialId: number): Promise<QuestionRow[]> => {
  const qs = await db
    .select()
    .from(quizQuestions)
    .where(eq(quizQuestions.materialId, materialId))
    .orderBy(asc(quizQuestions.position), asc(quizQuestions.id));
  if (qs.length === 0) return [];
  const opts = await db
    .select()
    .from(quizOptions)
    .where(
      inArray(
        quizOptions.questionId,
        qs.map((q) => q.id)
      )
    )
    .orderBy(asc(quizOptions.position), asc(quizOptions.id));
  const byQ = new Map<number, OptionRow[]>();
  for (const o of opts) {
    const list = byQ.get(o.questionId) ?? [];
    list.push({
      id: o.id,
      position: o.position,
      optionText: o.optionText,
      isCorrect: o.isCorrect,
    });
    byQ.set(o.questionId, list);
  }
  return qs.map((q) => ({
    id: q.id,
    position: q.position,
    questionText: q.questionText,
    explanation: q.explanation,
    options: byQ.get(q.id) ?? [],
  }));
};

const requireQuizMaterial = async (materialId: number) => {
  const mat = await getMaterial(materialId);
  if (!mat) {
    throw new QuizInputError("__NOT_FOUND__");
  }
  if (mat.type !== "kuis") {
    throw new QuizInputError("Materi bukan kuis");
  }
  return mat;
};

// ---------- API service ----------

/** Soal untuk peserta (tanpa kunci/pembahasan), terurut. */
export const getQuizForTaking = async (
  materialId: number
): Promise<TakingQuestion[]> => {
  await requireQuizMaterial(materialId);
  const rows = await listQuestionsInternal(materialId);
  return rows.map((q) => ({
    id: q.id,
    position: q.position,
    questionText: q.questionText,
    options: q.options.map((o) => ({
      id: o.id,
      position: o.position,
      optionText: o.optionText,
    })),
  }));
};

/** Ganti seluruh set soal+opsi secara atomik (wegenumerasi ulang posisi). */
export const replaceQuiz = async (materialId: number, input: QuizSetInput) => {
  await requireQuizMaterial(materialId);
  return db.transaction(async (tx) => {
    const existing = await tx
      .select({ id: quizQuestions.id })
      .from(quizQuestions)
      .where(eq(quizQuestions.materialId, materialId));
    if (existing.length > 0) {
      await tx.delete(quizOptions).where(
        inArray(
          quizOptions.questionId,
          existing.map((q) => q.id)
        )
      );
      await tx.delete(quizQuestions).where(eq(quizQuestions.materialId, materialId));
    }
    const created = [];
    for (const [qi, q] of input.questions.entries()) {
      const [qh] = await tx.insert(quizQuestions).values({
        materialId,
        position: q.position ?? qi,
        questionText: q.questionText,
        explanation: q.explanation ?? null,
      });
      const qid = Number((qh as unknown as { insertId: number }).insertId);
      const opts = [];
      for (const [oi, o] of q.options.entries()) {
        const [oh] = await tx.insert(quizOptions).values({
          questionId: qid,
          position: o.position ?? oi,
          optionText: o.optionText,
          isCorrect: o.isCorrect,
        });
        const oid = Number((oh as unknown as { insertId: number }).insertId);
        opts.push({
          id: oid,
          position: o.position ?? oi,
          optionText: o.optionText,
          isCorrect: o.isCorrect,
        });
      }
      created.push({
        id: qid,
        position: q.position ?? qi,
        questionText: q.questionText,
        explanation: q.explanation ?? null,
        options: opts,
      });
    }
    return created;
  });
};

export interface GradedAttempt {
  attempt: PublicAttempt;
  bestScore: number;
  attempts: number;
  overallPassed: boolean;
}

/** Nilai jawaban di server (bobot sama, kosong = salah), simpan + snapshot audit. */
export const gradeAttempt = async (
  userId: number,
  materialId: number,
  input: QuizAttemptInput
): Promise<GradedAttempt> => {
  const mat = await requireQuizMaterial(materialId);
  const questions = await listQuestionsInternal(materialId);
  if (questions.length === 0) {
    throw new QuizInputError("Kuis belum memiliki soal");
  }
  const byId = new Map(questions.map((q) => [q.id, q]));
  for (const a of input.answers) {
    const q = byId.get(a.questionId);
    if (!q) {
      throw new QuizInputError("Soal tidak dikenal dalam kuis ini");
    }
    if (a.optionId !== null && !q.options.some((o) => o.id === a.optionId)) {
      throw new QuizInputError("Opsi tidak valid untuk soal tersebut");
    }
  }
  const chosen = new Map(input.answers.map((a) => [a.questionId, a.optionId]));
  let correct = 0;
  for (const q of questions) {
    const right = q.options.find((o) => o.isCorrect);
    const pick = chosen.get(q.id) ?? null;
    if (right && pick !== null && pick === right.id) correct++;
  }
  const total = questions.length;
  const score = Math.round((correct / total) * 100);
  const passScore = mat.passScore ?? 70;
  const attemptAnswers: QuizAttemptAnswer[] = questions.map((q) => ({
    questionId: q.id,
    optionId: chosen.get(q.id) ?? null,
  }));
  const snapshot: QuizSnapshot = {
    questions: questions.map((q) => ({
      id: q.id,
      position: q.position,
      questionText: q.questionText,
      explanation: q.explanation,
      options: q.options.map((o) => ({
        id: o.id,
        position: o.position,
        optionText: o.optionText,
        isCorrect: o.isCorrect,
      })),
    })),
  };
  const inserted = await db.transaction(async (tx) => {
    const [h] = await tx.insert(quizAttempts).values({
      userId,
      materialId,
      score,
      total,
      correct,
      passScore,
      answers: attemptAnswers,
      snapshot,
    });
    const id = Number((h as unknown as { insertId: number }).insertId);
    const rows = await tx
      .select()
      .from(quizAttempts)
      .where(eq(quizAttempts.id, id))
      .limit(1);
    return rows[0];
  });
  if (!inserted) throw new Error("Gagal menyimpan percobaan kuis");
  const all = await db
    .select({ score: quizAttempts.score, passScore: quizAttempts.passScore })
    .from(quizAttempts)
    .where(
      and(eq(quizAttempts.userId, userId), eq(quizAttempts.materialId, materialId))
    );
  // Lulus menempel: OR atas (skor >= ambang snapshot tiap percobaan).
  return {
    attempt: toPublicAttempt(inserted),
    bestScore: Math.max(...all.map((a) => a.score)),
    attempts: all.length,
    overallPassed: all.some((a) => a.score >= a.passScore),
  };
};

/** Riwayat milik pengguna, terbaru dulu (tanpa kunci/snapshot). */
export const getHistory = async (
  userId: number,
  materialId: number
): Promise<PublicAttempt[]> => {
  await requireQuizMaterial(materialId);
  const rows = await db
    .select()
    .from(quizAttempts)
    .where(
      and(eq(quizAttempts.userId, userId), eq(quizAttempts.materialId, materialId))
    )
    .orderBy(desc(quizAttempts.attemptedAt), desc(quizAttempts.id));
  return rows.map(toPublicAttempt);
};

export interface BestResult {
  materialId: number;
  attempts: number;
  bestScore: number | null;
  effectivePassScore: number;
  passed: boolean;
}

/** Nilai terbaik + status lulus persisten (tahan ambang berubah). */
export const getBest = async (
  userId: number,
  materialId: number
): Promise<BestResult> => {
  const mat = await requireQuizMaterial(materialId);
  const rows = await db
    .select({ score: quizAttempts.score, passScore: quizAttempts.passScore })
    .from(quizAttempts)
    .where(
      and(eq(quizAttempts.userId, userId), eq(quizAttempts.materialId, materialId))
    );
  if (rows.length === 0) {
    return {
      materialId,
      attempts: 0,
      bestScore: null,
      effectivePassScore: mat.passScore ?? 70,
      passed: false,
    };
  }
  return {
    materialId,
    attempts: rows.length,
    bestScore: Math.max(...rows.map((r) => r.score)),
    effectivePassScore: mat.passScore ?? 70,
    passed: rows.some((r) => r.score >= r.passScore),
  };
};
