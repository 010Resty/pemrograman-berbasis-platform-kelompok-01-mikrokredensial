<script lang="ts">
	import { browser } from '$app/environment';
	import { page } from '$app/state';
	import { getCourseById } from '$lib/data/courses';
	import { getCourseMeta } from '$lib/data/course-meta';
	import { tasksOfCourse } from '$lib/data/grading';
	import { loadCourseTree, loadMyCourses } from '$lib/stores/instructor-courses.svelte';
	import { fetchMaterialSubmissions } from '$lib/api/submissions';
	import type { BackendCourse } from '$lib/api/courses';

	const courseId = $derived(Number(page.params.courseId));
	const course = $derived(getCourseById(courseId));
	const meta = $derived(course ? getCourseMeta(course.id) : undefined);
	const tasks = $derived(tasksOfCourse(courseId));

	let search = $state('');

	/* ---- Cabang server: id milik kursus kelola (data backend penuh). ---- */
	let serverCourse = $state<BackendCourse | null>(null);
	let serverTasks = $state<
		Array<{
			materialId: number;
			title: string;
			moduleLabel: string;
			duration: string | null;
			pending: number;
			total: number;
		}>
	>([]);
	let serverLoading = $state(true);
	let serverError = $state('');
	let serverPartial = $state(false);
	let serverStartedFor: number | null = $state(null);

	async function loadServer(cid: number): Promise<void> {
		serverLoading = true;
		serverError = '';
		serverPartial = false;
		try {
			const mine = await loadMyCourses();
			const found = mine.find((c) => c.id === cid) ?? null;
			serverCourse = found;
			serverTasks = [];
			if (!found) return;
			const tree = await loadCourseTree(cid);
			const flat: Array<{ id: number; title: string; moduleLabel: string; duration: string | null }> = [];
			let mi = 0;
			for (const mod of tree) {
				mi += 1;
				const mats = (mod.subModules?.flatMap((s) => s.materials) ?? mod.materials).filter(
					(m) => m.type === 'tugas' && Number.isInteger(Number(m.id))
				);
				for (const m of mats) {
					flat.push({
						id: Number(m.id),
						title: m.title,
						moduleLabel: `Modul ${mi}: ${mod.title}`,
						duration: (m as { duration?: string | null }).duration ?? null
					});
				}
			}
			const settled = await Promise.all(
				flat.map(async (f) => {
					try {
						const subs = await fetchMaterialSubmissions(f.id);
						if (!subs.manager) return { task: null, failed: true };
						return {
							task: {
								materialId: f.id,
								title: f.title,
								moduleLabel: f.moduleLabel,
								duration: f.duration,
								pending: subs.rows.filter((r) => r.status === 'submitted').length,
								total: subs.rows.length
							},
							failed: false
						};
					} catch {
						return { task: null, failed: true };
					}
				})
			);
			serverTasks = settled.flatMap((s) => (s.task ? [s.task] : []));
			serverPartial = settled.some((s) => s.failed);
		} catch (e) {
			serverCourse = null;
			serverTasks = [];
			serverError = e instanceof Error ? e.message : 'Gagal memuat penugasan dari server.';
		} finally {
			serverLoading = false;
		}
	}

	$effect(() => {
		if (!browser) return;
		const cid = courseId;
		if (!Number.isInteger(cid) || cid <= 0 || serverStartedFor === cid) return;
		serverStartedFor = cid;
		void loadServer(cid);
	});

	const loading = $derived(serverLoading);

	/* Header terpadu: server bila ada, jika tidak statis lokal. */
	const header = $derived(
		serverCourse
			? {
					title: serverCourse.title,
					category: serverCourse.category ?? 'Umum',
					image: serverCourse.image,
					price: serverCourse.priceLabel ?? ''
				}
			: course && meta
				? { title: course.title, category: course.category, image: course.image, price: meta.price }
				: null
	);

	interface TaskRow {
		key: string;
		materialId: string | number;
		title: string;
		moduleLabel: string;
		duration: string | null;
		excerpt: string;
		pending: number;
		total: number;
	}

	const rows = $derived.by((): TaskRow[] => {
		const q = search.trim().toLowerCase();
		if (serverCourse) {
			return serverTasks
				.filter(
					(t) =>
						!q ||
						t.title.toLowerCase().includes(q) ||
						t.moduleLabel.toLowerCase().includes(q)
				)
				.map((t) => ({
					key: `srv:${t.materialId}`,
					materialId: t.materialId,
					title: t.title,
					moduleLabel: t.moduleLabel,
					duration: t.duration,
					excerpt: '',
					pending: t.pending,
					total: t.total
				}));
		}
		// Materi statis/pratinjau: tanpa antrean server — angka nol yang jujur.
		const list: TaskRow[] = [];
		for (const info of tasks) {
			if (
				q &&
				!info.title.toLowerCase().includes(q) &&
				!info.moduleTitle.toLowerCase().includes(q) &&
				!(info.brief?.toLowerCase().includes(q) ?? false)
			) {
				continue;
			}
			list.push({
				key: info.key,
				materialId: info.materialId,
				title: info.title,
				moduleLabel: `Modul ${info.moduleIndex + 1}: ${info.moduleTitle}`,
				duration: info.duration,
				excerpt: info.brief ?? 'Penugasan praktik dari modul ini.',
				pending: 0,
				total: 0
			});
		}
		return list;
	});

	const pendingTotal = $derived(rows.reduce((n, r) => n + r.pending, 0));
	const submitTotal = $derived(rows.reduce((n, r) => n + r.total, 0));
