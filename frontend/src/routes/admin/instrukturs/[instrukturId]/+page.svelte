<script lang="ts">
	import { page } from '$app/state';
	import { courses } from '$lib/data/courses';
	import { getInstructor, setInstructorStatus } from '$lib/stores/instructors';

	const instrukturId = $derived(Number(page.params.instrukturId));
	const ins = $derived(getInstructor(instrukturId));
	/** Kursus di katalog yang mencantumkan instruktur ini sebagai pengampu. */
	const taughtCourses = $derived(
		ins ? courses.filter((c) => c.instructor === ins.name) : []
	);

	let toast = $state('');

	function toggleStatus() {
		if (!ins) return;
		const next = ins.status === 'Aktif' ? 'Nonaktif' : 'Aktif';
		setInstructorStatus(ins.id, next);
		toast =
			next === 'Aktif'
				? `${ins.name} diaktifkan kembali (data lokal, belum tersimpan permanen).`
				: `${ins.name} dinonaktifkan (data lokal, belum tersimpan permanen).`;
		setTimeout(() => (toast = ''), 2500);
	}

	function statusClass(status: 'Aktif' | 'Nonaktif'): string {
		return status === 'Aktif'
			? 'border-emerald-200 bg-emerald-50 text-emerald-700'
			: 'border-slate-200 bg-slate-100 text-slate-600';
	}
</script>

<svelte:head>
	<title>
		{ins ? `${ins.name} — Profil Instruktur` : 'Instruktur tidak ditemukan'} — Admin Aristoteles
	</title>
	<meta name="description" content="Profil instruktur platform Aristoteles." />
</svelte:head>

