<script lang="ts">
	import { browser } from '$app/environment';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import { fetchPromo, type PromoCampaign } from '$lib/api/promos';
	import { fetchMyEnrollments } from '$lib/api/progress';
	import { formatIDR } from '$lib/data/payment';
	import { toast } from '$lib/stores/toast.svelte';

	const COVER_FALLBACK =
		'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=800&q=80';

	const slug = $derived(page.params.slug ?? '');

	let camp = $state<PromoCampaign | null>(null);
	let enrolledIds = $state(new Set<number>());
	let loading = $state(true);
	let loadError = $state('');
	let notFound = $state(false);
	let started = false;
	let loadSeq = 0;

	function formatTanggal(value: string | null): string {
		if (!value) return '—';
		const d = new Date(value);
		return Number.isNaN(d.getTime())
			? value
			: d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
	}

	async function load(): Promise<void> {
		const my = ++loadSeq;
		loading = true;
		loadError = '';
		notFound = false;
		try {
			const [c, enr] = await Promise.all([
				fetchPromo(slug),
				fetchMyEnrollments().catch(() => [])
			]);
			if (my !== loadSeq) return;
			camp = c;
			enrolledIds = new Set(enr.map((e) => e.courseId));
		} catch (e) {
			if (my !== loadSeq) return;
			camp = null;
			const msg = e instanceof Error ? e.message : '';
			if (/404|tidak ditemukan|berakhir/i.test(msg)) {
				notFound = true;
			} else {
				loadError = msg || 'Gagal memuat promo.';
				toast.error(loadError);
			}
		} finally {
			if (my === loadSeq) loading = false;
		}
	}

	$effect(() => {
		if (!browser || started) return;
		started = true;
		void load();
	});

	const typeLabel = $derived(
		camp?.type === 'diskon' ? 'Flash Sale' : camp?.type === 'patungan' ? 'Promo Patungan' : 'Pilihan Unggulan'
	);
</script>

