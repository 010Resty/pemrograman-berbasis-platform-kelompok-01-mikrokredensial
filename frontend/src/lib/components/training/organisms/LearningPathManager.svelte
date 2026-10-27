<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import type { CourseModule, SubModule } from '$lib/data/courses';
	import { resolveSubModules } from '$lib/data/training';
	import { isServerId } from '$lib/api/courses';
	import WarningModal from '$lib/components/WarningModal.svelte';

	/**
	 * LearningPathManager — kelola daftar modul (nama + deskripsi).
	 * Sub-modul TIDAK disunting di sini; gunakan halaman kelola sub-modul
	 * masing-masing modul. `subModules` hanya dibaca untuk hitungan.
	 */
	let {
		modules = $bindable([]),
		onnotice = () => {},
		moduleHref,
		persist,
		withDefaultSub = true
	}: {
		modules: CourseModule[];
		onnotice?: (msg: string) => void;
		/** Bila diisi, judul modul menjadi tautan ke halaman kelola sub-modulnya. */
		moduleHref?: (mod: CourseModule, index: number) => string;
		/**
		 * Jembatan persistensi server (opsional). Bila diisi, tiap aksi
		 * menyunting modul juga ditulis ke backend; bila tidak diisi,
		 * perilaku murni draf lokal seperti semula.
		 */
		persist?: {
			create?: (input: {
				title: string;
				description: string;
				position: number;
			}) => Promise<string | null>;
			update?: (id: string, input: { title?: string; description?: string; position?: number }) => Promise<void>;
			remove?: (id: string) => Promise<void>;
			move?: (orderedIds: string[]) => Promise<void>;
		};
		/** Buat sub-modul awal otomatis (dimatikan untuk kursus server — sub dibuat eksplisit). */
		withDefaultSub?: boolean;
	} = $props();

	const uid = (prefix: string) =>
		`${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4)}`;

	const subsOf = (mod: CourseModule): SubModule[] => resolveSubModules(mod);

	/** Patch mana yang sedang dibuka panel suntingnya (nama + deskripsi modul). */
	let openPatches = new SvelteSet<string>();
	/** Menu overflow (⋯) yang sedang terbuka — hanya satu per daftar. */
	let menuFor = $state<string | null>(null);
	/** Posisi viewport menu (fixed) agar tidak terpotong `overflow-hidden` kartu. */
	let menuPos = $state<{ top: number; right: number } | null>(null);
	/** Draf suntingan nama + deskripsi per modul. Diterapkan hanya saat Simpan ditekan. */
	let editDrafts = $state<Record<string, { title: string; description: string }>>({});
	let editErrors = $state<Record<string, string>>({});
	/** Hapus yang menunggu konfirmasi modal (pengganti konfirmasi dua-tahap). */
	let pendingDelete = $state<{
		moduleId: string;
		title: string;
		message: string;
	} | null>(null);
	let showDelete = $state(false);

	function snapshotDraft(mod: CourseModule) {
		editDrafts[mod.id] = { title: mod.title, description: mod.description };
		delete editErrors[mod.id];
	}

	function togglePatch(id: string | null) {
		if (!id) return;
		if (openPatches.has(id)) {
			// Menutup = membuang perubahan yang belum disimpan.
			openPatches.delete(id);
			delete editDrafts[id];
			delete editErrors[id];
		} else {
			const mod = modules.find((m) => m.id === id);
			if (mod) snapshotDraft(mod);
			openPatches.add(id);
		}
	}

	/** Satu-satunya jalan menyimpan perubahan nama/deskripsi modul. */
	async function saveModuleDraft(id: string | null) {
		if (!id) return;
		const d = editDrafts[id];
		const idx = modules.findIndex((m) => m.id === id);
		if (!d || idx < 0) return;
		if (!d.title.trim()) {
			editErrors[id] = 'Isi nama modul terlebih dahulu.';
			return;
		}
		delete editErrors[id];
		if (persist?.update && isServerId(id)) {
			try {
				await persist.update(id, { title: d.title, description: d.description });
			} catch (e) {
				editErrors[id] = e instanceof Error ? e.message : 'Gagal menyimpan modul ke server.';
				return;
			}
		}
		modules = modules.map((m, i) =>
			i === idx ? { ...m, title: d.title, description: d.description } : m
		);
		delete editDrafts[id];
		openPatches.delete(id);
		announce(`Modul ${idx + 1} tersimpan.`);
	}

	function toggleMenu(id: string, anchor?: HTMLElement | null) {
		if (menuFor === id) {
			closeMenu();
			return;
		}
		if (anchor) {
			const r = anchor.getBoundingClientRect();
			const approxH = 264;
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

	function announce(msg: string) {
		onnotice(msg);
	}

	async function addModule(atIndex?: number) {
		const pos =
			atIndex === undefined || atIndex < 0 || atIndex > modules.length
				? modules.length
				: atIndex;
		const draftTitle = `Modul Baru ${modules.length + 1}`;
		const draftDesc = 'Deskripsi singkat modul baru — klik untuk sunting.';
		let id = uid('mod');
		let subId: string | null = null;
		if (persist?.create) {
			try {
				const serverId = await persist.create({
					title: draftTitle,
					description: draftDesc,
					position: pos
				});
				if (!serverId) {
					announce('Gagal menyimpan modul baru ke server.');
					return;
				}
				id = serverId;
			} catch (e) {
				announce(e instanceof Error ? e.message : 'Gagal menyimpan modul baru ke server.');
				return;
			}
		} else {
			subId = uid('sub');
		}
		const next: CourseModule = {
			id,
			title: draftTitle,
			description: draftDesc,
			materials: [],
			subModules:
				withDefaultSub && subId
					? [{ id: subId, title: 'Sub-modul 1', description: '', materials: [] }]
					: []
		};
		if (atIndex === undefined || atIndex < 0 || atIndex > modules.length) {
			modules = [...modules, next];
		} else {
			modules = [...modules.slice(0, atIndex), next, ...modules.slice(atIndex)];
		}
		if (persist?.move) {
			try {
				await persist.move(modules.map((m) => m.id));
			} catch (e) {
				announce(e instanceof Error ? e.message : 'Gagal menyimpan urutan modul.');
			}
		}
		openPatches.add(id);
		editDrafts[id] = { title: next.title, description: next.description };
		pendingDelete = null;
		announce(
			atIndex === undefined ? `Modul ${modules.length} ditambahkan ke ujung jalur.` : `Modul baru disisipkan di posisi ${atIndex + 1}.`
		);
	}

	function removeModule(id: string) {
		const idx = modules.findIndex((m) => m.id === id);
		modules = modules.filter((m) => m.id !== id);
		openPatches.delete(id);
		delete editDrafts[id];
		delete editErrors[id];
		announce(idx >= 0 ? `Modul ${idx + 1} dihapus dari jalur.` : 'Modul dihapus dari jalur.');
	}

	function askDeleteModule(mod: CourseModule, mi: number) {
		const subs = subsOf(mod);
		const mats = subs.reduce((n, s) => n + s.materials.length, 0);
		pendingDelete = {
			moduleId: mod.id,
			title: `Hapus Modul ${mi + 1}?`,
			message: `“${mod.title || '(belum berjudul)'}” beserta ${subs.length} sub-modul dan ${mats} materi di dalamnya akan dihapus dari draf. Tindakan ini tidak bisa dibatalkan.`
		};
		showDelete = true;
	}

	function moveModule(id: string | null, dir: -1 | 1) {
		if (!id) return;
		const idx = modules.findIndex((m) => m.id === id);
		const target = idx + dir;
		if (idx < 0 || target < 0 || target >= modules.length) return;
		const next = [...modules];
		[next[idx], next[target]] = [next[target], next[idx]];
		modules = next;
		if (persist?.move) {
			void persist
				.move(next.map((m) => m.id))
				.catch((e: unknown) =>
					announce(e instanceof Error ? e.message : 'Gagal menyimpan urutan modul.')
				);
		}
		announce(`Modul dipindah ke posisi ${target + 1}.`);
	}

	function cancelDelete() {
		pendingDelete = null;
	}

	async function executeDelete() {
		const target = pendingDelete;
		if (!target) return;
		if (persist?.remove && isServerId(target.moduleId)) {
			try {
				await persist.remove(target.moduleId);
			} catch (e) {
				announce(e instanceof Error ? e.message : 'Gagal menghapus modul di server.');
				return;
			}
		}
		pendingDelete = null;
		showDelete = false;
		closeMenu();
		removeModule(target.moduleId);
	}

	const totalSubs = $derived(modules.reduce((n, m) => n + subsOf(m).length, 0));
	const totalMats = $derived(modules.reduce((n, m) => n + subsOf(m).reduce((a, s) => a + s.materials.length, 0), 0));

	/** Konteks pemilik menu global: modul yang menunya terbuka (menu dirender sekali di luar kartu). */
	const menuModule = $derived(menuFor ? modules.find((m) => m.id === menuFor) : undefined);
	const menuModuleIndex = $derived(menuFor ? modules.findIndex((m) => m.id === menuFor) : -1);
	const menuOpen = $derived(menuFor ? openPatches.has(menuFor) : false);

	/** Hapus modul pemilik menu (dicari ulang agar aman dari draf basi). */
	function askDeleteMenuModule() {
		const m = menuModule;
		if (!m) return;
		const mi = modules.findIndex((x) => x.id === m.id);
		if (mi < 0) return;
		askDeleteModule(m, mi);
	}
</script>

<!-- Tutup menu ⋯ saat halaman digulir/diubah ukuran (posisinya fixed) -->
<svelte:window onscroll={closeMenu} onresize={closeMenu} />

<div class="overflow-hidden rounded-2xl border border-slate-200 bg-white">
	<!-- Kepala ringkas tanpa blok berwarna -->
	<div class="border-b border-slate-100 px-4 py-4 sm:px-6">
		<div class="flex flex-wrap items-start justify-between gap-3">
			<div class="min-w-0">
				<p class="text-[11px] font-extrabold tracking-widest text-slate-400 uppercase">
					Learning path · kelola kurikulum
				</p>
				<h2 class="mt-1 text-lg font-extrabold text-slate-900">Jalur Modul</h2>
				<p class="mt-1 max-w-xl text-xs leading-relaxed text-slate-500">
					Susun urutan <strong class="text-slate-700">modul</strong> dan sunting nama serta
					deskripsinya. Klik judul modul untuk mengatur sub-modulnya.
				</p>
			</div>
			<div class="flex shrink-0 flex-wrap items-center gap-2">
				<span class="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1.5 text-[11px] font-bold text-blue-700 ring-1 ring-blue-100">
					{modules.length} modul · {totalSubs} sub · {totalMats} materi
				</span>
			</div>
		</div>
	</div>

	<div class="p-4 sm:p-6">
		{#if modules.length === 0}
			<div class="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
				<p class="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-lg">
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
					<span class="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-blue-600">
						<i class="fa-solid fa-flag text-xs"></i>
					</span>
					<span class="text-[11px] font-extrabold tracking-widest text-slate-400 uppercase">Mulai jalur</span>
				</li>

				{#each modules as mod, mi (mod.id)}
					{@const subs = subsOf(mod)}
					{@const open = openPatches.has(mod.id)}
					{@const matCount = subs.reduce((n, s) => n + s.materials.length, 0)}
					<li>
						<!-- PATCH MODUL -->
						<article
							aria-labelledby={`lp-mod-title-${mod.id}`}
							class="rounded-2xl border border-slate-200 bg-white transition-all {open
								? 'border-blue-500 shadow-md shadow-blue-600/10'
								: 'shadow-sm hover:border-slate-300'}"
						>
							<div class="flex w-full items-center gap-2 p-4">
								<div class="flex min-w-0 flex-1 items-center gap-3">
									<div class="min-w-0 flex-1">
									<span
										id={`lp-mod-title-${mod.id}`}
										class="block truncate text-sm font-extrabold text-slate-900 sm:text-[15px]"
									>
										Modul {mi + 1}: {mod.title || '(belum berjudul)'}
									</span>
										<p class="mt-1 text-[11px] font-semibold text-slate-500">
											{subs.length} sub-modul · {matCount} materi
										</p>
									</div>
									{#if moduleHref}
										<a
											href={moduleHref(mod, mi)}
											aria-label={`Buka halaman kelola sub-modul Modul ${mi + 1}`}
											class="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-[11px] font-bold text-white transition-all hover:bg-blue-700 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-blue-600"
										>
											<i class="fa-solid fa-puzzle-piece" aria-hidden="true"></i>
											Kelola
											<i class="fa-solid fa-arrow-right text-[10px] opacity-70" aria-hidden="true"></i>
										</a>
									{/if}
									<button
										type="button"
										onclick={(e) => toggleMenu(mod.id, e.currentTarget)}
										aria-expanded={menuFor === mod.id}
										aria-haspopup="menu"
										aria-controls="lp-menu-open"
										aria-label={`Opsi lain Modul ${mi + 1}`}
										title="Opsi lain"
										class="flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition-all hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-blue-600"
										>
											<i class="fa-solid fa-ellipsis-vertical text-sm" aria-hidden="true"></i>
										</button>
								</div>
							</div>

							{#if open}
								{@const draft = editDrafts[mod.id]}
								{#if draft}
								<div id={`lp-mod-panel-${mod.id}`} class="space-y-3 rounded-b-2xl border-t border-slate-100 bg-slate-50/60 p-4">
									<div class="grid gap-3">
										<div>
											<label for={`lp-mod-t-${mod.id}`} class="mb-1 block text-xs font-bold text-slate-700">
												Judul modul {mi + 1}
											</label>
											<input
												id={`lp-mod-t-${mod.id}`}
												type="text"
												bind:value={draft.title}
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
												bind:value={draft.description}
												placeholder="Satu kalimat tujuan modul…"
												class="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-600 placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
											/>
										</div>
									</div>


									{#if editErrors[mod.id]}
										<p role="alert" class="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
											<i class="fa-solid fa-circle-exclamation mt-0.5 shrink-0" aria-hidden="true"></i>
											{editErrors[mod.id]}
										</p>
									{/if}
									<div>
										<button
											type="button"
											onclick={() => saveModuleDraft(mod.id)}
											aria-label={`Simpan perubahan Modul ${mi + 1}`}
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
										{subs.length} sub-modul · {matCount} materi
									</p>
								</div>
								{/if}
							{/if}
						</article>
					</li>
				{/each}

				<!-- Tambah modul di ujung -->
				<li>
					<button
						type="button"
						onclick={() => addModule()}
						class="flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-xs font-bold text-slate-600 transition-all hover:border-slate-900 hover:bg-white hover:text-slate-900 active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-slate-900"
					>
						<i class="fa-solid fa-plus" aria-hidden="true"></i>
						Tambah Modul {modules.length + 1}
					</button>
				</li>

				<!-- Node selesai -->
				<li class="relative flex items-center gap-3 pl-1">
					<span class="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
						<i class="fa-solid fa-check text-xs" aria-hidden="true"></i>
					</span>
					<span class="text-[11px] font-extrabold tracking-widest text-slate-400 uppercase">
						Selesai · {modules.length} modul · {totalSubs} sub
					</span>
				</li>
			</ol>
		{/if}
	</div>

	<div class="border-t border-slate-100 bg-slate-50/70 px-4 py-3 sm:px-6">
		<p class="flex items-start gap-2 text-[11px] leading-relaxed text-slate-500">
			<i class="fa-solid fa-lightbulb mt-0.5 shrink-0 text-amber-500" aria-hidden="true"></i>
			<span>
				<strong class="text-slate-700">Cara susun:</strong> tombol panah di menu ⋯ mengurutkan
				modul. Perubahan nama/deskripsi wajib disimpan lewat tombol Simpan di panel.
				Setiap penghapusan meminta konfirmasi dulu.
			</span>
		</p>
	</div>

	<!-- Menu overflow modul: fixed agar tidak terpotong overflow-hidden kartu -->
	{#if menuModule}
		<button
			type="button"
			tabindex={-1}
			aria-hidden="true"
			aria-label="Tutup menu"
			onclick={closeMenu}
			class="fixed inset-0 z-40 cursor-default bg-transparent"
		></button>
		<span
			id="lp-menu-open"
			role="menu"
			tabindex={-1}
			aria-label={`Opsi Modul ${menuModuleIndex + 1}`}
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
			aria-controls={`lp-mod-panel-${menuFor}`}
			onclick={() => { togglePatch(menuFor); closeMenu(); }}
			class="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none"
		>
			<i class="fa-solid fa-sliders w-4 shrink-0 text-center text-slate-400" aria-hidden="true"></i>
			Edit nama & deskripsi
			<span class="ml-auto text-[10px] font-normal text-slate-400"
				>{menuOpen ? 'tutup · buang draf' : 'nama · deskripsi'}</span
			>
		</button>
		<span class="mx-3 my-1 block border-t border-slate-100" aria-hidden="true"></span>
		<button
			type="button"
			role="menuitem"
			onclick={() => { moveModule(menuFor, -1); closeMenu(); }}
			disabled={menuModuleIndex === 0}
			class="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
		>
			<i class="fa-solid fa-arrow-up w-4 shrink-0 text-center text-slate-400" aria-hidden="true"></i>
			Pindah ke atas
		</button>
		<button
			type="button"
			role="menuitem"
			onclick={() => { moveModule(menuFor, 1); closeMenu(); }}
			disabled={menuModuleIndex === modules.length - 1}
			class="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
		>
			<i class="fa-solid fa-arrow-down w-4 shrink-0 text-center text-slate-400" aria-hidden="true"></i>
			Pindah ke bawah
		</button>
		<span class="mx-3 my-1 block border-t border-slate-100" aria-hidden="true"></span>
		<button
			type="button"
			role="menuitem"
			onclick={() => { askDeleteMenuModule(); closeMenu(); }}
			class="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 focus-visible:bg-red-50 focus-visible:outline-none"
		>
			<i class="fa-solid fa-trash w-4 shrink-0 text-center" aria-hidden="true"></i>
			Hapus modul
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
</div>

<style>
	@media (prefers-reduced-motion: reduce) {
		* {
			transition: none !important;
			animation: none !important;
		}
	}
</style>
