<script lang="ts">
	import type { JSONContent } from '@tiptap/core';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { getCourseById } from '$lib/data/courses';
	import type { CourseModule } from '$lib/data/courses';
	import {
		loadCurriculumDraft,
		saveCurriculumDraft,
		withSyncedFlat
	} from '$lib/stores/curriculum';
	import {
		loadMaterialDoc,
		saveMaterialDoc
	} from '$lib/stores/material-docs';
	import MaterialEditor from '$lib/components/training/organisms/MaterialEditor.svelte';
	import MaterialPreview from '$lib/components/training/organisms/MaterialPreview.svelte';
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

	/* Dokumen tersimpan (SSR-aman: null di server, isi draf di klien). */
	const storedDoc = $derived(loadMaterialDoc(courseId, moduleId, subId, materialId));
	const initialContent = $derived(storedDoc?.content ?? null);
	const previewJson = $derived(latestJson ?? storedDoc?.content ?? null);
	const previewTitle = $derived(
		(matIndex >= 0 ? editableModules[moduleIndex].subModules![subIndex].materials[matIndex].title : '') ||
			storedDoc?.title ||
			''
	);

	const storedUpdatedAt = $derived(storedDoc?.updatedAt ?? '');

	function handleUpdate(info: { json: JSONContent; words: number }) {
		latestJson = info.json;
		latestWords = info.words;
		dirty = true;
	}

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
		const content = latestJson ?? storedDoc?.content ?? null;
		const updatedAt = new Date().toISOString();
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
	}
</script>

<svelte:head>
	<title>
		{material ? `Editor: ${material.title}` : 'Materi tidak ditemukan'} — Instruktur Aristoteles
	</title>
	<meta
		name="description"
		content={material
			? `Susun dokumen materi ${material.title} dengan teks, gambar, video, kode, dan PDF`
			: 'Editor dokumen materi'}
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
			<div class="relative overflow-hidden bg-slate-900 p-5 sm:px-7 sm:py-6">
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
						<i class="fa-solid fa-pen-nib" aria-hidden="true"></i>
						Editor dokumen materi
					</p>
					<h1 id="editor-heading" class="mt-2.5 text-xl font-extrabold text-white sm:text-2xl">
						Modul {moduleIndex + 1} · Sub-modul {moduleIndex + 1}.{subIndex + 1}
					</h1>
					<p class="mt-1 flex flex-wrap gap-1.5 text-[11px] font-bold">
						<span class="rounded-full bg-white/15 px-2.5 py-0.5 text-white backdrop-blur">
							{material.type}
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
							class="inline-flex min-h-10 items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all focus-visible:outline-2 focus-visible:outline-blue-600 {mode === 'tulis' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'}"
						>
							<i class="fa-solid fa-pen" aria-hidden="true"></i> Tulis
						</button>
						<button
							type="button"
							role="tab"
							id="tab-pratinjau"
							aria-selected={mode === 'pratinjau'}
							aria-controls="panel-pratinjau"
							onclick={() => (mode = 'pratinjau')}
							class="inline-flex min-h-10 items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all focus-visible:outline-2 focus-visible:outline-blue-600 {mode === 'pratinjau' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'}"
						>
							<i class="fa-solid fa-eye" aria-hidden="true"></i> Pratinjau
						</button>
					</div>
					<div class="flex items-center gap-2">
						<span class="text-[11px] font-semibold text-slate-400" aria-live="polite">
							{latestWords > 0 ? `${latestWords} kata` : ''}
							{lastSavedLabel && !dirty ? ` · tersimpan ${lastSavedLabel}` : ''}
						</span>
						<button
							type="button"
							onclick={handleSave}
							class="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-blue-600/25 transition-all hover:bg-blue-700 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-blue-600"
						>
							<i class="fa-solid fa-floppy-disk" aria-hidden="true"></i> Simpan draft
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

		{#if mode === 'tulis'}
			<div id="panel-tulis" role="tabpanel" aria-labelledby="tab-tulis">
				<MaterialEditor docKey={docKey} initialContent={initialContent} onupdate={handleUpdate} />
				<p class="mt-3 flex items-start gap-2 text-[11px] leading-relaxed text-slate-500">
					<i class="fa-solid fa-lightbulb mt-0.5 shrink-0 text-amber-500" aria-hidden="true"></i>
					<span>
						Letakkan kursor di antara paragraf lalu gunakan ikon gambar, video, atau PDF untuk
						menyisipkan media tepat di posisi tersebut. Blok dapat dihapus dengan memilihnya lalu
						menekan Backspace.
					</span>
				</p>
			</div>
		{:else}
			<div id="panel-pratinjau" role="tabpanel" aria-labelledby="tab-pratinjau">
				<MaterialPreview content={previewJson} title={previewTitle} />
			</div>
		{/if}

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
