<script lang="ts">
	import { browser } from '$app/environment';
	import { getCurrentUser } from '$lib/stores/auth.svelte';
	import { fetchMyCertificates, type MyCertificate } from '$lib/api/progress';

	/**
	 * Daftar sertifikat milik sendiri dari backend (GET /api/v1/me/certificates).
	 * Hanya sertifikat yang benar-benar diterbitkan sistem yang tampil (K-05);
	 * tidak ada data contoh. State jujur: skeleton → error+retry / empty.
	 */

	const session = $derived(getCurrentUser());
	const holderName = $derived(session?.name.trim() || 'Peserta');

	let certificates = $state<MyCertificate[]>([]);
	let loading = $state(true);
	let loadError = $state('');
	let started = false;
	let loadSeq = 0;
	let copiedCode = $state<string | null>(null);

	async function load(): Promise<void> {
		const my = ++loadSeq;
		loading = true;
		loadError = '';
		try {
			const rows = await fetchMyCertificates();
			if (my !== loadSeq) return;
			certificates = [...rows].sort((a, b) => +new Date(b.issuedAt) - +new Date(a.issuedAt));
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

	function formatDate(iso: string | null): string {
		if (!iso) return '—';
		const d = new Date(iso);
		return Number.isNaN(d.getTime())
			? iso
			: d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
	}

	function isActive(cert: MyCertificate): boolean {
		return cert.status === 'issued';
	}

	async function copyCode(code: string): Promise<void> {
		try {
			await navigator.clipboard.writeText(code);
			copiedCode = code;
			setTimeout(() => {
				if (copiedCode === code) copiedCode = null;
			}, 2000);
		} catch {
			copiedCode = null;
		}
	}
</script>

<svelte:head>
	<title>Sertifikat — Aristoteles Platform</title>
	<meta name="description" content="Daftar sertifikat mikrokredensial milik Anda yang diterbitkan sistem." />
</svelte:head>

<div class="p-4 sm:p-6 lg:p-8">
	<div class="mb-6">
		<p class="text-xs font-bold tracking-widest text-blue-600 uppercase">Menu Utama · Sertifikat</p>
		<h1 class="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Sertifikat</h1>
		<p class="mt-1 text-sm text-slate-500">
			{certificates.length} sertifikat diterbitkan untuk Anda. Sertifikat terbit otomatis setelah
			seluruh syarat modul terpenuhi.
		</p>
	</div>

	<!-- Summary banner -->
	<div
		class="mb-6 flex flex-col gap-4 rounded-2xl bg-gradient-to-br from-amber-500 via-amber-600 to-orange-700 p-6 text-white sm:flex-row sm:items-center sm:justify-between"
	>
		<div class="flex items-center gap-4">
			<span class="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20">
				<i class="fa-solid fa-award text-xl" aria-hidden="true"></i>
			</span>
			<div>
				<p class="text-lg font-bold">{certificates.length} Sertifikat Diterbitkan</p>
				<p class="text-sm text-amber-100">Satu sertifikat per modul yang telah Anda tuntaskan.</p>
			</div>
		</div>
		<span
			class="inline-flex items-center justify-center gap-2 rounded-xl bg-white/60 px-5 py-2.5 text-xs font-bold text-amber-700/70"
			role="note"
		>
			<i class="fa-solid fa-shield-halved" aria-hidden="true"></i> Terverifikasi sistem
		</span>
	</div>

	{#if loading}
		<div class="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3" aria-label="Memuat sertifikat">
			{#each [1, 2, 3] as i (i)}
				<div class="animate-pulse overflow-hidden rounded-2xl border border-slate-200/70 bg-white">
					<div class="h-44 bg-slate-100"></div>
					<div class="space-y-2 p-5">
						<div class="h-4 rounded bg-slate-100"></div>
						<div class="h-4 w-2/3 rounded bg-slate-100"></div>
					</div>
				</div>
			{/each}
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
	{:else if certificates.length === 0}
		<div class="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
			<p class="text-sm font-bold text-slate-700">Belum ada sertifikat yang terbit</p>
			<p class="mx-auto mt-1 max-w-md text-xs text-slate-500">
				Sertifikat terbit otomatis per modul setelah seluruh materi wajib selesai serta kuis dan
				tugas wajib terpenuhi. Selesaikan kursus Anda untuk membuka sertifikasi.
			</p>
		</div>
	{:else}
		<div class="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
			{#each certificates as cert (cert.id)}
				{@const active = isActive(cert)}
				<article
					class="flex flex-col overflow-hidden rounded-2xl border border-slate-200/70 bg-white transition-shadow hover:shadow-xl"
				>
					<!-- Certificate preview -->
					<div class="relative bg-blue-900 p-6 text-center">
						<div
							class="pointer-events-none absolute inset-0 bg-gradient-to-br from-blue-600/30 via-transparent to-amber-500/20"
							aria-hidden="true"
						></div>
						<i class="fa-solid fa-award mb-2 text-4xl text-amber-400" aria-hidden="true"></i>
						<p class="text-[10px] font-bold tracking-widest text-slate-400 uppercase">Sertifikat Kelulusan</p>
						<h2 class="mt-1 text-lg font-extrabold text-white">{cert.moduleTitle}</h2>
						<p class="mt-0.5 text-xs text-slate-300">Diberikan kepada <strong class="text-white">{holderName}</strong></p>
						<div class="mt-3 inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-bold {active ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}">
							<i class="fa-solid {active ? 'fa-circle-check' : 'fa-ban'}" aria-hidden="true"></i>
							{active ? 'Aktif' : 'Dicabut'}
						</div>
					</div>

					<div class="flex flex-1 flex-col gap-3 p-5 text-sm">
						<dl class="space-y-2 text-[13px]">
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
										onclick={() => void copyCode(cert.code)}
										class="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600"
										aria-label={copiedCode === cert.code ? 'Kode tersalin' : 'Salin kode verifikasi'}
									>
										<i class="fa-solid {copiedCode === cert.code ? 'fa-check text-emerald-600' : 'fa-copy'}" aria-hidden="true"></i>
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

						<p class="text-[11px] text-slate-400">Simpan kode verifikasi ini sebagai bukti kelulusan modul.</p>
					</div>
				</article>
			{/each}
		</div>
	{/if}

	<!-- Empty / CTA -->
	<div class="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center sm:text-left">
		<div class="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
			<div class="flex items-center gap-3">
				<span class="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50">
					<i class="fa-solid fa-layer-group text-blue-600" aria-hidden="true"></i>
				</span>
				<div>
					<p class="text-sm font-bold text-slate-900">Ingin menambah sertifikat baru?</p>
					<p class="text-xs text-slate-500">Selesaikan kursus yang sedang berjalan untuk membuka sertifikasi.</p>
				</div>
			</div>
			<a
				href="/user/kursusku"
				class="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
			>
				Kembali ke Kursusku <i class="fa-solid fa-arrow-right text-[10px]" aria-hidden="true"></i>
			</a>
		</div>
	</div>
</div>
