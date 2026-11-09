import createDOMPurify from 'dompurify';
import type { Config } from 'dompurify';

/**
 * Sanitasi HTML untuk konten Tiptap — DOMPurify (browser) + fallback SSR.
 *
 * Konteks: materi/brief dirender via `{@html}` dari JSON Tiptap yang
 * tersimpan di backend. Penulisnya instruktur terautentikasi, tapi konten
 * tersimpan tetap berisiko (akun disusupi, impor massal). Sanitizer adalah
 * pertahanan lapis pertama; lapis kedua Content-Security-Policy
 * (`src/hooks.server.ts`).
 *
 * - Browser: DOMPurify (pustaka yang diaudit publik, dirawat mengikuti
 *   perubahan parser browser — termasuk vektor mXSS yang tidak tertutup
 *   sanitizer tulisan tangan).
 * - SSR (tanpa DOM): fallback allowlist kustom `legacySanitizeTiptapHtml`
 *   dengan semantik yang sama (diuji regresi identik).
 */

// Kebijakan: cermin allowlist Tiptap (StarterKit + underline + text-align
// + link + image + audio/video/source + kartu PDF + iframe embed). Eksplisit
// agar tidak bergantung pada default pustaka. Catatan: <audio>/<video>
// disengaja diizinkan karena embed materi hanya menunjuk URL berkas server;
// <iframe> HANYA untuk embed YouTube/Vimeo terpercaya (isAllowedEmbedSrc) —
// object/embed tetap dilarang (risiko XSS paling tinggi).
const ALLOWED_TAGS = [
	'a',
	'p',
	'br',
	'hr',
	'strong',
	'b',
	'em',
	'i',
	'u',
	's',
	'strike',
	'del',
	'code',
	'pre',
	'blockquote',
	'ul',
	'ol',
	'li',
	'h1',
	'h2',
	'h3',
	'h4',
	'h5',
	'h6',
	'img',
	'audio',
	'video',
	'source',
	'iframe',
	'table',
	'thead',
	'tbody',
	'tr',
	'th',
	'td',
	'div',
	'span',
	'sup',
	'sub',
	'mark'
];

const ALLOWED_ATTR = [
	'href',
	'title',
	'src',
	'alt',
	'width',
	'height',
	'colspan',
	'rowspan',
	'style',
	'target',
	'rel',
	'download',
	'class',
	'controls',
	'preload',
	'loading',
	'type',
	'allow',
	'allowfullscreen',
	// Marker round-trip Tiptap (parseHTML VideoEmbed/AudioEmbed/PdfAttachment).
	// Inert (tidak dieksekusi browser); daftar eksplisit, bukan data-* umum.
	'data-video-embed',
	'data-audio-embed',
	'data-pdf-attachment',
	'data-src'
];

/** Tag yang dibuang BESERTA seluruh isinya (tidak render children).
 * audio/video/source SENGAJA tidak ada di sini (lihat ALLOWED_TAGS);
 * iframe TIDAK ada di sini — hanya embed terpercaya via isAllowedEmbedSrc;
 * object/embed tetap dilarang. */
const FORBID_TAGS = [
	'script',
	'style',
	'object',
	'embed',
	'link',
	'meta',
	'base',
	'title',
	'form',
	'input',
	'button',
	'select',
	'option',
	'textarea',
	'track',
	'noscript',
	'template',
	'slot'
];

const DOMPURIFY_CONFIG: Config = {
	ALLOWED_TAGS,
	ALLOWED_ATTR,
	// data: URI hanya untuk gambar (lampiran Tiptap); audio/video/file
	// memakai URL berkas server.
	ADD_DATA_URI_TAGS: ['img'],
	FORBID_TAGS,
	FORBID_ATTR: ['srcset', 'formaction'],
	KEEP_CONTENT: true,
	ALLOW_UNKNOWN_PROTOCOLS: false,
	WHOLE_DOCUMENT: false
};

