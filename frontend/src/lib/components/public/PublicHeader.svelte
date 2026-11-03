<script lang="ts">
	import { resolve } from '$app/paths';
	import Logo from '$lib/components/Logo.svelte';
	import dropdownBg from '$lib/assets/dropdown-background.jpg';

	interface PromoItem {
		id: number | string;
		title: string;
		badge?: string;
		/** Deskripsi pendek di bawah judul (gaya mega menu). */
		desc?: string;
		href: string;
	}

	interface Props {
		active: 'promo' | 'pelatihan' | 'peringkat' | 'tentang' | 'verifikasi' | 'menjadi-instruktur';
		showSearch?: boolean;
		/**
		 * Daftar item dropdown menu Promo. Bila tidak diisi, dipakai daftar
		 * bawaan (shortcut tiap bagian landing) sehingga dropdown tetap bisa
		 * diakses dari halaman publik mana pun, bukan hanya di landing.
		 */
		promoItems?: PromoItem[];
	}

	let { active, showSearch = true, promoItems }: Props = $props();
	let menuOpen = $state(false);
	let promoOpen = $state(false);
	let mobilePromoOpen = $state(false);
	let promoWrap: HTMLDivElement | undefined = $state(undefined);

	/**
	 * Shortcut bawaan ke tiap bagian landing — dipakai saat halaman tidak
	 * mengoper `promoItems` sendiri, sehingga dropdown Promo bisa diakses
	 * dari halaman publik mana pun (tautan absolut `/#bagian`).
	 */
	const defaultPromoItems: PromoItem[] = [
		{ id: 'promo', title: 'Promo Pelatihan', desc: 'Penawaran harga spesial periode terbatas', href: `${resolve('/')}#promo` },
		{ id: 'unggulan', title: 'Pilihan Unggulan', desc: 'Sorotan pelatihan terbit terbaru', href: `${resolve('/')}#unggulan` },
		{ id: 'patungan', title: 'Promo Patungan', desc: 'Checkout kelas bareng, bayar lebih hemat', href: `${resolve('/')}#patungan` },
		{ id: 'cara-belajar', title: 'Cara Belajar', desc: 'Empat langkah menuju sertifikat', href: `${resolve('/')}#cara-belajar` },
		{ id: 'gratis', title: 'Mulai Gratis', desc: 'Kelas tanpa biaya untuk mulai belajar', href: `${resolve('/')}#gratis` }
	];

	const promoMenuItems = $derived(promoItems ?? defaultPromoItems);

	function closePromo(): void {
		promoOpen = false;
	}

	function handleWindowClick(e: MouseEvent): void {
		if (promoOpen && promoWrap && !promoWrap.contains(e.target as Node | null)) {
			promoOpen = false;
		}
	}

	function handleWindowKeydown(e: KeyboardEvent): void {
		if (e.key === 'Escape') promoOpen = false;
	}

	const links = [
		{ id: 'promo' as const, label: 'Promo', href: resolve('/') },
		{ id: 'pelatihan' as const, label: 'Pelatihan', href: resolve('/pelatihan') },
		{ id: 'peringkat' as const, label: 'Peringkat', href: resolve('/peringkat') },
		{ id: 'tentang' as const, label: 'Tentang', href: resolve('/tentang') },
		{ id: 'verifikasi' as const, label: 'Verifikasi', href: resolve('/verifikasi') }
	];

	const mobileLinks = [
		{ label: 'Promo', href: resolve('/') },
		{ label: 'Pelatihan', href: resolve('/pelatihan') },
		{ label: 'Peringkat', href: resolve('/peringkat') },
		{ label: 'Tentang', href: resolve('/tentang') },
		{ label: 'Verifikasi', href: resolve('/verifikasi') }
	];
</script>

<svelte:window onclick={handleWindowClick} onkeydown={handleWindowKeydown} />

