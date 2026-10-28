<script lang="ts">
	import { browser } from '$app/environment';
	import { getCurrentUser } from '$lib/stores/auth.svelte';
	import {
		fetchMyCertificates,
		fetchMyEnrollments,
		fetchMyProgressSummary,
		type MyCertificate
	} from '$lib/api/progress';

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

	const session = $derived(getCurrentUser());
	const firstName = $derived(session?.name.trim().split(/\s+/)[0] ?? 'Peserta');

	let summary = $state<{ percent: number; totalCourses: number; totalMaterials: number; completedMaterials: number; perCourse: { courseId: number; courseTitle: string; totalMaterials: number; completedMaterials: number; percent: number }[] } | null>(null);
	let completedCourses = $state(0);
	let issuedCertificates = $state<MyCertificate[]>([]);
	let loading = $state(true);
	let loadError = $state('');
	let started = false;
	let loadSeq = 0;

	/** Muat seluruh angka dasbor dari backend secara paralel (tanpa N+1 di klien). */
	async function load(): Promise<void> {
		const my = ++loadSeq;
		loading = true;
		loadError = '';
		try {
			const [s, enrollments, certs] = await Promise.all([
				fetchMyProgressSummary(),
				fetchMyEnrollments(),
				fetchMyCertificates()
			]);
			if (my !== loadSeq) return;
			summary = s;
			completedCourses = enrollments.filter((e) => e.status === 'completed').length;
			issuedCertificates = certs
				.filter((c) => c.status === 'issued')
				.sort((a, b) => +new Date(b.issuedAt) - +new Date(a.issuedAt));
		} catch (e) {
			if (my !== loadSeq) return;
			loadError = e instanceof Error ? e.message : 'Gagal memuat dasbor.';
		} finally {
			if (my === loadSeq) loading = false;
		}
	}

	$effect(() => {
		if (!browser || started) return;
		started = true;
		void load();
	});

	function formatPercent(p: number): string {
		return `${Number.isInteger(p) ? String(p) : p.toFixed(1)}%`;
	}

	function formatDate(iso: string): string {
		const d = new Date(iso);
		return Number.isNaN(d.getTime())
			? iso
			: d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
	}

	function toModuleStatus(percent: number): Module['status'] {
		if (percent >= 100) return 'completed';
		if (percent <= 0) return 'not-started';
		return 'in-progress';
	}

	const stats = $derived<StatCard[]>([
		{ label: 'Kursusku', value: String(summary?.totalCourses ?? 0), icon: 'fa-book-open', color: 'text-blue-600', bgColor: 'bg-blue-50' },
		{ label: 'Selesai', value: String(completedCourses), icon: 'fa-circle-check', color: 'text-emerald-600', bgColor: 'bg-emerald-50' },
		{ label: 'Sertifikat', value: String(issuedCertificates.length), icon: 'fa-award', color: 'text-amber-600', bgColor: 'bg-amber-50' },
		{ label: 'Materi Selesai', value: `${summary?.completedMaterials ?? 0}/${summary?.totalMaterials ?? 0}`, icon: 'fa-clock', color: 'text-violet-600', bgColor: 'bg-violet-50' }
	]);

	const modules = $derived<Module[]>(
		(summary?.perCourse ?? []).map((c) => ({
			id: c.courseId,
			title: c.courseTitle,
			progress: c.percent,
			totalMaterials: c.totalMaterials,
			completedMaterials: c.completedMaterials,
			status: toModuleStatus(c.percent)
		}))
	);

	const certificates = $derived<Certificate[]>(
		issuedCertificates.slice(0, 3).map((c) => ({
			id: c.id,
			title: c.moduleTitle,
			issuer: c.courseTitle,
			date: formatDate(c.issuedAt)
		}))
	);

	const overallPercent = $derived(summary?.percent ?? 0);
	const courseDoneRatio = $derived(
		summary && summary.totalCourses > 0 ? (completedCourses / summary.totalCourses) * 100 : 0
	);
	const certRatio = $derived(
		summary && summary.totalCourses > 0 ? (issuedCertificates.length / summary.totalCourses) * 100 : 0
	);

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
			Selamat Datang, {firstName}!
		</h1>
		<p class="text-sm text-slate-500">Pantau progres belajar dan sertifikasimu di sini.</p>
	</div>

	{#if loading}
		<div class="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4" aria-label="Memuat dasbor">
			{#each [1, 2, 3, 4] as i (i)}
				<div class="animate-pulse rounded-2xl border border-slate-200/60 bg-white p-5">
					<div class="mb-3 h-11 w-11 rounded-xl bg-slate-100"></div>
					<div class="h-7 w-16 rounded bg-slate-100"></div>
					<div class="mt-2 h-3 w-24 rounded bg-slate-100"></div>
				</div>
			{/each}
		</div>
	{:else if loadError}
		<div
			role="alert"
			class="mb-8 rounded-2xl border border-red-200 bg-red-50 p-6 text-center"
		>
			<p class="text-sm font-bold text-red-700">Dasbor belum dapat dimuat</p>
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
				{#if modules.length === 0}
					<p class="px-6 py-6 text-center text-xs text-slate-500">
						Belum ada kursus yang diikuti. Jelajahi kursus untuk mulai belajar.
					</p>
				{:else}
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
									aria-valuenow={Math.round(module.progress)}
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
									>{formatPercent(module.progress)}</span
								>
							</div>
						</div>
					{/each}
				</div>
				{/if}
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
				{#if certificates.length === 0}
					<p class="px-6 pb-6 text-center text-xs text-slate-500">
						Belum ada sertifikat yang terbit. Sertifikat terbit otomatis setelah seluruh
						syarat modul terpenuhi.
					</p>
				{:else}
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
				{/if}
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
					<div class="mb-1 text-4xl font-bold">{formatPercent(overallPercent)}</div>
					<p class="mb-6 text-sm text-blue-200">dari total kursus yang diikuti</p>

					<div class="space-y-3">
						<div>
							<div class="mb-1.5 flex justify-between text-xs">
								<span class="text-blue-100">Kursus Selesai</span>
								<span class="font-bold">{completedCourses}/{summary?.totalCourses ?? 0}</span>
							</div>
							<div class="h-2 overflow-hidden rounded-full bg-white/20">
								<div class="h-full rounded-full bg-emerald-400" style="width: {courseDoneRatio}%"></div>
							</div>
						</div>
						<div>
							<div class="mb-1.5 flex justify-between text-xs">
								<span class="text-blue-100">Sertifikat</span>
								<span class="font-bold">{issuedCertificates.length}/{summary?.totalCourses ?? 0}</span>
							</div>
							<div class="h-2 overflow-hidden rounded-full bg-white/20">
								<div class="h-full rounded-full bg-amber-400" style="width: {certRatio}%"></div>
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
	{/if}
</div>
