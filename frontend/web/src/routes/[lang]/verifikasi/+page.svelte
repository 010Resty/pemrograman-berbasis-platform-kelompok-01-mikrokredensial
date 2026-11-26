<script lang="ts">
	import { page } from '$app/state';
	import PublicHeader from '$lib/components/public/PublicHeader.svelte';
	import PublicFooter from '$lib/components/public/PublicFooter.svelte';
	import SeoHead from '$lib/components/SeoHead.svelte';
import CertificateCover from '$lib/components/training/molecules/CertificateCover.svelte';
import CertificateLightbox from '$lib/components/training/molecules/CertificateLightbox.svelte';
	import { canonicalPath, getSiteUrl, altUrls } from '$lib/seo/site';
	import { lp, jsonLdLang, type Locale } from '$lib/i18n/locale';
	import { intlLocale, t } from '$lib/i18n/index';
	import { reveal } from '$lib/actions/reveal';
	import { apiRequest } from '$lib/api/backend';
	import { fileUrl } from '$lib/api/courses';
	import verifikasiBg from '$lib/assets/verifikasi.jpg';
	import { toast } from '$lib/stores/toast.svelte';

	interface VerifyResult {
		code: string;
		recipientName: string;
		courseTitle: string;
		moduleTitle: string | null;
		instructorName: string | null;
		signatureUrl: string | null;
		status: string;
		revokeReason: string | null;
		issuedAt: string;
		revokedAt: string | null;
	}

	let verifyCode = $state('');
	let verifyLoading = $state(false);
	let verifyError = $state('');
	let verifyDone = $state(false);
	let verifyResult = $state<VerifyResult | null>(null);

	const lang: Locale = $derived(page.params.lang === 'en' ? 'en' : 'id');

	async function verifyCertificate(event: Event): Promise<void> {
		event.preventDefault();
		const code = verifyCode.trim();
		if (!code) {
			verifyError = t(lang, 'verifyCert.errEmpty');
			toast.error(verifyError);
			return;
		}
		verifyLoading = true;
		verifyError = '';
		verifyResult = null;
		verifyDone = false;
		try {
			const data = await apiRequest<VerifyResult>(
				`/certificates/verify/${encodeURIComponent(code)}`
			);
			verifyResult = data;
		} catch (e) {
			verifyError = e instanceof Error ? e.message : t(lang, 'verifyCert.errFail');
			toast.error(verifyError);
		} finally {
			verifyLoading = false;
			verifyDone = true;
		}
	}

	// QR sertifikat menaut ke ?code=… — verifikasi otomatis sekali saat dibuka.
	let autoVerifyStarted = $state(false);
	let showCert = $state(false);
	$effect(() => {
		if (autoVerifyStarted) return;
		autoVerifyStarted = true;
		const q = page.url.searchParams.get('code')?.trim();
		if (q) {
			verifyCode = q;
			void verifyCertificate(new Event('submit'));
		}
	});

	function formatTanggalID(iso: string): string {
		const d = new Date(iso);
		return Number.isNaN(d.getTime())
			? iso
			: d.toLocaleDateString(intlLocale(lang), { day: 'numeric', month: 'long', year: 'numeric' });
	}

	const verifikasiJsonLd = $derived([
		{
			'@context': 'https://schema.org',
			'@type': 'WebPage',
			name: 'Verifikasi Sertifikat Online ARISTOTELES',
			description:
				'Periksa keaslian sertifikat mikrokredensial: penerima, pelatihan, tanggal terbit, dan status pencabutan lewat endpoint publik resmi.',
			url: canonicalPath(lp(lang, '/verifikasi')),
			inLanguage: jsonLdLang(lang),
			isPartOf: { '@type': 'WebSite', name: 'ARISTOTELES', url: getSiteUrl() }
		},
		{
			'@context': 'https://schema.org',
			'@type': 'FAQPage',
			mainEntity: [
				{
					'@type': 'Question',
					name: 'Bagaimana cara memverifikasi sertifikat ARISTOTELES?',
					acceptedAnswer: {
						'@type': 'Answer',
						text: 'Masukkan kode sertifikat (contoh ED-2026-XXXX) pada formulir verifikasi untuk memeriksa penerima, pelatihan, tanggal terbit, dan status pencabutan.'
					}
				},
				{
					'@type': 'Question',
					name: 'Informasi apa yang ditampilkan hasil verifikasi?',
					acceptedAnswer: {
						'@type': 'Answer',
						text: 'Hasil verifikasi menampilkan kode sertifikat, nama penerima, judul pelatihan dan modul, tanggal terbit, serta status berlaku atau dicabut.'
					}
				}
			]
		},
		{
			'@context': 'https://schema.org',
			'@type': 'BreadcrumbList',
			itemListElement: [
				{ '@type': 'ListItem', position: 1, name: t(lang, 'common.home'), item: canonicalPath(lp(lang, '/')) },
				{ '@type': 'ListItem', position: 2, name: t(lang, 'nav.verifikasi'), item: canonicalPath(lp(lang, '/verifikasi')) }
			]
		}
	]);
