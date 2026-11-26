import { apiRequest } from './backend';
import { invalidateCache } from './cache';
import { getAccessToken, handlePrivateRequestError } from '$lib/stores/auth.svelte';

/**
 * Promo kurasi admin (diskon percent-only / pajang / patungan).
 * Baca publik tanpa login; kelola wajib admin.
 * Harga promo dari server adalah sumber kebenaran diskon;
 * tampilan klien hanya cermin (server menghitung ulang saat bayar).
 */

export type PromoType = 'diskon' | 'kurasi' | 'patungan';
export type PromoStatus = 'draft' | 'active' | 'archived';

/** Registri 3 halaman jenis promo. Kampanye baru dari admin otomatis masuk
 *  halaman jenisnya + dropdown + sidebar tanpa ubah kode (semua baca live). */
export interface PromoTypeMeta {
  type: PromoType;
  /** Segmen path halaman jenis: /promo/<slug> dan /user/promo/<slug>. */
  slug: 'diskon' | 'kurasi' | 'patungan';
  title: string;
  tagline: string;
  description: string;
  icon: string;
}

export const PROMO_TYPES: PromoTypeMeta[] = [
  {
    type: 'diskon',
    slug: 'diskon',
    title: 'Flash Sale',
    tagline: 'Hemat Lebih Banyak',
    description: 'Diskon spesial dalam periode terbatas. Harga coret adalah harga resmi, harga merah adalah harga bayar.',
    icon: 'fa-bolt'
  },
  {
    type: 'kurasi',
    slug: 'kurasi',
    title: 'Pilihan Unggulan',
    tagline: 'Sorotan Pilihan Editor',
    description: 'Kurasi khusus dari tim Aristoteles. Bila belum ada kurasi, tampilkan yang terbaru.',
    icon: 'fa-star'
  },
  {
    type: 'patungan',
    slug: 'patungan',
    title: 'Promo Patungan',
    tagline: 'Belajar Bareng, Bayar Patungan',
    description: 'Pelatihan yang terdaftar dalam promo patungan admin. Bentuk grup, bagi totalnya, dan bayar per orang.',
    icon: 'fa-people-group'
  }
];

export function promoTypeMeta(type: string | null | undefined): PromoTypeMeta {
  return PROMO_TYPES.find((t) => t.type === type) ?? PROMO_TYPES[0]!;
}

export interface PromoCourse {
	courseId: number;
	title: string;
	image: string | null;
	priceLabel: string;
	priceNominal: number;
	discountPercent: number | null;
	promoPrice: number | null;
	badgeLabel: string | null;
	promoEndsAt: string | null;
	/** Harga khusus patungan (total grup); null = ikut harga kursus. */
	patunganPrice: number | null;
}

export interface PromoCampaign {
	slug: string;
	title: string;
	badgeLabel: string | null;
	/** Sampul promo untuk highlight katalog; null = fallback. */
	coverImage: string | null;
	type: PromoType;
	discountPercent: number | null;
	startsAt: string | null;
	endsAt: string | null;
	courses: PromoCourse[];
}

export interface CoursePromoQuote {
	slug: string;
	title: string;
	badgeLabel: string | null;
	discountPercent: number;
	discountAmount: number;
	endsAt: string | null;
	promoPrice: number;
	priceNominal: number;
}

export async function fetchPromos(): Promise<PromoCampaign[]> {
	return apiRequest<PromoCampaign[]>('/promos');
}

export async function fetchPromo(slug: string): Promise<PromoCampaign> {
	return apiRequest<PromoCampaign>(`/promos/${encodeURIComponent(slug)}`);
}

export interface AdminPromoDetail extends AdminPromoCampaign {
	courses: Array<{
		courseId: number;
		position: number;
		customBadge: string | null;
		title: string;
		status: string;
		priceNominal: number;
		patunganPrice: number | null;
	}>;
}

export function fetchAdminPromoDetail(slug: string): Promise<AdminPromoDetail> {
	return adminRequest<AdminPromoDetail>(`/admin/promos/${encodeURIComponent(slug)}`, 'GET');
}

export async function fetchCoursePromo(courseId: number): Promise<CoursePromoQuote | null> {
	try {
		return await apiRequest<CoursePromoQuote | null>(`/promos/course/${courseId}`);
	} catch {
		return null;
	}
}

export interface AdminPromoCampaign {
	id: number;
	slug: string;
	title: string;
	badgeLabel: string | null;
	coverImage: string | null;
	type: PromoType;
	discountPercent: number | null;
	status: PromoStatus;
	startsAt: string | null;
	endsAt: string | null;
	proposedBy: number | null;
	createdBy: number | null;
	createdAt: string;
	updatedAt: string;
	courseCount?: number;
}

async function adminRequest<T>(path: string, method: string, body?: unknown): Promise<T> {
	try {
		return await apiRequest<T>(path, { method, body, token: getAccessToken() });
	} catch (e) {
		await handlePrivateRequestError(e);
		throw e;
	}
}

/** Request terautentikasi portal instruktur (teacher/admin) — pola sama seperti admin. */
async function instructorRequest<T>(path: string, method: string, body?: unknown): Promise<T> {
	try {
		return await apiRequest<T>(path, { method, body, token: getAccessToken() });
	} catch (e) {
		await handlePrivateRequestError(e);
		throw e;
	}
}

