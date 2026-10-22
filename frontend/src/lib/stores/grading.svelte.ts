import { SvelteMap } from 'svelte/reactivity';
import type { ApiResult, AssignmentSubmission } from '$lib/types/submission';
import { getCourseById } from '$lib/data/courses';
import { resolveSubModules } from '$lib/data/training';
import type { ReviewItem } from '$lib/data/grading';

/**
 * Antrean penilaian milik instruktur: contoh lokal + submission Drive.
 * Disimpan di SvelteMap agar reaktif di semua halaman penilaian
 * (indeks course → halaman course → halaman tugas).
 */
export const reviewMap = new SvelteMap<string, ReviewItem>();

let seeded = false;
let driveFetched = false;
let loading = $state(true);

export function gradingLoading(): boolean {
	return loading;
}

export function allReviews(): ReviewItem[] {
	return [...reviewMap.values()];
}

const SEED: ReviewItem[] = [
	{ id: 1, student: 'Ahmad Farizi', nim: '2101020045', course: 'Pengembangan Web Frontend', task: 'Proyek: Galeri Interaktif', type: 'Tugas', date: '2 jam lalu', status: 'Menunggu', score: null },
	{ id: 2, student: 'Dewi Anggraini', nim: '2101020031', course: 'Machine Learning Dasar', task: 'Proyek: Prediksi Churn', type: 'Tugas', date: '5 jam lalu', status: 'Menunggu', score: null },
	{ id: 3, student: 'Rian Pratama', nim: '2101020018', course: 'Jaringan Komputer Dasar', task: 'Latihan Subnetting VLSM', type: 'Tugas', date: 'Kemarin', status: 'Menunggu', score: null }
];

function toReviewItem(s: AssignmentSubmission): ReviewItem {
	const cid = Number(s.courseId);
	const course = Number.isFinite(cid) ? getCourseById(cid) : undefined;
	let materialTitle: string | undefined;
	if (course) {
		for (const mod of course.modules) {
			const found = resolveSubModules(mod)
				.flatMap((sub) => sub.materials)
				.find((m) => m.id === s.materialId);
			if (found) {
				materialTitle = found.title;
				break;
			}
		}
	}
	return {
		id: s.id,
		student: s.studentName,
		nim: s.studentNim || '—',
		course: course?.title ?? (s.courseId ? `Kursus ${s.courseId}` : '—'),
		task: materialTitle ?? s.fileName,
		type: 'Tugas',
		date: new Date(s.createdAt).toLocaleString('id-ID'),
		status: s.status,
		score: s.score,
		driveLink: s.driveLink,
		fileName: s.fileName,
		submissionId: s.id,
		courseId: s.courseId || null,
		moduleId: s.moduleId || null,
		materialId: s.materialId || null
	};
}

/** Isi seed sekali + tarik submission Drive sekali. Aman dipanggil tiap halaman. */
export function ensureGradingLoaded(): void {
	if (!seeded) {
		seeded = true;
		for (const r of SEED) reviewMap.set(String(r.id), r);
	}
	if (driveFetched) {
		loading = false;
		return;
	}
	driveFetched = true;
	fetch('/api/assignments/upload', { headers: { accept: 'application/json' } })
		.then(async (res) => {
			if (!res.ok) return;
			const json = (await res.json()) as ApiResult<AssignmentSubmission[]>;
			if (!json.status || !Array.isArray(json.data)) return;
			const known = new Set([...reviewMap.values()].map((r) => String(r.submissionId ?? r.id)));
			for (const s of json.data.map(toReviewItem)) {
				if (!known.has(String(s.id))) {
					known.add(String(s.id));
					reviewMap.set(String(s.id), s);
				}
			}
		})
		.catch(() => {
			/* backend offline — tampilkan data contoh saja */
		})
		.finally(() => {
			loading = false;
		});
}

/** Simpan nilai 0–100 untuk satu pengumpulan. Mengembalikan pesan hasil. */
export async function submitReviewScore(id: string, value: number): Promise<string> {
	const target = reviewMap.get(id);
	if (!target) return 'Data tidak ditemukan.';
	if (target.submissionId) {
		try {
			const res = await fetch(`/api/assignments/grade/${encodeURIComponent(target.submissionId)}`, {
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ score: value })
			});
			if (!res.ok) throw new Error('backend offline');
		} catch {
			/* fallback: simpan lokal saja */
		}
	}
	reviewMap.set(id, { ...target, score: value, status: 'Dinilai' });
	return `Nilai ${value} tersimpan untuk ${target.student}.`;
}
