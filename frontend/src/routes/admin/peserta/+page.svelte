<script lang="ts">
	import { browser } from '$app/environment';
	import Pagination from '$lib/components/Pagination.svelte';
	import { fetchAdminUsers, type AdminUser } from '$lib/api/admin';

	/**
	 * Daftar peserta dari backend (GET /api/v1/admin/users?role=student).
	 * Pencarian, filter status, dan paginasi berjalan di server.
	 * Kolom jumlah kursus & nilai tidak ditampilkan: tidak ada kontrak
	 * backend yang mendukungnya (rubrik/format nilai belum diputuskan K-02/K-06).
	 * Penambahan akun manual tidak tersedia: peserta mendaftar mandiri,
	 * akun teacher hanya via undangan admin (K-01).
	 */

	type Status = 'all' | 'Aktif' | 'Nonaktif';

	let query = $state('');
	let debouncedQuery = $state('');
	let filter = $state<Status>('all');
	let page = $state(1);
	let perPage = $state(5);
	let users = $state<AdminUser[]>([]);
	let total = $state(0);
	let loading = $state(true);
	let loadError = $state('');
	let loadSeq = 0;
	let lastPerPage: number | null = null;

	function statusClass(active: boolean): string {
		if (active) return 'border-emerald-200 bg-emerald-50 text-emerald-700';
		return 'border-slate-200 bg-slate-100 text-slate-600';
	}

	function formatDate(iso: string): string {
		const d = new Date(iso);
		return Number.isNaN(d.getTime())
			? iso
			: d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
	}

	function initials(name: string): string {
		return (
			name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?'
		);
	}

	async function load(): Promise<void> {
		const my = ++loadSeq;
		loading = true;
		loadError = '';
		try {
			const res = await fetchAdminUsers({
				role: 'student',
				q: debouncedQuery.trim() || undefined,
				isActive: filter === 'all' ? undefined : filter === 'Aktif',
				limit: perPage,
				page
			});
			if (my !== loadSeq) return;
			// Pertahanan lapis kedua: hanya tampilkan role student,
			// walau backend mengembalikan role lain.
			users = res.items.filter((u) => u.role === 'student');
			total = res.items.some((u) => u.role !== 'student') ? users.length : res.total;
		} catch (e) {
			if (my !== loadSeq) return;
			loadError = e instanceof Error ? e.message : 'Gagal memuat peserta.';
		} finally {
			if (my === loadSeq) loading = false;
		}
	}

	// Debounce pencarian 400 ms + kembali ke halaman 1.
	$effect(() => {
		const q = query;
		const t = setTimeout(() => {
			if (debouncedQuery !== q) {
				debouncedQuery = q;
				page = 1;
			}
		}, 400);
		return () => clearTimeout(t);
	});

	// Ganti jumlah baris → kembali ke halaman 1.
	$effect(() => {
		const pp = perPage;
		if (lastPerPage !== null && pp !== lastPerPage) page = 1;
		lastPerPage = pp;
	});

	$effect(() => {
		if (!browser) return;
		void filter;
		void page;
		void perPage;
		void debouncedQuery;
		void load();
	});

	function setFilter(s: Status): void {
		filter = s;
		page = 1;
	}
</script>

<svelte:head>
	<title>Peserta — Admin Aristoteles</title>
	<meta name="description" content="Kelola peserta platform Aristoteles." />
</svelte:head>

