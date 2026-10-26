<script lang="ts">
	import { page } from '$app/state';
	import '../../../../../app.css';
	import Logo from '$lib/components/Logo.svelte';
	import MaterialTypeIcon from '$lib/components/training/atoms/MaterialTypeIcon.svelte';
	import { getCourseById } from '$lib/data/courses';
	import { adjacentSubs, locateSubModule, resolveSubModules } from '$lib/data/training';
	import { locateModule, moduleCredentialId } from '$lib/data/certificates';

	const courseId = $derived(Number(page.params.courseId));
	const moduleId = $derived(page.params.moduleId);
	const subId = $derived(page.params.subId);
	const course = $derived(getCourseById(courseId));
	const locatedModule = $derived(course && moduleId ? locateModule(course, moduleId) : null);
	const located = $derived(
		course && moduleId && subId ? locateSubModule(course, moduleId, subId) : null
	);
	const moduleIndex = $derived(located?.moduleIndex ?? locatedModule?.moduleIndex ?? -1);
	const subIndex = $derived(located?.subIndex ?? -1);
	const module = $derived(located?.module ?? locatedModule?.module ?? null);
	const sub = $derived(located?.sub ?? null);
	const cred = $derived(
		course && moduleIndex >= 0 ? moduleCredentialId(course.id, moduleIndex) : ''
	);
	const nav = $derived(
		course && moduleId && subId ? adjacentSubs(course, moduleId, subId) : null
	);
	const subsInModule = $derived(module ? resolveSubModules(module) : []);

	function typeLabel(t: string): string {
		if (t === 'kuis') return 'Kuis';
		if (t === 'tugas') return 'Tugas';
		return 'Materi';
	}
</script>

<svelte:head>
	<title>
		{course && module && sub
			? `Sub-modul ${moduleIndex + 1}.${subIndex + 1}: ${sub.title} — ${course.title}`
			: 'Sub-modul tidak ditemukan'} — Aristoteles Platform
	</title>
	<meta
		name="description"
		content={course && module && sub
			? `Kumpulan materi Sub-modul ${moduleIndex + 1}.${subIndex + 1} ${sub.title}: ${sub.materials.length} materi, bagian dari Sertifikat Modul ${moduleIndex + 1} (${cred}).`
			: 'Kumpulan materi sub-modul pelatihan.'}
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
	</div>
</header>

