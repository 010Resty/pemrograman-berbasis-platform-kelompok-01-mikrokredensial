<script lang="ts">
	import { browser } from '$app/environment';
	import { Editor } from '@tiptap/core';
	import type { JSONContent } from '@tiptap/core';
	import '$lib/tiptap/content.css';
	import { createEditorExtensions, toEmbedUrl } from '$lib/tiptap/extensions';
	import { formatFileSize, readFileAsDataUrl } from '$lib/stores/material-docs';

	/**
	 * Editor dokumen materi (Tiptap, gaya Word/Docs): heading, paragraf,
	 * bold/italic/underline, daftar, tautan, gambar, video, blok kode, lampiran PDF.
	 * Murni permukaan sunting — penyimpanan ditangani halaman via `onupdate`.
	 */
	let {
		docKey,
		initialContent = null,
		onupdate = (_info: { json: JSONContent; words: number }) => {}
	}: {
		docKey: string;
		initialContent?: JSONContent | null;
		onupdate?: (info: { json: JSONContent; words: number }) => void;
	} = $props();

	let element = $state<HTMLDivElement>();
	let editor = $state<Editor | null>(null);
	/** Bila true, Tiptap gagal diinisialisasi — tampilkan pemulihan, bukan toolbar mati. */
	let editorFailed = $state(false);
	/** Dipakai tombol "Muat ulang editor" untuk mencoba inisialisasi ulang. */
	let retryCount = $state(0);
	/** Penghitung perubahan agar status aktif toolbar selalu segar. */
	let tick = $state(0);
	let words = $state(0);

	type DialogKind = 'link' | 'image' | 'video' | 'pdf';
	let dialog = $state<DialogKind | null>(null);
	let urlValue = $state('');
	let dialogError = $state('');
	let dialogInput = $state<HTMLInputElement>();

	/* Fokus otomatis ke kolom URL saat dialog dibuka (pengganti autofocus). */
	$effect(() => {
		if (dialog) dialogInput?.focus();
	});

	const CODE_LANGUAGES = [
		{ value: 'plaintext', label: 'Teks biasa' },
		{ value: 'html', label: 'HTML' },
		{ value: 'css', label: 'CSS' },
		{ value: 'javascript', label: 'JavaScript' },
		{ value: 'typescript', label: 'TypeScript' },
		{ value: 'python', label: 'Python' },
		{ value: 'java', label: 'Java' },
		{ value: 'php', label: 'PHP' },
		{ value: 'sql', label: 'SQL' },
		{ value: 'bash', label: 'Bash' }
	];

	function emit(e: Editor) {
		const text = e.getText().trim();
		words = text ? text.split(/\s+/).length : 0;
		onupdate({ json: e.getJSON(), words });
	}

	$effect(() => {
		// Dibuat ulang setiap ganti dokumen (navigasi antar materi).
		const key = docKey;
		const content = initialContent;
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		void retryCount;
		void key;
		if (!browser || !element) return;
		let ed: Editor | null = null;
		try {
			ed = new Editor({
				element,
				extensions: createEditorExtensions(
					'Tulis isi materi di sini — heading, daftar, kutipan, kode…'
				),
				content: content ?? { type: 'doc', content: [{ type: 'paragraph' }] },
				editorProps: {
					attributes: {
						class: 'mdoc',
						'aria-label': 'Isi dokumen materi'
					}
				},
				onUpdate: ({ editor: e }) => {
					tick++;
					emit(e);
				},
				onSelectionUpdate: () => {
					tick++;
				}
			});
		} catch {
			editorFailed = true;
			return;
		}
		editorFailed = false;
		editor = ed;
		emit(ed);
		return () => {
			ed.destroy();
			if (editor === ed) editor = null;
		};
	});

	function isActive(name: string | Record<string, unknown>, attrs: Record<string, unknown> = {}): boolean {
		void tick;
		if (!editor) return false;
		return typeof name === 'string' ? editor.isActive(name, attrs) : editor.isActive(name);
	}

	function canRun(fn: () => boolean): boolean {
		if (!editor) return false;
		try {
			return fn();
		} catch {
			return false;
		}
	}

	const btnBase =
		'flex min-h-10 min-w-10 items-center justify-center rounded-lg px-2 text-sm transition-all focus-visible:outline-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-35';
	const btnTone = (on: boolean) =>
		on
			? 'bg-slate-900 text-white shadow-md'
			: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900';

	function openDialog(kind: DialogKind) {
		dialogError = '';
		urlValue = '';
		if (kind === 'link') {
			urlValue = editor?.getAttributes('link').href ?? '';
		}
		dialog = kind;
	}

	function closeDialog() {
		dialog = null;
		urlValue = '';
		dialogError = '';
	}

	function validHttpUrl(raw: string): boolean {
		return /^(https?:\/\/|mailto:)/i.test(raw.trim());
	}

	function applyLink() {
		if (!editor) return;
		const value = urlValue.trim();
		if (value !== '' && !validHttpUrl(value)) {
			dialogError = 'Tautan harus diawali http://, https://, atau mailto:.';
			return;
		}
		if (value === '') {
			editor.chain().focus().extendMarkRange('link').unsetLink().run();
		} else {
			editor.chain().focus().extendMarkRange('link').setLink({ href: value }).run();
		}
		tick++;
		closeDialog();
	}

	function applyImageUrl() {
		if (!editor) return;
		const value = urlValue.trim();
		if (!validHttpUrl(value)) {
			dialogError = 'URL gambar harus diawali http:// atau https://.';
			return;
		}
		editor.chain().focus().setImage({ src: value }).run();
		tick++;
		closeDialog();
	}

	function applyVideoUrl() {
		if (!editor) return;
		const value = urlValue.trim();
		if (!validHttpUrl(value)) {
			dialogError = 'URL video harus diawali http:// atau https:// (YouTube, Vimeo, atau MP4).';
			return;
		}
		editor.chain().focus().insertVideo({ src: toEmbedUrl(value) }).run();
		tick++;
		closeDialog();
	}

	async function handleImageFile(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file || !editor) return;
		if (!file.type.startsWith('image/')) {
			dialogError = 'Berkas harus berupa gambar (JPG/PNG/WebP/GIF).';
			return;
		}
		if (file.size > 4 * 1024 * 1024) {
			dialogError = 'Ukuran gambar maksimal 4 MB agar draf lokal tetap tersimpan.';
			return;
		}
		try {
			const dataUrl = await readFileAsDataUrl(file);
			editor.chain().focus().setImage({ src: dataUrl, alt: file.name }).run();
			tick++;
			closeDialog();
		} catch {
			dialogError = 'Gagal membaca berkas gambar.';
		}
	}

	async function handlePdfFile(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file || !editor) return;
		if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
			dialogError = 'Berkas harus berupa PDF.';
			return;
		}
		if (file.size > 8 * 1024 * 1024) {
			dialogError = 'Ukuran PDF maksimal 8 MB agar draf lokal tetap tersimpan.';
			return;
		}
		try {
			const dataUrl = await readFileAsDataUrl(file);
			editor
				.chain()
				.focus()
				.insertPdf({ name: file.name, url: dataUrl, size: formatFileSize(file.size) })
				.run();
			tick++;
			closeDialog();
		} catch {
			dialogError = 'Gagal membaca berkas PDF.';
		}
	}

	function dialogKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			event.preventDefault();
			closeDialog();
		} else if (event.key === 'Enter' && dialog !== 'pdf') {
			event.preventDefault();
			if (dialog === 'link') applyLink();
			else if (dialog === 'image') applyImageUrl();
			else if (dialog === 'video') applyVideoUrl();
		}
	}

	const currentCodeLang = $derived(
		String(editor?.getAttributes('codeBlock').language ?? 'plaintext')
	);
	const inCodeBlock = $derived(isActive('codeBlock'));
