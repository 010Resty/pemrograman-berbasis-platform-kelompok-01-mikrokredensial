<script lang="ts">
	let {
		number,
		tone = 'blue',
		completed = false
	}: {
		number: number;
		tone?: 'blue' | 'violet' | 'emerald';
		completed?: boolean;
	} = $props();

	const toneClass = $derived(
		completed
			? 'bg-emerald-600 text-white ring-emerald-200'
			: tone === 'violet'
				? 'bg-violet-600 text-white ring-violet-200'
				: tone === 'emerald'
					? 'bg-emerald-600 text-white ring-emerald-200'
					: 'bg-blue-600 text-white ring-blue-200'
	);
</script>

<span
	aria-hidden="true"
	class={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-extrabold ring-4 ${toneClass}`}
>
	{#if completed}
		<i class="fa-solid fa-check"></i>
	{:else}
		{number}
	{/if}
</span>
