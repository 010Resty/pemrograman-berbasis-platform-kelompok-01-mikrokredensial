<script lang="ts">
	import { browser } from '$app/environment';
	import '../../app.css';
	import PublicHeader from '$lib/components/public/PublicHeader.svelte';
	import PublicFooter from '$lib/components/public/PublicFooter.svelte';
	import SeoHead from '$lib/components/SeoHead.svelte';
	import { canonicalPath, getSiteUrl } from '$lib/seo/site';
	import { reveal } from '$lib/actions/reveal';
	import Pagination from '$lib/components/Pagination.svelte';
	import { periodBadgeClass, periodIcon, type CoursePeriod } from '$lib/data/course-meta';
	import {
		fetchCourseDetail,
		fetchPublicCourseList,
		type BackendCourse
	} from '$lib/api/courses';

	/**
	 * Katalog publik dari backend (GET /courses — hanya published + archived).
	 * Pencarian, filter kategori, dan filter periode berjalan di server;
	 * paginasi lokal (maks 100 baris karena respons berupa array tanpa total).
	 * Rating/ulasan/jumlah peserta & materi tidak ada endpointnya → tidak ditampilkan.
	 * Nama pengampu hanya ada di detail kursus → dimuat per baris halaman aktif.
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
	/** Katalog awal dari server load (SSR); fetch browser hanya bila kosong/ganti filter. */
	let { data }: { data: { origin: string; catalog: BackendCourse[] } } = $props();
	// svelte-ignore state_referenced_locally -- seed SSR: snapshot awal, update via fetch browser
	let catalog = $state<BackendCourse[]>(data.catalog);
	let catalogNames = $state(new Map<number, string>());
	// svelte-ignore state_referenced_locally -- seed SSR: snapshot awal, update via fetch browser
	let loading = $state(data.catalog.length === 0);
	let loadError = $state('');
	let loadSeq = 0;
	let catalogFirstRun = true;

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
			const list = await fetchPublicCourseList({
				q: debouncedSearch.trim() || undefined,
				category: activeCategory === 'Semua' ? undefined : activeCategory,
				period: activePeriod === 'all' ? undefined : activePeriod,
				limit: 100
			});
			if (my !== loadSeq) return;
			catalog = list;
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
		// Mount pertama: data SSR sudah tampil → jangan fetch ulang (hindari flash).
		if (catalogFirstRun) {
			catalogFirstRun = false;
			if (catalog.length > 0) return;
		}
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

	const modulesJsonLd = $derived([
		{
			'@context': 'https://schema.org',
			'@type': 'CollectionPage',
			name: 'Semua Kursus Mikrokredensial ARISTOTELES',
			description:
				'Katalog lengkap kursus mikrokredensial dengan filter kategori, pencarian, dan periode batch: berjalan, akan datang, dan arsip.',
			url: canonicalPath('/modules', data.origin),
			inLanguage: 'id-ID',
			isPartOf: { '@type': 'WebSite', name: 'ARISTOTELES', url: getSiteUrl(data.origin) }
		},
		{
			'@context': 'https://schema.org',
			'@type': 'BreadcrumbList',
			itemListElement: [
				{ '@type': 'ListItem', position: 1, name: 'Beranda', item: canonicalPath('/', data.origin) },
				{ '@type': 'ListItem', position: 2, name: 'Semua Pelatihan', item: canonicalPath('/modules', data.origin) }
			]
		}
	]);
</script>

<SeoHead
	title="Semua Kursus Mikrokredensial — Katalog ARISTOTELES"
	description="Katalog lengkap kursus online mikrokredensial ARISTOTELES. Cari berdasar kategori & periode batch, lihat kurikulum, daftar dan raih sertifikat."
	path="/modules"
	origin={data.origin}
	jsonLd={modulesJsonLd}
/>

<!-- Navbar publik bersama (sama dengan halaman Promo/Pelatihan/Peringkat/Tentang/Verifikasi) -->
<PublicHeader active="pelatihan" />

