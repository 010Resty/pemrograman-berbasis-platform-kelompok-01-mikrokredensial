<script lang="ts">
	import '../../app.css';
	import Logo from '$lib/components/Logo.svelte';
	import { resolve } from '$app/paths';

	let menuOpen = $state(false);

	const mobileLinks = [
		{ href: '/', label: 'Beranda' },
		{ href: '/modules', label: 'Pelatihan' },
		{ href: '/#peringkat', label: 'Peringkat' },
		{ href: '/tentang', label: 'Tentang' },
		{ href: '/#verifikasi', label: 'Verifikasi' }
	];

	const highlights = [
		{ icon: 'fa-book-open', title: '20rb+ Pelatihan', desc: 'Mikrokredensial' },
		{ icon: 'fa-infinity', title: 'Akses Selamanya', desc: 'Materi Terbaru' },
		{ icon: 'fa-wallet', title: 'Terjangkau', desc: 'Harga Terbaik' },
		{ icon: 'fa-headset', title: 'Dukungan Mentoring', desc: 'Dukungan Seumur Hidup' },
		{ icon: 'fa-users', title: 'Komunitas Aktif', desc: 'Jaringan Luas' }
	];

	const steps = [
		{
			icon: 'fa-magnifying-glass',
			title: 'Pilih pelatihan',
			desc: 'Telusuri katalog dan pilih program mikrokredensial sesuai tujuan kariermu.'
		},
		{
			icon: 'fa-book-open',
			title: 'Belajar materi',
			desc: 'Pelajari materi teks, foto, audio, dan video per modul dengan alur terstruktur.'
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
			tile: 'bg-blue-50 text-blue-600',
			title: 'Peserta',
			desc: 'Belajar mandiri, kerjakan kuis dan tugas, tukar voucher, dan kumpulkan sertifikat per modul.',
			href: '/user',
			cta: 'Portal Peserta'
		},
		{
			icon: 'fa-chalkboard-user',
			tile: 'bg-emerald-50 text-emerald-600',
			title: 'Instruktur',
			desc: 'Kelola kurikulum, susun kuis dan tugas, nilai pengumpulan, dan pantau kelulusan peserta.',
			href: '/instruktur',
			cta: 'Portal Instruktur'
		},
		{
			icon: 'fa-shield-halved',
			tile: 'bg-violet-50 text-violet-600',
			title: 'Admin',
			desc: 'Kelola peserta, undang instruktur, atur voucher, dan pantau seluruh pelatihan.',
			href: '/admin',
			cta: 'Portal Admin'
		}
	];
</script>

<svelte:head>
	<title>Tentang Aristoteles — Platform Mikrokredensial</title>
	<meta
		name="description"
		content="Mengenal ARISTOTELES: platform pembelajaran mikrokredensial — kurikulum berbasis industri, mentor praktisi, dan sertifikat per modul."
	/>
</svelte:head>

