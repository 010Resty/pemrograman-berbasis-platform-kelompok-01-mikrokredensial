<script lang="ts">
	import { tick } from 'svelte';
	import { page } from '$app/state';
	import { getCourseById } from '$lib/data/courses';
	import { getQuizResult, type QuizResult } from '$lib/stores/quiz-results.svelte';

	const PASS_SCORE = 70;

	const courseId = $derived(Number(page.params.courseId));
	const course = $derived(getCourseById(courseId));
	const module = $derived(course?.modules.find((m) => m.id === page.params.moduleId));
	const matIndex = $derived(module?.materials.findIndex((m) => m.id === page.params.materialId) ?? -1);
	const material = $derived(matIndex >= 0 ? module?.materials[matIndex] : undefined);
	const moduleIndex = $derived(course?.modules.findIndex((m) => m.id === page.params.moduleId) ?? -1);

	const next = $derived(
		module && matIndex >= 0 && matIndex < module.materials.length - 1
			? module.materials[matIndex + 1]
			: undefined
	);
	const nextModule = $derived(
		course && moduleIndex >= 0 && moduleIndex < course.modules.length - 1
			? course.modules[moduleIndex + 1]
			: undefined
	);
	const nextModuleFirst = $derived(nextModule?.materials[0]);

	/** Hasil dibaca di client (tersimpan saat mengumpulkan) agar refresh tetap tampil. */
	let result = $state<QuizResult | null>(null);
	let loaded = $state(false);
	let heading: HTMLHeadingElement | null = $state(null);

	$effect(() => {
		result = getQuizResult(page.params.materialId ?? '') ?? null;
		loaded = true;
	});

	$effect(() => {
		if (loaded && result) {
			tick().then(() => heading?.focus());
		}
	});
</script>

<svelte:head>
	<title>
		{material && course ? `Hasil Kuis: ${material.title} — ${course.title}` : 'Hasil Kuis'} — Aristoteles
	</title>
	<meta
		name="description"
		content={material ? `Nilai kuis: ${material.title}` : 'Halaman nilai hasil kuis'}
	/>
</svelte:head>