/** Antarmuka struktural minimal agar tidak terikat versi @types/dompurify. */
export interface PurifyInstance {
	sanitize(source: string | Node, config?: Config): string;
	addHook(
		hook: 'afterSanitizeAttributes',
		cb: (node: Element, data: { attrName: string; attrValue: string; keepAttr: boolean }) => void
	): void;
}

/** Hanya `text-align` dengan nilai valid yang dipertahankan dari style. */
function sanitizeStyle(raw: string): string {
	for (const decl of raw.split(';')) {
		const [prop, ...rest] = decl.split(':');
		if (!prop || rest.length === 0) continue;
		const value = rest.join(':').trim().toLowerCase();
		if (prop.trim().toLowerCase() !== 'text-align') continue;
		if (['left', 'right', 'center', 'justify'].includes(value)) {
			return `text-align: ${value}`;
		}
	}
	return '';
}

/**
 * Satu-satunya src frame yang boleh lolos: URL embed hasil `toEmbedUrl`
 * (`extensions.ts`) — `https://www.youtube.com/embed/<id>` dan
 * `https://player.vimeo.com/video/<id>`. Skema https wajib (menolak
 * protocol-relative/javascript:/data:). Query/fragment tambahan (parameter
 * player) tetap lolos selama prefix cocok — origin-nya tetap YouTube/Vimeo.
 * Dipakai KEDUA jalur (DOMPurify + SSR) agar paritas.
 */
const EMBED_SRC_PATTERNS = [
	/^https:\/\/(www\.)?youtube\.com\/embed\/[\w-]+/i,
	/^https:\/\/player\.vimeo\.com\/video\/\d+/i
];

function isAllowedEmbedSrc(raw: string): boolean {
	const url = legacyStripUrlControls(raw).trim();
	return EMBED_SRC_PATTERNS.some((re) => re.test(url));
}

/**
 * Pasang aturan atribut pasca-sanitasi: tautan selalu tab baru + rel aman,
 * `style` dipangkas ke text-align, `img` selalu punya alt, src media
 * (audio/video/source) hanya boleh http(s) atau path absolut server,
 * src iframe WAJIB embed YouTube/Vimeo (isAllowedEmbedSrc) — selain itu
 * src-nya dibuang sehingga frame inert (about:blank, tanpa load/skrip).
 */
export function configurePurify(purify: PurifyInstance): void {
	purify.addHook('afterSanitizeAttributes', (node) => {
		if (node.nodeName === 'IFRAME') {
			const src = (node.getAttribute('src') ?? '').trim();
			if (!isAllowedEmbedSrc(src)) node.removeAttribute('src');
			return;
		}
		if (
			node.nodeName === 'AUDIO' ||
			node.nodeName === 'VIDEO' ||
			node.nodeName === 'SOURCE'
		) {
			const src = (node.getAttribute('src') ?? '').trim();
			// data:/blob:/javascript: dilarang untuk media (DOMPurify sudah
			// menolak sebagian; ini penegasan agar paritas dengan jalur SSR).
			if (src && !/^(https?:\/\/|\/)/i.test(src)) node.removeAttribute('src');
			return;
		}
		if (node.nodeName === 'A') {
			const a = node as HTMLAnchorElement;
			const href = (a.getAttribute('href') ?? '').trim();
			// Tolak URL protocol-relative (mewarisi protokol halaman → open redirect).
			if (href.startsWith('//')) {
				a.removeAttribute('href');
				return;
			}
			if (a.hasAttribute('href')) {
				a.setAttribute('target', '_blank');
				a.setAttribute('rel', 'noopener noreferrer');
			}
			return;
		}
		if (node.nodeName === 'IMG' && !node.hasAttribute('alt')) {
			node.setAttribute('alt', '');
		}
		if (node.hasAttribute('style')) {
			const clean = sanitizeStyle(node.getAttribute('style') ?? '');
			if (clean) node.setAttribute('style', clean);
			else node.removeAttribute('style');
		}
	});
}

