<script lang="ts">
	import { browser } from '$app/environment';
	import { resolve } from '$app/paths';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import PromoProposeModal from '$lib/components/instruktur/PromoProposeModal.svelte';
	import {
		fetchInstructorPromoMemberships,
		fetchMyPromoProposals,
		fetchPromos,
		markPromoProposalsSeen,
		type InstructorPromoMembership,
		type PromoCampaign,
		type PromoProposal
	} from '$lib/api/promos';
	import { loadMyCourses } from '$lib/stores/instructor-courses.svelte';
	import type { BackendCourse } from '$lib/api/courses';
	import { toast } from '$lib/stores/toast.svelte';

	/**
	 * Promo instruktur: semua kampanye aktif (bisa diajukan),
	 * kursusku yang sudah masuk promo (termasuk yang ditambah langsung
	 * admin), dan riwayat pengajuanku.
	 */

	let memberships = $state<InstructorPromoMembership[]>([]);
	let proposals = $state<PromoProposal[]>([]);
	let campaigns = $state<PromoCampaign[]>([]);
	let myCourses = $state<BackendCourse[]>([]);
	let loading = $state(true);
	let loadError = $state('');
	let started = $state(false);

	let modalOpen = $state(false);
	let modalCourse = $state<{ id: number; title: string } | null>(null);
	let modalSlug = $state<string | null>(null);
	let proposeCourseId = $state<Record<string, string>>({});

	async function load(): Promise<void> {
		loading = true;
		loadError = '';
		try {
			const [m, p, c, mine] = await Promise.all([
				fetchInstructorPromoMemberships(),
				fetchMyPromoProposals(),
				fetchPromos(),
				loadMyCourses()
			]);
			memberships = m;
			proposals = p;
			campaigns = c;
			myCourses = mine;
			// Keputusan yang belum dibaca: beri tahu sekali, lalu tandai dibaca.
			const fresh = p.filter((x) => x.status !== 'pending' && !x.seenAt);
			if (fresh.length > 0) {
				const approved = fresh.filter((x) => x.status === 'approved').length;
				const rejected = fresh.length - approved;
				const parts: string[] = [];
				if (approved > 0) parts.push(`${approved} disetujui`);
				if (rejected > 0) parts.push(`${rejected} ditolak`);
				toast.info(`Keputusan admin atas pengajuanmu: ${parts.join(', ')}.`, {
					title: 'Pengajuan promo'
				});
				try {
					await markPromoProposalsSeen();
					const now = new Date().toISOString();
					proposals = proposals.map((x) =>
						x.status !== 'pending' && !x.seenAt ? { ...x, seenAt: now } : x
					);
				} catch {
					// Abaikan: badge tetap tampil, dibaca ulang saat kunjungan berikut.
				}
			}
		} catch (e) {
			loadError = e instanceof Error ? e.message : 'Gagal memuat data promo.';
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		if (!browser || started) return;
		started = true;
		void load();
	});

	const memberCourseIdsBySlug = $derived.by(() => {
		const ids: Record<string, number[]> = {};
		for (const m of memberships) {
			(ids[m.slug] ??= []).push(m.courseId);
		}
		return ids;
	});

	const pendingBySlug = $derived.by(() => {
		const map: Record<string, PromoProposal[]> = {};
		for (const p of proposals) {
			if (p.status !== 'pending') continue;
			(map[p.campaignSlug] ??= []).push(p);
		}
		return map;
	});

	function proposableCourses(slug: string): BackendCourse[] {
		const member = new Set(memberCourseIdsBySlug[slug] ?? []);
		const pendingIds = new Set((pendingBySlug[slug] ?? []).map((p) => p.courseId));
		return myCourses.filter((c) => !member.has(c.id) && !pendingIds.has(c.id));
	}

	function openPropose(slug: string): void {
		const id = Number(proposeCourseId[slug] ?? '');
		const found = myCourses.find((c) => c.id === id);
		if (!found) return;
		modalCourse = { id: found.id, title: found.title };
		modalSlug = slug;
		modalOpen = true;
	}

	function statusChip(status: PromoProposal['status']): string {
		if (status === 'approved') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
		if (status === 'rejected') return 'bg-red-50 text-red-700 border-red-200';
		return 'bg-amber-50 text-amber-800 border-amber-200';
	}

	function statusLabel(status: PromoProposal['status']): string {
		if (status === 'approved') return 'Disetujui';
		if (status === 'rejected') return 'Ditolak';
		return 'Menunggu';
	}

	function typeLabel(type: PromoCampaign['type']): string {
		if (type === 'diskon') return 'Diskon';
		if (type === 'patungan') return 'Patungan';
		return 'Kurasi';
	}

	function formatTanggal(value: string | null): string {
		if (!value) return '—';
		const d = new Date(value);
		return Number.isNaN(d.getTime())
			? value
			: d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
	}
