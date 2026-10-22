<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import type { CourseModule, MaterialType, SubModule } from '$lib/data/courses';
	import { resolveSubModules } from '$lib/data/training';

	/**
	 * Editor kurikulum hierarkis: Modul → Sub-modul → Materi.
	 * Dipakai bersama halaman Kelola (instruktur) dan wizard Tambah.
	 * `subModules` adalah sumber kebenaran; array flat `materials`
	 * selalu disinkronkan ulang setiap perubahan struktur.
	 */
	let {
		modules = $bindable([]),
		errors = {},
		blankMaterial = { title: 'Materi baru', duration: '10 mnt' },
		minMaterialsPerModule = 0,
		onnotice = (_msg: string) => {}
	}: {
		modules: CourseModule[];
		/** Pesan validasi per id: `mod-*`, `sub-*`, `mat-*`, `matdur-*`. */
		errors?: Record<string, string>;
		/** Nilai awal materi baru (wizard memakai string kosong). */
		blankMaterial?: { title: string; duration: string };
		/** Minimal materi per modul; tombol hapus dikunci di batas ini. */
		minMaterialsPerModule?: number;
		/** Umpan balik aksi struktural (halaman Kelola menampilkannya). */
		onnotice?: (msg: string) => void;
	} = $props();

	const MATERIAL_TYPES: MaterialType[] = ['video', 'bacaan', 'audio', 'foto', 'kuis', 'tugas'];

	let openModules = new SvelteSet<string>();

	const uid = (prefix: string) =>
		`${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4)}`;

	const subsOf = (mod: CourseModule): SubModule[] => resolveSubModules(mod);
	const flatOf = (mod: CourseModule) => subsOf(mod).flatMap((s) => s.materials);
	const syncFlat = (mod: CourseModule): CourseModule => ({ ...mod, materials: flatOf(mod) });

	function toggleModule(id: string) {
		if (openModules.has(id)) openModules.delete(id);
		else openModules.add(id);
	}

	function addModule() {
		const idx = modules.length + 1;
		const id = uid('mod');
		const subId = uid('sub');
		modules = [
			...modules,
			{
				id,
				title: `Modul Baru ${idx}`,
				description: 'Deskripsi singkat modul baru.',
				materials: [],
				subModules: [{ id: subId, title: `Sub-modul 1`, description: '', materials: [] }]
			}
		];
		openModules.add(id);
		onnotice(`Modul ${idx} ditambahkan.`);
	}

	function removeModule(id: string) {
		modules = modules.filter((m) => m.id !== id);
		openModules.delete(id);
		onnotice('Modul dihapus dari draf.');
	}

	function addSubModule(moduleId: string) {
		modules = modules.map((m) => {
			if (m.id !== moduleId) return m;
			const subs = subsOf(m);
			const sub = {
				id: uid('sub'),
				title: `Sub-modul ${subs.length + 1}`,
				description: '',
				materials: []
			};
			return syncFlat({ ...m, subModules: [...subs, sub] });
		});
		onnotice('Sub-modul baru ditambahkan.');
	}

	function removeSubModule(moduleId: string, subId: string) {
		modules = modules.map((m) => {
			if (m.id !== moduleId) return m;
			const subs = subsOf(m);
			if (subs.length <= 1) return m;
			return syncFlat({ ...m, subModules: subs.filter((s) => s.id !== subId) });
		});
		onnotice('Sub-modul dihapus dari draf.');
	}

	function addMaterial(moduleId: string, subId: string) {
		modules = modules.map((m) => {
			if (m.id !== moduleId) return m;
			const subs = subsOf(m).map((s) =>
				s.id !== subId
					? s
					: {
							...s,
							materials: [
								...s.materials,
								{
									id: uid('mat'),
									title: blankMaterial.title,
									type: 'video' as MaterialType,
									duration: blankMaterial.duration,
									completed: false
								}
							]
						}
			);
			return syncFlat({ ...m, subModules: subs });
		});
		onnotice('Materi baru ditambahkan.');
	}

	function removeMaterial(moduleId: string, subId: string, matId: string) {
		modules = modules.map((m) => {
			if (m.id !== moduleId) return m;
			const subs = subsOf(m).map((s) =>
				s.id !== subId ? s : { ...s, materials: s.materials.filter((x) => x.id !== matId) }
			);
			return syncFlat({ ...m, subModules: subs });
		});
		onnotice('Materi dihapus dari draf.');
	}

	function typeIcon(type: string) {
		if (type === 'video') return 'fa-circle-play text-blue-600';
		if (type === 'audio') return 'fa-headphones text-cyan-600';
		if (type === 'foto') return 'fa-image text-slate-500';
		if (type === 'kuis') return 'fa-circle-question text-amber-600';
		if (type === 'tugas') return 'fa-pen-to-square text-violet-600';
		return 'fa-book-open text-emerald-600';
	}
</script>

