<script lang="ts">
	import '../../../app.css';
	import { browser } from '$app/environment';
	import { resolve } from '$app/paths';
	import PublicHeader from '$lib/components/public/PublicHeader.svelte';
	import PublicFooter from '$lib/components/public/PublicFooter.svelte';
	import SeoHead from '$lib/components/SeoHead.svelte';
	import { reveal } from '$lib/actions/reveal';
	import { fetchMyPatunganGroups, type PatunganGroupSummary } from '$lib/api/patungan';
	import { getAccessToken } from '$lib/stores/auth.svelte';
	import { formatIDR } from '$lib/data/payment';

	let { data }: { data: { origin: string } } = $props();

	let groups = $state<PatunganGroupSummary[]>([]);
	let loading = $state(true);
	let loadError = $state('');

	async function load(): Promise<void> {
		loading = true;
		loadError = '';
		try {
			groups = await fetchMyPatunganGroups();
		} catch (e) {
			loadError = e instanceof Error ? e.message : 'Gagal memuat grup.';
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		if (!browser) return;
		if (getAccessToken() === null) {
			loading = false;
			return;
		}
		void load();
	});
</script>

<SeoHead
	title="Grup Patunganku — ARISTOTELES"
	description="Daftar grup patungan yang kamu ikuti beserta progres pelunasannya."
	path="/patungan/saya"
	origin={data.origin}
/>

<PublicHeader active="promo" />

<main class="bg-ice/60">
	<div class="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
		<nav aria-label="Kembali" class="mb-6">
			<a href={resolve('/promo#patungan')} class="inline-flex min-h-[44px] items-center gap-2 font-heading text-sm font-bold text-royal hover:text-royal-hover">
				<i class="fa-solid fa-arrow-left text-xs" aria-hidden="true"></i> Kembali ke Promo
			</a>
		</nav>

		<div use:reveal>
			<p class="flex items-center gap-3 font-heading text-xs font-bold tracking-[0.18em] text-teal uppercase">
				<span class="h-px w-8 bg-teal" aria-hidden="true"></span>
				<i class="fa-solid fa-people-group" aria-hidden="true"></i>
				Patungan Saya
			</p>
			<h1 class="mt-3 font-heading text-3xl font-extrabold tracking-tight text-abyss sm:text-4xl">
				Grup Patunganku
			</h1>
		</div>

		<div class="mt-8">
			{#if loading}
				<div class="space-y-4" aria-label="Memuat grup">
					{#each [1, 2] as i (i)}
						<div class="rounded-2xl border border-mist bg-white p-6">
							<div class="h-4 w-1/2 animate-pulse rounded bg-ice"></div>
							<div class="mt-2 h-3 w-3/4 animate-pulse rounded bg-ice"></div>
						</div>
					{/each}
				</div>
			{:else if getAccessToken() === null}
				<div class="rounded-2xl border border-dashed border-mist bg-white p-12 text-center">
					<p class="font-heading text-sm font-bold text-abyss">Masuk dulu untuk melihat grupmu.</p>
					<a href={resolve(`/login?returnTo=${encodeURIComponent('/patungan/saya')}`)} class="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-royal px-6 py-2.5 font-heading text-xs font-bold text-white hover:bg-royal-hover">
						Masuk & kembali ke sini <i class="fa-solid fa-arrow-right text-xs" aria-hidden="true"></i>
					</a>
				</div>
			{:else if loadError}
				<div role="alert" class="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
					<p class="font-heading text-sm font-bold text-red-700">Grup belum dapat dimuat</p>
					<p class="mx-auto mt-1 max-w-md text-xs text-red-600">{loadError}</p>
					<button type="button" onclick={() => void load()} class="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-royal px-5 py-2.5 font-heading text-xs font-bold text-white hover:bg-royal-hover">
						<i class="fa-solid fa-rotate-right" aria-hidden="true"></i> Coba lagi
					</button>
				</div>
			{:else if groups.length === 0}
				<div class="rounded-2xl border border-dashed border-mist bg-white p-12 text-center">
					<p class="font-heading text-sm font-bold text-abyss">Belum ada grup patungan.</p>
					<p class="mx-auto mt-1 max-w-md text-sm text-slate-500">Buat grup baru dari halaman promo patungan.</p>
					<a href={resolve('/promo#patungan')} class="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-royal px-6 py-2.5 font-heading text-xs font-bold text-white hover:bg-royal-hover">
						Lihat promo patungan
					</a>
				</div>
			{:else}
				<ul class="space-y-4">
					{#each groups as g (g.id)}
						<li use:reveal>
							<a href={resolve(`/patungan/${g.id}`)} class="group flex items-center gap-4 rounded-2xl border border-mist bg-white p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-teal/50 hover:shadow-xl hover:shadow-slate-900/10">
								<div class="min-w-0 flex-1">
									<div class="flex flex-wrap items-center gap-2">
										<span class="font-mono text-xs font-bold text-teal">{g.code}</span>
										{#if g.status === 'pending'}
											<span class="rounded-md bg-amber-100 px-2 py-0.5 font-heading text-[10px] font-bold tracking-wider text-amber-800 uppercase">Pending · {g.paidCount}/{g.memberCount}</span>
										{:else if g.status === 'complete'}
											<span class="rounded-md bg-emerald-100 px-2 py-0.5 font-heading text-[10px] font-bold tracking-wider text-emerald-800 uppercase">Complete</span>
										{:else}
											<span class="rounded-md bg-slate-100 px-2 py-0.5 font-heading text-[10px] font-bold tracking-wider text-slate-600 uppercase">Dibatalkan</span>
										{/if}
									</div>
									<p class="mt-1 truncate font-heading text-base font-bold text-abyss group-hover:text-teal">{g.courseTitle ?? `Kursus #${g.courseId}`}</p>
									<p class="mt-0.5 text-xs text-slate-500">Total {formatIDR(g.priceNominal)} · {g.memberCount} anggota</p>
								</div>
								<i class="fa-solid fa-arrow-right shrink-0 text-xs text-slate-300 transition-transform duration-200 group-hover:translate-x-1 group-hover:text-teal" aria-hidden="true"></i>
							</a>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	</div>
</main>

<PublicFooter />
