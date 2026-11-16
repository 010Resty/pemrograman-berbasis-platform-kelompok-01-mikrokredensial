<script lang="ts">
	import { browser } from '$app/environment';
	import { resolve } from '$app/paths';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import WarningModal from '$lib/components/WarningModal.svelte';
	import {
		cancelPayment,
		fetchMyPayments,
		type MyPaymentListItem,
		type PaymentStatus
	} from '$lib/api/payments';
	import { formatIDR } from '$lib/data/payment';

	/**
	 * Riwayat pembayaran milik sendiri (GET /api/v1/me/payments).
	 * Titik kembali utama bila user menutup tab saat menunggu verifikasi admin:
	 * setiap baris bertaut ke detail `/user/pembayaran/:courseId` yang
	 * otomatis melanjutkan tahap (checkout → bayar → kirim bukti → menunggu).
	 * Tidak menandai keputusan sebagai dibaca — bell baru hilang setelah
	 * detail dibuka (dismissPaymentNotice di sana).
	 */

	type Filter = 'semua' | PaymentStatus;
	const filters: Array<{ value: Filter; label: string }> = [
		{ value: 'semua', label: 'Semua' },
		{ value: 'menunggu', label: 'Menunggu' },
		{ value: 'diverifikasi', label: 'Diverifikasi' },
		{ value: 'ditolak', label: 'Ditolak' }
	];

	let activeFilter = $state<Filter>('semua');
	let items = $state<MyPaymentListItem[]>([]);
	let total = $state(0);
	let loading = $state(true);
	let loadError = $state('');
	let started = false;
	let loadSeq = 0;

	// Pembatalan antrean (hard delete di server — baris hilang total).
	let cancelTarget = $state<MyPaymentListItem | null>(null);
	let cancelOpen = $state(false);
	let cancelling = $state(false);
	let cancelError = $state('');

	function askCancel(p: MyPaymentListItem): void {
		cancelError = '';
		cancelTarget = p;
		cancelOpen = true;
	}

	async function confirmCancel(): Promise<void> {
		if (!cancelTarget || cancelling) return;
		cancelling = true;
		cancelError = '';
		try {
			await cancelPayment(cancelTarget.id);
			cancelTarget = null;
			cancelOpen = false;
			await load();
		} catch (e) {
			cancelError = e instanceof Error ? e.message : 'Gagal membatalkan. Coba lagi.';
		} finally {
			cancelling = false;
		}
	}

	async function load(): Promise<void> {
		const my = ++loadSeq;
		loading = true;
		loadError = '';
		try {
			const res = await fetchMyPayments({
				status: activeFilter === 'semua' ? undefined : activeFilter,
				limit: 50
			});
			if (my !== loadSeq) return;
			items = res.items;
			total = res.total;
		} catch (e) {
			if (my !== loadSeq) return;
			loadError = e instanceof Error ? e.message : 'Gagal memuat riwayat pembayaran.';
		} finally {
			if (my === loadSeq) loading = false;
		}
	}

	function setFilter(f: Filter): void {
		if (activeFilter === f || loading) return;
		activeFilter = f;
		void load();
	}

	$effect(() => {
		if (!browser || started) return;
		started = true;
		void load();
	});

	function statusLabel(s: PaymentStatus): string {
		if (s === 'diverifikasi') return 'Diverifikasi';
		if (s === 'ditolak') return 'Ditolak';
		return 'Menunggu';
	}

	function statusClass(s: PaymentStatus): string {
		if (s === 'diverifikasi') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
		if (s === 'ditolak') return 'border-red-200 bg-red-50 text-red-700';
		return 'border-amber-200 bg-amber-50 text-amber-800';
	}

	function formatDate(iso: string | null): string {
		if (!iso) return '—';
		const d = new Date(iso);
		return Number.isNaN(d.getTime())
			? iso
			: d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
	}
</script>

<svelte:head>
	<title>Riwayat Pembayaran — Aristoteles Platform</title>
	<meta
		name="description"
		content="Daftar pembayaran QRIS dinamis Anda: lanjutkan yang menunggu, lihat status DOKU."
	/>
	<meta name="robots" content="noindex,nofollow" />
</svelte:head>