<main>
	<!-- Hero -->
	<section class="relative overflow-hidden bg-white">
		<div class="pointer-events-none absolute inset-0" aria-hidden="true">
			<div class="absolute -top-32 right-[10%] h-72 w-72 rounded-full bg-ice blur-3xl"></div>
		</div>
		<div class="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
			<p class="flex items-center gap-3 font-heading text-xs font-bold tracking-[0.18em] text-royal uppercase">
				<span class="h-px w-8 bg-royal" aria-hidden="true"></span>
				Katalog Pelatihan
			</p>
			<h1 class="mt-3 max-w-2xl font-heading text-4xl font-extrabold tracking-tight text-abyss sm:text-5xl">
				Semua pelatihan mikrokredensial
			</h1>
			<p class="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
				Jelajahi seluruh program: kategori, periode batch, dan informasi akses.</p>
		</div>
	</section>

	<!-- Katalog -->
	<section class="border-t border-mist bg-white py-12">
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
						placeholder="Cari judul atau deskripsi pelatihan..."
						autocomplete="off"
						class="w-full rounded-xl border border-mist bg-white py-2.5 pr-4 pl-10 text-sm text-slate-800 placeholder:text-slate-400 transition-colors duration-200 focus:border-royal focus:ring-2 focus:ring-royal/20 focus:outline-none"
					/>
				</div>
				<div class="flex flex-wrap gap-2" role="group" aria-label="Filter kategori">
					{#each ['Semua', ...CATEGORIES] as cat (cat)}
						<button
							type="button"
							onclick={() => (activeCategory = cat)}
							aria-pressed={activeCategory === cat}
							class={`rounded-xl px-4 py-2 font-heading text-xs font-bold transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-royal ${
								activeCategory === cat
									? 'bg-abyss text-white'
									: 'border border-mist bg-white text-slate-600 hover:border-royal hover:text-royal'
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
						class={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 font-heading text-xs font-bold transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-royal ${
							activePeriod === pf.value
								? 'bg-abyss text-white'
								: 'border border-mist bg-white text-slate-600 hover:border-royal hover:text-royal'
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
				Menampilkan {catalog.length} pelatihan
				{#if !loading && !loadError && catalog.length >= 100}
					<span class="text-slate-400">(maks 100 pertama — persempit pencarian bila kurang)</span>
				{/if}
			</p>

			{#if loading}
				<div class="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" aria-label="Memuat katalog">
					{#each [1, 2, 3, 4, 5, 6, 7, 8] as i (i)}
						<div class="overflow-hidden rounded-2xl border border-mist bg-white">
							<div class="h-44 animate-pulse bg-ice"></div>
							<div class="space-y-2 p-5">
								<div class="h-4 w-3/4 animate-pulse rounded bg-ice"></div>
								<div class="h-3 w-1/2 animate-pulse rounded bg-ice"></div>
							</div>
						</div>
					{/each}
				</div>
			{:else if loadError}
				<div role="alert" class="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
					<p class="font-heading text-sm font-bold text-red-700">Katalog belum dapat dimuat</p>
					<p class="mx-auto mt-1 max-w-md text-xs text-red-600">{loadError}</p>
					<button
						type="button"
						onclick={() => void load()}
						class="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-royal px-5 py-2.5 font-heading text-xs font-bold text-white transition-colors duration-200 hover:bg-royal-hover focus-visible:outline-2 focus-visible:outline-royal"
					>
						<i class="fa-solid fa-rotate-right" aria-hidden="true"></i> Coba lagi
					</button>
				</div>
			{:else if catalog.length === 0}
				<div class="rounded-2xl border border-dashed border-mist bg-white p-12 text-center">
					<i class="fa-solid fa-magnifying-glass mb-3 text-3xl text-slate-300" aria-hidden="true"></i>
					<p class="font-heading text-sm font-bold text-abyss">Pelatihan tidak ditemukan.</p>
					<p class="mt-1 text-xs text-slate-500">Coba kata kunci, kategori, atau periode lain.</p>
				</div>
			{:else}
				<div class="overflow-hidden rounded-2xl border border-mist bg-white">
					<div class="grid grid-cols-1 gap-5 p-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
						{#each paged as course, i (course.id)}
							{@const period = coursePeriod(course)}
							<article use:reveal={{ delay: (i % 4) * 60 }} class="group relative flex flex-col overflow-hidden rounded-2xl border border-mist bg-white transition-all duration-200 hover:-translate-y-1 hover:border-royal/40 hover:shadow-xl hover:shadow-slate-900/10">
								<div class="relative overflow-hidden" aria-hidden="true">
									<img
										src={course.image || COVER_FALLBACK}
										alt={`Kursus ${course.title} — ${course.category ?? 'mikrokredensial'} level ${course.level}`}
										class="h-44 w-full object-cover transition duration-500 group-hover:scale-[1.03]"
										loading="lazy"
									/>
									{#if course.duration}
										<span class="absolute top-3 left-3 rounded-md bg-abyss px-3 py-1 font-heading text-[10px] font-bold text-white uppercase">
											{course.duration}
										</span>
									{/if}
									<span class={`absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[10px] font-bold uppercase ${periodBadgeClass(period)}`}>
										<i class={`fa-solid ${periodIcon(period)}`} aria-hidden="true"></i>
										{periodShort(course)}
									</span>
								</div>
								<div class="flex flex-1 flex-col justify-between space-y-4 p-5">
									<div>
										<div class="mb-2 flex items-center justify-between text-xs text-slate-500">
											<span class="font-heading font-bold tracking-wide text-royal uppercase">{course.level}</span>
											{#if course.status === 'archived'}
												<span class="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500 uppercase">Arsip</span>
											{/if}
										</div>
										<p class="font-heading text-[11px] font-bold tracking-wide text-royal uppercase">
											{course.category ?? 'Umum'}
										</p>
										<h2 class="mt-1 line-clamp-2 font-heading text-base leading-snug font-bold text-abyss">
											<a href={`/modules/${course.id}`} class="rounded transition-colors duration-200 group-hover:text-royal focus-visible:outline-2 focus-visible:outline-royal after:absolute after:inset-0" aria-label={`Lihat info singkat: ${course.title}`}>{course.title}</a>
										</h2>
										<p class="mt-1 line-clamp-2 text-xs text-slate-500">
											{catalogNames.get(course.id) ?? '…'}
										</p>
									</div>
									<div class="flex items-center justify-between border-t border-mist pt-4">
										<span class="font-heading text-sm font-extrabold text-abyss">{course.priceLabel}</span>
									</div>
								</div>
							</article>
						{/each}
					</div>
					<div class="border-t border-mist bg-ice/60">
						<Pagination bind:page bind:perPage perPageOptions={[12, 24, 48]} totalItems={catalog.length} itemLabel="pelatihan" label="Navigasi halaman katalog" id="modules-pagination" />
					</div>
				</div>
			{/if}
		</div>
	</section>
</main>

<PublicFooter />
