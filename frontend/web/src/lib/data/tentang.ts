/**
 * Data konten statis halaman Tentang (dipakai ulang ringkasan + sub-halaman).
 * Faktual mengikuti keputusan proyek; tanpa angka contoh.
 */

export interface TentangStep {
	icon: string;
	title: string;
	desc: string;
	/** Rincian yang terjadi pada langkah ini (faktual, tanpa klaim angka). */
	points: string[];
}

export interface TentangRole {
	icon: string;
	title: string;
	desc: string;
	/** Sorotan kemampuan portal peran ini. */
	points: string[];
	href: '/user' | '/instruktur' | '/admin';
	cta: string;
}

export interface TentangFeature {
	icon: string;
	title: string;
	desc: string;
}

export interface TentangSubPage {
	id: string;
	title: string;
	desc: string;
	href: '/tentang/arti-nama' | '/tentang/cara-kerja' | '/tentang/untuk-siapa' | '/tentang/keunggulan';
	icon: string;
}

export const TENTANG_SUBPAGES: TentangSubPage[] = [
	{
		id: 'arti-nama',
		title: 'Arti Nama',
		desc: 'Makna dan singkatan ARISTOTELES',
		href: '/tentang/arti-nama',
		icon: 'fa-flask'
	},
	{
		id: 'cara-kerja',
		title: 'Cara Kerja',
		desc: 'Empat langkah menuju sertifikat',
		href: '/tentang/cara-kerja',
		icon: 'fa-route'
	},
	{
		id: 'untuk-siapa',
		title: 'Untuk Siapa',
		desc: 'Portal peserta, instruktur, dan admin',
		href: '/tentang/untuk-siapa',
		icon: 'fa-users'
	},
	{
		id: 'keunggulan',
		title: 'Keunggulan',
		desc: 'Kurikulum industri dan mentor praktisi',
		href: '/tentang/keunggulan',
		icon: 'fa-award'
	}
];

export const TENTANG_STEPS: TentangStep[] = [
	{
		icon: 'fa-magnifying-glass',
		title: 'Pilih pelatihan',
		desc: 'Telusuri katalog dan pilih program mikrokredensial sesuai tujuan kariermu.',
		points: [
			'Saring katalog berdasarkan kategori dan tingkatan',
			'Baca pratinjau: struktur modul, harga, dan periode',
			'Kelas gratis bisa langsung dipelajari setelah mendaftar'
		]
	},
	{
		icon: 'fa-book-open',
		title: 'Belajar materi',
		desc: 'Pelajari materi modul demi modul dengan alur yang sudah disusun.',
		points: [
			'Materi tersusun per modul, sub-modul, dan materi',
			'Tersedia dalam format video, audio, teks, dan foto',
			'Progres belajarmu terlacak otomatis'
		]
	},
	{
		icon: 'fa-list-check',
		title: 'Kerjakan kuis & tugas',
		desc: 'Uji pemahaman lewat kuis dan kumpulkan tugas untuk dinilai instruktur.',
		points: [
			'Kuis memakai nilai ambang kelulusan per kuis',
			'Tugas dinilai langsung oleh instruktur',
			'Boleh mengulang sampai memenuhi syarat'
		]
	},
	{
		icon: 'fa-award',
		title: 'Raih sertifikat',
		desc: 'Selesaikan syarat tiap modul dan terima sertifikat mikrokredensial.',
		points: [
			'Satu sertifikat untuk setiap modul yang tuntas',
			'Satu sertifikat pelatihan setelah semua modul tuntas',
			'Keaslian dapat dicek di halaman Verifikasi'
		]
	}
];

export const TENTANG_ROLES: TentangRole[] = [
	{
		icon: 'fa-user-graduate',
		title: 'Peserta',
		desc: 'Belajar mandiri, kerjakan kuis dan tugas, tukar voucher, dan kumpulkan sertifikat per modul.',
		points: [
			'Akses materi fleksibel mengikuti ritmemu',
			'Kuis dan tugas dengan penilaian instruktur',
			'Opsi hemat: voucher, promo, dan patungan'
		],
		href: '/user',
		cta: 'Portal Peserta'
	},
	{
		icon: 'fa-chalkboard-user',
		title: 'Instruktur',
		desc: 'Kelola kurikulum, susun kuis dan tugas, nilai pengumpulan, dan pantau kelulusan peserta.',
		points: [
			'Susun modul, sub-modul, dan materi',
			'Atur kuis berambang dan tugas berubrik',
			'Pantau kelulusan peserta per modul'
		],
		href: '/instruktur',
		cta: 'Portal Instruktur'
	},
	{
		icon: 'fa-shield-halved',
		title: 'Admin',
		desc: 'Kelola peserta, undang instruktur, atur voucher, dan pantau seluruh pelatihan.',
		points: [
			'Kelola peserta dan penugasan instruktur',
			'Atur voucher, promo, dan pembayaran',
			'Pantau seluruh pelatihan dan sertifikat'
		],
		href: '/admin',
		cta: 'Portal Admin'
	}
];

