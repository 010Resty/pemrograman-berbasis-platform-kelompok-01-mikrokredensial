<script lang="ts">
	import { resolve } from '$app/paths';
	import type { Course } from '$lib/data/courses';
	import type { CourseMeta } from '$lib/data/course-meta';
	import { canAccessCourse, isCoursePaid, isPeriodLocked } from '$lib/stores/enrollment.svelte';

	let {
		course,
		meta,
		mode
	}: {
		course: Course;
		meta: CourseMeta;
		mode: 'public' | 'user';
	} = $props();

	const locked = $derived(
		mode === 'user' && isCoursePaid(course.id) && !canAccessCourse(course.id)
	);
	const periodLocked = $derived(mode === 'user' && isPeriodLocked(course.id));
</script>

<aside
	aria-label="Ringkasan dan pendaftaran pelatihan"
	class="overflow-hidden rounded-2xl border border-slate-200/70 bg-white lg:sticky lg:top-24"
>
	<div class="relative">
		<img
			src={course.image}
			alt=""
			aria-hidden="true"
			class="h-36 w-full object-cover"
			loading="lazy"
		/>
		<span
			class="absolute bottom-3 left-4 rounded-lg bg-slate-900/80 px-3 py-1.5 text-lg font-extrabold text-white backdrop-blur"
		>
			{meta.price}
		</span>
	</div>
	<div class="space-y-3 p-5">
		{#if meta.period === 'ended'}
			<span
				class="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-slate-200 px-4 py-3 text-sm font-bold text-slate-500"
				title="Batch pelatihan ini sudah lewat"
			>
				<i class="fa-solid fa-clock-rotate-left" aria-hidden="true"></i> Periode Berakhir
			</span>
			<p class="text-center text-[11px] text-slate-500">
				Batch pelatihan ini sudah lewat. Pantau katalog untuk batch berikutnya.
			</p>
		{:else if mode === 'public'}
			<a
				href={resolve('/login')}
				class="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/25 transition-all duration-200 ease-smooth hover:bg-blue-700 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-blue-600"
			>
				<i class="fa-solid fa-arrow-right-to-bracket" aria-hidden="true"></i>
				{meta.period === 'upcoming'
					? `Daftar Batch ${meta.startMonth ?? ''}`.trim()
					: 'Masuk untuk Mulai'}
			</a>
			<p class="text-center text-[11px] text-slate-500">
				Masuk untuk melihat modul dan mulai belajar.
			</p>
		{:else if locked}
			<div class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center">
				<p class="text-[11px] font-extrabold tracking-widest text-amber-800 uppercase">
					Pelatihan Berbayar
				</p>
				<p class="mt-0.5 text-2xl font-black text-slate-900">{meta.price}</p>
				<p class="mt-0.5 text-[11px] text-slate-600">Sekali bayar · Akses selamanya</p>
			</div>
			<a
				href={mode === 'user'
					? resolve(`/user/pembayaran/${course.id}`)
					: resolve('/login')}
				class="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/25 transition-all duration-200 ease-smooth hover:bg-blue-700 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-blue-600"
			>
				<i class="fa-solid fa-credit-card" aria-hidden="true"></i> Lanjut ke Pembayaran
			</a>
			<p class="text-center text-[11px] text-slate-500">
				QRIS · VA · E-wallet · Kartu · Gerai retail
			</p>
		{:else if periodLocked}
			<div class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center">
				<p class="text-[11px] font-extrabold tracking-widest text-amber-800 uppercase">
					Terdaftar · Batch Belum Mulai
				</p>
				<p class="mt-0.5 text-lg font-black text-slate-900">
					Mulai {meta.startMonth ?? 'segera'}
				</p>
				<p class="mt-0.5 text-[11px] text-slate-600">Materi terkunci sampai batch berjalan</p>
			</div>
			<span
				aria-disabled="true"
				title="Materi terkunci sampai batch {meta.startMonth ?? ''} dimulai"
				class="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-slate-200 px-4 py-3 text-sm font-bold text-slate-500"
			>
				<i class="fa-solid fa-lock" aria-hidden="true"></i> Materi Terkunci
			</span>
			<p class="text-center text-[11px] text-slate-500">
				Kamu sudah terdaftar. Materi terbuka otomatis saat periode berjalan.
			</p>
		{:else}
			<a
				href={resolve(`/user/kursusku/${course.id}`)}
				class="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/25 transition-all duration-200 ease-smooth hover:bg-blue-700 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-blue-600"
			>
				<i class="fa-solid fa-play" aria-hidden="true"></i> Lanjut Belajar
			</a>
		{/if}
		<ul class="space-y-2 border-t border-slate-100 pt-3 text-[13px] text-slate-600">
			<li class="flex items-center gap-2.5">
				<i class="fa-solid fa-layer-group w-4 text-center text-slate-400" aria-hidden="true"></i> Modul
				→ sub-modul → materi bertahap
			</li>
			<li class="flex items-center gap-2.5">
				<i class="fa-solid fa-award w-4 text-center text-slate-400" aria-hidden="true"></i> Sertifikat
				kelulusan
			</li>
			<li class="flex items-center gap-2.5">
				<i class="fa-solid fa-mobile-screen w-4 text-center text-slate-400" aria-hidden="true"></i> Belajar
				via HP & laptop
			</li>
			<li class="flex items-center gap-2.5">
				<i class="fa-solid fa-users w-4 text-center text-slate-400" aria-hidden="true"></i> Komunitas
				diskusi
			</li>
		</ul>
	</div>
</aside>
