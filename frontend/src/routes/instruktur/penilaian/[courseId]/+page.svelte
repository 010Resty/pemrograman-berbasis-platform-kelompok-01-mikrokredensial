<script lang="ts">
	import { page } from '$app/state';
	import { getCourseById } from '$lib/data/courses';
	import { getCourseMeta } from '$lib/data/course-meta';
	import { resolveTaskKey, tasksOfCourse } from '$lib/data/grading';
	import { allReviews, ensureGradingLoaded, gradingLoading } from '$lib/stores/grading.svelte';

	$effect(() => {
		ensureGradingLoaded();
	});

	const courseId = $derived(Number(page.params.courseId));
	const course = $derived(getCourseById(courseId));
	const meta = $derived(course ? getCourseMeta(course.id) : undefined);
	const tasks = $derived(tasksOfCourse(courseId));

	let search = $state('');

	const loading = $derived(gradingLoading());
	const reviews = $derived(allReviews());

	interface TaskRow {
		key: string;
		materialId: string;
		title: string;
		moduleLabel: string;
		duration: string;
		excerpt: string;
		pending: number;
		total: number;
	}

	const rows = $derived.by((): TaskRow[] => {
		const q = search.trim().toLowerCase();
		const list: TaskRow[] = [];
		for (const info of tasks) {
			if (
				q &&
				!info.title.toLowerCase().includes(q) &&
				!info.moduleTitle.toLowerCase().includes(q) &&
				!(info.brief?.toLowerCase().includes(q) ?? false)
			) {
				continue;
			}
			const items = reviews.filter((r) => resolveTaskKey(r) === info.key);
			list.push({
				key: info.key,
				materialId: info.materialId,
				title: info.title,
				moduleLabel: `Modul ${info.moduleIndex + 1}: ${info.moduleTitle}`,
				duration: info.duration,
				excerpt: info.brief ?? 'Penugasan praktik dari modul ini.',
				pending: items.filter((r) => r.status === 'Menunggu').length,
				total: items.length
			});
		}
		return list;
	});

	const pendingTotal = $derived(rows.reduce((n, r) => n + r.pending, 0));
	const submitTotal = $derived(rows.reduce((n, r) => n + r.total, 0));
</script>

<svelte:head>
	<title>{course ? `Penilaian ${course.title}` : 'Course tidak ditemukan'} — Instruktur Aristotle</title>
	<meta
		name="description"
		content={course ? `Daftar penugasan ${course.title} yang menunggu penilaian.` : 'Penilaian per course'}
	/>
</svelte:head>

