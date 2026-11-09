<script lang="ts">
	import type { CourseModule } from '$lib/data/courses';

	let {
		module,
		moduleNumber,
		subCount,
		materialCount,
		open,
		complete = false,
		controlsId,
		ontoggle
	}: {
		module: CourseModule;
		moduleNumber: number;
		subCount: number;
		materialCount: number;
		open: boolean;
		complete?: boolean;
		controlsId: string;
		ontoggle: () => void;
	} = $props();
</script>

<button
	type="button"
	onclick={ontoggle}
	aria-expanded={open}
	aria-controls={controlsId}
	class="flex w-full items-center gap-3 bg-slate-50 p-4 text-left transition-colors duration-200 ease-smooth hover:bg-slate-100 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-600 sm:px-5"
>
	<span
		class={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-extrabold ${complete ? 'bg-emerald-600 text-white' : 'bg-blue-600 text-white'}`}
		aria-hidden="true"
	>
		{#if complete}
			<i class="fa-solid fa-check"></i>
		{:else}
			{moduleNumber}
		{/if}
	</span>
	<span class="min-w-0 flex-1">
		<span class="block truncate text-sm font-bold text-slate-900 sm:text-[15px]">
			Modul {moduleNumber}: {module.title}
		</span>
		<span class="block truncate text-xs text-slate-500">{module.description}</span>
		<span class={`mt-1 block text-[11px] font-semibold ${complete ? 'text-emerald-600' : 'text-slate-500'}`}>
			{subCount} sub-modul · {materialCount} materi
		</span>
	</span>
	<i class={`fa-solid fa-chevron-down text-xs text-slate-400 transition-transform duration-300 ease-smooth ${open ? 'rotate-180' : ''}`} aria-hidden="true"></i>
</button>
