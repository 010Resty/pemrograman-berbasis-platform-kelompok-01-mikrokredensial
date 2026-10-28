import { apiRequest } from './backend';
import { getAccessToken, handlePrivateRequestError } from '$lib/stores/auth.svelte';

/**
 * Kontrak API sertifikat instruktur — USULAN frontend, belum dikonfirmasi backend.
 *
 * Seluruh fungsi di bawah hanya memanggil endpoint backend dan TIDAK PERNAH
 * mengarang hasil: bila endpoint belum tersedia, `apiRequest` melempar
 * `BackendRequestError` dan UI wajib menampilkan state error/empty + retry.
 *
 * Endpoint usulan (butuh konfirmasi tim backend):
 * - GET    /instructor/certificates/summary
 * - GET    /instructor/modules/:moduleId/certificate-status
 * - GET    /instructor/eligibility?courseId=&moduleId=&status=&q=
 * - GET    /instructor/eligibility/:id
 * - GET    /instructor/certificates?courseId=&moduleId=&status=&q=&from=&to=
 * - GET    /instructor/certificates/:id
 * - POST   /instructor/certificates/:id/revoke  { reason: string }
 *
 * Aturan bisnis yang ditegakkan sisi UI:
 * - Penerbitan otomatis oleh backend; frontend TIDAK menyediakan tombol terbit manual.
 * - Pencabutan butuh alasan wajib; status hanya berubah setelah respons sukses.
 * - Sertifikat dicabut tetap tampil di riwayat.
 */

function req<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
	return apiRequest<T>(path, { ...options, token: getAccessToken() }).catch(async (e: unknown) => {
		await handlePrivateRequestError(e);
		throw e;
	});
}

export type CertificateStatus = 'aktif' | 'dicabut';

/** Status kelayakan sesuai spesifikasi fitur. */
export type EligibilityStatus =
	| 'belum_memenuhi'
	| 'menunggu_penilaian'
	| 'memenuhi'
	| 'sudah_terbit';

export interface SummaryCourseRow {
	courseId: number;
	courseTitle: string;
	eligibleCount: number;
	issuedActiveCount: number;
	notEligibleCount: number;
	revokedCount: number;
}

export interface RecentlyEligible {
	eligibilityId: number | string;
	studentName: string;
	courseTitle: string;
	moduleTitle: string;
}

export interface CertificateSummary {
	eligibleCount: number;
	issuedActiveCount: number;
	notEligibleCount: number;
	revokedCount: number;
	perCourse: SummaryCourseRow[];
	recentlyEligible: RecentlyEligible[];
}

export interface ModuleCertificateStatus {
	moduleId: number;
	moduleTitle: string;
	courseId: number;
	courseTitle: string;
	eligibleCount: number;
	issuedCount: number;
	notEligibleCount: number;
	revokedCount: number;
}

export interface EligibilityEntry {
	id: number | string;
	studentName: string;
	nim: string | null;
	courseId: number;
	courseTitle: string;
	moduleId: number;
	moduleTitle: string;
	materialDone: number;
	materialTotal: number;
	quizStatus: 'lulus' | 'belum_lulus' | 'tidak_ada';
	taskStatus: 'lulus' | 'belum_lulus' | 'menunggu_penilaian' | 'tidak_ada';
	status: EligibilityStatus;
}

export interface EligibilityRequirementItem {
	id: number | string;
	title: string;
	state: 'selesai' | 'belum' | 'lulus' | 'belum_lulus' | 'menunggu';
	extra?: string | null;
}

export interface EligibilityDetail extends EligibilityEntry {
	certificateId: number | string | null;
	failReasons: string[];
	materials: EligibilityRequirementItem[];
	quizzes: EligibilityRequirementItem[];
	tasks: EligibilityRequirementItem[];
}

export interface CertificateRecord {
	id: number | string;
	code: string;
	studentName: string;
	printedName: string;
	courseId: number;
	courseTitle: string;
	moduleId: number;
	moduleTitle: string;
	issuedAt: string;
	status: CertificateStatus;
	revokedAt: string | null;
	revokeReason: string | null;
}

export interface CertificateListParams {
	courseId?: number;
	moduleId?: number;
	status?: CertificateStatus | 'semua';
	q?: string;
	from?: string;
	to?: string;
}

export interface EligibilityListParams {
	courseId?: number;
	moduleId?: number;
	status?: EligibilityStatus | 'semua';
	q?: string;
}

function toQuery(params: Record<string, string | number | undefined>): string {
	const sp = new URLSearchParams();
	for (const [k, v] of Object.entries(params)) {
		if (v !== undefined && v !== '') sp.set(k, String(v));
	}
	const s = sp.toString();
	return s ? `?${s}` : '';
}

function unwrapList<T>(data: { items?: T[] } | T[], key: string): T[] {
	if (Array.isArray(data)) return data;
	const items = (data as { items?: T[] }).items;
	if (!Array.isArray(items)) {
		throw new Error(`Format respons ${key} tidak dikenali (tidak ada array items).`);
	}
	return items;
}

function unwrapOne<T>(data: { item?: T } | T): T {
	if (data && typeof data === 'object' && 'item' in (data as Record<string, unknown>)) {
		return (data as { item: T }).item;
	}
	return data as T;
}

