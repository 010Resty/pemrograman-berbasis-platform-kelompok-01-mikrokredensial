<script lang="ts">
	let {
		src,
		title,
		intro,
		transcript
	}: {
		src: string;
		title: string;
		intro?: string;
		transcript?: string;
	} = $props();
</script>

<div class="space-y-4">
	{#if intro}
		<p class="text-sm leading-relaxed text-slate-600 sm:text-[15px]">{intro}</p>
	{/if}
	<div class="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-900 to-slate-800 p-5 sm:p-6">
		<div class="mb-4 flex items-center gap-3">
			<span class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10" aria-hidden="true">
				<i class="fa-solid fa-headphones text-xl text-cyan-300"></i>
			</span>
			<div class="min-w-0">
				<p class="truncate text-sm font-bold text-white">{title}</p>
				<p class="text-xs text-slate-400">Audio pembelajaran · gunakan kontrol di bawah</p>
			</div>
		</div>
		<audio controls preload="metadata" class="w-full" aria-label={`Audio: ${title}`}>
			<source {src} type="audio/mpeg" />
			Browser Anda tidak mendukung pemutar audio.
		</audio>
	</div>
	{#if transcript}
		<details class="group rounded-2xl border border-slate-200 bg-white">
			<summary
				class="flex cursor-pointer items-center gap-2.5 rounded-2xl p-4 text-sm font-bold text-slate-800 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600"
			>
				<i
					class="fa-solid fa-chevron-down text-xs text-slate-400 transition-transform group-open:rotate-180"
					aria-hidden="true"
				></i>
				<i class="fa-solid fa-file-lines text-slate-400" aria-hidden="true"></i>
				Lihat transkrip lengkap
			</summary>
			<div class="border-t border-slate-100 px-4 py-4 text-sm leading-relaxed text-slate-600">
				{transcript}
			</div>
		</details>
	{/if}
</div>
