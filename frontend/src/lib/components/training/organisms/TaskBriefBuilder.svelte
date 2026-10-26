<script lang="ts">
	import type { JSONContent } from '@tiptap/core';
	import type { TaskDraft } from '$lib/stores/task-drafts';
	import { validateTaskDraft } from '$lib/stores/task-drafts';
	import MaterialEditor from '$lib/components/training/organisms/MaterialEditor.svelte';

	/**
	 * Pembuat penugasan instruktur dalam 3 bagian wajib:
	 * 1. Deskripsi penugasan, 2. Tujuan penugasan, 3. Langkah pengerjaan.
	 * Murni permukaan sunting — penyimpanan ditangani halaman via `onupdate`.
	 */
	let {
		draftKey,
		initial = null,
		onupdate = () => {}
	}: {
		draftKey: string;
		initial?: TaskDraft | null;
		onupdate?: (info: { draft: TaskDraft; valid: boolean; count: number }) => void;
	} = $props();

	let brief = $state<JSONContent | null>(null);
	let briefWords = $state(0);
	let objectives = $state<string[]>(['']);
	let steps = $state<string[]>(['', '', '', '']);
	let loadedFor = $state<string | null>(null);

	/* Muat draf sekali per materi. */
	$effect(() => {
		if (loadedFor === draftKey) return;
		const src = initial;
		brief = src?.brief ?? null;
		briefWords = 0;
		objectives = src && src.objectives.length > 0 ? [...src.objectives] : [''];
		steps = src && src.steps.length > 0 ? [...src.steps] : ['', '', '', ''];
		loadedFor = draftKey;
	});

	function handleBrief(info: { json: JSONContent; words: number }) {
		brief = info.json;
		briefWords = info.words;
	}

	/* Laporkan draf ke induk setiap berubah. */
	$effect(() => {
		if (loadedFor !== draftKey) return;
		// Baca state reaktif agar efek berlangganan: kata deskripsi + isi daftar.
		const words = briefWords;
		const objs = [...objectives];
		const stps = [...steps];
		void words;
		const draft: TaskDraft = {
			title: '',
			brief,
			objectives: objs,
			steps: stps,
			updatedAt: ''
		};
		const filled =
			objs.filter((o) => o.trim()).length + stps.filter((s) => s.trim()).length;
		onupdate({
			draft,
			valid: validateTaskDraft({ ...draft, title: 'x' }) === null,
			count: filled
		});
	});

	function setObjective(i: number, v: string) {
		objectives = objectives.map((o, x) => (x === i ? v : o));
	}

	function addObjective() {
		objectives = [...objectives, ''];
	}

	function removeObjective(i: number) {
		if (objectives.length <= 1) return;
		objectives = objectives.filter((_, x) => x !== i);
	}

	function setStep(i: number, v: string) {
		steps = steps.map((s, x) => (x === i ? v : s));
	}

	function addStep() {
		steps = [...steps, ''];
	}

	function removeStep(i: number) {
		if (steps.length <= 1) return;
		steps = steps.filter((_, x) => x !== i);
	}

	function moveStep(i: number, dir: -1 | 1) {
		const t = i + dir;
		if (t < 0 || t >= steps.length) return;
		const next = [...steps];
		[next[i], next[t]] = [next[t], next[i]];
		steps = next;
	}
</script>

