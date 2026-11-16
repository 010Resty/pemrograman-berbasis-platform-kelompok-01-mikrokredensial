<script lang="ts">
	import { browser } from '$app/environment';
	import { page } from '$app/state';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import Pagination from '$lib/components/Pagination.svelte';
	import { fetchAdminCourseList } from '$lib/api/admin';
	import type { BackendCourse } from '$lib/api/courses';
	import { fetchAdminCategory, type AdminCategory } from '$lib/api/categories';

	/**
	 * Kursus per kategori (admin): header identitas kategori + daftar kursus
	 * yang memakai nama kategori ini (filter server `?category=`).
	 * Dibuka dari daftar kategori (/admin/kategori).
	 */

	const kategoriId = $derived(Number(page.params.id));

	let category = $state<AdminCategory | null>(null);
	let courses = $state<BackendCourse[]>([]);
	let loading = $state(true);
	let loadError = $state('');
	let notFound = $state(false);
	let started = false;
	let loadSeq = 0;

	let pageNum = $state(1);
	let perPage = $state(10);

	function statusClass(status: BackendCourse['status']): string {
		if (status === 'published') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
		if (status === 'archived') return 'border-slate-200 bg-slate-100 text-slate-500';
		return 'border-amber-200 bg-amber-50 text-amber-800';
	}

	function statusLabel(status: BackendCourse['status']): string {
		if (status === 'published') return 'Terbit';
		if (status === 'archived') return 'Arsip';
		return 'Draft';
	}

	async function load(id: number): Promise<void> {
		const my = ++loadSeq;
		loading = true;
		loadError = '';
		notFound = false;
		try {
			const cat = await fetchAdminCategory(id);
			if (my !== loadSeq) return;
			category = cat;
			const list = await fetchAdminCourseList({ category: cat.name, limit: 100 });
			if (my !== loadSeq) return;
			courses = list.filter((c) => c.category === cat.name);
			pageNum = 1;
		} catch (e) {
			if (my !== loadSeq) return;
			if (e instanceof Error && /tidak ditemukan|404/.test(e.message)) {
				notFound = true;
				category = null;
				courses = [];
			} else {
				loadError = e instanceof Error ? e.message : 'Gagal memuat kursus kategori.';
			}
		} finally {
			if (my === loadSeq) loading = false;
		}
	}

	$effect(() => {
		if (!browser || started) return;
		started = true;
		const id = kategoriId;
		if (!Number.isInteger(id) || id <= 0) {
			notFound = true;
			loading = false;
			return;
		}
		void load(id);
	});

	const total = $derived(courses.length);
	const paged = $derived(courses.slice((pageNum - 1) * perPage, pageNum * perPage));
</script>

<svelte:head>
	<title>
		{category ? `Kursus kategori ${category.name}` : 'Kategori tidak ditemukan'} — Admin Aristoteles
	</title>
	<meta name="description" content="Daftar kursus per kategori." />
</svelte:head>

<div class="page-wrap page-stack">
	{#if loading}
		<div class="animate-pulse" aria-label="Memuat kursus kategori">
			<div class="mb-6 h-8 w-64 rounded-xl bg-slate-100"></div>
			<div class="overflow-hidden rounded-2xl border border-slate-200/70 bg-white p-5">
				<div class="h-6 w-56 rounded bg-slate-100"></div>
				<div class="mt-2 h-4 w-40 rounded bg-slate-100"></div>
			</div>
		</div>
	{:else if loadError}
		<div role="alert" class="mx-auto max-w-lg rounded-2xl border border-red-200 bg-red-50 p-10 text-center">
			<i class="fa-solid fa-triangle-exclamation mb-3 text-3xl text-red-400" aria-hidden="true"></i>
			<h1 class="text-xl font-bold text-slate-900">Kursus kategori belum dapat dimuat</h1>
			<p class="mx-auto mt-1 max-w-md text-sm text-red-600">{loadError}</p>
			<button
				type="button"
				onclick={() => {
					const id = Number(page.params.id);
					if (Number.isInteger(id) && id > 0) void load(id);
				}}
				class="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-red-600"
			>
				<i class="fa-solid fa-rotate-right" aria-hidden="true"></i> Coba lagi
			</button>
		</div>
	{:else if !category || notFound}
		<div class="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-10 text-center">
			<i class="fa-solid fa-triangle-exclamation mb-3 text-3xl text-amber-500" aria-hidden="true"></i>
			<h1 class="text-xl font-bold text-slate-900">Kategori tidak ditemukan</h1>
			<p class="mt-1 text-sm text-slate-500">
				ID kategori “{page.params.id}” tidak terdaftar.
			</p>
			<a
				href="/admin/kategori"
				class="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
			>
				<i class="fa-solid fa-arrow-left" aria-hidden="true"></i> Kembali ke Kategori
			</a>
		</div>
	{:else}
		<nav aria-label="Navigasi remah roti" class="flex items-center gap-2 text-xs text-slate-500">
			<a href="/admin/kategori" class="rounded font-semibold text-blue-600 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600">Kategori</a>
			<i class="fa-solid fa-chevron-right text-[10px] text-slate-300" aria-hidden="true"></i>
			<span aria-current="page" class="truncate font-medium text-slate-700">{category.name}</span>
		</nav>

		<PageHeader
			eyebrow="Admin · Katalog · Kategori"
			title={category.name}
			description={`${total} kursus memakai kategori ini · /${category.slug} · ${category.isActive ? 'Aktif' : 'Nonaktif'}`}
		/>

		{#if courses.length === 0}
			<div class="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
				<i class="fa-solid fa-layer-group mb-3 text-3xl text-slate-300" aria-hidden="true"></i>
				<p class="text-sm font-semibold text-slate-700">Belum ada kursus berkategori {category.name}.</p>
				<p class="mt-1 text-xs text-slate-500">Buat kursus baru dari halaman Kursus lalu pilih kategori ini.</p>
			</div>
		{:else}
			<div class="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm">
				<ol class="divide-y divide-slate-100" aria-label="Daftar kursus kategori {category.name}">
					{#each paged as c (c.id)}
						<li class="flex flex-wrap items-center justify-between gap-3 px-6 py-4 transition-colors hover:bg-slate-50/60">
							<span class="min-w-0 flex-1">
								<span class="block truncate text-sm font-bold text-slate-900">{c.title}</span>
								<span class="mt-0.5 block text-xs text-slate-500">
									#{c.id} · {c.level}{c.duration ? ` · ${c.duration}` : ''} · {c.priceLabel}
								</span>
							</span>
							<span class={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${statusClass(c.status)}`}>
								<span class="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true"></span>{statusLabel(c.status)}
							</span>
						</li>
					{/each}
				</ol>
				<div class="border-t border-slate-100 bg-slate-50/70">
					<Pagination bind:page={pageNum} bind:perPage totalItems={total} itemLabel="kursus" label="Navigasi halaman daftar kursus kategori" id="kategori-courses-pagination" activeClass="bg-blue-600 text-white shadow-lg shadow-blue-600/25" />
				</div>
			</div>
		{/if}

		<div class="mt-6">
			<a
				href="/admin/kategori"
				class="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-slate-500"
			>
				<i class="fa-solid fa-arrow-left" aria-hidden="true"></i> Kembali ke Kategori
			</a>
		</div>
	{/if}
</div>