<div class="min-h-screen p-4 sm:p-6">
	{#if !course || !module || !material}
		<div class="mx-auto max-w-lg">
			<div class="rounded-2xl border border-slate-200 bg-white p-10 text-center">
				<i class="fa-solid fa-triangle-exclamation mb-3 text-3xl text-amber-500" aria-hidden="true"></i>
				<h1 class="text-xl font-bold text-slate-900">Materi tidak ditemukan</h1>
				<p class="mt-1 text-sm text-slate-500">Tautan hasil kuis ini tidak valid atau sudah dipindahkan.</p>
				<a
					href="/user/kursusku"
					class="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
				>
					<i class="fa-solid fa-arrow-left" aria-hidden="true"></i> Kembali ke Kursusku
				</a>
			</div>
		</div>
	{:else}
		<nav aria-label="Breadcrumb" class="mx-auto mb-4 flex max-w-2xl flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
			<a href="/user/kursusku" class="rounded font-semibold text-blue-600 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600">
				Kursusku
			</a>
			<i class="fa-solid fa-chevron-right text-[10px] text-slate-300" aria-hidden="true"></i>
			<a
				href={`/user/kursusku/${course.id}`}
				class="max-w-40 truncate rounded font-semibold text-blue-600 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
			>
				{course.title}
			</a>
			<i class="fa-solid fa-chevron-right text-[10px] text-slate-300" aria-hidden="true"></i>
			<a
				href={`/user/kursusku/${course.id}/${module.id}/${material.id}`}
				class="max-w-48 truncate rounded font-medium text-slate-600 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-blue-600"
			>
				{material.title}
			</a>
			<i class="fa-solid fa-chevron-right text-[10px] text-slate-300" aria-hidden="true"></i>
			<span aria-current="page" class="font-medium text-slate-700">Hasil Kuis</span>
		</nav>

		<div class="mx-auto max-w-2xl">
			{#if !loaded}
				<div class="rounded-2xl border border-slate-200 bg-white p-10 text-center" role="status">
					<i class="fa-solid fa-circle-notch fa-spin text-2xl text-blue-500" aria-hidden="true"></i>
					<p class="mt-3 text-sm font-semibold text-slate-500">Memuat nilai…</p>
				</div>
			{:else if !result}
				<div class="rounded-2xl border border-slate-200 bg-white p-10 text-center">
					<i class="fa-solid fa-clipboard-question mb-3 text-3xl text-slate-300" aria-hidden="true"></i>
					<h1 class="text-xl font-bold text-slate-900">Hasil belum tersedia</h1>
					<p class="mx-auto mt-1 max-w-md text-sm text-slate-500">
						Kerjakan dulu kuis <strong class="text-slate-700">“{material.title}”</strong> untuk melihat nilaimu di sini.
					</p>
					<a
						href={`/user/kursusku/${course.id}/${module.id}/${material.id}`}
						class="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-blue-600/25 hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
					>
						<i class="fa-solid fa-pen-to-square" aria-hidden="true"></i> Kerjakan Kuis
					</a>
				</div>
			{:else}
				{@const passed = result.passed}
				<div
					role="status"
					aria-live="polite"
					class={`overflow-hidden rounded-2xl border bg-white ${passed ? 'border-emerald-200' : 'border-amber-200'}`}
				>
					<div class={`px-6 pt-8 pb-6 text-center sm:px-10 ${passed ? 'bg-gradient-to-b from-emerald-50 to-white' : 'bg-gradient-to-b from-amber-50 to-white'}`}>
						<span
							class={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl text-white shadow-lg ${passed ? 'bg-emerald-600 shadow-emerald-600/25' : 'bg-amber-500 shadow-amber-500/25'}`}
							aria-hidden="true"
						>
							<i class={`fa-solid ${passed ? 'fa-trophy' : 'fa-rotate-right'} text-2xl`}></i>
						</span>
						<h1 bind:this={heading} tabindex="-1" class="mt-4 text-xl font-extrabold text-slate-900 focus-visible:outline-2 focus-visible:outline-blue-600 sm:text-2xl">
							{passed ? 'Lulus! 🎉' : 'Belum Lolos'}
						</h1>
						<p class="mt-1 text-xs text-slate-500 sm:text-sm">
							{material.title} · {course.title}
						</p>
						<p class={`mt-5 text-6xl font-black tracking-tight sm:text-7xl ${passed ? 'text-emerald-600' : 'text-amber-500'}`}>
							{result.score}
						</p>
						<p class="mt-2 text-sm font-bold text-slate-600">
							Benar {result.correct} dari {result.total} soal · minimal {PASS_SCORE} untuk lolos
						</p>
						<p class="mx-auto mt-2 max-w-md text-xs leading-relaxed text-slate-500">
							{passed
								? 'Kerja bagus! Materi berikutnya sudah terbuka — lanjutkan lewat tombol di bawah.'
								: 'Jangan menyerah. Pelajari kembali materinya, lalu ulangi kuis untuk memperbaiki nilaimu.'}
						</p>
						<p class="mt-1 text-[11px] text-slate-400">
							Dikerjakan {new Date(result.createdAt).toLocaleString('id-ID')}
						</p>
					</div>
					<div class="flex flex-col gap-2 border-t border-slate-100 p-5 sm:flex-row sm:p-6">
						<a
							href={`/user/kursusku/${course.id}/${module.id}/${material.id}`}
							class="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600"
						>
							<i class="fa-solid fa-rotate-left" aria-hidden="true"></i> Ulangi Kuis
						</a>
						{#if next}
							<a
								href={`/user/kursusku/${course.id}/${module.id}/${next.id}`}
								class="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-blue-600/25 hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
							>
								{next.type === 'kuis' ? 'Kuis Berikutnya' : 'Materi Berikutnya'}
								<i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
							</a>
						{:else if nextModule && nextModuleFirst}
							<a
								href={`/user/kursusku/${course.id}/${nextModule.id}/${nextModuleFirst.id}`}
								class="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-indigo-600/25 hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-indigo-600"
							>
								Lanjut Modul {(moduleIndex ?? 0) + 2}
								<i class="fa-solid fa-forward" aria-hidden="true"></i>
							</a>
						{:else}
							<a
								href={`/user/kursusku/${course.id}`}
								class="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-600/25 hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-emerald-600"
							>
								<i class="fa-solid fa-check" aria-hidden="true"></i> Kembali ke Modul
							</a>
						{/if}
					</div>
				</div>
				<p class="mt-3 text-center text-[11px] text-slate-400">
					Hasil hanya berupa nilai — soal mana yang benar/salah tidak ditampilkan.
				</p>
			{/if}
		</div>
	{/if}
</div>
