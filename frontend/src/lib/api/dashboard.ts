import { apiRequest } from './backend';
import { getAccessToken, handlePrivateRequestError } from '$lib/stores/auth.svelte';

/** Satu kursus kelolaan + agregat database (tanpa data contoh). */
export interface DashboardCourse {
	id: number;
	title: string;
	status: 'draft' | 'published' | 'archived';
	studentCount: number;
	pendingCount: number;
	avgProgress: number;
}

/** Pengumpulan terbaru yang menunggu dinilai. */
export interface DashboardPendingReview {
	submissionId: number;
	studentName: string;
	courseId: number;
	courseTitle: string;
	materialId: number;
	materialTitle: string;
	submittedAt: string;
}

export interface DashboardTotals {
	activeCourses: number;
	draftCourses: number;
	totalStudents: number;
	pendingReviews: number;
}

export interface InstructorDashboard {
	courses: DashboardCourse[];
	pendingReviews: DashboardPendingReview[];
	totals: DashboardTotals;
}

/** Ringkasan dasbor instruktur (GET /api/v1/instructor/dashboard). */
export async function fetchInstructorDashboard(): Promise<InstructorDashboard> {
	try {
		return await apiRequest<InstructorDashboard>('/instructor/dashboard', {
			token: getAccessToken()
		});
	} catch (e) {
		await handlePrivateRequestError(e);
		throw e;
	}
}

/** Waktu relatif id-ID untuk daftar antrean ("2 jam lalu"). */
export function timeAgo(iso: string): string {
	const t = new Date(iso).getTime();
	if (!Number.isFinite(t)) return '-';
	const diff = Date.now() - t;
	if (diff < 0) return 'baru saja';
	const m = Math.floor(diff / 60000);
	if (m < 1) return 'baru saja';
	if (m < 60) return `${m} menit lalu`;
	const h = Math.floor(m / 60);
	if (h < 24) return `${h} jam lalu`;
	const d = Math.floor(h / 24);
	if (d < 7) return d === 1 ? 'Kemarin' : `${d} hari lalu`;
	const w = Math.floor(d / 7);
	if (w < 5) return `${w} minggu lalu`;
	const mo = Math.floor(d / 30);
	if (mo < 12) return `${mo} bulan lalu`;
	return `${Math.floor(mo / 12)} tahun lalu`;
}
