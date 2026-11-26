<script lang="ts">
	import { browser } from '$app/environment';
	import PublicHeader from '$lib/components/public/PublicHeader.svelte';
	import PublicFooter from '$lib/components/public/PublicFooter.svelte';
	import SeoHead from '$lib/components/SeoHead.svelte';
	import { canonicalPath, getSiteUrl, altUrls } from '$lib/seo/site';
	import { page } from '$app/state';
	import { lp, jsonLdLang, type Locale } from '$lib/i18n/locale';
	import { t } from '$lib/i18n/index';
	import { reveal } from '$lib/actions/reveal';
	import { fetchCourseRankings, type CourseRanking } from '$lib/api/courses';
	import { toast } from '$lib/stores/toast.svelte';

	const lang: Locale = $derived(page.params.lang === 'en' ? 'en' : 'id');

	/** Peringkat nyata dari database (jumlah peserta), tanpa data contoh. */
	let items = $state<CourseRanking[]>([]);
	let loading = $state(true);
	let loadError = $state('');
	let started = false;
	let loadSeq = 0;

	async function load(): Promise<void> {
		const my = ++loadSeq;
		loading = true;
		loadError = '';
		try {
			const list = await fetchCourseRankings(10);
			if (my !== loadSeq) return;
			items = list;
		} catch (e) {
			if (my !== loadSeq) return;
			loadError = e instanceof Error ? e.message : 'Gagal memuat peringkat.';
			toast.error(loadError);
		} finally {
			if (my === loadSeq) loading = false;
		}
	}

	$effect(() => {
		if (!browser || started) return;
		started = true;
		void load();
	});

	function initialsOf(name: string): string {
		const parts = name.trim().split(/\s+/).filter(Boolean);
		if (parts.length === 0) return '•';
		if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
		return (parts[0][0] + parts[1][0]).toUpperCase();
	}

	function instructorLabel(c: CourseRanking): string {
		return c.instructorNames.length > 0 ? c.instructorNames.join(', ') : '—';
	}

	/** Urutan tampil = urutan server (peserta terbanyak); rank = posisi. */
	const ranked = $derived(items.map((c, i) => ({ ...c, rank: i + 1 })));

	/* Podium tetap: 3 teratas (urutan DOM 1–2–3 untuk pembaca layar). */
	const podiumOrder = $derived(ranked.slice(0, 3));

	/**
	 * Peringkat tiap pelatihan di dalam kategorinya masing-masing.
	 * Turunan deterministik dari daftar yang sama — bukan data penilaian baru.
	 */
	const rankInCategory = $derived.by(() => {
		const map = new Map<number, number>();
		const counter = new Map<string, number>();
		for (const item of ranked) {
			const key = item.category ?? '';
			const next = (counter.get(key) ?? 0) + 1;
			counter.set(key, next);
			map.set(item.courseId, next);
		}
		return map;
	});

	const totalStudents = $derived(ranked.reduce((s, c) => s + c.studentCount, 0));
	const avgStudents = $derived(ranked.length > 0 ? totalStudents / ranked.length : 0);
	const avgLabel = $derived(
		avgStudents.toLocaleString(lang === 'en' ? 'en-US' : 'id-ID', { maximumFractionDigits: 1 })
	);

	/**
	 * Structured data TANPA AggregateRating: backend belum punya penilaian
	 * peserta, jadi halaman ini tidak mengklaim rating apa pun
	 * (melanggar panduan rich result Google bila dikarang).
	 */
	const peringkatJsonLd = $derived([
		{
			'@context': 'https://schema.org',
			'@type': 'WebPage',
			name: t(lang, 'about.rankSchemaName'),
			description: t(lang, 'about.rankSchemaDesc'),
			url: canonicalPath(lp(lang, '/peringkat')),
			inLanguage: jsonLdLang(lang),
			isPartOf: { '@type': 'WebSite', name: 'ARISTOTELES', url: getSiteUrl() }
		},
		{
			'@context': 'https://schema.org',
			'@type': 'BreadcrumbList',
			itemListElement: [
				{ '@type': 'ListItem', position: 1, name: t(lang, 'about.crumbHome'), item: canonicalPath(lp(lang, '/')) },
				{ '@type': 'ListItem', position: 2, name: t(lang, 'nav.peringkat'), item: canonicalPath(lp(lang, '/peringkat')) }
			]
		}
	]);
</script>

