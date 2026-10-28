<script lang="ts">
	import { page } from '$app/state';
	import { aristotelesLogo as logoUrl } from '$lib/assets/logo';

	export interface NavItem {
		label: string;
		icon: string;
		href: string;
		badge?: string;
	}

	let {
		navItems = [],
		isCollapsed = $bindable(false),
		sidebarOpen = $bindable(false),
		onClose,
		onLogout,
		brandHref = '/user',
		brandLabel = 'Aristoteles Platform - Dashboard pengguna',
		navAriaLabel = 'Navigasi pengguna',
		profileName = 'AHMAD FARIZI',
		profileRole = 'Mahasiswa',
		profileAlt = 'Foto profil Ahmad Farizi'
	}: {
		navItems?: NavItem[];
		isCollapsed?: boolean;
		sidebarOpen?: boolean;
		onClose?: () => void;
		onLogout?: () => void;
		brandHref?: string;
		brandLabel?: string;
		navAriaLabel?: string;
		profileName?: string;
		profileRole?: string;
		profileAlt?: string;
	} = $props();

	const currentPath = $derived(page.url.pathname);

	// Inisial lokal untuk avatar sidebar — tanpa request jaringan.
	// Sebelumnya memakai placehold.co eksternal (DNS+TLS+transfer pihak ketiga
	// di jalur kritis dashboard statis). Pola sama seperti tombol profil header.
	const profileInitials = $derived(
		(profileName.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('') || 'PG').toUpperCase()
	);

	function isActive(href: string): boolean {
		if (href === '/user' || href === '/admin' || href === '/instruktur')
			return currentPath === href || currentPath === href + '/';
		return currentPath === href || currentPath.startsWith(href + '/');
	}

	function toggleSidebar() {
		if (typeof window === 'undefined') return;
		if (window.matchMedia('(min-width: 1024px)').matches) {
			isCollapsed = !isCollapsed;
		} else {
			sidebarOpen = !sidebarOpen;
		}
	}

	function closeMobileSidebar() {
		sidebarOpen = false;
		onClose?.();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && sidebarOpen) closeMobileSidebar();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- Mobile overlay -->
{#if sidebarOpen}
	<button
		type="button"
		aria-label="Tutup menu sidebar"
		onclick={closeMobileSidebar}
		class="fixed inset-0 z-40 cursor-pointer bg-slate-900/60 backdrop-blur-[2px] lg:hidden"
	></button>
{/if}

<aside
	id="sidebar"
	class={`
		lg:sticky lg:top-0 lg:h-screen lg:translate-x-0
		fixed inset-y-0 left-0 z-50
		flex flex-col justify-between
		border-r border-slate-200 bg-white
		px-4 py-5 shadow-2xl lg:shadow-none
		transition-[width,transform] duration-300 ease-in-out
		motion-reduce:transition-none
		${isCollapsed ? 'lg:w-20' : 'lg:w-72'}
		w-72
		${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
	`}
	aria-label={navAriaLabel}
>
	<div class="flex min-h-0 flex-1 flex-col space-y-6">
		<!-- Brand and sidebar toggle -->
		<div class="flex items-center justify-between px-2">
			<a
				href={brandHref}
				class="flex min-w-0 items-center gap-3 overflow-hidden rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
				aria-label={brandLabel}
			>
				<img
					src={logoUrl}
					alt="Logo Aristoteles"
					class="h-11 w-11 shrink-0 rounded-xl border border-blue-200 object-cover shadow-md"
				/>
				{#if !isCollapsed}
					<span class="sidebar-text flex min-w-0 flex-col">
						<span class="flex items-center gap-1">
							<span class="text-xl font-bold tracking-tight text-slate-900">Aristoteles</span>
							<span class="h-2 w-2 rounded-full bg-blue-500" aria-hidden="true"></span>
						</span>
						<span class="whitespace-nowrap text-[10px] font-semibold tracking-widest text-blue-600"
							>MICRO-CREDENTIALS</span
						>
					</span>
				{/if}
			</a>

			<button
				type="button"
				onclick={toggleSidebar}
				aria-label={isCollapsed ? 'Perluas sidebar' : 'Ciutkan sidebar'}
				aria-expanded={!isCollapsed}
				aria-controls="sidebar"
				class="flex min-h-11 min-w-11 items-center justify-center rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
			>
				<i
					class={`fa-solid ${isCollapsed ? 'fa-angles-right' : 'fa-angles-left'} text-lg`}
					aria-hidden="true"
				></i>
			</button>
		</div>

		<!-- User profile -->
		<div
			class={`relative flex items-center gap-3 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-3.5 ${isCollapsed ? 'lg:justify-center lg:px-1' : ''}`}
		>
			<div
				class="pointer-events-none absolute -right-6 -bottom-6 h-16 w-16 rounded-full bg-blue-500/10 blur-xl"
				aria-hidden="true"
			></div>
			<div class="relative shrink-0">
				<span
					class="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-sm font-bold text-white shadow-md"
					aria-hidden="true"
				>
					{profileInitials}
				</span>
				<span
					class="absolute right-0 bottom-0 h-3 w-3 rounded-full border-2 border-slate-50 bg-emerald-500"
					aria-hidden="true"
				></span>
			</div>
			{#if !isCollapsed}
				<div class="sidebar-text flex min-w-0 flex-col">
					<span class="truncate text-sm font-semibold text-slate-900">{profileName}</span>
					<span class="truncate text-xs text-slate-500">{profileRole}</span>
				</div>
			{/if}
		</div>

		<!-- Main navigation -->
		<nav class="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto" aria-label={navAriaLabel}>
			{#if !isCollapsed}
				<span
					class="sidebar-text mb-1 px-3 text-[11px] font-bold tracking-wider text-slate-400 uppercase"
					>Menu Utama</span
				>
			{/if}

			{#each navItems as item (item.href)}
				{@const active = isActive(item.href)}
				<a
					href={item.href}
					title={isCollapsed ? item.label : undefined}
					aria-label={isCollapsed ? item.label : undefined}
					aria-current={active ? 'page' : undefined}
					onclick={closeMobileSidebar}
					class={`group flex min-h-11 items-center gap-3 rounded-xl px-3.5 py-3 transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
						isCollapsed ? 'lg:justify-center lg:px-2' : ''
					} ${
						active
							? 'bg-blue-600 font-semibold text-white shadow-lg shadow-blue-600/25 hover:bg-blue-700'
							: 'font-medium text-slate-600 hover:bg-blue-50 hover:text-blue-700'
					}`}
				>
					<span class="flex w-6 shrink-0 justify-center">
						<i
							class={`fa-solid ${item.icon} text-base transition-transform group-hover:scale-110 ${active ? 'text-white' : 'text-slate-400 group-hover:text-blue-600'}`}
							aria-hidden="true"
						></i>
					</span>
					{#if !isCollapsed}
						<span class="sidebar-text flex-1 truncate text-sm">{item.label}</span>
						{#if item.badge}
							<span
								class={`inline-flex min-w-6 items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-bold ${
									active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
								}`}
								aria-label={`${item.badge} baru`}
							>
								{item.badge}
							</span>
						{/if}
						{#if active}
							<i class="fa-solid fa-chevron-right text-[10px] opacity-70" aria-hidden="true"></i>
						{/if}
					{/if}
				</a>
			{/each}
		</nav>
	</div>

	<!-- Sidebar footer -->
	<div
		class={`mt-4 flex flex-col gap-2 border-t border-slate-200 pt-4 ${isCollapsed ? 'lg:items-center' : ''}`}
	>
		{#if !isCollapsed}
			<a
				href="/"
				onclick={() => onLogout?.()}
				class="flex min-h-11 items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
			>
				<span class="flex w-6 justify-center"
					><i class="fa-solid fa-right-from-bracket text-base" aria-hidden="true"></i></span
				>
				<span class="sidebar-text">Keluar</span>
			</a>
			<div class="flex items-center justify-between px-2 pt-1">
				<span
					class="sidebar-text text-[10px] font-medium tracking-widest whitespace-nowrap text-slate-400 uppercase"
					>ARISTOTELES · PLATFORM</span
				>
				<i class="fa-solid fa-shield-halved text-xs text-slate-300" aria-hidden="true"></i>
			</div>
		{:else}
			<a
				href="/"
				onclick={() => onLogout?.()}
				title="Keluar"
				aria-label="Keluar"
				class="flex min-h-11 min-w-11 items-center justify-center rounded-xl p-2 text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
			>
				<i class="fa-solid fa-right-from-bracket text-base" aria-hidden="true"></i>
			</a>
		{/if}
	</div>
</aside>
