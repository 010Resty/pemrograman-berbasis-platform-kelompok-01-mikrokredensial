<script lang="ts">
	import { browser } from '$app/environment';
	import { isServerId } from '$lib/api/courses';
	import { resolveMediaSrc } from '$lib/tiptap/extensions';
	import { BackendRequestError } from '$lib/api/backend';
	import {
		fetchQuizBest,
		fetchQuizHistory,
		fetchQuizQuestions,
		submitQuizAttempt,
		type QuizAttemptResult,
		type QuizBest
	} from '$lib/api/quiz';

	/**
	 * Kuis peserta — server-only (K-02).
	 * Soal tanpa kunci diambil dari backend, penilaian 100% server,
	 * nilai terbaik + riwayat persisten di server. Tanpa fallback lokal:
	 * kunci jawaban tidak pernah dikirim ke bundle, skor klien tidak dipercaya.
	 */

	let {
		materialId = '',
		onPass
	}: {
		materialId?: string;
		onPass?: () => void;
	} = $props();

	/* ID non-numerik = materi statis/demo: tidak ada kuis server untuk dinilai. */
	const numericId = $derived(/^\d+$/.test(materialId) ? Number(materialId) : null);
	const isSupported = $derived(browser && numericId !== null && isServerId(materialId));

	let sqLoading = $state(false);
	let sqError = $state('');
	let serverQuestions = $state<
		Array<{
			id: number;
			questionText: string;
			imageUrl: string | null;
			audioUrl: string | null;
			fileUrl: string | null;
			fileName: string | null;
			options: Array<{ id: number; optionText: string }>;
		}>
	>([]);
	let serverLoadedFor = $state<string | null>(null);
	let best = $state<QuizBest | null>(null);
	let historyCount = $state(0);
	let historyPreview = $state<Array<{ n: number; score: number; passed: boolean; attemptedAt: string }>>([]);
	let submitError = $state('');
	let serverResult = $state<QuizAttemptResult | null>(null);

	/* Ambang lulus efektif: dari server, 70 sebagai label sementara saat memuat. */
	const effectivePass = $derived(best?.effectivePassScore ?? 70);

	let answers = $state<Array<number | null>>([]);
	let sending = $state(false);

	const displayCount = $derived(serverQuestions.length);
	const order = $derived(Array.from({ length: displayCount }, (_, i) => i));

	function optionTexts(qi: number): string[] {
		return serverQuestions[qi]?.options.map((o) => o.optionText) ?? [];
	}

	/** Hanya URL berkas server yang dirender (anti-XSS walau data usang). */
	function isServerFileUrl(v: unknown): v is string {
		return typeof v === 'string' && v.startsWith('/api/v1/files/');
	}

	function questionMedia(qi: number): {
		imageUrl?: string;
		audioUrl?: string;
		fileUrl?: string;
		fileName?: string;
	} {
		const raw = serverQuestions[qi] as
			| {
					imageUrl?: unknown;
					audioUrl?: unknown;
					fileUrl?: unknown;
					fileName?: unknown;
			  }
			| undefined;
		if (!raw) return {};
		return {
			imageUrl: isServerFileUrl(raw.imageUrl) ? raw.imageUrl : undefined,
			audioUrl: isServerFileUrl(raw.audioUrl) ? raw.audioUrl : undefined,
			fileUrl: isServerFileUrl(raw.fileUrl) ? raw.fileUrl : undefined,
			fileName: typeof raw.fileName === 'string' && raw.fileName.trim() ? raw.fileName.trim() : undefined
		};
	}

	/* Reset jawaban hanya saat set soal berganti (materi/jumlah soal). */
	const questionKey = $derived(`${materialId}|${displayCount}`);
	$effect(() => {
		if (questionKey) {
			answers = Array.from({ length: displayCount }, () => null);
			sending = false;
		}
	});

	/* Muat soal + nilai terbaik server (sekali per materi). */
	$effect(() => {
		if (!isSupported || numericId === null || serverLoadedFor === materialId) return;
		serverLoadedFor = materialId;
		serverQuestions = [];
		best = null;
		historyCount = 0;
		historyPreview = [];
		serverResult = null;
		void loadServerQuiz(numericId);
	});

	function friendlyError(e: unknown, fallback: string): string {
		if (e instanceof BackendRequestError) {
			if (e.httpStatus === 401) return 'Sesi berakhir. Silakan masuk kembali lalu coba lagi.';
			if (e.httpStatus === 404) return 'Kuis tidak ditemukan di server.';
			return e.message || fallback;
		}
		return e instanceof Error ? e.message : fallback;
	}

	async function loadServerQuiz(mid: number): Promise<void> {
		sqLoading = true;
		sqError = '';
		try {
			const [quiz, bestRes] = await Promise.all([
				fetchQuizQuestions(mid),
				fetchQuizBest(mid).catch(() => null)
			]);
			serverQuestions = quiz.questions.map((q) => ({
				id: q.id,
				questionText: q.questionText,
				imageUrl: q.imageUrl,
				audioUrl: q.audioUrl,
				fileUrl: q.fileUrl,
				fileName: q.fileName,
				options: q.options.map((o) => ({ id: o.id, optionText: o.optionText }))
			}));
			if (bestRes) {
				best = bestRes;
				historyCount = bestRes.attempts;
			}
			void refreshHistory(mid);
		} catch (e) {
			const msg = friendlyError(e, 'Gagal memuat soal dari server.');
			sqError =
				e instanceof BackendRequestError && e.httpStatus === 400
					? 'Materi ini bukan kuis.'
					: msg;
		} finally {
			sqLoading = false;
		}
	}

	async function refreshHistory(mid: number): Promise<void> {
		try {
			const rows = await fetchQuizHistory(mid);
			historyCount = rows.length;
			// Server mengembalikan terbaru dulu → nomor upaya = total − indeks.
			historyPreview = rows
				.slice(0, 5)
				.map((r, i) => ({ n: rows.length - i, score: r.score, passed: r.passed, attemptedAt: r.attemptedAt }));
		} catch {
			/* riwayat best-effort; kegagalan tidak menghalangi mengerjakan */
		}
	}

	function formatAttemptDate(iso: string): string {
		const d = new Date(iso);
		if (Number.isNaN(d.getTime())) return '';
		return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
	}

	const answeredCount = $derived(answers.filter((a) => a !== null).length);
	const complete = $derived(answeredCount >= displayCount && displayCount > 0);

	function select(qi: number, oi: number) {
		if (sending) return;
		const next = [...answers];
		next[qi] = oi;
		answers = next;
	}

	/** Kirim jawaban — hanya server yang menilai; onPass hanya dari hasil server. */
	async function submit() {
		if (!complete || sending || numericId === null) return;
		sending = true;
		submitError = '';
		try {
			const payload = serverQuestions.map((q, qi) => ({
				questionId: q.id,
				optionId: answers[qi] === null ? null : (q.options[answers[qi] ?? -1]?.id ?? null)
			}));
			const res = await submitQuizAttempt(numericId, payload);
			serverResult = res;
			best = {
				materialId: res.materialId,
				attempts: res.attempts,
				bestScore: res.bestScore,
				effectivePassScore: res.passScore,
				passed: res.overallPassed
			};
			historyCount = res.attempts;
			historyPreview = [
				{ n: res.attempts, score: res.score, passed: res.passed, attemptedAt: new Date().toISOString() },
				...historyPreview
			].slice(0, 5);
			if (res.passed) onPass?.();
			/* Tetap di halaman: hasil tampil inline di bawah (tanpa navigasi). */
		} catch (e) {
			submitError = friendlyError(e, 'Gagal mengirim jawaban.');
		} finally {
			sending = false;
		}
	}
