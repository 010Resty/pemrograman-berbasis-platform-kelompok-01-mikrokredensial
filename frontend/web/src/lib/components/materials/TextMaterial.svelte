<script lang="ts">
	let {
		intro,
		paragraphs = [],
		points = []
	}: {
		intro?: string;
		paragraphs?: string[];
		points?: string[];
	} = $props();
</script>

<div class="space-y-4 text-sm leading-relaxed text-slate-700 sm:text-[15px]">
	{#if intro}
		<p class="rounded-xl border-l-4 border-blue-500 bg-blue-50/70 p-4 font-medium text-slate-800">
			{intro}
		</p>
	{/if}
	{#each paragraphs as p (p.slice(0, 48))}
		<p>{p}</p>
	{/each}
	{#if points.length > 0}
		<div class="rounded-2xl border border-slate-200 bg-slate-50 p-5">
			<p class="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900">
				<i class="fa-solid fa-list-check text-blue-600" aria-hidden="true"></i> Poin penting
			</p>
			<ul class="space-y-2.5">
				{#each points as point (point)}
					<li class="flex items-start gap-2.5 text-sm text-slate-700">
						<i class="fa-solid fa-circle-check mt-0.5 shrink-0 text-emerald-500" aria-hidden="true"></i>
						<span>{point}</span>
					</li>
				{/each}
			</ul>
		</div>
	{/if}
</div>