<div class="p-4 sm:p-6 lg:p-8">
	{#if !ins}
		<div class="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-10 text-center">
			<i class="fa-solid fa-triangle-exclamation mb-3 text-3xl text-amber-500" aria-hidden="true"></i>
			<h1 class="text-xl font-bold text-slate-900">Instruktur tidak ditemukan</h1>
			<p class="mt-1 text-sm text-slate-500">
				ID instruktur “{page.params.instrukturId}” tidak terdaftar.
			</p>
			<a
				href="/admin/instrukturs"
				class="mt-5 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-violet-700 focus-visible:outline-2 focus-visible:outline-violet-600"
			>
				<i class="fa-solid fa-arrow-left" aria-hidden="true"></i> Kembali ke Instruktur
			</a>
		</div>
	{:else}
		<nav aria-label="Navigasi remah roti" class="mb-4 flex items-center gap-2 text-xs text-slate-500">
			<a href="/admin/instrukturs" class="rounded font-semibold text-violet-600 hover:text-violet-700 focus-visible:outline-2 focus-visible:outline-violet-600">
				Instruktur
			</a>
			<i class="fa-solid fa-chevron-right text-[10px] text-slate-300" aria-hidden="true"></i>
			<span aria-current="page" class="truncate font-medium text-slate-700">{ins.name}</span>
		</nav>

		{#if toast}
			<p
				role="status"
				class="mb-4 flex items-start gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-xs font-semibold text-violet-800"
			>
				<i class="fa-solid fa-circle-check mt-0.5 shrink-0" aria-hidden="true"></i>
				<span>{toast}</span>
			</p>
		{/if}

		<header class="mb-6 overflow-hidden rounded-2xl border border-slate-200/70 bg-white">
			<div class="h-24 bg-gradient-to-r from-violet-600 via-indigo-700 to-slate-900" aria-hidden="true"></div>
			<div class="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
				<span
					class="-mt-12 flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-xl font-extrabold text-white shadow-lg sm:-mt-14"
					aria-hidden="true"
				>
					{ins.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}
				</span>
				<div class="min-w-0 flex-1">
					<div class="flex flex-wrap items-center gap-2">
						<h1 class="text-xl font-extrabold text-slate-900 sm:text-2xl">{ins.name}</h1>
						<span class={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${statusClass(ins.status)}`}>
							{ins.status}
						</span>
					</div>
					<p class="mt-0.5 text-sm text-slate-500">{ins.email} · {ins.expertise}</p>
				</div>
				<div class="flex flex-wrap gap-2">
					<a
						href={`/admin/instrukturs/${ins.id}/edit`}
						class="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-amber-600"
					>
						<i class="fa-solid fa-pen" aria-hidden="true"></i> Ubah
					</a>
					<button
						type="button"
						onclick={toggleStatus}
						class={`inline-flex min-h-[44px] items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold text-white focus-visible:outline-2 ${ins.status === 'Aktif' ? 'bg-red-600 hover:bg-red-700 focus-visible:outline-red-600' : 'bg-emerald-600 hover:bg-emerald-700 focus-visible:outline-emerald-600'}`}
					>
						<i class={`fa-solid ${ins.status === 'Aktif' ? 'fa-ban' : 'fa-check'}`} aria-hidden="true"></i>
						{ins.status === 'Aktif' ? 'Nonaktifkan' : 'Aktifkan'}
					</button>
				</div>
			</div>
			<dl class="grid grid-cols-3 divide-x divide-slate-100 border-t border-slate-100 text-center">
				<div class="p-4">
					<dt class="text-[10px] font-bold tracking-widest text-slate-400 uppercase">Kursus</dt>
					<dd class="mt-0.5 text-xl font-extrabold text-slate-900" aria-label={`${taughtCourses.length} kursus di katalog`}>{taughtCourses.length}</dd>
				</div>
				<div class="p-4">
					<dt class="text-[10px] font-bold tracking-widest text-slate-400 uppercase">Siswa</dt>
					<dd class="mt-0.5 text-xl font-extrabold text-violet-700">{ins.students.toLocaleString('id-ID')}</dd>
				</div>
				<div class="p-4">
					<dt class="text-[10px] font-bold tracking-widest text-slate-400 uppercase">Peringkat</dt>
					<dd class="mt-0.5 text-xl font-extrabold text-amber-600">★ {ins.rating}</dd>
				</div>
			</dl>
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
					<dd class="font-semibold text-slate-900">{ins.name}</dd>
				</div>
				<div class="flex flex-col gap-0.5 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
					<dt class="text-slate-500">Email</dt>
					<dd class="font-semibold text-slate-900">{ins.email}</dd>
				</div>
				<div class="flex flex-col gap-0.5 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
					<dt class="text-slate-500">Keahlian</dt>
					<dd class="font-semibold text-slate-900">{ins.expertise}</dd>
				</div>
				<div class="flex flex-col gap-0.5 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
					<dt class="text-slate-500">Status</dt>
					<dd>
						<span class={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${statusClass(ins.status)}`}>
							{ins.status}
						</span>
					</dd>
				</div>
			</dl>
			<p class="border-t border-slate-100 bg-slate-50/60 px-5 py-3 text-[11px] text-slate-500">
				Perubahan pada halaman ini tersimpan sementara di browser (demo) dan belum tersimpan permanen.
			</p>
		</section>

		<section
			aria-labelledby="ins-courses"
			class="mt-6 overflow-hidden rounded-2xl border border-slate-200/70 bg-white"
		>
			<div class="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 p-5 pb-3">
				<h2 id="ins-courses" class="text-lg font-bold text-slate-900">
					Kursus yang diampu ({taughtCourses.length})
				</h2>
				<p class="text-[11px] text-slate-400">Berdasarkan nama instruktur di katalog kursus</p>
			</div>
			{#if taughtCourses.length === 0}
				<p class="p-5 text-sm text-slate-500">
					Belum ada kursus di katalog yang mencantumkan {ins.name} sebagai pengampu.
				</p>
			{:else}
				<ul class="divide-y divide-slate-100">
					{#each taughtCourses as course (course.id)}
						<li class="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
							<span class="min-w-0">
								<span class="block truncate text-sm font-bold text-slate-900">{course.title}</span>
								<span class="mt-0.5 block text-xs text-slate-500">{course.duration} · {course.level}</span>
							</span>
							<span class="inline-flex w-fit shrink-0 items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-blue-700">
								{course.category}
							</span>
						</li>
					{/each}
				</ul>
			{/if}
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
