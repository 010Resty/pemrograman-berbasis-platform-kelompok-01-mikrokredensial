<script lang="ts">
	import type { QuizDraft } from '$lib/stores/quiz-drafts';
	import {
		blankQuizQuestion,
		DEFAULT_PASS_SCORE,
		normalizePassScore,
		validateQuizDraft
	} from '$lib/stores/quiz-drafts';
	import type { QuizQuestion } from '$lib/data/material-details';
	import { uploadFile } from '$lib/api/uploads';
	import { resolveMediaSrc } from '$lib/tiptap/extensions';

	/**
	 * Pembuat kuis instruktur: susun soal pilihan ganda (4 opsi + kunci)
	 * + lampiran per soal (foto/audio/PDF via backend, seperti editor materi)
	 * + pengaturan nilai minimum kelulusan (0–100).
	 * Murni permukaan sunting — penyimpanan ditangani halaman via `onupdate`.
	 */
	let {
		draftKey,
		initial = null,
		onupdate = () => {}
	}: {
		draftKey: string;
		initial?: QuizDraft | null;
		onupdate?: (info: { draft: QuizDraft; valid: boolean; count: number }) => void;
	} = $props();

	let intro = $state('');
	let passScore = $state<number>(DEFAULT_PASS_SCORE);
	let questions = $state<QuizQuestion[]>([blankQuizQuestion()]);
	let loadedFor = $state<string | null>(null);

	/* Muat draf sekali per materi. */
	$effect(() => {
		if (loadedFor === draftKey) return;
		const src = initial;
		intro = src?.intro ?? '';
		passScore = src ? normalizePassScore(src.passScore) : DEFAULT_PASS_SCORE;
		questions =
			src && src.questions.length > 0
				? src.questions.map((q) => ({
						question: q.question,
						options: [...q.options],
						answer: q.answer,
						explanation: q.explanation ?? '',
						imageUrl: q.imageUrl,
						audioUrl: q.audioUrl,
						fileUrl: q.fileUrl,
						fileName: q.fileName
					}))
				: [blankQuizQuestion()];
		loadedFor = draftKey;
	});

	const passInvalid = $derived(!Number.isFinite(passScore) || passScore < 0 || passScore > 100);

	/* Laporkan draf ke induk setiap berubah. */
	$effect(() => {
		if (loadedFor !== draftKey) return;
		const draft: QuizDraft = {
			title: '',
			intro,
			passScore: normalizePassScore(passScore),
			questions: questions.map((q) => ({
				question: q.question,
				options: [...q.options],
				answer: q.answer,
				explanation: q.explanation ?? '',
				imageUrl: q.imageUrl,
				audioUrl: q.audioUrl,
				fileUrl: q.fileUrl,
				fileName: q.fileName
			})),
			updatedAt: ''
		};
		onupdate({ draft, valid: validateQuizDraft({ ...draft, title: 'x' }) === null, count: questions.length });
	});

	function addQuestion() {
		questions = [...questions, blankQuizQuestion()];
	}

	function removeQuestion(i: number) {
		if (questions.length <= 1) return;
		questions = questions.filter((_, x) => x !== i);
	}

	function moveQuestion(i: number, dir: -1 | 1) {
		const t = i + dir;
		if (t < 0 || t >= questions.length) return;
		const next = [...questions];
		[next[i], next[t]] = [next[t], next[i]];
		questions = next;
	}

	function setOption(qi: number, oi: number, v: string) {
		questions = questions.map((q, x) =>
			x === qi ? { ...q, options: q.options.map((o, y) => (y === oi ? v : o)) } : q
		);
	}

	type MediaKind = 'image' | 'audio' | 'pdf';

	const MEDIA_ACCEPT: Record<MediaKind, string> = {
		image: 'image/jpeg,image/png,image/webp,image/gif',
		audio: 'audio/mpeg,audio/ogg,audio/wav,audio/x-wav',
		pdf: 'application/pdf'
	};

	/** Batas klien selaras backend (gambar 4MB, audio 8MB, PDF 8MB dari 10MB server). */
	const MEDIA_MAX_BYTES: Record<MediaKind, number> = {
		image: 4 * 1024 * 1024,
		audio: 8 * 1024 * 1024,
		pdf: 8 * 1024 * 1024
	};

	let mediaTarget = $state<{ qi: number; kind: MediaKind } | null>(null);
	let mediaBusy = $state<number | null>(null);
	let mediaError = $state('');
	let imageInput: HTMLInputElement | null = $state(null);
	let audioInput: HTMLInputElement | null = $state(null);
	let pdfInput: HTMLInputElement | null = $state(null);

	function setMedia(
		qi: number,
		patch: Partial<Pick<QuizQuestion, 'imageUrl' | 'audioUrl' | 'fileUrl' | 'fileName'>>
	) {
		questions = questions.map((q, x) => (x === qi ? { ...q, ...patch } : q));
	}

	function pickMedia(qi: number, kind: MediaKind) {
		mediaError = '';
		mediaTarget = { qi, kind };
		(kind === 'image' ? imageInput : kind === 'audio' ? audioInput : pdfInput)?.click();
	}

	async function handleMediaFile(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		const target = mediaTarget;
		mediaTarget = null;
		if (!file || !target || mediaBusy !== null) return;
		const { qi, kind } = target;
		const mime =
			kind === 'audio' && file.type === 'audio/mp3' ? 'audio/mpeg' : file.type || undefined;
		if (kind === 'pdf' && file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
			mediaError = `Soal ${qi + 1}: berkas harus berupa PDF.`;
			return;
		}
		if (file.size > MEDIA_MAX_BYTES[kind]) {
			mediaError = `Soal ${qi + 1}: ukuran maksimal ${MEDIA_MAX_BYTES[kind] / 1024 / 1024} MB (batas server).`;
			return;
		}
		mediaBusy = qi;
		mediaError = '';
		try {
			// Unggah dulu ke backend → simpan URL server (bukan dataURL).
			const uploaded = await uploadFile(file, kind, mime);
			if (kind === 'image') setMedia(qi, { imageUrl: uploaded.url });
			else if (kind === 'audio') setMedia(qi, { audioUrl: uploaded.url });
			else setMedia(qi, { fileUrl: uploaded.url, fileName: file.name.slice(0, 255) });
		} catch (e) {
			mediaError = `Soal ${qi + 1}: ${e instanceof Error ? e.message : 'gagal mengunggah berkas.'}`;
		} finally {
			mediaBusy = null;
		}
	}

	function removeMedia(qi: number, kind: MediaKind) {
		if (kind === 'image') setMedia(qi, { imageUrl: undefined });
		else if (kind === 'audio') setMedia(qi, { audioUrl: undefined });
		else setMedia(qi, { fileUrl: undefined, fileName: undefined });
	}
