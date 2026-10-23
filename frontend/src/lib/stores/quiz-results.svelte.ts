import { SvelteMap } from 'svelte/reactivity';

/** Hasil kuis per materi — hanya nilai, tanpa info soal mana yang benar/salah. */
export interface QuizResult {
	materialId: string;
	courseId: string;
	moduleId: string;
	materialTitle: string;
	total: number;
	correct: number;
	score: number;
	passed: boolean;
	createdAt: string;
}

const KEY = 'aristoteles:quiz-results:v1';

/** Hasil terakhir per materialId. Persisten localStorage agar refresh halaman hasil tetap tampil. */
export const quizResults = new SvelteMap<string, QuizResult>();

function load(): void {
	try {
		if (typeof localStorage === 'undefined') return;
		const raw = localStorage.getItem(KEY);
		if (!raw) return;
		const parsed = JSON.parse(raw) as Record<string, QuizResult>;
		for (const [k, v] of Object.entries(parsed)) quizResults.set(k, v);
	} catch {
		/* abaikan cache korup */
	}
}

function persist(): void {
	try {
		if (typeof localStorage === 'undefined') return;
		localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(quizResults)));
	} catch {
		/* kuota penuh — abaikan */
	}
}

if (typeof window !== 'undefined') load();

export function saveQuizResult(r: QuizResult): void {
	quizResults.set(r.materialId, r);
	persist();
}

export function getQuizResult(materialId: string): QuizResult | undefined {
	return quizResults.get(materialId);
}
