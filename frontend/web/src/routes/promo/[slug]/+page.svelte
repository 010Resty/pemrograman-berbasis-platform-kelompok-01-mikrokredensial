<script lang="ts">
	import { browser } from '$app/environment';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import PublicHeader from '$lib/components/public/PublicHeader.svelte';
	import PublicFooter from '$lib/components/public/PublicFooter.svelte';
	import SeoHead from '$lib/components/SeoHead.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import { canonicalPath } from '$lib/seo/site';
	import { reveal } from '$lib/actions/reveal';
	import { fetchPromo, type PromoCampaign } from '$lib/api/promos';
	import { fileUrl, type BackendCourse } from '$lib/api/courses';
	import { buildSrcSet } from '$lib/api/responsive';
	import PatunganSection from '$lib/components/public/PatunganSection.svelte';

	const COVER_FALLBACK =
		'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=800&q=80';

	const slug = $derived(page.params.slug ?? '');

	let camp = $state<PromoCampaign | null>(null);
	let loading = $state(true);
	let loadError = $state('');
	let notFound = $state(false);
	let now = $state(Date.now());
	let started = false;
	let loadSeq = 0;

	async function load(): Promise<void> {
		const my = ++loadSeq;
		loading = true;
		loadError = '';
		notFound = false;
		try {
			const c = await fetchPromo(slug);
			if (my !== loadSeq) return;
			camp = c;
		} catch (e) {
			if (my !== loadSeq) return;
			camp = null;
			const msg = e instanceof Error ? e.message : '';
			if (/404|tidak ditemukan|berakhir/i.test(msg)) {
				notFound = true;
			} else {
				loadError = msg || 'Gagal memuat promo.';
			}
		} finally {
			if (my === loadSeq) loading = false;
		}
	}

	$effect(() => {
		if (!browser || started) return;
		started = true;
		void load();
		const id = setInterval(() => {
			now = Date.now();
		}, 1000);
		return () => clearInterval(id);
	});

	function formatTanggal(value: string | null): string {
		if (!value) return '—';
		const d = new Date(value);
		return Number.isNaN(d.getTime())
			? value
			: d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
	}

	function formatIDR(n: number): string {
		return `Rp ${Number(n || 0).toLocaleString('id-ID')}`;
	}

	const countdown = $derived.by(() => {
		if (!camp?.endsAt) return null;
		const diff = new Date(camp.endsAt).getTime() - now;
		if (Number.isNaN(diff) || diff <= 0) return null;
		const s = Math.floor(diff / 1000);
		return {
			hari: Math.floor(s / 86400),
			jam: Math.floor((s % 86400) / 3600),
			menit: Math.floor((s % 3600) / 60),
			detik: s % 60
		};
	});

	const accent = $derived(
		camp?.type === 'diskon'
			? { text: 'text-red-600', bg: 'bg-red-600', ring: 'hover:border-red-300', chip: 'bg-red-600' }
			: camp?.type === 'patungan'
				? { text: 'text-teal', bg: 'bg-teal', ring: 'hover:border-teal/50', chip: 'bg-teal' }
				: { text: 'text-royal', bg: 'bg-royal', ring: 'hover:border-royal/40', chip: 'bg-royal' }
	);

	const typeLabel = $derived(
		camp?.type === 'diskon' ? 'Flash Sale' : camp?.type === 'patungan' ? 'Promo Patungan' : 'Pilihan Unggulan'
	);

	const patunganCourses = $derived.by((): BackendCourse[] => {
		if (!camp || camp.type !== 'patungan') return [];
		return camp.courses
			.filter((m) => (m.priceNominal ?? 0) > 0)
			.map(
				(m) =>
					({
						id: m.courseId,
						title: m.title,
						description: null,
						category: null,
						level: 'Semua level',
						duration: null,
						image: m.image,
						status: 'published' as const,
						priceLabel: m.priceLabel,
						priceNominal: m.priceNominal,
						period: 'ongoing',
						startMonth: null,
						outcomes: null,
						requirements: null,
						tools: null,
						createdBy: null
					}) satisfies BackendCourse
			);
	});

	const patunganPrices = $derived.by((): Record<number, number> => {
		const map: Record<number, number> = {};
		for (const m of camp?.courses ?? []) {
			if (m.patunganPrice !== null && m.patunganPrice !== undefined) {
				map[m.courseId] = m.patunganPrice;
			}
		}
		return map;
	});
</script>

