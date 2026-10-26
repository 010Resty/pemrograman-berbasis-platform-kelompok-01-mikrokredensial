<script lang="ts">
	import Pagination from '$lib/components/Pagination.svelte';

	interface Participant {
		id: number;
		name: string;
		email: string;
		status: 'Aktif' | 'Nonaktif';
		joined: string;
		courses: number;
		/** Nilai rata-rata (0–100). Null bila peserta belum memiliki nilai. */
		score: number | null;
	}

	type Status = 'all' | 'Aktif' | 'Nonaktif';
	type SortOrder = 'default' | 'desc' | 'asc';

	let query = $state('');
	let filter = $state<Status>('all');
	let sortOrder = $state<SortOrder>('default');
	let page = $state(1);
	let perPage = $state(5);
	let showAdd = $state(false);
	let formName = $state('');
	let formEmail = $state('');
	let formStatus = $state<Exclude<Status, 'all'>>('Aktif');
	let formError = $state('');
	let isSubmitting = $state(false);
	let addBtn: HTMLButtonElement | null = $state(null);
	let firstField: HTMLInputElement | null = $state(null);
	let modalOpened = false;

	let participants = $state<Participant[]>([
		{ id: 1, name: 'Ahmad Farizi', email: 'ahmad@student.ac.id', status: 'Aktif', joined: '12 Jan 2026', courses: 6, score: 87 },
		{ id: 2, name: 'Sarah Johnson', email: 'sarah@student.ac.id', status: 'Aktif', joined: '28 Feb 2026', courses: 4, score: 91 },
		{ id: 3, name: 'Rian Pratama', email: 'rian@student.ac.id', status: 'Aktif', joined: '05 Mar 2026', courses: 1, score: 78 },
		{ id: 6, name: 'Dewi Lestari', email: 'dewi@student.ac.id', status: 'Nonaktif', joined: '02 Feb 2026', courses: 2, score: null }
	]);

	let nextId = $derived(participants.reduce((m, u) => Math.max(m, u.id), 0) + 1);

	function statusClass(s: Participant['status']) {
		if (s === 'Aktif') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
		return 'border-slate-200 bg-slate-100 text-slate-600';
	}

	function closeAdd() {
		showAdd = false;
		formName = '';
		formEmail = '';
		formStatus = 'Aktif';
		formError = '';
		isSubmitting = false;
	}

	$effect(() => {
		if (showAdd) {
			modalOpened = true;
			firstField?.focus();
		} else if (modalOpened) {
			addBtn?.focus();
		}
	});

	function openAdd() {
		formError = '';
		showAdd = true;
	}

	function submitAdd(event: Event) {
		event.preventDefault();
		if (isSubmitting) return;
		formError = '';
		const name = formName.trim();
		const email = formEmail.trim();
		if (!name) {
			formError = 'Nama lengkap wajib diisi.';
			return;
		}
		if (!email) {
			formError = 'Email wajib diisi.';
			return;
		}
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
			formError = 'Format email tidak valid.';
			return;
		}
		if (participants.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
			formError = 'Email sudah terdaftar di daftar ini.';
			return;
		}
		isSubmitting = true;
		participants = [
			...participants,
			{ id: nextId, name, email, status: formStatus, joined: 'Hari ini', courses: 0, score: null }
		];
		closeAdd();
	}

	const filtered = $derived(
		participants
			.filter((u) => {
				const mStatus = filter === 'all' || u.status === filter;
				const q = query.trim().toLowerCase();
				const mQuery = !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
				return mStatus && mQuery;
			})
			.sort((a, b) => {
				if (sortOrder === 'desc') return (b.score ?? -1) - (a.score ?? -1);
				if (sortOrder === 'asc') return (a.score ?? 101) - (b.score ?? 101);
				return 0;
			})
	);

	/* Kembali ke halaman 1 setiap filter/pencarian/urutan/jumlah baris berubah. */
	$effect(() => {
		void query;
		void filter;
		void sortOrder;
		void perPage;
		page = 1;
	});

	const paged = $derived(filtered.slice((page - 1) * perPage, page * perPage));
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
				{filtered.length} dari {participants.length} peserta ditampilkan
			</p>
			<p class="mt-1 text-xs text-slate-400">
				Halaman ini hanya memuat peserta. Kelola instruktur di menu
				<a href="/admin/instrukturs" class="font-semibold text-blue-600 hover:text-blue-700">Instruktur</a>.
			</p>
		</div>
		<button type="button" bind:this={addBtn} onclick={openAdd} class="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-blue-600/25 transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600">
			<i class="fa-solid fa-user-plus" aria-hidden="true"></i> Tambah Peserta
		</button>
	</div>

	<div class="mb-5 flex flex-col gap-3 lg:flex-row">
		<div class="relative max-w-md flex-1">
			<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
				<i class="fa-solid fa-magnifying-glass text-sm" aria-hidden="true"></i>
			</div>
			<label for="peserta-search" class="sr-only">Cari peserta</label>
			<input id="peserta-search" type="search" bind:value={query} placeholder="Cari nama atau email..." class="w-full rounded-xl border border-slate-200 bg-white py-2.5 pr-4 pl-10 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none" />
		</div>
		<div class="flex flex-wrap gap-2" role="group" aria-label="Filter status peserta">
			{#each (['all', 'Aktif', 'Nonaktif'] as Status[]) as s (s)}
				<button type="button" onclick={() => (filter = s)} aria-pressed={filter === s} class={`rounded-xl px-4 py-2 text-xs font-bold transition-colors focus-visible:outline-2 focus-visible:outline-blue-600 ${filter === s ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
					{s === 'all' ? 'Semua' : s}
				</button>
			{/each}
		</div>
		<div class="flex items-center gap-2">
			<label for="peserta-sort" class="text-xs font-bold text-slate-600">Urutkan</label>
			<select
				id="peserta-sort"
				bind:value={sortOrder}
				class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 focus:border-blue-500 focus:outline-none"
			>
				<option value="default">Bawaan</option>
				<option value="desc">Nilai tertinggi</option>
				<option value="asc">Nilai terendah</option>
			</select>
		</div>
	</div>

	<div class="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm">
		<div class="h-1 bg-gradient-to-r from-blue-600 via-sky-500 to-blue-600" aria-hidden="true"></div>
		<div class="overflow-x-auto">
			<table class="w-full min-w-[820px] text-sm">
				<caption class="sr-only">Daftar peserta platform Aristoteles</caption>
				<thead class="bg-blue-700 text-white">
					<tr class="[&_th]:py-3.5 [&_th]:align-middle">
						<th scope="col" class="px-6 text-left text-xs font-bold tracking-wider uppercase">Peserta</th>
						<th scope="col" class="px-6 text-center text-xs font-bold tracking-wider uppercase">Kursus</th>
						<th scope="col" class="px-6 text-center text-xs font-bold tracking-wider uppercase">Nilai</th>
						<th scope="col" class="px-6 text-left text-xs font-bold tracking-wider uppercase">Bergabung</th>
						<th scope="col" class="px-6 text-center text-xs font-bold tracking-wider uppercase">Status</th>
						<th scope="col" class="px-6 text-right text-xs font-bold tracking-wider uppercase">Aksi</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-100">
					{#each paged as u, i (u.id)}
						<tr class={`transition-colors hover:bg-blue-50/50 ${i % 2 === 1 ? 'bg-slate-50/60' : 'bg-white'}`}>
							<td class="px-6 py-3.5">
								<div class="flex items-center gap-3">
									<span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-sky-500 text-xs font-bold text-white shadow-sm" aria-hidden="true">
										{u.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}
									</span>
									<span>
										<span class="block font-semibold text-slate-900">{u.name}</span>
										<span class="block text-xs text-slate-500">{u.email}</span>
									</span>
								</div>
							</td>
							<td class="px-6 py-3.5 text-center font-bold text-slate-800 tabular-nums">{u.courses}</td>
							<td class="px-6 py-3.5 text-center font-bold text-slate-800 tabular-nums">
								{#if u.score === null}
									<span class="font-semibold text-slate-400">—</span>
								{:else}
									<span class={`inline-flex min-w-11 items-center justify-center rounded-lg px-2 py-0.5 ${u.score >= 85 ? 'bg-emerald-50 text-emerald-700' : u.score >= 70 ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>{u.score}</span>
								{/if}
							</td>
							<td class="px-6 py-3.5 whitespace-nowrap text-slate-600">{u.joined}</td>
							<td class="px-6 py-3.5 text-center">
								<span class={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${statusClass(u.status)}`}><span class="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true"></span>{u.status}</span>
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
		{#if filtered.length === 0}
			<p class="border-t border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">Tidak ada peserta yang cocok dengan pencarian.</p>
		{/if}
		<div class="border-t border-slate-100 bg-slate-50/70">
			<Pagination bind:page bind:perPage totalItems={filtered.length} itemLabel="peserta" label="Navigasi halaman tabel peserta" id="peserta-pagination" activeClass="bg-blue-600 text-white shadow-lg shadow-blue-600/25" />
		</div>
	</div>

	{#if showAdd}
		<div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true" aria-labelledby="add-peserta-title" tabindex="-1" onclick={(e) => { if (e.target === e.currentTarget) closeAdd(); }} onkeydown={(e) => { if (e.key === 'Escape') closeAdd(); }}>
			<form onsubmit={submitAdd} class="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
				<h2 id="add-peserta-title" class="text-lg font-bold text-slate-900">Tambah Peserta</h2>
				<p class="mt-0.5 text-xs text-slate-500">Peserta baru langsung tampil di daftar (data lokal browser, belum tersimpan permanen).</p>
				{#if formError}
					<p role="alert" class="mt-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-semibold text-red-700">{formError}</p>
				{/if}
				<div class="mt-4 space-y-3">
					<div>
						<label for="add-name" class="mb-1 block text-xs font-bold text-slate-700">Nama lengkap</label>
						<input id="add-name" type="text" bind:this={firstField} bind:value={formName} required placeholder="cth. Budi Santoso" class="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none" />
					</div>
					<div>
						<label for="add-email" class="mb-1 block text-xs font-bold text-slate-700">Email</label>
						<input id="add-email" type="email" bind:value={formEmail} required placeholder="nama@email.com" class="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none" />
					</div>
					<div>
						<label for="add-status" class="mb-1 block text-xs font-bold text-slate-700">Status</label>
						<select id="add-status" bind:value={formStatus} class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none">
							<option>Aktif</option>
							<option>Nonaktif</option>
						</select>
					</div>
				</div>
				<div class="mt-5 flex gap-2">
					<button type="button" onclick={closeAdd} class="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50">
						Batal
					</button>
					<button type="submit" disabled={isSubmitting} class="flex-1 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
						Simpan Peserta
					</button>
				</div>
			</form>
		</div>
	{/if}
</div>
