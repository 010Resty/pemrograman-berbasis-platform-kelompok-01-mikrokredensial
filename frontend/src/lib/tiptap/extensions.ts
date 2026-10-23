import { mergeAttributes, Node } from '@tiptap/core';
import type { Extensions } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';

/** Ubah URL tonton YouTube/Vimeo menjadi URL embed. URL lain dikembalikan apa adanya. */
export function toEmbedUrl(raw: string): string {
	const url = raw.trim();
	const ytWatch = url.match(/(?:youtube\.com\/watch\?[^#]*v=|youtu\.be\/)([\w-]{6,})/i);
	if (ytWatch) return `https://www.youtube.com/embed/${ytWatch[1]}`;
	const ytEmbed = url.match(/youtube\.com\/embed\/([\w-]{6,})/i);
	if (ytEmbed) return `https://www.youtube.com/embed/${ytEmbed[1]}`;
	const vimeo = url.match(/vimeo\.com\/(\d+)/i);
	if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
	return url;
}

export function isEmbeddableFrame(src: string): boolean {
	return /youtube\.com\/embed\/|player\.vimeo\.com\/video\//i.test(src);
}

/** Blok video: iframe untuk YouTube/Vimeo, <video> untuk berkas mp4/webm langsung. */
export const VideoEmbed = Node.create({
	name: 'videoEmbed',
	group: 'block',
	atom: true,
	draggable: true,

	addAttributes() {
		return {
			src: { default: null },
			title: { default: 'Video materi' }
		};
	},

	parseHTML() {
		return [{ tag: 'div[data-video-embed]' }];
	},

	renderHTML({ HTMLAttributes }) {
		const src = String(HTMLAttributes.src ?? '');
		const title = String(HTMLAttributes.title ?? 'Video materi');
		const inner = isEmbeddableFrame(src)
			? [
					'iframe',
					{
						src,
						title,
						loading: 'lazy',
						allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture',
						allowfullscreen: 'true'
					}
				]
			: [
					'video',
					mergeAttributes(HTMLAttributes, { controls: 'true', preload: 'metadata' })
				];
		return [
			'div',
			{ 'data-video-embed': '', class: 'tiptap-video', 'data-src': src },
			inner
		];
	},

	addCommands() {
		return {
			insertVideo:
				(attrs: { src: string; title?: string }) =>
				({ commands }) =>
					commands.insertContent({ type: this.name, attrs })
		};
	}
});

/** Blok lampiran PDF: kartu unduh dengan nama + ukuran berkas. */
export const PdfAttachment = Node.create({
	name: 'pdfAttachment',
	group: 'block',
	atom: true,
	draggable: true,

	addAttributes() {
		return {
			name: { default: 'lampiran.pdf' },
			url: { default: null },
			size: { default: '' }
		};
	},

	parseHTML() {
		return [{ tag: 'div[data-pdf-attachment]' }];
	},

	renderHTML({ HTMLAttributes }) {
		const name = String(HTMLAttributes.name ?? 'lampiran.pdf');
		const url = String(HTMLAttributes.url ?? '#');
		const size = String(HTMLAttributes.size ?? '');
		return [
			'div',
			{ 'data-pdf-attachment': '', class: 'tiptap-pdf' },
			[
				'a',
				{ href: url, download: name, target: '_blank', rel: 'noopener', class: 'tiptap-pdf-link' },
				['span', { class: 'tiptap-pdf-icon' }, 'PDF'],
				[
					'span',
					{ class: 'tiptap-pdf-meta' },
					['span', { class: 'tiptap-pdf-name' }, name],
					size ? ['span', { class: 'tiptap-pdf-size' }, size] : ''
				]
			]
		];
	},

	addCommands() {
		return {
			insertPdf:
				(attrs: { name: string; url: string; size?: string }) =>
				({ commands }) =>
					commands.insertContent({ type: this.name, attrs })
		};
	}
});

/** Daftar ekstensi bersama untuk editor dan generator HTML pratinjau. */
export function createEditorExtensions(placeholder: string): Extensions {
	return [
		StarterKit.configure({
			heading: { levels: [1, 2, 3] },
			codeBlock: { HTMLAttributes: { class: 'tiptap-codeblock' } }
		}),
		Underline,
		Link.configure({
			openOnClick: false,
			autolink: true,
			HTMLAttributes: { class: 'tiptap-link' }
		}),
		Image.configure({
			inline: false,
			allowBase64: true,
			HTMLAttributes: { class: 'tiptap-image', loading: 'lazy' }
		}),
		TextAlign.configure({ types: ['heading', 'paragraph'] }),
		Placeholder.configure({ placeholder }),
		VideoEmbed,
		PdfAttachment
	];
}

declare module '@tiptap/core' {
	interface Commands<ReturnType> {
		videoEmbed: {
			insertVideo: (attrs: { src: string; title?: string }) => ReturnType;
		};
		pdfAttachment: {
			insertPdf: (attrs: { name: string; url: string; size?: string }) => ReturnType;
		};
	}
}
