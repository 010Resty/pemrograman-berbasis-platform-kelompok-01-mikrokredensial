<script lang="ts">
	import '../../app.css';
	import Logo from '$lib/components/Logo.svelte';
	import { resolve } from '$app/paths';

	const updatedAt = '27 Oktober 2026';

	const points = [
		{
			id: 'kelayakan',
			icon: 'fa-id-card-clip',
			title: 'Kelayakan & Kriteria Peserta',
			text: 'Dengan mendaftar, Anda menyatakan telah memenuhi kriteria minimum yang dipersyaratkan untuk mengikuti program — misalnya batas usia, latar belakang pendidikan, atau kualifikasi tertentu yang tercantum pada deskripsi tiap pelatihan. Pendaftaran mandiri terbuka untuk peran peserta (student), sedangkan akun instruktur hanya dibuat melalui undangan admin. Bila di kemudian hari diketahui Anda tidak memenuhi kriteria, pengelola berhak meninjau ulang kepesertaan Anda.'
		},
		{
			id: 'akurasi-data',
			icon: 'fa-circle-check',
			title: 'Akurasi Data Profil & Sertifikat',
			text: 'Anda wajib mengisi data diri — nama lengkap, identitas (NIK/ID), dan email — secara akurat dan sesuai identitas resmi, sebab data inilah yang akan tercetak langsung pada sertifikat atau kredensial Anda. Kesalahan penulisan akibat kelalaian saat pendaftaran menjadi tanggung jawab Anda sepenuhnya, termasuk bila sertifikat yang sudah terbit harus diperbaiki atau diterbitkan ulang.'
		},
		{
			id: 'keamanan-akun',
			icon: 'fa-key',
			title: 'Keamanan Akun & Akses Personal',
			text: 'Akun pelatihan bersifat pribadi dan tidak dapat dialihkan: dilarang membagikan, menjual, atau meminjamkan akun kepada pihak lain untuk mengakses materi maupun mengikuti evaluasi. Anda bertanggung jawab menjaga kerahasiaan kata sandi serta seluruh aktivitas yang terjadi di dalam akun Anda — segera laporkan kepada pengelola bila mencurigai adanya akses tanpa izin.'
		},
		{
			id: 'hak-cipta',
			icon: 'fa-copyright',
			title: 'Hak Cipta & Kekayaan Intelektual Materi',
			text: 'Seluruh materi pembelajaran — video, modul, bank soal, dan aset pendukung lainnya — adalah milik sah pengelola aplikasi dan/atau instruktur penyusunnya. Tanpa izin tertulis, Anda dilarang merekam, mengunduh secara ilegal, menggandakan, atau mendistribusikan ulang materi dalam bentuk apa pun, baik untuk tujuan komersial maupun non-komersial.'
		},
		{
			id: 'kejujuran',
			icon: 'fa-scale-balanced',
			title: 'Kepatuhan Pelaksanaan & Kecurangan Akademik',
			text: 'Anda wajib menempuh seluruh proses belajar dan evaluasi secara jujur dan mandiri. Penggunaan bot, jasa joki ujian, plagiarisme, atau segala bentuk kecurangan lainnya merupakan pelanggaran berat yang berakibat pada pembatalan kepesertaan dan pencabutan sertifikat yang telah diterbitkan — tanpa pengembalian biaya bagi program berbayar.'
		},
		{
			id: 'sertifikat',
			icon: 'fa-award',
			title: 'Ketentuan Penerbitan Kredensial / Sertifikat',
			text: 'Sertifikat atau mikrokredensial hanya diterbitkan apabila Anda telah memenuhi seluruh syarat kelulusan program: kehadiran atau penyelesaian materi minimum, capaian nilai ambang batas (passing grade) pada setiap evaluasi, dan penyelesaian seluruh tugas yang diwajibkan. Pemenuhan sebagian syarat tidak menimbulkan hak atas sertifikat.'
		},
		{
			id: 'data-pembelajaran',
			icon: 'fa-shield-halved',
			title: 'Perlindungan Data & Rekam Pembelajaran',
			text: 'Dengan menyetujui ketentuan ini, Anda menyetujui bahwa riwayat belajar, nilai, dan status kelulusan Anda dapat diproses, disimpan, dan — bila diperlukan untuk verifikasi kredensial — dibagikan kepada pihak ketiga yang berkepentingan seperti mitra industri atau institusi pendidikan, sesuai dengan Kebijakan Privasi Aristoteles.'
		},
		{
			id: 'penangguhan',
			icon: 'fa-gavel',
			title: 'Penangguhan & Penutupan Akun',
			text: 'Pengelola berhak membekukan sementara atau menghapus secara permanen akun yang terbukti melanggar kode etik pembelajaran, memalsukan data, menyalahgunakan voucher dan celah sistem, atau melakukan tindakan lain yang merugikan Platform dan penggunanya. Keputusan penutupan akun atas pelanggaran berat bersifat final.'
		}
	];
</script>

<svelte:head>
	<title>Syarat & Ketentuan Pendaftaran — Aristoteles</title>
	<meta
		name="description"
		content="Syarat dan ketentuan pendaftaran pelatihan di Platform Mikrokredensial Aristoteles: kelayakan peserta, akurasi data sertifikat, keamanan akun, hak cipta materi, kejujuran akademik, penerbitan sertifikat, dan persetujuan pengguna."
	/>
</svelte:head>

