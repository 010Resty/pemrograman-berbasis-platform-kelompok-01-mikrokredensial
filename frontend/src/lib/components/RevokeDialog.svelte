<script lang="ts">
	/**
	 * RevokeDialog — dialog konfirmasi pencabutan sertifikat.
	 *
	 * Mengikuti pola WarningModal (overlay, focus trap, Escape/backdrop,
	 * animasi, reduced-motion) dengan tambahan kolom alasan wajib.
	 * Alasan minimal 1 karakter non-spasi; tombol utama nonaktif selama
	 * alasan kosong atau request berjalan.
	 */
	let {
		open = $bindable(false),
		certCode,
		loading = false,
		serverError = '',
		onconfirm,
		oncancel
	}: {
		open: boolean;
		/** Kode sertifikat yang akan dicabut (ditampilkan di pesan). */
		certCode: string;
		/** Status request pencabutan. */
		loading?: boolean;
		/** Pesan error server dari percobaan sebelumnya. */
		serverError?: string;
		/** Dipanggil dengan alasan yang sudah divalidasi tak-kosong. */
		onconfirm: (reason: string) => void;
		/** Opsional: saat dibatalkan. */
		oncancel?: () => void;
	} = $props();

	const uid = `rv-${Math.random().toString(36).slice(2, 9)}`;
	const titleId = `${uid}-title`;
	const reasonId = `${uid}-reason`;
	const reasonErrorId = `${uid}-reason-error`;

	let reason = $state('');
	let touched = $state(false);
	let dialogEl = $state<HTMLDivElement>();
	let reasonEl = $state<HTMLTextAreaElement>();
	let lastFocused = $state<Element | null>(null);

	const trimmed = $derived(reason.trim());
	const showReasonError = $derived(touched && trimmed.length === 0);

	$effect(() => {
		if (!open) return;
		reason = '';
		touched = false;
		lastFocused = document.activeElement;
		document.body.style.overflow = 'hidden';
		reasonEl?.focus();
		return () => {
			document.body.style.overflow = '';
			if (lastFocused instanceof HTMLElement) lastFocused.focus();
		};
	});

	function requestClose(via: 'cancel' | 'escape' | 'backdrop'): void {
		if (loading) return;
		oncancel?.();
		open = false;
	}

	function handleBackdropClick(event: MouseEvent): void {
		if (event.target === event.currentTarget) requestClose('backdrop');
	}

	function handleKeydown(event: KeyboardEvent): void {
		if (event.key === 'Escape') {
			event.stopPropagation();
			requestClose('escape');
			return;
		}
		if (event.key !== 'Tab' || !dialogEl) return;
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

	function confirm(): void {
		touched = true;
		if (trimmed.length === 0 || loading) {
			reasonEl?.focus();
			return;
		}
		onconfirm(trimmed);
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
			aria-describedby={reasonId}
			bind:this={dialogEl}
			onkeydown={handleKeydown}
			class="wm-panel w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
		>
			<div class="p-5 sm:p-6">
				<div class="flex items-start gap-3.5">
					<span
						class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-100 text-xl text-red-600 ring-1 ring-red-200"
						aria-hidden="true"
					>
						<i class="fa-solid fa-ban"></i>
					</span>
					<div class="min-w-0 flex-1">
						<h2 id={titleId} class="text-base font-extrabold text-slate-900 sm:text-lg">
							Cabut sertifikat?
						</h2>
						<p class="mt-1 text-sm leading-relaxed text-slate-600">
							Sertifikat <span class="font-mono font-bold text-slate-800">{certCode}</span>
							akan berstatus dicabut dan tetap tercatat di riwayat. Tindakan ini tidak menghapus data.
						</p>
					</div>
					{#if !loading}
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

				<div class="mt-4">
					<label for={reasonId} class="mb-1.5 block text-xs font-bold text-slate-700">
						Alasan pencabutan <span class="text-red-600" aria-hidden="true">*</span>
						<span class="sr-only">(wajib diisi)</span>
					</label>
					<textarea
						id={reasonId}
						bind:this={reasonEl}
						bind:value={reason}
						rows={3}
						maxlength={500}
						disabled={loading}
						aria-invalid={showReasonError}
						aria-describedby={showReasonError ? reasonErrorId : undefined}
						placeholder="Contoh: nama peserta salah, perlu penerbitan ulang"
						class="w-full resize-y rounded-xl border bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none {showReasonError
							? 'border-red-400 focus:border-red-500 focus:ring-4 focus:ring-red-500/10'
							: 'border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10'} disabled:cursor-not-allowed disabled:opacity-60"
					></textarea>
					{#if showReasonError}
						<p id={reasonErrorId} role="alert" class="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-red-600">
							<i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i>
							Alasan wajib diisi.
						</p>
					{/if}
					{#if serverError}
						<p role="alert" class="mt-1.5 flex items-start gap-1.5 text-xs font-semibold text-red-600">
							<i class="fa-solid fa-circle-exclamation mt-0.5" aria-hidden="true"></i>
							<span>{serverError}</span>
						</p>
					{/if}
				</div>

				<div class="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
					<button
						type="button"
						disabled={loading}
						onclick={() => requestClose('cancel')}
						class="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-slate-500 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none sm:px-5"
					>
						Batal
					</button>
					<button
						type="button"
						disabled={loading || trimmed.length === 0}
						aria-label="Ya, cabut sertifikat dengan alasan yang diisi"
						onclick={confirm}
						class="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-red-600/25 transition-all hover:brightness-110 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-red-600 disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none sm:px-5"
					>
						{#if loading}
							<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i>
							<span>Mencabut…</span>
						{:else}
							Ya, cabut sertifikat
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
