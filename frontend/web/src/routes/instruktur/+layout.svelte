<script lang="ts">
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Logo from '$lib/components/Logo.svelte';
	import Sidebar, { type NavItem } from '$lib/components/Sidebar.svelte';
	import { getCurrentUser, homeFor, logout, verifySession } from '$lib/stores/auth.svelte';
	import { clearInstructorCourseCaches } from '$lib/stores/instructor-courses.svelte';
	import { fetchInstructorDashboard } from '$lib/api/dashboard';
	import { cachedGet } from '$lib/api/cache';
	import { useBadgePolling } from '$lib/stores/badge-poll.svelte';
	import { fetchCertificateSummary } from '$lib/api/certificates';
	import { fetchMyPromoProposals } from '$lib/api/promos';
	import { fileUrl } from '$lib/api/courses';
	import { untrack } from 'svelte';

	let { children } = $props();

	// Guard portal teacher: sesi diverifikasi ke server (/me), peran dari server.
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
			if (res.session.role !== 'teacher') {
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
	let showNotifMenu = $state(false);

	// Badge sidebar dari backend + antrean bell (hilang otomatis saat dikerjakan):
	// - penilaian menunggu dinilai (turun saat tugas dinilai)
	// - keputusan promo yang belum dibaca (hilang saat halaman Promo dibuka)
	// Gagal = badge hilang.
	let courseBadge = $state<string | undefined>(undefined);
	let reviewBadge = $state<string | undefined>(undefined);
	let certBadge = $state<string | undefined>(undefined);
	let promoBadge = $state<string | undefined>(undefined);
	let pendingReviews = $state(0);
	let promoUnread = $state(0);

	const notifCount = $derived(pendingReviews + promoUnread);
	const notifLabel = $derived(
		notifCount > 0 ? `${notifCount} hal perlu perhatian — buka Notifikasi` : 'Notifikasi'
	);

	async function loadBadges(): Promise<void> {
		// Badge bell boleh basi ≤45 dtk; keputusan promo/nilai memicu refresh eksplisit.
		const BELL_MS = 45_000;
		try {
			const [dashboard, summary, myProposals] = await Promise.all([
				cachedGet('bell:ins:dash', BELL_MS, () => fetchInstructorDashboard()),
				cachedGet('bell:ins:certs', BELL_MS, () => fetchCertificateSummary()),
				cachedGet('bell:ins:promos', BELL_MS, () => fetchMyPromoProposals().catch((): [] => []))
			]);
			courseBadge = String(dashboard.totals.activeCourses);
			reviewBadge = String(dashboard.totals.pendingReviews);
			pendingReviews = dashboard.totals.pendingReviews;
			certBadge = String(summary.issuedActiveCount);
			promoUnread = myProposals.filter((p) => p.status !== 'pending' && !p.seenAt).length;
			promoBadge = promoUnread > 0 ? String(promoUnread) : undefined;
		} catch {
			// Abaikan: navigasi tetap jalan tanpa badge.
		}
	}

	// Bell instruktur ikut segar seperti portal lain (visibility/fokus/event/60 dtk).
	useBadgePolling({
		load: () => void loadBadges(),
		isReady: () => phase === 'ready',
		eventName: 'instruktur:notif-refresh'
	});

	// Shell sama persis dengan portal user, hanya menu + identitas yang berbeda.
	const navItems = $derived<NavItem[]>([
		{
			label: 'Mengajar',
			icon: 'fa-person-chalkboard',
			href: '/instruktur',
			children: [
				{ label: 'Dashboard', icon: 'fa-house', href: '/instruktur' },
				{ label: 'Kursusku', icon: 'fa-book-open', href: '/instruktur/kursusku', badge: courseBadge },
				{ label: 'Ajukan Promo', icon: 'fa-tags', href: '/instruktur/promo', badge: promoBadge },
				{ label: 'Penilaian', icon: 'fa-clipboard-check', href: '/instruktur/penilaian', badge: reviewBadge }
			]
		},
		{
			label: 'Hasil',
			icon: 'fa-chart-line',
			href: '/instruktur/pendapatan',
			children: [
				{ label: 'Pendapatan', icon: 'fa-wallet', href: '/instruktur/pendapatan' },
				{ label: 'Sertifikat', icon: 'fa-award', href: '/instruktur/sertifikat', badge: certBadge }
			]
		},
		{
			label: 'Akun',
			icon: 'fa-circle-user',
			href: '/instruktur/profile',
			children: [{ label: 'Profil', icon: 'fa-user', href: '/instruktur/profile' }]
		}
	]);

	function toggleProfileMenu() {
		showProfileMenu = !showProfileMenu;
		if (showProfileMenu) showNotifMenu = false;
	}

	function closeProfileMenu() {
		showProfileMenu = false;
	}

	function toggleNotifMenu() {
		showNotifMenu = !showNotifMenu;
		if (showNotifMenu) showProfileMenu = false;
	}

	function closeNotifMenu() {
		showNotifMenu = false;
	}

	function handleWindowKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			closeProfileMenu();
			closeNotifMenu();
		}
	}

	// Profil dari sesi auth (bukan data dummy): nama/email milik akun yang login.
	const session = $derived(getCurrentUser());
	const displayName = $derived(session?.name ?? 'Instruktur');
	const displayEmail = $derived(session?.email ?? '');
	const displayInitials = $derived(
		(displayName.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('') || 'IN').toUpperCase()
	);
	// Foto dari sesi (relatif server) → absolut backend; null = inisial.
	const avatarSrc = $derived(session?.avatarUrl ? fileUrl(session.avatarUrl) : null);
