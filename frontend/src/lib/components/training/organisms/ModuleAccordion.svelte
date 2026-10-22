<script lang="ts">
	import type { CourseModule } from '$lib/data/courses';
	import { resolveSubModules } from '$lib/data/training';
	import ModuleHeader from '../molecules/ModuleHeader.svelte';
	import SubModuleAccordion from './SubModuleAccordion.svelte';

	let {
		module,
		moduleNumber,
		open,
		ontoggle,
		openSubs,
		ontogglesub,
		previewMaterialId = null
	}: {
		module: CourseModule;
		moduleNumber: number;
		open: boolean;
		ontoggle: () => void;
		openSubs: Set<string>;
		ontogglesub: (id: string) => void;
		previewMaterialId?: string | null;
	} = $props();

	const subs = $derived(resolveSubModules(module));
	const materialCount = $derived(subs.reduce((n, s) => n + s.materials.length, 0));
	const panelId = $derived(`mod-panel-${module.id}`);
</script>

<div class={`overflow-hidden rounded-xl border bg-white transition-all duration-300 ease-smooth ${open ? 'border-blue-200 shadow-lg' : 'border-slate-200'}`}>
	<ModuleHeader
		{module}
		{moduleNumber}
		subCount={subs.length}
		{materialCount}
		{open}
		controlsId={panelId}
		ontoggle={ontoggle}
	/>
	<div
		id={panelId}
		class={`grid transition-[grid-template-rows,visibility] duration-300 ease-smooth ${open ? 'grid-rows-[1fr] visible' : 'grid-rows-[0fr] invisible'}`}
	>
		<div class="overflow-hidden" inert={!open}>
			<div class="space-y-2.5 border-t border-slate-100 bg-slate-50/50 p-3 sm:p-4">
				{#each subs as sub, si (sub.id)}
					<SubModuleAccordion
						{sub}
						moduleNumber={moduleNumber}
						subNumber={si + 1}
						open={openSubs.has(sub.id)}
						ontoggle={() => ontogglesub(sub.id)}
						{previewMaterialId}
					/>
				{/each}
			</div>
		</div>
	</div>
</div>
