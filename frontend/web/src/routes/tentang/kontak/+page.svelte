<script lang="ts">
	import { onDestroy } from 'svelte';
	import '../../../app.css';
	import PublicHeader from '$lib/components/public/PublicHeader.svelte';
	import PublicFooter from '$lib/components/public/PublicFooter.svelte';
	import SeoHead from '$lib/components/SeoHead.svelte';
	import { canonicalPath, getSiteUrl } from '$lib/seo/site';
	import { resolve } from '$app/paths';
	import { reveal } from '$lib/actions/reveal';
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

	const siblings = TENTANG_SUBPAGES.filter((s) => s.id !== 'kontak');

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
			formError = 'Nama, email, dan pesan wajib diisi.';
			return;
		}
		if (!isEmail(email)) {
			formError = 'Format email tidak valid.';
			return;
		}
		const subject = encodeURIComponent(`Kontak ARISTOTELES — ${name.trim()}`);
		const body = encodeURIComponent(
			`Nama: ${name.trim()}\nEmail: ${email.trim()}\nTelepon: ${phone.trim() || '-'}\n\n${message.trim()}`
		);
		window.location.href = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
	}

	const kontakJsonLd = [
		{
			'@context': 'https://schema.org',
			'@type': 'ContactPage',
			name: 'Kontak Kami — ARISTOTELES',
			description:
				'Hubungi tim ARISTOTELES lewat email atau kunjungi lokasi kami. Formulir membuka aplikasi email Anda.',
			url: canonicalPath('/tentang/kontak'),
			inLanguage: 'id-ID',
			isPartOf: { '@type': 'WebSite', name: 'ARISTOTELES', url: getSiteUrl() }
		},
		{
			'@context': 'https://schema.org',
			'@type': 'BreadcrumbList',
			itemListElement: [
				{ '@type': 'ListItem', position: 1, name: 'Beranda', item: canonicalPath('/') },
				{ '@type': 'ListItem', position: 2, name: 'Tentang', item: canonicalPath('/tentang/arti-nama') },
				{ '@type': 'ListItem', position: 3, name: 'Kontak Kami', item: canonicalPath('/tentang/kontak') }
			]
		}
	];
</script>

<SeoHead
	title="Kontak Kami — ARISTOTELES"
	description="Hubungi tim ARISTOTELES lewat email admineraristoteles@gmail.com atau kunjungi lokasi kami. Formulir membuka aplikasi email Anda."
	path="/tentang/kontak"
	jsonLd={kontakJsonLd}
/>

<PublicHeader active="tentang" />

