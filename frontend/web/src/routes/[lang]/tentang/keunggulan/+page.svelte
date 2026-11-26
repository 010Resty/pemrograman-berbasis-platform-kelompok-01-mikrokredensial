<script lang="ts">
	import { page } from '$app/state';
	import PublicHeader from '$lib/components/public/PublicHeader.svelte';
	import PublicFooter from '$lib/components/public/PublicFooter.svelte';
	import SeoHead from '$lib/components/SeoHead.svelte';
	import { canonicalPath, getSiteUrl, altUrls } from '$lib/seo/site';
	import { lp, jsonLdLang, type Locale } from '$lib/i18n/locale';
	import { reveal } from '$lib/actions/reveal';
	import { t, ta } from '$lib/i18n/index';
	import { TENTANG_FEATURES, TENTANG_FORMATS, TENTANG_STATS, TENTANG_SUBPAGES } from '$lib/data/tentang';

	const lang: Locale = $derived(page.params.lang === 'en' ? 'en' : 'id');

	/** Sub-halaman, statistik, fitur, dan format mengikuti bahasa aktif. */
	const siblings = $derived.by(() => {
		const text: Record<string, { title: string; desc: string }> = {
			'arti-nama': { title: t(lang, 'about.subArtiNamaTitle'), desc: t(lang, 'about.subArtiNamaDesc') },
			'cara-kerja': { title: t(lang, 'about.subCaraKerjaTitle'), desc: t(lang, 'about.subCaraKerjaDesc') },
			kontak: { title: t(lang, 'about.subKontakTitle'), desc: t(lang, 'about.subKontakDesc') },
			keunggulan: { title: t(lang, 'about.subKeunggulanTitle'), desc: t(lang, 'about.subKeunggulanDesc') }
		};
		return TENTANG_SUBPAGES.filter((s) => s.id !== 'keunggulan').map((s) => ({
			...s,
			title: text[s.id]?.title ?? s.title,
			desc: text[s.id]?.desc ?? s.desc
		}));
	});
	const statItems = $derived(
		TENTANG_STATS.map((s, i) => ({
			value: s.value,
			label: [t(lang, 'about.statRoleLabel'), t(lang, 'about.statStepLabel'), t(lang, 'about.statCertLabel')][i] ?? s.label,
			desc: [t(lang, 'about.statRoleDesc'), t(lang, 'about.statStepDesc'), t(lang, 'about.statCertDesc')][i] ?? s.desc
		}))
	);
	const featItems = $derived.by(() => {
		const titles = ta(lang, 'about.featTitles');
		const descs = ta(lang, 'about.featDescs');
		return TENTANG_FEATURES.map((f, i) => ({
			icon: f.icon,
			title: titles[i] ?? f.title,
			desc: descs[i] ?? f.desc
		}));
	});
	const fmtItems = $derived.by(() => {
		const labels = ta(lang, 'about.fmtLabels');
		const descs = ta(lang, 'about.fmtDescs');
		return TENTANG_FORMATS.map((f, i) => ({
			icon: f.icon,
			label: labels[i] ?? f.label,
			desc: descs[i] ?? f.desc
		}));
	});

	const keunggulanJsonLd = $derived([
		{
			'@context': 'https://schema.org',
			'@type': 'AboutPage',
			name: t(lang, 'about.unggulPageTitle'),
			description: t(lang, 'about.unggulPageDesc'),
			url: canonicalPath(lp(lang, '/tentang/keunggulan')),
			inLanguage: jsonLdLang(lang),
			isPartOf: { '@type': 'WebSite', name: 'ARISTOTELES', url: getSiteUrl() }
		},
		{
			'@context': 'https://schema.org',
			'@type': 'BreadcrumbList',
			itemListElement: [
				{ '@type': 'ListItem', position: 1, name: t(lang, 'about.crumbHome'), item: canonicalPath(lp(lang, '/')) },
				{ '@type': 'ListItem', position: 2, name: t(lang, 'about.crumbAbout'), item: canonicalPath(lp(lang, '/tentang/arti-nama')) },
				{ '@type': 'ListItem', position: 3, name: t(lang, 'about.subKeunggulanTitle'), item: canonicalPath(lp(lang, '/tentang/keunggulan')) }
			]
		}
	]);
</script>

<SeoHead
	title={t(lang, 'about.unggulPageTitle')}
	description={t(lang, 'about.unggulPageDesc')}
	path={lp(lang, '/tentang/keunggulan')}
	lang={lang}
	alternates={altUrls(lp(lang, '/tentang/keunggulan'))}
	jsonLd={keunggulanJsonLd}
/>

<PublicHeader active="tentang" />

