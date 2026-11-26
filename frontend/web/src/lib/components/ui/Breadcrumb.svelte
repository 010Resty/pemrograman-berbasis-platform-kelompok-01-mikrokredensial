<script lang="ts">
	/**
	 * Breadcrumb — navigasi remah roti tunggal ARISTOTELES.
	 * Dipakai semua halaman dalam (Dasbor > …) agar gaya konsisten:
	 * satu truncate (`max-w-56`), satu pemisah, `aria-current` di akhir.
	 *
	 * Contoh pakai:
	 * ```svelte
	 * <Breadcrumb items={[
	 *   { label: 'Penilaian', href: '/instruktur/penilaian' },
	 *   { label: courseTitle },
	 * ]} />
	 * ```
	 */
	let {
		items,
		label = 'Breadcrumb'
	}: {
		/** Rangkaian crumb; entri terakhir = halaman aktif (tanpa `href`). */
		items: Array<{ label: string; href?: string }>;
		/** Label aksesibilitas nav. */
		label?: string;
	} = $props();
</script>

<nav aria-label={label} class="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
	{#each items as item, i (i)}
		{#if i > 0}
			<i class="fa-solid fa-chevron-right text-[10px] text-slate-300" aria-hidden="true"></i>
		{/if}
		{#if item.href && i < items.length - 1}
			<a
				href={item.href}
				class="max-w-56 truncate rounded font-semibold text-blue-600 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
			>
				{item.label}
			</a>
		{:else}
			<span aria-current={i === items.length - 1 ? 'page' : undefined} class="max-w-56 truncate font-semibold text-slate-900">
				{item.label}
			</span>
		{/if}
	{/each}
</nav>
