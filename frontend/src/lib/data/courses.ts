export type CourseStatus = 'in-progress' | 'completed' | 'not-started';

export type MaterialType =
	| 'materi'
	| 'tugas'
	| 'kuis'
	| 'video'
	| 'bacaan'
	| 'audio'
	| 'foto';

/** Tipe yang ditawarkan ke instruktur saat membuat materi baru. */
export const INSTRUCTOR_MATERIAL_TYPES = ['materi', 'tugas', 'kuis'] as const;
export type InstructorMaterialType = (typeof INSTRUCTOR_MATERIAL_TYPES)[number];

/**
 * Normalisasi tipe lama (video/bacaan/audio/foto) ke model 3-tipe:
 * - kuis → kuis, tugas → tugas
 * - selain itu (video/bacaan/audio/foto/materi) → materi
 */
export function normalizeMaterialType(t: string): InstructorMaterialType {
	if (t === 'kuis') return 'kuis';
	if (t === 'tugas') return 'tugas';
	return 'materi';
}

export function materialTypeLabel(t: string): string {
	const n = normalizeMaterialType(t);
	if (n === 'kuis') return 'Kuis';
	if (n === 'tugas') return 'Tugas';
	return 'Materi';
}

export function materialTypeIcon(t: string): string {
	const n = normalizeMaterialType(t);
	if (n === 'kuis') return 'fa-circle-question text-amber-600';
	if (n === 'tugas') return 'fa-pen-to-square text-violet-600';
	return 'fa-book-open text-emerald-600';
}

export function materialActionLabel(t: string): string {
	const n = normalizeMaterialType(t);
	if (n === 'kuis') return 'Kerjakan';
	if (n === 'tugas') return 'Kumpulkan';
	return 'Pelajari';
}

export interface Material {
	id: string;
	title: string;
	type: MaterialType;
	duration: string;
	completed: boolean;
}

/**
 * ATOMIC HIERARCHY
 * Pelatihan (Course) → Modul (CourseModule) → Sub-Modul (SubModule) → Materi (Material)
 *
 * `materials` pada modul dipertahankan sebagai flatten dari semua sub-modul
 * agar kode lama (progress, locking, instruktur) tetap kompatibel.
 */
export interface SubModule {
	id: string;
	title: string;
	description: string;
	materials: Material[];
}

export interface CourseModule {
	id: string;
	title: string;
	description: string;
	/** Flatten semua materi dari sub-modul — untuk kompatibilitas mundur. */
	materials: Material[];
	/** Sumber kebenaran hierarki. Opsional agar draf lama tetap valid. */
	subModules?: SubModule[];
}

export interface Course {
	id: number;
	title: string;
	category: string;
	instructor: string;
	image: string;
	description: string;
	duration: string;
	level: string;
	progress: number;
	totalMaterials: number;
	completedMaterials: number;
	status: CourseStatus;
	lastAccessed: string;
	modules: CourseModule[];
}

/** Input ringkas untuk mendefinisikan satu sub-modul di dalam `mod()`. */
export interface SubModuleInput {
	title: string;
	description: string;
	materials: Array<Omit<Material, 'id'>>;
}

function mod(
	courseId: number,
	index: number,
	title: string,
	description: string,
	subs: SubModuleInput[]
): CourseModule {
	// Counter global per modul agar ID materi tetap stabil (m{course}-{mod}-mat{n}),
	// sehingga override di material-details.ts tidak rusak saat migrasi ke hierarki.
	let counter = 1;
	const subModules: SubModule[] = subs.map((s, si) => ({
		id: `m${courseId}-${index}-sub${si + 1}`,
		title: s.title,
		description: s.description,
		materials: s.materials.map((m) => ({ ...m, id: `m${courseId}-${index}-mat${counter++}` }))
	}));
	return {
		id: `m${courseId}-${index}`,
		title,
		description,
		materials: subModules.flatMap((s) => s.materials),
		subModules
	};
}

