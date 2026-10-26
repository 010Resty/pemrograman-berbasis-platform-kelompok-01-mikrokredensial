import { SvelteMap } from 'svelte/reactivity';

export interface Instructor {
	id: number;
	name: string;
	email: string;
	expertise: string;
	courses: number;
	students: number;
	rating: number;
	status: 'Aktif' | 'Nonaktif';
}

/**
 * Data instruktur untuk portal admin.
 * Disimpan di memori selama sesi browser (konsisten dengan halaman Users):
 * perubahan langsung terlihat di daftar, detail, dan form ubah,
 * tetapi hilang saat halaman dimuat ulang — backend belum tersedia.
 */
const seed: Instructor[] = [
	{ id: 1, name: 'Kevin Perry', email: 'kevin@aristoteles.ac.id', expertise: 'Desain UI/UX', courses: 8, students: 5420, rating: 4.7, status: 'Aktif' },
	{ id: 2, name: 'Max Alexix', email: 'max@aristoteles.ac.id', expertise: 'Pengembangan Web', courses: 5, students: 3890, rating: 4.7, status: 'Aktif' },
	{ id: 3, name: 'Sarah Johnson', email: 'sarah@aristoteles.ac.id', expertise: 'Pemasaran Digital', courses: 6, students: 2746, rating: 4.6, status: 'Aktif' },
	{ id: 4, name: 'Rian Pratama', email: 'rian@aristoteles.ac.id', expertise: 'Sains Data & AI', courses: 4, students: 1980, rating: 4.9, status: 'Aktif' },
	{ id: 5, name: 'Dewi Anggraini', email: 'dewi@aristoteles.ac.id', expertise: 'Keamanan Siber', courses: 3, students: 940, rating: 4.5, status: 'Nonaktif' },
	{ id: 6, name: 'Budi Santoso', email: 'budi@aristoteles.ac.id', expertise: 'Jaringan Komputer', courses: 2, students: 620, rating: 4.4, status: 'Aktif' }
];

export const instructorsMap = new SvelteMap<number, Instructor>(
	seed.map((i) => [i.id, { ...i }] as const)
);

export function allInstructors(): Instructor[] {
	return [...instructorsMap.values()];
}

export function getInstructor(id: number): Instructor | undefined {
	return instructorsMap.get(id);
}

export function isEmailTaken(email: string, exceptId?: number): boolean {
	const addr = email.trim().toLowerCase();
	return allInstructors().some((i) => i.id !== exceptId && i.email.toLowerCase() === addr);
}

export function updateInstructor(
	id: number,
	patch: Pick<Instructor, 'name' | 'email' | 'expertise' | 'status'>
): boolean {
	const current = instructorsMap.get(id);
	if (!current) return false;
	if (isEmailTaken(patch.email, id)) return false;
	instructorsMap.set(id, { ...current, ...patch });
	return true;
}

export function setInstructorStatus(id: number, status: Instructor['status']): boolean {
	const current = instructorsMap.get(id);
	if (!current) return false;
	instructorsMap.set(id, { ...current, status });
	return true;
}
