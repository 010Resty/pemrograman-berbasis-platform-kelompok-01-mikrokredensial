<script lang="ts">
	import { page } from '$app/state';
	import { SvelteSet } from 'svelte/reactivity';
	import {
		getCourseById,
		getModuleMaterials,
		isMaterialLocked,
		isModuleLocked,
		isSubModuleLocked
	} from '$lib/data/courses';
	import { resolveSubModules } from '$lib/data/training';
	import { doneMaterials, ensureSeeded, markDone } from '$lib/stores/progress.svelte';
	import { getCourseMeta } from '$lib/data/course-meta';
	import { canAccessCourse, isPeriodLocked } from '$lib/stores/enrollment.svelte';
	import { resolve } from '$app/paths';
	import MaterialRenderer from '$lib/components/materials/MaterialRenderer.svelte';

	const courseId = $derived(Number(page.params.courseId));
	const course = $derived(getCourseById(courseId));
	const paidLocked = $derived(course ? !canAccessCourse(course.id) : false);
	const periodLocked = $derived(course ? !paidLocked && isPeriodLocked(course.id) : false);
	const paidPrice = $derived(course ? getCourseMeta(course.id).price : '');
	const startMonth = $derived(course ? (getCourseMeta(course.id).startMonth ?? '') : '');
	const module = $derived(course?.modules.find((m) => m.id === page.params.moduleId));
	const moduleIndex = $derived(
		course?.modules.findIndex((m) => m.id === page.params.moduleId) ?? -1
	);

	// Flatten materi modul (urut antar sub-modul) — sumber kebenaran urutan belajar.
	const flat = $derived(module ? getModuleMaterials(module) : []);
	const matIndex = $derived(flat.findIndex((m) => m.id === page.params.materialId));
	const material = $derived(matIndex >= 0 ? flat[matIndex] : undefined);

	const subs = $derived(module ? resolveSubModules(module) : []);
	const currentSubInfo = $derived.by(() => {
		if (!module) return { sub: null as null | (typeof subs)[number], subIndex: -1 };
		for (let i = 0; i < subs.length; i++) {
			if (subs[i].materials.some((m) => m.id === page.params.materialId)) {
				return { sub: subs[i], subIndex: i };
			}
		}
		return { sub: null as null | (typeof subs)[number], subIndex: -1 };
	});

	const prev = $derived(matIndex > 0 ? flat[matIndex - 1] : undefined);
	const next = $derived(
		matIndex >= 0 && matIndex < flat.length - 1 ? flat[matIndex + 1] : undefined
	);

	/** Modul saat ini terkunci bila ada materi di modul sebelumnya yang belum selesai */
	const moduleLocked = $derived(
		!course || moduleIndex < 0
			? false
			: isModuleLocked(course.modules, moduleIndex, (id) => doneMaterials.has(id))
	);

	const subLocked = $derived(
		!course || !module || currentSubInfo.subIndex < 0
			? false
			: isSubModuleLocked(course.modules, moduleIndex, currentSubInfo.subIndex, (id) =>
					doneMaterials.has(id)
				)
	);

	/** Materi saat ini terkunci bila modul/sub terkunci atau ada materi sebelumnya yang belum selesai */
	const locked = $derived(
		matIndex < 0
			? false
			: moduleLocked || subLocked || isMaterialLocked(flat, matIndex, (id) => doneMaterials.has(id))
	);

	/** Materi berikutnya terkunci? (untuk tombol navigasi) */
	const nextLocked = $derived(
		!next ? false : isMaterialLocked(flat, matIndex + 1, (id) => doneMaterials.has(id))
	);

	/** Modul setelah modul saat ini (untuk tombol lanjut di akhir modul) */
	const nextModule = $derived(
		course && moduleIndex >= 0 && moduleIndex < course.modules.length - 1
			? course.modules[moduleIndex + 1]
			: undefined
	);
	const nextModuleFirst = $derived(nextModule ? getModuleMaterials(nextModule)[0] : undefined);

	/** Materi pertama yang belum selesai dalam modul ini */
	const firstUnfinished = $derived(flat.find((m) => !doneMaterials.has(m.id)));

	// Sinkron status awal dari data (sekali per kursus)
	$effect(() => {
		if (course) ensureSeeded(course);
	});

	// Sidebar hierarki: modul terbuka + sub terbuka mengikuti posisi saat ini
	let sidebarOpenModules = new SvelteSet<string>();
	let sidebarOpenSubs = new SvelteSet<string>();
	$effect(() => {
		const mid = page.params.moduleId;
		const matId = page.params.materialId;
		if (mid && !sidebarOpenModules.has(mid)) {
			// Jangan hapus pilihan user lain; pastikan modul aktif terbuka
			sidebarOpenModules.add(mid);
		}
		if (course && mid && matId) {
			const mod = course.modules.find((m) => m.id === mid);
			if (mod) {
				for (const s of resolveSubModules(mod)) {
					if (s.materials.some((m) => m.id === matId)) {
						sidebarOpenSubs.add(s.id);
						break;
					}
				}
			}
		}
	});

	/** Panel daftar modul di sidebar (khusus layar kecil) */
	let showModules = $state(false);

	/** Sidebar modul diciutkan (layar besar) agar materi tampil penuh */
	let modulesCollapsed = $state(false);

	/** Lacak breakpoint desktop agar satu ikon panah bisa adaptif */
	let isDesktop = $state(false);

	$effect(() => {
		const mq = window.matchMedia('(min-width: 1024px)');
		const update = () => (isDesktop = mq.matches);
		update();
		mq.addEventListener('change', update);
		return () => mq.removeEventListener('change', update);
	});

	/** Satu ikon panah: bawah (mobile) / kanan-kiri (desktop) */
	const toggleIcon = $derived(
		isDesktop
			? modulesCollapsed
				? 'fa-angles-right'
				: 'fa-angles-left'
			: showModules
				? 'fa-chevron-up'
				: 'fa-chevron-down'
	);

	const toggleLabel = $derived(
		isDesktop
			? modulesCollapsed
				? 'Tampilkan daftar modul'
				: 'Sembunyikan daftar modul'
			: showModules
				? 'Tutup daftar modul'
				: 'Buka daftar modul'
	);

	function toggleModuleNav() {
		if (typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches) {
			modulesCollapsed = !modulesCollapsed;
		} else {
			showModules = !showModules;
		}
	}

	function openModuleNav() {
		modulesCollapsed = false;
	}

	function toggleSidebarModule(id: string) {
		if (sidebarOpenModules.has(id)) sidebarOpenModules.delete(id);
		else sidebarOpenModules.add(id);
	}

	function toggleSidebarSub(id: string) {
		if (sidebarOpenSubs.has(id)) sidebarOpenSubs.delete(id);
		else sidebarOpenSubs.add(id);
	}

	const totalMats = $derived(
		course?.modules.reduce((n, m) => n + getModuleMaterials(m).length, 0) ?? 0
	);
	const totalSubs = $derived(
		course?.modules.reduce((n, m) => n + resolveSubModules(m).length, 0) ?? 0
	);

	function typeBadge(type: string): string {
		if (type === 'video') return 'bg-blue-600 text-white';
		if (type === 'audio') return 'bg-cyan-600 text-white';
		if (type === 'foto') return 'bg-slate-700 text-white';
		if (type === 'kuis') return 'bg-amber-500 text-white';
		if (type === 'tugas') return 'bg-violet-600 text-white';
		return 'bg-emerald-600 text-white';
	}

	function typeIcon(type: string): string {
		if (type === 'video') return 'fa-circle-play';
		if (type === 'audio') return 'fa-headphones';
		if (type === 'foto') return 'fa-image';
		if (type === 'kuis') return 'fa-circle-question';
		if (type === 'tugas') return 'fa-pen-to-square';
		return 'fa-book-open';
	}

	function typeLabel(type: string): string {
		if (type === 'video') return 'Video';
		if (type === 'audio') return 'Audio';
		if (type === 'foto') return 'Foto';
		if (type === 'kuis') return 'Kuis';
		if (type === 'tugas') return 'Penugasan';
		return 'Bacaan';
	}
