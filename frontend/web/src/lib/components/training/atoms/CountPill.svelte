<script lang="ts">
	let {
		icon,
		text,
		tone = 'slate'
	}: {
		icon: string;
		text: string;
		tone?: 'slate' | 'blue' | 'emerald' | 'amber' | 'violet';
	} = $props();

	const toneClass = $derived(
		tone === 'blue'
			? 'bg-blue-50 text-blue-700 border-blue-100'
			: tone === 'emerald'
				? 'bg-emerald-50 text-emerald-700 border-emerald-100'
				: tone === 'amber'
					? 'bg-amber-50 text-amber-700 border-amber-100'
					: tone === 'violet'
						? 'bg-violet-50 text-violet-700 border-violet-100'
						: 'bg-slate-100 text-slate-600 border-slate-200/60'
	);
</script>

<span
	class={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${toneClass}`}
>
	<i class={`fa-solid ${icon} text-[10px]`} aria-hidden="true"></i>
	{text}
</span>
