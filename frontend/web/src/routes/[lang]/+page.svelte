<script lang="ts">
	import { browser } from '$app/environment';
	import { page } from '$app/state';
	import { lp, jsonLdLang, type Locale } from '$lib/i18n/locale';
	import { t, ta } from '$lib/i18n/index';
	import { altUrls } from '$lib/seo/site';
	import PublicHeader from '$lib/components/public/PublicHeader.svelte';
	import PublicFooter from '$lib/components/public/PublicFooter.svelte';
	import SeoHead from '$lib/components/SeoHead.svelte';
	import dropdownBg from '$lib/assets/dropdown-background.jpg';
	import { canonicalPath, getSiteUrl } from '$lib/seo/site';
	import { reveal } from '$lib/actions/reveal';
	import { toast } from '$lib/stores/toast.svelte';
	import {
		fetchCourseDetail,
		fetchPublicCourseList,
		type BackendCourse
	} from '$lib/api/courses';
	import { fileUrl } from '$lib/api/courses';
	import { buildSrcSet } from '$lib/api/responsive';

	const COVER_FALLBACK =
		'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=800&q=80';

	/* ---------- Sorotan beranda (hero + keunggulan + promosi instruktur) ---------- */
	/** Data awal dari server load (SSR) agar crawler menerima konten, bukan skeleton. */
	let { data }: { data: { origin: string; spot: BackendCourse[] } } = $props();
	const lang: Locale = $derived(page.params.lang === 'en' ? 'en' : 'id');
	// svelte-ignore state_referenced_locally -- seed SSR: snapshot awal, update via fetch browser
	let spotCourses = $state<BackendCourse[]>(data.spot);
	let instructorNames = $state(new Map<number, string>());
	// svelte-ignore state_referenced_locally -- seed SSR: snapshot awal, update via fetch browser
	let spotLoading = $state(data.spot.length === 0);
	let spotError = $state('');
	let spotSeq = 0;

	async function ensureInstructorNames(list: Array<{ id: number }>): Promise<void> {
		const missing = list.filter((c) => !instructorNames.has(c.id));
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
		const next = new Map(instructorNames);
		for (const [id, names] of entries) next.set(id, names);
		instructorNames = next;
	}

	async function loadSorotan(): Promise<void> {
		const my = ++spotSeq;
		spotLoading = true;
		spotError = '';
		try {
			spotCourses = await fetchPublicCourseList({ status: 'published', limit: 12 });
			if (my !== spotSeq) return;
			void ensureInstructorNames(spotCourses.slice(0, 9));
		} catch (e) {
			if (my !== spotSeq) return;
			spotError = e instanceof Error ? e.message : t(lang, 'home.spotFailTitle');
			toast.error(spotError);
		} finally {
			if (my === spotSeq) spotLoading = false;
		}
	}

	$effect(() => {
		if (!browser) return;
		// Data server tersedia → cukup lengkapi nama pengampu progresif.
		// Kosong (backend mati saat SSR) → fetch penuh dari browser seperti semula.
		if (spotCourses.length > 0) {
			void ensureInstructorNames([...spotCourses.slice(0, 9)]);
		} else {
			void loadSorotan();
		}
	});

	/** Sorotan utama hero: kursus terbit pertama dari katalog nyata. */
	const featuredCourse = $derived(spotCourses[0] ?? null);

	/** Kursus gratis (priceNominal 0) dari data backend asli — tanpa mock. */
	const freeCourses = $derived(spotCourses.filter((c) => (c.priceNominal ?? 0) === 0).slice(0, 3));

	const keunggulan = $derived([
		{
			icon: 'fa-list-check',
			title: t(lang, 'home.adv1t'),
			desc: t(lang, 'home.adv1d')
		},
		{
			icon: 'fa-book-open',
			title: t(lang, 'home.adv2t'),
			desc: t(lang, 'home.adv2d')
		},
		{
			icon: 'fa-pen-to-square',
			title: t(lang, 'home.adv3t'),
			desc: t(lang, 'home.adv3d')
		},
		{
			icon: 'fa-award',
			title: t(lang, 'home.adv4t'),
			desc: t(lang, 'home.adv4d')
		}
	]);

	/** FAQ beranda: jawaban faktual mengikuti alur produk yang benar ada. */
	const faqs = $derived(
		[1, 2, 3, 4, 5, 6].map((n) => ({
			q: t(lang, `home.faq${n}q`),
			a: t(lang, `home.faq${n}a`)
		}))
	);
	/** Structured data: klaim faktual tentang platform saja, tanpa angka fiktif. */
	const homeJsonLd = $derived([
		{
			'@context': 'https://schema.org',
			'@type': 'Organization',
			name: 'ARISTOTELES',
			url: getSiteUrl(data.origin),
			description: t(lang, 'home.schemaOrgDesc'),
			email: 'support@aristoteles.id'
		},
		{
			'@context': 'https://schema.org',
			'@type': 'WebSite',
			name: 'ARISTOTELES',
			url: getSiteUrl(data.origin),
			inLanguage: jsonLdLang(lang)
		},
		{
			'@context': 'https://schema.org',
			'@type': 'FAQPage',
			mainEntity: faqs.map((f) => ({
				'@type': 'Question',
				name: f.q,
				acceptedAnswer: { '@type': 'Answer', text: f.a }
			}))
		}
	]);
