<script lang="ts">
	import { browser } from '$app/environment';
	import Pagination from '$lib/components/Pagination.svelte';
	import { periodBadgeClass, periodIcon, type CoursePeriod } from '$lib/data/course-meta';
	import {
		fetchCourseDetail,
		fetchPublicCourseList,
		type BackendCourse
	} from '$lib/api/courses';
	import { fetchMyEnrollments } from '$lib/api/progress';
	import { ownedCourses, setServerCourseFlags } from '$lib/stores/enrollment.svelte';

	/**
	 * Katalog peserta dari backend (GET /courses — hanya published + archived).
	 * Pencarian, filter kategori, dan filter periode berjalan di server;
	 * paginasi lokal (maks 100 baris karena respons berupa array tanpa total).
	 * Rating/ulasan/jumlah peserta & materi tidak ada endpointnya → tidak ditampilkan.
	 * Nama pengampu hanya ada di detail kursus → dimuat per baris halaman aktif.
	 * Lencana "Diikuti" dari GET /me/enrollments (digabung milik lokal);
	 * "Berbayar" dari priceNominal baris (> 0).
	 */

	const CATEGORIES = [
		'Pengembangan Web',
		'Basis Data',
		'Jaringan',
		'Keamanan',
		'AI & Data',
		'Infrastruktur',
		'Desain',
		'Bisnis'
	];
	const COVER_FALLBACK =
		'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=800&q=80';

	let search = $state('');
	let debouncedSearch = $state('');
	let activeCategory = $state('Semua');
	let activePeriod = $state<'all' | CoursePeriod>('all');
	let page = $state(1);
	let perPage = $state(12);
	let catalog = $state<BackendCourse[]>([]);
	let catalogNames = $state(new Map<number, string>());
	let enrolledIds = $state(new Set<number>());
	let loading = $state(true);
	let loadError = $state('');
	let loadSeq = 0;

	const periodFilters: { value: 'all' | CoursePeriod; label: string }[] = [
		{ value: 'all', label: 'Semua Periode' },
		{ value: 'ongoing', label: 'Sedang Berjalan' },
		{ value: 'upcoming', label: 'Akan Datang' },
		{ value: 'ended', label: 'Sudah Lewat' }
	];

	async function load(): Promise<void> {
		const my = ++loadSeq;
		loading = true;
		loadError = '';
		try {
			const [list, mine] = await Promise.all([
				fetchPublicCourseList({
					q: debouncedSearch.trim() || undefined,
					category: activeCategory === 'Semua' ? undefined : activeCategory,
					period: activePeriod === 'all' ? undefined : activePeriod,
					limit: 100
				}),
				fetchMyEnrollments().catch(() => [] as { courseId: number; status: string }[])
			]);
			if (my !== loadSeq) return;
			catalog = list;
			for (const c of list) {
				setServerCourseFlags(c.id, {
					paid: (c.priceNominal ?? 0) > 0,
					upcoming: c.period === 'upcoming'
				});
			}
			enrolledIds = new Set(
				mine.filter((e) => e.status === 'active' || e.status === 'completed').map((e) => e.courseId)
			);
			page = 1;
		} catch (e) {
			if (my !== loadSeq) return;
			loadError = e instanceof Error ? e.message : 'Gagal memuat katalog.';
		} finally {
			if (my === loadSeq) loading = false;
		}
	}

	const paged = $derived(catalog.slice((page - 1) * perPage, page * perPage));

	/** Nama pengampu per baris halaman aktif (satu-satunya sumber: detail kursus). */
	async function ensureNames(list: BackendCourse[]): Promise<void> {
		const missing = list.filter((c) => !catalogNames.has(c.id));
		if (missing.length === 0) return;
		const entries = await Promise.all(
			missing.map(async (c) => {
				try {
					const d = await fetchCourseDetail(c.id);
					return [c.id, (d.instructors ?? []).map((i) => i.name).join(', ') || '—'] as const;
				} catch {
					return [c.id, '—'] as const;
				}
			})
		);
		const next = new Map(catalogNames);
		for (const [id, names] of entries) next.set(id, names);
		catalogNames = next;
	}

	function isEnrolled(c: BackendCourse): boolean {
		return enrolledIds.has(c.id) || ownedCourses.has(c.id);
	}

	function isPaid(c: BackendCourse): boolean {
		return (c.priceNominal ?? 0) > 0;
	}

	// Debounce pencarian 400 ms.
	$effect(() => {
		const q = search;
		const t = setTimeout(() => {
			if (debouncedSearch !== q) debouncedSearch = q;
		}, 400);
		return () => clearTimeout(t);
	});

	$effect(() => {
		if (!browser) return;
		void debouncedSearch;
		void activeCategory;
		void activePeriod;
		void load();
	});

	$effect(() => {
		if (!browser || loading || loadError) return;
		void page;
		void perPage;
		void catalog;
		void ensureNames(paged);
	});

	$effect(() => {
		const maxPage = Math.max(1, Math.ceil(catalog.length / perPage));
		if (page > maxPage) page = maxPage;
	});

	function periodShort(course: BackendCourse): string {
		if (course.period === 'upcoming') return `Mulai ${course.startMonth ?? ''}`.trim();
		if (course.period === 'ongoing') return 'Berjalan';
		if (course.period === 'ended') return 'Lewat';
		return '—';
	}

	function coursePeriod(course: BackendCourse): CoursePeriod {
		return course.period === 'upcoming' || course.period === 'ended' ? course.period : 'ongoing';
	}
