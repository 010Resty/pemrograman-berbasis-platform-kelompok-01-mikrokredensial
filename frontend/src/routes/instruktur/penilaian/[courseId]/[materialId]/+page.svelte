<script lang="ts">
	import { page } from '$app/state';
	import { getCourseById } from '$lib/data/courses';
	import { getTaskInfo, resolveTaskKey } from '$lib/data/grading';
	import {
		allReviews,
		ensureGradingLoaded,
		gradingLoading,
		submitReviewScore
	} from '$lib/stores/grading.svelte';

	$effect(() => {
		ensureGradingLoaded();
	});

	const courseId = $derived(Number(page.params.courseId));
	const materialId = $derived(page.params.materialId);
	const course = $derived(getCourseById(courseId));
	const info = $derived(
		course && materialId ? getTaskInfo(course.id, materialId) : undefined
	);

	type Filter = 'all' | 'Menunggu' | 'Dinilai';
	let activeFilter = $state<Filter>('all');
	let search = $state('');
	let draftScores: Record<string, string> = $state({});
	let message = $state('');

	const loading = $derived(gradingLoading());
	const reviews = $derived(allReviews());

	const items = $derived.by(() => {
		if (!info) return [];
		const q = search.trim().toLowerCase();
		return reviews.filter((r) => {
			if (resolveTaskKey(r) !== info.key) return false;
			if (activeFilter !== 'all' && r.status !== activeFilter) return false;
			if (
				q &&
				!r.student.toLowerCase().includes(q) &&
				!r.nim.toLowerCase().includes(q)
			) {
				return false;
			}
			return true;
		});
	});

	const pendingHere = $derived(items.filter((r) => r.status === 'Menunggu').length);

	async function submitScore(id: number | string) {
		const key = String(id);
		const raw = (draftScores[key] ?? '').trim();
		const val = Number(raw);
		if (!raw || Number.isNaN(val) || val < 0 || val > 100) {
			message = 'Masukkan nilai 0–100 terlebih dahulu.';
			return;
		}
		message = await submitReviewScore(key, val);
		delete draftScores[key];
	}
</script>

<svelte:head>
	<title>
		{info && course ? `${info.title} — Penilaian ${course.title}` : 'Tugas tidak ditemukan'} — Instruktur Aristoteles
	</title>
	<meta
		name="description"
		content={info ? `Informasi soal dan jawaban peserta untuk ${info.title}.` : 'Detail penugasan'}
	/>
</svelte:head>

