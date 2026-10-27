<script lang="ts">
import { page } from '$app/state';
	import { getCourseById } from '$lib/data/courses';
	import type { CourseModule, SubModule } from '$lib/data/courses';
	import { resolveServerCourse, isServerKelola, isServerId } from '$lib/api/courses';
	import {
		createSubModule,
		updateSubModule,
		deleteSubModule
	} from '$lib/api/courses';
	import {
		curriculumUid,
		clonePlain,
		loadCurriculumDraft,
		saveCurriculumDraft,
		withSyncedFlat
	} from '$lib/stores/curriculum';
	import WarningModal from '$lib/components/WarningModal.svelte';

	const courseId = $derived(Number(page.params.courseId));
	const moduleId = $derived(page.params.moduleId);
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
	let openSubs = $state<string[]>([]);
	/** Menu overflow (⋯) yang sedang terbuka — hanya satu per daftar. */
	let menuFor = $state<string | null>(null);
	/** Posisi viewport menu (fixed) agar tidak terpotong `overflow-hidden` kartu. */
	let menuPos = $state<{ top: number; right: number } | null>(null);
	/** Draf suntingan tiap sub-modul. Diterapkan hanya saat Simpan ditekan. */
	let subDrafts = $state<Record<string, { title: string; description: string }>>({});
	let subErrors = $state<Record<string, string>>({});
	/** Warna pastel badge nomor — sama seperti halaman modul. */
	const MODULE_BADGES = [
		'bg-blue-100 text-blue-700',
		'bg-violet-100 text-violet-700',
		'bg-emerald-100 text-emerald-700',
		'bg-amber-100 text-amber-700'
	] as const;

	function badgeClass(si: number): string {
		return MODULE_BADGES[((si % MODULE_BADGES.length) + MODULE_BADGES.length) % MODULE_BADGES.length];
	}

	/** Aksen warna header menurut nomor modul: garis atas, angka hantu, chip. */
	const MODULE_TINTS = [
		{ bar: 'bg-blue-600', ghost: 'text-blue-100', chip: 'bg-blue-50 text-blue-700 ring-1 ring-blue-100' },
		{ bar: 'bg-violet-600', ghost: 'text-violet-100', chip: 'bg-violet-50 text-violet-700 ring-1 ring-violet-100' },
		{ bar: 'bg-emerald-600', ghost: 'text-emerald-100', chip: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100' },
		{ bar: 'bg-amber-500', ghost: 'text-amber-100', chip: 'bg-amber-50 text-amber-700 ring-1 ring-amber-100' }
	] as const;

	function tintFor(mi: number): (typeof MODULE_TINTS)[number] {
		return MODULE_TINTS[((mi % MODULE_TINTS.length) + MODULE_TINTS.length) % MODULE_TINTS.length];
	}
	/** Hapus yang menunggu konfirmasi modal bahaya. */
	let pendingDelete = $state<{
		subId: string;
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
		menuFor = null;
		menuPos = null;
		subDrafts = {};
		subErrors = {};
		initializedFor = initKey;
	});

	function toggleMenu(id: string, anchor?: HTMLElement | null) {
		if (menuFor === id) {
			closeMenu();
			return;
		}
		if (anchor) {
			const r = anchor.getBoundingClientRect();
			const approxH = 248;
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

	/* Simpan setiap perubahan kembali ke draf bersama. */
	$effect(() => {
		if (initializedFor !== initKey || !course) return;
		saveCurriculumDraft(courseId, editableModules);
	});

	const moduleIndex = $derived(editableModules.findIndex((m) => m.id === moduleId));
	const mod = $derived(moduleIndex >= 0 ? editableModules[moduleIndex] : undefined);
	const subs = $derived<SubModule[]>(mod?.subModules ?? []);
	const matCount = $derived(subs.reduce((n, s) => n + s.materials.length, 0));
	const tint = $derived(tintFor(moduleIndex));
	/** Sub-modul + indeks pemilik menu yang terbuka (menu dirender sekali di luar kartu). */
	const menuSub = $derived(menuFor ? subs.find((s) => s.id === menuFor) : undefined);
	const menuIndex = $derived(menuFor ? subs.findIndex((s) => s.id === menuFor) : -1);
	const menuOpen = $derived(menuFor ? openSubs.includes(menuFor) : false);

	function markSaved(msg: string) {
		savedMessage = msg;
	}

	function isOpen(id: string): boolean {
		return openSubs.includes(id);
	}

	function snapshotSub(sub: SubModule) {
		subDrafts[sub.id] = { title: sub.title, description: sub.description };
		delete subErrors[sub.id];
	}

	function toggleSub(id: string | null) {
		if (!id) return;
		if (isOpen(id)) {
			// Menutup = membuang perubahan yang belum disimpan.
			openSubs = openSubs.filter((x) => x !== id);
			delete subDrafts[id];
			delete subErrors[id];
		} else {
			const sub = subs.find((s) => s.id === id);
			if (sub) snapshotSub(sub);
			openSubs = [...openSubs, id];
		}
	}

	function cancelDelete() {
		pendingDelete = null;
	}

	async function executeDelete() {
		const target = pendingDelete;
		if (!target || moduleIndex < 0) return;
		if (serverMode && isServerId(target.subId)) {
			try {
				await deleteSubModule(Number(target.subId));
			} catch (e) {
				markSaved(e instanceof Error ? e.message : 'Gagal menghapus sub-modul di server.');
				return;
			}
		}
		pendingDelete = null;
		showDelete = false;
		menuFor = null;
		menuPos = null;
		const m = editableModules[moduleIndex];
		const current = m.subModules ?? [];
		if (current.length <= 1) return;
		editableModules[moduleIndex] = withSyncedFlat({
			...m,
			subModules: current.filter((s) => s.id !== target.subId)
		});
		openSubs = openSubs.filter((x) => x !== target.subId);
		delete subDrafts[target.subId];
		delete subErrors[target.subId];
		markSaved('Sub-modul dihapus.');
	}

	function addSubModule() {
		if (moduleIndex < 0) return;
		void addSubModuleAsync();
	}

	async function addSubModuleAsync(): Promise<void> {
		if (moduleIndex < 0) return;
		const m = editableModules[moduleIndex];
		const current = m.subModules ?? [];
		const pos = current.length;
		let id = curriculumUid('sub');
		if (serverMode && isServerId(moduleId)) {
			try {
				const created = await createSubModule(Number(moduleId), {
					title: `Sub-modul ${current.length + 1}`,
					description: '',
					position: pos
				});
				id = String(created.id);
			} catch (e) {
				markSaved(e instanceof Error ? e.message : 'Gagal menambah sub-modul.');
				return;
			}
		}
		const sub: SubModule = {
			id,
			title: `Sub-modul ${current.length + 1}`,
			description: '',
			materials: []
		};
		editableModules[moduleIndex] = withSyncedFlat({ ...m, subModules: [...current, sub] });
		openSubs = [...openSubs, sub.id];
		subDrafts[sub.id] = { title: sub.title, description: sub.description };
		pendingDelete = null;
		markSaved('Sub-modul baru ditambahkan.');
	}

	function removeSubModule(subId: string | null) {
		if (!subId || moduleIndex < 0) return;
		const m = editableModules[moduleIndex];
		const current = m.subModules ?? [];
		if (current.length <= 1) return;
		const si = current.findIndex((s) => s.id === subId);
		const target = current[si];
		pendingDelete = {
			subId,
			title: `Hapus Sub-modul ${moduleIndex + 1}.${si + 1}?`,
			message: `“${target?.title || '(belum berjudul)'}” beserta ${target?.materials.length ?? 0} materi di dalamnya akan dihapus dari draf. Tindakan ini tidak bisa dibatalkan.`
		};
		showDelete = true;
	}

	function moveSub(subId: string | null, dir: -1 | 1) {
		if (!subId || moduleIndex < 0) return;
		const m = editableModules[moduleIndex];
		const current = [...(m.subModules ?? [])];
		const idx = current.findIndex((s) => s.id === subId);
		const target = idx + dir;
		if (idx < 0 || target < 0 || target >= current.length) return;
		[current[idx], current[target]] = [current[target], current[idx]];
		editableModules[moduleIndex] = withSyncedFlat({ ...m, subModules: current });
		if (serverMode) void syncSubPositions();
		markSaved(`Sub-modul dipindah ke posisi ${target + 1}.`);
	}

	/** Tulis ulang position semua sub-modul ke server sesuai urutan. */
	async function syncSubPositions(): Promise<void> {
		const current = editableModules[moduleIndex]?.subModules ?? [];
		try {
			await Promise.all(
				current.map((s, i) =>
					isServerId(s.id) ? updateSubModule(Number(s.id), { position: i }) : Promise.resolve()
				)
			);
		} catch (e) {
			markSaved(e instanceof Error ? e.message : 'Gagal menyimpan urutan sub-modul.');
		}
	}

	function duplicateSub(subId: string | null) {
		if (!subId || moduleIndex < 0) return;
		void duplicateSubAsync(subId);
	}

	async function duplicateSubAsync(subId: string): Promise<void> {
		const m = editableModules[moduleIndex];
		const current = m.subModules ?? [];
		const src = current.find((s) => s.id === subId);
		if (!src) return;
		let newId = curriculumUid('sub');
		let newPos = current.findIndex((s) => s.id === subId) + 1;
		if (serverMode && isServerId(moduleId)) {
			try {
				const created = await createSubModule(Number(moduleId), {
					title: `${src.title} (salinan)`,
					description: src.description,
					position: newPos
				});
				newId = String(created.id);
			} catch (e) {
				markSaved(e instanceof Error ? e.message : 'Gagal menduplikasi sub-modul.');
				return;
			}
		}
		const copy: SubModule = {
			...clonePlain(src),
			id: newId,
			title: `${src.title} (salinan)`,
			materials: []
		};
		const at = current.findIndex((s) => s.id === subId) + 1;
		editableModules[moduleIndex] = withSyncedFlat({
			...m,
			subModules: [...current.slice(0, at), copy, ...current.slice(at)]
		});
		if (serverMode) void syncSubPositions();
		markSaved('Sub-modul diduplikasi (materi tidak ikut disalin).');
	}

	/** Satu-satunya jalan menyimpan perubahan nama/deskripsi sub-modul. */
	async function saveSubDraft(subId: string | null) {
		if (!subId || moduleIndex < 0) return;
		const d = subDrafts[subId];
		const m = editableModules[moduleIndex];
		const si = (m.subModules ?? []).findIndex((s) => s.id === subId);
		if (!d || si < 0) return;
		if (!d.title.trim()) {
			subErrors[subId] = 'Isi nama sub-modul terlebih dahulu.';
			return;
		}
		delete subErrors[subId];
		if (serverMode && isServerId(subId)) {
			try {
				await updateSubModule(Number(subId), { title: d.title, description: d.description });
			} catch (e) {
				subErrors[subId] = e instanceof Error ? e.message : 'Gagal menyimpan ke server.';
				return;
			}
		}
		const current = [...(m.subModules ?? [])];
		current[si] = { ...current[si], title: d.title, description: d.description };
		editableModules[moduleIndex] = withSyncedFlat({ ...m, subModules: current });
		saveCurriculumDraft(courseId, editableModules);
		delete subDrafts[subId];
		openSubs = openSubs.filter((x) => x !== subId);
		markSaved(`Sub-modul ${moduleIndex + 1}.${si + 1} tersimpan.`);
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
			class="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white"
		>
			<div class={`h-1.5 ${tint.bar}`} aria-hidden="true"></div>
			<div class="relative px-4 py-4 sm:px-6">
				<span
					class={`pointer-events-none absolute top-1 right-3 text-[76px] leading-none font-black tracking-tighter select-none sm:text-[96px] ${tint.ghost}`}
					aria-hidden="true"
				>
					{String(moduleIndex + 1).padStart(2, '0')}
				</span>
				<div class="relative flex flex-wrap items-start justify-between gap-3">
					<div class="min-w-0">
						<p class={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-extrabold tracking-[0.16em] uppercase ${tint.chip}`}>
							<i class="fa-solid fa-layer-group" aria-hidden="true"></i>
							Kelola sub-modul
						</p>
						<h1 id="modul-heading" class="mt-2 text-xl font-extrabold text-slate-900 sm:text-2xl">
							Modul {moduleIndex + 1}: {mod.title || '(belum berjudul)'}
						</h1>
						{#if mod.description}
							<p class="mt-1.5 max-w-xl text-xs leading-relaxed text-slate-500 sm:text-[13px]">{mod.description}</p>
						{/if}
					</div>
					<div class="flex shrink-0 flex-wrap items-center gap-2 self-end">
						<span class="inline-flex items-center gap-1.5 rounded-full bg-violet-700 px-3 py-1.5 text-[11px] font-bold text-white">
							{subs.length} sub-modul · {matCount} materi
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

		<!-- Daftar sub-modul -->
		<div class="mb-4">
			<h2 class="text-lg font-bold text-slate-900">Sub-modul ({subs.length})</h2>
			<p class="text-xs text-slate-500">
				Tekan <strong>Kelola materi</strong> untuk mengatur isi tiap sub-modul. Perubahan nama/deskripsi wajib disimpan lewat tombol Simpan.
			</p>
		</div>

		<ol aria-label={`Sub-modul dalam Modul ${moduleIndex + 1}`} class="space-y-3">
			{#each subs as sub, si (sub.id)}
				{@const open = isOpen(sub.id)}
				<li
					class="rounded-2xl border border-slate-200 bg-white transition-all {open
						? 'border-blue-500 shadow-md shadow-blue-600/10'
						: 'shadow-sm hover:border-slate-300'}"
				>
					<div class="flex items-center gap-3 p-4">
						<span
							class={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xs font-extrabold ring-4 ring-white ${badgeClass(si)}`}
							aria-hidden="true"
						>
							{moduleIndex + 1}.{si + 1}
						</span>
						<span class="min-w-0 flex-1">
							<span class="block truncate text-sm font-extrabold text-slate-900">
								{sub.title || '(belum berjudul)'}
							</span>
							<span class="mt-0.5 block truncate text-[11px] font-semibold text-slate-500">
								{sub.materials.length} materi
								{#if sub.description}
									<span class="text-slate-400"> · {sub.description}</span>
								{/if}
							</span>
						</span>
						<span
							class="flex shrink-0 items-center gap-1.5"
							role="group"
							aria-label={`Aksi Sub-modul ${moduleIndex + 1}.${si + 1}`}
						>
							<a
								href={`/instruktur/kursusku/${courseId}/${moduleId}/${sub.id}`}
								aria-label={`Kelola materi Sub-modul ${moduleIndex + 1}.${si + 1}: ${sub.title || '(belum berjudul)'} (${sub.materials.length} materi)`}
								title="Buka halaman kelola materi"
								class="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-violet-600 px-3.5 py-2 text-[11px] font-bold text-white transition-all hover:bg-violet-700 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-violet-600"
							>
								<i class="fa-solid fa-book-open" aria-hidden="true"></i>
								Kelola materi
								<i class="fa-solid fa-arrow-right text-[10px] opacity-70" aria-hidden="true"></i>
							</a>
							<button
								type="button"
								onclick={(e) => toggleMenu(sub.id, e.currentTarget)}
								aria-expanded={menuFor === sub.id}
								aria-haspopup="menu"
								aria-controls="sub-menu-open"
								aria-label={`Opsi lain Sub-modul ${moduleIndex + 1}.${si + 1}`}
								title="Opsi lain"
								class="flex min-h-10 min-w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition-all hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-violet-600"
							>
								<i class="fa-solid fa-ellipsis-vertical text-sm" aria-hidden="true"></i>
							</button>
						</span>
					</div>

						{#if open}
							{@const draft = subDrafts[sub.id]}
							{#if draft}
							<div
								id={`sub-panel-${sub.id}`}
								class="space-y-3 rounded-b-2xl border-t border-slate-100 bg-slate-50/60 p-4"
							>
								<div class="grid gap-3">
									<div>
										<label for={`sub-t-${sub.id}`} class="mb-1 block text-[11px] font-bold text-slate-600">
											Sub-modul {moduleIndex + 1}.{si + 1} — judul
										</label>
										<input
											id={`sub-t-${sub.id}`}
											type="text"
											bind:value={draft.title}
											placeholder="Judul sub-modul…"
											class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 placeholder:font-normal placeholder:text-slate-400 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 focus:outline-none"
										/>
									</div>
									<div>
										<label for={`sub-d-${sub.id}`} class="mb-1 block text-[11px] font-bold text-slate-600">
											Deskripsi sub-modul (opsional)
										</label>
										<input
											id={`sub-d-${sub.id}`}
											type="text"
											bind:value={draft.description}
											placeholder="Satu kalimat tujuan sub-modul…"
											class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 placeholder:text-slate-400 focus:border-violet-500 focus:outline-none"
										/>
									</div>
								</div>
								{#if subErrors[sub.id]}
									<p role="alert" class="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
										<i class="fa-solid fa-circle-exclamation mt-0.5 shrink-0" aria-hidden="true"></i>
										{subErrors[sub.id]}
									</p>
								{/if}
								<div>
									<button
										type="button"
										onclick={() => saveSubDraft(sub.id)}
										aria-label={`Simpan Sub-modul ${moduleIndex + 1}.${si + 1}`}
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
									{sub.materials.length} materi
								</p>
							</div>
							{/if}
						{/if}
				</li>
			{/each}
		</ol>

		<button
			type="button"
			onclick={addSubModule}
			class="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-xs font-bold text-slate-600 transition-all hover:border-slate-900 hover:bg-white hover:text-slate-900 active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-slate-900"
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

		<!-- Menu overflow global: fixed agar tidak terpotong overflow-hidden kartu -->
		{#if menuFor && menuSub}
			<button
				type="button"
				tabindex={-1}
				aria-hidden="true"
				aria-label="Tutup menu"
				onclick={closeMenu}
				class="fixed inset-0 z-40 cursor-default bg-transparent"
			></button>
			<span
				id="sub-menu-open"
				role="menu"
				tabindex={-1}
				aria-label={`Opsi Sub-modul ${moduleIndex + 1}.${menuIndex + 1}`}
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
					aria-controls={`sub-panel-${menuFor}`}
					onclick={() => {
						toggleSub(menuFor);
						closeMenu();
					}}
					class="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none"
				>
					<i class="fa-solid fa-sliders w-4 shrink-0 text-center text-slate-400" aria-hidden="true"></i>
					Edit nama & deskripsi
					<span class="ml-auto text-[10px] font-normal text-slate-400"
						>{menuOpen ? 'tutup · buang draf' : 'nama · deskripsi'}</span
					>
				</button>
				<button
					type="button"
					role="menuitem"
					onclick={() => {
						duplicateSub(menuFor);
						closeMenu();
					}}
					class="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none"
				>
					<i class="fa-solid fa-copy w-4 shrink-0 text-center text-slate-400" aria-hidden="true"></i>
					Duplikasi
					<span class="ml-auto text-[10px] font-normal text-slate-400">tanpa materi</span>
				</button>
				<span class="mx-3 my-1 block border-t border-slate-100" aria-hidden="true"></span>
				<button
					type="button"
					role="menuitem"
					onclick={() => {
						moveSub(menuFor, -1);
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
						moveSub(menuFor, 1);
						closeMenu();
					}}
					disabled={menuIndex === subs.length - 1}
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
						removeSubModule(menuFor);
						closeMenu();
					}}
					disabled={subs.length <= 1}
					title={subs.length <= 1 ? 'Setiap modul wajib punya minimal 1 sub-modul' : undefined}
					class="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 focus-visible:bg-red-50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
				>
					<i class="fa-solid fa-trash w-4 shrink-0 text-center" aria-hidden="true"></i>
					Hapus sub-modul
				</button>
			</span>
		{/if}

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
