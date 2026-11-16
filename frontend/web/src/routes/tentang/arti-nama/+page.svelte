<script lang="ts">
	import '../../../app.css';
	import PublicHeader from '$lib/components/public/PublicHeader.svelte';
	import PublicFooter from '$lib/components/public/PublicFooter.svelte';
	import SeoHead from '$lib/components/SeoHead.svelte';
	import { canonicalPath, getSiteUrl } from '$lib/seo/site';
	import { resolve } from '$app/paths';
	import { reveal } from '$lib/actions/reveal';
	import { TENTANG_NAME_PARTS, TENTANG_PRINCIPLES, TENTANG_SUBPAGES } from '$lib/data/tentang';

	const siblings = TENTANG_SUBPAGES.filter((s) => s.id !== 'arti-nama');

	const artiNamaJsonLd = [
		{
			'@context': 'https://schema.org',
			'@type': 'AboutPage',
			name: 'Arti Nama ARISTOTELES — Laboratorium Pendidikan Era AI',
			description:
				'ARISTOTELES adalah singkatan dari Artificial Intelligence Research, Innovation, Science, Technology, and Engineering Laboratory for Education and Systems.',
			url: canonicalPath('/tentang/arti-nama'),
			inLanguage: 'id-ID',
			isPartOf: { '@type': 'WebSite', name: 'ARISTOTELES', url: getSiteUrl() }
		},
		{
			'@context': 'https://schema.org',
			'@type': 'BreadcrumbList',
			itemListElement: [
				{ '@type': 'ListItem', position: 1, name: 'Beranda', item: canonicalPath('/') },
				{ '@type': 'ListItem', position: 2, name: 'Tentang', item: canonicalPath('/tentang/arti-nama') },
				{ '@type': 'ListItem', position: 3, name: 'Arti Nama', item: canonicalPath('/tentang/arti-nama') }
			]
		}
	];
</script>

<SeoHead
	title="Arti Nama ARISTOTELES — Laboratorium Pendidikan Era AI"
	description="ARISTOTELES adalah singkatan dari Artificial Intelligence Research, Innovation, Science, Technology, and Engineering Laboratory for Education and Systems."
	path="/tentang/arti-nama"
	jsonLd={artiNamaJsonLd}
/>

<PublicHeader active="tentang" />

