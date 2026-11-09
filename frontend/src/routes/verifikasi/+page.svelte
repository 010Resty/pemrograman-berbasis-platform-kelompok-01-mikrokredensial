<script lang="ts">
	import '../../app.css';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import PublicHeader from '$lib/components/public/PublicHeader.svelte';
	import PublicFooter from '$lib/components/public/PublicFooter.svelte';
	import SeoHead from '$lib/components/SeoHead.svelte';
import CertificateCover from '$lib/components/training/molecules/CertificateCover.svelte';
import CertificateLightbox from '$lib/components/training/molecules/CertificateLightbox.svelte';
	import { canonicalPath, getSiteUrl } from '$lib/seo/site';
	import { reveal } from '$lib/actions/reveal';
	import { apiRequest } from '$lib/api/backend';

	interface VerifyResult {
		code: string;
		recipientName: string;
		courseTitle: string;
		moduleTitle: string | null;
		instructorName: string | null;
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

	async function verifyCertificate(event: Event): Promise<void> {
		event.preventDefault();
		const code = verifyCode.trim();
		if (!code) {
			verifyError = 'Masukkan kode sertifikat terlebih dahulu.';
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
			verifyError = e instanceof Error ? e.message : 'Verifikasi gagal. Coba lagi.';
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
			: d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
	}

	const verifikasiJsonLd = [
		{
			'@context': 'https://schema.org',
			'@type': 'WebPage',
			name: 'Verifikasi Sertifikat Online ARISTOTELES',
			description:
				'Periksa keaslian sertifikat mikrokredensial: penerima, pelatihan, tanggal terbit, dan status pencabutan lewat endpoint publik resmi.',
			url: canonicalPath('/verifikasi'),
			inLanguage: 'id-ID',
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
				{ '@type': 'ListItem', position: 1, name: 'Beranda', item: canonicalPath('/') },
				{ '@type': 'ListItem', position: 2, name: 'Verifikasi', item: canonicalPath('/verifikasi') }
			]
		}
	];
</script>

<SeoHead
	title="Verifikasi Sertifikat Online — ARISTOTELES"
	description="Cek keaslian sertifikat mikrokredensial ARISTOTELES online: masukkan kode, lihat penerima, pelatihan & status berlaku. Gratis untuk recruiter."
	path="/verifikasi"
	jsonLd={verifikasiJsonLd}
/>

<PublicHeader active="verifikasi" />

<main>
	<section class="relative overflow-hidden bg-white">
		<div class="pointer-events-none absolute inset-0" aria-hidden="true">
			<div class="absolute -top-32 right-[15%] h-72 w-72 rounded-full bg-ice blur-3xl"></div>
		</div>
		<div class="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
			<p class="flex items-center gap-3 font-heading text-xs font-bold tracking-[0.18em] text-royal uppercase">
				<span class="h-px w-8 bg-royal" aria-hidden="true"></span>
				Verifikasi Sertifikat
			</p>
			<h1 class="mt-3 max-w-3xl font-heading text-4xl font-extrabold tracking-tight text-abyss sm:text-5xl">
				Periksa keaslian sertifikat
			</h1>
			<p class="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
				Masukkan kode sertifikat untuk memeriksa validitas, penerima, pelatihan, dan status
				pencabutan melalui endpoint publik resmi.
			</p>
		</div>
	</section>

	<section aria-labelledby="verifikasi-form-title" class="border-t border-mist bg-ice/60 pb-20">
		<div class="mx-auto max-w-7xl px-4 pt-10 sm:px-6 lg:px-8">
			<div use:reveal class="rounded-2xl border border-mist bg-white p-8 md:p-12">
				<div class="grid grid-cols-1 items-center gap-12 lg:grid-cols-12">
					<div class="lg:col-span-7">
						<h2 id="verifikasi-form-title" class="mb-4 font-heading text-2xl font-extrabold tracking-tight text-abyss sm:text-3xl">
							Periksa validitas sertifikat
						</h2>
						<p class="mb-8 max-w-xl text-sm leading-relaxed text-slate-600 sm:text-base">
							Apakah Anda seorang recruiter atau pimpinan akademik? Masukkan ID Kredensial kandidat
							untuk memeriksa validitas skor, rekaman asesmen, dan keaslian cap digital.
						</p>
						<form class="flex max-w-xl flex-col items-stretch gap-3 sm:flex-row sm:items-center" onsubmit={verifyCertificate} novalidate>
							<div class="relative flex-grow">
								<label for="verify-code" class="sr-only">Kode sertifikat</label>
								<i class="fa-solid fa-qrcode absolute top-1/2 left-3.5 -translate-y-1/2 text-slate-400" aria-hidden="true"></i>
								<input
									id="verify-code"
									type="text"
									bind:value={verifyCode}
									placeholder="Contoh: ED-2026-XXXX"
									autocomplete="off"
									class="w-full rounded-xl border border-mist bg-white py-3 pr-4 pl-11 text-sm text-slate-800 transition-colors duration-200 focus:border-royal focus:ring-2 focus:ring-royal/20 focus:outline-none"
								/>
							</div>
							<button
								type="submit"
								disabled={verifyLoading}
								class="flex min-h-[52px] shrink-0 items-center justify-center gap-2 rounded-xl bg-royal px-6 font-heading text-sm font-bold text-white transition-colors duration-200 hover:bg-royal-hover disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal"
							>
								{#if verifyLoading}
									<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i> Memeriksa…
								{:else}
									<i class="fa-solid fa-magnifying-glass-chart" aria-hidden="true"></i> Periksa Validitas
								{/if}
							</button>
						</form>
						{#if verifyError}
							<p role="alert" class="mt-3 max-w-xl rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-700">{verifyError}</p>
						{/if}
						<ul class="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-xs font-medium text-slate-600">
							<li class="flex items-center gap-2">
								<i class="fa-solid fa-circle-check text-teal" aria-hidden="true"></i> Terhubung ke database sertifikat resmi
							</li>
							<li class="flex items-center gap-2">
								<i class="fa-solid fa-circle-check text-teal" aria-hidden="true"></i> Status aktif &amp; pencabutan tercatat
							</li>
							<li class="flex items-center gap-2">
								<i class="fa-solid fa-circle-check text-teal" aria-hidden="true"></i> Verifikasi gratis tanpa login
							</li>
						</ul>
					</div>
					<div class="lg:col-span-5">
						<div class="space-y-4 rounded-2xl border border-mist bg-ice/60 p-6" aria-live="polite">
							{#if verifyLoading}
								<div class="animate-pulse space-y-3" aria-label="Memeriksa sertifikat">
									<div class="h-5 w-2/3 rounded bg-mist"></div>
									<div class="h-4 w-full rounded bg-mist"></div>
									<div class="h-4 w-5/6 rounded bg-mist"></div>
								</div>
							{:else if verifyResult}
								<div class="flex items-center justify-between border-b border-mist pb-3">
									<div class="flex items-center gap-2">
										{#if verifyResult.status === 'revoked'}
											<i class="fa-solid fa-triangle-exclamation text-lg text-amber-500" aria-hidden="true"></i>
											<span class="font-heading text-sm font-bold text-abyss">Status: Dicabut</span>
										{:else if verifyResult.status === 'superseded'}
											<i class="fa-solid fa-arrows-rotate text-lg text-blue-500" aria-hidden="true"></i>
											<span class="font-heading text-sm font-bold text-abyss">Status: Digantikan</span>
										{:else}
											<i class="fa-solid fa-circle-check text-lg text-teal" aria-hidden="true"></i>
											<span class="font-heading text-sm font-bold text-abyss">Status: Terdaftar &amp; Terverifikasi</span>
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
											courseTitle={verifyResult.courseTitle}
											moduleTitle={verifyResult.moduleTitle}
											issuedLabel={formatTanggalID(verifyResult.issuedAt)}
											status={verifyResult.status === 'revoked' ? 'revoked' : verifyResult.status === 'superseded' ? 'superseded' : 'issued'}
											size="full"
											onview={() => (showCert = true)}
										/>
									</div>
									<div class="flex justify-between gap-4">
										<span class="text-slate-500">Pemilik Sertifikat:</span>
										<span class="text-right font-semibold text-abyss">{verifyResult.recipientName}</span>
									</div>
									<div class="flex justify-between gap-4">
										<span class="text-slate-500">Nama Pelatihan:</span>
										<span class="text-right font-semibold text-abyss">{verifyResult.courseTitle}</span>
									</div>
									{#if verifyResult.moduleTitle}
										<div class="flex justify-between gap-4">
											<span class="text-slate-500">Modul:</span>
											<span class="text-right font-semibold text-abyss">{verifyResult.moduleTitle}</span>
										</div>
									{:else}
										<div class="flex justify-between gap-4">
											<span class="text-slate-500">Tingkat:</span>
											<span class="text-right font-semibold text-abyss">Sertifikat kursus (seluruh modul)</span>
										</div>
									{/if}
									<div class="flex justify-between gap-4">
										<span class="text-slate-500">Tanggal Terbit:</span>
										<span class="font-semibold text-abyss">{formatTanggalID(verifyResult.issuedAt)}</span>
									</div>
								</div>
								{#if verifyResult.status === 'revoked'}
									<p role="alert" class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-semibold text-amber-800">Sertifikat ini telah dicabut dan tidak lagi berlaku.</p>
								{:else if verifyResult.status === 'superseded'}
									<p role="status" class="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs font-semibold text-blue-800">Sertifikat modul ini telah digantikan sertifikat kursus. {verifyResult.revokeReason ?? ''}</p>
								{/if}
							{:else}
								<div class="flex items-center justify-between border-b border-mist pb-3">
									<div class="flex items-center gap-2">
										<i class="fa-solid fa-shield-halved text-lg text-slate-300" aria-hidden="true"></i>
										<span class="font-heading text-sm font-bold text-abyss">Hasil Verifikasi</span>
									</div>
								</div>
								<p class="text-xs leading-relaxed text-slate-500">Masukkan kode sertifikat pada formulir di samping, lalu tekan “Periksa Validitas”. Hasil resmi dari sistem akan tampil di sini.</p>
							{/if}
						</div>
					</div>
				</div>
			</div>
		</div>
	</section>
</main>

<PublicFooter />
