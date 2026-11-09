<script lang="ts">
	import { aristotelesLogo } from '$lib/assets/logo';
	import { getApiBase } from '$lib/api/backend';

	/**
	 * Fasimil visual sertifikat — cerminan PDF asli (bingkai ganda navy/emas,
	 * logo Aristoteles tengah, subjudul Inggris, penerima, uraian penyelesaian,
	 * tanggal + kode, blok tanda tangan tengah + QR asli dari backend).
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
		status?: 'issued' | 'revoked' | 'superseded';
		size?: 'card' | 'full';
		href?: string | null;
		onview?: (() => void) | null;
	} = $props();

	const isCourse = $derived(moduleTitle === null);
	const level = $derived(isCourse ? 'KURSUS' : 'MODUL');
	const levelEn = $derived(isCourse ? 'COURSE' : 'MODULE');
	const title = $derived(moduleTitle ?? courseTitle);
	const atasLine = $derived(
		isCourse
			? 'Atas keberhasilannya menyelesaikan kursus:'
			: 'Atas keberhasilannya menyelesaikan modul pembelajaran:'
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
	<!-- Bingkai ganda -->
	<div class="absolute inset-0 border-[0.35em] border-[#1e3a8a]"></div>
	<div class="absolute inset-[0.55em] border border-[#b47814]"></div>

	<div class="relative flex h-full flex-col items-center px-[2.4em] py-[1.1em] text-center">
		<img src={aristotelesLogo} alt="" class="h-[2.1em] w-auto object-contain" />

		<p class="mt-[0.6em] text-[1em] font-extrabold tracking-[0.14em] text-[#1e3a8a]">
			SERTIFIKAT KELULUSAN {level}
		</p>
		<p class="text-[0.64em] text-slate-500 italic">CERTIFICATE OF {levelEn} COMPLETION</p>

		<p class="mt-[0.7em] text-[0.68em] text-slate-500">Diberikan kepada</p>
		<p class="max-w-full truncate px-[0.5em] text-[1.45em] font-extrabold text-[#1e3a8a]" title={recipientName}>
			{recipientName}
		</p>
		<p class="mt-[0.5em] text-[0.68em] text-slate-500">{atasLine}</p>
		<p class="max-w-full truncate px-[1em] text-[0.9em] font-bold text-slate-800" title={title}>
			{title}
		</p>
		<p class="mt-[0.3em] line-clamp-2 max-w-full px-[1.5em] text-[0.64em] leading-snug text-slate-500" title={descLine}>
			{descLine}
		</p>

		<p class="mt-[0.5em] text-[0.68em] text-slate-500">
			Tanggal Penerbitan: <span class="font-semibold text-slate-700">{issuedLabel}</span>
			<span class="mx-[0.5em]" aria-hidden="true">·</span>
			Kode Sertifikat: <span class="font-mono font-bold text-slate-700">{code}</span>
		</p>

		<div class="mt-auto flex w-full items-end justify-center gap-[1.2em]">
			<div class="text-center">
				<p class="max-w-[14em] truncate text-[0.78em] font-bold text-slate-700" title={instructorName ?? 'Instruktur Utama'}>
					{instructorName ?? 'Instruktur Utama'}
				</p>
				<p class="text-[0.64em] text-slate-400">Instruktur Utama</p>
			</div>
			{#if !qrFailed}
				<img
					src={qrSrc}
					alt={`QR verifikasi ${code}`}
					loading="lazy"
					onerror={() => (qrFailed = true)}
					class={size === 'full' ? 'h-[8em] w-[8em]' : 'h-[2.8em] w-[2.8em]'}
				/>
			{:else}
				<span
					class="flex items-center justify-center rounded-[0.3em] border border-dashed border-slate-400 bg-slate-50 text-center font-mono text-slate-500 {size === 'full' ? 'h-[8em] w-[8em] text-[0.7em]' : 'h-[2.8em] w-[2.8em] text-[0.5em]'}"
					title={`QR gagal dimuat — gunakan kode ${code}`}
				>
					{code}
				</span>
			{/if}
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
