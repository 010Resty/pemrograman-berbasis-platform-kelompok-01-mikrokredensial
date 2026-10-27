<script lang="ts">
	import { browser } from '$app/environment';
	import { page } from '$app/state';
	import RevokeDialog from '$lib/components/RevokeDialog.svelte';
	import { toast } from '$lib/stores/toast.svelte';
	import {
		fetchCertificateDetail as apiDetail,
		revokeCertificate as apiRevoke,
		publicVerifyHref,
		certificateStatusLabel,
		type CertificateRecord
	} from '$lib/api/certificates';
	import { mockCertificateDetail, mockRevoke } from '$lib/api/certificates.mock';

	/**
	 * Detail satu sertifikat: identitas snapshot, status terbaru, info
	 * pencabutan, tautan verifikasi publik, dan aksi cabut (aktif saja).
	 * Status hanya berubah setelah backend merespons sukses.
	 */

	const certId = $derived(decodeURIComponent(page.params.id ?? ''));
	const useMock = $derived(
		browser && import.meta.env.DEV && page.url.searchParams.get('mock') === 'sertifikat'
	);
	const mockSuffix = $derived(useMock ? '&mock=sertifikat' : '');

	type Phase = 'loading' | 'error' | 'ready';
	let phase = $state<Phase>('loading');
	let cert = $state<CertificateRecord | null>(null);
	let loadError = $state('');

	let showRevoke = $state(false);
	let revoking = $state(false);
	let revokeError = $state('');
	let copied = $state(false);

	async function load(): Promise<void> {
		phase = 'loading';
		loadError = '';
		try {
			cert = useMock ? await mockCertificateDetail(certId) : await apiDetail(certId);
			phase = 'ready';
		} catch (e) {
			loadError = e instanceof Error ? e.message : 'Gagal memuat detail sertifikat.';
			phase = 'error';
		}
	}

	$effect(() => {
		if (!browser) return;
		void load();
	});

	async function confirmRevoke(reason: string): Promise<void> {
		if (!cert || revoking) return;
		revoking = true;
		revokeError = '';
		try {
			cert = useMock ? await mockRevoke(cert.id, reason) : await apiRevoke(cert.id, reason);
			showRevoke = false;
			toast.success(`Sertifikat ${cert.code} dicabut dan tercatat di riwayat.`);
		} catch (e) {
			revokeError = e instanceof Error ? e.message : 'Pencabutan gagal.';
		} finally {
			revoking = false;
		}
	}

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

	function formatDateTime(iso: string | null): string {
		if (!iso) return '—';
		const d = new Date(iso);
		return Number.isNaN(d.getTime())
			? iso
			: d.toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
	}
</script>

<svelte:head>
	<title>Detail Sertifikat — Instruktur Aristoteles</title>
	<meta name="description" content="Detail sertifikat peserta beserta status dan riwayat pencabutan." />
</svelte:head>

