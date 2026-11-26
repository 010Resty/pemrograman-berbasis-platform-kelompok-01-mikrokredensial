<script lang="ts">
	import { page } from '$app/state';
	import Logo from '$lib/components/Logo.svelte';
	import LanguageSwitcher from '$lib/components/LanguageSwitcher.svelte';
	import dropdownBg from '$lib/assets/dropdown-background.jpg';
	import { lp, type Locale } from '$lib/i18n/locale';
	import { t } from '$lib/i18n/index';

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
	}

	let { active }: Props = $props();
	let menuOpen = $state(false);
	let promoOpen = $state(false);
	let mobilePromoOpen = $state(false);
	let promoWrap: HTMLDivElement | undefined = $state(undefined);
	let tentangOpen = $state(false);
	let mobileTentangOpen = $state(false);
	let tentangWrap: HTMLDivElement | undefined = $state(undefined);

	const lang: Locale = $derived(page.params.lang === 'en' ? 'en' : 'id');

	/**
	 * Item dropdown Promo: 3 halaman jenis. Sengaja tanpa daftar kampanye
	 * agar tidak duplikat/generic (judul kampanye demo sama dengan badge-nya).
	 * Kampanye baru tetap punya halaman sendiri via /promo/[slug] + sidebar.
	 */
	const promoMenuItems = $derived<PromoItem[]>([
		{ id: 'jenis-diskon', title: t(lang, 'nav.promoFlash'), desc: t(lang, 'nav.promoFlashDesc'), href: lp(lang, '/promo/diskon') },
		{ id: 'jenis-kurasi', title: t(lang, 'nav.promoCurated'), desc: t(lang, 'nav.promoCuratedDesc'), href: lp(lang, '/promo/kurasi') },
		{ id: 'jenis-patungan', title: t(lang, 'nav.promoPatungan'), desc: t(lang, 'nav.promoPatunganDesc'), href: lp(lang, '/promo/patungan') }
	]);

	const tentangMenuItems = $derived([
		{ id: 'arti-nama', title: t(lang, 'nav.artiNama'), desc: t(lang, 'nav.artiNamaDesc'), href: lp(lang, '/tentang/arti-nama') },
		{ id: 'cara-kerja', title: t(lang, 'nav.caraKerja'), desc: t(lang, 'nav.caraKerjaDesc'), href: lp(lang, '/tentang/cara-kerja') },
		{ id: 'kontak', title: t(lang, 'nav.kontak'), desc: t(lang, 'nav.kontakDesc'), href: lp(lang, '/tentang/kontak') },
		{ id: 'keunggulan', title: t(lang, 'nav.keunggulan'), desc: t(lang, 'nav.keunggulanDesc'), href: lp(lang, '/tentang/keunggulan') }
	]);

	function closePromo(): void {
		promoOpen = false;
	}

	function closeTentang(): void {
		tentangOpen = false;
	}

	function handleWindowClick(e: MouseEvent): void {
		if (promoOpen && promoWrap && !promoWrap.contains(e.target as Node | null)) {
			promoOpen = false;
		}
		if (tentangOpen && tentangWrap && !tentangWrap.contains(e.target as Node | null)) {
			tentangOpen = false;
		}
	}

	function handleWindowKeydown(e: KeyboardEvent): void {
		if (e.key === 'Escape') {
			promoOpen = false;
			tentangOpen = false;
			mobileTentangOpen = false;
		}
	}

	const links = $derived([
		{ id: 'promo' as const, label: t(lang, 'nav.promo'), href: lp(lang, '/') },
		{ id: 'pelatihan' as const, label: t(lang, 'nav.pelatihan'), href: lp(lang, '/pelatihan') },
		{ id: 'peringkat' as const, label: t(lang, 'nav.peringkat'), href: lp(lang, '/peringkat') },
		{ id: 'tentang' as const, label: t(lang, 'nav.tentang'), href: lp(lang, '/tentang') },
		{ id: 'verifikasi' as const, label: t(lang, 'nav.verifikasi'), href: lp(lang, '/verifikasi') }
	]);

	const mobileLinks = $derived([
		{ id: 'promo' as const, label: t(lang, 'nav.promo'), href: lp(lang, '/') },
		{ id: 'pelatihan' as const, label: t(lang, 'nav.pelatihan'), href: lp(lang, '/pelatihan') },
		{ id: 'peringkat' as const, label: t(lang, 'nav.peringkat'), href: lp(lang, '/peringkat') },
		{ id: 'tentang' as const, label: t(lang, 'nav.tentang'), href: lp(lang, '/tentang') },
		{ id: 'verifikasi' as const, label: t(lang, 'nav.verifikasi'), href: lp(lang, '/verifikasi') }
	]);
