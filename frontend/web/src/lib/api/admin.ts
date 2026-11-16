import { apiRequest } from './backend';
import { getAccessToken, handlePrivateRequestError } from '$lib/stores/auth.svelte';
import type { BackendCourse } from './courses';

/**
 * Ringkasan + daftar admin (tanpa data contoh).
 * Kontrak backend: docs `backend/docs/API_CONTRACT.md` §11.
 */
export interface AdminOverview {
	totalStudents: number;
	totalTeachers: number;
	totalCourses: number;
	totalCertificates: number;
}

export interface AdminUser {
	id: number;
	name: string;
	email: string;
	expertise: string | null;
	role: string;
	isActive: boolean;
	/** URL foto profil atau null; absen pada payload lama → null. */
	avatarUrl?: string | null;
	/** URL sampul profil atau null; absen pada payload lama → null. */
	coverUrl?: string | null;
	createdAt: string;
}

export interface AdminUserListParams {
	q?: string;
	role?: 'student' | 'teacher' | 'admin';
	isActive?: boolean;
	limit?: number;
	page?: number;
}

async function req<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
	try {
		return await apiRequest<T>(path, { ...options, token: getAccessToken() });
	} catch (e) {
		await handlePrivateRequestError(e);
		throw e;
	}
}

/** Hitungan badge/kartu ringkasan (GET /api/v1/admin/overview). */
export function fetchAdminOverview(): Promise<AdminOverview> {
	return req<AdminOverview>('/admin/overview');
}

/** Daftar pengguna (GET /api/v1/admin/users). */
export async function fetchAdminUsers(
	params: AdminUserListParams = {}
): Promise<{ items: AdminUser[]; total: number }> {
	const sp = new URLSearchParams();
	if (params.q?.trim()) sp.set('q', params.q.trim());
	if (params.role) sp.set('role', params.role);
	if (params.isActive !== undefined) sp.set('isActive', String(params.isActive));
	if (params.limit !== undefined) sp.set('limit', String(params.limit));
	if (params.page !== undefined) sp.set('page', String(params.page));
	const qs = sp.toString();
	const data = await req<{ items: AdminUser[]; total: number } | AdminUser[]>(
		`/admin/users${qs ? `?${qs}` : ''}`
	);
	return Array.isArray(data) ? { items: data, total: data.length } : data;
}

/** Pengguna terbaru (GET /api/v1/admin/users?limit=, terbaru dulu). */
export async function fetchRecentUsers(limit = 4, role = 'student'): Promise<AdminUser[]> {
	const data = await req<{ items: AdminUser[]; total: number } | AdminUser[]>(
		`/admin/users?role=${role}&limit=${limit}`
	);
	return Array.isArray(data) ? data : (data.items ?? []);
}

/** Kursus terbaru untuk admin (GET /api/v1/instructor/courses, admin melihat semua). */
export async function fetchRecentCourses(limit = 4): Promise<BackendCourse[]> {
	const data = await req<{ courses?: BackendCourse[] } | BackendCourse[]>(
		`/instructor/courses?limit=${limit}&sort=newest`
	);
	return Array.isArray(data) ? data : (data.courses ?? []);
}

/**
 * Seluruh kursus untuk admin (GET /api/v1/instructor/courses, admin melihat
 * semua). Dipakai untuk mengaitkan kursus ke pembuatnya (kolom `createdBy`).
 * Baris daftar tidak memuat `instructors[]`, jadi penugasan pengampu
 * (bukan pembuat) tidak dapat dibedakan di sini.
 */
export async function fetchAdminCourses(limit = 100): Promise<BackendCourse[]> {
	const data = await req<{ courses?: BackendCourse[] } | BackendCourse[]>(
		`/instructor/courses?limit=${limit}&sort=newest`
	);
	return Array.isArray(data) ? data : (data.courses ?? []);
}

/** Status kursus versi server (huruf kecil). */
export type AdminCourseStatus = 'draft' | 'published' | 'archived';

export interface AdminCourseListParams {
	q?: string;
	status?: AdminCourseStatus;
	category?: string;
	limit?: number;
}

/**
 * Daftar kursus untuk admin dengan filter server
 * (GET /api/v1/instructor/courses?q=&status=&category=&limit=&sort=newest).
 * Respons berupa array tanpa total — paginasi dilakukan di klien.
 */