</script>

<SeoHead
	title={t(lang, 'verifyCert.pageTitle')}
	description={t(lang, 'verifyCert.pageDesc')}
	path={lp(lang, '/verifikasi')}
	lang={lang}
	alternates={altUrls(lp(lang, '/verifikasi'))}
	jsonLd={verifikasiJsonLd}
/>

<PublicHeader active="verifikasi" />

<main>
	<!-- Hero -->
	<section class="relative overflow-hidden bg-abyss">
		<img src={verifikasiBg} alt="" aria-hidden="true" class="absolute inset-0 h-full w-full object-cover" loading="eager" fetchpriority="high" />
		<div class="absolute inset-0 bg-gradient-to-b from-abyss/80 via-abyss/70 to-abyss" aria-hidden="true"></div>
		<div class="pointer-events-none absolute inset-0" aria-hidden="true">
			<div class="absolute -top-24 right-[12%] h-64 w-64 rounded-full bg-royal/40 blur-3xl"></div>
			<div class="absolute -bottom-24 -left-10 h-56 w-56 rounded-full bg-teal/25 blur-3xl"></div>
			<i class="fa-solid fa-shield-halved absolute top-16 right-[10%] hidden text-7xl text-white/10 lg:block"></i>
			<div class="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.08)_1.2px,transparent_1.2px)] bg-[size:22px_22px] opacity-50 [mask-image:radial-gradient(ellipse_70%_60%_at_50%_30%,black,transparent)]"></div>
		</div>
		<div class="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
			<nav aria-label="Breadcrumb">
				<ol class="flex flex-wrap items-center gap-2 text-xs font-semibold">
					<li>
						<a href={lp(lang, '/')} class="rounded text-slate-300 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-white">
							{t(lang, 'common.home')}
						</a>
					</li>
					<li aria-hidden="true" class="text-slate-500">/</li>
					<li aria-current="page" class="text-teal">{t(lang, 'nav.verifikasi')}</li>
				</ol>
			</nav>
			<div class="mt-8 max-w-3xl">
				<p class="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 font-heading text-xs font-bold tracking-[0.18em] text-teal uppercase backdrop-blur">
					<i class="fa-solid fa-shield-halved" aria-hidden="true"></i>
					{t(lang, 'verifyCert.eyebrow')}
				</p>
				<h1 class="mt-5 font-heading text-4xl leading-[1.08] font-extrabold tracking-tight text-white sm:text-5xl">
					{t(lang, 'verifyCert.h1')}
				</h1>
				<p class="mt-4 max-w-2xl text-sm leading-relaxed text-slate-300 sm:text-base">
					{t(lang, 'verifyCert.sub')}
				</p>
			</div>
		</div>
		<div class="relative h-10 overflow-hidden" aria-hidden="true">
			<svg viewBox="0 0 1440 40" preserveAspectRatio="none" class="h-full w-full">
				<path d="M0,40 C360,0 1080,0 1440,40 L1440,40 L0,40 Z" class="fill-white"></path>
			</svg>
		</div>
	</section>

	<section aria-labelledby="verifikasi-form-title" class="bg-white pb-20">
		<div class="mx-auto max-w-7xl px-4 pt-10 sm:px-6 lg:px-8">
			<div use:reveal class="rounded-3xl border border-mist bg-white p-6 shadow-xl shadow-slate-900/10 sm:p-8">
				<div class="grid grid-cols-1 items-start gap-10 lg:grid-cols-12">
					<div class="lg:col-span-7">
						<div class="flex items-center gap-4">
							<span class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-royal to-teal text-lg text-white shadow-md shadow-royal/30" aria-hidden="true">
								<i class="fa-solid fa-qrcode"></i>
							</span>
							<h2 id="verifikasi-form-title" class="font-heading text-2xl font-extrabold tracking-tight text-abyss">
								{t(lang, 'verifyCert.formTitle')}
							</h2>
						</div>
						<p class="mt-3 mb-6 max-w-xl text-sm leading-relaxed text-slate-600 sm:text-base">
							{t(lang, 'verifyCert.formSub')}
						</p>
						<form class="flex max-w-xl flex-col items-stretch gap-3" onsubmit={verifyCertificate} novalidate>
							<div class="relative flex-grow">
								<label for="verify-code" class="sr-only">{t(lang, 'verifyCert.codeLabel')}</label>
								<i class="fa-solid fa-qrcode absolute top-1/2 left-4 -translate-y-1/2 text-slate-400" aria-hidden="true"></i>
								<input
									id="verify-code"
									type="text"
									bind:value={verifyCode}
									placeholder={t(lang, 'verifyCert.codePh')}
									autocomplete="off"
									class="w-full rounded-xl border border-mist bg-slate-50 py-3.5 pr-4 pl-11 font-mono text-sm font-bold tracking-wider text-slate-800 uppercase placeholder:font-sans placeholder:font-normal placeholder:normal-case placeholder:tracking-normal placeholder:text-slate-400 transition-colors duration-200 focus:border-royal focus:bg-white focus:ring-4 focus:ring-royal/15 focus:outline-none"
								/>
							</div>
							<button
								type="submit"
								disabled={verifyLoading}
								class="group inline-flex min-h-[52px] shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-royal to-teal px-8 font-heading text-sm font-bold text-white shadow-lg shadow-royal/25 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal"
							>
								{#if verifyLoading}
									<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i> {t(lang, 'verifyCert.checking')}
								{:else}
									<i class="fa-solid fa-magnifying-glass-chart transition-transform duration-200 group-hover:scale-110" aria-hidden="true"></i> {t(lang, 'verifyCert.check')}
								{/if}
							</button>
						</form>
						{#if verifyError}
							<p role="alert" class="mt-3 flex max-w-xl items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-700">
								<i class="fa-solid fa-circle-exclamation mt-0.5 shrink-0" aria-hidden="true"></i>
								{verifyError}
							</p>
						{/if}
						<ul class="mt-6 grid gap-2 sm:grid-cols-3">
							<li class="flex items-center gap-2 rounded-xl bg-ice/60 px-3 py-2.5 text-xs font-semibold text-slate-700">
								<i class="fa-solid fa-circle-check shrink-0 text-teal" aria-hidden="true"></i> {t(lang, 'verifyCert.trust1')}
							</li>
							<li class="flex items-center gap-2 rounded-xl bg-ice/60 px-3 py-2.5 text-xs font-semibold text-slate-700">
								<i class="fa-solid fa-circle-check shrink-0 text-teal" aria-hidden="true"></i> {t(lang, 'verifyCert.trust2')}
							</li>
							<li class="flex items-center gap-2 rounded-xl bg-ice/60 px-3 py-2.5 text-xs font-semibold text-slate-700">
								<i class="fa-solid fa-circle-check shrink-0 text-teal" aria-hidden="true"></i> {t(lang, 'verifyCert.trust3')}
							</li>
						</ul>
					</div>
					<div class="lg:col-span-5 lg:sticky lg:top-24">
						<div class="space-y-4 rounded-3xl border border-mist bg-white p-6 shadow-xl shadow-slate-900/10" aria-live="polite">
							{#if verifyLoading}
								<div class="animate-pulse space-y-3" aria-label="{t(lang, 'verifyCert.checkingLabel')}">
									<div class="h-5 w-2/3 rounded bg-mist"></div>
									<div class="h-4 w-full rounded bg-mist"></div>
									<div class="h-4 w-5/6 rounded bg-mist"></div>
								</div>
							{:else if verifyResult}
								<div class="flex items-center justify-between border-b border-mist pb-3">
									<div class="flex items-center gap-2">
										{#if verifyResult.status === 'revoked'}
											<i class="fa-solid fa-triangle-exclamation text-lg text-amber-500" aria-hidden="true"></i>
											<span class="font-heading text-sm font-bold text-abyss">{t(lang, 'verifyCert.stRevoked')}</span>
										{:else if verifyResult.status === 'superseded'}
											<i class="fa-solid fa-arrows-rotate text-lg text-blue-500" aria-hidden="true"></i>
											<span class="font-heading text-sm font-bold text-abyss">{t(lang, 'verifyCert.stSuperseded')}</span>
										{:else}
											<i class="fa-solid fa-circle-check text-lg text-teal" aria-hidden="true"></i>
											<span class="font-heading text-sm font-bold text-abyss">{t(lang, 'verifyCert.stOk')}</span>
										{/if}
									</div>
									<span class="font-mono text-xs text-slate-400">{verifyResult.code}</span>
								</div>
								<div class="space-y-3 text-sm">
									{#if verifyResult}
								<CertificateLightbox bind:open={showCert} label={`Sertifikat ${verifyResult.code}`}>
									<CertificateCover
										code={verifyResult.code}
										recipientName={verifyResult.recipientName}
										instructorName={verifyResult.instructorName}
										signatureUrl={verifyResult.signatureUrl ? fileUrl(verifyResult.signatureUrl) : null}
										courseTitle={verifyResult.courseTitle}
										moduleTitle={verifyResult.moduleTitle}
										issuedLabel={formatTanggalID(verifyResult.issuedAt)}
										status={verifyResult.status === 'revoked' ? 'revoked' : verifyResult.status === 'superseded' ? 'superseded' : 'issued'}
										size="full"
									/>
								</CertificateLightbox>
								{/if}
								<div class="overflow-hidden rounded-xl border border-mist">
										<CertificateCover
											code={verifyResult.code}
											recipientName={verifyResult.recipientName}
											instructorName={verifyResult.instructorName}
											signatureUrl={verifyResult.signatureUrl ? fileUrl(verifyResult.signatureUrl) : null}
											courseTitle={verifyResult.courseTitle}
											moduleTitle={verifyResult.moduleTitle}
											issuedLabel={formatTanggalID(verifyResult.issuedAt)}
											status={verifyResult.status === 'revoked' ? 'revoked' : verifyResult.status === 'superseded' ? 'superseded' : 'issued'}
											size="full"
											onview={() => (showCert = true)}
										/>
									</div>
									<div class="flex justify-between gap-4">
										<span class="text-slate-500">{t(lang, 'verifyCert.owner')}</span>
										<span class="text-right font-semibold text-abyss">{verifyResult.recipientName}</span>
									</div>
									<div class="flex justify-between gap-4">
										<span class="text-slate-500">{t(lang, 'verifyCert.course')}</span>
										<span class="text-right font-semibold text-abyss">{verifyResult.courseTitle}</span>
									</div>
									{#if verifyResult.moduleTitle}
										<div class="flex justify-between gap-4">
											<span class="text-slate-500">{t(lang, 'verifyCert.module')}</span>
											<span class="text-right font-semibold text-abyss">{verifyResult.moduleTitle}</span>
										</div>
									{:else}
										<div class="flex justify-between gap-4">
											<span class="text-slate-500">{t(lang, 'verifyCert.level')}</span>
											<span class="text-right font-semibold text-abyss">{t(lang, 'verifyCert.levelCourse')}</span>
										</div>
									{/if}
									<div class="flex justify-between gap-4">
										<span class="text-slate-500">{t(lang, 'verifyCert.issuedAt')}</span>
										<span class="font-semibold text-abyss">{formatTanggalID(verifyResult.issuedAt)}</span>
									</div>
								</div>
								{#if verifyResult.status === 'revoked'}
									<p role="alert" class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-semibold text-amber-800">{t(lang, 'verifyCert.revokedNote')}</p>
								{:else if verifyResult.status === 'superseded'}
									<p role="status" class="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs font-semibold text-blue-800">{t(lang, 'verifyCert.supersededNote')} {verifyResult.revokeReason ?? ''}</p>
								{/if}
							{:else}
								<div class="flex items-center justify-between border-b border-mist pb-3">
									<div class="flex items-center gap-2">
										<i class="fa-solid fa-shield-halved text-lg text-slate-300" aria-hidden="true"></i>
										<span class="font-heading text-sm font-bold text-abyss">{t(lang, 'verifyCert.emptyTitle')}</span>
									</div>
								</div>
								<p class="text-xs leading-relaxed text-slate-500">{t(lang, 'verifyCert.emptySub')}</p>
							{/if}
						</div>
					</div>
				</div>
			</div>
		</div>
	</section>
</main>

<PublicFooter />
