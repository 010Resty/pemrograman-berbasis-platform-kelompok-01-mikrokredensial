<script lang="ts">
	import type { CourseModule } from '$lib/data/courses';
	import ModuleAccordion from './ModuleAccordion.svelte';

	let {
		modules,
		openModules,
		openSubs,
		ontogglemodule,
		ontogglesub,
		previewMaterialId = null
	}: {
		modules: CourseModule[];
		openModules: Set<string>;
		openSubs: Set<string>;
		ontogglemodule: (id: string) => void;
		ontogglesub: (id: string) => void;
		previewMaterialId?: string | null;
	} = $props();

	let query = $state('');

	const visible = $derived(
		!query.trim()
			? modules
			: modules.filter((m) => {
					const q = query.trim().toLowerCase();
					if (m.title.toLowerCase().includes(q)) return true;
					return (m.subModules ?? []).some(
						(s) =>
							s.title.toLowerCase().includes(q) ||
							s.materials.some((mat) => mat.title.toLowerCase().includes(q))
					);
				})
	);
</script>

<div class="overflow-hidden rounded-2xl border border-slate-200/70 bg-white">
	<div class="border-b border-slate-100 p-5 pb-4 sm:px-6">
		<div class="flex flex-wrap items-end justify-between gap-3">
			<div>
				<h2 id="kurikulum-heading" class="text-lg font-bold text-slate-900">Kurikulum</h2>
				<p class="mt-0.5 text-xs text-slate-500">
					Pelatihan → {modules.length} modul → sub-modul → materi (video, bacaan, audio, foto, kuis, penugasan)
				</p>
			</div>
			<div class="relative w-full max-w-xs">
				<label for="kurikulum-search" class="sr-only">Cari modul, sub-modul, atau materi</label>
				<input
					id="kurikulum-search"
					type="search"
					bind:value={query}
					placeholder="Cari sub-modul / materi..."
					class="w-full rounded-xl border border-slate-200 py-2 pr-3 pl-9 text-xs focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
				/>
				<i class="fa-solid fa-magnifying-glass absolute top-1/2 left-3 -translate-y-1/2 text-xs text-slate-400" aria-hidden="true"></i>
			</div>
		</div>
	</div>

	<div class="space-y-3 p-5 pt-4 sm:px-6 sm:pb-6" role="list" aria-labelledby="kurikulum-heading">
		{#if visible.length === 0}
			<div class="rounded-xl border border-dashed border-slate-300 p-8 text-center">
				<p class="text-sm font-semibold text-slate-700">Tidak ada hasil untuk “{query}”.</p>
				<p class="mt-1 text-xs text-slate-500">Coba kata kunci modul, sub-modul, atau materi lain.</p>
			</div>
		{:else}
			{#each visible as mod, i (mod.id)}
				<div role="listitem">
					<ModuleAccordion
						module={mod}
						moduleNumber={modules.indexOf(mod) + 1}
						open={openModules.has(mod.id)}
						ontoggle={() => ontogglemodule(mod.id)}
						{openSubs}
						{ontogglesub}
						{previewMaterialId}
					/>
				</div>
			{/each}
		{/if}
	</div>
</div>
