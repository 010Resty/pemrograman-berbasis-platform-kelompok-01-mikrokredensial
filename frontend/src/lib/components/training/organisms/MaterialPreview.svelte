<script lang="ts">
	import type { JSONContent } from '@tiptap/core';
	import { generateHTML } from '@tiptap/html';
	import '$lib/tiptap/content.css';
	import { createEditorExtensions } from '$lib/tiptap/extensions';

	/**
	 * Pratinjau dokumen materi persis seperti dilihat peserta:
	 * HTML dirender dari JSON Tiptap memakai ekstensi yang sama dengan editor.
	 */
	let {
		content,
		title
	}: {
		content: JSONContent | null;
		title: string;
	} = $props();

	// Singleton ekstensi: createEditorExtensions() mahal (StarterKit+Image+Link+Video+Audio+PDF).
	// Dibuat sekali, bukan tiap keystroke/re-render.
	let cachedExtensions: ReturnType<typeof createEditorExtensions> | null = null;
	function getExtensions(): ReturnType<typeof createEditorExtensions> {
		if (!cachedExtensions) cachedExtensions = createEditorExtensions('');
		return cachedExtensions;
	}

	const html = $derived.by(() => {
		if (!content) return '';
		try {
			return generateHTML(content, getExtensions());
		} catch {
			return '';
		}
	});

	const isEmpty = $derived.by(() => {
		if (!content?.content || content.content.length === 0) return true;
		return content.content.every((node) => {
			if (node.type !== 'paragraph') return false;
			if (!node.content || node.content.length === 0) return true;
			return node.content.every((child) => !child.text?.trim());
		});
	});
</script>

<article aria-label="Pratinjau materi bagi peserta" class="overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
	<div class="border-b border-slate-100 bg-slate-50/70 px-5 py-4 sm:px-7">
		<p class="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-[10px] font-extrabold tracking-widest text-blue-700 uppercase ring-1 ring-blue-200">
			<i class="fa-solid fa-eye" aria-hidden="true"></i> Tampilan peserta
		</p>
		<h2 class="mt-2 text-lg leading-snug font-extrabold text-slate-900 sm:text-xl">
			{title || '(belum berjudul)'}
		</h2>
	</div>
	<div class="px-5 py-5 sm:px-7 sm:py-6">
		{#if isEmpty}
			<div class="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
				<i class="fa-solid fa-pen-nib mb-2 text-xl text-slate-300" aria-hidden="true"></i>
				<p class="text-sm font-bold text-slate-500">Dokumen masih kosong</p>
				<p class="mt-1 text-xs text-slate-400">
					Beralih ke tab Tulis untuk mulai menyusun materi.
				</p>
			</div>
		{:else}
			<div class="mdoc">{@html html}</div>
		{/if}
	</div>
</article>
