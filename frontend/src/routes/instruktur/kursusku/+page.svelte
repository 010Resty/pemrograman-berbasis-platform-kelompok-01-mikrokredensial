<script lang="ts">
	import { browser } from '$app/environment';
	import { page as routePage } from '$app/state';
	import { resolve } from '$app/paths';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import StatCard from '$lib/components/ui/StatCard.svelte';
	import type { Course } from '$lib/data/courses';
	import {
		periodBadgeClass,
		periodIcon,
		type CoursePeriod as MetaPeriod
	} from '$lib/data/course-meta';
	import {
		deleteCourse,
		toCourseView,
		markServerKelola,
		type BackendCourse
	} from '$lib/api/courses';
	import {
		loadMyCourses,
		loadCourseTree,
		invalidateMyCourses,
		invalidateCourseTree
	} from '$lib/stores/instructor-courses.svelte';
	import WarningModal from '$lib/components/WarningModal.svelte';
	import { toast } from '$lib/stores/toast.svelte';

	type Status = 'all' | 'Aktif' | 'Draft' | 'Diarsipkan';
	type SortKey = 'newest' | 'name' | 'priceAsc' | 'priceDesc';

	/** Sampul pengganti bila kursus belum punya gambar (hindari <img> rusak). */
	const COVER_FALLBACK =
		'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=800&q=80';

	/** Kursus server milik instruktur login + jumlah modul/materi dari pohon. */
	let serverCourses = $state<Array<Course & { publishState: string }>>([]);
	let backendPeriod = $state<Record<number, { period: MetaPeriod; startMonth?: string }>>({});
	/** Data mentah backend per id (harga + tanggal) — tanpa mengubah store/API. */
	let backendById = $state<Record<number, BackendCourse>>({});
	let loading = $state(true);
	let loadError = $state('');

	/** State hapus kursus (konfirmasi via WarningModal pola proyek). */
	let showDelete = $state(false);
	let deleting = $state(false);
	let deleteTarget = $state<{ id: number; title: string } | null>(null);
	let deleteError = $state('');

	function askDeleteCourse(id: number, title: string): void {
		deleteTarget = { id, title };
		deleteError = '';
		showDelete = true;
	}

	async function confirmDeleteCourse(): Promise<void> {
		if (!deleteTarget || deleting) return;
		deleting = true;
		deleteError = '';
		try {
			await deleteCourse(deleteTarget.id);
			const removed = deleteTarget.id;
			const removedTitle = deleteTarget.title;
			serverCourses = serverCourses.filter((c) => c.id !== removed);
			// Mutasi sukses: invalidasi cache domain agar kunjungan berikutnya baca server.
			invalidateMyCourses();
			invalidateCourseTree(removed);
			deleteTarget = null;
			showDelete = false;
			toast.success(`Kursus “${removedTitle}” dihapus.`);
		} catch (e) {
			deleteError = e instanceof Error ? e.message : 'Gagal menghapus kursus.';
		} finally {
			deleting = false;
		}
	}

	async function load(): Promise<void> {
		loading = true;
		loadError = '';
		try {
			// Cache terpusat: mount ulang/double-effect berbagi hasil tanpa request baru.
			const list: BackendCourse[] = await loadMyCourses();
			const adapted = list.map(toCourseView);
			serverCourses = adapted;
			const byId: Record<number, BackendCourse> = {};
			for (const b of list) byId[b.id] = b;
			backendById = byId;
			for (const c of adapted) markServerKelola(c.id);
			const periods: Record<number, { period: MetaPeriod; startMonth?: string }> = {};
			for (const b of list) {
				periods[b.id] =
					b.period === 'upcoming' || b.period === 'ongoing' || b.period === 'ended'
						? { period: b.period, startMonth: b.startMonth ?? undefined }
						: { period: 'ongoing' };
			}
			backendPeriod = periods;
			// Muat pohon tiap kursus (best-effort, didedup per courseId di store).
			const trees = await Promise.allSettled(adapted.map((c) => loadCourseTree(c.id)));
			trees.forEach((t, i) => {
				if (t.status === 'fulfilled') {
					adapted[i].modules = t.value;
					adapted[i].totalMaterials = t.value.flatMap((m) => m.materials).length;
				}
			});
		} catch (e) {
			loadError = e instanceof Error ? e.message : 'Gagal memuat kursus.';
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		if (!browser) return;
		void load();
	});

	let activeFilter = $state<Status>('all');
	let activeSort = $state<SortKey>('newest');
	// Kata kunci awal boleh datang dari header portal (?q=…).
	let search = $state(routePage.url.searchParams.get('q') ?? '');

	const filters: { value: Status; label: string }[] = [
		{ value: 'all', label: 'Semua' },
		{ value: 'Aktif', label: 'Aktif' },
		{ value: 'Draft', label: 'Draft' },
		{ value: 'Diarsipkan', label: 'Diarsipkan' }
	];

	const sortOptions: { value: SortKey; label: string }[] = [
		{ value: 'newest', label: 'Terbaru' },
		{ value: 'name', label: 'Nama A–Z' },
		{ value: 'priceAsc', label: 'Harga terendah' },
		{ value: 'priceDesc', label: 'Harga tertinggi' }
	];

	/** Ringkasan status dari data server aktual (tanpa status fiktif). */
	const statusCounts = $derived.by(() => {
		let aktif = 0;
		let draft = 0;
		let arsip = 0;
		for (const c of serverCourses) {
			const st = courseStatus(c);
			if (st === 'Aktif') aktif += 1;
			else if (st === 'Draft') draft += 1;
			else arsip += 1;
		}
		return { aktif, draft, arsip };
	});

	/** Format tanggal pembaruan dari server; '—' bila tak valid. */
	function updatedLabel(courseId: number): string {
		const raw = backendById[courseId]?.updatedAt ?? backendById[courseId]?.createdAt ?? '';
		const t = Date.parse(raw);
		if (!raw || Number.isNaN(t)) return '—';
		return new Date(t).toLocaleDateString('id-ID', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});
	}

	/** Status server 3 nilai (published/archived/draft); tanpa ini arsip salah tampil sebagai Draft. */
	function courseStatus(c: Course & { publishState?: string }): 'Aktif' | 'Draft' | 'Diarsipkan' {
		const s = c.publishState ?? 'draft';
		if (s === 'published') return 'Aktif';
		if (s === 'archived') return 'Diarsipkan';
		return 'Draft';
	}

	const filtered = $derived(
		serverCourses.filter((c) => {
			const st = courseStatus(c);
			const matchStatus = activeFilter === 'all' || st === activeFilter;
			const q = search.trim().toLowerCase();
			const matchSearch =
				!q || c.title.toLowerCase().includes(q) || c.category.toLowerCase().includes(q);
			return matchStatus && matchSearch;
		})
	);

	const filteredWithMeta = $derived(
		filtered.map((c) => {
			// Periode + bulan mulai murni dari server; tanpa data contoh.
			const ov = backendPeriod[c.id];
			return { course: c, meta: ov ?? { period: 'ongoing' as MetaPeriod } };
		})
	);

	/** Sortir sisi klien (tanpa mengubah API): terbaru / nama / harga. */
	const sorted = $derived(
		filteredWithMeta.toSorted((a, b) => {
			const pa = backendById[a.course.id]?.priceNominal ?? 0;
			const pb = backendById[b.course.id]?.priceNominal ?? 0;
			switch (activeSort) {
				case 'name':
					return a.course.title.localeCompare(b.course.title, 'id');
				case 'priceAsc':
					return pa - pb;
				case 'priceDesc':
					return pb - pa;
				case 'newest':
				default: {
					const ta =
						Date.parse(backendById[a.course.id]?.updatedAt ?? '') ||
						Date.parse(backendById[a.course.id]?.createdAt ?? '') ||
						0;
					const tb =
						Date.parse(backendById[b.course.id]?.updatedAt ?? '') ||
						Date.parse(backendById[b.course.id]?.createdAt ?? '') ||
						0;
					return tb - ta;
				}
			}
		})
	);
