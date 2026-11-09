<script lang="ts">
	let {
		percent,
		label,
		tone = 'blue'
	}: {
		percent: number;
		label: string;
		tone?: 'blue' | 'emerald';
	} = $props();

	const barClass = $derived(tone === 'emerald' ? 'bg-emerald-600' : 'bg-blue-600');
</script>

<div>
	<div class="mb-1.5 flex justify-between text-xs">
		<span class="font-medium text-slate-500">{label}</span>
		<span class="font-bold text-slate-800">{percent}%</span>
	</div>
	<div
		class="h-2.5 overflow-hidden rounded-full bg-slate-100"
		role="progressbar"
		aria-valuenow={percent}
		aria-valuemin={0}
		aria-valuemax={100}
		aria-label={label}
	>
		<div class={`h-full rounded-full transition-all duration-500 ease-smooth ${barClass}`} style="width: {percent}%"></div>
	</div>
</div>
