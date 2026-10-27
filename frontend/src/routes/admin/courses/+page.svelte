<script lang="ts">
	import Pagination from '$lib/components/Pagination.svelte';
	import WarningModal from '$lib/components/WarningModal.svelte';
	import { allInstructors } from '$lib/stores/instructors';

	type Status = 'all' | 'Published' | 'Draft' | 'Archived';

	interface Course {
		id: number;
		title: string;
		category: string;
		instructor: string;
		lessons: number;
		students: number;
		rating: number;
		status: Exclude<Status, 'all'>;
		updated: string;
	}

	let query = $state('');
	let filter = $state<Status>('all');
	let page = $state(1);
	let perPage = $state(5);
	let showAdd = $state(false);
	let formTitle = $state('');
	let formCategory = $state('');
	let formInstructor = $state('');
	let formError = $state('');
	let isSubmitting = $state(false);
	let addBtn: HTMLButtonElement | null = $state(null);
	let firstField: HTMLInputElement | null = $state(null);
	let detailCloseBtn: HTMLButtonElement | null = $state(null);
	let modalOpened = false;
	/** Elemen pemicu modal terakhir, untuk mengembalikan fokus saat modal ditutup. */
	let triggerEl: HTMLElement | null = null;

	/* --- State lihat / ubah / hapus (data lokal halaman ini) --- */
	let notice = $state('');
	let showDetail = $state(false);
	let detailCourse = $state<Course | null>(null);
	let showEdit = $state(false);
	let editId = $state<number | null>(null);
	let formEditTitle = $state('');
	let formEditCategory = $state('');
	let formEditInstructor = $state('');
	let formEditStatus = $state<Course['status']>('Draft');
	let formEditError = $state('');
	let isEditing = $state(false);
	let pendingDelete = $state<Course | null>(null);
	let showDelete = $state(false);

	let courses = $state<Course[]>([
		{ id: 1, title: 'Belajar Figma – Desain UI/UX Esensial', category: 'Desain UI/UX', instructor: 'Kevin Perry', lessons: 12, students: 2450, rating: 4.8, status: 'Published', updated: '20 Agu 2026' },
		{ id: 2, title: 'Sistem PHP & JS untuk Pendidikan', category: 'Pengembangan Web', instructor: 'Max Alexix', lessons: 8, students: 1920, rating: 4.7, status: 'Published', updated: '15 Agu 2026' },
		{ id: 3, title: 'Statistik TI & Analisis Bisnis', category: 'Sains Data', instructor: 'Kevin Perry', lessons: 16, students: 2180, rating: 4.7, status: 'Published', updated: '10 Agu 2026' },
		{ id: 4, title: 'Android 12 & Kotlin Lanjutan', category: 'Pengembangan Web', instructor: 'Max Alexix', lessons: 10, students: 1750, rating: 4.7, status: 'Published', updated: '02 Agu 2026' },
		{ id: 5, title: 'Machine Learning Dasar', category: 'Sains Data', instructor: 'Rian Pratama', lessons: 14, students: 860, rating: 4.9, status: 'Draft', updated: '28 Jul 2026' },
		{ id: 6, title: 'Keamanan Siber Fundamental', category: 'Keamanan', instructor: 'Dewi Anggraini', lessons: 6, students: 320, rating: 4.5, status: 'Draft', updated: '20 Jul 2026' },
		{ id: 7, title: 'Jaringan Komputer Legacy 2019', category: 'Jaringan', instructor: 'Budi Santoso', lessons: 7, students: 410, rating: 4.1, status: 'Archived', updated: '10 Jan 2026' }
	]);

	const filtered = $derived(
		courses.filter((c) => {
			const mStatus = filter === 'all' || c.status === filter;
			const q = query.trim().toLowerCase();
			const mQuery = !q || c.title.toLowerCase().includes(q) || c.instructor.toLowerCase().includes(q);
			return mStatus && mQuery;
		})
	);

	/* Kembali ke halaman 1 setiap filter/pencarian/jumlah baris/data berubah. */
	$effect(() => {
		void query;
		void filter;
		void perPage;
		void courses.length;
		page = 1;
	});

	const paged = $derived(filtered.slice((page - 1) * perPage, page * perPage));

	function statusClass(s: Course['status']) {
		if (s === 'Published') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
		if (s === 'Draft') return 'border-amber-200 bg-amber-50 text-amber-700';
		return 'border-slate-200 bg-slate-100 text-slate-600';
	}

	/** Label tampil untuk status. Nilai data (Published/Draft/Archived) tidak diubah. */
	function statusLabel(s: Status): string {
		if (s === 'Published') return 'Diterbitkan';
		if (s === 'Draft') return 'Draf';
		if (s === 'Archived') return 'Diarsipkan';
		return 'Semua';
	}

	let nextId = $derived(courses.reduce((m, c) => Math.max(m, c.id), 0) + 1);

	/**
	 * Daftar nama instruktur dari registri admin (sumber yang sama dengan
	 * halaman Instruktur). Bukan hasil fetch database — belum ada endpoint
	 * backend daftar instruktur yang disepakati (lihat docs/05).
	 */
	const instructorOptions = $derived(allInstructors());

	function closeAdd() {
		showAdd = false;
		formTitle = '';
		formCategory = '';
		formInstructor = '';
		formError = '';
		isSubmitting = false;
	}

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

	function openAdd() {
		formError = '';
		showEdit = false;
		showDetail = false;
		showAdd = true;
	}

	function submitAdd(event: Event) {
		event.preventDefault();
		if (isSubmitting) return;
		formError = '';
		if (!formTitle.trim()) {
			formError = 'Judul kursus wajib diisi.';
			return;
		}
		if (!formInstructor) {
			formError = 'Pilih instruktur kursus.';
			return;
		}
		isSubmitting = true;
		courses = [
			...courses,
			{
				id: nextId,
				title: formTitle.trim(),
				category: formCategory.trim() || 'Umum',
				instructor: formInstructor.trim() || 'Tim Aristoteles',
				lessons: 0,
				students: 0,
				rating: 5.0,
				status: 'Draft',
				updated: 'Hari ini'
			}
		];
		closeAdd();
	}

	function openDetail(c: Course, el: HTMLElement | null) {
		triggerEl = el;
		detailCourse = c;
		showAdd = false;
		showEdit = false;
		showDetail = true;
	}

	function closeDetail() {
		showDetail = false;
		detailCourse = null;
	}

	function openEdit(c: Course, el: HTMLElement | null) {
		triggerEl = el;
		editId = c.id;
		formEditTitle = c.title;
		formEditCategory = c.category;
		formEditInstructor = c.instructor;
		formEditStatus = c.status;
		formEditError = '';
		isEditing = false;
		showAdd = false;
		showDetail = false;
		showEdit = true;
	}

	function closeEdit() {
		showEdit = false;
		editId = null;
		formEditError = '';
		isEditing = false;
	}

	function submitEdit(event: Event) {
		event.preventDefault();
		if (isEditing || editId === null) return;
		formEditError = '';
		const title = formEditTitle.trim();
		if (!title) {
			formEditError = 'Judul kursus wajib diisi.';
			return;
		}
		isEditing = true;
		courses = courses.map((c) =>
			c.id === editId
				? {
						...c,
						title,
						category: formEditCategory.trim() || 'Umum',
						instructor: formEditInstructor.trim() || 'Tim Aristoteles',
						status: formEditStatus,
						updated: 'Hari ini'
					}
				: c
		);
		closeEdit();
		notice = `Kursus “${title}” diperbarui (data lokal, belum tersimpan permanen).`;
	}

	function askDelete(c: Course, el: HTMLElement | null) {
		triggerEl = el;
		pendingDelete = c;
		showDelete = true;
	}

	function confirmDelete() {
		if (pendingDelete) {
			courses = courses.filter((c) => c.id !== pendingDelete?.id);
			notice = `Kursus “${pendingDelete.title}” dihapus dari daftar ini (data lokal, belum tersimpan permanen).`;
		}
		pendingDelete = null;
		showDelete = false;
	}
