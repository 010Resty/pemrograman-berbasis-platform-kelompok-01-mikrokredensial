<script lang="ts">
	/**
	 * Navigasi halaman untuk tabel admin: info rentang, pilihan baris per halaman,
	 * tombol Sebelumnya/Berikutnya, dan nomor halaman dengan elipsis.
	 */
	let {
		page = $bindable(1),
		totalItems,
		perPage = $bindable(10),
		perPageOptions = [5, 10, 25],
		label = 'Navigasi halaman tabel',
		itemLabel = 'baris',
		id = 'rows-per-page',
		activeClass = 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
	}: {
		page?: number;
		totalItems: number;
		perPage?: number;
		perPageOptions?: number[];
		label?: string;
		itemLabel?: string;
		id?: string;
		/** Kelas tombol nomor halaman aktif. */
		activeClass?: string;
	} = $props();

	const totalPages = $derived(Math.max(1, Math.ceil(totalItems / Math.max(1, perPage))));
	const safePage = $derived(Math.min(Math.max(1, page), totalPages));
	const from = $derived(totalItems === 0 ? 0 : (safePage - 1) * perPage + 1);
	const to = $derived(Math.min(safePage * perPage, totalItems));

	/** Daftar nomor halaman dengan elipsis, maksimal 5 nomor terlihat. */
	const pages = $derived.by<(number | '…')[]>(() => {
		if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
		const window: (number | '…')[] = [1];
		const start = Math.max(2, Math.min(safePage - 1, totalPages - 3));
		const end = Math.min(totalPages - 1, start + 2);
		if (start > 2) window.push('…');
		for (let p = start; p <= end; p++) window.push(p);
		if (end < totalPages - 1) window.push('…');
		window.push(totalPages);
		return window;
	});

	function go(p: number) {
		page = Math.min(Math.max(1, p), totalPages);
	}
</script>

<div class="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
	<p class="text-xs text-slate-500 tabular-nums" role="status" aria-live="polite">
		Menampilkan <span class="font-bold text-slate-700">{from}–{to}</span> dari
		<span class="font-bold text-slate-700">{totalItems}</span>
		{itemLabel}
	</p>
	<div class="flex flex-wrap items-center gap-2">
		<label for={id} class="text-xs font-bold text-slate-600">Baris per halaman</label>
		<select
			{id}
			bind:value={perPage}
			aria-label="Baris per halaman"
			class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 focus:border-blue-500 focus:outline-none"
		>
			{#each perPageOptions as opt (opt)}
				<option value={opt}>{opt} / halaman</option>
			{/each}
		</select>
		<nav aria-label={label} class="flex items-center gap-1">
			<button
				type="button"
				onclick={() => go(safePage - 1)}
				disabled={safePage <= 1}
				aria-label="Halaman sebelumnya"
				class="flex min-h-9 min-w-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-2 text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
			>
				<i class="fa-solid fa-chevron-left text-xs" aria-hidden="true"></i>
			</button>
			{#each pages as p, i (p === '…' ? `gap-${i}` : p)}
				{#if p === '…'}
					<span class="px-1 text-xs font-bold text-slate-400" aria-hidden="true">…</span>
				{:else}
					<button
						type="button"
						onclick={() => go(p)}
						aria-label={`Ke halaman ${p}`}
						aria-current={p === safePage ? 'page' : undefined}
						class={`flex min-h-9 min-w-9 items-center justify-center rounded-lg px-2 text-xs font-bold transition-colors focus-visible:outline-2 focus-visible:outline-blue-600 ${
							p === safePage
								? activeClass
								: 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
						}`}
					>
						{p}
					</button>
				{/if}
			{/each}
			<button
				type="button"
				onclick={() => go(safePage + 1)}
				disabled={safePage >= totalPages}
				aria-label="Halaman berikutnya"
				class="flex min-h-9 min-w-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-2 text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
			>
				<i class="fa-solid fa-chevron-right text-xs" aria-hidden="true"></i>
			</button>
		</nav>
	</div>
</div>