</script>

<svelte:head>
	<title>{header ? `Penilaian ${header.title}` : 'Course tidak ditemukan'} — Instruktur Aristoteles</title>
	<meta
		name="description"
		content={header ? `Daftar penugasan ${header.title} yang menunggu penilaian.` : 'Penilaian per course'}
	/>
</svelte:head>

<div class="p-4 sm:p-6 lg:p-8">
	{#if !header}
		<div class="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-10 text-center">
			<i class="fa-solid fa-triangle-exclamation mb-3 text-3xl text-amber-500" aria-hidden="true"></i>
			<h1 class="text-xl font-bold text-slate-900">Course tidak ditemukan</h1>
			<p class="mt-1 text-sm text-slate-500">
				{#if serverError}
					{serverError}
				{:else}
					ID course tidak terdaftar.
				{/if}
			</p>
			<div class="mt-5 flex justify-center gap-2">
				{#if serverError}
					<button
						type="button"
						onclick={() => (serverStartedFor = null)}
						class="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
					>
						<i class="fa-solid fa-rotate-right" aria-hidden="true"></i> Coba lagi
					</button>
				{/if}
				<a
					href="/instruktur/penilaian"
					class="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
				>
					<i class="fa-solid fa-arrow-left" aria-hidden="true"></i> Kembali ke Penilaian
				</a>
			</div>
		</div>
	{:else}
		<nav aria-label="Breadcrumb" class="mb-4 flex items-center gap-2 text-xs text-slate-500">
			<a
				href="/instruktur/penilaian"
				class="rounded font-semibold text-blue-600 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
			>
				Penilaian
			</a>
			<i class="fa-solid fa-chevron-right text-[10px] text-slate-300" aria-hidden="true"></i>
			<span aria-current="page" class="truncate font-medium text-slate-700">{header.title}</span>
		</nav>

		<div class="mb-6 overflow-hidden rounded-2xl border border-slate-200/70 bg-white">
			<div class="relative flex min-h-40 flex-col justify-end overflow-hidden">
				{#if header.image}
					<img
						src={header.image}
						alt=""
						aria-hidden="true"
						class="absolute inset-0 h-full w-full object-cover"
						loading="eager"
					/>
				{:else}
					<div class="absolute inset-0 bg-gradient-to-br from-blue-100 to-indigo-200" aria-hidden="true"></div>
				{/if}
				<div
					class="absolute inset-0 bg-gradient-to-t from-slate-900/85 via-slate-900/40 to-slate-900/10"
					aria-hidden="true"
				></div>
				<div class="relative p-5 sm:px-6">
					<p class="text-[11px] font-bold tracking-widest text-blue-300 uppercase">
						{header.category}{header.price ? ` · ${header.price}` : ''}
					</p>
					<h1 class="mt-1 text-xl leading-snug font-extrabold text-white sm:text-2xl">
						{header.title}
					</h1>
					<p class="mt-1 text-xs text-slate-200 sm:text-sm">
						{rows.length} materi dinilai · {submitTotal} pengumpulan · {pendingTotal} menunggu
					</p>
				</div>
			</div>
		</div>

		<div class="mb-4 max-w-md">
			<label for="search-tugas" class="sr-only">Cari penugasan di course ini</label>
			<div class="relative">
				<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
					<i class="fa-solid fa-magnifying-glass text-sm" aria-hidden="true"></i>
				</div>
				<input
					id="search-tugas"
					type="search"
					bind:value={search}
					placeholder="Cari tugas, kuis, atau modul..."
					autocomplete="off"
					class="w-full rounded-xl border border-slate-200 bg-white py-2.5 pr-4 pl-10 text-sm placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
				/>
			</div>
		</div>

		{#if loading}
			<p role="status" class="mb-4 flex items-center gap-2 text-xs font-semibold text-slate-500">
				<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i> Memuat pengumpulan…
			</p>
		{/if}

		{#if serverError}
			<div role="alert" class="mb-4 rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
				<p class="text-sm font-bold text-red-700">Penugasan belum dapat dimuat</p>
				<p class="mx-auto mt-1 max-w-md text-xs text-red-600">{serverError}</p>
				<button
					type="button"
					onclick={() => (serverStartedFor = null)}
					class="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-red-600"
				>
					<i class="fa-solid fa-rotate-right" aria-hidden="true"></i> Coba lagi
				</button>
			</div>
		{/if}

		{#if serverCourse && serverPartial}
			<p role="note" class="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-semibold text-amber-800">
				<i class="fa-solid fa-triangle-exclamation mt-0.5 shrink-0" aria-hidden="true"></i>
				<span>Sebagian materi gagal dimuat — angka belum lengkap.</span>
			</p>
		{/if}

		{#if rows.length === 0}
			<div class="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
				<i class="fa-solid fa-folder-open mb-3 text-3xl text-slate-300" aria-hidden="true"></i>
				<p class="text-sm font-semibold text-slate-700">Tidak ada penugasan yang cocok.</p>
				<p class="mt-1 text-xs text-slate-500">Coba kata kunci lain.</p>
			</div>
		{:else}
			<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
				{#each rows as row (row.key)}
					<a
						href={`/instruktur/penilaian/${courseId}/${row.materialId}`}
						aria-label={`Buka tugas ${row.title}: ${row.pending} menunggu dari ${row.total} pengumpulan`}
						class="group flex flex-col rounded-2xl border border-slate-200/70 bg-white p-5 transition-all duration-300 ease-smooth hover:-translate-y-0.5 hover:shadow-xl focus-visible:outline-2 focus-visible:outline-blue-600"
					>
						<div class="mb-2 flex items-center justify-between gap-2">
							<span
								class="inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-2.5 py-1 text-[11px] font-extrabold text-violet-800 uppercase"
							>
								<i class="fa-solid fa-pen-to-square text-[10px]" aria-hidden="true"></i>
								Tugas
							</span>
							{#if row.pending > 0}
								<span class="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-700">
									<i class="fa-solid fa-hourglass-half text-[10px]" aria-hidden="true"></i>
									{row.pending} menunggu
								</span>
							{:else if serverCourse}
								<span class="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
									<i class="fa-solid fa-check text-[10px]" aria-hidden="true"></i> Tuntas
								</span>
							{:else}
								<span class="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-500">
									Pratinjau
								</span>
							{/if}
						</div>
						<h2 class="text-base font-bold text-slate-900 transition-colors group-hover:text-blue-700">
							{row.title}
						</h2>
						<p class="mt-0.5 text-[11px] font-semibold text-slate-500">
							{row.moduleLabel} · {row.duration ?? '—'} · {row.total} kiriman
						</p>
						<p class="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-500">{row.excerpt || 'Penugasan praktik dari modul ini.'}</p>
						<span
							class="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white transition-colors group-hover:bg-blue-700"
						>
							<i class="fa-solid fa-users" aria-hidden="true"></i>
							Lihat Jawaban Peserta
							<i class="fa-solid fa-arrow-right text-[10px]" aria-hidden="true"></i>
						</span>
					</a>
				{/each}
			</div>
		{/if}
	{/if}
</div>
