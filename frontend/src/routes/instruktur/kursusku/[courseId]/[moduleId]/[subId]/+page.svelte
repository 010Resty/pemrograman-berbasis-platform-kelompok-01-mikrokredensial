<script lang="ts">
	import { page } from '$app/state';
	import {
		getCourseById,
		INSTRUCTOR_MATERIAL_TYPES,
		materialTypeLabel,
		normalizeMaterialType
	} from '$lib/data/courses';
	import type { CourseModule, Material, MaterialType } from '$lib/data/courses';
	import {
		curriculumUid,
		loadCurriculumDraft,
		saveCurriculumDraft,
		withSyncedFlat
	} from '$lib/stores/curriculum';
	import { invalidateCourseTree } from '$lib/stores/instructor-courses.svelte';
	import {
		resolveServerCourse,
		isServerKelola,
		isServerId,
		createMaterial,
		updateMaterial,
		deleteMaterial
	} from '$lib/api/courses';
	import WarningModal from '$lib/components/WarningModal.svelte';
	import { getMaterialDocMeta } from '$lib/stores/material-docs';
	import { loadQuizDraft, validateQuizDraft } from '$lib/stores/quiz-drafts';
	import { countTaskPoints, loadTaskDraft, validateTaskDraft } from '$lib/stores/task-drafts';

	/** Hanya 3 tipe: materi (audio/video/teks), tugas (teks), kuis. */
	const MATERIAL_TYPES: MaterialType[] = [...INSTRUCTOR_MATERIAL_TYPES];

	const courseId = $derived(Number(page.params.courseId));
	const moduleId = $derived(page.params.moduleId ?? '');
	const subId = $derived(page.params.subId ?? '');
	const serverMode = $derived(
		page.url.searchParams.get('src') === 'server' || isServerKelola(courseId)
	);
	let serverCourse = $state<Awaited<ReturnType<typeof resolveServerCourse>>>(null);
	let serverLoading = $state(false);
	let serverLoadedFor = $state<number | null>(null);

	$effect(() => {
		if (!serverMode || serverLoadedFor === courseId) return;
		serverLoadedFor = courseId;
		serverLoading = true;
		void resolveServerCourse(courseId)
			.then((res) => {
				serverCourse = res;
			})
			.finally(() => {
				serverLoading = false;
			});
	});

	const course = $derived(serverMode ? serverCourse : getCourseById(courseId));

	let editableModules = $state<CourseModule[]>([]);
	let savedMessage = $state('');
	let initializedFor = $state<string | null>(null);
	/** Hapus materi yang menunggu konfirmasi modal bahaya. */
	let pendingDelete = $state<{ matId: string; title: string; detail: string } | null>(null);
	let showDelete = $state(false);
	/** Kartu materi yang dibuka panel suntingnya. */
	let openMats = $state<string[]>([]);
	/** Draf suntingan tiap materi. Diterapkan hanya saat Simpan ditekan. */
	let matDrafts = $state<Record<string, { title: string; type: MaterialType; duration: string }>>(
		{}
	);
	let matErrors = $state<Record<string, string>>({});
	/** Warna pastel badge nomor — sama seperti halaman modul. */
	const MODULE_BADGES = [
		'bg-blue-100 text-blue-700',
		'bg-violet-100 text-violet-700',
		'bg-emerald-100 text-emerald-700',
		'bg-amber-100 text-amber-700'
	] as const;

	function badgeClass(mi: number): string {
		return MODULE_BADGES[((mi % MODULE_BADGES.length) + MODULE_BADGES.length) % MODULE_BADGES.length];
	}

	/** Aksen warna header menurut nomor modul. */
	const MODULE_TINTS = [
		{ bar: 'bg-blue-600', ghost: 'text-blue-100', chip: 'bg-blue-50 text-blue-700 ring-1 ring-blue-100' },
		{ bar: 'bg-violet-600', ghost: 'text-violet-100', chip: 'bg-violet-50 text-violet-700 ring-1 ring-violet-100' },
		{ bar: 'bg-emerald-600', ghost: 'text-emerald-100', chip: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100' },
		{ bar: 'bg-amber-500', ghost: 'text-amber-100', chip: 'bg-amber-50 text-amber-700 ring-1 ring-amber-100' }
	] as const;

	function tintFor(mi: number): (typeof MODULE_TINTS)[number] {
		return MODULE_TINTS[((mi % MODULE_TINTS.length) + MODULE_TINTS.length) % MODULE_TINTS.length];
	}
	/** Menu overflow (⋯) yang sedang terbuka — hanya satu per daftar. */
	let menuFor = $state<string | null>(null);
	/** Posisi viewport menu (fixed) agar tidak terpotong `overflow-hidden` kartu. */
	let menuPos = $state<{ top: number; right: number } | null>(null);
	/** Status draf dokumen per materi — dihitung di klien agar SSR tetap konsisten. */
	let docMeta = $state<Record<string, { exists: boolean; words: number; updatedAt: string }>>({});

	const initKey = $derived(`${courseId}::${moduleId}::${subId}`);

	/* Muat draf bersama agar suntingan dari halaman modul / sub-modul terbawa. */
	$effect(() => {
		if (!course || initializedFor === initKey) return;
		editableModules = loadCurriculumDraft(courseId).map(withSyncedFlat);
		savedMessage = '';
		pendingDelete = null;
		menuFor = null;
		menuPos = null;
		openMats = [];
		matDrafts = {};
		matErrors = {};
		initializedFor = initKey;
	});

	function toggleMenu(id: string, anchor?: HTMLElement | null) {
		if (menuFor === id) {
			closeMenu();
			return;
		}
		if (anchor) {
			const r = anchor.getBoundingClientRect();
			const approxH = 216;
			const top =
				r.bottom + 6 + approxH > window.innerHeight
					? Math.max(8, r.top - approxH - 6)
					: r.bottom + 6;
			menuPos = { top, right: Math.max(8, window.innerWidth - r.right) };
		} else {
			menuPos = null;
		}
		menuFor = id;
	}

	function closeMenu() {
		menuFor = null;
		menuPos = null;
	}

	function refreshDocMeta() {
		const next: Record<string, { exists: boolean; words: number; updatedAt: string }> = {};
		for (const m of materials) {
			const kind = normalizeMaterialType(String(m.type));
			if (kind === 'kuis') {
				const q = loadQuizDraft(courseId, moduleId, subId, m.id);
				next[m.id] =
					q && q.questions.length > 0 && validateQuizDraft({ ...q, title: 'x' }) === null
						? { exists: true, words: q.questions.length, updatedAt: q.updatedAt }
						: { exists: false, words: q?.questions.length ?? 0, updatedAt: q?.updatedAt ?? '' };
			} else if (kind === 'tugas') {
				const t = loadTaskDraft(courseId, moduleId, subId, m.id);
				const points = t ? countTaskPoints(t) : 0;
				next[m.id] =
					t && validateTaskDraft(t) === null
						? { exists: true, words: points, updatedAt: t.updatedAt }
						: { exists: false, words: points, updatedAt: t?.updatedAt ?? '' };
			} else {
				next[m.id] = getMaterialDocMeta(courseId, moduleId, subId, m.id);
			}
		}
		docMeta = next;
	}

	function snapshotMat(mat: Material) {
		matDrafts[mat.id] = { title: mat.title, type: mat.type, duration: mat.duration };
		delete matErrors[mat.id];
	}

	function toggleMat(id: string | null) {
		if (!id) return;
		if (openMats.includes(id)) {
			// Menutup = membuang perubahan yang belum disimpan.
			openMats = openMats.filter((x) => x !== id);
			delete matDrafts[id];
			delete matErrors[id];
		} else {
			const mat = materials.find((m) => m.id === id);
			if (mat) snapshotMat(mat);
			openMats = [...openMats, id];
		}
	}

	/** Satu-satunya jalan menyimpan perubahan judul/tipe/durasi materi. */
	async function saveMatDraft(id: string | null) {
		if (!id || moduleIndex < 0 || subIndex < 0) return;
		const d = matDrafts[id];
		const m = editableModules[moduleIndex];
		const mi = (m.subModules?.[subIndex].materials ?? []).findIndex((x) => x.id === id);
		if (!d || mi < 0) return;
		if (!d.title.trim()) {
			matErrors[id] = 'Isi judul materi terlebih dahulu.';
			return;
		}
		delete matErrors[id];
		if (serverMode && isServerId(id)) {
			try {
				await updateMaterial(Number(id), { title: d.title, type: d.type, duration: d.duration });
				invalidateCourseTree(courseId);
			} catch (e) {
				matErrors[id] = e instanceof Error ? e.message : 'Gagal menyimpan materi ke server.';
				return;
			}
		}
		const current = [...(m.subModules ?? [])];
		const mats = [...current[subIndex].materials];
		mats[mi] = { ...mats[mi], title: d.title, type: d.type, duration: d.duration };
		current[subIndex] = { ...current[subIndex], materials: mats };
		editableModules[moduleIndex] = withSyncedFlat({ ...m, subModules: current });
		saveCurriculumDraft(courseId, editableModules);
		refreshDocMeta();
		delete matDrafts[id];
		openMats = openMats.filter((x) => x !== id);
		markSaved(`Materi ${mi + 1} tersimpan.`);
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
	/** Materi + indeks pemilik menu yang terbuka (menu dirender sekali di luar kartu). */
	const menuMat = $derived(menuFor ? materials.find((m) => m.id === menuFor) : undefined);
	const menuIndex = $derived(menuFor ? materials.findIndex((m) => m.id === menuFor) : -1);
	const menuOpen = $derived(menuFor ? openMats.includes(menuFor) : false);
	const tint = $derived(tintFor(moduleIndex));

	function markSaved(msg: string) {
		savedMessage = msg;
	}

	function cancelDelete() {
		pendingDelete = null;
	}

	function executeDelete() {
		const target = pendingDelete;
		if (!target || moduleIndex < 0 || subIndex < 0) return;
		void executeDeleteAsync(target.matId);
	}

	async function executeDeleteAsync(matId: string): Promise<void> {
		if (serverMode && isServerId(matId)) {
			try {
				await deleteMaterial(Number(matId));
				invalidateCourseTree(courseId);
			} catch (e) {
				markSaved(e instanceof Error ? e.message : 'Gagal menghapus materi di server.');
				return;
			}
		}
		pendingDelete = null;
		showDelete = false;
		menuFor = null;
		menuPos = null;
		const m = editableModules[moduleIndex];
		const current = [...(m.subModules ?? [])];
		current[subIndex] = {
			...current[subIndex],
			materials: current[subIndex].materials.filter((x) => x.id !== matId)
		};
		editableModules[moduleIndex] = withSyncedFlat({ ...m, subModules: current });
		openMats = openMats.filter((x) => x !== matId);
		delete matDrafts[matId];
		delete matErrors[matId];
		markSaved('Materi dihapus.');
		if (serverMode) void renumberMaterials();
	}

	function addMaterial() {
		if (moduleIndex < 0 || subIndex < 0) return;
		void addMaterialAsync();
	}

	async function addMaterialAsync(): Promise<void> {
		if (moduleIndex < 0 || subIndex < 0) return;
		const m = editableModules[moduleIndex];
		const current = [...(m.subModules ?? [])];
		const target = { ...current[subIndex], materials: [...current[subIndex].materials] };
		let id = curriculumUid('mat');
		if (serverMode && isServerId(subId)) {
			try {
				const created = await createMaterial(Number(subId), {
					title: 'Materi baru',
					type: 'materi',
					duration: '10 mnt',
					content: '{"type":"doc","content":[{"type":"paragraph"}]}',
					position: target.materials.length
				});
				id = String(created.id);
				invalidateCourseTree(courseId);
			} catch (e) {
				markSaved(e instanceof Error ? e.message : 'Gagal menambah materi ke server.');
				return;
			}
		}
		target.materials.push({
			id,
			title: 'Materi baru',
			type: 'materi' as MaterialType,
			duration: '10 mnt',
			completed: false
		});
		current[subIndex] = target;
		editableModules[moduleIndex] = withSyncedFlat({ ...m, subModules: current });
		pendingDelete = null;
		markSaved('Materi baru ditambahkan.');
	}

	function removeMaterial(matId: string | null) {
		if (!matId || moduleIndex < 0 || subIndex < 0) return;
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

	function moveMaterial(matId: string | null, dir: -1 | 1) {
		if (!matId || moduleIndex < 0 || subIndex < 0) return;
		const m = editableModules[moduleIndex];
		const current = [...(m.subModules ?? [])];
		const mats = [...current[subIndex].materials];
		const idx = mats.findIndex((x) => x.id === matId);
		const target = idx + dir;
		if (idx < 0 || target < 0 || target >= mats.length) return;
		[mats[idx], mats[target]] = [mats[target], mats[idx]];
		current[subIndex] = { ...current[subIndex], materials: mats };
		editableModules[moduleIndex] = withSyncedFlat({ ...m, subModules: current });
		if (serverMode) void renumberMaterials();
		markSaved(`Materi dipindah ke posisi ${target + 1}.`);
	}

	/** Tulis ulang position semua materi ke server sesuai urutan. */
	async function renumberMaterials(): Promise<void> {
		const mats = editableModules[moduleIndex]?.subModules?.[subIndex]?.materials ?? [];
		try {
			await Promise.all(
				mats.map((t, i) =>
					isServerId(t.id) ? updateMaterial(Number(t.id), { position: i }) : Promise.resolve()
				)
			);
			invalidateCourseTree(courseId);
		} catch (e) {
			markSaved(e instanceof Error ? e.message : 'Gagal menyimpan urutan materi.');
		}
	}

	function typeLabel(type: string): string {
		return materialTypeLabel(type);
	}

	function typeHint(type: string): string {
		const n = normalizeMaterialType(type);
		if (n === 'kuis') return 'Buat soal pilihan ganda';
		if (n === 'tugas') return 'Instruksi tugas (teks)';
		return 'Audio, video, atau teks';
	}

	function editLabel(type: string, exists = false): string {
		const n = normalizeMaterialType(type);
		if (n === 'kuis') return exists ? 'Edit kuis' : 'Buat kuis';
		if (n === 'tugas') return exists ? 'Edit tugas' : 'Buat tugas';
		return exists ? 'Edit materi' : 'Buat materi';
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

<!-- Tutup menu ⋯ saat halaman digulir/diubah ukuran (posisinya fixed) -->
<svelte:window onscroll={closeMenu} onresize={closeMenu} />

<div class="p-4 sm:p-6 lg:p-8">
	{#if serverMode && serverLoading && !course}
		<div class="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white p-12 text-sm font-semibold text-slate-500" role="status" aria-label="Memuat kursus">
			<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i> Memuat kursus dari server...
		</div>
	{:else if !course}
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
			class="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white"
		>
			<div class={`h-1.5 ${tint.bar}`} aria-hidden="true"></div>
			<div class="relative px-4 py-4 sm:px-6">
				<span
					class={`pointer-events-none absolute top-1 right-3 text-[76px] leading-none font-black tracking-tighter select-none sm:text-[96px] ${tint.ghost}`}
					aria-hidden="true"
				>
					{moduleIndex + 1}.{subIndex + 1}
				</span>
				<div class="relative flex flex-wrap items-start justify-between gap-3">
					<div class="min-w-0">
						<p class={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-extrabold tracking-[0.16em] uppercase ${tint.chip}`}>
							<i class="fa-solid fa-book-open" aria-hidden="true"></i>
							Kelola materi
						</p>
						<h1 id="sub-heading" class="mt-2 text-xl font-extrabold text-slate-900 sm:text-2xl">
							{sub.title || '(belum berjudul)'}
						</h1>
						{#if sub.description}
							<p class="mt-1.5 max-w-xl text-xs leading-relaxed text-slate-500 sm:text-[13px]">{sub.description}</p>
						{/if}
					</div>
					<div class="flex shrink-0 flex-wrap items-center gap-2 self-end">
						<span class="inline-flex items-center gap-1.5 rounded-full bg-violet-700 px-3 py-1.5 text-[11px] font-bold text-white">
							{materials.length} materi
						</span>
					</div>
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
				Tekan <strong>Buat</strong> untuk mengisi tiap materi (teks, audio, video, atau kuis). Perubahan nama/tipe/durasi wajib disimpan lewat tombol Simpan.
			</p>
		</div>

		{#if materials.length === 0}
			<div class="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
				<p
					class="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-lg"
				>
					<i class="fa-solid fa-book-open" aria-hidden="true"></i>
				</p>
				<p class="mt-3 text-sm font-bold text-slate-900">Belum ada materi</p>
				<p class="mx-auto mt-1 max-w-sm text-xs text-slate-500">
					Tambah materi pertama — materi, tugas, atau kuis.
				</p>
			</div>
		{:else}
			<ol aria-label={`Materi dalam Sub-modul ${moduleIndex + 1}.${subIndex + 1}`} class="space-y-3">
				{#each materials as mat, mi (mat.id)}
					{@const open = openMats.includes(mat.id)}
					{@const meta = docMeta[mat.id]}
					<li
						class="rounded-2xl border border-slate-200 bg-white transition-all {open
							? 'border-blue-500 shadow-md shadow-blue-600/10'
							: 'shadow-sm hover:border-slate-300'}"
					>
						<!-- Baris utama: judul + status + aksi -->
						<div class="flex items-center gap-3 p-3 sm:p-4">
							<span
								class={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-extrabold ring-4 ring-white ${badgeClass(mi)}`}
								aria-hidden="true"
							>
								{mi + 1}
							</span>
							<span class="min-w-0 flex-1">
								<span class="block truncate text-sm font-extrabold text-slate-900">
									{mat.title || '(belum berjudul)'}
								</span>
								<span class="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold">
									<span class="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-blue-700 ring-1 ring-blue-200">
										{typeLabel(mat.type)} · {mat.duration}
									</span>
									<span class="hidden text-slate-400 sm:inline">{typeHint(mat.type)}</span>
									{#if meta?.exists}
										<span class="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700 ring-1 ring-emerald-200">
											<i class="fa-solid fa-circle-check text-[10px]" aria-hidden="true"></i>
											Ada draf{meta.words > 0
												? normalizeMaterialType(String(mat.type)) === 'kuis'
													? ` · ${meta.words} soal`
													: normalizeMaterialType(String(mat.type)) === 'tugas'
														? ` · ${meta.words} poin`
														: ` · ${meta.words} kata`
												: ''}
										</span>
									{:else}
										<span class="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-slate-500 ring-1 ring-slate-200">
											<i class="fa-solid fa-pen-nib text-[10px]" aria-hidden="true"></i>
											Belum ada isi
										</span>
									{/if}
								</span>
							</span>
							<span class="flex shrink-0 items-center gap-1.5" role="group" aria-label={`Aksi materi ${mi + 1}`}>
								<a
									href={editorHref(mat.id)}
									aria-label={`${editLabel(mat.type, meta?.exists)} ${mi + 1}: ${mat.title || '(belum berjudul)'}`}
									title={editLabel(mat.type, meta?.exists)}
									class="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-[11px] font-bold text-white shadow-md shadow-blue-600/25 transition-all hover:bg-blue-700 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-blue-600"
								>
									<i class="fa-solid fa-pen-nib" aria-hidden="true"></i>
									{editLabel(mat.type, meta?.exists)}
									<i class="fa-solid fa-arrow-right text-[10px] opacity-70" aria-hidden="true"></i>
								</a>
								<button
									type="button"
									onclick={(e) => toggleMenu(mat.id, e.currentTarget)}
									aria-expanded={menuFor === mat.id}
									aria-haspopup="menu"
									aria-controls="mat-menu-open"
									aria-label={`Opsi lain materi ${mi + 1}`}
									title="Opsi lain"
									class="flex min-h-10 min-w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition-all hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-blue-600"
								>
									<i class="fa-solid fa-ellipsis-vertical text-sm" aria-hidden="true"></i>
								</button>
							</span>
						</div>

						{#if open}
							{@const draft = matDrafts[mat.id]}
							{#if draft}
							<div
								id={`mat-panel-${mat.id}`}
								class="space-y-3 rounded-b-2xl border-t border-slate-100 bg-slate-50/60 p-3 sm:p-4"
							>
								<div class="grid gap-2 sm:grid-cols-[minmax(0,1fr)_140px_110px]">
									<div>
										<label for={`mat-t-${mat.id}`} class="mb-1 block text-[11px] font-bold text-slate-600">
											Materi {mi + 1} — judul
										</label>
										<input
											id={`mat-t-${mat.id}`}
											type="text"
											bind:value={draft.title}
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
											bind:value={draft.type}
											class="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-bold text-slate-700 focus:border-blue-500 focus:outline-none"
										>
											{#each MATERIAL_TYPES as t (t)}
												<option value={t}>{typeLabel(t)}</option>
											{/each}
										</select>
										<p class="mt-1 text-[10px] leading-snug text-slate-400">{typeHint(draft.type)}</p>
									</div>
									<div>
										<label for={`mat-du-${mat.id}`} class="mb-1 block text-[11px] font-bold text-slate-600">
											Durasi
										</label>
										<input
											id={`mat-du-${mat.id}`}
											type="text"
											bind:value={draft.duration}
											placeholder="10 mnt"
											class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 focus:border-blue-500 focus:outline-none"
										/>
									</div>
								</div>
								{#if matErrors[mat.id]}
									<p role="alert" class="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
										<i class="fa-solid fa-circle-exclamation mt-0.5 shrink-0" aria-hidden="true"></i>
										{matErrors[mat.id]}
									</p>
								{/if}
								<div>
									<button
										type="button"
										onclick={() => saveMatDraft(mat.id)}
										aria-label={`Simpan materi ${mi + 1}`}
										class="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-[11px] font-bold text-white transition-all hover:bg-blue-700 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-blue-600"
									>
										<i class="fa-solid fa-floppy-disk" aria-hidden="true"></i>
										Simpan
									</button>
									<p class="mt-1.5 text-[11px] text-slate-400">
										Perubahan baru tersimpan setelah Simpan ditekan — menutup panel membuang draf.
									</p>
								</div>
								<p class="rounded-xl bg-slate-50 px-3.5 py-3 text-xs font-semibold text-slate-500">
									{typeLabel(draft.type)} · {draft.duration}
								</p>
							</div>
							{/if}
						{/if}
					</li>
				{/each}
			</ol>
		{/if}

		<button
			type="button"
			onclick={addMaterial}
			class="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-xs font-bold text-slate-600 transition-all hover:border-slate-900 hover:bg-white hover:text-slate-900 active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-slate-900"
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

		<!-- Menu overflow global: fixed agar tidak terpotong overflow-hidden kartu -->
		{#if menuFor && menuMat}
			<button
				type="button"
				tabindex={-1}
				aria-hidden="true"
				aria-label="Tutup menu"
				onclick={closeMenu}
				class="fixed inset-0 z-40 cursor-default bg-transparent"
			></button>
			<span
				id="mat-menu-open"
				role="menu"
				tabindex={-1}
				aria-label={`Opsi materi ${menuIndex + 1}`}
				onkeydown={(e) => {
					if (e.key === 'Escape') closeMenu();
				}}
				style:top={`${menuPos?.top ?? 0}px`}
				style:right={`${menuPos?.right ?? 8}px`}
				class="fixed z-50 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl shadow-slate-900/10"
			>
				<button
					type="button"
					role="menuitem"
					aria-expanded={menuOpen}
					aria-controls={`mat-panel-${menuFor}`}
					onclick={() => {
						toggleMat(menuFor);
						closeMenu();
					}}
					class="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none"
				>
					<i class="fa-solid fa-sliders w-4 shrink-0 text-center text-slate-400" aria-hidden="true"></i>
					Edit
					<span class="ml-auto text-[10px] font-normal text-slate-400"
						>{menuOpen ? 'tutup · buang draf' : 'judul · tipe'}</span
					>
				</button>
				<span class="mx-3 my-1 block border-t border-slate-100" aria-hidden="true"></span>
				<button
					type="button"
					role="menuitem"
					onclick={() => {
						moveMaterial(menuFor, -1);
						closeMenu();
					}}
					disabled={menuIndex === 0}
					class="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
				>
					<i class="fa-solid fa-arrow-up w-4 shrink-0 text-center text-slate-400" aria-hidden="true"></i>
					Pindah ke atas
				</button>
				<button
					type="button"
					role="menuitem"
					onclick={() => {
						moveMaterial(menuFor, 1);
						closeMenu();
					}}
					disabled={menuIndex === materials.length - 1}
					class="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
				>
					<i class="fa-solid fa-arrow-down w-4 shrink-0 text-center text-slate-400" aria-hidden="true"></i>
					Pindah ke bawah
				</button>
				<span class="mx-3 my-1 block border-t border-slate-100" aria-hidden="true"></span>
				<button
					type="button"
					role="menuitem"
					onclick={() => {
						removeMaterial(menuFor);
						closeMenu();
					}}
					class="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 focus-visible:bg-red-50 focus-visible:outline-none"
				>
					<i class="fa-solid fa-trash w-4 shrink-0 text-center" aria-hidden="true"></i>
					Hapus materi
				</button>
			</span>
		{/if}

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
