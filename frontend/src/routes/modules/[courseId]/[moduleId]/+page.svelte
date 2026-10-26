<script lang="ts">
	import { page } from '$app/state';
	import '../../../../app.css';
	import Logo from '$lib/components/Logo.svelte';
	import MaterialTypeIcon from '$lib/components/training/atoms/MaterialTypeIcon.svelte';
	import { getCourseById, getModuleMaterials } from '$lib/data/courses';
	import { getCourseMeta } from '$lib/data/course-meta';
	import { resolveSubModules, subModuleHref } from '$lib/data/training';
	import { locateModule, moduleCredentialId } from '$lib/data/certificates';

	const courseId = $derived(Number(page.params.courseId));
	const moduleId = $derived(page.params.moduleId);
	const course = $derived(getCourseById(courseId));
	const meta = $derived(course ? getCourseMeta(course.id) : undefined);
	const located = $derived(course && moduleId ? locateModule(course, moduleId) : null);
	const module = $derived(located?.module ?? null);
	const moduleIndex = $derived(located?.moduleIndex ?? -1);
	const subs = $derived(module ? resolveSubModules(module) : []);
	const mats = $derived(module ? getModuleMaterials(module) : []);
	const cred = $derived(course && moduleIndex >= 0 ? moduleCredentialId(course.id, moduleIndex) : '');
	const prev = $derived(
		course && moduleIndex > 0 ? course.modules[moduleIndex - 1] : null
	);
	const next = $derived(
		course && moduleIndex >= 0 && moduleIndex < course.modules.length - 1
			? course.modules[moduleIndex + 1]
			: null
	);

	let menuOpen = $state(false);
</script>

<svelte:head>
	<title>
		{course && module
			? `Modul ${moduleIndex + 1}: ${module.title} — ${course.title}`
			: 'Modul tidak ditemukan'} — Aristoteles Platform
	</title>
	<meta
		name="description"
		content={course && module
			? `Detail Modul ${moduleIndex + 1} ${module.title}: ${subs.length} sub-modul, ${mats.length} materi, 1 sertifikat modul (${cred}).`
			: 'Detail modul pelatihan.'}
	/>
</svelte:head>

<header class="sticky top-0 z-50 bg-white shadow-sm">
	<div class="mx-auto flex h-20 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
		<a href="/" class="flex shrink-0 items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-blue-600" aria-label="Aristoteles - Beranda">
			<Logo size="md" showText={true} textSize="xl" />
		</a>
		<nav aria-label="Navigasi utama" class="hidden min-w-0 flex-1 items-center justify-center gap-5 font-semibold text-[13px] text-slate-700 lg:flex xl:gap-7">
			<a href="/#beranda" class="whitespace-nowrap hover:text-blue-600">BERANDA</a>
			<a href="/modules" aria-current="page" class="whitespace-nowrap text-blue-600">PELATIHAN</a>
			<a href="/#peringkat" class="whitespace-nowrap hover:text-blue-600">PERINGKAT</a>
			<a href="/#tentang" class="whitespace-nowrap hover:text-blue-600">TENTANG</a>
			<a href="/#verifikasi" class="whitespace-nowrap hover:text-blue-600">VERIFIKASI</a>
		</nav>
		<div class="hidden shrink-0 items-center gap-2.5 sm:flex">
			<a href="/login" class="inline-flex min-h-[44px] items-center justify-center rounded-full border border-blue-600 px-5 text-xs font-bold text-blue-700 uppercase hover:bg-blue-50">Masuk</a>
			<a href="/register" class="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-blue-600 px-5 text-xs font-bold text-white uppercase shadow-lg shadow-blue-500/25 hover:bg-blue-700">
				Mulai Belajar <i class="fa-solid fa-arrow-right text-[11px]" aria-hidden="true"></i>
			</a>
		</div>
		<button
			type="button"
			onclick={() => (menuOpen = !menuOpen)}
			aria-expanded={menuOpen}
			aria-label={menuOpen ? 'Tutup menu' : 'Buka menu'}
			class="flex min-h-11 min-w-11 items-center justify-center rounded-xl p-2 text-slate-700 hover:bg-slate-100 lg:hidden"
		>
			<i class={`fa-solid ${menuOpen ? 'fa-xmark' : 'fa-bars'} text-xl`} aria-hidden="true"></i>
		</button>
	</div>
</header>

