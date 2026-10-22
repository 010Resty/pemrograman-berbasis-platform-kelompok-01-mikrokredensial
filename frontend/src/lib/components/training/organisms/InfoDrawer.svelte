<script lang="ts">
	import type { Snippet } from 'svelte';
	import { resolveSubModules, type RoadmapSelection } from '$lib/data/training';
	import CountPill from '../atoms/CountPill.svelte';

	/**
	 * Drawer info modul / sub-modul: meluncur dari kanan.
	 * Berisi pengertian singkat (deskripsi), konteks hierarki,
	 * hitungan, dan slot `actions` opsional — tanpa daftar judul materi.
	 */
	let {
		selection,
		onclose,
		actions
	}: {
		selection: RoadmapSelection | null;
		onclose: () => void;
		actions?: Snippet<[RoadmapSelection]>;
	} = $props();

	const open = $derived(selection !== null);

	let closeBtn: HTMLButtonElement | undefined = $state();

	$effect(() => {
		if (selection) {
			closeBtn?.focus();
			document.body.style.overflow = 'hidden';
		} else {
			document.body.style.overflow = '';
		}
	});

	function onWindowKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && selection) onclose();
	}

	const description = $derived.by(() => {
		if (!selection) return '';
		const raw =
			selection.kind === 'module' ? selection.module.description : selection.sub.description;
		return raw?.trim() ?? '';
	});

	/** Sub-modul di dalam modul terpilih (untuk daftar "yang akan dipelajari"). */
	const childSubs = $derived(
		selection?.kind === 'module' ? resolveSubModules(selection.module) : []
	);
</script>

<svelte:window onkeydown={onWindowKeydown} />

<div class={`fixed inset-0 z-[60] ${open ? 'visible' : 'invisible'}`}>
	<button
		type="button"
		tabindex={open ? 0 : -1}
		aria-label="Tutup panel informasi"
		onclick={onclose}
		class={`absolute inset-0 bg-slate-900/40 transition-opacity duration-300 ease-smooth ${open ? 'opacity-100' : 'opacity-0'}`}
	></button>
	<div
		role="dialog"
		aria-modal="true"
		aria-labelledby="info-drawer-title"
		inert={!open}
		class={`absolute inset-y-0 right-0 flex w-full flex-col overflow-hidden bg-white shadow-2xl transition-[transform,visibility] duration-300 ease-smooth sm:rounded-l-3xl md:w-1/2 ${open ? 'translate-x-0 visible' : 'translate-x-full invisible'}`}
	>
		{#if selection}
			<!-- Header navy akademik -->
			<div class="relative overflow-hidden bg-navy p-5 sm:px-6">
				<div
					class="pointer-events-none absolute -top-12 -right-8 h-36 w-36 rounded-full bg-white/10 blur-2xl"
					aria-hidden="true"
				></div>
				<div
					class="pointer-events-none absolute inset-x-0 bottom-0 h-1 bg-accent"
					aria-hidden="true"
				></div>
				<div class="relative flex items-start justify-between gap-3">
					<div class="min-w-0">
						<p
							class="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-extrabold tracking-[0.14em] text-white uppercase backdrop-blur"
						>
							<i
								class={selection.kind === 'module'
									? 'fa-solid fa-layer-group'
									: 'fa-solid fa-puzzle-piece'}
								aria-hidden="true"
							></i>
							{#if selection.kind === 'module'}
								Modul {selection.moduleIndex + 1}
							{:else}
								Modul {selection.moduleIndex + 1} · Sub-modul {selection.subIndex + 1}
							{/if}
						</p>
						<h2 id="info-drawer-title" class="mt-2 text-xl leading-snug font-extrabold text-white">
							{#if selection.kind === 'module'}
								{selection.module.title}
							{:else}
								{selection.sub.title}
							{/if}
						</h2>
					</div>
					<button
						type="button"
						bind:this={closeBtn}
						onclick={onclose}
						aria-label="Tutup panel informasi"
						class="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 p-2 text-white backdrop-blur transition-colors duration-200 ease-smooth hover:bg-white/25 focus-visible:outline-2 focus-visible:outline-white"
					>
						<i class="fa-solid fa-xmark text-lg" aria-hidden="true"></i>
					</button>
				</div>
			</div>

			<div class="min-h-0 flex-1 space-y-5 overflow-y-auto p-5 sm:px-6">
				{#if description}
					<p class="text-sm leading-relaxed text-slate-600">{description}</p>
				{:else}
					<p class="text-sm leading-relaxed text-slate-400 italic">
						Belum ada deskripsi untuk bagian ini. Silakan hubungi pengajar untuk detail kurikulum.
					</p>
				{/if}

				{#if selection.kind === 'module' && childSubs.length > 0}
					<!-- Daftar sub-modul dalam modul ini -->
					<section aria-label="Yang akan dipelajari">
						<h3
							class="mb-2 flex items-center gap-1.5 text-[11px] font-extrabold tracking-[0.12em] text-slate-500 uppercase"
						>
							<i class="fa-solid fa-list-check text-primary" aria-hidden="true"></i>
							Yang akan dipelajari
						</h3>
						<ol class="space-y-2">
							{#each childSubs as sub, si (sub.id)}
								<li
									class="flex items-center gap-3 rounded-xl border border-slate-100 bg-white px-3 py-2.5 shadow-sm"
								>
									<span
										class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-navy text-[11px] font-extrabold text-white"
									>
										{selection.moduleIndex + 1}.{si + 1}
									</span>
									<span class="min-w-0 flex-1">
										<span class="block truncate text-[13px] font-bold text-slate-800"
											>{sub.title}</span
										>
										<span class="block text-[11px] font-medium text-slate-400">
											{sub.materials.length} materi
										</span>
									</span>
									<i class="fa-solid fa-chevron-right text-[10px] text-slate-300" aria-hidden="true"
									></i>
								</li>
							{/each}
						</ol>
					</section>
				{/if}

				<div class="flex flex-wrap gap-2">
					{#if selection.kind === 'module'}
						<CountPill
							icon="fa-layer-group"
							text={`${selection.subCount} sub-modul`}
							tone="violet"
						/>
						<CountPill icon="fa-book-open" text={`${selection.materialCount} materi`} tone="blue" />
					{:else}
						<CountPill
							icon="fa-book-open"
							text={`${selection.sub.materials.length} materi`}
							tone="blue"
						/>
					{/if}
				</div>
				{#if actions}
					{@render actions(selection)}
				{:else}
					<a
						href="/login"
						class="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white shadow-lg shadow-primary/25 transition-all duration-200 ease-smooth hover:bg-primary-hover active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-primary"
					>
						<i class="fa-solid fa-arrow-right-to-bracket" aria-hidden="true"></i>
						{#if selection.kind === 'module'}
							Masuk untuk mulai belajar
						{:else}
							Masuk untuk membuka materi
						{/if}
					</a>
					<p class="text-center text-[11px] text-slate-500">
						Masuk untuk melacak progres dan membuka seluruh materi.
					</p>
				{/if}
			</div>
		{/if}
	</div>
</div>
