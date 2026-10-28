<script lang="ts">
	import { browser } from '$app/environment';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import '../../../app.css';
	import Logo from '$lib/components/Logo.svelte';
	import {
		fetchCourseDetail,
		fetchCourseTree,
		type BackendCourse
	} from '$lib/api/courses';
	import type { CourseModule } from '$lib/data/courses';

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

	let detail = $state<BackendCourse | null>(null);
	let tree = $state<CourseModule[]>([]);
	let loading = $state(true);
	let loadError = $state('');
	let notFound = $state(false);
	let started = false;
	let loadSeq = 0;

	let menuOpen = $state(false);

	const mobileLinks = [
		{ href: '/', label: 'Beranda' },
		{ href: '/modules', label: 'Pelatihan' },
		{ href: '/#peringkat', label: 'Peringkat' },
		{ href: '/#tentang', label: 'Tentang' },
		{ href: '/#verifikasi', label: 'Verifikasi' }
	];

	async function load(id: number): Promise<void> {
		const my = ++loadSeq;
		loading = true;
		loadError = '';
		notFound = false;
		try {
			const d = await fetchCourseDetail(id);
			if (my !== loadSeq) return;
			detail = d;
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
				loadError = e instanceof Error ? e.message : 'Gagal memuat pelatihan.';
			}
		} finally {
			if (my === loadSeq) loading = false;
		}
	}

	$effect(() => {
		if (!browser || started) return;
		started = true;
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
	const moduleCount = $derived(tree.length);
	const subCount = $derived(tree.reduce((n, m) => n + (m.subModules?.length ?? 0), 0));
	const materialCount = $derived(tree.reduce((n, m) => n + m.materials.length, 0));

	function periodLabel(): string {
		if (!detail) return '—';
		if (detail.period === 'upcoming') return `Akan Datang · Mulai ${detail.startMonth ?? ''}`.trim();
		if (detail.period === 'ongoing') return 'Sedang Berjalan';
		if (detail.period === 'ended') return 'Periode Lewat';
		return '—';
	}
</script>

<svelte:head>
	<title>{detail ? `${detail.title} — Pratinjau Pelatihan` : 'Pratinjau Pelatihan'} — Aristoteles Platform</title>
	<meta
		name="description"
		content={detail
			? `Pratinjau ${detail.title}: ${moduleCount} modul, ${subCount} sub-modul, ${materialCount} materi.`
			: 'Informasi singkat pelatihan: learning path modul, sub-modul, dan materi.'}
	/>
</svelte:head>

<header class="sticky top-0 z-50 bg-white shadow-sm">
	<div class="mx-auto flex h-20 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
		<a href="/" class="flex shrink-0 items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-blue-600" aria-label="Aristoteles - Beranda">
			<Logo size="md" showText={true} textSize="xl" />
		</a>
		<nav aria-label="Navigasi utama" class="hidden min-w-0 flex-1 items-center justify-center gap-5 font-semibold text-[13px] text-slate-700 lg:flex xl:gap-7">
			<a href="/#beranda" class="whitespace-nowrap transition-colors duration-200 ease-smooth hover:text-blue-600">BERANDA</a>
			<a href="/modules" aria-current="page" class="whitespace-nowrap text-blue-600 transition-colors duration-200 ease-smooth hover:text-blue-700">PELATIHAN</a>
			<a href="/#peringkat" class="whitespace-nowrap transition-colors duration-200 ease-smooth hover:text-blue-600">PERINGKAT</a>
			<a href="/#tentang" class="whitespace-nowrap transition-colors duration-200 ease-smooth hover:text-blue-600">TENTANG</a>
			<a href="/#verifikasi" class="whitespace-nowrap transition-colors duration-200 ease-smooth hover:text-blue-600">VERIFIKASI</a>
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
					<h2 id="pv-kurikulum" class="text-lg font-bold text-slate-900">
						Kurikulum ({moduleCount} Modul · {subCount} Sub-modul · {materialCount} Materi)
					</h2>
					<p class="mt-1 text-xs text-slate-500">Pratinjau struktur. Isi materi terbuka setelah masuk dan mendaftar.</p>
					{#if tree.length === 0}
						<p class="mt-3 text-sm text-slate-500">Kurikulum belum disusun untuk pelatihan ini.</p>
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
													{#if sub.materials.length > 0}
														<ul class="mt-1 space-y-1 pl-5">
															{#each sub.materials as mat (mat.id)}
																<li class="flex items-center gap-1.5 text-xs text-slate-500">
																	<i class="fa-solid fa-file-lines text-[10px] text-slate-300" aria-hidden="true"></i>
																	{mat.title} <span class="text-slate-300">· {mat.type}</span>
																</li>
															{/each}
														</ul>
													{/if}
												</li>
											{/each}
										</ul>
									{:else if mod.materials.length > 0}
										<ul class="mt-2 space-y-1 pl-4">
											{#each mod.materials as mat (mat.id)}
												<li class="flex items-center gap-1.5 text-[13px] text-slate-700">
													<i class="fa-solid fa-file-lines text-[10px] text-slate-300" aria-hidden="true"></i>
													{mat.title} <span class="text-xs text-slate-400">· {mat.type}</span>
												</li>
											{/each}
										</ul>
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
