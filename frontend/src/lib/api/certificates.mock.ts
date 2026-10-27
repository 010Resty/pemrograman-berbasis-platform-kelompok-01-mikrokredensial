import type {
	CertificateListParams,
	CertificateRecord,
	CertificateSummary,
	EligibilityDetail,
	EligibilityEntry,
	EligibilityListParams,
	ModuleCertificateStatus
} from './certificates';

/**
 * Mock DEV-ONLY untuk menu Sertifikat instruktur.
 *
 * Dipakai HANYA bila `import.meta.env.DEV` dan URL memuat
 * `?mock=sertifikat`. DILARANG dipakai di produksi: halaman wajib
 * menampilkan banner "Mode demo DEV" setiap mock ini aktif, dan data
 * di bawah tidak boleh ditampilkan sebagai data nyata.
 */

const DELAY_MS = 450;
const delay = () => new Promise((r) => setTimeout(r, DELAY_MS));

const CERTS: CertificateRecord[] = [
	{
		id: 101,
		code: 'ATS-2026-C1-M1-0042',
		studentName: 'Ahmad Farizi',
		printedName: 'Ahmad Farizi',
		courseId: 1,
		courseTitle: 'Pengembangan Web Frontend',
		moduleId: 11,
		moduleTitle: 'Dasar HTML & CSS',
		issuedAt: '2026-08-15T09:00:00+07:00',
		status: 'aktif',
		revokedAt: null,
		revokeReason: null
	},
	{
		id: 102,
		code: 'ATS-2026-C1-M1-0039',
		studentName: 'Dewi Anggraini',
		printedName: 'Dewi Anggraini',
		courseId: 1,
		courseTitle: 'Pengembangan Web Frontend',
		moduleId: 11,
		moduleTitle: 'Dasar HTML & CSS',
		issuedAt: '2026-07-28T14:30:00+07:00',
		status: 'dicabut',
		revokedAt: '2026-09-02T10:15:00+07:00',
		revokeReason: 'Contoh DEV: nama peserta salah eja, menunggu penerbitan ulang.'
	},
	{
		id: 103,
		code: 'ATS-2026-C2-M1-0017',
		studentName: 'Rian Pratama',
		printedName: 'Rian Pratama',
		courseId: 2,
		courseTitle: 'Basis Data & SQL',
		moduleId: 21,
		moduleTitle: 'Desain Skema Relasional',
		issuedAt: '2026-07-10T11:00:00+07:00',
		status: 'aktif',
		revokedAt: null,
		revokeReason: null
	}
];

const ELIGIBILITY: EligibilityEntry[] = [
	{
		id: 'e-1',
		studentName: 'Sinta Maharani',
		nim: '2101020061',
		courseId: 1,
		courseTitle: 'Pengembangan Web Frontend',
		moduleId: 11,
		moduleTitle: 'Dasar HTML & CSS',
		materialDone: 8,
		materialTotal: 8,
		quizStatus: 'lulus',
		taskStatus: 'lulus',
		status: 'memenuhi'
	},
	{
		id: 'e-2',
		studentName: 'Budi Santoso',
		nim: '2101020052',
		courseId: 1,
		courseTitle: 'Pengembangan Web Frontend',
		moduleId: 11,
		moduleTitle: 'Dasar HTML & CSS',
		materialDone: 8,
		materialTotal: 8,
		quizStatus: 'lulus',
		taskStatus: 'menunggu_penilaian',
		status: 'menunggu_penilaian'
	},
	{
		id: 'e-3',
		studentName: 'Ahmad Farizi',
		nim: '2101020045',
		courseId: 1,
		courseTitle: 'Pengembangan Web Frontend',
		moduleId: 11,
		moduleTitle: 'Dasar HTML & CSS',
		materialDone: 8,
		materialTotal: 8,
		quizStatus: 'lulus',
		taskStatus: 'lulus',
		status: 'sudah_terbit'
	},
	{
		id: 'e-4',
		studentName: 'Dewi Anggraini',
		nim: '2101020031',
		courseId: 1,
		courseTitle: 'Pengembangan Web Frontend',
		moduleId: 12,
		moduleTitle: 'JavaScript Interaktif',
		materialDone: 5,
		materialTotal: 9,
		quizStatus: 'belum_lulus',
		taskStatus: 'belum_lulus',
		status: 'belum_memenuhi'
	}
];

