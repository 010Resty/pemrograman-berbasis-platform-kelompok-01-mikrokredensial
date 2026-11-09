<script lang="ts">
	import { browser } from '$app/environment';
	import { resolve } from '$app/paths';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import { fetchPromos, type PromoCampaign } from '$lib/api/promos';
	import { fetchMyEnrollments } from '$lib/api/progress';
	import { formatIDR } from '$lib/data/payment';

	/**
	 * Etalase promo untuk peserta: kampanye aktif kurasi admin + harga coret
	 * server + tombol beli. Diskon diterapkan OTOMATIS di pembayaran
	 * (server sumber kebenaran; klien hanya cermin) — tanpa kode kupon.
	 */

	const COVER_FALLBACK =
		'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=800&q=80';

	let promos = $state<PromoCampaign[]>([]);
	let enrolledIds = $state(new Set<number>());
	let loading = $state(true);
	let loadError = $state('');
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
		try {
			const [camps, enr] = await Promise.all([
				fetchPromos(),
				fetchMyEnrollments().catch(() => [])
			]);
			if (my !== loadSeq) return;
			promos = camps.filter((c) => c.courses.length > 0);
			enrolledIds = new Set(enr.map((e) => e.courseId));
		} catch (e) {
			if (my !== loadSeq) return;
			loadError = e instanceof Error ? e.message : 'Gagal memuat promo.';
		} finally {
			if (my === loadSeq) loading = false;
		}
	}

	$effect(() => {
		if (!browser || started) return;
		started = true;
		void load();
	});

	const totalCourses = $derived(promos.reduce((n, c) => n + c.courses.length, 0));
</script>

<svelte:head>
	<title>Promo — Aristoteles Platform</title>
	<meta
		name="description"
		content="Promo kursus aktif untuk peserta: diskon otomatis saat pembayaran, tanpa kode kupon."
	/>
</svelte:head>

<div class="page-wrap page-stack">
	<PageHeader
		eyebrow="Menu Utama · Promo"
		title="Promo"
		description={loading
			? 'Memuat promo aktif…'
			: `${promos.length} kampanye · ${totalCourses} kursus diskon. Diskon diterapkan otomatis saat pembayaran.`}
	/>

	{#if loading}
		<div class="grid grid-cols-1 gap-5 md:grid-cols-2" aria-label="Memuat promo">
			{#each [1, 2] as i (i)}
				<div class="animate-pulse overflow-hidden rounded-2xl border border-slate-200/70 bg-white">
					<div class="h-44 bg-slate-100"></div>
					<div class="space-y-2 p-5">
						<div class="h-4 rounded bg-slate-100"></div>
						<div class="h-4 w-2/3 rounded bg-slate-100"></div>
					</div>
				</div>
			{/each}
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
	{:else if promos.length === 0}
		<div class="rounded-2xl border border-dashed border-slate-300 bg-white">
			<EmptyState
				icon="fa-tags"
				title="Belum ada promo aktif"
				description="Saat ini tidak ada kampanye diskon. Jelajahi katalog atau tukarkan kode voucher di Kursusku."
			>
				{#snippet actions()}
					<a
						href={resolve('/user/semua-kursus')}
						class="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
					>
						Lihat Semua Kursus <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
					</a>
				{/snippet}
			</EmptyState>
		</div>
	{:else}
		{#each promos as camp (camp.slug)}
			<section
				aria-label={`Promo ${camp.title}`}
				class="overflow-hidden rounded-2xl border border-slate-200/70 bg-white"
			>
				<div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-gradient-to-r from-red-50 to-amber-50 px-5 py-4">
					<div class="flex min-w-0 items-center gap-3">
						<span
							class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-600 text-lg text-white"
							aria-hidden="true"
						>
							<i class="fa-solid fa-tags"></i>
						</span>
						<div class="min-w-0">
							<h2 class="truncate text-base font-extrabold text-slate-900">{camp.title}</h2>
							<p class="text-[11px] font-semibold text-slate-500">
								{#if camp.discountPercent !== null}
									Diskon {camp.discountPercent}% otomatis
								{:else}
									Kurasi admin
								{/if}
								{#if camp.endsAt}
									· berakhir {formatTanggal(camp.endsAt)}
								{/if}
							</p>
						</div>
					</div>
					{#if camp.badgeLabel}
						<span class="shrink-0 rounded-full bg-red-600 px-3 py-1 text-[11px] font-extrabold text-white uppercase">
							{camp.badgeLabel}
						</span>
					{/if}
				</div>

				<ul class="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3">
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
								<h3 class="line-clamp-2 text-sm font-extrabold text-slate-900">{course.title}</h3>
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
								{#if course.promoEndsAt}
									<p class="text-[11px] font-semibold text-amber-700">
										<i class="fa-solid fa-clock" aria-hidden="true"></i>
										Harga promo s.d. {formatTanggal(course.promoEndsAt)}
									</p>
								{/if}
								<div class="mt-auto pt-2">
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
								</div>
							</div>
						</li>
					{/each}
				</ul>
			</section>
		{/each}
		<p class="text-center text-[11px] text-slate-400">
			Diskon promo diterapkan otomatis di halaman pembayaran (tidak digabung voucher — yang terbesar yang dipakai).
		</p>
	{/if}
</div>
