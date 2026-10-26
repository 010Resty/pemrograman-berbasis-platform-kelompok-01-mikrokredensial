<script lang="ts">
	import '../app.css';
	import { resolve } from '$app/paths';
	import Logo from '$lib/components/Logo.svelte';
	import { aristotelesLogo as logoUrl } from '$lib/assets/logo';
	import { courses } from '$lib/data/courses';
	import { getCourseMeta } from '$lib/data/course-meta';

	let menuOpen = $state(false);

	const rankings = [
		{
			rank: 1,
			title: 'Belajar Figma – Pelatihan Desain UI/UX Esensial',
			category: 'Desain UI/UX',
			instructor: 'Kevin Perry',
			rating: '4.8',
			participants: '2.450',
			initials: 'KP'
		},
		{
			rank: 2,
			title: 'Statistik TI, Sains Data, dan Analisis Bisnis',
			category: 'Sains Data',
			instructor: 'Kevin Perry',
			rating: '4.7',
			participants: '2.180',
			initials: 'KP'
		},
		{
			rank: 3,
			title: 'Perangkat Lunak Pendidikan dan Sistem PHP & JS',
			category: 'Pengembangan Web',
			instructor: 'Max Alexix',
			rating: '4.7',
			participants: '1.920',
			initials: 'MA'
		},
		{
			rank: 4,
			title: 'Kursus Pengembangan Android 12 & Kotlin Lanjutan',
			category: 'Pengembangan Mobile',
			instructor: 'Max Alexix',
			rating: '4.7',
			participants: '1.750',
			initials: 'MA'
		},
		{
			rank: 5,
			title: 'Pemasaran Digital untuk Pemula',
			category: 'Pemasaran Digital',
			instructor: 'Sarah Johnson',
			rating: '4.6',
			participants: '1.540',
			initials: 'SJ'
		},
		{
			rank: 6,
			title: 'Copywriting & Content Marketing untuk Brand',
			category: 'Pemasaran Digital',
			instructor: 'Dewi Lestari',
			rating: '4.6',
			participants: '1.320',
			initials: 'DL'
		},
		{
			rank: 7,
			title: 'Analisis Data dengan Python & Visualisasi Dashboard',
			category: 'Sains Data',
			instructor: 'Rizky Pratama',
			rating: '4.5',
			participants: '1.180',
			initials: 'RP'
		},
		{
			rank: 8,
			title: 'Fundamental JavaScript & Frontend Modern',
			category: 'Pengembangan Web',
			instructor: 'Andi Wijaya',
			rating: '4.5',
			participants: '1.050',
			initials: 'AW'
		},
		{
			rank: 9,
			title: 'Manajemen Proyek Agile & Scrum Master',
			category: 'Manajemen',
			instructor: 'Putri Ayu',
			rating: '4.4',
			participants: '980',
			initials: 'PA'
		},
		{
			rank: 10,
			title: 'Fotografi & Editing untuk Kreator Konten',
			category: 'Desain Grafis',
			instructor: 'Bagas Saputra',
			rating: '4.4',
			participants: '870',
			initials: 'BS'
		}
	];

	const podiumOrder = [rankings[1], rankings[0], rankings[2]];
	const tableRankings = rankings.slice(3);

	const mobileLinks = [
		{ id: 'beranda', label: 'Beranda' },
		{ id: 'modul', label: 'Pelatihan' },
		{ id: 'peringkat', label: 'Peringkat' },
		{ id: 'tentang', label: 'Tentang' },
		{ id: 'verifikasi', label: 'Verifikasi' }
	];
</script>

<svelte:head>
	<title>Ubah Rasa Ingin Tahu Menjadi Keahlian yang Bermakna — Aristoteles</title>
	<meta
		name="description"
		content="ARISTOTELES — Artificial Intelligence Research, Innovation, Science, Technology, and Engineering Laboratory for Education and Systems. Dari memilih pelatihan hingga memperoleh sertifikat. Terstruktur, terukur, dan berkelanjutan."
	/>
</svelte:head>

