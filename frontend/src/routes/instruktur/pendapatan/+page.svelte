<script lang="ts">
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import UiStatCard from '$lib/components/ui/StatCard.svelte';

	interface Payout {
		id: string;
		date: string;
		amount: string;
		amountNum: number;
		status: 'Berhasil' | 'Diproses' | 'Tertunda';
		bank: string;
	}

	let available = $state(5100000);
	let payouts = $state<Payout[]>([
		{ id: 'WD-2026-08-04', date: '28 Agu 2026', amount: 'Rp 2.500.000', amountNum: 2500000, status: 'Berhasil', bank: 'BCA ·· 8821' },
		{ id: 'WD-2026-08-03', date: '14 Agu 2026', amount: 'Rp 1.800.000', amountNum: 1800000, status: 'Berhasil', bank: 'BCA ·· 8821' },
		{ id: 'WD-2026-08-02', date: '5 Agu 2026', amount: 'Rp 3.300.000', amountNum: 3300000, status: 'Diproses', bank: 'BCA ·· 8821' }
	]);
	let withdrawMessage = $state('');

	const monthly = [
		{ month: 'Mar', value: 42 },
		{ month: 'Apr', value: 55 },
		{ month: 'Mei', value: 48 },
		{ month: 'Jun', value: 66 },
		{ month: 'Jul', value: 74 },
		{ month: 'Agu', value: 100 }
	];

	function formatRp(n: number): string {
		return `Rp ${(n / 1000000).toFixed(1).replace('.', ',')} jt`.replace(',0 jt', ' jt');
	}

	function withdraw() {
		if (available < 100000) {
			withdrawMessage = 'Saldo tersedia kurang dari batas minimal penarikan Rp 100 rb.';
			return;
		}
		const amount = Math.min(available, 2000000);
		available -= amount;
		payouts = [
			{
				id: `WD-2026-08-${String(payouts.length + 5).padStart(2, '0')}`,
				date: 'Hari ini',
				amount: `Rp ${amount.toLocaleString('id-ID')}`,
				amountNum: amount,
				status: 'Diproses',
				bank: 'BCA ·· 8821'
			},
			...payouts
		];
		withdrawMessage = `Penarikan Rp ${amount.toLocaleString('id-ID')} diajukan dan sedang diproses ke BCA ·· 8821.`;
	}
</script>

<svelte:head>
	<title>Pendapatan — Instruktur Aristoteles</title>
	<meta name="description" content="Ringkasan pendapatan, grafik bulanan, dan riwayat pencairan dana instruktur." />
</svelte:head>

