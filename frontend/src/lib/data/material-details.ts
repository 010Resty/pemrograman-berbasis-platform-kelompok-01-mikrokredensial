import type { Course, Material } from './courses';

export interface QuizQuestion {
	question: string;
	options: string[];
	/** index opsi yang benar */
	answer: number;
	explanation?: string;
	/** Lampiran opsional: URL berkas server (/api/v1/files/...) */
	imageUrl?: string;
	audioUrl?: string;
	fileUrl?: string;
	fileName?: string;
}

export interface AssignmentDetail {
	brief: string;
	objectives: string[];
	steps: string[];
	deliverable: string;
	deadline: string;
}

export interface Chapter {
	time: string;
	label: string;
}

export interface MaterialDetail {
	intro?: string;
	paragraphs?: string[];
	points?: string[];
	mediaUrl?: string;
	posterUrl?: string;
	caption?: string;
	transcript?: string;
	chapters?: Chapter[];
	questions?: QuizQuestion[];
	assignment?: AssignmentDetail;
}

const SAMPLE_VIDEO = 'https://www.w3schools.com/html/mov_bbb.mp4';
const SAMPLE_AUDIO = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';

/** Konten khusus (ditulis manual) per ID materi. */
const overrides: Record<string, MaterialDetail> = {
	// ===== Kursus 1 · Modul 1 =====
	'm1-1-mat1': {
		intro: 'HTML5 adalah fondasi setiap halaman web. Di materi ini kamu memahami elemen semantik dan struktur dokumen yang benar.',
		chapters: [
			{ time: '00:00', label: 'Pembuka & tujuan pembelajaran' },
			{ time: '04:12', label: 'Elemen semantik: header, main, section, footer' },
			{ time: '11:40', label: 'Contoh: membedah struktur landing page' },
			{ time: '16:05', label: 'Rangkuman & latihan mandiri' }
		],
		mediaUrl: SAMPLE_VIDEO,
		points: ['Gunakan <main> hanya sekali per halaman', 'Heading mengikuti urutan h1 → h2 → h3', 'Alt text wajib untuk gambar informatif']
	},
	'm1-1-mat2': {
		intro: 'Form yang baik memvalidasi input tanpa JavaScript — manfaatkan atribut bawaan HTML terlebih dahulu.',
		chapters: [
			{ time: '00:00', label: 'Anatomi form yang aksesibel' },
			{ time: '07:30', label: 'Atribut required, pattern, dan type' },
			{ time: '15:20', label: 'Pesan error bawaan browser' },
			{ time: '21:00', label: 'Studi kasus: form pendaftaran' }
		],
		mediaUrl: SAMPLE_VIDEO,
		points: ['Hubungkan <label> dengan input via for + id', 'Gunakan type="email" dan type="tel" yang sesuai', 'Jangan matikan validasi bawaan tanpa pengganti']
	},
	'm1-1-mat3': {
		assignment: {
			brief: 'Bangun landing page satu layar untuk produk fiktif menggunakan HTML semantik saja (tanpa CSS). Fokus pada struktur yang benar dan aksesibel.',
			objectives: ['Menerapkan elemen semantik secara tepat', 'Menyusun hierarki heading yang logis', 'Membuat form kontak yang aksesibel'],
			steps: ['Buat kerangka header – main – footer', 'Tambahkan minimal 3 section dengan heading berurutan', 'Sisipkan form dengan label yang terhubung ke setiap input', 'Validasi dengan pemeriksa HTML dan perbaiki error'],
			deliverable: 'Satu file index.html + tangkapan layar hasil validasi',
			deadline: '7 hari setelah modul dibuka'
		}
	},
	// ===== Kursus 1 · Modul 2 =====
	'm1-2-mat1': {
		intro: 'Flexbox untuk susunan satu dimensi, Grid untuk dua dimensi. Kuasai keduanya dan 90% kebutuhan layout terpenuhi.',
		chapters: [
			{ time: '00:00', label: 'Kapan Flexbox, kapan Grid?' },
			{ time: '09:15', label: 'Praktik Flexbox: navbar & kartu' },
			{ time: '19:40', label: 'Praktik Grid: galeri & dashboard' },
			{ time: '29:00', label: 'Rangkuman pola layout populer' }
		],
		mediaUrl: SAMPLE_VIDEO,
		points: ['justify-content mengatur sumbu utama Flexbox', 'grid-template-areas membuat layout mudah dibaca', 'gap menggantikan margin antar item']
	},
	'm1-2-mat2': {
		intro: 'Mayoritas pengguna membuka web dari ponsel. Desain mobile-first membuat hidupmu jauh lebih mudah.',
		paragraphs: [
			'Mulai dari viewport sempit (320–375px), lalu tambah kompleksitas lewat min-width media query. Dengan cara ini, gaya dasar tetap ringan dan hanya perangkat besar yang memuat tambahan.',
			'Gunakan satuan relatif (rem, %, fr) dan hindari lebar fix dalam piksel untuk konten. Gambar diberi max-width: 100% agar tidak meluber dari wadahnya.',
			'Uji di minimal tiga lebar: ponsel (~360px), tablet (~768px), dan desktop (~1280px). Perhatikan navigasi — ubah menu horizontal menjadi pola hamburger atau bottom bar.'
		],
		points: ['Mulai dari 360px, perluas dengan min-width', 'Satuan relatif untuk tipografi dan layout', 'Uji sentuh: target minimal 44×44 px']
	},
	// Kuis dikerjakan dari bank soal server (tanpa kunci di klien) — lihat QuizMaterial.
	// ===== Kursus 1 · Modul 3 =====
	'm1-3-mat1': {
		intro: 'DOM adalah jembatan antara HTML dan JavaScript. Pahami event agar antarmukamu hidup.',
		chapters: [
			{ time: '00:00', label: 'Memilih elemen: querySelector' },
			{ time: '08:45', label: 'Event listener & delegation' },
			{ time: '18:30', label: 'Contoh: tab interaktif tanpa library' },
			{ time: '25:10', label: 'Rangkuman & jebakan umum' }
		],
		mediaUrl: SAMPLE_VIDEO,
		points: ['Satu listener di parent (delegation) > banyak listener', 'Gunakan passive listener untuk scroll yang mulus', 'Bersihkan listener saat elemen dihapus']
	},
	'm1-3-mat2': {
		intro: 'Data dari server diambil secara asynchronous. Kuasai async/await dan fetch agar UI tidak membeku.',
		chapters: [
			{ time: '00:00', label: 'Sinkron vs asinkron' },
			{ time: '07:20', label: 'fetch + async/await dalam praktik' },
			{ time: '17:50', label: 'Menangani loading & error state' },
			{ time: '26:40', label: 'Latihan: daftar kursus dari API' }
		],
		mediaUrl: SAMPLE_VIDEO,
		points: ['Selalu bungkus fetch dengan try/catch', 'Tampilkan skeleton saat loading', 'Batalkan request basi dengan AbortController']
	},
	'm1-3-mat3': {
		assignment: {
			brief: 'Bangun galeri foto interaktif: grid responsif, filter kategori, dan lightbox. Data foto boleh hardcode dalam array JavaScript.',
			objectives: ['Mem practices DOM rendering dinamis', 'Menerapkan event delegation pada filter', 'Mengelola state UI (kategori aktif, item terbuka)'],
			steps: ['Render grid dari array data dengan fungsi render()', 'Tambahkan tombol filter yang me-render ulang grid', 'Buat lightbox dengan tombol tutup + navigasi keyboard (Esc, ←, →)', 'Pastikan bisa dioperasikan penuh via keyboard'],
			deliverable: 'Folder proyek + tautan demo / rekaman layar 1 menit',
			deadline: '10 hari setelah modul dibuka'
		}
	},
	// ===== Kursus 1 · Modul 4 =====
	'm1-4-mat1': {
		intro: 'Komponen memecah UI menjadi unit mandiri; state menentukan apa yang tampil. Pola ini dipakai semua framework modern.',
		chapters: [
			{ time: '00:00', label: 'Berpikir berbasis komponen' },
			{ time: '08:10', label: 'Props in, event out' },
			{ time: '16:30', label: 'State lokal vs state global' },
			{ time: '23:00', label: 'Contoh: komponen kartu kursus' }
		],
		mediaUrl: SAMPLE_VIDEO,
		points: ['Satu komponen = satu tanggung jawab', 'Data mengalir satu arah agar mudah dilacak', 'Angkat state ke parent jika dipakai bersama']
	},
	'm1-4-mat2': {
		intro: 'Kode yang tidak ter-deploy tidak memberi nilai. Pelajari alur build dan hosting statis hingga online.',
		paragraphs: [
			'Proses build menggabungkan module, mengoptimasi aset, dan menghasilkan file statis siap saji. Perintah umumnya hanya satu baris, tetapi pahami output-nya: HTML, CSS/JS ter-minifikasi, dan aset dengan hash unik untuk caching.',
			'Pilih platform hosting statis dan sambungkan ke repositori agar setiap push ter-deploy otomatis (CI/CD sederhana). Atur variabel environment dan domain kustom bila tersedia.',
			'Sebelum go-live, cek ulang: kecepatan muat, meta sosial, favicon, halaman 404, dan formulir. Catat URL produksi sebagai portofoliomu.'
		],
		points: ['Build menghasilkan aset statis berversi hash', 'Auto-deploy dari repo menghemat waktu', 'Checklist go-live: performa, meta, 404']
	},
	// Kuis dikerjakan dari bank soal server (tanpa kunci di klien) — lihat QuizMaterial.
	// ===== Contoh audio & foto =====
	'm4-1-mat2': {
		intro: 'Dengarkan penjelasan tentang rekayasa sosial — serangan yang menargetkan manusia, bukan mesin.',
		mediaUrl: SAMPLE_AUDIO,
		transcript:
			'Transkrip: Rekayasa sosial mengeksploitasi kepercayaan dan rasa urgensi. Bentuk umumnya meliputi phishing email, pretexting via telepon, dan baiting dengan media fisik. Pertahanan terbaik adalah verifikasi dua arah: jangan klik tautan mencurigakan, konfirmasi permintaan sensitif melalui kanal resmi, dan laporkan insiden ke tim keamanan. Ingat — kehati-hatian satu menit mencegah kerugian berhari-hari.'
	},
	'm3-2-mat3': {
		intro: 'Amati topologi pada diagram berikut, lalu identifikasi peran tiap perangkat sebelum masuk ke lab simulasi.',
		mediaUrl: 'https://picsum.photos/seed/topologi-jaringan/1200/700',
		caption: 'Diagram topologi: router inti terhubung ke dua switch distribusi dan empat host.',
		points: ['Router: penghubung antar subnet', 'Switch: penerus frame dalam satu segmen', 'Host: titik akhir yang diberi alamat IP']
	}
};

