<script lang="ts">
	import { materialTypeIcon, materialTypeLabel } from '$lib/data/courses';

	let {
		type,
		withLabel = false
	}: {
		type: string;
		withLabel?: boolean;
	} = $props();

	const iconClass = $derived(materialTypeIcon(type));

	const label = $derived(materialTypeLabel(type));
</script>

<span class="inline-flex items-center gap-1.5" aria-label={`Tipe materi: ${label}`}>
	<i class={`fa-solid ${iconClass} text-xs`} aria-hidden="true"></i>
	{#if withLabel}
		<span class="text-[11px] font-semibold text-slate-500">{label}</span>
	{/if}
</span>