<main>
	<!-- Hero -->
	<section class="relative overflow-hidden bg-abyss">
		<div class="pointer-events-none absolute inset-0" aria-hidden="true">
			<div class="absolute -top-24 left-[12%] h-72 w-72 rounded-full bg-teal/25 blur-3xl"></div>
			<div class="absolute -right-20 -bottom-24 h-72 w-72 rounded-full bg-royal/40 blur-3xl"></div>
			<i class="fa-solid fa-award absolute top-14 right-[8%] hidden text-8xl text-white/10 lg:block"></i>
			<i class="fa-solid fa-star absolute bottom-16 left-[6%] hidden text-4xl text-teal/30 lg:block"></i>
			<div class="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.08)_1.2px,transparent_1.2px)] bg-[size:22px_22px] opacity-50 [mask-image:radial-gradient(ellipse_70%_60%_at_50%_30%,black,transparent)]"></div>
		</div>
		<div class="relative mx-auto max-w-7xl px-4 py-14 text-center sm:px-6 sm:py-20 lg:px-8">
			<nav aria-label="Breadcrumb">
				<ol class="flex flex-wrap items-center justify-center gap-2 text-xs font-semibold">
					<li>
						<a href={lp(lang, '/')} class="rounded text-slate-300 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-white">
							{t(lang, 'about.crumbHome')}
						</a>
					</li>
					<li aria-hidden="true" class="text-slate-500">/</li>
					<li>
						<a href={lp(lang, '/tentang/arti-nama')} class="rounded text-slate-300 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-white">
							{t(lang, 'about.crumbAbout')}
						</a>
					</li>
					<li aria-hidden="true" class="text-slate-500">/</li>
					<li aria-current="page" class="text-teal">{t(lang, 'about.subKeunggulanTitle')}</li>
				</ol>
			</nav>
			<p class="mt-8 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 font-heading text-xs font-bold tracking-[0.18em] text-teal uppercase backdrop-blur">
				<i class="fa-solid fa-star" aria-hidden="true"></i>
				{t(lang, 'about.unggulEyebrow')}
			</p>
			<h1 class="mx-auto mt-5 max-w-4xl font-heading text-4xl leading-[1.08] font-extrabold tracking-tight text-balance text-white sm:text-5xl">
				{t(lang, 'about.unggulHeroTitle')}
			</h1>
			<div class="mt-8 flex flex-col justify-center gap-3 sm:flex-row sm:items-center">
				<a
					href={lp(lang, '/register')}
					class="group inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full bg-white px-8 font-heading text-sm font-bold text-abyss shadow-xl shadow-black/30 transition-all duration-200 hover:-translate-y-0.5 hover:bg-ice focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
				>
					{t(lang, 'about.unggulCtaStart')} <i class="fa-solid fa-arrow-right text-xs transition-transform duration-200 group-hover:translate-x-1" aria-hidden="true"></i>
				</a>
				<a
					href={lp(lang, '/pelatihan')}
					class="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full border border-white/25 bg-white/5 px-8 font-heading text-sm font-bold text-white backdrop-blur transition-all duration-200 hover:-translate-y-0.5 hover:border-white/60 hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
				>
					{t(lang, 'about.unggulCtaCatalog')}
				</a>
			</div>
		</div>
		<div class="relative h-10 overflow-hidden" aria-hidden="true">
			<svg viewBox="0 0 1440 40" preserveAspectRatio="none" class="h-full w-full">
				<path d="M0,40 C360,0 1080,0 1440,40 L1440,40 L0,40 Z" class="fill-white"></path>
			</svg>
		</div>
	</section>

	<!-- Angka struktural -->
	<section aria-label={t(lang, 'about.unggulFactLabel')} class="bg-white">
		<div class="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
			<dl class="grid grid-cols-1 gap-5 sm:grid-cols-3">
				{#each statItems as stat, i (stat.label)}
					<div use:reveal={{ delay: i * 80 }} class="group relative overflow-hidden rounded-2xl border border-mist bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-royal/40 hover:shadow-xl hover:shadow-slate-900/10">
						<span class="pointer-events-none absolute -top-3 -right-1 font-heading text-7xl leading-none font-extrabold text-ice transition-colors duration-200 group-hover:text-royal/15" aria-hidden="true">
							{stat.value}
						</span>
						<dd class="relative font-heading text-5xl font-extrabold text-royal tabular-nums" aria-hidden="true">{stat.value}</dd>
						<div class="relative mt-3">
							<dt class="font-heading text-base font-bold text-abyss">{stat.label}</dt>
							<dd class="mt-0.5 text-sm text-slate-500">{stat.desc}</dd>
						</div>
					</div>
				{/each}
			</dl>
		</div>
	</section>

	<!-- Keunggulan -->
	<section aria-label="Keunggulan platform" class="border-y border-mist bg-ice/60">
		<div class="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
			<ul class="grid grid-cols-1 gap-5 sm:grid-cols-2">
				{#each featItems as item, i (item.title)}
					<li use:reveal={{ delay: (i % 2) * 80 }} class="group flex gap-4 rounded-2xl border border-mist bg-white p-6 transition-all duration-200 hover:-translate-y-1 hover:border-royal/40 hover:shadow-xl hover:shadow-slate-900/10">
						<span class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-royal to-teal text-lg text-white shadow-md shadow-royal/25 transition-transform duration-200 group-hover:scale-105" aria-hidden="true">
							<i class="fa-solid {item.icon}"></i>
						</span>
						<div>
							<h2 class="font-heading text-base font-bold text-abyss">{item.title}</h2>
							<p class="mt-1 text-sm leading-relaxed text-slate-600">{item.desc}</p>
						</div>
					</li>
				{/each}
			</ul>

			<div use:reveal class="mt-10 rounded-2xl border border-mist bg-white p-6 sm:p-8">
				<div class="flex flex-wrap items-center justify-between gap-3">
					<div>
						<h2 class="font-heading text-lg font-extrabold text-abyss">{t(lang, 'about.unggulFormatTitle')}</h2>
						<p class="mt-1 text-sm text-slate-500">{t(lang, 'about.unggulFormatSub')}</p>
					</div>
				</div>
				<ul class="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
					{#each fmtItems as format, i (format.label)}
						<li use:reveal={{ delay: i * 50 }} class="group rounded-2xl border border-mist bg-ice/50 p-4 text-center transition-all duration-200 hover:-translate-y-0.5 hover:border-teal/50 hover:bg-white hover:shadow-lg hover:shadow-slate-900/10">
							<span class="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-white text-lg text-teal shadow-sm transition-colors duration-200 group-hover:bg-teal group-hover:text-white" aria-hidden="true">
								<i class="fa-solid {format.icon}"></i>
							</span>
							<p class="mt-2 font-heading text-sm font-bold text-abyss">{format.label}</p>
							<p class="mt-0.5 text-[11px] leading-snug text-slate-500">{format.desc}</p>
						</li>
					{/each}
				</ul>
			</div>
		</div>
	</section>

	<!-- CTA -->
	<section aria-label="Ajakan mulai belajar" class="bg-white">
		<div class="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
			<div use:reveal class="relative overflow-hidden rounded-3xl bg-gradient-to-r from-abyss via-royal to-teal p-8 text-center shadow-xl shadow-royal/20 sm:p-12">
				<div class="pointer-events-none absolute inset-0" aria-hidden="true">
					<i class="fa-solid fa-award absolute -top-4 -left-4 text-8xl text-white/10"></i>
					<i class="fa-solid fa-rocket absolute -right-4 -bottom-6 text-8xl text-white/10"></i>
				</div>
				<h2 class="relative font-heading text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
					{t(lang, 'about.unggulCtaTitle')}
				</h2>
				<p class="relative mx-auto mt-2 max-w-xl text-sm leading-relaxed text-white/85 sm:text-base">
					{t(lang, 'about.unggulCtaSub')}
				</p>
				<div class="relative mt-6 flex flex-col justify-center gap-3 sm:flex-row">
					<a
						href={lp(lang, '/register')}
						class="group inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full bg-white px-8 font-heading text-sm font-bold text-abyss shadow-lg transition-all duration-200 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
					>
						{t(lang, 'about.unggulCtaStart')} <i class="fa-solid fa-arrow-right text-xs transition-transform duration-200 group-hover:translate-x-1" aria-hidden="true"></i>
					</a>
					<a
						href={lp(lang, '/pelatihan')}
						class="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full border border-white/40 bg-white/10 px-8 font-heading text-sm font-bold text-white backdrop-blur transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
					>
						{t(lang, 'about.unggulCtaCatalog')}
					</a>
				</div>
			</div>
		</div>
	</section>

	<!-- Sub-halaman lain -->
	<section aria-labelledby="tentang-lain-heading" class="border-t border-mist bg-white">
		<div class="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
			<div use:reveal class="flex flex-wrap items-end justify-between gap-3">
				<h2 id="tentang-lain-heading" class="font-heading text-xl font-extrabold text-abyss sm:text-2xl">
					{t(lang, 'about.exploreTitle')}
				</h2>
				<a href={lp(lang, '/tentang/arti-nama')} class="group inline-flex items-center gap-2 text-sm font-bold text-royal hover:text-royal-hover">
					{t(lang, 'about.exploreFromStart')} <i class="fa-solid fa-arrow-right text-xs transition-transform duration-200 group-hover:translate-x-1" aria-hidden="true"></i>
				</a>
			</div>
			<div class="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-3">
				{#each siblings as sib, i (sib.id)}
					<a
						use:reveal={{ delay: i * 70 }}
						href={lp(lang, sib.href)}
						class="group flex items-center gap-4 rounded-2xl border border-mist bg-white p-5 transition-all duration-200 hover:-translate-y-1 hover:border-royal/40 hover:shadow-xl hover:shadow-slate-900/10 focus-visible:outline-2 focus-visible:outline-royal"
					>
						<span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-ice text-royal transition-colors duration-200 group-hover:bg-royal group-hover:text-white" aria-hidden="true">
							<i class="fa-solid {sib.icon} text-lg"></i>
						</span>
						<span class="min-w-0">
							<span class="block font-heading text-base font-bold text-abyss">{sib.title}</span>
							<span class="mt-0.5 block truncate text-sm text-slate-500">{sib.desc}</span>
						</span>
						<i class="fa-solid fa-arrow-right ml-auto shrink-0 text-xs text-slate-300 transition-all duration-200 group-hover:translate-x-1 group-hover:text-royal" aria-hidden="true"></i>
					</a>
				{/each}
			</div>
		</div>
	</section>
</main>

<PublicFooter />
