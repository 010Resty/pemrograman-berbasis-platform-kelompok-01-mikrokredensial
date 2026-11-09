import { apiRequest } from './backend';
import { getAccessToken, handlePrivateRequestError } from '$lib/stores/auth.svelte';

/**
 * Promo kurasi admin (diskon percent-only / pajang / patungan).
 * Baca publik tanpa login; kelola wajib admin.
 * Harga promo dari server adalah sumber kebenaran diskon;
 * tampilan klien hanya cermin (server menghitung ulang saat bayar).
 */

export type PromoType = 'diskon' | 'kurasi' | 'patungan';
export type PromoStatus = 'draft' | 'active' | 'archived';

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
}

export interface PromoCampaign {
	slug: string;
	title: string;
	badgeLabel: string | null;
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
	input: { courseId: number; position?: number; customBadge?: string }
): Promise<{ slug: string; courseId: number }> {
	return adminRequest(`/admin/promos/${encodeURIComponent(slug)}/courses`, 'POST', input);
}

export function removeCourseFromPromo(slug: string, courseId: number): Promise<{ slug: string; courseId: number }> {
	return adminRequest(`/admin/promos/${encodeURIComponent(slug)}/courses/${courseId}`, 'DELETE');
}
