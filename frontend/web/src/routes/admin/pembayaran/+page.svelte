<script lang="ts">
	import { browser } from '$app/environment';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import Pagination from '$lib/components/Pagination.svelte';
	import { getApiBase } from '$lib/api/backend';
	import {
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
	let verifyAmount = $state('');
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

	function fileUrl(path: string | null): string | null {
		if (!path) return null;
		if (/^https?:\/\//i.test(path)) return path;
		return `${getApiBase().replace(/\/+$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
	}

	function openVerify(row: AdminPaymentRow): void {
		verifyId = row.id;
		verifyAmount = String(row.amountExpected);
		verifyReason = '';
		verifyDecision = 'terima';
		verifyError = '';
	}

	function closeVerify(): void {
		if (verifyBusy) return;
		verifyId = null;
		verifyAmount = '';
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
		const amount = Number(verifyAmount);
		if (verifyDecision === 'terima' && (!Number.isFinite(amount) || amount < 0)) {
			verifyError = 'Nominal yang diterima harus angka ≥ 0.';
			return;
		}
		verifyBusy = true;
		try {
			await verifyPayment(verifyId, {
				decision: verifyDecision,
				...(verifyDecision === 'terima'
					? { amountPaid: Math.floor(amount) }
					: { reason: verifyReason.trim() })
			});
			closeVerify();
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
	<title>Verifikasi Pembayaran — Admin ARISTOTELES</title>
	<meta name="description" content="Antrean verifikasi pembayaran QRIS manual peserta." />
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="page-wrap page-stack">
	<PageHeader
		eyebrow="Admin · Pembayaran"
		title="Verifikasi Pembayaran"
		description="Setujui bukti bayar QRIS untuk membuka akses kursus, atau tolak beserta alasannya. Nominal kurang dari tagihan otomatis ditolak sistem."
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
				description="Pengajuan baru dari peserta akan muncul di sini untuk diverifikasi."
			/>
		</div>
	{:else}
		<ol class="grid grid-cols-1 gap-4 md:grid-cols-2" aria-label="Daftar pengajuan pembayaran">
			{#each items as p (p.id)}
				{@const proofUrl = p.proofFileId ? fileUrl(`/api/v1/files/${p.proofFileId}/content`) : null}
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
						{#if proofUrl}
							<a
								href={proofUrl}
								target="_blank"
								rel="noopener noreferrer"
								class="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600"
							>
								<i class="fa-solid fa-receipt" aria-hidden="true"></i> Lihat bukti
							</a>
						{:else}
							<span class="inline-flex min-h-10 flex-1 items-center justify-center rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-400">
								<i class="fa-solid fa-image" aria-hidden="true"></i> Tanpa bukti
							</span>
						{/if}
						{#if p.status === 'menunggu'}
							<button
								type="button"
								onclick={() => openVerify(p)}
								class="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
							>
								<i class="fa-solid fa-check-double" aria-hidden="true"></i> Verifikasi
							</button>
						{/if}
					</div>
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
				<label for="verify-amount" class="mt-4 block text-xs font-bold text-slate-700">Nominal yang diterima (Rp) — harus ≥ tagihan</label>
				<input
					id="verify-amount"
					type="number"
					min="0"
					step="1"
					bind:value={verifyAmount}
					class="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-2.5 font-mono text-sm font-bold focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
				/>
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