<div class="page-wrap page-stack">
	<PageHeader
		eyebrow="Menu Utama · Pembayaran"
		title="Riwayat Pembayaran"
		description={loading
			? 'Memuat riwayat pembayaran Anda…'
			: total === 0
				? 'Belum ada pembayaran. Riwayat pembelian kursus berbayar akan tercatat di sini.'
				: `${total} pembayaran tercatat. Buka baris mana pun untuk melanjutkan ke tahap berikutnya.`}
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
		<div class="grid grid-cols-1 gap-4 md:grid-cols-2" aria-label="Memuat riwayat">
			{#each [1, 2, 3, 4] as i (i)}
				<div class="animate-pulse rounded-2xl border border-slate-200/60 bg-white p-5">
					<div class="h-4 w-32 rounded bg-slate-100"></div>
					<div class="mt-2 h-6 w-48 rounded bg-slate-100"></div>
				</div>
			{/each}
		</div>
	{:else if loadError}
		<div role="alert" class="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
			<p class="text-sm font-bold text-red-700">Riwayat belum dapat dimuat</p>
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
				title={activeFilter === 'semua'
					? 'Belum ada pembayaran'
					: `Tidak ada pembayaran ${statusLabel(activeFilter as PaymentStatus).toLowerCase()}`}
				description="Setelah membuat QRIS dinamis untuk kursus berbayar, statusnya tercatat di sini — buka lagi kapan pun untuk melanjutkan."
			>
				{#snippet actions()}
					<a
						href={resolve('/user/semua-kursus')}
						class="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
					>
						Jelajahi kursus <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
					</a>
				{/snippet}
			</EmptyState>
		</div>
	{:else}
		<ol class="grid grid-cols-1 gap-4 md:grid-cols-2" aria-label="Daftar pembayaran">
			{#each items as p (p.id)}
				<li class="flex flex-col rounded-2xl border border-slate-200/70 bg-white p-5">
					<div class="flex items-start justify-between gap-3">
						<div class="min-w-0">
							<p class="font-mono text-xs font-bold text-slate-500">{p.invoice}</p>
							<p class="mt-0.5 truncate text-sm font-bold text-slate-900">
								{p.courseTitle ?? `Kursus #${p.courseId}`}
							</p>
							<p class="mt-0.5 text-xs text-slate-500">{formatDate(p.createdAt)} · {p.gateway === 'doku' ? 'QRIS dinamis' : 'Manual'}</p>
						</div>
						<span
							class={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${statusClass(p.status)}`}
						>
							<span class="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true"></span>{statusLabel(
								p.status
							)}
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
						{#if p.rejectReason}
							<div class="rounded-lg bg-red-50 px-3 py-2 text-[11px] font-semibold text-red-700">
								Alasan tolak: {p.rejectReason}
							</div>
						{/if}
					</dl>
					{#if cancelError}
						<p role="alert" class="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-700">{cancelError}</p>
					{/if}
					<div class="mt-3 flex gap-2">
						<a
							href={resolve(`/user/pembayaran/${p.courseId}`)}
							class="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
						>
							<i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
							{p.status === 'menunggu' ? 'Lanjutkan pembayaran' : 'Lihat detail'}
						</a>
						{#if p.status === 'menunggu'}
							<button
								type="button"
								onclick={() => askCancel(p)}
								class="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-red-200 px-4 py-2 text-xs font-bold text-red-600 transition-colors hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-red-600"
							>
								<i class="fa-solid fa-trash-can" aria-hidden="true"></i> Batalkan
							</button>
						{/if}
					</div>
				</li>
			{/each}
		</ol>
	{/if}
</div>

<WarningModal
	bind:open={cancelOpen}
	type="danger"
	title="Batalkan pengajuan ini?"
	message={cancelTarget
		? `Pengajuan ${cancelTarget.invoice} (${formatIDR(cancelTarget.amountExpected)}) akan dihapus permanen. Anda bisa membuat QR baru kapan pun.`
		: 'Pengajuan ini akan dihapus permanen.'}
	confirmText="Ya, batalkan"
	loading={cancelling}
	onconfirm={() => void confirmCancel()}
	oncancel={() => (cancelTarget = null)}
/>
