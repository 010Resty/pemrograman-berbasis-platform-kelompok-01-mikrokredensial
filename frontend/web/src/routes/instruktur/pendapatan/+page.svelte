<script lang="ts">
	import { browser } from '$app/environment';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import UiStatCard from '$lib/components/ui/StatCard.svelte';
	import {
		fetchMyEarnings,
		fetchMyPayouts,
		requestPayout,
		type Earnings,
		type PayoutRow,
		type PayoutStatus
	} from '$lib/api/revenues';
	import { toast } from '$lib/stores/toast.svelte';

	let earnings = $state<Earnings | null>(null);
	let payouts = $state<PayoutRow[]>([]);
	let loading = $state(true);
	let loadError = $state('');
	let started = false;
	let loadSeq = 0;

	let amount = $state<number | null>(null);
	let bankName = $state('');
	let accountNumber = $state('');
	let accountName = $state('');
	let withdrawBusy = $state(false);
	let withdrawMessage = $state('');

	function formatIDR(n: number): string {
		return `Rp ${Number(n || 0).toLocaleString('id-ID')}`;
	}

	function statusBadge(s: PayoutStatus): string {
		if (s === 'berhasil') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
		if (s === 'ditolak') return 'border-red-200 bg-red-50 text-red-700';
		if (s === 'diproses') return 'border-blue-200 bg-blue-50 text-blue-700';
		return 'border-amber-200 bg-amber-50 text-amber-700';
	}

	async function load(): Promise<void> {
		const my = ++loadSeq;
		loading = true;
		loadError = '';
		try {
			const [e, h] = await Promise.all([fetchMyEarnings(), fetchMyPayouts({ limit: 20, page: 1 })]);
			if (my !== loadSeq) return;
			earnings = e;
			payouts = h.items;
		} catch (e) {
			if (my !== loadSeq) return;
			loadError = e instanceof Error ? e.message : 'Ringkasan pendapatan belum dapat dimuat.';
			toast.error(loadError);
		} finally {
			if (my === loadSeq) loading = false;
		}
	}

	$effect(() => {
		if (!browser || started) return;
		started = true;
		void load();
	});

	async function submitWithdraw(): Promise<void> {
		if (withdrawBusy || !earnings) return;
		withdrawMessage = '';
		if (amount === null || !Number.isInteger(amount) || amount <= 0) {
			withdrawMessage = 'Nominal penarikan wajib diisi (rupiah penuh).';
			toast.error(withdrawMessage);
			return;
		}
		if (!bankName.trim() || !accountNumber.trim() || !accountName.trim()) {
			withdrawMessage = 'Nama bank, nomor rekening, dan nama pemilik wajib diisi.';
			toast.error(withdrawMessage);
			return;
		}
		withdrawBusy = true;
		try {
			const res = await requestPayout({
				amount,
				bankName: bankName.trim(),
				accountNumber: accountNumber.trim(),
				accountName: accountName.trim()
			});
			withdrawMessage = `Penarikan ${formatIDR(res.amount)} diajukan dan menunggu persetujuan admin.`;
			amount = null;
			await load();
		} catch (e) {
			withdrawMessage = e instanceof Error ? e.message : 'Pengajuan gagal. Coba lagi.';
			toast.error(withdrawMessage);
		} finally {
			withdrawBusy = false;
		}
	}
</script>

<svelte:head>
	<title>Pendapatan — Instruktur Aristoteles</title>
	<meta name="description" content="Ringkasan pendapatan kursus dan pengajuan pencairan dana instruktur." />
</svelte:head>

