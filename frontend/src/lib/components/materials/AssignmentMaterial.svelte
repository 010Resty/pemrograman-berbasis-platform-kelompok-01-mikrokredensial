<script lang="ts">
	import { tick } from 'svelte';
	import type { AssignmentDetail } from '$lib/data/material-details';
	import type { AssignmentSubmission, UploadMeta, UploadPhase } from '$lib/types/submission';
	import { MAX_PDF_BYTES, formatBytes } from '$lib/types/submission';
	import { uploadAssignmentPdf, fetchSubmissions } from '$lib/services/submission.service';
	import { latestFor, pushSubmission, setHistory } from '$lib/stores/submissions.svelte';

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
	let phase = $state<UploadPhase>({ kind: 'idle' });
	let dragOver = $state(false);
	let fileInput: HTMLInputElement | null = $state(null);
	let formHeading: HTMLHeadingElement | null = $state(null);
	let copied = $state(false);
	/** True saat user membuka form untuk merevisi kiriman yang sudah ada. */
	let revising = $state(false);

	const history = $derived(materialId ? (latestFor(materialId) ?? null) : null);
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
	$effect(() => {
		if (!materialId) return;
		let cancelled = false;
		fetchSubmissions(materialId)
			.then((list) => {
				if (!cancelled && list.length > 0) setHistory(materialId, list);
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
		copied = false;
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
			// TODO: isi dari sesi user login (nama + NIM otomatis).
			studentName: '',
			studentNim: '',
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
		copied = false;
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

	async function copyLink(link: string) {
		try {
			await navigator.clipboard.writeText(link);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch {
			/* clipboard ditolak — user bisa salin manual */
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
		<div class="mt-4 grid gap-3 sm:grid-cols-2">
			<div class="rounded-xl bg-white p-3.5 ring-1 ring-slate-200">
				<p class="mb-1 flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-slate-500 uppercase">
					<i class="fa-solid fa-box-open text-violet-500" aria-hidden="true"></i> Hasil dikumpulkan
				</p>
				<p class="text-xs font-semibold text-slate-800">{assignment.deliverable}</p>
			</div>
			<div class="rounded-xl bg-white p-3.5 ring-1 ring-slate-200">
				<p class="mb-1 flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-slate-500 uppercase">
					<i class="fa-solid fa-calendar-days text-amber-500" aria-hidden="true"></i> Tenggat
				</p>
				<p class="text-xs font-semibold text-slate-800">{assignment.deadline}</p>
			</div>
		</div>
	</div>

	<div class="grid gap-4 lg:grid-cols-2">
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
	</div>

	<!-- Riwayat pengumpulan terakhir (form disembunyikan kecuali sedang revisi) -->
	{#if history && phase.kind !== 'uploaded' && !revising}
		<div class="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5" role="status">
			<i class="fa-solid fa-circle-check mt-0.5 text-xl text-emerald-600" aria-hidden="true"></i>
			<div class="min-w-0 flex-1">
				<p class="text-sm font-bold text-emerald-800">Sudah terkumpul — {history.fileName}</p>
				<p class="mt-0.5 text-xs text-emerald-700">
					{new Date(history.createdAt).toLocaleString('id-ID')} ·
					{history.driveMode === 'drive' ? 'tersimpan di Google Drive' : 'mode mock (isi kredensial Drive untuk produksi)'} ·
					status: {history.status}{history.score !== null ? ` · nilai ${history.score}` : ''}
				</p>
				<div class="mt-2 flex flex-wrap gap-2">
					<a
						href={history.driveLink}
						target="_blank"
						rel="noopener noreferrer"
						class="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-emerald-600"
					>
						<i class="fa-brands fa-google-drive" aria-hidden="true"></i> Buka di Drive
					</a>
					<button
						type="button"
						onclick={startRevise}
						class="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-emerald-300 bg-white px-4 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100 focus-visible:outline-2 focus-visible:outline-emerald-600"
					>
						<i class="fa-solid fa-rotate-left" aria-hidden="true"></i> Kumpulkan revisi (PDF baru)
					</button>
				</div>
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
					<p class="text-sm font-bold text-emerald-800">PDF terkirim ke aplikasi via Google Drive!</p>
					<p class="mt-0.5 text-xs text-emerald-700">
						{s.fileName} · {formatBytes(s.fileSize)} ·
						{s.driveMode === 'drive' ? 'tersimpan di Drive' : 'mode MOCK'} ·
						instruktur menilai maks. 3 hari kerja.
					</p>
					<p class="mt-2 truncate text-xs text-emerald-700">
						<i class="fa-solid fa-link mr-1" aria-hidden="true"></i>
						<a href={s.driveLink} target="_blank" rel="noopener noreferrer" class="font-semibold underline hover:no-underline">{s.driveLink}</a>
					</p>
					<div class="mt-3 flex flex-wrap gap-2">
						<a
							href={s.driveLink}
							target="_blank"
							rel="noopener noreferrer"
							class="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-emerald-600"
						>
							<i class="fa-brands fa-google-drive" aria-hidden="true"></i> Lihat di Drive
						</a>
						<button
							type="button"
							onclick={() => copyLink(s.driveLink)}
							class="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-emerald-300 bg-white px-4 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100 focus-visible:outline-2 focus-visible:outline-emerald-600"
						>
							<i class="fa-solid fa-copy" aria-hidden="true"></i> {copied ? 'Tersalin!' : 'Salin tautan'}
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
			aria-label="Formulir pengumpulan tugas PDF via Google Drive"
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
				{revising ? 'Revisi tugas (PDF baru → Google Drive)' : 'Kumpulkan tugas (PDF → Google Drive → aplikasi)'}
			</h2>
			<p class="mt-1 text-xs text-slate-500">
				Format wajib <strong>PDF</strong>, maks. {formatBytes(MAX_PDF_BYTES)}. File diunggah ke Drive,
				lalu tautannya dikirim otomatis ke aplikasi untuk dinilai instruktur.
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
							<span><i class="fa-brands fa-google-drive mr-1.5 text-violet-500" aria-hidden="true"></i>Mengunggah ke Google Drive…</span>
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

			<div class="mt-4">
				<label for="sub-note" class="mb-1.5 block text-xs font-bold text-slate-700">
					Catatan untuk instruktur <span class="font-normal text-slate-400">(opsional, maks. 500 karakter)</span>
				</label>
				<textarea
					id="sub-note"
					bind:value={note}
					rows={3}
					maxlength={500}
					placeholder="cth. Pendekatan saya: … · demo: https://…"
					class="w-full rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-500/10 focus:outline-none"
				></textarea>
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
							<i class="fa-brands fa-google-drive" aria-hidden="true"></i> {revising ? 'Unggah Revisi ke Drive' : 'Unggah ke Drive & Kumpulkan'}
						{/if}
					</button>
				</div>
			</div>
		</form>
	{/if}
</div>