<div class="page-wrap page-stack">
	<PageHeader
		eyebrow="Menu Utama · Pendapatan"
		title="Pendapatan"
		description="Pantau penghasilan kursus dan ajukan pencairan dana kapan saja."
	/>

	<p
		role="note"
		class="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed font-semibold text-amber-800"
	>
		<i class="fa-solid fa-circle-info mt-0.5" aria-hidden="true"></i>
		<span
			>Data ilustrasi untuk tampilan — angka, grafik, dan riwayat di halaman ini belum terhubung ke
			sistem pembayaran. Penarikan bersifat simulasi, tidak ada dana nyata yang bergerak.</span
		>
	</p>

	<div class="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
		<UiStatCard label="Total pendapatan" value="Rp 32,6 jt" icon="fa-sack-dollar" tone="blue" />
		<UiStatCard
			label="Bulan ini"
			value="Rp 8,4 jt"
			sub="+18% vs bulan lalu"
			icon="fa-chart-line"
			tone="emerald"
		/>
		<UiStatCard
			label="Tersedia untuk ditarik"
			value={formatRp(available)}
			icon="fa-wallet"
			tone="emerald"
		/>
		<UiStatCard label="Dalam proses" value="Rp 3,3 jt" icon="fa-hourglass-half" tone="amber" />
	</div>

	<div class="grid gap-6 lg:grid-cols-3">
		<section aria-labelledby="heading-grafik" class="rounded-2xl border border-slate-200/60 bg-white p-6 lg:col-span-2">
			<div class="mb-1 flex items-center justify-between">
				<h2 id="heading-grafik" class="text-lg font-bold text-slate-900">Tren 6 Bulan Terakhir</h2>
				<span class="text-xs font-semibold text-emerald-600">+38% vs semester lalu</span>
			</div>
			<p class="mb-6 text-xs text-slate-500">Pendapatan kotor per bulan (skala relatif terhadap bulan tertinggi).</p>
			<table class="sr-only">
				<caption>Pendapatan kotor per bulan (data ilustrasi)</caption>
				<thead><tr><th scope="col">Bulan</th><th scope="col">Nilai relatif</th></tr></thead>
				<tbody>
					{#each monthly as m (m.month)}
						<tr><td>{m.month}</td><td>{m.value} dari 100</td></tr>
					{/each}
				</tbody>
			</table>
			<div class="flex h-44 items-end gap-3 sm:gap-4" role="img" aria-label="Grafik batang pendapatan naik dari Maret hingga Agustus">
				{#each monthly as m (m.month)}
					<div class="flex flex-1 flex-col items-center gap-2">
						<div class="flex w-full flex-1 items-end rounded-xl bg-slate-100">
							<div
								class="w-full rounded-xl {m.month === 'Agu' ? 'bg-gradient-to-t from-emerald-600 to-teal-400' : 'bg-blue-200'}"
								style="height: {m.value}%"
							></div>
						</div>
						<span class="text-[11px] font-bold {m.month === 'Agu' ? 'text-emerald-700' : 'text-slate-500'}">{m.month}</span>
					</div>
				{/each}
			</div>
		</section>

		<section aria-labelledby="heading-tarik" class="rounded-2xl bg-navy p-6 text-white">
			<div class="relative z-10">
				<h2 id="heading-tarik" class="text-lg font-bold">Tarik Dana</h2>
				<p class="mt-1 text-sm text-blue-100">Minimal Rp 100 rb · proses 1–2 hari kerja ke BCA ·· 8821.</p>
				<p class="mt-1 text-[11px] font-semibold text-blue-200/80">Simulasi — tidak ada dana nyata yang bergerak.</p>
				<div class="mt-4 rounded-xl bg-white/10 p-4">
					<p class="text-xs text-blue-100">Saldo tersedia</p>
					<p class="text-2xl font-bold">{formatRp(available)}</p>
				</div>
				<button
					type="button"
					onclick={withdraw}
					class="mt-4 flex w-full min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-blue-700 transition-colors duration-200 ease-smooth hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-white"
				>
					<i class="fa-solid fa-money-bill-transfer" aria-hidden="true"></i> Ajukan Penarikan
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
			<p class="mt-0.5 text-xs text-slate-500">{payouts.length} transaksi terakhir ke rekening terdaftar.</p>
		</div>
		<ol class="divide-y divide-slate-100 md:hidden" aria-label="Riwayat pencairan">
			{#each payouts as p (p.id)}
				<li class="flex items-center justify-between gap-3 px-4 py-3.5">
					<div class="min-w-0">
						<p class="truncate text-sm font-bold text-slate-900">{p.amount}</p>
						<p class="mt-0.5 truncate font-mono text-[11px] text-slate-500">{p.id} · {p.date} · {p.bank}</p>
					</div>
					<span
						class="inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold {p.status === 'Berhasil' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : p.status === 'Diproses' ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-amber-200 bg-amber-50 text-amber-700'}"
					>
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
								<div class="font-mono text-xs font-bold text-slate-800">{p.id}</div>
								<div class="text-xs text-slate-500">{p.date}</div>
							</td>
							<td class="px-6 py-4 text-xs font-semibold text-slate-600">{p.bank}</td>
							<td class="px-6 py-4 text-sm font-bold text-slate-900">{p.amount}</td>
							<td class="px-6 py-4 text-right">
								<span
									class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold {p.status === 'Berhasil' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : p.status === 'Diproses' ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-amber-200 bg-amber-50 text-amber-700'}"
								>
									{p.status}
								</span>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>
</div>
