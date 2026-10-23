<script lang="ts">
	type Status = 'all' | 'Published' | 'Draft' | 'Archived';

	interface Course {
		id: number;
		title: string;
		category: string;
		instructor: string;
		lessons: number;
		students: number;
		rating: number;
		status: Exclude<Status, 'all'>;
		updated: string;
	}

	let query = $state('');
	let filter = $state<Status>('all');
	let showAdd = $state(false);
	let formTitle = $state('');
	let formCategory = $state('');
	let formInstructor = $state('');

	let courses = $state<Course[]>([
		{ id: 1, title: 'Belajar Figma – Desain UI/UX Esensial', category: 'Desain UI/UX', instructor: 'Kevin Perry', lessons: 12, students: 2450, rating: 4.8, status: 'Published', updated: '20 Agu 2026' },
		{ id: 2, title: 'Sistem PHP & JS untuk Pendidikan', category: 'Pengembangan Web', instructor: 'Max Alexix', lessons: 8, students: 1920, rating: 4.7, status: 'Published', updated: '15 Agu 2026' },
		{ id: 3, title: 'Statistik TI & Analisis Bisnis', category: 'Sains Data', instructor: 'Kevin Perry', lessons: 16, students: 2180, rating: 4.7, status: 'Published', updated: '10 Agu 2026' },
		{ id: 4, title: 'Android 12 & Kotlin Lanjutan', category: 'Pengembangan Web', instructor: 'Max Alexix', lessons: 10, students: 1750, rating: 4.7, status: 'Published', updated: '02 Agu 2026' },
		{ id: 5, title: 'Machine Learning Dasar', category: 'Sains Data', instructor: 'Rian Pratama', lessons: 14, students: 860, rating: 4.9, status: 'Draft', updated: '28 Jul 2026' },
		{ id: 6, title: 'Keamanan Siber Fundamental', category: 'Keamanan', instructor: 'Dewi Anggraini', lessons: 6, students: 320, rating: 4.5, status: 'Draft', updated: '20 Jul 2026' },
		{ id: 7, title: 'Jaringan Komputer Legacy 2019', category: 'Jaringan', instructor: 'Budi Santoso', lessons: 7, students: 410, rating: 4.1, status: 'Archived', updated: '10 Jan 2026' }
	]);

	const filtered = $derived(
		courses.filter((c) => {
			const mStatus = filter === 'all' || c.status === filter;
			const q = query.trim().toLowerCase();
			const mQuery = !q || c.title.toLowerCase().includes(q) || c.instructor.toLowerCase().includes(q);
			return mStatus && mQuery;
		})
	);

	function statusClass(s: Course['status']) {
		if (s === 'Published') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
		if (s === 'Draft') return 'border-amber-200 bg-amber-50 text-amber-700';
		return 'border-slate-200 bg-slate-100 text-slate-600';
	}

	let nextId = $derived(courses.reduce((m, c) => Math.max(m, c.id), 0) + 1);

	function closeAdd() {
		showAdd = false;
		formTitle = '';
		formCategory = '';
		formInstructor = '';
	}

	function submitAdd(event: Event) {
		event.preventDefault();
		if (!formTitle.trim()) return;
		courses = [
			...courses,
			{
				id: nextId,
				title: formTitle.trim(),
				category: formCategory.trim() || 'Umum',
				instructor: formInstructor.trim() || 'Tim Aristoteles',
				lessons: 0,
				students: 0,
				rating: 5.0,
				status: 'Draft',
				updated: 'Hari ini'
			}
		];
		closeAdd();
	}
</script>

<svelte:head>
	<title>Courses — Admin Aristoteles</title>
	<meta name="description" content="Kelola course mikrokredensial Aristoteles." />
</svelte:head>

