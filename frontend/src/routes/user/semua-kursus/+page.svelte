<script lang="ts">
	import { courses } from '$lib/data/courses';
	import {
		getCourseMeta,
		periodBadgeClass,
		periodIcon,
		type CoursePeriod
	} from '$lib/data/course-meta';
	import { isCoursePaid } from '$lib/stores/enrollment.svelte';

	let search = $state('');
	let activeCategory = $state('Semua');
	let activePeriod = $state<'all' | CoursePeriod>('all');

	const categories = $derived(['Semua', ...new Set(courses.map((c) => c.category))]);

	const periodFilters: { value: 'all' | CoursePeriod; label: string }[] = [
		{ value: 'all', label: 'Semua Periode' },
		{ value: 'ongoing', label: 'Sedang Berjalan' },
		{ value: 'upcoming', label: 'Akan Datang' },
		{ value: 'ended', label: 'Sudah Lewat' }
	];

	const filtered = $derived(
		courses.filter((c) => {
			const matchCat = activeCategory === 'Semua' || c.category === activeCategory;
			const matchPeriod = activePeriod === 'all' || getCourseMeta(c.id).period === activePeriod;
			const q = search.trim().toLowerCase();
			const matchQ =
				!q || c.title.toLowerCase().includes(q) || c.instructor.toLowerCase().includes(q);
			return matchCat && matchPeriod && matchQ;
		})
	);

	function periodShort(meta: { period: CoursePeriod; startMonth?: string }): string {
		if (meta.period === 'upcoming') return `Mulai ${meta.startMonth ?? ''}`.trim();
		if (meta.period === 'ongoing') return 'Berjalan';
		return 'Lewat';
	}

	function isEnrolled(status: string): boolean {
		return status !== 'not-started';
	}
</script>

<svelte:head>
	<title>Semua Kursus — Aristoteles Platform</title>
	<meta
		name="description"
		content="Katalog semua kursus mikrokredensial Aristoteles yang dapat diikuti."
	/>
</svelte:head>

