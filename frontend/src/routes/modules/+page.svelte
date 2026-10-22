<script lang="ts">
	import '../../app.css';
	import Logo from '$lib/components/Logo.svelte';
	import { aristotleLogo as logoUrl } from '$lib/assets/logo';
	import { courses } from '$lib/data/courses';
	import {
		getCourseMeta,
		periodBadgeClass,
		periodIcon,
		type CoursePeriod
	} from '$lib/data/course-meta';

	let menuOpen = $state(false);

	const mobileLinks = [
		{ href: '/', label: 'Beranda' },
		{ href: '/modules', label: 'Pelatihan' },
		{ href: '/#peringkat', label: 'Peringkat' },
		{ href: '/#tentang', label: 'Tentang' },
		{ href: '/#verifikasi', label: 'Verifikasi' }
	];

	let search = $state('');
	let activeCategory = $state('Semua');
	let activePeriod = $state<'all' | CoursePeriod>('all');

	const categories = $derived(['Semua', ...new Set(courses.map((c) => c.category))]);

	const periodFilters: { value: 'all' | CoursePeriod; label: string }[] = [
		{ value: 'all', label: 'Semua Periode' },
		{ value: 'ongoing', label: 'Sedang Berjalan' },
		{ value: 'upcoming', label: 'Akan Datang' },
		{ value: 'ended', label: 'Sudah Lewat' }
	];

	const filtered = $derived(
		courses.filter((c) => {
			const matchCat = activeCategory === 'Semua' || c.category === activeCategory;
			const matchPeriod = activePeriod === 'all' || getCourseMeta(c.id).period === activePeriod;
			const q = search.trim().toLowerCase();
			const matchQ =
				!q || c.title.toLowerCase().includes(q) || c.instructor.toLowerCase().includes(q);
			return matchCat && matchPeriod && matchQ;
		})
	);

	function periodShort(meta: { period: CoursePeriod; startMonth?: string }): string {
		if (meta.period === 'upcoming') return `Mulai ${meta.startMonth ?? ''}`.trim();
		if (meta.period === 'ongoing') return 'Berjalan';
		return 'Lewat';
	}
</script>

<svelte:head>
	<title>Semua Pelatihan — Aristotle Platform</title>
	<meta
		name="description"
		content="Katalog lengkap pelatihan mikrokredensial Aristotle: info, rating, periode, dan kurikulum."
	/>
</svelte:head>

