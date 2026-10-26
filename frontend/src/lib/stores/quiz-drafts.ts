import type { QuizQuestion } from '$lib/data/material-details';

/** Draf kuis per materi (frontend-only, localStorage). */
export interface QuizDraft {
	title: string;
	intro: string;
	questions: QuizQuestion[];
	/** Nilai minimum 0–100 untuk dinyatakan lulus. Default 70. */
	passScore: number;
	updatedAt: string;
}

export const DEFAULT_PASS_SCORE = 70;

export function normalizePassScore(value: unknown): number {
	if (value === '' || value === null || value === undefined) return DEFAULT_PASS_SCORE;
	const n = typeof value === 'string' ? Number(value) : (value as number);
	if (!Number.isFinite(n)) return DEFAULT_PASS_SCORE;
	return Math.min(100, Math.max(0, Math.round(n)));
}

function quizKey(courseId: number, moduleId: string, subId: string, materialId: string): string {
	return `materi-kuis-${courseId}-${moduleId}-${subId}-${materialId}`;
}

function storageAvailable(): boolean {
	return typeof localStorage !== 'undefined';
}

export function blankQuizQuestion(): QuizQuestion {
	return { question: '', options: ['', '', '', ''], answer: 0, explanation: '' };
}

export function blankQuizDraft(title = ''): QuizDraft {
	return { title, intro: '', questions: [blankQuizQuestion()], passScore: DEFAULT_PASS_SCORE, updatedAt: '' };
}

/** Muat draf kuis. Null bila belum ada / SSR / rusak. */
export function loadQuizDraft(
	courseId: number,
	moduleId: string,
	subId: string,
	materialId: string
): QuizDraft | null {
	if (!storageAvailable()) return null;
	try {
		const raw = localStorage.getItem(quizKey(courseId, moduleId, subId, materialId));
		if (!raw) return null;
		const parsed = JSON.parse(raw) as QuizDraft;
		if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.questions)) return null;
		const questions = parsed.questions
			.filter((q) => q && typeof q === 'object')
			.map((q) => ({
				question: String(q.question ?? ''),
				options: Array.from({ length: 4 }, (_, i) => String(q.options?.[i] ?? '')),
				answer: Number.isInteger(q.answer) && q.answer >= 0 && q.answer < 4 ? q.answer : 0,
				explanation: String(q.explanation ?? '')
			}));
		return {
			title: String(parsed.title ?? ''),
			intro: String(parsed.intro ?? ''),
			questions,
			passScore: normalizePassScore(
				(parsed as { passScore?: unknown }).passScore ?? DEFAULT_PASS_SCORE
			),
			updatedAt: String(parsed.updatedAt ?? '')
		};
	} catch {
		return null;
	}
}

/** Simpan draf kuis. False bila storage penuh / tidak tersedia. */
export function saveQuizDraft(
	courseId: number,
	moduleId: string,
	subId: string,
	materialId: string,
	draft: QuizDraft
): boolean {
	if (!storageAvailable()) return false;
	try {
		localStorage.setItem(quizKey(courseId, moduleId, subId, materialId), JSON.stringify(draft));
		return true;
	} catch {
		return false;
	}
}

/** Validasi draf kuis untuk tombol simpan. */
export function validateQuizDraft(draft: QuizDraft): string | null {
	const raw = (draft as { passScore?: unknown }).passScore;
	if (raw === undefined || raw === null || raw === '') {
		// Kompatibilitas mundur: draf lama tanpa passScore dianggap 70.
		draft.passScore = DEFAULT_PASS_SCORE;
	} else {
		const num = Number(raw);
		if (!Number.isFinite(num) || num < 0 || num > 100)
			return 'Nilai minimum kelulusan harus 0–100.';
		draft.passScore = Math.round(num);
	}
	if (draft.questions.length === 0) return 'Tambahkan minimal 1 soal.';
	for (let i = 0; i < draft.questions.length; i++) {
		const q = draft.questions[i];
		if (!q.question.trim()) return `Soal ${i + 1} belum ada pertanyaan.`;
		for (let o = 0; o < 4; o++) {
			if (!q.options[o]?.trim()) return `Soal ${i + 1} opsi ${String.fromCharCode(65 + o)} masih kosong.`;
		}
		if (q.answer < 0 || q.answer > 3) return `Soal ${i + 1} belum ada kunci jawaban.`;
	}
	return null;
}

/**
 * Cari nilai minimum kelulusan untuk satu materialId tanpa tahu
 * courseId/moduleId/subId (dipakai sisi peserta pada browser yang sama).
 * Scan key `materi-kuis-*` yang berakhiran `-${materialId}`.
 */
export function findQuizPassScoreByMaterial(materialId: string): number | null {
	if (!storageAvailable() || !materialId) return null;
	try {
		for (let i = 0; i < localStorage.length; i++) {
			const key = localStorage.key(i);
			if (!key?.startsWith('materi-kuis-') || !key.endsWith(`-${materialId}`)) continue;
			const raw = localStorage.getItem(key);
			if (!raw) continue;
			const parsed = JSON.parse(raw) as Partial<QuizDraft>;
			if (parsed && typeof parsed.passScore !== 'undefined') {
				return normalizePassScore(parsed.passScore);
			}
		}
	} catch {
		return null;
	}
	return null;
}
