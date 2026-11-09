<script lang="ts">
	import { browser } from '$app/environment';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { generateHTML } from '@tiptap/html';
	import type { JSONContent } from '@tiptap/core';
	import { sanitizeTiptapHtml } from '$lib/security/sanitize';
	import { getCourseById } from '$lib/data/courses';
	import { getTaskInfo } from '$lib/data/grading';
	import { isServerId, fetchCourseDetail, fetchMaterialDetail, fileUrl } from '$lib/api/courses';
	import {
		fetchMaterialSubmissions,
		gradeMaterialSubmission,
		isServableSubmissionFile,
		type MaterialSubmissionItem
	} from '$lib/api/submissions';
	import { downloadSubmissionFile } from '$lib/services/submission.service';
	import { createEditorExtensions } from '$lib/tiptap/extensions';
	import '$lib/tiptap/content.css';

	const courseId = $derived(Number(page.params.courseId));
	const materialId = $derived(page.params.materialId);
	const course = $derived(getCourseById(courseId));
	const info = $derived(course && materialId ? getTaskInfo(course.id, materialId) : undefined);

	let draftDecisions: Record<string, string> = $state({});
	let draftFeedback: Record<string, string> = $state({});

	/**
	 * Rubrik seragam nasional K-06: 3 kriteria tetap (bobot sama).
	 * Nilai akhir = rata-rata dibulatkan — DIHITUNG SERVER dari rincian
	 * yang dikirim (skor kiriman diabaikan bila rubrik ada).
	 */
	const RUBRIK = [
		{ key: 'kelengkapan', label: 'Kelengkapan', hint: 'Semua bagian yang diminta ada dan lengkap.' },
		{ key: 'ketepatan', label: 'Ketepatan isi', hint: 'Jawaban benar dan sesuai materi.' },
		{ key: 'kerapian', label: 'Kerapian', hint: 'Tulisan rapi dan mudah dibaca.' }
	] as const;
	type RubrikKey = (typeof RUBRIK)[number]['key'];
	/** Nilai cepat sekali ketuk (tetap bisa digeser presisi via slider). */
	const QUICK_LEVELS = [0, 60, 75, 85, 100];
	let draftRubric: Record<string, Record<RubrikKey, number>> = $state({});

	function rubricFor(key: string): Record<RubrikKey, number> {
		return draftRubric[key] ?? { kelengkapan: 0, ketepatan: 0, kerapian: 0 };
	}

	function setRubric(key: string, k: RubrikKey, v: number): void {
		const cur = rubricFor(key);
		draftRubric[key] = { ...cur, [k]: Math.min(100, Math.max(0, Math.round(v) || 0)) };
	}

	function rubricAverage(key: string): number {
		const r = rubricFor(key);
		return Math.round((r.kelengkapan + r.ketepatan + r.kerapian) / 3);
	}

	/* ---- Cabang server: id numerik = materi kursus nyata (mis. dari dasbor Perlu Dinilai) ---- */
	const serverMode = $derived(
		isServerId(page.params.courseId) && isServerId(page.params.materialId)
	);

	let srvLoadedKey = '';
	let srvLoading = $state(false);
	let srvError = $state('');
	let srvCourseTitle = $state('');
	let srvMaterialTitle = $state('');
	let srvRows = $state<MaterialSubmissionItem[]>([]);
	let srvNotice = $state('');
	let srvNoticeError = $state(false);
	let srvDownloading = $state<number | null>(null);
	let srvDownloadError = $state('');
	let srvBriefHtml = $state('');
	/** Baris yang sedang diubah nilainya (nilai ulang); null = mode lihat. */
	let editingRow = $state<number | null>(null);

	const srvPending = $derived(srvRows.filter((r) => r.status === 'submitted').length);

	/** Badge presisi sesuai enum status backend (submitted/reviewed/revision_requested/passed/failed). */
	function srvStatusMeta(status: string): { label: string; classes: string } {
		switch (status) {
			case 'submitted':
				return { label: 'Menunggu', classes: 'border-amber-200 bg-amber-50 text-amber-700' };
			case 'revision_requested':
				return { label: 'Minta revisi', classes: 'border-violet-200 bg-violet-50 text-violet-700' };
			case 'passed':
				return { label: 'Lulus', classes: 'border-emerald-200 bg-emerald-50 text-emerald-700' };
			case 'failed':
				return { label: 'Tidak lulus', classes: 'border-red-200 bg-red-50 text-red-700' };
			default:
				return { label: 'Dinilai', classes: 'border-slate-200 bg-slate-100 text-slate-600' };
		}
	}

	function srvNeedsGrade(r: MaterialSubmissionItem): boolean {
		return r.status === 'submitted' || r.score === null;
	}

	/** Tiptap JSON materi → HTML; non-JSON jadi teks polos (aman, tanpa innerHTML mentah). */
	function srvBriefHtmlFrom(raw: string | null): string {
		if (!raw) return '';
		try {
			const json = JSON.parse(raw) as JSONContent;
			if (json && typeof json === 'object' && json.type === 'doc') {
				return generateHTML(json, createEditorExtensions(''));
			}
		} catch {
			/* bukan JSON Tiptap — fallback teks di bawah */
		}
		const esc = raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
		return `<p>${esc.replaceAll('\n', '<br>')}</p>`;
	}

	function formatDateTime(iso: string | null): string {
		if (!iso) return '-';
		const d = new Date(iso);
		if (Number.isNaN(d.getTime())) return '-';
		return d.toLocaleDateString('id-ID', {
			day: 'numeric',
			month: 'short',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	async function loadServer(): Promise<void> {
		srvLoading = true;
		srvError = '';
		srvNotice = '';
		srvNoticeError = false;
		// Draf nilai statis tidak berlaku untuk baris server.
		draftRubric = {};
		draftDecisions = {};
		draftFeedback = {};
		try {
			const cid = Number(page.params.courseId);
			const mid = Number(page.params.materialId);
			const [course, material, subs] = await Promise.all([
				fetchCourseDetail(cid).catch(() => null),
				fetchMaterialDetail(mid).catch(() => null),
				fetchMaterialSubmissions(mid)
			]);
			if (!subs.manager) throw new Error('Akun ini bukan pengampu kursus ini.');
			srvCourseTitle = course?.title ?? `Kursus #${cid}`;
			srvMaterialTitle = material?.title ?? `Tugas #${mid}`;
			srvBriefHtml = srvBriefHtmlFrom(material?.content ?? null);
			srvRows = subs.rows;
			editingRow = null;
		} catch (e) {
			srvError = e instanceof Error ? e.message : 'Gagal memuat pengumpulan.';
		} finally {
			srvLoading = false;
		}
	}

	$effect(() => {
		if (!browser || !serverMode) return;
		const key = `${page.params.courseId}:${page.params.materialId}`;
		if (srvLoadedKey === key) return;
		srvLoadedKey = key;
		void loadServer();
	});

	async function submitServerScore(id: number): Promise<void> {
		const key = String(id);
		const val = rubricAverage(key);
		const rb = rubricFor(key);
		const decision =
			draftDecisions[key] === 'failed' || draftDecisions[key] === 'revision_requested'
				? draftDecisions[key]
				: 'passed';
		try {
			const updated = await gradeMaterialSubmission(Number(page.params.materialId), id, {
				score: val,
				decision,
				feedback: (draftFeedback[key] ?? '').trim() || undefined,
				rubric: { kelengkapan: rb.kelengkapan, ketepatan: rb.ketepatan, kerapian: rb.kerapian }
			});
			srvRows = srvRows.map((r) => (r.id === id ? updated : r));
			delete draftRubric[key];
			delete draftDecisions[key];
			delete draftFeedback[key];
			editingRow = null;
			// Angka final dari server (server yang menghitung rata-rata).
			const saved = updated.rubricScores;
			srvNotice = saved
				? `Nilai ${updated.score} (rubrik ${saved.kelengkapan}/${saved.ketepatan}/${saved.kerapian}) tersimpan untuk ${updated.studentName ?? 'peserta'}.`
				: `Nilai ${updated.score} tersimpan untuk ${updated.studentName ?? 'peserta'}.`;
			srvNoticeError = false;
		} catch (e) {
			srvNotice = e instanceof Error ? e.message : 'Gagal menyimpan nilai.';
			srvNoticeError = true;
		}
	}

	/** Isi form dengan nilai tersimpan lalu buka mode ubah untuk baris ini. */
	function startEditRow(r: MaterialSubmissionItem): void {
		// Utamakan rincian server bila pernah dinilai pakai rubrik.
		const saved = r.rubricScores;
		if (saved) {
			draftRubric[String(r.id)] = {
				kelengkapan: saved.kelengkapan,
				ketepatan: saved.ketepatan,
				kerapian: saved.kerapian
			};
		} else {
			const seed = r.score === null ? 0 : Math.min(100, Math.max(0, r.score));
			draftRubric[String(r.id)] = { kelengkapan: seed, ketepatan: seed, kerapian: seed };
		}
		draftDecisions[String(r.id)] =
			r.status === 'failed'
				? 'failed'
				: r.status === 'revision_requested'
					? 'revision_requested'
					: 'passed';
		draftFeedback[String(r.id)] = r.feedback ?? '';
		editingRow = r.id;
		srvNotice = '';
		srvNoticeError = false;
	}

	async function downloadServerFile(row: MaterialSubmissionItem): Promise<void> {
		if (srvDownloading !== null) return;
		if (!isServableSubmissionFile(row.fileUrl)) {
			srvDownloadError = 'Berkas sumber tidak lagi tersimpan di server.';
			return;
		}
		srvDownloading = row.id;
		srvDownloadError = '';
		try {
			const blob = await downloadSubmissionFile(fileUrl(row.fileUrl));
			const url = URL.createObjectURL(blob);
			try {
				const a = document.createElement('a');
				a.href = url;
				a.download = row.originalName || `tugas-${row.id}.pdf`;
				document.body.appendChild(a);
				a.click();
				a.remove();
			} finally {
				setTimeout(() => URL.revokeObjectURL(url), 10_000);
			}
		} catch (e) {
			srvDownloadError = e instanceof Error ? e.message : 'Gagal mengunduh berkas.';
		} finally {
			srvDownloading = null;
		}
	}
</script>

<svelte:head>
	<title>
		{info && course ? `${info.title} — Penilaian ${course.title}` : 'Tugas tidak ditemukan'} — Instruktur
		Aristoteles
	</title>
	<meta
		name="description"
		content={info
			? `Deskripsi, tujuan, dan langkah penugasan ${info.title} beserta jawaban peserta.`
			: 'Detail penugasan'}
	/>
</svelte:head>

<div class="p-4 sm:p-6 lg:p-8">
	{#snippet rubricForm(key: string, pfx: string, who: string)}
		<fieldset class="mb-1">
			<legend class="mb-1 block text-[11px] font-bold tracking-wide text-slate-500 uppercase"
				>Rubrik<span class="sr-only"> untuk {who} — nilai akhir = rata-rata, dihitung server</span></legend
			>
			<div class="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
				{#each RUBRIK as k (k.key)}
					{@const rv = rubricFor(key)[k.key]}
					<div>
						<div class="flex items-center justify-between gap-2 text-[11px]">
							<label for={`${pfx}-rubric-${key}-${k.key}`} class="font-bold text-slate-600"
								>{k.label}</label
							>
							<span class="font-extrabold text-slate-800" aria-hidden="true">{rv}</span>
						</div>
						<p class="mt-0.5 text-[10px] leading-snug text-slate-400">{k.hint}</p>
						<input
							id={`${pfx}-rubric-${key}-${k.key}`}
							type="range"
							min="0"
							max="100"
							step="1"
							value={rv}
							oninput={(e) => setRubric(key, k.key, Number(e.currentTarget.value))}
							aria-valuetext={`${k.label}: ${rv} dari 100`}
							class="mt-1 w-full accent-blue-600"
						/>
						<div class="mt-1 flex gap-1" role="group" aria-label={`Nilai cepat ${k.label}`}>
							{#each QUICK_LEVELS as q (q)}
								<button
									type="button"
									onclick={() => setRubric(key, k.key, q)}
									aria-pressed={rv === q}
									aria-label={`${k.label} ${q}`}
									title={`${k.label} = ${q}`}
									class={`min-h-7 flex-1 rounded-lg px-1 text-[10px] font-extrabold transition-colors focus-visible:outline-2 focus-visible:outline-blue-600 ${rv === q ? 'bg-blue-600 text-white' : 'bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-blue-50 hover:text-blue-700'}`}
								>
									{q}
								</button>
							{/each}
						</div>
					</div>
				{/each}
				<p
					class="flex items-center justify-between border-t border-slate-200 pt-2"
					role="status"
				>
					<span class="text-[11px] font-bold text-slate-700">Nilai akhir <span class="font-medium text-slate-400">(rata-rata otomatis)</span></span>
					<span class="rounded-lg bg-blue-600 px-2.5 py-1 text-base font-black text-white">{rubricAverage(key)}</span>
				</p>
			</div>
		</fieldset>
		<div class="flex flex-col gap-1.5">
			<div class="flex flex-col gap-1.5">
				<label
					for={`${pfx}-decision-${key}`}
					class="mb-1 block text-[11px] font-bold tracking-wide text-slate-500 uppercase"
					>Keputusan<span class="sr-only"> untuk {who}</span></label
				>
				<select
					id={`${pfx}-decision-${key}`}
					bind:value={draftDecisions[key]}
					class="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-bold text-slate-700 focus:border-blue-500 focus:outline-none"
				>
					<option value="passed">Lulus</option>
					<option value="revision_requested">Minta revisi</option>
					<option value="failed">Tidak lulus</option>
				</select>
			</div>
			<label
				for={`${pfx}-feedback-${key}`}
				class="mb-1 block text-[11px] font-bold tracking-wide text-slate-500 uppercase"
				>Umpan balik<span class="sr-only"> untuk {who}</span></label
			>
			<input
				id={`${pfx}-feedback-${key}`}
				type="text"
				bind:value={draftFeedback[key]}
				placeholder="Umpan balik (opsional)"
				class="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
			/>
		</div>
	{/snippet}
	{#if serverMode}
		<nav
			aria-label="Breadcrumb"
			class="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500"
		>
			<a
				href={resolve('/instruktur/penilaian')}
				class="rounded font-semibold text-blue-600 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
				>Penilaian</a
			>
			<i class="fa-solid fa-chevron-right text-[10px] text-slate-300" aria-hidden="true"></i>
			<span class="max-w-56 truncate font-semibold text-slate-600"
				>{srvCourseTitle || `Kursus #${page.params.courseId}`}</span
			>
			<i class="fa-solid fa-chevron-right text-[10px] text-slate-300" aria-hidden="true"></i>
			<span aria-current="page" class="max-w-64 truncate font-medium text-slate-700"
				>{srvMaterialTitle || 'Memuat...'}</span
			>
		</nav>

		<section
			aria-labelledby="srv-heading"
			class="mb-6 overflow-hidden rounded-2xl border border-slate-200/60 bg-white"
		>
			<div class="border-b border-slate-100 bg-blue-50/40 px-5 py-4 sm:px-6">
				<p
					class="flex items-center gap-1.5 text-[11px] font-extrabold tracking-widest text-blue-700 uppercase"
				>
					<i class="fa-solid fa-pen-to-square" aria-hidden="true"></i>
					Penilaian tugas · data server
				</p>
				<h1
					id="srv-heading"
					class="mt-1 text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl"
				>
					{srvMaterialTitle || 'Memuat tugas...'}
				</h1>
				<p class="mt-1 text-xs text-slate-500 sm:text-sm" role="status">
					{srvRows.length} pengumpulan · {srvPending} menunggu dinilai
				</p>
			</div>
		</section>

		<section
			aria-label="Deskripsi tugas"
			class="mb-6 overflow-hidden rounded-2xl border border-slate-200/60 bg-white"
		>
			<div class="border-b border-slate-100 bg-blue-50/40 px-5 py-3 sm:px-6">
				<p
					class="flex items-center gap-1.5 text-[11px] font-extrabold tracking-widest text-blue-700 uppercase"
				>
					<i class="fa-solid fa-briefcase" aria-hidden="true"></i>
					Deskripsi tugas
				</p>
			</div>
			<div class="px-5 py-4 sm:px-6">
				{#if srvBriefHtml}
					<!-- eslint-disable-next-line svelte/no-at-html-tags -- disanitasi via sanitizeTiptapHtml -->
					<div class="mdoc text-sm leading-relaxed text-slate-700">
						{@html sanitizeTiptapHtml(srvBriefHtml)}
					</div>
				{:else}
					<p class="text-sm text-slate-400">Belum ada deskripsi untuk tugas ini.</p>
				{/if}
			</div>
		</section>

		{#if srvLoading}
			<p role="status" class="mb-4 flex items-center gap-2 text-xs font-semibold text-slate-500">
				<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i> Memuat pengumpulan dari server...
			</p>
		{:else if srvError}
			<div
				role="alert"
				class="mx-auto max-w-lg rounded-2xl border border-red-200 bg-red-50 p-8 text-center"
			>
				<i class="fa-solid fa-triangle-exclamation mb-3 text-3xl text-red-400" aria-hidden="true"
				></i>
				<h1 class="text-xl font-bold text-slate-900">Pengumpulan belum dapat dimuat</h1>
				<p class="mx-auto mt-1 max-w-md text-sm text-red-600">{srvError}</p>
				<div class="mt-5 flex justify-center gap-2">
					<button
						type="button"
						onclick={() => {
							srvLoadedKey = '';
						}}
						class="inline-flex min-h-11 items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-red-600"
					>
						<i class="fa-solid fa-rotate-right" aria-hidden="true"></i> Coba lagi
					</button>
					<a
						href={resolve('/instruktur')}
						class="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-slate-500"
					>
						<i class="fa-solid fa-arrow-left" aria-hidden="true"></i> Dasbor
					</a>
				</div>
			</div>
		{:else}
			{#if srvNotice}
				<p
					role={srvNoticeError ? 'alert' : 'status'}
					class={`mb-4 flex items-start gap-2 rounded-xl border px-4 py-3 text-xs font-semibold ${srvNoticeError ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}
				>
					<i
						class={`fa-solid mt-0.5 shrink-0 ${srvNoticeError ? 'fa-circle-exclamation' : 'fa-circle-check'}`}
						aria-hidden="true"
					></i>
					<span>{srvNotice}</span>
				</p>
			{/if}
			{#if srvDownloadError}
				<p
					role="alert"
					class="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700"
				>
					<i class="fa-solid fa-circle-exclamation mt-0.5 shrink-0" aria-hidden="true"></i>
					<span>{srvDownloadError}</span>
				</p>
			{/if}
			<div class="overflow-hidden rounded-2xl border border-slate-200/60 bg-white">
				{#if srvRows.length === 0}
					<div class="p-12 text-center">
						<i class="fa-solid fa-folder-open mb-3 text-3xl text-slate-300" aria-hidden="true"></i>
						<p class="text-sm font-semibold text-slate-700">
							Belum ada pengumpulan untuk tugas ini.
						</p>
						<p class="mt-1 text-xs text-slate-500">Pengumpulan peserta akan muncul di sini.</p>
					</div>
				{:else}
					<ol class="divide-y divide-slate-100 md:hidden" aria-label="Daftar pengumpulan">
						{#each srvRows as r (r.id)}
							{@const srvMeta = srvStatusMeta(r.status)}
							<li class="px-4 py-4">
								<div class="flex items-start justify-between gap-3">
									<div class="min-w-0">
										<p class="truncate text-sm font-bold text-slate-900">
											{r.studentName ?? `Peserta #${r.userId}`}
										</p>
										<p class="mt-0.5 text-[11px] text-slate-500">
											{r.studentNim ?? '-'} · {formatDateTime(r.submittedAt)}
										</p>
									</div>
									<span
										class={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${srvMeta.classes}`}
										>{srvMeta.label}</span
									>
								</div>
								{#if isServableSubmissionFile(r.fileUrl)}
									<button
										type="button"
										onclick={() => void downloadServerFile(r)}
										disabled={srvDownloading !== null}
										class="mt-2.5 inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-bold text-violet-700 hover:bg-violet-100 focus-visible:outline-2 focus-visible:outline-violet-600 disabled:cursor-not-allowed disabled:opacity-60"
									>
										<i class="fa-solid fa-file-pdf text-red-500" aria-hidden="true"></i>
										<span class="max-w-56 truncate">{r.originalName ?? 'Unduh PDF'}</span>
									</button>
								{:else}
									<p
										class="mt-2.5 inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-400"
									>
										<i class="fa-solid fa-file-circle-exclamation" aria-hidden="true"></i>
										Berkas tidak tersedia
									</p>
								{/if}
								<div class="mt-3">
									{#if srvNeedsGrade(r) || editingRow === r.id}
										{@render rubricForm(String(r.id), 'srvm', r.studentName ?? 'peserta')}
										<button
											type="button"
											onclick={() => void submitServerScore(r.id)}
											class="mt-2.5 inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
										>
											<i class="fa-solid fa-check" aria-hidden="true"></i> Simpan Nilai
										</button>
									{:else}
										<p class="text-sm font-bold text-emerald-600">Nilai: {r.score ?? '-'}</p>
										{#if r.rubricScores}
											<p
												class="mt-0.5 text-[11px] text-slate-500"
												title={`Rincian tersimpan di server: Kelengkapan ${r.rubricScores.kelengkapan} · Ketepatan isi ${r.rubricScores.ketepatan} · Kerapian ${r.rubricScores.kerapian}`}
											>
												Rubrik {r.rubricScores.kelengkapan}/{r.rubricScores.ketepatan}/{r.rubricScores.kerapian}
											</p>
										{/if}
										<button
											type="button"
											onclick={() => startEditRow(r)}
											aria-label={`Ubah nilai ${r.studentName ?? 'peserta'}`}
											class="mt-2 inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600"
										>
											<i class="fa-solid fa-pen text-[11px]" aria-hidden="true"></i> Ubah
										</button>
									{/if}
								</div>
							</li>
						{/each}
					</ol>
					<div class="hidden overflow-x-auto md:block">
						<table class="w-full min-w-[760px] text-left text-sm">
							<caption class="sr-only">Daftar pengumpulan tugas dari server</caption>
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
								{#each srvRows as r (r.id)}
									<tr class="transition-colors duration-200 ease-smooth hover:bg-slate-50/50">
										<td class="px-5 py-4">
											<span class="block font-semibold text-slate-900"
												>{r.studentName ?? `Peserta #${r.userId}`}</span
											>
											<span class="mt-0.5 block text-xs text-slate-500"
												>{r.studentNim ?? '-'} · {formatDateTime(r.submittedAt)}</span
											>
											{#if r.note}
												<span
													class="mt-1 block max-w-44 truncate text-[11px] text-slate-500"
													title={r.note}>“{r.note}”</span
												>
											{/if}
										</td>
										<td class="px-5 py-4">
											{#if isServableSubmissionFile(r.fileUrl)}
												<button
													type="button"
													onclick={() => void downloadServerFile(r)}
													disabled={srvDownloading !== null}
													title={r.originalName ?? 'Unduh PDF'}
													class="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-bold text-violet-700 transition-colors duration-200 ease-smooth hover:bg-violet-100 focus-visible:outline-2 focus-visible:outline-violet-600 disabled:cursor-not-allowed disabled:opacity-60"
												>
													{#if srvDownloading === r.id}
														<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i>
													{:else}
														<i class="fa-solid fa-file-pdf text-red-500" aria-hidden="true"></i>
													{/if}
													<span class="max-w-40 truncate">{r.originalName ?? 'Unduh PDF'}</span>
												</button>
											{:else}
												<span
													class="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-400"
													title="Berkas sumber tidak lagi tersimpan di server"
												>
													<i class="fa-solid fa-file-circle-exclamation" aria-hidden="true"></i>
													Berkas tidak tersedia
												</span>
											{/if}
										</td>
										<td class="px-5 py-4">
											{#each [srvStatusMeta(r.status)] as meta (meta.label)}
												<span
													class={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${meta.classes}`}
												>
													{meta.label}
												</span>
											{/each}
										</td>
										<td class="px-5 py-4">
											{#if srvNeedsGrade(r) || editingRow === r.id}
												{@render rubricForm(String(r.id), 'srv', r.studentName ?? 'peserta')}
												{#if editingRow === r.id && !srvNeedsGrade(r)}
													<button
														type="button"
														onclick={() => {
															editingRow = null;
															delete draftRubric[String(r.id)];
															delete draftDecisions[String(r.id)];
															delete draftFeedback[String(r.id)];
														}}
														class="self-start rounded-lg px-1 py-0.5 text-xs font-semibold text-slate-500 hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-blue-600"
													>
														Batal
													</button>
												{/if}
											{:else}
												<span class="text-sm font-bold text-emerald-600">{r.score ?? '-'}</span>
												{#if r.rubricScores}
													<span
														class="mt-0.5 block text-[11px] text-slate-500"
														title={`Rincian tersimpan di server: Kelengkapan ${r.rubricScores.kelengkapan} · Ketepatan isi ${r.rubricScores.ketepatan} · Kerapian ${r.rubricScores.kerapian}`}
														>Rubrik {r.rubricScores.kelengkapan}/{r.rubricScores.ketepatan}/{r.rubricScores.kerapian}</span
													>
												{/if}
												{#if r.feedback}
													<span
														class="mt-1 block max-w-44 truncate text-[11px] text-slate-500"
														title={r.feedback}>“{r.feedback}”</span
													>
												{/if}
											{/if}
										</td>
										<td class="px-5 py-4 text-right">
											{#if srvNeedsGrade(r) || editingRow === r.id}
												<button
													type="button"
													onclick={() => void submitServerScore(r.id)}
													class="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white transition-all duration-200 ease-smooth hover:bg-blue-700 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-blue-600"
												>
													<i class="fa-solid fa-check" aria-hidden="true"></i> Simpan Nilai
												</button>
											{:else}
												<button
													type="button"
													onclick={() => startEditRow(r)}
													aria-label={`Ubah nilai ${r.studentName ?? 'peserta'}`}
													class="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600"
												>
													<i class="fa-solid fa-pen text-[11px]" aria-hidden="true"></i> Ubah
												</button>
											{/if}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			</div>
		{/if}
	{:else if !course || !info}
		<div class="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-10 text-center">
			<i class="fa-solid fa-triangle-exclamation mb-3 text-3xl text-amber-500" aria-hidden="true"
			></i>
			<h1 class="text-xl font-bold text-slate-900">Tugas tidak ditemukan</h1>
			<p class="mt-1 text-sm text-slate-500">
				Materi “{page.params.materialId}” tidak terdaftar sebagai penugasan di course ini.
			</p>
			<a
				href={Number.isFinite(courseId)
					? `/instruktur/penilaian/${courseId}`
					: '/instruktur/penilaian'}
				class="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
			>
				<i class="fa-solid fa-arrow-left" aria-hidden="true"></i> Kembali
			</a>
		</div>
	{:else}
		<div class="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-10 text-center">
			<i class="fa-solid fa-clipboard-check mb-3 text-3xl text-slate-300" aria-hidden="true"></i>
			<h1 class="text-xl font-bold text-slate-900">Penilaian hanya untuk materi server</h1>
			<p class="mt-1 text-sm text-slate-500">Materi pratinjau ini tidak memiliki antrean penilaian. Nilai tugas hanya dapat diberikan pada materi tugas backend yang memiliki pengumpulan peserta.</p>
			<a
				href="/instruktur/penilaian"
				class="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
			>
				<i class="fa-solid fa-arrow-left" aria-hidden="true"></i> Kembali ke Penilaian
			</a>
		</div>
	{/if}
</div>