<div class="p-4 sm:p-6 lg:p-8">
	{#if !course || !meta}
		<div class="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-10 text-center">
			<i class="fa-solid fa-triangle-exclamation mb-3 text-3xl text-amber-500" aria-hidden="true"></i>
			<h1 class="text-xl font-bold text-slate-900">Course tidak ditemukan</h1>
			<p class="mt-1 text-sm text-slate-500">ID course “{page.params.courseId}” tidak terdaftar.</p>
			<a
				href="/instruktur/penilaian"
				class="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
			>
				<i class="fa-solid fa-arrow-left" aria-hidden="true"></i> Kembali ke Penilaian
			</a>
		</div>
	{:else}
		<nav aria-label="Breadcrumb" class="mb-4 flex items-center gap-2 text-xs text-slate-500">
			<a
				href="/instruktur/penilaian"
				class="rounded font-semibold text-blue-600 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
			>
				Penilaian
			</a>
			<i class="fa-solid fa-chevron-right text-[10px] text-slate-300" aria-hidden="true"></i>
			<span aria-current="page" class="truncate font-medium text-slate-700">{course.title}</span>
		</nav>

		<div class="mb-6 overflow-hidden rounded-2xl border border-slate-200/70 bg-white">
			<div class="relative flex min-h-40 flex-col justify-end overflow-hidden">
				<img
					src={course.image}
					alt=""
					aria-hidden="true"
					class="absolute inset-0 h-full w-full object-cover"
					loading="eager"
				/>
				<div
					class="absolute inset-0 bg-gradient-to-t from-slate-900/85 via-slate-900/40 to-slate-900/10"
					aria-hidden="true"
				></div>
				<div class="relative p-5 sm:px-6">
					<p class="text-[11px] font-bold tracking-widest text-blue-300 uppercase">
						{course.category} · {meta.price}
					</p>
					<h1 class="mt-1 text-xl leading-snug font-extrabold text-white sm:text-2xl">
						{course.title}
					</h1>
					<p class="mt-1 text-xs text-slate-200 sm:text-sm">
						{rows.length} materi dinilai · {submitTotal} pengumpulan · {pendingTotal} menunggu
					</p>
				</div>
			</div>
		</div>

		<div class="mb-4 max-w-md">
			<label for="search-tugas" class="sr-only">Cari penugasan di course ini</label>
			<div class="relative">
				<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
					<i class="fa-solid fa-magnifying-glass text-sm" aria-hidden="true"></i>
				</div>
				<input
					id="search-tugas"
					type="search"
					bind:value={search}
					placeholder="Cari tugas, kuis, atau modul..."
					autocomplete="off"
					class="w-full rounded-xl border border-slate-200 bg-white py-2.5 pr-4 pl-10 text-sm placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
				/>
			</div>
		</div>

		{#if loading}
			<p role="status" class="mb-4 flex items-center gap-2 text-xs font-semibold text-slate-500">
				<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i> Memuat pengumpulan…
			</p>
		{/if}

		{#if rows.length === 0}
			<div class="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
				<i class="fa-solid fa-folder-open mb-3 text-3xl text-slate-300" aria-hidden="true"></i>
				<p class="text-sm font-semibold text-slate-700">Tidak ada penugasan yang cocok.</p>
				<p class="mt-1 text-xs text-slate-500">Coba kata kunci lain.</p>
			</div>
		{:else}
			<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
				{#each rows as row (row.key)}
					<a
						href={`/instruktur/penilaian/${courseId}/${row.materialId}`}
						aria-label={`Buka tugas ${row.title}: ${row.pending} menunggu dari ${row.total} pengumpulan`}
						class="group flex flex-col rounded-2xl border border-slate-200/70 bg-white p-5 transition-all duration-300 ease-smooth hover:-translate-y-0.5 hover:shadow-xl focus-visible:outline-2 focus-visible:outline-blue-600"
					>
						<div class="mb-2 flex items-center justify-between gap-2">
							<span
								class="inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-2.5 py-1 text-[11px] font-extrabold text-violet-800 uppercase"
							>
								<i class="fa-solid fa-pen-to-square text-[10px]" aria-hidden="true"></i>
								Tugas
							</span>
							{#if row.pending > 0}
								<span class="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-700">
									<i class="fa-solid fa-hourglass-half text-[10px]" aria-hidden="true"></i>
									{row.pending} menunggu
								</span>
							{:else}
								<span class="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
									<i class="fa-solid fa-check text-[10px]" aria-hidden="true"></i> Tuntas
								</span>
							{/if}
						</div>
						<h2 class="text-base font-bold text-slate-900 transition-colors group-hover:text-blue-700">
							{row.title}
						</h2>
						<p class="mt-0.5 text-[11px] font-semibold text-slate-500">
							{row.moduleLabel} · {row.duration} · {row.total} kiriman
						</p>
						<p class="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-500">{row.excerpt}</p>
						<span
							class="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white transition-colors group-hover:bg-blue-700"
						>
							<i class="fa-solid fa-users" aria-hidden="true"></i>
							Lihat Jawaban Peserta
							<i class="fa-solid fa-arrow-right text-[10px]" aria-hidden="true"></i>
						</span>
					</a>
				{/each}
			</div>
		{/if}
	{/if}
</div>