export const courses: Course[] = [
	{
		id: 1,
		title: 'Pengembangan Web Frontend',
		category: 'Pengembangan Web',
		instructor: 'Kevin Perry',
		image:
			'https://images.unsplash.com/photo-1531403009284-440f080d1e12?auto=format&fit=crop&w=600&q=80',
		description:
			'Kuasai HTML, CSS, JavaScript, dan framework modern untuk membangun antarmuka web yang responsif dan aksesibel.',
		duration: '8 Minggu',
		level: 'Pemula',
		progress: 75,
		totalMaterials: 12,
		completedMaterials: 9,
		status: 'in-progress',
		lastAccessed: 'Kemarin',
		modules: [
			mod(
				1,
				1,
				'Dasar HTML & Struktur Web',
				'Modul ini menjadi fondasi seluruh perjalanan frontend. Kamu akan memahami cara kerja dokumen HTML5 — mulai dari elemen semantik seperti header, main, section, dan footer, hingga formulir yang aksesibel dengan validasi bawaan browser. Di akhir modul, kamu mampu menyusun struktur halaman yang rapi, mudah dibaca screen reader, dan siap diberi gaya dengan CSS.',
				[
					{
						title: 'Struktur & Semantik',
						description:
							'Sub-modul ini membahas elemen-elemen semantik HTML5 dan kapan menggunakannya: landmark ARIA, hierarki heading yang benar, serta atribut form seperti required, pattern, dan type. Kamu juga akan melihat bagaimana browser memvalidasi input secara bawaan, sehingga form tetap ramah pengguna bahkan tanpa JavaScript.',
						materials: [
							{ title: 'Pengenalan HTML5', type: 'video', duration: '18 mnt', completed: true },
							{
								title: 'Form & Validasi Native',
								type: 'video',
								duration: '24 mnt',
								completed: true
							}
						]
					},
					{
						title: 'Praktik Terpandu',
						description:
							'Saatnya mempraktikkan teori lewat latihan terpandu membangun landing page satu layar hanya dengan HTML semantik. Kamu akan menyusun kerangka header–main–footer, menambahkan section dengan heading berurutan, dan membuat form kontak yang aksesibel — lalu memvalidasi hasilnya dengan pemeriksa HTML hingga bebas error.',
						materials: [
							{
								title: 'Latihan: Landing Page Semantik',
								type: 'tugas',
								duration: '60 mnt',
								completed: true
							}
						]
					}
				]
			),
			mod(
				1,
				2,
				'CSS Modern & Layout Responsif',
				'Flexbox, Grid, dan Tailwind untuk layout profesional.',
				[
					{
						title: 'Layout Inti',
						description: 'Kapan memakai Flexbox vs Grid dengan contoh nyata.',
						materials: [
							{
								title: 'Flexbox & Grid Mendalam',
								type: 'video',
								duration: '32 mnt',
								completed: true
							}
						]
					},
					{
						title: 'Responsif & Evaluasi',
						description: 'Pola mobile-first dan kuis pemahaman layout.',
						materials: [
							{
								title: 'Desain Responsif Mobile-First',
								type: 'bacaan',
								duration: '20 mnt',
								completed: true
							},
							{ title: 'Kuis CSS Layout', type: 'kuis', duration: '15 mnt', completed: true }
						]
					}
				]
			),
			mod(1, 3, 'JavaScript Interaktif', 'DOM, event, dan fetch API untuk aplikasi dinamis.', [
				{
					title: 'DOM & Data',
					description: 'Event handling dan pengambilan data asinkron.',
					materials: [
						{ title: 'DOM & Event Handling', type: 'video', duration: '28 mnt', completed: true },
						{ title: 'Async & Fetch API', type: 'video', duration: '30 mnt', completed: true }
					]
				},
				{
					title: 'Proyek Mini',
					description: 'Terapkan konsep dalam galeri interaktif.',
					materials: [
						{
							title: 'Proyek: Galeri Interaktif',
							type: 'tugas',
							duration: '90 mnt',
							completed: false
						}
					]
				}
			]),
			mod(1, 4, 'Framework & Deployment', 'Komponen modern dan deploy ke production.', [
				{
					title: 'Komponen & Build',
					description: 'Pola komponen, state, dan alur build.',
					materials: [
						{
							title: 'Konsep Komponen & State',
							type: 'video',
							duration: '26 mnt',
							completed: false
						},
						{
							title: 'Build & Deploy ke Hosting',
							type: 'bacaan',
							duration: '18 mnt',
							completed: false
						}
					]
				},
				{
					title: 'Evaluasi Akhir',
					description: 'Ujian pemahaman menyeluruh modul framework.',
					materials: [
						{ title: 'Ujian Akhir Frontend', type: 'kuis', duration: '45 mnt', completed: false }
					]
				}
			])
		]
	},
	{
		id: 2,
		title: 'Basis Data & SQL',
		category: 'Basis Data',
		instructor: 'Max Alexix',
		image:
			'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=600&q=80',
		description:
			'Pelajari perancangan skema, query SQL lanjutan, dan optimasi performa basis data relasional.',
		duration: '6 Minggu',
		level: 'Menengah',
		progress: 100,
		totalMaterials: 10,
		completedMaterials: 10,
		status: 'completed',
		lastAccessed: '28 Jul 2026',
		modules: [
			mod(2, 1, 'Konsep & Perancangan Basis Data', 'ERD, normalisasi, dan relasi antar tabel.', [
				{
					title: 'Teori Dasar',
					description: 'DBMS, model data, dan bentuk normal.',
					materials: [
						{ title: 'Pengantar DBMS', type: 'video', duration: '20 mnt', completed: true },
						{ title: 'Normalisasi 1NF–3NF', type: 'bacaan', duration: '25 mnt', completed: true }
					]
				},
				{
					title: 'Praktik ERD',
					description: 'Merancang skema toko online.',
					materials: [
						{
							title: 'Latihan: Desain ERD Toko Online',
							type: 'tugas',
							duration: '60 mnt',
							completed: true
						}
					]
				}
			]),
			mod(2, 2, 'SQL Dasar hingga Join', 'SELECT, filter, agregasi, dan join multi-tabel.', [
				{
					title: 'Query Inti',
					description: 'CRUD, filter, dan join antar tabel.',
					materials: [
						{ title: 'CRUD & Filtering', type: 'video', duration: '30 mnt', completed: true },
						{ title: 'INNER, LEFT & FULL Join', type: 'video', duration: '28 mnt', completed: true }
					]
				},
				{
					title: 'Latihan Terpandu',
					description: 'Kuis pemahaman query menengah.',
					materials: [
						{ title: 'Kuis Query Menengah', type: 'kuis', duration: '20 mnt', completed: true }
					]
				}
			]),
			mod(2, 3, 'SQL Lanjutan & Optimasi', 'Subquery, window function, index, dan tuning.', [
				{
					title: 'Query Lanjutan',
					description: 'CTE, subquery, dan strategi index.',
					materials: [
						{ title: 'Subquery & CTE', type: 'video', duration: '26 mnt', completed: true },
						{ title: 'Index & Explain Plan', type: 'bacaan', duration: '22 mnt', completed: true }
					]
				},
				{
					title: 'Studi Kasus & Ujian',
					description: 'Optimasi dataset besar dan ujian akhir.',
					materials: [
						{
							title: 'Studi Kasus: Optimasi 1 Juta Baris',
							type: 'tugas',
							duration: '75 mnt',
							completed: true
						},
						{ title: 'Ujian Akhir SQL', type: 'kuis', duration: '40 mnt', completed: true }
					]
				}
			])
		]
	},
	{
		id: 3,
		title: 'Jaringan Komputer Dasar',
		category: 'Jaringan',
		instructor: 'Sarah Johnson',
		image:
			'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=600&q=80',
		description:
			'Memahami model OSI/TCP-IP, subnetting, routing dasar, dan troubleshooting jaringan.',
		duration: '6 Minggu',
		level: 'Pemula',
		progress: 45,
		totalMaterials: 8,
		completedMaterials: 4,
		status: 'in-progress',
		lastAccessed: '2 hari lalu',
		modules: [
			mod(3, 1, 'Fondasi Jaringan', 'Perangkat, topologi, dan model OSI vs TCP/IP.', [
				{
					title: 'Perangkat & Model',
					description: 'Topologi, OSI layer, dan TCP/IP.',
					materials: [
						{ title: 'Perangkat & Topologi', type: 'video', duration: '22 mnt', completed: true },
						{ title: 'OSI & TCP/IP Layer', type: 'bacaan', duration: '18 mnt', completed: true }
					]
				},
				{
					title: 'Evaluasi Konsep',
					description: 'Kuis pemahaman fondasi jaringan.',
					materials: [
						{ title: 'Kuis Konsep Dasar', type: 'kuis', duration: '15 mnt', completed: true }
					]
				}
			]),
			mod(3, 2, 'IP Addressing & Subnetting', 'IPv4, CIDR, dan perhitungan subnet praktis.', [
				{
					title: 'Pengalamatan',
					description: 'Notasi CIDR dan pembagian alamat.',
					materials: [
						{ title: 'IPv4 & CIDR Notation', type: 'video', duration: '30 mnt', completed: true }
					]
				},
				{
					title: 'Praktik & Simulasi',
					description: 'Latihan VLSM dan simulasi visual.',
					materials: [
						{
							title: 'Latihan Subnetting VLSM',
							type: 'tugas',
							duration: '60 mnt',
							completed: false
						},
						{ title: 'Simulasi Packet Tracer', type: 'foto', duration: '25 mnt', completed: false }
					]
				}
			]),
			mod(3, 3, 'Routing & Troubleshooting', 'Static routing, DHCP/DNS, dan perintah diagnostik.', [
				{
					title: 'Routing Dasar',
					description: 'Konsep static routing dan layanan jaringan.',
					materials: [
						{ title: 'Static Routing Dasar', type: 'video', duration: '24 mnt', completed: false }
					]
				},
				{
					title: 'Diagnostik',
					description: 'Alat uji konektivitas dan analisis paket.',
					materials: [
						{
							title: 'Ping, Traceroute & Wireshark',
							type: 'bacaan',
							duration: '20 mnt',
							completed: false
						}
					]
				}
			])
		]
	},
	{
		id: 4,
		title: 'Keamanan Siber',
		category: 'Keamanan',
		instructor: 'Rian Pratama',
		image:
			'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=600&q=80',
		description:
			'Prinsip CIA triad, threat modeling, hardening sistem, dan respons insiden untuk pemula.',
		duration: '5 Minggu',
		level: 'Pemula',
		progress: 0,
		totalMaterials: 6,
		completedMaterials: 0,
		status: 'not-started',
		lastAccessed: 'Belum dimulai',
		modules: [
			mod(4, 1, 'Pengantar Keamanan Siber', 'Lanskap ancaman dan prinsip pertahanan berlapis.', [
				{
					title: 'Konsep Ancaman',
					description: 'CIA triad dan lanskap ancaman modern.',
					materials: [
						{
							title: 'CIA Triad & Threat Landscape',
							type: 'video',
							duration: '20 mnt',
							completed: false
						}
					]
				},
				{
					title: 'Rekayasa Sosial',
					description: 'Mengenali serangan berbasis manusia.',
					materials: [
						{
							title: 'Social Engineering Awareness',
							type: 'audio',
							duration: '15 mnt',
							completed: false
						}
					]
				}
			]),
			mod(4, 2, 'Hardening & Praktikum Aman', 'Password policy, MFA, firewall, dan backup.', [
				{
					title: 'Proteksi Sistem',
					description: 'Hardening OS dan konfigurasi firewall.',
					materials: [
						{
							title: 'Hardening OS & Aplikasi',
							type: 'video',
							duration: '28 mnt',
							completed: false
						},
						{
							title: 'Lab: Konfigurasi Firewall',
							type: 'tugas',
							duration: '60 mnt',
							completed: false
						}
					]
				},
				{
					title: 'Evaluasi & Simulasi',
					description: 'Kuis fundamental dan simulasi insiden.',
					materials: [
						{
							title: 'Kuis Fundamental Security',
							type: 'kuis',
							duration: '15 mnt',
							completed: false
						},
						{
							title: 'Simulasi Respons Insiden',
							type: 'video',
							duration: '22 mnt',
							completed: false
						}
					]
				}
			])
		]
	},
	{
		id: 5,
		title: 'Machine Learning Dasar',
		category: 'AI & Data',
		instructor: 'Kevin Perry',
		image:
			'https://images.unsplash.com/photo-1555949963-aa79dcee981c?auto=format&fit=crop&w=600&q=80',
		description:
			'Dari preprocessing data hingga regresi, klasifikasi, dan evaluasi model dengan Python.',
		duration: '10 Minggu',
		level: 'Menengah',
		progress: 30,
		totalMaterials: 14,
		completedMaterials: 4,
		status: 'in-progress',
		lastAccessed: '3 hari lalu',
		modules: [
			mod(5, 1, 'Python untuk Data', 'NumPy, Pandas, dan visualisasi eksploratif.', [
				{
					title: 'Setup & Pandas',
					description: 'Alur kerja Jupyter dan pembersihan data.',
					materials: [
						{
							title: 'Setup & Jupyter Workflow',
							type: 'video',
							duration: '18 mnt',
							completed: true
						},
						{
							title: 'Pandas: Cleaning Dataset',
							type: 'video',
							duration: '32 mnt',
							completed: true
						}
					]
				},
				{
					title: 'Eksplorasi Data',
					description: 'Latihan EDA pada dataset penjualan.',
					materials: [
						{ title: 'Latihan EDA Penjualan', type: 'tugas', duration: '75 mnt', completed: true }
					]
				}
			]),
			mod(5, 2, 'Regresi & Klasifikasi', 'Model supervised learning pertama Anda.', [
				{
					title: 'Model Dasar',
					description: 'Regresi linear/logistik dan tree-based model.',
					materials: [
						{
							title: 'Linear & Logistic Regression',
							type: 'video',
							duration: '30 mnt',
							completed: true
						},
						{
							title: 'Decision Tree & Random Forest',
							type: 'video',
							duration: '28 mnt',
							completed: false
						}
					]
				},
				{
					title: 'Evaluasi Model',
					description: 'Kuis metrik evaluasi dan validasi.',
					materials: [
						{ title: 'Kuis Evaluasi Model', type: 'kuis', duration: '20 mnt', completed: false }
					]
				}
			]),
			mod(5, 3, 'Validasi & Proyek Akhir', 'Cross-validation, tuning, dan deployment sederhana.', [
				{
					title: 'Proyek Inti',
					description: 'Validasi silang dan prediksi churn.',
					materials: [
						{
							title: 'Cross-Validation & Tuning',
							type: 'video',
							duration: '26 mnt',
							completed: false
						},
						{
							title: 'Proyek: Prediksi Churn',
							type: 'tugas',
							duration: '120 mnt',
							completed: false
						},
						{ title: 'Presentasi Model', type: 'bacaan', duration: '15 mnt', completed: false }
					]
				},
				{
					title: 'Evaluasi Sejawat',
					description: 'Ujian akhir dan telaah proyek teman.',
					materials: [
						{ title: 'Ujian Akhir ML Dasar', type: 'kuis', duration: '45 mnt', completed: false },
						{ title: 'Peer Review Proyek', type: 'tugas', duration: '30 mnt', completed: false }
					]
				},
				{
					title: 'Penutup & Roadmap',
					description: 'Langkah lanjut menuju deep learning dan sertifikasi.',
					materials: [
						{
							title: 'Next Step: Deep Learning',
							type: 'bacaan',
							duration: '12 mnt',
							completed: false
						},
						{
							title: 'Sertifikasi Siap Kerja',
							type: 'video',
							duration: '10 mnt',
							completed: false
						},
						{ title: 'Refleksi & Roadmap', type: 'bacaan', duration: '10 mnt', completed: false }
					]
				}
			])
		]
	},
	{
		id: 6,
		title: 'Sistem Operasi',
		category: 'Infrastruktur',
		instructor: 'Max Alexix',
		image:
			'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=600&q=80',
		description:
			'Proses, memori, filesystem Linux, scripting shell, dan administrasi server dasar.',
		duration: '6 Minggu',
		level: 'Menengah',
		progress: 100,
		totalMaterials: 8,
		completedMaterials: 8,
		status: 'completed',
		lastAccessed: '10 Jul 2026',
		modules: [
			mod(6, 1, 'Arsitektur & Proses', 'Kernel, scheduling, dan manajemen proses.', [
				{
					title: 'Kernel & Proses',
					description: 'Ruang kernel vs user dan monitoring proses.',
					materials: [
						{ title: 'Kernel vs User Space', type: 'video', duration: '20 mnt', completed: true },
						{
							title: 'Monitoring Proses Linux',
							type: 'bacaan',
							duration: '15 mnt',
							completed: true
						}
					]
				},
				{
					title: 'Evaluasi',
					description: 'Kuis manajemen proses.',
					materials: [
						{ title: 'Kuis Manajemen Proses', type: 'kuis', duration: '15 mnt', completed: true }
					]
				}
			]),
			mod(6, 2, 'Filesystem & Shell', 'Permission, scripting bash, dan automasi tugas.', [
				{
					title: 'Izin & Skrip',
					description: 'Ownership file dan automasi Bash.',
					materials: [
						{ title: 'Permission & Ownership', type: 'video', duration: '24 mnt', completed: true },
						{ title: 'Bash Scripting Praktis', type: 'video', duration: '30 mnt', completed: true },
						{ title: 'Tugas: Automasi Backup', type: 'tugas', duration: '60 mnt', completed: true }
					]
				},
				{
					title: 'Administrasi & Ujian',
					description: 'Server mini dan ujian akhir.',
					materials: [
						{
							title: 'Administrasi Server Mini',
							type: 'video',
							duration: '22 mnt',
							completed: true
						},
						{
							title: 'Ujian Akhir Sistem Operasi',
							type: 'kuis',
							duration: '40 mnt',
							completed: true
						}
					]
				}
			])
		]
	},
	{
		id: 7,
		title: 'Full-Stack Web Development Bootcamp',
		category: 'Pengembangan Web',
		instructor: 'Tim Aristoteles',
		image:
			'https://images.unsplash.com/photo-1542831371-29b0f74f9713?auto=format&fit=crop&w=600&q=80',
		description:
			'Showcase pelatihan kompleks: 8 modul → 37 sub-modul → 161 materi. Dari setup, frontend, backend, DevOps, hingga capstone dan persiapan kerja.',
		duration: '16 Minggu',
		level: 'Pemula–Lanjutan',
		progress: 28,
		totalMaterials: 161,
		completedMaterials: 45,
		status: 'in-progress',
		lastAccessed: 'Hari ini',
		modules: [
			mod(
				7,
				1,
				'Fondasi & Alur Kerja Developer',
				'Mindset bootcamp, Git, internet, dan terminal.',
				[
					{
						title: 'Setup & Mindset Bootcamp',
						description: 'Peta 16 minggu, instalasi, dan cara belajar efektif.',
						materials: [
							{
								title: 'Selamat Datang & Peta Bootcamp',
								type: 'video',
								duration: '12 mnt',
								completed: true
							},
							{
								title: 'Setup VS Code, Node & WSL',
								type: 'video',
								duration: '25 mnt',
								completed: true
							},
							{
								title: 'Panduan Survival Belajar 16 Minggu',
								type: 'bacaan',
								duration: '15 mnt',
								completed: true
							},
							{
								title: 'Kuis Kesiapan Bootcamp',
								type: 'kuis',
								duration: '10 mnt',
								completed: true
							},
							{
								title: 'Tugas: Foto Setup Meja Belajarmu',
								type: 'tugas',
								duration: '30 mnt',
								completed: true
							}
						]
					},
					{
						title: 'Git & GitHub Kolaboratif',
						description: 'Version control untuk kerja tim profesional.',
						materials: [
							{
								title: 'Git Init, Add, Commit',
								type: 'video',
								duration: '22 mnt',
								completed: true
							},
							{
								title: 'Branching & Merge Conflict',
								type: 'video',
								duration: '28 mnt',
								completed: true
							},
							{
								title: 'Pull Request & Code Review',
								type: 'bacaan',
								duration: '18 mnt',
								completed: true
							},
							{
								title: 'Cerita Merge Conflict Horor',
								type: 'audio',
								duration: '14 mnt',
								completed: true
							},
							{
								title: 'Tugas: Repo Portofolio Pertama',
								type: 'tugas',
								duration: '60 mnt',
								completed: true
							}
						]
					},
					{
						title: 'Cara Internet Bekerja',
						description: 'DNS, HTTP, browser, dan DevTools.',
						materials: [
							{
								title: 'DNS, HTTP & Browser Rendering',
								type: 'video',
								duration: '20 mnt',
								completed: true
							},
							{
								title: 'DevTools Network Deep-Dive',
								type: 'video',
								duration: '18 mnt',
								completed: true
							},
							{
								title: 'Status Code & Caching',
								type: 'bacaan',
								duration: '12 mnt',
								completed: true
							},
							{ title: 'Kuis Fondasi Web', type: 'kuis', duration: '15 mnt', completed: true }
						]
					},
					{
						title: 'Terminal & Produktivitas',
						description: 'CLI esensial dan automasi harian.',
						materials: [
							{
								title: 'CLI Esensial & Shortcuts',
								type: 'video',
								duration: '19 mnt',
								completed: true
							},
							{
								title: 'Package Manager & Environment',
								type: 'bacaan',
								duration: '14 mnt',
								completed: true
							},
							{
								title: 'Galeri Shortcut Terminal',
								type: 'foto',
								duration: '10 mnt',
								completed: true
							},
							{
								title: 'Tugas: Automasi Skrip Harian',
								type: 'tugas',
								duration: '45 mnt',
								completed: true
							}
						]
					}
				]
			),
			mod(7, 2, 'HTML Semantik & Form Aksesibel', 'Struktur dokumen, media, form, SEO dasar.', [
				{
					title: 'Struktur Dokumen Modern',
					description: 'Semantik HTML5 dan landmark ARIA.',
					materials: [
						{ title: 'Anatomi HTML5 Modern', type: 'video', duration: '18 mnt', completed: true },
						{
							title: 'Header, Main, Section, Footer',
							type: 'video',
							duration: '21 mnt',
							completed: true
						},
						{
							title: 'Heading & Landmark ARIA',
							type: 'bacaan',
							duration: '16 mnt',
							completed: true
						},
						{
							title: 'Pengalaman Screen Reader',
							type: 'audio',
							duration: '12 mnt',
							completed: true
						},
						{ title: 'Kuis Semantik', type: 'kuis', duration: '15 mnt', completed: true }
					]
				},
				{
					title: 'Multimedia & Tabel Data',
					description: 'Gambar responsif, video, dan tabel aksesibel.',
					materials: [
						{
							title: 'Gambar Responsif & Picture',
							type: 'video',
							duration: '20 mnt',
							completed: true
						},
						{
							title: 'Video, Audio & Caption',
							type: 'bacaan',
							duration: '14 mnt',
							completed: true
						},
						{ title: 'Galeri Pola Media Web', type: 'foto', duration: '12 mnt', completed: true },
						{
							title: 'Tugas: Halaman Galeri Aksesibel',
							type: 'tugas',
							duration: '60 mnt',
							completed: true
						}
					]
				},
				{
					title: 'Form Lanjutan & Validasi',
					description: 'Input modern, error message, multi-step.',
					materials: [
						{
							title: 'Input Types & Validasi Native',
							type: 'video',
							duration: '24 mnt',
							completed: true
						},
						{
							title: 'Label, Fieldset & Error Message',
							type: 'video',
							duration: '22 mnt',
							completed: true
						},
						{ title: 'UX Form Anti Gagal', type: 'bacaan', duration: '18 mnt', completed: true },
						{ title: 'Kuis Form Aksesibel', type: 'kuis', duration: '12 mnt', completed: true },
						{
							title: 'Tugas: Form Pendaftaran Multi-Step',
							type: 'tugas',
							duration: '90 mnt',
							completed: true
						}
					]
				},
				{
					title: 'SEO Dasar & Publikasi',
					description: 'Meta, Lighthouse, dan checklist go-live.',
					materials: [
						{ title: 'Meta, OG & Sitemap', type: 'video', duration: '17 mnt', completed: true },
						{
							title: 'Audit Lighthouse & A11y',
							type: 'video',
							duration: '19 mnt',
							completed: true
						},
						{
							title: 'Checklist Go-Live Halaman Statis',
							type: 'bacaan',
							duration: '10 mnt',
							completed: true
						},
						{ title: 'Ujian Modul HTML', type: 'kuis', duration: '30 mnt', completed: true }
					]
				}
			]),
			mod(7, 3, 'CSS Modern & Desain Responsif', 'Cascade, Flexbox, Grid, Tailwind, animasi.', [
				{
					title: 'Selektor, Cascade & Theming',
					description: 'Specificity, layers, dan custom properties.',
					materials: [
						{
							title: 'Specificity & Cascade Layers',
							type: 'video',
							duration: '26 mnt',
							completed: true
						},
						{
							title: 'Custom Properties & Dark Mode',
							type: 'video',
							duration: '23 mnt',
							completed: true
						},
						{ title: 'BEM & Arsitektur CSS', type: 'bacaan', duration: '16 mnt', completed: true },
						{ title: 'Kuis Cascade', type: 'kuis', duration: '12 mnt', completed: true }
					]
				},
				{
					title: 'Flexbox & Grid Mendalam',
					description: 'Pola layout dashboard, galeri, navbar.',
					materials: [
						{
							title: 'Flexbox: Navbar & Kartu',
							type: 'video',
							duration: '28 mnt',
							completed: true
						},
						{
							title: 'Grid: Galeri & Dashboard',
							type: 'video',
							duration: '30 mnt',
							completed: true
						},
						{
							title: 'Pola Holy Grail Modern',
							type: 'bacaan',
							duration: '14 mnt',
							completed: true
						},
						{ title: 'Galeri Layout Referensi', type: 'foto', duration: '10 mnt', completed: true },
						{
							title: 'Tugas: Klon Layout Dashboard',
							type: 'tugas',
							duration: '90 mnt',
							completed: true
						}
					]
				},
				{
					title: 'Responsif Mobile-First',
					description: 'Breakpoint, container query, fluid type.',
					materials: [
						{
							title: 'Breakpoint & Mobile-First',
							type: 'video',
							duration: '21 mnt',
							completed: false
						},
						{
							title: 'Fluid Typography dengan Clamp',
							type: 'video',
							duration: '18 mnt',
							completed: false
						},
						{
							title: 'Container Query Praktis',
							type: 'bacaan',
							duration: '15 mnt',
							completed: false
						},
						{
							title: 'Podcast: Desain di Layar Kecil',
							type: 'audio',
							duration: '13 mnt',
							completed: false
						},
						{ title: 'Kuis Responsif', type: 'kuis', duration: '12 mnt', completed: false }
					]
				},
				{
					title: 'Tailwind CSS Produktif',
					description: 'Utility-first untuk kecepatan produksi.',
					materials: [
						{ title: 'Setup Tailwind v4', type: 'video', duration: '19 mnt', completed: false },
						{
							title: 'Komponen Reusable & @apply',
							type: 'video',
							duration: '22 mnt',
							completed: false
						},
						{
							title: 'Dark Mode & Theming Tailwind',
							type: 'bacaan',
							duration: '13 mnt',
							completed: false
						},
						{
							title: 'Tugas: Redesign dengan Tailwind',
							type: 'tugas',
							duration: '75 mnt',
							completed: false
						},
						{ title: 'Kuis Utility Patterns', type: 'kuis', duration: '10 mnt', completed: false }
					]
				},
				{
					title: 'Animasi & Micro-Interaction',
					description: 'Transisi, keyframes, dan prefers-reduced-motion.',
					materials: [
						{
							title: 'Transisi & Easing Alami',
							type: 'video',
							duration: '20 mnt',
							completed: false
						},
						{
							title: 'Keyframe & Choreography',
							type: 'bacaan',
							duration: '14 mnt',
							completed: false
						},
						{ title: 'Bank Easing Curve', type: 'foto', duration: '8 mnt', completed: false },
						{ title: 'Ujian Modul CSS', type: 'kuis', duration: '35 mnt', completed: false }
					]
				}
			]),
			mod(7, 4, 'JavaScript Mendalam', 'ES modern, DOM, async, pola & optimasi.', [
				{
					title: 'ES Modern & Struktur Data',
					description: 'Destructuring, modul, Map/Set.',
					materials: [
						{
							title: 'Let, Const & Destructuring',
							type: 'video',
							duration: '22 mnt',
							completed: false
						},
						{
							title: 'Array Methods Masterclass',
							type: 'video',
							duration: '30 mnt',
							completed: false
						},
						{
							title: 'Modul ES & Import Dinamis',
							type: 'bacaan',
							duration: '16 mnt',
							completed: false
						},
						{ title: 'Kuis ES Modern', type: 'kuis', duration: '12 mnt', completed: false },
						{
							title: 'Tugas: Refactor ke ES Modern',
							type: 'tugas',
							duration: '60 mnt',
							completed: false
						}
					]
				},
				{
					title: 'DOM & Event Lanjutan',
					description: 'Delegation, keyboard, dan aksesibilitas.',
					materials: [
						{
							title: 'Event Delegation Praktis',
							type: 'video',
							duration: '24 mnt',
							completed: false
						},
						{
							title: 'Keyboard & Focus Management',
							type: 'bacaan',
							duration: '15 mnt',
							completed: false
						},
						{ title: 'Podcast: DOM Gotchas', type: 'audio', duration: '11 mnt', completed: false },
						{
							title: 'Tugas: Komponen Tab Aksesibel',
							type: 'tugas',
							duration: '70 mnt',
							completed: false
						}
					]
				},
				{
					title: 'Async, Fetch & State',
					description: 'Promise, AbortController, loading pattern.',
					materials: [
						{ title: 'Promise & Async/Await', type: 'video', duration: '26 mnt', completed: false },
						{ title: 'Fetch, Retry & Cache', type: 'video', duration: '25 mnt', completed: false },
						{
							title: 'Loading, Empty & Error State',
							type: 'bacaan',
							duration: '14 mnt',
							completed: false
						},
						{ title: 'Diagram Alur Async', type: 'foto', duration: '9 mnt', completed: false },
						{ title: 'Kuis Async', type: 'kuis', duration: '15 mnt', completed: false }
					]
				},
				{
					title: 'Pola Kode & Kualitas',
					description: 'Clean code, error handling, debugging.',
					materials: [
						{
							title: 'Clean Function & Naming',
							type: 'video',
							duration: '20 mnt',
							completed: false
						},
						{
							title: 'Debugging dengan DevTools',
							type: 'video',
							duration: '23 mnt',
							completed: false
						},
						{
							title: 'Panduan Error Handling',
							type: 'bacaan',
							duration: '13 mnt',
							completed: false
						},
						{
							title: 'Tugas: Audit Kode Teman',
							type: 'tugas',
							duration: '50 mnt',
							completed: false
						}
					]
				},
				{
					title: 'Mini Project & Ujian',
					description: 'Aplikasi catatan dengan localStorage.',
					materials: [
						{
							title: 'Brief Proyek Notes App',
							type: 'bacaan',
							duration: '10 mnt',
							completed: false
						},
						{
							title: 'Live Coding: Arsitektur Notes',
							type: 'video',
							duration: '32 mnt',
							completed: false
						},
						{
							title: 'Tugas: Notes App + Filter',
							type: 'tugas',
							duration: '120 mnt',
							completed: false
						},
						{ title: 'Ujian Modul JavaScript', type: 'kuis', duration: '40 mnt', completed: false }
					]
				}
			]),
			mod(7, 5, 'TypeScript & Frontend Framework', 'Tiping kuat, Svelte, state, dan routing.', [
				{
					title: 'TypeScript Esensial',
					description: 'Type, interface, generic, dan narrowing.',
					materials: [
						{ title: 'Type vs Interface', type: 'video', duration: '21 mnt', completed: false },
						{
							title: 'Generic & Utility Types',
							type: 'video',
							duration: '26 mnt',
							completed: false
						},
						{
							title: 'Strict Mode & Narrowing',
							type: 'bacaan',
							duration: '15 mnt',
							completed: false
						},
						{ title: 'Kuis TypeScript', type: 'kuis', duration: '12 mnt', completed: false },
						{
							title: 'Tugas: Migrasi JS ke TS',
							type: 'tugas',
							duration: '70 mnt',
							completed: false
						}
					]
				},
				{
					title: 'Berpikir Komponen (Svelte)',
					description: 'Props, event, runes $state/$derived.',
					materials: [
						{
							title: 'Runes: State & Derived',
							type: 'video',
							duration: '24 mnt',
							completed: false
						},
						{ title: 'Snippet & Slot Modern', type: 'video', duration: '19 mnt', completed: false },
						{
							title: 'Siklus Hidup & $effect',
							type: 'bacaan',
							duration: '14 mnt',
							completed: false
						},
						{
							title: 'Cerita Migrasi Svelte 4→5',
							type: 'audio',
							duration: '13 mnt',
							completed: false
						},
						{
							title: 'Tugas: Kartu Kursus Reusable',
							type: 'tugas',
							duration: '65 mnt',
							completed: false
						}
					]
				},
				{
					title: 'Routing & Data Loading',
					description: 'SvelteKit load, param, dan form action.',
					materials: [
						{ title: 'File-Based Routing', type: 'video', duration: '22 mnt', completed: false },
						{
							title: 'Load Function & Streaming',
							type: 'video',
							duration: '25 mnt',
							completed: false
						},
						{
							title: 'Form Action & Validasi',
							type: 'bacaan',
							duration: '16 mnt',
							completed: false
						},
						{ title: 'Kuis Routing', type: 'kuis', duration: '12 mnt', completed: false }
					]
				},
				{
					title: 'State Global & Aksesibilitas',
					description: 'Store, konteks, focus trap, skip link.',
					materials: [
						{ title: 'Store vs Konteks', type: 'video', duration: '20 mnt', completed: false },
						{ title: 'Fokus & Skip Link', type: 'bacaan', duration: '12 mnt', completed: false },
						{ title: 'Peta Fokus Aplikasi', type: 'foto', duration: '9 mnt', completed: false },
						{
							title: 'Tugas: Sidebar Aksesibel',
							type: 'tugas',
							duration: '60 mnt',
							completed: false
						}
					]
				},
				{
					title: 'Optimasi & Ujian Frontend',
					description: 'Bundle, lazy, dan performa.',
					materials: [
						{ title: 'Code Splitting & Lazy', type: 'video', duration: '23 mnt', completed: false },
						{ title: 'Web Vitals untuk SPA', type: 'bacaan', duration: '14 mnt', completed: false },
						{ title: 'Tugas: Audit Performa', type: 'tugas', duration: '55 mnt', completed: false },
						{
							title: 'Ulasan Sejawat Komponen',
							type: 'tugas',
							duration: '30 mnt',
							completed: false
						},
						{ title: 'Ujian Modul Frontend', type: 'kuis', duration: '40 mnt', completed: false }
					]
				}
			]),
			mod(7, 6, 'Backend, API & Autentikasi', 'Node, REST, database client, JWT, upload.', [
				{
					title: 'Node & Tooling Backend',
					description: 'Runtime, npm script, env, dan logging.',
					materials: [
						{ title: 'Anatomi Server Node', type: 'video', duration: '22 mnt', completed: false },
						{
							title: 'Env & Konfigurasi Aman',
							type: 'bacaan',
							duration: '13 mnt',
							completed: false
						},
						{
							title: 'Diagram Request Lifecycle',
							type: 'foto',
							duration: '10 mnt',
							completed: false
						},
						{ title: 'Kuis Dasar Backend', type: 'kuis', duration: '10 mnt', completed: false }
					]
				},
				{
					title: 'REST API Profesional',
					description: 'Routing, validasi, pagination, versioning.',
					materials: [
						{
							title: 'Desain Resource & Status Code',
							type: 'video',
							duration: '26 mnt',
							completed: false
						},
						{
							title: 'Validasi & Error Envelope',
							type: 'video',
							duration: '24 mnt',
							completed: false
						},
						{
							title: 'Pagination & Filtering',
							type: 'bacaan',
							duration: '15 mnt',
							completed: false
						},
						{
							title: 'Koleksi Postman Referensi',
							type: 'foto',
							duration: '8 mnt',
							completed: false
						},
						{ title: 'Tugas: CRUD Kursus API', type: 'tugas', duration: '90 mnt', completed: false }
					]
				},
				{
					title: 'Autentikasi & Otorisasi',
					description: 'JWT, refresh token, RBAC, OAuth.',
					materials: [
						{
							title: 'Password Hashing & JWT',
							type: 'video',
							duration: '27 mnt',
							completed: false
						},
						{
							title: 'Refresh Token Rotation',
							type: 'video',
							duration: '21 mnt',
							completed: false
						},
						{
							title: 'RBAC untuk Admin & Siswa',
							type: 'bacaan',
							duration: '14 mnt',
							completed: false
						},
						{ title: 'Kuis Auth Aman', type: 'kuis', duration: '15 mnt', completed: false },
						{
							title: 'Tugas: Login + Guard Route',
							type: 'tugas',
							duration: '80 mnt',
							completed: false
						}
					]
				},
				{
					title: 'Upload & File Handling',
					description: 'Multipart, storage, dan validasi file.',
					materials: [
						{ title: 'Upload Multipart Aman', type: 'video', duration: '20 mnt', completed: false },
						{
							title: 'Validasi Tipe & Ukuran',
							type: 'bacaan',
							duration: '12 mnt',
							completed: false
						},
						{
							title: 'Cerita Horor Upload Tanpa Validasi',
							type: 'audio',
							duration: '10 mnt',
							completed: false
						},
						{ title: 'Tugas: Avatar Upload', type: 'tugas', duration: '60 mnt', completed: false }
					]
				},
				{
					title: 'Dokumentasi & Ujian Backend',
					description: 'OpenAPI, rate limit, dan caching.',
					materials: [
						{ title: 'Menulis OpenAPI Spec', type: 'video', duration: '19 mnt', completed: false },
						{
							title: 'Rate Limit & Cache Header',
							type: 'bacaan',
							duration: '13 mnt',
							completed: false
						},
						{
							title: 'Tugas: Dokumentasikan API-mu',
							type: 'tugas',
							duration: '50 mnt',
							completed: false
						},
						{ title: 'Ujian Modul Backend', type: 'kuis', duration: '35 mnt', completed: false }
					]
				}
			]),
			mod(7, 7, 'Database, Testing & DevOps', 'SQL lanjut, ORM, unit test, CI/CD.', [
				{
					title: 'Data Modeling & SQL Lanjut',
					description: 'Relasi, index, dan transaksi.',
					materials: [
						{
							title: 'ERD & Normalisasi Praktis',
							type: 'video',
							duration: '24 mnt',
							completed: false
						},
						{
							title: 'Join, CTE & Window Function',
							type: 'video',
							duration: '28 mnt',
							completed: false
						},
						{
							title: 'Index & Explain Analyze',
							type: 'bacaan',
							duration: '16 mnt',
							completed: false
						},
						{ title: 'Kuis SQL Lanjut', type: 'kuis', duration: '15 mnt', completed: false },
						{ title: 'Tugas: Skema LMS Mini', type: 'tugas', duration: '75 mnt', completed: false }
					]
				},
				{
					title: 'ORM & Migrasi Aman',
					description: 'Prisma/Drizzle dan strategi migrasi.',
					materials: [
						{ title: 'Setup ORM & Seeding', type: 'video', duration: '21 mnt', completed: false },
						{
							title: 'Migrasi Tanpa Downtime',
							type: 'bacaan',
							duration: '13 mnt',
							completed: false
						},
						{ title: 'Diagram Migrasi', type: 'foto', duration: '9 mnt', completed: false },
						{
							title: 'Tugas: Migrasi Tambah Kolom',
							type: 'tugas',
							duration: '55 mnt',
							completed: false
						}
					]
				},
				{
					title: 'Testing Berlapis',
					description: 'Unit, integration, dan E2E.',
					materials: [
						{
							title: 'Unit Test Fungsi Murni',
							type: 'video',
							duration: '23 mnt',
							completed: false
						},
						{ title: 'Integration Test API', type: 'video', duration: '25 mnt', completed: false },
						{
							title: 'E2E dengan Playwright',
							type: 'bacaan',
							duration: '15 mnt',
							completed: false
						},
						{
							title: 'Podcast: Budaya Testing',
							type: 'audio',
							duration: '12 mnt',
							completed: false
						},
						{ title: 'Tugas: Coverage 80%', type: 'tugas', duration: '70 mnt', completed: false }
					]
				},
				{
					title: 'Deploy & CI/CD',
					description: 'Docker dasar, pipeline, observability.',
					materials: [
						{
							title: 'Build & Deploy Statis + API',
							type: 'video',
							duration: '22 mnt',
							completed: false
						},
						{
							title: 'Pipeline: Lint, Test, Deploy',
							type: 'video',
							duration: '20 mnt',
							completed: false
						},
						{
							title: 'Logging & Monitoring Minimal',
							type: 'bacaan',
							duration: '12 mnt',
							completed: false
						},
						{ title: 'Ujian Modul DevOps', type: 'kuis', duration: '30 mnt', completed: false }
					]
				}
			]),
			mod(7, 8, 'Capstone & Siap Kerja', 'Proyek akhir, portofolio, interview.', [
				{
					title: 'Brief & Perencanaan Capstone',
					description: 'Pilih masalah, scope, dan milestone.',
					materials: [
						{
							title: 'Memilih Ide Capstone Bernilai',
							type: 'video',
							duration: '18 mnt',
							completed: false
						},
						{
							title: 'Breakdown Milestone 4 Minggu',
							type: 'bacaan',
							duration: '14 mnt',
							completed: false
						},
						{ title: 'Contoh Board Kanban', type: 'foto', duration: '8 mnt', completed: false },
						{
							title: 'Tugas: Proposal Capstone',
							type: 'tugas',
							duration: '60 mnt',
							completed: false
						}
					]
				},
				{
					title: 'Eksekusi & Mentoring',
					description: 'Sprint mingguan dan code review.',
					materials: [
						{ title: 'Sprint 1: Auth & CRUD', type: 'video', duration: '20 mnt', completed: false },
						{
							title: 'Sprint 2: Polish & A11y',
							type: 'video',
							duration: '19 mnt',
							completed: false
						},
						{
							title: 'Template Daily Standup',
							type: 'bacaan',
							duration: '10 mnt',
							completed: false
						},
						{
							title: 'Cerita Demo Day Alumni',
							type: 'audio',
							duration: '15 mnt',
							completed: false
						},
						{ title: 'Tugas: Demo Internal', type: 'tugas', duration: '90 mnt', completed: false }
					]
				},
				{
					title: 'Portofolio & Personal Branding',
					description: 'README, CV, dan LinkedIn.',
					materials: [
						{ title: 'README yang Merekrut', type: 'video', duration: '17 mnt', completed: false },
						{ title: 'CV ATS-Friendly', type: 'bacaan', duration: '13 mnt', completed: false },
						{
							title: 'Galeri Portofolio Bagus',
							type: 'foto',
							duration: '10 mnt',
							completed: false
						},
						{
							title: 'Tugas: Publish Portofolio',
							type: 'tugas',
							duration: '60 mnt',
							completed: false
						}
					]
				},
				{
					title: 'Interview & Ujian Akhir',
					description: 'Live coding, take-home, dan refleksi.',
					materials: [
						{ title: 'Simulasi Live Coding', type: 'video', duration: '25 mnt', completed: false },
						{
							title: 'Strategi Take-Home Test',
							type: 'bacaan',
							duration: '12 mnt',
							completed: false
						},
						{ title: 'Ujian Akhir Bootcamp', type: 'kuis', duration: '60 mnt', completed: false },
						{
							title: 'Refleksi & Roadmap Lanjutan',
							type: 'bacaan',
							duration: '10 mnt',
							completed: false
						}
					]
				}
			])
		]
	},
	{
		id: 8,
		title: 'Analitik Data & Dashboard Interaktif',
		category: 'AI & Data',
		instructor: 'Rian Pratama',
		image:
			'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=600&q=80',
		description:
			'Belajar berpikir analitik, mengolah data dengan Python dan Pandas, lalu menyajikannya dalam dashboard interaktif dan cerita data yang meyakinkan.',
		duration: '6 Minggu',
		level: 'Pemula–Menengah',
		progress: 0,
		totalMaterials: 14,
		completedMaterials: 0,
		status: 'not-started',
		lastAccessed: 'Belum dimulai',
		modules: [
			mod(
				8,
				1,
				'Fondasi Analitik Data',
				'Cara berpikir analitik, metrik bisnis, dan siklus analisis data.',
				[
					{
						title: 'Berpikir Analitik',
						description: 'Metrik, dimensi, dan pertanyaan bisnis yang tajam.',
						materials: [
							{
								title: 'Apa itu Analitik Data',
								type: 'video',
								duration: '18 mnt',
								completed: false
							},
							{ title: 'Metrik vs Dimensi', type: 'bacaan', duration: '12 mnt', completed: false }
						]
					},
					{
						title: 'Siklus & Studi Kasus',
						description: 'Alur tanya–olah–saji dan latihan nalar analitik.',
						materials: [
							{
								title: 'Siklus Analisis: Tanya, Olah, Saji',
								type: 'video',
								duration: '20 mnt',
								completed: false
							},
							{ title: 'Kuis Nalar Analitik', type: 'kuis', duration: '15 mnt', completed: false },
							{
								title: 'Tugas: Rumuskan 3 Pertanyaan Bisnis',
								type: 'tugas',
								duration: '45 mnt',
								completed: false
							}
						]
					}
				]
			),
			mod(
				8,
				2,
				'Python & Pandas untuk Analisis',
				'Setup, pembersihan data, agregasi, dan visualisasi dengan Python.',
				[
					{
						title: 'Setup & Data Wrangling',
						description: 'Colab, Pandas, dan pembersihan dataset kotor.',
						materials: [
							{
								title: 'Setup Colab & Pandas',
								type: 'video',
								duration: '22 mnt',
								completed: false
							},
							{ title: 'Cleaning Data Kotor', type: 'video', duration: '28 mnt', completed: false }
						]
					},
					{
						title: 'Agregasi & Visualisasi',
						description: 'GroupBy, pivot, dan memilih grafik yang tepat.',
						materials: [
							{
								title: 'GroupBy & Pivot Table',
								type: 'video',
								duration: '24 mnt',
								completed: false
							},
							{
								title: 'Memilih Grafik yang Tepat',
								type: 'bacaan',
								duration: '14 mnt',
								completed: false
							},
							{ title: 'Kuis Pandas', type: 'kuis', duration: '15 mnt', completed: false }
						]
					}
				]
			),
			mod(
				8,
				3,
				'Dashboard & Storytelling Data',
				'Bangun dashboard Streamlit dan sajikan insight yang meyakinkan.',
				[
					{
						title: 'Dashboard Streamlit',
						description: 'Dari notebook menjadi aplikasi dashboard interaktif.',
						materials: [
							{
								title: 'Bangun Dashboard Penjualan',
								type: 'video',
								duration: '30 mnt',
								completed: false
							},
							{
								title: 'Tugas: Dashboard Mini',
								type: 'tugas',
								duration: '90 mnt',
								completed: false
							}
						]
					},
					{
						title: 'Presentasi & Ujian Akhir',
						description: 'Storytelling data dan evaluasi menyeluruh.',
						materials: [
							{
								title: 'Storytelling dengan Data',
								type: 'bacaan',
								duration: '12 mnt',
								completed: false
							},
							{
								title: 'Ujian Akhir Analitik Data',
								type: 'kuis',
								duration: '40 mnt',
								completed: false
							}
						]
					}
				]
			)
		]
	}
];