<div class="p-4 sm:p-6 lg:p-8">
	{#if !course || !info}
		<div class="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-10 text-center">
			<i class="fa-solid fa-triangle-exclamation mb-3 text-3xl text-amber-500" aria-hidden="true"></i>
			<h1 class="text-xl font-bold text-slate-900">Tugas tidak ditemukan</h1>
			<p class="mt-1 text-sm text-slate-500">
				Materi “{page.params.materialId}” tidak terdaftar sebagai penugasan di course ini.
			</p>
			<a
				href={Number.isFinite(courseId) ? `/instruktur/penilaian/${courseId}` : '/instruktur/penilaian'}
				class="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
			>
				<i class="fa-solid fa-arrow-left" aria-hidden="true"></i> Kembali
			</a>
		</div>
	{:else}
		<nav aria-label="Breadcrumb" class="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
			<a
				href="/instruktur/penilaian"
				class="rounded font-semibold text-blue-600 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
			>
				Penilaian
			</a>
			<i class="fa-solid fa-chevron-right text-[10px] text-slate-300" aria-hidden="true"></i>
			<a
				href={`/instruktur/penilaian/${course.id}`}
				class="max-w-56 truncate rounded font-semibold text-blue-600 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
			>
				{course.title}
			</a>
			<i class="fa-solid fa-chevron-right text-[10px] text-slate-300" aria-hidden="true"></i>
			<span aria-current="page" class="max-w-64 truncate font-medium text-slate-700">{info.title}</span>
		</nav>

		<!-- Informasi soal -->
		<section
			aria-labelledby="heading-soal"
			class="mb-6 overflow-hidden rounded-2xl border border-slate-200/60 bg-white"
		>
			<div class="border-b border-slate-100 bg-blue-50/40 px-5 py-4 sm:px-6">
				<p class="flex items-center gap-1.5 text-[11px] font-extrabold tracking-widest text-blue-700 uppercase">
					<i class="fa-solid fa-pen-to-square" aria-hidden="true"></i>
					Informasi tugas
				</p>
				<h1 id="heading-soal" class="mt-1 text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">
					{info.title}
				</h1>
				<p class="mt-1 text-xs text-slate-500 sm:text-sm">
					{course.title} · Modul {info.moduleIndex + 1}: {info.moduleTitle} · Sub-modul: {info.subTitle} ·
					{info.duration}
				</p>
			</div>
			<div class="px-5 py-4 sm:px-6">
				<p class="text-sm leading-relaxed text-slate-700">{info.brief}</p>
				{#if info.objectives?.length}
					<h2 class="mt-4 mb-2 text-sm font-bold text-slate-900">Tujuan penugasan</h2>
					<ul class="grid gap-2 sm:grid-cols-2">
						{#each info.objectives as obj (obj)}
							<li class="flex items-start gap-2 text-sm text-slate-600">
								<i class="fa-solid fa-circle-check mt-0.5 shrink-0 text-emerald-500" aria-hidden="true"></i>
								<span>{obj}</span>
							</li>
						{/each}
					</ul>
				{/if}
				<dl class="mt-4 flex flex-wrap gap-2 text-xs">
					{#if info.deliverable}
						<div class="inline-flex items-center gap-1.5 rounded-xl bg-slate-50 px-3 py-2 font-semibold text-slate-600 ring-1 ring-slate-200">
							<dt class="sr-only">Hasil yang dikumpulkan</dt>
							<i class="fa-solid fa-box-open text-violet-500" aria-hidden="true"></i>
							<dd>{info.deliverable}</dd>
						</div>
					{/if}
					{#if info.deadline}
						<div class="inline-flex items-center gap-1.5 rounded-xl bg-slate-50 px-3 py-2 font-semibold text-slate-600 ring-1 ring-slate-200">
							<dt class="sr-only">Tenggat</dt>
							<i class="fa-solid fa-calendar-days text-amber-500" aria-hidden="true"></i>
							<dd>{info.deadline}</dd>
						</div>
					{/if}
				</dl>
				{#if info.steps?.length}
					<h2 class="mt-4 mb-2 text-sm font-bold text-slate-900">
						Langkah pengerjaan ({info.steps.length})
					</h2>
					<ol class="list-decimal space-y-1.5 rounded-xl bg-slate-50 py-3 pr-4 pl-9 text-sm leading-relaxed text-slate-600 ring-1 ring-slate-200">
						{#each info.steps as step (step)}
							<li>{step}</li>
						{/each}
					</ol>
				{/if}
			</div>
		</section>

		<!-- Jawaban peserta -->
		<section aria-labelledby="heading-jawaban">
			<div class="mb-3 flex flex-wrap items-center justify-between gap-2">
				<h2 id="heading-jawaban" class="text-lg font-bold text-slate-900">
					Jawaban Peserta ({items.length})
				</h2>
				<p class="text-xs font-semibold text-slate-500" role="status">
					{pendingHere} menunggu dinilai
				</p>
			</div>

			{#if message}
				<p role="status" class="mb-4 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-700">
					<i class="fa-solid fa-circle-check mt-0.5 shrink-0" aria-hidden="true"></i>
					<span>{message}</span>
				</p>
			{/if}

			<div class="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
				<div class="max-w-md flex-1">
					<label for="search-peserta" class="sr-only">Cari peserta</label>
					<div class="relative">
						<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
							<i class="fa-solid fa-magnifying-glass text-sm" aria-hidden="true"></i>
						</div>
						<input
							id="search-peserta"
							type="search"
							bind:value={search}
							placeholder="Cari nama atau NIM..."
							autocomplete="off"
							class="w-full rounded-xl border border-slate-200 bg-white py-2.5 pr-4 pl-10 text-sm placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
						/>
					</div>
				</div>
				<div class="flex flex-wrap gap-2" role="group" aria-label="Filter status jawaban">
					{#each [{ value: 'all', label: 'Semua' }, { value: 'Menunggu', label: 'Menunggu' }, { value: 'Dinilai', label: 'Dinilai' }] as f (f.value)}
						<button
							type="button"
							onclick={() => (activeFilter = f.value as Filter)}
							aria-pressed={activeFilter === f.value}
							class={`rounded-xl px-4 py-2 text-xs font-bold transition-all duration-200 ease-smooth active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
								activeFilter === f.value
									? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
									: 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
							}`}
						>
							{f.label}
						</button>
					{/each}
				</div>
			</div>

			{#if loading}
				<p role="status" class="mb-4 flex items-center gap-2 text-xs font-semibold text-slate-500">
					<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i> Memuat berkas PDF dari Drive…
				</p>
			{/if}

			<div class="overflow-hidden rounded-2xl border border-slate-200/60 bg-white">
				{#if items.length === 0}
					<div class="p-12 text-center">
						<i class="fa-solid fa-folder-open mb-3 text-3xl text-slate-300" aria-hidden="true"></i>
						<p class="text-sm font-semibold text-slate-700">Belum ada jawaban pada filter ini.</p>
						<p class="mt-1 text-xs text-slate-500">Coba kata kunci atau filter status lain.</p>
					</div>
				{:else}
					<div class="overflow-x-auto">
						<table class="w-full min-w-[760px] text-left text-sm">
							<thead>
								<tr class="border-b border-slate-100 bg-slate-50/60 text-xs text-slate-500">
									<th scope="col" class="px-5 py-3 font-bold">Peserta</th>
									<th scope="col" class="px-5 py-3 font-bold">Berkas PDF</th>
									<th scope="col" class="px-5 py-3 font-bold">Status</th>
									<th scope="col" class="px-5 py-3 font-bold">Nilai</th>
									<th scope="col" class="px-5 py-3 text-right font-bold">Aksi</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-slate-100">
								{#each items as r (r.id)}
									<tr class="transition-colors duration-200 ease-smooth hover:bg-slate-50/50">
										<td class="px-5 py-4">
											<div class="font-semibold text-slate-900">{r.student}</div>
											<div class="mt-0.5 text-xs text-slate-500">{r.nim} · {r.date}</div>
										</td>
										<td class="px-5 py-4">
											{#if r.driveLink}
												<a
													href={r.driveLink}
													target="_blank"
													rel="noopener noreferrer"
													title={r.fileName ?? 'Buka PDF di Google Drive'}
													class="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-bold text-violet-700 transition-colors duration-200 ease-smooth hover:bg-violet-100 focus-visible:outline-2 focus-visible:outline-violet-600"
												>
													<i class="fa-solid fa-file-pdf text-red-500" aria-hidden="true"></i>
													<span class="max-w-40 truncate">{r.fileName ?? 'Buka PDF'}</span>
													<i class="fa-solid fa-arrow-up-right-from-square text-[10px]" aria-hidden="true"></i>
												</a>
											{:else}
												<span class="text-xs font-semibold text-slate-400">—</span>
											{/if}
										</td>
										<td class="px-5 py-4">
											<span
												class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold {r.status === 'Dinilai' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}"
											>
												{r.status}
											</span>
										</td>
										<td class="px-5 py-4">
											{#if r.status === 'Dinilai' && r.score !== null}
												<span class="text-sm font-bold text-emerald-600">{r.score}</span>
											{:else}
												<label for={`score-${r.id}`} class="sr-only">Nilai untuk {r.student}</label>
												<input
													id={`score-${r.id}`}
													type="number"
													min="0"
													max="100"
													placeholder="0–100"
													bind:value={draftScores[String(r.id)]}
													class="w-24 rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
												/>
											{/if}
										</td>
										<td class="px-5 py-4 text-right">
											{#if r.status === 'Menunggu'}
												<button
													type="button"
													onclick={() => submitScore(r.id)}
													class="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white transition-all duration-200 ease-smooth hover:bg-blue-700 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-blue-600"
												>
													<i class="fa-solid fa-check" aria-hidden="true"></i> Simpan Nilai
												</button>
											{:else}
												<span class="text-xs font-semibold text-slate-400">Selesai</span>
											{/if}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			</div>
		</section>
	{/if}
</div>