</script>

<svelte:head>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

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
		brandHref="/instruktur"
		brandLabel="Aristoteles Platform - Dashboard instruktur"
		navAriaLabel="Navigasi instruktur"
		profileName={displayName}
		profileRole="Instruktur"
		profileAlt={`Foto profil ${displayName}`}
		profileAvatarUrl={avatarSrc}
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
			<a
				href={resolve('/instruktur/penilaian')}
				class="relative flex min-h-11 min-w-11 items-center justify-center rounded-lg p-2 text-slate-400 transition-colors hover:text-slate-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
				aria-label={reviewBadge ? `${reviewBadge} tugas menunggu dinilai — buka Penilaian` : 'Buka Penilaian'}
			>
				<i class="fa-solid fa-bell text-lg" aria-hidden="true"></i>
				{#if reviewBadge && reviewBadge !== '0'}
					<span class="absolute top-0.5 right-0.5 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white" aria-hidden="true"
						>{reviewBadge}</span
					>
				{/if}
			</a>
		</div>

		<header
			class="sticky top-0 z-20 border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur-md sm:px-6 lg:px-8"
		>
			<div class="flex items-center justify-end gap-4">
				<div class="flex items-center gap-3">
					<!-- Notifikasi -->
					<div class="relative hidden sm:block">
						<button
							type="button"
							class="relative flex min-h-11 min-w-11 items-center justify-center rounded-xl p-2.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
							onclick={toggleNotifMenu}
							aria-label={notifLabel}
							aria-expanded={showNotifMenu}
							aria-haspopup="menu"
						>
							<i class="fa-solid fa-bell text-lg" aria-hidden="true"></i>
							{#if notifCount > 0}
								<span class="absolute top-1 right-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-red-500 px-1 text-[10px] font-bold text-white" aria-hidden="true">{notifCount > 9 ? '9+' : notifCount}</span>
							{/if}
						</button>

						{#if showNotifMenu}
							<div
								role="menu"
								aria-label="Notifikasi"
								class="absolute top-full right-0 z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-xl"
							>
								<div class="flex items-center justify-between border-b border-slate-100 px-4 py-3">
									<div>
										<div class="text-sm font-semibold text-slate-800">Notifikasi</div>
										<div class="text-xs text-slate-500">Perlu perhatian Anda</div>
									</div>
									<button
										type="button"
										class="flex min-h-9 min-w-9 items-center justify-center rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-2 focus-visible:outline-blue-600"
										onclick={() => void loadBadges()}
										aria-label="Muat ulang notifikasi"
										title="Muat ulang"
									>
										<i class="fa-solid fa-rotate-right text-xs" aria-hidden="true"></i>
									</button>
								</div>
								<div class="p-1.5" role="none">
									{#if pendingReviews > 0}
										<a
											role="menuitem"
											href={resolve('/instruktur/penilaian')}
											class="flex items-start gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-blue-600"
											onclick={closeNotifMenu}
										>
											<i class="fa-solid fa-clipboard-check mt-0.5 w-4 text-center text-amber-500" aria-hidden="true"></i>
											<span>
												<span class="block font-semibold text-slate-800">{pendingReviews} tugas menunggu dinilai</span>
												<span class="block text-xs text-slate-500">Nilai di halaman Penilaian — hilang setelah dinilai.</span>
											</span>
										</a>
									{/if}
									{#if promoUnread > 0}
										<a
											role="menuitem"
											href={resolve('/instruktur/promo')}
											class="flex items-start gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-blue-600"
											onclick={closeNotifMenu}
										>
											<i class="fa-solid fa-tags mt-0.5 w-4 text-center text-violet-500" aria-hidden="true"></i>
											<span>
												<span class="block font-semibold text-slate-800">{promoUnread} keputusan promo baru</span>
												<span class="block text-xs text-slate-500">Lihat di halaman Promo — hilang setelah dibuka.</span>
											</span>
										</a>
									{/if}
									{#if notifCount === 0}
										<p class="px-3 py-4 text-center text-xs text-slate-500">Semua beres, tidak ada yang perlu perhatian.</p>
									{/if}
								</div>
							</div>
						{/if}
					</div>

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
								class="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-sm font-bold text-white shadow-md"
								aria-hidden="true"
							>
								{#if avatarSrc}
									<img src={avatarSrc} alt="" class="h-full w-full object-cover" />
								{:else}
									{displayInitials}
								{/if}
							</span>
							<span class="hidden text-left sm:block">
								<span class="block text-sm leading-tight font-semibold text-slate-800"
									>{displayName}</span
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
									<div class="text-sm font-semibold text-slate-800">{displayName}</div>
									<div class="text-xs text-slate-500">{displayEmail}</div>
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
