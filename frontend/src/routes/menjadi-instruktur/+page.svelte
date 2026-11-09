<script lang="ts">
	import '../../app.css';
	import { resolve } from '$app/paths';
	import PublicHeader from '$lib/components/public/PublicHeader.svelte';
	import PublicFooter from '$lib/components/public/PublicFooter.svelte';
	import SeoHead from '$lib/components/SeoHead.svelte';
	import { canonicalPath, getSiteUrl } from '$lib/seo/site';
	import dashboardIlustrasi from '$lib/assets/Modern Digital Learning Dashboard.png';
	import { reveal } from '$lib/actions/reveal';

	const manfaat = [
		{
			icon: 'fa-book-open',
			title: 'Berbagi Pengetahuan',
			desc: 'Bantu peserta mempelajari keterampilan dan wawasan melalui materi yang terstruktur.'
		},
		{
			icon: 'fa-award',
			title: 'Membangun Reputasi',
			desc: 'Tampilkan keahlian dan pengalaman profesional melalui karya pembelajaran yang berkualitas.'
		},
		{
			icon: 'fa-people-group',
			title: 'Bertumbuh Bersama',
			desc: 'Berkontribusi dalam komunitas pembelajaran dan membuka peluang kolaborasi.'
		}
	];

	/** Contoh tampilan — bukan data instruktur aktif. Tanpa angka/statistik fiktif. */
	const contohProfil = [
		{
			foto: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=160&q=80',
			bidang: 'Pengembangan Web',
			topik: 'Contoh topik: Dasar HTML & CSS'
		},
		{
			foto: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=160&q=80',
			bidang: 'Sains Data',
			topik: 'Contoh topik: Analisis Data dengan Python'
		},
		{
			foto: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=160&q=80',
			bidang: 'Desain UI/UX',
			topik: 'Contoh topik: Dasar Desain Antarmuka'
		}
	];

	/** Alur pengajuan instruktur: daftar → ditinjau admin → undangan email → buat kursus. */
	const alur: Array<{
		n: string;
		icon: string;
		title: string;
		desc: string;
		href?: '/menjadi-instruktur/daftar';
		linkLabel?: string;
	}> = [
		{
			n: '01',
			icon: 'fa-file-signature',
			title: 'Isi formulir pengajuan',
			desc: 'Lengkapi data diri, keahlian, dan contoh mengajar melalui formulir pendaftaran mentor.',
			href: '/menjadi-instruktur/daftar',
			linkLabel: 'Buka formulir'
		},
		{
			n: '02',
			icon: 'fa-magnifying-glass-chart',
			title: 'Pengajuan ditinjau admin',
			desc: 'Admin memeriksa kelengkapan data, keahlian, dan contoh mengajar yang kamu kirimkan.'
		},
		{
			n: '03',
			icon: 'fa-envelope-open-text',
			title: 'Terima undangan via email',
			desc: 'Bila memenuhi syarat, undangan resmi dikirim ke emailmu. Buka tautan undangan dan atur kata sandi untuk mengaktifkan akun.'
		},
		{
			n: '04',
			icon: 'fa-rocket',
			title: 'Buat & terbitkan kursus',
			desc: 'Susun kurikulum, materi, kuis, dan tugas lewat portal instruktur, lalu terbitkan kursusmu sendiri.'
		}
	];

	const keunggulanPlatform = [
		'Penyusunan materi yang terorganisasi per modul dan sub-modul.',
		'Materi dalam format yang didukung aplikasi: teks, foto, audio, dan video.',
		'Kuis dengan ambang nilai dan tugas untuk mendukung evaluasi pembelajaran.',
		'Penilaian hasil peserta dan pemantauan pengumpulan tugas.',
		'Sertifikat per modul ketika seluruh persyaratan penyelesaian terpenuhi.'
	];

	const faq = [
		{
			q: 'Siapa yang dapat menjadi instruktur ARISTOTELES?',
			a: 'Instruktur bergabung melalui undangan resmi dari admin — tidak ada pendaftaran terbuka untuk peran instruktur. Kriteria dan mekanisme undangan mengikuti kebijakan penyelenggara program.'
		},
		{
			q: 'Bagaimana proses bergabung sebagai instruktur?',
			a: 'Isi formulir pengajuan pada halaman ini, lalu admin akan meninjau kelengkapan data dan contoh mengajarmu. Bila memenuhi syarat, undangan resmi dikirim via email — buka tautan undangan dan atur kata sandi untuk mengaktifkan akun, kemudian masuk ke portal instruktur dan mulai menyusun kursus.'
		},
		{
			q: 'Bagaimana materi kursus ditinjau?',
			a: 'Instruktur menyusun materi melalui editor dan meninjaunya kembali lewat pratinjau sebelum menerbitkan. Standar kualitas materi mengikuti ketentuan platform.'
		},
		{
			q: 'Jenis materi apa yang dapat dimasukkan ke dalam kursus?',
			a: 'Materi teks, foto, audio, dan video, serta evaluasi berupa kuis dan tugas. Setiap materi disusun dalam struktur modul dan sub-modul.'
		},
		{
			q: 'Kapan kursus dapat dipublikasikan?',
			a: 'Instruktur mengatur sendiri status Terbit atau Draft dari halaman Kelola Kurikulum. Kursus berstatus Terbit akan tampil di katalog publik dan dapat dipelajari peserta.'
		},
		{
			q: 'Bagaimana cara mendapatkan informasi lebih lanjut?',
			a: 'Hubungi admin penyelenggara program atau kunjungi halaman Tentang untuk mengenal platform lebih jauh.'
		}
	];

	const instrukturJsonLd = [
		{
			'@context': 'https://schema.org',
			'@type': 'WebPage',
			name: 'Menjadi Instruktur ARISTOTELES',
			description:
				'Bagikan keahlian sebagai instruktur: susun materi terstruktur, kelola kuis dan tugas, terbitkan kursus mikrokredensial lewat undangan resmi admin.',
			url: canonicalPath('/menjadi-instruktur'),
			inLanguage: 'id-ID',
			isPartOf: { '@type': 'WebSite', name: 'ARISTOTELES', url: getSiteUrl() }
		},
		{
			'@context': 'https://schema.org',
			'@type': 'FAQPage',
			mainEntity: faq.map((item) => ({
				'@type': 'Question',
				name: item.q,
				acceptedAnswer: { '@type': 'Answer', text: item.a }
			}))
		},
		{
			'@context': 'https://schema.org',
			'@type': 'BreadcrumbList',
			itemListElement: [
				{ '@type': 'ListItem', position: 1, name: 'Beranda', item: canonicalPath('/') },
				{
					'@type': 'ListItem',
					position: 2,
					name: 'Menjadi Instruktur',
					item: canonicalPath('/menjadi-instruktur')
				}
			]
		}
	];