</script>

<svelte:head>
	<title>Kursusku — Instruktur Aristoteles</title>
	<meta
		name="description"
		content="Kelola kursus, kurikulum, modul, dan materi yang diampu instruktur Aristoteles."
	/>
</svelte:head>

<div class="page-wrap page-stack">
	<PageHeader
		eyebrow="Menu Utama · Kursusku"
		title="Kursusku"
		description={`${serverCourses.length} kursus kamu ampu · ${serverCourses.reduce((n, c) => n + c.modules.length, 0)} modul · ${serverCourses.reduce((n, c) => n + c.totalMaterials, 0)} materi.`}
	>
		{#snippet actions()}
			<a
				href={resolve('/instruktur/kursusku/tambah')}
				class="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white transition-all duration-200 ease-smooth hover:bg-blue-700 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-blue-600"
			>
				<i class="fa-solid fa-plus" aria-hidden="true"></i> Buat Kursus Baru
			</a>
		{/snippet}
	</PageHeader>

	<div
		class="grid grid-cols-1 gap-4 sm:grid-cols-3"
		role="region"
		aria-label="Ringkasan status kursus"
	>
		<StatCard
			label="Kursus Aktif"
			value={String(statusCounts.aktif)}
			sub="Terbit dan tampil di katalog"
			icon="fa-eye"
			tone="emerald"
		/>
		<StatCard
			label="Kursus Draft"
			value={String(statusCounts.draft)}
			sub="Belum diterbitkan"
			icon="fa-pen"
			tone="amber"
		/>
		<StatCard
			label="Diarsipkan"
			value={String(statusCounts.arsip)}
			sub="Tidak tampil di katalog"
			icon="fa-box-archive"
			tone="violet"
		/>
	</div>

	<div class="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center">
		<div class="max-w-md flex-1">
			<label for="search-kursus" class="sr-only">Cari kursus yang kamu ampu</label>
			<div class="relative">
				<div
					class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400"
				>
					<i class="fa-solid fa-magnifying-glass text-sm" aria-hidden="true"></i>
				</div>
				<input
					id="search-kursus"
					type="search"
					bind:value={search}
					placeholder="Cari judul atau kategori kursus..."
					autocomplete="off"
					class="w-full rounded-xl border border-slate-200 bg-white py-2.5 pr-4 pl-10 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
				/>
			</div>
		</div>
		<div class="flex flex-wrap items-center gap-2" role="group" aria-label="Filter status kursus">
			{#each filters as f (f.value)}
				<button
					type="button"
					onclick={() => (activeFilter = f.value)}
					aria-pressed={activeFilter === f.value}
					class={`rounded-xl px-4 py-2 text-xs font-bold transition-all duration-200 ease-smooth active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
						activeFilter === f.value
							? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
							: 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
					}`}
				>
					{f.label}
				</button>
			{/each}
		</div>
		<div class="max-w-xs flex-1 lg:max-w-56">
			<label for="sort-kursus" class="sr-only">Urutkan kursus</label>
			<div class="relative">
				<div
					class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400"
				>
					<i class="fa-solid fa-arrow-down-wide-short text-sm" aria-hidden="true"></i>
				</div>
				<select
					id="sort-kursus"
					bind:value={activeSort}
					aria-label="Urutkan kursus"
					class="w-full cursor-pointer appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pr-10 pl-10 text-xs font-bold text-slate-700 transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
				>
					{#each sortOptions as o (o.value)}
						<option value={o.value}>{o.label}</option>
					{/each}
				</select>
				<div
					class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400"
				>
					<i class="fa-solid fa-chevron-down text-xs" aria-hidden="true"></i>
				</div>
			</div>
		</div>
	</div>

	{#if loading}
		<div
			class="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white p-12 text-sm font-semibold text-slate-500"
			role="status"
			aria-label="Memuat kursus"
		>
			<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i> Memuat kursus dari server...
		</div>
	{:else if loadError}
		<div class="rounded-2xl border border-red-200 bg-red-50 p-12 text-center" role="alert">
			<i class="fa-solid fa-triangle-exclamation mb-3 text-3xl text-red-300" aria-hidden="true"></i>
			<p class="text-sm font-bold text-red-800">Gagal memuat kursus</p>
			<p class="mx-auto mt-1 max-w-md text-xs text-red-600">{loadError}</p>
			<button
				type="button"
				onclick={() => void load()}
				class="mt-4 inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-red-600"
			>
				<i class="fa-solid fa-rotate-right" aria-hidden="true"></i> Coba lagi
			</button>
		</div>
	{:else if filtered.length === 0}
		<div class="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
			<i class="fa-solid fa-folder-open mb-3 text-3xl text-slate-300" aria-hidden="true"></i>
			<p class="text-sm font-semibold text-slate-700">Tidak ada kursus pada filter ini.</p>
		</div>
	{:else}
		<div class="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
			{#each sorted as { course, meta: kMeta } (course.id)}
				{@const st = courseStatus(course)}
				{@const price = backendById[course.id]?.priceLabel ?? '—'}
				<article
					class="group flex flex-col overflow-hidden rounded-2xl border border-slate-200/70 bg-white transition-all duration-300 ease-smooth hover:-translate-y-1 hover:shadow-xl"
				>
					<div class="relative overflow-hidden">
						<img
							src={course.image || COVER_FALLBACK}
							alt={`Sampul kursus ${course.title}`}
							class="h-44 w-full object-cover transition-transform duration-700 ease-smooth group-hover:scale-105"
							loading="lazy"
						/>
						<div
							class="absolute inset-0 bg-gradient-to-t from-slate-900/70 via-slate-900/10 to-transparent"
							aria-hidden="true"
						></div>
						<span
							class={`absolute top-3 left-3 rounded-md border px-2.5 py-1 text-[10px] font-extrabold uppercase backdrop-blur ${st === 'Aktif' ? 'border-emerald-200/70 bg-emerald-50/95 text-emerald-700' : 'bg-slate-900/60 text-white border-white/20'}`}
						>
							{st}
						</span>
						<span
							class={`absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[10px] font-extrabold uppercase ${periodBadgeClass(kMeta.period)}`}
						>
							<i class={`fa-solid ${periodIcon(kMeta.period)}`} aria-hidden="true"></i>
							{kMeta.period === 'upcoming'
								? `Mulai ${kMeta.startMonth ?? ''}`.trim()
								: kMeta.period === 'ongoing'
									? 'Berjalan'
									: 'Lewat'}
						</span>
						<span
							class="absolute right-3 bottom-3 rounded-lg bg-white/95 px-2.5 py-1 text-xs font-black text-slate-900 shadow backdrop-blur"
						>
							{price}
						</span>
					</div>
					<div class="flex flex-1 flex-col p-5">
						<p class="flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-blue-600 uppercase">
							<span class="h-1.5 w-1.5 rounded-full bg-blue-600" aria-hidden="true"></span>
							{course.category}
						</p>
						<h2 class="mt-1.5 line-clamp-2 text-lg leading-snug font-extrabold text-slate-900">
							<a
								href={resolve(`/instruktur/kursusku/${course.id}?src=server`)}
								class="rounded transition-colors duration-200 ease-smooth hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
							>
								{course.title}
							</a>
						</h2>
						{#if course.description?.trim()}
							<p class="mt-1.5 line-clamp-2 text-xs leading-relaxed text-slate-500">
								{course.description.trim()}
							</p>
						{/if}
						<ul class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500">
							<li class="inline-flex items-center gap-1.5">
								<i class="fa-solid fa-layer-group text-[11px] text-blue-500" aria-hidden="true"></i>
								<span><strong class="text-slate-800">{course.modules.length}</strong> modul</span>
							</li>
							<li class="inline-flex items-center gap-1.5">
								<i class="fa-solid fa-file-lines text-[11px] text-violet-500" aria-hidden="true"></i>
								<span><strong class="text-slate-800">{course.totalMaterials}</strong> materi</span>
							</li>
							<li class="inline-flex items-center gap-1.5">
								<i class="fa-solid fa-clock-rotate-left text-[11px] text-slate-400" aria-hidden="true"></i>
								<span>Diperbarui {updatedLabel(course.id)}</span>
							</li>
						</ul>

						<div class="mt-4 flex gap-2 border-t border-slate-100 pt-4">
							<a
								href={resolve(`/instruktur/kursusku/${course.id}?src=server#kurikulum`)}
								aria-label={`Kelola materi kursus ${course.title}: buka bagian kurikulum`}
								title="Buka bagian kurikulum — susun modul, sub-modul, dan materi"
								class="flex min-h-11 flex-1 items-center gap-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-white shadow-lg shadow-blue-600/25 transition-all duration-200 ease-smooth hover:from-blue-700 hover:to-indigo-700 active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-blue-600"
							>
								<span
									class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/20"
									aria-hidden="true"
								>
									<i class="fa-solid fa-list-check text-xs"></i>
								</span>
								<span class="flex min-w-0 flex-1 flex-col items-start leading-tight">
									<span class="text-xs font-bold">Kelola Materi</span>
									<span class="truncate text-[11px] font-medium text-blue-100"
										>Buka bagian kurikulum</span
									>
								</span>
								<i class="fa-solid fa-arrow-right shrink-0 text-xs opacity-80" aria-hidden="true"
								></i>
							</a>
							<button
								type="button"
								onclick={() => askDeleteCourse(course.id, course.title)}
								aria-label={`Hapus kursus ${course.title}`}
								title="Hapus kursus beserta seluruh kurikulumnya"
								class="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl border border-red-200 text-red-600 transition-colors duration-200 ease-smooth hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-red-600"
							>
								<i class="fa-solid fa-trash-can" aria-hidden="true"></i>
							</button>
						</div>
					</div>
				</article>
			{/each}
		</div>
	{/if}

	{#if deleteError}
		<p
			role="alert"
			class="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700"
		>
			<i class="fa-solid fa-triangle-exclamation mr-1.5" aria-hidden="true"></i>{deleteError}
		</p>
	{/if}
</div>

<WarningModal
	bind:open={showDelete}
	type="danger"
	title="Hapus kursus ini?"
	message={deleteTarget
		? `“${deleteTarget.title}” beserta seluruh modul, sub-modul, dan materinya akan dihapus permanen dan tidak bisa dikembalikan.`
		: 'Kursus beserta seluruh kurikulumnya akan dihapus permanen.'}
	confirmText="Ya, hapus kursus"
	cancelText="Batal"
	confirmAriaLabel={deleteTarget
		? `Konfirmasi hapus kursus ${deleteTarget.title}`
		: 'Konfirmasi hapus kursus'}
	loading={deleting}
	onconfirm={() => void confirmDeleteCourse()}
/>
