<script lang="ts">
	import { browser } from '$app/environment';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { SvelteSet } from 'svelte/reactivity';
	import '../../../app.css';
	import Logo from '$lib/components/Logo.svelte';
	import {
		fetchCourseDetail,
		fetchCourseTree,
		type BackendCourse,
		type CourseAccessState
	} from '$lib/api/courses';
	import type { CourseModule } from '$lib/data/courses';
	import { getModuleMaterials, isMaterialLocked } from '$lib/data/courses';
	import { fetchMyProgressIds } from '$lib/api/progress';
	import { apiRequest } from '$lib/api/backend';
	import { getAccessToken } from '$lib/stores/auth.svelte';
	import SeoHead from '$lib/components/SeoHead.svelte';
	import { canonicalPath, getSiteUrl } from '$lib/seo/site';

	/**
	 * Pratinjau publik satu pelatihan dari backend.
	 * - Info + harga + periode + pengampu: GET /courses/:id (draft → 404 = tidak ditemukan).
	 * - Struktur kurikulum: endpoint modul/sub/materi publik (isi materi gated, hanya judul yang dipakai).
	 * - Rating/ulasan/jumlah peserta tidak ada endpointnya → tidak ditampilkan.
	 * - Sertifikat: tanpa ID palsu; penerbitan per modul mengikuti syarat (K-05, gate otomatis belum ada).
	 * - Aksi publik hanya mengarah ke login; tanpa simulasi beli/daftar.
	 */

	const COVER_FALLBACK =
		'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=800&q=80';

	const courseId = $derived(Number(page.params.courseId));

	/** Detail awal dari server load (SSR). Tree + akses + progres tetap via browser. */
	let { data }: { data: { origin: string; detail: BackendCourse | null; notFound: boolean } } =
		$props();
	// svelte-ignore state_referenced_locally -- seed SSR: snapshot awal, update via fetch browser
	let detail = $state<BackendCourse | null>(data.detail);
	let tree = $state<CourseModule[]>([]);
	let access = $state<CourseAccessState | null>(null);
	let doneIds = $state(new SvelteSet<string>());
	let loggedIn = $state(false);
	let pathOpen = $state(new SvelteSet<string>());
	// svelte-ignore state_referenced_locally -- seed SSR: snapshot awal, update via fetch browser
	let loading = $state(!data.detail && !data.notFound);
	let loadError = $state('');
	// svelte-ignore state_referenced_locally -- seed SSR: snapshot awal, update via fetch browser
	let notFound = $state(!data.detail && data.notFound);
	let started = false;
	let loadSeq = 0;

	let menuOpen = $state(false);

	const mobileLinks = [
		{ href: '/', label: 'Beranda' },
		{ href: '/modules', label: 'Pelatihan' },
		{ href: '/peringkat', label: 'Peringkat' },
		{ href: '/tentang', label: 'Tentang' },
		{ href: '/verifikasi', label: 'Verifikasi' }
	];

	async function load(id: number, opts: { soft?: boolean } = {}): Promise<void> {
		const my = ++loadSeq;
		// soft: detail sudah ada dari SSR → jangan tampilkan skeleton ulang.
		if (!opts.soft || detail === null) loading = true;
		loadError = '';
		notFound = false;
		try {
			// Struktur + akses + progres paralel. Akses dibaca mentah (tanpa req()) agar
			// pengunjung anonim yang 401 TIDAK dipaksa logout/redirect ke login.
			const li = browser && getAccessToken() !== null;
			const [d, t, a, done] = await Promise.all([
				detail ?? fetchCourseDetail(id),
				fetchCourseTree(id).catch((): CourseModule[] => []),
				apiRequest<CourseAccessState>(`/courses/${id}/access`, {
					token: getAccessToken()
				}).catch((): null => null),
				li ? fetchMyProgressIds(id).catch((): number[] => []) : Promise.resolve([] as number[])
			]);
			if (my !== loadSeq) return;
			loggedIn = li;
			detail = d;
			tree = t;
			access = a;
			doneIds = new SvelteSet(done.map(String));
			if (tree.length > 0 && pathOpen.size === 0) pathOpen.add(tree[0].id);
		} catch (e) {
			if (my !== loadSeq) return;
			if (e instanceof Error && /tidak ditemukan|404/.test(e.message)) {
				notFound = true;
				detail = null;
			} else {
				loadError = e instanceof Error ? e.message : 'Gagal memuat pelatihan.';
			}
		} finally {
			if (my === loadSeq) loading = false;
		}
	}

	$effect(() => {
		if (!browser || started) return;
		started = true;
		// Hasil SSR: detail → lanjutkan tree/progres tanpa fetch detail ulang;
		// 404 → tampilkan UI tidak-ditemukan tanpa request ulang.
		if (data.detail) {
			void load(courseId, { soft: true });
			return;
		}
		if (data.notFound) {
			notFound = true;
			loading = false;
			return;
		}
		const id = courseId;
		if (!Number.isInteger(id) || id <= 0) {
			notFound = true;
			loading = false;
			return;
		}
		void load(id);
	});

	const instructorNames = $derived(
		(detail?.instructors ?? []).map((i) => i.name).join(', ') || '—'
	);
	function togglePathModule(id: string): void {
		if (pathOpen.has(id)) pathOpen.delete(id);
		else pathOpen.add(id);
	}
	const moduleCount = $derived(tree.length);
	const subCount = $derived(tree.reduce((n, m) => n + (m.subModules?.length ?? 0), 0));
	const materialCount = $derived(tree.reduce((n, m) => n + m.materials.length, 0));

	/** Progres belajar (hanya terisi bila masuk; anonim melihat struktur saja). */
	const allPathMats = $derived(tree.flatMap((m) => getModuleMaterials(m)));
	const donePathCount = $derived(allPathMats.filter((m) => doneIds.has(m.id)).length);
	const coursePercent = $derived(
		allPathMats.length === 0 ? 0 : Math.round((donePathCount / allPathMats.length) * 100)
	);

	/** Daftar materi per sub-modul hanya untuk yang punya akses (terdaftar/pengelola).
	 * Publik tanpa akses hanya melihat struktur sampai tingkat sub-modul. */
	const canSeeMaterials = $derived(access !== null && (access.hasAccess || access.isManager));

	function periodLabel(): string {
		if (!detail) return '—';
		if (detail.period === 'upcoming') return `Akan Datang · Mulai ${detail.startMonth ?? ''}`.trim();
		if (detail.period === 'ongoing') return 'Sedang Berjalan';
		if (detail.period === 'ended') return 'Periode Lewat';
		return '—';
	}

	/**
	 * SEO dinamis dari data nyata: judul/deskripsi mengikuti detail kursus bila
	 * sudah termuat, fallback generik saat loading/404. JSON-LD Course hanya
	 * memakai field backend yang benar ada (tanpa rating/ulasan palsu).
	 * Hitungan modul dipakai hanya bila tree sudah termuat (hindari "0 modul").
	 */
	function truncate160(s: string): string {
		const t = s.trim().replace(/\s+/g, ' ');
		return t.length <= 160 ? t : `${t.slice(0, 159).trimEnd()}…`;
	}
	const detailPath = $derived(`/modules/${Number.isInteger(courseId) && courseId > 0 ? courseId : ''}`);
	const detailDescription = $derived(
		detail
			? tree.length > 0
				? truncate160(
						`Ikuti ${detail.title} (${detail.level}, ${detail.category ?? 'mikrokredensial'}): ${moduleCount} modul, ${subCount} sub-modul, ${materialCount} materi. ${detail.priceLabel} — daftar dan raih sertifikat.`
					)
				: truncate160(
						detail.description ||
							`${detail.title} (${detail.level}) — ${detail.priceLabel}. Pratinjau struktur modul, sub-modul, materi, periode, dan pengampu kursus.`
					)
			: 'Pratinjau pelatihan ARISTOTELES: struktur modul, sub-modul, materi, harga, periode, dan pengampu kursus.'
	);
	const detailJsonLd = $derived([
		{
			'@context': 'https://schema.org',
			'@type': 'Course',
			name: detail?.title ?? 'Pratinjau Pelatihan ARISTOTELES',
			description: detail?.description ?? detailDescription,
			url: canonicalPath(detailPath, data.origin),
			inLanguage: 'id-ID',
			provider: {
				'@type': 'Organization',
				name: 'ARISTOTELES',
				url: getSiteUrl(data.origin)
			}
		},
		{
			'@context': 'https://schema.org',
			'@type': 'BreadcrumbList',
			itemListElement: [
				{ '@type': 'ListItem', position: 1, name: 'Beranda', item: canonicalPath('/', data.origin) },
				{ '@type': 'ListItem', position: 2, name: 'Semua Pelatihan', item: canonicalPath('/modules', data.origin) },
				{
					'@type': 'ListItem',
					position: 3,
					name: detail?.title ?? 'Pratinjau Pelatihan',
					item: canonicalPath(detailPath, data.origin)
				}
			]
		}
	]);
