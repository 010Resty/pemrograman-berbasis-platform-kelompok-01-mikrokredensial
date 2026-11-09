<script lang="ts">
	import '../../app.css';
	import { browser } from '$app/environment';
	import { resolve } from '$app/paths';
	import PublicHeader from '$lib/components/public/PublicHeader.svelte';
	import PublicFooter from '$lib/components/public/PublicFooter.svelte';
	import PatunganSection from '$lib/components/public/PatunganSection.svelte';
	import SeoHead from '$lib/components/SeoHead.svelte';
	import { canonicalPath, getSiteUrl } from '$lib/seo/site';
	import { reveal } from '$lib/actions/reveal';
	import {
		fetchCourseDetail,
		fetchPublicCourseList,
		type BackendCourse
	} from '$lib/api/courses';
	import { fetchPromos, type PromoCampaign } from '$lib/api/promos';
	import { formatIDR } from '$lib/data/payment';

	const COVER_FALLBACK =
		'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=800&q=80';

	let { data }: { data: { origin: string } } = $props();

	/** Kampanye promo aktif dari server — satu-satunya sumber kebenaran promo. */
	let promoCampaigns = $state<PromoCampaign[]>([]);
	let promoLoading = $state(true);
	let promoError = $state('');
	let promoSeq = 0;

	/** Katalog terbit untuk fallback unggulan + kandidat patungan. */
	let katalog = $state<BackendCourse[]>([]);
	let katalogLoading = $state(true);
	let katalogSeq = 0;

	let instructorNames = $state(new Map<number, string>());

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

	async function loadPromos(): Promise<void> {
		const my = ++promoSeq;
		promoLoading = true;
		promoError = '';
		try {
			const camps = await fetchPromos();
			if (my !== promoSeq) return;
			promoCampaigns = camps;
			void ensureInstructorNames(camps.flatMap((c) => c.courses.map((m) => ({ id: m.courseId }))));
		} catch (e) {
			if (my !== promoSeq) return;
			promoError = e instanceof Error ? e.message : 'Gagal memuat promo.';
		} finally {
			if (my === promoSeq) promoLoading = false;
		}
	}

	async function loadKatalog(): Promise<void> {
		const my = ++katalogSeq;
		katalogLoading = true;
		try {
			const list = await fetchPublicCourseList({ status: 'published', limit: 20 });
			if (my !== katalogSeq) return;
			katalog = list;
			void ensureInstructorNames(list.slice(0, 12));
		} catch {
			if (my !== katalogSeq) return;
		} finally {
			if (my === katalogSeq) katalogLoading = false;
		}
	}

	$effect(() => {
		if (!browser) return;
		void loadPromos();
		void loadKatalog();
	});

	/** Flash sale = seluruh kampanye diskon + semua kursus anggotanya. */
	const diskonCampaigns = $derived(promoCampaigns.filter((c) => c.type === 'diskon'));
	const flashCount = $derived(diskonCampaigns.reduce((n, c) => n + c.courses.length, 0));

	/** Unggulan = kampanye kurasi; kosong → fallback kursus terbit terbaru. */
	const kurasiCampaigns = $derived(promoCampaigns.filter((c) => c.type === 'kurasi'));
	const unggulanFallback = $derived(katalog.slice(0, 6));
	const unggulanCount = $derived(
		kurasiCampaigns.length > 0
			? kurasiCampaigns.reduce((n, c) => n + c.courses.length, 0)
			: unggulanFallback.length
	);

	/** Patungan = kampanye patungan saja; tanpa kampanye = tanpa kandidat (tanpa fallback). */
	const patunganCampaigns = $derived(promoCampaigns.filter((c) => c.type === 'patungan'));
	const patunganMemberIds = $derived.by((): number[] => {
		const ids = patunganCampaigns.flatMap((c) => c.courses.map((m) => m.courseId));
		return [...new Set(ids)];
	});
	const patunganCourses = $derived.by((): BackendCourse[] => {
		const member = new Set(patunganMemberIds);
		return katalog.filter((c) => (c.priceNominal ?? 0) > 0 && member.has(c.id));
	});

	function formatTanggal(value: string | null): string {
		if (!value) return '—';
		const d = new Date(value);
		if (Number.isNaN(d.getTime())) return '—';
		return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
	}

	const promoJsonLd = $derived([
		{
			'@context': 'https://schema.org',
			'@type': 'CollectionPage',
			name: 'Promo Pelatihan ARISTOTELES',
			description:
				'Flash sale diskon, pilihan unggulan kurasi, dan promo patungan pelatihan mikrokredensial.',
			url: canonicalPath('/promo', data.origin),
			inLanguage: 'id-ID',
			isPartOf: { '@type': 'WebSite', name: 'ARISTOTELES', url: getSiteUrl(data.origin) }
		},
		{
			'@context': 'https://schema.org',
			'@type': 'BreadcrumbList',
			itemListElement: [
				{ '@type': 'ListItem', position: 1, name: 'Beranda', item: canonicalPath('/', data.origin) },
				{ '@type': 'ListItem', position: 2, name: 'Promo', item: canonicalPath('/promo', data.origin) }
			]
		}
	]);