<SeoHead
	title={t(lang, 'about.rankPageTitle')}
	description={t(lang, 'about.rankPageDesc')}
	path={lp(lang, '/peringkat')}
	lang={lang}
	alternates={altUrls(lp(lang, '/peringkat'))}
	jsonLd={peringkatJsonLd}
/>

<PublicHeader active="peringkat" />

<main>
	<section class="relative overflow-hidden bg-white">
		<div class="pointer-events-none absolute inset-0" aria-hidden="true">
			<div class="absolute -top-32 left-1/2 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-ice blur-3xl"></div>
		</div>
		<div class="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
			<p class="flex items-center gap-3 font-heading text-xs font-bold tracking-[0.18em] text-royal uppercase">
				<span class="h-px w-8 bg-royal" aria-hidden="true"></span>
				{t(lang, 'about.rankEyebrow')}
			</p>
			<h1 class="mt-3 max-w-2xl font-heading text-4xl font-extrabold tracking-tight text-abyss sm:text-5xl">
				{t(lang, 'about.rankHeroTitle')}
			</h1>
			<p class="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
				{t(lang, 'about.rankHeroSub')}
			</p>
		</div>
	</section>

	<section aria-labelledby="peringkat-heading" class="border-t border-mist bg-white pb-20">
		<div class="mx-auto max-w-7xl px-4 pt-10 sm:px-6 lg:px-8">
			<h2 id="peringkat-heading" class="sr-only">{t(lang, 'about.rankListHeading')}</h2>
			{#if loading}
				<div class="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3" role="status" aria-label={t(lang, 'catalog.loadingAria')}>
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
			{:else if loadError}
				<div role="alert" class="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
					<p class="font-heading text-sm font-bold text-red-700">{t(lang, 'catalog.errTitle')}</p>
					<p class="mx-auto mt-1 max-w-md text-xs text-red-600">{loadError}</p>
					<button
						type="button"
						onclick={() => void load()}
						class="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-red-600 px-5 font-heading text-xs font-bold text-white transition-colors duration-200 hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-red-600"
					>
						<i class="fa-solid fa-rotate-right" aria-hidden="true"></i> {t(lang, 'catalog.retry')}
					</button>
				</div>
			{:else if ranked.length === 0}
				<div class="rounded-2xl border border-dashed border-mist bg-white p-12 text-center">
					<i class="fa-solid fa-ranking-star mb-3 text-3xl text-slate-300" aria-hidden="true"></i>
					<p class="font-heading text-sm font-bold text-abyss">{t(lang, 'about.rankEmptyTitle')}</p>
					<p class="mx-auto mt-1 max-w-md text-xs text-slate-500">{t(lang, 'about.rankEmptySub')}</p>
					<a
						href={lp(lang, '/pelatihan')}
						class="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-royal px-6 py-2.5 font-heading text-xs font-bold text-white transition-colors duration-200 hover:bg-royal-hover focus-visible:outline-2 focus-visible:outline-royal"
					>
						{t(lang, 'about.rankCta')} <i class="fa-solid fa-arrow-right text-xs" aria-hidden="true"></i>
					</a>
				</div>
			{:else}
				<dl
					class="mx-auto mb-12 grid max-w-3xl grid-cols-3 divide-x divide-mist rounded-2xl border border-mist bg-ice/60"
				>
					<div class="px-4 py-4 text-center">
						<dt class="mt-1 block font-heading text-[10px] font-bold tracking-[0.16em] text-slate-500 uppercase">
							{t(lang, 'about.rankStatCourses')}
						</dt>
						<dd class="font-heading text-xl font-extrabold tabular-nums text-abyss sm:text-2xl">{ranked.length}</dd>
					</div>
					<div class="px-4 py-4 text-center">
						<dt class="mt-1 block font-heading text-[10px] font-bold tracking-[0.16em] text-slate-500 uppercase">
							{t(lang, 'about.rankStatAvg')}
						</dt>
						<dd class="font-heading text-xl font-extrabold tabular-nums text-royal sm:text-2xl">
							{avgLabel}
						</dd>
					</div>
					<div class="px-4 py-4 text-center">
						<dt class="mt-1 block font-heading text-[10px] font-bold tracking-[0.16em] text-slate-500 uppercase">
							{t(lang, 'about.rankStatTotal')}
						</dt>
						<dd class="font-heading text-xl font-extrabold tabular-nums text-abyss sm:text-2xl">{totalStudents.toLocaleString(lang === 'en' ? 'en-US' : 'id-ID')}</dd>
					</div>
				</dl>

				<div class="mx-auto mb-6 max-w-2xl text-center">
					<h3 class="font-heading text-xl font-extrabold tracking-tight text-abyss">{t(lang, 'about.rankBoardTitle')}</h3>
					<p class="mt-1 text-sm text-slate-500">{t(lang, 'about.rankBoardSub')}</p>
				</div>
				<ol
					aria-label={t(lang, 'about.rankBoardLabel')}
					class="mx-auto mb-4 grid max-w-5xl gap-5 md:grid-cols-3 md:items-stretch lg:gap-6"
				>
					{#each podiumOrder as item, i (item.courseId)}
						{@const isFirst = item.rank === 1}
						{@const code = String(item.rank).padStart(2, '0')}
						<li
							use:reveal={{ delay: i * 80 }}
							class={isFirst ? 'md:order-2' : item.rank === 2 ? 'md:order-1' : 'md:order-3'}
						>
							{#if isFirst}
								<article
									class="relative h-full overflow-hidden rounded-2xl bg-abyss p-6 text-white sm:p-7"
								>
									<div class="relative flex h-full flex-col overflow-hidden">
										<span
											class="pointer-events-none absolute -top-8 right-0 text-[6.5rem] leading-none font-black tabular-nums text-white/10 select-none"
											aria-hidden="true">{code}</span
										>
										<div class="relative flex items-center justify-between gap-3">
											<span
												class="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-royal text-white"
												aria-hidden="true"
											>
												<i class="fa-solid fa-crown text-lg"></i>
											</span>
											<span
												class="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1 font-heading text-[10px] font-bold tracking-[0.18em] text-ice uppercase"
											>
												{t(lang, 'about.rankLabel', { rank: item.rank })}
											</span>
										</div>
										<h3 class="relative mt-5 text-left font-heading text-lg leading-snug font-bold text-white sm:text-xl">
											{item.title}
										</h3>
										<p class="relative mt-2 flex items-center gap-2.5 text-left">
											<span
												class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 font-heading text-[11px] font-bold text-white"
												aria-hidden="true">{initialsOf(item.instructorNames[0] ?? '')}</span
											>
											<span class="text-xs font-semibold text-slate-300">
												{instructorLabel(item)}
												{#if item.category}<span class="text-slate-400">· {item.category}</span>{/if}
											</span>
										</p>
										<div class="relative mt-5 border-t border-white/15 pt-4">
											<p class="flex items-center gap-1.5 text-sm font-bold text-white">
												<i class="fa-solid fa-users text-slate-300" aria-hidden="true"></i>
												<span class="tabular-nums">{item.studentCount.toLocaleString(lang === 'en' ? 'en-US' : 'id-ID')}</span>
												<span class="text-xs font-bold text-slate-300">{t(lang, 'about.rankParticipants')}</span>
											</p>
										</div>
										<a
											href={lp(lang, `/modules/${item.courseId}`)}
											class="relative mt-5 inline-flex items-center gap-2 font-heading text-xs font-bold tracking-wide text-ice uppercase underline decoration-white/30 underline-offset-4 transition duration-200 hover:text-white focus-visible:rounded focus-visible:outline-2 focus-visible:outline-ice"
											aria-label={t(lang, 'about.rankViewAria', { title: item.title })}
										>
											{t(lang, 'about.rankViewList')} <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
										</a>
									</div>
								</article>
							{:else}
								<article
									class="relative flex h-full flex-col overflow-hidden rounded-2xl border border-mist bg-white p-6 pt-8 transition-all duration-200 hover:-translate-y-1 hover:border-royal/40 hover:shadow-xl hover:shadow-slate-900/10 sm:p-7 sm:pt-10"
								>
									<span
										class="pointer-events-none absolute -top-4 right-3 text-[5.5rem] leading-none font-black tabular-nums text-ice select-none"
										aria-hidden="true">{code}</span
									>
									<div class="relative flex items-center justify-between gap-3">
										<span
											class="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-ice text-royal"
											aria-hidden="true"
										>
											<i class="fa-solid {item.rank === 2 ? 'fa-medal' : 'fa-award'}"></i>
										</span>
										<span
											class="inline-flex items-center gap-1.5 rounded-lg bg-ice px-3 py-1 font-heading text-[10px] font-bold tracking-[0.18em] text-abyss uppercase"
										>
											{t(lang, 'about.rankLabel', { rank: item.rank })}
										</span>
									</div>
									<h3 class="relative mt-5 text-left font-heading text-base leading-snug font-bold text-abyss sm:text-lg">
										{item.title}
									</h3>
									<p class="relative mt-2 flex items-center gap-2.5 text-left">
										<span
											class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ice font-heading text-[11px] font-bold text-royal"
											aria-hidden="true">{initialsOf(item.instructorNames[0] ?? '')}</span
										>
										<span class="text-xs font-semibold text-slate-600">
											{instructorLabel(item)}
											{#if item.category}<span class="text-slate-400">· {item.category}</span>{/if}
										</span>
									</p>
									<div class="relative mt-5 border-t border-mist pt-4">
										<p class="flex items-center gap-1.5 text-sm font-bold text-abyss">
											<i class="fa-solid fa-users text-slate-400" aria-hidden="true"></i>
											<span class="tabular-nums">{item.studentCount.toLocaleString(lang === 'en' ? 'en-US' : 'id-ID')}</span>
											<span class="text-xs font-bold text-slate-500">{t(lang, 'about.rankParticipants')}</span>
										</p>
									</div>
								</article>
							{/if}
						</li>
					{/each}
				</ol>

				<div class="mx-auto mb-14 hidden max-w-5xl grid-cols-3 items-end gap-6 px-10 md:grid" aria-hidden="true">
					<div class="h-8 rounded-t-xl border-x border-t border-mist bg-white"></div>
					<div class="h-14 rounded-t-xl bg-abyss"></div>
					<div class="h-8 rounded-t-xl border-x border-t border-mist bg-white"></div>
				</div>

				<div use:reveal class="overflow-hidden rounded-2xl border border-mist bg-white">
					<div class="flex flex-wrap items-center justify-between gap-3 border-b border-mist bg-ice/60 px-6 py-5 sm:px-8">
						<h3 class="flex items-center gap-2.5 font-heading text-sm font-bold text-abyss">
							<span class="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-abyss text-xs text-white" aria-hidden="true">
								<i class="fa-solid fa-list-ol"></i>
							</span>
							{t(lang, 'about.rankTableTitle', { n: ranked.length })}
						</h3>
						<p class="flex items-center gap-2 text-xs font-semibold text-slate-500">
							<i class="fa-solid fa-users text-royal" aria-hidden="true"></i>
							{t(lang, 'about.rankTableSub')}
						</p>
					</div>

					<div class="hidden overflow-x-auto md:block">
						<table class="w-full text-sm">
							<caption class="sr-only">{t(lang, 'about.rankTableCaption')}</caption>
							<thead>
								<tr class="border-b border-mist text-left font-heading text-[11px] font-bold tracking-[0.14em] text-slate-400 uppercase">
									<th scope="col" class="px-8 py-4 font-extrabold">{t(lang, 'about.rankThRank')}</th>
									<th scope="col" class="px-6 py-4 font-extrabold">{t(lang, 'about.rankThCourse')}</th>
									<th scope="col" class="px-6 py-4 font-extrabold">{t(lang, 'about.rankThCat')}</th>
									<th scope="col" class="px-6 py-4 font-extrabold">{t(lang, 'about.rankThInstructor')}</th>
									<th scope="col" class="px-8 py-4 text-right font-extrabold">{t(lang, 'about.rankThParticipants')}</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-mist">
								{#each ranked as row (row.courseId)}
									{@const medal =
										row.rank === 1
											? 'bg-abyss text-white'
											: row.rank === 2
												? 'bg-slate-200 text-slate-700'
												: row.rank === 3
													? 'bg-ice text-royal'
													: row.rank <= 5
														? 'bg-royal text-white'
														: 'bg-slate-100 text-slate-600'}
									<tr
										class="group transition-colors duration-200 {row.rank === 1
											? 'bg-ice/60 hover:bg-ice'
											: 'hover:bg-slate-50/50'}"
									>
										<td class="px-8 py-4">
											<span
												class="inline-flex h-9 w-9 items-center justify-center rounded-xl font-heading text-sm font-bold tabular-nums {medal}"
												>{row.rank}</span
											>
										</td>
										<td class="max-w-72 px-6 py-4">
											<p class="flex items-center gap-2 font-heading font-bold text-abyss transition-colors duration-200 group-hover:text-royal">
												{#if row.rank === 1}
													<i class="fa-solid fa-crown text-sm text-royal" aria-hidden="true"></i>
												{:else if row.rank === 2}
													<i class="fa-solid fa-medal text-sm text-slate-400" aria-hidden="true"></i>
												{:else if row.rank === 3}
													<i class="fa-solid fa-award text-sm text-royal" aria-hidden="true"></i>
												{/if}
												{row.title}
											</p>
										</td>
										<td class="px-6 py-4 whitespace-nowrap">
											{#if row.category}
												<span class="inline-flex items-center rounded-md bg-ice px-2.5 py-1 text-[11px] font-bold text-abyss">
													{row.category}
												</span>
											{:else}
												<span class="text-[11px] text-slate-400">—</span>
											{/if}
											<p class="mt-1 text-[11px] font-semibold text-slate-400">
												#{rankInCategory.get(row.courseId)} {t(lang, 'about.rankInCat')}
											</p>
										</td>
										<td class="px-6 py-4 whitespace-nowrap">
											<span class="inline-flex items-center gap-2 text-[13px] font-semibold text-slate-600">
												<span
													class="inline-flex h-7 w-7 items-center justify-center rounded-full bg-ice font-heading text-[10px] font-bold text-royal"
													aria-hidden="true">{initialsOf(row.instructorNames[0] ?? '')}</span
												>
												{instructorLabel(row)}
											</span>
										</td>
										<td class="px-8 py-4 text-right">
											<span class="inline-flex items-center gap-1.5 text-[13px] font-bold tabular-nums text-slate-500">
												<i class="fa-solid fa-users text-xs text-slate-300" aria-hidden="true"></i>
												{row.studentCount.toLocaleString(lang === 'en' ? 'en-US' : 'id-ID')}
											</span>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>

					<ol class="divide-y divide-mist md:hidden" aria-label={t(lang, 'about.rankMobileLabel')}>
						{#each ranked as row (row.courseId)}
							{@const medal =
								row.rank === 1
									? 'bg-abyss text-white'
									: row.rank === 2
										? 'bg-slate-200 text-slate-700'
										: row.rank === 3
											? 'bg-ice text-royal'
											: row.rank <= 5
												? 'bg-royal text-white'
												: 'bg-slate-100 text-slate-600'}
							<li class="flex gap-4 px-5 py-4 {row.rank === 1 ? 'bg-ice/60' : ''}">
								<span
									class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-heading text-sm font-bold tabular-nums {medal}"
									aria-label={t(lang, 'about.rankLabel', { rank: row.rank })}>{row.rank}</span
								>
								<div class="min-w-0 flex-1">
									<p class="font-heading text-sm leading-snug font-bold text-abyss">{row.title}</p>
									<p class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-semibold text-slate-500">
										{#if row.category}
											<span class="inline-flex items-center rounded-md bg-ice px-2 py-0.5 text-[10px] font-bold text-abyss">
												{row.category}
											</span>
										{/if}
										<span>{instructorLabel(row)}</span>
										<span class="inline-flex items-center rounded-md bg-royal/10 px-2 py-0.5 text-[10px] font-bold text-royal">
											#{rankInCategory.get(row.courseId)} {t(lang, 'about.rankInCatShort')}
										</span>
									</p>
									<div class="mt-2 flex items-center justify-between gap-3">
										<span class="inline-flex items-center gap-1.5 text-xs font-bold tabular-nums text-abyss">
											<i class="fa-solid fa-users text-slate-400" aria-hidden="true"></i>
											{row.studentCount.toLocaleString(lang === 'en' ? 'en-US' : 'id-ID')} {t(lang, 'about.rankParticipants')}
										</span>
										<a
											href={lp(lang, `/modules/${row.courseId}`)}
											class="inline-flex min-h-[40px] items-center gap-1 rounded-lg px-2 text-xs font-bold text-royal hover:underline focus-visible:outline-2 focus-visible:outline-royal"
											aria-label={t(lang, 'about.rankViewAria', { title: row.title })}
										>
											{t(lang, 'about.rankViewList')}
										</a>
									</div>
								</div>
							</li>
						{/each}
					</ol>

					<div class="flex flex-col items-center justify-between gap-4 border-t border-mist bg-ice/60 px-6 py-5 sm:flex-row sm:px-8">
						<p role="note" class="inline-flex items-center gap-1.5 text-xs leading-relaxed font-semibold text-slate-600">
							<i class="fa-solid fa-circle-info text-slate-400" aria-hidden="true"></i>
							{t(lang, 'about.rankNote')}
						</p>
						<a
							href={lp(lang, '/pelatihan')}
							class="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-royal px-6 py-3 font-heading text-xs font-bold tracking-wide text-white uppercase transition-colors duration-200 hover:bg-royal-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal"
						>
							{t(lang, 'about.rankCta')} <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
						</a>
					</div>
				</div>
			{/if}
		</div>
	</section>
</main>

<PublicFooter />
