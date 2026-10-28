<script lang="ts">
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import '../../app.css';
	import Logo from '$lib/components/Logo.svelte';
	import Sidebar, { type NavItem } from '$lib/components/Sidebar.svelte';
	import { getCurrentUser, homeFor, logout, verifySession } from '$lib/stores/auth.svelte';
	import { clearInstructorCourseCaches } from '$lib/stores/instructor-courses.svelte';
	import { fetchAdminOverview } from '$lib/api/admin';
	import { untrack } from 'svelte';

	let { children } = $props();

	// Guard portal admin: sesi diverifikasi ke server (/me), peran dari server.
	// `started` + `untrack`: verifySession membaca $state (via loadSession);
	// tanpa ini $effect berlangganan ulang dan memicu loop /me tanpa henti.
	let phase = $state<'checking' | 'ready' | 'down'>('checking');
	let started = false;

	$effect(() => {
		if (!browser || started) return;
		started = true;
		untrack(() => void runVerify());
	});

	async function runVerify(): Promise<void> {
		phase = 'checking';
		const res = await verifySession();
		if (res.ok) {
			if (res.session.role !== 'admin') {
				goto(homeFor(res.session.role));
				return;
			}
			void loadBadges();
			phase = 'ready';
			return;
		}
		if (res.reason === 'backend-down') {
			phase = 'down';
			return;
		}
		goto('/login');
	}

	function handleLogout() {
		clearInstructorCourseCaches();
		logout();
	}

	let sidebarOpen = $state(false);
	let isCollapsed = $state(false);
	let showProfileMenu = $state(false);

	// Badge sidebar dari backend (GET /admin/overview): total peserta,
	// instruktur, dan kursus. Gagal = badge disembunyikan.
	let studentBadge = $state<string | undefined>(undefined);
	let teacherBadge = $state<string | undefined>(undefined);
	let courseBadge = $state<string | undefined>(undefined);

	const fmtCount = (n: number): string => n.toLocaleString('id-ID');

	async function loadBadges(): Promise<void> {
		try {
			const overview = await fetchAdminOverview();
			studentBadge = fmtCount(overview.totalStudents);
			teacherBadge = fmtCount(overview.totalTeachers);
			courseBadge = fmtCount(overview.totalCourses);
		} catch {
			// Abaikan: navigasi tetap jalan tanpa badge.
		}
	}

	// Profil dari sesi auth (bukan data dummy): nama/email milik akun yang login.
	const session = $derived(getCurrentUser());
	const displayName = $derived(session?.name ?? 'Administrator');
	const displayEmail = $derived(session?.email ?? '');
	const displayInitials = $derived(
		(displayName.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('') || 'AD').toUpperCase()
	);

	const navItems = $derived<NavItem[]>([
		{ label: 'Dasbor', icon: 'fa-house', href: '/admin' },
		{ label: 'Peserta', icon: 'fa-users', href: '/admin/peserta', badge: studentBadge },
		{ label: 'Undangan', icon: 'fa-envelope-open-text', href: '/admin/invitations' },
		{ label: 'Instruktur', icon: 'fa-chalkboard-user', href: '/admin/instrukturs', badge: teacherBadge },
		{ label: 'Kursus', icon: 'fa-layer-group', href: '/admin/courses', badge: courseBadge },
		{ label: 'Voucher', icon: 'fa-ticket', href: '/admin/vouchers' }
	]);

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

