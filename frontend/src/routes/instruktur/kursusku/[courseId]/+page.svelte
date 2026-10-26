<script lang="ts">
	import { page } from '$app/state';
	import { getCourseById, type CourseModule } from '$lib/data/courses';
	import { getCourseMeta } from '$lib/data/course-meta';
	import { getTrainingStats } from '$lib/data/training';
	import {
		loadCurriculumDraft,
		saveCurriculumDraft,
		withSyncedFlat
	} from '$lib/stores/curriculum';
	import LearningPathManager from '$lib/components/training/organisms/LearningPathManager.svelte';
	import CourseRoadmap from '$lib/components/training/organisms/CourseRoadmap.svelte';

	const courseId = $derived(Number(page.params.courseId));
	const course = $derived(getCourseById(courseId));
	const meta = $derived(course ? getCourseMeta(course.id) : undefined);

	let editableModules = $state<CourseModule[]>([]);
	let isPublished = $state(true);
	let savedMessage = $state('');
	let initializedFor = $state<number | null>(null);

	/* Muat draf bersama (memori + localStorage) agar suntingan terbawa
	   saat drill-down ke halaman sub-modul / materi. */
	$effect(() => {
		if (!course || initializedFor === courseId) return;
		editableModules = loadCurriculumDraft(courseId).map(withSyncedFlat);
		isPublished = course.id !== 4;
		savedMessage = '';
		initializedFor = courseId;
	});

	/* Simpan setiap perubahan kembali ke draf bersama. */
	$effect(() => {
		if (initializedFor !== courseId || !course) return;
		saveCurriculumDraft(courseId, editableModules);
	});

	const totalMats = $derived(editableModules.reduce((n, m) => n + m.materials.length, 0));
	const totalSubs = $derived(
		editableModules.reduce((n, m) => n + (m.subModules?.length ?? 0), 0)
	);
	const stats = $derived(
		course ? getTrainingStats({ ...course, modules: editableModules }) : undefined
	);

	function markSaved(msg: string) {
		savedMessage = msg;
	}
</script>

<svelte:head>
	<title>{course ? `Kelola ${course.title}` : 'Kursus tidak ditemukan'} — Instruktur Aristoteles</title>
	<meta name="description" content={course ? `Kelola kurikulum, modul, sub-modul, dan materi ${course.title}` : 'Kelola kurikulum kursus'} />
</svelte:head>

