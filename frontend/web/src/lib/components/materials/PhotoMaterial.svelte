<script lang="ts">
	import { buildSrcSet } from '$lib/api/responsive';
	let {
		src,
		alt,
		caption,
		intro,
		points = []
	}: {
		src: string;
		alt: string;
		caption?: string;
		intro?: string;
		points?: string[];
	} = $props();

	/** Varian responsif backend (`?w=`); null = pakai `src` polos (mis. URL luar). */
	const srcSet = $derived(buildSrcSet(src));
</script>

<div class="space-y-4">
	{#if intro}
		<p class="text-sm leading-relaxed text-slate-600 sm:text-[15px]">{intro}</p>
	{/if}
	<figure class="overflow-hidden rounded-2xl border border-slate-200 bg-slate-900">
		<img
			src={src}
			srcset={srcSet}
			sizes="(max-width: 768px) 100vw, 768px"
			{alt}
			class="max-h-[480px] w-full bg-slate-900 object-contain"
			loading="lazy"
			decoding="async"
		/>
		{#if caption}
			<figcaption class="flex items-start gap-2 px-4 py-3 text-xs leading-relaxed text-slate-300">
				<i class="fa-solid fa-image mt-0.5 shrink-0 text-slate-400" aria-hidden="true"></i>
				<span>{caption}</span>
			</figcaption>
		{/if}
	</figure>
	{#if points.length > 0}
		<ul class="space-y-2.5">
			{#each points as point, i (point)}
				<li class="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3.5 text-sm text-slate-700">
					<span
						class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-xs font-extrabold text-blue-700"
						aria-hidden="true"
					>
						{i + 1}
					</span>
					<span>{point}</span>
				</li>
			{/each}
		</ul>
	{/if}
</div>
