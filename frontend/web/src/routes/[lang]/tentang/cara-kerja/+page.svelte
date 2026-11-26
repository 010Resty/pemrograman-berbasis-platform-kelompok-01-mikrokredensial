<script lang="ts">
	import { page } from '$app/state';
	import PublicHeader from '$lib/components/public/PublicHeader.svelte';
	import PublicFooter from '$lib/components/public/PublicFooter.svelte';
	import SeoHead from '$lib/components/SeoHead.svelte';
	import { canonicalPath, getSiteUrl, altUrls } from '$lib/seo/site';
	import { lp, jsonLdLang, type Locale } from '$lib/i18n/locale';
	import { reveal } from '$lib/actions/reveal';
	import { t, ta } from '$lib/i18n/index';
	import { TENTANG_CERT_REQUIREMENTS, TENTANG_STEPS, TENTANG_SUBPAGES } from '$lib/data/tentang';

	const lang: Locale = $derived(page.params.lang === 'en' ? 'en' : 'id');

	/** Teks sub-halaman lain mengikuti bahasa aktif; href/ikon tetap dari data. */
	const siblings = $derived.by(() => {
		const text: Record<string, { title: string; desc: string }> = {
			'arti-nama': { title: t(lang, 'about.subArtiNamaTitle'), desc: t(lang, 'about.subArtiNamaDesc') },
			'cara-kerja': { title: t(lang, 'about.subCaraKerjaTitle'), desc: t(lang, 'about.subCaraKerjaDesc') },
			kontak: { title: t(lang, 'about.subKontakTitle'), desc: t(lang, 'about.subKontakDesc') },
			keunggulan: { title: t(lang, 'about.subKeunggulanTitle'), desc: t(lang, 'about.subKeunggulanDesc') }
		};
		return TENTANG_SUBPAGES.filter((s) => s.id !== 'cara-kerja').map((s) => ({
			...s,
			title: text[s.id]?.title ?? s.title,
			desc: text[s.id]?.desc ?? s.desc
		}));
	});

	/** Langkah + poin mengikuti bahasa aktif; ikon/struktur tetap dari data. */
	const steps = $derived.by(() => {
		const titles = ta(lang, 'about.stepTitles');
		const descs = ta(lang, 'about.stepDescs');
		return TENTANG_STEPS.map((s, i) => ({
			icon: s.icon,
			title: titles[i] ?? s.title,
			desc: descs[i] ?? s.desc,
			points: ta(lang, `about.stepPoints${i}`)
		}));
	});

	const certReqs = $derived([
		t(lang, 'about.certReq0'),
		t(lang, 'about.certReq1'),
		t(lang, 'about.certReq2')
	]);

	const caraKerjaJsonLd = $derived([
		{
			'@context': 'https://schema.org',
			'@type': 'AboutPage',
			name: t(lang, 'about.kerjaPageTitle'),
			description: t(lang, 'about.kerjaPageDesc'),
			url: canonicalPath(lp(lang, '/tentang/cara-kerja')),
			inLanguage: jsonLdLang(lang),
			isPartOf: { '@type': 'WebSite', name: 'ARISTOTELES', url: getSiteUrl() }
		},
		{
			'@context': 'https://schema.org',
			'@type': 'BreadcrumbList',
			itemListElement: [
				{ '@type': 'ListItem', position: 1, name: t(lang, 'about.crumbHome'), item: canonicalPath(lp(lang, '/')) },
				{ '@type': 'ListItem', position: 2, name: t(lang, 'about.crumbAbout'), item: canonicalPath(lp(lang, '/tentang/arti-nama')) },
				{ '@type': 'ListItem', position: 3, name: t(lang, 'about.kerjaCrumbCurrent'), item: canonicalPath(lp(lang, '/tentang/cara-kerja')) }
			]
		}
	]);
</script>

<SeoHead
	title={t(lang, 'about.kerjaPageTitle')}
	description={t(lang, 'about.kerjaPageDesc')}
	path={lp(lang, '/tentang/cara-kerja')}
	lang={lang}
	alternates={altUrls(lp(lang, '/tentang/cara-kerja'))}
	jsonLd={caraKerjaJsonLd}
