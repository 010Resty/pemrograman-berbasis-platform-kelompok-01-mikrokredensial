import type { JSONContent } from '@tiptap/core';

/** Satu dokumen materi: konten Tiptap JSON + metadata. Frontend-only (localStorage). */
export interface MaterialDoc {
	title: string;
	content: JSONContent | null;
	updatedAt: string;
}

function docKey(courseId: number, moduleId: string, subId: string, materialId: string): string {
	return `materi-dokumen-${courseId}-${moduleId}-${subId}-${materialId}`;
}

function storageAvailable(): boolean {
	return typeof localStorage !== 'undefined';
}

/** Muat dokumen materi (deep copy). Mengembalikan null bila belum ada / SSR. */
export function loadMaterialDoc(
	courseId: number,
	moduleId: string,
	subId: string,
	materialId: string
): MaterialDoc | null {
	if (!storageAvailable()) return null;
	try {
		const raw = localStorage.getItem(docKey(courseId, moduleId, subId, materialId));
		if (!raw) return null;
		const parsed = JSON.parse(raw) as MaterialDoc;
		if (!parsed || typeof parsed !== 'object') return null;
		return parsed;
	} catch {
		return null;
	}
}

/**
 * Simpan dokumen materi. Mengembalikan false bila penyimpanan penuh
 * (mis. lampiran besar melebihi kuota localStorage).
 */
export function saveMaterialDoc(
	courseId: number,
	moduleId: string,
	subId: string,
	materialId: string,
	doc: MaterialDoc
): boolean {
	if (!storageAvailable()) return false;
	try {
		localStorage.setItem(docKey(courseId, moduleId, subId, materialId), JSON.stringify(doc));
		return true;
	} catch {
		return false;
	}
}

/** Hitung kata dalam dokumen Tiptap (untuk badge status & statistik). */
export function countDocWords(content: JSONContent | null | undefined): number {
	if (!content) return 0;
	let text = '';
	const walk = (node: JSONContent): void => {
		if (typeof node.text === 'string') text += ` ${node.text}`;
		if (Array.isArray(node.content)) {
			for (const child of node.content) walk(child as JSONContent);
		}
	};
	walk(content);
	const words = text.trim().split(/\s+/).filter(Boolean);
	return text.trim() ? words.length : 0;
}

/** Ringkasan status draf satu materi (ada/tidak, jumlah kata, waktu simpan). */
export function getMaterialDocMeta(
	courseId: number,
	moduleId: string,
	subId: string,
	materialId: string
): { exists: boolean; words: number; updatedAt: string } {
	const doc = loadMaterialDoc(courseId, moduleId, subId, materialId);
	if (!doc?.content) return { exists: false, words: 0, updatedAt: '' };
	return { exists: true, words: countDocWords(doc.content), updatedAt: doc.updatedAt };
}
/** Format ukuran berkas untuk label lampiran. */
export function formatFileSize(bytes: number): string {
	if (!Number.isFinite(bytes) || bytes < 0) return '';
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Baca berkas sebagai dataURL (untuk gambar & PDF, frontend-only). */
export function readFileAsDataUrl(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(String(reader.result ?? ''));
		reader.onerror = () => reject(new Error('Gagal membaca berkas.'));
		reader.readAsDataURL(file);
	});
}
