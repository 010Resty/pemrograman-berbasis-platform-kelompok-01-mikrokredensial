<script lang="ts">
	import { page } from '$app/state';
	import '../../../app.css';
	import Logo from '$lib/components/Logo.svelte';
	import { getCourseById } from '$lib/data/courses';
	import { getCourseMeta } from '$lib/data/course-meta';
	import { getTrainingStats } from '$lib/data/training';
	import { getCourseCertificate, getModuleCertificates } from '$lib/data/certificates';
	import TrainingHero from '$lib/components/training/organisms/TrainingHero.svelte';
	import LearningPathRoadmap from '$lib/components/training/organisms/LearningPathRoadmap.svelte';
	import ModuleLearningPath from '$lib/components/training/organisms/ModuleLearningPath.svelte';
	import TrainingActionCard from '$lib/components/training/organisms/TrainingActionCard.svelte';

	// Hierarki: Pelatihan → Modul → Sub-modul → Materi.
	// Setiap Modul menerbitkan 1 sertifikat; pelatihan menerbitkan 1 sertifikat akhir.
	const courseId = $derived(Number(page.params.courseId));
	const course = $derived(getCourseById(courseId));
	const meta = $derived(course ? getCourseMeta(course.id) : undefined);
	const stats = $derived(course ? getTrainingStats(course) : undefined);
	const moduleCerts = $derived(course ? getModuleCertificates(course) : []);
	const courseCert = $derived(course ? getCourseCertificate(course) : undefined);

	let menuOpen = $state(false);

	const mobileLinks = [
		{ href: '/', label: 'Beranda' },
		{ href: '/modules', label: 'Pelatihan' },
		{ href: '/#peringkat', label: 'Peringkat' },
		{ href: '/#tentang', label: 'Tentang' },
		{ href: '/#verifikasi', label: 'Verifikasi' }
	];
</script>

<svelte:head>
	<title>{course ? `${course.title} — Learning Path & Sertifikat Modul` : 'Pratinjau Pelatihan'} — Aristoteles Platform</title>
	<meta
		name="description"
		content={course
			? `Learning path ${course.title}: ${stats?.moduleCount ?? 0} modul, ${stats?.subModuleCount ?? 0} sub-modul, ${stats?.materialCount ?? 0} materi. Setiap modul ber-sertifikat.`
			: 'Informasi singkat pelatihan: learning path modul, sub-modul, materi, dan sertifikat.'}
	/>
</svelte:head>

