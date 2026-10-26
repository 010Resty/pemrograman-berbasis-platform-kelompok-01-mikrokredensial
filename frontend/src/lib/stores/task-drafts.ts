import type { JSONContent } from '@tiptap/core';
import { countDocWords } from './material-docs';

/** Draf penugasan per materi (frontend-only, localStorage). */
export interface TaskDraft {
	title: string;
	/** 1. Deskripsi penugasan: dokumen kaya (teks + gambar/video/audio/PDF). */
	brief: JSONContent | null;
	/** 2. Tujuan penugasan: daftar kompetensi yang ingin dicapai. */
	objectives: string[];
	/** 3. Langkah pengerjaan: instruksi berurutan (boleh kurang/lebih dari 4). */
	steps: string[];
	updatedAt: string;
}

function taskKey(courseId: number, moduleId: string, subId: string, materialId: string): string {
	return `materi-tugas-${courseId}-${moduleId}-${subId}-${materialId}`;
}

function storageAvailable(): boolean {
	return typeof localStorage !== 'undefined';
}

function cleanList(raw: unknown): string[] {
	if (!Array.isArray(raw)) return [''];
	const list = raw.filter((x) => typeof x === 'string').map((x) => String(x));
	return list.length > 0 ? list : [''];
}

/** Normalisasi isi deskripsi: draf lama berupa teks polos dibungkus jadi dokumen. */
function cleanBrief(raw: unknown): JSONContent | null {
	if (!raw) return null;
	if (typeof raw === 'string') {
		const text = raw.trim();
		if (!text) return null;
		return { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] };
	}
	if (typeof raw === 'object' && (raw as JSONContent).type) return raw as JSONContent;
	return null;
}

export function blankTaskDraft(title = ''): TaskDraft {
	return { title, brief: null, objectives: [''], steps: ['', '', '', ''], updatedAt: '' };
}

/** Muat draf tugas. Null bila belum ada / SSR / rusak. */
export function loadTaskDraft(
	courseId: number,
	moduleId: string,
	subId: string,
	materialId: string
): TaskDraft | null {
	if (!storageAvailable()) return null;
	try {
		const raw = localStorage.getItem(taskKey(courseId, moduleId, subId, materialId));
		if (!raw) return null;
		const parsed = JSON.parse(raw) as TaskDraft;
		if (!parsed || typeof parsed !== 'object') return null;
		return {
			title: String(parsed.title ?? ''),
			brief: cleanBrief(parsed.brief),
			objectives: cleanList(parsed.objectives),
			steps: cleanList(parsed.steps),
			updatedAt: String(parsed.updatedAt ?? '')
		};
	} catch {
		return null;
	}
}

/** Simpan draf tugas. False bila storage penuh / tidak tersedia. */
export function saveTaskDraft(
	courseId: number,
	moduleId: string,
	subId: string,
	materialId: string,
	draft: TaskDraft
): boolean {
	if (!storageAvailable()) return false;
	try {
		localStorage.setItem(taskKey(courseId, moduleId, subId, materialId), JSON.stringify(draft));
		return true;
	} catch {
		return false;
	}
}

/** Validasi draf tugas untuk tombol simpan. */
export function validateTaskDraft(draft: TaskDraft): string | null {
	if (countDocWords(draft.brief) === 0) return 'Isi deskripsi penugasan terlebih dahulu.';
	if (!draft.objectives.some((o) => o.trim())) return 'Isi minimal 1 tujuan penugasan.';
	if (!draft.steps.some((s) => s.trim())) return 'Isi minimal 1 langkah pengerjaan.';
	return null;
}

/** Jumlah poin terisi (tujuan + langkah) untuk badge status. */
export function countTaskPoints(draft: TaskDraft): number {
	return (
		draft.objectives.filter((o) => o.trim()).length + draft.steps.filter((s) => s.trim()).length
	);
}
