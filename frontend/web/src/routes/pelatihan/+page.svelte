<script lang="ts">
	import '../../app.css';
	import { browser } from '$app/environment';
	import { resolve } from '$app/paths';
	import PublicHeader from '$lib/components/public/PublicHeader.svelte';
	import PublicFooter from '$lib/components/public/PublicFooter.svelte';
	import SeoHead from '$lib/components/SeoHead.svelte';
	import { canonicalPath, getSiteUrl } from '$lib/seo/site';
	import { reveal } from '$lib/actions/reveal';
	import {
		fetchCourseDetail,
		fetchPublicCourseList,
		type BackendCourse
	} from '$lib/api/courses';

	const MODUL_CATEGORIES = [
		'Pengembangan Web',
		'Basis Data',
		'Jaringan',
		'Keamanan',
		'AI & Data',
		'Infrastruktur',
		'Desain',
		'Bisnis'
	];
	const COVER_FALLBACK =
		'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=800&q=80';

	let modulCat = $state('Semua');
	let search = $state('');
	let debouncedSearch = $state('');
	/** Daftar awal dari server load (SSR); fetch browser hanya bila kosong/ganti filter. */
	let { data }: { data: { origin: string; modul: BackendCourse[] } } = $props();
	// svelte-ignore state_referenced_locally -- seed SSR: snapshot awal, update via fetch browser
	let modulCourses = $state<BackendCourse[]>(data.modul);
	let modulNames = $state(new Map<number, string>());
	// svelte-ignore state_referenced_locally -- seed SSR: snapshot awal, update via fetch browser
	let modulLoading = $state(data.modul.length === 0);
	let modulError = $state('');
	let modulSeq = 0;
	let modulFirstRun = true;

	async function loadModul(): Promise<void> {
		const my = ++modulSeq;
		modulLoading = true;
		modulError = '';
		try {
			const list = await fetchPublicCourseList({
				q: debouncedSearch.trim() || undefined,
				category: modulCat === 'Semua' ? undefined : modulCat,
				status: 'published',
				limit: 8
			});
			if (my !== modulSeq) return;
			modulCourses = list;
			void ensureModulNames(list);
		} catch (e) {
			if (my !== modulSeq) return;
			modulError = e instanceof Error ? e.message : 'Gagal memuat pelatihan.';
		} finally {
			if (my === modulSeq) modulLoading = false;
		}
	}

	async function ensureModulNames(list: BackendCourse[]): Promise<void> {
		const missing = list.filter((c) => !modulNames.has(c.id));
		if (missing.length === 0) return;
		const entries = await Promise.all(
			missing.map(async (c) => {
				try {
					const d = await fetchCourseDetail(c.id);
					return [c.id, (d.instructors ?? []).map((i) => i.name).join(', ') || '—'] as const;
				} catch {
					return [c.id, '—'] as const;
				}
			})
		);
		const next = new Map(modulNames);
		for (const [id, names] of entries) next.set(id, names);
		modulNames = next;
	}

	function periodShort(course: BackendCourse): string {
		if (course.period === 'upcoming') return `Mulai ${course.startMonth ?? ''}`.trim();
		if (course.period === 'ongoing') return 'Berjalan';
		if (course.period === 'ended') return 'Selesai';
		return '—';
	}

	// Debounce pencarian 400 ms (pola sama dengan /modules agar tidak spam backend).
	$effect(() => {
		const q = search;
		const t = setTimeout(() => {
			if (debouncedSearch !== q) debouncedSearch = q;
		}, 400);
		return () => clearTimeout(t);
	});

	$effect(() => {
		if (!browser) return;
		void debouncedSearch;
		void modulCat;
		// Mount pertama: data SSR sudah tampil → cukup lengkapi nama pengampu.
		if (modulFirstRun) {
			modulFirstRun = false;
			if (modulCourses.length > 0) {
				void ensureModulNames(modulCourses);
				return;
			}
		}
		void loadModul();
	});

	const pelatihanJsonLd = $derived([
		{
			'@context': 'https://schema.org',
			'@type': 'CollectionPage',
			name: 'Katalog Pelatihan ARISTOTELES',
			description:
				'Katalog pelatihan mikrokredensial: pengembangan web, basis data, jaringan, keamanan, AI & data, infrastruktur, desain, bisnis.',
			url: canonicalPath('/pelatihan', data.origin),
			inLanguage: 'id-ID',
			isPartOf: { '@type': 'WebSite', name: 'ARISTOTELES', url: getSiteUrl(data.origin) }
		},
		{
			'@context': 'https://schema.org',
			'@type': 'BreadcrumbList',
			itemListElement: [
				{ '@type': 'ListItem', position: 1, name: 'Beranda', item: canonicalPath('/', data.origin) },
				{ '@type': 'ListItem', position: 2, name: 'Pelatihan', item: canonicalPath('/pelatihan', data.origin) }
			]
		}
	]);
