<!-- PageHeader — kepala halaman konsisten di semua portal.
	Hierarki: eyebrow (opsional) + h1 + deskripsi + slot aksi.
	Judul selalu h1 (satu per halaman); breadcrumb opsional via slot. -->
<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		title,
		description = undefined,
		eyebrow = undefined,
		actions = undefined,
		meta = undefined
	}: {
		title: string;
		description?: string;
		eyebrow?: string;
		actions?: Snippet;
		meta?: Snippet;
	} = $props();
</script>

<div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
	<div class="min-w-0">
		{#if eyebrow}
			<p class="mb-1 text-[11px] font-bold tracking-[0.14em] text-blue-700 uppercase">
				{eyebrow}
			</p>
		{/if}
		<h1 class="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{title}</h1>
		{#if description}
			<p class="mt-1 max-w-2xl text-sm leading-relaxed text-slate-500">{description}</p>
		{/if}
		{#if meta}
			<div class="mt-2">{@render meta()}</div>
		{/if}
	</div>
	{#if actions}
		<div class="flex shrink-0 flex-wrap items-center gap-2">{@render actions()}</div>
	{/if}
</div>
