<script lang="ts">
	import { browser } from '$app/environment';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import Pagination from '$lib/components/Pagination.svelte';
	import {
		downloadProofFile,
		fetchAdminPayments,
		verifyPayment,
		type AdminPaymentRow,
		type PaymentStatus
	} from '$lib/api/payments';

	const filters: { value: PaymentStatus | 'all'; label: string }[] = [
		{ value: 'menunggu', label: 'Menunggu' },
		{ value: 'diverifikasi', label: 'Diverifikasi' },
		{ value: 'ditolak', label: 'Ditolak' },
		{ value: 'all', label: 'Semua' }
	];

	let activeFilter = $state<PaymentStatus | 'all'>('menunggu');
	let items = $state<AdminPaymentRow[]>([]);
	let total = $state(0);
	let page = $state(1);
	let perPage = $state(10);
	let loading = $state(true);
	let loadError = $state('');
	let started = false;
	let loadSeq = 0;

	let verifyId = $state<number | null>(null);
	let verifyReason = $state('');
	let verifyDecision = $state<'terima' | 'tolak'>('terima');
	let verifyBusy = $state(false);
	let verifyError = $state('');

	async function load(): Promise<void> {
		const my = ++loadSeq;
		loading = true;
		loadError = '';
		try {
			const res = await fetchAdminPayments({
				status: activeFilter === 'all' ? undefined : activeFilter,
				limit: perPage,
				page
			});
			if (my !== loadSeq) return;
			items = res.items;
			total = res.total;
		} catch (e) {
			if (my !== loadSeq) return;
			loadError = e instanceof Error ? e.message : 'Gagal memuat antrean pembayaran.';
		} finally {
			if (my === loadSeq) loading = false;
		}
	}

	$effect(() => {
		if (!browser || started) return;
		started = true;
		void load();
	});

	function setFilter(f: PaymentStatus | 'all'): void {
		activeFilter = f;
		page = 1;
		void load();
	}

	$effect(() => {
		if (!browser || !started) return;
		page;
		perPage;
		void load();
	});

	// Pratinjau bukti bayar: berkas privat (pemilik + admin) sehingga tidak bisa
	// dibuka via tautan langsung (tanpa header Authorization = 403).
	// Diunduh dengan token lalu ditampilkan sebagai object URL, per baris.
	let proofUrls = $state<Record<number, string>>({});
	let proofLoadingId = $state<number | null>(null);
	let proofErrorById = $state<Record<number, string>>({});
	let expandedProof = $state<Record<number, boolean>>({});

	async function loadProof(row: AdminPaymentRow): Promise<void> {
		if (proofUrls[row.id]) return;
		// Pengaman bila API mengembalikan baris tanpa bukti (normalnya sudah
		// disaring server): jangan fetch, tampilkan pesan saja.
		if (!row.proofFileId) {
			proofErrorById = { ...proofErrorById, [row.id]: 'Belum ada bukti bayar dari peserta.' };
			return;
		}
		proofLoadingId = row.id;
		proofErrorById = { ...proofErrorById, [row.id]: '' };
		try {
			const blob = await downloadProofFile(row.proofFileId);
			proofUrls = { ...proofUrls, [row.id]: URL.createObjectURL(blob) };
		} catch (e) {
			proofErrorById = {
				...proofErrorById,
				[row.id]: e instanceof Error ? e.message : 'Gagal memuat bukti.'
			};
		} finally {
			if (proofLoadingId === row.id) proofLoadingId = null;
		}
	}

	function toggleProof(row: AdminPaymentRow): void {
		expandedProof = { ...expandedProof, [row.id]: !expandedProof[row.id] };
		if (expandedProof[row.id]) void loadProof(row);
	}

	function openVerify(row: AdminPaymentRow): void {
		verifyId = row.id;
		verifyReason = '';
		verifyDecision = 'terima';
		verifyError = '';
		void loadProof(row);
	}

	function closeVerify(): void {
		if (verifyBusy) return;
		verifyId = null;
		verifyReason = '';
		verifyError = '';
	}

	async function submitVerify(): Promise<void> {
		if (verifyId === null || verifyBusy) return;
		verifyError = '';
		if (verifyDecision === 'tolak' && !verifyReason.trim()) {
			verifyError = 'Alasan penolakan wajib diisi.';
			return;
		}
		// Terima = dianggap lunas persis sebesar tagihan. Backend tetap butuh
		// amountPaid (tolak bila < tagihan), jadi kirim amountExpected langsung.
		const row = items.find((i) => i.id === verifyId);
		if (!row) {
			verifyError = 'Data pembayaran tidak ditemukan. Muat ulang antrean.';
			return;
		}
		verifyBusy = true;
		try {
			await verifyPayment(verifyId, {
				decision: verifyDecision,
				...(verifyDecision === 'terima'
					? { amountPaid: row.amountExpected }
					: { reason: verifyReason.trim() })
			});
			closeVerify();
			window.dispatchEvent(new CustomEvent('admin:notif-refresh'));
			await load();
		} catch (e) {
			verifyError = e instanceof Error ? e.message : 'Verifikasi gagal. Coba lagi.';
		} finally {
			verifyBusy = false;
		}
	}

	function formatIDR(n: number): string {
		return `Rp ${Number(n || 0).toLocaleString('id-ID')}`;
	}

	function statusBadge(s: PaymentStatus): string {
		if (s === 'diverifikasi') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
		if (s === 'ditolak') return 'border-red-200 bg-red-50 text-red-700';
		return 'border-amber-200 bg-amber-50 text-amber-700';
	}

	function statusLabel(s: PaymentStatus): string {
		if (s === 'diverifikasi') return 'Diverifikasi';
		if (s === 'ditolak') return 'Ditolak';
		return 'Menunggu';
	}
