<script lang="ts">
	import { browser } from '$app/environment';
	import Pagination from '$lib/components/Pagination.svelte';
	import WarningModal from '$lib/components/WarningModal.svelte';
	import {
		assignCourseInstructor,
		fetchAdminCourseList,
		type AdminCourseStatus
	} from '$lib/api/admin';
	import {
		createCourse,
		deleteCourse,
		fetchCourseDetail,
		updateCourse,
		type BackendCourse,
		type CreateCourseInput
	} from '$lib/api/courses';
	import { BackendRequestError } from '$lib/api/backend';

	/**
	 * Kelola kursus dari backend (GET /api/v1/instructor/courses — admin melihat semua).
	 * Pencarian + filter status berjalan di server; paginasi lokal (maks 100 baris
	 * karena respons berupa array tanpa total).
	 * Kolom materi/peserta/peringkat tidak ada kontrak backendnya → tidak ditampilkan.
	 * Nama pengampu hanya ada di detail kursus (`instructors[]`), jadi dimuat
	 * per baris halaman aktif lalu di-cache.
	 * Tambah memakai POST /courses (selalu Draf; pembuat otomatis menjadi pengampu,
	 * sehingga tanpa pilihan instruktur). Ubah memakai PATCH; tambah pengampu lewat
	 * POST /admin/courses/:id/instructors. Hapus permanen (cascade di server).
	 * Buat akun teacher langsung (POST /admin/users) sengaja tidak dipakai (K-01:
	 * teacher hanya via undangan di /admin/invitations).
	 */

	type Status = 'all' | AdminCourseStatus;

	const CATEGORIES = [
		'Pengembangan Web',
		'Basis Data',
		'Jaringan',
		'Keamanan',
		'AI & Data',
		'Infrastruktur',
		'Desain',
		'Bisnis'
	];
	const LEVELS = ['Pemula', 'Menengah', 'Lanjutan'];
	const PERIODS = [
		{ value: 'upcoming', label: 'Mendatang' },
		{ value: 'ongoing', label: 'Berjalan' },
		{ value: 'ended', label: 'Selesai' }
	];

	interface CourseFormState {
		title: string;
		category: string;
		level: string;
		duration: string;
		description: string;
		cover: string;
		period: string;
		startMonth: string;
		price: string;
		outcomes: string[];
		tools: string[];
	}

	let query = $state('');
	let debouncedQuery = $state('');
	let filter = $state<Status>('all');
	let page = $state(1);
	let perPage = $state(5);
	let courses = $state<BackendCourse[]>([]);
	let instructorNames = $state(new Map<number, string>());
	let loading = $state(true);
	let loadError = $state('');
	let loadSeq = 0;
	let nameSeq = 0;

	/* --- State lihat / ubah / hapus --- */
	let notice = $state('');
	let actionError = $state('');
	let showDetail = $state(false);
	let detailCourse = $state<BackendCourse | null>(null);
	let detailLoading = $state(false);
	let detailError = $state('');
	let showAdd = $state(false);
	let showEdit = $state(false);
	let editId = $state<number | null>(null);
	let editLoading = $state(false);
	let editError = $state('');
	let formError = $state('');
	let isSubmitting = $state(false);
	let formEditError = $state('');
	let isEditing = $state(false);
	let pendingDelete = $state<BackendCourse | null>(null);
	let showDelete = $state(false);
	let isDeleting = $state(false);
	let addBtn: HTMLButtonElement | null = $state(null);
	let firstField: HTMLInputElement | null = $state(null);
	let detailCloseBtn: HTMLButtonElement | null = $state(null);
	let modalOpened = false;
	/** Elemen pemicu modal terakhir, untuk mengembalikan fokus saat modal ditutup. */
	let triggerEl: HTMLElement | null = null;

	/* --- State form tambah --- */
	let cTitle = $state('');
	let cCategory = $state('');
	let cLevel = $state('Pemula');
	let cDuration = $state('');
	let cDescription = $state('');
	let cCover = $state('');
	let cPeriod = $state('upcoming');
	let cStartMonth = $state('');
	let cPrice = $state('0');
	let cOutcomes = $state<string[]>(['', '']);
	let cTools = $state<string[]>(['']);

	/* --- State form ubah --- */
	let eTitle = $state('');
	let eCategory = $state('');
	let eLevel = $state('Pemula');
	let eDuration = $state('');
	let eDescription = $state('');
	let eCover = $state('');
	let ePeriod = $state('upcoming');
	let eStartMonth = $state('');
	let ePrice = $state('0');
	let eOutcomes = $state<string[]>(['', '']);
	let eTools = $state<string[]>(['']);
	let eStatus = $state<AdminCourseStatus>('draft');
	let eAssignEmail = $state('');

	function statusClass(s: string): string {
		if (s === 'published') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
		if (s === 'draft') return 'border-amber-200 bg-amber-50 text-amber-700';
		return 'border-slate-200 bg-slate-100 text-slate-600';
	}

	/** Label tampil untuk status. Nilai data (draft/published/archived) tidak diubah. */
	function statusLabel(s: Status | string): string {
		if (s === 'published') return 'Diterbitkan';
		if (s === 'draft') return 'Draf';
		if (s === 'archived') return 'Diarsipkan';
		return 'Semua';
	}

	function periodLabel(p: string | null): string {
		return PERIODS.find((x) => x.value === p)?.label ?? p ?? '—';
	}

	function formatDate(iso: string | undefined): string {
		if (!iso) return '—';
		const d = new Date(iso);
		return Number.isNaN(d.getTime())
			? iso
			: d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
	}

	function serverMessage(e: unknown, fallback: string): string {
		if (e instanceof BackendRequestError) {
			const details = (e.errors ?? []).map((x) => `${x.field}: ${x.message}`).join('; ');
			return details ? `${e.message} (${details})` : e.message;
		}
		return e instanceof Error ? e.message : fallback;
	}

	function validateCourseForm(f: CourseFormState): string | null {
		const title = f.title.trim();
		if (title.length < 10) return 'Judul kursus minimal 10 karakter.';
		if (title.length > 120) return 'Judul kursus maksimal 120 karakter.';
		if (!CATEGORIES.includes(f.category)) return 'Pilih kategori yang valid.';
		if (!LEVELS.includes(f.level)) return 'Pilih level yang valid.';
		const durationMonths = Number(f.duration);
		if (!Number.isInteger(durationMonths) || durationMonths < 1 || durationMonths > 36)
			return 'Durasi harus bilangan bulat 1–36 bulan.';
		const description = f.description.trim();
		if (description.length < 30) return 'Deskripsi minimal 30 karakter.';
		if (description.length > 5000) return 'Deskripsi maksimal 5000 karakter.';
		const cover = f.cover.trim();
		if (
			cover &&
			(cover.length > 500 || !(cover.startsWith('/') || /^https?:\/\/.+/i.test(cover)))
		)
			return 'URL sampul tidak valid (kosongkan, atau pakai path /api… / http(s) maks 500 karakter).';
		if (!PERIODS.some((p) => p.value === f.period)) return 'Pilih periode yang valid.';
		const startMonth = f.startMonth.trim();
		if (!startMonth) return 'Bulan mulai wajib diisi.';
		if (startMonth.length > 100) return 'Bulan mulai maksimal 100 karakter.';
		const priceNominal = Number(f.price);
		if (!Number.isInteger(priceNominal) || priceNominal < 0)
			return 'Harga harus bilangan bulat ≥ 0 (0 = gratis).';
		const outcomes = f.outcomes.map((o) => o.trim()).filter(Boolean);
		if (outcomes.length < 2) return 'Minimal 2 capaian pembelajaran.';
		if (outcomes.length > 20) return 'Maksimal 20 capaian pembelajaran.';
		if (outcomes.some((o) => o.length < 10))
			return 'Setiap capaian pembelajaran minimal 10 karakter.';
		const tools = f.tools.map((t) => t.trim()).filter(Boolean);
		if (tools.length < 1) return 'Minimal 1 alat/bahan.';
		if (tools.length > 20) return 'Maksimal 20 alat/bahan.';
		return null;
	}

	function buildPayload(f: CourseFormState): CreateCourseInput {
		return {
			title: f.title.trim(),
			category: f.category,
			level: f.level,
			durationMonths: Number(f.duration),
			description: f.description.trim(),
			coverUrl: f.cover.trim() || null,
			period: f.period as 'upcoming' | 'ongoing' | 'ended',
			startMonth: f.startMonth.trim(),
			priceNominal: Number(f.price),
			outcomes: f.outcomes.map((o) => o.trim()).filter(Boolean),
			tools: f.tools.map((t) => t.trim()).filter(Boolean)
		};
	}

	function createFormState(): CourseFormState {
		return {
			title: cTitle,
			category: cCategory,
			level: cLevel,
			duration: cDuration,
			description: cDescription,
			cover: cCover,
			period: cPeriod,
			startMonth: cStartMonth,
			price: cPrice,
			outcomes: cOutcomes,
			tools: cTools
		};
	}

	function editFormState(): CourseFormState {
		return {
			title: eTitle,
			category: eCategory,
			level: eLevel,
			duration: eDuration,
			description: eDescription,
			cover: eCover,
			period: ePeriod,
			startMonth: eStartMonth,
			price: ePrice,
			outcomes: eOutcomes,
			tools: eTools
		};
	}

	async function load(): Promise<void> {
		const my = ++loadSeq;
		loading = true;
		loadError = '';
		actionError = '';
		try {
			const res = await fetchAdminCourseList({
				q: debouncedQuery.trim() || undefined,
				status: filter === 'all' ? undefined : filter,
				limit: 100
			});
			if (my !== loadSeq) return;
			courses = res;
		} catch (e) {
			if (my !== loadSeq) return;
			loadError = serverMessage(e, 'Gagal memuat kursus.');
		} finally {
			if (my === loadSeq) loading = false;
		}
	}

	const filtered = $derived(courses);
	const paged = $derived(filtered.slice((page - 1) * perPage, page * perPage));

	/** Nama pengampu per baris halaman aktif (satu-satunya sumber: detail kursus). */
	async function ensureNames(list: BackendCourse[]): Promise<void> {
		const missing = list.filter((c) => !instructorNames.has(c.id));
		if (missing.length === 0) return;
		const my = ++nameSeq;
		const entries = await Promise.all(
			missing.map(async (c) => {
				try {
					const d = await fetchCourseDetail(c.id);
					const names = (d.instructors ?? []).map((i) => i.name).join(', ') || '—';
					return [c.id, names] as const;
				} catch {
					return [c.id, '—'] as const;
				}
			})
		);
		if (my !== nameSeq) return;
		const next = new Map(instructorNames);
		for (const [id, names] of entries) next.set(id, names);
		instructorNames = next;
	}

	function instructorLabel(c: BackendCourse): string {
		if (!instructorNames.has(c.id)) return '…';
		return instructorNames.get(c.id) ?? '—';
	}

	/** Buang cache nama pengampu satu kursus (paksa muat ulang). */
	function dropName(id: number): void {
		if (!instructorNames.has(id)) return;
		const next = new Map(instructorNames);
		next.delete(id);
		instructorNames = next;
	}

	// Debounce pencarian 400 ms + kembali ke halaman 1.
	$effect(() => {
		const q = query;
		const t = setTimeout(() => {
			if (debouncedQuery !== q) {
				debouncedQuery = q;
				page = 1;
			}
		}, 400);
		return () => clearTimeout(t);
	});

	// Pencarian/filter baru → halaman 1.
	$effect(() => {
		void debouncedQuery;
		void filter;
		page = 1;
	});

	// Jepit halaman bila data menyusut (mis. setelah hapus).
	$effect(() => {
		const maxPage = Math.max(1, Math.ceil(filtered.length / perPage));
		if (page > maxPage) page = maxPage;
	});

	$effect(() => {
		if (!browser) return;
		void filter;
		void debouncedQuery;
		void load();
	});

	$effect(() => {
		if (!browser || loading || loadError) return;
		void page;
		void perPage;
		void courses;
		void ensureNames(paged);
	});

	$effect(() => {
		if (showAdd || showEdit) {
			modalOpened = true;
			firstField?.focus();
		} else if (showDetail) {
			modalOpened = true;
			detailCloseBtn?.focus();
		} else if (modalOpened) {
			(triggerEl ?? addBtn)?.focus();
			triggerEl = null;
		}
	});

	function resetCreateForm(): void {
		cTitle = '';
		cCategory = '';
		cLevel = 'Pemula';
		cDuration = '';
		cDescription = '';
		cCover = '';
		cPeriod = 'upcoming';
		cStartMonth = '';
		cPrice = '0';
		cOutcomes = ['', ''];
		cTools = [''];
	}

	function closeAdd() {
		showAdd = false;
		formError = '';
		isSubmitting = false;
	}

	function openAdd() {
		formError = '';
		resetCreateForm();
		showEdit = false;
		showDetail = false;
		showAdd = true;
	}

	async function submitAdd(event: Event) {
		event.preventDefault();
		if (isSubmitting) return;
		formError = '';
		const err = validateCourseForm(createFormState());
		if (err) {
			formError = err;
			return;
		}
		isSubmitting = true;
		try {
			const created = await createCourse(buildPayload(createFormState()));
			closeAdd();
			notice = `Kursus “${created.title}” dibuat sebagai Draf. Pembuat otomatis menjadi pengampu.`;
			page = 1;
			await load();
		} catch (e) {
			formError = serverMessage(e, 'Gagal membuat kursus.');
		} finally {
			isSubmitting = false;
		}
	}

	async function openDetail(id: number, el: HTMLElement | null) {
		triggerEl = el;
		showAdd = false;
		showEdit = false;
		showDetail = true;
		detailCourse = null;
		detailError = '';
		detailLoading = true;
		try {
			detailCourse = await fetchCourseDetail(id);
		} catch (e) {
			detailError = serverMessage(e, 'Gagal memuat detail kursus.');
		} finally {
			detailLoading = false;
		}
	}

	function closeDetail() {
		showDetail = false;
		detailCourse = null;
		detailError = '';
	}

	async function openEdit(id: number, el: HTMLElement | null) {
		triggerEl = el;
		editId = id;
		editError = '';
		formEditError = '';
		isEditing = false;
		eAssignEmail = '';
		showAdd = false;
		showDetail = false;
		showEdit = true;
		editLoading = true;
		try {
			const d = await fetchCourseDetail(id);
			eTitle = d.title;
			eCategory = d.category ?? '';
			eLevel = d.level;
			const m = /^(\d+)/.exec(d.duration ?? '');
			eDuration = m ? m[1] : '';
			eDescription = d.description ?? '';
			eCover = d.image ?? '';
			ePeriod = d.period;
			eStartMonth = d.startMonth ?? '';
			ePrice = String(d.priceNominal ?? 0);
			eOutcomes = d.outcomes && d.outcomes.length > 0 ? [...d.outcomes] : ['', ''];
			eTools = d.tools && d.tools.length > 0 ? [...d.tools] : [''];
			eStatus = d.status;
		} catch (e) {
			editError = serverMessage(e, 'Gagal memuat data kursus untuk diubah.');
		} finally {
			editLoading = false;
		}
	}

	function closeEdit() {
		showEdit = false;
		editId = null;
		editError = '';
		formEditError = '';
		isEditing = false;
		eAssignEmail = '';
	}

	async function submitEdit(event: Event) {
		event.preventDefault();
		if (isEditing || editId === null) return;
		formEditError = '';
		const err = validateCourseForm(editFormState());
		if (err) {
			formEditError = err;
			return;
		}
		const email = eAssignEmail.trim();
		if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
			formEditError = 'Format email pengampu tidak valid.';
			return;
		}
		isEditing = true;
		const id = editId;
		try {
			const updated = await updateCourse(id, { ...buildPayload(editFormState()), status: eStatus });
			let assignNote = '';
			if (email) {
				try {
					await assignCourseInstructor(id, { email });
				} catch (e) {
					assignNote = ` Namun penugasan pengampu gagal: ${serverMessage(e, 'gagal menugaskan pengampu.')}`;
					actionError = `Kursus “${updated.title}” diperbarui, tetapi penugasan ${email} gagal: ${serverMessage(e, 'gagal.')}`;
				}
			}
			if (!assignNote) {
				notice = `Kursus “${updated.title}” diperbarui.${email ? ' Pengampu ditambahkan.' : ''}`;
			} else {
				notice = `Kursus “${updated.title}” diperbarui.${assignNote}`;
			}
			dropName(id);
			closeEdit();
			await load();
		} catch (e) {
			formEditError = serverMessage(e, 'Gagal menyimpan perubahan.');
		} finally {
			isEditing = false;
		}
	}

	function askDelete(c: BackendCourse, el: HTMLElement | null) {
		triggerEl = el;
		pendingDelete = c;
		showDelete = true;
	}

	async function confirmDelete() {
		if (!pendingDelete) {
			showDelete = false;
			return;
		}
		isDeleting = true;
		const target = pendingDelete;
		try {
			await deleteCourse(target.id);
			notice = `Kursus “${target.title}” dihapus permanen dari server.`;
			dropName(target.id);
			pendingDelete = null;
			showDelete = false;
			await load();
		} catch (e) {
			actionError = serverMessage(e, 'Gagal menghapus kursus.');
			showDelete = false;
		} finally {
			isDeleting = false;
		}
	}
