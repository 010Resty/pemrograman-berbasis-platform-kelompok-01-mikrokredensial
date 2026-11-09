<script lang="ts">
	import type { Material } from '$lib/data/courses';
	import MaterialTypeIcon from '../atoms/MaterialTypeIcon.svelte';

	let {
		material,
		isPreview = false,
		href = null
	}: {
		material: Material;
		isPreview?: boolean;
		href?: string | null;
	} = $props();
</script>

{#if href}
	<a
		{href}
		class="group flex min-w-0 flex-1 items-center gap-3 rounded-lg py-1 focus-visible:outline-2 focus-visible:outline-blue-600"
		aria-label={`Buka materi ${material.title}`}
	>
		<span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100">
			<MaterialTypeIcon type={material.type} />
		</span>
		<span class="min-w-0 flex-1">
			<span class="block truncate text-sm font-semibold text-slate-800 group-hover:text-blue-700 group-hover:underline">
				{material.title}
			</span>
			<span class="mt-0.5 block text-[11px] text-slate-500">
				{material.type} · {material.duration}
			</span>
		</span>
		{#if isPreview}
			<span class="shrink-0 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700">
				Pratinjau
			</span>
		{/if}
		<i class="fa-solid fa-chevron-right text-[10px] text-slate-300 transition-transform duration-200 ease-smooth group-hover:translate-x-0.5" aria-hidden="true"></i>
	</a>
{:else}
	<div class="flex min-w-0 flex-1 items-center gap-3 py-1">
		<span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100">
			<MaterialTypeIcon type={material.type} />
		</span>
		<span class="min-w-0 flex-1">
			<span class="block truncate text-[13px] font-semibold text-slate-800">{material.title}</span>
			<span class="block text-[11px] text-slate-500">{material.type} · {material.duration}</span>
		</span>
		{#if isPreview}
			<span class="shrink-0 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700">
				Pratinjau
			</span>
		{/if}
	</div>
{/if}