</script>

<SeoHead
	title={t(lang, 'home.pageTitle')}
	description={t(lang, 'home.pageDesc')}
	path={lp(lang, '/')}
	origin={data.origin}
	lang={lang}
	alternates={altUrls(lp(lang, '/'), data.origin)}
	jsonLd={homeJsonLd}
/>

	<PublicHeader active="promo" />

<main>
	<!-- Hero -->
	<section aria-labelledby="hero-heading" class="relative overflow-hidden border-b border-white/10 bg-abyss">
		<div class="pointer-events-none absolute inset-0" aria-hidden="true">
			<img src={dropdownBg} alt="" aria-hidden="true" class="absolute inset-0 h-full w-full object-cover" fetchpriority="high" />
			<div class="absolute inset-0 bg-gradient-to-r from-abyss/95 via-abyss/80 to-abyss/50"></div>
			<div class="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-abyss/70 to-transparent"></div>
			<div class="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.12)_1.2px,transparent_1.2px)] bg-[size:22px_22px] opacity-60 [mask-image:radial-gradient(ellipse_70%_60%_at_50%_30%,black,transparent)]"></div>
			<div class="absolute top-10 left-[6%] hidden h-24 w-24 rounded-full border-[10px] border-white/10 lg:block"></div>
			<div class="absolute right-[8%] bottom-12 hidden h-14 w-14 rounded-2xl border-[6px] border-teal/40 lg:block" style="transform:rotate(-12deg)"></div>
		</div>
		<div class="relative mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-2 lg:gap-16 lg:px-8 lg:py-24">
			<div>
				<p class="inline-flex animate-rise items-center gap-2.5 rounded-full border border-white/15 bg-white/10 py-1.5 pr-5 pl-3 font-heading text-xs font-bold tracking-[0.16em] text-ice uppercase backdrop-blur">
					<span class="relative flex h-2 w-2" aria-hidden="true">
						<span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal opacity-70 motion-reduce:hidden"></span>
						<span class="relative inline-flex h-2 w-2 rounded-full bg-teal"></span>
					</span>
					{t(lang, 'home.badge')}
				</p>
				<h1
					id="hero-heading"
					class="mt-5 max-w-xl animate-rise font-heading text-4xl leading-[1.08] font-extrabold tracking-tight text-white sm:text-5xl lg:text-[3.4rem]"
					style="animation-delay:90ms"
				>
					{t(lang, 'home.heroTitleA')}<br />{t(lang, 'home.heroTitleB')}
					<span class="relative inline-block bg-gradient-to-r from-teal-300 via-teal-200 to-ice bg-clip-text text-transparent">
						{t(lang, 'home.heroTitleAccent')}
					</span>
				</h1>
				<p class="mt-5 max-w-lg animate-rise text-base leading-relaxed text-slate-300 sm:text-lg" style="animation-delay:160ms">
					{t(lang, 'home.heroSub')}
				</p>
				<div class="mt-8 flex animate-rise flex-col gap-3 sm:flex-row sm:items-center" style="animation-delay:220ms">
					<a
						href={lp(lang, '/register')}
						class="group inline-flex min-h-[54px] items-center justify-center gap-2 rounded-full bg-white px-8 font-heading text-sm font-bold text-abyss shadow-xl shadow-black/30 transition-all duration-200 hover:-translate-y-0.5 hover:bg-ice focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
					>
						{t(lang, 'home.ctaStart')}
						<i class="fa-solid fa-arrow-right text-xs transition-transform duration-200 group-hover:translate-x-1" aria-hidden="true"></i>
					</a>
					<a
						href={lp(lang, '/pelatihan')}
						class="inline-flex min-h-[54px] items-center justify-center gap-2 rounded-full border border-white/25 bg-white/5 px-8 font-heading text-sm font-bold text-white backdrop-blur transition-all duration-200 hover:-translate-y-0.5 hover:border-white/60 hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
					>
						{t(lang, 'home.ctaExplore')}
					</a>
				</div>
				<ul class="mt-8 flex animate-rise flex-wrap gap-3 text-sm font-medium text-slate-200" style="animation-delay:280ms">
					<li class="flex items-center gap-2.5 rounded-2xl border border-white/12 bg-white/[0.07] px-4 py-2.5 backdrop-blur">
						<span class="flex h-7 w-7 items-center justify-center rounded-xl bg-teal/20 text-teal" aria-hidden="true">
							<i class="fa-solid fa-layer-group text-xs"></i>
						</span>
						{t(lang, 'home.featCurriculum')}
					</li>
					<li class="flex items-center gap-2.5 rounded-2xl border border-white/12 bg-white/[0.07] px-4 py-2.5 backdrop-blur">
						<span class="flex h-7 w-7 items-center justify-center rounded-xl bg-white/10 text-ice" aria-hidden="true">
							<i class="fa-solid fa-chalkboard-user text-xs"></i>
						</span>
						{t(lang, 'home.featMentor')}
					</li>
				</ul>
			</div>

			<!-- Visual produk: pratinjau katalog nyata -->
			<div class="relative animate-rise" style="animation-delay:180ms">
				{#if spotLoading}
					<div class="overflow-hidden rounded-[1.75rem] border border-mist bg-white shadow-xl shadow-slate-900/5" role="status" aria-label={t(lang, 'home.spotLoading')}>
						<div class="h-56 animate-pulse bg-ice"></div>
						<div class="space-y-3 p-6">
							<div class="h-4 w-2/3 animate-pulse rounded bg-ice"></div>
							<div class="h-3 w-1/2 animate-pulse rounded bg-ice"></div>
							<div class="h-10 animate-pulse rounded-xl bg-ice"></div>
						</div>
					</div>
				{:else if featuredCourse}
					<div class="relative px-2 pt-6 pb-8 sm:px-6">
						<div class="absolute inset-x-6 top-2 bottom-12 rotate-3 rounded-[1.75rem] border border-white/20 bg-white/10 backdrop-blur-sm" aria-hidden="true"></div>
						<div class="absolute -top-1 right-8 z-20 rotate-2 rounded-full border border-mist bg-white py-2 pr-4 pl-3 shadow-lg shadow-slate-900/10" aria-hidden="true">
							<p class="flex items-center gap-1.5 text-xs font-bold text-abyss">
								<i class="fa-solid fa-laptop-file text-royal"></i>
								{t(lang, 'home.previewBadge')}
							</p>
						</div>
						<div class="relative rotate-1 overflow-hidden rounded-[1.75rem] border border-mist bg-white shadow-2xl shadow-slate-900/20 transition-transform duration-500 ease-out hover:rotate-0 sm:rotate-2">
							<div class="flex items-center gap-1.5 border-b border-mist bg-white px-4 py-3" aria-hidden="true">
								<span class="h-2.5 w-2.5 rounded-full bg-red-400"></span>
								<span class="h-2.5 w-2.5 rounded-full bg-amber-400"></span>
								<span class="h-2.5 w-2.5 rounded-full bg-green-500"></span>
								<span class="ml-2 hidden rounded-full bg-slate-100 px-3 py-1 font-mono text-xs text-slate-500 sm:block">{t(lang, 'home.previewBrowserBar')}</span>
							</div>
							<img
								src={featuredCourse.image || COVER_FALLBACK}
								alt={t(lang, 'home.previewAlt', { title: featuredCourse.title })}
								class="h-52 w-full object-cover sm:h-60"
								loading="eager"
								fetchpriority="high"
							/>
							<div class="p-6">
								<div class="flex items-center justify-between gap-3">
									<p class="rounded-full bg-ice px-3 py-1 font-heading text-xs font-bold tracking-[0.1em] text-royal uppercase">{featuredCourse.category ?? t(lang, 'home.categoryFallback')}</p>
									<p class="text-xs font-semibold text-slate-500">{featuredCourse.level}</p>
								</div>
								<p class="mt-3 font-heading text-xl leading-snug font-bold text-abyss">
									{featuredCourse.title}
								</p>
								<p class="mt-1 text-sm text-slate-500">
									{t(lang, 'home.taughtBy')}: {instructorNames.get(featuredCourse.id) ?? '…'}
								</p>
								<div class="mt-5 flex items-center justify-between gap-4 border-t border-dashed border-mist pt-5">
									<p class="font-heading text-xl font-extrabold text-abyss">{featuredCourse.priceLabel}</p>
									<a
										href={lp(lang, `/modules/${featuredCourse.id}`)}
										class="group inline-flex min-h-[46px] items-center gap-2 rounded-full bg-abyss px-6 font-heading text-sm font-bold text-white shadow-lg shadow-abyss/30 transition-all duration-200 hover:-translate-y-0.5 hover:bg-royal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal"
									>
										{t(lang, 'home.seeDetail')} <i class="fa-solid fa-arrow-right text-xs transition-transform duration-200 group-hover:translate-x-1" aria-hidden="true"></i>
									</a>
								</div>
							</div>
						</div>
						<div class="absolute -bottom-1 -left-1 flex rotate-[-2deg] items-center gap-3 rounded-2xl border border-mist bg-white px-4 py-3 shadow-xl shadow-slate-900/15 transition-transform duration-300 hover:rotate-0 sm:left-0">
							<span class="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal/15 text-teal" aria-hidden="true">
								<i class="fa-solid fa-award"></i>
							</span>
							<div>
								<p class="font-heading text-sm font-bold text-abyss">{t(lang, 'home.certCardTitle')}</p>
								<p class="text-xs text-slate-500">{t(lang, 'home.certCardSub')}</p>
							</div>
						</div>
					</div>
				{:else}
					<div class="rounded-[1.75rem] border border-dashed border-white/25 bg-white/5 p-12 text-center backdrop-blur">
						{#if spotError}
							<p class="font-heading text-sm font-bold text-white">{t(lang, 'home.spotFailTitle')}</p>
							<p class="mx-auto mt-1 max-w-sm text-sm text-slate-300">{spotError}</p>
							<button
								type="button"
								onclick={() => void loadSorotan()}
								class="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-full bg-white px-5 font-heading text-sm font-bold text-abyss transition-all duration-200 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
							>
								<i class="fa-solid fa-rotate-right text-xs" aria-hidden="true"></i> {t(lang, 'home.spotRetry')}
							</button>
						{:else}
							<p class="font-heading text-sm font-bold text-white">{t(lang, 'home.spotEmptyTitle')}</p>
							<p class="mx-auto mt-1 max-w-sm text-sm text-slate-300">{t(lang, 'home.spotEmptySub')}</p>
							<a href={lp(lang, '/pelatihan')} class="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-full bg-white px-5 font-heading text-sm font-bold text-abyss transition-all duration-200 hover:-translate-y-0.5">
								{t(lang, 'home.spotOpenCatalog')} <i class="fa-solid fa-arrow-right text-xs" aria-hidden="true"></i>
							</a>
						{/if}
					</div>
				{/if}
			</div>
		</div>
	</section>

	<!-- Kursus gratis (data backend asli; sembunyi bila tidak ada) -->
	{#if spotLoading}
		<section aria-label={t(lang, 'home.freeTitle')} class="border-b border-mist bg-white">
			<div class="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
				<div class="grid grid-cols-1 gap-5 md:grid-cols-3" role="status" aria-label={t(lang, 'catalog.loadingAria')}>
					{#each [1, 2, 3] as i (i)}
						<div class="overflow-hidden rounded-2xl border border-mist bg-white">
							<div class="h-44 animate-pulse bg-ice"></div>
							<div class="space-y-2 p-6">
								<div class="h-4 w-3/4 animate-pulse rounded bg-ice"></div>
								<div class="h-3 w-1/2 animate-pulse rounded bg-ice"></div>
							</div>
						</div>
					{/each}
				</div>
			</div>
		</section>
	{:else if freeCourses.length > 0}
		<section aria-labelledby="free-heading" class="border-b border-mist bg-white">
			<div class="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-16">
				<div use:reveal class="flex flex-wrap items-end justify-between gap-4">
					<div class="max-w-2xl">
						<p class="flex items-center gap-3 font-heading text-xs font-bold tracking-[0.18em] text-teal uppercase">
							<span class="h-px w-8 bg-teal" aria-hidden="true"></span>
							{t(lang, 'home.freeEyebrow')}
						</p>
						<h2 id="free-heading" class="mt-3 font-heading text-3xl font-extrabold tracking-tight text-abyss sm:text-4xl">
							{t(lang, 'home.freeTitle')}
						</h2>
						<p class="mt-2 max-w-xl text-sm leading-relaxed text-slate-600 sm:text-base">
							{t(lang, 'home.freeSub')}
						</p>
					</div>
					<a
						href={lp(lang, '/pelatihan')}
						class="group inline-flex min-h-[44px] items-center gap-2 rounded-full border border-mist bg-white px-5 font-heading text-sm font-bold text-abyss transition-all duration-200 hover:-translate-y-0.5 hover:border-royal hover:text-royal focus-visible:outline-2 focus-visible:outline-royal"
					>
						{t(lang, 'home.freeCtaAll')} <i class="fa-solid fa-arrow-right text-xs transition-transform duration-200 group-hover:translate-x-1" aria-hidden="true"></i>
					</a>
				</div>
				<ul class="mt-8 grid grid-cols-1 gap-5 md:grid-cols-3">
					{#each freeCourses as course, i (course.id)}
						<li
							use:reveal={{ delay: i * 70 }}
							class="group relative flex flex-col overflow-hidden rounded-2xl border border-mist bg-white transition-all duration-200 hover:-translate-y-1 hover:border-teal/50 hover:shadow-xl hover:shadow-slate-900/10"
						>
							<div class="relative overflow-hidden" aria-hidden="true">
								<img
									src={course.image ? fileUrl(course.image) : COVER_FALLBACK}
									srcset={course.image ? (buildSrcSet(fileUrl(course.image), [400, 800]) ?? undefined) : undefined}
									sizes="(max-width: 768px) 100vw, 33vw"
									alt=""
									class="h-44 w-full object-cover transition duration-500 group-hover:scale-[1.03]"
									loading="lazy"
									decoding="async"
								/>
								<span class="absolute top-3 left-3 rounded-md bg-teal px-3 py-1 font-heading text-xs font-bold text-white uppercase">
									{t(lang, 'home.freeBadge')}
								</span>
							</div>
							<div class="flex flex-1 flex-col justify-between gap-4 p-5">
								<div>
									<p class="text-xs font-semibold text-slate-500">
										<span class="font-heading font-bold tracking-wide text-blue-700 uppercase">{course.level}</span>
										{#if course.category}
											<span> · {course.category}</span>
										{/if}
									</p>
									<h3 class="mt-2 font-heading text-base leading-snug font-bold text-abyss">
										<a
											href={lp(lang, `/modules/${course.id}`)}
											class="rounded transition-colors duration-200 group-hover:text-royal focus-visible:outline-2 focus-visible:outline-royal after:absolute after:inset-0"
											aria-label={t(lang, 'catalog.cardAria', { title: course.title })}
										>{course.title}</a>
									</h3>
									<p class="mt-1 text-xs text-slate-500">
										{t(lang, 'home.taughtBy')}: {instructorNames.get(course.id) ?? '…'}
									</p>
								</div>
								<div class="flex items-center justify-between border-t border-mist pt-4">
									<span class="font-heading text-sm font-extrabold text-teal">{course.priceLabel}</span>
									<span class="inline-flex items-center gap-1.5 text-xs font-bold text-royal">
										{t(lang, 'home.seeDetail')} <i class="fa-solid fa-arrow-right text-[11px]" aria-hidden="true"></i>
									</span>
								</div>
							</div>
						</li>
					{/each}
				</ul>
			</div>
		</section>
	{/if}

	<!-- Keunggulan platform -->
	<section aria-labelledby="keunggulan-heading" class="border-y border-mist bg-ice/60">
		<div class="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
			<div use:reveal class="max-w-2xl">
				<p class="flex items-center gap-3 font-heading text-xs font-bold tracking-[0.18em] text-royal uppercase">
					<span class="h-px w-8 bg-royal" aria-hidden="true"></span>
					{t(lang, 'home.whyEyebrow')}
				</p>
				<h2 id="keunggulan-heading" class="mt-3 font-heading text-3xl font-extrabold tracking-tight text-abyss sm:text-4xl">
					{t(lang, 'home.whyTitle')}
				</h2>
			</div>
			<ul class="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
				{#each keunggulan as item, i (item.title)}
					<li use:reveal={{ delay: i * 70 }} class="rounded-2xl border border-mist bg-white p-6 transition-colors duration-200 hover:border-royal/40">
						<span class="flex h-11 w-11 items-center justify-center rounded-xl bg-ice text-royal" aria-hidden="true">
							<i class="fa-solid {item.icon} text-lg"></i>
						</span>
						<h3 class="mt-4 font-heading text-base font-bold text-abyss">{item.title}</h3>
						<p class="mt-1.5 text-sm leading-relaxed text-slate-600">{item.desc}</p>
					</li>
				{/each}
			</ul>
		</div>
	</section>

	<!-- FAQ -->
	<section aria-labelledby="faq-heading" class="border-y border-mist bg-white">
		<div class="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
			<div use:reveal class="text-center">
				<p class="flex items-center justify-center gap-3 font-heading text-xs font-bold tracking-[0.18em] text-royal uppercase">
					<span class="h-px w-8 bg-royal" aria-hidden="true"></span>
					{t(lang, 'home.faqEyebrow')}
					<span class="h-px w-8 bg-royal" aria-hidden="true"></span>
				</p>
				<h2 id="faq-heading" class="mt-3 font-heading text-3xl font-extrabold tracking-tight text-abyss sm:text-4xl">
					{t(lang, 'home.faqTitle')}
				</h2>
				<p class="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-slate-600 sm:text-base">
					{t(lang, 'home.faqSub')}
				</p>
			</div>
			<div class="mt-10 space-y-3">
				{#each faqs as faq, i (faq.q)}
					<details
						use:reveal={{ delay: i * 50 }}
						open={i === 0}
						class="group overflow-hidden rounded-2xl border border-mist bg-white transition-colors duration-200 open:border-royal/40 open:bg-ice/40 hover:border-royal/40"
					>
						<summary
							class="flex min-h-[56px] w-full cursor-pointer items-center justify-between gap-4 px-5 py-4 text-left focus-visible:outline-2 focus-visible:outline-royal"
						>
							<span class="font-heading text-sm font-bold text-abyss sm:text-base">{faq.q}</span>
							<span
								class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-ice text-royal transition-all duration-200 group-open:rotate-180 group-open:bg-royal group-open:text-white"
								aria-hidden="true"
							>
								<i class="fa-solid fa-chevron-down text-xs"></i>
							</span>
						</summary>
						<div>
							<p class="px-5 pb-5 text-sm leading-relaxed text-slate-600">
								{faq.a}
							</p>
						</div>
					</details>
				{/each}
			</div>
		</div>
	</section>

	<!-- Promosi instruktur -->
	<section aria-labelledby="instruktur-heading" class="relative overflow-hidden border-t border-mist bg-white">
		<div class="pointer-events-none absolute inset-0" aria-hidden="true">
			<div class="absolute top-[-6rem] right-[10%] h-72 w-72 rounded-full bg-ice blur-3xl"></div>
		</div>
		<div class="relative mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8 lg:py-20">
			<!-- Kolom kiri: visual instruktur -->
			<div class="relative">
				<figure class="overflow-hidden rounded-2xl border border-mist bg-white shadow-xl shadow-slate-900/10">
					<img
						src="https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=900&q=80"
						alt={t(lang, 'home.inspWorkshopAlt')}
						loading="lazy"
						decoding="async"
						class="aspect-[4/3] w-full object-cover"
					/>
				</figure>
				<div class="absolute -top-4 right-4 flex items-center gap-2 rounded-xl border border-mist bg-white px-3.5 py-2 shadow-lg shadow-slate-900/10" aria-hidden="true">
					<span class="flex h-8 w-8 items-center justify-center rounded-lg bg-ice text-royal">
						<i class="fa-solid fa-laptop-file text-sm"></i>
					</span>
					<p class="font-heading text-xs font-bold text-abyss">{t(lang, 'home.inspCardTag')}</p>
				</div>
				<!-- Kartu profil (contoh tampilan — bukan instruktur sungguhan) -->
				<div class="relative z-10 mx-4 -mt-12 rounded-2xl border border-mist bg-white p-5 shadow-xl shadow-slate-900/10 sm:mx-8">
					<div class="flex items-center gap-4">
						<img
							src="https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=160&q=80"
							alt={t(lang, 'home.inspPhotoAlt')}
							loading="lazy"
							decoding="async"
							class="h-14 w-14 shrink-0 rounded-full border border-mist object-cover"
						/>
						<div class="min-w-0">
							<p class="flex flex-wrap items-center gap-2 font-heading text-sm font-bold text-abyss">
								{t(lang, 'home.inspCardName')}
								<span class="rounded-md bg-ice px-2 py-0.5 font-heading text-xs font-bold tracking-wider text-royal uppercase">{t(lang, 'home.inspCardBadge')}</span>
							</p>
							<p class="mt-0.5 text-xs font-medium text-slate-500">{t(lang, 'home.inspCardField')}</p>
						</div>
					</div>
					<p class="mt-3 border-t border-mist pt-3 text-xs leading-relaxed text-slate-500">
						{t(lang, 'home.inspCardDesc')}
					</p>
				</div>
			</div>

			<!-- Kolom kanan: informasi promosi -->
			<div>
				<p class="flex items-center gap-3 font-heading text-xs font-bold tracking-[0.18em] text-teal uppercase">
					<span class="h-px w-8 bg-teal" aria-hidden="true"></span>
					{t(lang, 'home.inspEyebrow')}
				</p>
				<h2 id="instruktur-heading" class="mt-3 font-heading text-3xl font-extrabold tracking-tight text-abyss sm:text-4xl">
					{t(lang, 'home.inspTitleA')} <span class="text-royal">{t(lang, 'home.inspTitleAccent')}</span>
				</h2>
				<p class="mt-3 max-w-lg text-sm leading-relaxed text-slate-600 sm:text-base">
					{t(lang, 'home.inspSub')}
				</p>
				<ul class="mt-7 space-y-3.5">
					{#each ta(lang, 'home.inspBullets') as b, bi (bi)}
						<li class="flex items-start gap-3 text-sm leading-relaxed font-medium text-slate-700">
							<span class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal/15 text-teal" aria-hidden="true">
								<i class="fa-solid fa-check text-[11px]"></i>
							</span>
							{b}
						</li>
					{/each}
				</ul>
				<div class="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
					<a
						href={lp(lang, '/menjadi-instruktur')}
						class="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-royal px-8 font-heading text-sm font-bold text-white transition-colors duration-200 hover:bg-royal-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal"
					>
						{t(lang, 'home.inspCta')}
						<i class="fa-solid fa-arrow-right text-xs" aria-hidden="true"></i>
					</a>
				</div>
				<p class="mt-4 text-xs leading-relaxed text-slate-500">
					{t(lang, 'home.inspNote')}
				</p>
			</div>
		</div>
	</section>
</main>

<PublicFooter />
