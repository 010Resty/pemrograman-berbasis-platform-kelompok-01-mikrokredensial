<script lang="ts">
	import type { Snippet } from 'svelte';
	/**
	 * WarningModal — modal peringatan reusable ARISTOTELES.
	 *
	 * Native `<dialog>` + `showModal()`: fokus, top-layer, Escape, dan
	 * pengembalian fokus ditangani browser (tanpa focus-trap manual,
	 * tanpa `role="dialog"`/`aria-modal`, tanpa kunci `body overflow`).
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
		oncancel,
		extra
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
		/** Konten tambahan opsional (mis. kolom input) di antara pesan dan tombol. */
		extra?: Snippet;
	} = $props();

	const uid = $props.id();
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

	let dialogEl = $state<HTMLDialogElement>();
	let cancelBtn = $state<HTMLButtonElement>();

	/* Sinkronkan `open` <-> dialog native. `closedby` progresif:
	 * browser tanpa dukungan tetap tutup via Escape + klik backdrop manual. */
	$effect(() => {
		const el = dialogEl;
		if (!el) return;
		el.setAttribute('closedby', dismissible && !loading ? 'any' : 'none');
		if (open && !el.open) {
			el.showModal();
			cancelBtn?.focus();
		} else if (!open && el.open) {
			el.close();
		}
	});

	function requestClose(via: 'cancel' | 'escape' | 'backdrop') {
		if (loading) return;
		if (via !== 'cancel' && !dismissible) return;
		dialogEl?.close();
	}

	function confirm() {
		if (loading) return;
		if (dialogEl) {
			dialogEl.returnValue = 'confirmed';
			dialogEl.close();
		}
		open = false;
		onconfirm();
	}

	/** Escape/browser-back: kunci saat sibuk atau wajib pilih aksi. */
	function handleCancel(event: Event) {
		if (loading || !dismissible) event.preventDefault();
	}

	/** Satu-satunya tempat sinkronisasi tutup -> state + callback batal. */
	function handleClose() {
		const value = dialogEl?.returnValue ?? '';
		if (dialogEl) dialogEl.returnValue = '';
		if (value === 'confirmed') return;
		if (open) {
			open = false;
			oncancel?.();
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
	aria-describedby={messageId}
	onclose={handleClose}
	oncancel={handleCancel}
	onclick={handleBackdropClick}
	class="wm-dialog m-auto w-full max-w-md rounded-2xl bg-white p-0 shadow-2xl backdrop:bg-slate-900/50"
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
					class="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-slate-500"
				>
					<i class="fa-solid fa-xmark" aria-hidden="true"></i>
				</button>
			{/if}
		</div>

		{#if extra}
			<div class="mt-4">
				{@render extra()}
			</div>
		{/if}

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
				onclick={confirm}
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