{#if phase === 'ready'}
<div class="grid min-h-screen grid-cols-1 bg-slate-50 lg:grid-cols-[auto_1fr]">
	<Sidebar
		{navItems}
		bind:sidebarOpen
		bind:isCollapsed
		onClose={() => (sidebarOpen = false)}
		onLogout={handleLogout}
		brandHref="/admin"
		brandLabel="Aristoteles Platform - Dasbor admin"
		navAriaLabel="Navigasi admin"
		profileName={displayName}
		profileRole="Administrator"
		profileAlt={`Foto profil ${displayName}`}
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
			<span
				class="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-[11px] font-bold text-blue-700"
			>
				<i class="fa-solid fa-shield-halved" aria-hidden="true"></i> ADMIN
			</span>
		</div>

		<header
			class="sticky top-0 z-20 border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur-md sm:px-6 lg:px-8"
		>
			<div class="flex items-center justify-between gap-4">
				<div class="max-w-md flex-1">
					<form role="search" aria-label="Pencarian admin (segera hadir)" onsubmit={(e) => e.preventDefault()}>
						<div class="relative">
							<div
								class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400"
							>
								<i class="fa-solid fa-magnifying-glass text-sm" aria-hidden="true"></i>
							</div>
							<label for="admin-search" class="sr-only">Cari peserta, instruktur atau course</label>
							<input
								id="admin-search"
								type="search"
								placeholder="Pencarian global segera hadir" disabled title="Pencarian global belum tersedia. Gunakan kolom pencarian di halaman Peserta, Instruktur, atau Kursus." aria-describedby="admin-search-note"
								autocomplete="off"
								class="w-full cursor-not-allowed rounded-xl border border-transparent bg-slate-100 py-2.5 pr-4 pl-10 text-sm text-slate-400 placeholder:text-slate-400 focus:outline-none"
							/>
							<p id="admin-search-note" class="sr-only">
							Pencarian global belum berfungsi. Gunakan kolom pencarian di halaman Peserta, Instruktur, atau Kursus.
						</p>
						</div>
					</form>
				</div>

				<div class="flex items-center gap-3">
					<span
						class="hidden items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1.5 text-[11px] font-bold text-blue-700 md:inline-flex"
					>
						<i class="fa-solid fa-shield-halved" aria-hidden="true"></i> PANEL ADMIN
					</span>

					<div class="relative">
						<button
							type="button"
							class="flex items-center gap-2.5 rounded-xl p-1.5 pr-3 transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
							onclick={toggleProfileMenu}
							aria-label={`Menu profil ${displayName}`}
							aria-expanded={showProfileMenu}
							aria-haspopup="menu"
						>
							<span
								class="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-slate-700 to-slate-900 text-sm font-bold text-white shadow-md"
								aria-hidden="true"
							>
								{displayInitials}
							</span>
							<span class="hidden text-left sm:block">
								<span class="block text-sm leading-tight font-semibold text-slate-800">{displayName}</span>
								<span class="block text-xs leading-tight text-slate-500">Administrator</span>
							</span>
							<i class="fa-solid fa-chevron-down hidden text-xs text-slate-400 sm:block" aria-hidden="true"></i>
						</button>

						{#if showProfileMenu}
							<div
								role="menu"
								aria-label="Menu admin"
								class="absolute top-full right-0 z-50 mt-2 w-56 overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-xl"
							>
								<div class="border-b border-slate-100 px-4 py-3">
									<div class="text-sm font-semibold text-slate-800">{displayName}</div>
									<div class="text-xs text-slate-500">{displayEmail}</div>
								</div>
								<div class="p-1.5" role="none">
									<a
										role="menuitem"
										href="/admin/peserta"
										class="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-blue-600"
										onclick={closeProfileMenu}
									>
										<i class="fa-solid fa-users w-4 text-center text-slate-400" aria-hidden="true"></i>
										Kelola Peserta
									</a>
									<a
										role="menuitem"
										href="/admin/courses"
										class="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-blue-600"
										onclick={closeProfileMenu}
									>
										<i class="fa-solid fa-layer-group w-4 text-center text-slate-400" aria-hidden="true"></i>
										Kelola Kursus
									</a>
								</div>
								<div class="border-t border-slate-100 p-1.5">
									<a
										role="menuitem"
										href="/"
										class="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-red-600 transition-colors hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-red-500"
										onclick={() => {
											handleLogout();
											closeProfileMenu();
										}}
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
{:else}
	<div
		class="flex min-h-screen items-center justify-center bg-slate-50"
		role="status"
		aria-label={phase === 'down' ? 'Backend tidak tersedia' : 'Memeriksa sesi'}
	>
		{#if phase === 'down'}
			<div class="max-w-sm px-6 text-center">
				<p class="flex items-center justify-center gap-2 text-sm font-bold text-slate-700">
					<i class="fa-solid fa-triangle-exclamation text-amber-500" aria-hidden="true"></i>
					Backend tidak tersedia
				</p>
				<p class="mt-1 text-xs text-slate-500">
					Sesi Anda belum diverifikasi ke server. Periksa backend lalu coba lagi — Anda tidak
					dikeluarkan.
				</p>
				<button
					type="button"
					onclick={() => void runVerify()}
					class="mt-3 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
				>
					<i class="fa-solid fa-rotate-right" aria-hidden="true"></i> Coba lagi
				</button>
			</div>
		{:else}
			<p class="flex items-center gap-2 text-sm font-semibold text-slate-500">
				<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i> Memeriksa sesi portal...
			</p>
		{/if}
	</div>
{/if}
