<script lang="ts">
	type Status = 'all' | 'Aktif' | 'Pending' | 'Nonaktif';

	interface User {
		id: number;
		name: string;
		email: string;
		role: string;
		status: Exclude<Status, 'all'>;
		joined: string;
		courses: number;
	}

	let query = $state('');
	let filter = $state<Status>('all');

	const users: User[] = [
		{ id: 1, name: 'Ahmad Farizi', email: 'ahmad@student.ac.id', role: 'Mahasiswa', status: 'Aktif', joined: '12 Jan 2026', courses: 6 },
		{ id: 2, name: 'Sarah Johnson', email: 'sarah@student.ac.id', role: 'Mahasiswa', status: 'Aktif', joined: '28 Feb 2026', courses: 4 },
		{ id: 3, name: 'Rian Pratama', email: 'rian@student.ac.id', role: 'Mahasiswa', status: 'Pending', joined: '05 Mar 2026', courses: 1 },
		{ id: 4, name: 'Kevin Perry', email: 'kevin@aristotle.ac.id', role: 'Instruktur', status: 'Aktif', joined: '10 Jan 2026', courses: 8 },
		{ id: 5, name: 'Max Alexix', email: 'max@aristotle.ac.id', role: 'Instruktur', status: 'Aktif', joined: '18 Jan 2026', courses: 5 },
		{ id: 6, name: 'Dewi Lestari', email: 'dewi@student.ac.id', role: 'Mahasiswa', status: 'Nonaktif', joined: '02 Feb 2026', courses: 2 }
	];

	const filtered = $derived(
		users.filter((u) => {
			const mStatus = filter === 'all' || u.status === filter;
			const q = query.trim().toLowerCase();
			const mQuery = !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
			return mStatus && mQuery;
		})
	);

	function statusClass(s: User['status']) {
		if (s === 'Aktif') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
		if (s === 'Pending') return 'border-amber-200 bg-amber-50 text-amber-700';
		return 'border-slate-200 bg-slate-100 text-slate-600';
	}
</script>

<svelte:head>
	<title>Users — Admin Aristotle</title>
	<meta name="description" content="Kelola pengguna platform Aristotle." />
</svelte:head>

<div class="p-4 sm:p-6 lg:p-8">
	<div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
		<div>
			<p class="text-xs font-bold tracking-widest text-blue-600 uppercase">Admin · Users</p>
			<h1 class="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Users</h1>
			<p class="mt-1 text-sm text-slate-500" role="status">
				{filtered.length} dari {users.length} pengguna ditampilkan
			</p>
		</div>
		<button type="button" class="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-blue-600/25 transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600">
			<i class="fa-solid fa-user-plus" aria-hidden="true"></i> Tambah User
		</button>
	</div>

	<div class="mb-5 flex flex-col gap-3 lg:flex-row">
		<div class="relative max-w-md flex-1">
			<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
				<i class="fa-solid fa-magnifying-glass text-sm" aria-hidden="true"></i>
			</div>
			<label for="user-search" class="sr-only">Cari user</label>
			<input id="user-search" type="search" bind:value={query} placeholder="Cari nama atau email..." class="w-full rounded-xl border border-slate-200 bg-white py-2.5 pr-4 pl-10 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none" />
		</div>
		<div class="flex flex-wrap gap-2" role="group" aria-label="Filter status user">
			{#each (['all', 'Aktif', 'Pending', 'Nonaktif'] as Status[]) as s (s)}
				<button type="button" onclick={() => (filter = s)} aria-pressed={filter === s} class={`rounded-xl px-4 py-2 text-xs font-bold transition-colors focus-visible:outline-2 focus-visible:outline-blue-600 ${filter === s ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
					{s === 'all' ? 'Semua' : s}
				</button>
			{/each}
		</div>
	</div>

	<div class="overflow-hidden rounded-2xl border border-slate-200/70 bg-white">
		<div class="overflow-x-auto">
			<table class="w-full min-w-[720px] text-sm">
				<caption class="sr-only">Daftar pengguna platform Aristotle</caption>
				<thead class="bg-slate-900 text-white">
					<tr>
						<th scope="col" class="px-6 py-3.5 text-left text-xs font-bold tracking-wider uppercase">Pengguna</th>
						<th scope="col" class="px-6 py-3.5 text-left text-xs font-bold tracking-wider uppercase">Role</th>
						<th scope="col" class="px-6 py-3.5 text-center text-xs font-bold tracking-wider uppercase">Kursus</th>
						<th scope="col" class="px-6 py-3.5 text-left text-xs font-bold tracking-wider uppercase">Bergabung</th>
						<th scope="col" class="px-6 py-3.5 text-center text-xs font-bold tracking-wider uppercase">Status</th>
						<th scope="col" class="px-6 py-3.5 text-right text-xs font-bold tracking-wider uppercase">Aksi</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-100">
					{#each filtered as u (u.id)}
						<tr class="transition-colors hover:bg-blue-50/40">
							<td class="px-6 py-3.5">
								<div class="flex items-center gap-3">
									<span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-700" aria-hidden="true">
										{u.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}
									</span>
									<span>
										<span class="block font-semibold text-slate-900">{u.name}</span>
										<span class="block text-xs text-slate-500">{u.email}</span>
									</span>
								</div>
							</td>
							<td class="px-6 py-3.5 text-slate-600">{u.role}</td>
							<td class="px-6 py-3.5 text-center font-bold text-slate-800">{u.courses}</td>
							<td class="px-6 py-3.5 text-slate-600">{u.joined}</td>
							<td class="px-6 py-3.5 text-center">
								<span class={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${statusClass(u.status)}`}>{u.status}</span>
							</td>
							<td class="px-6 py-3.5">
								<div class="flex justify-end gap-2">
									<button type="button" aria-label={`Lihat detail ${u.name}`} class="flex min-h-9 min-w-9 items-center justify-center rounded-lg border border-slate-200 p-2 text-slate-500 transition-colors hover:bg-slate-50 hover:text-blue-600 focus-visible:outline-2 focus-visible:outline-blue-600">
										<i class="fa-solid fa-eye text-sm" aria-hidden="true"></i>
									</button>
									<button type="button" aria-label={`Ubah ${u.name}`} class="flex min-h-9 min-w-9 items-center justify-center rounded-lg border border-slate-200 p-2 text-slate-500 transition-colors hover:bg-slate-50 hover:text-amber-600 focus-visible:outline-2 focus-visible:outline-amber-600">
										<i class="fa-solid fa-pen text-sm" aria-hidden="true"></i>
									</button>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		{#if filtered.length === 0}
			<p class="p-8 text-center text-sm text-slate-500">Tidak ada user yang cocok dengan pencarian.</p>
		{/if}
	</div>
</div>