<!-- Navbar publik (selaras landing page) -->
<header class="sticky top-0 z-50 bg-white shadow-sm">
	<div class="mx-auto flex h-20 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
		<a
			href="/"
			class="flex shrink-0 items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-blue-600"
			aria-label="Aristoteles - Beranda"
		>
			<Logo size="md" showText={true} textSize="xl" />
		</a>
		<nav
			aria-label="Navigasi utama"
			class="hidden min-w-0 flex-1 items-center justify-center gap-5 font-semibold text-[13px] text-slate-700 lg:flex xl:gap-7"
		>
			<a href="/#beranda" class="whitespace-nowrap transition hover:text-blue-600">BERANDA</a>
			<a href="/modules" class="whitespace-nowrap transition hover:text-blue-600">PELATIHAN</a>
			<a href="/#peringkat" class="whitespace-nowrap transition hover:text-blue-600">PERINGKAT</a>
			<a
				href="/tentang"
				aria-current="page"
				class="whitespace-nowrap text-blue-600 transition hover:text-blue-700">TENTANG</a
			>
			<a href="/#verifikasi" class="whitespace-nowrap transition hover:text-blue-600">VERIFIKASI</a>
		</nav>
		<div class="hidden shrink-0 items-center gap-2.5 sm:flex">
			<a
				href="/login"
				class="inline-flex min-h-[44px] items-center justify-center rounded-full border border-blue-600 px-5 text-xs font-bold whitespace-nowrap text-blue-700 uppercase transition hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
			>
				Masuk
			</a>
			<a
				href="/register"
				class="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-blue-600 px-5 text-xs font-bold whitespace-nowrap text-white uppercase shadow-lg shadow-blue-500/25 transition hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
			>
				Mulai Belajar
				<i class="fa-solid fa-arrow-right text-[11px]" aria-hidden="true"></i>
			</a>
		</div>
		<button
			type="button"
			onclick={() => (menuOpen = !menuOpen)}
			aria-expanded={menuOpen}
			aria-label={menuOpen ? 'Tutup menu' : 'Buka menu'}
			class="flex min-h-11 min-w-11 items-center justify-center rounded-lg p-2 text-slate-600 transition hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-blue-600 lg:hidden"
		>
			<i class="fa-solid {menuOpen ? 'fa-xmark' : 'fa-bars'} text-lg" aria-hidden="true"></i>
		</button>
	</div>
	{#if menuOpen}
		<nav aria-label="Navigasi seluler" class="border-t border-slate-100 bg-white px-4 py-3 lg:hidden">
			<ul class="space-y-1">
				{#each mobileLinks as link (link.href)}
					<li>
						<a
							href={link.href}
							class="block rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
						>
							{link.label}
						</a>
					</li>
				{/each}
			</ul>
		</nav>
	{/if}
</header>

<main>
	<!-- Hero -->
	<section class="relative overflow-hidden bg-slate-50 py-16 sm:py-20">
		<div class="pointer-events-none absolute inset-0" aria-hidden="true">
			<div
				class="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:44px_44px] opacity-60 [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black,transparent)]"
			></div>
			<div
				class="absolute -top-10 left-1/2 h-56 w-[36rem] -translate-x-1/2 rounded-full bg-blue-200/40 blur-3xl"
			></div>
		</div>
		<div class="relative mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
			<span
				class="bg-blue-100 px-3 py-1 text-xs font-bold tracking-widest text-blue-600 uppercase rounded-full"
				><i class="fa-solid fa-circle-info"></i> TENTANG ARISTOTELES</span
			>
			<h1 class="mx-auto mt-4 max-w-3xl text-3xl leading-snug font-extrabold text-slate-900 sm:text-4xl">
				Ubah Rasa Ingin Tahu Menjadi Keahlian yang Bermakna
			</h1>
			<p class="mx-auto mt-4 max-w-2xl text-sm text-slate-500 sm:text-base">
				ARISTOTELES adalah platform pembelajaran mikrokredensial: dari memilih pelatihan hingga
				memperoleh sertifikat. Terstruktur, terukur, dan berkelanjutan.
			</p>
			<div class="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
				<a
					href={resolve('/modules')}
					class="inline-flex items-center justify-center gap-3 rounded-xl bg-blue-600 px-8 py-4 text-xs font-bold text-white uppercase shadow-lg shadow-blue-600/30 transition hover:bg-blue-700"
				>
					Lihat Pelatihan <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
				</a>
				<a
					href="/#verifikasi"
					class="inline-flex items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-8 py-4 text-xs font-bold text-slate-700 uppercase transition hover:bg-slate-50"
				>
					Verifikasi Sertifikat
				</a>
			</div>
		</div>
	</section>

	<!-- Arti nama -->
	<section class="bg-white py-16 sm:py-20">
		<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
			<div class="grid items-center gap-10 lg:grid-cols-2">
				<div>
					<span
						class="bg-blue-100 px-3 py-1 text-xs font-bold tracking-widest text-blue-600 uppercase rounded-full"
						><i class="fa-solid fa-lightbulb"></i> ARTI NAMA</span
					>
					<h2 class="mt-4 text-2xl leading-snug font-extrabold text-slate-900 sm:text-3xl">
						Laboratorium Pendidikan untuk Era Kecerdasan Buatan
					</h2>
					<p class="mt-4 text-sm leading-relaxed text-slate-600 sm:text-base">
						ARISTOTELES adalah singkatan dari <strong class="text-slate-900"
							>Artificial Intelligence Research, Innovation, Science, Technology, and Engineering
							Laboratory for Education and Systems</strong
						>. Terinspirasi dari filsuf Aristoteles yang menekankan pembelajaran melalui pengalaman
						dan penalaran, platform ini merancang pendidikan vokasi yang praktis, terukur, dan
						relevan dengan dunia kerja modern.
					</p>
				</div>
				<div class="rounded-2xl border border-slate-200 bg-slate-50 p-6 sm:p-8">
					<dl class="space-y-4">
						{#each [{ k: 'Artificial Intelligence', v: 'Kecerdasan Buatan — fondasi analisis dan personalisasi belajar.' }, { k: 'Research & Innovation', v: 'Riset dan inovasi sebagai cara memperbarui kurikulum.' }, { k: 'Science, Technology & Engineering', v: 'Sains, teknologi, dan rekayasa sebagai bidang keahlian utama.' }, { k: 'Laboratory for Education & Systems', v: 'Laboratorium yang membangun sistem pendidikan yang hidup.' }] as item}
							<div class="flex gap-3">
								<span
									class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-xs text-white"
									aria-hidden="true"
								>
									<i class="fa-solid fa-flask"></i>
								</span>
								<div>
									<dt class="text-sm font-extrabold text-slate-900">{item.k}</dt>
									<dd class="mt-0.5 text-xs leading-relaxed text-slate-500">{item.v}</dd>
								</div>
							</div>
						{/each}
					</dl>
				</div>
			</div>
		</div>
	</section>

	<!-- Cara kerja -->
	<section class="bg-slate-50 py-16 sm:py-20">
		<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
			<div class="mx-auto mb-12 max-w-2xl space-y-3 text-center">
				<span
					class="bg-blue-100 px-3 py-1 text-xs font-bold tracking-widest text-blue-600 uppercase rounded-full"
					><i class="fa-solid fa-route"></i> CARA KERJA</span
				>
				<h2 class="text-3xl font-extrabold text-slate-900 sm:text-4xl">Empat Langkah Menuju Sertifikat</h2>
				<p class="text-sm text-slate-500">
					Alur belajar yang jelas dari awal hingga sertifikat mikrokredensial di tangan.
				</p>
			</div>
			<ol class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
				{#each steps as step, i (step.title)}
					<li
						class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md"
					>
						<span
							class="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white"
							aria-hidden="true"
						>
							<i class="fa-solid {step.icon}"></i>
						</span>
						<p class="mt-4 text-xs font-extrabold tracking-widest text-blue-600 uppercase">
							Langkah {i + 1}
						</p>
						<h3 class="mt-1 text-base font-extrabold text-slate-900">{step.title}</h3>
						<p class="mt-1.5 text-xs leading-relaxed text-slate-500">{step.desc}</p>
					</li>
				{/each}
			</ol>
		</div>
	</section>

	<!-- Untuk siapa -->
	<section class="bg-white py-16 sm:py-20">
		<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
			<div class="mx-auto mb-12 max-w-2xl space-y-3 text-center">
				<span
					class="bg-blue-100 px-3 py-1 text-xs font-bold tracking-widest text-blue-600 uppercase rounded-full"
					><i class="fa-solid fa-users"></i> UNTUK SIAPA</span
				>
				<h2 class="text-3xl font-extrabold text-slate-900 sm:text-4xl">Satu Platform, Tiga Portal</h2>
				<p class="text-sm text-slate-500">
					Setiap peran memiliki ruang kerja sendiri yang saling terhubung.
				</p>
			</div>
			<div class="grid grid-cols-1 gap-5 md:grid-cols-3">
				{#each roles as role (role.title)}
					<article
						class="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md"
					>
						<span
							class="flex h-11 w-11 items-center justify-center rounded-xl {role.tile}"
							aria-hidden="true"
						>
							<i class="fa-solid {role.icon}"></i>
						</span>
						<h3 class="mt-4 text-base font-extrabold text-slate-900">{role.title}</h3>
						<p class="mt-1.5 flex-1 text-xs leading-relaxed text-slate-500">{role.desc}</p>
						<a
							href={role.href}
							class="mt-4 inline-flex items-center gap-2 text-xs font-extrabold tracking-wide text-blue-600 uppercase underline decoration-blue-200 underline-offset-4 transition hover:text-blue-700"
							aria-label="{role.cta} — buka portal {role.title}"
						>
							{role.cta} <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
						</a>
					</article>
				{/each}
			</div>
		</div>
	</section>

	<!-- Keunggulan + statistik -->
	<section class="bg-slate-50 py-16 sm:py-20">
		<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
			<div class="grid items-center gap-10 lg:grid-cols-2">
				<div>
					<span
						class="bg-blue-100 px-3 py-1 text-xs font-bold tracking-widest text-blue-600 uppercase rounded-full"
						><i class="fa-solid fa-star"></i> MENGAPA ARISTOTELES</span
					>
					<h2 class="mt-4 text-2xl leading-snug font-extrabold text-slate-900 sm:text-3xl">
						Kurikulum Industri, Mentor Praktisi, Sertifikat Terverifikasi
					</h2>
					<ul class="mt-6 space-y-2.5 text-sm text-slate-600">
						<li class="flex items-start gap-2.5">
							<i class="fa-solid fa-circle-check mt-0.5 text-green-500" aria-hidden="true"></i>
							Kurikulum yang terus diperbarui sesuai kebutuhan industri dan transformasi digital.
						</li>
						<li class="flex items-start gap-2.5">
							<i class="fa-solid fa-circle-check mt-0.5 text-green-500" aria-hidden="true"></i>
							Akses lebih dari 100.000 kursus online dan mikrokredensial yang diperbarui setiap tahun.
						</li>
						<li class="flex items-start gap-2.5">
							<i class="fa-solid fa-circle-check mt-0.5 text-green-500" aria-hidden="true"></i>
							Pelajari keterampilan berdampak tinggi yang dibutuhkan perusahaan global terkemuka.
						</li>
					</ul>
				</div>
				<dl class="grid grid-cols-2 gap-4">
					{#each highlights as h (h.title)}
						<div class="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4">
							<span
								class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white"
								aria-hidden="true"
							>
								<i class="fa-solid {h.icon}"></i>
							</span>
							<div class="text-left">
								<dt class="text-sm font-extrabold text-slate-900">{h.title}</dt>
								<dd class="text-xs text-slate-500">{h.desc}</dd>
							</div>
						</div>
					{/each}
				</dl>
			</div>
			<div class="mt-12 text-center">
				<a
					href={resolve('/modules')}
					class="inline-flex items-center gap-3 rounded-xl bg-blue-600 px-8 py-4 text-xs font-bold text-white uppercase shadow-lg shadow-blue-600/30 transition hover:bg-blue-700"
				>
					Mulai Belajar Sekarang <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
				</a>
			</div>
		</div>
	</section>
</main>

<footer class="border-t border-slate-800 bg-slate-900 py-8 text-center text-xs text-slate-500">
	&copy; 2026 Aristoteles Platform Mikrokredensial. Semua hak dilindungi.
</footer>
