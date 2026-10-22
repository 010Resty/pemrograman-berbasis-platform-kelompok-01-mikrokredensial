<script lang="ts">
	/**
	 * Pemilih bulan + tahun kustom (pengganti <input type="month"> bawaan
	 * browser yang tampilannya tidak konsisten). Nilai tetap format `YYYY-MM`.
	 * Bulan yang sudah lewat nonaktif agar batch upcoming selalu valid.
	 */
	const MONTHS = [
		{ short: 'Jan', full: 'Januari' },
		{ short: 'Feb', full: 'Februari' },
		{ short: 'Mar', full: 'Maret' },
		{ short: 'Apr', full: 'April' },
		{ short: 'Mei', full: 'Mei' },
		{ short: 'Jun', full: 'Juni' },
		{ short: 'Jul', full: 'Juli' },
		{ short: 'Agu', full: 'Agustus' },
		{ short: 'Sep', full: 'September' },
		{ short: 'Okt', full: 'Oktober' },
		{ short: 'Nov', full: 'November' },
		{ short: 'Des', full: 'Desember' }
	];

	let {
		value = $bindable(''),
		labelledby,
		describedby,
		invalid = false
	}: {
		value?: string;
		labelledby?: string;
		describedby?: string;
		invalid?: boolean;
	} = $props();

	const now = new Date();
	const MIN_YEAR = now.getFullYear();
	const MAX_YEAR = MIN_YEAR + 5;

	let open = $state(false);
	let viewYear = $state(MIN_YEAR);
	let triggerEl = $state<HTMLButtonElement | null>(null);
	let panelEl = $state<HTMLDivElement | null>(null);

	const selected = $derived.by(() => {
		const [y, m] = value.split('-').map(Number);
		if (!y || !m || m < 1 || m > 12) return null;
		return { y, m };
	});

	const triggerLabel = $derived(
		selected ? `${MONTHS[selected.m - 1].full} ${selected.y}` : 'Pilih bulan mulai…'
	);

	function isDisabled(y: number, m: number): boolean {
		return y < MIN_YEAR || y > MAX_YEAR || (y === MIN_YEAR && m < now.getMonth() + 1);
	}

	function toggle() {
		if (open) {
			close();
			return;
		}
		viewYear = selected?.y ?? MIN_YEAR;
		open = true;
	}

	function close(refocus = true) {
		open = false;
		if (refocus) triggerEl?.focus();
	}

	function choose(m: number) {
		value = `${viewYear}-${String(m).padStart(2, '0')}`;
		close();
	}

	function stepYear(dir: 1 | -1) {
		viewYear = Math.min(MAX_YEAR, Math.max(MIN_YEAR, viewYear + dir));
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.stopPropagation();
			close();
		}
	}

	// Tutup saat klik di luar pemilih.
	$effect(() => {
		if (!open) return;
		const onDocClick = (e: MouseEvent) => {
			const t = e.target as Node | null;
			if (t && !panelEl?.contains(t) && !triggerEl?.contains(t)) close(false);
		};
		document.addEventListener('mousedown', onDocClick);
		return () => document.removeEventListener('mousedown', onDocClick);
	});
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="relative" bind:this={panelEl}>
	<button
		type="button"
		bind:this={triggerEl}
		onclick={toggle}
		aria-haspopup="dialog"
		aria-expanded={open}
		aria-labelledby={labelledby}
		aria-describedby={describedby}
		class={`flex w-full items-center gap-3 rounded-xl border bg-white px-3.5 py-2.5 text-left text-sm transition-all focus:ring-4 focus:outline-none ${invalid ? 'border-red-300 focus:border-red-500 focus:ring-red-500/10' : open ? 'border-blue-500 ring-4 ring-blue-500/10' : 'border-slate-200 focus:border-blue-500 focus:ring-blue-500/10'} ${selected ? 'font-semibold text-slate-800' : 'text-slate-400'}`}
	>
		<span
			class={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${selected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}
			aria-hidden="true"
		>
			<i class="fa-solid fa-calendar-days text-sm"></i>
		</span>
		<span class="min-w-0 flex-1 truncate">{triggerLabel}</span>
		<i
			class={`fa-solid fa-chevron-down shrink-0 text-xs text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
			aria-hidden="true"
		></i>
	</button>

	{#if open}
		<div
			role="dialog"
			aria-label="Pilih bulan mulai batch"
			class="absolute top-full right-0 left-0 z-30 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-xl shadow-slate-900/10 sm:right-auto sm:w-72"
		>
			<div class="mb-3 flex items-center justify-between">
				<button
					type="button"
					onclick={() => stepYear(-1)}
					disabled={viewYear <= MIN_YEAR}
					aria-label="Tahun sebelumnya"
					class="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-blue-600"
				>
					<i class="fa-solid fa-chevron-left text-xs" aria-hidden="true"></i>
				</button>
				<p class="text-sm font-extrabold text-slate-900" aria-live="polite">{viewYear}</p>
				<button
					type="button"
					onclick={() => stepYear(1)}
					disabled={viewYear >= MAX_YEAR}
					aria-label="Tahun berikutnya"
					class="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-blue-600"
				>
					<i class="fa-solid fa-chevron-right text-xs" aria-hidden="true"></i>
				</button>
			</div>
			<div class="grid grid-cols-3 gap-1.5" role="group" aria-label={`Bulan tahun ${viewYear}`}>
				{#each MONTHS as mon, i (mon.full)}
					{@const m = i + 1}
					{@const disabled = isDisabled(viewYear, m)}
					{@const active = selected?.y === viewYear && selected.m === m}
					{@const isCurrent = viewYear === now.getFullYear() && m === now.getMonth() + 1}
					<button
						type="button"
						onclick={() => choose(m)}
						disabled={disabled}
						aria-pressed={active}
						aria-label={`${mon.full} ${viewYear}${disabled ? ' (tidak tersedia)' : ''}`}
						title={`${mon.full} ${viewYear}`}
						class={`min-h-11 rounded-xl px-2 py-2 text-xs font-bold transition-all active:scale-95 focus-visible:outline-2 focus-visible:outline-blue-600 ${active ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25' : disabled ? 'cursor-not-allowed text-slate-300' : 'text-slate-600 hover:bg-blue-50 hover:text-blue-700'} ${!active && !disabled && isCurrent ? 'ring-1 ring-blue-400' : ''}`}
					>
						{mon.short}
					</button>
				{/each}
			</div>
			<p class="mt-3 flex items-center gap-1.5 text-[11px] text-slate-400">
				<i class="fa-solid fa-circle-info" aria-hidden="true"></i>
				Bulan yang sudah lewat tidak bisa dipilih.
			</p>
		</div>
	{/if}
</div>