function defaultDetail(mat: Material, course: Course, moduleTitle: string): MaterialDetail {
	switch (mat.type) {
		case 'video':
			return {
				intro: `Tonton pembahasan "${mat.title}" pada modul ${moduleTitle}, lalu catat tiga hal yang ingin kamu praktikkan.`,
				mediaUrl: SAMPLE_VIDEO,
				posterUrl: course.image,
				chapters: [
					{ time: '00:00', label: 'Pembuka & tujuan pembelajaran' },
					{ time: `05:00`, label: `Konsep inti: ${mat.title}` },
					{ time: '15:00', label: 'Contoh kasus & rangkuman' }
				],
				points: ['Fokus pada satu konsep per sesi tonton', 'Jeda video dan coba langsung di lab', 'Rangkum ulang dengan bahasamu sendiri']
			};
		case 'audio':
			return {
				intro: `Simak audio "${mat.title}" — cocok didengar ulang saat perjalanan.`,
				mediaUrl: SAMPLE_AUDIO,
				transcript: `Transkrip: Materi ini membahas ${mat.title} dalam modul ${moduleTitle} pada kursus ${course.title}. Poin utamanya: pahami konsep dasar, perhatikan contoh yang diberikan, dan terapkan lewat latihan di akhir modul.`
			};
		case 'foto':
			return {
				intro: `Pelajari visual berikut terkait "${mat.title}" sebelum lanjut ke praktik.`,
				mediaUrl: `https://picsum.photos/seed/${mat.id}/1200/700`,
				caption: `Ilustrasi pendukung materi ${mat.title}.`,
				points: ['Amati detail visual selama 2 menit', 'Hubungkan dengan konsep di modul ini', 'Catat istilah baru yang muncul']
			};
		case 'kuis':
			// Tanpa bank soal lokal: kunci jawaban tidak pernah dikirim ke klien.
			// Soal + penilaian 100% dari backend (QuizMaterial server-only, K-02).
			return {
				intro: `Uji pemahamanmu tentang "${mat.title}" langsung dari bank soal server. Nilai minimal 70 untuk lolos.`
			};
		case 'tugas':
			return {
				assignment: {
					brief: `Selesaikan penugasan "${mat.title}" pada modul ${moduleTitle} dan kumpulkan hasilnya sesuai format yang diminta.`,
					objectives: ['Menerapkan konsep modul secara mandiri', 'Menghasilkan artefak yang bisa dinilai', 'Melatih manajemen waktu'],
					steps: ['Baca brief hingga tuntas', 'Kerjakan sesuai kriteria', 'Periksa ulang sebelum mengumpulkan'],
					deliverable: 'Berkas hasil kerja (PDF/ZIP/tautan)',
					deadline: '7 hari setelah modul dibuka'
				}
			};
		default:
			return {
				intro: `Pelajari materi "${mat.title}" dengan saksama sebagai bagian dari modul ${moduleTitle}.`,
				paragraphs: [
					`${mat.title} adalah bagian penting dari modul ${moduleTitle} pada kursus ${course.title}. Pahami konsepnya sebelum melanjutkan ke materi berikutnya.`,
					'Buat catatan dengan bahasamu sendiri dan tandai bagian yang belum jelas untuk didiskusikan dengan mentor atau komunitas.',
					'Akhiri sesi dengan mengerjakan latihan kecil: terapkan satu hal dari bacaan ini dalam waktu 15 menit.'
				],
				points: ['Baca aktif, bukan sekadar scanning', 'Tandai istilah kunci', 'Terapkan 1 hal dalam 15 menit']
			};
	}
}

export function getMaterialDetail(
	mat: Material,
	course: Course,
	moduleTitle: string
): MaterialDetail {
	return overrides[mat.id] ?? defaultDetail(mat, course, moduleTitle);
}