export async function fetchAdminCourseList(
	params: AdminCourseListParams = {}
): Promise<BackendCourse[]> {
	const sp = new URLSearchParams();
	if (params.q?.trim()) sp.set('q', params.q.trim());
	if (params.status) sp.set('status', params.status);
	if (params.category?.trim()) sp.set('category', params.category.trim());
	sp.set('limit', String(params.limit ?? 100));
	sp.set('sort', 'newest');
	const data = await req<{ courses?: BackendCourse[] } | BackendCourse[]>(
		`/instructor/courses?${sp.toString()}`
	);
	return Array.isArray(data) ? data : (data.courses ?? []);
}

export interface AssignInstructorResult {
	courseId: number;
	userId: number;
	email: string;
	role: string;
}

/** Tugaskan pengampu ke kursus (POST /api/v1/admin/courses/:id/instructors). */
export async function assignCourseInstructor(
	courseId: number,
	input: { userId?: number; email?: string }
): Promise<AssignInstructorResult> {
	return req<AssignInstructorResult>(`/admin/courses/${courseId}/instructors`, {
		method: 'POST',
		body: input
	});
}

export interface AdminUserDetail extends AdminUser {
	enrollmentCount: number;
	certificateCount: number;
}

/** Detail satu pengguna (GET /api/v1/admin/users/:id). */
export function fetchAdminUser(id: number): Promise<AdminUserDetail> {
	return req<AdminUserDetail>(`/admin/users/${id}`);
}

/** Aktif/nonaktif akun (PATCH /api/v1/admin/users/:id {isActive}). */
export async function setAdminUserActive(id: number, isActive: boolean): Promise<void> {
	await req<unknown>(`/admin/users/${id}`, { method: 'PATCH', body: { isActive } });
}

/**
 * Ubah akun (PATCH /api/v1/admin/users/:id {name?, email?, expertise?, isActive?}).
 * Min. 1 field; string kosong pada expertise = hapus. Email duplikat → 409;
 * ubah status diri sendiri → 400.
 */
export function updateAdminUser(
	id: number,
	input: { name?: string; email?: string; expertise?: string; isActive?: boolean }
): Promise<AdminUser> {
	return req<AdminUser>(`/admin/users/${id}`, { method: 'PATCH', body: input });
}

export interface AdminReportCourseRow {
	courseId: number;
	title: string;
	status: string;
	studentCount: number;
	avgProgress: number;
	pendingReviews: number;
	revenueVerified: number;
	paymentsMenunggu: number;
	paymentsDiverifikasi: number;
	paymentsDitolak: number;
	certificatesIssued: number;
	certificatesRevoked: number;
}

export interface AdminReportInsightStage {
	stage: 'pendaftar' | 'enrollment' | 'pembayaran' | 'sertifikat';
	label: string;
	basis: 'snapshot' | 'filter';
	count: number;
	pctOfFirst: number;
	pctOfPrev: number | null;
}

export interface AdminReportInsights {
	funnel: AdminReportInsightStage[];
	rates: {
		paymentApproval: number;
		paymentRejection: number;
		enrollmentCompletion: number;
		certificatePerEnrollment: number;
		enrollmentCertified: number;
		certificateRevoke: number;
	};
	note: string;
}

export interface AdminReports {
	summary: {
		totalStudents: number;
		totalTeachers: number;
		totalCourses: number;
		totalCertificates: number;
		activeEnrollments: number;
		completedEnrollments: number;
		paymentsMenunggu: number;
		paymentsDiverifikasi: number;
		paymentsDitolak: number;
		revenueVerified: number;
		voucherRedemptions: number;
	};
	perCourse: AdminReportCourseRow[];
	certificates: { issued: number; revoked: number };
	filters: { from?: string; to?: string; courseId?: number };
	paging: { page: number; limit: number; total: number };
	insights: AdminReportInsights;
}

export interface AdminReportsParams {
	from?: string;
	to?: string;
	courseId?: number;
	limit?: number;
	page?: number;
}

/**
 * Laporan agregat read-only (GET /api/v1/admin/reports?from=&to=&courseId=&limit=&page=).
 * Kontrak backend: docs `backend/docs/API_CONTRACT.md` §11.
 * `avgProgress`/`pendingReviews` adalah snapshot saat ini (tak terfilter tanggal).
 */
export function fetchAdminReports(params: AdminReportsParams = {}): Promise<AdminReports> {
	const sp = new URLSearchParams();
	if (params.from) sp.set('from', params.from);
	if (params.to) sp.set('to', params.to);
	if (params.courseId !== undefined) sp.set('courseId', String(params.courseId));
	if (params.limit !== undefined) sp.set('limit', String(params.limit));
	if (params.page !== undefined) sp.set('page', String(params.page));
	const qs = sp.toString();
	return req<AdminReports>(`/admin/reports${qs ? `?${qs}` : ''}`);
}