</script>

<svelte:head>
	<title>Monitor Pembayaran — Admin ARISTOTELES</title>
	<meta name="description" content="Pantau pembayaran QRIS dinamis DOKU (otomatis) + antrean manual lawas." />
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="page-wrap page-stack">
	<PageHeader
		eyebrow="Admin · Pembayaran"
		title="Monitor Pembayaran"
		description="QRIS dinamis DOKU diverifikasi otomatis via webhook. Verifikasi manual hanya untuk antrean manual lawas (bila masih ada)."
	/>

	<div class="flex flex-wrap gap-2" role="group" aria-label="Filter status pembayaran">
		{#each filters as f (f.value)}
			<button
				type="button"
				onclick={() => setFilter(f.value)}
				aria-pressed={activeFilter === f.value}
				class={`rounded-xl px-4 py-2 text-xs font-bold transition-colors focus-visible:outline-2 focus-visible:outline-blue-600 ${
					activeFilter === f.value
						? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
						: 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
				}`}
			>
				{f.label}
			</button>
		{/each}
	</div>

	{#if loading}
		<div class="grid grid-cols-1 gap-5 md:grid-cols-2" aria-label="Memuat antrean">
			{#each [1, 2, 3, 4] as i (i)}
				<div class="animate-pulse rounded-2xl border border-slate-200/60 bg-white p-5">
					<div class="h-4 w-32 rounded bg-slate-100"></div>
					<div class="mt-2 h-6 w-48 rounded bg-slate-100"></div>
				</div>
			{/each}
		</div>
	{:else if loadError}
		<div role="alert" class="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
			<p class="text-sm font-bold text-red-700">Antrean belum dapat dimuat</p>
			<p class="mx-auto mt-1 max-w-md text-xs text-red-600">{loadError}</p>
			<button
				type="button"
				onclick={() => void load()}
				class="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-red-600"
			>
				<i class="fa-solid fa-rotate-right" aria-hidden="true"></i> Coba lagi
			</button>
		</div>
	{:else if items.length === 0}
		<div class="rounded-2xl border border-slate-200/60 bg-white">
			<EmptyState
				icon="fa-money-bill-transfer"
				title={activeFilter === 'menunggu' ? 'Tidak ada antrean menunggu' : 'Tidak ada pembayaran pada filter ini'}
				description="Pembayaran DOKU masuk otomatis setelah peserta memindai QR; antrean manual lawas muncul di sini untuk diverifikasi."
			/>
		</div>
	{:else}
		<ol class="grid grid-cols-1 gap-4 md:grid-cols-2" aria-label="Daftar pengajuan pembayaran">
			{#each items as p (p.id)}
				<li class="flex flex-col rounded-2xl border border-slate-200/70 bg-white p-5">
					<div class="flex items-start justify-between gap-3">
						<div class="min-w-0">
							<p class="font-mono text-xs font-bold text-slate-500">{p.invoice}</p>
							<p class="mt-0.5 truncate text-sm font-bold text-slate-900">{p.courseTitle ?? `Kursus #${p.courseId}`}</p>
							<p class="mt-0.5 truncate text-xs text-slate-500">{p.userName} · {p.userEmail}</p>
						</div>
						<span class={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${statusBadge(p.status)}`}>
							<span class="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true"></span>{statusLabel(p.status)}
						</span>
					</div>
					<p class="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
						<span class={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-bold ${p.gateway === 'doku' ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-500'}`}>
							<i class="fa-solid fa-qrcode" aria-hidden="true"></i> {p.gateway === 'doku' ? 'DOKU dinamis' : 'Manual lawas'}
						</span>
						{#if p.gateway === 'doku' && p.dokuReferenceId}
							<span class="font-mono text-slate-400">{p.dokuReferenceId}</span>
						{/if}
					</p>
					<dl class="mt-3 space-y-1 text-xs">
						<div class="flex justify-between gap-3">
							<dt class="text-slate-500">Tagihan</dt>
							<dd class="font-bold text-slate-800">{formatIDR(p.amountExpected)}</dd>
						</div>
						{#if p.voucherCode}
							<div class="flex justify-between gap-3 text-emerald-700">
								<dt>Voucher {p.voucherCode}</dt>
								<dd class="font-bold">−{formatIDR(p.discountAmount)}</dd>
							</div>
						{:else if p.promoSlug}
							<div class="flex justify-between gap-3 text-red-700">
								<dt>Promo {p.promoSlug}</dt>
								<dd class="font-bold">−{formatIDR(p.discountAmount)}</dd>
							</div>
						{/if}
						{#if p.amountPaid !== null}
							<div class="flex justify-between gap-3">
								<dt class="text-slate-500">Diterima</dt>
								<dd class="font-bold text-slate-800">{formatIDR(p.amountPaid)}</dd>
							</div>
						{/if}
						{#if p.rejectReason}
							<div class="rounded-lg bg-red-50 px-3 py-2 text-[11px] font-semibold text-red-700">
								Alasan tolak: {p.rejectReason}
							</div>
						{/if}
					</dl>
					<div class="mt-3 flex flex-wrap gap-2">
						{#if p.proofFileId}
							<button
								type="button"
								onclick={() => toggleProof(p)}
								aria-expanded={Boolean(expandedProof[p.id])}
								class="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600"
							>
								<i class="fa-solid fa-receipt" aria-hidden="true"></i>
								{expandedProof[p.id] ? 'Sembunyikan bukti' : 'Lihat bukti'}
							</button>
						{/if}
						{#if p.status === 'menunggu' && p.gateway !== 'doku'}
							<button
								type="button"
								onclick={() => openVerify(p)}
								class="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
							>
								<i class="fa-solid fa-check-double" aria-hidden="true"></i> Verifikasi
							</button>
						{:else if p.status === 'menunggu' && p.gateway === 'doku'}
							<p class="flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-violet-50 px-3 py-2 text-center text-[11px] font-bold text-violet-700">
								<i class="fa-solid fa-bolt" aria-hidden="true"></i> Otomatis via webhook DOKU
							</p>
						{/if}
					</div>
					{#if expandedProof[p.id]}
						<div class="mt-3 overflow-hidden rounded-xl border border-slate-200">
							{#if proofUrls[p.id]}
								<img
									src={proofUrls[p.id]}
									alt={`Bukti bayar ${p.invoice}`}
									class="max-h-80 w-full bg-slate-50 object-contain"
								/>
							{:else if proofLoadingId === p.id}
								<p class="flex items-center justify-center gap-2 p-6 text-xs font-semibold text-slate-500">
									<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i> Memuat bukti…
								</p>
							{:else if proofErrorById[p.id]}
								<div class="p-4 text-center">
									<p role="alert" class="text-xs font-semibold text-red-600">{proofErrorById[p.id]}</p>
									<button
										type="button"
										onclick={() => void loadProof(p)}
										class="mt-2 inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-4 text-xs font-bold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600"
									>
										<i class="fa-solid fa-rotate-right" aria-hidden="true"></i> Coba lagi
									</button>
								</div>
							{/if}
						</div>
					{/if}
				</li>
			{/each}
		</ol>
		<div class="overflow-hidden rounded-2xl border border-slate-200/70 bg-white">
			<Pagination bind:page bind:perPage totalItems={total} itemLabel="pengajuan" label="Navigasi halaman tabel pembayaran" id="payment-pagination" activeClass="bg-blue-600 text-white shadow-lg shadow-blue-600/25" />
		</div>
	{/if}
</div>

{#if verifyId !== null}
	{@const row = items.find((i) => i.id === verifyId)}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
		role="dialog"
		aria-modal="true"
		aria-labelledby="verify-title"
	>
		<div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
			<h2 id="verify-title" class="text-base font-extrabold text-slate-900">Verifikasi pembayaran</h2>
			<p class="mt-1 font-mono text-xs text-slate-500">{row?.invoice ?? ''} · {row ? formatIDR(row.amountExpected) : ''}</p>
			{#if row?.proofFileId}
				<div class="mt-3 overflow-hidden rounded-xl border border-slate-200">
					{#if row && proofUrls[row.id]}
						<img
							src={proofUrls[row.id]}
							alt={`Bukti bayar ${row.invoice}`}
							class="max-h-64 w-full bg-slate-50 object-contain"
						/>
					{:else if row && proofLoadingId === row.id}
						<p class="flex items-center justify-center gap-2 p-6 text-xs font-semibold text-slate-500">
							<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i> Memuat bukti…
						</p>
					{:else if row?.id !== undefined && proofErrorById[row.id]}
						<div class="p-4 text-center">
							<p role="alert" class="text-xs font-semibold text-red-600">{proofErrorById[row.id]}</p>
							<button
								type="button"
								onclick={() => row && void loadProof(row)}
								class="mt-2 inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-4 text-xs font-bold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600"
							>
								<i class="fa-solid fa-rotate-right" aria-hidden="true"></i> Coba lagi
							</button>
						</div>
					{/if}
				</div>
			{:else}
				<p class="mt-3 rounded-xl bg-slate-100 px-4 py-3 text-center text-xs font-bold text-slate-400">
					Belum ada bukti bayar dari peserta.
				</p>
			{/if}
			<div class="mt-4 grid grid-cols-2 gap-2" role="group" aria-label="Keputusan verifikasi">
				<button
					type="button"
					onclick={() => (verifyDecision = 'terima')}
					aria-pressed={verifyDecision === 'terima'}
					class={`rounded-xl px-4 py-2.5 text-xs font-bold transition-colors focus-visible:outline-2 focus-visible:outline-emerald-600 ${verifyDecision === 'terima' ? 'bg-emerald-600 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
				>
					Terima
				</button>
				<button
					type="button"
					onclick={() => (verifyDecision = 'tolak')}
					aria-pressed={verifyDecision === 'tolak'}
					class={`rounded-xl px-4 py-2.5 text-xs font-bold transition-colors focus-visible:outline-2 focus-visible:outline-red-600 ${verifyDecision === 'tolak' ? 'bg-red-600 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
				>
					Tolak
				</button>
			</div>
			{#if verifyDecision === 'terima'}
				<p class="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-700">
					Menerima berarti lunas sebesar tagihan ({row ? formatIDR(row.amountExpected) : ''}) — akses kursus langsung dibuka.
				</p>
			{:else}
				<label for="verify-reason" class="mt-4 block text-xs font-bold text-slate-700">Alasan penolakan (wajib)</label>
				<textarea
					id="verify-reason"
					rows="3"
					bind:value={verifyReason}
					placeholder="cth. Nominal kurang dari tagihan; bukti tidak terbaca."
					class="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
				></textarea>
			{/if}
			{#if verifyError}
				<p role="alert" class="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-700">{verifyError}</p>
			{/if}
			<div class="mt-4 flex gap-2">
				<button
					type="button"
					onclick={closeVerify}
					disabled={verifyBusy}
					class="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-slate-200 px-4 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
				>
					Batal
				</button>
				<button
					type="button"
					onclick={() => void submitVerify()}
					disabled={verifyBusy}
					class="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-xs font-bold text-white transition-colors hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60"
				>
					{#if verifyBusy}
						<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i> Menyimpan…
					{:else}
						<i class="fa-solid fa-check" aria-hidden="true"></i> Simpan keputusan
					{/if}
				</button>
			</div>
			<p class="mt-3 text-[11px] leading-relaxed text-slate-400">
				Menerima pembayaran akan memberi akses kursus ke peserta + menghanguskan voucher diskon bila ada.
			</p>
		</div>
	</div>
{/if}