<header class="sticky top-0 z-50 bg-white shadow-sm">
	<div class="mx-auto flex h-20 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
		<a href="/" class="flex shrink-0 items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-blue-600" aria-label="Aristoteles - Beranda">
			<Logo size="md" showText={true} textSize="xl" />
		</a>
		<nav aria-label="Navigasi utama" class="hidden min-w-0 flex-1 items-center justify-center gap-5 font-semibold text-[13px] text-slate-700 lg:flex xl:gap-7">
			<a href="/#beranda" class="whitespace-nowrap transition-colors duration-200 ease-smooth hover:text-blue-600">BERANDA</a>
			<a href="/modules" aria-current="page" class="whitespace-nowrap text-blue-600 transition-colors duration-200 ease-smooth hover:text-blue-700">PELATIHAN</a>
			<a href="/#peringkat" class="whitespace-nowrap transition-colors duration-200 ease-smooth hover:text-blue-600">PERINGKAT</a>
			<a href="/#tentang" class="whitespace-nowrap transition-colors duration-200 ease-smooth hover:text-blue-600">TENTANG</a>
			<a href="/#verifikasi" class="whitespace-nowrap transition-colors duration-200 ease-smooth hover:text-blue-600">VERIFIKASI</a>
		</nav>
		<div class="hidden shrink-0 items-center gap-2.5 sm:flex">
			<a
				href="/login"
				class="inline-flex min-h-[44px] items-center justify-center rounded-full border border-blue-600 px-5 text-xs font-bold whitespace-nowrap text-blue-700 uppercase transition-all duration-200 ease-smooth hover:bg-blue-50 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
			>
				Masuk
			</a>
			<a
				href="/register"
				class="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-blue-600 px-5 text-xs font-bold whitespace-nowrap text-white uppercase shadow-lg shadow-blue-500/25 transition-all duration-200 ease-smooth hover:bg-blue-700 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
			>
				Mulai Belajar
				<i class="fa-solid fa-arrow-right text-[11px]" aria-hidden="true"></i>
			</a>
		</div>
		<button
			type="button"
			onclick={() => (menuOpen = !menuOpen)}
			aria-expanded={menuOpen}
			aria-controls="mobile-nav"
			aria-label={menuOpen ? 'Tutup menu navigasi' : 'Buka menu navigasi'}
			class="flex min-h-11 min-w-11 items-center justify-center rounded-xl p-2 text-slate-700 transition-colors duration-200 ease-smooth hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-600 lg:hidden"
		>
			<i class={`fa-solid ${menuOpen ? 'fa-xmark' : 'fa-bars'} text-xl`} aria-hidden="true"></i>
		</button>
	</div>
	<nav
		id="mobile-nav"
		aria-label="Navigasi seluler"
		inert={!menuOpen}
		class={`grid transition-[grid-template-rows,visibility] duration-300 ease-smooth lg:hidden ${menuOpen ? 'grid-rows-[1fr] visible' : 'grid-rows-[0fr] invisible'}`}
	>
		<div class="min-h-0 overflow-hidden">
			<div class="border-t border-slate-100 bg-white px-4 pt-2 pb-5 sm:px-6">
				<ul class="divide-y divide-slate-100 text-sm font-semibold text-slate-700">
					{#each mobileLinks as link (link.href)}
						<li>
							<a
								href={link.href}
								onclick={() => (menuOpen = false)}
								class="block rounded-lg px-2 py-3 uppercase tracking-wide transition-colors duration-200 ease-smooth hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
							>
								{link.label}
							</a>
						</li>
					{/each}
				</ul>
				<div class="mt-3 grid grid-cols-2 gap-2.5 sm:hidden">
					<a href="/login" class="inline-flex min-h-[44px] items-center justify-center rounded-full border border-blue-600 px-4 text-xs font-bold text-blue-700 uppercase transition-all duration-200 ease-smooth hover:bg-blue-50 active:scale-[0.98]">
						Masuk
					</a>
					<a href="/register" class="inline-flex min-h-[44px] items-center justify-center rounded-full bg-blue-600 px-4 text-xs font-bold text-white uppercase shadow-lg shadow-blue-500/25 transition-all duration-200 ease-smooth hover:bg-blue-700 active:scale-[0.98]">
						Mulai Belajar
					</a>
				</div>
			</div>
		</div>
	</nav>
</header>

<main class="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
	{#if !course || !meta || !stats}
		<div class="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-10 text-center">
			<i class="fa-solid fa-triangle-exclamation mb-3 text-3xl text-amber-500" aria-hidden="true"></i>
			<h1 class="text-xl font-bold text-slate-900">Pelatihan tidak ditemukan</h1>
			<p class="mt-1 text-sm text-slate-500">ID pelatihan “{page.params.courseId}” tidak terdaftar.</p>
			<a
				href="/modules"
				class="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white transition-all duration-200 ease-smooth hover:bg-blue-700 active:scale-[0.98]"
			>
				<i class="fa-solid fa-arrow-left" aria-hidden="true"></i> Kembali ke Semua Pelatihan
			</a>
		</div>
	{:else}
		<TrainingHero {course} {meta} {stats} crumbBackHref="/modules" crumbBackLabel="Semua Pelatihan" />

		<div class="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
			<div class="min-w-0 space-y-6">
				<section aria-labelledby="pv-tentang" class="rounded-2xl border border-slate-200/70 bg-white p-5 sm:p-6">
					<h2 id="pv-tentang" class="mb-2 text-lg font-bold text-slate-900">Tentang Pelatihan Ini</h2>
					<p class="text-sm leading-relaxed text-slate-600">{course.description}</p>
					<p class="mt-3 inline-flex flex-wrap items-center gap-2 rounded-xl bg-blue-50 px-3 py-2 text-[11px] font-bold text-blue-800">
						<i class="fa-solid fa-award" aria-hidden="true"></i>
						{moduleCerts.length} Sertifikat Modul + 1 Sertifikat Pelatihan
						<span class="font-medium text-blue-600">· setiap modul yang tuntas menerbitkan sertifikatnya sendiri</span>
					</p>
				</section>

				<section aria-labelledby="pv-outcome" class="rounded-2xl border border-slate-200/70 bg-white p-5 sm:p-6">
					<h2 id="pv-outcome" class="mb-4 text-lg font-bold text-slate-900">Yang Akan Kamu Pelajari</h2>
					<ul class="grid gap-2.5 sm:grid-cols-2">
						{#each meta.outcomes as out (out)}
							<li class="flex items-start gap-2.5 text-sm text-slate-700">
								<i class="fa-solid fa-circle-check mt-0.5 shrink-0 text-emerald-500" aria-hidden="true"></i>
								<span>{out}</span>
							</li>
						{/each}
					</ul>
				</section>

				<!-- UTAMA: learning path Modul → Sub-modul → Sertifikat per modul -->
				<ModuleLearningPath {course} />

				<!-- Sertifikat per modul -->
				<section aria-labelledby="pv-sertifikat" class="rounded-2xl border border-amber-200/70 bg-gradient-to-br from-amber-50 to-white p-5 sm:p-6">
					<h2 id="pv-sertifikat" class="flex items-center gap-2 text-lg font-bold text-slate-900">
						<span class="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400 text-slate-900" aria-hidden="true">
							<i class="fa-solid fa-award" aria-hidden="true"></i>
						</span>
						Sertifikat per Modul
					</h2>
					<p class="mt-1.5 text-[13px] leading-relaxed text-slate-600">
						Setiap modul memiliki sertifikatnya sendiri. Selesaikan seluruh sub-modul & materi dalam
						satu modul untuk membuka sertifikat modul tersebut — tanpa harus menunggu seluruh
						pelatihan selesai.
					</p>
					<ol class="mt-4 grid gap-3 sm:grid-cols-2">
						{#each moduleCerts as cert (cert.moduleId)}
							<li class="flex items-start gap-3 rounded-xl border border-amber-200/80 bg-white p-3.5">
								<span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-amber-400" aria-hidden="true">
									<i class="fa-solid fa-medal" aria-hidden="true"></i>
								</span>
								<span class="min-w-0">
									<span class="block text-[13px] font-extrabold text-slate-900">
										Modul {cert.moduleIndex + 1}: {cert.moduleTitle}
									</span>
									<span class="mt-0.5 block text-[11px] text-slate-500">
										{cert.subModuleCount} sub-modul · {cert.materialCount} materi
									</span>
									<span class="mt-1 inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2 py-1 font-mono text-[10px] font-bold text-slate-700">
										<i class="fa-solid fa-fingerprint text-[10px] text-slate-400" aria-hidden="true"></i>
										{cert.credentialId}
									</span>
								</span>
							</li>
						{/each}
						{#if courseCert}
							<li class="flex items-start gap-3 rounded-xl border-2 border-dashed border-emerald-300 bg-emerald-50/60 p-3.5">
								<span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white" aria-hidden="true">
									<i class="fa-solid fa-graduation-cap" aria-hidden="true"></i>
								</span>
								<span class="min-w-0">
									<span class="block text-[13px] font-extrabold text-slate-900">
										Sertifikat Pelatihan: {courseCert.courseTitle}
									</span>
									<span class="mt-0.5 block text-[11px] text-slate-500">
										Terbuka setelah {courseCert.moduleCount} modul tuntas · {courseCert.materialCount} materi
									</span>
									<span class="mt-1 inline-flex items-center gap-1.5 rounded-md bg-white px-2 py-1 font-mono text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-200">
										<i class="fa-solid fa-fingerprint text-[10px]" aria-hidden="true"></i>
										{courseCert.credentialId}
									</span>
								</span>
							</li>
						{/if}
					</ol>
					<p class="mt-3 flex items-center gap-1.5 text-[11px] text-slate-500">
						<i class="fa-solid fa-shield-halved text-emerald-600" aria-hidden="true"></i>
						Seluruh sertifikat terverifikasi & dapat divalidasi di halaman Verifikasi.
					</p>
				</section>

				<!-- Peta visual (tetap ada sebagai ringkasan interaktif) -->
				<LearningPathRoadmap modules={course.modules} courseId={course.id} />

				<section aria-labelledby="pv-syarat" class="rounded-2xl border border-slate-200/70 bg-white p-5 sm:p-6">
					<h2 id="pv-syarat" class="mb-3 text-lg font-bold text-slate-900">Syarat Mengikuti</h2>
					<ul class="space-y-2">
						{#each meta.requirements as req (req)}
							<li class="flex items-start gap-2.5 text-sm text-slate-600">
								<i class="fa-solid fa-circle-info mt-0.5 shrink-0 text-blue-400" aria-hidden="true"></i>
								<span>{req}</span>
							</li>
						{/each}
					</ul>
				</section>
			</div>

			<TrainingActionCard {course} {meta} mode="public" />
		</div>
	{/if}
</main>

<footer class="border-t border-slate-800 bg-slate-900 py-8 text-center text-xs text-slate-500">
	&copy; 2026 Aristoteles Platform Mikrokredensial. Semua hak dilindungi.
</footer>
