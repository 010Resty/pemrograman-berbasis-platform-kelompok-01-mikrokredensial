<script lang="ts">
	import { browser } from '$app/environment';
	import CourseRoadmap from '$lib/components/training/organisms/CourseRoadmap.svelte';
	import TrainingActionCard from '$lib/components/training/organisms/TrainingActionCard.svelte';
	import {
		fetchCourseDetail,
		fetchCourseTree,
		toCourseView,
		type BackendCourse
	} from '$lib/api/courses';
	import type { CourseModule } from '$lib/data/courses';
	import { setServerCourseFlags } from '$lib/stores/enrollment.svelte';
	import type { CourseMeta } from '$lib/data/course-meta';

	/**
	 * Pratinjau kursus peserta dari backend.
	 * - Info + harga + periode + pengampu: GET /courses/:id (draft → 404 = tidak ditemukan).
	 * - Struktur kurikulum: endpoint modul/sub/materi (isi materi gated, judul dipakai untuk peta).
	 * - Rating/ulasan/jumlah peserta tidak ada endpointnya → tidak ditampilkan.
	 * - Tombol daftar/bayar mempertahankan perilaku lokal (localStorage + halaman pembayaran);
	 *   bendera server (berbayar/upcoming) didaftarkan agar deteksinya memakai data asli,
	 *   bukan meta contoh (tanpa ini course backend selalu dianggap gratis + berjalan).
	 */

	const COVER_FALLBACK =
		'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=800&q=80';

	let {
		courseId,
		mode,
		backHref,
		backLabel = 'Semua Kursus'
	}: {
		courseId: number;
		mode: 'public' | 'user';
		backHref: string;
		backLabel?: string;
	} = $props();

	let detail = $state<BackendCourse | null>(null);
	let tree = $state<CourseModule[]>([]);
	let loading = $state(true);
	let loadError = $state('');
	let notFound = $state(false);
	let started = false;
	let loadSeq = 0;

	async function load(id: number): Promise<void> {
		const my = ++loadSeq;
		loading = true;
		loadError = '';
		notFound = false;
		try {
			const d = await fetchCourseDetail(id);
			if (my !== loadSeq) return;
			detail = d;
			setServerCourseFlags(d.id, {
				paid: (d.priceNominal ?? 0) > 0,
				upcoming: d.period === 'upcoming'
			});
			try {
				const t = await fetchCourseTree(id);
				if (my !== loadSeq) return;
				tree = t;
			} catch {
				if (my !== loadSeq) return;
				tree = [];
			}
		} catch (e) {
			if (my !== loadSeq) return;
			if (e instanceof Error && /tidak ditemukan|404/.test(e.message)) {
				notFound = true;
				detail = null;
			} else {
				loadError = e instanceof Error ? e.message : 'Gagal memuat pratinjau.';
			}
		} finally {
			if (my === loadSeq) loading = false;
		}
	}

	$effect(() => {
		if (!browser || started) return;
		started = true;
		if (!Number.isInteger(courseId) || courseId <= 0) {
			notFound = true;
			loading = false;
			return;
		}
		void load(courseId);
	});

	const instructorNames = $derived(
		(detail?.instructors ?? []).map((i) => i.name).join(', ') || '—'
	);
	const moduleCount = $derived(tree.length);
	const subCount = $derived(tree.reduce((n, m) => n + (m.subModules?.length ?? 0), 0));
	const materialCount = $derived(tree.reduce((n, m) => n + m.materials.length, 0));

	/** Meta untuk TrainingActionCard: hanya price/period/startMonth yang dibaca
	 *  di mode user; rating/ulasan/peserta nol semata memenuhi tipe (tanpa endpoint,
	 *  dan tidak dirender komponen ini). */
	const previewMeta = $derived.by<CourseMeta | null>(() => {
		if (!detail) return null;
		const period =
			detail.period === 'upcoming' || detail.period === 'ongoing' || detail.period === 'ended'
				? detail.period
				: 'ongoing';
		return {
			rating: 0,
			reviews: 0,
			students: 0,
			price: detail.priceLabel,
			period,
			startMonth: detail.startMonth ?? undefined,
			outcomes: detail.outcomes ?? [],
			requirements: detail.requirements ?? []
		};
	});

	const previewCourse = $derived.by(() => {
		if (!detail) return null;
		return { ...toCourseView(detail), image: detail.image || COVER_FALLBACK };
	});

	function periodLabel(): string {
		if (!detail) return '—';
		if (detail.period === 'upcoming') return `Mulai ${detail.startMonth ?? ''}`.trim();
		if (detail.period === 'ongoing') return 'Berjalan';
		if (detail.period === 'ended') return 'Selesai';
		return '—';
	}