</script>

<svelte:head>
	<title>
		{material && course ? `${material.title} — ${course.title}` : 'Materi tidak ditemukan'} — Aristoteles
	</title>
	<meta
		name="description"
		content={material ? `Materi pembelajaran: ${material.title}` : 'Detail materi kursus'}
	/>
</svelte:head>

<div class="min-h-screen">
	{#if !course || !module || !material}
		<div class="mx-auto max-w-lg p-4 sm:p-6">
			<div class="rounded-2xl border border-slate-200 bg-white p-10 text-center">
				<i class="fa-solid fa-triangle-exclamation mb-3 text-3xl text-amber-500" aria-hidden="true"
				></i>
				<h1 class="text-xl font-bold text-slate-900">Materi tidak ditemukan</h1>
				<p class="mt-1 text-sm text-slate-500">
					Tautan materi ini tidak valid atau sudah dipindahkan.
				</p>
				<a
					href="/user/kursusku"
					class="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-blue-700"
				>
					<i class="fa-solid fa-arrow-left" aria-hidden="true"></i> Kembali ke Kursusku
				</a>
			</div>
		</div>
	{:else if paidLocked && course}
		<div class="mx-auto max-w-lg p-4 sm:p-6">
			<div
				class="overflow-hidden rounded-2xl border border-slate-200 bg-white text-center shadow-xl"
			>
				<div class="bg-slate-900 px-6 py-8 text-white">
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
					<p class="mt-2 text-3xl font-black">{paidPrice}</p>
					<p class="mt-1 text-xs text-slate-300">Bayar untuk membuka seluruh materi course ini.</p>
				</div>
				<div class="space-y-2 p-6">
					<a
						href={resolve(`/user/pembayaran/${course.id}`)}
						class="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/25 transition-all hover:bg-blue-700 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-blue-600"
					>
						<i class="fa-solid fa-credit-card" aria-hidden="true"></i>
						Lanjut ke Pembayaran · {paidPrice}
					</a>
					<a
						href={`/user/kursusku/${course.id}`}
						class="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
					>
						<i class="fa-solid fa-arrow-left" aria-hidden="true"></i> Kembali
					</a>
				</div>
			</div>
		</div>
	{:else if periodLocked && course}
		<div class="mx-auto max-w-lg p-4 sm:p-6">
			<div
				class="overflow-hidden rounded-2xl border border-slate-200 bg-white text-center shadow-xl"
			>
				<div class="bg-slate-900 px-6 py-8 text-white">
					<span
						class="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10"
						aria-hidden="true"
					>
						<i class="fa-solid fa-calendar-clock text-2xl text-amber-300"></i>
					</span>
					<p class="mt-4 text-[11px] font-extrabold tracking-[0.16em] text-blue-200 uppercase">
						Batch Belum Mulai
					</p>
					<h1 class="mt-1 text-xl font-extrabold">{course.title}</h1>
					<p class="mt-2 text-2xl font-black">Mulai {startMonth || 'segera'}</p>
					<p class="mt-1 text-xs text-slate-300">
						Materi terkunci sampai periode berjalan, walau kamu sudah terdaftar.
					</p>
				</div>
				<div class="space-y-2 p-6">
					<span
						aria-disabled="true"
						class="flex min-h-12 w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-slate-200 px-5 py-3 text-sm font-bold text-slate-500"
					>
						<i class="fa-solid fa-lock" aria-hidden="true"></i>
						Materi Terkunci
					</span>
					<a
						href={`/user/kursusku/${course.id}`}
						class="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600"
					>
						<i class="fa-solid fa-arrow-left" aria-hidden="true"></i> Kembali ke detail kursus
					</a>
				</div>
			</div>
		</div>
	{:else}
		<!-- Top bar ramping pengganti header utama -->
		<div class="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
			<div class="flex h-14 items-center gap-3 px-4 sm:px-6">
				<a
					href={`/user/kursusku/${course.id}`}
					class="hidden min-h-10 min-w-10 items-center justify-center rounded-xl p-2 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-blue-600 sm:flex"
					aria-label={`Kembali ke modul ${course.title}`}
				>
					<i class="fa-solid fa-arrow-left" aria-hidden="true"></i>
				</a>
				<span class="hidden h-6 w-px bg-slate-200 sm:block" aria-hidden="true"></span>
				<div class="min-w-0 flex-1">
					<p class="truncate text-sm font-bold text-slate-900">{course.title}</p>
					<p class="truncate text-[11px] text-slate-500">
						Modul {(moduleIndex ?? 0) + 1}
						{#if currentSubInfo.sub}
							· Sub-modul {(moduleIndex ?? 0) + 1}.{currentSubInfo.subIndex + 1}
							{currentSubInfo.sub.title}
						{/if}
						· Materi {matIndex + 1} dari {flat.length} (modul ini)
					</p>
				</div>
				<a
					href="/user"
					class="hidden items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600 sm:inline-flex"
				>
					<i class="fa-solid fa-house" aria-hidden="true"></i> Dashboard
				</a>
			</div>
		</div>

		<div class="p-4 sm:p-6">
			<nav
				aria-label="Breadcrumb"
				class="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500"
			>
				<a
					href="/user/kursusku"
					class="rounded font-semibold text-blue-600 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
				>
					Kursusku
				</a>
				<i class="fa-solid fa-chevron-right text-[10px] text-slate-300" aria-hidden="true"></i>
				<a
					href={`/user/kursusku/${course.id}`}
					class="max-w-40 truncate rounded font-semibold text-blue-600 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
				>
					{course.title}
				</a>
				<i class="fa-solid fa-chevron-right text-[10px] text-slate-300" aria-hidden="true"></i>
				<a
					href={`/user/kursusku/${course.id}`}
					class="rounded font-medium text-slate-600 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-blue-600"
				>
					Modul {(moduleIndex ?? 0) + 1}: {module.title}
				</a>
				{#if currentSubInfo.sub}
					<i class="fa-solid fa-chevron-right text-[10px] text-slate-300" aria-hidden="true"></i>
					<span class="max-w-40 truncate rounded font-medium text-slate-600">
						Sub-modul {(moduleIndex ?? 0) + 1}.{currentSubInfo.subIndex + 1}
					</span>
				{/if}
				<i class="fa-solid fa-chevron-right text-[10px] text-slate-300" aria-hidden="true"></i>
				<span aria-current="page" class="max-w-48 truncate font-medium text-slate-700"
					>{material.title}</span
				>
			</nav>

			<div
				class="mt-4 grid grid-cols-1 items-start gap-6 transition-[grid-template-columns] duration-300 ease-in-out motion-reduce:transition-none lg:grid-cols-[var(--nav-w)_minmax(0,1fr)]"
				style:--nav-w={modulesCollapsed ? '3.5rem' : '20rem'}
			>
				<aside
					id="modul-nav"
					aria-label="Daftar modul, sub-modul, dan materi kursus"
					class={`relative overflow-hidden rounded-2xl ${modulesCollapsed ? 'border-transparent bg-transparent' : 'border border-slate-200/70 bg-white'} lg:sticky lg:top-[72px] lg:block lg:max-h-[calc(100vh-6rem)]`}
				>
					<!-- Satu kotak panah saat sidebar diciutkan -->
					<div
						class={`flex justify-center transition-all delay-100 duration-300 motion-reduce:transition-none ${modulesCollapsed ? 'visible opacity-100' : 'pointer-events-none invisible h-0 opacity-0'}`}
					>
						<button
							type="button"
							onclick={openModuleNav}
							aria-expanded={!modulesCollapsed}
							aria-controls="modul-nav"
							aria-label="Tampilkan daftar modul"
							title="Tampilkan daftar modul"
							tabindex={modulesCollapsed ? undefined : -1}
							class="flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-slate-200 bg-white p-2 text-slate-600 shadow-sm transition-colors hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
						>
							<i class="fa-solid fa-angles-right text-base" aria-hidden="true"></i>
						</button>
					</div>
					<!-- Panel penuh -->
					<div
						class={`w-80 max-lg:max-w-full transition-all duration-300 ease-in-out motion-reduce:transition-none ${modulesCollapsed ? 'pointer-events-none invisible -translate-x-4 opacity-0' : 'visible translate-x-0 opacity-100'} lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto`}
					>
						<div
							class="flex items-center justify-between gap-6 border-b border-slate-100 py-4 pr-0 pl-4 lg:gap-4 lg:p-4"
						>
							<div class="min-w-0">
								<p class="mt-1 line-clamp-2 text-sm font-bold text-slate-900">{course.title}</p>
								<p class="mt-0.5 text-[11px] text-slate-500">
									{course.modules.length} modul · {totalSubs} sub-modul · {totalMats} materi
								</p>
							</div>
							<button
								type="button"
								onclick={toggleModuleNav}
								aria-expanded={isDesktop ? !modulesCollapsed : showModules}
								aria-controls="modul-nav"
								aria-label={toggleLabel}
								title={toggleLabel}
								class="flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-blue-600"
							>
								<i class={`fa-solid ${toggleIcon} text-base`} aria-hidden="true"></i>
							</button>
						</div>
						<div class={`${showModules ? 'block' : 'hidden'} lg:block`}>
							<nav
								aria-label="Modul, sub-modul, dan materi"
								class="max-h-[60vh] overflow-y-auto p-2 lg:max-h-none lg:overflow-visible"
							>
								{#each course.modules as mod, mi (mod.id)}
									{@const isCurrentModule = mod.id === module.id}
									{@const modLocked =
										!isCurrentModule &&
										isModuleLocked(course.modules, mi, (id) => doneMaterials.has(id))}
									{@const modFlat = getModuleMaterials(mod)}
									{@const modSubs = resolveSubModules(mod)}
									{@const modOpen = sidebarOpenModules.has(mod.id)}
									<section aria-label={`Modul ${mi + 1}: ${mod.title}`} class="mb-1">
										<button
											type="button"
											onclick={() => toggleSidebarModule(mod.id)}
											aria-expanded={modOpen}
											class={`flex w-full items-center gap-1.5 rounded-xl px-3 pt-3 pb-1 text-left focus-visible:outline-2 focus-visible:outline-blue-600 ${isCurrentModule ? 'text-blue-700' : 'text-slate-400 hover:text-slate-600'}`}
										>
											{#if modLocked}<i class="fa-solid fa-lock text-[9px]" aria-hidden="true"
												></i>{/if}
											<span
												class="min-w-0 flex-1 truncate text-[11px] font-extrabold tracking-wide uppercase"
											>
												Modul {mi + 1}: {mod.title} · {modFlat.length} materi
											</span>
											<i
												class={`fa-solid fa-chevron-down text-[9px] transition-transform ${modOpen ? 'rotate-180' : ''}`}
												aria-hidden="true"
											></i>
										</button>
										{#if modOpen}
											<div class="space-y-1.5 px-1 pt-1 pb-2">
												{#each modSubs as sub, si (sub.id)}
													{@const isCurrentSub =
														isCurrentModule && sub.id === currentSubInfo.sub?.id}
													{@const sLocked = isSubModuleLocked(course.modules, mi, si, (id) =>
														doneMaterials.has(id)
													)}
													{@const sOpen = sidebarOpenSubs.has(sub.id)}
													<div
														class={`overflow-hidden rounded-xl border ${isCurrentSub ? 'border-blue-200 bg-blue-50/40' : 'border-slate-100 bg-slate-50/50'}`}
													>
														<button
															type="button"
															onclick={() => toggleSidebarSub(sub.id)}
															aria-expanded={sOpen}
															class="flex w-full items-center gap-2 px-2.5 py-2 text-left focus-visible:outline-2 focus-visible:outline-blue-600"
														>
															{#if sLocked && !isCurrentSub}
																<i
																	class="fa-solid fa-lock text-[9px] text-slate-400"
																	aria-hidden="true"
																></i>
															{:else}
																<span
																	class={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[10px] font-extrabold ${isCurrentSub ? 'bg-blue-600 text-white' : 'bg-violet-100 text-violet-700'}`}
																	aria-hidden="true"
																>
																	{si + 1}
																</span>
															{/if}
															<span
																class="min-w-0 flex-1 truncate text-[12px] font-bold {isCurrentSub
																	? 'text-blue-800'
																	: 'text-slate-600'}"
															>
																{mi + 1}.{si + 1}
																{sub.title}
															</span>
															<span class="shrink-0 text-[10px] font-bold text-slate-400"
																>{sub.materials.length}</span
															>
														</button>
														{#if sOpen}
															<ol
																class="space-y-0.5 border-t border-slate-100 bg-white px-1.5 py-1.5"
															>
																{#each sub.materials as mat (mat.id)}
																	{@const flatIdx = modFlat.findIndex((f) => f.id === mat.id)}
																	{@const isCurrent = mat.id === material.id}
																	{@const matDone = doneMaterials.has(mat.id)}
																	{@const lockedItem =
																		modLocked ||
																		sLocked ||
																		isMaterialLocked(modFlat, flatIdx, (id) =>
																			doneMaterials.has(id)
																		)}
																	<li>
																		{#if lockedItem && !isCurrent}
																			<span
																				class="flex cursor-not-allowed items-center gap-2 rounded-lg px-2 py-1.5 opacity-60"
																				title="Selesaikan materi sebelumnya untuk membuka"
																				aria-label={`Terkunci: ${mat.title}`}
																			>
																				<span
																					class="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-slate-200 text-slate-400"
																					aria-hidden="true"
																				>
																					<i class="fa-solid fa-lock text-[8px]"></i>
																				</span>
																				<span
																					class="min-w-0 flex-1 truncate text-[13px] text-slate-400"
																					>{mat.title}</span
																				>
																			</span>
																		{:else}
																			<a
																				href={`/user/kursusku/${course.id}/${mod.id}/${mat.id}`}
																				aria-current={isCurrent ? 'page' : undefined}
																				class={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-blue-600 ${
																					isCurrent
																						? 'bg-blue-600 font-bold text-white shadow-md shadow-blue-600/25'
																						: 'text-slate-600 hover:bg-blue-50 hover:text-blue-700'
																				}`}
																			>
																				<span
																					class={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[10px] font-extrabold ${
																						isCurrent
																							? 'bg-white/20 text-white'
																							: matDone
																								? 'bg-emerald-100 text-emerald-700'
																								: 'bg-slate-100 text-slate-500'
																					}`}
																					aria-hidden="true"
																				>
																					{#if isCurrent}
																						<i class="fa-solid fa-play text-[8px]"></i>
																					{:else if matDone}
																						<i class="fa-solid fa-check text-[8px]"></i>
																					{:else}
																						{flatIdx + 1}
																					{/if}
																				</span>
																				<span class="min-w-0 flex-1 truncate text-[13px]"
																					>{mat.title}</span
																				>
																			</a>
																		{/if}
																	</li>
																{/each}
															</ol>
														{/if}
													</div>
												{/each}
											</div>
										{/if}
									</section>
								{/each}
							</nav>
						</div>
					</div>
				</aside>

				<div class={`mx-auto w-full min-w-0 ${modulesCollapsed ? 'max-w-5xl' : 'max-w-4xl'}`}>
					<header class="mb-5 rounded-2xl border border-slate-200/70 bg-white p-5 sm:p-6">
						<div class="flex flex-wrap items-center gap-2">
							<span
								class={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold ${typeBadge(material.type)}`}
							>
								<i class={`fa-solid ${typeIcon(material.type)}`} aria-hidden="true"></i>
								{typeLabel(material.type)}
							</span>
							<span
								class="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-600"
							>
								<i class="fa-regular fa-clock" aria-hidden="true"></i>
								{material.duration}
							</span>
							<span
								class="inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-3 py-1 text-[11px] font-semibold text-violet-700"
							>
								Modul {moduleIndex + 1}
								{#if currentSubInfo.sub}
									· Sub {moduleIndex + 1}.{currentSubInfo.subIndex + 1}
								{/if}
								· Materi {matIndex + 1}/{flat.length}
							</span>
						</div>
						<h1 class="mt-3 text-xl leading-snug font-extrabold text-slate-900 sm:text-2xl">
							{material.title}
						</h1>
						<p class="mt-1 text-xs text-slate-500 sm:text-sm">
							{course.title} · Modul {(moduleIndex ?? 0) + 1}: {module.title}
							{#if currentSubInfo.sub}
								· Sub-modul {(moduleIndex ?? 0) + 1}.{currentSubInfo.subIndex + 1}: {currentSubInfo
									.sub.title}
							{/if}
						</p>
					</header>

					<article
						aria-label={`Isi materi: ${material.title}`}
						class="rounded-2xl border border-slate-200/70 bg-white p-5 sm:p-6"
					>
						{#if locked}
							<div class="py-6 text-center">
								<span
									class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100"
									aria-hidden="true"
								>
									<i class="fa-solid fa-lock text-2xl text-slate-400"></i>
								</span>
								<h2 class="text-lg font-extrabold text-slate-900">Materi Terkunci</h2>
								{#if moduleLocked}
									<p class="mx-auto mt-1 max-w-md text-sm text-slate-500">
										Selesaikan <strong class="text-slate-700">Modul {moduleIndex}</strong> terlebih dahulu
										untuk membuka modul ini.
									</p>
									<a
										href={`/user/kursusku/${course.id}`}
										class="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-blue-600/25 transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
									>
										<i class="fa-solid fa-arrow-left" aria-hidden="true"></i>
										Kembali ke Daftar Modul
									</a>
								{:else}
									<p class="mx-auto mt-1 max-w-md text-sm text-slate-500">
										Selesaikan materi sebelumnya dalam
										{#if currentSubInfo.sub}
											sub-modul <strong class="text-slate-700">“{currentSubInfo.sub.title}”</strong>
										{:else}
											modul ini
										{/if}
										untuk membuka
										<strong class="text-slate-700">“{material.title}”</strong>.
									</p>
									{#if firstUnfinished}
										<a
											href={`/user/kursusku/${course.id}/${module.id}/${firstUnfinished.id}`}
											class="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-blue-600/25 transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
										>
											<i class="fa-solid fa-play" aria-hidden="true"></i>
											Kerjakan: {firstUnfinished.title}
										</a>
									{/if}
								{/if}
							</div>
						{:else}
							{#key material.id}
								<MaterialRenderer
									{material}
									{course}
									moduleTitle={module.title}
									moduleId={module.id}
									onComplete={markDone}
								/>
							{/key}
						{/if}
					</article>

					<nav aria-label="Navigasi materi" class="mt-5 grid grid-cols-2 gap-3">
						{#if prev}
							<a
								href={`/user/kursusku/${course.id}/${module.id}/${prev.id}`}
								class="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-blue-600"
							>
								<i
									class="fa-solid fa-arrow-left shrink-0 text-slate-400 transition-transform group-hover:-translate-x-0.5"
									aria-hidden="true"
								></i>
								<span class="min-w-0">
									<span class="block text-[10px] font-bold tracking-wide text-slate-400 uppercase"
										>Sebelumnya</span
									>
									<span class="block truncate text-sm font-bold text-slate-800">{prev.title}</span>
								</span>
							</a>
						{:else}
							<span></span>
						{/if}
						{#if next}
							<a
								href={`/user/kursusku/${course.id}/${module.id}/${next.id}`}
								onclick={() => markDone(material.id)}
								class="group flex items-center justify-end gap-3 rounded-2xl bg-blue-600 p-4 text-right text-white shadow-lg shadow-blue-600/25 transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
								aria-label={nextLocked
									? `Lanjutkan dan buka: ${next.title}`
									: `Lanjut ke: ${next.title}`}
							>
								<span class="min-w-0">
									<span class="block text-[10px] font-bold tracking-wide text-blue-200 uppercase">
										{nextLocked ? 'Buka materi' : 'Berikutnya'}
									</span>
									<span class="block truncate text-sm font-bold">{next.title}</span>
								</span>
								<i
									class={`fa-solid ${nextLocked ? 'fa-lock-open' : 'fa-arrow-right'} shrink-0 transition-transform group-hover:translate-x-0.5`}
									aria-hidden="true"
								></i>
							</a>
						{:else if nextModule && nextModuleFirst}
							<a
								href={`/user/kursusku/${course.id}/${nextModule.id}/${nextModuleFirst.id}`}
								onclick={() => markDone(material.id)}
								class="group flex items-center justify-end gap-3 rounded-2xl bg-indigo-600 p-4 text-right text-white shadow-lg shadow-indigo-600/25 transition-colors hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-indigo-600"
								aria-label={`Lanjut ke Modul ${(moduleIndex ?? 0) + 2}: ${nextModuleFirst.title}`}
							>
								<span class="min-w-0">
									<span class="block text-[10px] font-bold tracking-wide text-indigo-200 uppercase"
										>Lanjut Modul {(moduleIndex ?? 0) + 2}</span
									>
									<span class="block truncate text-sm font-bold">{nextModuleFirst.title}</span>
								</span>
								<i
									class="fa-solid fa-forward shrink-0 transition-transform group-hover:translate-x-0.5"
									aria-hidden="true"
								></i>
							</a>
						{:else}
							<a
								href={`/user/kursusku/${course.id}`}
								onclick={() => markDone(material.id)}
								class="flex items-center justify-end gap-3 rounded-2xl bg-emerald-600 p-4 text-right text-white shadow-lg shadow-emerald-600/25 transition-colors hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-emerald-600"
							>
								<span class="min-w-0">
									<span class="block text-[10px] font-bold tracking-wide text-emerald-200 uppercase"
										>Selesai</span
									>
									<span class="block truncate text-sm font-bold">Kembali ke Modul</span>
								</span>
								<i class="fa-solid fa-check shrink-0" aria-hidden="true"></i>
							</a>
						{/if}
					</nav>
				</div>
			</div>
		</div>
	{/if}
</div>
