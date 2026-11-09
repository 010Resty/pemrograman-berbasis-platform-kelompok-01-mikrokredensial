<script lang="ts">
	/**
	 * WarningModal — modal peringatan reusable ARISTOTELES.
	 *
	 * Tiga jenis: `warning` (amber), `danger` (merah), `info` (biru),
	 * masing-masing dengan ikon serta warna tombol yang sesuai.
	 *
	 * Contoh pakai:
	 * ```svelte
	 * <script>
	 *   import WarningModal from '$lib/components/WarningModal.svelte';
	 *   let showDelete = $state(false);
	 *   let deleting = $state(false);
	 *   async function confirmDelete() {
	 *     deleting = true;
	 *     await hapusMateri();
	 *     deleting = false;
	 *     showDelete = false;
	 *   }
	 * <\/script>
	 *
	 * <WarningModal
	 *   bind:open={showDelete}
	 *   type="danger"
	 *   title="Hapus materi?"
	 *   message="Materi yang dihapus tidak bisa dikembalikan."
	 *   confirmText="Ya, hapus"
	 *   cancelText="Batal"
	 *   loading={deleting}
	 *   onconfirm={confirmDelete}
	 * />
	 * ```
	 */
	let {
		open = $bindable(false),
		type = 'warning',
		title,
		message,
		confirmText = 'Konfirmasi',
		cancelText = 'Batal',
		confirmAriaLabel,
		dismissible = true,
		loading = false,
		onconfirm,
		oncancel
	}: {
		/** Kontrol tampil/sembunyi (two-way via `bind:open`). */
		open: boolean;
		/** Jenis modal: menentukan ikon + warna. */
		type?: 'warning' | 'danger' | 'info';
		/** Judul modal. */
		title: string;
		/** Pesan penjelasan. */
		message: string;
		/** Teks tombol utama. */
		confirmText?: string;
		/** Teks tombol sekunder. */
		cancelText?: string;
		/** Label aksesibilitas tombol utama (opsional, default = confirmText). */
		confirmAriaLabel?: string;
		/** Bila false, Escape + klik backdrop dinonaktifkan (aksi wajib dipilih). */
		dismissible?: boolean;
		/** Status sibuk: tombol utama menampilkan spinner & semua cara tutup dikunci. */
		loading?: boolean;
		/** Callback tombol utama. Parent menutup modal via `bind:open`. */
		onconfirm: () => void;
		/** Callback opsional saat dibatalkan (tombol batal / tutup / Escape / backdrop). */
		oncancel?: () => void;
	} = $props();

	const uid = `wm-${Math.random().toString(36).slice(2, 9)}`;
	const titleId = `${uid}-title`;
	const messageId = `${uid}-message`;

	const CONFIG = {
		warning: {
			icon: 'fa-triangle-exclamation',
			tile: 'bg-amber-100 text-amber-600 ring-amber-200',
			confirm: 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/25 focus-visible:outline-amber-600'
		},
		danger: {
			icon: 'fa-trash-can',
			tile: 'bg-red-100 text-red-600 ring-red-200',
			confirm: 'bg-red-600 hover:bg-red-700 shadow-red-600/25 focus-visible:outline-red-600'
		},
		info: {
			icon: 'fa-circle-info',
			tile: 'bg-blue-100 text-blue-600 ring-blue-200',
			confirm: 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/25 focus-visible:outline-blue-600'
		}
	} as const;

	const cfg = $derived(CONFIG[type]);

	let dialogEl = $state<HTMLDivElement>();
	let cancelBtn = $state<HTMLButtonElement>();
	let lastFocused = $state<Element | null>(null);

	/* Kunci scroll badan + fokus tombol batal + kembalikan fokus saat tutup. */
	$effect(() => {
		if (!open) return;
		lastFocused = document.activeElement;
		document.body.style.overflow = 'hidden';
		cancelBtn?.focus();
		return () => {
			document.body.style.overflow = '';
			if (lastFocused instanceof HTMLElement) lastFocused.focus();
		};
	});

	function requestClose(via: 'cancel' | 'escape' | 'backdrop') {
		if (loading) return;
		if (via !== 'cancel' && !dismissible) return;
		oncancel?.();
		open = false;
	}

	function handleBackdropClick(event: MouseEvent) {
		if (event.target === event.currentTarget) requestClose('backdrop');
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			event.stopPropagation();
			requestClose('escape');
			return;
		}
		if (event.key !== 'Tab' || !dialogEl) return;
		/* Kunci fokus di dalam dialog selama modal terbuka. */
		const focusables = [...dialogEl.querySelectorAll<HTMLElement>(
			'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
		)];
		if (focusables.length === 0) return;
		const first = focusables[0];
		const last = focusables[focusables.length - 1];
		if (event.shiftKey && document.activeElement === first) {
			event.preventDefault();
			last.focus();
		} else if (!event.shiftKey && document.activeElement === last) {
			event.preventDefault();
			first.focus();
		}
	}
</script>

{#if open}
	<div
		class="wm-overlay fixed inset-0 z-[80] flex items-end justify-center bg-slate-900/50 p-4 sm:items-center"
		role="presentation"
		onclick={handleBackdropClick}
	>
		<div
			role="dialog"
			aria-modal="true"
			tabindex="-1"
			aria-labelledby={titleId}
			aria-describedby={messageId}
			bind:this={dialogEl}
			onkeydown={handleKeydown}
			class="wm-panel w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
		>
			<div class="p-5 sm:p-6">
				<div class="flex items-start gap-3.5">
					<span
						class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-xl ring-1 {cfg.tile}"
						aria-hidden="true"
					>
						<i class="fa-solid {cfg.icon}"></i>
					</span>
					<div class="min-w-0 flex-1">
						<h2 id={titleId} class="text-base font-extrabold text-slate-900 sm:text-lg">
							{title}
						</h2>
						<p id={messageId} class="mt-1 text-sm leading-relaxed text-slate-600">
							{message}
						</p>
					</div>
					{#if dismissible && !loading}
						<button
							type="button"
							aria-label="Tutup dialog"
							onclick={() => requestClose('cancel')}
							class="flex min-h-9 min-w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-slate-500"
						>
							<i class="fa-solid fa-xmark" aria-hidden="true"></i>
						</button>
					{/if}
				</div>

				<div class="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
					<button
						type="button"
						bind:this={cancelBtn}
						disabled={loading}
						onclick={() => requestClose('cancel')}
						class="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-slate-500 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none sm:px-5"
					>
						{cancelText}
					</button>
					<button
						type="button"
						disabled={loading}
						aria-label={confirmAriaLabel ?? confirmText}
						onclick={onconfirm}
						class="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold text-white shadow-lg transition-all hover:brightness-110 active:scale-[0.98] focus-visible:outline-2 disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none sm:px-5 {cfg.confirm}"
					>
						{#if loading}
							<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i>
							<span>Memproses…</span>
						{:else}
							{confirmText}
						{/if}
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	.wm-overlay {
		animation: wm-fade 0.2s ease-out;
	}

	.wm-panel {
		animation: wm-pop 0.25s cubic-bezier(0.22, 1, 0.36, 1);
		transform-origin: center bottom;
	}

	@media (min-width: 640px) {
		.wm-panel {
			transform-origin: center;
		}
	}

	@keyframes wm-fade {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	@keyframes wm-pop {
		from {
			opacity: 0;
			transform: translateY(16px) scale(0.96);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.wm-overlay,
		.wm-panel {
			animation: none;
		}
	}
</style>
