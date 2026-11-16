<script lang="ts">
	import '../../../app.css';
	import PublicHeader from '$lib/components/public/PublicHeader.svelte';
	import PublicFooter from '$lib/components/public/PublicFooter.svelte';
	import SeoHead from '$lib/components/SeoHead.svelte';
	import { canonicalPath, getSiteUrl } from '$lib/seo/site';
	import { resolve } from '$app/paths';
	import { reveal } from '$lib/actions/reveal';
	import { TENTANG_CERT_REQUIREMENTS, TENTANG_STEPS, TENTANG_SUBPAGES } from '$lib/data/tentang';

	const siblings = TENTANG_SUBPAGES.filter((s) => s.id !== 'cara-kerja');

	const caraKerjaJsonLd = [
		{
			'@context': 'https://schema.org',
			'@type': 'AboutPage',
			name: 'Cara Kerja ARISTOTELES — Empat Langkah Menuju Sertifikat',
			description:
				'Pilih pelatihan, pelajari materi modul demi modul, kerjakan kuis dan tugas, lalu raih sertifikat mikrokredensial per modul.',
			url: canonicalPath('/tentang/cara-kerja'),
			inLanguage: 'id-ID',
			isPartOf: { '@type': 'WebSite', name: 'ARISTOTELES', url: getSiteUrl() }
		},
		{
			'@context': 'https://schema.org',
			'@type': 'BreadcrumbList',
			itemListElement: [
				{ '@type': 'ListItem', position: 1, name: 'Beranda', item: canonicalPath('/') },
				{ '@type': 'ListItem', position: 2, name: 'Tentang', item: canonicalPath('/tentang/arti-nama') },
				{ '@type': 'ListItem', position: 3, name: 'Cara Kerja', item: canonicalPath('/tentang/cara-kerja') }
			]
		}
	];
</script>

<SeoHead
	title="Cara Kerja ARISTOTELES — Empat Langkah Menuju Sertifikat"
	description="Pilih pelatihan, pelajari materi modul demi modul, kerjakan kuis dan tugas, lalu raih sertifikat mikrokredensial per modul."
	path="/tentang/cara-kerja"
	jsonLd={caraKerjaJsonLd}
/>

<PublicHeader active="tentang" />

<main>
	<!-- Hero -->
	<section class="relative overflow-hidden bg-white">
		<div class="pointer-events-none absolute inset-0" aria-hidden="true">
			<div class="absolute -top-32 left-1/2 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-ice blur-3xl"></div>
		</div>
		<div class="relative mx-auto max-w-7xl px-4 py-14 text-center sm:px-6 sm:py-16 lg:px-8">
			<p class="flex items-center justify-center gap-3 font-heading text-xs font-bold tracking-[0.18em] text-royal uppercase">
				<span class="h-px w-8 bg-royal" aria-hidden="true"></span>
				Cara Kerja
				<span class="h-px w-8 bg-royal" aria-hidden="true"></span>
			</p>
			<h1 class="mx-auto mt-4 max-w-3xl font-heading text-4xl leading-tight font-extrabold tracking-tight text-abyss sm:text-5xl">
				Empat langkah menuju sertifikat
			</h1>
			<p class="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
				Alur belajar yang jelas dari memilih pelatihan hingga meraih sertifikat mikrokredensial.
			</p>
		</div>
	</section>

	<!-- Langkah -->
	<section aria-label="Langkah belajar" class="border-y border-mist bg-ice/60">
		<div class="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
			<ol class="grid grid-cols-1 gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
				{#each TENTANG_STEPS as step, i (step.title)}
					<li use:reveal={{ delay: i * 70 }} class="border-t-2 border-mist bg-white p-6 pt-6 transition-colors duration-200 hover:border-royal">
						<span class="flex h-10 w-10 items-center justify-center rounded-xl bg-ice text-royal" aria-hidden="true">
							<i class="fa-solid {step.icon}"></i>
						</span>
						<p class="mt-4 font-heading text-xs font-bold tracking-[0.18em] text-royal">
							{String(i + 1).padStart(2, '0')}
						</p>
						<h2 class="mt-1 font-heading text-base font-bold text-abyss">{step.title}</h2>
						<p class="mt-1.5 text-sm leading-relaxed text-slate-600">{step.desc}</p>
						<ul class="mt-3 space-y-1.5 border-t border-mist/70 pt-3">
							{#each step.points as point (point)}
								<li class="flex items-start gap-2 text-xs leading-relaxed text-slate-600">
									<i class="fa-solid fa-check mt-0.5 shrink-0 text-[10px] text-teal" aria-hidden="true"></i>
									{point}
								</li>
							{/each}
						</ul>
					</li>
				{/each}
			</ol>
			<div use:reveal class="mt-10 text-center">
				<a
					href={resolve('/pelatihan')}
					class="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-royal px-8 font-heading text-sm font-bold text-white transition-colors duration-200 hover:bg-royal-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal"
				>
					Mulai dari Katalog <i class="fa-solid fa-arrow-right text-xs" aria-hidden="true"></i>
				</a>
			</div>
		</div>
	</section>

	<!-- Syarat sertifikat -->
	<section aria-labelledby="syarat-heading" class="bg-white">
		<div class="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
			<div class="grid items-center gap-10 lg:grid-cols-2">
				<div use:reveal class="relative overflow-hidden rounded-2xl bg-abyss p-8 sm:p-10">
					<div class="pointer-events-none absolute inset-0" aria-hidden="true">
						<div class="absolute -top-20 -right-20 h-56 w-56 rounded-full bg-royal/30 blur-3xl"></div>
						<i class="fa-solid fa-award absolute -right-6 -bottom-8 text-[10rem] text-white/10"></i>
					</div>
					<p class="relative flex items-center gap-3 font-heading text-xs font-bold tracking-[0.18em] text-teal uppercase">
						<span class="h-px w-8 bg-teal" aria-hidden="true"></span>
						Transparan Sejak Awal
					</p>
					<h2 id="syarat-heading" class="relative mt-3 font-heading text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
						Syarat sertifikat, jelas sebelum mulai
					</h2>
					<p class="relative mt-3 max-w-lg text-sm leading-relaxed text-slate-300 sm:text-base">
						Tidak ada syarat tersembunyi. Penuhi tiga hal ini di setiap modul, dan sertifikat
						diterbitkan setelah tervalidasi.
					</p>
				</div>
				<ol class="space-y-4">
					{#each TENTANG_CERT_REQUIREMENTS as syarat, i (syarat)}
						<li use:reveal={{ delay: i * 80 }} class="flex items-start gap-4 rounded-2xl border border-mist bg-white p-5 transition-colors duration-200 hover:border-royal/40">
							<span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ice font-heading text-sm font-extrabold text-royal" aria-hidden="true">
								{i + 1}
							</span>
							<span class="pt-2 text-sm leading-relaxed font-semibold text-abyss">{syarat}</span>
						</li>
					{/each}
				</ol>
			</div>
		</div>
	</section>

	<!-- Sub-halaman lain -->
	<section aria-labelledby="tentang-lain-heading" class="bg-white">
		<div class="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
			<h2 id="tentang-lain-heading" class="font-heading text-xl font-extrabold text-abyss">
				Jelajahi tentang ARISTOTELES
			</h2>
			<div class="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-3">
				{#each siblings as sib, i (sib.id)}
					<a
						use:reveal={{ delay: i * 70 }}
						href={resolve(sib.href)}
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
