<script lang="ts">
	import type { Chapter } from '$lib/data/material-details';

	let {
		src,
		title,
		poster,
		intro,
		chapters = [],
		points = []
	}: {
		src: string;
		title: string;
		poster?: string;
		intro?: string;
		chapters?: Chapter[];
		points?: string[];
	} = $props();
</script>

<div class="space-y-4">
	{#if intro}
		<p class="text-sm leading-relaxed text-slate-600 sm:text-[15px]">{intro}</p>
	{/if}
	<div class="overflow-hidden rounded-2xl border border-slate-200 bg-slate-950">
		<video
			controls
			preload="metadata"
			poster={poster}
			class="aspect-video w-full"
			aria-label={`Video: ${title}`}
		>
			<source {src} type="video/mp4" />
			Browser Anda tidak mendukung pemutar video.
		</video>
	</div>
	{#if chapters.length > 0}
		<div class="rounded-2xl border border-slate-200 bg-white p-5">
			<p class="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900">
				<i class="fa-solid fa-list-ul text-blue-600" aria-hidden="true"></i> Bab video
			</p>
			<ol class="space-y-2">
				{#each chapters as ch (ch.time + ch.label)}
					<li class="flex items-center gap-3 text-sm">
						<span
							class="shrink-0 rounded-lg bg-slate-100 px-2.5 py-1 font-mono text-[11px] font-bold text-slate-700"
						>
							{ch.time}
						</span>
						<span class="text-slate-700">{ch.label}</span>
					</li>
				{/each}
			</ol>
		</div>
	{/if}
	{#if points.length > 0}
		<ul class="space-y-2.5">
			{#each points as point (point)}
				<li class="flex items-start gap-2.5 text-sm text-slate-700">
					<i class="fa-solid fa-circle-check mt-0.5 shrink-0 text-emerald-500" aria-hidden="true"></i>
					<span>{point}</span>
				</li>
			{/each}
		</ul>
	{/if}
</div>