<div class="p-4 sm:p-6 lg:p-8">
	<div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
		<div>
			<p class="text-xs font-bold tracking-widest text-blue-600 uppercase">Admin · Peserta</p>
			<h1 class="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Peserta</h1>
			<p class="mt-1 text-sm text-slate-500" role="status">
				{total} peserta terdaftar
			</p>
			<p class="mt-1 text-xs text-slate-400">
				Peserta mendaftar mandiri. Kelola instruktur di menu
				<a href="/admin/instrukturs" class="font-semibold text-blue-600 hover:text-blue-700">Instruktur</a>.
			</p>
		</div>
	</div>

	<div class="mb-5 flex flex-col gap-3 lg:flex-row">
		<div class="relative max-w-md flex-1">
			<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
				<i class="fa-solid fa-magnifying-glass text-sm" aria-hidden="true"></i>
			</div>
			<label for="peserta-search" class="sr-only">Cari peserta</label>
			<input id="peserta-search" type="search" bind:value={query} placeholder="Cari nama atau email..." autocomplete="off" class="w-full rounded-xl border border-slate-200 bg-white py-2.5 pr-4 pl-10 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none" />
		</div>
		<div class="flex flex-wrap gap-2" role="group" aria-label="Filter status peserta">
			{#each (['all', 'Aktif', 'Nonaktif'] as Status[]) as s (s)}
				<button type="button" onclick={() => setFilter(s)} aria-pressed={filter === s} class={`rounded-xl px-4 py-2 text-xs font-bold transition-colors focus-visible:outline-2 focus-visible:outline-blue-600 ${filter === s ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
					{s === 'all' ? 'Semua' : s}
				</button>
			{/each}
		</div>
	</div>

	{#if loading}
		<div class="overflow-hidden rounded-2xl border border-slate-200/70 bg-white" aria-label="Memuat peserta">
			<div class="space-y-0 divide-y divide-slate-100">
				{#each [1, 2, 3, 4, 5] as i (i)}
					<div class="flex items-center gap-3 px-6 py-3.5">
						<div class="h-10 w-10 shrink-0 animate-pulse rounded-full bg-slate-100"></div>
						<div class="min-w-0 flex-1 space-y-1.5">
							<div class="h-4 w-40 animate-pulse rounded bg-slate-100"></div>
							<div class="h-3 w-56 animate-pulse rounded bg-slate-100"></div>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{:else if loadError}
		<div role="alert" class="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
			<p class="text-sm font-bold text-red-700">Daftar peserta belum dapat dimuat</p>
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
		<div class="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm">
			<div class="h-1 bg-gradient-to-r from-blue-600 via-sky-500 to-blue-600" aria-hidden="true"></div>
			<div class="overflow-x-auto">
				<table class="w-full min-w-[640px] text-sm">
					<caption class="sr-only">Daftar peserta platform Aristoteles</caption>
					<thead class="bg-blue-700 text-white">
						<tr class="[&_th]:py-3.5 [&_th]:align-middle">
							<th scope="col" class="px-6 text-left text-xs font-bold tracking-wider uppercase">Peserta</th>
							<th scope="col" class="px-6 text-left text-xs font-bold tracking-wider uppercase">Bergabung</th>
							<th scope="col" class="px-6 text-center text-xs font-bold tracking-wider uppercase">Status</th>
							<th scope="col" class="px-6 text-right text-xs font-bold tracking-wider uppercase">Aksi</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-slate-100">
						{#each users as u, i (u.id)}
							<tr class={`transition-colors hover:bg-blue-50/50 ${i % 2 === 1 ? 'bg-slate-50/60' : 'bg-white'}`}>
								<td class="px-6 py-3.5">
									<div class="flex items-center gap-3">
										<span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-sky-500 text-xs font-bold text-white shadow-sm" aria-hidden="true">
											{initials(u.name)}
										</span>
										<span>
											<span class="block font-semibold text-slate-900">{u.name}</span>
											<span class="block text-xs text-slate-500">{u.email}</span>
										</span>
									</div>
								</td>
								<td class="px-6 py-3.5 whitespace-nowrap text-slate-600">{formatDate(u.createdAt)}</td>
								<td class="px-6 py-3.5 text-center">
									<span class={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${statusClass(u.isActive)}`}><span class="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true"></span>{u.isActive ? 'Aktif' : 'Nonaktif'}</span>
								</td>
								<td class="px-6 py-3.5">
									<div class="flex justify-end gap-2">
										<a
											href={`/admin/peserta/${u.id}`}
											aria-label={`Lihat detail ${u.name}`}
											class="flex min-h-9 min-w-9 items-center justify-center rounded-lg border border-slate-200 p-2 text-slate-500 shadow-xs transition-all hover:-translate-y-px hover:bg-slate-50 hover:text-blue-600 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-blue-600"
										>
											<i class="fa-solid fa-eye text-sm" aria-hidden="true"></i>
										</a>
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			{#if users.length === 0}
				<p class="border-t border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">Tidak ada peserta yang cocok dengan pencarian.</p>
			{/if}
			<div class="border-t border-slate-100 bg-slate-50/70">
				<Pagination bind:page bind:perPage totalItems={total} itemLabel="peserta" label="Navigasi halaman tabel peserta" id="peserta-pagination" activeClass="bg-blue-600 text-white shadow-lg shadow-blue-600/25" />
			</div>
		</div>
	{/if}
</div>
