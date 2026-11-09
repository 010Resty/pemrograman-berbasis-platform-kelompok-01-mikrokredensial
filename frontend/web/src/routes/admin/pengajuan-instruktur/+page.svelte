<script lang="ts">
	import { browser } from '$app/environment';
	import { resolve } from '$app/paths';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import Pagination from '$lib/components/Pagination.svelte';
	import {
		listApplicationsRequest,
		type ApplicationStatus,
		type PengajuanInstruktur
	} from '$lib/api/applications';
	import { BackendRequestError } from '$lib/api/backend';

	/**
	 * Daftar pengajuan minat instruktur (DATA BACKEND NYATA).
	 * Pencarian + filter status + paginasi di server; filter foto di halaman
	 * yang sedang dimuat. Akun resmi tetap diterbitkan via undangan
	 * di `/admin/invitations` (K-01).
	 */

	type Filter = 'all' | 'ada-foto' | 'tanpa-foto';
	type StatusFilter = 'all' | ApplicationStatus;

	let query = $state('');
	let debouncedQuery = $state('');
	let filter = $state<Filter>('all');
	let statusFilter = $state<StatusFilter>('all');
	let page = $state(1);
	let perPage = $state(5);

	let items = $state<PengajuanInstruktur[]>([]);
	let total = $state(0);
	let loading = $state(false);
	let loadError = $state('');
	let requestSeq = 0;
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;

	$effect(() => {
		const q = query;
		if (debounceTimer) clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			debouncedQuery = q;
		}, 350);
		return () => {
			if (debounceTimer) clearTimeout(debounceTimer);
		};
	});

	$effect(() => {
		if (!browser) return;
		const seq = (requestSeq += 1);
		loading = true;
		loadError = '';
		void listApplicationsRequest({
			q: debouncedQuery.trim() || undefined,
			status: statusFilter === 'all' ? undefined : statusFilter,
			page,
			limit: perPage
		})
			.then((result) => {
				if (seq !== requestSeq) return;
				items = result.items;
				total = result.total;
			})
			.catch((e) => {
				if (seq !== requestSeq) return;
				items = [];
				total = 0;
				loadError =
					e instanceof BackendRequestError && e.message
						? e.message
						: 'Gagal memuat pengajuan. Periksa koneksi backend lalu coba lagi.';
			})
			.finally(() => {
				if (seq === requestSeq) loading = false;
			});
	});

	/* Kembali ke halaman 1 setiap pencarian/filter/jumlah baris berubah. */
	$effect(() => {
		void debouncedQuery;
		void filter;
		void statusFilter;
		void perPage;
		page = 1;
	});

	const visible = $derived(
		items.filter((p) => {
			if (filter === 'ada-foto') return (p.fotoUrl ?? '').trim() !== '';
			if (filter === 'tanpa-foto') return (p.fotoUrl ?? '').trim() === '';
			return true;
		})
	);

	function formatDate(iso: string): string {
		try {
			return new Date(iso).toLocaleDateString('id-ID', {
				day: 'numeric',
				month: 'short',
				year: 'numeric'
			});
		} catch {
			return '-';
		}
	}

	function initials(nama: string): string {
		return (
			nama.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?'
		);
	}

	function filterLabel(f: Filter): string {
		if (f === 'ada-foto') return 'Ada foto';
		if (f === 'tanpa-foto') return 'Tanpa foto';
		return 'Semua';
	}

	function statusBadge(status: ApplicationStatus): string {
		if (status === 'approved') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
		if (status === 'rejected') return 'bg-red-50 text-red-700 border-red-200';
		if (status === 'under_review') return 'bg-blue-50 text-blue-700 border-blue-200';
		return 'bg-amber-50 text-amber-700 border-amber-200';
	}

	function statusLabel(status: ApplicationStatus): string {
		if (status === 'approved') return 'Disetujui';
		if (status === 'rejected') return 'Ditolak';
		if (status === 'under_review') return 'Ditinjau';
		return 'Diajukan';
	}

	function retry(): void {
		requestSeq += 1;
		loading = true;
		loadError = '';
		const seq = requestSeq;
		void listApplicationsRequest({
			q: debouncedQuery.trim() || undefined,
			status: statusFilter === 'all' ? undefined : statusFilter,
			page,
			limit: perPage
		})
			.then((result) => {
				if (seq !== requestSeq) return;
				items = result.items;
				total = result.total;
			})
			.catch((e) => {
				if (seq !== requestSeq) return;
				loadError =
					e instanceof BackendRequestError && e.message
						? e.message
						: 'Gagal memuat pengajuan. Periksa koneksi backend lalu coba lagi.';
			})
			.finally(() => {
				if (seq === requestSeq) loading = false;
			});
	}
