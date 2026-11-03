<script lang="ts">
	import {
		DEFAULT_OG_IMAGE,
		DEFAULT_OG_IMAGE_HEIGHT,
		DEFAULT_OG_IMAGE_WIDTH,
		SITE_LOCALE,
		SITE_NAME,
		canonicalPath
	} from '$lib/seo/site';

	interface Props {
		/** Judul penuh <= 60 karakter, unik per halaman, kata kunci di depan. */
		title: string;
		/** Deskripsi unik 150-160 karakter + CTA, sesuai isi halaman. */
		description: string;
		/** Path internal untuk canonical/og:url, mis. '/pelatihan'. */
		path: string;
		/** Origin request (dari server load) agar canonical selalu benar per domain. */
		origin?: string;
		/** 'website' untuk landing, 'article' untuk detail konten. */
		type?: 'website' | 'article';
		/** True untuk halaman non-indeks (placeholder/auth/privat). */
		noindex?: boolean;
		/** URL gambar absolut/relatif untuk OG/Twitter. Default: /og-cover.png. */
		image?: string;
		/** Alt gambar sosial. Wajib bila image diisi. */
		imageAlt?: string;
		/** Structured data JSON-LD (objek tunggal). Render apa adanya. */
		jsonLd?: Record<string, unknown> | Array<Record<string, unknown>>;
	}

	let {
		title,
		description,
		path,
		origin,
		type = 'website',
		noindex = false,
		image = DEFAULT_OG_IMAGE,
		imageAlt,
		jsonLd
	}: Props = $props();

	const canonical = $derived(canonicalPath(path, origin));
	const robots = $derived(noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large');

	function toAbsoluteImage(src: string): string {
		if (/^https?:\/\//i.test(src)) return src;
		const clean = src.startsWith('/') ? src : `/${src}`;
		return canonicalPath(clean, origin);
	}

	const absoluteImage = $derived(image ? toAbsoluteImage(image) : null);
	const imageIsDefault = $derived(!image || image === DEFAULT_OG_IMAGE);

	// Nama tag dipecah agar parser Svelte tidak mengira blok script berakhir
	// di tengah template string JSON-LD.
	const TAG = 'script';
	const jsonLdHtml = $derived(
		jsonLd
			? (Array.isArray(jsonLd) ? jsonLd : [jsonLd])
					.map((node) => {
						const safe = JSON.stringify(node).replace(/<\//g, '<\\/');
						return `<${TAG} type="application/ld+json">${safe}</${TAG}>`;
					})
					.join('')
			: ''
	);
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={description} />
	<meta name="robots" content={robots} />
	<link rel="canonical" href={canonical} />

	<!-- Open Graph -->
	<meta property="og:type" content={type} />
	<meta property="og:site_name" content={SITE_NAME} />
	<meta property="og:locale" content={SITE_LOCALE} />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	<meta property="og:url" content={canonical} />
	{#if absoluteImage}
		<meta property="og:image" content={absoluteImage} />
		<meta property="og:image:alt" content={imageAlt ?? title} />
		{#if imageIsDefault}
			<meta property="og:image:width" content={String(DEFAULT_OG_IMAGE_WIDTH)} />
			<meta property="og:image:height" content={String(DEFAULT_OG_IMAGE_HEIGHT)} />
		{/if}
	{/if}

	<!-- Twitter -->
	<meta name="twitter:card" content={absoluteImage ? 'summary_large_image' : 'summary'} />
	<meta name="twitter:title" content={title} />
	<meta name="twitter:description" content={description} />
	{#if absoluteImage}
		<meta name="twitter:image" content={absoluteImage} />
		<meta name="twitter:image:alt" content={imageAlt ?? title} />
	{/if}

	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	{@html jsonLdHtml}
</svelte:head>
