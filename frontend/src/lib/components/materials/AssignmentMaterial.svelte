<script lang="ts">
	import { tick } from 'svelte';
	import type { AssignmentDetail } from '$lib/data/material-details';
	import type { AssignmentSubmission, UploadMeta, UploadPhase } from '$lib/types/submission';
	import { MAX_PDF_BYTES, formatBytes } from '$lib/types/submission';
	import { uploadAssignmentPdf, fetchSubmissions, downloadSubmissionFile } from '$lib/services/submission.service';
	import { fetchTaskStatus, type TaskStatus } from '$lib/api/submissions';
	import { getCurrentUser } from '$lib/stores/auth.svelte';
	import { latestFor, pushSubmission, setHistory, submissionsByMaterial } from '$lib/stores/submissions.svelte';

	let {
		assignment,
		materialId = '',
		courseId = '',
		moduleId = '',
		moduleTitle = '',
		courseTitle = '',
		onSubmit
	}: {
		assignment: AssignmentDetail;
		materialId?: string;
		courseId?: string;
		moduleId?: string;
		moduleTitle?: string;
		courseTitle?: string;
		onSubmit?: (submission: AssignmentSubmission) => void;
	} = $props();

	let note = $state('');
	let studentNim = $state('');
	let phase = $state<UploadPhase>({ kind: 'idle' });
	let dragOver = $state(false);
	let fileInput: HTMLInputElement | null = $state(null);
	let formHeading: HTMLHeadingElement | null = $state(null);
	let downloading = $state(false);
	let downloadError = $state('');
	/** True saat user membuka form untuk merevisi kiriman yang sudah ada. */
	let revising = $state(false);

	// Nama pengumpul dari sesi login; NIM diisi manual (tanpa sumber profil).
	const sessionName = $derived(getCurrentUser()?.name ?? '');

	/** Status kelulusan server (K-06): lulus menempel, bukan dari kiriman terakhir. */
	let taskStatus = $state<TaskStatus | null>(null);

	$effect(() => {
		const mid = Number(materialId);
		if (!materialId || !Number.isInteger(mid) || mid <= 0) {
			taskStatus = null;
			return;
		}
		let cancelled = false;
		fetchTaskStatus(mid)
			.then((s) => {
				if (!cancelled) taskStatus = s;
			})
			.catch(() => {
				/* best-effort; kartu kiriman tetap tampil */
			});
		return () => {
			cancelled = true;
		};
	});

	const history = $derived(materialId ? (latestFor(materialId) ?? null) : null);
	/** Seluruh riwayat lokal (maks. 20, terbaru dulu). Tetap tampil walau backend offline. */
	const historyList = $derived(materialId ? (submissionsByMaterial.get(materialId) ?? []) : []);
	const previousSubmissions = $derived(historyList.slice(1));
	const busy = $derived(phase.kind === 'uploading');
	const selectedFile = $derived(
		phase.kind === 'selected' || phase.kind === 'uploading' ? phase.file : null
	);
	const previewUrl = $derived(
		phase.kind === 'selected' || phase.kind === 'uploading' || phase.kind === 'uploaded'
			? phase.previewUrl
			: null
	);
	const canSubmit = $derived(phase.kind === 'selected' && !busy);

	// Muat riwayat dari server (sekali per materi) agar refresh tetap tampil.
	// Selalu timpa cache lokal dengan kebenaran server — termasuk daftar
	// kosong, agar entri simulasi lama tidak bertahan.
	$effect(() => {
		if (!materialId) return;
		let cancelled = false;
		fetchSubmissions(materialId)
			.then((list) => {
				if (!cancelled) setHistory(materialId, list);
			})
			.catch(() => {});
		return () => {
			cancelled = true;
		};
	});

	// Bersihkan object URL saat file diganti / komponen dilepas.
	let lastUrl: string | null = null;
	$effect(() => {
		const url = previewUrl;
		if (lastUrl && lastUrl !== url) URL.revokeObjectURL(lastUrl);
		lastUrl = url;
		return () => {
			if (lastUrl && !url) {
				URL.revokeObjectURL(lastUrl);
				lastUrl = null;
			}
		};
	});

	function setError(message: string, keepUrl?: string) {
		phase = { kind: 'error', message, previewUrl: keepUrl };
	}

	async function validatePdf(file: File): Promise<string | null> {
		if (!file.name.toLowerCase().endsWith('.pdf')) return 'Hanya file berekstensi .pdf yang diterima.';
		if (file.type && file.type !== 'application/pdf' && file.type !== 'application/octet-stream')
			return `Tipe file "${file.type}" ditolak. Pilih PDF asli.`;
		if (file.size === 0) return 'File kosong. Pilih PDF yang valid.';
		if (file.size > MAX_PDF_BYTES)
			return `Ukuran ${formatBytes(file.size)} melebihi batas ${formatBytes(MAX_PDF_BYTES)}.`;
		try {
			const head = new Uint8Array(await file.slice(0, 8).arrayBuffer());
			const ok =
				head.length >= 5 &&
				head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46 && head[4] === 0x2d;
			if (!ok) return 'File tidak valid: header %PDF tidak ditemukan.';
		} catch {
			return 'Gagal membaca file. Coba lagi.';
		}
		return null;
	}

	async function pickFile(file: File | undefined | null) {
		if (!file) return;
		const err = await validatePdf(file);
		if (err) {
			setError(err);
			return;
		}
		if (previewUrl) URL.revokeObjectURL(previewUrl);
		phase = { kind: 'selected', file, previewUrl: URL.createObjectURL(file) };
	}

	function onInputChange(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		void pickFile(input.files?.[0]);
		input.value = '';
	}

	function onDrop(e: DragEvent) {
		e.preventDefault();
		dragOver = false;
		void pickFile(e.dataTransfer?.files?.[0]);
	}

	async function submit() {
		if (phase.kind !== 'selected') return;
		const { file, previewUrl: url } = phase;
		const meta: UploadMeta = {
			courseId,
			moduleId: moduleId || moduleTitle,
			materialId,
			// Nama dari sesi login; NIM dari input manual (maks 30, opsional).
			studentName: sessionName,
			studentNim: studentNim.trim().slice(0, 30),
			note: note.trim()
		};
		phase = { kind: 'uploading', file, previewUrl: url, progress: 0 };
		try {
			const submission = await uploadAssignmentPdf(file, meta, (progress) => {
				phase = { kind: 'uploading', file, previewUrl: url, progress };
			});
			pushSubmission(submission);
			revising = false;
			phase = { kind: 'uploaded', submission, previewUrl: url };
			onSubmit?.(submission);
		} catch (e) {
			setError(e instanceof Error ? e.message : 'Upload gagal. Coba lagi.', url);
		}
	}

	function reset() {
		if (previewUrl) URL.revokeObjectURL(previewUrl);
		phase = { kind: 'idle' };
	}

	/** Buka form revisi: input file lama dibuang, user wajib pilih PDF baru. */
	async function startRevise() {
		reset();
		note = '';
		revising = true;
		await tick();
		formHeading?.focus();
	}

	/** Batalkan revisi: kembali ke kartu kiriman tanpa mengubah apa pun. */
	function cancelRevise() {
		reset();
		note = '';
		revising = false;
	}

	/** Unduh PDF kiriman (butuh token → fetch, bukan tautan langsung). */
	async function downloadFile(submission: AssignmentSubmission): Promise<void> {
		if (downloading) return;
		downloading = true;
		downloadError = '';
		try {
			const blob = await downloadSubmissionFile(submission.driveLink);
			const url = URL.createObjectURL(blob);
			try {
				const a = document.createElement('a');
				a.href = url;
				a.download = submission.fileName || 'tugas.pdf';
				document.body.appendChild(a);
				a.click();
				a.remove();
			} finally {
				setTimeout(() => URL.revokeObjectURL(url), 10_000);
			}
		} catch (e) {
			downloadError = e instanceof Error ? e.message : 'Gagal mengunduh berkas.';
		} finally {
			downloading = false;
		}
	}
