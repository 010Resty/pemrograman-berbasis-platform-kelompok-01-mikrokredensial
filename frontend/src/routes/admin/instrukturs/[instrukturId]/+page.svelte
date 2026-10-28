<script lang="ts">
	import { browser } from '$app/environment';
	import { page } from '$app/state';
	import {
		fetchAdminCourses,
		fetchAdminUser,
		setAdminUserActive,
		type AdminUserDetail
	} from '$lib/api/admin';
	import type { BackendCourse } from '$lib/api/courses';

	/**
	 * Detail instruktur dari backend (GET /api/v1/admin/users/:id).
	 * Tanpa data contoh: nama/email/peran/status/bergabung dari server +
	 * kursus yang dibuat akun ini (GET /api/v1/instructor/courses lalu
	 * saring `createdBy`, karena baris daftar tak memuat `instructors[]`).
	 * Keahlian dan peringkat belum ada endpointnya, jadi tidak ditampilkan.
	 * Ubah nama/email/keahlian belum didukung: PATCH /admin/users/:id
	 * hanya menerima isActive, jadi halaman ini hanya menyediakan
	 * aktif/nonaktif akun.
	 */

	const instrukturId = $derived(Number(page.params.instrukturId));

	let user = $state<AdminUserDetail | null>(null);
	let loading = $state(true);
	let loadError = $state('');
	let notFound = $state(false);
	let toggling = $state(false);
	let actionError = $state('');
	let actionMessage = $state('');
	let taughtCourses = $state<BackendCourse[]>([]);
	let coursesLoading = $state(false);
	let coursesError = $state('');
	let started = false;
	let loadSeq = 0;
	let coursesSeq = 0;

	async function load(id: number): Promise<void> {
		const my = ++loadSeq;
		loading = true;
		loadError = '';
		notFound = false;
		taughtCourses = [];
		coursesError = '';
		try {
			const data = await fetchAdminUser(id);
			if (my !== loadSeq) return;
			user = data;
			if (data.role === 'teacher') void loadCourses(data.id);
		} catch (e) {
			if (my !== loadSeq) return;
			if (e instanceof Error && /tidak ditemukan|404/.test(e.message)) {
				notFound = true;
				user = null;
			} else {
				loadError = e instanceof Error ? e.message : 'Gagal memuat detail instruktur.';
			}
		} finally {
			if (my === loadSeq) loading = false;
		}
	}

	/** Kursus yang dibuat akun ini (saring `createdBy` dari daftar admin). */
	async function loadCourses(id: number): Promise<void> {
		const my = ++coursesSeq;
		coursesLoading = true;
		coursesError = '';
		try {
			const all = await fetchAdminCourses(100);
			if (my !== coursesSeq) return;
			taughtCourses = all.filter((c) => c.createdBy === id);
		} catch (e) {
			if (my !== coursesSeq) return;
			coursesError = e instanceof Error ? e.message : 'Daftar kursus belum dapat dimuat.';
		} finally {
			if (my === coursesSeq) coursesLoading = false;
		}
	}

	$effect(() => {
		if (!browser || started) return;
		started = true;
		const id = instrukturId;
		if (!Number.isInteger(id) || id <= 0) {
			notFound = true;
			loading = false;
			return;
		}
		void load(id);
	});

	function formatDate(iso: string): string {
		const d = new Date(iso);
		return Number.isNaN(d.getTime())
			? iso
			: d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
	}

	function roleLabel(role: string): string {
		if (role === 'teacher') return 'Instruktur';
		if (role === 'admin') return 'Administrator';
		return 'Peserta';
	}

	function initials(name: string): string {
		return (
			name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?'
		);
	}

	function courseStatus(course: BackendCourse): { label: string; classes: string } {
		if (course.status === 'published')
			return { label: 'Terbit', classes: 'bg-emerald-50 text-emerald-700' };
		if (course.status === 'archived') return { label: 'Arsip', classes: 'bg-slate-100 text-slate-500' };
		return { label: 'Draft', classes: 'bg-amber-50 text-amber-700' };
	}

	async function toggleActive(): Promise<void> {
		if (!user || toggling) return;
		toggling = true;
		actionError = '';
		actionMessage = '';
		try {
			await setAdminUserActive(user.id, !user.isActive);
			user = { ...user, isActive: !user.isActive };
			actionMessage = user.isActive
				? 'Akun diaktifkan kembali.'
				: 'Akun dinonaktifkan. Pengguna tidak dapat masuk sampai diaktifkan lagi.';
		} catch (e) {
			actionError = e instanceof Error ? e.message : 'Perubahan status gagal.';
		} finally {
			toggling = false;
		}
	}
</script>

<svelte:head>
	<title>
		{user ? `${user.name} — Profil Instruktur` : 'Instruktur tidak ditemukan'} — Admin Aristoteles
	</title>
	<meta name="description" content="Profil instruktur platform Aristoteles." />