</script>

<SeoHead
	title="Menjadi Instruktur — Bagikan Keahlian | ARISTOTELES"
	description="Jadi instruktur kursus online ARISTOTELES: susun materi terstruktur, kelola kuis & tugas, terbitkan kursus. Ajukan diri, terima undangan resmi admin."
	path="/menjadi-instruktur"
	jsonLd={instrukturJsonLd}
/>

<PublicHeader active="menjadi-instruktur" />

<main>
	<!-- Hero -->
	<section aria-labelledby="hero-instruktur" class="relative overflow-hidden bg-white">
		<div class="pointer-events-none absolute inset-0" aria-hidden="true">
			<div class="absolute -top-32 right-[8%] h-72 w-72 rounded-full bg-ice blur-3xl"></div>
		</div>
		<div class="relative mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-4 py-14 sm:px-6 sm:py-16 lg:grid-cols-2 lg:gap-16 lg:px-8">
			<div>
				<p class="flex items-center gap-3 font-heading text-xs font-bold tracking-[0.18em] text-royal uppercase">
					<span class="h-px w-8 bg-royal" aria-hidden="true"></span>
					Berbagi ilmu, ciptakan dampak
				</p>
				<h1 id="hero-instruktur" class="mt-3 font-heading text-4xl leading-tight font-extrabold tracking-tight text-abyss sm:text-5xl">
					Bagikan Keahlianmu. <span class="text-royal">Inspirasi Masa Depan.</span>
				</h1>
				<p class="mt-4 max-w-lg text-sm leading-relaxed text-slate-600 sm:text-base">
					Jadikan pengalaman dan pengetahuanmu lebih bermakna dengan menghadirkan
					pembelajaran terstruktur untuk mahasiswa dan masyarakat umum melalui ARISTOTELES.
				</p>
				<div class="mt-8 flex flex-col gap-3 sm:flex-row">
					<a
						href={resolve('/menjadi-instruktur/daftar')}
						class="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-royal px-8 font-heading text-sm font-bold text-white transition-colors duration-200 hover:bg-royal-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal"
					>
						Daftar Sekarang
						<i class="fa-solid fa-arrow-right text-xs" aria-hidden="true"></i>
					</a>
					<a
						href="#alur"
						class="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl border border-mist bg-white px-8 font-heading text-sm font-bold text-abyss transition-colors duration-200 hover:border-royal hover:text-royal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal"
					>
						Lihat Alur Instruktur
					</a>
				</div>
			</div>
			<div class="relative">
				<figure class="overflow-hidden rounded-2xl border border-mist bg-white shadow-xl shadow-slate-900/10">
					<img
						src="https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=900&q=80"
						alt="Suasana kelas pembelajaran dengan peserta"
						loading="eager"
						class="aspect-[4/3] w-full object-cover"
					/>
				</figure>
				<div class="absolute -top-4 right-4 flex items-center gap-2 rounded-xl border border-mist bg-white px-3.5 py-2 shadow-lg shadow-slate-900/10" aria-hidden="true">
					<span class="flex h-8 w-8 items-center justify-center rounded-lg bg-ice text-royal">
						<i class="fa-solid fa-laptop-file text-sm"></i>
					</span>
					<p class="font-heading text-xs font-bold whitespace-nowrap text-abyss">Materi · Kuis · Tugas</p>
				</div>
				<div class="relative z-10 mx-4 -mt-12 rounded-2xl border border-mist bg-white p-5 shadow-xl shadow-slate-900/10 sm:mx-8">
					<div class="flex items-center gap-4">
						<img
							src="https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=160&q=80"
							alt="Foto profil contoh"
							loading="lazy"
							class="h-14 w-14 shrink-0 rounded-full border border-mist object-cover"
						/>
						<div class="min-w-0">
							<p class="flex flex-wrap items-center gap-2 font-heading text-sm font-bold text-abyss">
								Nama Instruktur
								<span class="rounded-md bg-ice px-2 py-0.5 font-heading text-[10px] font-bold tracking-wider text-royal uppercase">Contoh</span>
							</p>
							<p class="mt-0.5 text-xs font-medium text-slate-500">Bidang keahlian · contoh tampilan profil</p>
						</div>
					</div>
					<p class="mt-3 border-t border-mist pt-3 text-xs leading-relaxed text-slate-500">
						Contoh tampilan kartu profil. Data instruktur terdaftar akan tampil di sini.
					</p>
				</div>
			</div>
		</div>
	</section>

	<!-- Manfaat -->
	<section id="manfaat" aria-labelledby="manfaat-heading" class="scroll-mt-20 border-y border-mist bg-ice/60">
		<div class="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
			<div class="max-w-2xl">
				<p class="flex items-center gap-3 font-heading text-xs font-bold tracking-[0.18em] text-royal uppercase">
					<span class="h-px w-8 bg-royal" aria-hidden="true"></span>
					Manfaat
				</p>
				<h2 id="manfaat-heading" class="mt-3 font-heading text-3xl font-extrabold tracking-tight text-abyss sm:text-4xl">
					Lebih dari sekadar mengajar
				</h2>
				<p class="mt-2 max-w-xl text-sm leading-relaxed text-slate-600 sm:text-base">
					Berbagi pengetahuan adalah kesempatan untuk terus bertumbuh sekaligus membantu orang lain berkembang.
				</p>
			</div>
			<ul class="mt-10 grid grid-cols-1 gap-5 md:grid-cols-3">
				{#each manfaat as item, i (item.title)}
					<li use:reveal={{ delay: i * 80 }} class="rounded-2xl border border-mist bg-white p-6 transition-all duration-200 hover:-translate-y-1 hover:border-royal/40 hover:shadow-xl hover:shadow-slate-900/10">
						<span class="flex h-11 w-11 items-center justify-center rounded-xl bg-ice text-royal" aria-hidden="true">
							<i class="fa-solid {item.icon} text-lg"></i>
						</span>
						<h3 class="mt-4 font-heading text-base font-bold text-abyss">{item.title}</h3>
						<p class="mt-1.5 text-sm leading-relaxed text-slate-600">{item.desc}</p>
					</li>
				{/each}
			</ul>
		</div>
	</section>

	<!-- Profil dan cerita instruktur (contoh tampilan) -->
	<section id="cerita" aria-labelledby="cerita-heading" class="scroll-mt-20 bg-white">
		<div class="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
			<div class="max-w-2xl">
				<p class="flex items-center gap-3 font-heading text-xs font-bold tracking-[0.18em] text-royal uppercase">
					<span class="h-px w-8 bg-royal" aria-hidden="true"></span>
					Instruktur
				</p>
				<h2 id="cerita-heading" class="mt-3 font-heading text-3xl font-extrabold tracking-tight text-abyss sm:text-4xl">
					Pengetahuanmu layak dibagikan
				</h2>
				<p class="mt-2 max-w-xl text-sm leading-relaxed text-slate-600 sm:text-base">
					Contoh tampilan profil instruktur — bukan data instruktur aktif.
				</p>
			</div>
			<ul class="mt-10 grid grid-cols-1 gap-5 md:grid-cols-3">
				{#each contohProfil as p, i (p.bidang)}
					<li use:reveal={{ delay: i * 80 }} class="flex flex-col rounded-2xl border border-mist bg-white p-6 transition-all duration-200 hover:-translate-y-1 hover:border-royal/40 hover:shadow-xl hover:shadow-slate-900/10">
						<div class="flex items-center gap-4">
							<img
								src={p.foto}
								alt="Foto profil contoh"
								loading="lazy"
								class="h-14 w-14 shrink-0 rounded-full border border-mist object-cover"
							/>
							<div class="min-w-0">
								<p class="flex flex-wrap items-center gap-2 font-heading text-sm font-bold text-abyss">
									Nama Instruktur
									<span class="rounded-md bg-ice px-2 py-0.5 font-heading text-[10px] font-bold tracking-wider text-royal uppercase">Contoh</span>
								</p>
								<p class="mt-0.5 text-xs font-medium text-slate-500">{p.bidang}</p>
							</div>
						</div>
						<p class="mt-4 flex-1 text-sm leading-relaxed text-slate-600">
							Contoh deskripsi profil. Cerita dan karya pembelajaran instruktur akan tampil di sini.
						</p>
						<p class="mt-4 inline-flex w-fit items-center gap-1.5 rounded-lg bg-ice px-2.5 py-1 text-xs font-semibold text-abyss">
							<i class="fa-solid fa-book-open text-[11px] text-royal" aria-hidden="true"></i>
							{p.topik}
						</p>
					</li>
				{/each}
			</ul>
		</div>
	</section>

	<!-- Alur menjadi instruktur -->
	<section id="alur" aria-labelledby="alur-heading" class="scroll-mt-20 border-y border-mist bg-ice/60">
		<div class="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
			<div class="max-w-2xl">
				<p class="flex items-center gap-3 font-heading text-xs font-bold tracking-[0.18em] text-royal uppercase">
					<span class="h-px w-8 bg-royal" aria-hidden="true"></span>
					Alur Instruktur
				</p>
				<h2 id="alur-heading" class="mt-3 font-heading text-3xl font-extrabold tracking-tight text-abyss sm:text-4xl">
					Mulai berbagi ilmu bersama ARISTOTELES
				</h2>
			</div>
			<ol class="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
				{#each alur as s, i (s.n)}
					<li use:reveal={{ delay: i * 70 }} class="flex flex-col rounded-2xl border border-mist bg-white p-6 transition-all duration-200 hover:-translate-y-1 hover:border-royal/40 hover:shadow-xl hover:shadow-slate-900/10">
						<div class="flex items-center justify-between gap-3">
							<span class="flex h-11 w-11 items-center justify-center rounded-xl bg-ice text-royal" aria-hidden="true">
								<i class="fa-solid {s.icon} text-lg"></i>
							</span>
							<span class="font-heading text-sm font-bold tracking-[0.18em] text-slate-300">{s.n}</span>
						</div>
						<h3 class="mt-4 font-heading text-base font-bold text-abyss">{s.title}</h3>
						<p class="mt-1.5 flex-1 text-sm leading-relaxed text-slate-600">{s.desc}</p>
						{#if 'href' in s && s.href}
							<a
								href={resolve(s.href)}
								class="mt-4 inline-flex items-center gap-2 font-heading text-sm font-bold text-royal transition-colors duration-200 hover:text-royal-hover focus-visible:outline-2 focus-visible:outline-royal"
							>
								{s.linkLabel} <i class="fa-solid fa-arrow-right text-xs" aria-hidden="true"></i>
							</a>
						{/if}
					</li>
				{/each}
			</ol>
			<p class="mt-6 max-w-2xl text-xs leading-relaxed text-slate-500">
				Ketentuan kualitas materi dan kebijakan publikasi mengikuti ketentuan platform yang berlaku.
			</p>
		</div>
	</section>

	<!-- Keunggulan platform -->
	<section id="platform" aria-labelledby="platform-heading" class="scroll-mt-20 bg-white">
		<div class="mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-4 py-14 sm:px-6 sm:py-16 lg:grid-cols-2 lg:gap-16 lg:px-8">
			<div class="relative order-2 lg:order-1">
				<figure class="overflow-hidden rounded-2xl border border-mist bg-white shadow-xl shadow-slate-900/10">
					<img
						src={dashboardIlustrasi}
						alt="Ilustrasi dasbor pembelajaran digital ARISTOTELES: materi, kuis, progres belajar, dan sertifikat"
						loading="lazy"
						class="aspect-[4/3] w-full object-cover"
					/>
				</figure>
				<div class="absolute -bottom-5 left-4 flex items-center gap-3 rounded-2xl border border-mist bg-white px-4 py-3 shadow-lg shadow-slate-900/10 sm:left-8" aria-hidden="true">
					<span class="flex h-10 w-10 items-center justify-center rounded-xl bg-ice text-royal">
						<i class="fa-solid fa-award"></i>
					</span>
					<p class="font-heading text-xs font-bold text-abyss">Sertifikat per modul<br /><span class="font-medium text-slate-500">bila syarat terpenuhi</span></p>
				</div>
			</div>
			<div class="order-1 lg:order-2">
				<p class="flex items-center gap-3 font-heading text-xs font-bold tracking-[0.18em] text-royal uppercase">
					<span class="h-px w-8 bg-royal" aria-hidden="true"></span>
					Platform
				</p>
				<h2 id="platform-heading" class="mt-3 font-heading text-3xl font-extrabold tracking-tight text-abyss sm:text-4xl">
					Lingkungan belajar digital yang terstruktur
				</h2>
				<ul class="mt-7 space-y-3.5">
					{#each keunggulanPlatform as item (item)}
						<li class="flex items-start gap-3 text-sm leading-relaxed font-medium text-slate-700">
							<span class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal/15 text-teal" aria-hidden="true">
								<i class="fa-solid fa-check text-[11px]"></i>
							</span>
							{item}
						</li>
					{/each}
				</ul>
			</div>
		</div>
	</section>

	<!-- FAQ -->
	<section id="faq" aria-labelledby="faq-heading" class="scroll-mt-20 border-t border-mist bg-ice/60">
		<div class="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-16">
			<div class="text-center">
				<p class="flex items-center justify-center gap-3 font-heading text-xs font-bold tracking-[0.18em] text-royal uppercase">
					<span class="h-px w-8 bg-royal" aria-hidden="true"></span>
					FAQ
					<span class="h-px w-8 bg-royal" aria-hidden="true"></span>
				</p>
				<h2 id="faq-heading" class="mt-3 font-heading text-3xl font-extrabold tracking-tight text-abyss sm:text-4xl">
					Pertanyaan umum
				</h2>
			</div>
			<div class="mt-10 space-y-3">
				{#each faq as item, i (item.q)}
					<details use:reveal={{ delay: Math.min(i, 3) * 60 }} class="group rounded-2xl border border-mist bg-white transition-colors duration-200 open:border-royal/40" name="faq-instruktur">
						<summary class="flex min-h-[56px] cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-heading text-sm font-bold text-abyss focus-visible:outline-2 focus-visible:outline-royal [&::-webkit-details-marker]:hidden">
							<span>{i + 1}. {item.q}</span>
							<span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ice text-royal transition-transform duration-200 group-open:rotate-45" aria-hidden="true">
								<i class="fa-solid fa-plus text-xs"></i>
							</span>
						</summary>
						<p class="px-5 pb-5 text-sm leading-relaxed text-slate-600">
							{item.a}
							{#if i === faq.length - 1}
								<a href={resolve('/tentang')} class="font-bold text-royal underline decoration-royal/30 underline-offset-4 transition-colors duration-200 hover:text-royal-hover"> Kunjungi halaman Tentang.</a>
							{/if}
						</p>
					</details>
				{/each}
			</div>
		</div>
	</section>

	<!-- CTA penutup -->
	<section aria-labelledby="cta-instruktur" class="relative overflow-hidden border-t border-mist bg-white">
		<div class="pointer-events-none absolute inset-0" aria-hidden="true">
			<div class="absolute -top-24 left-1/2 h-64 w-[42rem] -translate-x-1/2 rounded-full bg-ice blur-3xl"></div>
		</div>
		<div class="relative mx-auto max-w-7xl px-4 py-14 text-center sm:px-6 sm:py-16 lg:px-8">
			<p class="flex items-center justify-center gap-3 font-heading text-xs font-bold tracking-[0.18em] text-royal uppercase">
				<span class="h-px w-8 bg-royal" aria-hidden="true"></span>
				Mulai Sekarang
				<span class="h-px w-8 bg-royal" aria-hidden="true"></span>
			</p>
			<h2 id="cta-instruktur" class="mx-auto mt-3 max-w-2xl font-heading text-3xl font-extrabold tracking-tight text-abyss sm:text-4xl">
				Siap Membagikan Pengetahuanmu?
			</h2>
			<p class="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-slate-600 sm:text-base">
				Mulai langkahmu untuk menciptakan pengalaman belajar yang bermanfaat bersama ARISTOTELES.
			</p>
			<div class="mt-8">
				<a
					href={resolve('/menjadi-instruktur/daftar')}
					class="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-royal px-8 font-heading text-sm font-bold text-white transition-colors duration-200 hover:bg-royal-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal"
				>
					Daftar Sekarang
					<i class="fa-solid fa-arrow-right text-xs" aria-hidden="true"></i>
				</a>
			</div>
		</div>
	</section>
</main>

<PublicFooter />