<main>
	<!-- Hero -->
	<section aria-labelledby="kontak-heading" class="relative overflow-hidden bg-ice">
		<img src={kamiBg} alt="" aria-hidden="true" class="absolute inset-0 h-full w-full object-cover" loading="eager" fetchpriority="high" />
		<div class="absolute inset-0 bg-gradient-to-b from-abyss/75 via-royal/55 to-abyss/75" aria-hidden="true"></div>
		<div class="pointer-events-none absolute inset-0" aria-hidden="true">
			<div class="absolute top-10 left-[8%] hidden gap-1 text-white/30 sm:flex" aria-hidden="true">
				<i class="fa-solid fa-chevron-right text-2xl"></i>
				<i class="fa-solid fa-chevron-right text-2xl"></i>
				<i class="fa-solid fa-chevron-right text-2xl"></i>
				<i class="fa-solid fa-chevron-right text-2xl"></i>
			</div>
			<div class="absolute right-[8%] bottom-16 hidden gap-1 text-white/30 sm:flex" aria-hidden="true">
				<i class="fa-solid fa-chevron-right text-2xl"></i>
				<i class="fa-solid fa-chevron-right text-2xl"></i>
				<i class="fa-solid fa-chevron-right text-2xl"></i>
			</div>
		</div>
		<div class="relative mx-auto max-w-7xl px-4 py-14 text-center sm:px-6 sm:py-16 lg:px-8">
			<h1 id="kontak-heading" class="font-heading text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
				Kontak Kami
			</h1>
			<svg class="mx-auto mt-3 h-3 w-40 text-teal" viewBox="0 0 160 12" fill="none" aria-hidden="true">
				<path d="M2 8 Q 12 2, 22 8 T 42 8 T 62 8 T 82 8 T 102 8 T 122 8 T 142 8 T 158 8" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" />
			</svg>
			<p class="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-slate-300 sm:text-base">
				Ada pertanyaan tentang pelatihan, akun, atau kerja sama? Kirim pesan lewat
				formulir di bawah — aplikasi email Anda akan terbuka dengan tujuan
				{CONTACT_EMAIL}.
			</p>
		</div>
	</section>

	<!-- Formulir + layanan cepat -->
	<section aria-label="Formulir kontak dan layanan cepat" class="bg-white">
		<div class="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
			<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
				<form
					use:reveal
					onsubmit={submitContact}
					aria-label="Formulir kontak"
					class="rounded-2xl border border-mist bg-white p-6 shadow-xl shadow-slate-900/5 sm:p-8"
					novalidate
				>
					<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<div>
							<label for="kontak-email" class="mb-1.5 block text-xs font-bold text-slate-700">Email</label>
							<input
								id="kontak-email"
								type="email"
								bind:value={email}
								autocomplete="email"
								placeholder="nama@email.com"
								class="w-full rounded-full border border-mist bg-ice/60 px-5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-royal focus:bg-white focus:outline-none"
							/>
						</div>
						<div>
							<label for="kontak-phone" class="mb-1.5 block text-xs font-bold text-slate-700">Telepon <span class="font-normal text-slate-400">(opsional)</span></label>
							<input
								id="kontak-phone"
								type="tel"
								bind:value={phone}
								autocomplete="tel"
								placeholder="+62 ..."
								class="w-full rounded-full border border-mist bg-ice/60 px-5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-royal focus:bg-white focus:outline-none"
							/>
						</div>
					</div>
					<div class="mt-4">
						<label for="kontak-name" class="mb-1.5 block text-xs font-bold text-slate-700">Nama</label>
						<input
							id="kontak-name"
							type="text"
							bind:value={name}
							autocomplete="name"
							maxlength={100}
							placeholder="Nama lengkap Anda"
							class="w-full rounded-full border border-mist bg-ice/60 px-5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-royal focus:bg-white focus:outline-none"
						/>
					</div>
					<div class="mt-4">
						<label for="kontak-message" class="mb-1.5 block text-xs font-bold text-slate-700">Pesan</label>
						<textarea
							id="kontak-message"
							bind:value={message}
							rows={5}
							maxlength={2000}
							placeholder="Tulis pertanyaan atau kebutuhan Anda…"
							class="w-full resize-y rounded-2xl border border-mist bg-ice/60 px-5 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-royal focus:bg-white focus:outline-none"
						></textarea>
					</div>
					{#if formError}
						<p role="alert" class="mt-3 text-xs font-semibold text-red-600">{formError}</p>
					{/if}
					<button
						type="submit"
						class="mt-4 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-royal px-8 py-2.5 font-heading text-xs font-bold text-white transition-colors duration-200 hover:bg-royal-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal"
					>
						Kirim Pesan <i class="fa-solid fa-paper-plane" aria-hidden="true"></i>
					</button>
					<p class="mt-2 text-[11px] text-slate-400">Mengirim = membuka aplikasi email Anda dengan tujuan {CONTACT_EMAIL}.</p>
				</form>

				<aside use:reveal aria-labelledby="layanan-heading" class="relative overflow-hidden rounded-2xl bg-navy p-6 text-white shadow-xl shadow-slate-900/10 sm:p-8">
					<img src={layananBg} alt="" aria-hidden="true" class="absolute inset-0 h-full w-full object-cover" loading="lazy" />
					<div class="absolute inset-0 bg-gradient-to-t from-navy via-navy/80 to-navy/40" aria-hidden="true"></div>
					<div class="relative">
					<h2 id="layanan-heading" class="font-heading text-xl font-extrabold">Layanan Cepat</h2>
					<p class="mt-2 text-sm leading-relaxed text-slate-300">
						Butuh hal lain? Langsung ke layanan yang Anda tuju.
					</p>
					<ul class="mt-4 space-y-2.5">
						<li>
							<a
								href={resolve('/register')}
								class="flex items-center gap-3 rounded-xl bg-white/10 px-4 py-3 transition-colors hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-white"
							>
								<span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 text-base" aria-hidden="true">
									<i class="fa-solid fa-user-plus"></i>
								</span>
								<span class="min-w-0">
									<span class="block font-heading text-sm font-bold text-white">Pendaftaran &amp; Akun</span>
									<span class="block truncate text-xs text-slate-300">Buat akun dan mulai belajar.</span>
								</span>
								<i class="fa-solid fa-arrow-right ml-auto shrink-0 text-xs text-slate-400" aria-hidden="true"></i>
							</a>
						</li>
						<li>
							<a
								href={resolve('/user/pembayaran')}
								class="flex items-center gap-3 rounded-xl bg-white/10 px-4 py-3 transition-colors hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-white"
							>
								<span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 text-base" aria-hidden="true">
									<i class="fa-solid fa-ticket"></i>
								</span>
								<span class="min-w-0">
									<span class="block font-heading text-sm font-bold text-white">Pembayaran &amp; Voucher</span>
									<span class="block truncate text-xs text-slate-300">Bayar kelas atau tukar kode voucher.</span>
								</span>
								<i class="fa-solid fa-arrow-right ml-auto shrink-0 text-xs text-slate-400" aria-hidden="true"></i>
							</a>
						</li>
						<li>
							<a
								href={resolve('/verifikasi')}
								class="flex items-center gap-3 rounded-xl bg-white/10 px-4 py-3 transition-colors hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-white"
							>
								<span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 text-base" aria-hidden="true">
									<i class="fa-solid fa-award"></i>
								</span>
								<span class="min-w-0">
									<span class="block font-heading text-sm font-bold text-white">Verifikasi Sertifikat</span>
									<span class="block truncate text-xs text-slate-300">Cek keaslian sertifikat.</span>
								</span>
								<i class="fa-solid fa-arrow-right ml-auto shrink-0 text-xs text-slate-400" aria-hidden="true"></i>
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
				<div use:reveal class="flex flex-col rounded-2xl border border-mist bg-white p-6 shadow-sm">
					<div class="flex items-center gap-3">
						<span class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-royal/10 text-xl text-royal" aria-hidden="true">
							<i class="fa-solid fa-envelope"></i>
						</span>
						<p class="font-heading text-xs font-bold tracking-[0.14em] text-slate-500 uppercase">Email</p>
					</div>
					<a
						href={`mailto:${CONTACT_EMAIL}`}
						class="mt-4 flex min-h-[44px] items-center rounded-xl bg-royal/5 px-4 text-sm font-bold break-all text-royal transition-colors hover:bg-royal/10 focus-visible:outline-2 focus-visible:outline-royal"
					>
						{CONTACT_EMAIL}
					</a>
					<p class="mt-2 text-xs text-slate-500">Untuk pertanyaan, bantuan akun, dan kerja sama.</p>
					<div class="mt-auto pt-4" aria-live="polite">
						<button
							type="button"
							onclick={() => void copyText('email', CONTACT_EMAIL)}
							class="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-mist px-4 text-xs font-bold text-slate-700 transition-colors hover:border-royal hover:text-royal focus-visible:outline-2 focus-visible:outline-royal"
						>
							<i class={`fa-solid ${copied === 'email' ? 'fa-check text-teal' : 'fa-copy'}`} aria-hidden="true"></i>
							{copied === 'email' ? 'Disalin!' : 'Salin alamat email'}
						</button>
					</div>
				</div>
				<div use:reveal={{ delay: 80 }} class="flex flex-col rounded-2xl border border-mist bg-white p-6 shadow-sm">
					<div class="flex items-center gap-3">
						<span class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-teal/10 text-xl text-teal" aria-hidden="true">
							<i class="fa-solid fa-phone"></i>
						</span>
						<p class="font-heading text-xs font-bold tracking-[0.14em] text-slate-500 uppercase">Telepon</p>
					</div>
					<a
						href={`tel:${CONTACT_PHONE}`}
						class="mt-4 flex min-h-[44px] items-center rounded-xl bg-teal/5 px-4 text-sm font-bold text-teal transition-colors hover:bg-teal/10 focus-visible:outline-2 focus-visible:outline-teal"
					>
						{CONTACT_PHONE_LABEL}
					</a>
					<p class="mt-2 text-xs text-slate-500">Hubungi langsung untuk keperluan mendesak.</p>
					<div class="mt-auto pt-4" aria-live="polite">
						<button
							type="button"
							onclick={() => void copyText('phone', CONTACT_PHONE)}
							class="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-mist px-4 text-xs font-bold text-slate-700 transition-colors hover:border-teal hover:text-teal focus-visible:outline-2 focus-visible:outline-teal"
						>
							<i class={`fa-solid ${copied === 'phone' ? 'fa-check text-teal' : 'fa-copy'}`} aria-hidden="true"></i>
							{copied === 'phone' ? 'Disalin!' : 'Salin nomor telepon'}
						</button>
					</div>
				</div>
				<div use:reveal={{ delay: 160 }} class="flex flex-col rounded-2xl border border-mist bg-white p-6 shadow-sm">
					<div class="flex items-center gap-3">
						<span class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-xl text-amber-600" aria-hidden="true">
							<i class="fa-solid fa-location-dot"></i>
						</span>
						<p class="font-heading text-xs font-bold tracking-[0.14em] text-slate-500 uppercase">Alamat</p>
					</div>
					<p class="mt-4 flex min-h-[44px] items-center rounded-xl bg-amber-50 px-4 text-sm font-bold text-slate-800">
						{ADDRESS_NAME}
					</p>
					<p class="mt-2 text-xs text-slate-500">Lihat lokasi dan rute di Google Maps.</p>
					<div class="mt-auto pt-4">
						<a
							href={MAPS_URL}
							target="_blank"
							rel="noopener"
							class="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-mist px-4 text-xs font-bold text-slate-700 transition-colors hover:border-amber-500 hover:text-amber-600 focus-visible:outline-2 focus-visible:outline-amber-500"
						>
							<i class="fa-solid fa-map-location-dot" aria-hidden="true"></i>
							Buka di Google Maps
						</a>
					</div>
				</div>
			</div>

			<div use:reveal class="mt-6 overflow-hidden rounded-2xl border border-mist bg-white shadow-sm">
				<iframe
					title="Peta lokasi {ADDRESS_NAME}"
					src={MAPS_EMBED}
					class="h-80 w-full border-0"
					loading="lazy"
					referrerpolicy="no-referrer-when-downgrade"
					allowfullscreen
				></iframe>
				<div class="flex flex-col items-center gap-4 p-5 sm:flex-row sm:justify-between">
					<div class="flex items-center gap-4">
						<span class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-xl text-red-500" aria-hidden="true">
							<i class="fa-solid fa-map-pin"></i>
						</span>
						<div>
							<h2 class="font-heading text-base font-bold text-abyss">{ADDRESS_NAME}</h2>
							<p class="mt-0.5 text-xs text-slate-500">Rute dan titik kumpul tersedia di Google Maps.</p>
						</div>
					</div>
					<a
						href={MAPS_URL}
						target="_blank"
						rel="noopener"
						class="inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-xl bg-abyss px-5 py-2.5 font-heading text-xs font-bold text-white transition-colors hover:bg-royal focus-visible:outline-2 focus-visible:outline-royal"
					>
						<i class="fa-solid fa-diamond-turn-right" aria-hidden="true"></i> Petunjuk Arah
					</a>
				</div>
			</div>
		</div>
	</section>

	<!-- Sub-halaman lain -->
	<section aria-labelledby="tentang-lain-heading" class="bg-white">
		<div class="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
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
