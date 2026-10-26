<script lang="ts">
	import { page } from '$app/state';
	import { untrack } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import {
		getCourseById,
		getModuleMaterials,
		isMaterialLocked,
		isSubModuleLocked,
		normalizeMaterialType,
		type CourseModule,
		type MaterialType
	} from '$lib/data/courses';
	import {
		courseProgress,
		firstUnfinishedInCourse,
		getTrainingStats,
		moduleProgress,
		resolveSubModules,
		subModuleProgress
	} from '$lib/data/training';
	import { doneMaterials, ensureSeeded } from '$lib/stores/progress.svelte';
	import { getQuizResult } from '$lib/stores/quiz-results.svelte';
	import { latestFor } from '$lib/stores/submissions.svelte';
	import { getCourseMeta } from '$lib/data/course-meta';
	import { moduleCredentialId } from '$lib/data/certificates';
	import { canAccessCourse, isPeriodLocked } from '$lib/stores/enrollment.svelte';
	import { resolve } from '$app/paths';
	import CourseRoadmap from '$lib/components/training/organisms/CourseRoadmap.svelte';

	/** Warna pastel badge nomor — sama seperti halaman instruktur. */
	const MODULE_BADGES = [
		'bg-blue-100 text-blue-700',
		'bg-violet-100 text-violet-700',
		'bg-emerald-100 text-emerald-700',
		'bg-amber-100 text-amber-700'
	] as const;

	function badgeClass(mi: number): string {
		return MODULE_BADGES[((mi % MODULE_BADGES.length) + MODULE_BADGES.length) % MODULE_BADGES.length];
	}

	/**
	 * Tahap 2a — baca-saja. Status kuis per modul dari hasil tersimpan di browser.
	 * Hanya percobaan terakhir yang tersedia, bukan nilai terbaik (K-02).
	 */
	function quizStatsFor(mod: CourseModule): { total: number; passed: number } {
		const qs = getModuleMaterials(mod).filter((m) => normalizeMaterialType(m.type) === 'kuis');
		let passed = 0;
		for (const q of qs) if (getQuizResult(q.id)?.passed) passed++;
		return { total: qs.length, passed };
	}

	/**
	 * Tahap 2a — baca-saja. Status tugas per modul dari riwayat lokal peserta.
	 * Nilai instruktur tersimpan di antrean terpisah dan belum tentu tersinkron ke sini,
	 * jadi `graded` hanya yang benar-benar terbaca di sisi peserta.
	 */
	function taskStatsFor(mod: CourseModule): {
		total: number;
		submitted: number;
		graded: number;
	} {
		const ts = getModuleMaterials(mod).filter((m) => normalizeMaterialType(m.type) === 'tugas');
		let submitted = 0;
		let graded = 0;
		for (const t of ts) {
			const s = latestFor(t.id);
			if (s) {
				submitted++;
				if (s.score !== null && s.score !== undefined) graded++;
			}
		}
		return { total: ts.length, submitted, graded };
	}

	const courseId = $derived(Number(page.params.courseId));
	const course = $derived(getCourseById(courseId));
	const meta = $derived(course ? getCourseMeta(course.id) : null);
	const paidLocked = $derived(course ? !canAccessCourse(course.id) : false);
	const periodLocked = $derived(course ? !paidLocked && isPeriodLocked(course.id) : false);

	let openModules = new SvelteSet<string>();
	let openSubs = new SvelteSet<string>();

	let query = $state('');
	let typeFilter = $state<'all' | MaterialType>('all');
	let hideDone = $state(false);

	// Seed + buka otomatis modul & sub-modul pertama yang belum selesai.
	// Dilewati saat materi terkunci (belum bayar / batch belum mulai).
	$effect(() => {
		if (!course || paidLocked || periodLocked) return;
		ensureSeeded(course);
		const isDone = (id: string) => untrack(() => doneMaterials.has(id));
		const first = untrack(() => firstUnfinishedInCourse(course, isDone));
		openModules.clear();
		openSubs.clear();
		if (first) {
			openModules.add(first.module.id);
			const subs = resolveSubModules(first.module);
			const sub = subs.find((s) => s.materials.some((m) => m.id === first.material.id));
			if (sub) openSubs.add(sub.id);
			else if (subs[0]) openSubs.add(subs[0].id);
		} else if (course.modules[0]) {
			openModules.add(course.modules[0].id);
			const s0 = resolveSubModules(course.modules[0])[0];
			if (s0) openSubs.add(s0.id);
		}
	});

	const stats = $derived(course ? getTrainingStats(course) : null);
	const prog = $derived(course ? courseProgress(course, (id) => doneMaterials.has(id)) : null);

	const resume = $derived(
		course ? firstUnfinishedInCourse(course, (id) => doneMaterials.has(id)) : null
	);
	const resumeSub = $derived.by(() => {
		if (!resume || !course) return null;
		const subs = resolveSubModules(resume.module);
		return subs.find((s) => s.materials.some((m) => m.id === resume.material.id)) ?? null;
	});

	const q = $derived(query.trim().toLowerCase());

	// Struktur tampil dengan filter pencarian / tipe / sembunyikan selesai.
	// Index asli (moduleIndex/subIndex) dipertahankan untuk locking yang benar.
	const view = $derived.by(() => {
		if (!course) return [];
		return course.modules
			.map((mod, moduleIndex) => {
				const subs = resolveSubModules(mod);
				const mappedSubs = subs
					.map((sub, subIndex) => {
						let mats = sub.materials;
						if (q) {
							mats = mats.filter(
								(m) =>
									m.title.toLowerCase().includes(q) ||
									sub.title.toLowerCase().includes(q) ||
									mod.title.toLowerCase().includes(q)
							);
						}
						if (typeFilter !== 'all') {
							mats = mats.filter((m) => normalizeMaterialType(String(m.type)) === typeFilter);
						}
						if (hideDone) {
							mats = mats.filter((m) => !doneMaterials.has(m.id));
						}
						return { sub, subIndex, mats };
					})
					.filter((s) => {
						if (q) {
							return (
								s.mats.length > 0 ||
								s.sub.title.toLowerCase().includes(q) ||
								s.sub.description.toLowerCase().includes(q)
							);
						}
						// Tanpa pencarian: tampilkan sub walau kosong karena hideDone,
						// tapi tandai kosong agar bisa tampil pesan.
						if (hideDone || typeFilter !== 'all') return s.mats.length > 0;
						return true;
					});
				// Saat mencari, modul tanpa sub cocok disembunyikan
				if (q && mappedSubs.length === 0) {
					const modMatch =
						mod.title.toLowerCase().includes(q) || mod.description.toLowerCase().includes(q);
					if (!modMatch) return null;
				}
				if ((hideDone || typeFilter !== 'all') && !q && mappedSubs.length === 0) return null;
				return { mod, moduleIndex, subs: mappedSubs };
			})
			.filter((x) => x !== null);
	});

	const searching = $derived(q.length > 0 || typeFilter !== 'all' || hideDone);

	function toggleModule(id: string) {
		if (openModules.has(id)) openModules.delete(id);
		else openModules.add(id);
	}

	function toggleSub(id: string) {
		if (openSubs.has(id)) openSubs.delete(id);
		else openSubs.add(id);
	}

	function expandAll() {
		if (!course) return;
		for (const m of course.modules) {
			openModules.add(m.id);
			for (const s of resolveSubModules(m)) openSubs.add(s.id);
		}
	}

	function collapseAll() {
		openModules.clear();
		openSubs.clear();
	}

	function typeIcon(type: string) {
		if (type === 'kuis') return 'fa-circle-question text-amber-600';
		if (type === 'tugas') return 'fa-pen-to-square text-violet-600';
		return 'fa-book-open text-emerald-600';
	}

	function typeLabel(type: string) {
		if (type === 'kuis') return 'Kuis';
		if (type === 'tugas') return 'Tugas';
		return 'Materi';
	}

	function actionLabel(type: string) {
		if (type === 'kuis') return 'Kerjakan';
		if (type === 'tugas') return 'Kumpulkan';
		return 'Pelajari';
	}