<div class="p-4 sm:p-6 lg:p-8">
	<div class="mb-6">
		<a
			href="/instruktur/sertifikat?tab=riwayat{mockSuffix}"
			class="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600"
		>
			<i class="fa-solid fa-arrow-left" aria-hidden="true"></i> Kembali ke riwayat
		</a>
		<p class="mt-4 text-xs font-bold tracking-widest text-blue-600 uppercase">Menu Utama · Sertifikat · Detail</p>
		<h1 class="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Detail Sertifikat</h1>
	</div>

	{#if useMock}
		<p
			role="status"
			class="mb-4 flex items-start gap-2 rounded-xl border border-dashed border-amber-400 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-800"
		>
			<i class="fa-solid fa-triangle-exclamation mt-0.5 shrink-0" aria-hidden="true"></i>
			<span>Mode demo DEV — data ilustratif, bukan data produksi.</span>
		</p>
	{/if}

	{#if phase === 'loading'}
		<div class="animate-pulse rounded-2xl border border-slate-200 bg-white p-6" aria-label="Memuat detail">
			<div class="h-6 w-56 rounded bg-slate-100"></div>
			<div class="mt-4 space-y-2">
				{#each [1, 2, 3, 4, 5] as i (i)}
					<div class="h-4 rounded bg-slate-100"></div>
				{/each}
			</div>
		</div>
	{:else if phase === 'error'}
		<div role="alert" class="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
			<p class="text-sm font-bold text-red-700">Detail belum dapat dimuat</p>
			<p class="mx-auto mt-1 max-w-md text-xs text-red-600">{loadError}</p>
			<button
				type="button"
				onclick={() => void load()}
				class="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-red-600"
			>
				<i class="fa-solid fa-rotate-right" aria-hidden="true"></i> Coba lagi
			</button>
		</div>
	{:else if cert}
		<div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
			<div class="overflow-hidden rounded-2xl border border-slate-200/70 bg-white lg:col-span-2">
				<div class="relative bg-blue-900 p-6 text-center">
					<i class="fa-solid fa-award mb-2 text-4xl text-amber-400" aria-hidden="true"></i>
					<p class="text-[10px] font-bold tracking-widest text-slate-400 uppercase">Sertifikat Kelulusan</p>
					<h2 class="mt-1 text-lg font-extrabold text-white">{cert.courseTitle}</h2>
					<p class="mt-0.5 text-xs text-slate-300">
						Diberikan kepada <strong class="text-white">{cert.printedName}</strong>
					</p>
					<div
						class="mt-3 inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-bold {cert.status === 'aktif'
							? 'bg-emerald-500/20 text-emerald-300'
							: 'bg-red-500/20 text-red-300'}"
					>
						<i
							class="fa-solid {cert.status === 'aktif' ? 'fa-circle-check' : 'fa-ban'}"
							aria-hidden="true"
						></i>
						{certificateStatusLabel(cert.status)}
					</div>
				</div>
				<dl class="space-y-3 p-5 text-sm sm:p-6">
					<div class="flex justify-between gap-3 border-b border-slate-100 pb-3">
						<dt class="text-slate-500">Nama peserta</dt>
						<dd class="text-right font-semibold text-slate-800">{cert.studentName}</dd>
					</div>
					<div class="flex justify-between gap-3 border-b border-slate-100 pb-3">
						<dt class="text-slate-500">Nama tercetak</dt>
						<dd class="text-right font-semibold text-slate-800">{cert.printedName}</dd>
					</div>
					<p class="rounded-xl bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-slate-500">
						Nama tercetak adalah snapshot saat penerbitan. Perubahan profil peserta tidak mengubah
						sertifikat yang sudah terbit.
					</p>
					<div class="flex justify-between gap-3 border-b border-slate-100 pb-3">
						<dt class="text-slate-500">Modul</dt>
						<dd class="text-right font-semibold text-slate-800">{cert.moduleTitle}</dd>
					</div>
					<div class="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
						<dt class="text-slate-500">Kode sertifikat</dt>
						<dd class="flex items-center gap-2">
							<span class="font-mono text-xs font-bold text-slate-800">{cert.code}</span>
							<button
								type="button"
								onclick={() => void copyCode()}
								class="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600"
								aria-label={copied ? 'Kode tersalin' : 'Salin kode sertifikat'}
							>
								<i class="fa-solid {copied ? 'fa-check text-emerald-600' : 'fa-copy'}" aria-hidden="true"></i>
							</button>
						</dd>
					</div>
					<div class="flex justify-between gap-3 border-b border-slate-100 pb-3">
						<dt class="text-slate-500">Tanggal penerbitan</dt>
						<dd class="text-right font-semibold text-slate-800">{formatDateTime(cert.issuedAt)}</dd>
					</div>
					<div class="flex items-center justify-between gap-3">
						<dt class="text-slate-500">Verifikasi publik</dt>
						<dd>
							<a
								href={publicVerifyHref()}
								class="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-blue-600"
							>
								<i class="fa-solid fa-shield-halved" aria-hidden="true"></i> Buka halaman verifikasi
							</a>
						</dd>
					</div>
				</dl>
			</div>

			<div class="space-y-4">
				<div class="rounded-2xl border border-slate-200 bg-white p-5">
					<h2 class="text-sm font-extrabold text-slate-900">Status pencabutan</h2>
					{#if cert.status === 'dicabut'}
						<div role="status" class="mt-3 rounded-xl bg-red-50 px-4 py-3 text-xs text-red-700">
							<p class="flex items-center gap-1.5 font-bold">
								<i class="fa-solid fa-ban" aria-hidden="true"></i> Sertifikat ini dicabut
							</p>
							<p class="mt-1.5">Waktu: {formatDateTime(cert.revokedAt)}</p>
							<p class="mt-1">Alasan: {cert.revokeReason ?? '—'}</p>
						</div>
						<p class="mt-3 text-[11px] leading-relaxed text-slate-500">
							Catatan tetap tersimpan di riwayat dan tidak dapat dihapus dari UI ini.
						</p>
					{:else}
						<p class="mt-2 text-xs leading-relaxed text-slate-500">
							Sertifikat aktif. Pencabutan membutuhkan alasan tertulis dan dicatat permanen di
							riwayat.
						</p>
						<button
							type="button"
							onclick={() => {
								revokeError = '';
								showRevoke = true;
							}}
							class="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-red-600"
						>
							<i class="fa-solid fa-ban" aria-hidden="true"></i> Cabut sertifikat
						</button>
					{/if}
				</div>
			</div>
		</div>
	{/if}
</div>

{#if cert}
	<RevokeDialog
		bind:open={showRevoke}
		certCode={cert.code}
		loading={revoking}
		serverError={revokeError}
		onconfirm={(reason) => void confirmRevoke(reason)}
	/>
{/if}