<!-- Main Header Navbar -->
<header class="bg-white sticky top-0 z-50 shadow-sm">
	<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
		<div class="flex items-center justify-between gap-3 h-20">
			<!-- Logo -->
			<a
				href="#beranda"
				class="flex shrink-0 items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-blue-600"
				aria-label="Aristoteles - Beranda"
			>
				<Logo size="md" showText={true} textSize="xl" />
			</a>

			<!-- Desktop Navigation -->
			<nav
				aria-label="Navigasi utama"
				class="hidden lg:flex min-w-0 flex-1 items-center justify-center gap-5 xl:gap-7 font-semibold text-[13px] text-slate-700"
			>
				<a href="#beranda" class="whitespace-nowrap text-blue-600 transition hover:text-blue-700"
					>BERANDA</a
				>
				<a href="#modul" class="whitespace-nowrap hover:text-blue-600 transition">PELATIHAN</a>
				<a href="#peringkat" class="whitespace-nowrap hover:text-blue-600 transition">PERINGKAT</a>
				<a href="#tentang" class="whitespace-nowrap hover:text-blue-600 transition">TENTANG</a>
				<a href="#verifikasi" class="whitespace-nowrap hover:text-blue-600 transition">VERIFIKASI</a
				>
			</nav>

			<!-- Search & Actions -->
			<div
				class="hidden xl:flex shrink-0 items-center bg-slate-100 rounded-full pl-4 pr-2 py-1.5 border border-slate-200"
			>
				<label for="landing-search" class="sr-only">Cari program mikrokredensial</label>
				<input
					id="landing-search"
					type="search"
					placeholder="Cari program..."
					class="bg-transparent text-xs focus:outline-none w-40 text-slate-700"
				/>
				<span
					class="flex h-7 w-7 items-center justify-center rounded-full bg-white"
					aria-hidden="true"
				>
					<img src={logoUrl} alt="" aria-hidden="true" class="h-5 w-5 rounded-full object-cover" />
				</span>
			</div>
			<div class="hidden shrink-0 items-center gap-2.5 sm:flex">
				<a
					href={resolve('/login')}
					class="inline-flex min-h-[44px] items-center justify-center whitespace-nowrap rounded-full border border-blue-600 px-5 text-xs font-bold text-blue-700 uppercase transition hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
				>
					Masuk
				</a>
				<a
					href={resolve('/register')}
					class="inline-flex min-h-[44px] items-center justify-center gap-2 whitespace-nowrap rounded-full bg-blue-600 px-5 text-xs font-bold text-white uppercase shadow-lg shadow-blue-500/25 transition hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
				>
					Mulai Belajar
					<i class="fa-solid fa-arrow-right text-[11px]" aria-hidden="true"></i>
				</a>
			</div>

			<!-- Mobile menu button -->
			<button
				type="button"
				onclick={() => (menuOpen = !menuOpen)}
				aria-expanded={menuOpen}
				aria-controls="mobile-nav"
				aria-label={menuOpen ? 'Tutup menu navigasi' : 'Buka menu navigasi'}
				class="flex min-h-11 min-w-11 items-center justify-center rounded-xl p-2 text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-600 lg:hidden"
			>
				<i class={`fa-solid ${menuOpen ? 'fa-xmark' : 'fa-bars'} text-xl`} aria-hidden="true"></i>
			</button>
		</div>
	</div>

	<!-- Mobile navigation panel -->
	{#if menuOpen}
		<nav
			id="mobile-nav"
			aria-label="Navigasi seluler"
			class="border-t border-slate-100 bg-white px-4 pt-2 pb-5 sm:px-6 lg:hidden"
		>
			<ul class="divide-y divide-slate-100 text-sm font-semibold text-slate-700">
				{#each mobileLinks as link (link.id)}
					<li>
						<a
							href={`#${link.id}`}
							onclick={() => (menuOpen = false)}
							class="block rounded-lg px-2 py-3 uppercase tracking-wide transition-colors hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
						>
							{link.label}
						</a>
					</li>
				{/each}
			</ul>
			<div class="mt-3 grid grid-cols-2 gap-2.5 sm:hidden">
				<a
					href={resolve('/login')}
					class="inline-flex min-h-[44px] items-center justify-center rounded-full border border-blue-600 px-4 text-xs font-bold text-blue-700 uppercase transition hover:bg-blue-50"
				>
					Masuk
				</a>
				<a
					href={resolve('/register')}
					class="inline-flex min-h-[44px] items-center justify-center rounded-full bg-blue-600 px-4 text-xs font-bold text-white uppercase shadow-lg shadow-blue-500/25 transition hover:bg-blue-700"
				>
					Mulai Belajar
				</a>
			</div>
		</nav>
	{/if}
</header>

<main>
	<!-- Hero Section (Beranda) -->
	<section id="beranda" class="relative overflow-hidden bg-white pt-12 pb-20">
		<!-- Kisi blueprint samar + aksen datar -->
		<div class="pointer-events-none absolute inset-0" aria-hidden="true">
			<div
				class="absolute inset-0 bg-[linear-gradient(to_right,#dbeafe_1px,transparent_1px),linear-gradient(to_bottom,#dbeafe_1px,transparent_1px)] bg-[size:48px_48px] opacity-70 [mask-image:radial-gradient(ellipse_75%_65%_at_50%_30%,black,transparent)]"
			></div>
			<div class="absolute top-16 right-[6%] hidden h-24 w-24 rounded-3xl bg-navy lg:block"></div>
			<div
				class="absolute top-44 right-[12%] hidden h-10 w-10 rounded-full border-[3px] border-accent lg:block"
			></div>
			<div
				class="absolute bottom-12 left-[3%] hidden h-14 w-14 rounded-2xl bg-primary/10 lg:block"
			></div>
		</div>

		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
			<div class="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
				<!-- Left Column text -->
				<div class="lg:col-span-7 space-y-6">
					<p
						class="inline-flex animate-rise items-center gap-2.5 rounded-full border border-primary/25 bg-info-bg px-4 py-1.5 text-[11px] font-extrabold tracking-[0.18em] text-navy uppercase"
					>
						<span class="h-2 w-2 rounded-full bg-primary" aria-hidden="true"></span> Ruang Tumbuh dan
						Berkarya
					</p>

					<h1
						class="max-w-2xl animate-rise text-5xl leading-[1.04] font-extrabold tracking-tight text-navy sm:text-6xl"
						style="animation-delay:90ms"
					>
						Ubah Rasa Ingin Tahu Menjadi
						<span class="text-primary">Keahlian yang Bermakna.</span>
					</h1>

					<p class="max-w-xl text-xs leading-relaxed text-text-muted sm:text-sm">
						<strong class="font-bold text-navy">ARISTOTELES</strong> — Artificial Intelligence Research,
						Innovation, Science, Technology, and Engineering Laboratory for Education and Systems.
					</p>

					<p class="max-w-xl text-base text-slate-600 sm:text-lg">
						Dari memilih pelatihan, mempelajari modul, menyelesaikan tantangan, hingga memperoleh
						sertifikat. Terstruktur, terukur, dan berkelanjutan.
					</p>

					<!-- Bullet badges -->
					<div class="flex flex-wrap gap-4 pt-2">
						<div
							class="flex items-center gap-2 rounded-xl border border-border bg-white px-3.5 py-2 text-sm font-bold text-navy shadow-sm"
						>
							<i class="fa-solid fa-circle-check text-success" aria-hidden="true"></i> Sertifikasi Resmi
						</div>
						<div
							class="flex items-center gap-2 rounded-xl border border-border bg-white px-3.5 py-2 text-sm font-bold text-navy shadow-sm"
						>
							<i class="fa-solid fa-circle-check text-success" aria-hidden="true"></i> Kurikulum Berbasis
							Industri
						</div>
						<div
							class="flex items-center gap-2 rounded-xl border border-border bg-white px-3.5 py-2 text-sm font-bold text-navy shadow-sm"
						>
							<i class="fa-solid fa-circle-check text-success" aria-hidden="true"></i> Mentor Praktisi
							Ahli
						</div>
					</div>

					<!-- Action Buttons -->
					<div class="flex animate-rise flex-wrap gap-4 pt-4" style="animation-delay:270ms">
						<a
							href="/register"
							class="group flex items-center gap-3 rounded-xl bg-primary px-8 py-4 font-bold text-white shadow-lg shadow-primary/25 transition-all duration-300 hover:bg-primary-hover active:scale-[0.98]"
						>
							DAFTAR SEKARANG <i
								class="fa-solid fa-arrow-right transition-transform duration-300 group-hover:translate-x-1"
								aria-hidden="true"
							></i>
						</a>
						<a
							href="#modul"
							class="flex items-center gap-3 rounded-xl border border-border bg-white px-8 py-4 font-bold text-navy shadow-sm transition-all duration-300 hover:border-primary hover:shadow-md active:scale-[0.98]"
						>
							<span
								class="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white"
								><i class="fa-solid fa-play text-xs" aria-hidden="true"></i></span
							> LIHAT KURIKULUM
						</a>
					</div>
				</div>

				<!-- Right Column: Image & Floating Cards -->
				<div class="relative flex justify-center lg:col-span-5">
					<div class="relative w-full max-w-md animate-rise" style="animation-delay:180ms">
						<!-- Foto modern berbingkai navy -->
						<div class="relative mx-auto w-72 sm:w-80">
							<div
								class="absolute -inset-0 translate-x-3 translate-y-3 rounded-[2rem] bg-navy"
								aria-hidden="true"
							></div>
							<div class="relative overflow-hidden rounded-[2rem] border border-border bg-info-bg">
								<img
									src="https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=800&q=80"
									alt="Mahasiswa mengikuti pembelajaran mikrokredensial"
									class="aspect-[4/5] w-full object-cover"
									loading="eager"
								/>
								<span
									class="absolute top-4 left-4 rounded-lg bg-navy px-3 py-1.5 text-[11px] font-extrabold tracking-widest text-white uppercase"
									>Kelas 2026</span
								>
							</div>
						</div>

						<!-- Rating pill -->
						<div
							class="hero-float absolute -top-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-navy px-3.5 py-1.5 text-xs font-bold whitespace-nowrap text-white shadow-lg"
						>
							<i class="fa-solid fa-star text-accent" aria-hidden="true"></i> 4.9/5 dari 16.500+ alumni
						</div>

						<!-- Floating Badge 1: Active Students -->
						<div
							class="hero-float absolute top-8 -left-4 flex items-center gap-3 rounded-2xl border border-border bg-white p-3.5 shadow-xl shadow-slate-900/5 sm:-left-10"
						>
							<div class="rounded-xl bg-primary p-2.5 text-white">
								<i class="fa-solid fa-user-graduate text-lg"></i>
							</div>
							<div>
								<h4 class="text-xs font-bold tracking-wide text-text-muted uppercase">
									Total Peserta
								</h4>
								<p class="text-xl font-extrabold text-navy tabular-nums">16.500+ Alumni</p>
							</div>
						</div>

						<!-- Floating Badge 2: Video Courses -->
						<div
							class="hero-float hero-float-late absolute -right-2 bottom-16 flex items-center gap-3 rounded-2xl border border-border bg-white p-3.5 shadow-xl shadow-slate-900/5 sm:-right-8"
						>
							<div class="rounded-xl bg-navy p-2.5 text-white">
								<i class="fa-solid fa-video text-lg"></i>
							</div>
							<div>
								<h4 class="text-xs font-bold tracking-wide text-text-muted uppercase">
									Pelatihan Interaktif
								</h4>
								<p class="text-xl font-extrabold text-navy tabular-nums">7.500+ Pelatihan</p>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	</section>

	<!-- Features Bar Section -->
	<section class="border-y border-border bg-surface py-6">
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
			<div
				class="grid grid-cols-2 md:grid-cols-5 gap-6 text-center divide-y md:divide-y-0 md:divide-x divide-slate-100"
			>
				<div class="flex items-center justify-center gap-3 p-2">
					<div class="bg-primary text-white p-3 rounded-full">
						<i class="fa-solid fa-book-open text-xl"></i>
					</div>
					<div class="text-left">
						<h5 class="font-extrabold text-slate-900 text-sm">20rb+ Pelatihan</h5>
						<p class="text-xs text-slate-500">Mikrokredensial</p>
					</div>
				</div>
				<div class="flex items-center justify-center gap-3 p-2">
					<div class="bg-primary text-white p-3 rounded-full">
						<i class="fa-solid fa-infinity text-xl"></i>
					</div>
					<div class="text-left">
						<h5 class="font-extrabold text-slate-900 text-sm">Akses Selamanya</h5>
						<p class="text-xs text-slate-500">Materi Terbaru</p>
					</div>
				</div>
				<div class="flex items-center justify-center gap-3 p-2">
					<div class="bg-primary text-white p-3 rounded-full">
						<i class="fa-solid fa-wallet text-xl"></i>
					</div>
					<div class="text-left">
						<h5 class="font-extrabold text-slate-900 text-sm">Terjangkau</h5>
						<p class="text-xs text-slate-500">Harga Terbaik</p>
					</div>
				</div>
				<div class="flex items-center justify-center gap-3 p-2">
					<div class="bg-primary text-white p-3 rounded-full">
						<i class="fa-solid fa-headset text-xl"></i>
					</div>
					<div class="text-left">
						<h5 class="font-extrabold text-slate-900 text-sm">Dukungan Mentoring</h5>
						<p class="text-xs text-slate-500">Dukungan Seumur Hidup</p>
					</div>
				</div>
				<div class="flex items-center justify-center gap-3 p-2 col-span-2 md:col-span-1">
					<div class="bg-primary text-white p-3 rounded-full">
						<i class="fa-solid fa-users text-xl"></i>
					</div>
					<div class="text-left">
						<h5 class="font-extrabold text-slate-900 text-sm">Komunitas Aktif</h5>
						<p class="text-xs text-slate-500">Jaringan Luas</p>
					</div>
				</div>
			</div>
		</div>
	</section>

	<!-- Popular Online Courses Section (Modul) -->
	<section id="modul" class="py-20 bg-white">
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
			<div class="text-center max-w-2xl mx-auto mb-12 space-y-3">
				<span
					class="text-blue-600 font-bold text-xs uppercase tracking-widest bg-blue-100 px-3 py-1 rounded-full"
					><i class="fa-solid fa-book-bookmark"></i> PELATIHAN POPULER</span
				>
				<h2 class="text-3xl sm:text-4xl font-extrabold text-slate-900">
					Pelatihan Online Populer Kami
				</h2>
				<p class="text-slate-500 text-sm">
					Pilih program mikrokredensial pilihan yang dirancang spesifik untuk karier profesional
					Anda di masa depan.
				</p>
			</div>

			<!-- Category Filter Buttons -->
			<div class="flex flex-wrap justify-center gap-3 mb-12">
				<button
					class="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold text-xs shadow-md shadow-blue-600/20 flex items-center gap-2"
					><i class="fa-solid fa-laptop-code"></i> Pemasaran Digital</button
				>
				<button
					class="bg-slate-100 hover:bg-slate-200 text-slate-700 px-6 py-3 rounded-xl font-bold text-xs transition flex items-center gap-2"
					><i class="fa-solid fa-pen-nib"></i> Desain UI/UX</button
				>
				<button
					class="bg-slate-100 hover:bg-slate-200 text-slate-700 px-6 py-3 rounded-xl font-bold text-xs transition flex items-center gap-2"
					><i class="fa-solid fa-chart-pie"></i> Desain Grafis</button
				>
				<button
					class="bg-slate-100 hover:bg-slate-200 text-slate-700 px-6 py-3 rounded-xl font-bold text-xs transition flex items-center gap-2"
					><i class="fa-solid fa-code"></i> Pengembangan Web</button
				>
			</div>

			<!-- Course Cards Grid -->
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
				{#each courses.slice(0, 4) as course (course.id)}
					{@const meta = getCourseMeta(course.id)}
					<article
						class="relative bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-xl transition group flex flex-col"
					>
						<div class="relative overflow-hidden" aria-hidden="true">
							<img
								src={course.image}
								alt=""
								class="w-full h-48 object-cover group-hover:scale-105 transition duration-500"
								loading="lazy"
							/>
							<span
								class="absolute top-3 left-3 bg-red-600 text-white text-[10px] font-extrabold px-3 py-1 rounded-md uppercase"
								>{course.duration}</span
							>
						</div>
						<div class="p-6 flex-1 flex flex-col justify-between space-y-4">
							<div>
								<div class="flex items-center justify-between text-xs text-slate-500 mb-2">
									<span class="flex items-center gap-1"
										><i class="fa-regular fa-star text-amber-400"></i>
										{meta.rating} ({meta.reviews})</span
									>
									<span class="flex items-center gap-1"
										><i class="fa-regular fa-clock"></i> {course.totalMaterials} Materi</span
									>
								</div>
								<h3 class="font-extrabold text-slate-900 text-base leading-snug">
									<a
										href={resolve(`/modules/${course.id}`)}
										class="rounded transition group-hover:text-blue-600 focus-visible:outline-2 focus-visible:outline-blue-600 after:absolute after:inset-0"
										aria-label={`Lihat info singkat: ${course.title}`}>{course.title}</a
									>
								</h3>
								<p class="mt-1 text-xs text-slate-500">
									{course.modules.length} modul · {course.category}
								</p>
							</div>
							<div class="pt-4 border-t border-slate-100 flex items-center justify-between">
								<span class="text-xs font-semibold text-slate-700">{course.instructor}</span>
								<span class="text-blue-600 font-extrabold text-sm">{meta.price}</span>
							</div>
						</div>
					</article>
				{/each}
			</div>

			<!-- View All Courses Button -->
			<div class="text-center mt-12">
				<a
					href={resolve('/modules')}
					class="inline-flex items-center gap-3 bg-blue-600 text-white font-bold text-xs uppercase px-8 py-4 rounded-xl hover:bg-blue-700 transition shadow-lg shadow-blue-600/30"
				>
					LIHAT SEMUA PELATIHAN <i class="fa-solid fa-arrow-right"></i>
				</a>
			</div>
		</div>
	</section>

	<!-- Rankings Section (Peringkat) -->
	<section id="peringkat" class="relative overflow-hidden py-20 bg-slate-50">
		<div
			class="pointer-events-none absolute inset-0"
			aria-hidden="true"
		>
			<div
				class="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:44px_44px] opacity-60 [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black,transparent)]"
			></div>
			<div class="absolute -top-10 left-1/2 h-56 w-[36rem] -translate-x-1/2 rounded-full bg-blue-200/40 blur-3xl"></div>
		</div>

		<div class="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
			<div class="text-center max-w-2xl mx-auto mb-12 space-y-3">
				<span
					class="text-blue-600 font-bold text-xs uppercase tracking-widest bg-blue-100 px-3 py-1 rounded-full"
					><i class="fa-solid fa-trophy"></i> PERINGKAT</span
				>
				<h2 class="text-3xl sm:text-4xl font-extrabold text-slate-900">
					Peringkat Pelatihan Terbaik
				</h2>
				<p class="text-slate-500 text-sm">
					Pelatihan dengan peringkat tertinggi berdasarkan penilaian peserta dan popularitas.
				</p>
			</div>

			<!-- Podium Top 3 -->
			<ol
				aria-label="Tiga pelatihan peringkat teratas"
				class="mx-auto mb-12 grid max-w-4xl grid-cols-3 items-end gap-3 sm:gap-6"
			>
				{#each podiumOrder as item (item.rank)}
					{@const isFirst = item.rank === 1}
					{@const isSecond = item.rank === 2}
					<li
						class="animate-rise flex flex-col items-center text-center {isFirst
							? 'order-2 -mt-2'
							: isSecond
								? 'order-1'
								: 'order-3'}"
						style="animation-delay:{item.rank * 90}ms"
					>
						{#if isFirst}
							<span
								class="mb-1 inline-flex h-9 w-9 items-center justify-center rounded-full bg-amber-400 text-slate-900 shadow-lg shadow-amber-400/40 ring-4 ring-amber-100"
								aria-hidden="true"
							>
								<i class="fa-solid fa-crown text-base"></i>
							</span>
						{/if}

						<!-- Medali / avatar -->
						<div class="relative">
							<div
								class="flex items-center justify-center rounded-2xl font-black {isFirst
									? 'h-16 w-16 sm:h-20 sm:w-20 text-xl bg-blue-800 text-amber-300 ring-4 ring-amber-400 shadow-xl shadow-blue-800/30'
									: isSecond
										? 'h-14 w-14 sm:h-16 sm:w-16 text-lg bg-white text-slate-700 ring-2 ring-slate-300 shadow-lg'
										: 'h-14 w-14 sm:h-16 sm:w-16 text-lg bg-white text-orange-700 ring-2 ring-orange-300 shadow-lg'}"
								aria-hidden="true"
							>
								{isFirst ? '1' : isSecond ? '2' : '3'}
							</div>
							<span
								class="absolute -right-2 -bottom-2 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-xs shadow {isFirst
									? 'bg-amber-400 text-slate-900'
									: isSecond
										? 'bg-slate-400 text-white'
										: 'bg-orange-600 text-white'}"
								aria-hidden="true"
							>
								<i
									class="fa-solid {isFirst ? 'fa-trophy' : isSecond ? 'fa-medal' : 'fa-award'}"
								></i>
							</span>
						</div>

						<!-- Info kartu -->
						<div
							class="mt-3 w-full rounded-2xl border bg-white px-2 py-3 shadow-sm sm:px-4 {isFirst
								? 'border-amber-300 shadow-amber-100'
								: 'border-slate-200'}"
						>
							<p
								class="text-[10px] font-extrabold tracking-[0.16em] uppercase {isFirst
									? 'text-amber-600'
									: isSecond
										? 'text-slate-500'
										: 'text-orange-600'}"
							>
								Juara {item.rank}
							</p>
							<h3
								class="mt-1 line-clamp-2 min-h-8 text-[11px] leading-snug font-extrabold text-slate-900 sm:min-h-10 sm:text-sm"
							>
								{item.title}
							</h3>
							<p class="mt-1 hidden text-[11px] font-semibold text-slate-500 sm:block">
								{item.category} · {item.instructor}
							</p>
							<div class="mt-2 flex items-center justify-center gap-2 text-[11px] font-bold">
								<span class="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-amber-600">
									<i class="fa-solid fa-star text-[10px]" aria-hidden="true"></i>
									{item.rating}
								</span>
								<span class="hidden items-center gap-1 text-slate-500 sm:inline-flex">
									<i class="fa-solid fa-users text-[10px]" aria-hidden="true"></i>
									{item.participants}
								</span>
							</div>
						</div>

						<!-- Balok podium bertingkat -->
						<div
							class="mt-3 flex w-full flex-col items-center justify-start rounded-t-2xl border-x border-t px-2 pt-3 text-white {isFirst
								? 'h-40 sm:h-48 bg-blue-800 border-blue-800 shadow-[0_-8px_30px_-10px_rgba(245,158,11,0.5)]'
								: isSecond
									? 'h-28 sm:h-32 bg-white border-slate-200 text-slate-700'
									: 'h-24 sm:h-28 bg-white border-slate-200 text-slate-700'}"
							aria-hidden="true"
						>
							{#if isFirst}
								<span class="h-1 w-12 rounded-full bg-amber-400"></span>
							{/if}
							<span
								class="mt-1 text-3xl font-black tracking-tight tabular-nums sm:text-4xl {isFirst
									? 'text-amber-300'
									: 'text-slate-300'}"
							>
								{item.rank}
							</span>
							<span
								class="text-[10px] font-bold tracking-[0.2em] uppercase {isFirst
									? 'text-slate-300'
									: 'text-slate-400'}"
							>
								{item.participants} peserta
							</span>
						</div>
						<div
							class="h-2 w-full rounded-b-lg {isFirst
								? 'bg-amber-400'
								: isSecond
									? 'bg-slate-400'
									: 'bg-orange-600'}"
							aria-hidden="true"
						></div>
					</li>
				{/each}
			</ol>

			<!-- Rankings Table (peringkat 4 ke bawah) -->
			<div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
				<div class="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/60 px-6 py-4">
					<h3 class="text-sm font-extrabold text-slate-900">
						<i class="fa-solid fa-list-ol text-blue-600" aria-hidden="true"></i>
						Peringkat 4 – 10
					</h3>
					<p class="text-xs text-slate-500">Berdasarkan penilaian peserta</p>
				</div>
				<div class="overflow-x-auto">
					<table class="w-full text-sm">
						<caption class="sr-only">Tabel peringkat pelatihan posisi 4 sampai 10</caption>
						<thead class="bg-blue-800 text-white">
							<tr>
								<th class="px-6 py-4 text-left font-bold text-xs uppercase tracking-wider"
									>Peringkat</th
								>
								<th class="px-6 py-4 text-left font-bold text-xs uppercase tracking-wider"
									>Nama Pelatihan</th
								>
								<th
									class="px-6 py-4 text-left font-bold text-xs uppercase tracking-wider hidden sm:table-cell"
									>Kategori</th
								>
								<th
									class="px-6 py-4 text-left font-bold text-xs uppercase tracking-wider hidden md:table-cell"
									>Instruktur</th
								>
								<th class="px-6 py-4 text-center font-bold text-xs uppercase tracking-wider"
									>Rating</th
								>
								<th
									class="px-6 py-4 text-center font-bold text-xs uppercase tracking-wider hidden lg:table-cell"
									>Peserta</th
								>
							</tr>
						</thead>
						<tbody class="divide-y divide-slate-100">
							{#each tableRankings as row (row.rank)}
								<tr class="hover:bg-blue-50/50 transition">
									<td class="px-6 py-4">
										<span
											class="inline-flex items-center justify-center w-8 h-8 bg-slate-200 text-slate-700 font-black text-sm rounded-lg"
											>{row.rank}</span
										>
									</td>
									<td class="px-6 py-4 font-bold text-slate-900">{row.title}</td>
									<td class="px-6 py-4 text-slate-600 hidden sm:table-cell">{row.category}</td>
									<td class="px-6 py-4 text-slate-600 hidden md:table-cell">{row.instructor}</td>
									<td class="px-6 py-4 text-center">
										<span class="inline-flex items-center gap-1 text-amber-500 font-bold"
											><i class="fa-solid fa-star"></i> {row.rating}</span
										>
									</td>
									<td class="px-6 py-4 text-center text-slate-600 hidden lg:table-cell">
										{row.participants}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	</section>

	<!-- About Section (Tentang) -->
	<section id="tentang" class="py-20 bg-slate-50">
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
			<div class="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
				<!-- Left Image Collage -->
				<div class="lg:col-span-6 grid grid-cols-2 gap-4">
					<div class="space-y-4">
						<img
							src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=600&q=80"
							alt="Peserta Bekerja"
							class="rounded-2xl shadow-lg object-cover h-64 w-full"
						/>
						<div
							class="bg-blue-900 text-white p-6 rounded-2xl shadow-lg relative overflow-hidden flex flex-col justify-center items-center text-center"
						>
							<span class="absolute -right-4 -bottom-4 text-7xl opacity-10 font-bold"
								><i class="fa-solid fa-award"></i></span
							>
							<span class="text-3xl font-black text-cyan-400">24+</span>
							<span class="text-xs font-semibold uppercase tracking-wider mt-1"
								>Tahun Pengalaman Institusi Pendidikan</span
							>
						</div>
					</div>
					<div class="pt-8 space-y-4">
						<img
							src="https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=600&q=80"
							alt="Kolaborasi"
							class="rounded-2xl shadow-lg object-cover h-48 w-full"
						/>
						<img
							src="https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=600&q=80"
							alt="Kelas Online"
							class="rounded-2xl shadow-lg object-cover h-56 w-full"
						/>
					</div>
				</div>

				<!-- Right Content -->
				<div class="lg:col-span-6 space-y-6">
					<span
						class="text-blue-600 font-bold text-xs uppercase tracking-widest bg-blue-100 px-3 py-1 rounded-full"
						><i class="fa-solid fa-circle-info"></i> TENTANG PROGRAM KAMI</span
					>
					<h2 class="text-3xl sm:text-4xl font-extrabold text-slate-900 leading-snug">
						Jelajahi Kursus Online Kami dan Tingkatkan Semangat Belajar Anda!
					</h2>
					<p class="text-slate-600 text-sm sm:text-base">
						Kami menyediakan program mikrokredensial berkualitas tinggi yang dirancang untuk
						membantu Anda menguasai keterampilan yang dibutuhkan dunia kerja modern. Dengan
						kurikulum berbasis industri dan mentor praktisi ahli, Anda siap menghadapi tantangan
						karier.
					</p>

					<div class="space-y-3 pt-2">
						<div class="flex items-start gap-3">
							<div class="bg-blue-600 text-white p-1 rounded mt-1">
								<i class="fa-solid fa-check text-xs"></i>
							</div>
							<p class="text-slate-700 text-sm font-semibold">
								Kurikulum yang terus diperbarui sesuai kebutuhan industri dan transformasi digital.
							</p>
						</div>
						<div class="flex items-start gap-3">
							<div class="bg-blue-600 text-white p-1 rounded mt-1">
								<i class="fa-solid fa-check text-xs"></i>
							</div>
							<p class="text-slate-700 text-sm font-semibold">
								Akses lebih dari 100.000 kursus online dan mikrokredensial yang diperbarui setiap
								tahun.
							</p>
						</div>
						<div class="flex items-start gap-3">
							<div class="bg-blue-600 text-white p-1 rounded mt-1">
								<i class="fa-solid fa-check text-xs"></i>
							</div>
							<p class="text-slate-700 text-sm font-semibold">
								Pelajari keterampilan berdampak tinggi yang dibutuhkan perusahaan global terkemuka.
							</p>
						</div>
					</div>

					<div class="pt-4">
						<a
							href="/modules"
							class="inline-flex items-center gap-3 bg-blue-600 text-white font-bold text-sm px-8 py-4 rounded-xl hover:bg-blue-700 transition shadow-lg shadow-blue-600/30"
						>
							BACA SELENGKAPNYA <i class="fa-solid fa-arrow-right"></i>
						</a>
					</div>
				</div>
			</div>
		</div>
	</section>

	<!-- Certificate Verification Section (Verifikasi) -->
	<section id="verifikasi" class="py-20 bg-white">
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
			<div class="bg-slate-50 rounded-2xl border border-slate-200 p-8 md:p-12 shadow-sm">
				<div class="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
					<!-- Left: Verification Form -->
					<div class="lg:col-span-7">
						<span
							class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-bold mb-4"
						>
							<i class="fa-solid fa-shield-halved"></i> Portal Validasi Perusahaan &amp; Institusi
						</span>
						<h2 class="text-3xl sm:text-4xl font-extrabold text-slate-900 mb-4">
							Verifikasi Keaslian Sertifikat Aristoteles
						</h2>
						<p class="text-slate-600 text-sm sm:text-base mb-8 max-w-xl">
							Apakah Anda seorang recruiter atau pimpinan akademik? Masukkan ID Kredensial kandidat
							untuk memeriksa validitas skor, rekaman asesmen, dan keaslian cap digital.
						</p>
						<!-- Interactive Search Box -->
						<div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 max-w-xl">
							<div class="relative flex-grow">
								<i
									class="fa-solid fa-qrcode absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
								></i>
								<input
									type="text"
									placeholder="Contoh: ED-2026-XXXX"
									class="w-full pl-11 pr-4 py-3 bg-white rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
								/>
							</div>
							<button
								class="px-6 py-3 bg-blue-600 text-white font-bold text-sm rounded-xl hover:bg-blue-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shrink-0 shadow-lg shadow-blue-600/25"
							>
								<i class="fa-solid fa-magnifying-glass-chart"></i>
								Periksa Validitas
							</button>
						</div>
						<!-- Trust Indicators -->
						<div class="mt-8 flex flex-wrap gap-4">
							<div class="flex items-center gap-2 text-xs text-slate-500">
								<i class="fa-solid fa-circle-check text-green-500"></i> Enkripsi Kriptografis
							</div>
							<div class="flex items-center gap-2 text-xs text-slate-500">
								<i class="fa-solid fa-circle-check text-green-500"></i> Terhubung ke Blockchain
							</div>
							<div class="flex items-center gap-2 text-xs text-slate-500">
								<i class="fa-solid fa-circle-check text-green-500"></i> Audit Real-time
							</div>
						</div>
					</div>
					<!-- Right: Verification Result Preview -->
					<div class="lg:col-span-5">
						<div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-md space-y-4">
							<div class="flex items-center justify-between pb-3 border-b border-slate-100">
								<div class="flex items-center gap-2">
									<i class="fa-solid fa-circle-check text-green-500 text-lg"></i>
									<span class="font-bold text-sm text-slate-800"
										>Status: Terdaftar &amp; Terverifikasi</span
									>
								</div>
								<span class="text-xs text-slate-400 font-mono">v2.4 Audit</span>
							</div>
							<div class="space-y-3 text-sm">
								<div class="flex justify-between">
									<span class="text-slate-500">Pemilik Sertifikat:</span>
									<span class="font-semibold text-slate-800">Rian Pratama</span>
								</div>
								<div class="flex justify-between">
									<span class="text-slate-500">Nama Pelatihan:</span>
									<span class="font-semibold text-slate-800">Full-Stack Cloud Engineer</span>
								</div>
								<div class="flex justify-between">
									<span class="text-slate-500">Tanggal Terbit:</span>
									<span class="font-semibold text-slate-800">14 Februari 2026</span>
								</div>
								<div class="flex justify-between">
									<span class="text-slate-500">Skor Akhir:</span>
									<span class="font-semibold text-green-600">96/100 (Distinction)</span>
								</div>
								<div class="flex justify-between">
									<span class="text-slate-500">Integritas Proktor:</span>
									<span class="font-semibold text-green-600">99.2% (Valid)</span>
								</div>
							</div>
							<div
								class="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400 font-mono"
							>
								<span>Signer: 0x4D2A...81E9</span>
								<a
									href="/user/sertifikat"
									class="text-blue-600 hover:underline flex items-center gap-1 font-sans font-semibold"
								>
									Unduh PDF
									<i class="fa-solid fa-download"></i>
								</a>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	</section>
</main>

<!-- Footer -->
<footer class="bg-slate-900 text-slate-400 py-12 border-t border-slate-800 text-sm">
	<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
		<div class="space-y-4">
			<div class="flex items-center gap-3">
				<Logo size="md" showText={true} textSize="lg" dark={true} />
			</div>
			<p class="text-xs text-slate-400 leading-relaxed">
				Platform pendidikan mikrokredensial terkemuka untuk membangun kompetensi profesional siap
				kerja secara fleksibel dan cepat.
			</p>
		</div>
		<div>
			<h4 class="text-white font-bold text-base mb-4">Navigasi Utama</h4>
			<ul class="space-y-2 text-xs">
				<li><a href="#tentang" class="hover:text-white transition">Tentang Kami</a></li>
				<li><a href="#modul" class="hover:text-white transition">Pelatihan</a></li>
				<li><a href="#peringkat" class="hover:text-white transition">Peringkat Pelatihan</a></li>
				<li><a href="/with_UNIRA" class="hover:text-white transition">Kebijakan Privasi</a></li>
			</ul>
		</div>
		<div>
			<h4 class="text-white font-bold text-base mb-4">Kategori Program</h4>
			<ul class="space-y-2 text-xs">
				<li><a href="/modules" class="hover:text-white transition">Pemasaran Digital</a></li>
				<li><a href="/modules" class="hover:text-white transition">Desain UI/UX</a></li>
				<li><a href="/modules" class="hover:text-white transition">Sains Data & Analitik</a></li>
				<li>
					<a href="/modules" class="hover:text-white transition">Pengembangan Mobile & Web</a>
				</li>
			</ul>
		</div>
		<div>
			<h4 class="text-white font-bold text-base mb-4">Buletin & Info</h4>
			<p class="text-xs text-slate-400 mb-4">
				Dapatkan info pelatihan terbaru langsung ke email Anda.
			</p>
			<div class="flex">
				<input
					type="email"
					placeholder="Email Anda..."
					class="bg-slate-800 text-xs px-3 py-2 rounded-l-lg focus:outline-none text-white w-full border border-slate-700"
				/>
				<button
					aria-label="Kirim email buletin"
					class="bg-blue-600 text-white px-4 rounded-r-lg text-xs font-bold hover:bg-blue-700 transition"
					><i class="fa-solid fa-paper-plane" aria-hidden="true"></i></button
				>
			</div>
		</div>
	</div>
	<div
		class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 border-t border-slate-800 text-center text-xs text-slate-500"
	>
		&copy; 2026 Aristoteles Platform Mikrokredensial. Semua hak dilindungi.
	</div>
</footer>

<style>
	/* Kartu mengambang lembut */
	.hero-float {
		animation: hero-float 5.5s ease-in-out infinite;
	}
	.hero-float-late {
		animation-delay: 2.2s;
	}
	@keyframes hero-float {
		0%,
		100% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(-10px);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.hero-float {
			animation: none;
		}
	}
</style>
