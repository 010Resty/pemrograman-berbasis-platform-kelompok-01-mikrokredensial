<script lang="ts">
	interface Instructor {
		id: number;
		name: string;
		email: string;
		expertise: string;
		courses: number;
		students: number;
		rating: number;
		status: 'Aktif' | 'Nonaktif';
	}

	let query = $state('');

	const instructors: Instructor[] = [
		{ id: 1, name: 'Kevin Perry', email: 'kevin@aristotle.ac.id', expertise: 'Desain UI/UX', courses: 8, students: 5420, rating: 4.8, status: 'Aktif' },
		{ id: 2, name: 'Max Alexix', email: 'max@aristotle.ac.id', expertise: 'Pengembangan Web', courses: 5, students: 3890, rating: 4.7, status: 'Aktif' },
		{ id: 3, name: 'Sarah Johnson', email: 'sarah@aristotle.ac.id', expertise: 'Pemasaran Digital', courses: 6, students: 2740, rating: 4.6, status: 'Aktif' },
		{ id: 4, name: 'Rian Pratama', email: 'rian@aristotle.ac.id', expertise: 'Sains Data & AI', courses: 4, students: 1980, rating: 4.9, status: 'Aktif' },
		{ id: 5, name: 'Dewi Anggraini', email: 'dewi@aristotle.ac.id', expertise: 'Keamanan Siber', courses: 3, students: 940, rating: 4.5, status: 'Nonaktif' },
		{ id: 6, name: 'Budi Santoso', email: 'budi@aristotle.ac.id', expertise: 'Jaringan Komputer', courses: 2, students: 620, rating: 4.4, status: 'Aktif' }
	];

	const filtered = $derived(
		instructors.filter((ins) => {
			const q = query.trim().toLowerCase();
			return !q || ins.name.toLowerCase().includes(q) || ins.expertise.toLowerCase().includes(q);
		})
	);
</script>

<svelte:head>
	<title>Instrukturs — Admin Aristotle</title>
	<meta name="description" content="Kelola instruktur platform Aristotle." />
</svelte:head>

<div class="p-4 sm:p-6 lg:p-8">
	<div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
		<div>
			<p class="text-xs font-bold tracking-widest text-blue-600 uppercase">Admin · Instrukturs</p>
			<h1 class="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Instrukturs</h1>
			<p class="mt-1 text-sm text-slate-500" role="status">{filtered.length} instruktur terdaftar</p>
		</div>
		<button type="button" class="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-violet-600/25 transition-colors hover:bg-violet-700 focus-visible:outline-2 focus-visible:outline-violet-600">
			<i class="fa-solid fa-chalkboard-user" aria-hidden="true"></i> Tambah Instruktur
		</button>
	</div>

	<div class="relative mb-6 max-w-md">
		<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
			<i class="fa-solid fa-magnifying-glass text-sm" aria-hidden="true"></i>
		</div>
		<label for="instructor-search" class="sr-only">Cari instruktur</label>
		<input id="instructor-search" type="search" bind:value={query} placeholder="Cari nama atau keahlian..." class="w-full rounded-xl border border-slate-200 bg-white py-2.5 pr-4 pl-10 text-sm focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 focus:outline-none" />
	</div>

	{#if filtered.length === 0}
		<div class="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
			<p class="text-sm font-semibold text-slate-700">Instruktur tidak ditemukan.</p>
		</div>
	{:else}
		<div class="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
			{#each filtered as ins (ins.id)}
				<article class="flex flex-col rounded-2xl border border-slate-200/70 bg-white p-6 transition-shadow hover:shadow-xl">
					<div class="mb-4 flex items-start justify-between gap-3">
						<div class="flex items-center gap-3">
							<span class="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-sm font-bold text-white" aria-hidden="true">
								{ins.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}
							</span>
							<div>
								<h2 class="text-sm font-bold text-slate-900">{ins.name}</h2>
								<p class="text-xs text-slate-500">{ins.email}</p>
							</div>
						</div>
						<span class={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${ins.status === 'Aktif' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-600'}`}>
							{ins.status}
						</span>
					</div>
					<p class="mb-4 inline-flex w-fit items-center gap-1.5 rounded-full bg-violet-50 px-3 py-1 text-[11px] font-bold text-violet-700">
						<i class="fa-solid fa-star" aria-hidden="true"></i> {ins.expertise}
					</p>
					<dl class="mb-5 grid grid-cols-3 gap-2 text-center">
						<div class="rounded-xl bg-slate-50 p-2.5">
							<dt class="sr-only">Jumlah course</dt>
							<dd class="text-base font-bold text-slate-900">{ins.courses}</dd>
							<dd class="text-[10px] font-medium text-slate-500 uppercase">Course</dd>
						</div>
						<div class="rounded-xl bg-slate-50 p-2.5">
							<dt class="sr-only">Jumlah mahasiswa</dt>
							<dd class="text-base font-bold text-slate-900">{ins.students.toLocaleString('id-ID')}</dd>
							<dd class="text-[10px] font-medium text-slate-500 uppercase">Siswa</dd>
						</div>
						<div class="rounded-xl bg-slate-50 p-2.5">
							<dt class="sr-only">Rating</dt>
							<dd class="text-base font-bold text-slate-900">★ {ins.rating}</dd>
							<dd class="text-[10px] font-medium text-slate-500 uppercase">Rating</dd>
						</div>
					</dl>
					<div class="mt-auto flex gap-2">
						<button type="button" class="flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-slate-900">
							<i class="fa-solid fa-eye" aria-hidden="true"></i> Profil
						</button>
						<button type="button" aria-label={`Ubah ${ins.name}`} class="flex min-h-10 min-w-10 items-center justify-center rounded-xl border border-slate-200 p-2.5 text-slate-500 transition-colors hover:bg-slate-50 hover:text-amber-600 focus-visible:outline-2 focus-visible:outline-amber-600">
							<i class="fa-solid fa-pen text-sm" aria-hidden="true"></i>
						</button>
					</div>
				</article>
			{/each}
		</div>
	{/if}
</div>