<div class="p-4 sm:p-6 lg:p-8">
	<div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
		<div>
			<p class="text-xs font-bold tracking-widest text-blue-600 uppercase">Admin · Courses</p>
			<h1 class="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Courses</h1>
			<p class="mt-1 text-sm text-slate-500" role="status">
				{filtered.length} dari {courses.length} course ditampilkan
			</p>
		</div>
		<button type="button" onclick={() => (showAdd = true)} class="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-600/25 transition-colors hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-emerald-600">
			<i class="fa-solid fa-plus" aria-hidden="true"></i> Buat Course
		</button>
	</div>

	<div class="mb-5 flex flex-col gap-3 lg:flex-row">
		<div class="relative max-w-md flex-1">
			<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
				<i class="fa-solid fa-magnifying-glass text-sm" aria-hidden="true"></i>
			</div>
			<label for="course-search" class="sr-only">Cari course</label>
			<input id="course-search" type="search" bind:value={query} placeholder="Cari judul atau instruktur..." class="w-full rounded-xl border border-slate-200 bg-white py-2.5 pr-4 pl-10 text-sm focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 focus:outline-none" />
		</div>
		<div class="flex flex-wrap gap-2" role="group" aria-label="Filter status course">
			{#each (['all', 'Published', 'Draft', 'Archived'] as Status[]) as s (s)}
				<button type="button" onclick={() => (filter = s)} aria-pressed={filter === s} class={`rounded-xl px-4 py-2 text-xs font-bold transition-colors focus-visible:outline-2 focus-visible:outline-emerald-600 ${filter === s ? 'bg-slate-900 text-white shadow-lg' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
					{s === 'all' ? 'Semua' : s}
				</button>
			{/each}
		</div>
	</div>

	<div class="overflow-hidden rounded-2xl border border-slate-200/70 bg-white">
		<div class="overflow-x-auto">
			<table class="w-full min-w-[820px] text-sm">
				<caption class="sr-only">Daftar course platform Aristoteles</caption>
				<thead class="bg-slate-900 text-white">
					<tr>
						<th scope="col" class="px-6 py-3.5 text-left text-xs font-bold tracking-wider uppercase">Course</th>
						<th scope="col" class="px-6 py-3.5 text-left text-xs font-bold tracking-wider uppercase">Kategori</th>
						<th scope="col" class="px-6 py-3.5 text-center text-xs font-bold tracking-wider uppercase">Materi</th>
						<th scope="col" class="px-6 py-3.5 text-center text-xs font-bold tracking-wider uppercase">Peserta</th>
						<th scope="col" class="px-6 py-3.5 text-center text-xs font-bold tracking-wider uppercase">Rating</th>
						<th scope="col" class="px-6 py-3.5 text-center text-xs font-bold tracking-wider uppercase">Status</th>
						<th scope="col" class="px-6 py-3.5 text-right text-xs font-bold tracking-wider uppercase">Aksi</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-100">
					{#each filtered as c (c.id)}
						<tr class="transition-colors hover:bg-emerald-50/40">
							<td class="px-6 py-3.5">
								<span class="block max-w-64 truncate font-semibold text-slate-900">{c.title}</span>
								<span class="block text-xs text-slate-500">{c.instructor} · Update {c.updated}</span>
							</td>
							<td class="px-6 py-3.5">
								<span class="inline-flex rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-blue-700">{c.category}</span>
							</td>
							<td class="px-6 py-3.5 text-center font-semibold text-slate-800">{c.lessons}</td>
							<td class="px-6 py-3.5 text-center font-semibold text-slate-800">{c.students.toLocaleString('id-ID')}</td>
							<td class="px-6 py-3.5 text-center font-semibold text-amber-600">★ {c.rating}</td>
							<td class="px-6 py-3.5 text-center">
								<span class={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${statusClass(c.status)}`}>{c.status}</span>
							</td>
							<td class="px-6 py-3.5">
								<div class="flex justify-end gap-2">
									<button type="button" aria-label={`Lihat ${c.title}`} class="flex min-h-9 min-w-9 items-center justify-center rounded-lg border border-slate-200 p-2 text-slate-500 transition-colors hover:bg-slate-50 hover:text-blue-600 focus-visible:outline-2 focus-visible:outline-blue-600">
										<i class="fa-solid fa-eye text-sm" aria-hidden="true"></i>
									</button>
									<button type="button" aria-label={`Ubah ${c.title}`} class="flex min-h-9 min-w-9 items-center justify-center rounded-lg border border-slate-200 p-2 text-slate-500 transition-colors hover:bg-slate-50 hover:text-amber-600 focus-visible:outline-2 focus-visible:outline-amber-600">
										<i class="fa-solid fa-pen text-sm" aria-hidden="true"></i>
									</button>
									<button type="button" aria-label={`Hapus ${c.title}`} class="flex min-h-9 min-w-9 items-center justify-center rounded-lg border border-slate-200 p-2 text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:outline-2 focus-visible:outline-red-500">
										<i class="fa-solid fa-trash text-sm" aria-hidden="true"></i>
									</button>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		{#if filtered.length === 0}
			<p class="p-8 text-center text-sm text-slate-500">Tidak ada course yang cocok dengan pencarian.</p>
		{/if}
	</div>

	{#if showAdd}
		<div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true" aria-labelledby="add-course-title">
			<form onsubmit={submitAdd} class="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
				<h2 id="add-course-title" class="text-lg font-bold text-slate-900">Buat Course</h2>
				<p class="mt-0.5 text-xs text-slate-500">Course baru tersimpan sebagai Draft.</p>
				<div class="mt-4 space-y-3">
					<div>
						<label for="course-title" class="mb-1 block text-xs font-bold text-slate-700">Judul course</label>
						<input id="course-title" type="text" bind:value={formTitle} required placeholder="cth. Desain UI/UX Lanjutan" class="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 focus:outline-none" />
					</div>
					<div class="grid grid-cols-2 gap-3">
						<div>
							<label for="course-cat" class="mb-1 block text-xs font-bold text-slate-700">Kategori</label>
							<input id="course-cat" type="text" bind:value={formCategory} placeholder="cth. Desain" class="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 focus:outline-none" />
						</div>
						<div>
							<label for="course-ins" class="mb-1 block text-xs font-bold text-slate-700">Instruktur</label>
							<input id="course-ins" type="text" bind:value={formInstructor} placeholder="cth. Kevin Perry" class="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 focus:outline-none" />
						</div>
					</div>
				</div>
				<div class="mt-5 flex gap-2">
					<button type="button" onclick={closeAdd} class="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50">
						Batal
					</button>
					<button type="submit" class="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-700">
						Simpan Draft
					</button>
				</div>
			</form>
		</div>
	{/if}
</div>
