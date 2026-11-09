<script lang="ts">
	import type { SubModule } from '$lib/data/courses';
	import SubModuleHeader from '../molecules/SubModuleHeader.svelte';
	import MaterialItem from '../molecules/MaterialItem.svelte';

	let {
		sub,
		moduleNumber,
		subNumber,
		open,
		ontoggle,
		previewMaterialId = null
	}: {
		sub: SubModule;
		moduleNumber: number;
		subNumber: number;
		open: boolean;
		ontoggle: () => void;
		previewMaterialId?: string | null;
	} = $props();

	const panelId = $derived(`sub-panel-${sub.id}`);
</script>

<div class="overflow-hidden rounded-xl border border-violet-100 bg-white">
	<SubModuleHeader
		{sub}
		subNumber={subNumber}
		materialCount={sub.materials.length}
		{open}
		controlsId={panelId}
		ontoggle={ontoggle}
	/>
	<div
		id={panelId}
		class={`grid transition-[grid-template-rows,visibility] duration-300 ease-smooth ${open ? 'grid-rows-[1fr] visible' : 'grid-rows-[0fr] invisible'}`}
	>
		<div class="overflow-hidden" inert={!open}>
			<div class="border-t border-violet-100/70 bg-white">
				<p class="px-4 pt-2 text-[11px] text-slate-400" aria-hidden="true">
					Modul {moduleNumber} · Sub-modul {subNumber}
				</p>
				<ol class="divide-y divide-slate-100">
					{#each sub.materials as mat (mat.id)}
						<li class="flex items-center gap-3 px-4 py-2.5">
							<MaterialItem material={mat} isPreview={previewMaterialId === mat.id} />
						</li>
					{/each}
				</ol>
			</div>
		</div>
	</div>
</div>
