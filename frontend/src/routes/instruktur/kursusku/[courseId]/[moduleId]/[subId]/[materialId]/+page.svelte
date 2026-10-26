<script lang="ts">
	import type { JSONContent } from '@tiptap/core';
	import { generateHTML } from '@tiptap/html';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { getCourseById, normalizeMaterialType } from '$lib/data/courses';
	import type { CourseModule } from '$lib/data/courses';
	import {
		loadCurriculumDraft,
		saveCurriculumDraft,
		withSyncedFlat
	} from '$lib/stores/curriculum';
	import {
		countDocWords,
		loadMaterialDoc,
		saveMaterialDoc
	} from '$lib/stores/material-docs';
	import { createEditorExtensions } from '$lib/tiptap/extensions';
	import {
		blankQuizDraft,
		DEFAULT_PASS_SCORE,
		loadQuizDraft,
		normalizePassScore,
		saveQuizDraft,
		validateQuizDraft,
		type QuizDraft
	} from '$lib/stores/quiz-drafts';
	import {
		blankTaskDraft,
		countTaskPoints,
		loadTaskDraft,
		saveTaskDraft,
		validateTaskDraft,
		type TaskDraft
	} from '$lib/stores/task-drafts';
	import MaterialEditor from '$lib/components/training/organisms/MaterialEditor.svelte';
	import MaterialPreview from '$lib/components/training/organisms/MaterialPreview.svelte';
	import QuizBuilder from '$lib/components/training/organisms/QuizBuilder.svelte';
	import TaskBriefBuilder from '$lib/components/training/organisms/TaskBriefBuilder.svelte';
	import TaskStepsList from '$lib/components/training/molecules/TaskStepsList.svelte';
	import WarningModal from '$lib/components/WarningModal.svelte';

	const courseId = $derived(Number(page.params.courseId));
	const moduleId = $derived(page.params.moduleId ?? '');
	const subId = $derived(page.params.subId ?? '');
	const materialId = $derived(page.params.materialId ?? '');
	const course = $derived(getCourseById(courseId));

	let editableModules = $state<CourseModule[]>([]);
	let savedMessage = $state('');
	let saveError = $state('');
	let initializedFor = $state<string | null>(null);
	let mode = $state<'tulis' | 'pratinjau'>('tulis');
	let latestJson = $state<JSONContent | null>(null);
	let latestWords = $state(0);
	let dirty = $state(false);
	let lastSavedLabel = $state('');
	let showLeave = $state(false);
	/** Draf kuis (tipe kuis): disunting via QuizBuilder. */
	let latestQuiz = $state<QuizDraft | null>(null);
	let quizCount = $state(0);
	let storedQuiz = $state<QuizDraft | null>(null);
	/** Draf tugas (tipe tugas): disunting via TaskBriefBuilder (3 bagian). */
	let latestTask = $state<TaskDraft | null>(null);
	let taskCount = $state(0);
	let storedTask = $state<TaskDraft | null>(null);

	const backHref = $derived(`/instruktur/kursusku/${courseId}/${moduleId}/${subId}`);

	const initKey = $derived(`${courseId}::${moduleId}::${subId}::${materialId}`);
	const docKey = $derived(`${courseId}/${moduleId}/${subId}/${materialId}`);

	/* Muat draf kurikulum bersama (judul/tipe/durasi materi). */
	$effect(() => {
		if (!course || initializedFor === initKey) return;
		editableModules = loadCurriculumDraft(courseId).map(withSyncedFlat);
		savedMessage = '';
		saveError = '';
		latestJson = null;
		latestWords = 0;
		latestQuiz = null;
		quizCount = 0;
		storedQuiz = loadQuizDraft(courseId, moduleId, subId, materialId);
		latestTask = null;
		taskCount = 0;
		storedTask = loadTaskDraft(courseId, moduleId, subId, materialId);
		dirty = false;
		lastSavedLabel = '';
		initializedFor = initKey;
	});

	/* Simpan draf kurikulum setiap berubah (judul materi ikut tersinkron). */
	$effect(() => {
		if (initializedFor !== initKey || !course) return;
		saveCurriculumDraft(courseId, editableModules);
	});

	const moduleIndex = $derived(editableModules.findIndex((m) => m.id === moduleId));
	const mod = $derived(moduleIndex >= 0 ? editableModules[moduleIndex] : undefined);
	const subIndex = $derived((mod?.subModules ?? []).findIndex((s) => s.id === subId));
	const sub = $derived(subIndex >= 0 ? mod?.subModules?.[subIndex] : undefined);
	const matIndex = $derived((sub?.materials ?? []).findIndex((m) => m.id === materialId));
	const material = $derived(matIndex >= 0 ? sub?.materials[matIndex] : undefined);
	/** Model 3-tipe: materi (audio/video/teks) · tugas (3 bagian) · kuis. */
	const kind = $derived(
		material ? normalizeMaterialType(String(material.type)) : ('materi' as const)
	);
	const kindLabel = $derived(kind === 'kuis' ? 'Kuis' : kind === 'tugas' ? 'Tugas' : 'Materi');

	/* Dokumen tersimpan (SSR-aman: null di server, isi draf di klien). */
	const storedDoc = $derived(loadMaterialDoc(courseId, moduleId, subId, materialId));
	const initialContent = $derived(storedDoc?.content ?? null);
	const previewJson = $derived(latestJson ?? storedDoc?.content ?? null);
	const previewTitle = $derived(
		(matIndex >= 0 ? editableModules[moduleIndex].subModules![subIndex].materials[matIndex].title : '') ||
			storedDoc?.title ||
			''
	);

	const storedUpdatedAt = $derived(
		kind === 'kuis'
			? (storedQuiz?.updatedAt ?? '')
			: kind === 'tugas'
				? (storedTask?.updatedAt ?? '')
				: (storedDoc?.updatedAt ?? '')
	);

	function handleUpdate(info: { json: JSONContent; words: number }) {
		latestJson = info.json;
		latestWords = info.words;
		dirty = true;
	}

	function handleQuizUpdate(info: { draft: QuizDraft; valid: boolean; count: number }) {
		latestQuiz = info.draft;
		quizCount = info.count;
		dirty = true;
	}

	function handleTaskUpdate(info: { draft: TaskDraft; valid: boolean; count: number }) {
		latestTask = info.draft;
		taskCount = info.count;
		dirty = true;
	}

	const quizInitial = $derived(storedQuiz ?? blankQuizDraft(material?.title ?? ''));
	const quizPreview = $derived(latestQuiz ?? storedQuiz ?? null);
	const quizPassScore = $derived(
		normalizePassScore(quizPreview?.passScore ?? DEFAULT_PASS_SCORE)
	);
	const quizStatus = $derived(
		latestQuiz ?? storedQuiz
			? `${quizCount || storedQuiz?.questions.length || 0} soal · minimal ${quizPassScore}`
			: ''
	);

	const taskInitial = $derived(storedTask ?? blankTaskDraft(material?.title ?? ''));
	const taskPreview = $derived(latestTask ?? storedTask ?? null);
	const taskStatus = $derived(
		latestTask ?? storedTask
			? `${taskCount || (storedTask ? countTaskPoints(storedTask) : 0)} poin`
			: ''
	);
	/** HTML deskripsi tugas untuk pratinjau (SSR-aman: kosong di server). */
	const taskBriefHtml = $derived.by(() => {
		const content = taskPreview?.brief;
		if (!content) return '';
		try {
			return generateHTML(content, createEditorExtensions(''));
		} catch {
			return '';
		}
	});
	const taskBriefEmpty = $derived(
		!taskPreview ||
			(countDocWords(taskPreview.brief) === 0 &&
				!taskPreview.objectives.some((o) => o.trim()) &&
				!taskPreview.steps.some((s) => s.trim()))
	);

	/** Cegah keluar diam-diam saat ada perubahan belum disimpan. */
	function handleBack(event: MouseEvent) {
		if (!dirty) return;
		event.preventDefault();
		showLeave = true;
	}

	function confirmLeave() {
		showLeave = false;
		goto(backHref);
	}

	function touchModule() {
		if (moduleIndex < 0) return;
		editableModules[moduleIndex] = withSyncedFlat(editableModules[moduleIndex]);
	}

	function handleSave() {
		saveError = '';
		if (moduleIndex < 0 || subIndex < 0 || matIndex < 0) return;
		const title =
			editableModules[moduleIndex].subModules![subIndex].materials[matIndex].title.trim();
		if (!title) {
			saveError = 'Isi judul materi terlebih dahulu sebelum menyimpan draf.';
			return;
		}
		const updatedAt = new Date().toISOString();
		if (kind === 'tugas') {
			const draft: TaskDraft = {
				title,
				brief: latestTask?.brief ?? storedTask?.brief ?? null,
				objectives: latestTask?.objectives ?? storedTask?.objectives ?? [],
				steps: latestTask?.steps ?? storedTask?.steps ?? [],
				updatedAt
			};
			const err = validateTaskDraft(draft);
			if (err) {
				saveError = err;
				return;
			}
			const okTask = saveTaskDraft(courseId, moduleId, subId, materialId, draft);
			if (!okTask) {
				saveError = 'Draf tugas gagal tersimpan: penyimpanan lokal penuh.';
				return;
			}
			storedTask = draft;
			latestTask = null;
			touchModule();
			saveCurriculumDraft(courseId, editableModules);
			dirty = false;
			lastSavedLabel = new Date(updatedAt).toLocaleString('id-ID', {
				day: 'numeric',
				month: 'short',
				hour: '2-digit',
				minute: '2-digit'
			});
			savedMessage = `Draf tugas tersimpan ${lastSavedLabel} (${countTaskPoints(draft)} poin).`;
			goto(backHref);
			return;
		}
		if (kind === 'kuis') {
			const draft: QuizDraft = {
				title,
				intro: latestQuiz?.intro ?? storedQuiz?.intro ?? '',
				passScore: normalizePassScore(
					latestQuiz?.passScore ?? storedQuiz?.passScore ?? DEFAULT_PASS_SCORE
				),
				questions: latestQuiz?.questions ?? storedQuiz?.questions ?? [],
				updatedAt
			};
			const err = validateQuizDraft({ ...draft, title: title || 'x' });
			if (err) {
				saveError = err;
				return;
			}
			const ok = saveQuizDraft(courseId, moduleId, subId, materialId, draft);
			if (!ok) {
				saveError = 'Draf kuis gagal tersimpan: penyimpanan lokal penuh.';
				return;
			}
			storedQuiz = draft;
			latestQuiz = null;
			touchModule();
			saveCurriculumDraft(courseId, editableModules);
			dirty = false;
			lastSavedLabel = new Date(updatedAt).toLocaleString('id-ID', {
				day: 'numeric',
				month: 'short',
				hour: '2-digit',
				minute: '2-digit'
			});
			savedMessage = `Draf kuis tersimpan ${lastSavedLabel} (${draft.questions.length} soal, minimal ${draft.passScore}).`;
			goto(backHref);
			return;
		}
		const content = latestJson ?? storedDoc?.content ?? null;
		const ok = saveMaterialDoc(courseId, moduleId, subId, materialId, {
			title,
			content,
			updatedAt
		});
		if (!ok) {
			saveError =
				'Draf gagal tersimpan: penyimpanan lokal penuh (mungkin lampiran terlalu besar). Kecilkan gambar/PDF lalu coba lagi.';
			return;
		}
		touchModule();
		saveCurriculumDraft(courseId, editableModules);
		dirty = false;
		lastSavedLabel = new Date(updatedAt).toLocaleString('id-ID', {
			day: 'numeric',
			month: 'short',
			hour: '2-digit',
			minute: '2-digit'
		});
		savedMessage = `Draf tersimpan ${lastSavedLabel}. Judul materi ikut tersinkron ke daftar materi.`;
		goto(backHref);
	}
