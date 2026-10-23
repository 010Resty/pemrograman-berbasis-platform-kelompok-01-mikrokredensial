<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import type { CourseModule, SubModule } from '$lib/data/courses';
	import { resolveSubModules } from '$lib/data/training';
	import WarningModal from '$lib/components/WarningModal.svelte';

	/**
	 * LearningPathManager — kelola kurikulum sebagai jalur belajar (learning path).
	 * Modul = patch besar di sumbu utama, Sub-modul = patch cabang.
	 * Tambah / hapus / sisip / urutkan modul & sub-modul langsung dari visual path.
	 * `subModules` adalah sumber kebenaran; `materials` flat selalu disinkronkan.
	 */
	let {
		modules = $bindable([]),
		onnotice = (_msg: string) => {},
		moduleHref,
		subHref
	}: {
		modules: CourseModule[];
		onnotice?: (msg: string) => void;
		/** Bila diisi, judul modul menjadi tautan ke halaman kelola sub-modulnya. */
		moduleHref?: (mod: CourseModule, index: number) => string;
		/** Bila diisi, judul sub-modul menjadi tautan ke halaman kelola materinya. */
		subHref?: (mod: CourseModule, sub: SubModule, moduleIndex: number, subIndex: number) => string;
	} = $props();

	const uid = (prefix: string) =>
		`${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4)}`;

	const subsOf = (mod: CourseModule): SubModule[] => resolveSubModules(mod);
	const syncFlat = (mod: CourseModule): CourseModule => ({
		...mod,
		materials: subsOf(mod).flatMap((s) => s.materials)
	});

	/** Patch mana yang sedang dibuka detailnya (mode baca) vs edit inline. */
	let openPatches = new SvelteSet<string>();
	/** Hapus yang menunggu konfirmasi modal (pengganti konfirmasi dua-tahap). */
	let pendingDelete = $state<{
		scope: 'module' | 'sub';
		moduleId: string;
		subId?: string;
		title: string;
		message: string;
	} | null>(null);
	let showDelete = $state(false);

	function togglePatch(id: string) {
		if (openPatches.has(id)) openPatches.delete(id);
		else openPatches.add(id);
	}

	function announce(msg: string) {
		onnotice(msg);
	}

	function addModule(atIndex?: number) {
		const id = uid('mod');
		const subId = uid('sub');
		const next: CourseModule = {
			id,
			title: `Modul Baru ${modules.length + 1}`,
			description: 'Deskripsi singkat modul baru — klik untuk sunting.',
			materials: [],
			subModules: [{ id: subId, title: 'Sub-modul 1', description: '', materials: [] }]
		};
		if (atIndex === undefined || atIndex < 0 || atIndex > modules.length) {
			modules = [...modules, next];
		} else {
			modules = [...modules.slice(0, atIndex), next, ...modules.slice(atIndex)];
		}
		openPatches.add(id);
		pendingDelete = null;
		announce(
			atIndex === undefined ? `Modul ${modules.length} ditambahkan ke ujung jalur.` : `Modul baru disisipkan di posisi ${atIndex + 1}.`
		);
	}

	function removeModule(id: string) {
		const idx = modules.findIndex((m) => m.id === id);
		modules = modules.filter((m) => m.id !== id);
		openPatches.delete(id);
		announce(idx >= 0 ? `Modul ${idx + 1} dihapus dari jalur.` : 'Modul dihapus dari jalur.');
	}

	function askDeleteModule(mod: CourseModule, mi: number) {
		const subs = subsOf(mod);
		const mats = subs.reduce((n, s) => n + s.materials.length, 0);
		pendingDelete = {
			scope: 'module',
			moduleId: mod.id,
			title: `Hapus Modul ${mi + 1}?`,
			message: `“${mod.title || '(belum berjudul)'}” beserta ${subs.length} sub-modul dan ${mats} materi di dalamnya akan dihapus dari draf. Tindakan ini tidak bisa dibatalkan.`
		};
		showDelete = true;
	}

	function moveModule(id: string, dir: -1 | 1) {
		const idx = modules.findIndex((m) => m.id === id);
		const target = idx + dir;
		if (idx < 0 || target < 0 || target >= modules.length) return;
		const next = [...modules];
		[next[idx], next[target]] = [next[target], next[idx]];
		modules = next;
		announce(`Modul dipindah ke posisi ${target + 1}.`);
	}

	function addSubModule(moduleId: string) {
		modules = modules.map((m) => {
			if (m.id !== moduleId) return m;
			const subs = subsOf(m);
			const sub: SubModule = {
				id: uid('sub'),
				title: `Sub-modul ${subs.length + 1}`,
				description: '',
				materials: []
			};
			return syncFlat({ ...m, subModules: [...subs, sub] });
		});
		announce('Sub-modul baru ditambahkan ke patch modul.');
	}

	function removeSubModule(moduleId: string, subId: string) {
		modules = modules.map((m) => {
			if (m.id !== moduleId) return m;
			const subs = subsOf(m);
			if (subs.length <= 1) return m;
			return syncFlat({ ...m, subModules: subs.filter((s) => s.id !== subId) });
		});
		openPatches.delete(subId);
		announce('Sub-modul dihapus dari jalur.');
	}

	function askDeleteSub(mod: CourseModule, sub: SubModule, mi: number, si: number) {
		pendingDelete = {
			scope: 'sub',
			moduleId: mod.id,
			subId: sub.id,
			title: `Hapus Sub-modul ${mi + 1}.${si + 1}?`,
			message: `“${sub.title || '(belum berjudul)'}” beserta ${sub.materials.length} materi di dalamnya akan dihapus dari draf. Tindakan ini tidak bisa dibatalkan.`
		};
		showDelete = true;
	}

	function cancelDelete() {
		pendingDelete = null;
	}

	function executeDelete() {
		const target = pendingDelete;
		pendingDelete = null;
		showDelete = false;
		if (!target) return;
		if (target.scope === 'module') removeModule(target.moduleId);
		else if (target.subId) removeSubModule(target.moduleId, target.subId);
	}

	function duplicateSubModule(moduleId: string, subId: string) {
		modules = modules.map((m) => {
			if (m.id !== moduleId) return m;
			const subs = subsOf(m);
			const src = subs.find((s) => s.id === subId);
			if (!src) return m;
			const copy: SubModule = {
				...structuredClone(src),
				id: uid('sub'),
				title: `${src.title} (salinan)`,
				materials: []
			};
			const at = subs.findIndex((s) => s.id === subId) + 1;
			return syncFlat({
				...m,
				subModules: [...subs.slice(0, at), copy, ...subs.slice(at)]
			});
		});
		announce('Sub-modul diduplikasi (materi tidak ikut disalin).');
	}

	const totalSubs = $derived(modules.reduce((n, m) => n + subsOf(m).length, 0));
	const totalMats = $derived(modules.reduce((n, m) => n + subsOf(m).reduce((a, s) => a + s.materials.length, 0), 0));