/** Sanitasi memakai instance DOMPurify yang sudah dikonfigurasi. */
export function sanitizeWithPurify(purify: PurifyInstance, dirty: string | null | undefined): string {
	if (!dirty) return '';
	return purify.sanitize(dirty, DOMPURIFY_CONFIG);
}

let cachedBrowserPurify: PurifyInstance | null = null;

function browserPurify(): PurifyInstance | null {
	if (typeof window === 'undefined') return null;
	if (!cachedBrowserPurify) {
		const instance = (createDOMPurify as unknown as (w: unknown) => PurifyInstance)(window);
		configurePurify(instance);
		cachedBrowserPurify = instance;
	}
	return cachedBrowserPurify;
}

// ---------------------------------------------------------------------------
// Fallback SSR: allowlist kustom isomorfik (tanpa DOM).
// Dipakai saat render server; diuji menghasilkan output identik dengan
// jalur DOMPurify untuk 29 kasus adversarial. Jangan hapus.
// ---------------------------------------------------------------------------

const LEGACY_ALLOWED_TAGS = new Set(ALLOWED_TAGS);

/** Tag yang dibuang BESERTA seluruh isinya — diselaraskan persis dengan
 * perilaku DOMPurify (jalur browser), agar output SSR dan browser identik
 * (tanpa mismatch hidrasi). Tag lain yang dilarang hanya dikupas.
 * audio/video/source SENGAJA tidak ada di sini (lihat ALLOWED_TAGS);
 * iframe juga tidak — src non-embed dibuang per-atribut (lihat
 * legacySanitizeAttrs), paritas hook DOMPurify yang membuang src-nya. */
const LEGACY_DROP_WITH_CONTENT = new Set([
	'script',
	'style',
	'title',
	'noscript',
	'template',
	'noembed',
	'noframes',
	'plaintext',
	'xmp',
	'svg',
	'math'
]);

const LEGACY_VOID_TAGS = new Set(['br', 'hr', 'img', 'source']);

const LEGACY_ATTRS: Record<string, Set<string>> = {
	a: new Set(['href', 'title', 'download', 'target', 'rel']),
	img: new Set(['src', 'alt', 'title', 'width', 'height', 'loading']),
	audio: new Set(['src', 'controls', 'preload', 'title']),
	video: new Set(['src', 'controls', 'preload', 'title']),
	source: new Set(['src', 'type']),
	iframe: new Set(['src', 'title', 'loading', 'allow', 'allowfullscreen', 'width', 'height']),
	th: new Set(['colspan', 'rowspan']),
	td: new Set(['colspan', 'rowspan'])
};

const LEGACY_SAFE_SCHEMES = new Set(['http:', 'https:', 'mailto:', 'tel:']);

const LEGACY_NAMED_ENTITIES: Record<string, string> = {
	amp: '&',
	lt: '<',
	gt: '>',
	quot: '"',
	apos: "'",
	nbsp: ' '
};

function legacyDecodeEntities(s: string): string {
	return s.replace(/&(#\d+|#x[0-9a-fA-F]+|[a-zA-Z]+);/g, (m, body: string) => {
		if (body[0] === '#') {
			const hex = body[1]?.toLowerCase() === 'x';
			const code = parseInt(hex ? body.slice(2) : body.slice(1), hex ? 16 : 10);
			if (!Number.isNaN(code) && code > 0 && code <= 0x10ffff) {
				return String.fromCodePoint(code);
			}
			return m;
		}
		return LEGACY_NAMED_ENTITIES[body] ?? m;
	});
}

/** Singkirkan karakter kontrol ASCII — browser mengabaikannya di URL
 * ("java\tscript:" menjadi "javascript:"), jadi harus dibuang dulu. */
function legacyStripUrlControls(s: string): string {
	let out = '';
	for (const ch of s) {
		const code = ch.codePointAt(0) ?? 0;
		if (code <= 0x20 || code === 0x7f) continue;
		out += ch;
	}
	return out;
}