</script>

<svelte:head>
	<title>
		{material ? `Editor: ${material.title}` : 'Materi tidak ditemukan'} — Instruktur Aristoteles
	</title>
	<meta
		name="description"
		content={material
			? kind === 'kuis'
				? `Susun soal kuis ${material.title} dengan 4 opsi dan kunci jawaban`
				: kind === 'tugas'
					? `Susun penugasan ${material.title}: deskripsi, tujuan, dan langkah pengerjaan`
					: `Susun materi ${material.title} dengan teks, audio, video, dan gambar`
			: 'Editor materi'}
	/>
</svelte:head>

<div class="p-4 sm:p-6 lg:p-8">
	{#if !course}
		<div class="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-10 text-center">
			<i class="fa-solid fa-triangle-exclamation mb-3 text-3xl text-amber-500" aria-hidden="true"></i>
			<h1 class="text-xl font-bold text-slate-900">Kursus tidak ditemukan</h1>
			<p class="mt-1 text-sm text-slate-500">
				ID kursus “{page.params.courseId}” tidak terdaftar di Kursusku.
			</p>
			<a
				href="/instruktur/kursusku"
				class="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
			>
				<i class="fa-solid fa-arrow-left" aria-hidden="true"></i> Kembali ke Kursusku
			</a>
		</div>
	{:else if !mod}
		<div class="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-10 text-center">
			<i class="fa-solid fa-layer-group mb-3 text-3xl text-slate-300" aria-hidden="true"></i>
			<h1 class="text-xl font-bold text-slate-900">Modul tidak ditemukan</h1>
			<p class="mt-1 text-sm text-slate-500">Modul “{moduleId}” tidak ada di “{course.title}”.</p>
			<a
				href={`/instruktur/kursusku/${courseId}`}
				class="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
			>
				<i class="fa-solid fa-arrow-left" aria-hidden="true"></i> Kembali ke daftar modul
			</a>
		</div>
	{:else if !sub}
		<div class="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-10 text-center">
			<i class="fa-solid fa-puzzle-piece mb-3 text-3xl text-slate-300" aria-hidden="true"></i>
			<h1 class="text-xl font-bold text-slate-900">Sub-modul tidak ditemukan</h1>
			<p class="mt-1 text-sm text-slate-500">Sub-modul “{subId}” tidak ada di Modul {moduleIndex + 1}.</p>
			<a
				href={`/instruktur/kursusku/${courseId}/${moduleId}`}
				class="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
			>
				<i class="fa-solid fa-arrow-left" aria-hidden="true"></i> Kembali ke sub-modul
			</a>
		</div>
	{:else if !material}
		<div class="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-10 text-center">
			<i class="fa-solid fa-book-open mb-3 text-3xl text-slate-300" aria-hidden="true"></i>
			<h1 class="text-xl font-bold text-slate-900">Materi tidak ditemukan</h1>
			<p class="mt-1 text-sm text-slate-500">
				Materi “{materialId}” tidak ada di Sub-modul {moduleIndex + 1}.{subIndex + 1}.
			</p>
			<a
				href={`/instruktur/kursusku/${courseId}/${moduleId}/${subId}`}
				class="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
			>
				<i class="fa-solid fa-arrow-left" aria-hidden="true"></i> Kembali ke daftar materi
			</a>
		</div>
	{:else}
		<nav aria-label="Breadcrumb" class="mb-4 flex flex-wrap items-center gap-2 text-xs text-slate-500">
			<a
				href="/instruktur/kursusku"
				class="rounded font-semibold text-blue-600 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
			>
				Kursusku
			</a>
			<i class="fa-solid fa-chevron-right text-[10px] text-slate-300" aria-hidden="true"></i>
			<a
				href={`/instruktur/kursusku/${courseId}`}
				class="rounded font-semibold text-blue-600 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
			>
				{course.title}
			</a>
			<i class="fa-solid fa-chevron-right text-[10px] text-slate-300" aria-hidden="true"></i>
			<a
				href={`/instruktur/kursusku/${courseId}/${moduleId}`}
				class="rounded font-semibold text-blue-600 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
			>
				Modul {moduleIndex + 1}
			</a>
			<i class="fa-solid fa-chevron-right text-[10px] text-slate-300" aria-hidden="true"></i>
			<a
				href={`/instruktur/kursusku/${courseId}/${moduleId}/${subId}`}
				class="rounded font-semibold text-blue-600 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
			>
				Sub-modul {moduleIndex + 1}.{subIndex + 1}
			</a>
			<i class="fa-solid fa-chevron-right text-[10px] text-slate-300" aria-hidden="true"></i>
			<span aria-current="page" class="truncate font-medium text-slate-700">
				Editor: {material.title || '(belum berjudul)'}
			</span>
		</nav>

		<!-- Kepala editor -->
		<section aria-labelledby="editor-heading" class="mb-5 overflow-hidden rounded-3xl border border-slate-200/70 bg-white shadow-lg shadow-slate-900/5">
			<div class="relative overflow-hidden bg-violet-900 p-5 sm:px-7 sm:py-6">
				<div
					class="pointer-events-none absolute -top-16 -right-10 h-48 w-48 rounded-full bg-blue-500/20 blur-2xl"
					aria-hidden="true"
				></div>
				<div
					class="pointer-events-none absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-blue-600 via-cyan-400 to-blue-600"
					aria-hidden="true"
				></div>
				<div class="relative">
					<p
						class="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[10px] font-extrabold tracking-[0.16em] text-white uppercase backdrop-blur"
					>
						<i
							class="fa-solid {kind === 'kuis'
								? 'fa-circle-question'
								: kind === 'tugas'
									? 'fa-pen-to-square'
									: 'fa-pen-nib'}"
							aria-hidden="true"
						></i>
						Editor {kindLabel}
					</p>
					<h1 id="editor-heading" class="mt-2.5 text-xl font-extrabold text-white sm:text-2xl">
						Modul {moduleIndex + 1} · Sub-modul {moduleIndex + 1}.{subIndex + 1}
					</h1>
					<p class="mt-1 flex flex-wrap gap-1.5 text-[11px] font-bold">
						<span class="rounded-full bg-white/15 px-2.5 py-0.5 text-white backdrop-blur">
							{kindLabel}
						</span>
						<span class="rounded-full bg-white/15 px-2.5 py-0.5 text-white backdrop-blur">
							{material.duration}
						</span>
						{#if storedUpdatedAt}
							<span class="rounded-full bg-emerald-400/20 px-2.5 py-0.5 text-emerald-200 backdrop-blur">
								Draf: {new Date(storedUpdatedAt).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
							</span>
						{/if}
						{#if dirty}
							<span class="rounded-full bg-amber-400/20 px-2.5 py-0.5 text-amber-200 backdrop-blur">
								Belum disimpan
							</span>
						{/if}
					</p>
				</div>
			</div>

			<div class="grid gap-3 p-4 sm:p-6">
				<div>
					<label for="material-title" class="mb-1 block text-xs font-bold text-slate-700">
						Judul materi <span class="text-red-500" aria-hidden="true">*</span>
					</label>
					<input
						id="material-title"
						type="text"
						bind:value={editableModules[moduleIndex].subModules![subIndex].materials[matIndex].title}
						oninput={touchModule}
						placeholder="cth. Pengenalan HTML5"
						class="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-900 placeholder:font-normal placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
					/>
				</div>
				<div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
					<div
						role="tablist"
						aria-label="Mode editor materi"
						class="inline-flex w-fit rounded-2xl border border-slate-200 bg-white p-1 shadow-sm"
					>
						<button
							type="button"
							role="tab"
							id="tab-tulis"
							aria-selected={mode === 'tulis'}
							aria-controls="panel-tulis"
							onclick={() => (mode = 'tulis')}
							class="inline-flex min-h-10 items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all focus-visible:outline-2 focus-visible:outline-blue-600 {mode === 'tulis' ? 'bg-violet-700 text-white shadow-lg shadow-violet-700/25' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'}"
						>
							<i class="fa-solid fa-pen" aria-hidden="true"></i> {kind === 'kuis'
							? 'Buat soal'
							: kind === 'tugas'
								? 'Buat tugas'
								: 'Tulis'}
						</button>
						<button
							type="button"
							role="tab"
							id="tab-pratinjau"
							aria-selected={mode === 'pratinjau'}
							aria-controls="panel-pratinjau"
							onclick={() => (mode = 'pratinjau')}
							class="inline-flex min-h-10 items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all focus-visible:outline-2 focus-visible:outline-blue-600 {mode === 'pratinjau' ? 'bg-violet-700 text-white shadow-lg shadow-violet-700/25' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'}"
						>
							<i class="fa-solid fa-eye" aria-hidden="true"></i> Pratinjau
						</button>
					</div>
					<div class="flex items-center gap-2">
						<span class="text-[11px] font-semibold text-slate-400" aria-live="polite">
							{#if kind === 'kuis'}
								{quizStatus}
							{:else if kind === 'tugas'}
								{taskStatus}
							{:else}
								{latestWords > 0 ? `${latestWords} kata` : ''}
							{/if}
							{lastSavedLabel && !dirty ? ` · tersimpan ${lastSavedLabel}` : ''}
						</span>
						<button
							type="button"
							onclick={handleSave}
							class="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-blue-600/25 transition-all hover:bg-blue-700 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-blue-600"
						>
							<i class="fa-solid fa-floppy-disk" aria-hidden="true"></i> Simpan
						</button>
					</div>
				</div>
				{#if savedMessage}
					<p
						role="status"
						class="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700"
					>
						<i class="fa-solid fa-circle-check mt-0.5 shrink-0" aria-hidden="true"></i> {savedMessage}
					</p>
				{/if}
				{#if saveError}
					<p
						role="alert"
						class="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700"
					>
						<i class="fa-solid fa-circle-exclamation mt-0.5 shrink-0" aria-hidden="true"></i> {saveError}
					</p>
				{/if}
			</div>
		</section>

		<!-- Panel tulis: kuis, tugas, dan materi memakai pembuatnya masing-masing.
			`hidden` menyembunyikan tanpa menghancurkan instance editor. -->
		<div id="panel-tulis" role="tabpanel" aria-labelledby="tab-tulis" hidden={mode !== 'tulis'}>
			{#if kind === 'kuis'}
				<QuizBuilder draftKey={docKey} initial={quizInitial} onupdate={handleQuizUpdate} />
				<p class="mt-3 flex items-start gap-2 text-[11px] leading-relaxed text-slate-500">
					<i class="fa-solid fa-lightbulb mt-0.5 shrink-0 text-amber-500" aria-hidden="true"></i>
					<span>
						Setiap soal wajib punya 4 opsi dan satu kunci jawaban (radio kuning). Tambah,
						hapus, atau susun ulang soal lalu tekan Simpan.
					</span>
				</p>
			{:else if kind === 'tugas'}
				<TaskBriefBuilder draftKey={docKey} initial={taskInitial} onupdate={handleTaskUpdate} />
				<p class="mt-3 flex items-start gap-2 text-[11px] leading-relaxed text-slate-500">
					<i class="fa-solid fa-lightbulb mt-0.5 shrink-0 text-amber-500" aria-hidden="true"></i>
					<span>
						Wajib isi ketiga bagian: deskripsi, minimal 1 tujuan, dan minimal 1 langkah.
						Jumlah langkah bebas — boleh kurang atau lebih dari 4. Tekan Simpan bila selesai.
					</span>
				</p>
			{:else}
				<MaterialEditor
					docKey={docKey}
					initialContent={initialContent}
					variant="full"
					onupdate={handleUpdate}
				/>
				<p class="mt-3 flex items-start gap-2 text-[11px] leading-relaxed text-slate-500">
					<i class="fa-solid fa-lightbulb mt-0.5 shrink-0 text-amber-500" aria-hidden="true"></i>
					<span>
						Materi dapat berupa teks, audio, video, maupun gambar: letakkan kursor di
						antara paragraf lalu gunakan ikon gambar, video, audio, atau PDF untuk
						menyisipkan media tepat di posisi tersebut.
					</span>
				</p>
			{/if}
		</div>
		<div
			id="panel-pratinjau"
			role="tabpanel"
			aria-labelledby="tab-pratinjau"
			hidden={mode !== 'pratinjau'}
		>
			{#if kind === 'kuis'}
				<article
					aria-label="Pratinjau kuis bagi peserta"
					class="overflow-hidden rounded-2xl border border-slate-200/80 bg-white"
				>
					<div class="border-b border-slate-100 bg-slate-50/70 px-5 py-4 sm:px-7">
						<div class="flex flex-wrap items-center gap-2">
							<p class="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-[10px] font-extrabold tracking-widest text-amber-700 uppercase ring-1 ring-amber-200">
								<i class="fa-solid fa-eye" aria-hidden="true"></i> Tampilan peserta
							</p>
							<p class="inline-flex items-center gap-1.5 rounded-full bg-violet-700 px-3 py-1 text-[10px] font-extrabold tracking-widest text-white uppercase">
								<i class="fa-solid fa-award text-amber-300" aria-hidden="true"></i> Minimal {quizPassScore} untuk lolos
							</p>
						</div>
						<h2 class="mt-2 text-lg leading-snug font-extrabold text-slate-900 sm:text-xl">
							{previewTitle || '(belum berjudul)'}
						</h2>
						{#if quizPreview?.intro}
							<p class="mt-1 text-xs text-slate-500">{quizPreview.intro}</p>
						{/if}
					</div>
					<div class="space-y-3 px-5 py-5 sm:px-7 sm:py-6">
						{#if !quizPreview || quizPreview.questions.length === 0}
							<div class="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
								<i class="fa-solid fa-circle-question mb-2 text-xl text-slate-300" aria-hidden="true"></i>
								<p class="text-sm font-bold text-slate-500">Belum ada soal</p>
								<p class="mt-1 text-xs text-slate-400">
									Beralih ke tab Buat soal untuk menyusun kuis.
								</p>
							</div>
						{:else}
							<ol class="space-y-3">
								{#each quizPreview.questions as q, qi (qi)}
									<li class="rounded-xl border border-slate-200 p-4">
										<p class="text-sm font-bold text-slate-900">
											<span class="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-lg bg-violet-600 text-[11px] font-extrabold text-white">{qi + 1}</span>
											{q.question || '(pertanyaan kosong)'}
										</p>
										<ul class="mt-2 space-y-1.5">
											{#each q.options as opt, oi (oi)}
												<li
													class="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs {oi ===
													q.answer
														? 'border-emerald-300 bg-emerald-50 font-bold text-emerald-800'
														: 'border-slate-200 text-slate-600'}"
												>
													<span class="font-extrabold">{String.fromCharCode(65 + oi)}.</span>
													<span class="flex-1">{opt || '(kosong)'}</span>
													{#if oi === q.answer}
														<i class="fa-solid fa-circle-check text-emerald-600" aria-hidden="true"></i>
													{/if}
												</li>
											{/each}
										</ul>
										{#if q.explanation}
											<p class="mt-2 text-[11px] text-slate-500">
												<i class="fa-solid fa-comment-dots mr-1" aria-hidden="true"></i>{q.explanation}
											</p>
										{/if}
									</li>
								{/each}
							</ol>
						{/if}
					</div>
				</article>
			{:else if kind === 'tugas'}
				<article
					aria-label="Pratinjau tugas bagi peserta"
					class="overflow-hidden rounded-2xl border border-slate-200/80 bg-white"
				>
					<div class="border-b border-slate-100 bg-slate-50/70 px-5 py-4 sm:px-7">
						<p class="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-3 py-1 text-[10px] font-extrabold tracking-widest text-violet-700 uppercase ring-1 ring-violet-200">
							<i class="fa-solid fa-eye" aria-hidden="true"></i> Tampilan peserta
						</p>
						<h2 class="mt-2 text-lg leading-snug font-extrabold text-slate-900 sm:text-xl">
							{previewTitle || '(belum berjudul)'}
						</h2>
					</div>
					<div class="space-y-4 px-5 py-5 sm:px-7 sm:py-6">
						{#if taskBriefEmpty}
							<div class="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
								<i class="fa-solid fa-briefcase mb-2 text-xl text-slate-300" aria-hidden="true"></i>
								<p class="text-sm font-bold text-slate-500">Belum ada isi tugas</p>
								<p class="mt-1 text-xs text-slate-400">
									Beralih ke tab Buat tugas untuk mengisi deskripsi, tujuan, dan langkah.
								</p>
							</div>
						{:else if taskPreview}
							<div>
								<p class="mb-1.5 flex items-center gap-1.5 text-xs font-extrabold tracking-wide text-slate-500 uppercase">
									<span class="flex h-5 w-5 items-center justify-center rounded-md bg-violet-600 text-[10px] text-white">1</span>
									Deskripsi Penugasan
								</p>
								{#if taskBriefHtml}
									<div class="mdoc">{@html taskBriefHtml}</div>
								{:else}
									<p class="text-sm text-slate-400">(belum diisi)</p>
								{/if}
							</div>
							<div>
								<p class="mb-1.5 flex items-center gap-1.5 text-xs font-extrabold tracking-wide text-slate-500 uppercase">
									<span class="flex h-5 w-5 items-center justify-center rounded-md bg-violet-600 text-[10px] text-white">2</span>
									Tujuan Penugasan
								</p>
								<ul class="space-y-1.5">
									{#each taskPreview.objectives.filter((o) => o.trim()) as obj, oi (oi)}
										<li class="flex items-start gap-2 text-sm text-slate-700">
											<i class="fa-solid fa-circle-check mt-1 shrink-0 text-xs text-emerald-500" aria-hidden="true"></i>
											<span>{obj}</span>
										</li>
									{/each}
								</ul>
							</div>
							<div>
								<p class="mb-1.5 flex items-center gap-1.5 text-xs font-extrabold tracking-wide text-slate-500 uppercase">
									<span class="flex h-5 w-5 items-center justify-center rounded-md bg-violet-600 text-[10px] text-white">3</span>
									Langkah Pengerjaan
								</p>
								<TaskStepsList steps={taskPreview.steps.filter((s) => s.trim())} />
							</div>
						{/if}
					</div>
				</article>
			{:else}
				<MaterialPreview content={previewJson} title={previewTitle} />
			{/if}
		</div>

		<div class="mt-6">
			<a
				href={backHref}
				onclick={handleBack}
				class="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 transition-all hover:bg-slate-50 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-slate-500"
			>
				<i class="fa-solid fa-arrow-left" aria-hidden="true"></i> Daftar materi
			</a>
		</div>

		<WarningModal
			bind:open={showLeave}
			type="warning"
			title="Buang perubahan?"
			message="Ada perubahan dokumen yang belum disimpan. Perubahan tersebut akan hilang jika Anda kembali sekarang."
			confirmText="Ya, tinggalkan"
			cancelText="Tetap di sini"
			onconfirm={confirmLeave}
		/>
	{/if}
</div>
