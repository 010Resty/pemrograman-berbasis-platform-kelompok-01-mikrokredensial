<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { getCourseById } from '$lib/data/courses';
	import type { CourseModule, SubModule } from '$lib/data/courses';
	import {
		curriculumUid,
		loadCurriculumDraft,
		saveCurriculumDraft,
		withSyncedFlat
	} from '$lib/stores/curriculum';
	import WarningModal from '$lib/components/WarningModal.svelte';

	const courseId = $derived(Number(page.params.courseId));
	const moduleId = $derived(page.params.moduleId);
	const course = $derived(getCourseById(courseId));

	let editableModules = $state<CourseModule[]>([]);
	let savedMessage = $state('');
	let initializedFor = $state<string | null>(null);
	let openSubs = $state<string[]>([]);
	/** Hapus yang menunggu konfirmasi modal bahaya. */
	let pendingDelete = $state<{
		scope: 'module' | 'sub';
		subId?: string;
		title: string;
		message: string;
	} | null>(null);
	let showDelete = $state(false);

	const initKey = $derived(`${courseId}::${moduleId}`);

	/* Muat draf bersama agar suntingan dari halaman modul terbawa. */
	$effect(() => {
		if (!course || initializedFor === initKey) return;
		editableModules = loadCurriculumDraft(courseId).map(withSyncedFlat);
		savedMessage = '';
		openSubs = [];
		pendingDelete = null;
		initializedFor = initKey;
	});

	/* Simpan setiap perubahan kembali ke draf bersama. */
	$effect(() => {
		if (initializedFor !== initKey || !course) return;
		saveCurriculumDraft(courseId, editableModules);
	});

	const moduleIndex = $derived(editableModules.findIndex((m) => m.id === moduleId));
	const mod = $derived(moduleIndex >= 0 ? editableModules[moduleIndex] : undefined);
	const subs = $derived<SubModule[]>(mod?.subModules ?? []);
	const matCount = $derived(subs.reduce((n, s) => n + s.materials.length, 0));

	function markSaved(msg: string) {
		savedMessage = msg;
	}

	function isOpen(id: string): boolean {
		return openSubs.includes(id);
	}

	function toggleSub(id: string) {
		openSubs = isOpen(id) ? openSubs.filter((x) => x !== id) : [...openSubs, id];
	}

	function touchModule() {
		if (moduleIndex < 0) return;
		editableModules[moduleIndex] = withSyncedFlat(editableModules[moduleIndex]);
	}

	function saveModule() {
		if (moduleIndex < 0) return;
		touchModule();
		saveCurriculumDraft(courseId, editableModules);
		markSaved(`Modul ${moduleIndex + 1} tersimpan.`);
	}

	function cancelDelete() {
		pendingDelete = null;
	}

	function executeDelete() {
		const target = pendingDelete;
		pendingDelete = null;
		showDelete = false;
		if (!target || moduleIndex < 0) return;
		if (target.scope === 'module') {
			const next = editableModules.filter((m) => m.id !== moduleId);
			saveCurriculumDraft(courseId, next);
			goto(`/instruktur/kursusku/${courseId}`);
			return;
		}
		if (target.scope === 'sub' && target.subId) {
			const m = editableModules[moduleIndex];
			const current = m.subModules ?? [];
			if (current.length <= 1) return;
			editableModules[moduleIndex] = withSyncedFlat({
				...m,
				subModules: current.filter((s) => s.id !== target.subId)
			});
			openSubs = openSubs.filter((x) => x !== target.subId);
			markSaved('Sub-modul dihapus.');
		}
	}

	function addSubModule() {
		if (moduleIndex < 0) return;
		const m = editableModules[moduleIndex];
		const current = m.subModules ?? [];
		const sub: SubModule = {
			id: curriculumUid('sub'),
			title: `Sub-modul ${current.length + 1}`,
			description: '',
			materials: []
		};
		editableModules[moduleIndex] = withSyncedFlat({ ...m, subModules: [...current, sub] });
		openSubs = [...openSubs, sub.id];
		pendingDelete = null;
		markSaved('Sub-modul baru ditambahkan.');
	}

	function removeSubModule(subId: string) {
		if (moduleIndex < 0) return;
		const m = editableModules[moduleIndex];
		const current = m.subModules ?? [];
		if (current.length <= 1) return;
		const si = current.findIndex((s) => s.id === subId);
		const target = current[si];
		pendingDelete = {
			scope: 'sub',
			subId,
			title: `Hapus Sub-modul ${moduleIndex + 1}.${si + 1}?`,
			message: `“${target?.title || '(belum berjudul)'}” beserta ${target?.materials.length ?? 0} materi di dalamnya akan dihapus dari draf. Tindakan ini tidak bisa dibatalkan.`
		};
		showDelete = true;
	}

	function moveSub(subId: string, dir: -1 | 1) {
		if (moduleIndex < 0) return;
		const m = editableModules[moduleIndex];
		const current = [...(m.subModules ?? [])];
		const idx = current.findIndex((s) => s.id === subId);
		const target = idx + dir;
		if (idx < 0 || target < 0 || target >= current.length) return;
		[current[idx], current[target]] = [current[target], current[idx]];
		editableModules[moduleIndex] = withSyncedFlat({ ...m, subModules: current });
		markSaved(`Sub-modul dipindah ke posisi ${target + 1}.`);
	}

	function duplicateSub(subId: string) {
		if (moduleIndex < 0) return;
		const m = editableModules[moduleIndex];
		const current = m.subModules ?? [];
		const src = current.find((s) => s.id === subId);
		if (!src) return;
		const copy: SubModule = {
			...structuredClone(src),
			id: curriculumUid('sub'),
			title: `${src.title} (salinan)`,
			materials: []
		};
		const at = current.findIndex((s) => s.id === subId) + 1;
		editableModules[moduleIndex] = withSyncedFlat({
			...m,
			subModules: [...current.slice(0, at), copy, ...current.slice(at)]
		});
		markSaved('Sub-modul diduplikasi (materi tidak ikut disalin).');
	}

	function removeModule() {
		if (moduleIndex < 0) return;
		pendingDelete = {
			scope: 'module',
			title: `Hapus Modul ${moduleIndex + 1}?`,
			message: `“${mod?.title || '(belum berjudul)'}” beserta ${subs.length} sub-modul dan ${matCount} materi di dalamnya akan dihapus dari draf. Tindakan ini tidak bisa dibatalkan.`
		};
		showDelete = true;
	}

	/** Simpan satu sub-modul: tulis eksplisit draf bersama + tampilkan konfirmasi. */
	function saveSubModule(subId: string) {
		if (moduleIndex < 0) return;
		touchModule();
		saveCurriculumDraft(courseId, editableModules);
		const si = (editableModules[moduleIndex].subModules ?? []).findIndex((s) => s.id === subId);
		markSaved(
			si >= 0
				? `Sub-modul ${moduleIndex + 1}.${si + 1} tersimpan.`
				: 'Sub-modul tersimpan.'
		);
	}
