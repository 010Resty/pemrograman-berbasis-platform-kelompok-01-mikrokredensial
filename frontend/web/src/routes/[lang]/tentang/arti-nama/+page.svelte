<script lang="ts">
	import { page } from '$app/state';
	import PublicHeader from '$lib/components/public/PublicHeader.svelte';
	import PublicFooter from '$lib/components/public/PublicFooter.svelte';
	import SeoHead from '$lib/components/SeoHead.svelte';
	import { canonicalPath, getSiteUrl, altUrls } from '$lib/seo/site';
	import { lp, jsonLdLang, type Locale } from '$lib/i18n/locale';
	import { reveal } from '$lib/actions/reveal';
	import { t, ta } from '$lib/i18n/index';
	import { TENTANG_NAME_PARTS, TENTANG_PRINCIPLES, TENTANG_SUBPAGES } from '$lib/data/tentang';
	import layananBg from '$lib/assets/layanan.jpg';

	const lang: Locale = $derived(page.params.lang === 'en' ? 'en' : 'id');

	/** Sub-halaman, makna huruf, dan prinsip mengikuti bahasa aktif. */
	const siblings = $derived.by(() => {
		const text: Record<string, { title: string; desc: string }> = {
			'arti-nama': { title: t(lang, 'about.subArtiNamaTitle'), desc: t(lang, 'about.subArtiNamaDesc') },
			'cara-kerja': { title: t(lang, 'about.subCaraKerjaTitle'), desc: t(lang, 'about.subCaraKerjaDesc') },
			kontak: { title: t(lang, 'about.subKontakTitle'), desc: t(lang, 'about.subKontakDesc') },
			keunggulan: { title: t(lang, 'about.subKeunggulanTitle'), desc: t(lang, 'about.subKeunggulanDesc') }
		};
		return TENTANG_SUBPAGES.filter((s) => s.id !== 'arti-nama').map((s) => ({
			...s,
			title: text[s.id]?.title ?? s.title,
			desc: text[s.id]?.desc ?? s.desc
		}));
	});
	const nameItems = $derived.by(() => {
		const vs = ta(lang, 'about.nameVs');
		return TENTANG_NAME_PARTS.map((p, i) => ({ k: p.k, v: vs[i] ?? p.v }));
	});
	const princItems = $derived.by(() => {
		const titles = ta(lang, 'about.princTitles');
		const descs = ta(lang, 'about.princDescs');
		return TENTANG_PRINCIPLES.map((p, i) => ({
			icon: p.icon,
			title: titles[i] ?? p.title,
			desc: descs[i] ?? p.desc
		}));
	});

	const artiNamaJsonLd = $derived([
		{
			'@context': 'https://schema.org',
			'@type': 'AboutPage',
			name: t(lang, 'about.artiPageTitle'),
			description: t(lang, 'about.artiPageDesc'),
			url: canonicalPath(lp(lang, '/tentang/arti-nama')),
			inLanguage: jsonLdLang(lang),
			isPartOf: { '@type': 'WebSite', name: 'ARISTOTELES', url: getSiteUrl() }
		},
		{
			'@context': 'https://schema.org',
			'@type': 'BreadcrumbList',
			itemListElement: [
				{ '@type': 'ListItem', position: 1, name: t(lang, 'about.crumbHome'), item: canonicalPath(lp(lang, '/')) },
				{ '@type': 'ListItem', position: 2, name: t(lang, 'about.crumbAbout'), item: canonicalPath(lp(lang, '/tentang/arti-nama')) },
				{ '@type': 'ListItem', position: 3, name: t(lang, 'about.subArtiNamaTitle'), item: canonicalPath(lp(lang, '/tentang/arti-nama')) }
			]
		}
	]);
</script>

<SeoHead
	title={t(lang, 'about.artiPageTitle')}
	description={t(lang, 'about.artiPageDesc')}
	path={lp(lang, '/tentang/arti-nama')}
	lang={lang}
	alternates={altUrls(lp(lang, '/tentang/arti-nama'))}
	jsonLd={artiNamaJsonLd}
/>

<PublicHeader active="tentang" />