<div class="page-wrap page-stack">
	<PageHeader
		eyebrow="Menu Utama · Pendapatan"
		title="Pendapatan"
		description="Pantau penghasilan kursus dan ajukan pencairan dana ke rekening Anda."
	/>

	{#if loading}
		<div class="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4" aria-label="Memuat pendapatan">
			{#each [1, 2, 3, 4] as i (i)}
				<div class="animate-pulse rounded-2xl border border-slate-200/60 bg-white p-5">
					<div class="h-4 w-24 rounded bg-slate-100"></div>
					<div class="mt-2 h-7 w-32 rounded bg-slate-100"></div>
				</div>
			{/each}
		</div>
	{:else if loadError || !earnings}
		<div role="alert" class="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
			<p class="text-sm font-bold text-red-700">Ringkasan belum dapat dimuat</p>
			<p class="mx-auto mt-1 max-w-md text-xs text-red-600">{loadError}</p>
			<button
				type="button"
				onclick={() => void load()}
				class="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-red-600"
			>
				<i class="fa-solid fa-rotate-right" aria-hidden="true"></i> Coba lagi
			</button>
		</div>
	{:else}
		<p class="flex items-start gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs leading-relaxed font-semibold text-blue-800">
			<i class="fa-solid fa-circle-info mt-0.5" aria-hidden="true"></i>
			<span>Bagian Anda {earnings.percent}% dari setiap pembayaran terverifikasi. Perubahan persen admin hanya berlaku untuk pembayaran berikutnya.</span>
		</p>

		<div class="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
			<UiStatCard label="Total pendapatan" value={formatIDR(earnings.totalEarned)} icon="fa-sack-dollar" tone="blue" />
			<UiStatCard label="Tersedia untuk ditarik" value={formatIDR(earnings.available)} icon="fa-wallet" tone="emerald" />
			<UiStatCard label="Dalam proses" value={formatIDR(earnings.pending)} icon="fa-hourglass-half" tone="amber" />
			<UiStatCard label="Sudah dibayar" value={formatIDR(earnings.paid)} icon="fa-circle-check" tone="emerald" />
		</div>

		<div class="grid gap-6 lg:grid-cols-3">
			<section aria-labelledby="heading-rincian" class="rounded-2xl border border-slate-200/60 bg-white p-6 lg:col-span-2">
				<h2 id="heading-rincian" class="text-lg font-bold text-slate-900">Rincian per kursus</h2>
				<p class="mt-0.5 text-xs text-slate-500">Hak Anda dari pembayaran terverifikasi tiap kursus.</p>
				{#if earnings.courses.length === 0}
					<p class="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-500">
						Belum ada pendapatan. Hak tercatat otomatis setiap ada pembayaran terverifikasi di kursus Anda.
					</p>
				{:else}
					<div class="mt-4 overflow-x-auto">
						<table class="w-full min-w-[480px] text-left text-sm">
							<thead>
								<tr class="border-y border-slate-100 bg-slate-50/60 text-xs text-slate-500">
									<th scope="col" class="px-4 py-3 font-bold">Kursus</th>
									<th scope="col" class="px-4 py-3 text-right font-bold">Pembayaran</th>
									<th scope="col" class="px-4 py-3 text-right font-bold">Hak Anda</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-slate-100">
								{#each earnings.courses as c (c.courseId)}
									<tr class="hover:bg-slate-50/50">
										<td class="px-4 py-3 text-[13px] font-bold text-slate-800">{c.title}</td>
										<td class="px-4 py-3 text-right text-[13px] font-semibold tabular-nums text-slate-500">{c.payments}</td>
										<td class="px-4 py-3 text-right text-sm font-bold tabular-nums text-slate-900">{formatIDR(c.earned)}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			</section>

			<section aria-labelledby="heading-tarik" class="rounded-2xl bg-navy p-6 text-white">
				<div class="relative z-10">
					<h2 id="heading-tarik" class="text-lg font-bold">Tarik Dana</h2>
					<p class="mt-1 text-sm text-blue-100">
						Minimal {formatIDR(earnings.minWithdrawal)} · tersedia {formatIDR(earnings.available)}.
					</p>
					<p class="mt-1 text-[11px] font-semibold text-blue-200/80">
						Rekening diisi tiap pengajuan. Admin mentransfer manual lalu menandai berhasil.
					</p>
					<div class="mt-4 space-y-3">
						<div>
							<label for="wd-amount" class="mb-1.5 block text-xs font-bold text-blue-100">Nominal (Rp)</label>
							<input
								id="wd-amount"
								type="number"
								min={earnings.minWithdrawal}
								step="1000"
								bind:value={amount}
								placeholder="cth. 500000"
								class="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-bold text-white placeholder:text-blue-200/60 focus:border-white focus:outline-none"
							/>
						</div>
						<div>
							<label for="wd-bank" class="mb-1.5 block text-xs font-bold text-blue-100">Nama bank</label>
							<input
								id="wd-bank"
								type="text"
								bind:value={bankName}
								maxlength={100}
								placeholder="cth. BCA"
								class="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white placeholder:text-blue-200/60 focus:border-white focus:outline-none"
							/>
						</div>
						<div>
							<label for="wd-number" class="mb-1.5 block text-xs font-bold text-blue-100">Nomor rekening</label>
							<input
								id="wd-number"
								type="text"
								inputmode="numeric"
								bind:value={accountNumber}
								maxlength={50}
								placeholder="cth. 8821123456"
								class="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white placeholder:text-blue-200/60 focus:border-white focus:outline-none"
							/>
						</div>
						<div>
							<label for="wd-name" class="mb-1.5 block text-xs font-bold text-blue-100">Nama pemilik rekening</label>
							<input
								id="wd-name"
								type="text"
								bind:value={accountName}
								maxlength={150}
								placeholder="Sesuai buku tabungan"
								class="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white placeholder:text-blue-200/60 focus:border-white focus:outline-none"
							/>
						</div>
					</div>
					<button
						type="button"
						onclick={() => void submitWithdraw()}
						disabled={withdrawBusy}
						class="mt-4 flex w-full min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-blue-700 transition-colors duration-200 ease-smooth hover:bg-blue-50 disabled:cursor-wait disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-white"
					>
						<i class="fa-solid fa-money-bill-transfer" aria-hidden="true"></i>
						{withdrawBusy ? 'Mengajukan…' : 'Ajukan Penarikan'}
					</button>
					{#if withdrawMessage}
						<p role="status" class="mt-3 rounded-xl bg-white/10 px-3.5 py-2.5 text-xs font-semibold text-white">
							{withdrawMessage}
						</p>
					{/if}
				</div>
			</section>
		</div>

		<section aria-labelledby="heading-riwayat" class="mt-6 overflow-hidden rounded-2xl border border-slate-200/60 bg-white">
			<div class="p-6 pb-4">
				<h2 id="heading-riwayat" class="text-lg font-bold text-slate-900">Riwayat Pencairan</h2>
				<p class="mt-0.5 text-xs text-slate-500">{payouts.length} pengajuan terakhir.</p>
			</div>
			{#if payouts.length === 0}
				<p class="px-6 pb-6 text-xs font-semibold text-slate-500">Belum ada pengajuan penarikan.</p>
			{:else}
				<ol class="divide-y divide-slate-100 md:hidden" aria-label="Riwayat pencairan">
					{#each payouts as p (p.id)}
						<li class="flex items-center justify-between gap-3 px-4 py-3.5">
							<div class="min-w-0">
								<p class="truncate text-sm font-bold text-slate-900">{formatIDR(p.amount)}</p>
								<p class="mt-0.5 truncate font-mono text-[11px] text-slate-500">#{p.id} · {p.bankName} · {p.accountNumber}</p>
								{#if p.status === 'ditolak' && p.rejectReason}
									<p class="mt-0.5 text-[11px] text-red-600">Alasan: {p.rejectReason}</p>
								{/if}
							</div>
							<span class={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${statusBadge(p.status)}`}>
								{p.status}
							</span>
						</li>
					{/each}
				</ol>
				<div class="hidden overflow-x-auto md:block">
					<table class="w-full min-w-[640px] text-left text-sm">
						<thead>
							<tr class="border-y border-slate-100 bg-slate-50/60 text-xs text-slate-500">
								<th scope="col" class="px-6 py-3 font-bold">ID / Tanggal</th>
								<th scope="col" class="px-6 py-3 font-bold">Tujuan</th>
								<th scope="col" class="px-6 py-3 font-bold">Nominal</th>
								<th scope="col" class="px-6 py-3 text-right font-bold">Status</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-slate-100">
							{#each payouts as p (p.id)}
								<tr class="hover:bg-slate-50/50">
									<td class="px-6 py-4">
										<div class="font-mono text-xs font-bold text-slate-800">#{p.id}</div>
										<div class="text-xs text-slate-500">{new Date(p.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
									</td>
									<td class="px-6 py-4 text-xs font-semibold text-slate-600">
										{p.bankName} · {p.accountNumber}
										<div class="font-normal text-slate-500">{p.accountName}</div>
										{#if p.status === 'ditolak' && p.rejectReason}
											<div class="font-normal text-red-600">Alasan: {p.rejectReason}</div>
										{/if}
									</td>
									<td class="px-6 py-4 text-sm font-bold tabular-nums text-slate-900">{formatIDR(p.amount)}</td>
									<td class="px-6 py-4 text-right">
										<span class={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${statusBadge(p.status)}`}>
											{p.status}
										</span>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</section>
	{/if}
</div>