<!-- Navbar publik (selaras landing page) -->
<header class="sticky top-0 z-50 bg-white shadow-sm">
	<div class="mx-auto flex h-20 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
		<a href="/" class="flex shrink-0 items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-blue-600" aria-label="Aristotle - Beranda">
			<Logo size="md" showText={true} textSize="xl" />
		</a>
		<nav aria-label="Navigasi utama" class="hidden min-w-0 flex-1 items-center justify-center gap-5 font-semibold text-[13px] text-slate-700 lg:flex xl:gap-7">
			<a href="/#beranda" class="whitespace-nowrap transition-colors duration-200 ease-smooth hover:text-blue-600">BERANDA</a>
			<a href="/modules" aria-current="page" class="whitespace-nowrap text-blue-600 transition-colors duration-200 ease-smooth hover:text-blue-700">PELATIHAN</a>
			<a href="/#peringkat" class="whitespace-nowrap transition-colors duration-200 ease-smooth hover:text-blue-600">PERINGKAT</a>
			<a href="/#tentang" class="whitespace-nowrap transition-colors duration-200 ease-smooth hover:text-blue-600">TENTANG</a>
			<a href="/#verifikasi" class="whitespace-nowrap transition-colors duration-200 ease-smooth hover:text-blue-600">VERIFIKASI</a>
		</nav>
		<div class="hidden shrink-0 items-center gap-2 rounded-full border border-slate-200 bg-slate-100 py-1.5 pr-2 pl-4 xl:flex">
			<label for="modules-nav-search" class="sr-only">Cari program mikrokredensial</label>
			<input id="modules-nav-search" type="search" placeholder="Cari program..." class="w-40 bg-transparent text-xs text-slate-700 focus:outline-none" />
			<span class="flex h-7 w-7 items-center justify-center rounded-full bg-white" aria-hidden="true">
				<img src={logoUrl} alt="" aria-hidden="true" class="h-5 w-5 rounded-full object-cover" />
			</span>
		</div>
		<div class="hidden shrink-0 items-center gap-2.5 sm:flex">
			<a
				href="/login"
				class="inline-flex min-h-[44px] items-center justify-center rounded-full border border-blue-600 px-5 text-xs font-bold whitespace-nowrap text-blue-700 uppercase transition-all duration-200 ease-smooth hover:bg-blue-50 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
			>
				Masuk
			</a>
			<a
				href="/register"
				class="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-blue-600 px-5 text-xs font-bold whitespace-nowrap text-white uppercase shadow-lg shadow-blue-500/25 transition-all duration-200 ease-smooth hover:bg-blue-700 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
			>
				Mulai Belajar
				<i class="fa-solid fa-arrow-right text-[11px]" aria-hidden="true"></i>
			</a>
		</div>
		<button
			type="button"
			onclick={() => (menuOpen = !menuOpen)}
			aria-expanded={menuOpen}
			aria-controls="mobile-nav"
			aria-label={menuOpen ? 'Tutup menu navigasi' : 'Buka menu navigasi'}
			class="flex min-h-11 min-w-11 items-center justify-center rounded-xl p-2 text-slate-700 transition-colors duration-200 ease-smooth hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-600 lg:hidden"
		>
			<i class={`fa-solid ${menuOpen ? 'fa-xmark' : 'fa-bars'} text-xl`} aria-hidden="true"></i>
		</button>
	</div>
	<nav
		id="mobile-nav"
		aria-label="Navigasi seluler"
		inert={!menuOpen}
		class={`grid transition-[grid-template-rows,visibility] duration-300 ease-smooth lg:hidden ${menuOpen ? 'grid-rows-[1fr] visible' : 'grid-rows-[0fr] invisible'}`}
	>
		<div class="min-h-0 overflow-hidden">
			<div class="border-t border-slate-100 bg-white px-4 pt-2 pb-5 sm:px-6">
				<ul class="divide-y divide-slate-100 text-sm font-semibold text-slate-700">
					{#each mobileLinks as link (link.href)}
						<li>
							<a
								href={link.href}
								onclick={() => (menuOpen = false)}
								aria-current={link.href === '/modules' ? 'page' : undefined}
								class="block rounded-lg px-2 py-3 uppercase tracking-wide transition-colors duration-200 ease-smooth hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
							>
								{link.label}
							</a>
						</li>
					{/each}
				</ul>
				<div class="mt-3 grid grid-cols-2 gap-2.5 sm:hidden">
					<a
						href="/login"
						class="inline-flex min-h-[44px] items-center justify-center rounded-full border border-blue-600 px-4 text-xs font-bold text-blue-700 uppercase transition-all duration-200 ease-smooth hover:bg-blue-50 active:scale-[0.98]"
					>
						Masuk
					</a>
					<a
						href="/register"
						class="inline-flex min-h-[44px] items-center justify-center rounded-full bg-blue-600 px-4 text-xs font-bold text-white uppercase shadow-lg shadow-blue-500/25 transition-all duration-200 ease-smooth hover:bg-blue-700 active:scale-[0.98]"
					>
						Mulai Belajar
					</a>
				</div>
			</div>
		</div>
	</nav>
</header>

<main>
	<!-- Hero -->
	<section class="relative overflow-hidden bg-gradient-to-br from-blue-50 via-cyan-50/30 to-white py-14">
		<div class="pointer-events-none absolute top-0 right-10 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" aria-hidden="true"></div>
		<div class="relative mx-auto max-w-7xl animate-rise px-4 sm:px-6 lg:px-8">
			<nav aria-label="Breadcrumb" class="mb-3 flex items-center gap-2 text-xs text-slate-500">
				<a href="/" class="rounded font-semibold text-blue-600 hover:text-blue-700">Beranda</a>
				<i class="fa-solid fa-chevron-right text-[10px] text-slate-300" aria-hidden="true"></i>
				<span aria-current="page" class="font-medium text-slate-700">Semua Pelatihan</span>
			</nav>
			<span class="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700 uppercase">
				<i class="fa-solid fa-book-bookmark" aria-hidden="true"></i> Katalog Pelatihan
			</span>
			<h1 class="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
				Semua Pelatihan Mikrokredensial
			</h1>
			<p class="mt-2 max-w-2xl text-sm text-slate-600 sm:text-base">
				Jelajahi seluruh program: rating, periode batch, jumlah modul dan materi.</p>
		</div>
	</section>

	<!-- Katalog -->
	<section class="bg-white py-12">
		<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
			<div class="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center">
				<div class="relative max-w-md flex-1">
					<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
						<i class="fa-solid fa-magnifying-glass text-sm" aria-hidden="true"></i>
					</div>
					<label for="modules-search" class="sr-only">Cari pelatihan</label>
					<input
						id="modules-search"
						type="search"
						bind:value={search}
						placeholder="Cari judul pelatihan atau instruktur..."
						class="w-full rounded-xl border border-slate-200 bg-white py-2.5 pr-4 pl-10 text-sm text-slate-800 placeholder:text-slate-400 transition-all duration-200 ease-smooth focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
					/>
				</div>
				<div class="flex flex-wrap gap-2" role="group" aria-label="Filter kategori">
					{#each categories as cat (cat)}
						<button
							type="button"
							onclick={() => (activeCategory = cat)}
							aria-pressed={activeCategory === cat}
							class={`rounded-xl px-4 py-2 text-xs font-bold transition-all duration-200 ease-smooth active:scale-95 focus-visible:outline-2 focus-visible:outline-blue-600 ${
								activeCategory === cat
									? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
									: 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
							}`}
						>
							{cat}
						</button>
					{/each}
				</div>
			</div>
			<div class="mb-6 flex flex-wrap gap-2" role="group" aria-label="Filter periode pelatihan">
				{#each periodFilters as pf (pf.value)}
					<button
						type="button"
						onclick={() => (activePeriod = pf.value)}
						aria-pressed={activePeriod === pf.value}
						class={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition-all duration-200 ease-smooth active:scale-95 focus-visible:outline-2 focus-visible:outline-blue-600 ${
							activePeriod === pf.value
								? 'bg-slate-900 text-white shadow-lg'
								: 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
						}`}
					>
						{#if pf.value !== 'all'}
							<i class={`fa-solid ${periodIcon(pf.value)} text-[10px]`} aria-hidden="true"></i>
						{/if}
						{pf.label}
					</button>
				{/each}
			</div>

			<p class="mb-4 text-xs font-medium text-slate-500" role="status">
				Menampilkan {filtered.length} dari {courses.length} pelatihan
			</p>

			{#if filtered.length === 0}
				<div class="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
					<i class="fa-solid fa-magnifying-glass mb-3 text-3xl text-slate-300" aria-hidden="true"></i>
					<p class="text-sm font-semibold text-slate-700">Pelatihan tidak ditemukan.</p>
					<p class="mt-1 text-xs text-slate-500">Coba kata kunci, kategori, atau periode lain.</p>
				</div>
			{:else}
				<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
					{#each filtered as course (course.id)}
						{@const meta = getCourseMeta(course.id)}
						<article class="group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-300 ease-smooth hover:-translate-y-1 hover:shadow-xl">
							<div class="relative overflow-hidden" aria-hidden="true">
								<img
									src={course.image}
									alt=""
									class="h-44 w-full object-cover transition-transform duration-700 ease-smooth group-hover:scale-105"
									loading="lazy"
								/>
								<span class="absolute top-3 left-3 rounded-md bg-red-600 px-3 py-1 text-[10px] font-extrabold text-white uppercase">
									{course.duration}
								</span>
								<span class={`absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[10px] font-extrabold uppercase ${periodBadgeClass(meta.period)}`}>
									<i class={`fa-solid ${periodIcon(meta.period)}`} aria-hidden="true"></i>
									{periodShort(meta)}
								</span>
							</div>
							<div class="flex flex-1 flex-col justify-between space-y-4 p-5">
								<div>
									<div class="mb-2 flex items-center justify-between text-xs text-slate-500">
										<span class="flex items-center gap-1">
											<i class="fa-regular fa-star text-amber-400" aria-hidden="true"></i>
											<span><strong class="text-slate-700">{meta.rating}</strong> ({meta.reviews})</span>
										</span>
										<span class="flex items-center gap-1">
											<i class="fa-regular fa-clock" aria-hidden="true"></i>
											{course.totalMaterials} Materi
										</span>
									</div>
									<p class="text-[11px] font-bold tracking-wide text-blue-600 uppercase">
										{course.category} · {course.level}
									</p>
									<h2 class="mt-1 line-clamp-2 text-base leading-snug font-extrabold text-slate-900">
										<a href={`/modules/${course.id}`} class="rounded transition-colors duration-200 ease-smooth group-hover:text-blue-600 focus-visible:outline-2 focus-visible:outline-blue-600 after:absolute after:inset-0" aria-label={`Lihat info singkat: ${course.title}`}>{course.title}</a>
									</h2>
									<p class="mt-1 line-clamp-2 text-xs text-slate-500">
										{course.modules.length} modul · oleh {course.instructor}
									</p>
								</div>
								<div class="flex items-center justify-between border-t border-slate-100 pt-4">
									<span class="text-sm font-extrabold text-blue-600">{meta.price}</span>
									<span class="text-[11px] font-semibold text-slate-500">{meta.students.toLocaleString('id-ID')} peserta</span>
								</div>
							</div>
						</article>
					{/each}
				</div>
			{/if}
		</div>
	</section>
</main>

<footer class="border-t border-slate-800 bg-slate-900 py-8 text-center text-xs text-slate-500">
	&copy; 2026 Aristotle Platform Mikrokredensial. Semua hak dilindungi.
</footer>