</script>

<div class="space-y-5">
	{#if !isSupported}
		<div class="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
			<i class="fa-solid fa-circle-question mb-2 text-xl text-slate-300" aria-hidden="true"></i>
			<p class="text-sm font-bold text-slate-500">Kuis tidak tersedia</p>
			<p class="mt-1 text-xs text-slate-400">
				Kuis hanya dapat dikerjakan pada materi server. Materi pratinjau ini tidak memiliki bank soal.
			</p>
		</div>
	{:else}
	<p
		role="status"
		class="flex items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-bold text-amber-800"
	>
		<i class="fa-solid fa-award" aria-hidden="true"></i>
		Nilai minimal {effectivePass} untuk lolos
		{#if best !== null && best.attempts > 0}
			<span class="font-semibold text-amber-700">
				· Terbaik {best.bestScore ?? 0} dari {best.attempts} percobaan{best.passed ? ' · Lulus' : ''}
			</span>
		{/if}
	</p>

	{#if sqLoading}
		<div
			class="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white p-10 text-sm font-semibold text-slate-500"
			role="status"
			aria-label="Memuat soal kuis"
		>
			<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i> Memuat soal dari server…
		</div>
	{:else if sqError}
		<div class="rounded-2xl border border-red-200 bg-red-50 p-8 text-center" role="alert">
			<i class="fa-solid fa-triangle-exclamation mb-2 text-xl text-red-300" aria-hidden="true"></i>
			<p class="text-sm font-bold text-red-800">Gagal memuat kuis</p>
			<p class="mx-auto mt-1 max-w-md text-xs text-red-600">{sqError}</p>
			<button
				type="button"
				onclick={() => numericId !== null && void loadServerQuiz(numericId)}
				class="mt-3 inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-red-600"
			>
				<i class="fa-solid fa-rotate-right" aria-hidden="true"></i> Coba lagi
			</button>
		</div>
	{:else if displayCount === 0}
		<div class="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
			<i class="fa-solid fa-circle-question mb-2 text-xl text-slate-300" aria-hidden="true"></i>
			<p class="text-sm font-bold text-slate-500">Belum ada soal</p>
			<p class="mt-1 text-xs text-slate-400">Kuis ini belum memiliki soal untuk dikerjakan.</p>
		</div>
	{:else}
		<ol class="space-y-4">
			{#each order as qi (qi)}
				{@const opts = optionTexts(qi)}
				{@const media = questionMedia(qi)}
				{@const q = serverQuestions[qi]}
				<li class="rounded-2xl border border-slate-200 bg-white p-5">
					<fieldset>
						<legend class="contents">
							<span class="mb-3 block text-sm font-bold text-slate-900">
								<span class="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-lg bg-blue-600 text-[11px] font-extrabold text-white" aria-hidden="true">
									{qi + 1}
								</span>
								{q?.questionText ?? ''}
							</span>
						</legend>
						{#if media.imageUrl}
							<img
								src={resolveMediaSrc(media.imageUrl)}
								alt={`Gambar pendukung soal ${qi + 1}`}
								class="mb-3 max-h-72 w-full rounded-xl border border-slate-200 object-contain bg-slate-50"
								loading="lazy"
							/>
						{/if}
						{#if media.audioUrl}
							<audio
								src={resolveMediaSrc(media.audioUrl)}
								controls
								preload="none"
								class="mb-3 w-full"
								aria-label={`Audio pendukung soal ${qi + 1}`}
							></audio>
						{/if}
						{#if media.fileUrl}
							<a
								href={resolveMediaSrc(media.fileUrl)}
								target="_blank"
								rel="noopener"
								class="mb-3 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-700 hover:border-blue-300 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
							>
								<i class="fa-solid fa-file-pdf text-red-500" aria-hidden="true"></i>
								<span class="flex-1 truncate">{media.fileName ?? 'Unduh lampiran soal'}</span>
								<i class="fa-solid fa-arrow-up-right-from-square text-[10px] text-slate-400" aria-hidden="true"></i>
							</a>
						{/if}
						<div class="space-y-2" role="radiogroup" aria-label={`Pilihan jawaban soal ${qi + 1}`}>
							{#each opts as opt, oi (oi)}
								{@const selected = answers[qi] === oi}
								<button
									type="button"
									role="radio"
									aria-checked={selected}
									disabled={sending}
									onclick={() => select(qi, oi)}
									class={`flex w-full items-center gap-3 rounded-xl border px-4 py-2.5 text-left text-sm transition-all focus-visible:outline-2 focus-visible:outline-blue-600 ${
										selected
											? 'border-blue-600 bg-blue-50 font-semibold text-blue-800'
											: 'border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50/50'
									}`}
								>
									<span
										class={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-bold ${
											selected
												? 'border-blue-600 bg-blue-600 text-white'
												: 'border-slate-300 text-transparent'
										}`}
										aria-hidden="true"
									>
										{String.fromCharCode(65 + oi)}
									</span>
									<span class="flex-1">{opt}</span>
								</button>
							{/each}
						</div>
					</fieldset>
				</li>
			{/each}
		</ol>

		{#if submitError}
			<p
				role="alert"
				class="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700"
			>
				<i class="fa-solid fa-circle-exclamation mt-0.5 shrink-0" aria-hidden="true"></i> {submitError}
			</p>
		{/if}

		<button
			type="button"
			onclick={submit}
			disabled={!complete || sending || sqLoading}
			class="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/25 transition-all hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
		>
			{#if sending}
				<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i> Mengirim…
			{:else}
				<i class="fa-solid fa-paper-plane" aria-hidden="true"></i>
				Kirim Jawaban ({answeredCount}/{displayCount})
			{/if}
		</button>
		<p class="text-center text-[11px] text-slate-500">
			Nilai minimal {effectivePass} untuk lolos. Dapat diulang tanpa batas — nilai terbaik yang dipakai.
			Hasil hanya berupa nilai — tanpa pembahasan jawaban.
		</p>

		{#if serverResult}
			<section
				aria-label="Hasil percobaan terakhir"
				role="status"
				class={`rounded-2xl border bg-white p-5 text-center ${serverResult.passed ? 'border-emerald-200' : 'border-amber-200'}`}
			>
				<p class={`mx-auto flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-lg ${serverResult.passed ? 'bg-emerald-600 shadow-emerald-600/25' : 'bg-amber-500 shadow-amber-500/25'}`} aria-hidden="true">
					<i class={`fa-solid ${serverResult.passed ? 'fa-trophy' : 'fa-rotate-right'} text-xl`}></i>
				</p>
				<h2 class="mt-3 text-lg font-extrabold text-slate-900">
					{serverResult.passed ? 'Lulus!' : 'Belum Lulus'}
				</h2>
				<p class={`mt-1 text-5xl font-black tracking-tight ${serverResult.passed ? 'text-emerald-600' : 'text-amber-500'}`}>
					{serverResult.score}
				</p>
				<p class="mt-1 text-xs font-bold text-slate-600">
					Benar {serverResult.correct ?? 0} dari {serverResult.total ?? displayCount} soal · minimal {serverResult.passScore} untuk lolos
				</p>
				<button
					type="button"
					onclick={() => (serverResult = null)}
					class="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-slate-500"
				>
					<i class="fa-solid fa-pen-to-square" aria-hidden="true"></i> Ubah jawaban & kirim ulang
				</button>
			</section>
		{/if}

		{#if historyPreview.length > 0}
			<section aria-label="Riwayat percobaan" class="rounded-2xl border border-slate-200 bg-white p-5">
				<h2 class="text-xs font-extrabold tracking-widest text-slate-500 uppercase">
					Riwayat percobaanmu
				</h2>
				<ol class="mt-3 space-y-2">
					{#each historyPreview as h (h.n)}
						<li class="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3.5 py-2 text-xs">
							<span class="font-bold text-slate-700">
								Upaya ke-{h.n}
								<span class="font-semibold text-slate-400">· {formatAttemptDate(h.attemptedAt)}</span>
							</span>
							<span class={`shrink-0 rounded-full px-2 py-0.5 font-extrabold ${h.passed ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>
								{h.score} · {h.passed ? 'Lulus' : 'Belum lulus'}
							</span>
						</li>
					{/each}
				</ol>
				{#if historyCount > historyPreview.length}
					<p class="mt-2 text-[11px] text-slate-400">+ {historyCount - historyPreview.length} percobaan sebelumnya tersimpan di server.</p>
				{/if}
			</section>
		{/if}
	{/if}
	{/if}
</div>
