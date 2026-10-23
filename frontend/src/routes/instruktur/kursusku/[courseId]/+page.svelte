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
	import CurriculumEditor from '$lib/components/training/organisms/CurriculumEditor.svelte';
	import LearningPathManager from '$lib/components/training/organisms/LearningPathManager.svelte';
	import CourseRoadmap from '$lib/components/training/organisms/CourseRoadmap.svelte';

	const courseId = $derived(Number(page.params.courseId));
	const course = $derived(getCourseById(courseId));
	const meta = $derived(course ? getCourseMeta(course.id) : undefined);

	let editableModules = $state<CourseModule[]>([]);
	let isPublished = $state(true);
	let savedMessage = $state('');
	let activeTab = $state<'path' | 'materi'>('path');
	let initializedFor = $state<number | null>(null);

	/* Muat draf bersama (memori + localStorage) agar suntingan terbawa
	   saat drill-down ke halaman sub-modul / materi. */
	$effect(() => {
		if (!course || initializedFor === courseId) return;
		editableModules = loadCurriculumDraft(courseId).map(withSyncedFlat);
		isPublished = course.id !== 4;
		savedMessage = '';
		activeTab = 'path';
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
					alt={`Sampul kursus ${course.title}`}
					class="absolute inset-0 h-full w-full object-cover"
					loading="eager"
				/>
				<div
					class="absolute inset-0 bg-gradient-to-t from-slate-900/85 via-slate-900/40 to-slate-900/10"
					aria-hidden="true"
				></div>
				<div class="relative flex flex-col gap-3 p-4 pt-14 sm:p-6 sm:pt-16 lg:flex-row lg:items-end lg:justify-between">
					<div class="min-w-0">
						<p class="text-[11px] font-bold tracking-widest text-blue-300 uppercase">
							{course.category} · {course.level}
						</p>
						<h1 class="mt-1.5 text-xl leading-snug font-extrabold text-white sm:text-2xl">
							{course.title}
						</h1>
						<p class="mt-1.5 text-xs text-slate-200 sm:text-sm">
							{editableModules.length} modul · {totalSubs} sub-modul · {totalMats} materi · {meta?.students.toLocaleString('id-ID') ?? '-'} peserta · ★ {meta?.rating ?? '-'}
						</p>
					</div>
					<div class="flex shrink-0 items-center gap-2">
						<span
							class="inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-bold {isPublished ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-600'}"
						>
							<i class="fa-solid {isPublished ? 'fa-eye' : 'fa-pen'} mr-1.5" aria-hidden="true"></i>
							{isPublished ? 'Terbit' : 'Draft'}
						</span>
						<button
							type="button"
							onclick={() => {
								isPublished = !isPublished;
								markSaved(isPublished ? 'Kursus diterbitkan.' : 'Kursus dikembalikan ke draft.');
							}}
							aria-pressed={isPublished}
							class="rounded-xl bg-white px-4 py-2 text-xs font-bold text-slate-800 transition-all duration-200 ease-smooth hover:bg-slate-100 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-white"
						>
							{isPublished ? 'Jadikan Draft' : 'Terbitkan'}
						</button>
					</div>
				</div>
			</div>
			<div class="flex flex-col gap-3 p-4 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
				<p class="max-w-2xl flex-1 text-sm text-slate-600">{course.description}</p>
				<div class="flex shrink-0 gap-2">
					<a href="/instruktur/penilaian" class="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 transition-all duration-200 ease-smooth hover:bg-slate-50 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-slate-500">
						<i class="fa-solid fa-clipboard-check" aria-hidden="true"></i> Penilaian
					</a>
					<button
						type="button"
						onclick={() => markSaved('Draf kurikulum tersimpan (simulasi sisi klien).')}
						class="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white transition-all duration-200 ease-smooth hover:bg-blue-700 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-blue-600"
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

		<!-- Tab kelola: Learning Path (modul/sub) vs Detail Materi -->
		<div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
			<div>
				<h2 class="text-lg font-bold text-slate-900">Kurikulum ({editableModules.length} Modul · {totalSubs} Sub-modul)</h2>
				<p class="text-xs text-slate-500">Klik judul modul untuk mengelola sub-modulnya, klik judul sub-modul untuk mengelola materinya.</p>
			</div>
			<div role="tablist" aria-label="Mode kelola kurikulum" class="inline-flex rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
				<button
					type="button"
					role="tab"
					id="tab-path"
					aria-selected={activeTab === 'path'}
					aria-controls="panel-path"
					onclick={() => (activeTab = 'path')}
					class="inline-flex min-h-10 items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all focus-visible:outline-2 focus-visible:outline-blue-600 {activeTab === 'path' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'}"
				>
					<i class="fa-solid fa-route" aria-hidden="true"></i>
					Learning Path
				</button>
				<button
					type="button"
					role="tab"
					id="tab-materi"
					aria-selected={activeTab === 'materi'}
					aria-controls="panel-materi"
					onclick={() => (activeTab = 'materi')}
					class="inline-flex min-h-10 items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all focus-visible:outline-2 focus-visible:outline-blue-600 {activeTab === 'materi' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'}"
				>
					<i class="fa-solid fa-list-check" aria-hidden="true"></i>
					Detail Materi
				</button>
			</div>
		</div>

		{#if activeTab === 'path'}
			<div id="panel-path" role="tabpanel" aria-labelledby="tab-path">
				<!-- MANAJER LEARNING PATH: tambah/kurang modul & sub-modul dari patch jalur.
				     Klik judul modul → halaman kelola sub-modul,
				     klik judul sub-modul → halaman kelola materi. -->
				<LearningPathManager
					bind:modules={editableModules}
					onnotice={markSaved}
					moduleHref={(mod) => `/instruktur/kursusku/${courseId}/${mod.id}`}
					subHref={(mod, sub) => `/instruktur/kursusku/${courseId}/${mod.id}/${sub.id}`}
				/>
			</div>
		{:else}
			<div id="panel-materi" role="tabpanel" aria-labelledby="tab-materi">
				<p class="mb-3 rounded-2xl border border-blue-100 bg-blue-50/60 px-4 py-2.5 text-xs leading-relaxed text-slate-600">
					<i class="fa-solid fa-circle-info mr-1.5 text-blue-500" aria-hidden="true"></i>
					Tambah / hapus <strong>materi</strong> di tiap sub-modul di sini. Untuk tambah / hapus
					<strong>modul &amp; sub-modul</strong>, gunakan tab Learning Path.
				</p>
				<!-- ORGANISM: editor kurikulum hierarkis bersama -->
				<CurriculumEditor bind:modules={editableModules} onnotice={markSaved} />
			</div>
		{/if}

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

		<div class="mt-6 flex flex-col gap-3 rounded-2xl border border-blue-100 bg-blue-50/60 p-5 sm:flex-row sm:items-center sm:justify-between">
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
