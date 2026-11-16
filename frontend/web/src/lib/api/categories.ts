import { apiRequest } from './backend';
import { getAccessToken, handlePrivateRequestError } from '$lib/stores/auth.svelte';

/**
 * Kategori kursus kelola-admin (sumber kebenaran dropdown/filter).
 * Baca publik tanpa login; kelola wajib admin.
 * Bila backend tak terjangkau / endpoint belum ada (backend lama),
 * pemanggil memakai FALLBACK_CATEGORIES agar form tetap berfungsi.
 */

export interface Category {
	id: number;
	slug: string;
	name: string;
	sortOrder: number;
}

export interface AdminCategory extends Category {
	isActive: boolean;
	courseCount: number;
	createdAt: string;
	updatedAt: string;
}

/** Daftar bawaan (parity migrasi 0026) — hanya fallback offline. */
export const FALLBACK_CATEGORIES: string[] = [
	'Pengembangan Web',
	'Basis Data',
	'Jaringan',
	'Keamanan',
	'AI & Data',
	'Infrastruktur',
	'Desain',
	'Bisnis'
];

/** Daftar aktif untuk dropdown/filter (publik, tanpa token). */
export async function fetchCategories(): Promise<string[]> {
	try {
		const rows = await apiRequest<Category[]>('/categories');
		if (Array.isArray(rows) && rows.length > 0) return rows.map((c) => c.name);
		return [...FALLBACK_CATEGORIES];
	} catch {
		return [...FALLBACK_CATEGORIES];
	}
}

async function adminReq<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
	try {
		return await apiRequest<T>(path, { ...options, token: getAccessToken() });
	} catch (e) {
		await handlePrivateRequestError(e);
		throw e;
	}
}

/** Semua kategori + hitungan pemakaian (admin). */
export function fetchAdminCategories(): Promise<AdminCategory[]> {
	return adminReq<AdminCategory[]>('/admin/categories');
}

/** Detail satu kategori (admin). */
export function fetchAdminCategory(id: number): Promise<AdminCategory> {
	return adminReq<AdminCategory>(`/admin/categories/${id}`);
}

/** Tambah kategori (admin). Slug otomatis dari nama bila kosong. */
export function createCategory(input: { name: string; sortOrder?: number }): Promise<AdminCategory> {
	return adminReq<AdminCategory>('/admin/categories', { method: 'POST', body: input });
}

/** Ubah nama/status/urutan (admin). Ganti nama ikut mengubah kursus pemakai. */
export function patchCategory(
	id: number,
	input: { name?: string; isActive?: boolean; sortOrder?: number }
): Promise<AdminCategory> {
	return adminReq<AdminCategory>(`/admin/categories/${id}`, { method: 'PATCH', body: input });
}

/** Hapus permanen (admin) — ditolak bila masih dipakai kursus. */
export function deleteCategory(id: number): Promise<{ id: number; removed: boolean }> {
	return adminReq<{ id: number; removed: boolean }>(`/admin/categories/${id}`, {
		method: 'DELETE'
	});
}
