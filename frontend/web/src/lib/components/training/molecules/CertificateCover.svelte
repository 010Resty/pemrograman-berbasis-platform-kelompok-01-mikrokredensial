<script lang="ts">
	import { aristotelesLogo } from '$lib/assets/logo';
	import medaliEmas from '$lib/assets/medali emas.png';
	import medaliPerak from '$lib/assets/medali-perak.png';
	import { getApiBase } from '$lib/api/backend';

	/**
	 * Fasimil visual sertifikat — cerminan PDF asli (bingkai navy, logo +
	 * nama kiri atas, chip kode, penerima, uraian kelulusan, tanda tangan +
	 * nama kiri bawah, pita kanan "SERTIFIKAT KOMPETENSI" berisi medali
	 * emas (kursus) / perak (modul), QR + kode verifikasi kanan bawah).
	 * Dipakai sebagai sampul kartu peserta + tampilan hasil verifikasi.
	 * Ukuran diskala via `em` dari font root (card vs full).
	 * Bila `href` diisi → sampul menjadi tautan (navigasi); bila `onview`
	 * diisi → menjadi tombol (mis. buka lightbox). Keduanya opsional.
	 */
	let {
		code,
		recipientName,
		courseTitle,
		moduleTitle,
		issuedLabel,
		instructorName,
		signatureUrl = null,
		status = 'issued',
		size = 'card',
		href = null,
		onview = null
	}: {
		code: string;
		recipientName: string;
		courseTitle: string;
		moduleTitle: string | null;
		issuedLabel: string;
		instructorName: string | null;
		/** URL gambar tanda tangan instruktur utama (null = hanya nama diketik). */
		signatureUrl?: string | null;
		status?: 'issued' | 'revoked' | 'superseded';
		size?: 'card' | 'full';
		href?: string | null;
		onview?: (() => void) | null;
	} = $props();

	const isCourse = $derived(moduleTitle === null);
	const level = $derived(isCourse ? 'KURSUS' : 'MODUL');
	const title = $derived(moduleTitle ?? courseTitle);
	const atasLine = $derived(
		isCourse ? 'Atas kelulusannya pada kursus:' : 'Atas kelulusannya pada modul:'
	);
	const descLine = $derived(
		isCourse
			? 'serta telah memenuhi seluruh persyaratan penyelesaian kursus yang ditetapkan.'
			: `Dalam program kursus ${courseTitle}, serta telah memenuhi seluruh persyaratan penyelesaian modul yang ditetapkan.`
	);
	const qrSrc = $derived(
		`${getApiBase()}/certificates/verify/${encodeURIComponent(code)}/qr`
	);
	const interactive = $derived(href !== null || onview !== null);
	const rootClass = $derived(
		`relative block aspect-[1.414/1] w-full overflow-hidden rounded-lg bg-white ${size === 'full' ? 'text-[15px] sm:text-base' : 'text-[8.5px]'}`
	);
	const interactiveClass = $derived(
		interactive
			? ' cursor-zoom-in transition-shadow hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600'
			: ''
	);
	const viewLabel = $derived(`Lihat sertifikat kelulusan ${level.toLowerCase()} untuk ${recipientName}, kode ${code}`);
	let qrFailed = $state(false);
	// Buka kunci fallback saat kode berubah (kegagalan lama tak boleh
	// mengunci selamanya meski backend sudah pulih).
	$effect(() => {
		qrSrc;
		qrFailed = false;
	});
</script>