<header class="sticky top-0 z-50 border-b border-mist bg-white/95 backdrop-blur">
	<div class="mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
		<a
			href={resolve('/')}
			class="flex shrink-0 items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-royal"
			aria-label="Aristoteles - Promo"
			aria-current={active === 'promo' ? 'page' : undefined}
		>
			<Logo size="md" showText={true} textSize="xl" />
		</a>

		<nav
			aria-label="Navigasi utama"
			class="hidden min-w-0 flex-1 items-center justify-center gap-1 font-heading text-[15px] font-semibold lg:flex"
		>
			{#each links as link (link.id)}
				{#if link.id === 'promo'}
					<div class="relative" bind:this={promoWrap}>
						<button
							type="button"
							aria-haspopup="true"
							aria-expanded={promoOpen}
							onclick={() => (promoOpen = !promoOpen)}
							onkeydown={(e) => {
								if (e.key === 'Escape') promoOpen = false;
							}}
							class="relative flex cursor-pointer items-center gap-1.5 rounded-lg px-4 py-2 transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-royal {active === link.id
								? 'text-royal'
								: 'text-slate-600 hover:text-abyss'}"
						>
							{link.label}
							<i class={`fa-solid fa-chevron-down text-[10px] transition-transform duration-200 ${promoOpen ? 'rotate-180' : ''}`} aria-hidden="true"></i>
						</button>
						{#if promoOpen}
							<div class="absolute top-full left-1/2 z-50 w-[540px] max-w-[calc(100vw-2rem)] -translate-x-1/2 pt-2.5">
								<div class="flex overflow-hidden rounded-2xl border border-mist bg-white shadow-[0_16px_32px_rgba(0,0,0,0.08)]">
									<div class="relative flex w-[42%] flex-col items-center justify-center overflow-hidden p-6 text-center text-white">
										<img src={dropdownBg} alt="" aria-hidden="true" class="absolute inset-0 h-full w-full object-cover" loading="lazy" />
										<div class="absolute inset-0 bg-abyss/65" aria-hidden="true"></div>
										<div class="relative">
											<p class="mb-2 text-xs font-semibold tracking-wide text-teal">Penawaran Spesial</p>
											<p class="font-heading text-xl leading-snug font-extrabold">Hemat Lebih Banyak</p>
											<p class="mt-2 text-xs leading-relaxed text-slate-200">Dapatkan promo terbaik untuk investasi belajarmu</p>
										</div>
									</div>
									<ul class="flex w-[58%] flex-col gap-0.5 p-3">
										{#each promoMenuItems as item (item.id)}
											<li>
												<a
													href={item.href}
													onclick={closePromo}
													class="block rounded-lg px-3 py-2 transition-colors duration-200 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-royal"
												>
													<span class="flex items-center gap-2">
														<span class="text-sm font-bold text-abyss">{item.title}</span>
														{#if item.badge}
															<span class="rounded-full bg-royal px-2 py-0.5 text-[10px] font-bold tracking-wider text-white uppercase">{item.badge}</span>
														{/if}
													</span>
													{#if item.desc}
														<span class="mt-0.5 block text-xs text-slate-400">{item.desc}</span>
													{/if}
												</a>
											</li>
										{/each}
										{#if promoMenuItems.length === 0}
											<li class="px-4 py-3 text-sm text-slate-500">Belum ada promo saat ini.</li>
										{/if}
									</ul>
								</div>
							</div>
						{/if}
					</div>
				{:else}
					<a
						href={link.href}
						aria-current={active === link.id ? 'page' : undefined}
						class="relative rounded-lg px-4 py-2 transition-colors duration-200 {active === link.id
							? 'text-royal'
							: 'text-slate-600 hover:text-abyss'}"
					>
						{link.label}
					</a>
				{/if}
			{/each}
		</nav>

		<div class="hidden shrink-0 items-center gap-3 sm:flex">
			{#if showSearch}
				<div
					class="hidden items-center rounded-[10px] border border-mist bg-slate-50 py-2 pr-2 pl-3 xl:flex"
				>
					<label for="public-nav-search" class="sr-only">Cari program mikrokredensial</label>
					<i class="fa-solid fa-magnifying-glass text-xs text-slate-400" aria-hidden="true"></i>
					<input
						id="public-nav-search"
						type="search"
						placeholder="Cari program..."
						class="w-36 bg-transparent pl-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
					/>
				</div>
			{/if}
			<a
				href={resolve('/login')}
				class="inline-flex min-h-[42px] items-center justify-center rounded-[10px] border border-mist bg-white px-5 font-heading text-sm font-bold text-abyss transition-colors duration-200 hover:border-royal hover:text-royal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal"
			>
				Masuk
			</a>
			<a
				href={resolve('/register')}
				class="inline-flex min-h-[42px] items-center justify-center rounded-[10px] bg-royal px-5 font-heading text-sm font-bold text-white shadow-sm transition-colors duration-200 hover:bg-royal-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal"
			>
				Daftar
			</a>
		</div>

		<button
			type="button"
			onclick={() => (menuOpen = !menuOpen)}
			aria-expanded={menuOpen}
			aria-controls="public-mobile-nav"
			aria-label={menuOpen ? 'Tutup menu navigasi' : 'Buka menu navigasi'}
			class="flex min-h-11 min-w-11 items-center justify-center rounded-[10px] p-2 text-abyss transition-colors duration-200 hover:bg-ice focus-visible:outline-2 focus-visible:outline-royal lg:hidden"
		>
			<i class={`fa-solid ${menuOpen ? 'fa-xmark' : 'fa-bars'} text-lg`} aria-hidden="true"></i>
		</button>
	</div>

	{#if menuOpen}
		<nav
			id="public-mobile-nav"
			aria-label="Navigasi seluler"
			class="border-t border-mist bg-white px-4 pt-2 pb-5 sm:px-6 lg:hidden"
		>
			<ul class="divide-y divide-mist font-heading text-[15px] font-semibold">
				{#each mobileLinks as link (link.href)}
					<li>
						{#if link.label === 'Promo'}
							<button
								type="button"
								aria-expanded={mobilePromoOpen}
								onclick={() => (mobilePromoOpen = !mobilePromoOpen)}
								class="flex w-full items-center justify-between rounded-lg px-2 py-3 transition-colors duration-200 hover:bg-ice focus-visible:outline-2 focus-visible:outline-royal {active === 'promo' ? 'text-royal' : 'text-slate-700'}"
							>
								{link.label}
								<i class={`fa-solid fa-chevron-down text-xs transition-transform duration-200 ${mobilePromoOpen ? 'rotate-180' : ''}`} aria-hidden="true"></i>
							</button>
							{#if mobilePromoOpen}
								<ul class="mb-2 ml-2 space-y-0.5 border-l-2 border-mist pl-3">
								{#each promoMenuItems as item (item.id)}
										<li>
											<a
												href={item.href}
												onclick={() => (menuOpen = false)}
												class="flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 text-sm font-semibold text-slate-600 transition-colors duration-200 hover:bg-ice hover:text-abyss focus-visible:outline-2 focus-visible:outline-royal"
											>
												<span class="min-w-0 flex-1">
												<span class="block truncate">{item.title}</span>
												{#if item.desc}
													<span class="block truncate text-xs font-normal text-slate-400">{item.desc}</span>
												{/if}
											</span>
												{#if item.badge}
													<span class="shrink-0 rounded-md bg-abyss px-2 py-0.5 font-heading text-[11px] font-bold text-white">{item.badge}</span>
												{/if}
											</a>
										</li>
									{/each}
								{#if promoMenuItems.length === 0}
										<li class="px-2 py-2.5 text-sm font-normal text-slate-500">Belum ada promo saat ini.</li>
									{/if}
								</ul>
							{/if}
						{:else}
							<a
								href={link.href}
								onclick={() => (menuOpen = false)}
								class="block rounded-lg px-2 py-3 transition-colors duration-200 hover:bg-ice focus-visible:outline-2 focus-visible:outline-royal {link.href === '/' && active === 'promo' ? 'text-royal' : 'text-slate-700'}"
							>
								{link.label}
							</a>
						{/if}
					</li>
				{/each}
			</ul>
			<div class="mt-3 grid grid-cols-2 gap-2.5 sm:hidden">
				<a
					href={resolve('/login')}
					class="inline-flex min-h-[44px] items-center justify-center rounded-[10px] border border-mist px-4 font-heading text-sm font-bold text-abyss transition-colors duration-200 hover:border-royal hover:text-royal"
				>
					Masuk
				</a>
				<a
					href={resolve('/register')}
					class="inline-flex min-h-[44px] items-center justify-center rounded-[10px] bg-royal px-4 font-heading text-sm font-bold text-white transition-colors duration-200 hover:bg-royal-hover"
				>
					Daftar
				</a>
			</div>
		</nav>
	{/if}
</header>