</script>

<SeoHead
	title="Katalog Pelatihan & Kursus Online — ARISTOTELES"
	description="Jelajahi katalog pelatihan mikrokredensial ARISTOTELES: web, data, AI, desain & bisnis. Pilih program, ikuti evaluasi, raih sertifikat terverifikasi."
	path="/pelatihan"
	origin={data.origin}
	jsonLd={pelatihanJsonLd}
/>

<PublicHeader active="pelatihan" />

<main>
	<!-- Hero -->
	<section class="relative overflow-hidden bg-white">
		<div class="pointer-events-none absolute inset-0" aria-hidden="true">
			<div class="absolute -top-32 right-[10%] h-72 w-72 rounded-full bg-ice blur-3xl"></div>
		</div>
		<div class="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
			<p class="flex items-center gap-3 font-heading text-xs font-bold tracking-[0.18em] text-royal uppercase">
				<span class="h-px w-8 bg-royal" aria-hidden="true"></span>
				Katalog Pelatihan
			</p>
			<h1 class="mt-3 max-w-2xl font-heading text-4xl font-extrabold tracking-tight text-abyss sm:text-5xl">
				Pelatihan untuk setiap tahap kariermu
			</h1>
			<p class="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
				Pilih program mikrokredensial berdasarkan kategori — dari memilih program hingga
				meraih sertifikat.
			</p>
		</div>
	</section>

	<!-- Filter + grid -->
	<section aria-labelledby="pelatihan-heading" class="border-t border-mist bg-white pb-20">
		<div class="mx-auto max-w-7xl px-4 pt-10 sm:px-6 lg:px-8">
			<h2 id="pelatihan-heading" class="sr-only">Daftar pelatihan berdasarkan kategori</h2>
			<div class="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center">
				<div class="relative max-w-md flex-1">
					<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
						<i class="fa-solid fa-magnifying-glass text-sm" aria-hidden="true"></i>
					</div>
					<label for="pelatihan-search" class="sr-only">Cari pelatihan</label>
					<input
						id="pelatihan-search"
						type="search"
						bind:value={search}
						placeholder="Cari judul atau deskripsi pelatihan..."
						autocomplete="off"
						class="w-full rounded-xl border border-mist bg-white py-2.5 pr-4 pl-10 text-sm text-slate-800 placeholder:text-slate-400 transition-colors duration-200 focus:border-royal focus:ring-2 focus:ring-royal/20 focus:outline-none"
					/>
				</div>
				<div class="flex flex-wrap gap-2" role="group" aria-label="Filter kategori">
					{#each ['Semua', ...MODUL_CATEGORIES] as cat (cat)}
						<button
							type="button"
							onclick={() => (modulCat = cat)}
							aria-pressed={modulCat === cat}
							class={`rounded-xl px-5 py-2.5 font-heading text-xs font-bold transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-royal ${modulCat === cat ? 'bg-abyss text-white' : 'border border-mist bg-white text-slate-600 hover:border-royal hover:text-royal'}`}
						>{cat}</button
						>
					{/each}
				</div>
			</div>

			<p class="mb-4 text-xs font-medium text-slate-500" role="status">
				{#if debouncedSearch.trim()}
					Hasil untuk “{debouncedSearch.trim()}”: {modulCourses.length} pelatihan
				{:else}
					Menampilkan {modulCourses.length} pelatihan
				{/if}
			</p>

			{#if modulLoading}
				<div class="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4" aria-label="Memuat pelatihan">
					{#each [1, 2, 3, 4, 5, 6, 7, 8] as i (i)}
						<div class="overflow-hidden rounded-2xl border border-mist bg-white">
							<div class="h-44 animate-pulse bg-ice"></div>
							<div class="space-y-2 p-6">
								<div class="h-4 w-3/4 animate-pulse rounded bg-ice"></div>
								<div class="h-3 w-1/2 animate-pulse rounded bg-ice"></div>
							</div>
						</div>
					{/each}
				</div>
			{:else if modulError}
				<div role="alert" class="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
					<p class="font-heading text-sm font-bold text-red-700">Pelatihan belum dapat dimuat</p>
					<p class="mx-auto mt-1 max-w-md text-xs text-red-600">{modulError}</p>
					<button
						type="button"
						onclick={() => void loadModul()}
						class="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-royal px-5 py-2.5 font-heading text-xs font-bold text-white transition-colors duration-200 hover:bg-royal-hover focus-visible:outline-2 focus-visible:outline-royal"
					>
						<i class="fa-solid fa-rotate-right" aria-hidden="true"></i> Coba lagi
					</button>
				</div>
			{:else if modulCourses.length === 0}
				<div class="rounded-2xl border border-dashed border-mist bg-white p-12 text-center">
					<i class="fa-solid fa-magnifying-glass mb-3 text-3xl text-slate-300" aria-hidden="true"></i>
					<p class="font-heading text-sm font-bold text-abyss">Pelatihan tidak ditemukan.</p>
					<p class="mt-1 text-xs text-slate-500">
						{#if debouncedSearch.trim()}
							Coba kata kunci atau kategori lain.
						{:else}
							Belum ada pelatihan pada kategori ini.
						{/if}
					</p>
					{#if debouncedSearch.trim() || modulCat !== 'Semua'}
						<button
							type="button"
							onclick={() => {
								search = '';
								debouncedSearch = '';
								modulCat = 'Semua';
							}}
							class="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-mist bg-white px-5 py-2.5 font-heading text-xs font-bold text-slate-600 transition-colors duration-200 hover:border-royal hover:text-royal focus-visible:outline-2 focus-visible:outline-royal"
						>
							<i class="fa-solid fa-rotate-left" aria-hidden="true"></i> Atur ulang pencarian
						</button>
					{/if}
				</div>
			{:else}
				<div class="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
					{#each modulCourses as course, i (course.id)}
						<article
							use:reveal={{ delay: (i % 4) * 70 }}
							class="group relative flex flex-col overflow-hidden rounded-2xl border border-mist bg-white transition-all duration-200 hover:-translate-y-1 hover:border-royal/40 hover:shadow-xl hover:shadow-slate-900/10"
						>
							<div class="relative overflow-hidden" aria-hidden="true">
								<img
									src={course.image || COVER_FALLBACK}
									alt={`Pelatihan ${course.title} — ${course.category ?? 'kursus online'} di ARISTOTELES`}
									class="h-44 w-full object-cover transition duration-500 group-hover:scale-[1.03]"
									loading="lazy"
								/>
								{#if course.duration}
									<span
										class="absolute top-3 left-3 rounded-md bg-abyss px-3 py-1 font-heading text-[10px] font-bold text-white uppercase"
										>{course.duration}</span
									>
								{/if}
							</div>
							<div class="flex flex-1 flex-col justify-between space-y-4 p-5">
								<div>
									<div class="mb-2 flex items-center justify-between text-xs text-slate-500">
										<span class="font-heading font-bold tracking-wide text-royal uppercase">{course.level}</span>
										<span class="flex items-center gap-1"
											><i class="fa-regular fa-clock" aria-hidden="true"></i> {periodShort(course)}</span
										>
									</div>
									<h3 class="font-heading text-base leading-snug font-bold text-abyss">
										<a
											href={resolve(`/modules/${course.id}`)}
											class="rounded transition-colors duration-200 group-hover:text-royal focus-visible:outline-2 focus-visible:outline-royal after:absolute after:inset-0"
											aria-label={`Lihat info singkat: ${course.title}`}>{course.title}</a
										>
									</h3>
									<p class="mt-1 text-xs text-slate-500">
										{course.category ?? 'Umum'}
									</p>
								</div>
								<div class="flex items-center justify-between border-t border-mist pt-4">
									<span class="text-xs font-semibold text-slate-600">{modulNames.get(course.id) ?? '…'}</span>
									<span class="font-heading text-sm font-extrabold text-abyss">{course.priceLabel}</span>
								</div>
							</div>
						</article>
					{/each}
				</div>
			{/if}

			<div class="mt-12 text-center">
				<a
					href={resolve('/modules')}
					class="inline-flex min-h-[52px] items-center gap-2 rounded-xl bg-abyss px-8 font-heading text-sm font-bold text-white transition-colors duration-200 hover:bg-royal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal"
				>
					Lihat semua pelatihan <i class="fa-solid fa-arrow-right text-xs" aria-hidden="true"></i>
				</a>
			</div>
		</div>
	</section>

	<!-- Cara belajar -->
	<section aria-labelledby="cara-belajar-heading" class="border-t border-mist bg-ice/60">
		<div class="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
			<div class="max-w-2xl">
				<p class="flex items-center gap-3 font-heading text-xs font-bold tracking-[0.18em] text-royal uppercase">
					<span class="h-px w-8 bg-royal" aria-hidden="true"></span>
					Cara Belajar
				</p>
				<h2 id="cara-belajar-heading" class="mt-3 font-heading text-3xl font-extrabold tracking-tight text-abyss sm:text-4xl">Alur belajar yang jelas</h2>
				<p class="mt-2 text-sm leading-relaxed text-slate-600 sm:text-base">Empat langkah sederhana dari memilih pelatihan hingga meraih sertifikat.</p>
			</div>
			<ol class="mt-10 grid grid-cols-1 gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
				{#each [{ n: '01', title: 'Pilih pelatihan', desc: 'Telusuri katalog dan pilih program yang sesuai dengan tujuan kariermu.' }, { n: '02', title: 'Pelajari materi & ikuti evaluasi', desc: 'Selesaikan modul, kerjakan kuis, dan kumpulkan tugas yang diberikan.' }, { n: '03', title: 'Selesaikan persyaratan', desc: 'Penuhi seluruh materi wajib, kelulusan kuis, dan kriteria tugas.' }, { n: '04', title: 'Raih sertifikat', desc: 'Sertifikat diterbitkan per modul setelah seluruh syarat terpenuhi dan tervalidasi.' }] as s, i (s.n)}
					<li use:reveal={{ delay: i * 70 }} class="border-t-2 border-mist bg-transparent pt-6 transition-colors duration-200 hover:border-royal">
						<p class="font-heading text-sm font-bold tracking-[0.18em] text-royal">{s.n}</p>
						<h3 class="mt-2 font-heading text-base font-bold text-abyss">{s.title}</h3>
						<p class="mt-1.5 text-sm leading-relaxed text-slate-600">{s.desc}</p>
					</li>
				{/each}
			</ol>
			<p class="mt-8 max-w-2xl text-xs leading-relaxed text-slate-500">Sertifikat hanya diterbitkan setelah seluruh syarat terpenuhi dan terverifikasi — pendaftaran atau pembayaran saja tidak otomatis menerbitkan sertifikat.</p>
		</div>
	</section>
</main>

<PublicFooter />
