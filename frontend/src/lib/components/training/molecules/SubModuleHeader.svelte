<script lang="ts">
	import type { SubModule } from '$lib/data/courses';

	let {
		sub,
		subNumber,
		materialCount,
		open,
		accent = 'violet',
		controlsId,
		ontoggle
	}: {
		sub: SubModule;
		subNumber: number;
		materialCount: number;
		open: boolean;
		accent?: 'violet' | 'emerald' | 'blue';
		controlsId: string;
		ontoggle: () => void;
	} = $props();

	const badgeClass = $derived(
		accent === 'emerald' ? 'bg-emerald-100 text-emerald-700' : accent === 'blue' ? 'bg-blue-100 text-blue-700' : 'bg-violet-100 text-violet-700'
	);
</script>

<button
	type="button"
	onclick={ontoggle}
	aria-expanded={open}
	aria-controls={controlsId}
	class="flex w-full items-center gap-3 rounded-xl border border-violet-100 bg-violet-50/50 p-3 text-left transition-colors duration-200 ease-smooth hover:bg-violet-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-violet-600 sm:px-4"
>
	<span class={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-extrabold ${badgeClass}`} aria-hidden="true">
		{subNumber}
	</span>
	<span class="min-w-0 flex-1">
		<span class="block truncate text-[13px] font-bold text-slate-900">
			Sub-modul {subNumber}: {sub.title}
		</span>
		<span class="block truncate text-[11px] text-slate-500">
			{sub.description || `${materialCount} materi`}
		</span>
		<span class="mt-1 block text-[11px] font-semibold text-violet-600">
			{materialCount} materi
		</span>
	</span>
	<i class={`fa-solid fa-chevron-down text-xs text-violet-400 transition-transform duration-300 ease-smooth ${open ? 'rotate-180' : ''}`} aria-hidden="true"></i>
</button>