</script>

<svelte:head>
	<title>Kursus — Admin Aristoteles</title>
	<meta name="description" content="Kelola kursus mikrokredensial Aristoteles." />
</svelte:head>

<div class="p-4 sm:p-6 lg:p-8">
	<div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
		<div>
			<p class="text-xs font-bold tracking-widest text-blue-600 uppercase">Admin · Kursus</p>
			<h1 class="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Kursus</h1>
			<p class="mt-1 text-sm text-slate-500" role="status">
				{filtered.length} dari {courses.length} kursus ditampilkan
			</p>
		</div>
		<button type="button" bind:this={addBtn} onclick={openAdd} class="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-600/25 transition-colors hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-emerald-600">
			<i class="fa-solid fa-plus" aria-hidden="true"></i> Buat Kursus
		</button>
	</div>

	{#if notice}
		<p
			role="status"
			class="mb-4 flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs font-semibold text-blue-800"
		>
			<i class="fa-solid fa-circle-info mt-0.5 shrink-0" aria-hidden="true"></i>
			<span>{notice}</span>
		</p>
	{/if}

	<div class="mb-5 flex flex-col gap-3 lg:flex-row">
		<div class="relative max-w-md flex-1">
			<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
				<i class="fa-solid fa-magnifying-glass text-sm" aria-hidden="true"></i>
			</div>
			<label for="course-search" class="sr-only">Cari kursus</label>
			<input id="course-search" type="search" bind:value={query} placeholder="Cari judul atau instruktur..." class="w-full rounded-xl border border-slate-200 bg-white py-2.5 pr-4 pl-10 text-sm focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 focus:outline-none" />
		</div>
		<div class="flex flex-wrap gap-2" role="group" aria-label="Filter status kursus">
			{#each (['all', 'Published', 'Draft', 'Archived'] as Status[]) as s (s)}
				<button type="button" onclick={() => (filter = s)} aria-pressed={filter === s} class={`rounded-xl px-4 py-2 text-xs font-bold transition-colors focus-visible:outline-2 focus-visible:outline-emerald-600 ${filter === s ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/25' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
					{statusLabel(s)}
				</button>
			{/each}
		</div>
	</div>

	<div class="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm">
		<div class="h-1 bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-600" aria-hidden="true"></div>
		<div class="overflow-x-auto">
			<table class="w-full min-w-[820px] text-sm">
				<caption class="sr-only">Daftar kursus platform Aristoteles</caption>
				<thead class="bg-emerald-700 text-white">
					<tr class="[&_th]:py-3.5 [&_th]:align-middle">
						<th scope="col" class="px-6 text-left text-xs font-bold tracking-wider uppercase">Kursus</th>
						<th scope="col" class="px-6 text-left text-xs font-bold tracking-wider uppercase">Kategori</th>
						<th scope="col" class="px-6 text-center text-xs font-bold tracking-wider uppercase">Materi</th>
						<th scope="col" class="px-6 text-center text-xs font-bold tracking-wider uppercase">Peserta</th>
						<th scope="col" class="px-6 text-center text-xs font-bold tracking-wider uppercase">Peringkat</th>
						<th scope="col" class="px-6 text-center text-xs font-bold tracking-wider uppercase">Status</th>
						<th scope="col" class="px-6 text-right text-xs font-bold tracking-wider uppercase">Aksi</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-100">
					{#each paged as c, i (c.id)}
						<tr class={`transition-colors hover:bg-emerald-50/50 ${i % 2 === 1 ? 'bg-slate-50/60' : 'bg-white'}`}>
							<td class="px-6 py-3.5">
								<span class="block max-w-64 truncate font-semibold text-slate-900">{c.title}</span>
								<span class="block text-xs text-slate-500">{c.instructor} · Diperbarui {c.updated}</span>
							</td>
							<td class="px-6 py-3.5">
								<span class="inline-flex rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-blue-700">{c.category}</span>
							</td>
							<td class="px-6 py-3.5 text-center font-semibold text-slate-800 tabular-nums">{c.lessons}</td>
							<td class="px-6 py-3.5 text-center font-semibold text-slate-800 tabular-nums">{c.students.toLocaleString('id-ID')}</td>
							<td class="px-6 py-3.5 text-center font-semibold text-amber-600 tabular-nums">★ {c.rating}</td>
							<td class="px-6 py-3.5 text-center">
								<span class={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${statusClass(c.status)}`}><span class="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true"></span>{statusLabel(c.status)}</span>
							</td>
							<td class="px-6 py-3.5">
								<div class="flex justify-end gap-2">
									<button type="button" onclick={(e) => openDetail(c, e.currentTarget)} aria-label={`Lihat detail ${c.title}`} title="Lihat detail" class="flex min-h-9 min-w-9 items-center justify-center rounded-lg border border-slate-200 p-2 text-slate-500 transition-colors hover:bg-slate-50 hover:text-emerald-600 focus-visible:outline-2 focus-visible:outline-emerald-600">
										<i class="fa-solid fa-eye text-sm" aria-hidden="true"></i>
									</button>
									<button type="button" onclick={(e) => openEdit(c, e.currentTarget)} aria-label={`Ubah ${c.title}`} title="Ubah kursus" class="flex min-h-9 min-w-9 items-center justify-center rounded-lg border border-slate-200 p-2 text-slate-500 transition-colors hover:bg-slate-50 hover:text-amber-600 focus-visible:outline-2 focus-visible:outline-amber-600">
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

	{#if showAdd}
		<div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true" aria-labelledby="add-course-title" tabindex="-1" onclick={(e) => { if (e.target === e.currentTarget) closeAdd(); }} onkeydown={(e) => { if (e.key === 'Escape') closeAdd(); }}>
			<form onsubmit={submitAdd} class="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
				<h2 id="add-course-title" class="text-lg font-bold text-slate-900">Buat Kursus</h2>
				<p class="mt-0.5 text-xs text-slate-500">Kursus baru tersimpan sebagai Draf (data lokal browser, belum tersimpan permanen).</p>
					{#if formError}
						<p role="alert" class="mt-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-semibold text-red-700">{formError}</p>
					{/if}
				<div class="mt-4 space-y-3">
					<div>
						<label for="course-title" class="mb-1 block text-xs font-bold text-slate-700">Judul kursus</label>
						<input id="course-title" type="text" bind:this={firstField} bind:value={formTitle} required placeholder="cth. Desain UI/UX Lanjutan" class="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 focus:outline-none" />
					</div>
					<div class="grid grid-cols-2 gap-3">
						<div>
							<label for="course-cat" class="mb-1 block text-xs font-bold text-slate-700">Kategori</label>
							<input id="course-cat" type="text" bind:value={formCategory} placeholder="cth. Desain" class="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 focus:outline-none" />
						</div>
						<div>
							<label for="course-ins" class="mb-1 block text-xs font-bold text-slate-700">Instruktur</label>
							<select id="course-ins" bind:value={formInstructor} class="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 focus:outline-none">
								<option value="">Pilih instruktur…</option>
								<option value="Tim Aristoteles">Tim Aristoteles</option>
								{#each instructorOptions as ins (ins.id)}
									<option value={ins.name}>
										{ins.name} · {ins.expertise}{ins.status === 'Nonaktif' ? ' (Nonaktif)' : ''}
									</option>
								{/each}
							</select>
						</div>
					</div>
				</div>
				<div class="mt-5 flex gap-2">
					<button type="button" onclick={closeAdd} class="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50">
						Batal
					</button>
					<button type="submit" disabled={isSubmitting} class="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60">
						Simpan Draf
					</button>
				</div>
			</form>
		</div>
	{/if}

	{#if showDetail && detailCourse}
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
					<div class="flex items-start justify-between gap-3">
						<div>
							<p class="text-[11px] font-bold tracking-widest text-emerald-600 uppercase">Detail kursus</p>
							<h2 id="detail-course-title" class="mt-0.5 text-xl font-extrabold break-words text-slate-900">
								{detailCourse.title}
							</h2>
						</div>
						<span class={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold whitespace-nowrap ${statusClass(detailCourse.status)}`}>
							<span class="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true"></span>{statusLabel(detailCourse.status)}
						</span>
					</div>

					<dl class="mt-4 grid grid-cols-1 gap-2.5 rounded-2xl bg-slate-50 p-4 text-sm sm:grid-cols-2">
						<div>
							<dt class="text-[10px] font-bold tracking-widest text-slate-400 uppercase">Kategori</dt>
							<dd class="mt-0.5 font-bold text-slate-900">{detailCourse.category}</dd>
						</div>
						<div>
							<dt class="text-[10px] font-bold tracking-widest text-slate-400 uppercase">Instruktur</dt>
							<dd class="mt-0.5 font-bold text-slate-900">{detailCourse.instructor}</dd>
						</div>
						<div>
							<dt class="text-[10px] font-bold tracking-widest text-slate-400 uppercase">Materi</dt>
							<dd class="mt-0.5 font-extrabold text-slate-900 tabular-nums">{detailCourse.lessons}</dd>
						</div>
						<div>
							<dt class="text-[10px] font-bold tracking-widest text-slate-400 uppercase">Peserta</dt>
							<dd class="mt-0.5 font-extrabold text-slate-900 tabular-nums">{detailCourse.students.toLocaleString('id-ID')}</dd>
						</div>
						<div>
							<dt class="text-[10px] font-bold tracking-widest text-slate-400 uppercase">Peringkat</dt>
							<dd class="mt-0.5 font-extrabold text-amber-600 tabular-nums">★ {detailCourse.rating}</dd>
						</div>
						<div>
							<dt class="text-[10px] font-bold tracking-widest text-slate-400 uppercase">Diperbarui</dt>
							<dd class="mt-0.5 font-semibold text-slate-700">{detailCourse.updated}</dd>
						</div>
					</dl>
					<p class="mt-3 text-[11px] leading-relaxed text-slate-400">
						Data lokal halaman ini (demo), belum tersimpan permanen dan belum menjadi katalog resmi.
					</p>

					<div class="mt-5 flex flex-col gap-2 sm:flex-row">
						<button
							type="button"
							onclick={() => {
								const c = detailCourse;
								closeDetail();
								if (c) openEdit(c, null);
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
			<form
				onsubmit={submitEdit}
				class="my-8 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
			>
				<h2 id="edit-course-title" class="text-lg font-bold text-slate-900">Ubah Kursus</h2>
				<p class="mt-0.5 text-xs text-slate-500">Perubahan tersimpan lokal (demo) dan belum tersimpan permanen.</p>
				{#if formEditError}
					<p role="alert" class="mt-3 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-semibold text-red-700">
						{formEditError}
					</p>
				{/if}
				<div class="mt-4 space-y-3">
					<div>
						<label for="edit-course-title" class="mb-1 block text-xs font-bold text-slate-700">Judul kursus</label>
						<input id="edit-course-title" type="text" bind:this={firstField} bind:value={formEditTitle} required placeholder="cth. Desain UI/UX Lanjutan" class="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 focus:outline-none" />
					</div>
					<div class="grid grid-cols-2 gap-3">
						<div>
							<label for="edit-course-cat" class="mb-1 block text-xs font-bold text-slate-700">Kategori</label>
							<input id="edit-course-cat" type="text" bind:value={formEditCategory} placeholder="cth. Desain" class="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 focus:outline-none" />
						</div>
						<div>
							<label for="edit-course-ins" class="mb-1 block text-xs font-bold text-slate-700">Instruktur</label>
							<input id="edit-course-ins" type="text" bind:value={formEditInstructor} placeholder="cth. Kevin Perry" class="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 focus:outline-none" />
						</div>
					</div>
					<div>
						<label for="edit-course-status" class="mb-1 block text-xs font-bold text-slate-700">Status</label>
						<select id="edit-course-status" bind:value={formEditStatus} class="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm focus:border-emerald-500 focus:outline-none">
							<option value="Published">Diterbitkan</option>
							<option value="Draft">Draf</option>
							<option value="Archived">Diarsipkan</option>
						</select>
					</div>
				</div>
				<div class="mt-5 flex gap-2">
					<button type="button" onclick={closeEdit} class="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50">
						Batal
					</button>
					<button type="submit" disabled={isEditing} class="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60">
						Simpan Perubahan
					</button>
				</div>
			</form>
		</div>
	{/if}

	<WarningModal
		bind:open={showDelete}
		type="danger"
		title="Hapus kursus?"
		message={pendingDelete
			? `Kursus “${pendingDelete.title}” akan dihapus dari daftar ini. Tindakan ini hanya berlaku lokal (demo).`
			: 'Kursus ini akan dihapus dari daftar ini.'}
		confirmText="Ya, hapus"
		cancelText="Batal"
		oncancel={() => {
			pendingDelete = null;
			showDelete = false;
		}}
		onconfirm={confirmDelete}
	/>
</div>