</script>

<SeoHead
	title={detail ? `${detail.title} — Kursus | ARISTOTELES`.slice(0, 60) : 'Pratinjau Pelatihan — ARISTOTELES'}
	description={detailDescription}
	path={detailPath}
	origin={data.origin}
	type="article"
	image={detail?.image || undefined}
	imageAlt={detail ? `Sampul kursus ${detail.title}` : undefined}
	jsonLd={detailJsonLd}
/>

<header class="sticky top-0 z-50 bg-white shadow-sm">
	<div class="mx-auto flex h-20 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
		<a href="/" class="flex shrink-0 items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-blue-600" aria-label="Aristoteles - Beranda">
			<Logo size="md" showText={true} textSize="xl" />
		</a>
		<nav aria-label="Navigasi utama" class="hidden min-w-0 flex-1 items-center justify-center gap-5 font-semibold text-[13px] text-slate-700 lg:flex xl:gap-7">
			<a href="/" class="whitespace-nowrap transition-colors duration-200 ease-smooth hover:text-blue-600">BERANDA</a>
			<a href="/modules" aria-current="page" class="whitespace-nowrap text-blue-600 transition-colors duration-200 ease-smooth hover:text-blue-700">PELATIHAN</a>
			<a href="/peringkat" class="whitespace-nowrap transition-colors duration-200 ease-smooth hover:text-blue-600">PERINGKAT</a>
			<a href="/tentang" class="whitespace-nowrap transition-colors duration-200 ease-smooth hover:text-blue-600">TENTANG</a>
			<a href="/verifikasi" class="whitespace-nowrap transition-colors duration-200 ease-smooth hover:text-blue-600">VERIFIKASI</a>
		</nav>
		<div class="hidden shrink-0 items-center gap-2.5 sm:flex">
			<a
				href="/login"
				class="inline-flex min-h-[44px] items-center justify-center rounded-full border border-blue-600 px-5 text-xs font-bold whitespace-nowrap text-blue-700 uppercase transition-all duration-200 ease-smooth hover:bg-blue-50 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
			>
				Masuk
			</a>
			<a
				href="/register"
				class="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-blue-600 px-5 text-xs font-bold whitespace-nowrap text-white uppercase shadow-lg shadow-blue-500/25 transition-all duration-200 ease-smooth hover:bg-blue-700 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
			>
				Mulai Belajar
				<i class="fa-solid fa-arrow-right text-[11px]" aria-hidden="true"></i>
			</a>
		</div>
		<button
			type="button"
			onclick={() => (menuOpen = !menuOpen)}
			aria-expanded={menuOpen}
			aria-controls="mobile-nav"
			aria-label={menuOpen ? 'Tutup menu navigasi' : 'Buka menu navigasi'}
			class="flex min-h-11 min-w-11 items-center justify-center rounded-xl p-2 text-slate-700 transition-colors duration-200 ease-smooth hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-600 lg:hidden"
		>
			<i class={`fa-solid ${menuOpen ? 'fa-xmark' : 'fa-bars'} text-xl`} aria-hidden="true"></i>
		</button>
	</div>
	<nav
		id="mobile-nav"
		aria-label="Navigasi seluler"
		inert={!menuOpen}
		class={`grid transition-[grid-template-rows,visibility] duration-300 ease-smooth lg:hidden ${menuOpen ? 'grid-rows-[1fr] visible' : 'grid-rows-[0fr] invisible'}`}
	>
		<div class="min-h-0 overflow-hidden">
			<div class="border-t border-slate-100 bg-white px-4 pt-2 pb-5 sm:px-6">
				<ul class="divide-y divide-slate-100 text-sm font-semibold text-slate-700">
					{#each mobileLinks as link (link.href)}
						<li>
							<a
								href={link.href}
								onclick={() => (menuOpen = false)}
								class="block rounded-lg px-2 py-3 uppercase tracking-wide transition-colors duration-200 ease-smooth hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
							>
								{link.label}
							</a>
						</li>
					{/each}
				</ul>
				<div class="mt-3 grid grid-cols-2 gap-2.5 sm:hidden">
					<a href="/login" class="inline-flex min-h-[44px] items-center justify-center rounded-full border border-blue-600 px-4 text-xs font-bold text-blue-700 uppercase transition-all duration-200 ease-smooth hover:bg-blue-50 active:scale-[0.98]">
						Masuk
					</a>
					<a href="/register" class="inline-flex min-h-[44px] items-center justify-center rounded-full bg-blue-600 px-4 text-xs font-bold text-white uppercase shadow-lg shadow-blue-500/25 transition-all duration-200 ease-smooth hover:bg-blue-700 active:scale-[0.98]">
						Mulai Belajar
					</a>
				</div>
			</div>
		</div>
	</nav>
</header>

<main class="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
	{#if loading}
		<div class="animate-pulse" aria-label="Memuat pelatihan">
			<div class="h-8 w-64 rounded-xl bg-slate-100"></div>
			<div class="mt-4 h-56 rounded-2xl bg-slate-100"></div>
			<div class="mt-4 space-y-2">
				<div class="h-5 w-3/4 rounded bg-slate-100"></div>
				<div class="h-4 w-1/2 rounded bg-slate-100"></div>
			</div>
		</div>
	{:else if loadError}
		<div role="alert" class="mx-auto max-w-lg rounded-2xl border border-red-200 bg-red-50 p-10 text-center">
			<i class="fa-solid fa-triangle-exclamation mb-3 text-3xl text-red-400" aria-hidden="true"></i>
			<h1 class="text-xl font-bold text-slate-900">Pelatihan belum dapat dimuat</h1>
			<p class="mx-auto mt-1 max-w-md text-sm text-red-600">{loadError}</p>
			<button
				type="button"
				onclick={() => {
					const id = Number(page.params.courseId);
					if (Number.isInteger(id) && id > 0) void load(id);
				}}
				class="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-red-600"
			>
				<i class="fa-solid fa-rotate-right" aria-hidden="true"></i> Coba lagi
			</button>
		</div>
	{:else if !detail || notFound}
		<div class="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-10 text-center">
			<i class="fa-solid fa-triangle-exclamation mb-3 text-3xl text-amber-500" aria-hidden="true"></i>
			<h1 class="text-xl font-bold text-slate-900">Pelatihan tidak ditemukan</h1>
			<p class="mt-1 text-sm text-slate-500">ID pelatihan “{page.params.courseId}” tidak terdaftar.</p>
			<a
				href="/modules"
				class="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white transition-all duration-200 ease-smooth hover:bg-blue-700 active:scale-[0.98]"
			>
				<i class="fa-solid fa-arrow-left" aria-hidden="true"></i> Kembali ke Semua Pelatihan
			</a>
		</div>
	{:else}
		{@const c = detail}
		<nav aria-label="Breadcrumb" class="mb-4 flex items-center gap-2 text-xs text-slate-500">
			<a href="/modules" class="rounded font-semibold text-blue-600 hover:text-blue-700">Semua Pelatihan</a>
			<i class="fa-solid fa-chevron-right text-[10px] text-slate-300" aria-hidden="true"></i>
			<span aria-current="page" class="truncate font-medium text-slate-700">{c.title}</span>
		</nav>

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
					<h2 id="pv-kurikulum" class="flex items-center gap-2 text-lg font-bold text-slate-900">
						<span class="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white" aria-hidden="true">
							<i class="fa-solid fa-route" aria-hidden="true"></i>
						</span>
						Alur Belajar ({moduleCount} Modul · {subCount} Sub-modul · {materialCount} Materi)
					</h2>
					<div class="mt-2 flex flex-wrap items-center justify-between gap-2">
						<p class="text-xs text-slate-500">Buka tiap modul untuk melihat sub-modul dan materinya.</p>
						{#if loggedIn}
							<p class="text-xs font-bold text-slate-600 tabular-nums" role="status">{donePathCount}/{allPathMats.length} materi · {coursePercent}%</p>
						{/if}
					</div>
					{#if loggedIn}
						<div class="mt-2 h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={coursePercent} aria-valuemin={0} aria-valuemax={100} aria-label="Progres kursus">
							<div class="h-full rounded-full bg-blue-600 transition-all" style="width: {coursePercent}%"></div>
						</div>
					{/if}
					{#if !canSeeMaterials}
						<p class="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-semibold text-amber-800">
							<i class="fa-solid fa-lock mt-0.5 shrink-0" aria-hidden="true"></i>
							<span>Daftar materi tampil sebagai pratinjau terkunci. <a href={resolve('/login')} class="underline hover:text-amber-900">Masuk dan daftar</a> untuk membuka materi.</span>
						</p>
					{/if}
					{#if tree.length === 0}
						<p class="mt-3 text-sm text-slate-500">Kurikulum belum disusun untuk pelatihan ini.</p>
					{:else}
						<div class="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200/70">
							{#each tree as mod, mi (mod.id)}
								{@const modFlat = getModuleMaterials(mod)}
								{@const modDone = modFlat.filter((m) => doneIds.has(m.id)).length}
								{@const modOpen = pathOpen.has(mod.id)}
								<div>
									<button
										type="button"
										onclick={() => togglePathModule(mod.id)}
										aria-expanded={modOpen}
										aria-controls={`pv-mod-${mod.id}`}
										class="flex min-h-11 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600"
									>
										<span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-xs font-extrabold text-white" aria-hidden="true">{mi + 1}</span>
										<span class="min-w-0 flex-1">
											<span class="block truncate text-sm font-bold text-slate-900">Modul {mi + 1}: {mod.title}</span>
											<span class="mt-0.5 block text-[11px] font-semibold text-slate-500 tabular-nums">{modDone}/{modFlat.length} materi</span>
										</span>
										<i class={`fa-solid fa-chevron-down text-xs text-slate-400 transition-transform ${modOpen ? 'rotate-180' : ''}`} aria-hidden="true"></i>
									</button>
									{#if modOpen}
										<ol id={`pv-mod-${mod.id}`} class="space-y-3 border-t border-slate-100 bg-slate-50/50 px-4 py-3">
											{#each mod.subModules ?? [] as sub, si (sub.id)}
												{@const subMats = sub.materials}
												<li>
													{#if !String(sub.id).endsWith('-direct')}
														<p class="mb-1 flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-slate-500 uppercase">
															<i class="fa-solid fa-folder-open" aria-hidden="true"></i>
															Sub-modul {mi + 1}.{si + 1} · {sub.title}
															<span class="font-semibold normal-case">({sub.materials.length} materi)</span>
														</p>
													{/if}
													<ol class="space-y-1">
														{#each sub.materials as mat, matIdx (mat.id)}
															{@const locked = !canSeeMaterials || isMaterialLocked(subMats, matIdx, (id) => doneIds.has(id))}
															{@const matDone = doneIds.has(mat.id)}
															<li class={`flex items-center gap-2.5 rounded-xl border bg-white px-3 py-2 ${locked ? 'border-slate-100' : 'border-slate-200'}`}>
																<span class={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-extrabold ${matDone ? 'bg-emerald-100 text-emerald-700' : locked ? 'bg-slate-100 text-slate-400' : 'bg-blue-100 text-blue-700'}`} aria-hidden="true">
																	{#if matDone}
																		<i class="fa-solid fa-check"></i>
																	{:else if locked}
																		<i class="fa-solid fa-lock"></i>
																	{:else}
																		{matIdx + 1}
																	{/if}
																</span>
																<span class="min-w-0 flex-1">
																	<span class={`block truncate text-[13px] font-bold ${locked && !matDone ? 'text-slate-400' : 'text-slate-800'}`}>{mat.title}</span>
																	{#if mat.type === 'kuis' || mat.type === 'tugas'}
																		<span class={`mt-0.5 inline-block rounded-full px-2 py-px text-[10px] font-bold uppercase ${mat.type === 'kuis' ? 'bg-amber-100 text-amber-700' : 'bg-violet-100 text-violet-700'}`}>
																			{mat.type === 'kuis' ? 'Kuis' : 'Tugas'}
																		</span>
																	{/if}
																</span>
															</li>
														{/each}
													</ol>
												</li>
											{/each}
										</ol>
									{/if}
								</div>
							{/each}
						</div>
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

				<section aria-labelledby="pv-sertifikat" class="rounded-2xl border border-amber-200/70 bg-gradient-to-br from-amber-50 to-white p-5 sm:p-6">
					<h2 id="pv-sertifikat" class="flex items-center gap-2 text-lg font-bold text-slate-900">
						<span class="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400 text-slate-900" aria-hidden="true">
							<i class="fa-solid fa-award" aria-hidden="true"></i>
						</span>
						Sertifikat per Modul
					</h2>
					<p class="mt-1.5 text-[13px] leading-relaxed text-slate-600">
						Setiap modul yang tuntas menerbitkan sertifikatnya sendiri, ditambah 1 sertifikat
						pelatihan setelah semua modul tuntas. Status penerbitan per akun dapat dilihat
						setelah masuk.
					</p>
				</section>
			</div>

			<aside aria-label="Ringkasan dan pendaftaran pelatihan" class="overflow-hidden rounded-2xl border border-slate-200/70 bg-white lg:sticky lg:top-24">
				<div class="relative">
					<img
						src={c.image || COVER_FALLBACK}
						alt=""
						aria-hidden="true"
						class="h-36 w-full object-cover"
						loading="lazy"
					/>
					<span class="absolute bottom-3 left-4 rounded-lg bg-slate-900/80 px-3 py-1.5 text-lg font-extrabold text-white backdrop-blur">
						{c.priceLabel}
					</span>
				</div>
				<div class="space-y-3 p-5">
					{#if c.period === 'ended'}
						<span class="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-slate-200 px-4 py-3 text-sm font-bold text-slate-500" title="Batch pelatihan ini sudah lewat">
							<i class="fa-solid fa-clock-rotate-left" aria-hidden="true"></i> Periode Berakhir
						</span>
						<p class="text-center text-[11px] text-slate-500">
							Batch pelatihan ini sudah lewat. Pantau katalog untuk batch berikutnya.
						</p>
					{:else}
						<a
							href={resolve('/login')}
							class="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/25 transition-all duration-200 ease-smooth hover:bg-blue-700 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-blue-600"
						>
							<i class="fa-solid fa-arrow-right-to-bracket" aria-hidden="true"></i>
							{c.period === 'upcoming' ? `Daftar Batch ${c.startMonth ?? ''}`.trim() : 'Masuk untuk Mulai'}
						</a>
						<p class="text-center text-[11px] text-slate-500">
							Masuk untuk melihat modul dan mulai belajar.
						</p>
					{/if}
					<ul class="space-y-2 border-t border-slate-100 pt-3 text-[13px] text-slate-600">
						<li class="flex items-center gap-2.5">
							<i class="fa-solid fa-layer-group w-4 text-center text-slate-400" aria-hidden="true"></i> Modul
							→ sub-modul → materi bertahap
						</li>
						<li class="flex items-center gap-2.5">
							<i class="fa-solid fa-award w-4 text-center text-amber-500" aria-hidden="true"></i>
							<span><strong>1 sertifikat per modul</strong> + sertifikat pelatihan</span>
						</li>
						<li class="flex items-center gap-2.5">
							<i class="fa-solid fa-mobile-screen w-4 text-center text-slate-400" aria-hidden="true"></i> Belajar
							via HP & laptop
						</li>
					</ul>
				</div>
			</aside>
		</div>
	{/if}
</main>

<footer class="border-t border-slate-800 bg-slate-900 py-8 text-center text-xs text-slate-500">
	&copy; 2026 Aristoteles Platform Mikrokredensial. Semua hak dilindungi.
</footer>
