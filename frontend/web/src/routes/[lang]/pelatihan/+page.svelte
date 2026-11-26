<script lang="ts">
	import { browser } from '$app/environment';
	import { page as routePage } from '$app/state';
	import { lp, jsonLdLang, type Locale } from '$lib/i18n/locale';
	import { t } from '$lib/i18n/index';
	import { altUrls } from '$lib/seo/site';
	import PublicHeader from '$lib/components/public/PublicHeader.svelte';
	import PublicFooter from '$lib/components/public/PublicFooter.svelte';
	import SeoHead from '$lib/components/SeoHead.svelte';
	import { canonicalPath, getSiteUrl } from '$lib/seo/site';
	import { reveal } from '$lib/actions/reveal';
	import {
		fetchCourseDetail,
		fetchPublicCourseList,
		type BackendCourse
	} from '$lib/api/courses';
	import { fetchPromos, type PromoCampaign } from '$lib/api/promos';
	import { fetchCategories, FALLBACK_CATEGORIES } from '$lib/api/categories';
	import { fileUrl } from '$lib/api/courses';
	import { buildSrcSet } from '$lib/api/responsive';
	import { toast } from '$lib/stores/toast.svelte';

	/** Samakan sampul promo tersimpan (relatif /api/...) ke URL absolut backend. */
	function promoCoverSrc(path: string | null): string {
		if (!path) return '';
		const raw = path.trim();
		if (!raw) return '';
		if (/^(data|blob):/i.test(raw)) return raw;
		try {
			return fileUrl(raw);
		} catch {
			return raw;
		}
	}

	/** Kategori resmi dari server (dikelola admin); fallback bila offline. */
	let MODUL_CATEGORIES = $state<string[]>([...FALLBACK_CATEGORIES]);
	const MODUL_LEVELS = ['Pemula', 'Menengah', 'Lanjutan'];
	const PAGE_SIZE = 10;
	const COVER_FALLBACK =
		'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=800&q=80';

	let search = $state('');
	let debouncedSearch = $state('');
	let modulCat = $state('Semua');
	let modulLevel = $state('Semua');
	/** Daftar awal dari server load (SSR); fetch browser hanya bila kosong/ganti filter. */
	let { data }: { data: { origin: string; modul: BackendCourse[] } } = $props();
	const lang: Locale = $derived(routePage.params.lang === 'en' ? 'en' : 'id');
	// svelte-ignore state_referenced_locally -- seed SSR: snapshot awal, update via fetch browser
	let modulCourses = $state<BackendCourse[]>(data.modul);
	let modulNames = $state(new Map<number, string>());
	let page = $state(1);
	// svelte-ignore state_referenced_locally -- seed SSR: snapshot awal, update via fetch browser
	let hasMore = $state(data.modul.length >= PAGE_SIZE);
	// svelte-ignore state_referenced_locally -- seed SSR: snapshot awal, update via fetch browser
	let modulLoading = $state(data.modul.length === 0);
	let modulLoadingMore = $state(false);
	let modulError = $state('');
	let modulSeq = 0;
	let modulFirstRun = true;

	let promos = $state<PromoCampaign[]>([]);
	let promoLoading = $state(true);
	let promoIndex = $state(0);

	/** Highlight carousel: maksimal 5 kampanye aktif, sampul per promo dari admin. */
	const promoHighlight = $derived(promos.slice(0, 5));
	const activePromo = $derived(
		promoHighlight.length > 0 ? promoHighlight[promoIndex % promoHighlight.length] : null
	);

	function promoPrev(): void {
		if (promoHighlight.length === 0) return;
		promoIndex = (promoIndex - 1 + promoHighlight.length) % promoHighlight.length;
	}

	function promoNext(): void {
		if (promoHighlight.length === 0) return;
		promoIndex = (promoIndex + 1) % promoHighlight.length;
	}

	function periodShort(course: BackendCourse): string {
		if (course.period === 'upcoming') return t(lang, 'catalog.periodUpcoming', { m: course.startMonth ?? '' }).trim();
		if (course.period === 'ongoing') return t(lang, 'catalog.periodOngoing');
		if (course.period === 'ended') return t(lang, 'catalog.periodEnded');
		return t(lang, 'catalog.periodDash');
	}

	function promoIcon(type: string): string {
		if (type === 'diskon') return 'fa-bolt';
		if (type === 'patungan') return 'fa-people-group';
		return 'fa-star';
	}

	async function loadPromos(): Promise<void> {
		try {
			promos = await fetchPromos();
		} catch {
			promos = [];
		} finally {
			promoLoading = false;
		}
	}

	/** Muat ulang dari halaman 1 (dipakai saat filter/pencarian berubah). */
	async function loadModul(): Promise<void> {
		const my = ++modulSeq;
		page = 1;
		hasMore = true;
		modulLoading = true;
		modulError = '';
		try {
			const list = await fetchPublicCourseList({
				q: debouncedSearch.trim() || undefined,
				category: modulCat === 'Semua' ? undefined : modulCat,
				level: modulLevel === 'Semua' ? undefined : modulLevel,
				status: 'published',
				limit: PAGE_SIZE,
				page: 1
			});
			if (my !== modulSeq) return;
			modulCourses = list;
			hasMore = list.length >= PAGE_SIZE;
			void ensureModulNames(list);
		} catch (e) {
			if (my !== modulSeq) return;
			modulError = e instanceof Error ? e.message : t(lang, 'catalog.errDefault');
			toast.error(modulError);
		} finally {
			if (my === modulSeq) modulLoading = false;
		}
	}

	/** Tambah halaman berikut tanpa menghapus daftar yang sudah tampil. */
	async function loadMore(): Promise<void> {
		if (modulLoadingMore || !hasMore) return;
		const my = ++modulSeq;
		modulLoadingMore = true;
		try {
			const list = await fetchPublicCourseList({
				q: debouncedSearch.trim() || undefined,
				category: modulCat === 'Semua' ? undefined : modulCat,
				level: modulLevel === 'Semua' ? undefined : modulLevel,
				status: 'published',
				limit: PAGE_SIZE,
				page: page + 1
			});
			if (my !== modulSeq) return;
			if (list.length > 0) {
				page = page + 1;
				modulCourses = [...modulCourses, ...list];
				void ensureModulNames(list);
			}
			if (list.length < PAGE_SIZE) hasMore = false;
		} catch (e) {
			if (my !== modulSeq) return;
			modulError = e instanceof Error ? e.message : t(lang, 'catalog.errDefault');
			toast.error(modulError);
		} finally {
			if (my === modulSeq) modulLoadingMore = false;
		}
	}

	function resetFilter(): void {
		search = '';
		debouncedSearch = '';
		modulCat = 'Semua';
		modulLevel = 'Semua';
		void loadModul();
	}

	const filterAktif = $derived(search.trim() !== '' || modulCat !== 'Semua' || modulLevel !== 'Semua');

	async function ensureModulNames(list: BackendCourse[]): Promise<void> {
		const missing = list.filter((c) => !modulNames.has(c.id));
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
		const next = new Map(modulNames);
		for (const [id, names] of entries) next.set(id, names);
		modulNames = next;
	}

	// Debounce pencarian 400 ms (pola sama dengan /modules: tanpa spam backend).
	$effect(() => {
		const q = search;
		const t = setTimeout(() => {
			if (debouncedSearch !== q) debouncedSearch = q;
		}, 400);
		return () => clearTimeout(t);
	});

	$effect(() => {
		if (!browser) return;
		void fetchCategories().then((names) => {
			if (names.length > 0) MODUL_CATEGORIES = names;
		});
	});

	$effect(() => {
		if (!browser) return;
		void debouncedSearch;
		void modulCat;
		void modulLevel;
		// Mount pertama: data SSR sudah tampil → cukup lengkapi nama pengampu + promo.
		if (modulFirstRun) {
			modulFirstRun = false;
			void loadPromos();
			if (modulCourses.length > 0) {
				void ensureModulNames(modulCourses);
				return;
			}
		}
		void loadModul();
	});

	// Carousel highlight: jaga indeks tetap valid + putar otomatis 6 detik.
	$effect(() => {
		if (promoIndex >= promoHighlight.length && promoHighlight.length > 0) promoIndex = 0;
	});
	$effect(() => {
		if (!browser || promoHighlight.length <= 1) return;
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		const id = setInterval(() => {
			promoIndex = (promoIndex + 1) % promoHighlight.length;
		}, 6000);
		return () => clearInterval(id);
	});

	const pelatihanJsonLd = $derived([
		{
			'@context': 'https://schema.org',
			'@type': 'CollectionPage',
			name: t(lang, 'catalog.schemaName'),
			description: t(lang, 'catalog.schemaDesc'),
			url: canonicalPath(lp(lang, '/pelatihan'), data.origin),
			inLanguage: jsonLdLang(lang)
		},
		{
			'@type': 'BreadcrumbList',
			itemListElement: [
				{ '@type': 'ListItem', position: 1, name: t(lang, 'common.home'), item: canonicalPath(lp(lang, '/'), data.origin) },
				{ '@type': 'ListItem', position: 2, name: t(lang, 'nav.pelatihan'), item: canonicalPath(lp(lang, '/pelatihan'), data.origin) }
			]
		}
	]);
