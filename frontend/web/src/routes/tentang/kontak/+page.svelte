<script lang="ts">
	import '../../../app.css';
	import PublicHeader from '$lib/components/public/PublicHeader.svelte';
	import PublicFooter from '$lib/components/public/PublicFooter.svelte';
	import SeoHead from '$lib/components/SeoHead.svelte';
	import { canonicalPath, getSiteUrl } from '$lib/seo/site';
	import { resolve } from '$app/paths';
	import { reveal } from '$lib/actions/reveal';
	import { TENTANG_ROLES, TENTANG_SUBPAGES } from '$lib/data/tentang';

	const siblings = TENTANG_SUBPAGES.filter((s) => s.id !== 'untuk-siapa');

	const untukSiapaJsonLd = [
		{
			'@context': 'https://schema.org',
			'@type': 'AboutPage',
			name: 'Untuk Siapa ARISTOTELES — Portal Peserta, Instruktur, Admin',
			description:
				'Satu platform, tiga portal yang saling terhubung: peserta belajar mandiri, instruktur mengelola kurikulum, admin mengelola ekosistem.',
			url: canonicalPath('/tentang/untuk-siapa'),
			inLanguage: 'id-ID',
			isPartOf: { '@type': 'WebSite', name: 'ARISTOTELES', url: getSiteUrl() }
		},
		{
			'@context': 'https://schema.org',
			'@type': 'BreadcrumbList',
			itemListElement: [
				{ '@type': 'ListItem', position: 1, name: 'Beranda', item: canonicalPath('/') },
				{ '@type': 'ListItem', position: 2, name: 'Tentang', item: canonicalPath('/tentang/arti-nama') },
				{ '@type': 'ListItem', position: 3, name: 'Untuk Siapa', item: canonicalPath('/tentang/untuk-siapa') }
			]
		}
	];
</script>

<SeoHead
	title="Untuk Siapa ARISTOTELES — Peserta, Instruktur, Admin"
	description="Satu platform, tiga portal yang saling terhubung: peserta belajar mandiri, instruktur mengelola kurikulum, admin mengelola ekosistem."
	path="/tentang/untuk-siapa"
	jsonLd={untukSiapaJsonLd}
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
				Untuk Siapa
				<span class="h-px w-8 bg-royal" aria-hidden="true"></span>
			</p>
			<h1 class="mx-auto mt-4 max-w-3xl font-heading text-4xl leading-tight font-extrabold tracking-tight text-abyss sm:text-5xl">
				Satu platform, tiga portal
			</h1>
			<p class="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
				Setiap peran memiliki ruang kerja sendiri yang saling terhubung.
			</p>
		</div>
	</section>

	<!-- Peran -->
	<section aria-label="Peran pengguna" class="border-y border-mist bg-ice/60">
		<div class="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
			<div class="grid grid-cols-1 gap-5 md:grid-cols-3">
				{#each TENTANG_ROLES as role, i (role.title)}
					<article
						use:reveal={{ delay: i * 80 }}
						class="flex flex-col rounded-2xl border border-mist bg-white p-6 transition-all duration-200 hover:-translate-y-1 hover:border-royal/40 hover:shadow-xl hover:shadow-slate-900/10"
					>
						<span
							class="flex h-11 w-11 items-center justify-center rounded-xl bg-ice text-royal"
							aria-hidden="true"
						>
							<i class="fa-solid {role.icon} text-lg"></i>
						</span>
						<h2 class="mt-4 font-heading text-base font-bold text-abyss">{role.title}</h2>
						<p class="mt-1.5 text-sm leading-relaxed text-slate-600">{role.desc}</p>
						<ul class="mt-3 flex-1 space-y-1.5 border-t border-mist/70 pt-3">
							{#each role.points as point (point)}
								<li class="flex items-start gap-2 text-xs leading-relaxed text-slate-600">
									<i class="fa-solid fa-check mt-0.5 shrink-0 text-[10px] text-teal" aria-hidden="true"></i>
									{point}
								</li>
							{/each}
						</ul>
						<a
							href={resolve(role.href)}
							class="mt-4 inline-flex items-center gap-2 font-heading text-sm font-bold text-royal transition-colors duration-200 hover:text-royal-hover"
							aria-label="{role.cta} — buka portal {role.title}"
						>
							{role.cta} <i class="fa-solid fa-arrow-right text-xs" aria-hidden="true"></i>
						</a>
					</article>
				{/each}
			</div>
			<div use:reveal class="mt-8 flex items-start gap-3 rounded-2xl border border-royal/25 bg-royal/5 p-5">
				<span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-royal text-sm text-white" aria-hidden="true">
					<i class="fa-solid fa-envelope-open-text"></i>
				</span>
				<p class="pt-1 text-sm leading-relaxed text-slate-600">
					<span class="font-bold text-abyss">Akun instruktur melalui undangan resmi.</span>
					Tidak ada pendaftaran bebas — admin mengundang lewat email, pendaftar mengatur kata sandi
					sendiri, lalu akun aktif dan siap mengelola kursus.
				</p>
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
