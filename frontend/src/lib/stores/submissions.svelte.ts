import { SvelteMap } from 'svelte/reactivity';
import type { AssignmentSubmission } from '$lib/types/submission';

const KEY = 'aristoteles:submissions:v1';

/** Riwayat submission per materialId. Persisten localStorage + reaktif Svelte 5. */
export const submissionsByMaterial = new SvelteMap<string, AssignmentSubmission[]>();

function load(): void {
	try {
		if (typeof localStorage === 'undefined') return;
		const raw = localStorage.getItem(KEY);
		if (!raw) return;
		const parsed = JSON.parse(raw) as Record<string, AssignmentSubmission[]>;
		for (const [k, v] of Object.entries(parsed)) submissionsByMaterial.set(k, v);
	} catch {
		/* abaikan cache korup */
	}
}

function persist(): void {
	try {
		if (typeof localStorage === 'undefined') return;
		localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(submissionsByMaterial)));
	} catch {
		/* kuota penuh — abaikan */
	}
}

if (typeof window !== 'undefined') load();

export function latestFor(materialId: string): AssignmentSubmission | undefined {
	return submissionsByMaterial.get(materialId)?.[0];
}

export function pushSubmission(s: AssignmentSubmission): void {
	const list = submissionsByMaterial.get(s.materialId) ?? [];
	submissionsByMaterial.set(s.materialId, [s, ...list].slice(0, 20));
	persist();
}

export function setHistory(materialId: string, list: AssignmentSubmission[]): void {
	submissionsByMaterial.set(materialId, list.slice(0, 20));
	persist();
}