</script>

<svelte:window onclick={handleWindowClick} onkeydown={handleWindowKeydown} />

<header class="sticky top-0 z-50 border-b border-mist bg-white/95 backdrop-blur">
	<div class="mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
		<a
			href={lp(lang, '/')}
			class="flex shrink-0 items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-royal"
			aria-label={t(lang, 'nav.homeLabel')}
			aria-current={active === 'promo' ? 'page' : undefined}
		>
			<Logo size="md" showText={true} textSize="xl" />
		</a>

		<nav
			aria-label={t(lang, 'nav.main')}
			class="hidden min-w-0 flex-1 items-center justify-center gap-1 font-heading text-[15px] font-semibold lg:flex"
		>
			{#each links as link (link.id)}
				{#if link.id === 'promo'}
					<div class="relative" bind:this={promoWrap}>
						<button
							type="button"
							aria-haspopup="menu"
							aria-expanded={promoOpen}
							aria-controls="promo-menu"
							onclick={() => (promoOpen = !promoOpen)}
							onkeydown={(e) => {
								if (e.key === 'Escape') promoOpen = false;
							}}
							class="relative flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-lg px-4 py-2 transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-royal {active === link.id
								? 'text-royal'
								: 'text-slate-600 hover:text-abyss'}"
						>
							{link.label}
							<i class={`fa-solid fa-chevron-down text-xs transition-transform duration-200 ${promoOpen ? 'rotate-180' : ''}`} aria-hidden="true"></i>
						</button>
						{#if promoOpen}
							<div class="absolute top-full left-1/2 z-50 w-[540px] max-w-[calc(100vw-2rem)] -translate-x-1/2 pt-2.5">
								<div class="flex overflow-hidden rounded-2xl border border-mist bg-white shadow-[0_16px_32px_rgba(0,0,0,0.08)]">
									<div class="relative flex w-[42%] flex-col items-center justify-center overflow-hidden p-6 text-center text-white">
										<img src={dropdownBg} alt="" aria-hidden="true" class="absolute inset-0 h-full w-full object-cover" loading="lazy" />
										<div class="absolute inset-0 bg-abyss/65" aria-hidden="true"></div>
										<div class="relative">
											<p class="mb-2 text-xs font-semibold tracking-wide text-teal">{t(lang, 'nav.promoSpecial')}</p>
											<p class="font-heading text-xl leading-snug font-extrabold">{t(lang, 'nav.promoSaveMore')}</p>
											<p class="mt-2 text-xs leading-relaxed text-slate-200">{t(lang, 'nav.promoBestDesc')}</p>
										</div>
									</div>
									<ul id="promo-menu" role="menu" aria-label={t(lang, 'nav.promoMenu')} class="flex w-[58%] flex-col gap-0.5 p-3">
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
															<span class="rounded-full bg-royal px-2 py-0.5 text-xs font-bold tracking-wider text-white uppercase">{item.badge}</span>
														{/if}
													</span>
													{#if item.desc}
														<span class="mt-0.5 block text-xs text-slate-400">{item.desc}</span>
													{/if}
												</a>
											</li>
										{/each}
										{#if promoMenuItems.length === 0}
											<li class="px-4 py-3 text-sm text-slate-500">{t(lang, 'nav.noPromo')}</li>
										{/if}
									</ul>
								</div>
							</div>
						{/if}
					</div>
				{:else if link.id === 'tentang'}
					<div class="relative" bind:this={tentangWrap}>
						<button
							type="button"
							aria-haspopup="menu"
							aria-expanded={tentangOpen}
							aria-controls="tentang-menu"
							onclick={() => (tentangOpen = !tentangOpen)}
							onkeydown={(e) => {
								if (e.key === 'Escape') tentangOpen = false;
							}}
							class="relative flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-lg px-4 py-2 transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-royal {active === link.id
								? 'text-royal'
								: 'text-slate-600 hover:text-abyss'}"
						>
							{link.label}
							<i class={`fa-solid fa-chevron-down text-xs transition-transform duration-200 ${tentangOpen ? 'rotate-180' : ''}`} aria-hidden="true"></i>
						</button>
						{#if tentangOpen}
							<div class="absolute top-full left-1/2 z-50 w-[540px] max-w-[calc(100vw-2rem)] -translate-x-1/2 pt-2.5">
								<div class="flex overflow-hidden rounded-2xl border border-mist bg-white shadow-[0_16px_32px_rgba(0,0,0,0.08)]">
									<div class="relative flex w-[42%] flex-col items-center justify-center overflow-hidden p-6 text-center text-white">
										<img src={dropdownBg} alt="" aria-hidden="true" class="absolute inset-0 h-full w-full object-cover" loading="lazy" />
										<div class="absolute inset-0 bg-abyss/65" aria-hidden="true"></div>
										<div class="relative">
											<p class="mb-2 text-xs font-semibold tracking-wide text-teal">{t(lang, 'nav.aboutIntro')}</p>
											<p class="font-heading text-xl leading-snug font-extrabold">{t(lang, 'nav.aboutLab')}</p>
											<p class="mt-2 text-xs leading-relaxed text-slate-200">{t(lang, 'nav.aboutDesc')}</p>
										</div>
									</div>
									<ul id="tentang-menu" role="menu" aria-label={t(lang, 'nav.aboutMenu')} class="flex w-[58%] flex-col gap-0.5 p-3">
										{#each tentangMenuItems as item (item.id)}
											<li>
												<a
													href={item.href}
													onclick={closeTentang}
													class="block rounded-lg px-3 py-2 transition-colors duration-200 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-royal"
												>
													<span class="flex items-center gap-2">
														<span class="text-sm font-bold text-abyss">{item.title}</span>
													</span>
													{#if item.desc}
														<span class="mt-0.5 block text-xs text-slate-400">{item.desc}</span>
													{/if}
												</a>
											</li>
										{/each}
									</ul>
								</div>
							</div>
						{/if}
					</div>
				{:else}
					<a
						href={link.href}
						aria-current={active === link.id ? 'page' : undefined}
						class="relative inline-flex min-h-[44px] items-center rounded-lg px-4 py-2 transition-colors duration-200 {active === link.id
							? 'text-royal'
							: 'text-slate-600 hover:text-abyss'}"
					>
						{link.label}
					</a>
				{/if}
			{/each}
		</nav>

		<div class="hidden shrink-0 items-center gap-3 sm:flex">
			<LanguageSwitcher {lang} />
			<a
				href={lp(lang, '/login')}
				class="group inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-mist bg-white px-5 font-heading text-sm font-bold text-abyss shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-royal/60 hover:text-royal hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal"
			>
				<i class="fa-solid fa-arrow-right-to-bracket text-xs opacity-60 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true"></i>
				{t(lang, 'nav.signin')}
			</a>
			<a
				href={lp(lang, '/register')}
				class="group inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-royal to-teal px-5 font-heading text-sm font-bold text-white shadow-md shadow-royal/25 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-royal/35 hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal"
			>
				{t(lang, 'nav.signup')}
				<i class="fa-solid fa-arrow-right text-xs transition-transform duration-200 group-hover:translate-x-1" aria-hidden="true"></i>
			</a>
		</div>

		<button
			type="button"
			onclick={() => (menuOpen = !menuOpen)}
			aria-expanded={menuOpen}
			aria-controls="public-mobile-nav"
			aria-label={menuOpen ? t(lang, 'nav.closeMenu') : t(lang, 'nav.openMenu')}
			class="flex min-h-11 min-w-11 items-center justify-center rounded-[10px] p-2 text-abyss transition-colors duration-200 hover:bg-ice focus-visible:outline-2 focus-visible:outline-royal lg:hidden"
		>
			<i class={`fa-solid ${menuOpen ? 'fa-xmark' : 'fa-bars'} text-lg`} aria-hidden="true"></i>
		</button>
	</div>

	{#if menuOpen}
		<nav
			id="public-mobile-nav"
			aria-label={t(lang, 'nav.mobileNav')}
			class="border-t border-mist bg-white px-4 pt-2 pb-5 sm:px-6 lg:hidden"
		>
			<ul class="divide-y divide-mist font-heading text-[15px] font-semibold">
				{#each mobileLinks as link (link.id)}
					<li>
						{#if link.id === 'promo'}
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
													<span class="shrink-0 rounded-md bg-abyss px-2 py-0.5 font-heading text-xs font-bold text-white">{item.badge}</span>
												{/if}
											</a>
										</li>
									{/each}
								{#if promoMenuItems.length === 0}
										<li class="px-2 py-2.5 text-sm font-normal text-slate-500">{t(lang, 'nav.noPromo')}</li>
									{/if}
								</ul>
							{/if}
						{:else if link.id === 'tentang'}
							<button
								type="button"
								aria-expanded={mobileTentangOpen}
								onclick={() => (mobileTentangOpen = !mobileTentangOpen)}
								class="flex w-full items-center justify-between rounded-lg px-2 py-3 transition-colors duration-200 hover:bg-ice focus-visible:outline-2 focus-visible:outline-royal {active === 'tentang' ? 'text-royal' : 'text-slate-700'}"
							>
								{link.label}
								<i class={`fa-solid fa-chevron-down text-xs transition-transform duration-200 ${mobileTentangOpen ? 'rotate-180' : ''}`} aria-hidden="true"></i>
							</button>
							{#if mobileTentangOpen}
								<ul class="mb-2 ml-2 space-y-0.5 border-l-2 border-mist pl-3">
								{#each tentangMenuItems as item (item.id)}
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
											</a>
										</li>
									{/each}
								</ul>
							{/if}
						{:else}
							{@const isActive = active === link.id}
							<a
								href={link.href}
								onclick={() => (menuOpen = false)}
								aria-current={isActive ? 'page' : undefined}
								class="block rounded-lg px-2 py-3 transition-colors duration-200 hover:bg-ice focus-visible:outline-2 focus-visible:outline-royal {isActive ? 'text-royal' : 'text-slate-700'}"
							>
								{link.label}
							</a>
						{/if}
					</li>
				{/each}
			</ul>
			<div class="mt-3 grid grid-cols-2 gap-2.5 sm:hidden">
				<a
					href={lp(lang, '/login')}
					class="group inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-mist px-4 font-heading text-sm font-bold text-abyss transition-all duration-200 hover:border-royal/60 hover:text-royal"
				>
					<i class="fa-solid fa-arrow-right-to-bracket text-xs opacity-60" aria-hidden="true"></i>
					{t(lang, 'nav.signin')}
				</a>
				<a
					href={lp(lang, '/register')}
					class="group inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-royal to-teal px-4 font-heading text-sm font-bold text-white shadow-md shadow-royal/25 transition-all duration-200 hover:brightness-110"
				>
					{t(lang, 'nav.signup')}
					<i class="fa-solid fa-arrow-right text-xs transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true"></i>
				</a>
			</div>
			<div class="mt-3 flex justify-center sm:justify-start">
				<LanguageSwitcher {lang} />
			</div>
		</nav>
	{/if}
</header>
