<script lang="ts">
	import { onDestroy } from 'svelte';
	import { page } from '$app/state';
	import { lp, jsonLdLang, type Locale } from '$lib/i18n/locale';
	import PublicHeader from '$lib/components/public/PublicHeader.svelte';
	import PublicFooter from '$lib/components/public/PublicFooter.svelte';
	import SeoHead from '$lib/components/SeoHead.svelte';
	import { canonicalPath, getSiteUrl, altUrls } from '$lib/seo/site';
	import { reveal } from '$lib/actions/reveal';
	import { t } from '$lib/i18n/index';
	import { toast } from '$lib/stores/toast.svelte';
	import layananBg from '$lib/assets/layanan.jpg';
	import kamiBg from '$lib/assets/kami.jpg';
	import { TENTANG_SUBPAGES } from '$lib/data/tentang';

	const CONTACT_EMAIL = 'admineraristoteles@gmail.com';
	const CONTACT_PHONE = '+6285142521198';
	const CONTACT_PHONE_LABEL = '+62 851-4252-1198';
	const MAPS_URL =
		'https://www.google.com/maps/place/Universitas+Madura/@-7.1916232,113.4755811,17z/data=!3m1!4b1!4m6!3m5!1s0x2dd77e81a24e13b1:0x933c68261d6703ff!8m2!3d-7.1916232!4d113.4755811!16s%2Fg%2F11bw8fv_fx?entry=ttu';
	const MAPS_EMBED = 'https://www.google.com/maps?q=-7.1916232,113.4755811&z=17&output=embed';
	const ADDRESS_NAME = 'Universitas Madura';

	const siblings = $derived.by(() => {
		const text: Record<string, { title: string; desc: string }> = {
			'arti-nama': { title: t(lang, 'about.subArtiNamaTitle'), desc: t(lang, 'about.subArtiNamaDesc') },
			'cara-kerja': { title: t(lang, 'about.subCaraKerjaTitle'), desc: t(lang, 'about.subCaraKerjaDesc') },
			kontak: { title: t(lang, 'about.subKontakTitle'), desc: t(lang, 'about.subKontakDesc') },
			keunggulan: { title: t(lang, 'about.subKeunggulanTitle'), desc: t(lang, 'about.subKeunggulanDesc') }
		};
		return TENTANG_SUBPAGES.filter((s) => s.id !== 'kontak').map((s) => ({
			...s,
			title: text[s.id]?.title ?? s.title,
			desc: text[s.id]?.desc ?? s.desc
		}));
	});
	const lang: Locale = $derived(page.params.lang === 'en' ? 'en' : 'id');

	let name = $state('');
	let email = $state('');
	let phone = $state('');
	let message = $state('');
	let formError = $state('');
	let copied = $state<'email' | 'phone' | null>(null);
	let copyTimer: number | undefined;

	onDestroy(() => {
		if (copyTimer !== undefined) window.clearTimeout(copyTimer);
	});

	function isEmail(v: string): boolean {
		return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
	}

	/** Salin ke clipboard dengan fallback untuk browser lama/non-HTTPS. */
	async function copyText(key: 'email' | 'phone', value: string): Promise<void> {
		try {
			if (navigator.clipboard?.writeText) {
				await navigator.clipboard.writeText(value);
			} else {
				const ta = document.createElement('textarea');
				ta.value = value;
				ta.style.position = 'fixed';
				ta.style.opacity = '0';
				document.body.appendChild(ta);
				ta.select();
				document.execCommand('copy');
				ta.remove();
			}
			copied = key;
			window.clearTimeout(copyTimer);
			copyTimer = window.setTimeout(() => {
				copied = null;
			}, 2000);
		} catch {
			copied = null;
		}
	}

	/** Kirim via aplikasi email pengunjung (tanpa backend formulir). */
	function submitContact(e: SubmitEvent): void {
		e.preventDefault();
		formError = '';
		if (!name.trim() || !email.trim() || !message.trim()) {
			formError = t(lang, 'about.kontakErrRequired');
			toast.error(formError);
			return;
		}
		if (!isEmail(email)) {
			formError = t(lang, 'about.kontakErrEmail');
			toast.error(formError);
			return;
		}
		const subject = encodeURIComponent(`${t(lang, 'about.kontakSubject')} — ${name.trim()}`);
		const body = encodeURIComponent(
			`Nama: ${name.trim()}\nEmail: ${email.trim()}\nTelepon: ${phone.trim() || '-'}\n\n${message.trim()}`
		);
		window.location.href = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
	}

	const kontakJsonLd = $derived([
		{
			'@context': 'https://schema.org',
			'@type': 'ContactPage',
			name: t(lang, 'about.kontakPageTitle'),
			description: t(lang, 'about.kontakPageDesc'),
			url: canonicalPath(lp(lang, '/tentang/kontak')),
			inLanguage: jsonLdLang(lang),
			isPartOf: { '@type': 'WebSite', name: 'ARISTOTELES', url: getSiteUrl() }
		},
		{
			'@context': 'https://schema.org',
			'@type': 'BreadcrumbList',
			itemListElement: [
				{ '@type': 'ListItem', position: 1, name: t(lang, 'about.crumbHome'), item: canonicalPath(lp(lang, '/')) },
				{ '@type': 'ListItem', position: 2, name: t(lang, 'about.crumbAbout'), item: canonicalPath(lp(lang, '/tentang/arti-nama')) },
				{ '@type': 'ListItem', position: 3, name: t(lang, 'about.kontakHeading'), item: canonicalPath(lp(lang, '/tentang/kontak')) }
			]
		}
	]);