</script>

<svelte:head>
	<title>
		{mod ? `Modul ${moduleIndex + 1}: ${mod.title}` : 'Modul tidak ditemukan'} — Instruktur Aristoteles
	</title>
	<meta
		name="description"
		content={mod
			? `Kelola sub-modul dan materi ${mod.title}`
			: 'Kelola sub-modul kursus'}
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
			<i class="fa-solid fa-puzzle-piece mb-3 text-3xl text-slate-300" aria-hidden="true"></i>
			<h1 class="text-xl font-bold text-slate-900">Modul tidak ditemukan</h1>
			<p class="mt-1 text-sm text-slate-500">
				Modul “{moduleId}” tidak ada di “{course.title}”. Mungkin baru saja dihapus.
			</p>
			<a
				href={`/instruktur/kursusku/${courseId}`}
				class="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
			>
				<i class="fa-solid fa-arrow-left" aria-hidden="true"></i> Kembali ke daftar modul
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
			<span aria-current="page" class="truncate font-medium text-slate-700">
				Modul {moduleIndex + 1}: {mod.title}
			</span>
		</nav>

		<!-- Header modul -->
		<section
			aria-labelledby="modul-heading"
			class="mb-6 overflow-hidden rounded-3xl border border-slate-200/70 bg-white shadow-lg shadow-slate-900/5"
		>
			<div class="relative overflow-hidden bg-slate-900 p-5 sm:px-7 sm:py-6">
				<div
					class="pointer-events-none absolute -top-16 -right-10 h-48 w-48 rounded-full bg-blue-500/20 blur-2xl"
					aria-hidden="true"
				></div>
				<div
					class="pointer-events-none absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-blue-600 via-cyan-400 to-blue-600"
					aria-hidden="true"
				></div>
				<div class="relative flex flex-wrap items-center justify-between gap-3">
					<div class="flex min-w-0 items-center gap-3">
						<span
							class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-base font-extrabold text-white shadow-lg ring-4 ring-white/20"
							aria-hidden="true"
						>
							M{moduleIndex + 1}
						</span>
						<div class="min-w-0">
							<p
								class="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[10px] font-extrabold tracking-[0.16em] text-white uppercase backdrop-blur"
							>
								<i class="fa-solid fa-layer-group" aria-hidden="true"></i>
								Kelola sub-modul
							</p>
							<h1
								id="modul-heading"
								class="mt-1.5 truncate text-xl font-extrabold text-white sm:text-2xl"
							>
								{mod.title || '(belum berjudul)'}
							</h1>
						</div>
					</div>
					<div class="rounded-2xl bg-white/15 p-3 text-center backdrop-blur">
						<p class="text-[11px] font-bold text-white">
							{subs.length} sub-modul · {matCount} materi
						</p>
					</div>
				</div>
			</div>

			<div class="grid gap-3 p-4 sm:p-6">
				<div>
					<label for="modul-title" class="mb-1 block text-xs font-bold text-slate-700">
						Judul modul {moduleIndex + 1}
					</label>
					<input
						id="modul-title"
						type="text"
						bind:value={editableModules[moduleIndex].title}
						oninput={touchModule}
						placeholder="cth. CSS Modern & Layout Responsif"
						class="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-900 placeholder:font-normal placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
					/>
				</div>
				<div>
					<label for="modul-desc" class="mb-1 block text-xs font-bold text-slate-700">
						Deskripsi modul
					</label>
					<input
						id="modul-desc"
						type="text"
						bind:value={editableModules[moduleIndex].description}
						oninput={touchModule}
						placeholder="Satu kalimat tujuan modul…"
						class="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-600 placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
					/>
				</div>
				<div class="flex flex-wrap gap-2">
					<button
						type="button"
						onclick={saveModule}
						aria-label={`Simpan Modul ${moduleIndex + 1}`}
						class="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-[11px] font-bold text-white shadow-md shadow-emerald-600/25 transition-all hover:bg-emerald-700 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-emerald-600"
					>
						<i class="fa-solid fa-floppy-disk" aria-hidden="true"></i> Simpan Modul
					</button>
					<button
						type="button"
						onclick={addSubModule}
						class="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-violet-600 px-3.5 py-2 text-[11px] font-bold text-white shadow-md shadow-violet-600/25 transition-all hover:bg-violet-700 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-violet-600"
					>
						<i class="fa-solid fa-plus" aria-hidden="true"></i> Tambah sub-modul
					</button>
					<button
						type="button"
						onclick={removeModule}
						aria-label={`Hapus Modul ${moduleIndex + 1}`}
						class="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2 text-[11px] font-bold text-red-600 transition-all hover:bg-red-100 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-red-500"
					>
						<i class="fa-solid fa-trash" aria-hidden="true"></i>
						Hapus modul
					</button>
				</div>
			</div>
			{#if savedMessage}
				<p
					role="status"
					class="flex items-center gap-2 border-t border-slate-100 bg-emerald-50/60 px-4 py-2.5 text-xs font-semibold text-emerald-700 sm:px-6"
				>
					<i class="fa-solid fa-circle-check" aria-hidden="true"></i> {savedMessage}
				</p>
			{/if}
		</section>

		<!-- Daftar sub-modul: klik judul untuk mengelola materinya -->
		<div class="mb-4">
			<h2 class="text-lg font-bold text-slate-900">Sub-modul ({subs.length})</h2>
			<p class="text-xs text-slate-500">
				Klik judul sub-modul untuk membuka halaman kelola materinya.
			</p>
		</div>

		<ol aria-label={`Sub-modul dalam Modul ${moduleIndex + 1}`} class="space-y-3">
			{#each subs as sub, si (sub.id)}
				{@const open = isOpen(sub.id)}
				<li
					class="overflow-hidden rounded-2xl border bg-white transition-all {open
						? 'border-violet-500 shadow-xl shadow-violet-600/10'
						: 'border-slate-200/80 shadow-sm hover:border-violet-300 hover:shadow-lg'}"
				>
					<div class="flex items-center gap-3 p-4">
						<span
							class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-600 text-xs font-extrabold text-white shadow-md shadow-violet-600/25"
							aria-hidden="true"
						>
							{moduleIndex + 1}.{si + 1}
						</span>
						<span class="min-w-0 flex-1">
							<a
								href={`/instruktur/kursusku/${courseId}/${moduleId}/${sub.id}`}
								aria-label={`Kelola materi Sub-modul ${moduleIndex + 1}.${si + 1}: ${sub.title || '(belum berjudul)'}`}
								title="Buka halaman kelola materi"
								class="block truncate rounded text-sm font-extrabold text-slate-900 underline-offset-4 hover:text-violet-700 hover:underline focus-visible:outline-2 focus-visible:outline-violet-600"
							>
								{sub.title || '(belum berjudul)'}
								<i
									class="fa-solid fa-arrow-up-right-from-square ml-1 text-[11px] text-violet-500"
									aria-hidden="true"
								></i>
							</a>
							<span class="mt-0.5 block truncate text-[11px] font-semibold text-slate-500">
								{sub.materials.length} materi
								{#if sub.description}
									<span class="text-slate-400"> · {sub.description}</span>
								{/if}
							</span>
						</span>
						<span
							class="flex shrink-0 items-center gap-1"
							role="group"
							aria-label={`Aksi Sub-modul ${moduleIndex + 1}.${si + 1}`}
						>
							<button
								type="button"
								onclick={() => moveSub(sub.id, -1)}
								disabled={si === 0}
								aria-label={`Pindah sub-modul ${si + 1} ke atas`}
								title="Pindah ke atas"
								class="hidden min-h-9 min-w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-all hover:border-violet-300 hover:text-violet-600 focus-visible:outline-2 focus-visible:outline-violet-600 disabled:cursor-not-allowed disabled:opacity-35 sm:flex"
							>
								<i class="fa-solid fa-arrow-up text-[11px]" aria-hidden="true"></i>
							</button>
							<button
								type="button"
								onclick={() => moveSub(sub.id, 1)}
								disabled={si === subs.length - 1}
								aria-label={`Pindah sub-modul ${si + 1} ke bawah`}
								title="Pindah ke bawah"
								class="hidden min-h-9 min-w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-all hover:border-violet-300 hover:text-violet-600 focus-visible:outline-2 focus-visible:outline-violet-600 disabled:cursor-not-allowed disabled:opacity-35 sm:flex"
							>
								<i class="fa-solid fa-arrow-down text-[11px]" aria-hidden="true"></i>
							</button>
							<button
								type="button"
								onclick={() => toggleSub(sub.id)}
								aria-expanded={open}
								aria-controls={`sub-panel-${sub.id}`}
								aria-label={open
									? `Tutup editor cepat sub-modul ${si + 1}`
									: `Buka editor cepat sub-modul ${si + 1}`}
								class="flex min-h-9 min-w-9 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-violet-50 hover:text-violet-600 focus-visible:outline-2 focus-visible:outline-violet-600"
							>
								<i
									class="fa-solid fa-chevron-down text-sm transition-transform duration-300 {open
										? 'rotate-180'
										: ''}"
									aria-hidden="true"
								></i>
							</button>
						</span>
					</div>

					{#if open}
						<div
							id={`sub-panel-${sub.id}`}
							class="space-y-3 border-t border-slate-100 bg-slate-50/60 p-4"
						>
							<div class="grid gap-3">
								<div>
									<label
										for={`sub-t-${sub.id}`}
										class="mb-1 block text-xs font-bold text-slate-700"
									>
										Judul sub-modul {moduleIndex + 1}.{si + 1}
									</label>
									<input
										id={`sub-t-${sub.id}`}
										type="text"
										bind:value={editableModules[moduleIndex].subModules![si].title}
										oninput={touchModule}
										class="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-900 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 focus:outline-none"
									/>
								</div>
								<div>
									<label
										for={`sub-d-${sub.id}`}
										class="mb-1 block text-xs font-bold text-slate-700"
									>
										Deskripsi sub-modul (opsional)
									</label>
									<input
										id={`sub-d-${sub.id}`}
										type="text"
										bind:value={editableModules[moduleIndex].subModules![si].description}
										oninput={touchModule}
										placeholder="Satu kalimat tujuan sub-modul…"
										class="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-600 placeholder:text-slate-400 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 focus:outline-none"
									/>
								</div>
							</div>
							<div class="flex flex-wrap gap-2">
								<button
									type="button"
									onclick={() => saveSubModule(sub.id)}
									aria-label={`Simpan Sub-modul ${moduleIndex + 1}.${si + 1}`}
									class="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-[11px] font-bold text-white shadow-md shadow-emerald-600/25 transition-all hover:bg-emerald-700 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-emerald-600"
								>
									<i class="fa-solid fa-floppy-disk" aria-hidden="true"></i>
									Simpan
								</button>
								<a
									href={`/instruktur/kursusku/${courseId}/${moduleId}/${sub.id}`}
									aria-label={`Buka halaman kelola materi Sub-modul ${moduleIndex + 1}.${si + 1}`}
									class="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-[11px] font-bold text-white shadow-md shadow-blue-600/25 transition-all hover:bg-blue-700 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-blue-600"
								>
									<i class="fa-solid fa-book-open" aria-hidden="true"></i>
									Kelola materi ({sub.materials.length})
									<i class="fa-solid fa-arrow-right text-[10px]" aria-hidden="true"></i>
								</a>
								<button
									type="button"
									onclick={() => duplicateSub(sub.id)}
									class="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-[11px] font-bold text-slate-600 transition-all hover:bg-slate-50 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-slate-500"
								>
									<i class="fa-solid fa-copy" aria-hidden="true"></i> Duplikasi
								</button>
								<button
									type="button"
									onclick={() => removeSubModule(sub.id)}
									disabled={subs.length <= 1}
									aria-label={`Hapus sub-modul ${moduleIndex + 1}.${si + 1}`}
									class="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2 text-[11px] font-bold text-red-600 transition-all hover:bg-red-100 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-red-500 disabled:cursor-not-allowed disabled:opacity-40"
								>
									<i class="fa-solid fa-trash" aria-hidden="true"></i>
									Hapus
								</button>
							</div>
						</div>
					{/if}
				</li>
			{/each}
		</ol>

		<button
			type="button"
			onclick={addSubModule}
			class="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-violet-300 bg-violet-50/60 px-4 py-3 text-xs font-bold text-violet-700 transition-all hover:border-violet-500 hover:bg-violet-50 active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-violet-600"
		>
			<i class="fa-solid fa-plus" aria-hidden="true"></i>
			Tambah Sub-modul {moduleIndex + 1}.{subs.length + 1}
		</button>

		<div class="mt-6">
			<a
				href={`/instruktur/kursusku/${courseId}`}
				class="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 transition-all hover:bg-slate-50 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-slate-500"
			>
				<i class="fa-solid fa-arrow-left" aria-hidden="true"></i> Daftar modul
			</a>
		</div>

		{#if pendingDelete}
			<WarningModal
				bind:open={showDelete}
				type="danger"
				title={pendingDelete.title}
				message={pendingDelete.message}
				confirmText="Ya, hapus"
				cancelText="Batal"
				oncancel={cancelDelete}
				onconfirm={executeDelete}
			/>
		{/if}
	{/if}
</div>
