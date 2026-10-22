<script lang="ts">
	import { resolveGradingHref } from '$lib/data/grading';

	interface StatCard {
		label: string;
		value: string;
		sub: string;
		icon: string;
		color: string;
		bgColor: string;
	}

	interface OwnedCourse {
		id: number;
		title: string;
		students: number;
		rating: number;
		pending: number;
		status: 'Aktif' | 'Draft';
		progress: number;
	}

	interface PendingReview {
		id: number;
		student: string;
		course: string;
		task: string;
		date: string;
	}

	const stats: StatCard[] = [
		{ label: 'Kursus Aktif', value: '4', sub: '2 draft menunggu terbit', icon: 'fa-book-open', color: 'text-blue-600', bgColor: 'bg-blue-50' },
		{ label: 'Total Peserta', value: '5.420', sub: '+312 bulan ini', icon: 'fa-users', color: 'text-emerald-600', bgColor: 'bg-emerald-50' },
		{ label: 'Menunggu Dinilai', value: '12', sub: 'tugas peserta menunggu nilai', icon: 'fa-clipboard-check', color: 'text-amber-600', bgColor: 'bg-amber-50' },
		{ label: 'Pendapatan Bulan Ini', value: 'Rp 8,4 jt', sub: 'tersedia Rp 5,1 jt', icon: 'fa-wallet', color: 'text-violet-600', bgColor: 'bg-violet-50' }
	];

	const ownedCourses: OwnedCourse[] = [
		{ id: 1, title: 'Pengembangan Web Frontend', students: 2450, rating: 4.8, pending: 5, status: 'Aktif', progress: 75 },
		{ id: 5, title: 'Machine Learning Dasar', students: 1740, rating: 4.9, pending: 4, status: 'Aktif', progress: 30 },
		{ id: 3, title: 'Jaringan Komputer Dasar', students: 1310, rating: 4.6, pending: 3, status: 'Aktif', progress: 45 },
		{ id: 4, title: 'Keamanan Siber', students: 980, rating: 4.7, pending: 0, status: 'Draft', progress: 0 }
	];

	const pendingReviews: PendingReview[] = [
		{ id: 1, student: 'Ahmad Farizi', course: 'Pengembangan Web Frontend', task: 'Proyek: Galeri Interaktif', date: '2 jam lalu' },
		{ id: 2, student: 'Dewi Anggraini', course: 'Machine Learning Dasar', task: 'Proyek: Prediksi Churn', date: '5 jam lalu' },
		{ id: 3, student: 'Rian Pratama', course: 'Jaringan Komputer Dasar', task: 'Latihan Subnetting VLSM', date: 'Kemarin' }
	];
</script>

<svelte:head>
	<title>Dashboard Instruktur — Aristotle Platform</title>
	<meta name="description" content="Dashboard instruktur Aristotle untuk mengelola kursus, penilaian, dan pendapatan." />
</svelte:head>