export const TENTANG_FEATURES: TentangFeature[] = [
	{
		icon: 'fa-list-check',
		title: 'Pembelajaran terstruktur',
		desc: 'Materi, kuis, dan tugas tersusun per modul dengan alur yang jelas dari awal hingga akhir.'
	},
	{
		icon: 'fa-book-open',
		title: 'Akses materi fleksibel',
		desc: 'Pelajari materi dalam berbagai format sesuai ritmemu, dengan progres yang terlacak.'
	},
	{
		icon: 'fa-pen-to-square',
		title: 'Evaluasi yang terukur',
		desc: 'Uji pemahaman lewat kuis bernilai ambang dan tugas yang dinilai langsung oleh instruktur.'
	},
	{
		icon: 'fa-award',
		title: 'Sertifikat bersyarat',
		desc: 'Sertifikat per modul diterbitkan setelah seluruh persyaratan wajib terpenuhi dan terverifikasi.'
	}
];

export const TENTANG_NAME_PARTS = [
	{ k: 'Artificial Intelligence', v: 'Kecerdasan Buatan — fondasi analisis dan personalisasi belajar.' },
	{ k: 'Research & Innovation', v: 'Riset dan inovasi sebagai cara memperbarui kurikulum.' },
	{ k: 'Science, Technology & Engineering', v: 'Sains, teknologi, dan rekayasa sebagai bidang keahlian utama.' },
	{ k: 'Laboratory for Education & Systems', v: 'Laboratorium yang membangun sistem pendidikan yang hidup.' }
];

export interface TentangPrinciple {
	icon: string;
	title: string;
	desc: string;
}

/** Tiga prinsip turunan langsung dari filosofi di hero Arti Nama. */
export const TENTANG_PRINCIPLES: TentangPrinciple[] = [
	{
		icon: 'fa-flask',
		title: 'Belajar lewat pengalaman',
		desc: 'Materi disusun dari praktik nyata agar pengetahuan langsung bisa diterapkan, bukan sekadar dihafal.'
	},
	{
		icon: 'fa-brain',
		title: 'Bernalar dan terukur',
		desc: 'Penalaranmu diuji lewat kuis berambang dan tugas yang dinilai — hasilnya terlacak, bukan tebakan.'
	},
	{
		icon: 'fa-briefcase',
		title: 'Relevan dunia kerja',
		desc: 'Kurikulum berbasis industri dengan sertifikat per modul yang terverifikasi keasliannya.'
	}
];

/** Syarat penerbitan sertifikat (aturan K-05). */
export const TENTANG_CERT_REQUIREMENTS = [
	'Selesaikan seluruh materi wajib di modul tersebut',
	'Lulus seluruh kuis wajib sesuai ambang yang ditentukan',
	'Penuhi syarat tugas berdasarkan penilaian instruktur'
];

export interface TentangFormat {
	icon: string;
	label: string;
	desc: string;
}

/** Format materi yang didukung platform (cermin tipe materi di kurikulum). */
export const TENTANG_FORMATS: TentangFormat[] = [
	{ icon: 'fa-circle-play', label: 'Video', desc: 'Materi visual' },
	{ icon: 'fa-headphones', label: 'Audio', desc: 'Belajar sambil jalan' },
	{ icon: 'fa-file-lines', label: 'Teks', desc: 'Bacaan mendalam' },
	{ icon: 'fa-image', label: 'Foto', desc: 'Ilustrasi materi' },
	{ icon: 'fa-circle-question', label: 'Kuis', desc: 'Uji pemahaman' },
	{ icon: 'fa-pen-to-square', label: 'Tugas', desc: 'Dinilai instruktur' }
];

export interface TentangStat {
	value: string;
	label: string;
	desc: string;
}

/** Angka struktural faktual — tanpa klaim jumlah pengguna/kursus. */
export const TENTANG_STATS: TentangStat[] = [
	{ value: '3', label: 'Portal peran', desc: 'Peserta, instruktur, admin' },
	{ value: '4', label: 'Langkah belajar', desc: 'Pilih hingga sertifikat' },
	{ value: '1', label: 'Sertifikat per modul', desc: 'Terbit per modul tuntas' }
];
