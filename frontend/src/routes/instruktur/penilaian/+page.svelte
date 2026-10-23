<script lang="ts">
	import { getCourseById } from '$lib/data/courses';
	import { COURSE_ORDER, resolveTaskKey } from '$lib/data/grading';
	import { allReviews, ensureGradingLoaded, gradingLoading } from '$lib/stores/grading.svelte';

	$effect(() => {
		ensureGradingLoaded();
	});

	let search = $state('');

	const loading = $derived(gradingLoading());
	const reviews = $derived(allReviews());

	const pendingCount = $derived(reviews.filter((r) => r.status === 'Menunggu').length);
	const gradedCount = $derived(reviews.filter((r) => r.status === 'Dinilai').length);
	const avgScore = $derived.by(() => {
		const graded = reviews.filter((r) => r.score !== null);
		if (graded.length === 0) return '-';
		return Math.round(graded.reduce((n, r) => n + (r.score ?? 0), 0) / graded.length).toString();
	});

	interface CourseCard {
		id: number;
		title: string;
		category: string;
		image: string;
		taskCount: number;
		pending: number;
		total: number;
	}

	const cards = $derived.by((): CourseCard[] => {
		const q = search.trim().toLowerCase();
		const list: CourseCard[] = [];
		for (const courseId of COURSE_ORDER) {
			const course = getCourseById(courseId);
			if (!course) continue;
			if (q && !course.title.toLowerCase().includes(q) && !course.category.toLowerCase().includes(q)) {
				continue;
			}
			let taskCount = 0;
			for (const mod of course.modules) {
				for (const sub of mod.subModules ?? []) {
					for (const mat of sub.materials) {
						if (mat.type === 'tugas') taskCount += 1;
					}
				}
			}
			const items = reviews.filter((r) => {
				const key = resolveTaskKey(r);
				return key !== null && Number(key.split('::')[0]) === courseId;
			});
			list.push({
				id: course.id,
				title: course.title,
				category: course.category,
				image: course.image,
				taskCount,
				pending: items.filter((r) => r.status === 'Menunggu').length,
				total: items.length
			});
		}
		return list;
	});
</script>

<svelte:head>
	<title>Penilaian — Instruktur Aristoteles</title>
	<meta name="description" content="Daftar course untuk antrean penilaian tugas dan kuis peserta." />
</svelte:head>

<div class="p-4 sm:p-6 lg:p-8">
	<div class="mb-6">
		<p class="text-xs font-bold tracking-widest text-blue-600 uppercase">Menu Utama · Penilaian</p>
		<h1 class="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Penilaian</h1>
		<p class="mt-1 text-sm text-slate-500">
			{pendingCount} menunggu dinilai · {gradedCount} sudah dinilai · rata-rata nilai {avgScore}.
			Pilih course untuk melihat penugasannya.
		</p>
	</div>

	<div class="mb-6 grid grid-cols-3 gap-4">
		<div class="rounded-2xl border border-amber-200/70 bg-amber-50 p-4 sm:p-5">
			<div class="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 text-white">
				<i class="fa-solid fa-hourglass-half text-sm" aria-hidden="true"></i>
			</div>
			<div class="mt-3 text-2xl font-bold text-slate-900">{pendingCount}</div>
			<div class="text-xs font-semibold text-slate-600">Menunggu</div>
		</div>
		<div class="rounded-2xl border border-emerald-200/70 bg-emerald-50 p-4 sm:p-5">
			<div class="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white">
				<i class="fa-solid fa-circle-check text-sm" aria-hidden="true"></i>
			</div>
			<div class="mt-3 text-2xl font-bold text-slate-900">{gradedCount}</div>
			<div class="text-xs font-semibold text-slate-600">Dinilai</div>
		</div>
		<div class="rounded-2xl border border-blue-200/70 bg-blue-50 p-4 sm:p-5">
			<div class="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white">
				<i class="fa-solid fa-star text-sm" aria-hidden="true"></i>
			</div>
			<div class="mt-3 text-2xl font-bold text-slate-900">{avgScore}</div>
			<div class="text-xs font-semibold text-slate-600">Rata-rata</div>
		</div>
	</div>

	<div class="mb-4 max-w-md">
		<label for="search-course-penilaian" class="sr-only">Cari course</label>
		<div class="relative">
			<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
				<i class="fa-solid fa-magnifying-glass text-sm" aria-hidden="true"></i>
			</div>
			<input
				id="search-course-penilaian"
				type="search"
				bind:value={search}
				placeholder="Cari course..."
				autocomplete="off"
				class="w-full rounded-xl border border-slate-200 bg-white py-2.5 pr-4 pl-10 text-sm placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
			/>
		</div>
	</div>

	{#if loading}
		<p role="status" class="mb-4 flex items-center gap-2 text-xs font-semibold text-slate-500">
			<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i> Memuat berkas PDF dari Drive…
		</p>
	{/if}

	{#if cards.length === 0}
		<div class="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
			<i class="fa-solid fa-folder-open mb-3 text-3xl text-slate-300" aria-hidden="true"></i>
			<p class="text-sm font-semibold text-slate-700">Tidak ada course yang cocok.</p>
			<p class="mt-1 text-xs text-slate-500">Coba kata kunci lain.</p>
		</div>
	{:else}
		<div class="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
			{#each cards as card (card.id)}
				<a
					href={`/instruktur/penilaian/${card.id}`}
					aria-label={`Buka penilaian ${card.title}: ${card.pending} menunggu dari ${card.total} pengumpulan`}
					class="group flex flex-col overflow-hidden rounded-2xl border border-slate-200/70 bg-white transition-all duration-300 ease-smooth hover:-translate-y-1 hover:shadow-xl focus-visible:outline-2 focus-visible:outline-blue-600"
				>
					<div class="relative overflow-hidden">
						<img
							src={card.image}
							alt=""
							aria-hidden="true"
							class="h-36 w-full object-cover transition-transform duration-700 ease-smooth group-hover:scale-105"
							loading="lazy"
						/>
						<span
							class="absolute top-3 left-3 rounded-md bg-slate-900/80 px-2.5 py-1 text-[10px] font-extrabold text-white uppercase backdrop-blur"
						>
							{card.category}
						</span>
						{#if card.pending > 0}
							<span
								class="absolute top-3 right-3 inline-flex items-center gap-1 rounded-md bg-amber-400 px-2.5 py-1 text-[10px] font-extrabold text-slate-900 uppercase"
							>
								<i class="fa-solid fa-hourglass-half text-[9px]" aria-hidden="true"></i>
								{card.pending} antre
							</span>
						{:else}
							<span
								class="absolute top-3 right-3 inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-[10px] font-extrabold text-white uppercase"
							>
								<i class="fa-solid fa-check text-[9px]" aria-hidden="true"></i> Tuntas
							</span>
						{/if}
					</div>
					<div class="flex flex-1 flex-col p-5">
						<h2 class="line-clamp-2 text-base font-bold text-slate-900 transition-colors group-hover:text-blue-700">
							{card.title}
						</h2>
						<p class="mt-1 text-xs text-slate-500">
							{card.taskCount} materi dinilai · {card.total} pengumpulan · {card.pending} menunggu
						</p>
						<span
							class="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white transition-colors group-hover:bg-blue-700"
						>
							<i class="fa-solid fa-clipboard-check" aria-hidden="true"></i>
							Buka Penugasan
							<i class="fa-solid fa-arrow-right text-[10px]" aria-hidden="true"></i>
						</span>
					</div>
				</a>
			{/each}
		</div>
	{/if}
</div>