<main class="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
	{#if !course || !module || !sub || moduleIndex < 0 || subIndex < 0}
		<div class="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-10 text-center">
			<i class="fa-solid fa-triangle-exclamation mb-3 text-3xl text-amber-500" aria-hidden="true"></i>
			<h1 class="text-xl font-bold text-slate-900">Sub-modul tidak ditemukan</h1>
			<p class="mt-1 text-sm text-slate-500">
				Sub-modul “{page.params.subId}” tidak terdaftar pada Modul “{page.params.moduleId}”.
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
			<a href={`/modules/${course.id}/${module.id}`} class="rounded font-semibold text-blue-600 hover:text-blue-700">Modul {moduleIndex + 1}</a>
			<i class="fa-solid fa-chevron-right text-[10px] text-slate-300" aria-hidden="true"></i>
			<span aria-current="page" class="max-w-64 truncate font-medium text-slate-700">Sub-modul {moduleIndex + 1}.{subIndex + 1}</span>
		</nav>

		<header class="mb-6 overflow-hidden rounded-2xl border border-slate-200/70 bg-white">
			<div class="relative flex min-h-44 flex-col justify-end overflow-hidden bg-slate-900 sm:min-h-52">
				<img src={course.image} alt="" aria-hidden="true" class="absolute inset-0 h-full w-full object-cover opacity-40" />
				<div class="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/50 to-slate-900/20" aria-hidden="true"></div>
				<div class="relative p-4 pt-12 sm:px-6 sm:pt-14">
					<p class="flex flex-wrap items-center gap-2 text-[11px] font-bold tracking-widest text-violet-300 uppercase">
						<span>Modul {moduleIndex + 1} · Sub-modul {subIndex + 1} dari {subsInModule.length}</span>
						<span class="rounded-md bg-white/15 px-2 py-0.5 text-white normal-case tracking-normal">
							{sub.materials.length} materi
						</span>
					</p>
					<h1 class="mt-1.5 text-xl leading-snug font-extrabold text-white sm:text-2xl">
						{sub.title}
					</h1>
					<p class="mt-1 text-xs text-slate-300 sm:text-sm">
						{module.title} · {course.title}
					</p>
				</div>
			</div>
			<div class="grid gap-4 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_300px]">
				<div>
					<h2 class="text-sm font-extrabold tracking-widest text-slate-500 uppercase">Tentang sub-modul ini</h2>
					<p class="mt-1.5 text-sm leading-relaxed text-slate-600">{sub.description}</p>
					<p class="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-violet-50 px-3 py-2 text-[11px] font-bold text-violet-800 ring-1 ring-violet-200">
						<i class="fa-solid fa-award text-amber-500" aria-hidden="true"></i>
						Bagian dari Sertifikat Modul {moduleIndex + 1} · {cred}
					</p>
				</div>
				<aside aria-label="Akses materi" class="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
					<p class="text-[11px] font-extrabold tracking-widest text-slate-500 uppercase">Pratinjau publik</p>
					<p class="mt-1 text-[13px] leading-relaxed text-slate-600">
						Kamu melihat daftar materi. Masuk untuk membuka materi & melacak progres sertifikat.
					</p>
					<a href="/login" class="mt-3 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-700">
						<i class="fa-solid fa-arrow-right-to-bracket" aria-hidden="true"></i> Masuk untuk membuka materi
					</a>
					<a href={`/modules/${course.id}/${module.id}`} class="mt-2 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50">
						<i class="fa-solid fa-layer-group" aria-hidden="true"></i> Semua sub-modul
					</a>
				</aside>
			</div>
		</header>

		<div class="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
			<section aria-labelledby="materi-heading" class="rounded-2xl border border-slate-200/70 bg-white p-4 sm:p-6">
				<h2 id="materi-heading" class="text-lg font-bold text-slate-900">
					Kumpulan Materi
					<span class="ml-1 text-xs font-semibold text-slate-500">· {sub.materials.length} materi berurutan</span>
				</h2>
				<p class="mt-1 text-[13px] text-slate-600">
					Selesaikan materi berurutan — progresnya dihitung menuju Sertifikat Modul {moduleIndex + 1}.
				</p>
				<ol class="mt-4 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200/70">
					{#each sub.materials as m, mi (m.id)}
						<li class="flex items-center gap-3 bg-white p-3.5 transition-colors hover:bg-slate-50/70 sm:px-5">
							<span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500" aria-hidden="true">
								<i class="fa-solid fa-lock text-xs"></i>
							</span>
							<span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100" aria-hidden="true">
								<MaterialTypeIcon type={m.type} />
							</span>
							<span class="min-w-0 flex-1">
								<span class="block truncate text-sm font-bold text-slate-800">
									<span class="mr-1.5 font-mono text-[11px] font-bold text-slate-400">{moduleIndex + 1}.{subIndex + 1}.{mi + 1}</span>{m.title}
								</span>
								<span class="mt-0.5 block text-[11px] text-slate-500">
									{typeLabel(m.type)} · {m.duration}
								</span>
							</span>
							<a
								href="/login"
								class="hidden shrink-0 items-center gap-1.5 rounded-full bg-blue-700 px-3.5 py-1.5 text-[11px] font-bold text-white hover:bg-blue-600 sm:inline-flex"
								aria-label={`Masuk untuk membuka materi ${typeLabel(m.type)}: ${m.title}`}
							>
								<i class="fa-solid fa-lock text-[10px]" aria-hidden="true"></i> Buka
							</a>
						</li>
					{/each}
				</ol>
				<div class="mt-4 flex flex-wrap gap-2">
					{#if nav?.prev}
						<a href={`/modules/${course.id}/${module.id}/${nav.prev.id}`} class="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50">
							<i class="fa-solid fa-arrow-left" aria-hidden="true"></i> {moduleIndex + 1}.{subsInModule.findIndex((s) => s.id === nav.prev?.id) + 1} {nav.prev.title}
						</a>
					{/if}
					{#if nav?.next}
						<a href={`/modules/${course.id}/${module.id}/${nav.next.id}`} class="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-violet-700">
							{moduleIndex + 1}.{subsInModule.findIndex((s) => s.id === nav.next?.id) + 1} {nav.next.title} <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
						</a>
					{:else}
						<a href={`/modules/${course.id}/${module.id}#sertifikat`} class="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-amber-400 px-4 py-2.5 text-xs font-bold text-slate-900 hover:bg-amber-300">
							<i class="fa-solid fa-award" aria-hidden="true"></i> Lihat Sertifikat Modul {moduleIndex + 1}
						</a>
					{/if}
				</div>
			</section>

			<aside class="space-y-4 lg:sticky lg:top-24">
				<nav aria-label={`Sub-modul lain di Modul ${moduleIndex + 1}`} class="overflow-hidden rounded-2xl border border-slate-200/70 bg-white">
					<p class="border-b border-slate-100 bg-slate-50 px-5 py-3 text-[11px] font-extrabold tracking-widest text-slate-500 uppercase">
						Sub-modul lain · Modul {moduleIndex + 1}
					</p>
					<ol class="divide-y divide-slate-100">
						{#each subsInModule as s, si (s.id)}
							<li>
								<a
									href={`/modules/${course.id}/${module.id}/${s.id}`}
									aria-current={s.id === sub.id ? 'page' : undefined}
									class={`flex items-center gap-3 px-5 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-violet-600 ${s.id === sub.id ? 'bg-violet-50/70' : 'hover:bg-slate-50'}`}
								>
									<span class={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-extrabold ${s.id === sub.id ? 'bg-violet-600 text-white' : 'bg-violet-100 text-violet-700'}`} aria-hidden="true">
										{si + 1}
									</span>
									<span class="min-w-0 flex-1">
										<span class="block truncate text-[13px] font-bold text-slate-900">{s.title}</span>
										<span class="block text-[11px] text-slate-500">{s.materials.length} materi</span>
									</span>
									{#if s.id === sub.id}
										<i class="fa-solid fa-circle-check text-emerald-500" aria-hidden="true"></i>
									{:else}
										<i class="fa-solid fa-chevron-right text-[10px] text-slate-300" aria-hidden="true"></i>
									{/if}
								</a>
							</li>
						{/each}
					</ol>
				</nav>
			</aside>
		</div>
	{/if}
</main>

<footer class="border-t border-slate-800 bg-slate-900 py-8 text-center text-xs text-slate-500">
	&copy; 2026 Aristoteles Platform Mikrokredensial. Semua hak dilindungi.
</footer>
