<script lang="ts">
	interface StatCard {
		label: string;
		value: string;
		icon: string;
		color: string;
		bgColor: string;
	}

	interface Module {
		id: number;
		title: string;
		progress: number;
		totalMaterials: number;
		completedMaterials: number;
		status: 'in-progress' | 'completed' | 'not-started';
	}

	interface Certificate {
		id: number;
		title: string;
		issuer: string;
		date: string;
	}

	const stats: StatCard[] = [
		{ label: 'Kursusku', value: '6', icon: 'fa-book-open', color: 'text-blue-600', bgColor: 'bg-blue-50' },
		{ label: 'Sertifikat', value: '3', icon: 'fa-award', color: 'text-amber-600', bgColor: 'bg-amber-50' },
		{ label: 'Selesai', value: '2', icon: 'fa-circle-check', color: 'text-emerald-600', bgColor: 'bg-emerald-50' },
		{ label: 'Jam Belajar', value: '48', icon: 'fa-clock', color: 'text-violet-600', bgColor: 'bg-violet-50' }
	];

	const modules: Module[] = [
		{ id: 1, title: 'Pengembangan Web Frontend', progress: 75, totalMaterials: 12, completedMaterials: 9, status: 'in-progress' },
		{ id: 2, title: 'Basis Data & SQL', progress: 100, totalMaterials: 10, completedMaterials: 10, status: 'completed' },
		{ id: 3, title: 'Jaringan Komputer Dasar', progress: 45, totalMaterials: 8, completedMaterials: 4, status: 'in-progress' },
		{ id: 4, title: 'Keamanan Siber', progress: 0, totalMaterials: 6, completedMaterials: 0, status: 'not-started' }
	];

	const certificates: Certificate[] = [
		{ id: 1, title: 'Frontend Developer', issuer: 'Aristoteles Academy', date: '15 Agu 2026' },
		{ id: 2, title: 'Database Administrator', issuer: 'Aristoteles Academy', date: '28 Jul 2026' },
		{ id: 3, title: 'Network Specialist', issuer: 'Aristoteles Academy', date: '10 Jul 2026' }
	];

	function getStatusBadge(status: Module['status']) {
		switch (status) {
			case 'completed':
				return { text: 'Selesai', class: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
			case 'in-progress':
				return { text: 'Berjalan', class: 'bg-blue-50 text-blue-700 border-blue-200' };
			case 'not-started':
				return { text: 'Belum Mulai', class: 'bg-slate-50 text-slate-600 border-slate-200' };
		}
	}

	function getProgressColor(progress: number) {
		if (progress === 100) return 'bg-emerald-500';
		if (progress >= 50) return 'bg-blue-500';
		if (progress > 0) return 'bg-amber-500';
		return 'bg-slate-300';
	}
</script>

<svelte:head>
	<title>Dashboard — Aristoteles Platform</title>
	<meta name="description" content="Dashboard pengguna Aristoteles untuk memantau kursus dan sertifikat." />
</svelte:head>

<div class="p-4 sm:p-6 lg:p-8">
	<!-- Welcome Section -->
	<div class="mb-8">
		<div
			class="mb-3 inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700"
		>
			<i class="fa-solid fa-user-graduate" aria-hidden="true"></i> Dashboard Mahasiswa
		</div>
		<h1 class="mb-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
			Selamat Datang, Ahmad!
		</h1>
		<p class="text-sm text-slate-500">Pantau progres belajar dan sertifikasimu di sini.</p>
	</div>

	<!-- Stats Grid -->
	<div class="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
		{#each stats as stat (stat.label)}
			<div
				class="rounded-2xl border border-slate-200/60 bg-white p-5 transition-all duration-200 ease-smooth hover:shadow-lg hover:shadow-slate-200/50"
			>
				<div class="mb-3 flex items-center justify-between">
					<div class="flex h-11 w-11 items-center justify-center rounded-xl {stat.bgColor}">
						<i class="fa-solid {stat.icon} {stat.color} text-lg" aria-hidden="true"></i>
					</div>
				</div>
				<div class="text-2xl font-bold text-slate-900">{stat.value}</div>
				<div class="mt-0.5 text-xs font-medium text-slate-500">{stat.label}</div>
			</div>
		{/each}
	</div>

	<div class="grid gap-6 lg:grid-cols-3">
		<!-- Left Column: Modules (2/3 width) -->
		<div class="space-y-6 lg:col-span-2">
			<!-- Active Modules -->
			<section
				aria-labelledby="heading-kursus"
				class="overflow-hidden rounded-2xl border border-slate-200/60 bg-white"
			>
				<div class="flex items-center justify-between p-6 pb-4">
					<div>
						<h2 id="heading-kursus" class="text-lg font-bold text-slate-900">Kursusku</h2>
						<p class="mt-0.5 text-xs text-slate-500">Lanjutkan progres belajar Anda</p>
					</div>
					<a
						href="/user/kursusku"
						class="rounded-lg text-sm font-semibold text-blue-600 transition-colors duration-200 ease-smooth hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
					>
						Lihat Semua <i class="fa-solid fa-arrow-right ml-1 text-xs" aria-hidden="true"></i>
					</a>
				</div>
				<div class="divide-y divide-slate-100">
					{#each modules as module (module.id)}
						<div class="px-6 py-4 transition-colors duration-200 ease-smooth hover:bg-slate-50/50">
							<div class="mb-2 flex items-center justify-between">
								<div class="mr-4 min-w-0 flex-1">
									<h3 class="truncate text-sm font-semibold text-slate-800">{module.title}</h3>
									<p class="mt-0.5 text-xs text-slate-500">
										{module.completedMaterials}/{module.totalMaterials} materi selesai
									</p>
								</div>
								<span
									class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold {getStatusBadge(module.status).class}"
								>
									{getStatusBadge(module.status).text}
								</span>
							</div>
							<div class="flex items-center gap-3">
								<div
									class="h-2 flex-1 overflow-hidden rounded-full bg-slate-100"
									role="progressbar"
									aria-valuenow={module.progress}
									aria-valuemin={0}
									aria-valuemax={100}
									aria-label={`Progres ${module.title}`}
								>
									<div
										class="h-full {getProgressColor(module.progress)} rounded-full transition-all duration-500 ease-smooth"
										style="width: {module.progress}%"
									></div>
								</div>
								<span class="w-10 text-right text-xs font-bold text-slate-600"
									>{module.progress}%</span
								>
							</div>
						</div>
					{/each}
				</div>
			</section>

			<!-- Quick Actions -->
			<section
				aria-labelledby="heading-aksi"
				class="rounded-2xl border border-slate-200/60 bg-white p-6"
			>
				<h2 id="heading-aksi" class="mb-4 text-lg font-bold text-slate-900">Aksi Cepat</h2>
				<div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
					<a
						href="/user/kursusku"
						class="group flex flex-col items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 p-4 transition-colors duration-200 ease-smooth hover:bg-blue-100 focus-visible:outline-2 focus-visible:outline-blue-600"
					>
						<span
							class="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 shadow-md shadow-blue-600/25 transition-transform duration-300 ease-spring group-hover:scale-110"
						>
							<i class="fa-solid fa-book-open text-sm text-white" aria-hidden="true"></i>
						</span>
						<span class="text-xs font-semibold text-blue-700">Kursusku</span>
					</a>
					<a
						href="/user/semua-kursus"
						class="group flex flex-col items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 p-4 transition-colors duration-200 ease-smooth hover:bg-emerald-100 focus-visible:outline-2 focus-visible:outline-emerald-600"
					>
						<span
							class="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 shadow-md shadow-emerald-600/25 transition-transform duration-300 ease-spring group-hover:scale-110"
						>
							<i class="fa-solid fa-layer-group text-sm text-white" aria-hidden="true"></i>
						</span>
						<span class="text-xs font-semibold text-emerald-700">Semua Kursus</span>
					</a>
					<a
						href="/user/sertifikat"
						class="group flex flex-col items-center gap-2 rounded-xl border border-amber-100 bg-amber-50 p-4 transition-colors duration-200 ease-smooth hover:bg-amber-100 focus-visible:outline-2 focus-visible:outline-amber-600"
					>
						<span
							class="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-600 shadow-md shadow-amber-600/25 transition-transform duration-300 ease-spring group-hover:scale-110"
						>
							<i class="fa-solid fa-award text-sm text-white" aria-hidden="true"></i>
						</span>
						<span class="text-xs font-semibold text-amber-700">Sertifikat</span>
					</a>
				</div>
			</section>
		</div>

		<!-- Right Column -->
		<div class="space-y-6">
			<!-- Recent Certificates -->
			<section
				aria-labelledby="heading-sertifikat"
				class="overflow-hidden rounded-2xl border border-slate-200/60 bg-white"
			>
				<div class="flex items-center justify-between p-6 pb-4">
					<h2 id="heading-sertifikat" class="text-lg font-bold text-slate-900">Sertifikat Terbaru</h2>
					<a
						href="/user/sertifikat"
						class="rounded-lg text-sm font-semibold text-blue-600 transition-colors duration-200 ease-smooth hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
					>
						Lihat Semua
					</a>
				</div>
				<div class="divide-y divide-slate-100">
					{#each certificates as cert (cert.id)}
						<a
							href="/user/sertifikat"
							class="flex items-center gap-3 px-6 py-4 transition-colors duration-200 ease-smooth hover:bg-slate-50/50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-600"
						>
							<div class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-amber-50">
								<i class="fa-solid fa-award text-amber-600" aria-hidden="true"></i>
							</div>
							<div class="min-w-0 flex-1">
								<h3 class="truncate text-sm font-semibold text-slate-800">{cert.title}</h3>
								<p class="mt-0.5 text-xs text-slate-500">{cert.issuer}</p>
							</div>
							<span class="flex-shrink-0 text-xs text-slate-400">{cert.date}</span>
						</a>
					{/each}
				</div>
			</section>

			<!-- Learning Progress Summary -->
			<section
				aria-labelledby="heading-progres"
				class="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 p-6 text-white"
			>
				<div class="absolute -top-12 -right-12 h-40 w-40 rounded-full bg-white/10 blur-2xl" aria-hidden="true"></div>
				<div class="absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-cyan-400/20 blur-2xl" aria-hidden="true"></div>

				<div class="relative z-10">
					<div
						class="mb-4 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-bold text-cyan-300"
					>
						<i class="fa-solid fa-chart-line" aria-hidden="true"></i> Progres Keseluruhan
					</div>
					<div class="mb-1 text-4xl font-bold">68%</div>
					<p class="mb-6 text-sm text-blue-200">dari total kursus yang diikuti</p>

					<div class="space-y-3">
						<div>
							<div class="mb-1.5 flex justify-between text-xs">
								<span class="text-blue-100">Kursus Selesai</span>
								<span class="font-bold">2/6</span>
							</div>
							<div class="h-2 overflow-hidden rounded-full bg-white/20">
								<div class="h-full rounded-full bg-emerald-400" style="width: 33%"></div>
							</div>
						</div>
						<div>
							<div class="mb-1.5 flex justify-between text-xs">
								<span class="text-blue-100">Sertifikat</span>
								<span class="font-bold">3/6</span>
							</div>
							<div class="h-2 overflow-hidden rounded-full bg-white/20">
								<div class="h-full rounded-full bg-amber-400" style="width: 50%"></div>
							</div>
						</div>
					</div>

					<a
						href="/user/semua-kursus"
						class="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-white/15 py-2.5 px-4 text-sm font-semibold text-white transition-colors duration-200 ease-smooth hover:bg-white/25 focus-visible:outline-2 focus-visible:outline-white"
					>
						Jelajahi Kursus Baru
						<i class="fa-solid fa-arrow-right text-xs" aria-hidden="true"></i>
					</a>
				</div>
			</section>
		</div>
	</div>
</div>
