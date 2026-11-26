<script lang="ts">
	import { browser } from '$app/environment';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import Pagination from '$lib/components/Pagination.svelte';
	import {
		fetchAdminPayouts,
		fetchRevenueSettings,
		processPayout,
		updateRevenueSettings,
		type PayoutRow,
		type PayoutStatus
	} from '$lib/api/revenues';
	import { toast } from '$lib/stores/toast.svelte';

	const filters: { value: PayoutStatus | 'all'; label: string }[] = [
		{ value: 'diajukan', label: 'Diajukan' },
		{ value: 'diproses', label: 'Diproses' },
		{ value: 'berhasil', label: 'Berhasil' },
		{ value: 'ditolak', label: 'Ditolak' },
		{ value: 'all', label: 'Semua' }
	];

	let activeFilter = $state<PayoutStatus | 'all'>('diajukan');
	let items = $state<PayoutRow[]>([]);
	let total = $state(0);
	let page = $state(1);
	let perPage = $state(10);
	let loading = $state(true);
	let loadError = $state('');
	let started = false;
	let loadSeq = 0;

	let percent = $state(70);
	let minWithdrawal = $state(100000);
	let settingsLoading = $state(true);
	let settingsError = $state('');
	let settingsBusy = $state(false);
	let settingsSaved = $state('');
	let settingsOpen = $state(false);

	let actionId = $state<number | null>(null);
	let actionKind = $state<'setujui' | 'tolak' | 'tandai-ditransfer'>('setujui');
	let actionReason = $state('');
	let actionBusy = $state(false);
	let actionError = $state('');

	function formatIDR(n: number): string {
		return `Rp ${Number(n || 0).toLocaleString('id-ID')}`;
	}

	function statusBadge(s: PayoutStatus): string {
		if (s === 'berhasil') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
		if (s === 'ditolak') return 'border-red-200 bg-red-50 text-red-700';
		if (s === 'diproses') return 'border-blue-200 bg-blue-50 text-blue-700';
		return 'border-amber-200 bg-amber-50 text-amber-700';
	}

	async function loadSettings(): Promise<void> {
		settingsLoading = true;
		settingsError = '';
		try {
			const s = await fetchRevenueSettings();
			percent = s.instructorPercent;
			minWithdrawal = s.minWithdrawal;
		} catch (e) {
			settingsError = e instanceof Error ? e.message : 'Pengaturan belum dapat dimuat.';
			toast.error(settingsError);
		} finally {
			settingsLoading = false;
		}
	}

	async function saveSettings(): Promise<void> {
		if (settingsBusy) return;
		settingsSaved = '';
		if (!Number.isInteger(percent) || percent < 1 || percent > 99) {
			toast.error('Persen instruktur harus 1–99.');
			return;
		}
		if (!Number.isInteger(minWithdrawal) || minWithdrawal < 0) {
			toast.error('Minimal penarikan tidak valid.');
			return;
		}
		settingsBusy = true;
		try {
			const s = await updateRevenueSettings({ instructorPercent: percent, minWithdrawal });
			percent = s.instructorPercent;
			minWithdrawal = s.minWithdrawal;
			settingsSaved = `Tersimpan: instruktur ${percent}% · minimal ${formatIDR(minWithdrawal)}. Berlaku untuk pembayaran berikutnya.`;
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Gagal menyimpan pengaturan.');
		} finally {
			settingsBusy = false;
		}
	}

	async function load(): Promise<void> {
		const my = ++loadSeq;
		loading = true;
		loadError = '';
		try {
			const res = await fetchAdminPayouts({
				status: activeFilter === 'all' ? undefined : activeFilter,
				limit: perPage,
				page
			});
			if (my !== loadSeq) return;
			items = res.items;
			total = res.total;
		} catch (e) {
			if (my !== loadSeq) return;
			loadError = e instanceof Error ? e.message : 'Gagal memuat antrean penarikan.';
			toast.error(loadError);
		} finally {
			if (my === loadSeq) loading = false;
		}
	}

	$effect(() => {
		if (!browser || started) return;
		started = true;
		void loadSettings();
		void load();
	});

	function setFilter(f: PayoutStatus | 'all'): void {
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

	function openAction(row: PayoutRow, kind: 'setujui' | 'tolak' | 'tandai-ditransfer'): void {
		actionId = row.id;
		actionKind = kind;
		actionReason = '';
		actionError = '';
	}

	function closeAction(): void {
		if (actionBusy) return;
		actionId = null;
		actionReason = '';
		actionError = '';
	}

	async function submitAction(): Promise<void> {
		if (actionId === null || actionBusy) return;
		actionError = '';
		if (actionKind === 'tolak' && !actionReason.trim()) {
			actionError = 'Alasan penolakan wajib diisi.';
			toast.error(actionError);
			return;
		}
		actionBusy = true;
		try {
			await processPayout(actionId, {
				action: actionKind,
				...(actionKind === 'tolak' ? { reason: actionReason.trim() } : {})
			});
			closeAction();
			window.dispatchEvent(new CustomEvent('admin:notif-refresh'));
			await load();
		} catch (e) {
			actionError = e instanceof Error ? e.message : 'Aksi gagal. Coba lagi.';
			toast.error(actionError);
		} finally {
			actionBusy = false;
		}
	}
</script>

<svelte:head>
	<title>Bagi Hasil — Admin ARISTOTELES</title>
	<meta name="description" content="Atur persen bagi hasil instruktur dan proses pengajuan penarikan dana." />
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="page-wrap page-stack">
	<PageHeader
		eyebrow="Admin · Bagi Hasil"
		title="Bagi Hasil Instruktur"
		description="Persen global untuk semua instruktur + antrean penarikan. Perubahan persen hanya berlaku untuk pembayaran berikutnya."
	/>

	<section aria-labelledby="heading-persen" class="rounded-2xl border border-slate-200/60 bg-white p-6">
		<div class="flex flex-wrap items-center justify-between gap-3">
			<div>
				<h2 id="heading-persen" class="text-lg font-bold text-slate-900">Persen Instruktur</h2>
				<p class="mt-0.5 text-xs text-slate-500">
					Bagian instruktur dari setiap pembayaran terverifikasi. Hak yang sudah tercatat tidak berubah.
				</p>
			</div>
			{#if !settingsLoading}
				<div class="flex items-center gap-2">
					<span class="rounded-xl bg-blue-50 px-3 py-1.5 font-heading text-sm font-extrabold tabular-nums text-blue-700">
						{percent}%
					</span>
					<button
						type="button"
						onclick={() => (settingsOpen = !settingsOpen)}
						aria-expanded={settingsOpen}
						aria-controls="bagi-form"
						class="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition-colors hover:border-blue-500 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
					>
						<i class={`fa-solid ${settingsOpen ? 'fa-xmark' : 'fa-pen'}`} aria-hidden="true"></i>
						{settingsOpen ? 'Tutup' : 'Ubah'}
					</button>
				</div>
			{/if}
		</div>
		{#if settingsLoading}
			<p class="mt-4 text-xs font-semibold text-slate-500">Memuat pengaturan…</p>
		{:else if settingsOpen}
			<div id="bagi-form" class="mt-4 grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
				<div>
					<label for="bagi-persen" class="mb-1.5 block text-xs font-bold text-slate-700">Persen instruktur (%)</label>
					<input
						id="bagi-persen"
						type="number"
						min="1"
						max="99"
						step="1"
						bind:value={percent}
						class="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-900 focus:border-blue-500 focus:outline-none"
					/>
				</div>
				<div>
					<label for="bagi-min" class="mb-1.5 block text-xs font-bold text-slate-700">Minimal penarikan (Rp)</label>
					<input
						id="bagi-min"
						type="number"
						min="0"
						step="10000"
						bind:value={minWithdrawal}
						class="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-900 focus:border-blue-500 focus:outline-none"
					/>
				</div>
				<button
					type="button"
					onclick={() => void saveSettings()}
					disabled={settingsBusy}
					class="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:cursor-wait disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-blue-600"
				>
					<i class="fa-solid fa-floppy-disk" aria-hidden="true"></i>
					{settingsBusy ? 'Menyimpan…' : 'Simpan'}
				</button>
			</div>
			{#if settingsSaved}
				<p role="status" class="mt-3 text-xs font-semibold text-emerald-700">{settingsSaved}</p>
			{/if}
		{/if}
	</section>

	<div class="flex flex-wrap gap-2" role="group" aria-label="Filter status penarikan">
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
		<div class="grid grid-cols-1 gap-4 md:grid-cols-2" aria-label="Memuat antrean">
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
		<div class="rounded-2xl border border-slate-200/60 bg-white p-8 text-center">
			<p class="text-sm font-bold text-slate-700">Tidak ada pengajuan pada filter ini</p>
			<p class="mx-auto mt-1 max-w-md text-xs text-slate-500">
				Pengajuan penarikan instruktur muncul di sini untuk disetujui, ditolak, atau ditandai sudah ditransfer.
			</p>
		</div>
	{:else}
		<ol class="grid grid-cols-1 gap-4 md:grid-cols-2" aria-label="Daftar pengajuan penarikan">
			{#each items as p (p.id)}
				<li class="flex flex-col rounded-2xl border border-slate-200/70 bg-white p-5">
					<div class="flex items-start justify-between gap-3">
						<div>
							<p class="font-heading text-lg font-extrabold tabular-nums text-slate-900">
								{formatIDR(p.amount)}
							</p>
							<p class="mt-0.5 font-mono text-[11px] text-slate-500">#{p.id} · {p.instructorName} ({p.instructorEmail})</p>
						</div>
						<span class={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${statusBadge(p.status)}`}>
							{p.status}
						</span>
					</div>
					<div class="mt-3 rounded-xl bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-700">
						<i class="fa-solid fa-building-columns mr-1.5 text-slate-400" aria-hidden="true"></i>
						{p.bankName} · {p.accountNumber} · {p.accountName}
					</div>
					{#if p.status === 'ditolak' && p.rejectReason}
						<p class="mt-2 text-xs text-red-600">Alasan: {p.rejectReason}</p>
					{/if}
					{#if p.status === 'diajukan' || p.status === 'diproses'}
						<div class="mt-3 flex flex-wrap gap-2">
							{#if p.status === 'diajukan'}
								<button
									type="button"
									onclick={() => openAction(p, 'setujui')}
									class="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
								>
									<i class="fa-solid fa-check" aria-hidden="true"></i> Setujui
								</button>
							{/if}
							{#if p.status === 'diproses'}
								<button
									type="button"
									onclick={() => openAction(p, 'tandai-ditransfer')}
									class="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-emerald-600"
								>
									<i class="fa-solid fa-money-bill-transfer" aria-hidden="true"></i> Tandai sudah ditransfer
								</button>
							{/if}
							<button
								type="button"
								onclick={() => openAction(p, 'tolak')}
								class="inline-flex min-h-11 items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2 text-xs font-bold text-red-700 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-red-600"
							>
								<i class="fa-solid fa-xmark" aria-hidden="true"></i> Tolak
							</button>
						</div>
					{/if}
				</li>
			{/each}
		</ol>
		<Pagination bind:page bind:perPage totalItems={total} itemLabel="pengajuan" />
	{/if}

	{#if actionId !== null}
		{@const row = items.find((i) => i.id === actionId)}
		<div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true" aria-label="Proses penarikan">
			<div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
				<h2 class="font-heading text-base font-extrabold text-slate-900">
					{actionKind === 'setujui' ? 'Setujui penarikan' : actionKind === 'tandai-ditransfer' ? 'Tandai sudah ditransfer' : 'Tolak penarikan'}
					#{actionId}
				</h2>
				{#if row}
					<p class="mt-1 text-xs text-slate-500">
						{formatIDR(row.amount)} → {row.bankName} · {row.accountNumber} · {row.accountName}
					</p>
					{#if actionKind === 'tandai-ditransfer'}
						<p class="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
							Pastikan dana sudah ditransfer manual ke rekening di atas sebelum menandai berhasil.
						</p>
					{/if}
				{/if}
				{#if actionKind === 'tolak'}
					<label for="bagi-reason" class="mt-4 mb-1.5 block text-xs font-bold text-slate-700">Alasan penolakan</label>
					<textarea
						id="bagi-reason"
						bind:value={actionReason}
						rows={3}
						maxlength={500}
						placeholder="Contoh: nomor rekening tidak valid"
						class="w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-red-500 focus:outline-none"
					></textarea>
				{/if}
				{#if actionError}
					<p role="alert" class="mt-3 text-xs font-semibold text-red-600">{actionError}</p>
				{/if}
				<div class="mt-5 flex justify-end gap-2">
					<button
						type="button"
						onclick={closeAction}
						disabled={actionBusy}
						class="inline-flex min-h-11 items-center rounded-xl border border-slate-200 px-5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
					>
						Batal
					</button>
					<button
						type="button"
						onclick={() => void submitAction()}
						disabled={actionBusy}
						class="inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-900 px-5 py-2 text-xs font-bold text-white hover:bg-slate-700 disabled:cursor-wait disabled:opacity-70"
					>
						{actionBusy ? 'Memproses…' : 'Konfirmasi'}
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>