<div class="space-y-4">
	{#each modules as mod, mi (mod.id)}
		{@const subs = subsOf(mod)}
		{@const matTotal = flatOf(mod).length}
		{@const open = openModules.has(mod.id)}
		<section
			aria-labelledby={`cur-mod-title-${mod.id}`}
			class="overflow-hidden rounded-2xl border border-slate-200/70 bg-white transition-all duration-300 ease-smooth {open
				? 'shadow-lg'
				: ''}"
		>
			<button
				type="button"
				onclick={() => toggleModule(mod.id)}
				aria-expanded={open}
				aria-controls={`cur-mod-panel-${mod.id}`}
				class="flex w-full items-center gap-4 p-4 text-left transition-colors duration-200 ease-smooth hover:bg-slate-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-600 sm:p-5"
			>
				<span
					class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-sm font-extrabold text-white"
					aria-hidden="true"
				>
					{mi + 1}
				</span>
				<span class="min-w-0 flex-1">
					<span
						id={`cur-mod-title-${mod.id}`}
						class="block truncate text-sm font-bold text-slate-900 sm:text-base"
					>
						Modul {mi + 1}: {mod.title || '(belum berjudul)'}
					</span>
					<span class="mt-0.5 block truncate text-xs text-slate-500">
						{subs.length} sub-modul · {matTotal} materi
					</span>
				</span>
				<i
					class={`fa-solid fa-chevron-down shrink-0 text-sm text-slate-400 transition-transform duration-300 ease-smooth ${open ? 'rotate-180' : ''}`}
					aria-hidden="true"
				></i>
			</button>

			{#if open}
				<div
					id={`cur-mod-panel-${mod.id}`}
					class="space-y-4 border-t border-slate-100 bg-slate-50/40 p-4 sm:p-5"
				>
					<div class="grid gap-3 rounded-xl border border-slate-200 bg-white p-4">
						<div>
							<label
								for={`cur-mod-t-${mod.id}`}
								class="mb-1 block text-xs font-bold text-slate-700">Judul modul</label
							>
							<input
								id={`cur-mod-t-${mod.id}`}
								type="text"
								bind:value={mod.title}
								aria-invalid={!!errors[`mod-${mod.id}`]}
								class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
							/>
							{#if errors[`mod-${mod.id}`]}<p class="mt-1.5 text-xs font-semibold text-red-600">
									{errors[`mod-${mod.id}`]}
								</p>{/if}
						</div>
						<div>
							<label
								for={`cur-mod-d-${mod.id}`}
								class="mb-1 block text-xs font-bold text-slate-700">Deskripsi modul</label
							>
							<input
								id={`cur-mod-d-${mod.id}`}
								type="text"
								bind:value={mod.description}
								class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
							/>
						</div>
						<div class="flex flex-wrap gap-2">
							<button
								type="button"
								onclick={() => addSubModule(mod.id)}
								class="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-violet-600 px-3.5 py-2 text-[11px] font-bold text-white transition-all duration-200 ease-smooth hover:bg-violet-700 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-violet-600"
							>
								<i class="fa-solid fa-plus" aria-hidden="true"></i> Tambah Sub-modul
							</button>
							<button
								type="button"
								onclick={() => removeModule(mod.id)}
								class="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2 text-[11px] font-bold text-red-600 transition-all duration-200 ease-smooth hover:bg-red-100 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-red-500"
							>
								<i class="fa-solid fa-trash" aria-hidden="true"></i> Hapus Modul
							</button>
						</div>
					</div>

					{#each subs as sub, si (sub.id)}
						<div class="rounded-xl border border-violet-200/70 bg-violet-50/40 p-3 sm:p-4">
							<div class="flex items-center gap-2.5">
								<span
									class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-600 text-[11px] font-extrabold text-white"
									aria-hidden="true"
								>
									{si + 1}
								</span>
								<div class="min-w-0 flex-1">
									<label for={`cur-sub-t-${sub.id}`} class="sr-only"
										>Judul sub-modul {si + 1} modul {mi + 1}</label
									>
									<input
										id={`cur-sub-t-${sub.id}`}
										type="text"
										bind:value={sub.title}
										placeholder={`Sub-modul ${si + 1}: cth “Struktur & Semantik”`}
										aria-invalid={!!errors[`sub-${sub.id}`]}
										class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-900 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 focus:outline-none"
									/>
								</div>
								<button
									type="button"
									onclick={() => removeSubModule(mod.id, sub.id)}
									disabled={subs.length <= 1}
									title={subs.length <= 1 ? 'Setiap modul wajib punya minimal 1 sub-modul' : `Hapus sub-modul ${si + 1}`}
									aria-label={`Hapus sub-modul ${sub.title || si + 1}`}
									class="flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 transition-all duration-200 ease-smooth hover:bg-red-50 hover:text-red-600 focus-visible:outline-2 focus-visible:outline-red-500 disabled:cursor-not-allowed disabled:opacity-40"
								>
									<i class="fa-solid fa-trash text-xs" aria-hidden="true"></i>
								</button>
							</div>
							{#if errors[`sub-${sub.id}`]}<p class="mt-1.5 text-xs font-semibold text-red-600">
									{errors[`sub-${sub.id}`]}
								</p>{/if}
							<div class="mt-2">
								<label
									for={`cur-sub-d-${sub.id}`}
									class="mb-1 block text-[11px] font-bold text-slate-600"
									>Deskripsi sub-modul (opsional)</label
								>
								<input
									id={`cur-sub-d-${sub.id}`}
									type="text"
									bind:value={sub.description}
									placeholder="Satu kalimat tujuan sub-modul…"
									class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 focus:outline-none"
								/>
							</div>
							{#if errors[`mod-${mod.id}-mats`]}<p class="mt-1.5 text-xs font-semibold text-red-600">
									{errors[`mod-${mod.id}-mats`]}
								</p>{/if}

							{#if sub.materials.length === 0}
								<p class="mt-3 rounded-xl border border-dashed border-slate-300 bg-white p-5 text-center text-xs text-slate-500">
									Belum ada materi di sub-modul ini. Klik “Tambah Materi” untuk mulai menyusun.
								</p>
							{:else}
								<ol class="mt-3 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
									{#each sub.materials as mat (mat.id)}
										<li class="flex flex-col gap-3 p-3 sm:p-4 lg:flex-row lg:items-center">
											<span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100">
												<i class={`fa-solid ${typeIcon(mat.type)}`} aria-hidden="true"></i>
											</span>
											<div class="grid min-w-0 flex-1 gap-2 sm:grid-cols-[1fr_140px_110px]">
												<div>
													<label for={`cur-mat-t-${mat.id}`} class="sr-only">Judul materi</label>
													<input
														id={`cur-mat-t-${mat.id}`}
														type="text"
														bind:value={mat.title}
														placeholder="Judul materi…"
														aria-invalid={!!errors[`mat-${mat.id}`]}
														class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-800 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
													/>
													{#if errors[`mat-${mat.id}`]}<p class="mt-1 text-xs font-semibold text-red-600">
															{errors[`mat-${mat.id}`]}
														</p>{/if}
												</div>
												<div>
													<label for={`cur-mat-ty-${mat.id}`} class="sr-only">Tipe materi</label>
													<select
														id={`cur-mat-ty-${mat.id}`}
														bind:value={mat.type}
														class="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-bold text-slate-700 focus:border-blue-500 focus:outline-none"
													>
														{#each MATERIAL_TYPES as t (t)}
															<option value={t}>{t}</option>
														{/each}
													</select>
												</div>
												<div>
													<label for={`cur-mat-du-${mat.id}`} class="sr-only">Durasi materi</label>
													<input
														id={`cur-mat-du-${mat.id}`}
														type="text"
														bind:value={mat.duration}
														placeholder="10 mnt"
														aria-invalid={!!errors[`matdur-${mat.id}`]}
														class="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-600 focus:border-blue-500 focus:outline-none"
													/>
													{#if errors[`matdur-${mat.id}`]}<p class="mt-1 text-xs font-semibold text-red-600">
															{errors[`matdur-${mat.id}`]}
														</p>{/if}
												</div>
											</div>
											<button
												type="button"
												onclick={() => removeMaterial(mod.id, sub.id, mat.id)}
												disabled={matTotal <= minMaterialsPerModule}
												aria-label={`Hapus materi ${mat.title || 'baru'}`}
												class="flex min-h-10 min-w-10 items-center justify-center self-end rounded-lg border border-slate-200 text-slate-400 transition-all duration-200 ease-smooth hover:bg-red-50 hover:text-red-600 focus-visible:outline-2 focus-visible:outline-red-500 disabled:cursor-not-allowed disabled:opacity-40 lg:self-auto"
											>
												<i class="fa-solid fa-trash text-xs" aria-hidden="true"></i>
											</button>
										</li>
									{/each}
								</ol>
							{/if}
							<button
								type="button"
								onclick={() => addMaterial(mod.id, sub.id)}
								class="mt-2.5 inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-[11px] font-bold text-white transition-all duration-200 ease-smooth hover:bg-blue-700 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-blue-600"
							>
								<i class="fa-solid fa-plus" aria-hidden="true"></i> Tambah Materi
							</button>
						</div>
					{/each}
				</div>
			{/if}
		</section>
	{/each}

	<button
		type="button"
		onclick={addModule}
		class="flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-blue-300 bg-blue-50/60 px-4 py-3 text-xs font-bold text-blue-700 transition-all duration-200 ease-smooth hover:bg-blue-50 active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-blue-600"
	>
		<i class="fa-solid fa-plus" aria-hidden="true"></i> Tambah Modul
	</button>
</div>
