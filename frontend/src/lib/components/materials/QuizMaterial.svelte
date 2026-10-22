<script lang="ts">
	import { goto } from '$app/navigation';
	import type { QuizQuestion } from '$lib/data/material-details';
	import { saveQuizResult } from '$lib/stores/quiz-results.svelte';

	let {
		questions,
		intro,
		materialId = '',
		courseId = '',
		moduleId = '',
		onPass
	}: {
		questions: QuizQuestion[];
		intro?: string;
		materialId?: string;
		courseId?: string;
		moduleId?: string;
		onPass?: () => void;
	} = $props();

	const PASS_SCORE = 70;

	let answers = $state<Array<number | null>>([]);
	let sending = $state(false);

	// Reset saat set soal berganti (navigasi antar materi kuis)
	$effect(() => {
		answers = questions.map(() => null);
		sending = false;
	});

	const answeredCount = $derived(answers.filter((a) => a !== null).length);
	const complete = $derived(answeredCount >= questions.length && questions.length > 0);

	function select(qi: number, oi: number) {
		if (sending) return;
		const next = [...answers];
		next[qi] = oi;
		answers = next;
	}

	/** Kumpulkan jawaban → simpan nilai lalu buka halaman hasil (tanpa bocoran benar/salah di sini). */
	async function submit() {
		if (!complete || sending || !materialId) return;
		sending = true;
		const correct = questions.filter((q, i) => answers[i] === q.answer).length;
		const score =
			questions.length === 0 ? 0 : Math.round((correct / questions.length) * 100);
		const passed = score >= PASS_SCORE;
		saveQuizResult({
			materialId,
			courseId,
			moduleId,
			materialTitle: '',
			total: questions.length,
			correct,
			score,
			passed,
			createdAt: new Date().toISOString()
		});
		if (passed) onPass?.();
		await goto(`/user/kursusku/${courseId}/${moduleId}/${materialId}/hasil`);
	}
</script>

<div class="space-y-5">
	{#if intro}
		<p class="text-sm leading-relaxed text-slate-600 sm:text-[15px]">{intro}</p>
	{/if}

	<ol class="space-y-4">
		{#each questions as q, qi (q.question)}
			<li class="rounded-2xl border border-slate-200 bg-white p-5">
				<fieldset>
					<legend class="contents">
						<span class="mb-3 block text-sm font-bold text-slate-900">
							<span class="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-lg bg-slate-900 text-[11px] font-extrabold text-white" aria-hidden="true">
								{qi + 1}
							</span>
							{q.question}
						</span>
					</legend>
					<div class="space-y-2" role="radiogroup" aria-label={`Pilihan jawaban soal ${qi + 1}`}>
						{#each q.options as opt, oi (opt)}
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

	<button
		type="button"
		onclick={submit}
		disabled={!complete || sending}
		class="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/25 transition-all hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
	>
		{#if sending}
			<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i> Mengirim…
		{:else}
			<i class="fa-solid fa-paper-plane" aria-hidden="true"></i>
			Lihat Hasil ({answeredCount}/{questions.length})
		{/if}
	</button>
	<p class="text-center text-[11px] text-slate-500">
		Nilai minimal {PASS_SCORE} untuk lolos. Hasil hanya berupa nilai — tanpa pembahasan jawaban.
	</p>
</div>
