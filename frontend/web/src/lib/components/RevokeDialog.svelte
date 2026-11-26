<script lang="ts">
	import { tick } from 'svelte';
	import ModalShell from '$lib/components/ModalShell.svelte';
	/**
	 * RevokeDialog — dialog konfirmasi pencabutan sertifikat.
	 *
	 * Dibangun di atas `ModalShell` (native `<dialog>`: fokus, top-layer,
	 * Escape, pengembalian fokus) dengan tambahan kolom alasan wajib.
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
	const reasonId = `${uid}-reason`;
	const reasonErrorId = `${uid}-reason-error`;

	let reason = $state('');
	let touched = $state(false);
	let reasonEl = $state<HTMLTextAreaElement>();

	const trimmed = $derived(reason.trim());
	const showReasonError = $derived(touched && trimmed.length === 0);

	$effect(() => {
		if (!open) return;
		reason = '';
		touched = false;
		void tick().then(() => reasonEl?.focus());
	});

	function confirm(): void {
		touched = true;
		if (trimmed.length === 0 || loading) {
			reasonEl?.focus();
			return;
		}
		onconfirm(trimmed);
	}
</script>

<ModalShell
	bind:open
	title="Cabut sertifikat?"
	icon="fa-ban"
	tileClass="bg-red-100 text-red-600 ring-red-200"
	loading={loading}
	onclose={oncancel}
>
	{#snippet footer()}
		<button
			type="button"
			disabled={loading}
			onclick={() => (open = false)}
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
	{/snippet}
	<p class="text-sm leading-relaxed text-slate-600">
		Sertifikat <span class="font-mono font-bold text-slate-800">{certCode}</span>
		akan berstatus dicabut dan tetap tercatat di riwayat. Tindakan ini tidak menghapus data.
	</p>
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
</ModalShell>
