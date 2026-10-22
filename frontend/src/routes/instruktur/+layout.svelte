<script lang="ts">
	import '../../app.css';
	import Logo from '$lib/components/Logo.svelte';
	import Sidebar, { type NavItem } from '$lib/components/Sidebar.svelte';

	let { children } = $props();

	let sidebarOpen = $state(false);
	let isCollapsed = $state(false);
	let searchQuery = $state('');
	let showProfileMenu = $state(false);

	// Shell sama persis dengan portal user, hanya menu + identitas yang berbeda.
	const navItems: NavItem[] = [
		{ label: 'Dashboard', icon: 'fa-house', href: '/instruktur' },
		{ label: 'Kursusku', icon: 'fa-book-open', href: '/instruktur/kursusku', badge: '4' },
		{ label: 'Penilaian', icon: 'fa-clipboard-check', href: '/instruktur/penilaian', badge: '12' },
		{ label: 'Pendapatan', icon: 'fa-wallet', href: '/instruktur/pendapatan' },
		{ label: 'Sertifikat', icon: 'fa-award', href: '/instruktur/sertifikat', badge: '8' }
	];

	function toggleProfileMenu() {
		showProfileMenu = !showProfileMenu;
	}

	function closeProfileMenu() {
		showProfileMenu = false;
	}

	function handleWindowKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') closeProfileMenu();
	}
</script>

<svelte:window onkeydown={handleWindowKeydown} />

<a
	href="#main-content"
	class="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[60] focus:rounded-lg focus:bg-blue-600 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
>
	Lewati ke konten utama
</a>

<div class="grid min-h-screen grid-cols-1 bg-slate-50 lg:grid-cols-[auto_1fr]">
	<Sidebar
		{navItems}
		bind:sidebarOpen
		bind:isCollapsed
		onClose={() => (sidebarOpen = false)}
		brandHref="/instruktur"
		brandLabel="Aristotle Platform - Dashboard instruktur"
		navAriaLabel="Navigasi instruktur"
		profileName="KEVIN PERRY"
		profileRole="Instruktur"
		profileAlt="Foto profil Kevin Perry"
	/>

	<div class="flex min-h-0 min-w-0 flex-1 flex-col">
		<div
			class="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 lg:hidden"
		>
			<button
				type="button"
				class="flex min-h-11 min-w-11 items-center justify-center rounded-lg p-2 text-slate-600 transition-colors hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
				onclick={() => (sidebarOpen = !sidebarOpen)}
				aria-label={sidebarOpen ? 'Tutup sidebar' : 'Buka sidebar'}
				aria-expanded={sidebarOpen}
				aria-controls="sidebar"
			>
				<i class="fa-solid {sidebarOpen ? 'fa-xmark' : 'fa-bars'} text-lg" aria-hidden="true"></i>
			</button>
			<Logo size="sm" showText={true} textSize="md" />
			<button
				type="button"
				class="relative flex min-h-11 min-w-11 items-center justify-center rounded-lg p-2 text-slate-400 transition-colors hover:text-slate-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
				aria-label="Notifikasi, 12 penilaian menunggu"
			>
				<i class="fa-solid fa-bell text-lg" aria-hidden="true"></i>
				<span class="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500" aria-hidden="true"
				></span>
			</button>
		</div>

		<header
			class="sticky top-0 z-20 border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur-md sm:px-6 lg:px-8"
		>
			<div class="flex items-center justify-between gap-4">
				<div class="max-w-md flex-1">
					<form role="search" aria-label="Pencarian instruktur" onsubmit={(e) => e.preventDefault()}>
						<div class="relative">
							<div
								class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400"
							>
								<i class="fa-solid fa-magnifying-glass text-sm" aria-hidden="true"></i>
							</div>
							<label for="instruktur-search" class="sr-only">Cari kursus, peserta, atau penilaian</label>
							<input
								id="instruktur-search"
								type="search"
								placeholder="Cari kursus, peserta, penilaian..."
								bind:value={searchQuery}
								autocomplete="off"
								class="w-full rounded-xl border border-transparent bg-slate-100 py-2.5 pr-4 pl-10 text-sm text-slate-800 transition-all placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
							/>
							{#if searchQuery}
								<button
									type="button"
									class="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 transition-colors hover:text-slate-600"
									onclick={() => (searchQuery = '')}
									aria-label="Hapus pencarian"
								>
									<i class="fa-solid fa-xmark text-sm" aria-hidden="true"></i>
								</button>
							{/if}
						</div>
					</form>
				</div>

				<div class="flex items-center gap-3">
					<button
						type="button"
						class="relative hidden min-h-11 min-w-11 items-center justify-center rounded-xl p-2.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:flex"
						aria-label="Notifikasi, 12 penilaian menunggu"
					>
						<i class="fa-solid fa-bell text-lg" aria-hidden="true"></i>
						<span
							class="absolute top-2 right-2 h-2 w-2 rounded-full border-2 border-white bg-red-500"
							aria-hidden="true"
						></span>
					</button>

					<div class="relative">
						<button
							type="button"
							class="flex items-center gap-2.5 rounded-xl p-1.5 pr-3 transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
							onclick={toggleProfileMenu}
							aria-label="Menu profil Kevin Perry"
							aria-expanded={showProfileMenu}
							aria-haspopup="menu"
						>
							<span
								class="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-sm font-bold text-white shadow-md"
								aria-hidden="true"
							>
								KP
							</span>
							<span class="hidden text-left sm:block">
								<span class="block text-sm leading-tight font-semibold text-slate-800"
									>Kevin Perry</span
								>
								<span class="block text-xs leading-tight text-slate-500">Instruktur</span>
							</span>
							<i class="fa-solid fa-chevron-down hidden text-xs text-slate-400 sm:block" aria-hidden="true"></i>
						</button>

						{#if showProfileMenu}
							<div
								role="menu"
								aria-label="Menu profil instruktur"
								class="absolute top-full right-0 z-50 mt-2 w-56 overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-xl"
							>
								<div class="border-b border-slate-100 px-4 py-3">
									<div class="text-sm font-semibold text-slate-800">Kevin Perry</div>
									<div class="text-xs text-slate-500">kevin@aristotle.ac.id</div>
								</div>
								<div class="p-1.5" role="none">
									<a
										role="menuitem"
										href="/instruktur/kursusku"
										class="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-blue-600"
										onclick={closeProfileMenu}
									>
										<i class="fa-solid fa-book-open w-4 text-center text-slate-400" aria-hidden="true"></i>
										Kursusku
									</a>
									<a
										role="menuitem"
										href="/instruktur/penilaian"
										class="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-blue-600"
										onclick={closeProfileMenu}
									>
										<i class="fa-solid fa-clipboard-check w-4 text-center text-slate-400" aria-hidden="true"></i>
										Penilaian
									</a>
								</div>
								<div class="border-t border-slate-100 p-1.5">
									<a
										role="menuitem"
										href="/"
										class="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-red-600 transition-colors hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-red-500"
										onclick={closeProfileMenu}
									>
										<i class="fa-solid fa-right-from-bracket w-4 text-center" aria-hidden="true"></i>
										Keluar
									</a>
								</div>
							</div>
						{/if}
					</div>
				</div>
			</div>
		</header>

		<main id="main-content" tabindex="-1" class="min-h-0 flex-1 focus:outline-none">
			{@render children()}
		</main>
	</div>
</div>
