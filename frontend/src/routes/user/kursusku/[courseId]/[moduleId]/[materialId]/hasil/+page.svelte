<script lang="ts">
	import { browser } from '$app/environment';
	import { tick } from 'svelte';
	import { page } from '$app/state';
	import { getCourseById, type Course, type CourseModule } from '$lib/data/courses';
	import { getQuizResult, type QuizResult } from '$lib/stores/quiz-results.svelte';
	import { DEFAULT_PASS_SCORE, normalizePassScore } from '$lib/stores/quiz-drafts';
	import { fetchCourseDetail, fetchCourseTree, isServerId, toCourseView } from '$lib/api/courses';
	import {
		fetchQuizBest,
		fetchQuizHistory,
		type QuizAttemptRow,
		type QuizBest
	} from '$lib/api/quiz';

	const courseId = $derived(Number(page.params.courseId));
	/** ID numerik = materi backend (nilai terbaik + riwayat server, K-02). */
	const useServer = $derived(isServerId(page.params.materialId ?? ''));

	const localCourse = $derived(getCourseById(courseId));
	let serverCourse = $state<(Course & { modules: CourseModule[] }) | null>(null);
	const course = $derived(localCourse ?? serverCourse);
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

	// K-02 di backend: nilai terbaik + riwayat persisten per materi.
	let serverBest = $state<QuizBest | null>(null);
	let serverHistory = $state<QuizAttemptRow[]>([]);
	let serverError = $state('');
	let serverSeq = 0;

	async function loadServer(mid: number, cid: number): Promise<void> {
		const my = ++serverSeq;
		try {
			const [detail, tree, best, history] = await Promise.all([
				fetchCourseDetail(cid),
				fetchCourseTree(cid),
				fetchQuizBest(mid).catch(() => null),
				fetchQuizHistory(mid).catch(() => [] as QuizAttemptRow[])
			]);
			if (my !== serverSeq) return;
			serverCourse = { ...toCourseView(detail), modules: tree };
			serverBest = best;
			serverHistory = (history ?? []).slice(0, 5);
		} catch (e) {
			if (my !== serverSeq) return;
			serverBest = null;
			serverHistory = [];
			serverError = e instanceof Error ? e.message : 'Gagal memuat nilai dari server.';
		} finally {
			if (my === serverSeq) loaded = true;
		}
	}

	$effect(() => {
		if (!browser) return;
		let cancelled = false;
		const midParam = page.params.materialId ?? '';
		const cid = Number(page.params.courseId);
		serverBest = null;
		serverHistory = [];
		serverError = '';
		if (useServer && Number.isInteger(cid) && cid > 0) {
			loaded = false;
			void loadServer(Number(midParam), cid).then(() => {
				if (!cancelled) tick().then(() => heading?.focus());
			});
		} else {
			result = getQuizResult(midParam) ?? null;
			loaded = true;
		}
		return () => {
			cancelled = true;
		};
	});

	$effect(() => {
		if (loaded && result && !useServer) {
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
			{:else if useServer}
				{#if serverError}
					<div role="alert" class="rounded-2xl border border-red-200 bg-red-50 p-10 text-center">
						<i class="fa-solid fa-triangle-exclamation mb-3 text-3xl text-red-400" aria-hidden="true"></i>
						<h1 class="text-xl font-bold text-slate-900">Nilai belum dapat dimuat</h1>
						<p class="mx-auto mt-1 max-w-md text-sm text-red-600">{serverError}</p>
						<button
							type="button"
							onclick={() => {
								const mid = Number(page.params.materialId);
								const cid = Number(page.params.courseId);
								if (Number.isInteger(mid) && mid > 0 && Number.isInteger(cid) && cid > 0) {
									loaded = false;
									void loadServer(mid, cid);
								}
							}}
							class="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-red-600"
						>
							<i class="fa-solid fa-rotate-right" aria-hidden="true"></i> Coba lagi
						</button>
					</div>
				{:else if !serverBest || serverBest.attempts === 0}
					<div class="rounded-2xl border border-slate-200 bg-white p-10 text-center">
						<i class="fa-solid fa-clipboard-question mb-3 text-3xl text-slate-300" aria-hidden="true"></i>
						<h1 class="text-xl font-bold text-slate-900">Belum ada percobaan</h1>
						<p class="mx-auto mt-1 max-w-md text-sm text-slate-500">
							Kerjakan dulu kuis <strong class="text-slate-700">“{material.title}”</strong> untuk melihat nilaimu di sini. Nilai terbaikmu tersimpan di server.
						</p>
						<a
							href={`/user/kursusku/${course.id}/${module.id}/${material.id}`}
							class="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-blue-600/25 hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
						>
							<i class="fa-solid fa-pen-to-square" aria-hidden="true"></i> Kerjakan Kuis
						</a>
					</div>
				{:else}
					{@const serverPassed = serverBest.passed}
					<div
						role="status"
						aria-live="polite"
						class={`overflow-hidden rounded-2xl border bg-white ${serverPassed ? 'border-emerald-200' : 'border-amber-200'}`}
					>
						<div class={`px-6 pt-8 pb-6 text-center sm:px-10 ${serverPassed ? 'bg-gradient-to-b from-emerald-50 to-white' : 'bg-gradient-to-b from-amber-50 to-white'}`}>
							<span
								class={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl text-white shadow-lg ${serverPassed ? 'bg-emerald-600 shadow-emerald-600/25' : 'bg-amber-500 shadow-amber-500/25'}`}
								aria-hidden="true"
							>
								<i class={`fa-solid ${serverPassed ? 'fa-trophy' : 'fa-rotate-right'} text-2xl`}></i>
							</span>
							<h2 class="mt-4 text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">
								{serverPassed ? 'Lulus! 🎉' : 'Belum Lolos'}
							</h2>
							<p class="mt-1 text-xs text-slate-500 sm:text-sm">
								{material.title} · {course.title}
							</p>
							<p class={`mt-5 text-6xl font-black tracking-tight sm:text-7xl ${serverPassed ? 'text-emerald-600' : 'text-amber-500'}`}>
								{serverBest.bestScore ?? 0}
							</p>
							<p class="mt-2 text-sm font-bold text-slate-600">
								Terbaik dari {serverBest.attempts} percobaan · minimal {serverBest.effectivePassScore} untuk lulus
							</p>
							<p class="mx-auto mt-2 max-w-md text-xs leading-relaxed text-slate-500">
								{serverPassed
									? 'Kerja bagus! Nilai terbaikmu aman — percobaan berikutnya yang lebih rendah tidak akan menghapus kelulusan.'
									: 'Jangan menyerah. Pelajari kembali materinya, lalu ulangi kuis untuk memperbaiki nilaimu.'}
							</p>
							{#if serverHistory.length > 0}
								<ul class="mx-auto mt-5 max-w-md space-y-1.5 text-left" aria-label="Riwayat percobaan">
									{#each serverHistory as h (h.id)}
										<li class="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3.5 py-2 text-xs">
											<span class="font-bold tabular-nums text-slate-700">{h.score}</span>
											<span class="truncate text-slate-500">{new Date(h.attemptedAt).toLocaleString('id-ID')}</span>
											<span class={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${h.passed ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
												{h.passed ? 'Lulus' : 'Belum lulus'}
											</span>
										</li>
									{/each}
								</ul>
							{/if}
						</div>
						<div class="flex flex-col gap-2 border-t border-slate-100 p-5 sm:flex-row sm:p-6">
							<a
								href={`/user/kursusku/${course.id}/${module.id}/${material.id}`}
								class="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-slate-500"
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
						Nilai terbaik tersimpan di server dan bertahan walau percobaan berikutnya lebih rendah.
					</p>
				{/if}
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
				{@const effectivePass = normalizePassScore(result.passScore ?? DEFAULT_PASS_SCORE)}
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
							Benar {result.correct} dari {result.total} soal · minimal {effectivePass} untuk lolos
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
