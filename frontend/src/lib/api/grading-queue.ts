import { fetchReviewQueue } from './submissions';

/**
 * Antrean penilaian instruktur dari backend dalam SATU respons
 * (GET /api/v1/instructor/review-queue; tanpa data contoh).
 * Agregat per kursus kelola: materi `tugas` + hitungan pengumpulan.
 *
 * Status tampil: `submitted` sudah diagregat server sebagai Menunggu;
 * Dinilai = skor tidak null. `partial` dipertahankan untuk kompatibilitas
 * (server selalu lengkap; true hanya bila klien fallback per-materi).
 */

export interface QueueTask {
	materialId: number;
	title: string;
	moduleLabel: string;
	duration: string | null;
	pending: number;
	graded: number;
	total: number;
	avgScore: number | null;
}

export interface QueueCourse {
	id: number;
	title: string;
	category: string;
	image: string | null;
	tasks: QueueTask[];
	pending: number;
	graded: number;
	total: number;
}

export interface ReviewQueue {
	courses: QueueCourse[];
	pendingTotal: number;
	gradedTotal: number;
	avgScore: number | null;
	/** True bila sebagian data gagal dimuat (angka tidak lengkap). */
	partial: boolean;
}

export async function loadInstructorReviewQueue(): Promise<ReviewQueue> {
	const q = await fetchReviewQueue();
	return {
		courses: q.courses.map((c) => ({
			id: c.id,
			title: c.title,
			category: c.category ?? 'Umum',
			image: c.image,
			tasks: c.tasks.map((t) => ({
				materialId: t.materialId,
				title: t.title,
				moduleLabel: `Modul ${t.moduleIndex}: ${t.moduleTitle}`,
				duration: t.duration,
				pending: t.pending,
				graded: t.graded,
				total: t.total,
				avgScore: t.avgScore
			})),
			pending: c.pending,
			graded: c.graded,
			total: c.total
		})),
		pendingTotal: q.pendingTotal,
		gradedTotal: q.gradedTotal,
		avgScore: q.avgScore,
		partial: false
	};
}