<div class="p-4 sm:p-6 lg:p-8">
	<div class="mb-6">
		<p class="text-xs font-bold tracking-widest text-blue-600 uppercase">
			Menu Utama · Semua Kursus
		</p>
		<h1 class="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Semua Kursus</h1>
		<p class="mt-1 text-sm text-slate-500">
			Klik kartu untuk melihat pratinjau: info, modul, dan materi.
		</p>
	</div>

	<!-- Search + filter -->
	<div class="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center">
		<div class="relative max-w-md flex-1">
			<div
				class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400"
			>
				<i class="fa-solid fa-magnifying-glass text-sm" aria-hidden="true"></i>
			</div>
			<label for="catalog-search" class="sr-only">Cari kursus</label>
			<input
				id="catalog-search"
				type="search"
				bind:value={search}
				placeholder="Cari judul kursus atau instruktur..."
				class="w-full rounded-xl border border-slate-200 bg-white py-2.5 pr-4 pl-10 text-sm text-slate-800 placeholder:text-slate-400 transition-all duration-200 ease-smooth focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
			/>
		</div>
		<div class="flex flex-wrap gap-2" role="group" aria-label="Filter kategori">
			{#each categories as cat (cat)}
				<button
					type="button"
					onclick={() => (activeCategory = cat)}
					aria-pressed={activeCategory === cat}
					class={`rounded-xl px-4 py-2 text-xs font-bold transition-all duration-200 ease-smooth active:scale-95 focus-visible:outline-2 focus-visible:outline-blue-600 ${
						activeCategory === cat
							? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
							: 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
					}`}
				>
					{cat}
				</button>
			{/each}
		</div>
	</div>
	<div class="mb-6 flex flex-wrap gap-2" role="group" aria-label="Filter periode pelatihan">
		{#each periodFilters as pf (pf.value)}
			<button
				type="button"
				onclick={() => (activePeriod = pf.value)}
				aria-pressed={activePeriod === pf.value}
				class={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition-all duration-200 ease-smooth active:scale-95 focus-visible:outline-2 focus-visible:outline-blue-600 ${
					activePeriod === pf.value
						? 'bg-slate-900 text-white shadow-lg'
						: 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
				}`}
			>
				{#if pf.value !== 'all'}
					<i class={`fa-solid ${periodIcon(pf.value)} text-[10px]`} aria-hidden="true"></i>
				{/if}
				{pf.label}
			</button>
		{/each}
	</div>

	<p class="mb-4 text-xs font-medium text-slate-500" role="status">
		Menampilkan {filtered.length} dari {courses.length} kursus
	</p>

	{#if filtered.length === 0}
		<div class="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
			<i class="fa-solid fa-magnifying-glass mb-3 text-3xl text-slate-300" aria-hidden="true"></i>
			<p class="text-sm font-semibold text-slate-700">Kursus tidak ditemukan.</p>
			<p class="mt-1 text-xs text-slate-500">Coba kata kunci atau kategori lain.</p>
		</div>
	{:else}
		<div class="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
			{#each filtered as course (course.id)}
				{@const meta = getCourseMeta(course.id)}
				{@const enrolled = isEnrolled(course.status)}
				<article
					class="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-300 ease-smooth hover:-translate-y-1 hover:shadow-xl"
				>
					<a
						href={`/user/semua-kursus/${course.id}`}
						class="relative block overflow-hidden focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-600"
						aria-label={`Lihat pratinjau: ${course.title}`}
					>
						<img
							src={course.image}
							alt={`Sampul kursus ${course.title}`}
							class="h-48 w-full object-cover transition-transform duration-700 ease-smooth group-hover:scale-105"
							loading="lazy"
						/>
						<span
							class="absolute top-3 left-3 rounded-md bg-red-600 px-3 py-1 text-[10px] font-extrabold text-white uppercase"
						>
							{course.duration}
						</span>
						<span
							class={`absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[10px] font-extrabold uppercase ${periodBadgeClass(meta.period)}`}
						>
							<i class={`fa-solid ${periodIcon(meta.period)}`} aria-hidden="true"></i>
							{periodShort(meta)}
						</span>
						{#if enrolled}
							<span
								class="absolute top-3 right-3 inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-[10px] font-bold text-white"
							>
								<i class="fa-solid fa-check" aria-hidden="true"></i> Diikuti
							</span>
						{:else if isCoursePaid(course.id)}
							<span
								class="absolute top-3 right-3 inline-flex items-center gap-1 rounded-md bg-amber-400 px-2.5 py-1 text-[10px] font-bold text-slate-900"
							>
								<i class="fa-solid fa-lock" aria-hidden="true"></i> Berbayar
							</span>
						{/if}
					</a>
					<div class="flex flex-1 flex-col justify-between space-y-4 p-6">
						<div>
							<div class="mb-2 flex items-center justify-between text-xs text-slate-500">
								<span class="flex items-center gap-1">
									<i class="fa-regular fa-star text-amber-400" aria-hidden="true"></i>
									<span><strong class="text-slate-700">{meta.rating}</strong> ({meta.reviews})</span
									>
								</span>
								<span class="flex items-center gap-1">
									<i class="fa-regular fa-clock" aria-hidden="true"></i>
									{course.totalMaterials} Materi
								</span>
							</div>
							<p class="text-[11px] font-bold tracking-wide text-blue-600 uppercase">
								{course.category} · {course.level}
							</p>
							<h2 class="mt-1 line-clamp-2 text-base leading-snug font-extrabold text-slate-900">
								<a
									href={`/user/semua-kursus/${course.id}`}
									class="rounded transition-colors duration-200 ease-smooth group-hover:text-blue-600 focus-visible:outline-2 focus-visible:outline-blue-600"
								>
									{course.title}
								</a>
							</h2>
						</div>
						<div class="flex items-center justify-between border-t border-slate-100 pt-4">
							<span class="text-xs font-semibold text-slate-700">{course.instructor}</span>
							<span class="text-sm font-extrabold text-blue-600">{meta.price}</span>
						</div>
						<a
							href={`/user/semua-kursus/${course.id}`}
							class="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white transition-all duration-200 ease-smooth hover:bg-blue-700 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-blue-600"
						>
							<i class="fa-solid fa-eye" aria-hidden="true"></i>
							{enrolled ? 'Lihat Detail & Lanjut' : 'Lihat Pratinjau'}
						</a>
					</div>
				</article>
			{/each}
		</div>
	{/if}
</div>