</script>

<svelte:head>
	<title>Kursus — Admin Aristoteles</title>
	<meta name="description" content="Kelola kursus mikrokredensial Aristoteles." />
</svelte:head>

<div class="p-4 sm:p-6 lg:p-8">
	<div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
		<div>
			<p class="text-xs font-bold tracking-widest text-emerald-600 uppercase">Admin · Kursus</p>
			<h1 class="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Kursus</h1>
			<p class="mt-1 text-sm text-slate-500" role="status">
				{courses.length} kursus ditampilkan
				{#if !loading && !loadError && courses.length >= 100}
					<span class="text-xs text-slate-400">(maks 100 pertama — persempit pencarian bila kurang)</span>
				{/if}
			</p>
		</div>
		<button type="button" bind:this={addBtn} onclick={openAdd} class="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-600/25 transition-colors hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-emerald-600">
			<i class="fa-solid fa-plus" aria-hidden="true"></i> Buat Kursus
		</button>
	</div>

	{#if notice}
		<p
			role="status"
			class="mb-4 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-semibold text-emerald-800"
		>
			<i class="fa-solid fa-circle-check mt-0.5 shrink-0" aria-hidden="true"></i>
			<span>{notice}</span>
		</p>
	{/if}
	{#if actionError}
		<p
			role="alert"
			class="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-700"
		>
			<i class="fa-solid fa-circle-exclamation mt-0.5 shrink-0" aria-hidden="true"></i>
			<span>{actionError}</span>
		</p>
	{/if}

	<div class="mb-5 flex flex-col gap-3 lg:flex-row">
		<div class="relative max-w-md flex-1">
			<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
				<i class="fa-solid fa-magnifying-glass text-sm" aria-hidden="true"></i>
			</div>
			<label for="course-search" class="sr-only">Cari kursus</label>
			<input id="course-search" type="search" bind:value={query} placeholder="Cari judul atau deskripsi..." autocomplete="off" class="w-full rounded-xl border border-slate-200 bg-white py-2.5 pr-4 pl-10 text-sm focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 focus:outline-none" />
		</div>
		<div class="flex flex-wrap gap-2" role="group" aria-label="Filter status kursus">
			{#each (['all', 'published', 'draft', 'archived'] as Status[]) as s (s)}
				<button type="button" onclick={() => { filter = s; }} aria-pressed={filter === s} class={`rounded-xl px-4 py-2 text-xs font-bold transition-colors focus-visible:outline-2 focus-visible:outline-emerald-600 ${filter === s ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/25' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
					{statusLabel(s)}
				</button>
			{/each}
		</div>
	</div>

	{#if loading}
		<div class="overflow-hidden rounded-2xl border border-slate-200/70 bg-white" aria-label="Memuat kursus">
			<div class="space-y-0 divide-y divide-slate-100">
				{#each [1, 2, 3, 4, 5] as i (i)}
					<div class="flex items-center gap-3 px-6 py-3.5">
						<div class="min-w-0 flex-1 space-y-1.5">
							<div class="h-4 w-48 animate-pulse rounded bg-slate-100"></div>
							<div class="h-3 w-64 animate-pulse rounded bg-slate-100"></div>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{:else if loadError}
		<div role="alert" class="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
			<p class="text-sm font-bold text-red-700">Daftar kursus belum dapat dimuat</p>
			<p class="mx-auto mt-1 max-w-md text-xs text-red-600">{loadError}</p>
			<button
				type="button"
				onclick={() => void load()}
				class="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-red-600"
			>
				<i class="fa-solid fa-rotate-right" aria-hidden="true"></i> Coba lagi
			</button>
		</div>
	{:else}
		<div class="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm">
			<div class="h-1 bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-600" aria-hidden="true"></div>
			<div class="overflow-x-auto">
				<table class="w-full min-w-[640px] text-sm">
					<caption class="sr-only">Daftar kursus platform Aristoteles</caption>
					<thead class="bg-emerald-700 text-white">
						<tr class="[&_th]:py-3.5 [&_th]:align-middle">
							<th scope="col" class="px-6 text-left text-xs font-bold tracking-wider uppercase">Kursus</th>
							<th scope="col" class="px-6 text-left text-xs font-bold tracking-wider uppercase">Kategori</th>
							<th scope="col" class="px-6 text-left text-xs font-bold tracking-wider uppercase">Harga</th>
							<th scope="col" class="px-6 text-center text-xs font-bold tracking-wider uppercase">Status</th>
							<th scope="col" class="px-6 text-right text-xs font-bold tracking-wider uppercase">Aksi</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-slate-100">
						{#each paged as c, i (c.id)}
							<tr class={`transition-colors hover:bg-emerald-50/50 ${i % 2 === 1 ? 'bg-slate-50/60' : 'bg-white'}`}>
								<td class="px-6 py-3.5">
									<span class="block max-w-64 truncate font-semibold text-slate-900">{c.title}</span>
									<span class="block text-xs text-slate-500">{instructorLabel(c)} · Diperbarui {formatDate(c.updatedAt ?? c.createdAt)}</span>
								</td>
								<td class="px-6 py-3.5">
									<span class="inline-flex rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-blue-700">{c.category ?? '—'}</span>
								</td>
								<td class="px-6 py-3.5 whitespace-nowrap text-slate-700">{c.priceLabel}</td>
								<td class="px-6 py-3.5 text-center">
									<span class={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${statusClass(c.status)}`}><span class="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true"></span>{statusLabel(c.status)}</span>
								</td>
								<td class="px-6 py-3.5">
									<div class="flex justify-end gap-2">
										<button type="button" onclick={(e) => void openDetail(c.id, e.currentTarget)} aria-label={`Lihat detail ${c.title}`} title="Lihat detail" class="flex min-h-9 min-w-9 items-center justify-center rounded-lg border border-slate-200 p-2 text-slate-500 transition-colors hover:bg-slate-50 hover:text-emerald-600 focus-visible:outline-2 focus-visible:outline-emerald-600">
											<i class="fa-solid fa-eye text-sm" aria-hidden="true"></i>
										</button>
										<button type="button" onclick={(e) => void openEdit(c.id, e.currentTarget)} aria-label={`Ubah ${c.title}`} title="Ubah kursus" class="flex min-h-9 min-w-9 items-center justify-center rounded-lg border border-slate-200 p-2 text-slate-500 transition-colors hover:bg-slate-50 hover:text-amber-600 focus-visible:outline-2 focus-visible:outline-amber-600">
											<i class="fa-solid fa-pen text-sm" aria-hidden="true"></i>
										</button>
										<button type="button" onclick={(e) => askDelete(c, e.currentTarget)} aria-label={`Hapus ${c.title}`} title="Hapus kursus" class="flex min-h-9 min-w-9 items-center justify-center rounded-lg border border-slate-200 p-2 text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:outline-2 focus-visible:outline-red-500">
											<i class="fa-solid fa-trash text-sm" aria-hidden="true"></i>
										</button>
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			{#if filtered.length === 0}
				<p class="border-t border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">Tidak ada kursus yang cocok dengan pencarian.</p>
			{/if}
			<div class="border-t border-slate-100 bg-slate-50/70">
				<Pagination bind:page bind:perPage totalItems={filtered.length} itemLabel="kursus" label="Navigasi halaman tabel kursus" id="course-pagination" activeClass="bg-emerald-600 text-white shadow-lg shadow-emerald-600/25" />
			</div>
		</div>
	{/if}

	{#if showAdd}
		<div class="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/50 p-4" role="dialog" aria-modal="true" aria-labelledby="add-course-title" tabindex="-1" onclick={(e) => { if (e.target === e.currentTarget) closeAdd(); }} onkeydown={(e) => { if (e.key === 'Escape') closeAdd(); }}>
			<form onsubmit={submitAdd} class="my-8 w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl" novalidate>
				<h2 id="add-course-title" class="text-lg font-bold text-slate-900">Buat Kursus</h2>
				<p class="mt-0.5 text-xs text-slate-500">Kursus baru tersimpan sebagai Draf. Anda otomatis menjadi pengampu.</p>
				{#if formError}
					<p role="alert" class="mt-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-semibold text-red-700">{formError}</p>
				{/if}
				<div class="mt-4 space-y-3">
					<div>
						<label for="course-title" class="mb-1 block text-xs font-bold text-slate-700">Judul kursus <span class="text-red-500" aria-hidden="true">*</span></label>
						<input id="course-title" type="text" bind:this={firstField} bind:value={cTitle} required placeholder="cth. Desain UI/UX Lanjutan" class="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 focus:outline-none" />
						<p class="mt-1 text-[11px] text-slate-400">10–120 karakter.</p>
					</div>
					<div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
						<div>
							<label for="course-cat" class="mb-1 block text-xs font-bold text-slate-700">Kategori <span class="text-red-500" aria-hidden="true">*</span></label>
							<select id="course-cat" bind:value={cCategory} class="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 focus:border-emerald-500 focus:outline-none">
								<option value="">Pilih…</option>
								{#each CATEGORIES as cat (cat)}
									<option value={cat}>{cat}</option>
								{/each}
							</select>
						</div>
						<div>
							<label for="course-level" class="mb-1 block text-xs font-bold text-slate-700">Level <span class="text-red-500" aria-hidden="true">*</span></label>
							<select id="course-level" bind:value={cLevel} class="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 focus:border-emerald-500 focus:outline-none">
								{#each LEVELS as lv (lv)}
									<option value={lv}>{lv}</option>
								{/each}
							</select>
						</div>
						<div>
							<label for="course-duration" class="mb-1 block text-xs font-bold text-slate-700">Durasi (bulan) <span class="text-red-500" aria-hidden="true">*</span></label>
							<input id="course-duration" type="number" min="1" max="36" step="1" bind:value={cDuration} placeholder="cth. 3" class="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-emerald-500 focus:outline-none" />
						</div>
					</div>
					<div>
						<label for="course-desc" class="mb-1 block text-xs font-bold text-slate-700">Deskripsi <span class="text-red-500" aria-hidden="true">*</span></label>
						<textarea id="course-desc" rows="3" bind:value={cDescription} placeholder="Deskripsi lengkap kursus…" class="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 focus:outline-none"></textarea>
						<p class="mt-1 text-[11px] text-slate-400">{cDescription.trim().length}/5000 karakter (minimal 30).</p>
					</div>
					<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
						<div>
							<label for="course-period" class="mb-1 block text-xs font-bold text-slate-700">Periode <span class="text-red-500" aria-hidden="true">*</span></label>
							<select id="course-period" bind:value={cPeriod} class="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 focus:border-emerald-500 focus:outline-none">
								{#each PERIODS as p (p.value)}
									<option value={p.value}>{p.label}</option>
								{/each}
							</select>
						</div>
						<div>
							<label for="course-start" class="mb-1 block text-xs font-bold text-slate-700">Bulan mulai <span class="text-red-500" aria-hidden="true">*</span></label>
							<input id="course-start" type="text" bind:value={cStartMonth} placeholder="cth. Jan 2026" class="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-emerald-500 focus:outline-none" />
						</div>
					</div>
					<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
						<div>
							<label for="course-price" class="mb-1 block text-xs font-bold text-slate-700">Harga nominal (Rp) <span class="text-red-500" aria-hidden="true">*</span></label>
							<input id="course-price" type="number" min="0" step="1" bind:value={cPrice} placeholder="cth. 0" class="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-emerald-500 focus:outline-none" />
							<p class="mt-1 text-[11px] text-slate-400">0 = gratis.</p>
						</div>
						<div>
							<label for="course-cover" class="mb-1 block text-xs font-bold text-slate-700">URL sampul (opsional)</label>
							<input id="course-cover" type="text" bind:value={cCover} placeholder="https://… atau /api/v1/files/…/content" class="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-emerald-500 focus:outline-none" />
						</div>
					</div>
					<div>
						<span id="course-outcomes-label" class="mb-1 block text-xs font-bold text-slate-700">Capaian pembelajaran <span class="text-red-500" aria-hidden="true">*</span> <span class="font-medium text-slate-400">(min 2, tiap ≥ 10 karakter)</span></span>
						<div class="space-y-2" role="group" aria-labelledby="course-outcomes-label">
							{#each cOutcomes as _, i (i)}
								<div class="flex gap-2">
									<input type="text" bind:value={cOutcomes[i]} placeholder={`Capaian ${i + 1}`} aria-label={`Capaian ${i + 1}`} class="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-emerald-500 focus:outline-none" />
									<button type="button" onclick={() => { cOutcomes = cOutcomes.filter((__, j) => j !== i); }} disabled={cOutcomes.length <= 1} aria-label={`Hapus capaian ${i + 1}`} class="flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40">
										<i class="fa-solid fa-xmark text-sm" aria-hidden="true"></i>
									</button>
								</div>
							{/each}
							{#if cOutcomes.length < 20}
								<button type="button" onclick={() => { cOutcomes = [...cOutcomes, '']; }} class="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50">
									<i class="fa-solid fa-plus" aria-hidden="true"></i> Tambah capaian
								</button>
							{/if}
						</div>
					</div>
					<div>
						<span id="course-tools-label" class="mb-1 block text-xs font-bold text-slate-700">Alat/bahan <span class="text-red-500" aria-hidden="true">*</span> <span class="font-medium text-slate-400">(min 1)</span></span>
						<div class="space-y-2" role="group" aria-labelledby="course-tools-label">
							{#each cTools as _, i (i)}
								<div class="flex gap-2">
									<input type="text" bind:value={cTools[i]} placeholder={`Alat ${i + 1}`} aria-label={`Alat ${i + 1}`} class="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-emerald-500 focus:outline-none" />
									<button type="button" onclick={() => { cTools = cTools.filter((__, j) => j !== i); }} disabled={cTools.length <= 1} aria-label={`Hapus alat ${i + 1}`} class="flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40">
										<i class="fa-solid fa-xmark text-sm" aria-hidden="true"></i>
									</button>
								</div>
							{/each}
							{#if cTools.length < 20}
								<button type="button" onclick={() => { cTools = [...cTools, '']; }} class="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50">
									<i class="fa-solid fa-plus" aria-hidden="true"></i> Tambah alat
								</button>
							{/if}
						</div>
					</div>
				</div>
				<div class="mt-5 flex gap-2">
					<button type="button" onclick={closeAdd} class="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50">
						Batal
					</button>
					<button type="submit" disabled={isSubmitting} class="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60">
						{isSubmitting ? 'Menyimpan…' : 'Simpan Draf'}
					</button>
				</div>
			</form>
		</div>
	{/if}

	{#if showDetail}
		<div
			class="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/50 p-4"
			role="dialog"
			aria-modal="true"
			aria-labelledby="detail-course-title"
			tabindex="-1"
			onclick={(e) => {
				if (e.target === e.currentTarget) closeDetail();
			}}
			onkeydown={(e) => {
				if (e.key === 'Escape') closeDetail();
			}}
		>
			<div class="my-8 w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
				<div class="h-1.5 bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-600" aria-hidden="true"></div>
				<div class="p-6">
					{#if detailLoading}
						<div class="animate-pulse space-y-2" aria-label="Memuat detail kursus">
							<div class="h-6 w-56 rounded bg-slate-100"></div>
							<div class="h-4 w-40 rounded bg-slate-100"></div>
						</div>
					{:else if detailError || !detailCourse}
						<p role="alert" class="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-semibold text-red-700">
							{detailError || 'Detail kursus tidak tersedia.'}
						</p>
						<button
							type="button"
							bind:this={detailCloseBtn}
							onclick={closeDetail}
							class="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-slate-500"
						>
							Tutup
						</button>
					{:else}
						{@const dc = detailCourse}
						<div class="flex items-start justify-between gap-3">
							<div>
								<p class="text-[11px] font-bold tracking-widest text-emerald-600 uppercase">Detail kursus</p>
								<h2 id="detail-course-title" class="mt-0.5 text-xl font-extrabold break-words text-slate-900">
									{dc.title}
								</h2>
							</div>
							<span class={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold whitespace-nowrap ${statusClass(dc.status)}`}>
								<span class="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true"></span>{statusLabel(dc.status)}
							</span>
						</div>

						{#if dc.image}
							<img src={dc.image} alt={`Sampul ${dc.title}`} class="mt-4 h-32 w-full rounded-xl border border-slate-200 object-cover" loading="lazy" />
						{/if}

						{#if dc.description}
							<p class="mt-4 text-sm leading-relaxed text-slate-600">{dc.description}</p>
						{/if}

						<dl class="mt-4 grid grid-cols-1 gap-2.5 rounded-2xl bg-slate-50 p-4 text-sm sm:grid-cols-2">
							<div>
								<dt class="text-[10px] font-bold tracking-widest text-slate-400 uppercase">Kategori</dt>
								<dd class="mt-0.5 font-bold text-slate-900">{dc.category ?? '—'}</dd>
							</div>
							<div>
								<dt class="text-[10px] font-bold tracking-widest text-slate-400 uppercase">Level</dt>
								<dd class="mt-0.5 font-bold text-slate-900">{dc.level}</dd>
							</div>
							<div>
								<dt class="text-[10px] font-bold tracking-widest text-slate-400 uppercase">Durasi</dt>
								<dd class="mt-0.5 font-bold text-slate-900">{dc.duration ?? '—'}</dd>
							</div>
							<div>
								<dt class="text-[10px] font-bold tracking-widest text-slate-400 uppercase">Harga</dt>
								<dd class="mt-0.5 font-bold text-slate-900">{dc.priceLabel}</dd>
							</div>
							<div>
								<dt class="text-[10px] font-bold tracking-widest text-slate-400 uppercase">Periode</dt>
								<dd class="mt-0.5 font-bold text-slate-900">{periodLabel(dc.period)} · {dc.startMonth ?? '—'}</dd>
							</div>
							<div>
								<dt class="text-[10px] font-bold tracking-widest text-slate-400 uppercase">Pengampu</dt>
								<dd class="mt-0.5 font-bold text-slate-900">
									{(dc.instructors ?? []).map((x) => x.name).join(', ') || '—'}
								</dd>
							</div>
						</dl>

						{#if dc.outcomes && dc.outcomes.length > 0}
							<h3 class="mt-4 text-xs font-bold tracking-widest text-slate-500 uppercase">Capaian pembelajaran</h3>
							<ul class="mt-1.5 list-disc space-y-1 pl-5 text-sm text-slate-700">
								{#each dc.outcomes as o (o)}
									<li>{o}</li>
								{/each}
							</ul>
						{/if}

						{#if dc.tools && dc.tools.length > 0}
							<h3 class="mt-4 text-xs font-bold tracking-widest text-slate-500 uppercase">Alat/bahan</h3>
							<div class="mt-1.5 flex flex-wrap gap-1.5">
								{#each dc.tools as t (t)}
									<span class="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-700">{t}</span>
								{/each}
							</div>
						{/if}

						<div class="mt-5 flex flex-col gap-2 sm:flex-row">
							<button
								type="button"
								onclick={() => {
									const id = dc.id;
									closeDetail();
									void openEdit(id, null);
								}}
								class="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-emerald-600"
							>
								<i class="fa-solid fa-pen" aria-hidden="true"></i> Ubah
							</button>
							<button
								type="button"
								bind:this={detailCloseBtn}
								onclick={closeDetail}
								class="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-slate-500"
							>
								Tutup
							</button>
						</div>
					{/if}
				</div>
			</div>
		</div>
	{/if}

	{#if showEdit}
		<div
			class="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/50 p-4"
			role="dialog"
			aria-modal="true"
			aria-labelledby="edit-course-title"
			tabindex="-1"
			onclick={(e) => {
				if (e.target === e.currentTarget) closeEdit();
			}}
			onkeydown={(e) => {
				if (e.key === 'Escape') closeEdit();
			}}
		>
			<div class="my-8 w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl">
				<h2 id="edit-course-title" class="text-lg font-bold text-slate-900">Ubah Kursus</h2>
				<p class="mt-0.5 text-xs text-slate-500">Perubahan tersimpan permanen di server.</p>
				{#if editLoading}
					<div class="mt-4 animate-pulse space-y-2" aria-label="Memuat data kursus">
						<div class="h-4 w-48 rounded bg-slate-100"></div>
						<div class="h-10 w-full rounded-xl bg-slate-100"></div>
						<div class="h-10 w-full rounded-xl bg-slate-100"></div>
					</div>
				{:else if editError}
					<p role="alert" class="mt-3 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-semibold text-red-700">
						{editError}
					</p>
					<div class="mt-5 flex gap-2">
						<button type="button" onclick={closeEdit} class="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50">
							Tutup
						</button>
					</div>
				{:else}
					<form onsubmit={submitEdit} novalidate>
						{#if formEditError}
							<p role="alert" class="mt-3 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-semibold text-red-700">
								{formEditError}
							</p>
						{/if}
						<div class="mt-4 space-y-3">
							<div>
								<label for="edit-course-title" class="mb-1 block text-xs font-bold text-slate-700">Judul kursus</label>
								<input id="edit-course-title" type="text" bind:this={firstField} bind:value={eTitle} required placeholder="cth. Desain UI/UX Lanjutan" class="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 focus:outline-none" />
							</div>
							<div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
								<div>
									<label for="edit-course-cat" class="mb-1 block text-xs font-bold text-slate-700">Kategori</label>
									<select id="edit-course-cat" bind:value={eCategory} class="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 focus:border-emerald-500 focus:outline-none">
										<option value="">Pilih…</option>
										{#each CATEGORIES as cat (cat)}
											<option value={cat}>{cat}</option>
										{/each}
									</select>
								</div>
								<div>
									<label for="edit-course-level" class="mb-1 block text-xs font-bold text-slate-700">Level</label>
									<select id="edit-course-level" bind:value={eLevel} class="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 focus:border-emerald-500 focus:outline-none">
										{#each LEVELS as lv (lv)}
											<option value={lv}>{lv}</option>
										{/each}
									</select>
								</div>
								<div>
									<label for="edit-course-duration" class="mb-1 block text-xs font-bold text-slate-700">Durasi (bulan)</label>
									<input id="edit-course-duration" type="number" min="1" max="36" step="1" bind:value={eDuration} class="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-emerald-500 focus:outline-none" />
								</div>
							</div>
							<div>
								<label for="edit-course-desc" class="mb-1 block text-xs font-bold text-slate-700">Deskripsi</label>
								<textarea id="edit-course-desc" rows="3" bind:value={eDescription} class="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 focus:outline-none"></textarea>
								<p class="mt-1 text-[11px] text-slate-400">{eDescription.trim().length}/5000 karakter (minimal 30).</p>
							</div>
							<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
								<div>
									<label for="edit-course-period" class="mb-1 block text-xs font-bold text-slate-700">Periode</label>
									<select id="edit-course-period" bind:value={ePeriod} class="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 focus:border-emerald-500 focus:outline-none">
										{#each PERIODS as p (p.value)}
											<option value={p.value}>{p.label}</option>
										{/each}
									</select>
								</div>
								<div>
									<label for="edit-course-start" class="mb-1 block text-xs font-bold text-slate-700">Bulan mulai</label>
									<input id="edit-course-start" type="text" bind:value={eStartMonth} class="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-emerald-500 focus:outline-none" />
								</div>
							</div>
							<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
								<div>
									<label for="edit-course-price" class="mb-1 block text-xs font-bold text-slate-700">Harga nominal (Rp)</label>
									<input id="edit-course-price" type="number" min="0" step="1" bind:value={ePrice} class="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-emerald-500 focus:outline-none" />
									<p class="mt-1 text-[11px] text-slate-400">0 = gratis.</p>
								</div>
								<div>
									<label for="edit-course-cover" class="mb-1 block text-xs font-bold text-slate-700">URL sampul (opsional)</label>
									<input id="edit-course-cover" type="text" bind:value={eCover} class="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-emerald-500 focus:outline-none" />
								</div>
							</div>
							<div>
								<span id="edit-course-outcomes-label" class="mb-1 block text-xs font-bold text-slate-700">Capaian pembelajaran <span class="font-medium text-slate-400">(min 2, tiap ≥ 10 karakter)</span></span>
								<div class="space-y-2" role="group" aria-labelledby="edit-course-outcomes-label">
									{#each eOutcomes as _, i (i)}
										<div class="flex gap-2">
											<input type="text" bind:value={eOutcomes[i]} aria-label={`Capaian ${i + 1}`} class="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-emerald-500 focus:outline-none" />
											<button type="button" onclick={() => { eOutcomes = eOutcomes.filter((__, j) => j !== i); }} disabled={eOutcomes.length <= 1} aria-label={`Hapus capaian ${i + 1}`} class="flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40">
												<i class="fa-solid fa-xmark text-sm" aria-hidden="true"></i>
											</button>
										</div>
									{/each}
									{#if eOutcomes.length < 20}
										<button type="button" onclick={() => { eOutcomes = [...eOutcomes, '']; }} class="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50">
											<i class="fa-solid fa-plus" aria-hidden="true"></i> Tambah capaian
										</button>
									{/if}
								</div>
							</div>
							<div>
								<span id="edit-course-tools-label" class="mb-1 block text-xs font-bold text-slate-700">Alat/bahan <span class="font-medium text-slate-400">(min 1)</span></span>
								<div class="space-y-2" role="group" aria-labelledby="edit-course-tools-label">
									{#each eTools as _, i (i)}
										<div class="flex gap-2">
											<input type="text" bind:value={eTools[i]} aria-label={`Alat ${i + 1}`} class="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-emerald-500 focus:outline-none" />
											<button type="button" onclick={() => { eTools = eTools.filter((__, j) => j !== i); }} disabled={eTools.length <= 1} aria-label={`Hapus alat ${i + 1}`} class="flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40">
												<i class="fa-solid fa-xmark text-sm" aria-hidden="true"></i>
											</button>
										</div>
									{/each}
									{#if eTools.length < 20}
										<button type="button" onclick={() => { eTools = [...eTools, '']; }} class="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50">
											<i class="fa-solid fa-plus" aria-hidden="true"></i> Tambah alat
										</button>
									{/if}
								</div>
							</div>
							<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
								<div>
									<label for="edit-course-status" class="mb-1 block text-xs font-bold text-slate-700">Status</label>
									<select id="edit-course-status" bind:value={eStatus} class="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm focus:border-emerald-500 focus:outline-none">
										<option value="published">Diterbitkan</option>
										<option value="draft">Draf</option>
										<option value="archived">Diarsipkan</option>
									</select>
								</div>
								<div>
									<label for="edit-course-assign" class="mb-1 block text-xs font-bold text-slate-700">Tambah pengampu (opsional)</label>
									<input id="edit-course-assign" type="email" bind:value={eAssignEmail} placeholder="nama@aristoteles.ac.id" autocomplete="off" class="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-emerald-500 focus:outline-none" />
									<p class="mt-1 text-[11px] text-slate-400">Email akun teacher/admin.</p>
								</div>
							</div>
						</div>
						<div class="mt-5 flex gap-2">
							<button type="button" onclick={closeEdit} class="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50">
								Batal
							</button>
							<button type="submit" disabled={isEditing} class="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60">
								{isEditing ? 'Menyimpan…' : 'Simpan Perubahan'}
							</button>
						</div>
					</form>
				{/if}
			</div>
		</div>
	{/if}

	<WarningModal
		bind:open={showDelete}
		type="danger"
		title="Hapus kursus?"
		message={pendingDelete
			? `Kursus “${pendingDelete.title}” akan dihapus permanen dari server beserta seluruh modul, materi, dan datanya. Tindakan ini tidak bisa dibatalkan.`
			: 'Kursus ini akan dihapus permanen dari server.'}
		confirmText="Ya, hapus"
		cancelText="Batal"
		loading={isDeleting}
		oncancel={() => {
			pendingDelete = null;
			showDelete = false;
		}}
		onconfirm={() => void confirmDelete()}
	/>
</div>
