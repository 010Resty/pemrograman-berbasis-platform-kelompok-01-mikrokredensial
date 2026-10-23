<script lang="ts">
	import { page } from '$app/state';

	interface EnrolledCourse {
		id: number;
		title: string;
		progress: number;
		status: string;
	}

	interface UserDetail {
		id: number;
		name: string;
		email: string;
		role: string;
		status: 'Aktif' | 'Pending' | 'Nonaktif';
		joined: string;
		lastActive: string;
		courses: EnrolledCourse[];
		certificates: number;
	}

	// Data demo — sinkron dengan daftar di /admin/users
	const DIRECTORY: UserDetail[] = [
		{
			id: 1, name: 'Ahmad Farizi', email: 'ahmad@student.ac.id', role: 'Mahasiswa',
			status: 'Aktif', joined: '12 Jan 2026', lastActive: 'Hari ini', certificates: 2,
			courses: [
				{ id: 1, title: 'Pengembangan Web Frontend', progress: 75, status: 'Berjalan' },
				{ id: 2, title: 'Basis Data & SQL', progress: 100, status: 'Selesai' },
				{ id: 5, title: 'Machine Learning Dasar', progress: 30, status: 'Berjalan' }
			]
		},
		{
			id: 2, name: 'Sarah Johnson', email: 'sarah@student.ac.id', role: 'Mahasiswa',
			status: 'Aktif', joined: '28 Feb 2026', lastActive: 'Kemarin', certificates: 1,
			courses: [
				{ id: 2, title: 'Basis Data & SQL', progress: 60, status: 'Berjalan' },
				{ id: 8, title: 'Analitik Data & Dashboard', progress: 20, status: 'Berjalan' }
			]
		},
		{
			id: 3, name: 'Rian Pratama', email: 'rian@student.ac.id', role: 'Mahasiswa',
			status: 'Pending', joined: '05 Mar 2026', lastActive: '2 hari lalu', certificates: 0,
			courses: [{ id: 4, title: 'Keamanan Siber', progress: 0, status: 'Belum mulai' }]
		},
		{
			id: 4, name: 'Kevin Perry', email: 'kevin@aristoteles.ac.id', role: 'Instruktur',
			status: 'Aktif', joined: '10 Jan 2026', lastActive: 'Hari ini', certificates: 8,
			courses: [
				{ id: 1, title: 'Pengembangan Web Frontend', progress: 75, status: 'Aktif' },
				{ id: 5, title: 'Machine Learning Dasar', progress: 30, status: 'Aktif' }
			]
		},
		{
			id: 5, name: 'Max Alexix', email: 'max@aristoteles.ac.id', role: 'Instruktur',
			status: 'Aktif', joined: '18 Jan 2026', lastActive: '3 jam lalu', certificates: 5,
			courses: [{ id: 2, title: 'Basis Data & SQL', progress: 100, status: 'Aktif' }]
		},
		{
			id: 6, name: 'Dewi Lestari', email: 'dewi@student.ac.id', role: 'Mahasiswa',
			status: 'Nonaktif', joined: '02 Feb 2026', lastActive: '2 minggu lalu', certificates: 0,
			courses: [{ id: 3, title: 'Jaringan Komputer Dasar', progress: 10, status: 'Berjalan' }]
		}
	];

	const userId = $derived(Number(page.params.userId));
	const user = $derived(DIRECTORY.find((u) => u.id === userId));

	let toast = $state('');

	function flash(message: string) {
		toast = message;
		setTimeout(() => (toast = ''), 2500);
	}

	function statusClass(s: UserDetail['status']) {
		if (s === 'Aktif') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
		if (s === 'Pending') return 'border-amber-200 bg-amber-50 text-amber-700';
		return 'border-slate-200 bg-slate-100 text-slate-600';
	}
</script>

<svelte:head>
	<title>
		{user ? `${user.name} — Detail User` : 'User tidak ditemukan'} — Admin Aristoteles
	</title>
</svelte:head>