function legacyIsSafeUrl(decodedRaw: string, allowDataImage: boolean): boolean {
	// Nilai atribut SUDAH didekode sekali saat ekstraksi (tepat satu kali,
	// seperti parser browser). Jangan dekode lagi agar identik DOMPurify.
	const url = legacyStripUrlControls(decodedRaw).trim();
	if (!url) return false;
	if (url.startsWith('//')) return false; // protocol-relative → tolak
	const lower = url.toLowerCase();
	if (lower.startsWith('data:')) {
		return allowDataImage && lower.startsWith('data:image/');
	}
	const scheme = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(url);
	if (!scheme) return true;
	return LEGACY_SAFE_SCHEMES.has(scheme[1].toLowerCase() + ':');
}

function legacyEscapeText(s: string): string {
	return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function legacyEscapeAttr(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/"/g, '&quot;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}

interface LegacyParsedTag {
	closing: boolean;
	name: string;
	attrs: string;
}

function legacyParseTag(token: string): LegacyParsedTag | null {
	if (token.startsWith('<!--') || token.startsWith('<!') || token.startsWith('<?')) {
		return null;
	}
	// Pindai sadar-kuotes agar `>` di dalam nilai atribut (mis. srcdoc="<p>")
	// tidak memutus tag.
	const m = /^<\s*(\/?)\s*([a-zA-Z][a-zA-Z0-9]*)/.exec(token);
	if (!m) return null;
	let i = m[0].length;
	let quote: string | null = null;
	while (i < token.length) {
		const ch = token[i];
		if (quote) {
			if (ch === quote) quote = null;
		} else if (ch === '"' || ch === "'") {
			quote = ch;
		} else if (ch === '>') {
			break;
		}
		i++;
	}
	if (i >= token.length || quote) return null;
	const inner = token.slice(m[0].length, i);
	const selfClosing = /\/\s*$/.test(inner);
	const attrs = selfClosing ? inner.replace(/\/\s*$/, '') : inner;
	return { closing: m[1] === '/', name: m[2].toLowerCase(), attrs };
}

function legacySanitizeAttrs(tag: string, raw: string): string {
	const allowed = LEGACY_ATTRS[tag];
	let out = '';
	const re = /([a-zA-Z_:][a-zA-Z0-9_.:-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'`=<>]+))?)?/g;
	let m: RegExpExecArray | null;
	while ((m = re.exec(raw)) !== null) {
		const name = m[1].toLowerCase();
		// Nilai didekode dulu (validasi melihat bentuk final), lalu di-escape ulang.
		const value = legacyDecodeEntities(m[2] ?? m[3] ?? m[4] ?? '');
		// Blokir seluruh event handler + atribut berisiko (srcset, formaction, ...).
		if (name.startsWith('on') || name === 'srcset' || name === 'formaction') continue;
		if (name === 'style') {
			const clean = sanitizeStyle(value);
			if (clean) out += ` style="${legacyEscapeAttr(clean)}"`;
			continue;
		}
		// `class` global seperti DOMPurify (ALLOWED_ATTR): kartu PDF/audio/video
		// Tiptap memakai class (tiptap-pdf-link, tiptap-audio-el, ...). Nilai
		// di-escape ulang; bukan vektor XSS.
		if (name === 'class') {
			if (value.trim()) out += ` class="${legacyEscapeAttr(value)}"`;
			continue;
		}
		// Marker round-trip Tiptap (paritas ALLOWED_ATTR jalur browser):
		// data-video-embed / data-audio-embed / data-pdf-attachment / data-src.
		// Inert, daftar eksplisit — data-* lain tetap dibuang.
		if (
			name === 'data-video-embed' ||
			name === 'data-audio-embed' ||
			name === 'data-pdf-attachment' ||
			name === 'data-src'
		) {
			out += value ? ` ${name}="${legacyEscapeAttr(value)}"` : ` ${name}`;
			continue;
		}
		if (name === 'href' || name === 'src') {
			if (!allowed?.has(name)) continue;
			// iframe: lapis tambahan — hanya embed YouTube/Vimeo terpercaya.
			// Selain itu src dibuang (frame inert), paritas hook DOMPurify.
			if (tag === 'iframe' && name === 'src' && !isAllowedEmbedSrc(value)) continue;
			const allowDataImage = tag === 'img' && name === 'src';
			if (!legacyIsSafeUrl(value, allowDataImage)) continue;
			out += ` ${name}="${legacyEscapeAttr(value.trim())}"`;
			continue;
		}
		if (!allowed?.has(name)) continue;
		out += value ? ` ${name}="${legacyEscapeAttr(value)}"` : ` ${name}`;
	}
	// Tautan eksternal: paksa tab baru + rel aman.
	if (tag === 'a' && /href=/.test(out)) {
		out += ' target="_blank" rel="noopener noreferrer"';
	}
	if (tag === 'img' && !/alt=/.test(out)) out += ' alt=""';
	return out;
}

export function legacySanitizeTiptapHtml(dirty: string | null | undefined): string {
	if (!dirty) return '';
	const tokens = dirty.match(/<!--[\s\S]*?-->|<\/?[a-zA-Z](?:[^<>"']|"[^"]*"|'[^']*')*>|[^<]+|</g) ?? [];
	let out = '';
	let dropDepth = 0;
	/** Tag terbuka yang sudah di-emit — ditutup otomatis di akhir (paritas
	 * auto-close browser/DOMPurify agar SSR dan browser identik). */
	const openStack: string[] = [];

	for (let ti = 0; ti < tokens.length; ti++) {
		const token = tokens[ti];
		if (token === '<') {
			// Kurung tak valid (mis. "5 < 6"): render sebagai teks.
			if (dropDepth === 0) out += '&lt;';
			continue;
		}
		if (!token.startsWith('<')) {
			if (dropDepth === 0) out += legacyEscapeText(legacyDecodeEntities(token));
			continue;
		}
		const tag = legacyParseTag(token);
		if (!tag) continue; // komentar/doctype/invalid → buang
		const { closing, name, attrs } = tag;

		// <plaintext>: seluruh sisa input dibuang (paritas DOMPurify).
		if (name === 'plaintext' && !closing && dropDepth === 0) {
			break;
		}
		if (LEGACY_DROP_WITH_CONTENT.has(name)) {
			if (!closing && !LEGACY_VOID_TAGS.has(name)) dropDepth++;
			else if (closing && dropDepth > 0) dropDepth--;
			continue;
		}
		if (dropDepth > 0) continue;
		if (!LEGACY_ALLOWED_TAGS.has(name)) continue; // buang tag, pertahankan isi

		if (closing) {
			if (!LEGACY_VOID_TAGS.has(name)) {
				// Tutup yang cocok; tag yang menumpang di atasnya ditutup juga.
				const at = openStack.lastIndexOf(name);
				if (at >= 0) {
					for (let k = openStack.length - 1; k >= at; k--) out += `</${openStack[k]}>`;
					openStack.length = at;
				}
			}
			continue;
		}
		out += `<${name}${legacySanitizeAttrs(name, attrs)}>`;
		if (!LEGACY_VOID_TAGS.has(name)) openStack.push(name);
	}
	for (let k = openStack.length - 1; k >= 0; k--) out += `</${openStack[k]}>`;
	return out;
}

/**
 * Sanitasi HTML Tiptap → string aman untuk `{@html}`.
 * Browser: DOMPurify. SSR: fallback allowlist (output setara, teruji).
 */
export function sanitizeTiptapHtml(dirty: string | null | undefined): string {
	if (!dirty) return '';
	const purify = browserPurify();
	if (purify) return sanitizeWithPurify(purify, dirty);
	return legacySanitizeTiptapHtml(dirty);
}