<main>
	<!-- Hero -->
	<section class="relative overflow-hidden bg-white">
		<div class="pointer-events-none absolute inset-0" aria-hidden="true">
			<div class="absolute -top-32 left-1/2 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-ice blur-3xl"></div>
		</div>
		<div class="relative mx-auto max-w-7xl px-4 py-14 text-center sm:px-6 sm:py-20 lg:px-8">
			<p class="flex items-center justify-center gap-3 font-heading text-xs font-bold tracking-[0.18em] text-royal uppercase">
				<span class="h-px w-8 bg-royal" aria-hidden="true"></span>
				Tentang Aristoteles
				<span class="h-px w-8 bg-royal" aria-hidden="true"></span>
			</p>
			<h1 class="mx-auto mt-4 max-w-3xl font-heading text-4xl leading-tight font-extrabold tracking-tight text-abyss sm:text-5xl">
				Ubah Rasa Ingin Tahu Menjadi Keahlian yang Bermakna
			</h1>
			<p class="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
				ARISTOTELES adalah platform pembelajaran mikrokredensial: dari memilih pelatihan hingga
				memperoleh sertifikat. Terstruktur, terukur, dan berkelanjutan.
			</p>
			<div class="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
				<a
					href={resolve('/pelatihan')}
					class="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-royal px-8 font-heading text-sm font-bold text-white transition-colors duration-200 hover:bg-royal-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal"
				>
					Lihat Pelatihan <i class="fa-solid fa-arrow-right text-xs" aria-hidden="true"></i>
				</a>
				<a
					href={resolve('/verifikasi')}
					class="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl border border-mist bg-white px-8 font-heading text-sm font-bold text-abyss transition-colors duration-200 hover:border-royal hover:text-royal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal"
				>
					Verifikasi Sertifikat
				</a>
			</div>
		</div>
	</section>

	<!-- Arti nama -->
	<section aria-labelledby="arti-nama-heading" class="border-y border-mist bg-ice/60">
		<div class="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
			<div class="grid items-start gap-10 lg:grid-cols-2">
				<div>
					<p class="flex items-center gap-3 font-heading text-xs font-bold tracking-[0.18em] text-royal uppercase">
						<span class="h-px w-8 bg-royal" aria-hidden="true"></span>
						Arti Nama
					</p>
					<h2 id="arti-nama-heading" class="mt-3 font-heading text-3xl font-extrabold tracking-tight text-abyss sm:text-4xl">
						Laboratorium Pendidikan untuk Era Kecerdasan Buatan
					</h2>
					<p class="mt-4 text-sm leading-relaxed text-slate-600 sm:text-base">
						ARISTOTELES adalah singkatan dari <strong class="font-semibold text-abyss"
							>Artificial Intelligence Research, Innovation, Science, Technology, and Engineering
							Laboratory for Education and Systems</strong
						>. Terinspirasi dari filsuf Aristoteles yang menekankan pembelajaran melalui pengalaman
						dan penalaran, platform ini merancang pendidikan vokasi yang praktis, terukur, dan
						relevan dengan dunia kerja modern.
					</p>
				</div>
				<div class="rounded-2xl border border-mist bg-white p-6 sm:p-8">
					<dl class="space-y-5">
						{#each TENTANG_NAME_PARTS as item (item.k)}
							<div class="flex gap-4">
								<span
									class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ice text-sm text-royal"
									aria-hidden="true"
								>
									<i class="fa-solid fa-flask"></i>
								</span>
								<div>
									<dt class="font-heading text-sm font-bold text-abyss">{item.k}</dt>
									<dd class="mt-0.5 text-sm leading-relaxed text-slate-600">{item.v}</dd>
								</div>
							</div>
						{/each}
					</dl>
				</div>
			</div>
		</div>
	</section>

	<!-- Tiga prinsip -->
	<section aria-labelledby="prinsip-heading" class="bg-white">
		<div class="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
			<div class="max-w-2xl">
				<p class="flex items-center gap-3 font-heading text-xs font-bold tracking-[0.18em] text-teal uppercase">
					<span class="h-px w-8 bg-teal" aria-hidden="true"></span>
					Tiga Prinsip
				</p>
				<h2 id="prinsip-heading" class="mt-3 font-heading text-3xl font-extrabold tracking-tight text-abyss sm:text-4xl">
					Filosofi yang menjadi cara kerja
				</h2>
				<p class="mt-2 max-w-xl text-sm leading-relaxed text-slate-600 sm:text-base">
					Inspirasi Aristoteles kami terjemahkan menjadi tiga prinsip yang hidup di setiap fitur platform.
				</p>
			</div>
			<div class="mt-10 grid grid-cols-1 gap-5 md:grid-cols-3">
				{#each TENTANG_PRINCIPLES as prinsip, i (prinsip.title)}
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
					Rasakan bedanya belajar yang terstruktur
				</h2>
				<p class="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-slate-300 sm:text-base">
					Buat akun gratis, pilih pelatihan pertamamu, dan kumpulkan sertifikat per modul.
				</p>
				<div class="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
					<a
						href={resolve('/register')}
						class="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-white px-8 font-heading text-sm font-bold text-abyss transition-all duration-200 hover:-translate-y-0.5 hover:bg-ice focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
					>
						Mulai Belajar Sekarang <i class="fa-solid fa-arrow-right text-xs" aria-hidden="true"></i>
					</a>
					<a
						href={resolve('/pelatihan')}
						class="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/5 px-8 font-heading text-sm font-bold text-white backdrop-blur transition-all duration-200 hover:-translate-y-0.5 hover:border-white/60 hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
					>
						Jelajahi Katalog
					</a>
				</div>
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