</script>

<div class="overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
	<!-- Toolbar ala Word/Docs -->
	<div
		role="toolbar"
		aria-label="Format dokumen materi"
		class="flex flex-wrap items-center gap-1 overflow-x-auto border-b border-slate-200 bg-slate-50/80 p-2"
	>
		<span class="flex items-center gap-1" role="group" aria-label="Riwayat">
			<button
				type="button"
				title="Urungkan (Ctrl+Z)"
				aria-label="Urungkan"
				disabled={!canRun(() => editor!.can().chain().focus().undo().run())}
				onclick={() => editor?.chain().focus().undo().run()}
				class="{btnBase} {btnTone(false)}"
			>
				<i class="fa-solid fa-rotate-left" aria-hidden="true"></i>
			</button>
			<button
				type="button"
				title="Ulangi (Ctrl+Y)"
				aria-label="Ulangi"
				disabled={!canRun(() => editor!.can().chain().focus().redo().run())}
				onclick={() => editor?.chain().focus().redo().run()}
				class="{btnBase} {btnTone(false)}"
			>
				<i class="fa-solid fa-rotate-right" aria-hidden="true"></i>
			</button>
		</span>
		<span class="h-6 w-px shrink-0 bg-slate-300" aria-hidden="true"></span>

		<span class="flex items-center gap-1" role="group" aria-label="Gaya blok">
			<button
				type="button"
				title="Judul 1"
				aria-label="Judul 1"
				aria-pressed={isActive('heading', { level: 1 })}
				disabled={!editor}
				onclick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
				class="{btnBase} px-2.5 text-xs font-extrabold {btnTone(isActive('heading', { level: 1 }))}"
			>
				H1
			</button>
			<button
				type="button"
				title="Judul 2"
				aria-label="Judul 2"
				aria-pressed={isActive('heading', { level: 2 })}
				disabled={!editor}
				onclick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
				class="{btnBase} px-2.5 text-xs font-extrabold {btnTone(isActive('heading', { level: 2 }))}"
			>
				H2
			</button>
			<button
				type="button"
				title="Judul 3"
				aria-label="Judul 3"
				aria-pressed={isActive('heading', { level: 3 })}
				disabled={!editor}
				onclick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
				class="{btnBase} px-2.5 text-xs font-extrabold {btnTone(isActive('heading', { level: 3 }))}"
			>
				H3
			</button>
			<button
				type="button"
				title="Paragraf biasa"
				aria-label="Paragraf biasa"
				aria-pressed={isActive('paragraph')}
				disabled={!editor}
				onclick={() => editor?.chain().focus().setParagraph().run()}
				class="{btnBase} {btnTone(isActive('paragraph'))}"
			>
				<i class="fa-solid fa-paragraph" aria-hidden="true"></i>
			</button>
		</span>
		<span class="h-6 w-px shrink-0 bg-slate-300" aria-hidden="true"></span>

		<span class="flex items-center gap-1" role="group" aria-label="Format huruf">
			<button
				type="button"
				title="Tebal (Ctrl+B)"
				aria-label="Tebal"
				aria-pressed={isActive('bold')}
				disabled={!canRun(() => editor!.can().chain().focus().toggleBold().run())}
				onclick={() => editor?.chain().focus().toggleBold().run()}
				class="{btnBase} {btnTone(isActive('bold'))}"
			>
				<i class="fa-solid fa-bold" aria-hidden="true"></i>
			</button>
			<button
				type="button"
				title="Miring (Ctrl+I)"
				aria-label="Miring"
				aria-pressed={isActive('italic')}
				disabled={!canRun(() => editor!.can().chain().focus().toggleItalic().run())}
				onclick={() => editor?.chain().focus().toggleItalic().run()}
				class="{btnBase} {btnTone(isActive('italic'))}"
			>
				<i class="fa-solid fa-italic" aria-hidden="true"></i>
			</button>
			<button
				type="button"
				title="Garis bawah (Ctrl+U)"
				aria-label="Garis bawah"
				aria-pressed={isActive('underline')}
				disabled={!canRun(() => editor!.can().chain().focus().toggleUnderline().run())}
				onclick={() => editor?.chain().focus().toggleUnderline().run()}
				class="{btnBase} {btnTone(isActive('underline'))}"
			>
				<i class="fa-solid fa-underline" aria-hidden="true"></i>
			</button>
			<button
				type="button"
				title="Coret"
				aria-label="Coret"
				aria-pressed={isActive('strike')}
				disabled={!canRun(() => editor!.can().chain().focus().toggleStrike().run())}
				onclick={() => editor?.chain().focus().toggleStrike().run()}
				class="{btnBase} {btnTone(isActive('strike'))}"
			>
				<i class="fa-solid fa-strikethrough" aria-hidden="true"></i>
			</button>
		</span>
		<span class="h-6 w-px shrink-0 bg-slate-300" aria-hidden="true"></span>

		<span class="flex items-center gap-1" role="group" aria-label="Perataan">
			<button
				type="button"
				title="Rata kiri"
				aria-label="Rata kiri"
				aria-pressed={isActive({ textAlign: 'left' })}
				disabled={!editor}
				onclick={() => editor?.chain().focus().setTextAlign('left').run()}
				class="{btnBase} {btnTone(isActive({ textAlign: 'left' }))}"
			>
				<i class="fa-solid fa-align-left" aria-hidden="true"></i>
			</button>
			<button
				type="button"
				title="Rata tengah"
				aria-label="Rata tengah"
				aria-pressed={isActive({ textAlign: 'center' })}
				disabled={!editor}
				onclick={() => editor?.chain().focus().setTextAlign('center').run()}
				class="{btnBase} {btnTone(isActive({ textAlign: 'center' }))}"
			>
				<i class="fa-solid fa-align-center" aria-hidden="true"></i>
			</button>
			<button
				type="button"
				title="Rata kanan"
				aria-label="Rata kanan"
				aria-pressed={isActive({ textAlign: 'right' })}
				disabled={!editor}
				onclick={() => editor?.chain().focus().setTextAlign('right').run()}
				class="{btnBase} {btnTone(isActive({ textAlign: 'right' }))}"
			>
				<i class="fa-solid fa-align-right" aria-hidden="true"></i>
			</button>
			<button
				type="button"
				title="Rata kanan-kiri"
				aria-label="Rata kanan-kiri"
				aria-pressed={isActive({ textAlign: 'justify' })}
				disabled={!editor}
				onclick={() => editor?.chain().focus().setTextAlign('justify').run()}
				class="{btnBase} {btnTone(isActive({ textAlign: 'justify' }))}"
			>
				<i class="fa-solid fa-align-justify" aria-hidden="true"></i>
			</button>
		</span>
		<span class="h-6 w-px shrink-0 bg-slate-300" aria-hidden="true"></span>

		<span class="flex items-center gap-1" role="group" aria-label="Daftar dan kutipan">
			<button
				type="button"
				title="Daftar poin"
				aria-label="Daftar poin"
				aria-pressed={isActive('bulletList')}
				disabled={!editor}
				onclick={() => editor?.chain().focus().toggleBulletList().run()}
				class="{btnBase} {btnTone(isActive('bulletList'))}"
			>
				<i class="fa-solid fa-list-ul" aria-hidden="true"></i>
			</button>
			<button
				type="button"
				title="Daftar bernomor"
				aria-label="Daftar bernomor"
				aria-pressed={isActive('orderedList')}
				disabled={!editor}
				onclick={() => editor?.chain().focus().toggleOrderedList().run()}
				class="{btnBase} {btnTone(isActive('orderedList'))}"
			>
				<i class="fa-solid fa-list-ol" aria-hidden="true"></i>
			</button>
			<button
				type="button"
				title="Kutipan"
				aria-label="Kutipan"
				aria-pressed={isActive('blockquote')}
				disabled={!editor}
				onclick={() => editor?.chain().focus().toggleBlockquote().run()}
				class="{btnBase} {btnTone(isActive('blockquote'))}"
			>
				<i class="fa-solid fa-quote-left" aria-hidden="true"></i>
			</button>
			<button
				type="button"
				title="Blok kode program"
				aria-label="Blok kode program"
				aria-pressed={inCodeBlock}
				disabled={!editor}
				onclick={() => editor?.chain().focus().toggleCodeBlock().run()}
				class="{btnBase} {btnTone(inCodeBlock)}"
			>
				<i class="fa-solid fa-code" aria-hidden="true"></i>
			</button>
		</span>
		<span class="h-6 w-px shrink-0 bg-slate-300" aria-hidden="true"></span>

		<span class="flex items-center gap-1" role="group" aria-label="Sisipkan media">
			<button
				type="button"
				title="Sisipkan / ubah tautan"
				aria-label="Sisipkan atau ubah tautan"
				aria-pressed={isActive('link')}
				disabled={!editor}
				onclick={() => openDialog('link')}
				class="{btnBase} {btnTone(isActive('link'))}"
			>
				<i class="fa-solid fa-link" aria-hidden="true"></i>
			</button>
			<button
				type="button"
				title="Sisipkan gambar"
				aria-label="Sisipkan gambar"
				disabled={!editor}
				onclick={() => openDialog('image')}
				class="{btnBase} {btnTone(false)}"
			>
				<i class="fa-solid fa-image" aria-hidden="true"></i>
			</button>
			<button
				type="button"
				title="Sisipkan video (YouTube / Vimeo / MP4)"
				aria-label="Sisipkan video"
				disabled={!editor}
				onclick={() => openDialog('video')}
				class="{btnBase} {btnTone(false)}"
			>
				<i class="fa-solid fa-circle-play" aria-hidden="true"></i>
			</button>
			<button
				type="button"
				title="Lampirkan PDF"
				aria-label="Lampirkan PDF"
				disabled={!editor}
				onclick={() => openDialog('pdf')}
				class="{btnBase} {btnTone(false)}"
			>
				<i class="fa-solid fa-file-pdf" aria-hidden="true"></i>
			</button>
			<button
				type="button"
				title="Garis pembatas"
				aria-label="Sisipkan garis pembatas"
				disabled={!editor}
				onclick={() => editor?.chain().focus().setHorizontalRule().run()}
				class="{btnBase} {btnTone(false)}"
			>
				<i class="fa-solid fa-minus" aria-hidden="true"></i>
			</button>
		</span>

		{#if inCodeBlock}
			<span class="flex items-center gap-1.5 pl-1" role="group" aria-label="Bahasa kode">
				<label for="code-lang" class="text-[11px] font-bold text-slate-500">Bahasa</label>
				<select
					id="code-lang"
					value={currentCodeLang}
					onchange={(e) =>
						editor?.chain().focus().updateAttributes('codeBlock', { language: e.currentTarget.value }).run()}
					class="min-h-10 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-bold text-slate-700 focus:border-blue-500 focus:outline-none"
				>
					{#each CODE_LANGUAGES as lang (lang.value)}
						<option value={lang.value}>{lang.label}</option>
					{/each}
				</select>
			</span>
		{/if}

		<span class="ml-auto hidden items-center gap-1.5 pr-1 text-[11px] font-semibold text-slate-400 sm:flex" aria-live="polite">
			<i class="fa-solid fa-keyboard" aria-hidden="true"></i> {words} kata
		</span>
	</div>

	<!-- Kanvas dokumen -->
	<div class="mdoc mdoc-edit bg-white">
		{#if editorFailed}
			<div class="p-8 text-center" role="alert">
				<p
					class="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-500"
				>
					<i class="fa-solid fa-triangle-exclamation text-xl" aria-hidden="true"></i>
				</p>
				<p class="mt-3 text-sm font-bold text-slate-900">Editor gagal dimuat</p>
				<p class="mx-auto mt-1 max-w-sm text-xs text-slate-500">
					Komponen editor tidak dapat diinisialisasi di peramban ini. Draf tersimpan tetap aman.
				</p>
				<button
					type="button"
					onclick={() => {
						editorFailed = false;
						retryCount++;
					}}
					class="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
				>
					<i class="fa-solid fa-rotate-right" aria-hidden="true"></i> Muat ulang editor
				</button>
			</div>
		{:else if browser}
			<div bind:this={element}></div>
		{:else}
			<p class="p-6 text-sm text-slate-400">Memuat editor…</p>
		{/if}
	</div>

	<!-- Dialog sisipkan -->
	{#if dialog}
		<div class="fixed inset-0 z-[70] flex items-end justify-center bg-slate-900/50 p-4 sm:items-center" role="presentation">
			<div
				role="dialog"
				aria-modal="true"
				tabindex="-1"
				aria-label={dialog === 'link'
					? 'Sisipkan atau ubah tautan'
					: dialog === 'image'
						? 'Sisipkan gambar'
						: dialog === 'video'
							? 'Sisipkan video'
							: 'Lampirkan PDF'}
				onkeydown={dialogKeydown}
				class="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
			>
				<div class="flex items-center justify-between gap-3 border-b border-slate-100 p-4">
					<h3 class="text-sm font-extrabold text-slate-900">
						{#if dialog === 'link'}
							<i class="fa-solid fa-link mr-1.5 text-blue-600" aria-hidden="true"></i>Tautan
						{:else if dialog === 'image'}
							<i class="fa-solid fa-image mr-1.5 text-blue-600" aria-hidden="true"></i>Gambar
						{:else if dialog === 'video'}
							<i class="fa-solid fa-circle-play mr-1.5 text-blue-600" aria-hidden="true"></i>Video
						{:else}
							<i class="fa-solid fa-file-pdf mr-1.5 text-red-600" aria-hidden="true"></i>Lampiran PDF
						{/if}
					</h3>
					<button
						type="button"
						aria-label="Tutup dialog"
						onclick={closeDialog}
						class="flex min-h-9 min-w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-blue-600"
					>
						<i class="fa-solid fa-xmark" aria-hidden="true"></i>
					</button>
				</div>

				<div class="space-y-3 p-4">
					{#if dialog === 'link'}
						<p class="text-xs text-slate-500">
							Pilih teks dulu lalu tempel tautan, atau kosongkan untuk melepas tautan.
						</p>
						<div>
							<label for="dlg-url" class="mb-1 block text-xs font-bold text-slate-700">URL tautan</label>
							<input
								id="dlg-url"
								type="url"
								bind:this={dialogInput}
								bind:value={urlValue}
								placeholder="https://contoh.com/materi"
								class="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
							/>
						</div>
					{:else if dialog === 'image'}
						<div>
							<span id="dlg-img-up" class="mb-1 block text-xs font-bold text-slate-700">Unggah dari perangkat</span>
							<label
								for="dlg-img-file"
								class="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-blue-300 bg-blue-50/60 px-4 py-2.5 text-xs font-bold text-blue-700 transition-colors hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-blue-600"
							>
								<i class="fa-solid fa-upload" aria-hidden="true"></i> Pilih gambar (maks 4 MB)
							</label>
							<input
								id="dlg-img-file"
								type="file"
								accept="image/*"
								aria-labelledby="dlg-img-up"
								onchange={handleImageFile}
								class="sr-only"
							/>
						</div>
						<div class="relative flex items-center">
							<div class="grow border-t border-slate-200"></div>
							<span class="mx-3 shrink text-[11px] font-bold tracking-wider text-slate-400 uppercase">atau</span>
							<div class="grow border-t border-slate-200"></div>
						</div>
						<div>
							<label for="dlg-url" class="mb-1 block text-xs font-bold text-slate-700">URL gambar</label>
							<input
								id="dlg-url"
								type="url"
								bind:this={dialogInput}
								bind:value={urlValue}
								placeholder="https://…/gambar.png"
								class="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
							/>
						</div>
					{:else if dialog === 'video'}
						<p class="text-xs text-slate-500">
							Tempel tautan YouTube, Vimeo, atau berkas MP4 langsung. Video tersisip di antara
							paragraf pada posisi kursor.
						</p>
						<div>
							<label for="dlg-url" class="mb-1 block text-xs font-bold text-slate-700">URL video</label>
							<input
								id="dlg-url"
								type="url"
								bind:this={dialogInput}
								bind:value={urlValue}
								placeholder="https://www.youtube.com/watch?v=…"
								class="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
							/>
						</div>
					{:else}
						<p class="text-xs text-slate-500">
							PDF tersisip sebagai kartu unduhan di posisi kursor (maks 8 MB, tersimpan lokal).
						</p>
						<div>
							<label
								for="dlg-pdf-file"
								class="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-red-300 bg-red-50/60 px-4 py-2.5 text-xs font-bold text-red-700 transition-colors hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-red-500"
							>
								<i class="fa-solid fa-upload" aria-hidden="true"></i> Pilih berkas PDF
							</label>
							<input
								id="dlg-pdf-file"
								type="file"
								accept="application/pdf,.pdf"
								onchange={handlePdfFile}
								class="sr-only"
							/>
						</div>
					{/if}

					{#if dialogError}
						<p
							role="alert"
							class="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700"
						>
							<i class="fa-solid fa-circle-exclamation mt-0.5 shrink-0" aria-hidden="true"></i>
							{dialogError}
						</p>
					{/if}
				</div>

				<div class="flex gap-2 border-t border-slate-100 p-4">
					<button
						type="button"
						onclick={closeDialog}
						class="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-slate-500"
					>
						Batal
					</button>
					{#if dialog === 'link'}
						<button
							type="button"
							onclick={applyLink}
							class="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
						>
							<i class="fa-solid fa-check" aria-hidden="true"></i> Terapkan
						</button>
					{:else if dialog === 'image'}
						<button
							type="button"
							onclick={applyImageUrl}
							class="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
						>
							<i class="fa-solid fa-check" aria-hidden="true"></i> Sisipkan URL
						</button>
					{:else if dialog === 'video'}
						<button
							type="button"
							onclick={applyVideoUrl}
							class="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
						>
							<i class="fa-solid fa-check" aria-hidden="true"></i> Sisipkan video
						</button>
					{/if}
				</div>
			</div>
		</div>
	{/if}
</div>