<div class="p-4 sm:p-6 lg:p-8">
	{#if !user}
		<div class="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-10 text-center">
			<i class="fa-solid fa-triangle-exclamation mb-3 text-3xl text-amber-500" aria-hidden="true"></i>
			<h1 class="text-xl font-bold text-slate-900">User tidak ditemukan</h1>
			<p class="mt-1 text-sm text-slate-500">ID user “{page.params.userId}” tidak terdaftar.</p>
			<a
				href="/admin/users"
				class="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-blue-700"
			>
				<i class="fa-solid fa-arrow-left" aria-hidden="true"></i> Kembali ke Users
			</a>
		</div>
	{:else}
		<nav aria-label="Breadcrumb" class="mb-4 flex items-center gap-2 text-xs text-slate-500">
			<a href="/admin/users" class="rounded font-semibold text-blue-600 hover:text-blue-700">Users</a>
			<i class="fa-solid fa-chevron-right text-[10px] text-slate-300" aria-hidden="true"></i>
			<span aria-current="page" class="truncate font-medium text-slate-700">{user.name}</span>
		</nav>

		{#if toast}
			<p
				role="status"
				class="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-bold text-emerald-700"
			>
				<i class="fa-solid fa-circle-check" aria-hidden="true"></i> {toast}
			</p>
		{/if}

		<header class="mb-6 overflow-hidden rounded-2xl border border-slate-200/70 bg-white">
			<div class="h-24 bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-800" aria-hidden="true"></div>
			<div class="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
				<span
					class="-mt-12 flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border-4 border-white bg-blue-50 text-xl font-extrabold text-blue-700 shadow-lg sm:-mt-14"
					aria-hidden="true"
				>
					{user.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}
				</span>
				<div class="min-w-0 flex-1">
					<div class="flex flex-wrap items-center gap-2">
						<h1 class="text-xl font-extrabold text-slate-900 sm:text-2xl">{user.name}</h1>
						<span class={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${statusClass(user.status)}`}>
							{user.status}
						</span>
					</div>
					<p class="mt-0.5 text-sm text-slate-500">{user.email} · {user.role}</p>
					<p class="mt-1 text-[11px] text-slate-400">
						Bergabung {user.joined} · Terakhir aktif {user.lastActive}
					</p>
				</div>
				<div class="flex flex-wrap gap-2">
					<button
						type="button"
						onclick={() => flash(`Email reset kata sandi dikirim ke ${user.email}.`)}
						class="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
					>
						<i class="fa-solid fa-key" aria-hidden="true"></i> Reset Sandi
					</button>
					<button
						type="button"
						onclick={() => flash(user.status === 'Aktif' ? `${user.name} dinonaktifkan.` : `${user.name} diaktifkan kembali.`)}
						class={`inline-flex min-h-[44px] items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold text-white ${user.status === 'Aktif' ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
					>
						<i class={`fa-solid ${user.status === 'Aktif' ? 'fa-ban' : 'fa-check'}`} aria-hidden="true"></i>
						{user.status === 'Aktif' ? 'Nonaktifkan' : 'Aktifkan'}
					</button>
				</div>
			</div>
			<dl class="grid grid-cols-3 divide-x divide-slate-100 border-t border-slate-100 text-center">
				<div class="p-4">
					<dt class="text-[10px] font-bold tracking-widest text-slate-400 uppercase">Kursus</dt>
					<dd class="mt-0.5 text-xl font-extrabold text-slate-900">{user.courses.length}</dd>
				</div>
				<div class="p-4">
					<dt class="text-[10px] font-bold tracking-widest text-slate-400 uppercase">Sertifikat</dt>
					<dd class="mt-0.5 text-xl font-extrabold text-amber-600">{user.certificates}</dd>
				</div>
				<div class="p-4">
					<dt class="text-[10px] font-bold tracking-widest text-slate-400 uppercase">Rata-rata progres</dt>
					<dd class="mt-0.5 text-xl font-extrabold text-blue-700">
						{user.courses.length > 0 ? Math.round(user.courses.reduce((n, c) => n + c.progress, 0) / user.courses.length) : 0}%
					</dd>
				</div>
			</dl>
		</header>

		<section
			aria-labelledby="ucourses"
			class="overflow-hidden rounded-2xl border border-slate-200/70 bg-white"
		>
			<h2 id="ucourses" class="border-b border-slate-100 p-5 pb-3 text-lg font-bold text-slate-900">
				Kursus yang diikuti
			</h2>
			<ul class="divide-y divide-slate-100">
				{#each user.courses as c (c.id)}
					<li class="flex items-center gap-4 px-5 py-4">
						<div class="min-w-0 flex-1">
							<p class="truncate text-sm font-bold text-slate-900">{c.title}</p>
							<div
								class="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100"
								role="progressbar"
								aria-valuenow={c.progress}
								aria-valuemin={0}
								aria-valuemax={100}
								aria-label={`Progres ${c.title}`}
							>
								<div class="h-full rounded-full bg-blue-500" style="width: {c.progress}%"></div>
							</div>
						</div>
						<span class="w-12 shrink-0 text-right text-xs font-bold text-slate-600">{c.progress}%</span>
						<span
							class="hidden shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600 sm:inline-block"
						>
							{c.status}
						</span>
					</li>
				{/each}
			</ul>
		</section>
	{/if}
</div>