<header class="sticky top-0 z-50 bg-white shadow-sm">
	<div class="mx-auto flex h-16 max-w-4xl items-center justify-between gap-3 px-4 sm:px-6">
		<a
			href={resolve('/')}
			class="rounded-lg focus-visible:outline-2 focus-visible:outline-blue-600"
			aria-label="Aristoteles - Beranda"
		>
			<Logo size="sm" showText={true} textSize="md" />
		</a>
		<nav aria-label="Navigasi" class="flex shrink-0 items-center gap-2 text-xs font-bold">
			<a
				href={resolve('/login')}
				class="rounded-full border border-blue-600 px-4 py-2 text-blue-700 uppercase transition hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
			>
				Masuk
			</a>
			<a
				href={resolve('/register')}
				class="rounded-full bg-blue-600 px-4 py-2 text-white uppercase shadow-lg shadow-blue-500/25 transition hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
			>
				Daftar
			</a>
		</nav>
	</div>
</header>

<main class="bg-slate-100">
	<div class="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
		<!-- Satu kartu informasi -->
		<article
			aria-labelledby="sk-title"
			class="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-900/5"
		>
			<!-- Aksen atas -->
			<div
				class="h-1.5 bg-gradient-to-r from-blue-700 via-cyan-500 to-blue-700"
				aria-hidden="true"
			></div>

			<div class="p-6 sm:p-10">
				<!-- Kepala kartu -->
				<div class="text-center">
					<div
						class="mb-4 inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-3.5 py-1.5 text-xs font-bold text-blue-700"
					>
						<i class="fa-solid fa-file-contract" aria-hidden="true"></i> Dokumen Legal
					</div>
					<h1
						id="sk-title"
						class="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl"
					>
						Syarat & Ketentuan Pendaftaran
					</h1>
					<p class="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-slate-500">
						Aturan main program pelatihan di Platform Mikrokredensial Aristoteles — dibaca
						dalam sekali duduk, berlaku sejak Anda menekan tombol
						<span class="font-bold text-slate-700">“Daftar”</span>.
					</p>
					<p class="mt-3 text-xs font-semibold text-slate-400">
						Terakhir diperbarui: {updatedAt} · Berlaku untuk seluruh pengguna Platform.
					</p>
				</div>

				<!-- Navigasi isi di dalam kartu -->
				<nav
					aria-label="Ringkasan isi"
					class="mt-8 rounded-2xl border border-slate-100 bg-slate-50 p-4 sm:p-5"
				>
					<ol class="grid gap-1 sm:grid-cols-2">
						{#each points as p, i (p.id)}
							<li>
								<a
									href={`#${p.id}`}
									class="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px] font-semibold text-slate-600 transition hover:bg-white hover:text-blue-700 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-blue-600"
								>
									<span
										class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[11px] font-bold text-white"
										aria-hidden="true"
									>
										{i + 1}
									</span>
									{p.title}
								</a>
							</li>
						{/each}
					</ol>
				</nav>

				<!-- Isi ketentuan -->
				<ol class="mt-4">
					{#each points as p, i (p.id)}
						<li
							id={p.id}
							class="scroll-mt-24 border-b border-slate-100 py-6 last:border-b-0 sm:py-7"
						>
							<section aria-labelledby={`${p.id}-title`}>
								<h2
									id={`${p.id}-title`}
									class="flex items-center gap-3.5 text-base font-bold text-slate-900 sm:text-lg"
								>
									<span
										class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-sm font-bold text-white shadow-md shadow-blue-600/25"
										aria-hidden="true"
									>
										{i + 1}
									</span>
									<span class="min-w-0 flex-1">{p.title}</span>
									<i
										class={`fa-solid ${p.icon} hidden shrink-0 text-lg text-blue-200 sm:block`}
										aria-hidden="true"
									></i>
								</h2>
								<p class="mt-3 pl-[3.25rem] text-sm leading-relaxed text-slate-600 sm:text-[15px]">
									{p.text}
								</p>
							</section>
						</li>
					{/each}
				</ol>

				<!-- Pernyataan persetujuan -->
				<section
					aria-labelledby="persetujuan-title"
					class="mt-2 rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-600 to-indigo-700 p-6 text-white shadow-lg shadow-blue-600/25 sm:p-7"
				>
					<h2 id="persetujuan-title" class="flex items-center gap-2.5 text-base font-bold sm:text-lg">
						<i class="fa-solid fa-pen-nib" aria-hidden="true"></i>
						Pernyataan Persetujuan
					</h2>
					<p class="mt-2.5 text-sm leading-relaxed text-blue-50">
						Dengan menekan tombol <span class="font-bold text-white">“Daftar”</span> pada
						halaman pendaftaran, Anda menyatakan telah membaca, memahami, dan menyetujui
						seluruh aturan serta ketentuan program pelatihan ini — termasuk pengelolaan data
						yang diatur dalam
						<a
							href={resolve('/kebijakan-privasi')}
							class="font-bold text-white underline decoration-cyan-300 decoration-2 underline-offset-2 transition hover:text-cyan-200 focus-visible:outline-2 focus-visible:outline-white"
						>
							Kebijakan Privasi
						</a>.
					</p>
					<a
						href={resolve('/register')}
						class="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-blue-700 shadow transition hover:bg-blue-50 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
					>
						Saya Setuju — Lanjut Daftar
						<i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
					</a>
				</section>
			</div>
		</article>

		<!-- Navigasi luar kartu -->
		<div class="mt-6 flex flex-wrap items-center justify-between gap-3">
			<a
				href={resolve('/register')}
				class="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-600/25 transition hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
			>
				<i class="fa-solid fa-arrow-left" aria-hidden="true"></i>
				Kembali ke Pendaftaran
			</a>
			<a
				href={resolve('/')}
				class="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600"
			>
				<i class="fa-solid fa-house" aria-hidden="true"></i>
				Beranda
			</a>
		</div>

		<p class="mt-6 text-center text-xs text-slate-400">
			&copy; 2026 Aristoteles Platform Mikrokredensial. Semua hak dilindungi.
		</p>
	</div>
</main>