</script>

<SeoHead
	title={t(lang, 'catalog.pageTitle')}
	description={t(lang, 'catalog.pageDesc')}
	path={lp(lang, '/pelatihan')}
	origin={data.origin}
	lang={lang}
	alternates={altUrls(lp(lang, '/pelatihan'), data.origin)}
	jsonLd={pelatihanJsonLd}
/>

<PublicHeader active="pelatihan" />

<main>
	<!-- Highlight promo: hanya sampul gambar (tanpa teks), klik → halaman promo -->
	{#if promoLoading}
		<section role="status" aria-label={t(lang, 'catalog.promoLoadingAria')} class="border-t border-mist bg-white pb-2">
			<div class="mx-auto max-w-7xl px-4 pt-10 sm:px-6 lg:px-8">
				<div class="aspect-[1600/450] animate-pulse rounded-2xl bg-ice"></div>
			</div>
		</section>
	{:else if activePromo}
		<section
			aria-roledescription="carousel"
			aria-label={t(lang, 'catalog.promoAria')}
			class="border-t border-mist bg-white pb-2"
		>
			<div class="mx-auto max-w-7xl px-4 pt-10 sm:px-6 lg:px-8">
				<div class="relative">
					{#key activePromo.slug}
						<a
							href={lp(lang, `/promo/${activePromo.slug}`)}
							class="relative block max-h-[450px] w-full overflow-hidden rounded-2xl border border-mist bg-abyss transition-shadow duration-200 hover:shadow-xl hover:shadow-slate-900/20 focus-visible:outline-2 focus-visible:outline-royal aspect-[1600/450]"
							aria-label={t(lang, 'catalog.promoView')}
						>
							{#if activePromo.coverImage}
								<img
									src={promoCoverSrc(activePromo.coverImage)}
									srcset={buildSrcSet(promoCoverSrc(activePromo.coverImage), [800, 1200, 1600]) ?? undefined}
									sizes="100vw"
									alt=""
									aria-hidden="true"
									fetchpriority="high"
									loading="eager"
									class="absolute inset-0 h-full w-full object-cover"
								/>
							{:else}
								<div class="absolute inset-0 bg-gradient-to-br from-abyss via-royal to-teal" aria-hidden="true"></div>
								<i class="fa-solid {promoIcon(activePromo.type)} absolute -right-6 -bottom-6 text-[12rem] text-white/10" aria-hidden="true"></i>
							{/if}
						</a>
					{/key}
					{#if promoHighlight.length > 1}
						<button
							type="button"
							onclick={promoPrev}
							aria-label={t(lang, 'catalog.promoPrev')}
							class="absolute top-1/2 left-3 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white backdrop-blur transition-colors duration-200 hover:bg-black/60 focus-visible:outline-2 focus-visible:outline-white"
						>
							<i class="fa-solid fa-chevron-left text-sm" aria-hidden="true"></i>
						</button>
						<button
							type="button"
							onclick={promoNext}
							aria-label={t(lang, 'catalog.promoNext')}
							class="absolute top-1/2 right-3 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white backdrop-blur transition-colors duration-200 hover:bg-black/60 focus-visible:outline-2 focus-visible:outline-white"
						>
							<i class="fa-solid fa-chevron-right text-sm" aria-hidden="true"></i>
						</button>
						<div class="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-1" role="group" aria-label={t(lang, 'catalog.promoPick')}>
							{#each promoHighlight as camp, idx (camp.slug)}
								<button
									type="button"
									aria-current={idx === promoIndex % promoHighlight.length}
									aria-label={t(lang, 'catalog.promoShowN', { i: idx + 1, n: promoHighlight.length })}
									onclick={() => {
										promoIndex = idx;
									}}
									class="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-white"
								><span class={`block h-2 rounded-full transition-all duration-200 ${idx === promoIndex % promoHighlight.length ? 'w-8 bg-white' : 'w-2 bg-white/50'}`} aria-hidden="true"></span></button>
							{/each}
						</div>
					{/if}
				</div>
			</div>
		</section>
	{/if}

	<!-- Hero -->
	<section class="relative overflow-hidden bg-white">
		<div class="pointer-events-none absolute inset-0" aria-hidden="true">
			<div class="absolute -top-32 right-[10%] h-72 w-72 rounded-full bg-ice blur-3xl"></div>
		</div>
		<div class="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
			<p class="flex items-center gap-3 font-heading text-xs font-bold tracking-[0.18em] text-royal uppercase">
				<span class="h-px w-8 bg-royal" aria-hidden="true"></span>
				{t(lang, 'catalog.heroEyebrow')}
			</p>
			<h1 class="mt-3 max-w-2xl font-heading text-4xl font-extrabold tracking-tight text-abyss sm:text-5xl">
				{t(lang, 'catalog.heroTitle')}
			</h1>
			<p class="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
				{t(lang, 'catalog.heroSub')}
			</p>
		</div>
	</section>

	<!-- Katalog: sidebar filter + grid -->
	<section aria-labelledby="pelatihan-heading" class="border-t border-mist bg-white pb-20">
		<div class="mx-auto max-w-7xl px-4 pt-10 sm:px-6 lg:px-8">
			<h2 id="pelatihan-heading" class="sr-only">{t(lang, 'catalog.listHeading')}</h2>
			<div class="grid gap-8 lg:grid-cols-[270px_1fr]">
				<aside aria-label={t(lang, 'catalog.filterLabel')} class="lg:sticky lg:top-24 lg:self-start">
					<div class="rounded-2xl border border-mist bg-white p-5 shadow-sm lg:border-0 lg:bg-slate-50 lg:p-5">
						<search>
						<div class="relative">
							<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
								<i class="fa-solid fa-magnifying-glass text-sm" aria-hidden="true"></i>
							</div>
							<label for="pelatihan-search" class="sr-only">{t(lang, 'catalog.searchLabel')}</label>
							<input
								id="pelatihan-search"
								name="q"
								type="search"
								bind:value={search}
								placeholder={t(lang, 'catalog.searchPh')}
								autocomplete="off"
								spellcheck="false"
								autocorrect="off"
								autocapitalize="none"
								enterkeyhint="search"
								class="w-full rounded-xl border border-mist bg-white py-2.5 pr-4 pl-10 text-sm text-slate-800 placeholder:text-slate-400 transition-colors duration-200 focus:border-royal focus:ring-2 focus:ring-royal/20 focus:outline-none"
							/>
						</div>
						</search>

						<fieldset class="mt-6">
							<legend class="font-heading text-xs font-bold tracking-[0.14em] text-slate-500 uppercase">
								{t(lang, 'catalog.catLabel')}
							</legend>
							<div class="mt-2 flex flex-col gap-1" role="radiogroup" aria-label={t(lang, 'catalog.catFilter')}>
								{#each ['Semua', ...MODUL_CATEGORIES] as cat (cat)}
									<button
										type="button"
										onclick={() => {
											modulCat = cat;
										}}
										role="radio"
										aria-checked={modulCat === cat}
										class={`flex min-h-[44px] items-center justify-between rounded-xl px-3.5 text-left text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-royal ${
											modulCat === cat
												? 'bg-abyss text-white'
												: 'text-slate-600 hover:bg-slate-100 hover:text-abyss'
										}`}
									>
										{cat === 'Semua' ? t(lang, 'catalog.all') : cat}
										{#if modulCat === cat}
											<i class="fa-solid fa-check text-xs" aria-hidden="true"></i>
										{/if}
									</button>
								{/each}
							</div>
						</fieldset>

						<fieldset class="mt-6">
							<legend class="font-heading text-xs font-bold tracking-[0.14em] text-slate-500 uppercase">
								{t(lang, 'catalog.levelLabel')}
							</legend>
							<div class="mt-2 flex flex-col gap-1" role="radiogroup" aria-label={t(lang, 'catalog.levelFilter')}>
								{#each ['Semua', ...MODUL_LEVELS] as lv (lv)}
									<button
										type="button"
										onclick={() => {
											modulLevel = lv;
										}}
										role="radio"
										aria-checked={modulLevel === lv}
										class={`flex min-h-[44px] items-center justify-between rounded-xl px-3.5 text-left text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-royal ${
											modulLevel === lv
												? 'bg-abyss text-white'
												: 'text-slate-600 hover:bg-slate-100 hover:text-abyss'
										}`}
									>
										{lv === 'Semua' ? t(lang, 'catalog.allLevels') : lv}
										{#if modulLevel === lv}
											<i class="fa-solid fa-check text-xs" aria-hidden="true"></i>
										{/if}
									</button>
								{/each}
							</div>
						</fieldset>

						{#if filterAktif}
							<button
								type="button"
								onclick={resetFilter}
								class="mt-6 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-mist bg-white px-4 text-xs font-bold text-slate-600 transition-colors duration-200 hover:border-royal hover:text-royal focus-visible:outline-2 focus-visible:outline-royal"
							>
								<i class="fa-solid fa-rotate-left" aria-hidden="true"></i> {t(lang, 'catalog.reset')}
							</button>
						{/if}
					</div>
				</aside>

				<div class="min-w-0">
					<p class="mb-4 text-xs font-medium text-slate-500" role="status">
						{#if debouncedSearch.trim()}
							{t(lang, 'catalog.resultsFor', { q: debouncedSearch.trim(), n: modulCourses.length })}
						{:else}
							{t(lang, 'catalog.showing', { n: modulCourses.length })}
						{/if}
					</p>

					{#if modulLoading}
						<div class="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3" role="status" aria-label={t(lang, 'catalog.loadingAria')}>
							{#each [1, 2, 3, 4, 5, 6] as i (i)}
								<div class="overflow-hidden rounded-2xl border border-mist bg-white">
									<div class="h-44 animate-pulse bg-ice"></div>
									<div class="space-y-2 p-6">
										<div class="h-4 w-3/4 animate-pulse rounded bg-ice"></div>
										<div class="h-3 w-1/2 animate-pulse rounded bg-ice"></div>
									</div>
								</div>
							{/each}
						</div>
					{:else if modulError}
						<div role="alert" class="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
							<p class="font-heading text-sm font-bold text-red-700">{t(lang, 'catalog.errTitle')}</p>
							<p class="mx-auto mt-1 max-w-md text-xs text-red-600">{modulError}</p>
							<button
								type="button"
								onclick={() => void loadModul()}
								class="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-red-600 px-5 font-heading text-xs font-bold text-white transition-colors duration-200 hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-red-600"
							>
								<i class="fa-solid fa-rotate-right" aria-hidden="true"></i> {t(lang, 'catalog.retry')}
							</button>
						</div>
					{:else if modulCourses.length === 0}
						<div class="rounded-2xl border border-dashed border-mist bg-white p-12 text-center">
							<i class="fa-solid fa-magnifying-glass mb-3 text-3xl text-slate-300" aria-hidden="true"></i>
							<p class="font-heading text-sm font-bold text-abyss">{t(lang, 'catalog.emptyTitle')}</p>
							<p class="mt-1 text-xs text-slate-500">
								{#if debouncedSearch.trim() || modulCat !== 'Semua' || modulLevel !== 'Semua'}
									{t(lang, 'catalog.emptyHintFiltered')}
								{:else}
									{t(lang, 'catalog.emptyHintNone')}
								{/if}
							</p>
							{#if filterAktif}
								<button
									type="button"
									onclick={resetFilter}
									class="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-mist bg-white px-5 font-heading text-xs font-bold text-slate-600 transition-colors duration-200 hover:border-royal hover:text-royal focus-visible:outline-2 focus-visible:outline-royal"
								>
									<i class="fa-solid fa-rotate-left" aria-hidden="true"></i> {t(lang, 'catalog.reset')}
								</button>
							{/if}
						</div>
					{:else}
						<div class="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
							{#each modulCourses as course, i (course.id)}
								<article
									use:reveal={{ delay: (i % 6) * 50 }}
									class="group relative flex flex-col overflow-hidden rounded-2xl border border-mist bg-white transition-all duration-200 hover:-translate-y-1 hover:border-royal/40 hover:shadow-xl hover:shadow-slate-900/10"
								>
									<div class="relative overflow-hidden" aria-hidden="true">
										<img
											src={course.image || COVER_FALLBACK}
											srcset={course.image
												? (buildSrcSet(fileUrl(course.image), [400, 800]) ?? undefined)
												: undefined}
											sizes="(max-width: 768px) 100vw, 33vw"
											alt={t(lang, 'catalog.cardAlt', { title: course.title, cat: course.category ?? t(lang, 'catalog.fallbackCat') })}
											class="h-44 w-full object-cover transition duration-500 group-hover:scale-[1.03]"
											loading="lazy"
											decoding="async"
										/>
										{#if course.duration}
											<span
												class="absolute top-3 left-3 rounded-md bg-abyss px-3 py-1 font-heading text-xs font-bold text-white uppercase"
												>{course.duration}</span
											>
										{/if}
									</div>
									<div class="flex flex-1 flex-col justify-between space-y-4 p-5">
										<div>
											<div class="mb-2 flex items-center justify-between text-xs text-slate-500">
												<span class="font-heading font-bold tracking-wide text-blue-700 uppercase">{course.level}</span>
												<span class="flex items-center gap-1"
													><i class="fa-regular fa-clock" aria-hidden="true"></i> {periodShort(course)}</span
												>
											</div>
											<h3 class="font-heading text-base leading-snug font-bold text-abyss">
												<a
													href={lp(lang, `/modules/${course.id}`)}
													class="rounded transition-colors duration-200 group-hover:text-royal focus-visible:outline-2 focus-visible:outline-royal after:absolute after:inset-0"
													aria-label={t(lang, 'catalog.cardAria', { title: course.title })}
													>{course.title}</a
												>
											</h3>
											<p class="mt-1 text-xs text-slate-500">
												{course.category ?? t(lang, 'catalog.fallbackCat')}
											</p>
										</div>
										<div class="flex items-center justify-between border-t border-mist pt-4">
											<span class="text-xs font-semibold text-slate-600">{modulNames.get(course.id) ?? '…'}</span>
											<span class="font-heading text-sm font-extrabold text-abyss">{course.priceLabel}</span>
										</div>
									</div>
								</article>
							{/each}
						</div>
						<div class="mt-8 text-center">
							{#if hasMore}
								<button
									type="button"
									onclick={() => void loadMore()}
									disabled={modulLoadingMore}
									class="inline-flex min-h-[52px] items-center gap-2 rounded-xl bg-abyss px-8 font-heading text-sm font-bold text-white transition-colors duration-200 hover:bg-royal disabled:cursor-wait disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal"
								>
									{#if modulLoadingMore}
										<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i> {t(lang, 'catalog.loadingMore')}
									{:else}
										{t(lang, 'catalog.loadMore')} <i class="fa-solid fa-arrow-down text-xs" aria-hidden="true"></i>
									{/if}
								</button>
							{:else if modulCourses.length > 0}
								<p class="text-xs font-semibold text-slate-400">
									{t(lang, 'catalog.allShown', { n: modulCourses.length })}
								</p>
							{/if}
						</div>
					{/if}
				</div>
			</div>
		</div>
	</section>
</main>

<PublicFooter />