<svelte:head>
	<title>{camp ? `${camp.title} — Promo` : 'Promo'} — Aristoteles Platform</title>
	<meta
		name="description"
		content={camp
			? `${camp.title}: ${camp.courses.length} kursus promo untuk peserta.`
			: 'Detail promo kursus untuk peserta ARISTOTELES.'}
	/>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="page-wrap page-stack">
	{#if loading}
		<div aria-label="Memuat promo">
			<div class="h-8 w-2/3 animate-pulse rounded bg-slate-200"></div>
			<div class="mt-3 h-4 w-1/2 animate-pulse rounded bg-slate-200"></div>
			<div class="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
				{#each [1, 2, 3] as i (i)}
					<div class="h-64 animate-pulse rounded-2xl bg-slate-100"></div>
				{/each}
			</div>
		</div>
	{:else if loadError}
		<div role="alert" class="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
			<p class="text-sm font-bold text-red-700">Promo belum dapat dimuat</p>
			<p class="mx-auto mt-1 max-w-md text-xs text-red-600">{loadError}</p>
			<button
				type="button"
				onclick={() => void load()}
				class="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-red-600"
			>
				<i class="fa-solid fa-rotate-right" aria-hidden="true"></i> Coba lagi
			</button>
		</div>
	{:else if notFound || !camp}
		<EmptyState
			icon="fa-tags"
			title="Promo tidak ditemukan"
			description="Kampanye ini tidak ada, sudah berakhir, atau masih draft."
		>
			{#snippet actions()}
				<a
					href={resolve('/user/semua-kursus')}
					class="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
				>
					<i class="fa-solid fa-arrow-left" aria-hidden="true"></i> Lihat katalog
				</a>
			{/snippet}
		</EmptyState>
	{:else}
		{@const badgeLabel = camp?.badgeLabel}
		<PageHeader
			eyebrow={`Promo · ${typeLabel}`}
			title={camp.title}
			description={camp.type === 'diskon'
				? `Diskon ${camp.discountPercent ?? 0}% otomatis saat bayar${camp.endsAt ? ` · berakhir ${formatTanggal(camp.endsAt)}` : ''}. Tanpa kode kupon.`
				: camp.type === 'patungan'
					? `Bentuk grup dan bayar patungan. Harga khusus patungan per kursus bila ditetapkan admin${camp.endsAt ? ` · berakhir ${formatTanggal(camp.endsAt)}` : ''}.`
					: `Kurasi pilihan editor${camp.endsAt ? ` · sampai ${formatTanggal(camp.endsAt)}` : ''}.`}
		>
			{#snippet actions()}
				{#if badgeLabel}
					<span class="inline-flex items-center rounded-full bg-red-600 px-3 py-1 text-[11px] font-extrabold text-white uppercase">
						{badgeLabel}
					</span>
				{/if}
			{/snippet}
		</PageHeader>

		{#if camp.courses.length === 0}
			<EmptyState
				icon="fa-tags"
				title="Belum ada kursus di promo ini"
				description="Admin masih melengkapi daftarnya. Cek lagi nanti."
			/>
		{:else}
			<ul class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
				{#each camp.courses as course (course.courseId)}
					{@const owned = enrolledIds.has(course.courseId)}
					{@const hasDiscount =
						course.discountPercent !== null && (course.promoPrice ?? course.priceNominal) < course.priceNominal}
					<li
						class="flex flex-col overflow-hidden rounded-2xl border border-slate-200/70 bg-white transition-shadow hover:shadow-lg"
					>
						<div class="relative">
							<img
								src={course.image || COVER_FALLBACK}
								alt=""
								loading="lazy"
								class="h-36 w-full object-cover"
							/>
							{#if hasDiscount}
								<span class="absolute top-2 left-2 rounded-full bg-red-600 px-2.5 py-1 text-[11px] font-extrabold text-white">
									−{course.discountPercent}%
								</span>
							{/if}
						</div>
						<div class="flex flex-1 flex-col gap-1.5 p-4">
							<h2 class="line-clamp-2 text-sm font-extrabold text-slate-900">{course.title}</h2>
							<div class="flex flex-wrap items-baseline gap-x-2">
								{#if hasDiscount}
									<span class="text-xs text-slate-400 line-through">{course.priceLabel}</span>
									<span class="text-base font-black text-red-700">
										{formatIDR(course.promoPrice ?? course.priceNominal)}
									</span>
								{:else}
									<span class="text-base font-black text-slate-900">{course.priceLabel}</span>
								{/if}
							</div>
							{#if course.patunganPrice !== null && course.patunganPrice !== undefined}
								<p class="text-[11px] font-bold text-teal-700">
									Harga patungan: {formatIDR(course.patunganPrice)} total grup
								</p>
							{/if}
							{#if course.promoEndsAt}
								<p class="text-[11px] font-semibold text-amber-700">
									<i class="fa-solid fa-clock" aria-hidden="true"></i>
									Harga promo s.d. {formatTanggal(course.promoEndsAt)}
								</p>
							{/if}
							<div class="mt-auto space-y-2 pt-2">
								{#if owned}
									<span
										class="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-50 px-4 py-2.5 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200"
									>
										<i class="fa-solid fa-check" aria-hidden="true"></i> Sudah dimiliki
									</span>
								{:else}
									<a
										href={resolve(`/user/pembayaran/${course.courseId}`)}
										class="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
									>
										<i class="fa-solid fa-cart-shopping" aria-hidden="true"></i>
										Beli{hasDiscount ? ' dengan diskon' : ''}
									</a>
								{/if}
								{#if camp.type === 'patungan' && !owned}
									<a
										href={resolve(`/patungan/setup/${course.courseId}`)}
										class="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-teal-300 bg-teal-50 px-4 py-2.5 text-xs font-bold text-teal-800 transition-colors hover:bg-teal-100 focus-visible:outline-2 focus-visible:outline-teal"
									>
										<i class="fa-solid fa-people-group" aria-hidden="true"></i> Buat grup patungan
									</a>
								{/if}
							</div>
						</div>
					</li>
				{/each}
			</ul>
			<p class="text-center text-[11px] text-slate-400">
				Diskon promo diterapkan otomatis di halaman pembayaran (tidak digabung voucher — yang terbesar yang dipakai).
			</p>
		{/if}
	{/if}
</div>