export function fetchAdminPromos(params: { status?: string; type?: string } = {}): Promise<AdminPromoCampaign[]> {
	const qs = new URLSearchParams();
	if (params.status) qs.set('status', params.status);
	if (params.type) qs.set('type', params.type);
	const q = qs.toString();
	return adminRequest<AdminPromoCampaign[]>(`/admin/promos${q ? `?${q}` : ''}`, 'GET');
}

export function createPromo(input: {
	slug: string;
	title: string;
	badgeLabel?: string;
	coverImage?: string;
	type: PromoType;
	discountPercent?: number;
	status?: PromoStatus;
	startsAt?: string;
	endsAt?: string;
}): Promise<AdminPromoCampaign> {
	return adminRequest<AdminPromoCampaign>('/admin/promos', 'POST', input);
}

export function patchPromo(
	slug: string,
	input: Partial<{
		title: string;
		badgeLabel: string | null;
		coverImage: string | null;
		type: PromoType;
		discountPercent: number | null;
		status: PromoStatus;
		startsAt: string | null;
		endsAt: string | null;
	}>
): Promise<AdminPromoCampaign> {
	return adminRequest<AdminPromoCampaign>(`/admin/promos/${encodeURIComponent(slug)}`, 'PATCH', input);
}

export function addCourseToPromo(
	slug: string,
	input: { courseId: number; position?: number; customBadge?: string; patunganPrice?: number }
): Promise<{ slug: string; courseId: number }> {
	return adminRequest(`/admin/promos/${encodeURIComponent(slug)}/courses`, 'POST', input);
}

export function removeCourseFromPromo(slug: string, courseId: number): Promise<{ slug: string; courseId: number }> {
	return adminRequest(`/admin/promos/${encodeURIComponent(slug)}/courses/${courseId}`, 'DELETE');
}

export function deletePromo(slug: string): Promise<{ slug: string; removed: boolean }> {
	return adminRequest(`/admin/promos/${encodeURIComponent(slug)}`, 'DELETE');
}

export type PromoProposalStatus = 'pending' | 'approved' | 'rejected';

export interface PromoProposal {
	id: number;
	campaignSlug: string;
	campaignTitle: string;
	campaignType: PromoType;
	courseId: number;
	courseTitle: string;
	customBadge: string | null;
	patunganPrice: number | null;
	note: string | null;
	status: PromoProposalStatus;
	decidedNote: string | null;
	/** Kapan keputusan dilihat instruktur; null = belum dibaca (badge nav). */
	seenAt: string | null;
	createdAt: string;
	decidedAt: string | null;
}

export interface InstructorPromoMembership {
	slug: string;
	title: string;
	type: PromoType;
	discountPercent: number | null;
	status: PromoStatus;
	endsAt: string | null;
	courseId: number;
	courseTitle: string;
	customBadge: string | null;
	patunganPrice: number | null;
}

export interface AdminPromoProposal extends PromoProposal {
	courseStatus: string;
	priceNominal: number;
	proposedBy: number | null;
	proposerName: string | null;
}

/** Kampanye aktif + keanggotaan kursusku (termasuk yang ditambah langsung admin). */
export function fetchInstructorPromoMemberships(): Promise<InstructorPromoMembership[]> {
	return instructorRequest<InstructorPromoMembership[]>('/instructor/promos', 'GET');
}

/** Riwayat pengajuanku ke promo (pending/disetujui/ditolak). */
export function fetchMyPromoProposals(): Promise<PromoProposal[]> {
	return instructorRequest<PromoProposal[]>('/instructor/promo-proposals', 'GET');
}

/** Tandai semua keputusan atas pengajuanku sudah dibaca. */
export async function markPromoProposalsSeen(): Promise<{ seen: number }> {
	const out = await instructorRequest<{ seen: number }>('/instructor/promo-proposals/seen', 'POST', {});
	invalidateCache('bell:');
	return out;
}

/** Ajukan kursus milikku ke sebuah kampanye (butuh approve admin). */
export async function proposeCourseToPromo(
	slug: string,
	input: { courseId: number; customBadge?: string; patunganPrice?: number; note?: string }
): Promise<PromoProposal> {
	const out = await instructorRequest<PromoProposal>(
		`/instructor/promos/${encodeURIComponent(slug)}/proposals`,
		'POST',
		input
	);
	invalidateCache('bell:');
	return out;
}

/** Antrean pengajuan untuk admin (filter status opsional). */
export function fetchAdminPromoProposals(status?: string): Promise<AdminPromoProposal[]> {
	const qs = status ? `?status=${encodeURIComponent(status)}` : '';
	return adminRequest<AdminPromoProposal[]>(`/admin/promo-proposals${qs}`, 'GET');
}

/** Setujui pengajuan: kursus masuk promo. */
export async function approvePromoProposal(id: number): Promise<PromoProposal> {
	const out = await adminRequest<PromoProposal>(`/admin/promo-proposals/${id}/approve`, 'POST', {});
	invalidateCache('bell:');
	return out;
}

/** Tolak pengajuan beserta catatan keputusan opsional. */
export async function rejectPromoProposal(id: number, note?: string): Promise<PromoProposal> {
	const out = await adminRequest<PromoProposal>(`/admin/promo-proposals/${id}/reject`, 'POST', {
		note: note ?? undefined
	});
	invalidateCache('bell:');
	return out;
}
