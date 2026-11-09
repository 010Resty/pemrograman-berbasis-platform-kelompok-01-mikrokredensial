<script lang="ts">
	import { browser } from '$app/environment';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import CertificateCover from '$lib/components/training/molecules/CertificateCover.svelte';
	import { downloadMyCertificatePdf, fetchMyCertificates, type MyCertificate } from '$lib/api/progress';

	/**
	 * Detail satu sertifikat milik sendiri: fasimil besar + data + unduh PDF.
	 * Sumber data = daftar milik sendiri (tanpa endpoint baru); id yang tak
	 * ada di daftar (milik orang lain / disupersede) → status tidak ditemukan.
	 */

	const certId = $derived(Number(page.params.id));

	let cert = $state<MyCertificate | null>(null);
	let loading = $state(true);
	let loadError = $state('');
	let notFound = $state(false);
	let started = false;
	let loadSeq = 0;

	let copied = $state(false);
	let downloading = $state(false);
	let downloadError = $state('');

	function formatDate(iso: string | null): string {
		if (!iso) return '—';
		const d = new Date(iso);
		return Number.isNaN(d.getTime())
			? iso
			: d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
	}

	const isCourse = $derived(cert !== null && cert.moduleTitle === null);
	const active = $derived(cert !== null && cert.status === 'issued');

	async function load(): Promise<void> {
		const my = ++loadSeq;
		loading = true;
		loadError = '';
		notFound = false;
		if (!Number.isInteger(certId) || certId <= 0) {
			notFound = true;
			loading = false;
			return;
		}
		try {
			const rows = await fetchMyCertificates();
			if (my !== loadSeq) return;
			cert = rows.find((c) => c.id === certId) ?? null;
			if (!cert) notFound = true;
		} catch (e) {
			if (my !== loadSeq) return;
			loadError = e instanceof Error ? e.message : 'Gagal memuat sertifikat.';
		} finally {
			if (my === loadSeq) loading = false;
		}
	}

	$effect(() => {
		if (!browser || started) return;
		started = true;
		void load();
	});

	async function copyCode(): Promise<void> {
		if (!cert) return;
		try {
			await navigator.clipboard.writeText(cert.code);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch {
			copied = false;
		}
	}

	async function downloadPdf(): Promise<void> {
		if (!cert || downloading) return;
		downloading = true;
		downloadError = '';
		try {
			const { blob, filename } = await downloadMyCertificatePdf(cert.id);
			const url = URL.createObjectURL(blob);
			try {
				const a = document.createElement('a');
				a.href = url;
				a.download = filename;
				document.body.appendChild(a);
				a.click();
				a.remove();
			} finally {
				URL.revokeObjectURL(url);
			}
		} catch (e) {
			downloadError = e instanceof Error ? e.message : 'Gagal mengunduh sertifikat.';
		} finally {
			downloading = false;
		}
	}
</script>

<svelte:head>
	<title>{cert ? `${cert.moduleTitle ?? cert.courseTitle} — Sertifikat` : 'Sertifikat'} — Aristoteles Platform</title>
	<meta name="description" content="Detail sertifikat kelulusan milik Anda." />
</svelte:head>

<div class="page-wrap page-stack">
	<a
		href={resolve('/user/sertifikat')}
		class="inline-flex min-h-10 items-center gap-2 self-start rounded-xl px-3 py-2 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-blue-600"
	>
		<i class="fa-solid fa-arrow-left" aria-hidden="true"></i> Kembali ke Sertifikat
	</a>

	{#if loading}
		<div class="animate-pulse overflow-hidden rounded-2xl border border-slate-200/70 bg-white" aria-label="Memuat sertifikat">
			<div class="h-64 bg-slate-100"></div>
			<div class="space-y-2 p-5">
				<div class="h-4 rounded bg-slate-100"></div>
				<div class="h-4 w-2/3 rounded bg-slate-100"></div>
			</div>
		</div>
	{:else if loadError}
		<div role="alert" class="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
			<p class="text-sm font-bold text-red-700">Sertifikat belum dapat dimuat</p>
			<p class="mx-auto mt-1 max-w-md text-xs text-red-600">{loadError}</p>
			<button
				type="button"
				onclick={() => void load()}
				class="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-red-600"
			>
				<i class="fa-solid fa-rotate-right" aria-hidden="true"></i> Coba lagi
			</button>
		</div>
	{:else if notFound || !cert}
		<div class="rounded-2xl border border-slate-200 bg-white p-10 text-center">
			<i class="fa-solid fa-triangle-exclamation mb-3 text-3xl text-amber-500" aria-hidden="true"></i>
			<h1 class="text-xl font-bold text-slate-900">Sertifikat tidak ditemukan</h1>
			<p class="mt-1 text-sm text-slate-500">
				Mungkin milik akun lain atau sudah digantikan sertifikat kursus.
			</p>
			<a
				href={resolve('/user/sertifikat')}
				class="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-blue-700"
			>
				<i class="fa-solid fa-arrow-left" aria-hidden="true"></i> Kembali ke Sertifikat
			</a>
		</div>
	{:else}
		<div class="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
			<div class="overflow-hidden rounded-2xl border border-slate-200/70 bg-slate-100 p-4 sm:p-6">
				<CertificateCover
					code={cert.code}
					recipientName={cert.recipientName}
					courseTitle={cert.courseTitle}
					moduleTitle={cert.moduleTitle}
					issuedLabel={formatDate(cert.issuedAt)}
					instructorName={cert.instructorName ?? null}
					status={active ? 'issued' : 'revoked'}
					size="full"
				/>
			</div>

			<aside aria-label="Rincian sertifikat" class="rounded-2xl border border-slate-200/70 bg-white p-5">
				<p class="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
					Sertifikat Kelulusan {isCourse ? 'Kursus' : 'Modul'}
				</p>
				<h1 class="mt-1 text-xl font-extrabold text-slate-900">
					{cert.moduleTitle ?? cert.courseTitle}
				</h1>
				<div
					class="mt-2 inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-bold {active
						? 'bg-emerald-100 text-emerald-700'
						: 'bg-red-100 text-red-700'}"
				>
					<i class="fa-solid {active ? 'fa-circle-check' : 'fa-ban'}" aria-hidden="true"></i>
					{active ? 'Aktif' : 'Dicabut'}
				</div>

				<dl class="mt-4 space-y-2 text-[13px]">
					<div class="flex justify-between gap-2">
						<dt class="text-slate-500">Kursus</dt>
						<dd class="text-right font-semibold text-slate-800">{cert.courseTitle}</dd>
					</div>
					<div class="flex justify-between gap-2">
						<dt class="text-slate-500">Tanggal Terbit</dt>
						<dd class="font-semibold text-slate-800">{formatDate(cert.issuedAt)}</dd>
					</div>
					<div class="flex items-center justify-between gap-2">
						<dt class="text-slate-500">Kode Verifikasi</dt>
						<dd class="flex items-center gap-2">
							<span class="font-mono text-xs font-bold text-slate-800">{cert.code}</span>
							<button
								type="button"
								onclick={() => void copyCode()}
								class="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600"
								aria-label={copied ? 'Kode tersalin' : 'Salin kode verifikasi'}
							>
								<i class="fa-solid {copied ? 'fa-check text-emerald-600' : 'fa-copy'}" aria-hidden="true"></i>
							</button>
						</dd>
					</div>
					{#if !active}
						<div class="flex justify-between gap-2">
							<dt class="text-slate-500">Status</dt>
							<dd class="text-right font-semibold text-red-600">
								Dicabut{#if cert.revokeReason} — {cert.revokeReason}{/if}
							</dd>
						</div>
					{/if}
				</dl>

				{#if active}
					<button
						type="button"
						onclick={() => void downloadPdf()}
						disabled={downloading}
						class="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-70"
					>
						{#if downloading}
							<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i> Mengunduh…
						{:else}
							<i class="fa-solid fa-file-arrow-down" aria-hidden="true"></i> Unduh PDF
						{/if}
					</button>
				{/if}
				{#if downloadError}
					<p role="alert" class="mt-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-semibold text-red-700">
						{downloadError}
					</p>
				{/if}
				<a
					href="/verifikasi?code={encodeURIComponent(cert.code)}"
					class="mt-2 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 py-2.5 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600"
				>
					<i class="fa-solid fa-shield-halved" aria-hidden="true"></i> Cek keaslian publik
				</a>
			</aside>
		</div>
	{/if}
</div>
