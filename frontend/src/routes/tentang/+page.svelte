<script lang="ts">
	import '../../app.css';
	import PublicHeader from '$lib/components/public/PublicHeader.svelte';
	import PublicFooter from '$lib/components/public/PublicFooter.svelte';
	import SeoHead from '$lib/components/SeoHead.svelte';
	import { canonicalPath, getSiteUrl } from '$lib/seo/site';
	import { resolve } from '$app/paths';
	import { reveal } from '$lib/actions/reveal';

	const steps = [
		{
			icon: 'fa-magnifying-glass',
			title: 'Pilih pelatihan',
			desc: 'Telusuri katalog dan pilih program mikrokredensial sesuai tujuan kariermu.'
		},
		{
			icon: 'fa-book-open',
			title: 'Belajar materi',
			desc: 'Pelajari materi modul demi modul dengan alur yang sudah disusun.'
		},
		{
			icon: 'fa-list-check',
			title: 'Kerjakan kuis & tugas',
			desc: 'Uji pemahaman lewat kuis dan kumpulkan tugas untuk dinilai instruktur.'
		},
		{
			icon: 'fa-award',
			title: 'Raih sertifikat',
			desc: 'Selesaikan syarat tiap modul dan terima sertifikat mikrokredensial.'
		}
	];

	const roles = [
		{
			icon: 'fa-user-graduate',
			title: 'Peserta',
			desc: 'Belajar mandiri, kerjakan kuis dan tugas, tukar voucher, dan kumpulkan sertifikat per modul.',
			href: '/user',
			cta: 'Portal Peserta'
		},
		{
			icon: 'fa-chalkboard-user',
			title: 'Instruktur',
			desc: 'Kelola kurikulum, susun kuis dan tugas, nilai pengumpulan, dan pantau kelulusan peserta.',
			href: '/instruktur',
			cta: 'Portal Instruktur'
		},
		{
			icon: 'fa-shield-halved',
			title: 'Admin',
			desc: 'Kelola peserta, undang instruktur, atur voucher, dan pantau seluruh pelatihan.',
			href: '/admin',
			cta: 'Portal Admin'
		}
	];

	const keunggulan = [
		{
			icon: 'fa-list-check',
			title: 'Pembelajaran terstruktur',
			desc: 'Materi, kuis, dan tugas tersusun per modul dengan alur yang jelas dari awal hingga akhir.'
		},
		{
			icon: 'fa-book-open',
			title: 'Akses materi fleksibel',
			desc: 'Pelajari materi dalam berbagai format sesuai ritmemu, dengan progres yang terlacak.'
		},
		{
			icon: 'fa-pen-to-square',
			title: 'Evaluasi yang terukur',
			desc: 'Uji pemahaman lewat kuis bernilai ambang dan tugas yang dinilai langsung oleh instruktur.'
		},
		{
			icon: 'fa-award',
			title: 'Sertifikat bersyarat',
			desc: 'Sertifikat per modul diterbitkan setelah seluruh persyaratan wajib terpenuhi dan terverifikasi.'
		}
	];

	const tentangJsonLd = [
		{
			'@context': 'https://schema.org',
			'@type': 'AboutPage',
			name: 'Tentang ARISTOTELES — Platform Kursus Mikrokredensial',
			description:
				'ARISTOTELES adalah platform pembelajaran mikrokredensial: kurikulum berbasis industri, mentor praktisi, sertifikat per modul terverifikasi.',
			url: canonicalPath('/tentang'),
			inLanguage: 'id-ID',
			isPartOf: { '@type': 'WebSite', name: 'ARISTOTELES', url: getSiteUrl() }
		},
		{
			'@context': 'https://schema.org',
			'@type': 'Organization',
			name: 'ARISTOTELES',
			url: getSiteUrl(),
			description:
				'Platform pembelajaran mikrokredensial dengan portal peserta, instruktur, dan admin; sertifikat per modul yang terverifikasi.',
			email: 'support@aristoteles.id'
		},
		{
			'@context': 'https://schema.org',
			'@type': 'BreadcrumbList',
			itemListElement: [
				{ '@type': 'ListItem', position: 1, name: 'Beranda', item: canonicalPath('/') },
				{ '@type': 'ListItem', position: 2, name: 'Tentang', item: canonicalPath('/tentang') }
			]
		}
	];
</script>