</script>

<svelte:head>
	<title>{course ? `${course.title} — Modul` : 'Kursus tidak ditemukan'} — Aristoteles</title>
	<meta
		name="description"
		content={course ? `Modul pembelajaran ${course.title}` : 'Detail kursus'}
	/>
</svelte:head>

<div class="p-4 sm:p-6 lg:p-8">
	{#if !course || !stats || !prog}
		<div class="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-10 text-center">
			<i class="fa-solid fa-triangle-exclamation mb-3 text-3xl text-amber-500" aria-hidden="true"
			></i>
			<h1 class="text-xl font-bold text-slate-900">Kursus tidak ditemukan</h1>
			<p class="mt-1 text-sm text-slate-500">
				ID kursus “{page.params.courseId}” tidak terdaftar di Kursusku.
			</p>
			<a
				href="/user/kursusku"
				class="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-blue-700"
			>
				<i class="fa-solid fa-arrow-left" aria-hidden="true"></i> Kembali ke Kursusku
			</a>
		</div>
	{:else if paidLocked && meta}
		<nav aria-label="Breadcrumb" class="mb-4 flex items-center gap-2 text-xs text-slate-500">
			<a
				href="/user/kursusku"
				class="rounded font-semibold text-blue-600 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
			>
				Kursusku
			</a>
			<i class="fa-solid fa-chevron-right text-[10px] text-slate-300" aria-hidden="true"></i>
			<span aria-current="page" class="truncate font-medium text-slate-700">{course.title}</span>
		</nav>
		<div
			class="mx-auto max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white text-center shadow-xl"
		>
			<div class="bg-blue-800 px-6 py-8 text-white">
				<span
					class="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10"
					aria-hidden="true"
				>
					<i class="fa-solid fa-lock text-2xl text-amber-300"></i>
				</span>
				<p class="mt-4 text-[11px] font-extrabold tracking-[0.16em] text-blue-200 uppercase">
					Course Berbayar
				</p>
				<h1 class="mt-1 text-xl font-extrabold">{course.title}</h1>
				<p class="mt-2 text-3xl font-black">{meta.price}</p>
				<p class="mt-1 text-xs text-slate-300">Sekali bayar · Akses selamanya</p>
			</div>
			<div class="space-y-2 p-6 text-left text-sm text-slate-600">
				<p class="flex items-center gap-2.5">
					<i class="fa-solid fa-circle-check text-emerald-500" aria-hidden="true"></i>
					{stats?.moduleCount} modul · {stats?.subModuleCount} sub-modul · {stats?.materialCount} materi
				</p>
				<p class="flex items-center gap-2.5">
					<i class="fa-solid fa-circle-check text-emerald-500" aria-hidden="true"></i> Sertifikat kelulusan
					+ mentoring
				</p>
				<a
					href={resolve(`/user/pembayaran/${course.id}`)}
					class="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/25 transition-all hover:bg-blue-700 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-blue-600"
				>
					<i class="fa-solid fa-credit-card" aria-hidden="true"></i>
					Lanjut ke Pembayaran · {meta.price}
				</a>
				<a
					href="/user/semua-kursus"
					class="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
				>
					<i class="fa-solid fa-arrow-left" aria-hidden="true"></i> Kembali ke Katalog
				</a>
			</div>
		</div>
	{:else if periodLocked && meta}
		<nav aria-label="Breadcrumb" class="mb-4 flex items-center gap-2 text-xs text-slate-500">
			<a
				href="/user/kursusku"
				class="rounded font-semibold text-blue-600 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
			>
				Kursusku
			</a>
			<i class="fa-solid fa-chevron-right text-[10px] text-slate-300" aria-hidden="true"></i>
			<span aria-current="page" class="truncate font-medium text-slate-700">{course.title}</span>
		</nav>
		<div
			class="mx-auto max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white text-center shadow-xl"
		>
			<div class="bg-blue-800 px-6 py-8 text-white">
				<span
					class="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10"
					aria-hidden="true"
				>
					<i class="fa-solid fa-calendar-clock text-2xl text-amber-300"></i>
				</span>
				<p class="mt-4 text-[11px] font-extrabold tracking-[0.16em] text-blue-200 uppercase">
					Terdaftar · Batch Belum Mulai
				</p>
				<h1 class="mt-1 text-xl font-extrabold">{course.title}</h1>
				<p class="mt-2 text-2xl font-black">Mulai {meta.startMonth ?? 'segera'}</p>
				<p class="mt-1 text-xs text-slate-300">
					Kamu sudah terdaftar. Seluruh materi terkunci sampai periode berjalan.
				</p>
			</div>
			<div class="space-y-2 p-6 text-left text-sm text-slate-600">
				<p class="flex items-center gap-2.5">
					<i class="fa-solid fa-circle-check text-emerald-500" aria-hidden="true"></i>
					{stats?.moduleCount} modul · {stats?.subModuleCount} sub-modul · {stats?.materialCount} materi
					menunggumu
				</p>
				<p class="flex items-center gap-2.5">
					<i class="fa-solid fa-bell text-amber-500" aria-hidden="true"></i>
					Kami akan memberi tahu saat batch dibuka.
				</p>
				<span
					aria-disabled="true"
					class="flex min-h-12 w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-slate-200 px-5 py-3 text-sm font-bold text-slate-500"
				>
					<i class="fa-solid fa-lock" aria-hidden="true"></i>
					Materi Terkunci
				</span>
				<a
					href="/user/semua-kursus"
					class="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600"
				>
					<i class="fa-solid fa-arrow-left" aria-hidden="true"></i> Kembali ke Katalog
				</a>
			</div>
		</div>
	{:else}
		<nav aria-label="Breadcrumb" class="mb-4 flex items-center gap-2 text-xs text-slate-500">
			<a
				href="/user/kursusku"
				class="rounded font-semibold text-blue-600 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
			>
				Kursusku
			</a>
			<i class="fa-solid fa-chevron-right text-[10px] text-slate-300" aria-hidden="true"></i>
			<span aria-current="page" class="truncate font-medium text-slate-700">{course.title}</span>
		</nav>

		<!-- Header kursus: sama seperti halaman instruktur, aksi = mengikuti pelatihan -->
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
				<div class="relative flex flex-wrap gap-2 p-4 pb-2 sm:px-6">
					<span class="rounded-full bg-blue-600 px-3 py-1 text-[11px] font-bold text-white uppercase">{course.category}</span>
					<span class="rounded-full bg-white/20 px-3 py-1 text-[11px] font-bold text-white uppercase backdrop-blur">{course.level}</span>
					<span class="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold text-white uppercase backdrop-blur">
						<i class="fa-solid fa-circle-play" aria-hidden="true"></i>
						{prog.percent}% selesai
					</span>
				</div>
				<div class="relative p-4 pt-1 sm:px-6 sm:pb-5">
					<h1 class="text-xl leading-snug font-extrabold text-white sm:text-2xl">{course.title}</h1>
					<p class="mt-1 text-xs text-slate-200 sm:text-sm">Oleh {course.instructor} · {course.duration}</p>
					<p class="mt-1 text-[11px] font-semibold tracking-wide text-blue-200 uppercase">
						Ikuti · {stats.moduleCount} modul · {stats.subModuleCount} sub-modul · {stats.materialCount} materi
					</p>
				</div>
			</div>
			<div class="flex flex-col gap-4 p-4 sm:p-6 lg:flex-row lg:items-center">
				<p class="max-w-2xl flex-1 text-sm text-slate-600">{course.description}</p>
				<div class="w-full lg:max-w-xs">
					<div class="mb-1.5 flex justify-between text-xs">
						<span class="font-medium text-slate-500"
							>Progres kamu: {prog.done}/{prog.total} materi</span
						>
						<span class="font-bold text-slate-800">{prog.percent}%</span>
					</div>
					<div
						class="h-2.5 overflow-hidden rounded-full bg-slate-100"
						role="progressbar"
						aria-valuenow={prog.percent}
						aria-valuemin={0}
						aria-valuemax={100}
						aria-label={`Progres ${course.title}`}
					>
						<div
							class="h-full rounded-full bg-blue-600 transition-all duration-500"
							style="width: {prog.percent}%"
						></div>
					</div>
					<p class="mt-2 text-[11px] text-slate-500" role="status" aria-live="polite">
						{#if prog.percent === 100}
							🎉 Semua {stats.moduleCount} modul selesai! Sertifikatmu siap diunduh.
						{:else if resume}
							Lanjut: Modul {resume.moduleIndex + 1} · {resume.material.title}
						{:else}
							Lanjutkan modul berikutnya untuk menaikkan progres.
						{/if}
					</p>
					{#if resume}
						<a
							href={`/user/kursusku/${course.id}/${resume.module.id}/${resume.material.id}`}
							class="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-blue-600/25 transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
						>
							<i class="fa-solid fa-play" aria-hidden="true"></i>
							Lanjutkan Belajar
							<span class="sr-only">: {resume.material.title} di {resume.module.title}</span>
						</a>
						{#if resumeSub}
							<p class="mt-1.5 truncate text-[11px] text-slate-500">
								Sub-modul: {resumeSub.title}
							</p>
						{/if}
					{/if}
				</div>
			</div>
		</header>

		<!-- Kontrol: cari + filter + buka/tutup (penting untuk 161 materi) -->
		<div class="mb-4 rounded-2xl border border-slate-200/70 bg-white p-4 sm:p-5">
			<div class="flex flex-col gap-3 lg:flex-row lg:items-center">
				<div class="relative flex-1">
					<label for="cari-materi" class="sr-only">Cari modul, sub-modul, atau materi</label>
					<input
						id="cari-materi"
						type="search"
						bind:value={query}
						placeholder="Cari: mis. “JWT”, “Grid”, “Capstone”…"
						class="w-full rounded-xl border border-slate-200 py-2.5 pr-3 pl-9 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
					/>
					<i
						class="fa-solid fa-magnifying-glass absolute top-1/2 left-3 -translate-y-1/2 text-xs text-slate-400"
						aria-hidden="true"
					></i>
				</div>
				<div class="flex flex-wrap items-center gap-2">
					<label for="filter-tipe" class="sr-only">Filter tipe materi</label>
					<select
						id="filter-tipe"
						bind:value={typeFilter}
						class="min-h-11 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
					>
						<option value="all">Semua tipe</option>
						<option value="materi">Materi</option>
						<option value="kuis">Kuis</option>
						<option value="tugas">Tugas</option>
					</select>
					<label
						class="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 select-none hover:bg-slate-50"
					>
						<input type="checkbox" bind:checked={hideDone} class="h-4 w-4 accent-blue-600" />
						Sembunyikan selesai
					</label>
					<button
						type="button"
						onclick={expandAll}
						class="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600"
					>
						<i class="fa-solid fa-angles-down" aria-hidden="true"></i> Buka semua
					</button>
					<button
						type="button"
						onclick={collapseAll}
						class="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600"
					>
						<i class="fa-solid fa-angles-up" aria-hidden="true"></i> Tutup
					</button>
				</div>
			</div>
			<p class="mt-2 text-[11px] text-slate-500" role="status" aria-live="polite">
				Menampilkan {view.length} modul
				{#if searching}
					· hasil filter: {view.reduce(
						(n, v) => n + v.subs.reduce((m, s) => m + s.mats.length, 0),
						0
					)} materi cocok
				{:else}
					· {prog.done}/{prog.total} materi selesai
				{/if}
			</p>
		</div>

		<!-- Daftar hierarki -->
		<div class="mb-4">
			<h2 class="text-lg font-bold text-slate-900">
				Kurikulum ({stats.moduleCount} Modul · {stats.subModuleCount} Sub-modul)
			</h2>
			<p class="text-xs text-slate-500">Ikuti modul berurutan — {prog.done}/{prog.total} materi selesai ({prog.percent}%).</p>
		</div>

		{#if view.length === 0}
			<div class="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
				<i class="fa-solid fa-folder-open mb-3 text-3xl text-slate-300" aria-hidden="true"></i>
				<p class="text-sm font-semibold text-slate-700">Tidak ada hasil untuk filter ini.</p>
				<p class="mt-1 text-xs text-slate-500">
					Coba ubah kata kunci, tipe, atau matikan “Sembunyikan selesai”.
				</p>
				<button
					type="button"
					onclick={() => {
						query = '';
						typeFilter = 'all';
						hideDone = false;
					}}
					class="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-blue-700"
				>
					<i class="fa-solid fa-rotate-left" aria-hidden="true"></i> Reset filter
				</button>
			</div>
		{:else}
			<div class="space-y-4">
				{#each view as { mod, moduleIndex, subs } (mod.id)}
					{@const mProg = moduleProgress(mod, (id) => doneMaterials.has(id))}
					{@const modOpen = searching ? true : openModules.has(mod.id)}
					{@const modComplete = mProg.done === mProg.total && mProg.total > 0}
					{@const qStat = quizStatsFor(mod)}
					{@const tStat = taskStatsFor(mod)}
					{@const missingMateri = mProg.total - mProg.done}
					{@const missingKuis = qStat.total - qStat.passed}
					{@const missingTugas = tStat.total - tStat.submitted}
					{@const ungradedTugas = tStat.submitted - tStat.graded}
					{@const knownUnmet =
						missingMateri > 0 || missingKuis > 0 || missingTugas > 0 || ungradedTugas > 0}
					<section
						aria-labelledby={`mod-title-${mod.id}`}
						class={`overflow-hidden rounded-2xl border bg-white transition-shadow ${modComplete ? 'border-emerald-200' : 'border-slate-200/70'} ${modOpen ? 'shadow-lg' : ''}`}
					>
						<button
								type="button"
								onclick={() => toggleModule(mod.id)}
								aria-expanded={modOpen}
								aria-controls={`mod-panel-${mod.id}`}
								class="flex w-full items-center gap-4 p-4 text-left transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-600 sm:p-5"
							>
								<span
									class={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-extrabold ring-4 ring-white ${modComplete ? 'bg-emerald-100 text-emerald-700' : badgeClass(moduleIndex)}`}
									aria-hidden="true"
								>
									{#if modComplete}
										<i class="fa-solid fa-check"></i>
									{:else}
										{moduleIndex + 1}
									{/if}
								</span>
								<span class="min-w-0 flex-1">
									<span
										id={`mod-title-${mod.id}`}
										class="block truncate text-sm font-bold text-slate-900 sm:text-base"
									>
										Modul {moduleIndex + 1}: {mod.title}
									</span>
									<span class="mt-0.5 block truncate text-xs text-slate-500">{mod.description}</span
									>
									<span
										class="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-semibold {modComplete
											? 'text-emerald-600'
											: 'text-slate-500'}"
									>
										<span>{mProg.done}/{mProg.total} materi</span>
										<span aria-hidden="true">·</span>
										<span>{subs.length} sub-modul</span>
										<span aria-hidden="true">·</span>
										<span>{mProg.percent}%</span>
									</span>
									<span
										class="mt-2 block h-1.5 w-full max-w-md overflow-hidden rounded-full bg-slate-100"
										role="progressbar"
										aria-valuenow={mProg.percent}
										aria-valuemin={0}
										aria-valuemax={100}
										aria-label={`Progres Modul ${moduleIndex + 1}`}
									>
										<span
											class={`block h-full rounded-full ${modComplete ? 'bg-emerald-500' : 'bg-blue-500'}`}
											style="width: {mProg.percent}%"
										></span>
									</span>
								</span>
								<i
									class={`fa-solid fa-chevron-down shrink-0 text-sm text-slate-400 transition-transform duration-300 ${modOpen ? 'rotate-180' : ''}`}
									aria-hidden="true"
								></i>
							</button>

						{#if modOpen}
							<div
								id={`mod-panel-${mod.id}`}
								class="border-t border-slate-100 bg-slate-50/50 p-3 sm:p-4"
							>
								<div
									class={`mb-2.5 flex flex-col gap-2 rounded-xl border px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between ${modComplete ? 'border-emerald-200 bg-emerald-50/70' : 'border-amber-200 bg-amber-50/70'}`}
								>
									<p class="flex items-start gap-2.5 text-[13px]">
										<span class={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${modComplete ? 'bg-emerald-600 text-white' : 'bg-amber-400 text-slate-900'}`} aria-hidden="true">
											<i class="fa-solid fa-award" aria-hidden="true"></i>
										</span>
										<span>
											<strong class="block text-[13px] font-extrabold text-slate-900">
												{#if modComplete}
													Sertifikat Modul {moduleIndex + 1} terbuka
												{:else}
													Sertifikat Modul {moduleIndex + 1}
												{/if}
											</strong>
											<span class="block text-[11px] text-slate-600">
												ID <span class="font-mono font-bold text-slate-800">{moduleCredentialId(course.id, moduleIndex)}</span>
												· {mProg.done}/{mProg.total} materi
											</span>
										</span>
									</p>
									{#if modComplete}
										<a
											href="/user/sertifikat"
											class="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-[11px] font-bold text-white hover:bg-emerald-700"
										>
											<i class="fa-solid fa-download text-[10px]" aria-hidden="true"></i> Lihat sertifikat
										</a>
									{:else}
										<span class="text-[11px] font-bold text-amber-700">
											Tuntaskan {mProg.total - mProg.done} materi lagi
										</span>
									{/if}
								</div>
								<div
									class="mb-2.5 rounded-xl border border-slate-200 bg-white px-3.5 py-3"
									aria-label={`Status persyaratan sertifikat Modul ${moduleIndex + 1}`}
								>
									<p class="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] font-extrabold text-slate-900">
										Status persyaratan
										<span class="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
											data lokal, bukan bukti resmi
										</span>
									</p>
									<ul class="mt-1.5 space-y-1 text-[12px] text-slate-600">
										<li>
											Materi: {mProg.done}/{mProg.total} ditandai selesai (progres lokal di browser ini).
										</li>
										{#if qStat.total > 0}
											<li>
												Kuis: {qStat.passed}/{qStat.total} lulus (acuan percobaan terakhir, bukan
												nilai terbaik).
											</li>
										{:else}
											<li>Tidak ada kuis di modul ini.</li>
										{/if}
										{#if tStat.total > 0}
											<li>
												Tugas: {tStat.submitted}/{tStat.total} terkumpul · {tStat.graded} ada nilai
												yang terbaca di sisi peserta. Terkumpul ≠ lulus; nilai instruktur belum
												tentu tersinkron ke perangkat ini.
											</li>
										{:else}
											<li>Tidak ada tugas di modul ini.</li>
										{/if}
									</ul>
									{#if knownUnmet}
										<p class="mt-1.5 text-[12px] font-bold text-amber-700">
											Belum memenuhi berdasarkan data tersedia:
											{#if missingMateri > 0}<span>{missingMateri} materi belum selesai.</span>{/if}
											{#if missingKuis > 0}<span>{missingKuis} kuis belum lulus.</span>{/if}
											{#if missingTugas > 0}<span>{missingTugas} tugas belum terkumpul.</span>{/if}
											{#if ungradedTugas > 0}<span>{ungradedTugas} tugas menunggu nilai.</span>{/if}
										</p>
									{:else}
										<p class="mt-1.5 text-[12px] font-bold text-slate-600">
											Belum dapat diverifikasi. Data lokal tampak lengkap, tetapi penerbitan resmi
											membutuhkan validasi server, nilai terbaik kuis, dan status kelulusan tugas
											yang belum tersedia di sini.
										</p>
									{/if}
								</div>
								<div class="space-y-2.5">
									{#each subs as { sub, subIndex, mats } (sub.id)}
										{@const sProg = subModuleProgress(sub, (id) => doneMaterials.has(id))}
										{@const subOpen = searching ? true : openSubs.has(sub.id)}
										{@const subComplete = sProg.done === sProg.total && sProg.total > 0}
										{@const subLocked = isSubModuleLocked(
											course.modules,
											moduleIndex,
											subIndex,
											(id) => doneMaterials.has(id)
										)}
										{@const flat = getModuleMaterials(mod)}
										<div class="overflow-hidden rounded-xl border border-slate-200 bg-white">
											{#if subLocked && !searching}
												<div
													class="flex w-full cursor-not-allowed items-center gap-3 p-3 opacity-70 sm:px-4"
													title="Selesaikan sub-modul sebelumnya untuk membuka"
													aria-label={`Terkunci: Sub-modul ${moduleIndex + 1}.${subIndex + 1}: ${sub.title}`}
												>
													<span
														class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-200 text-[11px] font-extrabold text-slate-400"
														aria-hidden="true"
													>
														<i class="fa-solid fa-lock text-[10px]"></i>
													</span>
													<span class="min-w-0 flex-1">
														<span class="block truncate text-[13px] font-bold text-slate-400">
															{moduleIndex + 1}.{subIndex + 1} · {sub.title}
														</span>
														<span class="block truncate text-[11px] text-slate-400"
															>{sub.description}</span
														>
														<span class="mt-0.5 block text-[11px] font-semibold text-slate-400">
															Terkunci · {sProg.done}/{sProg.total} materi
														</span>
													</span>
												</div>
											{:else}
												<button
													type="button"
													onclick={() => toggleSub(sub.id)}
													aria-expanded={subOpen}
													aria-controls={`sub-panel-${sub.id}`}
													class="flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-violet-50/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-violet-600 sm:px-4"
												>
													<span
														class={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-extrabold ${subComplete ? 'bg-emerald-600 text-white' : 'bg-violet-100 text-violet-700'}`}
														aria-hidden="true"
													>
														{#if subComplete}
															<i class="fa-solid fa-check text-[10px]"></i>
														{:else}
															{subIndex + 1}
														{/if}
													</span>
													<span class="min-w-0 flex-1">
														<span class="block truncate text-[13px] font-bold text-slate-900">
															{moduleIndex + 1}.{subIndex + 1} · {sub.title}
														</span>
														<span class="block truncate text-[11px] text-slate-500"
															>{sub.description}</span
														>
														<span
															class="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] font-semibold {subComplete
																? 'text-emerald-600'
																: 'text-violet-600'}"
														>
															<span>{sProg.done}/{sProg.total} materi</span>
															<span aria-hidden="true" class="text-slate-300">·</span>
															<span class="text-slate-500">{sProg.percent}%</span>
														</span>
													</span>
													<span
														class="hidden h-1.5 w-16 overflow-hidden rounded-full bg-slate-100 sm:block"
														role="progressbar"
														aria-valuenow={sProg.percent}
														aria-valuemin={0}
														aria-valuemax={100}
														aria-label={`Progres sub-modul ${sub.title}`}
													>
														<span
															class={`block h-full rounded-full ${subComplete ? 'bg-emerald-500' : 'bg-violet-500'}`}
															style="width: {sProg.percent}%"
														></span>
													</span>
													<i
														class={`fa-solid fa-chevron-down text-xs text-violet-400 transition-transform duration-300 ${subOpen ? 'rotate-180' : ''}`}
														aria-hidden="true"
													></i>
												</button>
											{/if}

											{#if subOpen && (!subLocked || searching)}
												<div id={`sub-panel-${sub.id}`} class="border-t border-violet-100/70">
													<p class="px-4 pt-2 text-[11px] text-slate-400" aria-hidden="true">
														Modul {moduleIndex + 1} · Sub-modul {subIndex + 1} · {mats.length} materi
													</p>
													{#if mats.length === 0}
														<p class="px-4 py-3 text-xs text-slate-500">
															Tidak ada materi cocok di sub-modul ini.
														</p>
													{:else}
														<ol class="divide-y divide-slate-100">
															{#each mats as mat (mat.id)}
																{@const done = doneMaterials.has(mat.id)}
																{@const flatIndex = flat.findIndex((f) => f.id === mat.id)}
																{@const locked =
																	!searching &&
																	(subLocked ||
																		(flatIndex >= 0 &&
																			isMaterialLocked(flat, flatIndex, (id) =>
																				doneMaterials.has(id)
																			)))}
																<li>
																	<div
																		class={`flex items-center gap-3 px-4 py-2.5 transition-colors sm:px-5 ${done ? 'bg-emerald-50/40' : locked ? 'bg-slate-50/60' : 'hover:bg-slate-50/70'}`}
																	>
																		<span
																			role="img"
																			aria-label={done
																				? `Selesai: ${mat.title}`
																				: `Belum selesai: ${mat.title}. Buka materinya untuk mengerjakan.`}
																			title={done
																				? 'Selesai'
																				: 'Belum selesai — buka materinya untuk mengerjakan'}
																			class={`flex min-h-9 min-w-9 items-center justify-center rounded-full border-2 ${done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 bg-white text-transparent'}`}
																		>
																			<i class="fa-solid fa-check text-xs" aria-hidden="true"></i>
																		</span>
																		{#if locked}
																			<span
																				class="flex min-w-0 flex-1 cursor-not-allowed items-center gap-3 rounded-lg py-1 opacity-70"
																				title="Selesaikan materi sebelumnya untuk membuka"
																				aria-label={`Terkunci: ${mat.title}. Selesaikan materi sebelumnya untuk membuka.`}
																			>
																				<span
																					class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-200"
																				>
																					<i
																						class="fa-solid fa-lock text-xs text-slate-500"
																						aria-hidden="true"
																					></i>
																				</span>
																				<span class="min-w-0 flex-1">
																					<span
																						class="block truncate text-sm font-semibold text-slate-400"
																						>{mat.title}</span
																					>
																					<span class="mt-0.5 block text-[11px] text-slate-400"
																						>{typeLabel(mat.type)} · {mat.duration} · {moduleIndex +
																							1}.{subIndex + 1}</span
																					>
																				</span>
																				<span
																					class="hidden shrink-0 items-center gap-1.5 rounded-full bg-slate-200 px-3 py-1.5 text-[11px] font-bold text-slate-500 sm:inline-flex"
																				>
																					<i class="fa-solid fa-lock text-[10px]" aria-hidden="true"
																					></i> Terkunci
																				</span>
																			</span>
																		{:else}
																			<a
																				href={`/user/kursusku/${course.id}/${mod.id}/${mat.id}`}
																				class="flex min-w-0 flex-1 items-center gap-3 rounded-lg py-1 focus-visible:outline-2 focus-visible:outline-blue-600"
																				aria-label={`Buka materi ${typeLabel(mat.type)}: ${mat.title} (Modul ${moduleIndex + 1}.${subIndex + 1})`}
																			>
																				<span
																					class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100"
																				>
																					<i
																						class={`fa-solid ${typeIcon(mat.type)}`}
																						aria-hidden="true"
																					></i>
																				</span>
																				<span class="min-w-0 flex-1">
																					<span
																						class={`block truncate text-sm font-semibold ${done ? 'text-slate-500' : 'text-slate-800 hover:text-blue-700 hover:underline'}`}
																						>{mat.title}</span
																					>
																					<span class="mt-0.5 block text-[11px] text-slate-500"
																						>{typeLabel(mat.type)} · {mat.duration} · {moduleIndex +
																							1}.{subIndex + 1}</span
																					>
																				</span>
																				<span
																					class="hidden shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold sm:inline-block {mat.type ===
																					'video'
																						? 'bg-blue-600 text-white'
																						: mat.type === 'kuis'
																							? 'bg-amber-100 text-amber-700'
																							: mat.type === 'tugas'
																								? 'bg-violet-100 text-violet-700'
																								: 'bg-emerald-100 text-emerald-700'}"
																				>
																					{actionLabel(mat.type)}
																				</span>
																			</a>
																		{/if}
																	</div>
																</li>
															{/each}
														</ol>
													{/if}
												</div>
											{/if}
										</div>
									{/each}
								</div>
							</div>
						{/if}
					</section>
				{/each}
			</div>
		{/if}

		<!-- Pratinjau alur belajar dengan progresmu -->
		<section aria-labelledby="roadmap-preview-heading" class="mt-6">
			<div class="mb-3">
				<h2 id="roadmap-preview-heading" class="text-lg font-bold text-slate-900">Pratinjau Alur Belajar</h2>
				<p class="text-xs text-slate-500">
					Jalur Modul → Sub-modul dengan progresmu. Klik node untuk info.
					{#if stats} ({stats.estimatedLabel}){/if}
				</p>
			</div>
			<CourseRoadmap modules={course.modules} courseId={course.id} />
		</section>

		<!-- CTA bawah -->
		<div
			class="mt-6 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between"
		>
			<div>
				<p class="text-sm font-bold text-slate-900">
					Selesaikan semua {stats.moduleCount} modul · {stats.subModuleCount} sub-modul untuk membuka
					sertifikat
				</p>
				<p class="text-xs text-slate-500">
					Progres tersimpan otomatis setiap kamu menandai materi selesai.
				</p>
			</div>
			<div class="flex gap-2">
				<a
					href="/user/kursusku"
					class="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-slate-500"
				>
					<i class="fa-solid fa-arrow-left" aria-hidden="true"></i> Kursusku
				</a>
				<a
					href="/user/sertifikat"
					class="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-emerald-600"
				>
					<i class="fa-solid fa-award" aria-hidden="true"></i> Sertifikat
				</a>
			</div>
		</div>
	{/if}
</div>