</script>

<div class="space-y-5">
	<!-- Brief penugasan (dipertahankan) -->
	<div class="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-white p-5 sm:p-6">
		<p class="mb-2 flex items-center gap-2 text-sm font-bold text-slate-900">
			<i class="fa-solid fa-briefcase text-violet-600" aria-hidden="true"></i> Brief penugasan
		</p>
		<p class="text-sm leading-relaxed text-slate-700">{assignment.brief}</p>
		{#if assignment.deliverable !== '-' || assignment.deadline !== '-'}
		<div class="mt-4 grid gap-3 sm:grid-cols-2">
			{#if assignment.deliverable !== '-'}
			<div class="rounded-xl bg-white p-3.5 ring-1 ring-slate-200">
				<p class="mb-1 flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-slate-500 uppercase">
					<i class="fa-solid fa-box-open text-violet-500" aria-hidden="true"></i> Hasil dikumpulkan
				</p>
				<p class="text-xs font-semibold text-slate-800">{assignment.deliverable}</p>
			</div>
			{/if}
			{#if assignment.deadline !== '-'}
			<div class="rounded-xl bg-white p-3.5 ring-1 ring-slate-200">
				<p class="mb-1 flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-slate-500 uppercase">
					<i class="fa-solid fa-calendar-days text-amber-500" aria-hidden="true"></i> Tenggat
				</p>
				<p class="text-xs font-semibold text-slate-800">{assignment.deadline}</p>
			</div>
			{/if}
		</div>
		{/if}
	</div>

	<!-- Status kelulusan server (K-06): lulus menempel walau kiriman terakhir belum dinilai -->
	{#if taskStatus && taskStatus.attempts > 0}
		<div
			role="status"
			class={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-bold ${taskStatus.passed ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}
		>
			<i class={`fa-solid ${taskStatus.passed ? 'fa-trophy' : 'fa-hourglass-half'}`} aria-hidden="true"></i>
			{#if taskStatus.passed}
				<span>Lulus — nilai terbaik {taskStatus.bestScore ?? '-'} dari {taskStatus.attempts} kiriman.</span>
			{:else}
				<span>Menunggu penilaian — {taskStatus.attempts} kiriman{taskStatus.graded > 0 ? ` · ${taskStatus.graded} dinilai` : ''}.</span>
			{/if}
		</div>
	{/if}

	{#if assignment.objectives.length > 0 || assignment.steps.length > 0}
	<div class="grid gap-4 lg:grid-cols-2">
		{#if assignment.objectives.length > 0}
		<div class="rounded-2xl border border-slate-200 bg-white p-5">
			<p class="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900">
				<i class="fa-solid fa-bullseye text-emerald-600" aria-hidden="true"></i> Tujuan
			</p>
			<ul class="space-y-2.5">
				{#each assignment.objectives as obj (obj)}
					<li class="flex items-start gap-2.5 text-sm text-slate-700">
						<i class="fa-solid fa-circle-check mt-0.5 shrink-0 text-emerald-500" aria-hidden="true"></i>
						<span>{obj}</span>
					</li>
				{/each}
			</ul>
		</div>
		{/if}
		{#if assignment.steps.length > 0}
		<div class="rounded-2xl border border-slate-200 bg-white p-5">
			<p class="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900">
				<i class="fa-solid fa-shoe-prints text-blue-600" aria-hidden="true"></i> Langkah pengerjaan
			</p>
			<ol class="space-y-2.5">
				{#each assignment.steps as step, i (step)}
					<li class="flex items-start gap-3 text-sm text-slate-700">
						<span
							class="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-[11px] font-extrabold text-blue-700"
							aria-hidden="true"
						>
							{i + 1}
						</span>
						<span>{step}</span>
					</li>
				{/each}
			</ol>
		</div>
		{/if}
	</div>
	{/if}

	<!-- Riwayat pengumpulan terakhir (form disembunyikan kecuali sedang revisi) -->
	{#if history && phase.kind !== 'uploaded' && !revising}
		<div class="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5" role="status">
			<i class="fa-solid fa-circle-check mt-0.5 text-xl text-emerald-600" aria-hidden="true"></i>
			<div class="min-w-0 flex-1">
				<p class="flex flex-wrap items-center gap-2 text-sm font-bold text-emerald-800">
					<span>Sudah terkumpul — {history.fileName}</span>
					<span class="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-extrabold text-white uppercase">Terbaru</span>
					<span class="rounded-full border border-emerald-300 bg-white px-2 py-0.5 text-[10px] font-bold text-emerald-700">
						{history.driveMode === 'drive' ? 'Tersimpan di server' : 'Simulasi lokal'}
					</span>
				</p>
				<p class="mt-0.5 text-xs text-emerald-700">
					{new Date(history.createdAt).toLocaleString('id-ID')} ·
					{history.driveMode === 'drive' ? 'tersimpan di server' : 'mode MOCK — belum terkirim'} ·
					status: {history.status}{history.score !== null ? ` · nilai ${history.score}` : ''}
				</p>
				<p class="mt-1 text-[11px] text-emerald-700">
					Terkumpul ≠ lulus — menunggu nilai instruktur.
				</p>
				{#if history.feedback?.trim()}
					<p class="mt-1 text-xs text-emerald-800">
						<i class="fa-solid fa-comment-dots mr-1" aria-hidden="true"></i>{history.feedback}
					</p>
				{:else}
					<p class="mt-1 text-[11px] text-emerald-700">Belum ada umpan balik dari instruktur.</p>
				{/if}
				{#if history.rubricScores}
					<p class="mt-1.5 rounded-xl bg-white/70 px-3 py-2 text-[11px] font-semibold text-emerald-800 ring-1 ring-emerald-200">
						<i class="fa-solid fa-list-check mr-1" aria-hidden="true"></i>Rincian nilai — Kelengkapan {history.rubricScores.kelengkapan} · Ketepatan isi {history.rubricScores.ketepatan} · Kerapian {history.rubricScores.kerapian}
					</p>
				{/if}
				<div class="mt-2 flex flex-wrap gap-2">
					<button
						type="button"
						onclick={() => void downloadFile(history)}
						disabled={downloading}
						class="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-emerald-600"
					>
						<i class={`fa-solid ${downloading ? 'fa-circle-notch fa-spin' : 'fa-download'}`} aria-hidden="true"></i> {downloading ? 'Mengunduh…' : 'Unduh PDF'}
					</button>
					<button
						type="button"
						onclick={startRevise}
						class="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-emerald-300 bg-white px-4 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100 focus-visible:outline-2 focus-visible:outline-emerald-600"
					>
						<i class="fa-solid fa-rotate-left" aria-hidden="true"></i> Kumpulkan revisi (PDF baru)
					</button>
					{#if downloadError}
						<p role="alert" class="w-full text-xs font-semibold text-red-600">{downloadError}</p>
					{/if}
				</div>
				{#if previousSubmissions.length > 0}
					<div class="mt-3 border-t border-emerald-200 pt-3">
						<p class="text-[11px] font-extrabold tracking-wide text-emerald-800 uppercase">
							Riwayat sebelumnya ({previousSubmissions.length})
						</p>
						<ol class="mt-1.5 space-y-1.5">
							{#each previousSubmissions as prev (prev.id)}
								<li class="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-emerald-700">
									<i class="fa-solid fa-file-pdf text-red-500" aria-hidden="true"></i>
									<span class="max-w-48 truncate font-bold">{prev.fileName}</span>
									<span>{new Date(prev.createdAt).toLocaleString('id-ID')}</span>
									<span>· {prev.driveMode === 'drive' ? 'Tersimpan di server' : 'Simulasi lokal'}</span>
									<span>· {prev.status}{prev.score !== null ? ` · nilai ${prev.score}` : ''}{prev.rubricScores ? ` · rubrik ${prev.rubricScores.kelengkapan}/${prev.rubricScores.ketepatan}/${prev.rubricScores.kerapian}` : ''}</span>
								</li>
							{/each}
						</ol>
					</div>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Form pengumpulan PDF -> Drive -> aplikasi -->
	{#if phase.kind === 'uploaded'}
		{@const s = phase.submission}
		<div
			role="status"
			aria-live="polite"
			class="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 sm:p-6"
		>
			<div class="flex items-start gap-3">
				<i class="fa-solid fa-circle-check mt-0.5 text-2xl text-emerald-600" aria-hidden="true"></i>
				<div class="min-w-0 flex-1">
					<p class="text-sm font-bold text-emerald-800">
						{s.driveMode === 'drive'
							? 'PDF terkumpul di server.'
							: 'PDF tersimpan lokal (simulasi) — belum terkirim ke server.'}
					</p>
					<p class="mt-0.5 text-xs text-emerald-700">
						{s.fileName} · {formatBytes(s.fileSize)} ·
						instruktur menilai maks. 3 hari kerja.
					</p>
					<p class="mt-1 text-[11px] text-emerald-700">
						Terkumpul ≠ lulus — kelulusan dan nilai dibaca dari server.
					</p>
					<div class="mt-3 flex flex-wrap gap-2">
						<button
							type="button"
							onclick={() => void downloadFile(s)}
							disabled={downloading}
							class="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-emerald-600"
						>
							<i class={`fa-solid ${downloading ? 'fa-circle-notch fa-spin' : 'fa-download'}`} aria-hidden="true"></i> {downloading ? 'Mengunduh…' : 'Unduh PDF'}
						</button>
						<button
							type="button"
							onclick={startRevise}
							class="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100 focus-visible:outline-2 focus-visible:outline-emerald-600"
						>
							<i class="fa-solid fa-rotate-left" aria-hidden="true"></i> Revisi (PDF baru)
						</button>
					</div>
				</div>
			</div>
		</div>
	{:else if !history || revising}
		<form
			aria-label="Formulir pengumpulan tugas PDF"
			class="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"
			onsubmit={(e) => {
				e.preventDefault();
				void submit();
			}}
		>
			<h2
				bind:this={formHeading}
				tabindex="-1"
				class="flex items-center gap-2 text-sm font-bold text-slate-900 focus-visible:outline-2 focus-visible:outline-violet-600"
			>
				<i class="fa-solid fa-file-arrow-up text-violet-600" aria-hidden="true"></i>
				{revising ? 'Revisi tugas (PDF baru)' : 'Kumpulkan tugas (PDF)'}
			</h2>
			<p class="mt-1 text-xs text-slate-500">
				Format wajib <strong>PDF</strong>, maks. {formatBytes(MAX_PDF_BYTES)}. File diunggah ke server lalu
				dicatat sebagai kiriman untuk dinilai instruktur.
				{#if courseTitle}<span class="font-semibold text-slate-600">· {courseTitle}</span>{/if}
			</p>

			<!-- Dropzone PDF -->
			<div class="mt-4">
				<span id="pdf-label" class="mb-1.5 block text-xs font-bold text-slate-700">File PDF *</span>
				<button
					type="button"
					aria-labelledby="pdf-label"
					aria-describedby="pdf-hint"
					aria-disabled={busy}
					disabled={busy}
					onclick={() => fileInput?.click()}
					ondragover={(e) => {
						e.preventDefault();
						dragOver = true;
					}}
					ondragleave={() => (dragOver = false)}
					ondrop={onDrop}
					class={`flex min-h-32 w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-6 text-center transition-colors focus-visible:outline-2 focus-visible:outline-violet-600 motion-reduce:transition-none ${
						dragOver
							? 'border-violet-500 bg-violet-50'
							: selectedFile
								? 'border-emerald-300 bg-emerald-50/50'
								: 'border-slate-300 bg-slate-50 hover:border-violet-400 hover:bg-violet-50/50'
					}`}
				>
					{#if selectedFile}
						<i class="fa-solid fa-file-pdf text-3xl text-red-500" aria-hidden="true"></i>
						<span class="max-w-full truncate text-sm font-bold text-slate-900">{selectedFile.name}</span>
						<span class="text-xs text-slate-500">{formatBytes(selectedFile.size)} · klik / seret untuk ganti</span>
					{:else}
						<i class="fa-solid fa-cloud-arrow-up text-3xl text-violet-400" aria-hidden="true"></i>
						<span class="text-sm font-bold text-slate-700">Seret PDF ke sini atau <span class="text-violet-600 underline">pilih file</span></span>
						<span id="pdf-hint" class="text-xs text-slate-500">.pdf · maks. {formatBytes(MAX_PDF_BYTES)} · header %PDF dicek otomatis</span>
					{/if}
				</button>
				<input
					bind:this={fileInput}
					type="file"
					accept="application/pdf,.pdf"
					aria-label="Pilih file PDF tugas"
					onchange={onInputChange}
					class="sr-only"
					tabindex={-1}
				/>

				{#if phase.kind === 'uploading'}
					<div class="mt-3" role="status" aria-live="polite" aria-label={`Mengunggah ${phase.progress} persen`}>
						<div class="flex items-center justify-between text-xs font-bold text-slate-600">
							<span><i class="fa-solid fa-upload mr-1.5 text-violet-500" aria-hidden="true"></i>Mengunggah PDF…</span>
							<span>{phase.progress}%</span>
						</div>
						<div class="mt-1.5 h-2.5 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={phase.progress}>
							<div
								class="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-[width] motion-reduce:transition-none"
								style:width={`${phase.progress}%`}
							></div>
						</div>
					</div>
				{/if}

				{#if previewUrl && phase.kind !== 'uploading'}
					<div class="mt-3 overflow-hidden rounded-xl border border-slate-200">
						<p class="flex items-center gap-1.5 border-b border-slate-100 bg-slate-50 px-3.5 py-2 text-[11px] font-bold tracking-wide text-slate-500 uppercase">
							<i class="fa-solid fa-eye text-violet-500" aria-hidden="true"></i> Pratinjau PDF
						</p>
						<embed src={previewUrl} type="application/pdf" class="h-72 w-full bg-slate-100" title="Pratinjau PDF tugas" />
					</div>
				{/if}
			</div>

			<div class="mt-4 grid gap-4 sm:grid-cols-2">
				<div>
					<label for="sub-nim" class="mb-1.5 block text-xs font-bold text-slate-700">
						NIM <span class="font-normal text-slate-400">(opsional, maks. 30 karakter)</span>
					</label>
					<input
						id="sub-nim"
						type="text"
						bind:value={studentNim}
						maxlength={30}
						placeholder="cth. 2101020045"
						autocomplete="off"
						class="w-full rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-500/10 focus:outline-none"
					/>
				</div>
				<div>
					<label for="sub-note" class="mb-1.5 block text-xs font-bold text-slate-700">
						Catatan untuk instruktur <span class="font-normal text-slate-400">(opsional, maks. 500 karakter)</span>
					</label>
					<textarea
						id="sub-note"
						bind:value={note}
						rows={3}
						maxlength={500}
						placeholder="cth. Pendekatan saya: …"
						class="w-full rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-500/10 focus:outline-none"
					></textarea>
				</div>
			</div>

			{#if phase.kind === 'error'}
				<p role="alert" class="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700">
					<i class="fa-solid fa-triangle-exclamation mt-0.5 shrink-0" aria-hidden="true"></i>
					<span>{phase.message}</span>
				</p>
			{/if}

			<div class="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
				<p class="text-[11px] text-slate-500" aria-live="polite">
					{#if selectedFile}
						<i class="fa-solid fa-lock mr-1 text-emerald-500" aria-hidden="true"></i>Siap dikirim: {selectedFile.name}
					{:else}
						Pilih PDF untuk mengaktifkan tombol kirim.
					{/if}
				</p>
				<div class="flex gap-2">
					{#if !busy && (selectedFile || revising)}
						<button
							type="button"
							onclick={() => (revising ? cancelRevise() : reset())}
							class="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-violet-600"
						>
							{#if revising}
								<i class="fa-solid fa-arrow-left" aria-hidden="true"></i> Kembali
							{:else}
								<i class="fa-solid fa-xmark" aria-hidden="true"></i> Batal
							{/if}
						</button>
					{/if}
					<button
						type="submit"
						disabled={!canSubmit}
						class="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-violet-600/25 transition-all hover:bg-violet-700 focus-visible:outline-2 focus-visible:outline-violet-600 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
					>
						{#if busy}
							<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i> Mengirim…
						{:else}
							<i class="fa-solid fa-paper-plane" aria-hidden="true"></i> {revising ? 'Unggah Revisi' : 'Kumpulkan Tugas'}
						{/if}
					</button>
				</div>
			</div>
		</form>
	{/if}
</div>
