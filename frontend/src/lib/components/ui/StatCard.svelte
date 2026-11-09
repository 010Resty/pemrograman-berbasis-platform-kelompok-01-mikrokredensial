<!-- StatCard — kartu angka ringkas dengan satu aksen.
	Varian terbatas (blue/emerald/amber/violet) agar dasbor tidak pelangi.
	Sub-label menjelaskan angka; seluruh kartu bisa menjadi tautan via href. -->
<script lang="ts">
	let {
		label,
		value,
		sub = undefined,
		icon,
		tone = 'blue',
		href = undefined
	}: {
		label: string;
		value: string;
		sub?: string;
		icon: string;
		tone?: 'blue' | 'emerald' | 'amber' | 'violet';
		href?: string;
	} = $props();

	const tones: Record<string, { chip: string; text: string }> = {
		blue: { chip: 'bg-blue-50 text-blue-700', text: 'text-blue-700' },
		emerald: { chip: 'bg-emerald-50 text-emerald-700', text: 'text-emerald-700' },
		amber: { chip: 'bg-amber-50 text-amber-700', text: 'text-amber-700' },
		violet: { chip: 'bg-violet-50 text-violet-700', text: 'text-violet-700' }
	};
	const t = $derived(tones[tone]);
</script>

{#if href}
	<a
		{href}
		class="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition-colors hover:border-blue-300 hover:bg-blue-50/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
		aria-label={`${label}: ${value}${sub ? `, ${sub}` : ''}`}
	>
		<span
			class={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${t.chip}`}
			aria-hidden="true"
		>
			<i class={`fa-solid ${icon}`}></i>
		</span>
		<span class="min-w-0">
			<span class="block truncate text-xs font-medium text-slate-500">{label}</span>
			<span class="block text-lg leading-tight font-bold text-slate-900">{value}</span>
			{#if sub}<span class="block truncate text-xs text-slate-400">{sub}</span>{/if}
		</span>
	</a>
{:else}
	<div class="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4">
		<span
			class={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${t.chip}`}
			aria-hidden="true"
		>
			<i class={`fa-solid ${icon}`}></i>
		</span>
		<div class="min-w-0">
			<p class="truncate text-xs font-medium text-slate-500">{label}</p>
			<p class="text-lg leading-tight font-bold text-slate-900">{value}</p>
			{#if sub}<p class="truncate text-xs text-slate-400">{sub}</p>{/if}
		</div>
	</div>
{/if}
