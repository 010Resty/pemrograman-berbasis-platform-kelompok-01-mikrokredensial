<script lang="ts">
	import type { Snippet } from 'svelte';
	/**
	 * ModalShell — kerangka dialog generik ARISTOTELES.
	 *
	 * Native `<dialog>` + `showModal()`: fokus, top-layer, Escape, dan
	 * pengembalian fokus ditangani browser. Pola yang sama dengan
	 * `WarningModal.svelte` (animasi, `closedby`, light-dismiss) agar semua
	 * dialog berperilaku seragam (AGENTS.md §6).
	 *
	 * Contoh pakai:
	 * ```svelte
	 * <ModalShell bind:open={show} title="Verifikasi pembayaran">
	 *   {#snippet footer()}
	 *     <button onclick={batal}>Batal</button>
	 *     <button onclick={simpan}>Simpan</button>
	 *   {/snippet}
	 *   <p>Isi dialog…</p>
	 * </ModalShell>
	 * ```
	 */
	let {
		open = $bindable(false),
		title,
		icon = 'fa-circle-info',
		tileClass = 'bg-blue-100 text-blue-600 ring-blue-200',
		dismissible = true,
		loading = false,
		onclose,
		children,
		footer
	}: {
		/** Kontrol tampil/sembunyi (two-way via `bind:open`). */
		open: boolean;
		/** Judul dialog (wajib, untuk `aria-labelledby`). */
		title: string;
		/** Ikon FontAwesome di ubin judul. */
		icon?: string;
		/** Kelas warna ubin ikon. */
		tileClass?: string;
		/** Bila false, Escape + klik backdrop dinonaktifkan. */
		dismissible?: boolean;
		/** Status sibuk: semua cara tutup dikunci. */
		loading?: boolean;
		/** Callback sekali tiap dialog tertutup (kecuali via `confirm` internal). */
		onclose?: () => void;
		/** Isi dialog. */
		children: Snippet;
		/** Baris tombol opsional. */
		footer?: Snippet;
	} = $props();

	const uid = $props.id();
	const titleId = `${uid}-title`;

	let dialogEl = $state<HTMLDialogElement>();
	let closeBtn = $state<HTMLButtonElement>();

	/* Sinkronkan `open` <-> dialog native (pola WarningModal). */
	$effect(() => {
		const el = dialogEl;
		if (!el) return;
		el.setAttribute('closedby', dismissible && !loading ? 'any' : 'none');
		if (open && !el.open) {
			el.showModal();
			(closeBtn ?? el).focus();
		} else if (!open && el.open) {
			el.close();
		}
	});

	function requestClose(via: 'cancel' | 'escape' | 'backdrop') {
		if (loading) return;
		if (via !== 'cancel' && !dismissible) return;
		dialogEl?.close();
	}

	/** Escape/browser-back: kunci saat sibuk atau wajib pilih aksi. */
	function handleCancel(event: Event) {
		if (loading || !dismissible) event.preventDefault();
	}

	/** Satu-satunya tempat sinkronisasi tutup -> state + callback. */
	function handleClose() {
		if (open) {
			open = false;
			onclose?.();
		}
	}

	/** Fallback light-dismiss untuk browser tanpa `closedby="any"`. */
	function handleBackdropClick(event: MouseEvent) {
		if (event.target === dialogEl) requestClose('backdrop');
	}
</script>

<dialog
	bind:this={dialogEl}
	aria-labelledby={titleId}
	onclose={handleClose}
	oncancel={handleCancel}
	onclick={handleBackdropClick}
	class="wm-dialog m-auto w-full max-w-md rounded-2xl bg-white p-0 shadow-2xl backdrop:bg-slate-900/50"
>
	<div class="p-5 sm:p-6">
		<div class="flex items-start gap-3.5">
			<span
				class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-xl ring-1 {tileClass}"
				aria-hidden="true"
			>
				<i class="fa-solid {icon}"></i>
			</span>
			<div class="min-w-0 flex-1">
				<h2 id={titleId} class="text-base font-extrabold text-slate-900 sm:text-lg">
					{title}
				</h2>
			</div>
			{#if dismissible && !loading}
				<button
					type="button"
					bind:this={closeBtn}
					aria-label="Tutup dialog"
					onclick={() => requestClose('cancel')}
					class="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-slate-500"
				>
					<i class="fa-solid fa-xmark" aria-hidden="true"></i>
				</button>
			{/if}
		</div>

		<div class="mt-4">
			{@render children()}
		</div>

		{#if footer}
			<div class="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
				{@render footer()}
			</div>
		{/if}
	</div>
</dialog>

<style>
	.wm-dialog[open] {
		animation: wm-pop 0.25s cubic-bezier(0.22, 1, 0.36, 1);
	}
	.wm-dialog[open]::backdrop {
		animation: wm-fade 0.2s ease-out;
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
		.wm-dialog[open],
		.wm-dialog[open]::backdrop {
			animation: none;
		}
	}
</style>