/** Ringkasan angka sertifikat untuk seluruh kursus milik instruktur login. */
export async function fetchCertificateSummary(): Promise<CertificateSummary> {
	const data = await req<{ summary?: CertificateSummary } | CertificateSummary>(
		'/instructor/certificates/summary'
	);
	return (data as { summary?: CertificateSummary }).summary ?? (data as CertificateSummary);
}

/** Status sertifikat satu modul (angka kelayakan/terbit/belum/dicabut). */
export async function fetchModuleCertificateStatus(
	moduleId: number
): Promise<ModuleCertificateStatus> {
	const data = await req<{ status?: ModuleCertificateStatus } | ModuleCertificateStatus>(
		`/instructor/modules/${moduleId}/certificate-status`
	);
	return (
		(data as { status?: ModuleCertificateStatus }).status ?? (data as ModuleCertificateStatus)
	);
}

/** Daftar kelayakan peserta (semua angka/status dari backend). */
export async function fetchEligibility(
	params: EligibilityListParams = {}
): Promise<EligibilityEntry[]> {
	const data = await req<{ items?: EligibilityEntry[] } | EligibilityEntry[]>(
		`/instructor/eligibility${toQuery({
			courseId: params.courseId,
			moduleId: params.moduleId,
			status: params.status === 'semua' ? undefined : params.status,
			q: params.q?.trim() || undefined
		})}`
	);
	return unwrapList(data, 'kelayakan');
}

/** Rincian kelayakan satu peserta pada satu modul. */
export async function fetchEligibilityDetail(
	id: number | string
): Promise<EligibilityDetail> {
	const data = await req<{ item?: EligibilityDetail } | EligibilityDetail>(
		`/instructor/eligibility/${encodeURIComponent(String(id))}`
	);
	return unwrapOne(data);
}

/** Riwayat sertifikat (termasuk yang dicabut). */
export async function fetchCertificates(
	params: CertificateListParams = {}
): Promise<CertificateRecord[]> {
	const data = await req<{ items?: CertificateRecord[] } | CertificateRecord[]>(
		`/instructor/certificates${toQuery({
			courseId: params.courseId,
			moduleId: params.moduleId,
			status: params.status === 'semua' ? undefined : params.status,
			q: params.q?.trim() || undefined,
			from: params.from || undefined,
			to: params.to || undefined
		})}`
	);
	return unwrapList(data, 'riwayat sertifikat');
}

/** Detail satu sertifikat (termasuk info pencabutan bila ada). */
export async function fetchCertificateDetail(
	id: number | string
): Promise<CertificateRecord> {
	const data = await req<{ item?: CertificateRecord } | CertificateRecord>(
		`/instructor/certificates/${encodeURIComponent(String(id))}`
	);
	return unwrapOne(data);
}

/**
 * Mencabut sertifikat aktif. `reason` wajib tidak kosong (divalidasi UI +
 * backend). Mengembalikan record terbaru dari server — UI hanya boleh
 * mengubah status setelah promise ini resolve.
 */
export async function revokeCertificate(
	id: number | string,
	reason: string
): Promise<CertificateRecord> {
	const data = await req<{ item?: CertificateRecord } | CertificateRecord>(
		`/instructor/certificates/${encodeURIComponent(String(id))}/revoke`,
		{ method: 'POST', body: { reason: reason.trim() } }
	);
	return unwrapOne(data);
}

/**
 * Tautan verifikasi publik. Halaman verifikasi publik khusus
 * (`/verifikasi`) belum ada di frontend — untuk sementara arahkan ke
 * section verifikasi landing. Jangan mengarang route baru.
 */
export function publicVerifyHref(): string {
	return '/#verifikasi';
}

/** Kelayakan sertifikat milik sendiri per modul (GET /api/v1/me/modules/:id/certificate-status). */
export interface MyModuleRequirement {
	materialId: number;
	title: string;
	type: string;
	state: string;
	extra: string | null;
}

export interface MyModuleCertificateStatus {
	moduleId: number;
	courseId: number;
	eligible: boolean;
	requirements: MyModuleRequirement[];
	failReasons: string[];
	certificate: { id: number; code: string; status: string } | null;
}

export async function fetchMyModuleCertificateStatus(
	moduleId: number
): Promise<MyModuleCertificateStatus> {
	const data = await req<{ item?: MyModuleCertificateStatus } | MyModuleCertificateStatus>(
		`/me/modules/${moduleId}/certificate-status`
	);
	return unwrapOne(data);
}

/** Label Indonesia untuk status kelayakan. */
export function eligibilityLabel(s: EligibilityStatus): string {
	switch (s) {
		case 'belum_memenuhi':
			return 'Belum memenuhi syarat';
		case 'menunggu_penilaian':
			return 'Menunggu penilaian tugas';
		case 'memenuhi':
			return 'Memenuhi syarat';
		case 'sudah_terbit':
			return 'Sertifikat sudah diterbitkan';
	}
}

/** Label Indonesia untuk status sertifikat. */
export function certificateStatusLabel(s: CertificateStatus): string {
	return s === 'aktif' ? 'Aktif' : 'Dicabut';
}
