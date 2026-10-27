import { apiRequest } from './backend';
import { getAccessToken, handlePrivateRequestError } from '$lib/stores/auth.svelte';

/** Soal untuk peserta (TANPA kunci jawaban dan pembahasan). */
export interface ServerQuizOption {
	id: number;
	position: number;
	optionText: string;
}

export interface ServerQuizQuestion {
	id: number;
	position: number;
	questionText: string;
	options: ServerQuizOption[];
}

/** Soal lengkap dengan kunci (hanya untuk instruktur pengelola). */
export interface ServerQuizOptionKeyed extends ServerQuizOption {
	isCorrect: boolean;
}

export interface ServerQuizQuestionKeyed {
	id: number;
	position: number;
	questionText: string;
	explanation: string | null;
	options: ServerQuizOptionKeyed[];
}

export interface QuizAttemptAnswer {
	questionId: number;
	optionId: number | null;
}

export interface QuizAttemptResult {
	attemptId: number;
	materialId: number;
	score: number;
	total: number | null;
	correct: number | null;
	passScore: number;
	passed: boolean;
	bestScore: number;
	attempts: number;
	overallPassed: boolean;
}

export interface QuizAttemptRow {
	id: number;
	materialId: number;
	score: number;
	total: number | null;
	correct: number | null;
	passScore: number;
	passed: boolean;
	attemptedAt: string;
}

export interface QuizBest {
	materialId: number;
	attempts: number;
	bestScore: number | null;
	effectivePassScore: number;
	passed: boolean;
}

export interface QuizSetInput {
	questions: Array<{
		questionText: string;
		explanation?: string | null;
		position?: number;
		options: Array<{ optionText: string; isCorrect: boolean; position?: number }>;
	}>;
}

function req<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
	return apiRequest<T>(path, { ...options, token: getAccessToken() }).catch(async (e: unknown) => {
		await handlePrivateRequestError(e);
		throw e;
	});
}

/** Ambil soal kuis untuk peserta (tanpa kunci). */
export async function fetchQuizQuestions(
	materialId: number
): Promise<{ materialId: number; questions: ServerQuizQuestion[] }> {
	return req(`/materials/${materialId}/quiz`);
}

/** Ganti seluruh set soal (instruktur pengelola; respons memuat kunci). */
export async function saveQuizSet(
	materialId: number,
	input: QuizSetInput
): Promise<{ materialId: number; questions: ServerQuizQuestionKeyed[] }> {
	return req(`/materials/${materialId}/quiz`, { method: 'PUT', body: input });
}

/** Kirim jawaban; penilaian dilakukan server. Skor klien tidak dikirim. */
export async function submitQuizAttempt(
	materialId: number,
	answers: QuizAttemptAnswer[]
): Promise<QuizAttemptResult> {
	return req(`/materials/${materialId}/quiz-attempts`, {
		method: 'POST',
		body: { answers }
	});
}

/** Riwayat percobaan milik sendiri (tanpa kunci/snapshot). */
export async function fetchQuizHistory(materialId: number): Promise<QuizAttemptRow[]> {
	return req(`/materials/${materialId}/quiz-attempts`);
}

/** Nilai terbaik + status lulus persisten milik sendiri. */
export async function fetchQuizBest(materialId: number): Promise<QuizBest> {
	return req(`/materials/${materialId}/quiz-best`);
}
