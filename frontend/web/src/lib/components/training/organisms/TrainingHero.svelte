<script lang="ts">
	import type { Course } from '$lib/data/courses';
	import type { CourseMeta } from '$lib/data/course-meta';
	import { periodBadgeClass, periodIcon, periodLabel } from '$lib/data/course-meta';
	import type { TrainingStats } from '$lib/data/training';

	let {
		course,
		meta,
		stats,
		crumbBackHref,
		crumbBackLabel
	}: {
		course: Course;
		meta: CourseMeta;
		stats: TrainingStats;
		crumbBackHref: string;
		crumbBackLabel: string;
	} = $props();
</script>

<div>
	<nav aria-label="Breadcrumb" class="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
		<a href={crumbBackHref} class="rounded font-semibold text-blue-600 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600">
			{crumbBackLabel}
		</a>
		<i class="fa-solid fa-chevron-right text-[10px] text-slate-300" aria-hidden="true"></i>
		<span aria-current="page" class="max-w-64 truncate font-medium text-slate-700">{course.title}</span>
	</nav>

	<header class="mb-6 overflow-hidden rounded-2xl border border-slate-200/70 bg-white">
		<div class="relative flex min-h-56 flex-col justify-end overflow-hidden sm:min-h-64">
			<img src={course.image} alt={`Sampul pelatihan ${course.title}`} class="absolute inset-0 h-full w-full object-cover" />
			<div class="absolute inset-0 bg-gradient-to-t from-slate-900/85 via-slate-900/40 to-slate-900/10" aria-hidden="true"></div>
			<div class="relative flex flex-wrap gap-2 p-4 pb-2 sm:px-6">
				<span class="rounded-full bg-blue-600 px-3 py-1 text-[11px] font-bold text-white uppercase">{course.category}</span>
				<span class="rounded-full bg-white/20 px-3 py-1 text-[11px] font-bold text-white uppercase backdrop-blur">{course.level}</span>
				<span class={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase ${periodBadgeClass(meta.period)}`}>
					<i class={`fa-solid ${periodIcon(meta.period)}`} aria-hidden="true"></i>
					{periodLabel(meta)}
				</span>
			</div>
			<div class="relative p-4 pt-1 sm:px-6 sm:pb-5">
				<h1 class="text-xl leading-snug font-extrabold text-white sm:text-3xl">{course.title}</h1>
				<p class="mt-1 text-xs text-slate-200 sm:text-sm">Oleh {course.instructor} · {course.duration}</p>
				<p class="mt-1 text-[11px] font-semibold tracking-wide text-blue-200 uppercase">
					Pelatihan · {stats.moduleCount} modul · {stats.subModuleCount} sub-modul · {stats.materialCount} materi
				</p>
			</div>
		</div>
		<dl class="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4 sm:px-6 sm:py-5">
			<div class="rounded-xl bg-slate-50 p-3 text-center">
				<dt class="sr-only">Rating</dt>
				<dd class="text-base font-extrabold text-slate-900">★ {meta.rating} <span class="text-xs font-medium text-slate-500">({meta.reviews})</span></dd>
				<dd class="text-[10px] font-medium text-slate-500 uppercase">Rating</dd>
			</div>
			<div class="rounded-xl bg-slate-50 p-3 text-center">
				<dt class="sr-only">Peserta</dt>
				<dd class="text-base font-extrabold text-slate-900">{meta.students.toLocaleString('id-ID')}</dd>
				<dd class="text-[10px] font-medium text-slate-500 uppercase">Peserta</dd>
			</div>
			<div class="rounded-xl bg-slate-50 p-3 text-center">
				<dt class="sr-only">Struktur kurikulum</dt>
				<dd class="text-base font-extrabold text-slate-900">{stats.moduleCount} · {stats.subModuleCount} · {stats.materialCount}</dd>
				<dd class="text-[10px] font-medium text-slate-500 uppercase">Modul · Sub · Materi</dd>
			</div>
			<div class="rounded-xl bg-slate-50 p-3 text-center">
				<dt class="sr-only">Harga</dt>
				<dd class="text-base font-extrabold text-blue-700">{meta.price}</dd>
				<dd class="text-[10px] font-medium text-slate-500 uppercase">Harga</dd>
			</div>
		</dl>
	</header>
</div>
