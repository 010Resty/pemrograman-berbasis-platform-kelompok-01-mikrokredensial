<script lang="ts">
	import type { MaterialType } from '$lib/data/courses';

	let {
		type,
		withLabel = false
	}: {
		type: MaterialType | string;
		withLabel?: boolean;
	} = $props();

	const iconClass = $derived(
		type === 'video'
			? 'fa-circle-play text-blue-600'
			: type === 'audio'
				? 'fa-headphones text-cyan-600'
				: type === 'foto'
					? 'fa-image text-slate-500'
					: type === 'kuis'
						? 'fa-circle-question text-amber-600'
						: type === 'tugas'
							? 'fa-pen-to-square text-violet-600'
							: 'fa-book-open text-emerald-600'
	);

	const label = $derived(
		type === 'video'
			? 'Video'
			: type === 'audio'
				? 'Audio'
				: type === 'foto'
					? 'Foto'
					: type === 'kuis'
						? 'Kuis'
						: type === 'tugas'
							? 'Tugas'
							: 'Bacaan'
	);
</script>

<span class="inline-flex items-center gap-1.5" aria-label={`Tipe materi: ${label}`}>
	<i class={`fa-solid ${iconClass} text-xs`} aria-hidden="true"></i>
	{#if withLabel}
		<span class="text-[11px] font-semibold text-slate-500">{label}</span>
	{/if}
</span>
