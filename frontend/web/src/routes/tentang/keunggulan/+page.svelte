<script lang="ts">
	import '../../../app.css';
	import PublicHeader from '$lib/components/public/PublicHeader.svelte';
	import PublicFooter from '$lib/components/public/PublicFooter.svelte';
	import SeoHead from '$lib/components/SeoHead.svelte';
	import { canonicalPath, getSiteUrl } from '$lib/seo/site';
	import { resolve } from '$app/paths';
	import { reveal } from '$lib/actions/reveal';
	import { TENTANG_FEATURES, TENTANG_FORMATS, TENTANG_STATS, TENTANG_SUBPAGES } from '$lib/data/tentang';

	const siblings = TENTANG_SUBPAGES.filter((s) => s.id !== 'keunggulan');

	const keunggulanJsonLd = [
		{
			'@context': 'https://schema.org',
			'@type': 'AboutPage',
			name: 'Keunggulan ARISTOTELES — Kurikulum Industri, Mentor Praktisi',
			description:
				'Kurikulum industri, mentor praktisi, dan sertifikat per modul terverifikasi. Buat akun gratis dan pilih pelatihan pertamamu.',
			url: canonicalPath('/tentang/keunggulan'),
			inLanguage: 'id-ID',
			isPartOf: { '@type': 'WebSite', name: 'ARISTOTELES', url: getSiteUrl() }
		},
		{
			'@context': 'https://schema.org',
			'@type': 'BreadcrumbList',
			itemListElement: [
				{ '@type': 'ListItem', position: 1, name: 'Beranda', item: canonicalPath('/') },
				{ '@type': 'ListItem', position: 2, name: 'Tentang', item: canonicalPath('/tentang/arti-nama') },
				{ '@type': 'ListItem', position: 3, name: 'Keunggulan', item: canonicalPath('/tentang/keunggulan') }
			]
		}
	];
</script>

<SeoHead
	title="Keunggulan ARISTOTELES — Kurikulum Industri, Mentor Praktisi"
	description="Kurikulum industri, mentor praktisi, sertifikat per modul terverifikasi. Buat akun gratis dan pilih pelatihan pertamamu."
	path="/tentang/keunggulan"
	jsonLd={keunggulanJsonLd}
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
				Mengapa Aristoteles
				<span class="h-px w-8 bg-royal" aria-hidden="true"></span>
			</p>
			<h1 class="mx-auto mt-4 max-w-3xl font-heading text-4xl leading-tight font-extrabold tracking-tight text-abyss sm:text-5xl">
				Kurikulum industri, mentor praktisi, sertifikat terverifikasi
			</h1>
		</div>
	</section>

	<!-- Angka struktural -->
	<section aria-label="Fakta platform" class="border-b border-mist bg-white">
		<div class="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
			<dl class="grid grid-cols-1 gap-5 sm:grid-cols-3">
				{#each TENTANG_STATS as stat, i (stat.label)}
					<div use:reveal={{ delay: i * 80 }} class="flex items-center gap-5 rounded-2xl border border-mist bg-ice/50 p-6">
						<dd class="font-heading text-5xl font-extrabold text-royal tabular-nums" aria-hidden="true">{stat.value}</dd>
						<div>
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
				{#each TENTANG_FEATURES as item, i (item.title)}
					<li use:reveal={{ delay: (i % 2) * 80 }} class="flex gap-4 rounded-2xl border border-mist bg-white p-6 transition-colors duration-200 hover:border-royal/40">
						<span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-ice text-royal" aria-hidden="true">
							<i class="fa-solid {item.icon} text-lg"></i>
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
						<h2 class="font-heading text-lg font-extrabold text-abyss">Satu kurikulum, banyak format</h2>
						<p class="mt-1 text-sm text-slate-500">Materi disajikan sesuai gaya belajarmu.</p>
					</div>
				</div>
				<ul class="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
					{#each TENTANG_FORMATS as format, i (format.label)}
						<li use:reveal={{ delay: i * 50 }} class="group rounded-xl border border-mist bg-ice/50 p-4 text-center transition-colors duration-200 hover:border-royal/40 hover:bg-ice">
							<i class="fa-solid {format.icon} text-xl text-royal" aria-hidden="true"></i>
							<p class="mt-2 font-heading text-sm font-bold text-abyss">{format.label}</p>
							<p class="mt-0.5 text-[11px] leading-snug text-slate-500">{format.desc}</p>
						</li>
					{/each}
				</ul>
			</div>
			<div use:reveal class="mt-10 rounded-2xl border border-mist bg-white p-8 text-center sm:p-10">
				<h2 class="font-heading text-2xl font-extrabold tracking-tight text-abyss">
					Siap memulai perjalanan belajarmu?
				</h2>
				<p class="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-slate-600">
					Buat akun gratis dan pilih pelatihan pertamamu hari ini.
				</p>
				<div class="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
					<a
						href={resolve('/register')}
						class="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-royal px-8 font-heading text-sm font-bold text-white transition-colors duration-200 hover:bg-royal-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal"
					>
						Mulai Belajar Sekarang <i class="fa-solid fa-arrow-right text-xs" aria-hidden="true"></i>
					</a>
					<a
						href={resolve('/pelatihan')}
						class="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl border border-mist bg-white px-8 font-heading text-sm font-bold text-abyss transition-colors duration-200 hover:border-royal hover:text-royal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal"
					>
						Lihat Pelatihan
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
