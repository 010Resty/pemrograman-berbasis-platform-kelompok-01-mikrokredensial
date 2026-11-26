<script lang="ts">
	import { goto, preloadCode } from '$app/navigation';
	import { page } from '$app/state';
	import { lp, type Locale } from '$lib/i18n/locale';
	import { t } from '$lib/i18n/index';
	import Logo from '$lib/components/Logo.svelte';
	import { uniraLogo } from '$lib/assets/logo';
	import { toast } from '$lib/stores/toast.svelte';
	import {
		PORTALS,
		getAccessToken,
		homeFor,
		loadSession,
		loginWithBackend,
		logout,
		roleLabelFor,
		verifySession,
		type Role
	} from '$lib/stores/auth.svelte';

	const TABS: Role[] = ['student', 'teacher', 'admin'];
	const TAB_STYLE: Record<Role, { active: string; soft: string; text: string; icon: string }> = {
		student: {
			active: 'bg-blue-600 text-white shadow-lg shadow-blue-600/25',
			soft: 'bg-blue-50 text-blue-700 border-blue-200',
			text: 'text-blue-700',
			icon: 'fa-user-graduate'
		},
		teacher: {
			active: 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/25',
			soft: 'bg-emerald-50 text-emerald-700 border-emerald-200',
			text: 'text-emerald-700',
			icon: 'fa-chalkboard-user'
		},
		admin: {
			active: 'bg-blue-800 text-white shadow-lg shadow-blue-800/25',
			soft: 'bg-slate-100 text-slate-700 border-slate-200',
			text: 'text-slate-800',
			icon: 'fa-shield-halved'
		}
	};

	let activeTab = $state<Role>('student');
	let showPassword = $state(false);
	// Deploy: mulai kosong, tanpa prefill demo.
	let email = $state('');
	let password = $state('');
	let rememberMe = $state(false);
	let isLoading = $state(false);
	let errorMessage = $state('');

	const account = $derived(PORTALS.find((a) => a.role === activeTab)!);
	const style = $derived(TAB_STYLE[activeTab]);
	const lang: Locale = $derived(page.params.lang === 'en' ? 'en' : 'id');

	/** Deskripsi portal per peran mengikuti bahasa aktif. */
	function portalDescFor(role: Role): string {
		if (role === 'student') return t(lang, 'auth.portalDescStudent');
		if (role === 'teacher') return t(lang, 'auth.portalDescTeacher');
		return t(lang, 'auth.portalDescAdmin');
	}

	/**
	 * Tujuan kembali pasca-login (mis. dari halaman setup patungan).
	 * Dibatasi ke path /patungan/* ber-prefix bahasa agar tidak bisa
	 * dipakai open-redirect.
	 */
	const returnTo = $derived.by(() => {
		const raw = page.url.searchParams.get('returnTo');
		if (!raw || !/^\/(id|en)\/patungan\//.test(raw)) return null;
		if (raw.startsWith('//') || raw.includes('://') || raw.includes('\\')) return null;
		return raw;
	});

	function togglePassword() {
		showPassword = !showPassword;
	}

	function selectTab(role: Role) {
		activeTab = role;
		email = '';
		password = '';
		errorMessage = '';
		warmPortal(role);
	}

	// Hangatkan chunk JS portal tab aktif selagi user mengetik, agar navigasi
	// pasca-login tidak menunggu unduhan chunk. Hanya kode (preloadCode),
	// bukan data: tidak memicu fetch dashboard/verify tambahan.
	let preloadedFor: Role | null = null;
	function warmPortal(role: Role): void {
		if (typeof window === 'undefined' || preloadedFor === role) return;
		preloadedFor = role;
		void preloadCode(homeFor(role)).catch(() => {
			preloadedFor = null;
		});
	}

	// Prefetch saat idle setelah render awal (jangan berebut bandwidth dengan form).
	$effect(() => {
		const role = activeTab;
		if (typeof window === 'undefined') return;
		if (typeof window.requestIdleCallback === 'function') {
			const id = window.requestIdleCallback(() => warmPortal(role));
			return () => window.cancelIdleCallback(id);
		}
		warmPortal(role);
	});

	/** Login nyata via backend. Gagal = tetap di halaman ini dengan pesan error. */
	async function handleSubmit(event: Event) {
		event.preventDefault();
		errorMessage = '';
		if (!email.trim() || !password) {
			errorMessage = t(lang, 'auth.errRequired');
			toast.error(errorMessage);
			return;
		}
		isLoading = true;
		try {
			const result = await loginWithBackend(email, password, rememberMe);
			if (!result.ok) {
				// Email belum diverifikasi: lanjutkan ke halaman verifikasi OTP.
				if (result.needsVerification) {
					await goto(`${lp(lang, '/verify-email')}?email=${encodeURIComponent(result.needsVerification)}`);
					return;
				}
				errorMessage = result.error;
				toast.error(errorMessage);
				isLoading = false;
				return;
			}
			// Sukses: tahan status loading (tombol disabled + spinner) sampai
			// navigasi chunk portal selesai dan halaman ini unmount.
			// Tanpa await, finally langsung mengaktifkan tombol sebelum render portal.
			if (result.user.role !== activeTab) {
				// Portal salah = tidak boleh masuk: cabut sesi yang terlanjur
				// tersimpan loginWithBackend (token + cache + storage), lalu tolak
				// di halaman ini. Tanpa logout, token valid tertinggal dan efek
				// auto-login di bawah akan tetap meloloskan user.
				logout();
				errorMessage = t(lang, 'auth.errWrongPortal', { role: roleLabelFor(result.user.role, lang) });
				toast.error(errorMessage);
				isLoading = false;
				return;
			}
			// Bila datang dengan ?returnTo= yang valid, kembali ke sana.
			await goto(returnTo ?? account.home);
		} catch {
			isLoading = false;
		}
	}

	// Sudah login (terverifikasi server) → langsung ke portal perannya.
	// Tidak memakai loadSession mentah agar sesi palsu tidak lolos:
	// tanpa token valid tidak ada verifikasi, dan peran ikut hasil /me.
	$effect(() => {
		let cancelled = false;
		if (!loadSession() || !getAccessToken()) return;
		(void (async () => {
			const res = await verifySession();
			if (!cancelled && res.ok) goto(returnTo ?? homeFor(res.session.role));
		})());
		return () => {
			cancelled = true;
		};
	});
</script>

<svelte:head>
	<title>{t(lang, 'auth.pageTitle')}</title>
	<meta
		name="description"
		content={t(lang, 'auth.pageDesc')}
	/>
</svelte:head>

<div class="flex h-dvh flex-col overflow-hidden bg-slate-50 lg:flex-row">
	<!-- Left Panel: Branding & Info -->
	<div
		class="relative hidden min-h-0 overflow-hidden bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 lg:flex lg:w-1/2 xl:w-3/5"
	>
		<div class="absolute inset-0 opacity-10" aria-hidden="true">
			<div
				class="absolute inset-0 h-full w-full"
				style="background-image: url('data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.4\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E');"
			></div>
		</div>
		<div
			class="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-cyan-400/20 blur-3xl"
			aria-hidden="true"
		></div>
		<div
			class="absolute -bottom-32 -left-32 h-[500px] w-[500px] rounded-full bg-blue-400/20 blur-3xl"
			aria-hidden="true"
		></div>

		<div class="relative z-10 flex min-h-0 w-full flex-col justify-between p-8 xl:p-10">
			<Logo size="xl" showText={true} textSize="xl" dark={true} />

			<div class="flex min-h-0 flex-col justify-center py-4">
				<h1 class="sr-only">{t(lang, 'auth.srTitle')}</h1>
				<div
					class="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-1.5 text-xs font-semibold text-cyan-300 backdrop-blur-sm"
				>
					<i class="fa-solid fa-shield-halved" aria-hidden="true"></i> {t(lang, 'auth.badge')}
				</div>

				<p class="mb-3 text-3xl leading-tight font-bold text-white xl:text-4xl" aria-hidden="true">
					{t(lang, 'auth.heroA')}<br />
					<span class="text-cyan-400">{t(lang, 'auth.heroB')}</span>
				</p>

				<p class="mb-6 max-w-md text-sm leading-relaxed text-blue-100 xl:text-base">
					{t(lang, 'auth.heroDesc')}
				</p>

				<div class="space-y-2.5">
					{#each PORTALS as portal (portal.role)}
						<button
							type="button"
							onclick={() => selectTab(portal.role)}
							aria-pressed={activeTab === portal.role}
							class={`flex w-full max-w-md items-center gap-3 rounded-2xl border p-3.5 text-left backdrop-blur-sm transition-all focus-visible:outline-2 focus-visible:outline-cyan-300 ${activeTab === portal.role ? 'border-cyan-300/60 bg-white/15' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}
						>
							<span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10">
								<i class={`fa-solid ${portal.icon} text-cyan-300`} aria-hidden="true"></i>
							</span>
							<span class="min-w-0 flex-1">
								<span class="block text-sm font-bold text-white">
									Portal {roleLabelFor(portal.role, lang)}
									{#if activeTab === portal.role}
										<span class="ml-1.5 rounded-full bg-cyan-400/20 px-2 py-0.5 text-xs font-bold text-cyan-200">{t(lang, 'auth.selected')}</span>
									{/if}
								</span>
								<span class="block truncate text-xs text-blue-200">{portalDescFor(portal.role)}</span>
							</span>
							<i
								class={`fa-solid fa-chevron-right text-xs ${activeTab === portal.role ? 'text-cyan-300' : 'text-white/30'}`}
								aria-hidden="true"
							></i>
						</button>
					{/each}
				</div>
			</div>

			<div class="grid grid-cols-3 gap-6 border-t border-white/10 pt-5" aria-label={t(lang, 'auth.statsLabel')}>
				<div>
					<div class="text-2xl font-bold text-white" aria-hidden="true">45.000+</div>
					<div class="text-xs text-blue-200">{t(lang, 'auth.statStudents')}</div>
				</div>
				<div>
					<div class="text-2xl font-bold text-white" aria-hidden="true">120+</div>
					<div class="text-xs text-blue-200">{t(lang, 'auth.statModules')}</div>
				</div>
				<div>
					<div class="text-2xl font-bold text-white" aria-hidden="true">80+</div>
					<div class="text-xs text-blue-200">{t(lang, 'auth.statPartners')}</div>
				</div>
				<p class="col-span-3 text-xs text-blue-300/80">{t(lang, 'auth.statNote')}</p>
			</div>
		</div>
	</div>

	<!-- Right Panel: Login Form -->
	<div
		class="flex min-h-0 flex-1 items-center justify-center overflow-y-auto bg-slate-50 p-4 sm:p-6 lg:w-1/2 lg:p-8 xl:w-2/5"
	>
		<div class="flex max-h-full min-h-0 w-full max-w-md flex-col">
			<div class="mb-4 flex items-center justify-center gap-3 lg:hidden">
				<Logo size="lg" showText={true} textSize="lg" />
			</div>

			<div class="min-h-0 shrink p-6 sm:p-7">
				<div class="mb-5">
					<div
						class={`mb-3 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${style.soft}`}
					>
						<i class={`fa-solid ${style.icon}`} aria-hidden="true"></i> {t(lang, 'auth.portalTitle')} {roleLabelFor(activeTab, lang)}
					</div>
					<h2 class="mb-1 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
						{t(lang, 'auth.portalTitle')} {roleLabelFor(activeTab, lang)}
					</h2>
					<p class="text-xs text-slate-500 sm:text-sm">{portalDescFor(activeTab)}</p>
				</div>

				<!-- Role tabs -->
				<div
					class="mb-5 grid grid-cols-3 gap-1 rounded-2xl border border-slate-200 bg-white p-1"
					role="tablist"
					aria-label={t(lang, 'auth.tablist')}
				>
					{#each TABS as role (role)}
						<button
							type="button"
							role="tab"
							aria-selected={activeTab === role}
							onclick={() => selectTab(role)}
							class={`inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-bold transition-all focus-visible:outline-2 focus-visible:outline-blue-600 ${activeTab === role ? TAB_STYLE[role].active : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}
						>
							<i class={`fa-solid ${TAB_STYLE[role].icon}`} aria-hidden="true"></i>
							{roleLabelFor(role, lang)}
						</button>
					{/each}
				</div>

				<form class="space-y-3.5" onsubmit={handleSubmit}>
					{#if errorMessage}
						<p
							role="alert"
							class="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-700"
						>
							<i class="fa-solid fa-circle-exclamation mt-0.5 shrink-0" aria-hidden="true"></i>
							<span>{errorMessage}</span>
						</p>
					{/if}
					<div>
						<label for="login-email" class="mb-1.5 block text-sm font-semibold text-slate-700">
							{t(lang, 'auth.emailLabel')}{#if activeTab === 'student'}{t(lang, 'auth.nimSuffix')}{/if}
						</label>
						<div class="relative">
							<div
								class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400"
							>
								<i class="fa-solid fa-envelope" aria-hidden="true"></i>
							</div>
							<input
								id="login-email"
								name="email"
								type="email"
								autocomplete="username"
								spellcheck="false"
								autocorrect="off"
								autocapitalize="none"
								enterkeyhint="next"
								required
								placeholder={t(lang, 'auth.emailPh')}
								bind:value={email}
								class="w-full min-h-[44px] rounded-xl border border-slate-200 bg-white py-2.5 pr-4 pl-11 text-sm text-slate-800 transition-all placeholder:text-slate-500 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
							/>
						</div>
					</div>

					<div>
						<div class="mb-1.5 flex items-center justify-between">
							<label for="login-password" class="block text-sm font-semibold text-slate-700">
								{t(lang, 'auth.passLabel')}
							</label>
							<a
								href={lp(lang, '/lupa-password')}
								class="rounded text-xs font-semibold text-blue-600 transition-colors hover:text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-blue-600"
							>
								{t(lang, 'auth.forgot')}
							</a>
						</div>
						<div class="relative">
							<div
								class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400"
							>
								<i class="fa-solid fa-lock" aria-hidden="true"></i>
							</div>
							<input
								id="login-password"
								name="password"
								type={showPassword ? 'text' : 'password'}
								autocomplete="current-password"
								enterkeyhint="done"
								required
								placeholder={t(lang, 'auth.passPh')}
								bind:value={password}
								class="w-full min-h-[44px] rounded-xl border border-slate-200 bg-white py-2.5 pr-12 pl-11 text-sm text-slate-800 transition-all placeholder:text-slate-500 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
							/>
							<button
								type="button"
								aria-label={showPassword ? t(lang, 'auth.hidePw') : t(lang, 'auth.showPw')}
								aria-pressed={showPassword}
								onclick={togglePassword}
								class="absolute inset-y-0 right-0 flex min-w-[44px] items-center justify-center px-3 text-slate-500 transition-colors hover:text-slate-600 focus-visible:outline-2 focus-visible:outline-blue-600"
							>
								<i class={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`} aria-hidden="true"></i>
							</button>
						</div>
					</div>

					<div class="flex items-center justify-between">
						<div class="flex items-center">
							<input
								id="remember-me"
								name="remember-me"
								type="checkbox"
								bind:checked={rememberMe}
								class="h-5 w-5 cursor-pointer rounded border-slate-300 text-blue-600 focus:ring-blue-500/20"
							/>
							<label
								for="remember-me"
								class="ml-2 block cursor-pointer text-sm text-slate-600 select-none"
							>
								{t(lang, 'auth.remember')}
							</label>
						</div>
						<a
							href={lp(lang, '/register')}
							class="rounded text-sm font-semibold text-blue-600 transition-colors hover:text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-blue-600"
						>
							{t(lang, 'auth.noAccount')}
						</a>
					</div>

					<button
						type="submit"
						disabled={isLoading}
						class="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/25 transition-all duration-200 hover:bg-blue-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-blue-400"
					>
						{#if isLoading}
							<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i>
							<span>{t(lang, 'auth.submitBusy')}</span>
						{:else}
							<span>{t(lang, 'auth.submitIdle')} {roleLabelFor(activeTab, lang)}</span>
							<i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
						{/if}
					</button>

					<div class="relative flex items-center py-1">
						<div class="grow border-t border-slate-200"></div>
						<span
							class="mx-4 shrink text-xs font-semibold tracking-wider text-slate-500 uppercase"
							>{t(lang, 'auth.or')}</span
						>
						<div class="grow border-t border-slate-200"></div>
					</div>

					<a
						href={lp(lang, '/with_UNIRA')}
						class="flex w-full items-center justify-center gap-2.5 rounded-xl border border-slate-200 bg-white px-6 py-2.5 text-sm font-semibold text-slate-700 transition-all duration-200 hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-blue-600"
						aria-label={t(lang, 'auth.uniraAria')}
						title={t(lang, 'auth.uniraTitle')}
					>
						<img
							src={uniraLogo}
							alt=""
							class="h-5 w-5 rounded-full object-cover"
						/>
						<span>{t(lang, 'auth.unira')}</span>
					</a>
				</form>
			</div>

			<div class="mt-4 shrink-0 text-center">
				<a
					href={lp(lang, '/')}
					class="inline-flex items-center gap-2 rounded text-sm font-medium text-slate-500 transition-colors hover:text-blue-600 focus-visible:outline-2 focus-visible:outline-blue-600"
				>
					<i class="fa-solid fa-arrow-left" aria-hidden="true"></i>
					{t(lang, 'auth.backHome')}
				</a>
			</div>
		</div>
	</div>
</div>