<svelte:head>
	<title>{camp ? `${camp.title} — Promo ARISTOTELES` : 'Promo — ARISTOTELES'}</title>
	<meta
		name="description"
		content={camp
			? `${camp.title}: ${camp.courses.length} pelatihan promo. Harga promo dari server adalah harga yang dipakai saat bayar.`
			: 'Detail promo pelatihan ARISTOTELES.'}
	/>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<PublicHeader active="promo" />

<main>
	{#if loading}
		<div class="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8" aria-label="Memuat promo">
			<div class="h-8 w-2/3 animate-pulse rounded bg-slate-200"></div>
			<div class="mt-3 h-4 w-1/2 animate-pulse rounded bg-slate-200"></div>
			<div class="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
				{#each [1, 2, 3] as i (i)}
					<div class="overflow-hidden rounded-2xl border border-mist bg-white">
						<div class="h-48 animate-pulse bg-ice"></div>
						<div class="space-y-2 p-6">
							<div class="h-4 w-3/4 animate-pulse rounded bg-ice"></div>
							<div class="h-3 w-1/2 animate-pulse rounded bg-ice"></div>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{:else if loadError}
		<div class="mx-auto max-w-3xl px-4 py-16 sm:px-6" role="alert">
			<div class="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
				<p class="font-heading text-sm font-bold text-red-700">Promo belum dapat dimuat</p>
				<p class="mx-auto mt-1 max-w-md text-xs text-red-600">{loadError}</p>
				<button
					type="button"
					onclick={() => void load()}
					class="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-royal px-5 py-2.5 font-heading text-xs font-bold text-white transition-colors duration-200 hover:bg-royal-hover focus-visible:outline-2 focus-visible:outline-royal"
				>
					<i class="fa-solid fa-rotate-right" aria-hidden="true"></i> Coba lagi
				</button>
			</div>
		</div>
	{:else if notFound || !camp}
		<div class="mx-auto max-w-3xl px-4 py-16 sm:px-6">
			<EmptyState
				icon="fa-tags"
				title="Promo tidak ditemukan"
				description="Kampanye ini tidak ada, sudah berakhir, atau masih draft. Lihat promo aktif lainnya."
			>
				{#snippet actions()}
					<a
						href={resolve('/promo')}
						class="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-royal px-5 py-2.5 font-heading text-xs font-bold text-white transition-colors duration-200 hover:bg-royal-hover focus-visible:outline-2 focus-visible:outline-royal"
					>
						<i class="fa-solid fa-arrow-left" aria-hidden="true"></i> Semua promo
					</a>
				{/snippet}
			</EmptyState>
		</div>
	{:else}
		<!-- Hero per jenis promo -->
		<section aria-labelledby="promo-detail-heading" class="relative overflow-hidden bg-abyss">
			<div class="pointer-events-none absolute inset-0" aria-hidden="true">
				<div class="absolute -top-24 left-[8%] h-64 w-64 rounded-full bg-royal/30 blur-3xl"></div>
				<div class="absolute -right-16 -bottom-24 h-72 w-72 rounded-full bg-teal/20 blur-3xl"></div>
			</div>
			<div class="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
				<p class="flex flex-wrap items-center gap-2">
					<a href={resolve('/promo')} class="text-xs font-bold text-slate-300 hover:text-white">Promo</a>
					<span class="text-slate-500" aria-hidden="true">/</span>
					<span class="rounded-full bg-white/10 px-3 py-1 font-heading text-[11px] font-bold tracking-wider text-white uppercase">
						{typeLabel}
					</span>
					{#if camp.badgeLabel}
						<span class={`rounded-full px-3 py-1 font-heading text-[11px] font-bold text-white uppercase ${accent.chip}`}>
							{camp.badgeLabel}
						</span>
					{/if}
				</p>
				<h1 id="promo-detail-heading" class="mt-3 max-w-3xl font-heading text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
					{camp.title}
				</h1>
				<p class="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300 sm:text-base">
					{#if camp.type === 'diskon'}
						Diskon {camp.discountPercent ?? 0}% otomatis saat bayar — tanpa kode kupon.
					{:else if camp.type === 'patungan'}
						Bentuk grup {2}–{15} orang dan bayar patungan: total grup dibagi rata, akses dibuka setelah semua lunas.
					{:else}
						Kurasi pilihan editor Aristoteles — pelatihan terpilih tanpa embel-embel.
					{/if}
					{#if camp.endsAt}Berlaku s.d. {formatTanggal(camp.endsAt)}.{/if}
				</p>
				{#if camp.type === 'diskon' && countdown}
					<div class="mt-6 flex items-center gap-2" role="timer" aria-label={`Berakhir dalam ${countdown.hari} hari ${countdown.jam} jam ${countdown.menit} menit`}>
						{#each [{ v: countdown.hari, l: 'Hari' }, { v: countdown.jam, l: 'Jam' }, { v: countdown.menit, l: 'Mnt' }, { v: countdown.detik, l: 'Dtk' }] as u (u.l)}
							<span class="min-w-16 rounded-2xl border border-white/15 bg-white/10 px-3 py-2 text-center backdrop-blur">
								<span class="block font-heading text-2xl font-extrabold text-white tabular-nums">{String(u.v).padStart(2, '0')}</span>
								<span class="block text-[10px] font-bold tracking-widest text-slate-300 uppercase">{u.l}</span>
							</span>
						{/each}
					</div>
				{/if}
			</div>
		</section>

		<!-- Daftar kursus kampanye -->
		<section aria-label={`Kursus dalam ${camp.title}`} class="bg-white">
			<div class="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
				{#if camp.courses.length === 0}
					<div class="rounded-2xl border border-dashed border-mist bg-white p-12 text-center">
						<p class="font-heading text-sm font-bold text-abyss">Belum ada kursus di promo ini.</p>
						<p class="mx-auto mt-1 max-w-md text-sm text-slate-500">Admin masih melengkapi daftarnya. Cek lagi nanti.</p>
					</div>
				{:else}
					<div class="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
						{#each camp.courses as m, i (m.courseId)}
							<article use:reveal={{ delay: (i % 3) * 80 }} class="group relative flex flex-col overflow-hidden rounded-2xl border border-mist bg-white transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-900/10">
								<div class="relative overflow-hidden" aria-hidden="true">
									<img src={m.image || COVER_FALLBACK} srcset={m.image ? (buildSrcSet(fileUrl(m.image), [400, 800]) ?? undefined) : undefined} sizes="(max-width: 768px) 100vw, 33vw" alt="" loading="lazy" class="h-48 w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
									{#if camp.type === 'diskon'}
										<span class="absolute top-3 left-3 rounded-lg bg-abyss px-3 py-1 font-heading text-xs font-bold text-white">−{m.discountPercent ?? camp.discountPercent ?? 0}%</span>
									{/if}
									{#if m.badgeLabel ?? camp.badgeLabel}
										<span class="absolute top-3 right-3 rounded-lg bg-red-600 px-3 py-1 font-heading text-[11px] font-bold text-white uppercase">{m.badgeLabel ?? camp.badgeLabel}</span>
									{/if}
								</div>
								<div class="flex flex-1 flex-col justify-between space-y-4 p-6">
									<div>
										<h2 class="font-heading text-base leading-snug font-bold text-abyss">
											<a href={resolve(`/modules/${m.courseId}`)} aria-label={`Lihat detail: ${m.title}`} class="rounded transition-colors duration-200 group-hover:text-royal focus-visible:outline-2 focus-visible:outline-royal after:absolute after:inset-0">{m.title}</a>
										</h2>
										{#if camp.type === 'patungan' && m.patunganPrice !== null && m.patunganPrice !== undefined}
											<p class="mt-1 text-xs font-bold text-teal">Harga patungan: {formatIDR(m.patunganPrice)} total grup</p>
										{/if}
									</div>
									<div class="flex items-center justify-between gap-3 border-t border-mist pt-4">
										{#if camp.type === 'diskon' && m.promoPrice !== null && m.promoPrice < m.priceNominal}
											<p>
												<span class="block text-xs text-slate-400 line-through">{m.priceLabel}</span>
												<span class="font-heading text-lg font-extrabold text-red-600">{formatIDR(m.promoPrice)}</span>
											</p>
										{:else}
											<span class="font-heading text-lg font-extrabold text-abyss">{m.priceLabel}</span>
										{/if}
										<span class="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-mist px-4 py-2 font-heading text-xs font-bold text-abyss">
											Detail <i class="fa-solid fa-arrow-right text-[11px]" aria-hidden="true"></i>
										</span>
									</div>
									{#if camp.type === 'patungan'}
										<a href={resolve(`/patungan/setup/${m.courseId}`)} class="relative z-10 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-teal px-4 py-2.5 font-heading text-xs font-bold text-white transition-colors duration-200 hover:bg-teal-600 focus-visible:outline-2 focus-visible:outline-teal">
											<i class="fa-solid fa-people-group" aria-hidden="true"></i> Buat grup patungan
										</a>
									{/if}
								</div>
							</article>
						{/each}
					</div>
				{/if}
			</div>
		</section>

		{#if camp.type === 'patungan' && patunganCourses.length > 0}
			<PatunganSection courses={patunganCourses} patunganPrices={patunganPrices} loading={false} />
		{/if}
	{/if}
</main>

<PublicFooter />
