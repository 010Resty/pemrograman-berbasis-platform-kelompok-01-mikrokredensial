<script lang="ts">
	import { browser } from '$app/environment';
	import Pagination from '$lib/components/Pagination.svelte';
	import { fetchAdminUsers, type AdminUser } from '$lib/api/admin';

	/**
	 * Daftar instruktur dari backend (GET /api/v1/admin/users?role=teacher).
	 * Pencarian, filter status, dan paginasi berjalan di server.
	 * Kartu hanya memakai kolom kontrak backend (nama/email/status/bergabung):
	 * keahlian, jumlah kursus/siswa, dan peringkat tidak ada endpointnya
	 * sehingga tidak ditampilkan (jangan mengarang).
	 * Akun teacher baru hanya via undangan admin (K-01) — tombol di bawah
	 * mengarah ke /admin/invitations. Tombol Ubah per baris dihapus:
	 * belum ada kontrak API untuk ubah nama/email/keahlian
	 * (PATCH /admin/users/:id hanya mendukung isActive).
	 */

	type Status = 'all' | 'Aktif' | 'Nonaktif';

	let query = $state('');
	let debouncedQuery = $state('');
	let filter = $state<Status>('all');
	let page = $state(1);
	let perPage = $state(6);
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
				role: 'teacher',
				q: debouncedQuery.trim() || undefined,
				isActive: filter === 'all' ? undefined : filter === 'Aktif',
				limit: perPage,
				page
			});
			if (my !== loadSeq) return;
			// Pertahanan lapis kedua: hanya tampilkan role teacher,
			// walau backend mengembalikan role lain.
			users = res.items.filter((u) => u.role === 'teacher');
			total = res.items.some((u) => u.role !== 'teacher') ? users.length : res.total;
		} catch (e) {
			if (my !== loadSeq) return;
			loadError = e instanceof Error ? e.message : 'Gagal memuat instruktur.';
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
	<title>Instruktur — Admin Aristoteles</title>
	<meta name="description" content="Kelola instruktur platform Aristoteles." />
</svelte:head>

<div class="p-4 sm:p-6 lg:p-8">
	<div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
		<div>
			<p class="text-xs font-bold tracking-widest text-violet-600 uppercase">Admin · Instruktur</p>
			<h1 class="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Instruktur</h1>
			<p class="mt-1 text-sm text-slate-500" role="status">{total} instruktur terdaftar</p>
			<p class="mt-1 text-xs text-slate-400">Akun instruktur baru hanya dapat ditambahkan melalui undangan.</p>
		</div>
		<a
			href="/admin/invitations"
			class="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-violet-600/25 transition-colors hover:bg-violet-700 focus-visible:outline-2 focus-visible:outline-violet-600"
		>
			<i class="fa-solid fa-envelope-open-text" aria-hidden="true"></i> Undang Instruktur
		</a>
	</div>

	<div class="mb-5 flex flex-col gap-3 lg:flex-row">
		<div class="relative max-w-md flex-1">
			<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
				<i class="fa-solid fa-magnifying-glass text-sm" aria-hidden="true"></i>
			</div>
			<label for="instructor-search" class="sr-only">Cari instruktur</label>
			<input id="instructor-search" type="search" bind:value={query} placeholder="Cari nama atau email..." autocomplete="off" class="w-full rounded-xl border border-slate-200 bg-white py-2.5 pr-4 pl-10 text-sm focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 focus:outline-none" />
		</div>
		<div class="flex flex-wrap gap-2" role="group" aria-label="Filter status instruktur">
			{#each (['all', 'Aktif', 'Nonaktif'] as Status[]) as s (s)}
				<button type="button" onclick={() => setFilter(s)} aria-pressed={filter === s} class={`rounded-xl px-4 py-2 text-xs font-bold transition-colors focus-visible:outline-2 focus-visible:outline-violet-600 ${filter === s ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/25' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
					{s === 'all' ? 'Semua' : s}
				</button>
			{/each}
		</div>
	</div>

	{#if loading}
		<div class="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3" aria-label="Memuat instruktur">
			{#each [1, 2, 3, 4, 5, 6] as i (i)}
				<div class="rounded-2xl border border-slate-200/70 bg-white p-6">
					<div class="mb-4 flex items-center gap-3">
						<div class="h-12 w-12 shrink-0 animate-pulse rounded-2xl bg-slate-100"></div>
						<div class="min-w-0 flex-1 space-y-1.5">
							<div class="h-4 w-32 animate-pulse rounded bg-slate-100"></div>
							<div class="h-3 w-44 animate-pulse rounded bg-slate-100"></div>
						</div>
					</div>
					<div class="h-3 w-28 animate-pulse rounded bg-slate-100"></div>
				</div>
			{/each}
		</div>
	{:else if loadError}
		<div role="alert" class="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
			<p class="text-sm font-bold text-red-700">Daftar instruktur belum dapat dimuat</p>
			<p class="mx-auto mt-1 max-w-md text-xs text-red-600">{loadError}</p>
			<button
				type="button"
				onclick={() => void load()}
				class="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-red-600"
			>
				<i class="fa-solid fa-rotate-right" aria-hidden="true"></i> Coba lagi
			</button>
		</div>
	{:else if users.length === 0}
		<div class="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
			<p class="text-sm font-semibold text-slate-700">Instruktur tidak ditemukan.</p>
			<p class="mx-auto mt-1 max-w-md text-xs text-slate-500">Coba kata kunci atau filter status lain, atau undang instruktur baru.</p>
		</div>
	{:else}
		<div class="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm">
			<div class="h-1 bg-gradient-to-r from-violet-600 via-indigo-500 to-violet-600" aria-hidden="true"></div>
			<div class="grid grid-cols-1 gap-5 p-5 md:grid-cols-2 xl:grid-cols-3">
				{#each users as u (u.id)}
					<article class="flex flex-col rounded-2xl border border-slate-200/70 bg-white p-6 transition-shadow hover:shadow-xl">
						<div class="mb-4 flex items-start justify-between gap-3">
							<div class="flex min-w-0 items-center gap-3">
								<span class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-sm font-bold text-white" aria-hidden="true">
									{initials(u.name)}
								</span>
								<div class="min-w-0">
									<h2 class="truncate text-sm font-bold text-slate-900">{u.name}</h2>
									<p class="truncate text-xs text-slate-500">{u.email}</p>
								</div>
							</div>
							<span class={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${statusClass(u.isActive)}`}>
								<span class="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true"></span>{u.isActive ? 'Aktif' : 'Nonaktif'}
							</span>
						</div>
						<p class="mb-5 text-xs text-slate-500">Bergabung {formatDate(u.createdAt)}</p>
						<div class="mt-auto">
							<a
								href={`/admin/instrukturs/${u.id}`}
								aria-label={`Lihat profil ${u.name}`}
								class="flex flex-1 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-violet-700 focus-visible:outline-2 focus-visible:outline-violet-600"
							>
								<i class="fa-solid fa-eye" aria-hidden="true"></i> Profil
							</a>
						</div>
					</article>
				{/each}
			</div>
			<div class="border-t border-slate-100 bg-slate-50/70">
				<Pagination bind:page bind:perPage perPageOptions={[6, 12, 24]} totalItems={total} itemLabel="instruktur" label="Navigasi halaman daftar instruktur" id="instruktur-pagination" activeClass="bg-violet-600 text-white shadow-lg shadow-violet-600/25" />
			</div>
		</div>
	{/if}

</div>
