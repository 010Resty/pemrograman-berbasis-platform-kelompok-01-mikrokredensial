<!-- EmptyState — keadaan kosong yang mengarahkan, bukan layar mati.
	Selalu: ikon + judul + penjelasan + (opsional) aksi. -->
<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		icon = 'fa-inbox',
		title,
		description = undefined,
		actions = undefined
	}: {
		icon?: string;
		title: string;
		description?: string;
		actions?: Snippet;
	} = $props();
</script>

<div class="flex flex-col items-center px-6 py-12 text-center" role="status" aria-label={title}>
	<span
		class="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600"
		aria-hidden="true"
	>
		<i class={`fa-solid ${icon} text-xl`}></i>
	</span>
	<p class="text-sm font-bold text-slate-800">{title}</p>
	{#if description}
		<p class="mt-1 max-w-sm text-sm leading-relaxed text-slate-500">{description}</p>
	{/if}
	{#if actions}
		<div class="mt-4 flex flex-wrap items-center justify-center gap-2">{@render actions()}</div>
	{/if}
</div>