<div class="p-4 sm:p-6 lg:p-8">
	<div class="mb-8">
		<div
			class="mb-3 inline-flex items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700"
		>
			<i class="fa-solid fa-chalkboard-user" aria-hidden="true"></i> Dashboard Instruktur
		</div>
		<h1 class="mb-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
			Selamat Datang, Kevin!
		</h1>
		<p class="text-sm text-slate-500">Kelola kursus, nilai tugas peserta, dan pantau pendapatanmu di sini.</p>
	</div>

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
				<div class="divide-y divide-slate-100">
					{#each ownedCourses as course (course.id)}
						<div class="px-6 py-4 transition-colors duration-200 ease-smooth hover:bg-slate-50/50">
							<div class="mb-2 flex items-center justify-between gap-3">
								<div class="mr-2 min-w-0 flex-1">
									<h3 class="truncate text-sm font-semibold text-slate-800">{course.title}</h3>
									<p class="mt-0.5 text-xs text-slate-500">
										{course.students.toLocaleString('id-ID')} peserta · ★ {course.rating} · {course.pending} menunggu dinilai
									</p>
								</div>
								<span
									class="inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold {course.status === 'Aktif' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-600 border-slate-200'}"
								>
									{course.status}
								</span>
							</div>
							<div class="flex items-center gap-3">
								<div
									class="h-2 flex-1 overflow-hidden rounded-full bg-slate-100"
									role="progressbar"
									aria-valuenow={course.progress}
									aria-valuemin={0}
									aria-valuemax={100}
									aria-label={`Rata-rata progres ${course.title}`}
								>
									<div
										class="h-full rounded-full transition-all duration-500 ease-smooth {course.progress === 0 ? 'bg-slate-300' : course.progress >= 50 ? 'bg-blue-500' : 'bg-amber-500'}"
										style="width: {course.progress}%"
									></div>
								</div>
								<span class="w-10 text-right text-xs font-bold text-slate-600">{course.progress}%</span>
								<a
									href={`/instruktur/kursusku/${course.id}`}
									class="shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-[11px] font-bold text-white transition-all duration-200 ease-smooth hover:bg-blue-700 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-blue-600"
								>
									Kelola
								</a>
							</div>
						</div>
					{/each}
				</div>
			</section>

			<section
				aria-labelledby="heading-aksi"
				class="rounded-2xl border border-slate-200/60 bg-white p-6"
			>
				<h2 id="heading-aksi" class="mb-4 text-lg font-bold text-slate-900">Aksi Cepat</h2>
				<div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
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
					<a
						href="/instruktur/pendapatan"
						class="group flex flex-col items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 p-4 transition-colors duration-200 ease-smooth hover:bg-emerald-100 focus-visible:outline-2 focus-visible:outline-emerald-600"
					>
						<span
							class="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 shadow-md shadow-emerald-600/25 transition-transform duration-300 ease-spring group-hover:scale-110"
						>
							<i class="fa-solid fa-wallet text-sm text-white" aria-hidden="true"></i>
						</span>
						<span class="text-xs font-semibold text-emerald-700">Pendapatan</span>
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
				<div class="divide-y divide-slate-100">
					{#each pendingReviews as review (review.id)}
						<a
							href={resolveGradingHref(review.course, review.task)}
							class="flex items-center gap-3 px-6 py-4 transition-colors duration-200 ease-smooth hover:bg-slate-50/50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-600"
						>
							<div class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-amber-50">
								<i class="fa-solid fa-pen-to-square text-amber-600" aria-hidden="true"></i>
							</div>
							<div class="min-w-0 flex-1">
								<h3 class="truncate text-sm font-semibold text-slate-800">{review.task}</h3>
								<p class="mt-0.5 truncate text-xs text-slate-500">{review.student} · {review.course}</p>
							</div>
							<span class="flex-shrink-0 text-xs text-slate-400">{review.date}</span>
						</a>
					{/each}
				</div>
			</section>

			<section
				aria-labelledby="heading-income"
				class="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 via-teal-700 to-slate-900 p-6 text-white"
			>
				<div class="absolute -top-12 -right-12 h-40 w-40 rounded-full bg-white/10 blur-2xl" aria-hidden="true"></div>
				<div class="absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-amber-400/20 blur-2xl" aria-hidden="true"></div>

				<div class="relative z-10">
					<div
						class="mb-4 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-bold text-emerald-200"
					>
						<i class="fa-solid fa-chart-line" aria-hidden="true"></i> Pendapatan
					</div>
					<div class="mb-1 text-4xl font-bold">Rp 8,4 jt</div>
					<p class="mb-6 text-sm text-emerald-100">pendapatan bulan Agustus 2026</p>

					<div class="space-y-3">
						<div>
							<div class="mb-1.5 flex justify-between text-xs">
								<span class="text-emerald-100">Tersedia untuk ditarik</span>
								<span class="font-bold">Rp 5,1 jt</span>
							</div>
							<div class="h-2 overflow-hidden rounded-full bg-white/20">
								<div class="h-full rounded-full bg-emerald-300" style="width: 61%"></div>
							</div>
						</div>
						<div>
							<div class="mb-1.5 flex justify-between text-xs">
								<span class="text-emerald-100">Dalam proses</span>
								<span class="font-bold">Rp 3,3 jt</span>
							</div>
							<div class="h-2 overflow-hidden rounded-full bg-white/20">
								<div class="h-full rounded-full bg-amber-300" style="width: 39%"></div>
							</div>
						</div>
					</div>

					<a
						href="/instruktur/pendapatan"
						class="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-white/15 py-2.5 px-4 text-sm font-semibold text-white transition-colors duration-200 ease-smooth hover:bg-white/25 focus-visible:outline-2 focus-visible:outline-white"
					>
						Lihat Rincian Pendapatan
						<i class="fa-solid fa-arrow-right text-xs" aria-hidden="true"></i>
					</a>
				</div>
			</section>
		</div>
	</div>
</div>
