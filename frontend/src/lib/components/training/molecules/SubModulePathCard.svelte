<script lang="ts">
	import type { SubModule } from '$lib/data/courses';
	import LearningPathDot from '../atoms/LearningPathDot.svelte';
	import MaterialTypeIcon from '../atoms/MaterialTypeIcon.svelte';

	let {
		sub,
		href = null,
		moduleNumber,
		subNumber,
		isFirst = false
	}: {
		sub: SubModule;
		/** Jika null, kartu tampil terkunci (teaser publik — tanpa akses materi). */
		href?: string | null;
		moduleNumber: number;
		subNumber: number;
		isFirst?: boolean;
	} = $props();

	const typeBreakdown = $derived(
		Object.entries(
			sub.materials.reduce<Record<string, number>>((acc, m) => {
				acc[m.type] = (acc[m.type] ?? 0) + 1;
				return acc;
			}, {})
		)
	);
</script>

{#if href}
	<a
		{href}
		aria-label={`Buka sub-modul ${subNumber}: ${sub.title}, ${sub.materials.length} materi`}
		class="group flex min-h-[44px] w-full items-center gap-3 rounded-2xl border border-violet-100 bg-white p-3 text-left shadow-sm transition-all duration-300 ease-smooth hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-lg hover:shadow-violet-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 sm:gap-4 sm:p-4"
	>
		<LearningPathDot number={subNumber} tone="violet" />
		<span class="min-w-0 flex-1">
			<span class="flex flex-wrap items-center gap-2">
				<span class="truncate text-sm font-bold text-slate-900 group-hover:text-violet-700 sm:text-[15px]">
					{sub.title}
				</span>
				{#if isFirst}
					<span class="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 uppercase">
						Mulai di sini
					</span>
				{/if}
			</span>
			{#if sub.description}
				<span class="mt-0.5 block truncate text-xs text-slate-500">{sub.description}</span>
			{/if}
			<span class="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold text-slate-500">
				<span class="inline-flex items-center gap-1 text-violet-700">
					<i class="fa-solid fa-layer-group text-[10px]" aria-hidden="true"></i>
					{sub.materials.length} materi
				</span>
				{#each typeBreakdown as [type] (type)}
					<MaterialTypeIcon {type} withLabel />
				{/each}
			</span>
			<span class="mt-0.5 block text-[11px] text-slate-400">
				Modul {moduleNumber} · Sub-modul {subNumber}
			</span>
		</span>
		<span
			aria-hidden="true"
			class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-600 text-white transition-transform duration-300 ease-smooth group-hover:translate-x-1"
		>
			<i class="fa-solid fa-arrow-right text-xs"></i>
		</span>
	</a>
{:else}
	<div
		role="group"
		aria-label={`Sub-modul ${subNumber}: ${sub.title} (terkunci — masuk untuk membuka materi)`}
		class="flex min-h-[44px] w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm sm:gap-4 sm:p-4"
	>
		<LearningPathDot number={subNumber} tone="violet" />
		<span class="min-w-0 flex-1">
			<span class="flex flex-wrap items-center gap-2">
				<span class="truncate text-sm font-bold text-slate-900 sm:text-[15px]">
					{sub.title}
				</span>
				<span class="inline-flex shrink-0 items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500 uppercase">
					<i class="fa-solid fa-lock text-[9px]" aria-hidden="true"></i>
					Terkunci
				</span>
			</span>
			{#if sub.description}
				<span class="mt-0.5 block truncate text-xs text-slate-500">{sub.description}</span>
			{/if}
			<span class="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold text-slate-500">
				<span class="inline-flex items-center gap-1">
					<i class="fa-solid fa-layer-group text-[10px]" aria-hidden="true"></i>
					{sub.materials.length} materi
				</span>
				<span class="inline-flex items-center gap-1 text-slate-400">
					<i class="fa-solid fa-lock text-[10px]" aria-hidden="true"></i>
					Masuk untuk membuka
				</span>
			</span>
			<span class="mt-0.5 block text-[11px] text-slate-400">
				Modul {moduleNumber} · Sub-modul {subNumber}
			</span>
		</span>
		<span
			aria-hidden="true"
			class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400"
		>
			<i class="fa-solid fa-lock text-xs"></i>
		</span>
	</div>
{/if}