export function getCourseById(id: number): Course | undefined {
	return courses.find((c) => c.id === id);
}

/**
 * Materi index ke-i terkunci bila ada materi sebelumnya dalam modul yang sama
 * yang belum selesai. Materi pertama tiap modul selalu terbuka.
 */
export function isMaterialLocked(
	materials: Material[],
	index: number,
	isDone: (id: string) => boolean
): boolean {
	if (index <= 0) return false;
	for (let i = 0; i < index; i++) {
		if (!isDone(materials[i].id)) return true;
	}
	return false;
}

/**
 * K-07: modul bersifat independen. Peserta yang memiliki akses kursus boleh
 * membuka modul mana pun tanpa menyelesaikan modul sebelumnya.
 * Fungsi dipertahankan agar pemanggil lama tidak rusak, selalu false.
 * Penguncian berurutan tetap berlaku di dalam modul via
 * `isSubModuleLocked` / `isMaterialLocked`. Akses bayar/periode tetap
 * ditangani `paidLocked` / `periodLocked`, bukan di sini.
 */
export function isModuleLocked(
	modules: CourseModule[],
	index: number,
	isDone: (id: string) => boolean
): boolean {
	void modules;
	void index;
	void isDone;
	return false;
}

/** Ambil semua materi dalam satu modul (flatten dari sub-modul). */
export function getModuleMaterials(module: CourseModule): Material[] {
	if (module.subModules?.length) return module.subModules.flatMap((s) => s.materials);
	return module.materials;
}

/** Sub-modul index ke-i terkunci bila sub-modul sebelumnya dalam modul yang sama belum tuntas. */
export function isSubModuleLocked(
	modules: CourseModule[],
	moduleIndex: number,
	subIndex: number,
	isDone: (id: string) => boolean
): boolean {
	if (subIndex <= 0) return false;
	const subs = modules[moduleIndex]?.subModules ?? [];
	for (let i = 0; i < subIndex; i++) {
		for (const mat of subs[i]?.materials ?? []) {
			if (!isDone(mat.id)) return true;
		}
	}
	return false;
}