<main>
	<!-- Hero -->
	<section class="relative overflow-hidden bg-navy">
		<img src={layananBg} alt={t(lang, 'about.artiHeroImgAlt')} class="absolute inset-0 h-full w-full object-cover" loading="eager" fetchpriority="high" />
		<div class="absolute inset-0 bg-gradient-to-b from-navy/85 via-navy/75 to-navy/85" aria-hidden="true"></div>
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
					<li aria-current="page" class="text-teal">{t(lang, 'about.subArtiNamaTitle')}</li>
				</ol>
			</nav>
			<p class="mt-8 flex items-center justify-center gap-3 font-heading text-xs font-bold tracking-[0.18em] text-ice uppercase">
				<span class="h-px w-8 bg-ice/60" aria-hidden="true"></span>
				{t(lang, 'about.artiEyebrow')}
				<span class="h-px w-8 bg-ice/60" aria-hidden="true"></span>
			</p>
			<h1 class="mx-auto mt-4 max-w-3xl font-heading text-4xl leading-tight font-extrabold tracking-tight text-balance text-white sm:text-5xl">
				{t(lang, 'about.artiHeroTitle')}
			</h1>
			<p class="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-slate-300 sm:text-base">
				{t(lang, 'about.artiHeroSub')}
			</p>
			<div class="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
				<a
					href={lp(lang, '/pelatihan')}
					class="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-royal px-8 font-heading text-sm font-bold text-white transition-colors duration-200 hover:bg-royal-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
				>
					{t(lang, 'about.artiCtaCourses')} <i class="fa-solid fa-arrow-right text-xs" aria-hidden="true"></i>
				</a>
				<a
					href={lp(lang, '/verifikasi')}
					class="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/5 px-8 font-heading text-sm font-bold text-white backdrop-blur transition-colors duration-200 hover:border-white/60 hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
				>
					{t(lang, 'about.artiCtaVerify')}
				</a>
			</div>
		</div>
	</section>

	<!-- Arti nama -->
	<section aria-labelledby="arti-nama-heading" class="border-y border-mist bg-ice/60">
		<div class="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
			<div class="grid items-stretch gap-10 lg:grid-cols-2">
				<div use:reveal class="relative min-h-[300px] overflow-hidden rounded-2xl shadow-xl shadow-slate-900/10 lg:min-h-[440px]">
					<img src={layananBg} alt={t(lang, 'about.artiSideImgAlt')} class="absolute inset-0 h-full w-full object-cover" loading="lazy" />
					<div class="absolute inset-0 bg-gradient-to-t from-navy/85 via-navy/20 to-transparent" aria-hidden="true"></div>
					<div class="absolute right-4 bottom-4 left-4">
						<p class="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 font-heading text-xs font-bold text-white backdrop-blur">
							<i class="fa-solid fa-flask text-teal" aria-hidden="true"></i>
							{t(lang, 'about.artiLabBadge')}
						</p>
					</div>
				</div>
				<div>
					<p class="flex items-center gap-3 font-heading text-xs font-bold tracking-[0.18em] text-royal uppercase">
						<span class="h-px w-8 bg-royal" aria-hidden="true"></span>
						{t(lang, 'about.artiSecEyebrow')}
					</p>
					<h2 id="arti-nama-heading" class="mt-3 font-heading text-3xl font-extrabold tracking-tight text-abyss sm:text-4xl">
						{t(lang, 'about.artiSecTitle')}
					</h2>
					<p class="mt-4 text-sm leading-relaxed text-slate-600 sm:text-base">
						{t(lang, 'about.artiSecBodyA')} <strong class="font-semibold text-abyss"
							>Artificial Intelligence Research, Innovation, Science, Technology, and Engineering
							Laboratory for Education and Systems</strong
						>{t(lang, 'about.artiSecBodyB')}
					</p>
				</div>
			</div>
			<ul class="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4" aria-label={t(lang, 'about.artiListLabel')}>
				{#each nameItems as item, i (item.k)}
					<li
						use:reveal={{ delay: i * 80 }}
						class="group relative flex flex-col overflow-hidden rounded-2xl border border-mist bg-white p-6 transition-all duration-200 hover:-translate-y-1 hover:border-royal/40 hover:shadow-xl hover:shadow-slate-900/10"
					>
						<span class="pointer-events-none absolute -top-4 -right-2 font-heading text-[6rem] leading-none font-extrabold text-ice transition-colors duration-200 group-hover:text-royal/15" aria-hidden="true">
							{String(i + 1).padStart(2, '0')}
						</span>
						<div class="relative flex items-center gap-3">
							<span class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-navy font-heading text-xl font-extrabold text-white transition-colors duration-200 group-hover:bg-royal" aria-hidden="true">
								{item.k.charAt(0)}
							</span>
							<span class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-royal/10 text-royal" aria-hidden="true">
								<i class="fa-solid {['fa-brain', 'fa-flask', 'fa-gears', 'fa-network-wired'][i % 4]} text-xl"></i>
							</span>
							<span class="ml-auto font-heading text-xs font-bold text-slate-400 tabular-nums" aria-hidden="true">
								{String(i + 1).padStart(2, '0')}
							</span>
						</div>
						<h3 class="relative mt-4 font-heading text-base font-bold text-abyss">{item.k}</h3>
						<p class="relative mt-1.5 text-sm leading-relaxed text-slate-600">{item.v}</p>
					</li>
				{/each}
			</ul>
		</div>
	</section>

	<!-- Tiga prinsip -->
	<section aria-labelledby="prinsip-heading" class="bg-white">
		<div class="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
			<div class="max-w-2xl">
				<p class="flex items-center gap-3 font-heading text-xs font-bold tracking-[0.18em] text-teal uppercase">
					<span class="h-px w-8 bg-teal" aria-hidden="true"></span>
					{t(lang, 'about.artiPrincEyebrow')}
				</p>
				<h2 id="prinsip-heading" class="mt-3 font-heading text-3xl font-extrabold tracking-tight text-abyss sm:text-4xl">
					{t(lang, 'about.artiPrincTitle')}
				</h2>
				<p class="mt-2 max-w-xl text-sm leading-relaxed text-slate-600 sm:text-base">
					{t(lang, 'about.artiPrincSub')}
				</p>
			</div>
			<div class="mt-10 grid grid-cols-1 gap-5 md:grid-cols-3">
				{#each princItems as prinsip, i (prinsip.title)}
					<article
						use:reveal={{ delay: i * 80 }}
						class="group relative overflow-hidden rounded-2xl border border-mist bg-white p-6 transition-all duration-200 hover:-translate-y-1 hover:border-teal/50 hover:shadow-xl hover:shadow-teal-900/10"
					>
						<span class="pointer-events-none absolute -top-4 -right-2 font-heading text-[6rem] leading-none font-extrabold text-ice transition-colors duration-200 group-hover:text-teal/15" aria-hidden="true">
							{String(i + 1).padStart(2, '0')}
						</span>
						<span class="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-teal/15 text-teal" aria-hidden="true">
							<i class="fa-solid {prinsip.icon} text-xl"></i>
						</span>
						<h3 class="relative mt-4 font-heading text-base font-bold text-abyss">{prinsip.title}</h3>
						<p class="relative mt-1.5 text-sm leading-relaxed text-slate-600">{prinsip.desc}</p>
					</article>
				{/each}
			</div>
		</div>
	</section>

	<!-- CTA -->
	<section aria-label="Ajakan mulai belajar" class="border-t border-mist bg-abyss">
		<div class="relative mx-auto max-w-7xl overflow-hidden px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
			<div class="pointer-events-none absolute inset-0" aria-hidden="true">
				<div class="absolute -top-24 right-[10%] h-64 w-64 rounded-full bg-royal/30 blur-3xl"></div>
				<div class="absolute -bottom-24 left-[5%] h-64 w-64 rounded-full bg-teal/20 blur-3xl"></div>
			</div>
			<div use:reveal class="relative mx-auto max-w-2xl text-center">
				<h2 class="font-heading text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
					{t(lang, 'about.artiCtaTitle')}
				</h2>
				<p class="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-slate-300 sm:text-base">
					{t(lang, 'about.artiCtaSub')}
				</p>
				<div class="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
					<a
						href={lp(lang, '/register')}
						class="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-white px-8 font-heading text-sm font-bold text-abyss transition-all duration-200 hover:-translate-y-0.5 hover:bg-ice focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
					>
						{t(lang, 'about.artiCtaStart')} <i class="fa-solid fa-arrow-right text-xs" aria-hidden="true"></i>
					</a>
					<a
						href={lp(lang, '/pelatihan')}
						class="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/5 px-8 font-heading text-sm font-bold text-white backdrop-blur transition-all duration-200 hover:-translate-y-0.5 hover:border-white/60 hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
					>
						{t(lang, 'about.artiCtaCatalog')}
					</a>
				</div>
			</div>
		</div>
	</section>

	<!-- Sub-halaman lain -->
	<section aria-labelledby="tentang-lain-heading" class="bg-white">
		<div class="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
			<h2 id="tentang-lain-heading" class="font-heading text-xl font-extrabold text-abyss">
				{t(lang, 'about.exploreTitle')}
			</h2>
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
