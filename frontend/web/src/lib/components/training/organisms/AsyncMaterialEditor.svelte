<script module lang="ts">
	// Chunk Tiptap (~200-300KB) hanya diunduh bila editor benar-benar
	// dirender. Import statis di sini akan menyeretnya ke chunk halaman.
	const editorPromise = import('$lib/components/training/organisms/MaterialEditor.svelte');
</script>

<script lang="ts">
	import type { JSONContent } from '@tiptap/core';

	let {
		docKey,
		initialContent = null,
		variant = 'full',
		onupdate = () => {}
	}: {
		docKey: string;
		initialContent?: JSONContent | null;
		variant?: 'full' | 'text-only';
		onupdate?: (info: { json: JSONContent; words: number }) => void;
	} = $props();
</script>

{#await editorPromise then { default: MaterialEditor }}
	<MaterialEditor {docKey} {initialContent} {variant} {onupdate} />
{:catch}
	<p role="alert" class="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700">
		Editor gagal dimuat. Muat ulang halaman untuk mencoba lagi.
	</p>
{/await}