</script>

<SeoHead
	title={t(lang, 'about.kontakPageTitle')}
	description={t(lang, 'about.kontakPageDesc')}
	path={lp(lang, '/tentang/kontak')}
	lang={lang}
	alternates={altUrls(lp(lang, '/tentang/kontak'))}
	jsonLd={kontakJsonLd}
/>

<PublicHeader active="tentang" />

<main>
	<!-- Hero -->
	<section aria-labelledby="kontak-heading" class="relative overflow-hidden bg-abyss">
		<img src={kamiBg} alt="" aria-hidden="true" class="absolute inset-0 h-full w-full object-cover opacity-25" loading="eager" fetchpriority="high" />
		<div class="absolute inset-0 bg-gradient-to-b from-abyss/70 via-abyss/85 to-abyss" aria-hidden="true"></div>
		<div class="pointer-events-none absolute inset-0" aria-hidden="true">
			<div class="absolute -top-24 right-[12%] h-64 w-64 rounded-full bg-royal/40 blur-3xl"></div>
			<div class="absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-teal/25 blur-3xl"></div>
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
					<li aria-current="page" class="text-teal">{t(lang, 'about.kontakHeading')}</li>
				</ol>
			</nav>
			<div class="mt-8 max-w-3xl">
				<p class="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 font-heading text-xs font-bold tracking-[0.18em] text-teal uppercase backdrop-blur">
					<i class="fa-solid fa-paper-plane" aria-hidden="true"></i>
					{t(lang, 'about.kontakHeading')}
				</p>
				<h1 id="kontak-heading" class="mt-5 font-heading text-4xl leading-[1.08] font-extrabold tracking-tight text-white sm:text-5xl">
					{t(lang, 'about.kontakHeading')}
				</h1>
				<p class="mt-4 max-w-2xl text-sm leading-relaxed text-slate-300 sm:text-base">
					{t(lang, 'about.kontakHeroSub')}
					{t(lang, 'about.kontakHeroTo')}
					{CONTACT_EMAIL}.
				</p>
				<div class="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
					<a
						href={`mailto:${CONTACT_EMAIL}`}
						class="group inline-flex min-h-[52px] items-center justify-center gap-2.5 rounded-full bg-white px-7 font-heading text-sm font-bold text-abyss shadow-xl shadow-black/30 transition-all duration-200 hover:-translate-y-0.5 hover:bg-ice focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
					>
						<span class="flex h-8 w-8 items-center justify-center rounded-full bg-royal/10 text-royal" aria-hidden="true">
							<i class="fa-solid fa-envelope text-sm"></i>
						</span>
						<span class="break-all">{CONTACT_EMAIL}</span>
					</a>
					<a
						href={`tel:${CONTACT_PHONE}`}
						class="inline-flex min-h-[52px] items-center justify-center gap-2.5 rounded-full border border-white/25 bg-white/5 px-7 font-heading text-sm font-bold text-white backdrop-blur transition-all duration-200 hover:-translate-y-0.5 hover:border-white/60 hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
					>
						<i class="fa-solid fa-phone text-sm text-teal" aria-hidden="true"></i>
						{CONTACT_PHONE_LABEL}
					</a>
				</div>
			</div>
		</div>
		<div class="relative h-10 overflow-hidden" aria-hidden="true">
			<svg viewBox="0 0 1440 40" preserveAspectRatio="none" class="h-full w-full">
				<path d="M0,40 C360,0 1080,0 1440,40 L1440,40 L0,40 Z" class="fill-white"></path>
			</svg>
		</div>
	</section>

	<!-- Formulir + layanan cepat -->
	<section aria-label={t(lang, 'about.kontakFormLabel')} class="bg-white">
		<div class="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
			<div class="grid grid-cols-1 items-start gap-6 lg:grid-cols-[1.15fr_1fr]">
				<form
					use:reveal
					onsubmit={submitContact}
					aria-label={t(lang, 'about.kontakFormLabel')}
					class="rounded-3xl border border-mist bg-white p-6 shadow-xl shadow-slate-900/10 sm:p-8"
					novalidate
				>
					<div class="flex items-center gap-4">
						<span class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-royal to-teal text-lg text-white shadow-md shadow-royal/30" aria-hidden="true">
							<i class="fa-solid fa-pen-to-square"></i>
						</span>
						<div>
							<h2 class="font-heading text-lg font-extrabold text-abyss">{t(lang, 'about.kontakFormLabel')}</h2>
							<p class="text-xs text-slate-500">{t(lang, 'about.kontakMailNote')} {CONTACT_EMAIL}.</p>
						</div>
					</div>
					<div class="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
						<div>
							<label for="kontak-email" class="mb-1.5 block text-xs font-bold text-slate-700">{t(lang, 'about.kontakEmailLabel')}</label>
							<div class="relative">
								<span class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400" aria-hidden="true">
									<i class="fa-solid fa-envelope text-sm"></i>
								</span>
								<input
									id="kontak-email"
									type="email"
									bind:value={email}
									autocomplete="email"
									placeholder="nama@email.com"
									class="w-full rounded-xl border border-mist bg-slate-50 py-2.5 pr-4 pl-11 text-sm text-slate-800 placeholder:text-slate-400 transition-colors focus:border-royal focus:bg-white focus:outline-none focus:ring-4 focus:ring-royal/15"
								/>
							</div>
						</div>
						<div>
							<label for="kontak-phone" class="mb-1.5 block text-xs font-bold text-slate-700">{t(lang, 'about.kontakPhoneLabel')} <span class="font-normal text-slate-400">{t(lang, 'about.kontakOptional')}</span></label>
							<div class="relative">
								<span class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400" aria-hidden="true">
									<i class="fa-solid fa-phone text-sm"></i>
								</span>
								<input
									id="kontak-phone"
									type="tel"
									bind:value={phone}
									autocomplete="tel"
									placeholder="+62 ..."
									class="w-full rounded-xl border border-mist bg-slate-50 py-2.5 pr-4 pl-11 text-sm text-slate-800 placeholder:text-slate-400 transition-colors focus:border-royal focus:bg-white focus:outline-none focus:ring-4 focus:ring-royal/15"
								/>
							</div>
						</div>
					</div>
					<div class="mt-4">
						<label for="kontak-name" class="mb-1.5 block text-xs font-bold text-slate-700">{t(lang, 'about.kontakNameLabel')}</label>
						<div class="relative">
							<span class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400" aria-hidden="true">
								<i class="fa-solid fa-user text-sm"></i>
							</span>
							<input
								id="kontak-name"
								type="text"
								bind:value={name}
								autocomplete="name"
								maxlength={100}
								placeholder={t(lang, 'about.kontakNamePh')}
								class="w-full rounded-xl border border-mist bg-slate-50 py-2.5 pr-4 pl-11 text-sm text-slate-800 placeholder:text-slate-400 transition-colors focus:border-royal focus:bg-white focus:outline-none focus:ring-4 focus:ring-royal/15"
							/>
						</div>
					</div>
					<div class="mt-4">
						<label for="kontak-message" class="mb-1.5 block text-xs font-bold text-slate-700">{t(lang, 'about.kontakMessageLabel')}</label>
						<textarea
							id="kontak-message"
							bind:value={message}
							rows={5}
							maxlength={2000}
							placeholder={t(lang, 'about.kontakMessagePh')}
							class="w-full resize-y rounded-xl border border-mist bg-slate-50 px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 transition-colors focus:border-royal focus:bg-white focus:outline-none focus:ring-4 focus:ring-royal/15"
						></textarea>
					</div>
					{#if formError}
						<p role="alert" class="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-700">
							<i class="fa-solid fa-circle-exclamation mt-0.5 shrink-0" aria-hidden="true"></i>
							{formError}
						</p>
					{/if}
					<button
						type="submit"
						class="group mt-5 inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-royal to-teal px-8 font-heading text-sm font-bold text-white shadow-lg shadow-royal/25 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal"
					>
						{t(lang, 'about.kontakSubmit')} <i class="fa-solid fa-paper-plane text-xs transition-transform duration-200 group-hover:translate-x-1 group-hover:-translate-y-0.5" aria-hidden="true"></i>
					</button>
				</form>

				<aside use:reveal aria-labelledby="layanan-heading" class="relative overflow-hidden rounded-3xl bg-abyss p-6 text-white shadow-xl shadow-slate-900/20 sm:p-8 lg:sticky lg:top-24">
					<img src={layananBg} alt="" aria-hidden="true" class="absolute inset-0 h-full w-full object-cover opacity-20" loading="lazy" />
					<div class="absolute inset-0 bg-gradient-to-t from-abyss via-abyss/85 to-abyss/60" aria-hidden="true"></div>
					<div class="relative">
						<h2 id="layanan-heading" class="font-heading text-xl font-extrabold">{t(lang, 'about.kontakFastTitle')}</h2>
						<p class="mt-2 text-sm leading-relaxed text-slate-300">
							{t(lang, 'about.kontakFastSub')}
						</p>
						<ul class="mt-5 space-y-2.5">
							<li>
								<a
									href={lp(lang, '/register')}
									class="group flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur transition-all duration-200 hover:-translate-y-0.5 hover:border-teal/50 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white"
								>
									<span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-royal to-teal text-base text-white" aria-hidden="true">
										<i class="fa-solid fa-user-plus"></i>
									</span>
									<span class="min-w-0">
										<span class="block font-heading text-sm font-bold text-white">{t(lang, 'about.kontakRegTitle')}</span>
										<span class="block truncate text-xs text-slate-300">{t(lang, 'about.kontakRegDesc')}</span>
									</span>
									<i class="fa-solid fa-arrow-right ml-auto shrink-0 text-xs text-slate-400 transition-all duration-200 group-hover:translate-x-1 group-hover:text-teal" aria-hidden="true"></i>
								</a>
							</li>
							<li>
								<a
									href="/user/pembayaran"
									class="group flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur transition-all duration-200 hover:-translate-y-0.5 hover:border-teal/50 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white"
								>
									<span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-base text-teal" aria-hidden="true">
										<i class="fa-solid fa-ticket"></i>
									</span>
									<span class="min-w-0">
										<span class="block font-heading text-sm font-bold text-white">{t(lang, 'about.kontakPayTitle')}</span>
										<span class="block truncate text-xs text-slate-300">{t(lang, 'about.kontakPayDesc')}</span>
									</span>
									<i class="fa-solid fa-arrow-right ml-auto shrink-0 text-xs text-slate-400 transition-all duration-200 group-hover:translate-x-1 group-hover:text-teal" aria-hidden="true"></i>
								</a>
							</li>
							<li>
								<a
									href={lp(lang, '/verifikasi')}
									class="group flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur transition-all duration-200 hover:-translate-y-0.5 hover:border-teal/50 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white"
								>
									<span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-base text-teal" aria-hidden="true">
										<i class="fa-solid fa-award"></i>
									</span>
									<span class="min-w-0">
										<span class="block font-heading text-sm font-bold text-white">{t(lang, 'about.kontakVerifyTitle')}</span>
										<span class="block truncate text-xs text-slate-300">{t(lang, 'about.kontakVerifyDesc')}</span>
									</span>
									<i class="fa-solid fa-arrow-right ml-auto shrink-0 text-xs text-slate-400 transition-all duration-200 group-hover:translate-x-1 group-hover:text-teal" aria-hidden="true"></i>
								</a>
							</li>
						</ul>
					</div>
				</aside>
			</div>
		</div>
	</section>

	<!-- Info kontak -->
	<section aria-label="Informasi kontak" class="border-y border-mist bg-ice/60">
		<div class="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
			<div class="grid grid-cols-1 gap-5 md:grid-cols-3">
				<div use:reveal class="group flex flex-col rounded-3xl border border-mist bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-900/10">
					<div class="flex items-center gap-3">
						<span class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-royal to-royal-hover text-xl text-white shadow-md shadow-royal/30" aria-hidden="true">
							<i class="fa-solid fa-envelope"></i>
						</span>
						<p class="font-heading text-xs font-bold tracking-[0.14em] text-slate-500 uppercase">{t(lang, 'about.kontakEmailLabel')}</p>
					</div>
					<a
						href={`mailto:${CONTACT_EMAIL}`}
						class="mt-4 flex min-h-[44px] items-center rounded-xl bg-royal/5 px-4 text-sm font-bold break-all text-royal transition-colors hover:bg-royal/10 focus-visible:outline-2 focus-visible:outline-royal"
					>
						{CONTACT_EMAIL}
					</a>
					<p class="mt-2 text-xs text-slate-500">{t(lang, 'about.kontakEmailCardDesc')}</p>
					<div class="mt-auto pt-4" aria-live="polite">
						<button
							type="button"
							onclick={() => void copyText('email', CONTACT_EMAIL)}
							class="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-mist px-4 text-xs font-bold text-slate-700 transition-colors hover:border-royal hover:text-royal focus-visible:outline-2 focus-visible:outline-royal"
						>
							<i class={`fa-solid ${copied === 'email' ? 'fa-check text-teal' : 'fa-copy'}`} aria-hidden="true"></i>
							{copied === 'email' ? t(lang, 'about.kontakCopied') : t(lang, 'about.kontakCopyEmail')}
						</button>
					</div>
				</div>
				<div use:reveal={{ delay: 80 }} class="group flex flex-col rounded-3xl border border-mist bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-900/10">
					<div class="flex items-center gap-3">
						<span class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-teal to-royal text-xl text-white shadow-md shadow-teal/30" aria-hidden="true">
							<i class="fa-solid fa-phone"></i>
						</span>
						<p class="font-heading text-xs font-bold tracking-[0.14em] text-slate-500 uppercase">{t(lang, 'about.kontakPhoneLabel')}</p>
					</div>
					<a
						href={`tel:${CONTACT_PHONE}`}
						class="mt-4 flex min-h-[44px] items-center rounded-xl bg-teal/10 px-4 text-sm font-bold text-teal transition-colors hover:bg-teal/15 focus-visible:outline-2 focus-visible:outline-teal"
					>
						{CONTACT_PHONE_LABEL}
					</a>
					<p class="mt-2 text-xs text-slate-500">{t(lang, 'about.kontakPhoneCardDesc')}</p>
					<div class="mt-auto pt-4" aria-live="polite">
						<button
							type="button"
							onclick={() => void copyText('phone', CONTACT_PHONE)}
							class="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-mist px-4 text-xs font-bold text-slate-700 transition-colors hover:border-teal hover:text-teal focus-visible:outline-2 focus-visible:outline-teal"
						>
							<i class={`fa-solid ${copied === 'phone' ? 'fa-check text-teal' : 'fa-copy'}`} aria-hidden="true"></i>
							{copied === 'phone' ? t(lang, 'about.kontakCopied') : t(lang, 'about.kontakCopyPhone')}
						</button>
					</div>
				</div>
				<div use:reveal={{ delay: 160 }} class="group flex flex-col rounded-3xl border border-mist bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-900/10">
					<div class="flex items-center gap-3">
						<span class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-xl text-white shadow-md shadow-orange-500/30" aria-hidden="true">
							<i class="fa-solid fa-location-dot"></i>
						</span>
						<p class="font-heading text-xs font-bold tracking-[0.14em] text-slate-500 uppercase">{t(lang, 'about.kontakAddrLabel')}</p>
					</div>
					<p class="mt-4 flex min-h-[44px] items-center rounded-xl bg-amber-50 px-4 text-sm font-bold text-slate-800">
						{ADDRESS_NAME}
					</p>
					<p class="mt-2 text-xs text-slate-500">{t(lang, 'about.kontakAddrCardDesc')}</p>
					<div class="mt-auto pt-4">
						<a
							href={MAPS_URL}
							target="_blank"
							rel="noopener"
							class="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-mist px-4 text-xs font-bold text-slate-700 transition-colors hover:border-amber-500 hover:text-amber-600 focus-visible:outline-2 focus-visible:outline-amber-500"
						>
							<i class="fa-solid fa-map-location-dot" aria-hidden="true"></i>
							{t(lang, 'about.kontakMapsOpen')}
						</a>
					</div>
				</div>
			</div>

			<div use:reveal class="mt-6 overflow-hidden rounded-3xl border border-mist bg-white shadow-xl shadow-slate-900/10">
				<iframe
					title={`${t(lang, 'about.kontakMapTitle')} ${ADDRESS_NAME}`}
					src={MAPS_EMBED}
					class="h-80 w-full border-0"
					loading="lazy"
					referrerpolicy="no-referrer-when-downgrade"
					allowfullscreen
				></iframe>
				<div class="flex flex-col items-stretch gap-4 bg-abyss p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
					<div class="flex items-center gap-4">
						<span class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-500/15 text-xl text-red-400" aria-hidden="true">
							<i class="fa-solid fa-map-pin"></i>
						</span>
						<div>
							<h2 class="font-heading text-base font-bold text-white">{ADDRESS_NAME}</h2>
							<p class="mt-0.5 text-xs text-slate-300">{t(lang, 'about.kontakRouteDesc')}</p>
						</div>
					</div>
					<a
						href={MAPS_URL}
						target="_blank"
						rel="noopener"
						class="group inline-flex min-h-[48px] shrink-0 items-center justify-center gap-2 rounded-full bg-white px-6 py-2.5 font-heading text-xs font-bold text-abyss transition-all duration-200 hover:-translate-y-0.5 hover:bg-ice focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
					>
						<i class="fa-solid fa-diamond-turn-right" aria-hidden="true"></i> {t(lang, 'about.kontakDirections')}
					</a>
				</div>
			</div>
		</div>
	</section>

	<!-- Sub-halaman lain -->
	<section aria-labelledby="tentang-lain-heading" class="bg-white">
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