<main class="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
	{#if !course || !module || moduleIndex < 0}
		<div class="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-10 text-center">
			<i class="fa-solid fa-triangle-exclamation mb-3 text-3xl text-amber-500" aria-hidden="true"></i>
			<h1 class="text-xl font-bold text-slate-900">Modul tidak ditemukan</h1>
			<p class="mt-1 text-sm text-slate-500">
				Modul “{page.params.moduleId}” tidak terdaftar pada pelatihan “{page.params.courseId}”.
			</p>
			<a href={`/modules/${page.params.courseId}`} class="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-blue-700">
				<i class="fa-solid fa-arrow-left" aria-hidden="true"></i> Kembali ke Learning Path
			</a>
		</div>
	{:else}
		<nav aria-label="Breadcrumb" class="mb-4 flex flex-wrap items-center gap-2 text-xs text-slate-500">
			<a href="/modules" class="rounded font-semibold text-blue-600 hover:text-blue-700">Semua Pelatihan</a>
			<i class="fa-solid fa-chevron-right text-[10px] text-slate-300" aria-hidden="true"></i>
			<a href={`/modules/${course.id}`} class="rounded font-semibold text-blue-600 hover:text-blue-700">{course.title}</a>
			<i class="fa-solid fa-chevron-right text-[10px] text-slate-300" aria-hidden="true"></i>
			<span aria-current="page" class="max-w-64 truncate font-medium text-slate-700">Modul {moduleIndex + 1}: {module.title}</span>
		</nav>

		<header class="mb-6 overflow-hidden rounded-2xl border border-slate-200/70 bg-white">
			<div class="relative flex min-h-48 flex-col justify-end overflow-hidden sm:min-h-56">
				<img src={course.image} alt="" aria-hidden="true" class="absolute inset-0 h-full w-full object-cover" />
				<div class="absolute inset-0 bg-gradient-to-t from-slate-900/85 via-slate-900/40 to-slate-900/10" aria-hidden="true"></div>
				<div class="relative p-4 pt-14 sm:px-6 sm:pt-16">
					<p class="flex flex-wrap items-center gap-2 text-[11px] font-bold tracking-widest text-blue-300 uppercase">
						<span>Modul {moduleIndex + 1} dari {course.modules.length}</span>
						<span class="rounded-md bg-white/15 px-2 py-0.5 text-white normal-case tracking-normal">
							{subs.length} sub-modul · {mats.length} materi
						</span>
					</p>
					<h1 class="mt-1.5 text-xl leading-snug font-extrabold text-white sm:text-2xl">
						{module.title}
					</h1>
					<p class="mt-1 text-xs text-slate-200 sm:text-sm">
						{course.title} · {meta?.price ?? ''} · {course.duration}
					</p>
				</div>
			</div>
			<div class="grid gap-4 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_300px]">
				<div>
					<h2 class="text-sm font-extrabold tracking-widest text-slate-500 uppercase">Tentang modul ini</h2>
					<p class="mt-1.5 text-sm leading-relaxed text-slate-600">{module.description}</p>
				</div>
				<aside id="sertifikat" aria-label={`Sertifikat Modul ${moduleIndex + 1}`} class="rounded-2xl border border-amber-200 bg-amber-50 p-4">
					<p class="flex items-center gap-2 text-[11px] font-extrabold tracking-widest text-amber-800 uppercase">
						<i class="fa-solid fa-award" aria-hidden="true"></i> Sertifikat Modul {moduleIndex + 1}
					</p>
					<p class="mt-1 text-sm font-extrabold text-slate-900">{module.title}</p>
					<p class="mt-1 text-[11px] leading-relaxed text-slate-600">
						Terbuka setelah {mats.length} materi dalam {subs.length} sub-modul tuntas.
					</p>
					<p class="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 font-mono text-[11px] font-bold text-slate-800 ring-1 ring-amber-200">
						<i class="fa-solid fa-fingerprint text-amber-500" aria-hidden="true"></i> {cred}
					</p>
					<a href="/login" class="mt-3 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-700">
						<i class="fa-solid fa-arrow-right-to-bracket" aria-hidden="true"></i> Masuk untuk mengejar sertifikat
					</a>
				</aside>
			</div>
		</header>

		<div class="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
			<section aria-labelledby="sub-list-heading" class="rounded-2xl border border-slate-200/70 bg-white p-4 sm:p-6">
				<h2 id="sub-list-heading" class="text-lg font-bold text-slate-900">
					Learning Path Modul {moduleIndex + 1}
					<span class="ml-1 text-xs font-semibold text-slate-500">· {subs.length} sub-modul berurutan</span>
				</h2>
				<p class="mt-1 text-[13px] text-slate-600">
					Pelajari sub-modul berurutan dari {moduleIndex + 1}.1 hingga {moduleIndex + 1}.{subs.length}.
					Klik sub-modul untuk melihat kumpulan materinya.
				</p>
				<ol class="mt-4 space-y-3">
					{#each subs as sub, si (sub.id)}
						<li class="rounded-2xl border border-slate-200/80 bg-white p-4 transition-shadow hover:shadow-lg">
							<div class="flex items-start gap-3">
								<span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-xs font-extrabold text-violet-700" aria-hidden="true">
									{moduleIndex + 1}.{si + 1}
								</span>
								<div class="min-w-0 flex-1">
									<h3 class="text-[15px] font-extrabold text-slate-900">
										<a href={subModuleHref(course.id, module.id, sub.id)} class="rounded hover:text-violet-700 focus-visible:outline-2 focus-visible:outline-violet-600">
											{sub.title}
										</a>
									</h3>
									<p class="mt-0.5 line-clamp-2 text-[13px] text-slate-600">{sub.description}</p>
									<ul class="mt-2 flex flex-wrap gap-1.5" aria-label={`Tipe materi Sub-modul ${moduleIndex + 1}.${si + 1}`}>
										{#each sub.materials as m (m.id)}
											<li class="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
												<MaterialTypeIcon type={m.type} />
												<span class="max-w-40 truncate">{m.title}</span>
												<span class="text-slate-400">· {m.duration}</span>
											</li>
										{/each}
									</ul>
								</div>
							</div>
							<div class="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
								<p class="text-[11px] font-bold text-slate-500">{sub.materials.length} materi</p>
								<a
									href={subModuleHref(course.id, module.id, sub.id)}
									class="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-[11px] font-bold text-white hover:bg-violet-700"
									aria-label={`Buka Sub-modul ${moduleIndex + 1}.${si + 1}: ${sub.title}`}
								>
									Buka sub-modul <i class="fa-solid fa-arrow-right text-[10px]" aria-hidden="true"></i>
								</a>
							</div>
						</li>
					{/each}
				</ol>
				<div class="mt-4 flex flex-wrap gap-2">
					{#if prev}
						<a href={`/modules/${course.id}/${prev.id}`} class="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50">
							<i class="fa-solid fa-arrow-left" aria-hidden="true"></i> Modul {moduleIndex}: {prev.title}
						</a>
					{/if}
					{#if next}
						<a href={`/modules/${course.id}/${next.id}`} class="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-700">
							Modul {moduleIndex + 2}: {next.title} <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
						</a>
					{/if}
				</div>
			</section>

			<aside class="space-y-4 lg:sticky lg:top-24">
				<div class="overflow-hidden rounded-2xl border border-slate-200/70 bg-white">
					<div class="bg-blue-800 px-5 py-4 text-white">
						<p class="text-[11px] font-extrabold tracking-widest text-blue-200 uppercase">Ringkasan modul</p>
						<p class="mt-0.5 text-lg font-extrabold">Modul {moduleIndex + 1}</p>
					</div>
					<dl class="space-y-2.5 p-5 text-[13px]">
						<div class="flex justify-between gap-2">
							<dt class="text-slate-500">Sub-modul</dt>
							<dd class="font-bold text-slate-900">{subs.length}</dd>
						</div>
						<div class="flex justify-between gap-2">
							<dt class="text-slate-500">Materi</dt>
							<dd class="font-bold text-slate-900">{mats.length}</dd>
						</div>
						<div class="flex justify-between gap-2">
							<dt class="text-slate-500">Sertifikat</dt>
							<dd class="font-bold text-amber-700">1 sertifikat modul</dd>
						</div>
						<div class="flex justify-between gap-2">
							<dt class="text-slate-500">ID Kredensial</dt>
							<dd class="font-mono text-[11px] font-bold text-slate-800">{cred}</dd>
						</div>
					</dl>
					<div class="border-t border-slate-100 p-5 pt-4">
						<a href={`/modules/${course.id}`} class="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50">
							<i class="fa-solid fa-route" aria-hidden="true"></i> Semua modul
						</a>
						<a href="/login" class="mt-2 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-700">
							<i class="fa-solid fa-play" aria-hidden="true"></i> Masuk untuk belajar
						</a>
					</div>
				</div>
			</aside>
		</div>
	{/if}
</main>

<footer class="border-t border-slate-800 bg-slate-900 py-8 text-center text-xs text-slate-500">
	&copy; 2026 Aristoteles Platform Mikrokredensial. Semua hak dilindungi.
</footer>