</script>

<div class="space-y-4">
	<div class="overflow-hidden rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50 to-white">
		<div class="flex items-center gap-3 border-b border-amber-100 bg-amber-50/70 px-4 py-3 sm:px-5">
			<span
				class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-md shadow-amber-500/25"
				aria-hidden="true"
			>
				<i class="fa-solid fa-award text-sm"></i>
			</span>
			<div class="min-w-0 flex-1">
				<h2 class="text-sm font-extrabold text-slate-900">Nilai minimum kelulusan</h2>
				<p id="quiz-pass-desc" class="text-[11px] leading-snug text-slate-500">
					Peserta dinyatakan <strong class="text-slate-700">lulus</strong> bila nilainya ≥ nilai ini (0–100).
				</p>
			</div>
			<span
				aria-live="polite"
				class="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-violet-700 px-3 py-1.5 text-xs font-extrabold text-white"
			>
				<i class="fa-solid fa-star text-[10px] text-amber-300" aria-hidden="true"></i>
				{Number.isFinite(passScore) ? Math.min(100, Math.max(0, Math.round(passScore))) : '—'}
			</span>
		</div>
		<div class="grid gap-3 p-4 sm:grid-cols-[140px_minmax(0,1fr)] sm:items-center sm:gap-4 sm:p-5">
			<div>
				<label for="quiz-pass-score" class="mb-1 block text-xs font-bold text-slate-700">
					Nilai minimum <span class="text-red-500" aria-hidden="true">*</span>
				</label>
				<div class="relative">
					<input
						id="quiz-pass-score"
						type="number"
						min={0}
						max={100}
						step={1}
						bind:value={passScore}
						aria-describedby="quiz-pass-desc quiz-pass-hint"
						aria-invalid={passInvalid}
						class="w-full rounded-xl border bg-white px-3.5 py-2.5 pr-10 text-lg font-extrabold text-slate-900 focus:ring-4 focus:outline-none {passInvalid
							? 'border-red-300 focus:border-red-500 focus:ring-red-500/10'
							: 'border-slate-200 focus:border-amber-500 focus:ring-amber-500/10'}"
					/>
					<span class="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs font-bold text-slate-400" aria-hidden="true">/ 100</span>
				</div>
			</div>
			<div>
				<label for="quiz-pass-range" class="mb-1 block text-xs font-bold text-slate-700">
					Geser cepat <span class="font-normal text-slate-400">(0–100)</span>
				</label>
				<input
					id="quiz-pass-range"
					type="range"
					min={0}
					max={100}
					step={1}
					bind:value={passScore}
					aria-describedby="quiz-pass-desc"
					class="h-2 w-full cursor-pointer appearance-none rounded-full bg-gradient-to-r from-amber-200 via-amber-400 to-emerald-500 accent-amber-600 focus-visible:outline-2 focus-visible:outline-amber-600"
				/>
				<div class="mt-1 flex justify-between text-[10px] font-bold text-slate-400" aria-hidden="true">
					<span>0 · mudah lulus</span>
					<span id="quiz-pass-hint">70 · standar</span>
					<span>100 · sempurna</span>
				</div>
			</div>
		</div>
		{#if passInvalid}
			<p
				role="alert"
				class="flex items-start gap-2 border-t border-red-100 bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-700 sm:px-5"
			>
				<i class="fa-solid fa-circle-exclamation mt-0.5 shrink-0" aria-hidden="true"></i>
				Nilai minimum harus di antara 0 dan 100.
			</p>
		{/if}
	</div>

	<div class="overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
		<div class="border-b border-slate-100 bg-slate-50/70 px-4 py-3 sm:px-5">
			<label for="quiz-intro" class="block text-xs font-bold text-slate-700">
				Pengantar kuis <span class="font-normal text-slate-400">(opsional)</span>
			</label>
		</div>
		<div class="p-4 sm:p-5">
			<textarea
				id="quiz-intro"
				bind:value={intro}
				rows={2}
				maxlength={500}
				placeholder={`cth. Kerjakan dengan jujur — nilai minimal ${Number.isFinite(passScore) ? Math.min(100, Math.max(0, Math.round(passScore))) : DEFAULT_PASS_SCORE} untuk lolos.`}
				class="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 focus:outline-none"
			></textarea>
			<p class="mt-1.5 text-[11px] text-slate-400">
				Tips: tulis target kelulusan di pengantar agar peserta tahu — mis. “Nilai minimal {Number.isFinite(
					passScore
				)
					? Math.min(100, Math.max(0, Math.round(passScore)))
					: DEFAULT_PASS_SCORE} untuk lolos”.
			</p>
		</div>
	</div>

	<ol class="space-y-4" aria-label="Daftar soal kuis">
		{#each questions as q, qi (qi)}
			<li class="overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
				<div class="flex items-center gap-2 border-b border-slate-100 bg-slate-50/70 px-4 py-3">
					<span
						class="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-xs font-extrabold text-white"
						aria-hidden="true"
					>
						{qi + 1}
					</span>
					<span class="min-w-0 flex-1 text-sm font-extrabold text-slate-900">Soal {qi + 1}</span>
					<span class="flex shrink-0 items-center gap-1" role="group" aria-label={`Aksi soal ${qi + 1}`}>
						<button
							type="button"
							onclick={() => moveQuestion(qi, -1)}
							disabled={qi === 0}
							aria-label={`Pindah soal ${qi + 1} ke atas`}
							class="flex min-h-9 min-w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-all hover:border-amber-300 hover:text-amber-600 focus-visible:outline-2 focus-visible:outline-amber-600 disabled:cursor-not-allowed disabled:opacity-35"
						>
							<i class="fa-solid fa-arrow-up text-[11px]" aria-hidden="true"></i>
						</button>
						<button
							type="button"
							onclick={() => moveQuestion(qi, 1)}
							disabled={qi === questions.length - 1}
							aria-label={`Pindah soal ${qi + 1} ke bawah`}
							class="flex min-h-9 min-w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-all hover:border-amber-300 hover:text-amber-600 focus-visible:outline-2 focus-visible:outline-amber-600 disabled:cursor-not-allowed disabled:opacity-35"
						>
							<i class="fa-solid fa-arrow-down text-[11px]" aria-hidden="true"></i>
						</button>
						<button
							type="button"
							onclick={() => removeQuestion(qi)}
							disabled={questions.length <= 1}
							aria-label={`Hapus soal ${qi + 1}`}
							class="flex min-h-9 min-w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 transition-all hover:border-red-300 hover:bg-red-50 hover:text-red-600 focus-visible:outline-2 focus-visible:outline-red-500 disabled:cursor-not-allowed disabled:opacity-35"
						>
							<i class="fa-solid fa-trash text-[11px]" aria-hidden="true"></i>
						</button>
					</span>
				</div>

				<div class="space-y-3 p-4 sm:p-5">
					<div>
						<label for={`quiz-q-${qi}`} class="mb-1 block text-xs font-bold text-slate-700">
							Pertanyaan <span class="text-red-500" aria-hidden="true">*</span>
						</label>
						<textarea
							id={`quiz-q-${qi}`}
							bind:value={questions[qi].question}
							rows={2}
							placeholder="cth. Apa fungsi utama DOM dalam aplikasi web?"
							class="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-900 placeholder:font-normal placeholder:text-slate-400 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 focus:outline-none"
						></textarea>
					</div>

					<fieldset>
						<legend class="mb-1 block text-xs font-bold text-slate-700">
							Opsi jawaban <span class="text-red-500" aria-hidden="true">*</span>
							<span class="font-normal text-slate-400">— pilih satu kunci</span>
						</legend>
						<div class="space-y-2">
							{#each q.options as opt, oi (oi)}
								<div class="flex items-center gap-2">
									<input
										type="radio"
										id={`quiz-q${qi}-k${oi}`}
										name={`quiz-q${qi}-key`}
										checked={q.answer === oi}
										onchange={() => {
											questions = questions.map((x, xi) =>
												xi === qi ? { ...x, answer: oi } : x
											);
										}}
										class="h-4 w-4 shrink-0 cursor-pointer accent-amber-600"
										aria-label={`Kunci soal ${qi + 1}: opsi ${String.fromCharCode(65 + oi)}`}
									/>
									<span
										class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-extrabold {q.answer ===
										oi
											? 'bg-amber-500 text-white'
											: 'bg-slate-100 text-slate-500'}"
										aria-hidden="true"
									>
										{String.fromCharCode(65 + oi)}
									</span>
									<label for={`quiz-q${qi}-o${oi}`} class="sr-only"
										>Soal {qi + 1} opsi {String.fromCharCode(65 + oi)}</label
									>
									<input
										id={`quiz-q${qi}-o${oi}`}
										type="text"
										value={opt}
										oninput={(e) => setOption(qi, oi, e.currentTarget.value)}
										placeholder={`Opsi ${String.fromCharCode(65 + oi)}…`}
										class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 focus:outline-none"
									/>
								</div>
							{/each}
						</div>
					</fieldset>

					<div>
						<label for={`quiz-q${qi}-exp`} class="mb-1 block text-xs font-bold text-slate-700">
							Pembahasan <span class="font-normal text-slate-400">(opsional)</span>
						</label>
						<input
							id={`quiz-q${qi}-exp`}
							type="text"
							bind:value={questions[qi].explanation}
							placeholder="Kenapa jawaban itu benar?"
							class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 placeholder:text-slate-400 focus:border-amber-500 focus:outline-none"
						/>
					</div>

					<div class="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
						<p class="mb-2 text-xs font-bold text-slate-700">
							Lampiran soal <span class="font-normal text-slate-400">(opsional — foto/audio/PDF)</span>
						</p>
						{#if mediaError && mediaBusy === null}
							<p role="alert" class="mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-semibold text-red-700">
								{mediaError}
							</p>
						{/if}
						<div class="grid gap-2 sm:grid-cols-3">
							<div class="rounded-lg border border-slate-200 bg-white p-2">
								{#if q.imageUrl}
									<img src={resolveMediaSrc(q.imageUrl)} alt={`Lampiran foto soal ${qi + 1}`} class="mb-1.5 max-h-28 w-full rounded-lg object-cover" loading="lazy" />
									<button
										type="button"
										onclick={() => removeMedia(qi, 'image')}
										class="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-[11px] font-bold text-slate-500 hover:bg-red-50 hover:text-red-600 focus-visible:outline-2 focus-visible:outline-red-500"
									>
										Hapus foto
									</button>
								{:else}
									<button
										type="button"
										onclick={() => pickMedia(qi, 'image')}
										disabled={mediaBusy !== null}
										class="flex w-full flex-col items-center gap-1 rounded-lg border border-dashed border-slate-300 px-2 py-3 text-[11px] font-bold text-slate-500 hover:border-amber-400 hover:text-amber-700 focus-visible:outline-2 focus-visible:outline-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
									>
										<i class="fa-solid fa-image" aria-hidden="true"></i> Tambah foto
									</button>
								{/if}
							</div>
							<div class="rounded-lg border border-slate-200 bg-white p-2">
								{#if q.audioUrl}
									<audio src={resolveMediaSrc(q.audioUrl)} controls preload="none" class="mb-1.5 w-full" aria-label={`Lampiran audio soal ${qi + 1}`}></audio>
									<button
										type="button"
										onclick={() => removeMedia(qi, 'audio')}
										class="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-[11px] font-bold text-slate-500 hover:bg-red-50 hover:text-red-600 focus-visible:outline-2 focus-visible:outline-red-500"
									>
										Hapus audio
									</button>
								{:else}
									<button
										type="button"
										onclick={() => pickMedia(qi, 'audio')}
										disabled={mediaBusy !== null}
										class="flex w-full flex-col items-center gap-1 rounded-lg border border-dashed border-slate-300 px-2 py-3 text-[11px] font-bold text-slate-500 hover:border-amber-400 hover:text-amber-700 focus-visible:outline-2 focus-visible:outline-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
									>
										<i class="fa-solid fa-microphone" aria-hidden="true"></i> Tambah audio
									</button>
								{/if}
							</div>
							<div class="rounded-lg border border-slate-200 bg-white p-2">
								{#if q.fileUrl}
									<p class="mb-1.5 truncate text-[11px] font-bold text-slate-700" title={q.fileName ?? q.fileUrl}>
										<i class="fa-solid fa-file-pdf text-red-500" aria-hidden="true"></i>
										{q.fileName ?? 'Lampiran PDF'}
									</p>
									<button
										type="button"
										onclick={() => removeMedia(qi, 'pdf')}
										class="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-[11px] font-bold text-slate-500 hover:bg-red-50 hover:text-red-600 focus-visible:outline-2 focus-visible:outline-red-500"
									>
										Hapus file
									</button>
								{:else}
									<button
										type="button"
										onclick={() => pickMedia(qi, 'pdf')}
										disabled={mediaBusy !== null}
										class="flex w-full flex-col items-center gap-1 rounded-lg border border-dashed border-slate-300 px-2 py-3 text-[11px] font-bold text-slate-500 hover:border-amber-400 hover:text-amber-700 focus-visible:outline-2 focus-visible:outline-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
									>
										<i class="fa-solid fa-file-arrow-up" aria-hidden="true"></i> Tambah PDF
									</button>
								{/if}
							</div>
						</div>
						{#if mediaBusy === qi}
							<p role="status" class="mt-2 text-[11px] font-bold text-amber-700">
								<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i> Mengunggah…
							</p>
						{/if}
					</div>
				</div>
			</li>
		{/each}
	</ol>

	<button
		type="button"
		onclick={addQuestion}
		class="flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-amber-300 bg-amber-50/60 px-4 py-3 text-xs font-bold text-amber-700 transition-all hover:border-amber-500 hover:bg-amber-50 active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-amber-600"
	>
		<i class="fa-solid fa-plus" aria-hidden="true"></i>
		Tambah Soal {questions.length + 1}
	</button>
	<input
		type="file"
		accept={MEDIA_ACCEPT.image}
		bind:this={imageInput}
		onchange={handleMediaFile}
		class="sr-only"
		tabindex={-1}
		aria-hidden="true"
	/>
	<input
		type="file"
		accept={MEDIA_ACCEPT.audio}
		bind:this={audioInput}
		onchange={handleMediaFile}
		class="sr-only"
		tabindex={-1}
		aria-hidden="true"
	/>
	<input
		type="file"
		accept={MEDIA_ACCEPT.pdf}
		bind:this={pdfInput}
		onchange={handleMediaFile}
		class="sr-only"
		tabindex={-1}
		aria-hidden="true"
	/>
</div>
