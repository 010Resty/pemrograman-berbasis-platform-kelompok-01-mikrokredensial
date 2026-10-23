<script lang="ts">
	import { page } from '$app/state';
	import { getCourseById } from '$lib/data/courses';
	import type { CourseModule, Material, MaterialType } from '$lib/data/courses';
	import {
		curriculumUid,
		loadCurriculumDraft,
		saveCurriculumDraft,
		withSyncedFlat
	} from '$lib/stores/curriculum';
	import WarningModal from '$lib/components/WarningModal.svelte';
	import { getMaterialDocMeta } from '$lib/stores/material-docs';

	const MATERIAL_TYPES: MaterialType[] = ['video', 'bacaan', 'audio', 'foto', 'kuis', 'tugas'];

	const courseId = $derived(Number(page.params.courseId));
	const moduleId = $derived(page.params.moduleId ?? '');
	const subId = $derived(page.params.subId ?? '');
	const course = $derived(getCourseById(courseId));

	let editableModules = $state<CourseModule[]>([]);
	let savedMessage = $state('');
	let initializedFor = $state<string | null>(null);
	/** Hapus materi yang menunggu konfirmasi modal bahaya. */
	let pendingDelete = $state<{ matId: string; title: string; detail: string } | null>(null);
	let showDelete = $state(false);
	/** Kartu materi yang dibuka panel sunting cepatnya. */
	let openMats = $state<string[]>([]);
	/** Status draf dokumen per materi — dihitung di klien agar SSR tetap konsisten. */
	let docMeta = $state<Record<string, { exists: boolean; words: number; updatedAt: string }>>({});

	const initKey = $derived(`${courseId}::${moduleId}::${subId}`);

	/* Muat draf bersama agar suntingan dari halaman modul / sub-modul terbawa. */
	$effect(() => {
		if (!course || initializedFor === initKey) return;
		editableModules = loadCurriculumDraft(courseId).map(withSyncedFlat);
		savedMessage = '';
		pendingDelete = null;
		initializedFor = initKey;
	});

	function refreshDocMeta() {
		const next: Record<string, { exists: boolean; words: number; updatedAt: string }> = {};
		for (const m of materials) {
			next[m.id] = getMaterialDocMeta(courseId, moduleId, subId, m.id);
		}
		docMeta = next;
	}

	function toggleMat(id: string) {
		openMats = openMats.includes(id) ? openMats.filter((x) => x !== id) : [...openMats, id];
	}

	/* Simpan setiap perubahan kembali ke draf bersama + segarkan status dokumen. */
	$effect(() => {
		if (initializedFor !== initKey || !course) return;
		saveCurriculumDraft(courseId, editableModules);
		refreshDocMeta();
	});

	const moduleIndex = $derived(editableModules.findIndex((m) => m.id === moduleId));
	const mod = $derived(moduleIndex >= 0 ? editableModules[moduleIndex] : undefined);
	const subIndex = $derived((mod?.subModules ?? []).findIndex((s) => s.id === subId));
	const sub = $derived(subIndex >= 0 ? mod?.subModules?.[subIndex] : undefined);
	const materials = $derived<Material[]>(sub?.materials ?? []);

	function markSaved(msg: string) {
		savedMessage = msg;
	}

	function touchModule() {
		if (moduleIndex < 0) return;
		editableModules[moduleIndex] = withSyncedFlat(editableModules[moduleIndex]);
	}

	function cancelDelete() {
		pendingDelete = null;
	}

	function executeDelete() {
		const target = pendingDelete;
		pendingDelete = null;
		showDelete = false;
		if (!target || moduleIndex < 0 || subIndex < 0) return;
		const m = editableModules[moduleIndex];
		const current = [...(m.subModules ?? [])];
		current[subIndex] = {
			...current[subIndex],
			materials: current[subIndex].materials.filter((x) => x.id !== target.matId)
		};
		editableModules[moduleIndex] = withSyncedFlat({ ...m, subModules: current });
		markSaved('Materi dihapus.');
	}

	function addMaterial() {
		if (moduleIndex < 0 || subIndex < 0) return;
		const m = editableModules[moduleIndex];
		const current = [...(m.subModules ?? [])];
		const target = { ...current[subIndex], materials: [...current[subIndex].materials] };
		target.materials.push({
			id: curriculumUid('mat'),
			title: 'Materi baru',
			type: 'video' as MaterialType,
			duration: '10 mnt',
			completed: false
		});
		current[subIndex] = target;
		editableModules[moduleIndex] = withSyncedFlat({ ...m, subModules: current });
		pendingDelete = null;
		markSaved('Materi baru ditambahkan.');
	}

	function removeMaterial(matId: string) {
		if (moduleIndex < 0 || subIndex < 0) return;
		const mat = (editableModules[moduleIndex].subModules?.[subIndex].materials ?? []).find(
			(x) => x.id === matId
		);
		pendingDelete = {
			matId,
			title: `Hapus materi ${moduleIndex + 1}.${subIndex + 1}?`,
			detail: `“${mat?.title || '(belum berjudul)'}” akan dihapus dari draf. Tindakan ini tidak bisa dibatalkan.`
		};
		showDelete = true;
	}

	function moveMaterial(matId: string, dir: -1 | 1) {
		if (moduleIndex < 0 || subIndex < 0) return;
		const m = editableModules[moduleIndex];
		const current = [...(m.subModules ?? [])];
		const mats = [...current[subIndex].materials];
		const idx = mats.findIndex((x) => x.id === matId);
		const target = idx + dir;
		if (idx < 0 || target < 0 || target >= mats.length) return;
		[mats[idx], mats[target]] = [mats[target], mats[idx]];
		current[subIndex] = { ...current[subIndex], materials: mats };
		editableModules[moduleIndex] = withSyncedFlat({ ...m, subModules: current });
		markSaved(`Materi dipindah ke posisi ${target + 1}.`);
	}

	function typeIcon(type: string): string {
		if (type === 'video') return 'fa-circle-play text-blue-600';
		if (type === 'audio') return 'fa-headphones text-cyan-600';
		if (type === 'foto') return 'fa-image text-slate-500';
		if (type === 'kuis') return 'fa-circle-question text-amber-600';
		if (type === 'tugas') return 'fa-pen-to-square text-violet-600';
		return 'fa-book-open text-emerald-600';
	}

	function typeLabel(type: string): string {
		if (type === 'video') return 'Video';
		if (type === 'audio') return 'Audio';
		if (type === 'foto') return 'Gambar';
		if (type === 'kuis') return 'Kuis';
		if (type === 'tugas') return 'Tugas';
		return 'Bacaan';
	}

	function editorHref(matId: string): string {
		return `/instruktur/kursusku/${courseId}/${moduleId}/${subId}/${matId}`;
	}