{#snippet body()}
	<!-- Latar navy + kartu putih + garis tipis dalam -->
	<div class="absolute inset-0 bg-[#1a2746]"></div>
	<div class="absolute bg-white" style="inset: 0.55em;"></div>
	<div class="absolute border border-[#1e3a8a]" style="inset: 0.75em;"></div>

	<!-- Pita kanan: judul + medali emas (kursus) / perak (modul) -->
	<div
		class="absolute flex flex-col items-center bg-[#1e3a8a]"
		style="top: 0.55em; right: 1.1em; width: 9em; height: 62%; clip-path: polygon(0 0, 100% 0, 100% 88%, 50% 100%, 0 88%);"
	>
		<p class="mt-[1.6em] text-[0.85em] font-extrabold tracking-wide text-white">SERTIFIKAT</p>
		<p class="text-[0.85em] font-extrabold tracking-wide text-white">KOMPETENSI</p>
		<img
			src={isCourse ? medaliEmas : medaliPerak}
			alt={isCourse ? 'Medali emas' : 'Medali perak'}
			loading="lazy"
			class="mt-[0.9em] h-auto w-[7.5em] object-contain drop-shadow-sm"
		/>
	</div>

	<div class="relative flex h-full flex-col px-[1.6em] py-[1.1em]">
		<div style="padding-right: 10.5em;">
			<div class="flex items-center gap-[0.7em]">
				<img src={aristotelesLogo} alt="" class="h-[2.8em] w-auto object-contain" />
				<p class="text-[1.3em] font-extrabold tracking-wide text-[#1e3a8a]">ARISTOTELES</p>
			</div>

			<p
				class="mt-[1.4em] inline-flex w-fit items-center rounded-[0.3em] bg-[#1e3a8a] px-[0.9em] py-[0.35em] font-mono text-[0.75em] font-bold text-white"
			>
				{code}
			</p>

			<p class="mt-[1em] text-[0.68em] text-black">Diberikan kepada</p>
			<p
				class="max-w-full truncate text-[1.45em] font-extrabold text-black"
				title={recipientName}
			>
				{recipientName}
			</p>
			<p class="mt-[0.9em] text-[0.68em] text-black">{atasLine}</p>
			<p class="max-w-full truncate text-[0.95em] font-bold text-black" title={title}>
				{title}
			</p>
			<p
				class="mt-[0.5em] line-clamp-2 max-w-full text-[0.64em] leading-relaxed text-black"
				title={descLine}
			>
				{descLine}
			</p>
		</div>

		<div class="mt-auto flex w-full items-end justify-between gap-[1em]">
			<div class="min-w-0">
				{#if signatureUrl}
					<img
						src={signatureUrl}
						alt={`Tanda tangan ${instructorName ?? 'instruktur'}`}
						loading="lazy"
						class="mb-[0.3em] h-[2.4em] w-auto max-w-[11em] object-contain"
					/>
				{/if}
				<p
					class="max-w-[14em] truncate text-[0.78em] font-bold text-slate-700"
					title={instructorName ?? 'Instruktur Utama'}
				>
					{instructorName ?? 'Instruktur Utama'}
				</p>
				<p class="text-[0.64em] text-slate-400">Instruktur Utama</p>
				<p class="mt-[0.4em] text-[0.68em] text-slate-500">{issuedLabel}</p>
			</div>
			<div class="flex shrink-0 flex-col items-center" style="margin-right: 0.4em;">
				{#if !qrFailed}
					<img
						src={qrSrc}
						alt={`QR verifikasi ${code}`}
						loading="lazy"
						onerror={() => (qrFailed = true)}
						class={size === 'full' ? 'h-[6em] w-[6em]' : 'h-[2.8em] w-[2.8em]'}
					/>
				{:else}
					<span
						class="flex items-center justify-center rounded-[0.3em] border border-dashed border-slate-400 bg-slate-50 text-center font-mono text-slate-500 {size === 'full' ? 'h-[6em] w-[6em] text-[0.5em]' : 'h-[2.8em] w-[2.8em] text-[0.4em]'}"
						title={`QR gagal dimuat — gunakan kode ${code}`}
					>
						{code}
					</span>
				{/if}
				<p class="mt-[0.3em] text-[0.62em] font-bold text-slate-700">Verifikasi Sertifikat</p>
				<p class="font-mono text-[0.62em] text-slate-500">{code}</p>
			</div>
		</div>
	</div>

	<!-- Cap status -->
	{#if status !== 'issued'}
		<div class="absolute inset-0 flex items-center justify-center" aria-hidden="true">
			<span
				class=" -rotate-12 rounded border-[0.25em] px-[0.8em] py-[0.3em] text-[1.6em] font-black tracking-[0.2em] {status === 'revoked'
					? 'border-red-600/80 text-red-600/80'
					: 'border-blue-600/80 text-blue-600/80'}"
			>
				{status === 'revoked' ? 'DICABUT' : 'DIGANTIKAN'}
			</span>
		</div>
	{/if}
{/snippet}

{#if href !== null}
	<a
		href={href}
		aria-label={viewLabel}
		onclick={() => (qrFailed = false)}
		class={rootClass + interactiveClass}
	>
		{@render body()}
	</a>
{:else if onview !== null}
	<button
		type="button"
		onclick={() => {
			qrFailed = false;
			onview?.();
		}}
		aria-label={viewLabel}
		class={rootClass + interactiveClass}
	>
		{@render body()}
	</button>
{:else}
	<div role="img" aria-label={viewLabel} class={rootClass}>
		{@render body()}
	</div>
{/if}