</script>

<div class="overflow-hidden rounded-3xl border border-slate-200/70 bg-white shadow-lg shadow-slate-900/5">
	<!-- Header jalur -->
	<div class="relative overflow-hidden bg-slate-900 p-5 sm:px-7 sm:py-6">
		<div
			class="pointer-events-none absolute -top-16 -right-10 h-48 w-48 rounded-full bg-blue-500/20 blur-2xl"
			aria-hidden="true"
		></div>
		<div
			class="pointer-events-none absolute -bottom-20 left-1/3 h-48 w-64 rounded-full bg-cyan-400/20 blur-2xl"
			aria-hidden="true"
		></div>
		<div
			class="pointer-events-none absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-blue-600 via-cyan-400 to-blue-600"
			aria-hidden="true"
		></div>
		<div class="relative flex flex-wrap items-end justify-between gap-3">
			<div>
				<p
					class="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[10px] font-extrabold tracking-[0.16em] text-white uppercase backdrop-blur"
				>
					<i class="fa-solid fa-route" aria-hidden="true"></i>
					Learning path · kelola kurikulum
				</p>
				<h2 class="mt-2.5 text-xl font-extrabold text-white sm:text-2xl">Jalur Modul → Sub-modul</h2>
				<p class="mt-1 max-w-xl text-xs leading-relaxed text-slate-300 sm:text-[13px]">
					Tambah, sisip, urutkan, dan hapus <strong class="text-white">modul</strong> serta
					<strong class="text-white">sub-modul</strong> langsung dari patch jalur. Klik judul modul untuk
					membuka halaman sub-modulnya, klik judul sub-modul untuk membuka halaman materinya.
				</p>
			</div>
			<div class="min-w-44 rounded-2xl bg-white/15 p-3 backdrop-blur">
				<p class="flex items-center justify-between text-[10px] font-extrabold tracking-widest text-slate-300 uppercase">
					<span>Kurikulum</span><span>{modules.length} modul</span>
				</p>
				<p class="mt-1.5 text-center text-[11px] font-bold text-white">
					{modules.length} modul · {totalSubs} sub · {totalMats} materi
				</p>
			</div>
		</div>
	</div>

	<div class="p-4 sm:p-6">
		{#if modules.length === 0}
			<div class="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
				<p class="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-lg">
					<i class="fa-solid fa-map" aria-hidden="true"></i>
				</p>
				<p class="mt-3 text-sm font-bold text-slate-900">Jalur masih kosong</p>
				<p class="mx-auto mt-1 max-w-sm text-xs text-slate-500">
					Mulai dengan satu modul — setiap modul otomatis membawa satu sub-modul pertama.
				</p>
				<button
					type="button"
					onclick={() => addModule()}
					class="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-blue-600/25 transition-all hover:bg-blue-700 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-blue-600"
				>
					<i class="fa-solid fa-plus" aria-hidden="true"></i>
					Tambah Modul Pertama
				</button>
			</div>
		{:else}
			<ol aria-label="Jalur belajar: daftar modul dan sub-modul" class="relative space-y-3">
				<!-- Node mulai -->
				<li class="relative flex items-center gap-3 pl-1" aria-hidden="true">
					<span class="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/30">
						<i class="fa-solid fa-flag text-xs"></i>
					</span>
					<span class="text-[11px] font-extrabold tracking-widest text-slate-400 uppercase">Mulai jalur</span>
				</li>

				{#each modules as mod, mi (mod.id)}
					{@const subs = subsOf(mod)}
					{@const open = openPatches.has(mod.id)}
					{@const matCount = subs.reduce((n, s) => n + s.materials.length, 0)}
					<li class="relative">
						<!-- Garis sumbu vertikal -->
						<span
							class="pointer-events-none absolute top-0 bottom-0 left-[22px] w-0.5 bg-gradient-to-b from-blue-200 via-slate-200 to-blue-200"
							aria-hidden="true"
						></span>

						<!-- Tombol sisip di antara modul -->
						{#if mi > 0}
							<div class="relative my-1 flex items-center gap-3 py-1 pl-1">
								<button
									type="button"
									onclick={() => addModule(mi)}
									aria-label={`Sisipkan modul baru sebelum modul ${mi + 1}`}
									title={`Sisip modul sebelum M${mi + 1}`}
									class="group flex min-h-8 items-center gap-2 rounded-full border border-dashed border-blue-300 bg-blue-50/70 py-1 pr-3 pl-1 text-[11px] font-bold text-blue-700 transition-all hover:border-blue-500 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-blue-600"
								>
									<span class="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-[10px] text-white transition-transform group-hover:scale-110">
										<i class="fa-solid fa-plus" aria-hidden="true"></i>
									</span>
									Sisip modul di sini
								</button>
							</div>
						{/if}

						<!-- PATCH MODUL -->
						<article
							aria-labelledby={`lp-mod-title-${mod.id}`}
							class="relative ml-12 overflow-hidden rounded-2xl border bg-white transition-all duration-300 {open
								? 'border-blue-500 shadow-xl shadow-blue-600/10'
								: 'border-slate-200/80 shadow-sm hover:border-blue-300 hover:shadow-lg'}"
						>
							<!-- Badge nomor di sumbu -->
							<span
								class="absolute top-4 -left-12 flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-sm font-extrabold text-white shadow-lg shadow-blue-600/30 ring-4 ring-white"
								aria-hidden="true"
							>
								M{mi + 1}
							</span>

							<div class="flex w-full items-center gap-2 p-4">
								<div class="flex min-w-0 flex-1 items-center gap-3">
									<div class="min-w-0 flex-1">
										{#if moduleHref}
											<a
												href={moduleHref(mod, mi)}
												id={`lp-mod-title-${mod.id}`}
												aria-label={`Kelola sub-modul Modul ${mi + 1}: ${mod.title || '(belum berjudul)'}`}
												title="Buka halaman kelola sub-modul"
												class="block truncate rounded-lg text-sm font-extrabold text-slate-900 underline-offset-4 hover:text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-blue-600 sm:text-[15px]"
											>
												Modul {mi + 1}: {mod.title || '(belum berjudul)'}
												<i class="fa-solid fa-arrow-up-right-from-square ml-1 text-[11px] text-blue-500" aria-hidden="true"></i>
											</a>
										{:else}
											<span
												id={`lp-mod-title-${mod.id}`}
												class="block truncate text-sm font-extrabold text-slate-900 sm:text-[15px]"
											>
												Modul {mi + 1}: {mod.title || '(belum berjudul)'}
											</span>
										{/if}
										<span class="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-slate-500">
											<span class="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-violet-700 ring-1 ring-violet-200">
												<i class="fa-solid fa-puzzle-piece text-[10px]" aria-hidden="true"></i>
												{subs.length} sub-modul
											</span>
											<span class="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-blue-700 ring-1 ring-blue-200">
												<i class="fa-solid fa-book-open text-[10px]" aria-hidden="true"></i>
												{matCount} materi
											</span>
										</span>
									</div>
									<button
										type="button"
										onclick={() => togglePatch(mod.id)}
										aria-expanded={open}
										aria-controls={`lp-mod-panel-${mod.id}`}
										aria-label={open ? `Tutup editor cepat Modul ${mi + 1}` : `Buka editor cepat Modul ${mi + 1}`}
										class="flex min-h-9 min-w-9 shrink-0 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-blue-600"
									>
										<i
											class={`fa-solid fa-chevron-down text-sm transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
											aria-hidden="true"
										></i>
									</button>
								</div>
								<span class="hidden shrink-0 items-center gap-1 sm:flex" role="group" aria-label={`Urutkan modul ${mi + 1}`}>
									<button
										type="button"
										onclick={() => moveModule(mod.id, -1)}
										disabled={mi === 0}
										aria-label={`Pindah modul ${mi + 1} ke atas`}
										title="Pindah ke atas"
										class="flex min-h-9 min-w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-all hover:border-blue-300 hover:text-blue-600 focus-visible:outline-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-35"
									>
										<i class="fa-solid fa-arrow-up text-[11px]" aria-hidden="true"></i>
									</button>
									<button
										type="button"
										onclick={() => moveModule(mod.id, 1)}
										disabled={mi === modules.length - 1}
										aria-label={`Pindah modul ${mi + 1} ke bawah`}
										title="Pindah ke bawah"
										class="flex min-h-9 min-w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-all hover:border-blue-300 hover:text-blue-600 focus-visible:outline-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-35"
									>
										<i class="fa-solid fa-arrow-down text-[11px]" aria-hidden="true"></i>
									</button>
								</span>
							</div>

							{#if open}
								<div id={`lp-mod-panel-${mod.id}`} class="space-y-3 border-t border-slate-100 bg-slate-50/60 p-4">
									<div class="grid gap-3">
										<div>
											<label for={`lp-mod-t-${mod.id}`} class="mb-1 block text-xs font-bold text-slate-700">
												Judul modul {mi + 1}
											</label>
											<input
												id={`lp-mod-t-${mod.id}`}
												type="text"
												bind:value={mod.title}
												placeholder="cth. CSS Modern & Layout Responsif"
												class="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-900 placeholder:font-normal placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
											/>
										</div>
										<div>
											<label for={`lp-mod-d-${mod.id}`} class="mb-1 block text-xs font-bold text-slate-700">
												Deskripsi modul
											</label>
											<input
												id={`lp-mod-d-${mod.id}`}
												type="text"
												bind:value={mod.description}
												placeholder="Satu kalimat tujuan modul…"
												class="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-600 placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
											/>
										</div>
									</div>

									<div class="flex flex-wrap gap-2">
										{#if moduleHref}
											<a
												href={moduleHref(mod, mi)}
												aria-label={`Buka halaman kelola sub-modul Modul ${mi + 1}`}
												class="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-[11px] font-bold text-white shadow-md shadow-blue-600/25 transition-all hover:bg-blue-700 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-blue-600"
											>
												<i class="fa-solid fa-puzzle-piece" aria-hidden="true"></i>
												Kelola sub-modul
												<i class="fa-solid fa-arrow-right text-[10px]" aria-hidden="true"></i>
											</a>
										{/if}
										<button
											type="button"
											onclick={() => addSubModule(mod.id)}
											class="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-violet-600 px-3.5 py-2 text-[11px] font-bold text-white shadow-md shadow-violet-600/25 transition-all hover:bg-violet-700 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-violet-600"
										>
											<i class="fa-solid fa-plus" aria-hidden="true"></i>
											Tambah sub-modul
										</button>
										<button
											type="button"
											onclick={() => askDeleteModule(mod, mi)}
											aria-label={`Hapus Modul ${mi + 1}`}
											class="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2 text-[11px] font-bold text-red-600 transition-all hover:bg-red-100 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-red-500"
										>
											<i class="fa-solid fa-trash" aria-hidden="true"></i>
											Hapus modul
										</button>
									</div>

									<!-- SUB PATCHES -->
									<ol aria-label={`Sub-modul dalam modul ${mi + 1}`} class="space-y-2.5">
										{#each subs as sub, si (sub.id)}
											{@const subOpen = openPatches.has(sub.id)}
											<li class="relative rounded-2xl border border-violet-200/70 bg-white p-3 shadow-sm">
												<div class="flex items-center gap-2.5">
													<span
														class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-[11px] font-extrabold text-white shadow-md shadow-violet-600/25"
														aria-hidden="true"
													>
														{mi + 1}.{si + 1}
													</span>
													<span class="min-w-0 flex-1">
														{#if subHref}
															<a
																href={subHref(mod, sub, mi, si)}
																aria-label={`Kelola materi Sub-modul ${mi + 1}.${si + 1}: ${sub.title || '(belum berjudul)'}`}
																title="Buka halaman kelola materi"
																class="block truncate rounded text-[13px] font-extrabold text-slate-900 underline-offset-4 hover:text-violet-700 hover:underline focus-visible:outline-2 focus-visible:outline-violet-600"
															>
																{sub.title || '(belum berjudul)'}
																<i class="fa-solid fa-arrow-up-right-from-square ml-1 text-[10px] text-violet-500" aria-hidden="true"></i>
															</a>
														{:else}
															<span class="block truncate text-[13px] font-extrabold text-slate-900">
																{sub.title || '(belum berjudul)'}
															</span>
														{/if}
														<span class="mt-0.5 block truncate text-[11px] font-semibold text-slate-500">
															{sub.materials.length} materi
															{#if sub.description}
																<span class="text-slate-400"> · {sub.description}</span>
															{/if}
														</span>
													</span>
													<span class="flex shrink-0 items-center gap-1" role="group" aria-label={`Aksi sub-modul ${mi + 1}.${si + 1}`}>
														<button
															type="button"
															onclick={() => duplicateSubModule(mod.id, sub.id)}
															aria-label={`Duplikasi sub-modul ${sub.title || si + 1}`}
															title="Duplikasi (tanpa materi)"
															class="flex min-h-9 min-w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 transition-all hover:border-violet-300 hover:text-violet-600 focus-visible:outline-2 focus-visible:outline-violet-600"
														>
															<i class="fa-solid fa-copy text-[11px]" aria-hidden="true"></i>
														</button>
														<button
															type="button"
															onclick={() => askDeleteSub(mod, sub, mi, si)}
															disabled={subs.length <= 1}
															title={subs.length <= 1
																? 'Setiap modul wajib punya minimal 1 sub-modul'
																: `Hapus sub-modul ${mi + 1}.${si + 1}`}
															aria-label={`Hapus sub-modul ${sub.title || `${mi + 1}.${si + 1}`}`}
															class="flex min-h-9 min-w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 transition-all hover:border-red-300 hover:bg-red-50 hover:text-red-600 focus-visible:outline-2 focus-visible:outline-red-500 disabled:cursor-not-allowed disabled:opacity-35"
														>
															<i class="fa-solid fa-trash text-[11px]" aria-hidden="true"></i>
														</button>
														<button
															type="button"
															onclick={() => togglePatch(sub.id)}
															aria-label={subOpen ? `Tutup detail sub-modul ${si + 1}` : `Buka detail sub-modul ${si + 1}`}
															aria-expanded={subOpen}
															class="flex min-h-9 min-w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-violet-50 hover:text-violet-600 focus-visible:outline-2 focus-visible:outline-violet-600"
														>
															<i class="fa-solid fa-chevron-down text-xs transition-transform duration-300 {subOpen ? 'rotate-180' : ''}" aria-hidden="true"></i>
														</button>
													</span>
												</div>

												{#if subOpen}
													<div id={`lp-sub-panel-${sub.id}`} class="mt-2.5 grid gap-2 border-t border-dashed border-violet-200 pt-2.5">
														<div>
															<label for={`lp-sub-t-${sub.id}`} class="mb-1 block text-[11px] font-bold text-slate-600">
																Judul sub-modul {mi + 1}.{si + 1}
															</label>
															<input
																id={`lp-sub-t-${sub.id}`}
																type="text"
																bind:value={sub.title}
																placeholder={`cth. Layout Inti ${mi + 1}.${si + 1}`}
																class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] font-bold text-slate-900 placeholder:font-normal placeholder:text-slate-400 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 focus:outline-none"
															/>
														</div>
														<div>
															<label for={`lp-sub-d-${sub.id}`} class="mb-1 block text-[11px] font-bold text-slate-600">
																Deskripsi sub-modul (opsional)
															</label>
															<input
																id={`lp-sub-d-${sub.id}`}
																type="text"
																bind:value={sub.description}
																placeholder="Satu kalimat tujuan sub-modul…"
																class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 placeholder:text-slate-400 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 focus:outline-none"
															/>
														</div>
														{#if subHref}
															<div>
																<a
																	href={subHref(mod, sub, mi, si)}
																	aria-label={`Buka halaman kelola materi Sub-modul ${mi + 1}.${si + 1}`}
																	class="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-violet-600 px-3.5 py-2 text-[11px] font-bold text-white shadow-md shadow-violet-600/25 transition-all hover:bg-violet-700 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-violet-600"
																>
																	<i class="fa-solid fa-book-open" aria-hidden="true"></i>
																	Kelola materi
																	<i class="fa-solid fa-arrow-right text-[10px]" aria-hidden="true"></i>
																</a>
															</div>
														{/if}
													</div>
												{/if}
											</li>
										{/each}
									</ol>
								</div>
							{/if}
						</article>
					</li>
				{/each}

				<!-- Tambah modul di ujung -->
				<li class="relative">
					<span
						class="pointer-events-none absolute top-0 bottom-1/2 left-[22px] w-0.5 bg-gradient-to-b from-blue-200 to-transparent"
						aria-hidden="true"
					></span>
					<button
						type="button"
						onclick={() => addModule()}
						class="relative ml-12 flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-blue-300 bg-blue-50/60 px-4 py-3 text-xs font-bold text-blue-700 transition-all hover:border-blue-500 hover:bg-blue-50 active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-blue-600"
					>
						<i class="fa-solid fa-plus" aria-hidden="true"></i>
						Tambah Modul {modules.length + 1} di ujung jalur
					</button>
				</li>

				<!-- Node selesai -->
				<li class="relative flex items-center gap-3 pl-1">
					<span class="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-white shadow-lg">
						<i class="fa-solid fa-trophy text-xs" aria-hidden="true"></i>
					</span>
					<span class="text-[11px] font-extrabold tracking-widest text-slate-400 uppercase">
						Finish · {modules.length} modul · {totalSubs} sub
					</span>
				</li>
			</ol>
		{/if}
	</div>

	<div class="border-t border-slate-100 bg-slate-50/70 px-4 py-3 sm:px-6">
		<p class="flex items-start gap-2 text-[11px] leading-relaxed text-slate-500">
			<i class="fa-solid fa-lightbulb mt-0.5 shrink-0 text-amber-500" aria-hidden="true"></i>
			<span>
				<strong class="text-slate-700">Tips jalur:</strong> gunakan tombol panah untuk mengurutkan modul
				tanpa drag, tombol <strong class="text-slate-700">“Sisip modul di sini”</strong> untuk menyela di tengah
				jalur. Penghapusan selalu meminta konfirmasi modal terlebih dahulu.
			</span>
		</p>
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
</div>

<style>
	@media (prefers-reduced-motion: reduce) {
		* {
			transition: none !important;
			animation: none !important;
		}
	}
</style>
