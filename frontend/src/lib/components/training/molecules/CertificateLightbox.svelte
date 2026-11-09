<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * CertificateLightbox — penampil sertifikat layar penuh.
	 *
	 * Alasan pola sendiri (bukan WarningModal): WarningModal adalah dialog
	 * konfirmasi sempit (max-w-md + tombolYa/Batal) untuk aksi destruktif;
	 * viewer butuh kanvas lebar + konten bebas + tanpa tombol aksi. Perilaku
	 * aksesibilitas disamakan: kunci scroll, Escape, klik backdrop, fokus
	 * tombol tutup + kembalikan fokus saat tutup.
	 */
	let {
		open = $bindable(false),
		label,
		children
	}: {
		open: boolean;
		label: string;
		children: Snippet;
	} = $props();

	let panelEl = $state<HTMLDivElement>();
	let closeBtn = $state<HTMLButtonElement>();
	let lastFocused = $state<Element | null>(null);

	$effect(() => {
		if (!open) return;
		lastFocused = document.activeElement;
		document.body.style.overflow = 'hidden';
		closeBtn?.focus();
		return () => {
			document.body.style.overflow = '';
			if (lastFocused instanceof HTMLElement) lastFocused.focus();
		};
	});

	function close(): void {
		open = false;
	}

	function handleBackdrop(event: MouseEvent): void {
		if (event.target === event.currentTarget) close();
	}

	function handleKeydown(event: KeyboardEvent): void {
		if (event.key === 'Escape') {
			event.stopPropagation();
			close();
		}
	}
</script>

{#if open}
	<div
		class="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/70 p-4 sm:p-8"
		role="presentation"
		onclick={handleBackdrop}
	>
		<div
			role="dialog"
			aria-modal="true"
			aria-label={label}
			tabindex="-1"
			bind:this={panelEl}
			onkeydown={handleKeydown}
			class="max-h-full w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl sm:p-6"
		>
			<div class="mb-3 flex justify-end">
				<button
					type="button"
					bind:this={closeBtn}
					onclick={close}
					aria-label="Tutup tampilan sertifikat"
					class="flex min-h-10 min-w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-blue-600"
				>
					<i class="fa-solid fa-xmark" aria-hidden="true"></i>
				</button>
			</div>
			{@render children()}
		</div>
	</div>
{/if}