</script>

<SeoHead
	title="Promo Pelatihan — Flash Sale, Unggulan & Patungan — ARISTOTELES"
	description="Semua promo pelatihan ARISTOTELES: flash sale diskon terbatas, pilihan unggulan kurasi, dan promo patungan bayar bareng lebih hemat."
	path="/promo"
	origin={data.origin}
	jsonLd={promoJsonLd}
/>

<PublicHeader active="promo" />

<main>
	<!-- Hero halaman promo -->
	<section aria-labelledby="promo-page-heading" class="relative overflow-hidden bg-abyss">
		<div class="pointer-events-none absolute inset-0" aria-hidden="true">
			<div class="absolute -top-24 left-[8%] h-64 w-64 rounded-full bg-royal/30 blur-3xl"></div>
			<div class="absolute -right-16 -bottom-24 h-72 w-72 rounded-full bg-teal/20 blur-3xl"></div>
			<div class="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.1)_1.2px,transparent_1.2px)] bg-[size:22px_22px] opacity-60"></div>
		</div>
		<div class="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
			<p class="flex items-center gap-3 font-heading text-xs font-bold tracking-[0.18em] text-teal uppercase">
				<span class="h-px w-8 bg-teal" aria-hidden="true"></span>
				<i class="fa-solid fa-tags" aria-hidden="true"></i>
				Promo Pelatihan
			</p>
			<h1 id="promo-page-heading" class="mt-3 max-w-2xl font-heading text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
				Semua Promo, <span class="text-teal">Satu Halaman.</span>
			</h1>
			<p class="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300 sm:text-base">
				Flash sale diskon terbatas, pilihan unggulan kurasi editor, dan promo patungan
				bayar bareng. Harga promo dari server adalah harga yang dipakai saat bayar.
			</p>
			<nav aria-label="Navigasi bagian promo" class="mt-8 flex flex-wrap gap-2.5">
				<a href="#flash-sale" class="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 font-heading text-xs font-bold text-white transition-colors duration-200 hover:bg-red-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
					<i class="fa-solid fa-bolt" aria-hidden="true"></i> Flash Sale{#if !promoLoading && flashCount > 0} ({flashCount}){/if}
				</a>
				<a href="#unggulan" class="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-white/10 px-5 py-2.5 font-heading text-xs font-bold text-white ring-1 ring-white/20 transition-colors duration-200 hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
					<i class="fa-solid fa-star" aria-hidden="true"></i> Pilihan Unggulan{#if !promoLoading && !katalogLoading && unggulanCount > 0} ({unggulanCount}){/if}
				</a>
				<a href="#patungan" class="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-white/10 px-5 py-2.5 font-heading text-xs font-bold text-white ring-1 ring-white/20 transition-colors duration-200 hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
					<i class="fa-solid fa-people-group" aria-hidden="true"></i> Promo Patungan
				</a>
			</nav>
		</div>
	</section>

	<!-- Bagian 1: Flash Sale — kartu diskon, harga coret + harga promo -->
	<section id="flash-sale" aria-labelledby="flash-sale-heading" class="scroll-mt-20 bg-white">
		<div class="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
			<div use:reveal class="flex flex-wrap items-end justify-between gap-6">
				<div class="max-w-2xl">
					<p class="flex items-center gap-3 font-heading text-xs font-bold tracking-[0.18em] text-red-600 uppercase">
						<span class="h-px w-8 bg-red-600" aria-hidden="true"></span>
						<i class="fa-solid fa-bolt" aria-hidden="true"></i>
						Bagian 01 · Flash Sale
					</p>
					<h2 id="flash-sale-heading" class="mt-3 font-heading text-3xl font-extrabold tracking-tight text-abyss sm:text-4xl">
						Hemat Lebih <span class="text-red-600">Banyak</span>
					</h2>
					<p class="mt-2 max-w-xl text-sm leading-relaxed text-slate-600 sm:text-base">
						Diskon spesial dalam periode terbatas. Harga coret adalah harga resmi,
						harga merah adalah harga bayar.
					</p>
				</div>
				<a href={resolve('/pelatihan')} class="inline-flex min-h-[44px] items-center gap-2 font-heading text-sm font-bold text-royal transition-colors duration-200 hover:text-royal-hover">
					Lihat semua pelatihan <i class="fa-solid fa-arrow-right text-xs" aria-hidden="true"></i>
				</a>
			</div>

			{#if promoLoading}
				<div class="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3" aria-label="Memuat flash sale">
					{#each [1, 2, 3, 4, 5, 6] as i (i)}
						<div class="overflow-hidden rounded-2xl border border-mist bg-white">
							<div class="h-48 animate-pulse bg-ice"></div>
							<div class="space-y-2 p-6">
								<div class="h-4 w-3/4 animate-pulse rounded bg-ice"></div>
								<div class="h-3 w-1/2 animate-pulse rounded bg-ice"></div>
							</div>
						</div>
					{/each}
				</div>
			{:else if promoError}
				<div role="alert" class="mt-8 rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
					<p class="font-heading text-sm font-bold text-red-700">Promo belum dapat dimuat</p>
					<p class="mx-auto mt-1 max-w-md text-xs text-red-600">{promoError}</p>
					<button type="button" onclick={() => void loadPromos()} class="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-royal px-5 py-2.5 font-heading text-xs font-bold text-white transition-colors duration-200 hover:bg-royal-hover focus-visible:outline-2 focus-visible:outline-royal">
						<i class="fa-solid fa-rotate-right" aria-hidden="true"></i> Coba lagi
					</button>
				</div>
			{:else if diskonCampaigns.length === 0}
				<div class="mt-8 rounded-2xl border border-dashed border-mist bg-white p-12 text-center">
					<i class="fa-solid fa-bolt mb-3 text-3xl text-slate-300" aria-hidden="true"></i>
					<p class="font-heading text-sm font-bold text-abyss">Belum ada flash sale saat ini.</p>
					<p class="mx-auto mt-1 max-w-md text-sm text-slate-500">Jelajahi katalog untuk melihat seluruh pelatihan yang tersedia.</p>
					<div class="mt-5">
						<a href={resolve('/pelatihan')} class="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-royal px-6 py-2.5 font-heading text-xs font-bold text-white transition-colors duration-200 hover:bg-royal-hover focus-visible:outline-2 focus-visible:outline-royal">
							Lihat Katalog <i class="fa-solid fa-arrow-right text-xs" aria-hidden="true"></i>
						</a>
					</div>
				</div>
			{:else}
				{#each diskonCampaigns as camp (camp.slug)}
					<div class="mt-10">
						<div use:reveal class="flex flex-wrap items-center gap-3 rounded-2xl border border-red-100 bg-red-50/60 px-5 py-4">
							<span class="rounded-lg bg-red-600 px-3 py-1 font-heading text-xs font-bold text-white">−{camp.discountPercent ?? 0}%</span>
							<div class="min-w-0">
								<h3 class="truncate font-heading text-base font-bold text-abyss">{camp.title}</h3>
								<p class="text-xs text-slate-500">
									Berakhir {formatTanggal(camp.endsAt)} · {camp.courses.length} pelatihan
								</p>
							</div>
						</div>
						<div class="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
							{#each camp.courses as m, i (m.courseId)}
								<article use:reveal={{ delay: (i % 3) * 80 }} class="group relative flex flex-col overflow-hidden rounded-2xl border border-mist bg-white transition-all duration-200 hover:-translate-y-1 hover:border-red-300 hover:shadow-xl hover:shadow-red-900/10">
									<div class="relative overflow-hidden" aria-hidden="true">
										<img src={m.image || COVER_FALLBACK} alt={`Pelatihan ${m.title} — promo harga spesial`} loading="lazy" class="h-48 w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
										<span class="absolute top-3 left-3 rounded-lg bg-abyss px-3 py-1 font-heading text-xs font-bold text-white">−{m.discountPercent ?? camp.discountPercent ?? 0}%</span>
										{#if m.badgeLabel ?? camp.badgeLabel}
											<span class="absolute top-3 right-3 rounded-lg bg-red-600 px-3 py-1 font-heading text-[11px] font-bold text-white uppercase">{m.badgeLabel ?? camp.badgeLabel}</span>
										{/if}
									</div>
									<div class="flex flex-1 flex-col justify-between space-y-4 p-6">
										<div>
											<p class="font-heading text-[11px] font-bold tracking-[0.14em] text-red-600 uppercase">Flash Sale</p>
											<h4 class="mt-2 font-heading text-base leading-snug font-bold text-abyss">
												<a href={resolve(`/modules/${m.courseId}`)} aria-label={`Lihat info singkat: ${m.title}`} class="rounded transition-colors duration-200 group-hover:text-red-600 focus-visible:outline-2 focus-visible:outline-red-600 after:absolute after:inset-0">{m.title}</a>
											</h4>
											<p class="mt-1 text-xs text-slate-500">Pengampu: {instructorNames.get(m.courseId) ?? '…'}</p>
											{#if m.promoEndsAt ?? camp.endsAt}
												<p class="mt-1 text-[11px] font-semibold text-red-600">Berakhir {formatTanggal(m.promoEndsAt ?? camp.endsAt)}</p>
											{/if}
										</div>
										<div class="border-t border-mist pt-4">
											<div class="flex items-baseline gap-2">
												<span class="text-sm text-slate-400 line-through">{m.priceLabel}</span>
												{#if m.promoPrice !== null}
													<span class="font-heading text-lg font-extrabold text-red-600">{formatIDR(m.promoPrice)}</span>
												{/if}
											</div>
											<a href={resolve(`/modules/${m.courseId}`)} class="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-abyss px-4 py-2.5 font-heading text-xs font-bold text-white transition-colors duration-200 hover:bg-red-600 focus-visible:outline-2 focus-visible:outline-red-600">
												Lihat Pelatihan <i class="fa-solid fa-arrow-right text-[11px]" aria-hidden="true"></i>
											</a>
										</div>
									</div>
								</article>
							{/each}
						</div>
					</div>
				{/each}
			{/if}
		</div>
	</section>

	<!-- Bagian 2: Pilihan Unggulan — kartu editorial kurasi, tanpa harga coret -->
	<section id="unggulan" aria-labelledby="unggulan-heading" class="scroll-mt-20 border-y border-mist bg-ice/60">
		<div class="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
			<div use:reveal class="flex flex-wrap items-end justify-between gap-6">
				<div class="max-w-2xl">
					<p class="flex items-center gap-3 font-heading text-xs font-bold tracking-[0.18em] text-royal uppercase">
						<span class="h-px w-8 bg-royal" aria-hidden="true"></span>
						<i class="fa-solid fa-star" aria-hidden="true"></i>
						Bagian 02 · Pilihan Unggulan
					</p>
					<h2 id="unggulan-heading" class="mt-3 font-heading text-3xl font-extrabold tracking-tight text-abyss sm:text-4xl">
						Sorotan <span class="text-royal">Pilihan Editor</span>
					</h2>
					<p class="mt-2 max-w-xl text-sm leading-relaxed text-slate-600 sm:text-base">
						Kurasi khusus dari tim Aristoteles. Bila belum ada kurasi, tampilkan yang terbaru.
					</p>
				</div>
				<a href={resolve('/pelatihan')} class="inline-flex min-h-[44px] items-center gap-2 font-heading text-sm font-bold text-royal transition-colors duration-200 hover:text-royal-hover">
					Lihat semua pelatihan <i class="fa-solid fa-arrow-right text-xs" aria-hidden="true"></i>
				</a>
			</div>

			{#if promoLoading || katalogLoading}
				<div class="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4" aria-label="Memuat pilihan unggulan">
					{#each [1, 2, 3, 4] as i (i)}
						<div class="overflow-hidden rounded-2xl border border-mist bg-white">
							<div class="h-40 animate-pulse bg-ice"></div>
							<div class="space-y-2 p-6">
								<div class="h-4 w-3/4 animate-pulse rounded bg-ice"></div>
								<div class="h-3 w-1/2 animate-pulse rounded bg-ice"></div>
							</div>
						</div>
					{/each}
				</div>
			{:else if promoError && kurasiCampaigns.length === 0 && unggulanFallback.length === 0}
				<div role="alert" class="mt-8 rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
					<p class="font-heading text-sm font-bold text-red-700">Pilihan unggulan belum dapat dimuat</p>
					<p class="mx-auto mt-1 max-w-md text-xs text-red-600">{promoError}</p>
					<button type="button" onclick={() => { void loadPromos(); void loadKatalog(); }} class="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-royal px-5 py-2.5 font-heading text-xs font-bold text-white transition-colors duration-200 hover:bg-royal-hover focus-visible:outline-2 focus-visible:outline-royal">
						<i class="fa-solid fa-rotate-right" aria-hidden="true"></i> Coba lagi
					</button>
				</div>
			{:else if kurasiCampaigns.length === 0 && unggulanFallback.length === 0}
				<div class="mt-8 rounded-2xl border border-dashed border-mist bg-white p-12 text-center">
					<i class="fa-solid fa-star mb-3 text-3xl text-slate-300" aria-hidden="true"></i>
					<p class="font-heading text-sm font-bold text-abyss">Belum ada sorotan unggulan.</p>
					<p class="mx-auto mt-1 max-w-md text-sm text-slate-500">Jelajahi katalog untuk melihat seluruh pelatihan yang tersedia.</p>
				</div>
			{:else if kurasiCampaigns.length > 0}
				{#each kurasiCampaigns as camp (camp.slug)}
					<div class="mt-10">
						<div use:reveal class="flex flex-wrap items-center gap-3 rounded-2xl border border-royal/20 bg-white px-5 py-4">
							<span class="flex h-10 w-10 items-center justify-center rounded-xl bg-royal text-sm text-white" aria-hidden="true">
								<i class="fa-solid fa-award"></i>
							</span>
							<div class="min-w-0">
								<h3 class="truncate font-heading text-base font-bold text-abyss">{camp.title}</h3>
								<p class="text-xs text-slate-500">{camp.courses.length} pelatihan pilihan editor</p>
							</div>
						</div>
						<ol class="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
							{#each camp.courses as m, i (m.courseId)}
								<li use:reveal={{ delay: (i % 2) * 80 }} class="group relative flex gap-5 overflow-hidden rounded-2xl border border-mist bg-white p-5 transition-all duration-200 hover:-translate-y-1 hover:border-royal/40 hover:shadow-xl hover:shadow-slate-900/10">
									<span class="font-heading text-3xl font-extrabold text-ice transition-colors duration-200 group-hover:text-royal/30" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
									<img src={m.image || COVER_FALLBACK} alt="" aria-hidden="true" loading="lazy" class="h-24 w-28 shrink-0 rounded-xl object-cover" />
									<div class="flex min-w-0 flex-1 flex-col justify-between gap-3">
										<div class="min-w-0">
											{#if m.badgeLabel ?? camp.badgeLabel}
												<p class="font-heading text-[11px] font-bold tracking-[0.14em] text-royal uppercase">{m.badgeLabel ?? camp.badgeLabel}</p>
											{:else}
												<p class="font-heading text-[11px] font-bold tracking-[0.14em] text-royal uppercase">Unggulan</p>
											{/if}
											<h4 class="mt-1 truncate font-heading text-base font-bold text-abyss">
												<a href={resolve(`/modules/${m.courseId}`)} aria-label={`Lihat detail: ${m.title}`} class="rounded transition-colors duration-200 group-hover:text-royal focus-visible:outline-2 focus-visible:outline-royal after:absolute after:inset-0">{m.title}</a>
											</h4>
											<p class="mt-0.5 text-xs text-slate-500">Pengampu: {instructorNames.get(m.courseId) ?? '…'}</p>
										</div>
										<div class="flex items-center justify-between gap-3 border-t border-mist pt-3">
											<span class="font-heading text-sm font-extrabold text-abyss">{m.priceLabel}</span>
											<span class="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-mist px-4 py-2 font-heading text-xs font-bold text-abyss transition-colors duration-200 group-hover:border-royal group-hover:text-royal">
												Detail <i class="fa-solid fa-arrow-right text-[11px]" aria-hidden="true"></i>
											</span>
										</div>
									</div>
								</li>
							{/each}
						</ol>
					</div>
				{/each}
			{:else}
				<div class="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
					{#each unggulanFallback as course, i (course.id)}
						<article use:reveal={{ delay: (i % 3) * 80 }} class="group relative flex flex-col overflow-hidden rounded-2xl border border-mist bg-white transition-all duration-200 hover:-translate-y-1 hover:border-royal/40 hover:shadow-xl hover:shadow-slate-900/10">
							<div class="relative overflow-hidden" aria-hidden="true">
								<img src={course.image || COVER_FALLBACK} alt={`Pelatihan terbaru: ${course.title}`} loading="lazy" class="h-44 w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
								<span class="absolute top-3 left-3 rounded-lg bg-royal px-3 py-1 font-heading text-[11px] font-bold text-white uppercase">Terbaru</span>
							</div>
							<div class="flex flex-1 flex-col justify-between space-y-4 p-6">
								<div>
									<p class="font-heading text-[11px] font-bold tracking-[0.14em] text-royal uppercase">Unggulan</p>
									<h3 class="mt-2 font-heading text-base leading-snug font-bold text-abyss">
										<a href={resolve(`/modules/${course.id}`)} aria-label={`Lihat detail: ${course.title}`} class="rounded transition-colors duration-200 group-hover:text-royal focus-visible:outline-2 focus-visible:outline-royal after:absolute after:inset-0">{course.title}</a>
									</h3>
									<p class="mt-1 text-xs text-slate-500">Pengampu: {instructorNames.get(course.id) ?? '…'}</p>
								</div>
								<div class="flex items-center justify-between gap-3 border-t border-mist pt-4">
									<span class="font-heading font-extrabold text-abyss">{course.priceLabel}</span>
									<span class="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-mist px-4 py-2 font-heading text-xs font-bold text-abyss transition-colors duration-200 group-hover:border-royal group-hover:text-royal">
										Detail <i class="fa-solid fa-arrow-right text-[11px]" aria-hidden="true"></i>
									</span>
								</div>
							</div>
						</article>
					{/each}
				</div>
			{/if}
		</div>
	</section>

	<!-- Bagian 3: Promo Patungan — daftar kampanye + kalkulator grup -->
	<section id="patungan-info" aria-labelledby="patungan-info-heading" class="scroll-mt-20 bg-white">
		<div class="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
			<div use:reveal class="max-w-2xl">
				<p class="flex items-center gap-3 font-heading text-xs font-bold tracking-[0.18em] text-teal uppercase">
					<span class="h-px w-8 bg-teal" aria-hidden="true"></span>
					<i class="fa-solid fa-people-group" aria-hidden="true"></i>
					Bagian 03 · Promo Patungan
				</p>
				<h2 id="patungan-info-heading" class="mt-3 font-heading text-3xl font-extrabold tracking-tight text-abyss sm:text-4xl">
					Belajar Bareng, <span class="text-teal">Bayar Patungan</span>
				</h2>
				<p class="mt-2 max-w-xl text-sm leading-relaxed text-slate-600 sm:text-base">
					Pelatihan di bawah ini terdaftar dalam promo patungan admin. Bentuk grup,
					bagi totalnya, dan bayar per orang lewat kalkulator.
				</p>
			</div>

			{#if promoLoading}
				<div class="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3" aria-label="Memuat promo patungan">
					{#each [1, 2, 3] as i (i)}
						<div class="rounded-2xl border border-mist bg-white p-6">
							<div class="h-4 w-2/3 animate-pulse rounded bg-ice"></div>
							<div class="mt-2 h-3 w-1/2 animate-pulse rounded bg-ice"></div>
						</div>
					{/each}
				</div>
			{:else if promoError && patunganCampaigns.length === 0}
				<div role="alert" class="mt-8 rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
					<p class="font-heading text-sm font-bold text-red-700">Promo patungan belum dapat dimuat</p>
					<p class="mx-auto mt-1 max-w-md text-xs text-red-600">{promoError}</p>
					<button type="button" onclick={() => void loadPromos()} class="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-royal px-5 py-2.5 font-heading text-xs font-bold text-white transition-colors duration-200 hover:bg-royal-hover focus-visible:outline-2 focus-visible:outline-royal">
						<i class="fa-solid fa-rotate-right" aria-hidden="true"></i> Coba lagi
					</button>
				</div>
			{:else if patunganCampaigns.length === 0}
				<div class="mt-8 rounded-2xl border border-dashed border-mist bg-white p-12 text-center">
					<i class="fa-solid fa-people-group mb-3 text-3xl text-slate-300" aria-hidden="true"></i>
					<p class="font-heading text-sm font-bold text-abyss">Belum ada promo patungan khusus.</p>
					<p class="mx-auto mt-1 max-w-md text-sm text-slate-500">Hanya kursus yang dipilih admin yang bisa ikut patungan. Cek lagi nanti.</p>
				</div>
			{:else}
				<div class="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
					{#each patunganCampaigns as camp (camp.slug)}
						<div use:reveal class="flex flex-col rounded-2xl border border-teal/30 bg-teal/5 p-6">
							<p class="flex items-center gap-2 font-heading text-[11px] font-bold tracking-[0.14em] text-teal uppercase">
								<i class="fa-solid fa-people-group" aria-hidden="true"></i>
								{camp.badgeLabel ?? 'Patungan'}
							</p>
							<h3 class="mt-2 font-heading text-base font-bold text-abyss">{camp.title}</h3>
							<p class="mt-1 text-xs text-slate-500">
								Berakhir {formatTanggal(camp.endsAt)} · {camp.courses.length} pelatihan
							</p>
							<ul class="mt-4 space-y-2 border-t border-teal/20 pt-4">
								{#each camp.courses as m (m.courseId)}
									<li>
										<a href={resolve(`/patungan/setup/${m.courseId}`)} class="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors hover:bg-teal/10 focus-visible:outline-2 focus-visible:outline-teal" aria-label={`Buat grup patungan: ${m.title}`}>
											<span class="min-w-0 flex-1 truncate font-semibold text-abyss">{m.title}</span>
											<span class="flex shrink-0 items-center gap-2 text-xs font-bold text-teal">
												{m.priceLabel}
												<i class="fa-solid fa-arrow-right text-[11px]" aria-hidden="true"></i>
											</span>
										</a>
									</li>
								{/each}
							</ul>
							<a href={resolve('/patungan/saya')} class="mt-4 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-abyss px-4 py-2.5 font-heading text-xs font-bold text-white transition-colors duration-200 hover:bg-teal focus-visible:outline-2 focus-visible:outline-teal">
								Grup patunganku <i class="fa-solid fa-arrow-right text-[11px]" aria-hidden="true"></i>
							</a>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</section>

	{#if patunganCampaigns.length > 0}
		<PatunganSection courses={patunganCourses} loading={promoLoading || katalogLoading} />
	{/if}
</main>

<PublicFooter />