</script>

<svelte:head>
	<title>Pengajuan Instruktur — Admin Aristoteles</title>
	<meta
		name="description"
		content="Tinjau pengajuan minat instruktur Aristoteles dari database."
	/>
</svelte:head>

<div class="page-wrap page-stack">
	<PageHeader
		eyebrow="Admin · Pengajuan"
		title="Pengajuan Instruktur"
		description={`${total} pengajuan di database. Pendaftar mengisi /menjadi-instruktur/daftar — akun resmi tetap diterbitkan via Undangan.`}
	>
		{#snippet actions()}
			<a
				href={resolve('/admin/invitations')}
				class="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-teal-600 px-5 py-2.5 text-xs font-bold text-white transition-colors hover:bg-teal-700 focus-visible:outline-2 focus-visible:outline-teal-600"
			>
				<i class="fa-solid fa-envelope-open-text" aria-hidden="true"></i> Buka Undangan
			</a>
		{/snippet}
	</PageHeader>

	<div class="mb-5 flex flex-col gap-3 lg:flex-row">
		<div class="relative max-w-md flex-1">
			<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
				<i class="fa-solid fa-magnifying-glass text-sm" aria-hidden="true"></i>
			</div>
			<label for="pengajuan-search" class="sr-only">Cari pengajuan</label>
			<input
				id="pengajuan-search"
				type="search"
				bind:value={query}
				placeholder="Cari nama, email, atau kode..."
				autocomplete="off"
				class="w-full rounded-xl border border-slate-200 bg-white py-2.5 pr-4 pl-10 text-sm focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 focus:outline-none"
			/>
		</div>
		<div class="flex flex-wrap items-center gap-2">
			<label for="pengajuan-status" class="sr-only">Filter status pengajuan</label>
			<select
				id="pengajuan-status"
				bind:value={statusFilter}
				class="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 focus:outline-none"
			>
				<option value="all">Semua status</option>
				<option value="submitted">Diajukan</option>
				<option value="under_review">Ditinjau</option>
				<option value="approved">Disetujui</option>
				<option value="rejected">Ditolak</option>
			</select>
		</div>
		<div class="flex flex-wrap gap-2" role="group" aria-label="Filter foto pengajuan">
			{#each (['all', 'ada-foto', 'tanpa-foto'] as Filter[]) as f (f)}
				<button
					type="button"
					onclick={() => (filter = f)}
					aria-pressed={filter === f}
					class={`rounded-xl px-4 py-2 text-xs font-bold transition-colors focus-visible:outline-2 focus-visible:outline-teal-600 ${
						filter === f
							? 'bg-teal-600 text-white shadow-lg shadow-teal-600/25'
							: 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
					}`}
				>
					{filterLabel(f)}
				</button>
			{/each}
		</div>
	</div>

	{#if loadError}
		<div
			role="alert"
			class="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700"
		>
			<i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i>
			<span class="flex-1">{loadError}</span>
			<button
				type="button"
				onclick={retry}
				class="rounded-lg bg-red-600 px-3.5 py-2 font-bold text-white hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-red-600"
			>
				Coba lagi
			</button>
		</div>
	{/if}

	<div class="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm">
		<div class="h-1 bg-teal-600" aria-hidden="true"></div>
		<ol class="divide-y divide-slate-100 md:hidden" aria-label="Daftar pengajuan">
			{#each visible as p (p.id)}
				<li>
					<a
						href={resolve(`/admin/pengajuan-instruktur/${p.id}`)}
						class="flex items-center gap-3 px-4 py-3.5 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-teal-600"
						aria-label={`Lihat detail pengajuan ${p.nama}`}
					>
						<span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-600 text-xs font-bold text-white" aria-hidden="true">
							{initials(p.nama)}
						</span>
						<span class="min-w-0 flex-1">
							<span class="block truncate font-semibold text-slate-900">{p.nama}</span>
							<span class="block truncate text-xs text-slate-500">{p.email} · {formatDate(p.createdAt)}</span>
						</span>
						<span class={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${statusBadge(p.status)}`}>
							{statusLabel(p.status)}
						</span>
					</a>
				</li>
			{/each}
		</ol>
		<div class="hidden overflow-x-auto md:block">
			<table class="w-full min-w-[820px] text-sm">
				<caption class="sr-only">Daftar pengajuan minat instruktur</caption>
				<thead class="bg-teal-700 text-white">
					<tr class="[&_th]:py-3.5 [&_th]:align-middle">
						<th scope="col" class="px-6 text-left text-xs font-bold tracking-wider uppercase">Pendaftar</th>
						<th scope="col" class="px-6 text-left text-xs font-bold tracking-wider uppercase">Kode</th>
						<th scope="col" class="px-6 text-left text-xs font-bold tracking-wider uppercase">Status</th>
						<th scope="col" class="px-6 text-left text-xs font-bold tracking-wider uppercase">Mengajukan</th>
						<th scope="col" class="px-6 text-left text-xs font-bold tracking-wider uppercase">Keahlian</th>
						<th scope="col" class="px-6 text-right text-xs font-bold tracking-wider uppercase">Aksi</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-100">
					{#if loading}
						<tr>
							<td colspan={6} class="px-6 py-10 text-center text-sm text-slate-500">
								<i class="fa-solid fa-circle-notch fa-spin mr-2" aria-hidden="true"></i>
								Memuat pengajuan...
							</td>
						</tr>
					{:else}
						{#each visible as p, i (p.id)}
							<tr class={`transition-colors hover:bg-teal-50/50 ${i % 2 === 1 ? 'bg-slate-50/60' : 'bg-white'}`}>
								<td class="px-6 py-3.5">
									<div class="flex items-center gap-3">
										<span
											class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-600 text-xs font-bold text-white shadow-sm"
											aria-hidden="true"
										>
											{initials(p.nama)}
										</span>
										<span class="min-w-0">
											<span class="block truncate font-semibold text-slate-900">{p.nama}</span>
											<span class="block truncate text-xs text-slate-500">{p.email}</span>
										</span>
									</div>
								</td>
								<td class="px-6 py-3.5">
									<span class="font-mono text-xs font-bold text-slate-700">{p.code}</span>
								</td>
								<td class="px-6 py-3.5">
									<span class={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${statusBadge(p.status)}`}>
										{statusLabel(p.status)}
									</span>
								</td>
								<td class="px-6 py-3.5 whitespace-nowrap text-slate-600">{formatDate(p.createdAt)}</td>
								<td class="px-6 py-3.5">
									<span class="block max-w-52 truncate text-slate-600" title={p.skill || '-'}>
										{p.skill || '-'}
									</span>
								</td>
								<td class="px-6 py-3.5">
									<div class="flex justify-end gap-2">
										<a
											href={`/admin/pengajuan-instruktur/${p.id}`}
											aria-label={`Lihat detail ${p.nama}`}
											title="Lihat detail"
											class="flex min-h-9 min-w-9 items-center justify-center rounded-lg border border-slate-200 p-2 text-slate-500 transition-colors hover:bg-slate-50 hover:text-teal-600 focus-visible:outline-2 focus-visible:outline-teal-600"
										>
											<i class="fa-solid fa-eye text-sm" aria-hidden="true"></i>
										</a>
									</div>
								</td>
							</tr>
						{/each}
					{/if}
				</tbody>
			</table>
		</div>
		{#if !loading && visible.length === 0}
			<p class="border-t border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
				{total === 0
					? 'Belum ada pengajuan. Minta pendaftar mengisi formulir /menjadi-instruktur/daftar.'
					: 'Tidak ada pengajuan yang cocok dengan pencarian.'}
			</p>
		{/if}
		<div class="border-t border-slate-100 bg-slate-50/70">
			<Pagination bind:page bind:perPage totalItems={total} itemLabel="pengajuan" label="Navigasi halaman tabel pengajuan" id="pengajuan-pagination" activeClass="bg-teal-600 text-white shadow-lg shadow-teal-600/25" />
		</div>
	</div>
</div>