</script>

{#if loading}
	<div class="animate-pulse" aria-label="Memuat pratinjau kursus">
		<div class="h-8 w-64 rounded-xl bg-slate-100"></div>
		<div class="mt-4 h-56 rounded-2xl bg-slate-100"></div>
	</div>
{:else if loadError}
	<div role="alert" class="mx-auto max-w-lg rounded-2xl border border-red-200 bg-red-50 p-10 text-center">
		<i class="fa-solid fa-triangle-exclamation mb-3 text-3xl text-red-400" aria-hidden="true"></i>
		<h1 class="text-xl font-bold text-slate-900">Pratinjau belum dapat dimuat</h1>
		<p class="mx-auto mt-1 max-w-md text-sm text-red-600">{loadError}</p>
		<button
			type="button"
			onclick={() => void load(courseId)}
			class="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-red-600"
		>
			<i class="fa-solid fa-rotate-right" aria-hidden="true"></i> Coba lagi
		</button>
	</div>
{:else if !detail || notFound || !previewMeta || !previewCourse}
	<div class="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-10 text-center">
		<i class="fa-solid fa-triangle-exclamation mb-3 text-3xl text-amber-500" aria-hidden="true"></i>
		<h1 class="text-xl font-bold text-slate-900">Kursus tidak ditemukan</h1>
		<a
			href={backHref}
			class="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white transition-all duration-200 ease-smooth hover:bg-blue-700 active:scale-[0.98]"
		>
			<i class="fa-solid fa-arrow-left" aria-hidden="true"></i> Kembali ke {backLabel}
		</a>
	</div>
{:else}
	{@const c = detail}
	<header class="mb-6 overflow-hidden rounded-2xl border border-slate-200/70 bg-white">
		<div class="relative flex min-h-48 flex-col justify-end overflow-hidden sm:min-h-56">
			<img
				src={c.image || COVER_FALLBACK}
				alt=""
				aria-hidden="true"
				class="absolute inset-0 h-full w-full object-cover"
				loading="eager"
			/>
			<div class="absolute inset-0 bg-gradient-to-t from-slate-900/85 via-slate-900/40 to-slate-900/10" aria-hidden="true"></div>
			<div class="relative flex flex-wrap gap-2 p-4 pb-2 sm:px-6">
				<span class="rounded-full bg-blue-600 px-3 py-1 text-[11px] font-bold text-white uppercase">{c.category ?? 'Umum'}</span>
				<span class="rounded-full bg-white/20 px-3 py-1 text-[11px] font-bold text-white uppercase backdrop-blur">{c.level}</span>
				{#if c.status === 'archived'}
					<span class="rounded-full bg-slate-500/80 px-3 py-1 text-[11px] font-bold text-white uppercase backdrop-blur">Arsip</span>
				{/if}
			</div>
			<div class="relative p-4 pt-1 sm:px-6 sm:pb-5">
				<h1 class="text-xl leading-snug font-extrabold text-white sm:text-2xl">{c.title}</h1>
				<p class="mt-1 text-xs text-slate-200 sm:text-sm">
					Oleh {instructorNames}{c.duration ? ` · ${c.duration}` : ''} · {periodLabel()}
				</p>
			</div>
		</div>
		<div class="flex flex-col gap-3 p-4 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
			<p class="max-w-2xl flex-1 text-sm leading-relaxed text-slate-600">{c.description ?? 'Deskripsi belum tersedia.'}</p>
			<p class="shrink-0 text-2xl font-black text-slate-900">{c.priceLabel}</p>
		</div>
	</header>

	<div class="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
		<div class="min-w-0 space-y-6">
			{#if c.outcomes && c.outcomes.length > 0}
				<section aria-labelledby="pv-outcome" class="rounded-2xl border border-slate-200/70 bg-white p-5 sm:p-6">
					<h2 id="pv-outcome" class="mb-4 text-lg font-bold text-slate-900">Yang Akan Kamu Pelajari</h2>
					<ul class="grid gap-2.5 sm:grid-cols-2">
						{#each c.outcomes as out (out)}
							<li class="flex items-start gap-2.5 text-sm text-slate-700">
								<i class="fa-solid fa-circle-check mt-0.5 shrink-0 text-emerald-500" aria-hidden="true"></i>
								<span>{out}</span>
							</li>
						{/each}
					</ul>
				</section>
			{/if}

			<section aria-labelledby="pv-kurikulum" class="rounded-2xl border border-slate-200/70 bg-white p-5 sm:p-6">
				<h2 id="pv-kurikulum" class="text-lg font-bold text-slate-900">
					Kurikulum ({moduleCount} Modul · {subCount} Sub-modul · {materialCount} Materi)
				</h2>
				<p class="mt-1 text-xs text-slate-500">Pratinjau struktur. Isi materi terbuka setelah mendaftar.</p>
				{#if tree.length === 0}
					<p class="mt-3 text-sm text-slate-500">Kurikulum belum disusun untuk kursus ini.</p>
				{:else}
					<ol class="mt-4 space-y-3">
						{#each tree as mod, mi (mod.id)}
							<li class="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
								<p class="text-sm font-extrabold text-slate-900">
									<span class="text-blue-600">Modul {mi + 1}:</span> {mod.title}
								</p>
								{#if (mod.subModules?.length ?? 0) > 0}
									<ul class="mt-2 space-y-1.5 pl-4">
										{#each mod.subModules ?? [] as sub (sub.id)}
											<li class="text-[13px] text-slate-700">
												<i class="fa-solid fa-folder-open mr-1.5 text-[11px] text-slate-400" aria-hidden="true"></i>
												<span class="font-semibold">{sub.title}</span>
												<span class="text-slate-400"> · {sub.materials.length} materi</span>
											</li>
										{/each}
									</ul>
								{:else if mod.materials.length > 0}
									<p class="mt-1 pl-4 text-xs text-slate-500">{mod.materials.length} materi langsung</p>
								{/if}
							</li>
						{/each}
					</ol>
				{/if}
			</section>

			{#if c.requirements && c.requirements.length > 0}
				<section aria-labelledby="pv-syarat" class="rounded-2xl border border-slate-200/70 bg-white p-5 sm:p-6">
					<h2 id="pv-syarat" class="mb-3 text-lg font-bold text-slate-900">Syarat Mengikuti</h2>
					<ul class="space-y-2">
						{#each c.requirements as req (req)}
							<li class="flex items-start gap-2.5 text-sm text-slate-600">
								<i class="fa-solid fa-circle-info mt-0.5 shrink-0 text-blue-400" aria-hidden="true"></i>
								<span>{req}</span>
							</li>
						{/each}
					</ul>
				</section>
			{/if}

			<CourseRoadmap modules={tree} courseId={c.id} preview />
		</div>

		<TrainingActionCard course={previewCourse} meta={previewMeta} {mode} />
	</div>
{/if}