</script>

<svelte:head>
	<title>Promo — Instruktur Aristoteles</title>
	<meta
		name="description"
		content="Kampanye promo aktif, kursus milik instruktur yang masuk promo, dan pengajuan promo."
	/>
</svelte:head>

<div class="page-wrap page-stack">
	<PageHeader
		eyebrow="Menu Utama · Promo"
		title="Promo"
		description="Semua kampanye aktif yang bisa diajukan, kursusmu yang sudah masuk promo, dan riwayat pengajuanmu."
	/>

	{#if loading}
		<div
			class="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm font-semibold text-slate-500"
			role="status"
			aria-label="Memuat promo"
		>
			<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i> Memuat data promo…
		</div>
	{:else if loadError}
		<div role="alert" class="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
			<p class="text-sm font-bold text-red-700">Data promo belum dapat dimuat</p>
			<p class="mx-auto mt-1 max-w-md text-xs text-red-600">{loadError}</p>
			<button
				type="button"
				onclick={() => void load()}
				class="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-red-600"
			>
				<i class="fa-solid fa-rotate-right" aria-hidden="true"></i> Coba lagi
			</button>
		</div>
	{:else}
		<!-- Kursusku yang sudah masuk promo (termasuk tambahan langsung admin) -->
		<section aria-labelledby="my-promos-heading">
			<h2 id="my-promos-heading" class="text-sm font-extrabold text-slate-900">
				Kursusku yang masuk promo ({memberships.length})
			</h2>
			{#if memberships.length === 0}
				<p
					class="mt-3 rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-xs text-slate-500"
				>
					Belum ada kursusmu yang masuk promo. Ajukan dari daftar kampanye di bawah atau dari
					halaman Kursusku.
				</p>
			{:else}
				<ul class="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
					{#each memberships as m (m.slug + ':' + m.courseId)}
						<li
							class="flex items-center justify-between gap-3 rounded-2xl border border-slate-200/70 bg-white px-4 py-3"
						>
							<div class="min-w-0">
								<p class="truncate text-sm font-bold text-slate-900">{m.courseTitle}</p>
								<p class="mt-0.5 truncate text-xs text-slate-500">
									<span
										class="mr-1.5 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-slate-600 uppercase"
										>{typeLabel(m.type)}</span
									>
									{m.title}
									{#if m.discountPercent !== null} · −{m.discountPercent}%{/if}
								</p>
							</div>
							<a
								href={resolve(`/promo/${m.slug}`)}
								class="inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 px-3.5 text-xs font-bold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600"
								aria-label={`Lihat halaman promo ${m.title}`}
							>
								Lihat <i class="fa-solid fa-arrow-right text-[10px]" aria-hidden="true"></i>
							</a>
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		<!-- Semua kampanye aktif + ajukan -->
		<section aria-labelledby="all-promos-heading" class="mt-8">
			<h2 id="all-promos-heading" class="text-sm font-extrabold text-slate-900">
				Semua kampanye ({campaigns.length})
			</h2>
			{#if campaigns.length === 0}
				<p
					class="mt-3 rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-xs text-slate-500"
				>
					Belum ada kampanye promo.
				</p>
			{:else}
				<div class="mt-3 space-y-3">
					{#each campaigns as camp (camp.slug)}
						{@const mine = memberships.filter((m) => m.slug === camp.slug)}
						{@const pendings = pendingBySlug[camp.slug] ?? []}
						{@const options = proposableCourses(camp.slug)}
						<article class="rounded-2xl border border-slate-200/70 bg-white p-4 sm:p-5">
							<div class="flex flex-wrap items-center justify-between gap-3">
								<div class="min-w-0">
									<p class="flex flex-wrap items-center gap-2 text-[11px] font-bold tracking-wide uppercase">
										<span class="rounded-md bg-slate-900 px-2 py-0.5 text-white">{typeLabel(camp.type)}</span>
										{#if camp.discountPercent !== null}
											<span class="rounded-md bg-red-600 px-2 py-0.5 text-white">−{camp.discountPercent}%</span>
										{/if}
										{#if camp.endsAt}
											<span class="font-semibold text-slate-500 normal-case">s.d. {formatTanggal(camp.endsAt)}</span>
										{/if}
									</p>
									<h3 class="mt-1.5 truncate text-base font-extrabold text-slate-900">{camp.title}</h3>
									<p class="mt-0.5 text-xs text-slate-500">
										{camp.courses.length} pelatihan di promo · {mine.length} kursusmu masuk
										{#if pendings.length > 0} · {pendings.length} pengajuan menunggu{/if}
									</p>
								</div>
								<a
									href={resolve(`/promo/${camp.slug}`)}
									class="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-slate-200 px-3.5 text-xs font-bold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600"
								>
									Halaman promo <i class="fa-solid fa-arrow-right text-[10px]" aria-hidden="true"></i>
								</a>
							</div>
							{#if options.length > 0}
								<div class="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3 sm:flex-row sm:items-center">
									<label for="propose-{camp.slug}" class="sr-only">Pilih kursus untuk diajukan ke {camp.title}</label>
									<select
										id="propose-{camp.slug}"
										bind:value={proposeCourseId[camp.slug]}
										class="w-full flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none sm:w-auto"
									>
										<option value="">— Pilih kursusku —</option>
										{#each options as c (c.id)}
											<option value={String(c.id)}>{c.title}</option>
										{/each}
									</select>
									<button
										type="button"
										onclick={() => openPropose(camp.slug)}
										disabled={!proposeCourseId[camp.slug]}
										class="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-xs font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-blue-600"
									>
										<i class="fa-solid fa-tags" aria-hidden="true"></i> Ajukan ke promo ini
									</button>
								</div>
							{/if}
						</article>
					{/each}
				</div>
			{/if}
		</section>

		<!-- Riwayat pengajuanku -->
		<section aria-labelledby="my-proposals-heading" class="mt-8">
			<h2 id="my-proposals-heading" class="text-sm font-extrabold text-slate-900">
				Pengajuanku ({proposals.length})
			</h2>
			{#if proposals.length === 0}
				<p
					class="mt-3 rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-xs text-slate-500"
				>
					Belum ada pengajuan.
				</p>
			{:else}
				<ul class="mt-3 space-y-2">
					{#each proposals as p (p.id)}
						<li
							class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/70 bg-white px-4 py-3"
						>
							<div class="min-w-0">
								<p class="truncate text-sm font-bold text-slate-900">{p.courseTitle}</p>
								<p class="mt-0.5 truncate text-xs text-slate-500">
									→ {p.campaignTitle}
									{#if p.customBadge} · “{p.customBadge}”{/if}
								</p>
								{#if p.status === 'rejected' && p.decidedNote}
									<p class="mt-1 text-xs text-red-600">Catatan admin: {p.decidedNote}</p>
								{/if}
							</div>
							<span
								class={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold ${statusChip(p.status)}`}
							>
								{statusLabel(p.status)}
							</span>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	{/if}
</div>

<PromoProposeModal
	open={modalOpen}
	course={modalCourse}
	preselectedSlug={modalSlug}
	onclose={() => {
		modalOpen = false;
		modalCourse = null;
		modalSlug = null;
	}}
	onsuccess={(title) => {
		toast.success(`“${title}” diajukan ke promo, menunggu persetujuan admin.`);
		void load();
	}}
/>
