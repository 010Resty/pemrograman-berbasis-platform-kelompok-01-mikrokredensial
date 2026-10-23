<script lang="ts">
	import { courses, type Course } from '$lib/data/courses';
	import { getCourseMeta, periodBadgeClass, periodIcon } from '$lib/data/course-meta';

	// Kursus milik instruktur demo (Kevin Perry) + 2 kursus kolaborasi.
	// Untuk demo, tampilkan 4 kursus pertama sebagai "kursusku" instruktur.
	const ownedIds = [1, 5, 3, 4];
	const owned = $derived(courses.filter((c) => ownedIds.includes(c.id)));

	type Status = 'all' | 'Aktif' | 'Draft';
	let activeFilter = $state<Status>('all');
	let search = $state('');

	const filters: { value: Status; label: string }[] = [
		{ value: 'all', label: 'Semua' },
		{ value: 'Aktif', label: 'Aktif' },
		{ value: 'Draft', label: 'Draft' }
	];

	function courseStatus(c: Course): 'Aktif' | 'Draft' {
		return c.id === 4 ? 'Draft' : 'Aktif';
	}

	const filtered = $derived(
		owned.filter((c) => {
			const st = courseStatus(c);
			const matchStatus = activeFilter === 'all' || st === activeFilter;
			const q = search.trim().toLowerCase();
			const matchSearch =
				!q || c.title.toLowerCase().includes(q) || c.category.toLowerCase().includes(q);
			return matchStatus && matchSearch;
		})
	);

	const filteredWithMeta = $derived(
		filtered.map((c) => ({ course: c, meta: getCourseMeta(c.id) }))
	);
</script>

<svelte:head>
	<title>Kursusku — Instruktur Aristoteles</title>
	<meta
		name="description"
		content="Kelola kursus, kurikulum, modul, dan materi yang diampu instruktur Aristoteles."
	/>
</svelte:head>

<div class="p-4 sm:p-6 lg:p-8">
	<div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
		<div>
			<p class="text-xs font-bold tracking-widest text-blue-600 uppercase">Menu Utama · Kursusku</p>
			<h1 class="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Kursusku</h1>
			<p class="mt-1 text-sm text-slate-500">
				{owned.length} kursus kamu ampu · {owned.reduce((n, c) => n + c.modules.length, 0)} modul ·
				{owned.reduce((n, c) => n + c.totalMaterials, 0)} materi.
			</p>
		</div>
		<a
			href="/instruktur/kursusku/tambah"
			class="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white transition-all duration-200 ease-smooth hover:bg-blue-700 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-blue-600"
		>
			<i class="fa-solid fa-plus" aria-hidden="true"></i> Buat Kursus Baru
		</a>
	</div>

	<div class="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center">
		<div class="max-w-md flex-1">
			<label for="search-kursus" class="sr-only">Cari kursus yang kamu ampu</label>
			<div class="relative">
				<div
					class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400"
				>
					<i class="fa-solid fa-magnifying-glass text-sm" aria-hidden="true"></i>
				</div>
				<input
					id="search-kursus"
					type="search"
					bind:value={search}
					placeholder="Cari judul atau kategori kursus..."
					autocomplete="off"
					class="w-full rounded-xl border border-slate-200 bg-white py-2.5 pr-4 pl-10 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
				/>
			</div>
		</div>
		<div class="flex flex-wrap gap-2" role="group" aria-label="Filter status kursus">
			{#each filters as f (f.value)}
				<button
					type="button"
					onclick={() => (activeFilter = f.value)}
					aria-pressed={activeFilter === f.value}
					class={`rounded-xl px-4 py-2 text-xs font-bold transition-all duration-200 ease-smooth active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
						activeFilter === f.value
							? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
							: 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
					}`}
				>
					{f.label}
				</button>
			{/each}
		</div>
	</div>

	{#if filtered.length === 0}
		<div class="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
			<i class="fa-solid fa-folder-open mb-3 text-3xl text-slate-300" aria-hidden="true"></i>
			<p class="text-sm font-semibold text-slate-700">Tidak ada kursus pada filter ini.</p>
		</div>
	{:else}
		<div class="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
			{#each filteredWithMeta as { course, meta: kMeta } (course.id)}
				{@const st = courseStatus(course)}
				<article
					class="group flex flex-col overflow-hidden rounded-2xl border border-slate-200/70 bg-white transition-all duration-300 ease-smooth hover:-translate-y-1 hover:shadow-xl"
				>
					<div class="relative overflow-hidden">
						<img
							src={course.image}
							alt={`Sampul kursus ${course.title}`}
							class="h-44 w-full object-cover transition-transform duration-700 ease-smooth group-hover:scale-105"
							loading="lazy"
						/>
						<span
							class={`absolute top-3 left-3 rounded-md border px-2.5 py-1 text-[10px] font-extrabold uppercase ${st === 'Aktif' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}
						>
							{st}
						</span>
						<span
							class={`absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[10px] font-extrabold uppercase ${periodBadgeClass(kMeta.period)}`}
						>
							<i class={`fa-solid ${periodIcon(kMeta.period)}`} aria-hidden="true"></i>
							{kMeta.period === 'upcoming'
								? `Mulai ${kMeta.startMonth ?? ''}`.trim()
								: kMeta.period === 'ongoing'
									? 'Berjalan'
									: 'Lewat'}
						</span>
					</div>
					<div class="flex flex-1 flex-col p-5">
						<p class="text-[11px] font-bold tracking-wide text-blue-600 uppercase">
							{course.category}
						</p>
						<h2 class="mt-1 line-clamp-2 text-base font-bold text-slate-900">
							<a
								href={`/instruktur/kursusku/${course.id}`}
								class="rounded transition-colors duration-200 ease-smooth hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
							>
								{course.title}
							</a>
						</h2>
						<p class="mt-1 text-xs text-slate-500">
							{course.modules.length} modul · {course.totalMaterials} materi · {kMeta.students.toLocaleString(
								'id-ID'
							)} peserta
						</p>

						<div class="mt-4">
							<div class="mb-1.5 flex justify-between text-xs">
								<span class="text-slate-500">Rata-rata progres peserta</span>
								<span class="font-bold text-slate-700">{course.progress}%</span>
							</div>
							<div
								class="h-2 overflow-hidden rounded-full bg-slate-100"
								role="progressbar"
								aria-valuenow={course.progress}
								aria-valuemin={0}
								aria-valuemax={100}
								aria-label={`Progres ${course.title}`}
							>
								<div
									class={`h-full rounded-full ${course.progress === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`}
									style="width: {course.progress}%"
								></div>
							</div>
						</div>

						<div class="mt-5 flex gap-2">
							<a
								href={`/instruktur/kursusku/${course.id}`}
								class="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white transition-all duration-200 ease-smooth hover:bg-blue-700 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-blue-600"
							>
								<i class="fa-solid fa-list-check" aria-hidden="true"></i> Kelola Kurikulum
							</a>
							<button
								type="button"
								aria-label={`Pengaturan cepat ${course.title}`}
								class="flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition-colors duration-200 ease-smooth hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-slate-500"
							>
								<i class="fa-solid fa-gear" aria-hidden="true"></i>
							</button>
						</div>
					</div>
				</article>
			{/each}
		</div>
	{/if}
</div>
