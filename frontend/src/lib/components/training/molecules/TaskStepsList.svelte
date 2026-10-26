<script lang="ts">
	/**
	 * Daftar langkah pengerjaan penugasan dalam satu kolom:
	 * nomor dan teks sebaris, dipisah garis halus.
	 * Dipakai di pratinjau editor tugas dan halaman penilaian.
	 */
	let { steps }: { steps: string[] } = $props();
</script>

<ol class="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200/80 bg-white">
	{#each steps as step, si (si)}
		<li class="flex items-baseline gap-2 px-3.5 py-2.5 text-sm leading-relaxed text-slate-700">
			<span class="shrink-0 font-extrabold" aria-hidden="true">{si + 1}.</span>
			<span>{step}</span>
		</li>
	{/each}
</ol>