export async function mockSummary(): Promise<CertificateSummary> {
	await delay();
	return {
		eligibleCount: 12,
		issuedActiveCount: 34,
		notEligibleCount: 41,
		revokedCount: 2,
		perCourse: [
			{
				courseId: 1,
				courseTitle: 'Pengembangan Web Frontend',
				eligibleCount: 9,
				issuedActiveCount: 28,
				notEligibleCount: 30,
				revokedCount: 1
			},
			{
				courseId: 2,
				courseTitle: 'Basis Data & SQL',
				eligibleCount: 3,
				issuedActiveCount: 6,
				notEligibleCount: 11,
				revokedCount: 1
			}
		],
		recentlyEligible: [
			{
				eligibilityId: 'e-1',
				studentName: 'Sinta Maharani',
				courseTitle: 'Pengembangan Web Frontend',
				moduleTitle: 'Dasar HTML & CSS'
			},
			{
				eligibilityId: 'e-2',
				studentName: 'Budi Santoso',
				courseTitle: 'Pengembangan Web Frontend',
				moduleTitle: 'Dasar HTML & CSS'
			}
		]
	};
}

export async function mockModuleStatus(moduleId: number): Promise<ModuleCertificateStatus> {
	await delay();
	return {
		moduleId,
		moduleTitle: moduleId === 12 ? 'JavaScript Interaktif' : 'Dasar HTML & CSS',
		courseId: 1,
		courseTitle: 'Pengembangan Web Frontend',
		eligibleCount: 9,
		issuedCount: 28,
		notEligibleCount: 30,
		revokedCount: 1
	};
}

export async function mockEligibility(params: EligibilityListParams): Promise<EligibilityEntry[]> {
	await delay();
	return ELIGIBILITY.filter((e) => {
		if (params.courseId && e.courseId !== params.courseId) return false;
		if (params.moduleId && e.moduleId !== params.moduleId) return false;
		if (params.status && params.status !== 'semua' && e.status !== params.status) return false;
		if (params.q?.trim()) {
			const q = params.q.trim().toLowerCase();
			if (!e.studentName.toLowerCase().includes(q)) return false;
		}
		return true;
	});
}

export async function mockEligibilityDetail(id: number | string): Promise<EligibilityDetail> {
	await delay();
	const base =
		ELIGIBILITY.find((e) => String(e.id) === String(id)) ?? ELIGIBILITY[0];
	const failReasons: string[] =
		base.status === 'belum_memenuhi'
			? [
					`Materi wajib belum selesai (${base.materialDone}/${base.materialTotal}).`,
					'Kuis wajib belum lulus.',
					'Tugas wajib belum lulus.'
				]
			: base.status === 'menunggu_penilaian'
				? ['Tugas wajib menunggu penilaian instruktur.']
				: [];
	return {
		...base,
		certificateId: base.status === 'sudah_terbit' ? 101 : null,
		failReasons,
		materials: [
			{ id: 'm1', title: 'Contoh DEV: Pengenalan HTML', state: 'selesai' },
			{ id: 'm2', title: 'Contoh DEV: Struktur Dokumen', state: 'selesai' },
			{
				id: 'm3',
				title: 'Contoh DEV: Form & Validasi',
				state: base.materialDone < base.materialTotal ? 'belum' : 'selesai'
			}
		],
		quizzes: [{ id: 'q1', title: 'Contoh DEV: Kuis Modul', state: base.quizStatus === 'lulus' ? 'lulus' : 'belum_lulus', extra: 'Nilai terbaik 85' }],
		tasks: [
			{
				id: 't1',
				title: 'Contoh DEV: Proyek Galeri',
				state:
					base.taskStatus === 'lulus'
						? 'lulus'
						: base.taskStatus === 'menunggu_penilaian'
							? 'menunggu'
							: 'belum_lulus',
				extra: base.taskStatus === 'lulus' ? 'Nilai 90' : null
			}
		]
	};
}

export async function mockCertificates(params: CertificateListParams): Promise<CertificateRecord[]> {
	await delay();
	return CERTS.filter((c) => {
		if (params.courseId && c.courseId !== params.courseId) return false;
		if (params.moduleId && c.moduleId !== params.moduleId) return false;
		if (params.status && params.status !== 'semua' && c.status !== params.status) return false;
		if (params.q?.trim()) {
			const q = params.q.trim().toLowerCase();
			if (!c.studentName.toLowerCase().includes(q) && !c.code.toLowerCase().includes(q))
				return false;
		}
		if (params.from && c.issuedAt.slice(0, 10) < params.from) return false;
		if (params.to && c.issuedAt.slice(0, 10) > params.to) return false;
		return true;
	});
}

export async function mockCertificateDetail(id: number | string): Promise<CertificateRecord> {
	await delay();
	const found = CERTS.find((c) => String(c.id) === String(id));
	if (!found) throw new Error('Contoh DEV: sertifikat tidak ditemukan.');
	return found;
}

export async function mockRevoke(id: number | string, reason: string): Promise<CertificateRecord> {
	await delay();
	const found = CERTS.find((c) => String(c.id) === String(id));
	if (!found) throw new Error('Contoh DEV: sertifikat tidak ditemukan.');
	if (found.status !== 'aktif') throw new Error('Contoh DEV: sertifikat sudah dicabut.');
	found.status = 'dicabut';
	found.revokedAt = new Date().toISOString();
	found.revokeReason = reason.trim();
	return { ...found };
}