</svelte:head>

<div class="p-4 sm:p-6 lg:p-8">
	{#if loading}
		<div class="animate-pulse" aria-label="Memuat detail instruktur">
			<div class="mb-6 h-8 w-64 rounded-xl bg-slate-100"></div>
			<div class="overflow-hidden rounded-2xl border border-slate-200/70 bg-white">
				<div class="h-24 bg-slate-100"></div>
				<div class="space-y-2 p-5 sm:p-6">
					<div class="h-6 w-56 rounded bg-slate-100"></div>
					<div class="h-4 w-40 rounded bg-slate-100"></div>
				</div>
			</div>
		</div>
	{:else if loadError}
		<div role="alert" class="mx-auto max-w-lg rounded-2xl border border-red-200 bg-red-50 p-10 text-center">
			<i class="fa-solid fa-triangle-exclamation mb-3 text-3xl text-red-400" aria-hidden="true"></i>
			<h1 class="text-xl font-bold text-slate-900">Detail instruktur belum dapat dimuat</h1>
			<p class="mx-auto mt-1 max-w-md text-sm text-red-600">{loadError}</p>
			<button
				type="button"
				onclick={() => {
					const id = Number(page.params.instrukturId);
					if (Number.isInteger(id) && id > 0) void load(id);
				}}
				class="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-red-600"
			>
				<i class="fa-solid fa-rotate-right" aria-hidden="true"></i> Coba lagi
			</button>
		</div>
	{:else if !user || notFound}
		<div class="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-10 text-center">
			<i class="fa-solid fa-triangle-exclamation mb-3 text-3xl text-amber-500" aria-hidden="true"></i>
			<h1 class="text-xl font-bold text-slate-900">Instruktur tidak ditemukan</h1>
			<p class="mt-1 text-sm text-slate-500">
				ID instruktur “{page.params.instrukturId}” tidak terdaftar.
			</p>
			<a
				href="/admin/instrukturs"
				class="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-violet-700 focus-visible:outline-2 focus-visible:outline-violet-600"
			>
				<i class="fa-solid fa-arrow-left" aria-hidden="true"></i> Kembali ke Instruktur
			</a>
		</div>
	{:else}
		<nav aria-label="Navigasi remah roti" class="mb-4 flex items-center gap-2 text-xs text-slate-500">
			<a href="/admin/instrukturs" class="rounded font-semibold text-violet-600 hover:text-violet-700 focus-visible:outline-2 focus-visible:outline-violet-600">Instruktur</a>
			<i class="fa-solid fa-chevron-right text-[10px] text-slate-300" aria-hidden="true"></i>
			<span aria-current="page" class="truncate font-medium text-slate-700">{user.name}</span>
		</nav>

		{#if actionMessage}
			<p
				role="status"
				class="mb-4 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-semibold text-emerald-800"
			>
				<i class="fa-solid fa-circle-check mt-0.5 shrink-0" aria-hidden="true"></i>
				<span>{actionMessage}</span>
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

		{#if user.role !== 'teacher'}
			<p
				role="note"
				class="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-semibold text-amber-800"
			>
				<i class="fa-solid fa-triangle-exclamation mt-0.5 shrink-0" aria-hidden="true"></i>
				<span>Akun ini berperan {roleLabel(user.role)}, bukan instruktur. Ditampilkan karena ID-nya dibuka lewat halaman instruktur.</span>
			</p>
		{/if}

		<header class="mb-6 overflow-hidden rounded-2xl border border-slate-200/70 bg-white">
			<div class="h-24 bg-gradient-to-r from-violet-600 via-indigo-700 to-slate-900" aria-hidden="true"></div>
			<div class="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
				<span
					class="-mt-12 flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-xl font-extrabold text-white shadow-lg sm:-mt-14"
					aria-hidden="true"
				>
					{initials(user.name)}
				</span>
				<div class="min-w-0 flex-1">
					<div class="flex flex-wrap items-center gap-2">
						<h1 class="text-xl font-extrabold text-slate-900 sm:text-2xl">{user.name}</h1>
						<span class={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${user.isActive ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-600'}`}>
							<span class="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true"></span>{user.isActive ? 'Aktif' : 'Nonaktif'}
						</span>
					</div>
					<p class="mt-0.5 text-sm text-slate-500">{user.email} · {roleLabel(user.role)}</p>
					<p class="mt-1 text-[11px] text-slate-400">
						Bergabung {formatDate(user.createdAt)}
					</p>
				</div>
				<div class="flex flex-wrap gap-2">
					<button
						type="button"
						onclick={() => void toggleActive()}
						disabled={toggling}
						class="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-slate-500"
					>
						{#if toggling}
							<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i> Menyimpan…
						{:else if user.isActive}
							<i class="fa-solid fa-ban" aria-hidden="true"></i> Nonaktifkan Akun
						{:else}
							<i class="fa-solid fa-check" aria-hidden="true"></i> Aktifkan Akun
						{/if}
					</button>
				</div>
			</div>
		</header>

		<section
			aria-labelledby="ins-info"
			class="overflow-hidden rounded-2xl border border-slate-200/70 bg-white"
		>
			<h2 id="ins-info" class="border-b border-slate-100 p-5 pb-3 text-lg font-bold text-slate-900">
				Informasi akun
			</h2>
			<dl class="divide-y divide-slate-100 text-sm">
				<div class="flex flex-col gap-0.5 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
					<dt class="text-slate-500">Nama lengkap</dt>
					<dd class="font-semibold text-slate-900">{user.name}</dd>
				</div>
				<div class="flex flex-col gap-0.5 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
					<dt class="text-slate-500">Email</dt>
					<dd class="font-semibold text-slate-900">{user.email}</dd>
				</div>
				<div class="flex flex-col gap-0.5 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
					<dt class="text-slate-500">Peran</dt>
					<dd class="font-semibold text-slate-900">{roleLabel(user.role)}</dd>
				</div>
				<div class="flex flex-col gap-0.5 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
					<dt class="text-slate-500">Status</dt>
					<dd>
						<span class={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${user.isActive ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-600'}`}>
							<span class="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true"></span>{user.isActive ? 'Aktif' : 'Nonaktif'}
						</span>
					</dd>
				</div>
				<div class="flex flex-col gap-0.5 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
					<dt class="text-slate-500">Bergabung</dt>
					<dd class="font-semibold text-slate-900">{formatDate(user.createdAt)}</dd>
				</div>
			</dl>
		</section>

		<section
			aria-labelledby="ins-courses"
			class="mt-6 overflow-hidden rounded-2xl border border-slate-200/70 bg-white"
		>
			<div class="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 p-5 pb-3">
				<h2 id="ins-courses" class="text-lg font-bold text-slate-900">
					Kursus yang dimiliki ({taughtCourses.length})
				</h2>
				<p class="text-[11px] text-slate-400">Kursus yang dibuat akun ini</p>
			</div>
			{#if coursesLoading}
				<div class="space-y-0 divide-y divide-slate-100" aria-label="Memuat kursus instruktur">
					{#each [1, 2, 3] as i (i)}
						<div class="space-y-1.5 px-5 py-4">
							<div class="h-4 w-48 animate-pulse rounded bg-slate-100"></div>
							<div class="h-3 w-32 animate-pulse rounded bg-slate-100"></div>
						</div>
					{/each}
				</div>
			{:else if coursesError}
				<div class="p-5">
					<p role="alert" class="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-semibold text-red-700">
						{coursesError}
					</p>
					<button
						type="button"
						onclick={() => user && void loadCourses(user.id)}
						class="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-violet-600"
					>
						<i class="fa-solid fa-rotate-right" aria-hidden="true"></i> Muat ulang kursus
					</button>
				</div>
			{:else if taughtCourses.length === 0}
				<p class="p-5 text-sm text-slate-500">
					Belum ada kursus yang dibuat {user.name}.
				</p>
			{:else}
				<ul class="divide-y divide-slate-100">
					{#each taughtCourses as course (course.id)}
						{@const st = courseStatus(course)}
						<li class="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
							<span class="min-w-0">
								<span class="block truncate text-sm font-bold text-slate-900">{course.title}</span>
								<span class="mt-0.5 block text-xs text-slate-500">
									{course.category ?? 'Tanpa kategori'} · {course.level}{course.duration ? ` · ${course.duration}` : ''}
								</span>
							</span>
							<span class={`inline-flex w-fit shrink-0 items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ${st.classes}`}>
								{st.label}
							</span>
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		<section
			aria-labelledby="ins-batas"
			class="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-5"
		>
			<h2 id="ins-batas" class="text-sm font-bold text-slate-800">Cakupan data halaman ini</h2>
			<p class="mt-1 text-xs leading-relaxed text-slate-500">
				Menampilkan identitas dan status akun dari server, serta kursus yang dibuat
				akun ini. Kursus lain tempat ia ditugaskan sebagai pengampu (bukan pembuat)
				belum dapat dibedakan lewat endpoint daftar kursus, begitu pula keahlian
				dan peringkat. Ubah nama/email/keahlian belum didukung backend
				(PATCH hanya menerima status aktif).
			</p>
		</section>

		<div class="mt-6">
			<a
				href="/admin/instrukturs"
				class="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-slate-500"
			>
				<i class="fa-solid fa-arrow-left" aria-hidden="true"></i> Kembali ke Instruktur
			</a>
		</div>
	{/if}
</div>