<div class="p-4 sm:p-6 lg:p-8">
	{#if !course}
		<div class="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-10 text-center">
			<i class="fa-solid fa-triangle-exclamation mb-3 text-3xl text-amber-500" aria-hidden="true"></i>
			<h1 class="text-xl font-bold text-slate-900">Kursus tidak ditemukan</h1>
			<p class="mt-1 text-sm text-slate-500">ID kursus “{page.params.courseId}” tidak terdaftar di Kursusku.</p>
			<a href="/instruktur/kursusku" class="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white transition-all duration-200 ease-smooth hover:bg-blue-700 active:scale-[0.98]">
				<i class="fa-solid fa-arrow-left" aria-hidden="true"></i> Kembali ke Kursusku
			</a>
		</div>
	{:else}
		<nav aria-label="Breadcrumb" class="mb-4 flex items-center gap-2 text-xs text-slate-500">
			<a href="/instruktur/kursusku" class="rounded font-semibold text-blue-600 transition-colors duration-200 ease-smooth hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600">
				Kursusku
			</a>
			<i class="fa-solid fa-chevron-right text-[10px] text-slate-300" aria-hidden="true"></i>
			<span aria-current="page" class="truncate font-medium text-slate-700">{course.title}</span>
		</nav>

		<header class="mb-6 overflow-hidden rounded-2xl border border-slate-200/70 bg-white">
			<div class="relative flex min-h-48 flex-col justify-end overflow-hidden sm:min-h-56">
				<img
					src={course.image}
					alt={`Sampul pelatihan ${course.title}`}
					class="absolute inset-0 h-full w-full object-cover"
					loading="eager"
				/>
				<div
					class="absolute inset-0 bg-gradient-to-t from-slate-900/85 via-slate-900/40 to-slate-900/10"
					aria-hidden="true"
				></div>
				<div class="relative flex flex-wrap gap-2 p-4 pb-2 sm:px-6">
					<span class="rounded-full bg-blue-600 px-3 py-1 text-[11px] font-bold text-white uppercase">{course.category}</span>
					<span class="rounded-full bg-white/20 px-3 py-1 text-[11px] font-bold text-white uppercase backdrop-blur">{course.level}</span>
					<span
						class="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold uppercase {isPublished ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-white/30 bg-white/15 text-white backdrop-blur'}"
					>
						<i class="fa-solid {isPublished ? 'fa-eye' : 'fa-pen'}" aria-hidden="true"></i>
						{isPublished ? 'Terbit' : 'Draft'}
					</span>
				</div>
				<div class="relative p-4 pt-1 sm:px-6 sm:pb-5">
					<h1 class="text-xl leading-snug font-extrabold text-white sm:text-2xl">{course.title}</h1>
					<p class="mt-1 text-xs text-slate-200 sm:text-sm">Oleh {course.instructor} · {course.duration} · {meta?.students.toLocaleString('id-ID') ?? '-'} peserta · ★ {meta?.rating ?? '-'}</p>
					<p class="mt-1 text-[11px] font-semibold tracking-wide text-blue-200 uppercase">
						Kelola · {editableModules.length} modul · {totalSubs} sub-modul · {totalMats} materi
					</p>
				</div>
			</div>
			<div class="flex flex-col gap-3 p-4 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
				<p class="max-w-2xl flex-1 text-sm leading-relaxed text-slate-600">{course.description}</p>
				<div class="flex shrink-0 flex-wrap items-center gap-2">
					<button
						type="button"
						onclick={() => {
							isPublished = !isPublished;
							markSaved(isPublished ? 'Kursus diterbitkan.' : 'Kursus dikembalikan ke draft.');
						}}
						aria-pressed={isPublished}
						class="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition-all hover:bg-slate-50 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-slate-500"
					>
						{isPublished ? 'Jadikan Draft' : 'Terbitkan'}
					</button>
					<a href="/instruktur/penilaian" class="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition-all hover:bg-slate-50 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-slate-500">
						<i class="fa-solid fa-clipboard-check" aria-hidden="true"></i> Penilaian
					</a>
					<button
						type="button"
						onclick={() => markSaved('Draf kurikulum tersimpan (simulasi sisi klien).')}
						class="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white transition-all hover:bg-blue-700 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-blue-600"
					>
						<i class="fa-solid fa-floppy-disk" aria-hidden="true"></i> Simpan Kurikulum
					</button>
				</div>
			</div>
			{#if savedMessage}
				<p role="status" class="flex items-center gap-2 border-t border-slate-100 bg-emerald-50/60 px-4 py-2.5 text-xs font-semibold text-emerald-700 sm:px-6">
					<i class="fa-solid fa-circle-check" aria-hidden="true"></i> {savedMessage}
				</p>
			{/if}
		</header>

		<!-- Daftar modul kursus -->
		<div class="mb-4">
			<h2 class="text-lg font-bold text-slate-900">Kurikulum ({editableModules.length} Modul · {totalSubs} Sub-modul)</h2>
			<p class="text-xs text-slate-500">Susun modul di bawah; sub-modul dan materi diatur di halaman tiap modul.</p>
		</div>

		<LearningPathManager
			bind:modules={editableModules}
			onnotice={markSaved}
			moduleHref={(mod) => `/instruktur/kursusku/${courseId}/${mod.id}`}
		/>

		<!-- ORGANISM: pratinjau alur belajar draf (langsung mengikuti edit) -->
		<section aria-labelledby="roadmap-preview-heading" class="mt-6">
			<div class="mb-3">
				<h2 id="roadmap-preview-heading" class="text-lg font-bold text-slate-900">Pratinjau Alur Belajar</h2>
				<p class="text-xs text-slate-500">
					Tampilan jalur Modul → Sub-modul seperti yang dilihat peserta. Klik node untuk info.
					{#if stats} ({stats.estimatedLabel}){/if}
				</p>
			</div>
			<CourseRoadmap modules={editableModules} courseId={courseId} preview />
		</section>

		<div class="mt-6 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
			<div>
				<p class="text-sm font-bold text-slate-900">Kurikulum tersimpan sebagai draf lokal</p>
				<p class="text-xs text-slate-500">Total {editableModules.length} modul · {totalSubs} sub-modul · {totalMats} materi. Klik Simpan untuk menerbitkan perubahan.</p>
			</div>
			<div class="flex gap-2">
				<a href="/instruktur/kursusku" class="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 transition-all duration-200 ease-smooth hover:bg-slate-50 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-slate-500">
					<i class="fa-solid fa-arrow-left" aria-hidden="true"></i> Kursusku
				</a>
				<button
					type="button"
					onclick={() => markSaved('Draf kurikulum tersimpan (simulasi sisi klien).')}
					class="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white transition-all duration-200 ease-smooth hover:bg-blue-700 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-blue-600"
				>
					<i class="fa-solid fa-floppy-disk" aria-hidden="true"></i> Simpan Kurikulum
				</button>
			</div>
		</div>
	{/if}
</div>
