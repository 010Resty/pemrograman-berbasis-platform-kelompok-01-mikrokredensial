export type CoursePeriod = 'upcoming' | 'ongoing' | 'ended';

export interface CourseMeta {
	rating: number;
	reviews: number;
	students: number;
	price: string;
	/** Periode batch pelatihan */
	period: CoursePeriod;
	/** Bulan mulai batch (wajib untuk periode akan datang), contoh: "Desember 2026" */
	startMonth?: string;
	outcomes: string[];
	requirements: string[];
}

export function periodLabel(meta: Pick<CourseMeta, 'period' | 'startMonth'>): string {
	if (meta.period === 'upcoming') return `Akan Datang · Mulai ${meta.startMonth ?? ''}`.trim();
	if (meta.period === 'ongoing') return 'Sedang Berjalan';
	return 'Periode Lewat';
}

export function periodBadgeClass(period: CoursePeriod): string {
	if (period === 'upcoming') return 'bg-amber-500 text-white';
	if (period === 'ongoing') return 'bg-emerald-600 text-white';
	return 'bg-slate-500 text-white';
}

export function periodIcon(period: CoursePeriod): string {
	if (period === 'upcoming') return 'fa-calendar-plus';
	if (period === 'ongoing') return 'fa-circle-play';
	return 'fa-clock-rotate-left';
}

const META: Record<number, CourseMeta> = {
	1: {
		rating: 4.8,
		reviews: 1240,
		students: 2450,
		price: 'GRATIS',
		period: 'ongoing',
		outcomes: [
			'Membangun halaman web semantik yang aksesibel',
			'Membuat layout responsif dengan Flexbox, Grid, dan Tailwind',
			'Mengembangkan interaksi dinamis dengan JavaScript dan Fetch API',
			'Men-deploy aplikasi ke hosting production'
		],
		requirements: [
			'Laptop/komputer dengan browser modern',
			'Kemauan praktik rutin minimal 30 menit/hari',
			'Tidak perlu pengalaman coding sebelumnya'
		]
	},
	2: {
		rating: 4.7,
		reviews: 860,
		students: 1920,
		price: 'GRATIS',
		period: 'ongoing',
		outcomes: [
			'Merancang skema basis data ternormalisasi',
			'Menulis query SELECT, JOIN, dan agregasi multi-tabel',
			'Menggunakan subquery, CTE, dan window function',
			'Menganalisis dan mengoptimasi performa query'
		],
		requirements: [
			'Logika dasar pemrograman',
			'Akses ke DB Browser / psql / MySQL',
			'Terbiasa membaca dokumentasi teknis'
		]
	},
	3: {
		rating: 4.6,
		reviews: 540,
		students: 1310,
		price: 'GRATIS',
		period: 'upcoming',
		startMonth: 'Desember 2026',
		outcomes: [
			'Memahami model OSI dan TCP/IP secara praktis',
			'Melakukan subnetting IPv4 dan VLSM',
			'Mengonfigurasi static routing dan layanan DHCP/DNS',
			'Melakukan troubleshooting dengan ping, traceroute, dan Wireshark'
		],
		requirements: [
			'Pengetahuan dasar komputer',
			'Aplikasi simulasi Packet Tracer (gratis)',
			'Tidak perlu perangkat jaringan fisik'
		]
	},
	4: {
		rating: 4.7,
		reviews: 620,
		students: 980,
		price: 'GRATIS',
		period: 'upcoming',
		startMonth: 'Januari 2027',
		outcomes: [
			'Memahami CIA triad dan lanskap ancaman siber',
			'Mengenali dan mencegah serangan rekayasa sosial',
			'Melakukan hardening OS, MFA, dan firewall dasar',
			'Menyusun langkah respons insiden keamanan'
		],
		requirements: [
			'Pengguna komputer aktif sehari-hari',
			'Rasa ingin tahu tentang keamanan digital',
			'Tidak perlu latar belakang IT'
		]
	},
	5: {
		rating: 4.9,
		reviews: 980,
		students: 1740,
		price: 'GRATIS',
		period: 'ongoing',
		outcomes: [
			'Membersihkan dan mengeksplorasi dataset dengan Pandas',
			'Melatih model regresi dan klasifikasi',
			'Mengevaluasi model dengan metrik yang tepat',
			'Menyelesaikan proyek prediksi churn end-to-end'
		],
		requirements: [
			'Python dasar (variabel, fungsi, list)',
			'Matematika SMA (aljabar & statistika dasar)',
			'Akun Google Colab (gratis)'
		]
	},
	6: {
		rating: 4.5,
		reviews: 410,
		students: 860,
		price: 'GRATIS',
		period: 'ended',
		outcomes: [
			'Memahami kernel, proses, dan scheduling',
			'Mengelola permission dan filesystem Linux',
			'Menulis skrip Bash untuk automasi',
			'Melakukan administrasi server dasar'
		],
		requirements: [
			'Terbiasa memakai terminal/command line',
			'VM atau WSL untuk praktik Linux',
			'Logika dasar pemrograman'
		]
	},
	7: {
		rating: 4.9,
		reviews: 2310,
		students: 5840,
		price: 'GRATIS',
		period: 'ongoing',
		outcomes: [
			'Menyelesaikan 161 materi dalam 8 modul dan 37 sub-modul kompleks',
			'Membangun aplikasi full-stack aksesibel dari frontend hingga backend',
			'Mengelola database, testing, dan deployment CI/CD',
			'Menyelesaikan capstone dan portofolio siap kerja'
		],
		requirements: [
			'Laptop dan internet stabil',
			'Komitmen 8–10 jam/minggu selama 16 minggu',
			'Tidak perlu pengalaman sebelumnya'
		]
	},
	8: {
		rating: 4.9,
		reviews: 356,
		students: 418,
		price: 'Rp349.000',
		period: 'ongoing',
		outcomes: [
			'Merumuskan pertanyaan bisnis menjadi rencana analisis',
			'Membersihkan dan mengagregasi data dengan Python dan Pandas',
			'Memilih visualisasi yang tepat untuk setiap insight',
			'Membangun dashboard Streamlit dan mempresentasikan cerita data'
		],
		requirements: [
			'Logika dasar dan terbiasa memakai spreadsheet',
			'Akun Google Colab (gratis)',
			'Komitmen 5–6 jam/minggu selama 6 minggu'
		]
	}
};

const FALLBACK: CourseMeta = {
	rating: 4.5,
	reviews: 100,
	students: 500,
	price: 'GRATIS',
	period: 'ongoing',
	outcomes: [
		'Memahami konsep inti kursus',
		'Mempraktikkan studi kasus nyata',
		'Menyelesaikan proyek akhir'
	],
	requirements: ['Komitmen belajar mandiri', 'Perangkat komputer dan internet']
};

export function getCourseMeta(id: number): CourseMeta {
	return META[id] ?? FALLBACK;
}