</script>

<svelte:head>
	<title>
		{sub ? `Sub-modul ${moduleIndex + 1}.${subIndex + 1}: ${sub.title}` : 'Sub-modul tidak ditemukan'} — Instruktur Aristoteles
	</title>
	<meta
		name="description"
		content={sub ? `Kelola materi ${sub.title}` : 'Kelola materi sub-modul'}
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
			<p class="mt-1 text-sm text-slate-500">
				Sub-modul “{subId}” tidak ada di Modul {moduleIndex + 1}. Mungkin baru saja dihapus.
			</p>
			<a
				href={`/instruktur/kursusku/${courseId}/${moduleId}`}
				class="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
			>
				<i class="fa-solid fa-arrow-left" aria-hidden="true"></i> Kembali ke sub-modul
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
			<span aria-current="page" class="truncate font-medium text-slate-700">
				Sub-modul {moduleIndex + 1}.{subIndex + 1}: {sub.title}
			</span>
		</nav>

		<!-- Header sub-modul -->
		<section
			aria-labelledby="sub-heading"
			class="mb-6 overflow-hidden rounded-3xl border border-slate-200/70 bg-white shadow-lg shadow-slate-900/5"
		>
			<div class="relative overflow-hidden bg-violet-700 p-5 sm:px-7 sm:py-6">
				<div
					class="pointer-events-none absolute -top-16 -right-10 h-48 w-48 rounded-full bg-white/10 blur-2xl"
					aria-hidden="true"
				></div>
				<div
					class="pointer-events-none absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-violet-400 via-fuchsia-300 to-violet-400"
					aria-hidden="true"
				></div>
				<div class="relative flex flex-wrap items-center justify-between gap-3">
					<div class="flex min-w-0 items-center gap-3">
						<span
							class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-xs font-extrabold text-white shadow-lg ring-4 ring-white/20 backdrop-blur"
							aria-hidden="true"
						>
							{moduleIndex + 1}.{subIndex + 1}
						</span>
						<div class="min-w-0">
							<p
								class="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[10px] font-extrabold tracking-[0.16em] text-white uppercase backdrop-blur"
							>
								<i class="fa-solid fa-book-open" aria-hidden="true"></i>
								Kelola materi
							</p>
							<h1
								id="sub-heading"
								class="mt-1.5 truncate text-xl font-extrabold text-white sm:text-2xl"
							>
								{sub.title || '(belum berjudul)'}
							</h1>
						</div>
					</div>
					<div class="rounded-2xl bg-white/15 p-3 text-center backdrop-blur">
						<p class="text-[11px] font-bold text-white">{materials.length} materi</p>
					</div>
				</div>
			</div>

			<div class="grid gap-3 p-4 sm:p-6">
				<div>
					<label for="sub-title" class="mb-1 block text-xs font-bold text-slate-700">
						Judul sub-modul {moduleIndex + 1}.{subIndex + 1}
					</label>
					<input
						id="sub-title"
						type="text"
						bind:value={editableModules[moduleIndex].subModules![subIndex].title}
						oninput={touchModule}
						class="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-900 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 focus:outline-none"
					/>
				</div>
				<div>
					<label for="sub-desc" class="mb-1 block text-xs font-bold text-slate-700">
						Deskripsi sub-modul (opsional)
					</label>
					<input
						id="sub-desc"
						type="text"
						bind:value={editableModules[moduleIndex].subModules![subIndex].description}
						oninput={touchModule}
						placeholder="Satu kalimat tujuan sub-modul…"
						class="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-600 placeholder:text-slate-400 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 focus:outline-none"
					/>
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

		<!-- Daftar materi -->
		<div class="mb-4">
			<h2 class="text-lg font-bold text-slate-900">Materi ({materials.length})</h2>
			<p class="text-xs text-slate-500">
				Klik judul materi untuk membuka editor dokumennya — gabungkan teks, gambar, video, kode,
				dan PDF dalam satu dokumen.
			</p>
		</div>

		{#if materials.length === 0}
			<div class="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
				<p
					class="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-lg"
				>
					<i class="fa-solid fa-book-open" aria-hidden="true"></i>
				</p>
				<p class="mt-3 text-sm font-bold text-slate-900">Belum ada materi</p>
				<p class="mx-auto mt-1 max-w-sm text-xs text-slate-500">
					Tambah materi pertama — video, bacaan, kuis, atau tugas.
				</p>
			</div>
		{:else}
			<ol aria-label={`Materi dalam Sub-modul ${moduleIndex + 1}.${subIndex + 1}`} class="space-y-3">
				{#each materials as mat, mi (mat.id)}
					{@const open = openMats.includes(mat.id)}
					{@const meta = docMeta[mat.id]}
					<li
						class="overflow-hidden rounded-2xl border bg-white transition-all {open
							? 'border-blue-500 shadow-xl shadow-blue-600/10'
							: 'border-slate-200/80 shadow-sm hover:border-blue-300 hover:shadow-lg'}"
					>
						<!-- Baris utama: judul (tautan editor) + status + aksi -->
						<div class="flex items-center gap-3 p-3 sm:p-4">
							<span
								class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-xs font-extrabold text-white shadow-md"
								aria-hidden="true"
							>
								{mi + 1}
							</span>
							<span
								class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100"
								aria-hidden="true"
							>
								<i class={`fa-solid ${typeIcon(mat.type)}`} aria-hidden="true"></i>
							</span>
							<span class="min-w-0 flex-1">
								<a
									href={editorHref(mat.id)}
									aria-label={`Buka editor dokumen materi ${mi + 1}: ${mat.title || '(belum berjudul)'}`}
									title="Buka editor dokumen materi"
									class="block truncate rounded text-sm font-extrabold text-slate-900 underline-offset-4 hover:text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-blue-600"
								>
									{mat.title || '(belum berjudul)'}
									<i class="fa-solid fa-arrow-up-right-from-square ml-1 text-[11px] text-blue-500" aria-hidden="true"></i>
								</a>
								<span class="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold">
									<span class="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-blue-700 ring-1 ring-blue-200">
										{typeLabel(mat.type)} · {mat.duration}
									</span>
									{#if meta?.exists}
										<span class="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700 ring-1 ring-emerald-200">
											<i class="fa-solid fa-circle-check text-[10px]" aria-hidden="true"></i>
											Ada draf{meta.words > 0 ? ` · ${meta.words} kata` : ''}
										</span>
									{:else}
										<span class="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-slate-500 ring-1 ring-slate-200">
											<i class="fa-solid fa-pen-nib text-[10px]" aria-hidden="true"></i>
											Belum ada isi
										</span>
									{/if}
								</span>
							</span>
							<span
								class="flex shrink-0 flex-wrap items-center justify-end gap-1"
								role="group"
								aria-label={`Aksi materi ${mi + 1}`}
							>
								<a
									href={editorHref(mat.id)}
									aria-label={`Edit konten materi ${mi + 1}: ${mat.title || '(belum berjudul)'}`}
									title="Buka editor dokumen materi"
									class="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-[11px] font-bold text-white shadow-md shadow-blue-600/25 transition-all hover:bg-blue-700 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-blue-600"
								>
									<i class="fa-solid fa-pen-nib" aria-hidden="true"></i>
									Edit konten
								</a>
								<button
									type="button"
									onclick={() => toggleMat(mat.id)}
									aria-expanded={open}
									aria-controls={`mat-panel-${mat.id}`}
									aria-label={open
										? `Tutup sunting cepat materi ${mi + 1}`
										: `Buka sunting cepat materi ${mi + 1}`}
									title="Sunting cepat judul, tipe, durasi"
									class="flex min-h-10 min-w-10 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-blue-600"
								>
									<i class="fa-solid fa-chevron-down text-sm transition-transform duration-300 {open ? 'rotate-180' : ''}" aria-hidden="true"></i>
								</button>
								<button
									type="button"
									onclick={() => moveMaterial(mat.id, -1)}
									disabled={mi === 0}
									aria-label={`Pindah materi ${mi + 1} ke atas`}
									title="Pindah ke atas"
									class="hidden min-h-10 min-w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition-all hover:border-blue-300 hover:text-blue-600 focus-visible:outline-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-35 sm:flex"
								>
									<i class="fa-solid fa-arrow-up text-[11px]" aria-hidden="true"></i>
								</button>
								<button
									type="button"
									onclick={() => moveMaterial(mat.id, 1)}
									disabled={mi === materials.length - 1}
									aria-label={`Pindah materi ${mi + 1} ke bawah`}
									title="Pindah ke bawah"
									class="hidden min-h-10 min-w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition-all hover:border-blue-300 hover:text-blue-600 focus-visible:outline-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-35 sm:flex"
								>
									<i class="fa-solid fa-arrow-down text-[11px]" aria-hidden="true"></i>
								</button>
								<button
									type="button"
									onclick={() => removeMaterial(mat.id)}
									aria-label={`Hapus materi ${mat.title || mi + 1}`}
									class="flex min-h-10 min-w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 transition-all hover:border-red-300 hover:bg-red-50 hover:text-red-600 focus-visible:outline-2 focus-visible:outline-red-500"
								>
									<i class="fa-solid fa-trash text-[11px]" aria-hidden="true"></i>
								</button>
							</span>
						</div>

						{#if open}
							<div
								id={`mat-panel-${mat.id}`}
								class="grid gap-2 border-t border-slate-100 bg-slate-50/60 p-3 sm:grid-cols-[minmax(0,1fr)_140px_110px] sm:p-4"
							>
								<div>
									<label for={`mat-t-${mat.id}`} class="mb-1 block text-[11px] font-bold text-slate-600">
										Materi {mi + 1} — judul
									</label>
									<input
										id={`mat-t-${mat.id}`}
										type="text"
										bind:value={editableModules[moduleIndex].subModules![subIndex].materials[mi].title}
										oninput={touchModule}
										placeholder="Judul materi…"
										class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 placeholder:font-normal placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
									/>
								</div>
								<div>
									<label for={`mat-ty-${mat.id}`} class="mb-1 block text-[11px] font-bold text-slate-600">
										Tipe
									</label>
									<select
										id={`mat-ty-${mat.id}`}
										bind:value={editableModules[moduleIndex].subModules![subIndex].materials[mi].type}
										onchange={touchModule}
										class="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-bold text-slate-700 focus:border-blue-500 focus:outline-none"
									>
										{#each MATERIAL_TYPES as t (t)}
											<option value={t}>{t}</option>
										{/each}
									</select>
								</div>
								<div>
									<label for={`mat-du-${mat.id}`} class="mb-1 block text-[11px] font-bold text-slate-600">
										Durasi
									</label>
									<input
										id={`mat-du-${mat.id}`}
										type="text"
										bind:value={editableModules[moduleIndex].subModules![subIndex].materials[mi].duration}
										oninput={touchModule}
										placeholder="10 mnt"
										class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 focus:border-blue-500 focus:outline-none"
									/>
								</div>
							</div>
						{/if}
					</li>
				{/each}
			</ol>
		{/if}

		<button
			type="button"
			onclick={addMaterial}
			class="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-blue-300 bg-blue-50/60 px-4 py-3 text-xs font-bold text-blue-700 transition-all hover:border-blue-500 hover:bg-blue-50 active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-blue-600"
		>
			<i class="fa-solid fa-plus" aria-hidden="true"></i>
			Tambah Materi {materials.length + 1}
		</button>

		<div class="mt-6">
			<a
				href={`/instruktur/kursusku/${courseId}/${moduleId}`}
				class="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 transition-all hover:bg-slate-50 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-slate-500"
			>
				<i class="fa-solid fa-arrow-left" aria-hidden="true"></i> Daftar sub-modul
			</a>
		</div>

		{#if pendingDelete}
			<WarningModal
				bind:open={showDelete}
				type="danger"
				title={pendingDelete.title}
				message={pendingDelete.detail}
				confirmText="Ya, hapus"
				cancelText="Batal"
				oncancel={cancelDelete}
				onconfirm={executeDelete}
			/>
		{/if}
	{/if}
</div>
