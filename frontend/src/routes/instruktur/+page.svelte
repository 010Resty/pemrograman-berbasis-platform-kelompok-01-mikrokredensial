<script lang="ts">
	import { browser } from '$app/environment';
	import { getCurrentUser } from '$lib/stores/auth.svelte';
	import {
		fetchInstructorDashboard,
		timeAgo,
		type InstructorDashboard
	} from '$lib/api/dashboard';

	interface StatCard {
		label: string;
		value: string;
		sub: string;
		icon: string;
		color: string;
		bgColor: string;
	}

	const session = $derived(getCurrentUser());
	const firstName = $derived(session?.name.trim().split(/\s+/)[0] ?? 'Instruktur');

	let dashboard = $state<InstructorDashboard | null>(null);
	let loading = $state(true);
	let loadError = $state('');
	let started = false;
	// Stale-guard: respons lambat tidak boleh menimpa retry yang lebih baru.
	// Pola sama seperti sertifikat (summaryReq/moduleStatusReq).
	let loadSeq = 0;

	async function load(): Promise<void> {
		const my = ++loadSeq;
		loading = true;
		loadError = '';
		try {
			const data = await fetchInstructorDashboard();
			if (my !== loadSeq) return;
			dashboard = data;
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

	const stats = $derived<StatCard[]>([
		{
			label: 'Kursus Aktif',
			value: String(dashboard?.totals.activeCourses ?? 0),
			sub: `${dashboard?.totals.draftCourses ?? 0} draft menunggu terbit`,
			icon: 'fa-book-open',
			color: 'text-blue-600',
			bgColor: 'bg-blue-50'
		},
		{
			label: 'Total Peserta',
			value: (dashboard?.totals.totalStudents ?? 0).toLocaleString('id-ID'),
			sub: 'peserta aktif di kursusmu',
			icon: 'fa-users',
			color: 'text-emerald-600',
			bgColor: 'bg-emerald-50'
		},
		{
			label: 'Menunggu Dinilai',
			value: String(dashboard?.totals.pendingReviews ?? 0),
			sub: 'tugas peserta menunggu nilai',
			icon: 'fa-clipboard-check',
			color: 'text-amber-600',
			bgColor: 'bg-amber-50'
		}
	]);

	function statusBadge(status: string): { label: string; cls: string } {
		if (status === 'published')
			return { label: 'Aktif', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
		if (status === 'archived')
			return { label: 'Arsip', cls: 'bg-slate-100 text-slate-500 border-slate-200' };
		return { label: 'Draft', cls: 'bg-slate-50 text-slate-600 border-slate-200' };
	}
</script>

<svelte:head>
	<title>Dashboard Instruktur — Aristoteles Platform</title>
	<meta name="description" content="Dashboard instruktur Aristoteles untuk mengelola kursus, penilaian, dan pendapatan." />
</svelte:head>

<div class="p-4 sm:p-6 lg:p-8">
	<div class="mb-8">
		<div
			class="mb-3 inline-flex items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700"
		>
			<i class="fa-solid fa-chalkboard-user" aria-hidden="true"></i> Dashboard Instruktur
		</div>
		<h1 class="mb-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
			Selamat Datang, {firstName}!
		</h1>
		<p class="text-sm text-slate-500">Kelola kursus dan nilai tugas peserta di sini.</p>
	</div>

	{#if loading}
		<div
			class="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white p-12 text-sm font-semibold text-slate-500"
			role="status"
			aria-label="Memuat dasbor"
		>
			<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i> Memuat dasbor dari server...
		</div>
	{:else if loadError}
		<div class="rounded-2xl border border-red-200 bg-red-50 p-12 text-center" role="alert">
			<i class="fa-solid fa-triangle-exclamation mb-3 text-3xl text-red-300" aria-hidden="true"></i>
			<p class="text-sm font-bold text-red-800">Gagal memuat dasbor</p>
			<p class="mx-auto mt-1 max-w-md text-xs text-red-600">{loadError}</p>
			<button
				type="button"
				onclick={() => void load()}
				class="mt-4 inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-red-600"
			>
				<i class="fa-solid fa-rotate-right" aria-hidden="true"></i> Coba lagi
			</button>
		</div>
	{:else}
		<div class="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-3">
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
					<div class="mt-0.5 text-xs font-semibold text-slate-700">{stat.label}</div>
					<div class="mt-0.5 text-[11px] text-slate-500">{stat.sub}</div>
				</div>
			{/each}
		</div>

		<div class="grid gap-6 lg:grid-cols-3">
			<div class="space-y-6 lg:col-span-2">
				<section
					aria-labelledby="heading-kursus"
					class="overflow-hidden rounded-2xl border border-slate-200/60 bg-white"
				>
					<div class="flex items-center justify-between p-6 pb-4">
						<div>
							<h2 id="heading-kursus" class="text-lg font-bold text-slate-900">Kursus Saya</h2>
							<p class="mt-0.5 text-xs text-slate-500">Kursus yang kamu ampu beserta antrean penilaian</p>
						</div>
						<a
							href="/instruktur/kursusku"
							class="rounded-lg text-sm font-semibold text-blue-600 transition-colors duration-200 ease-smooth hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
						>
							Kelola Semua <i class="fa-solid fa-arrow-right ml-1 text-xs" aria-hidden="true"></i>
						</a>
					</div>
					{#if (dashboard?.courses.length ?? 0) === 0}
						<div class="px-6 pb-6 text-center">
							<i class="fa-solid fa-folder-open mb-2 text-2xl text-slate-300" aria-hidden="true"></i>
							<p class="text-sm font-semibold text-slate-600">Belum ada kursus yang kamu ampu.</p>
							<a
								href="/instruktur/kursusku/tambah"
								class="mt-3 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
							>
								<i class="fa-solid fa-plus" aria-hidden="true"></i> Buat Kursus Baru
							</a>
						</div>
					{:else}
						<div class="divide-y divide-slate-100">
							{#each dashboard?.courses ?? [] as course (course.id)}
								{@const badge = statusBadge(course.status)}
								<div class="px-6 py-4 transition-colors duration-200 ease-smooth hover:bg-slate-50/50">
									<div class="mb-2 flex items-center justify-between gap-3">
										<div class="mr-2 min-w-0 flex-1">
											<h3 class="truncate text-sm font-semibold text-slate-800">{course.title}</h3>
											<p class="mt-0.5 text-xs text-slate-500">
												{course.studentCount.toLocaleString('id-ID')} peserta · {course.pendingCount} menunggu dinilai
											</p>
										</div>
										<span
											class="inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold {badge.cls}"
										>
											{badge.label}
										</span>
									</div>
									<div class="flex items-center gap-3">
										<div
											class="h-2 flex-1 overflow-hidden rounded-full bg-slate-100"
											role="progressbar"
											aria-valuenow={course.avgProgress}
											aria-valuemin={0}
											aria-valuemax={100}
											aria-label={`Rata-rata progres ${course.title}`}
										>
											<div
												class="h-full rounded-full transition-all duration-500 ease-smooth {course.avgProgress === 0 ? 'bg-slate-300' : course.avgProgress >= 50 ? 'bg-blue-500' : 'bg-amber-500'}"
												style="width: {course.avgProgress}%"
											></div>
										</div>
										<span class="w-10 text-right text-xs font-bold text-slate-600">{course.avgProgress}%</span>
										<a
											href={`/instruktur/kursusku/${course.id}?src=server`}
											class="shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-[11px] font-bold text-white transition-all duration-200 ease-smooth hover:bg-blue-700 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-blue-600"
										>
											Kelola
										</a>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</section>

				<section
					aria-labelledby="heading-aksi"
					class="rounded-2xl border border-slate-200/60 bg-white p-6"
				>
					<h2 id="heading-aksi" class="mb-4 text-lg font-bold text-slate-900">Aksi Cepat</h2>
					<div class="grid grid-cols-2 gap-3">
						<a
							href="/instruktur/kursusku"
							class="group flex flex-col items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 p-4 transition-colors duration-200 ease-smooth hover:bg-blue-100 focus-visible:outline-2 focus-visible:outline-blue-600"
						>
							<span
								class="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 shadow-md shadow-blue-600/25 transition-transform duration-300 ease-spring group-hover:scale-110"
							>
								<i class="fa-solid fa-book-open text-sm text-white" aria-hidden="true"></i>
							</span>
							<span class="text-xs font-semibold text-blue-700">Kelola Kursus</span>
						</a>
						<a
							href="/instruktur/penilaian"
							class="group flex flex-col items-center gap-2 rounded-xl border border-amber-100 bg-amber-50 p-4 transition-colors duration-200 ease-smooth hover:bg-amber-100 focus-visible:outline-2 focus-visible:outline-amber-600"
						>
							<span
								class="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-600 shadow-md shadow-amber-600/25 transition-transform duration-300 ease-spring group-hover:scale-110"
							>
								<i class="fa-solid fa-clipboard-check text-sm text-white" aria-hidden="true"></i>
							</span>
							<span class="text-xs font-semibold text-amber-700">Nilai Tugas</span>
						</a>
					</div>
				</section>
			</div>

			<div class="space-y-6">
				<section
					aria-labelledby="heading-review"
					class="overflow-hidden rounded-2xl border border-slate-200/60 bg-white"
				>
					<div class="flex items-center justify-between p-6 pb-4">
						<h2 id="heading-review" class="text-lg font-bold text-slate-900">Perlu Dinilai</h2>
						<a
							href="/instruktur/penilaian"
							class="rounded-lg text-sm font-semibold text-blue-600 transition-colors duration-200 ease-smooth hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
						>
							Lihat Semua
						</a>
					</div>
					{#if (dashboard?.pendingReviews.length ?? 0) === 0}
						<div class="px-6 pb-6 text-center">
							<i class="fa-solid fa-circle-check mb-2 text-2xl text-emerald-300" aria-hidden="true"></i>
							<p class="text-sm font-semibold text-slate-600">Semua tugas sudah dinilai.</p>
							<p class="mt-1 text-xs text-slate-400">Pengumpulan baru akan muncul di sini.</p>
						</div>
					{:else}
						<div class="divide-y divide-slate-100">
							{#each dashboard?.pendingReviews ?? [] as review (review.submissionId)}
								<a
									href={`/instruktur/penilaian/${review.courseId}/${review.materialId}`}
									class="flex items-center gap-3 px-6 py-4 transition-colors duration-200 ease-smooth hover:bg-slate-50/50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-600"
								>
									<div class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-amber-50">
										<i class="fa-solid fa-pen-to-square text-amber-600" aria-hidden="true"></i>
									</div>
									<div class="min-w-0 flex-1">
										<h3 class="truncate text-sm font-semibold text-slate-800">{review.materialTitle}</h3>
										<p class="mt-0.5 truncate text-xs text-slate-500">{review.studentName} · {review.courseTitle}</p>
									</div>
									<span class="flex-shrink-0 text-xs text-slate-400">{timeAgo(review.submittedAt)}</span>
								</a>
							{/each}
						</div>
					{/if}
				</section>
			</div>
		</div>
	{/if}
</div>