</script>

<svelte:head>
	<title>Semua Kursus — Aristoteles Platform</title>
	<meta
		name="description"
		content="Katalog semua kursus mikrokredensial Aristoteles yang dapat diikuti."
	/>
</svelte:head>

<div class="p-4 sm:p-6 lg:p-8">
	<div class="mb-6">
		<p class="text-xs font-bold tracking-widest text-blue-600 uppercase">
			Menu Utama · Semua Kursus
		</p>
		<h1 class="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Semua Kursus</h1>
		<p class="mt-1 text-sm text-slate-500">
			Klik kartu untuk melihat pratinjau: info, modul, dan materi.
		</p>
	</div>

	<!-- Search + filter -->
	<div class="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center">
		<div class="relative max-w-md flex-1">
			<div
				class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400"
			>
				<i class="fa-solid fa-magnifying-glass text-sm" aria-hidden="true"></i>
			</div>
			<label for="catalog-search" class="sr-only">Cari kursus</label>
			<input
				id="catalog-search"
				type="search"
				bind:value={search}
				placeholder="Cari judul atau deskripsi kursus..."
				autocomplete="off"
				class="w-full rounded-xl border border-slate-200 bg-white py-2.5 pr-4 pl-10 text-sm text-slate-800 placeholder:text-slate-400 transition-all duration-200 ease-smooth focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
			/>
		</div>
		<div class="flex flex-wrap gap-2" role="group" aria-label="Filter kategori">
			{#each ['Semua', ...CATEGORIES] as cat (cat)}
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
						? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
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
		Menampilkan {catalog.length} kursus
		{#if !loading && !loadError && catalog.length >= 100}
			<span class="text-slate-400">(maks 100 pertama — persempit pencarian bila kurang)</span>
		{/if}
	</p>

	{#if loading}
		<div class="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3" aria-label="Memuat katalog">
			{#each [1, 2, 3, 4, 5, 6] as i (i)}
				<div class="overflow-hidden rounded-2xl border border-slate-200 bg-white">
					<div class="h-48 animate-pulse bg-slate-100"></div>
					<div class="space-y-2 p-6">
						<div class="h-4 w-3/4 animate-pulse rounded bg-slate-100"></div>
						<div class="h-3 w-1/2 animate-pulse rounded bg-slate-100"></div>
					</div>
				</div>
			{/each}
		</div>
	{:else if loadError}
		<div role="alert" class="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
			<p class="text-sm font-bold text-red-700">Katalog belum dapat dimuat</p>
			<p class="mx-auto mt-1 max-w-md text-xs text-red-600">{loadError}</p>
			<button
				type="button"
				onclick={() => void load()}
				class="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-red-600"
			>
				<i class="fa-solid fa-rotate-right" aria-hidden="true"></i> Coba lagi
			</button>
		</div>
	{:else if catalog.length === 0}
		<div class="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
			<i class="fa-solid fa-magnifying-glass mb-3 text-3xl text-slate-300" aria-hidden="true"></i>
			<p class="text-sm font-semibold text-slate-700">Kursus tidak ditemukan.</p>
			<p class="mt-1 text-xs text-slate-500">Coba kata kunci atau kategori lain.</p>
		</div>
	{:else}
		<div class="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm">
			<div class="grid grid-cols-1 gap-6 p-5 md:grid-cols-2 xl:grid-cols-3">
				{#each paged as course (course.id)}
					{@const enrolled = isEnrolled(course)}
					{@const paid = isPaid(course)}
					{@const period = coursePeriod(course)}
					<article
						class="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-300 ease-smooth hover:-translate-y-1 hover:shadow-xl"
					>
						<a
							href={`/user/semua-kursus/${course.id}`}
							class="relative block overflow-hidden focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-600"
							aria-label={`Lihat pratinjau: ${course.title}`}
						>
							<img
								src={course.image || COVER_FALLBACK}
								alt={`Sampul kursus ${course.title}`}
								class="h-48 w-full object-cover transition-transform duration-700 ease-smooth group-hover:scale-105"
								loading="lazy"
							/>
							{#if course.duration}
								<span
									class="absolute top-3 left-3 rounded-md bg-red-600 px-3 py-1 text-[10px] font-extrabold text-white uppercase"
								>
									{course.duration}
								</span>
							{/if}
							<span
								class={`absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[10px] font-extrabold uppercase ${periodBadgeClass(period)}`}
							>
								<i class={`fa-solid ${periodIcon(period)}`} aria-hidden="true"></i>
								{periodShort(course)}
							</span>
							{#if enrolled}
								<span
									class="absolute top-3 right-3 inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-[10px] font-bold text-white"
								>
									<i class="fa-solid fa-check" aria-hidden="true"></i> Diikuti
								</span>
							{:else if paid}
								<span
									class="absolute top-3 right-3 inline-flex items-center gap-1 rounded-md bg-amber-400 px-2.5 py-1 text-[10px] font-bold text-slate-900"
								>
									<i class="fa-solid fa-lock" aria-hidden="true"></i> Berbayar
								</span>
							{/if}
						</a>
						<div class="flex flex-1 flex-col justify-between space-y-4 p-6">
							<div>
								<div class="mb-2 flex items-center justify-between text-xs text-slate-500">
									<span class="font-bold tracking-wide text-blue-600 uppercase">{course.level}</span>
									{#if course.status === 'archived'}
										<span class="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500 uppercase">Arsip</span>
									{/if}
								</div>
								<p class="text-[11px] font-bold tracking-wide text-blue-600 uppercase">
									{course.category ?? 'Umum'}
								</p>
								<h2 class="mt-1 line-clamp-2 text-base leading-snug font-extrabold text-slate-900">
									<a
										href={`/user/semua-kursus/${course.id}`}
										class="rounded transition-colors duration-200 ease-smooth group-hover:text-blue-600 focus-visible:outline-2 focus-visible:outline-blue-600"
									>
										{course.title}
									</a>
								</h2>
								<p class="mt-1 line-clamp-1 text-xs text-slate-500">
									{catalogNames.get(course.id) ?? '…'}
								</p>
							</div>
							<div class="flex items-center justify-between border-t border-slate-100 pt-4">
								<span class="text-sm font-extrabold text-blue-600">{course.priceLabel}</span>
							</div>
							<a
								href={`/user/semua-kursus/${course.id}`}
								class="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white transition-all duration-200 ease-smooth hover:bg-blue-700 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-blue-600"
							>
								<i class="fa-solid fa-eye" aria-hidden="true"></i>
								{enrolled ? 'Lihat Detail & Lanjut' : 'Lihat Pratinjau'}
							</a>
						</div>
					</article>
				{/each}
			</div>
			<div class="border-t border-slate-100 bg-slate-50/70">
				<Pagination bind:page bind:perPage perPageOptions={[12, 24, 48]} totalItems={catalog.length} itemLabel="kursus" label="Navigasi halaman katalog" id="catalog-pagination" />
			</div>
		</div>
	{/if}
</div>