<div class="space-y-4">
	<!-- Bagian 1: Deskripsi penugasan -->
	<section
		aria-labelledby="task-brief-heading"
		class="overflow-hidden rounded-2xl border border-slate-200/80 bg-white"
	>
		<div class="flex items-center gap-2.5 border-b border-slate-100 bg-slate-50/70 px-4 py-3 sm:px-5">
			<span
				class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-600 text-xs font-extrabold text-white"
				aria-hidden="true"
			>
				1
			</span>
			<div>
				<h3 id="task-brief-heading" class="text-sm font-extrabold text-slate-900">
					Deskripsi Penugasan
				</h3>
				<p class="text-[11px] text-slate-500">
					Penjelasan singkat tugas — boleh disisipi gambar, video, audio, atau file PDF.
				</p>
			</div>
		</div>
		<div class="p-4 sm:p-5">
			<MaterialEditor
				docKey={`${draftKey}:brief`}
				initialContent={initial?.brief ?? null}
				variant="full"
				onupdate={handleBrief}
			/>
		</div>
	</section>

	<!-- Bagian 2: Tujuan penugasan -->
	<section
		aria-labelledby="task-goals-heading"
		class="overflow-hidden rounded-2xl border border-slate-200/80 bg-white"
	>
		<div class="flex items-center gap-2.5 border-b border-slate-100 bg-slate-50/70 px-4 py-3 sm:px-5">
			<span
				class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-600 text-xs font-extrabold text-white"
				aria-hidden="true"
			>
				2
			</span>
			<div>
				<h3 id="task-goals-heading" class="text-sm font-extrabold text-slate-900">
					Tujuan Penugasan
				</h3>
				<p class="text-[11px] text-slate-500">Daftar kompetensi yang ingin dicapai.</p>
			</div>
		</div>
		<div class="space-y-2 p-4 sm:p-5">
			<ol class="space-y-2" aria-label="Daftar tujuan penugasan">
				{#each objectives as obj, oi (oi)}
					<li class="flex items-center gap-2">
						<span
							class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-[11px] font-extrabold text-emerald-700"
							aria-hidden="true"
						>
							<i class="fa-solid fa-bullseye text-[10px]"></i>
						</span>
						<label for={`task-obj-${oi}`} class="sr-only">Tujuan {oi + 1}</label>
						<input
							id={`task-obj-${oi}`}
							type="text"
							value={obj}
							oninput={(e) => setObjective(oi, e.currentTarget.value)}
							placeholder={`Kompetensi ${oi + 1}…`}
							class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 focus:outline-none"
						/>
						<button
							type="button"
							onclick={() => removeObjective(oi)}
							disabled={objectives.length <= 1}
							aria-label={`Hapus tujuan ${oi + 1}`}
							class="flex min-h-9 min-w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 transition-all hover:border-red-300 hover:bg-red-50 hover:text-red-600 focus-visible:outline-2 focus-visible:outline-red-500 disabled:cursor-not-allowed disabled:opacity-35"
						>
							<i class="fa-solid fa-trash text-[11px]" aria-hidden="true"></i>
						</button>
					</li>
				{/each}
			</ol>
			<button
				type="button"
				onclick={addObjective}
				class="flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-2 text-xs font-bold text-slate-600 transition-all hover:border-violet-400 hover:bg-violet-50/50 hover:text-violet-700 focus-visible:outline-2 focus-visible:outline-violet-600"
			>
				<i class="fa-solid fa-plus" aria-hidden="true"></i>
				Tambah Tujuan
			</button>
		</div>
	</section>

	<!-- Bagian 3: Langkah pengerjaan -->
	<section
		aria-labelledby="task-steps-heading"
		class="overflow-hidden rounded-2xl border border-slate-200/80 bg-white"
	>
		<div class="flex items-center gap-2.5 border-b border-slate-100 bg-slate-50/70 px-4 py-3 sm:px-5">
			<span
				class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-600 text-xs font-extrabold text-white"
				aria-hidden="true"
			>
				3
			</span>
			<div>
				<h3 id="task-steps-heading" class="text-sm font-extrabold text-slate-900">
					Langkah Pengerjaan
				</h3>
				<p class="text-[11px] text-slate-500">Instruksi berurutan — boleh kurang atau lebih dari 4.</p>
			</div>
		</div>
		<div class="space-y-2 p-4 sm:p-5">
			<ol
				class="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white focus-within:border-violet-300"
				aria-label="Daftar langkah pengerjaan"
			>
				{#each steps as step, si (si)}
					<li class="flex items-center gap-1.5 px-2.5 py-1.5 transition-colors focus-within:bg-violet-50/40">
						<span class="shrink-0 pl-1 text-sm font-extrabold text-slate-800" aria-hidden="true">
							{si + 1}.
						</span>
						<label for={`task-step-${si}`} class="sr-only">Langkah {si + 1}</label>
						<input
							id={`task-step-${si}`}
							type="text"
							value={step}
							oninput={(e) => setStep(si, e.currentTarget.value)}
							placeholder={`Langkah ${si + 1}…`}
							class="w-full min-w-0 flex-1 bg-transparent py-1.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
						/>
						<span class="flex shrink-0 items-center" role="group" aria-label={`Aksi langkah ${si + 1}`}>
							<button
								type="button"
								onclick={() => moveStep(si, -1)}
								disabled={si === 0}
								aria-label={`Pindah langkah ${si + 1} ke atas`}
								class="hidden min-h-9 min-w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-violet-600 disabled:cursor-not-allowed disabled:opacity-35 sm:flex"
							>
								<i class="fa-solid fa-arrow-up text-[11px]" aria-hidden="true"></i>
							</button>
							<button
								type="button"
								onclick={() => moveStep(si, 1)}
								disabled={si === steps.length - 1}
								aria-label={`Pindah langkah ${si + 1} ke bawah`}
								class="hidden min-h-9 min-w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-violet-600 disabled:cursor-not-allowed disabled:opacity-35 sm:flex"
							>
								<i class="fa-solid fa-arrow-down text-[11px]" aria-hidden="true"></i>
							</button>
							<button
								type="button"
								onclick={() => removeStep(si)}
								disabled={steps.length <= 1}
								aria-label={`Hapus langkah ${si + 1}`}
								class="flex min-h-9 min-w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:outline-2 focus-visible:outline-red-500 disabled:cursor-not-allowed disabled:opacity-35"
							>
								<i class="fa-solid fa-trash text-[11px]" aria-hidden="true"></i>
							</button>
						</span>
					</li>
				{/each}
			</ol>
			<button
				type="button"
				onclick={addStep}
				class="flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-2 text-xs font-bold text-slate-600 transition-all hover:border-violet-400 hover:bg-violet-50/50 hover:text-violet-700 focus-visible:outline-2 focus-visible:outline-violet-600"
			>
				<i class="fa-solid fa-plus" aria-hidden="true"></i>
				Tambah Langkah {steps.length + 1}
			</button>
		</div>
	</section>
</div>
