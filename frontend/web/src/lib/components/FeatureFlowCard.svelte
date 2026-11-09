<script lang="ts">
	/**
	 * Kartu panduan alur fitur — satu kartu penuh berisi daftar fitur dari atas
	 * ke bawah. Tiap fitur dapat diklik untuk membuka diagram alur horizontal
	 * (lingkaran bernomor per langkah) dari admin hingga ke penerima
	 * (instruktur/peserta). Dibuat generik agar dapat dipakai ulang di
	 * dashboard Peserta dan Instruktur dengan isi berbeda.
	 *
	 * Contoh pakai (semua tertutup saat pertama dibuka; klik untuk membuka):
	 * ```svelte
	 * <FeatureFlowCard flows={[
	 *   {
	 *     icon: 'fa-envelope-open-text',
	 *     tile: 'bg-violet-50 text-violet-600',
	 *     title: 'Tambah Instruktur via Undangan',
	 *     description: '…',
	 *     ctaLabel: 'Kelola Undangan',
	 *     href: '/admin/invitations',
	 *     ctaClass: 'bg-violet-600 hover:bg-violet-700 focus-visible:outline-violet-600',
	 *     note: '…',
	 *     steps: [{ title: 'Admin membuat undangan', detail: '…', color: 'bg-violet-600 ring-violet-200' }]
	 *   }
	 * ]} />
	 * ```
	 */
	export interface FlowStep {
		/** Judul langkah, mis. "Admin membagikan tautan". */
		title: string;
		/** Satu kalimat penjelas langkah. */
		detail: string;
		/**
		 * Warna lingkaran langkah, mis. `bg-violet-600 ring-violet-200`.
		 * Bila kosong dipakai palet bawaan sesuai urutan.
		 */
		color?: string;
	}

	export interface FeatureFlow {
		/** Kelas ikon FontAwesome tanpa prefix `fa-solid`, mis. `fa-ticket`. */
		icon: string;
		/** Kelas warna ubin ikon, mis. `bg-orange-50 text-orange-600`. */
		tile: string;
		title: string;
		description: string;
		ctaLabel: string;
		href: string;
		/** Kelas warna tombol CTA (background, hover, outline). */
		ctaClass: string;
		/** Catatan kecil, mis. batasan simulasi lokal. */
		note?: string;
		/** Alur ujung-ke-ujung dari admin hingga penerima. */
		steps: FlowStep[];
	}

	/**
	 * Palet bawaan bila langkah tidak menentukan warna sendiri.
	 * Disengaja nuansa `-600` agar angka putih tetap terbaca; urutan langkah
	 * juga diumumkan via teks sr-only sehingga warna bukan satu-satunya pembeda.
	 */
	const DEFAULT_PALETTE = [
		'bg-violet-600 ring-violet-200',
		'bg-blue-600 ring-blue-200',
		'bg-cyan-600 ring-cyan-200',
		'bg-amber-600 ring-amber-200',
		'bg-orange-600 ring-orange-200',
		'bg-emerald-600 ring-emerald-200'
	];

	let { flows }: { flows: FeatureFlow[] } = $props();

	/* Semua panduan tertutup saat pertama dibuka; pengguna membuka manual
	 * per kebutuhan (tidak ada yang terbuka otomatis). */
	let open = $state<Record<number, boolean>>({});

	function slug(title: string): string {
		return title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
	}

	function toggle(i: number) {
		open[i] = !open[i];
	}
</script>

<div class="overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm">
	<div class="divide-y divide-slate-100">
		{#each flows as flow, i (flow.title)}
			{@const isOpen = !!open[i]}
			{@const panelId = `alur-${slug(flow.title)}`}
			{@const buttonId = `tombol-${slug(flow.title)}`}
			<div>
				<button
					type="button"
					id={buttonId}
					aria-expanded={isOpen}
					aria-controls={panelId}
					onclick={() => toggle(i)}
					class="flex w-full items-center gap-4 p-5 text-left transition-colors hover:bg-slate-50/70 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-600 sm:px-6"
				>
					<span
						class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl {flow.tile}"
						aria-hidden="true"
					>
						<i class="fa-solid {flow.icon} text-xl"></i>
					</span>
					<span class="min-w-0 flex-1">
						<span class="block text-sm font-bold text-slate-900 sm:text-base">
							<span class="mr-2 font-mono text-xs font-extrabold text-slate-300" aria-hidden="true">
								{String(i + 1).padStart(2, '0')}
							</span>{flow.title}
						</span>
						<span class="mt-0.5 block truncate text-xs text-slate-500 sm:text-sm">
							{flow.description}
						</span>
					</span>
					<span
						class="flex min-h-9 min-w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition-transform {isOpen ? 'rotate-180' : ''}"
						aria-hidden="true"
					>
						<i class="fa-solid fa-chevron-down text-xs"></i>
					</span>
				</button>

				{#if isOpen}
					<div
						id={panelId}
						role="region"
						aria-labelledby={buttonId}
						class="flow-panel border-t border-dashed border-slate-200 bg-slate-50/60 px-5 py-5 sm:px-6"
					>
						<p class="mb-4 text-xs font-bold tracking-wider text-slate-500 uppercase">
							Alur langkah — klik tiap fitur untuk membuka/menutup
						</p>
						<ol class="flex items-stretch gap-1 overflow-x-auto pb-2" aria-label={`Alur ${flow.title}`}>
							{#each flow.steps as step, s (step.title)}
								<li class="flex min-w-44 flex-1 items-stretch gap-2">
									<div class="flex w-full flex-col items-center rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm transition-shadow hover:shadow-md">
										<span
											class="flex h-14 w-14 items-center justify-center rounded-full text-lg font-extrabold text-white shadow-lg ring-4 {step.color ?? DEFAULT_PALETTE[s % DEFAULT_PALETTE.length]}"
											aria-hidden="true"
										>
											{s + 1}
										</span>
										<p class="mt-2.5 text-[13px] leading-snug font-bold text-slate-900">
											<span class="sr-only">Langkah {s + 1}: </span>{step.title}
										</p>
										<p class="mt-1 text-[11px] leading-relaxed text-slate-500">{step.detail}</p>
									</div>
									{#if s < flow.steps.length - 1}
										<span class="shrink-0 self-center text-slate-300" aria-hidden="true">
											<i class="fa-solid fa-arrow-right text-sm"></i>
										</span>
									{/if}
								</li>
							{/each}
						</ol>
						{#if flow.note}
							<p
								class="mt-3 flex items-start gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[11px] leading-relaxed text-amber-800"
							>
								<i class="fa-solid fa-triangle-exclamation mt-0.5 shrink-0" aria-hidden="true"></i>
								<span>{flow.note}</span>
							</p>
						{/if}
						<div class="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
							<p class="text-[11px] text-slate-400">
								{flow.steps.length} langkah · dari admin hingga ke penerima
							</p>
							<a
								href={flow.href}
								aria-label={`${flow.ctaLabel} — buka halaman ${flow.title}`}
								class="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold text-white shadow-lg transition-colors focus-visible:outline-2 {flow.ctaClass}"
							>
								{flow.ctaLabel}
								<i class="fa-solid fa-arrow-right text-[11px]" aria-hidden="true"></i>
							</a>
						</div>
					</div>
				{/if}
			</div>
		{/each}
	</div>
</div>

<style>
	.flow-panel {
		animation: flow-in 0.25s ease-out;
	}

	@keyframes flow-in {
		from {
			opacity: 0;
			transform: translateY(-6px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.flow-panel {
			animation: none;
		}
	}
</style>