<SeoHead
	title="Tentang ARISTOTELES — Platform Kursus Mikrokredensial"
	description="Mengenal ARISTOTELES: platform kursus online mikrokredensial Indonesia — kurikulum industri, mentor praktisi, sertifikat per modul terverifikasi."
	path="/tentang"
	jsonLd={tentangJsonLd}
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
					href="/verifikasi"
					class="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl border border-mist bg-white px-8 font-heading text-sm font-bold text-abyss transition-colors duration-200 hover:border-royal hover:text-royal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal"
				>
					Verifikasi Sertifikat
				</a>
			</div>
		</div>
	</section>

	<!-- Arti nama -->
	<section class="border-y border-mist bg-ice/60">
		<div class="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
			<div class="grid items-start gap-10 lg:grid-cols-2">
				<div>
					<p class="flex items-center gap-3 font-heading text-xs font-bold tracking-[0.18em] text-royal uppercase">
						<span class="h-px w-8 bg-royal" aria-hidden="true"></span>
						Arti Nama
					</p>
					<h2 class="mt-3 font-heading text-3xl font-extrabold tracking-tight text-abyss sm:text-4xl">
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
						{#each [{ k: 'Artificial Intelligence', v: 'Kecerdasan Buatan — fondasi analisis dan personalisasi belajar.' }, { k: 'Research & Innovation', v: 'Riset dan inovasi sebagai cara memperbarui kurikulum.' }, { k: 'Science, Technology & Engineering', v: 'Sains, teknologi, dan rekayasa sebagai bidang keahlian utama.' }, { k: 'Laboratory for Education & Systems', v: 'Laboratorium yang membangun sistem pendidikan yang hidup.' }] as item}
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

	<!-- Cara kerja -->
	<section class="bg-white">
		<div class="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
			<div class="max-w-2xl">
				<p class="flex items-center gap-3 font-heading text-xs font-bold tracking-[0.18em] text-royal uppercase">
					<span class="h-px w-8 bg-royal" aria-hidden="true"></span>
					Cara Kerja
				</p>
				<h2 class="mt-3 font-heading text-3xl font-extrabold tracking-tight text-abyss sm:text-4xl">
					Empat langkah menuju sertifikat
				</h2>
			</div>
			<ol class="mt-10 grid grid-cols-1 gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
				{#each steps as step, i (step.title)}
					<li use:reveal={{ delay: i * 70 }} class="border-t-2 border-mist pt-6 transition-colors duration-200 hover:border-royal">
						<span class="flex h-10 w-10 items-center justify-center rounded-xl bg-ice text-royal" aria-hidden="true">
							<i class="fa-solid {step.icon}"></i>
						</span>
						<p class="mt-4 font-heading text-xs font-bold tracking-[0.18em] text-royal">
							{String(i + 1).padStart(2, '0')}
						</p>
						<h3 class="mt-1 font-heading text-base font-bold text-abyss">{step.title}</h3>
						<p class="mt-1.5 text-sm leading-relaxed text-slate-600">{step.desc}</p>
					</li>
				{/each}
			</ol>
		</div>
	</section>

	<!-- Untuk siapa -->
	<section class="border-y border-mist bg-ice/60">
		<div class="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
			<div class="max-w-2xl">
				<p class="flex items-center gap-3 font-heading text-xs font-bold tracking-[0.18em] text-royal uppercase">
					<span class="h-px w-8 bg-royal" aria-hidden="true"></span>
					Untuk Siapa
				</p>
				<h2 class="mt-3 font-heading text-3xl font-extrabold tracking-tight text-abyss sm:text-4xl">
					Satu platform, tiga portal
				</h2>
				<p class="mt-2 max-w-xl text-sm leading-relaxed text-slate-600 sm:text-base">
					Setiap peran memiliki ruang kerja sendiri yang saling terhubung.
				</p>
			</div>
			<div class="mt-10 grid grid-cols-1 gap-5 md:grid-cols-3">
				{#each roles as role, i (role.title)}
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
						<h3 class="mt-4 font-heading text-base font-bold text-abyss">{role.title}</h3>
						<p class="mt-1.5 flex-1 text-sm leading-relaxed text-slate-600">{role.desc}</p>
						<a
							href={role.href}
							class="mt-4 inline-flex items-center gap-2 font-heading text-sm font-bold text-royal transition-colors duration-200 hover:text-royal-hover"
							aria-label="{role.cta} — buka portal {role.title}"
						>
							{role.cta} <i class="fa-solid fa-arrow-right text-xs" aria-hidden="true"></i>
						</a>
					</article>
				{/each}
			</div>
		</div>
	</section>

	<!-- Keunggulan -->
	<section class="bg-white">
		<div class="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
			<div class="max-w-2xl">
				<p class="flex items-center gap-3 font-heading text-xs font-bold tracking-[0.18em] text-royal uppercase">
					<span class="h-px w-8 bg-royal" aria-hidden="true"></span>
					Mengapa Aristoteles
				</p>
				<h2 class="mt-3 font-heading text-3xl font-extrabold tracking-tight text-abyss sm:text-4xl">
					Kurikulum industri, mentor praktisi, sertifikat terverifikasi
				</h2>
			</div>
			<ul class="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2">
				{#each keunggulan as item, i (item.title)}
					<li use:reveal={{ delay: (i % 2) * 80 }} class="flex gap-4 rounded-2xl border border-mist bg-white p-6 transition-colors duration-200 hover:border-royal/40">
						<span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-ice text-royal" aria-hidden="true">
							<i class="fa-solid {item.icon} text-lg"></i>
						</span>
						<div>
							<h3 class="font-heading text-base font-bold text-abyss">{item.title}</h3>
							<p class="mt-1 text-sm leading-relaxed text-slate-600">{item.desc}</p>
						</div>
					</li>
				{/each}
			</ul>
			<div use:reveal class="mt-10 rounded-2xl border border-mist bg-ice/60 p-8 text-center sm:p-10">
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
</main>

<PublicFooter />
