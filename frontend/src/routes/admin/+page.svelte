<script lang="ts">
	interface Stat {
		label: string;
		value: string;
		change: string;
		icon: string;
		color: string;
		bg: string;
	}

	const stats: Stat[] = [
		{ label: 'Total Users', value: '1.248', change: '+12% bulan ini', icon: 'fa-users', color: 'text-blue-600', bg: 'bg-blue-50' },
		{ label: 'Instrukturs', value: '48', change: '+4 baru', icon: 'fa-chalkboard-user', color: 'text-violet-600', bg: 'bg-violet-50' },
		{ label: 'Courses', value: '120', change: '18 aktif', icon: 'fa-layer-group', color: 'text-emerald-600', bg: 'bg-emerald-50' },
		{ label: 'Sertifikat Terbit', value: '3.420', change: '+210 bulan ini', icon: 'fa-award', color: 'text-amber-600', bg: 'bg-amber-50' }
	];

	const recentUsers = [
		{ name: 'Ahmad Farizi', email: 'ahmad@student.ac.id', role: 'Mahasiswa', status: 'Aktif', date: 'Hari ini' },
		{ name: 'Sarah Johnson', email: 'sarah@student.ac.id', role: 'Mahasiswa', status: 'Aktif', date: 'Kemarin' },
		{ name: 'Rian Pratama', email: 'rian@student.ac.id', role: 'Mahasiswa', status: 'Pending', date: '2 hari lalu' },
		{ name: 'Kevin Perry', email: 'kevin@aristoteles.ac.id', role: 'Instruktur', status: 'Aktif', date: '3 hari lalu' }
	];

	const recentCourses = [
		{ title: 'Pengembangan Web Frontend', instructor: 'Kevin Perry', peserta: 2450, rating: 4.8, status: 'Published' },
		{ title: 'Basis Data & SQL', instructor: 'Max Alexix', peserta: 1920, rating: 4.7, status: 'Published' },
		{ title: 'Machine Learning Dasar', instructor: 'Rian Pratama', peserta: 860, rating: 4.9, status: 'Draft' }
	];
</script>

<svelte:head>
	<title>Dashboard Admin — Aristoteles Platform</title>
	<meta name="description" content="Dashboard admin Aristoteles untuk mengelola users, instruktur, dan courses." />
</svelte:head>

<div class="p-4 sm:p-6 lg:p-8">
	<div class="mb-8">
		<p class="text-xs font-bold tracking-widest text-blue-600 uppercase">Admin · Dashboard</p>
		<h1 class="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
			Selamat Datang, Admin!
		</h1>
		<p class="mt-1 text-sm text-slate-500">Ringkasan aktivitas platform mikrokredensial hari ini.</p>
	</div>

	<div class="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
		{#each stats as s (s.label)}
			<div class="rounded-2xl border border-slate-200/60 bg-white p-5 transition-shadow hover:shadow-lg">
				<div class="mb-3 flex h-11 w-11 items-center justify-center rounded-xl {s.bg}">
					<i class="fa-solid {s.icon} {s.color} text-lg" aria-hidden="true"></i>
				</div>
				<div class="text-2xl font-bold text-slate-900">{s.value}</div>
				<div class="mt-0.5 text-xs font-medium text-slate-500">{s.label}</div>
				<div class="mt-1 text-[11px] font-semibold text-emerald-600">{s.change}</div>
			</div>
		{/each}
	</div>

	<div class="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
		<a href="/admin/users" class="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-xs font-bold text-white shadow-lg shadow-blue-600/25 transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600">
			<i class="fa-solid fa-user-plus" aria-hidden="true"></i> Tambah User
		</a>
		<a href="/admin/instrukturs" class="flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-xs font-bold text-white shadow-lg shadow-violet-600/25 transition-colors hover:bg-violet-700 focus-visible:outline-2 focus-visible:outline-violet-600">
			<i class="fa-solid fa-chalkboard-user" aria-hidden="true"></i> Tambah Instruktur
		</a>
		<a href="/admin/courses" class="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-xs font-bold text-white shadow-lg shadow-emerald-600/25 transition-colors hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-emerald-600">
			<i class="fa-solid fa-plus" aria-hidden="true"></i> Buat Course
		</a>
		<a href="/admin/courses" class="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-slate-500">
			<i class="fa-solid fa-chart-line" aria-hidden="true"></i> Lihat Laporan
		</a>
	</div>

	<div class="grid gap-6 lg:grid-cols-2">
		<section aria-labelledby="h-users" class="overflow-hidden rounded-2xl border border-slate-200/60 bg-white">
			<div class="flex items-center justify-between p-6 pb-4">
				<h2 id="h-users" class="text-lg font-bold text-slate-900">Users Terbaru</h2>
				<a href="/admin/users" class="text-sm font-semibold text-blue-600 hover:text-blue-700">Lihat Semua</a>
			</div>
			<ul class="divide-y divide-slate-100">
				{#each recentUsers as u (u.email)}
					<li class="flex items-center gap-3 px-6 py-3.5">
						<span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600" aria-hidden="true">
							{u.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}
						</span>
						<span class="min-w-0 flex-1">
							<span class="block truncate text-sm font-semibold text-slate-800">{u.name}</span>
							<span class="block truncate text-xs text-slate-500">{u.email} · {u.role}</span>
						</span>
						<span class={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${u.status === 'Aktif' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
							{u.status}
						</span>
					</li>
				{/each}
			</ul>
		</section>

		<section aria-labelledby="h-courses" class="overflow-hidden rounded-2xl border border-slate-200/60 bg-white">
			<div class="flex items-center justify-between p-6 pb-4">
				<h2 id="h-courses" class="text-lg font-bold text-slate-900">Courses Populer</h2>
				<a href="/admin/courses" class="text-sm font-semibold text-blue-600 hover:text-blue-700">Kelola</a>
			</div>
			<ul class="divide-y divide-slate-100">
				{#each recentCourses as c (c.title)}
					<li class="px-6 py-3.5">
						<div class="flex items-center justify-between gap-3">
							<span class="min-w-0 flex-1">
								<span class="block truncate text-sm font-semibold text-slate-800">{c.title}</span>
								<span class="block text-xs text-slate-500">{c.instructor} · {c.peserta.toLocaleString('id-ID')} peserta · ★ {c.rating}</span>
							</span>
							<span class={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${c.status === 'Published' ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
								{c.status}
							</span>
						</div>
					</li>
				{/each}
			</ul>
		</section>
	</div>
</div>
