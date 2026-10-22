<script lang="ts">
	/**
	 * Atom node roadmap ala roadmap.sh — hanya berisi NAMA topik.
	 * Tanpa deskripsi, ikon, badge, progress, atau info tambahan apa pun.
	 */
	let {
		label,
		href = null,
		tone = 'default',
		center = false
	}: {
		label: string;
		href?: string | null;
		tone?: 'default' | 'dark' | 'primary';
		center?: boolean;
	} = $props();

	const toneClass = $derived(
		tone === 'dark'
			? 'border-transparent bg-slate-900 font-bold text-white'
			: tone === 'primary'
				? 'border-transparent bg-blue-600 font-bold text-white'
				: 'border-slate-200 bg-white font-semibold text-slate-800'
	);
	const alignClass = $derived(center ? 'text-center' : 'text-left');
	const interactiveClass = $derived(
		href
			? 'cursor-pointer transition-all duration-300 ease-smooth hover:-translate-y-0.5 hover:border-blue-400 hover:shadow-md active:translate-y-0 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600'
			: ''
	);
	const cls = $derived(
		`block w-full rounded-xl border px-4 py-3 text-sm break-words ${toneClass} ${alignClass} ${interactiveClass}`
	);
</script>

{#if href}
	<a {href} class={cls}>{label}</a>
{:else}
	<div class={cls}>{label}</div>
{/if}