/>

<PublicHeader active="tentang" />

<main>
	<!-- Hero -->
	<section class="relative overflow-hidden bg-abyss">
		<div class="pointer-events-none absolute inset-0" aria-hidden="true">
			<div class="absolute -top-32 right-[10%] h-72 w-72 rounded-full bg-royal/40 blur-3xl"></div>
			<div class="absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-teal/25 blur-3xl"></div>
			<div class="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.1)_1.2px,transparent_1.2px)] bg-[size:22px_22px] opacity-50 [mask-image:radial-gradient(ellipse_70%_60%_at_50%_30%,black,transparent)]"></div>
			<i class="fa-solid fa-route absolute top-16 right-[12%] hidden text-7xl text-white/10 lg:block"></i>
		</div>
		<div class="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
			<nav aria-label="Breadcrumb">
				<ol class="flex flex-wrap items-center gap-2 text-xs font-semibold">
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
					<li aria-current="page" class="text-teal">{t(lang, 'about.kerjaCrumbCurrent')}</li>
				</ol>
			</nav>
			<div class="mt-8 grid items-center gap-12 lg:grid-cols-[1.2fr_1fr]">
				<div>
					<p class="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 font-heading text-xs font-bold tracking-[0.18em] text-teal uppercase backdrop-blur">
						<i class="fa-solid fa-compass" aria-hidden="true"></i>
						{t(lang, 'about.kerjaBadge')}
					</p>
					<h1 class="mt-5 font-heading text-4xl leading-[1.08] font-extrabold tracking-tight text-white sm:text-5xl">
						{t(lang, 'about.kerjaHeroTitle')}
					</h1>
					<p class="mt-4 max-w-xl text-sm leading-relaxed text-slate-300 sm:text-base">
						{t(lang, 'about.kerjaHeroSub')}
					</p>
					<div class="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
						<a
							href={lp(lang, '/pelatihan')}
							class="group inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full bg-white px-8 font-heading text-sm font-bold text-abyss shadow-xl shadow-black/30 transition-all duration-200 hover:-translate-y-0.5 hover:bg-ice focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
						>
							{t(lang, 'about.kerjaCtaCatalog')} <i class="fa-solid fa-arrow-right text-xs transition-transform duration-200 group-hover:translate-x-1" aria-hidden="true"></i>
						</a>
						<a
							href="#syarat"
							class="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full border border-white/25 bg-white/5 px-8 font-heading text-sm font-bold text-white backdrop-blur transition-all duration-200 hover:-translate-y-0.5 hover:border-white/60 hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
						>
							{t(lang, 'about.kerjaCtaReqs')}
						</a>
					</div>
				</div>
				<div class="relative hidden lg:block" aria-hidden="true">
					<div class="absolute inset-x-8 top-4 bottom-4 rotate-2 rounded-3xl border border-white/15 bg-white/5 backdrop-blur-sm"></div>
					<ol class="relative space-y-3 rounded-3xl border border-white/15 bg-abyss/80 p-6 shadow-2xl shadow-black/40 backdrop-blur">
						{#each steps as step, i (step.title)}
							<li class="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
								<span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-heading text-sm font-extrabold {i === TENTANG_STEPS.length - 1 ? 'bg-teal text-white' : 'bg-royal text-white'}">
									{i + 1}
								</span>
								<span class="min-w-0">
									<span class="block truncate font-heading text-sm font-bold text-white">{step.title}</span>
									<span class="block text-xs text-slate-400">{t(lang, 'about.stepOf', { i: i + 1, n: TENTANG_STEPS.length })}</span>
								</span>
								<i class="fa-solid {step.icon} ml-auto text-lg text-white/30"></i>
							</li>
						{/each}
					</ol>
				</div>
			</div>
		</div>
		<div class="relative h-10 overflow-hidden" aria-hidden="true">
			<svg viewBox="0 0 1440 40" preserveAspectRatio="none" class="h-full w-full">
				<path d="M0,40 C360,0 1080,0 1440,40 L1440,40 L0,40 Z" class="fill-white"></path>
			</svg>
		</div>
	</section>

	<!-- Langkah: timeline vertikal -->
	<section aria-label={t(lang, 'about.kerjaFlowLabel')} class="bg-white">
		<div class="mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
			<div use:reveal class="max-w-2xl">
				<p class="flex items-center gap-3 font-heading text-xs font-bold tracking-[0.18em] text-royal uppercase">
					<span class="h-px w-8 bg-royal" aria-hidden="true"></span>
					{t(lang, 'about.kerjaFlowEyebrow')}
				</p>
				<h2 class="mt-3 font-heading text-3xl font-extrabold tracking-tight text-abyss sm:text-4xl">
					{t(lang, 'about.kerjaFlowTitle')}
				</h2>
			</div>
			<ol class="relative mt-12 space-y-6 before:absolute before:top-4 before:bottom-4 before:left-[27px] before:w-0.5 before:bg-gradient-to-b before:from-royal before:via-royal/40 before:to-teal sm:before:left-[31px]" aria-label={t(lang, 'about.kerjaFlowLabel')}>
				{#each steps as step, i (step.title)}
					<li use:reveal={{ delay: i * 70 }} class="relative flex gap-5 sm:gap-7">
						<span class="relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl font-heading text-lg font-extrabold text-white shadow-lg {i === TENTANG_STEPS.length - 1 ? 'bg-gradient-to-br from-teal to-royal shadow-teal/30' : 'bg-gradient-to-br from-royal to-abyss shadow-royal/30'}" aria-hidden="true">
							{String(i + 1).padStart(2, '0')}
						</span>
						<div class="min-w-0 flex-1 rounded-2xl border border-mist bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-royal/40 hover:shadow-xl hover:shadow-slate-900/10 sm:p-7">
							<div class="flex flex-wrap items-center gap-3">
								<span class="flex h-10 w-10 items-center justify-center rounded-xl bg-ice text-royal" aria-hidden="true">
									<i class="fa-solid {step.icon}"></i>
								</span>
								<div class="min-w-0">
									<p class="font-heading text-[11px] font-bold tracking-[0.18em] text-royal uppercase">
										{t(lang, 'about.stepOf', { i: i + 1, n: TENTANG_STEPS.length })}
									</p>
									<h3 class="font-heading text-lg font-bold text-abyss">{step.title}</h3>
								</div>
							</div>
							<p class="mt-3 text-sm leading-relaxed text-slate-600">{step.desc}</p>
							<ul class="mt-4 grid gap-2 border-t border-mist/70 pt-4 sm:grid-cols-2">
								{#each step.points as point (point)}
									<li class="flex items-start gap-2.5 rounded-xl bg-slate-50 px-3 py-2.5 text-xs leading-relaxed font-medium text-slate-700">
										<i class="fa-solid fa-circle-check mt-0.5 shrink-0 text-teal" aria-hidden="true"></i>
										{point}
									</li>
								{/each}
							</ul>
							<div class="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={i + 1} aria-valuemin={1} aria-valuemax={TENTANG_STEPS.length} aria-label={t(lang, 'about.progressLabel', { i: i + 1, n: TENTANG_STEPS.length })}>
								<div class="h-full rounded-full bg-gradient-to-r from-royal to-teal" style="width: {((i + 1) / TENTANG_STEPS.length) * 100}%"></div>
							</div>
						</div>
					</li>
				{/each}
			</ol>
		</div>
	</section>

	<!-- Syarat sertifikat -->
	<section id="syarat" aria-labelledby="syarat-heading" class="scroll-mt-24 border-y border-white/10 bg-abyss">
		<div class="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
			<div class="grid items-center gap-10 lg:grid-cols-[1fr_1.1fr]">
				<div use:reveal class="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur sm:p-10">
					<div class="pointer-events-none absolute inset-0" aria-hidden="true">
						<div class="absolute -top-20 -right-20 h-56 w-56 rounded-full bg-royal/40 blur-3xl"></div>
						<div class="absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-teal/25 blur-3xl"></div>
						<i class="fa-solid fa-award absolute -right-6 -bottom-8 text-[10rem] text-white/10"></i>
					</div>
					<p class="relative flex items-center gap-3 font-heading text-xs font-bold tracking-[0.18em] text-teal uppercase">
						<span class="h-px w-8 bg-teal" aria-hidden="true"></span>
						{t(lang, 'about.kerjaReqEyebrow')}
					</p>
					<h2 id="syarat-heading" class="relative mt-3 font-heading text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
						{t(lang, 'about.kerjaReqTitle')}
					</h2>
					<p class="relative mt-3 max-w-lg text-sm leading-relaxed text-slate-300 sm:text-base">
						{t(lang, 'about.kerjaReqSub')}
					</p>
					<a
						href={lp(lang, '/verifikasi')}
						class="group relative mt-6 inline-flex min-h-[48px] items-center gap-2 rounded-full border border-white/25 bg-white/5 px-6 font-heading text-sm font-bold text-white backdrop-blur transition-all duration-200 hover:-translate-y-0.5 hover:border-teal/60 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
					>
						<i class="fa-solid fa-shield-halved text-teal" aria-hidden="true"></i>
						{t(lang, 'about.kerjaReqCta')} <i class="fa-solid fa-arrow-right text-xs transition-transform duration-200 group-hover:translate-x-1" aria-hidden="true"></i>
					</a>
				</div>
				<ol class="space-y-4">
					{#each certReqs as syarat, i (syarat)}
						<li use:reveal={{ delay: i * 80 }} class="group flex items-start gap-4 rounded-2xl border border-white/10 bg-white p-5 shadow-xl shadow-black/20 transition-all duration-200 hover:-translate-y-0.5 hover:border-teal/50">
							<span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-royal to-teal font-heading text-sm font-extrabold text-white shadow-md shadow-royal/30" aria-hidden="true">
								{i + 1}
							</span>
							<span class="pt-2 text-sm leading-relaxed font-semibold text-abyss">{syarat}</span>
						</li>
					{/each}
				</ol>
			</div>
		</div>
	</section>

	<!-- CTA -->
	<section aria-label="Ajakan mulai belajar" class="bg-white">
		<div class="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
			<div use:reveal class="relative overflow-hidden rounded-3xl bg-gradient-to-r from-abyss via-royal to-teal p-8 text-center shadow-xl shadow-royal/20 sm:p-12">
				<div class="pointer-events-none absolute inset-0" aria-hidden="true">
					<i class="fa-solid fa-graduation-cap absolute -top-4 -left-4 text-8xl text-white/10"></i>
					<i class="fa-solid fa-certificate absolute -right-4 -bottom-6 text-8xl text-white/10"></i>
				</div>
				<h2 class="relative font-heading text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
					{t(lang, 'about.kerjaCtaTitle')}
				</h2>
				<p class="relative mx-auto mt-2 max-w-xl text-sm leading-relaxed text-white/85 sm:text-base">
					{t(lang, 'about.kerjaCtaSub')}
				</p>
				<div class="relative mt-6 flex flex-col justify-center gap-3 sm:flex-row">
					<a
						href={lp(lang, '/pelatihan')}
						class="group inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full bg-white px-8 font-heading text-sm font-bold text-abyss shadow-lg transition-all duration-200 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
					>
						{t(lang, 'about.kerjaCtaCatalog')} <i class="fa-solid fa-arrow-right text-xs transition-transform duration-200 group-hover:translate-x-1" aria-hidden="true"></i>
					</a>
					<a
						href={lp(lang, '/register')}
						class="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full border border-white/40 bg-white/10 px-8 font-heading text-sm font-bold text-white backdrop-blur transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
					>
						{t(lang, 'about.kerjaCtaRegister')}
					</a>
				</div>
			</div>
		</div>
	</section>

	<!-- Sub-halaman lain -->
	<section aria-labelledby="tentang-lain-heading" class="border-t border-mist bg-ice/60">
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
