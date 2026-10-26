<script lang="ts">
	import { goto } from '$app/navigation';
	import '../../app.css';
	import Logo from '$lib/components/Logo.svelte';
	import {
		DEMO_ACCOUNTS,
		ROLE_LABEL,
		homeFor,
		loadSession,
		login,
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
	let email = $state(DEMO_ACCOUNTS[0].email);
	let password = $state(DEMO_ACCOUNTS[0].password);
	let rememberMe = $state(false);
	let isLoading = $state(false);
	let errorMessage = $state('');

	const account = $derived(DEMO_ACCOUNTS.find((a) => a.role === activeTab)!);
	const style = $derived(TAB_STYLE[activeTab]);

	function togglePassword() {
		showPassword = !showPassword;
	}

	function selectTab(role: Role) {
		activeTab = role;
		const demo = DEMO_ACCOUNTS.find((a) => a.role === role)!;
		email = demo.email;
		password = demo.password;
		errorMessage = '';
	}

	function fillDemo() {
		email = account.email;
		password = account.password;
		errorMessage = '';
	}

	function handleSubmit(event: Event) {
		event.preventDefault();
		errorMessage = '';
		isLoading = true;
		setTimeout(() => {
			isLoading = false;
			const result = login(email, password, rememberMe);
			if (!result.ok) {
				errorMessage = result.error;
				return;
			}
			if (result.user.role !== activeTab) {
				goto(homeFor(result.user.role));
				return;
			}
			goto(account.home);
		}, 700);
	}

	// Sudah login → langsung ke portal perannya
	$effect(() => {
		const s = loadSession();
		if (s) goto(homeFor(s.role));
	});
</script>

<svelte:head>
	<title>Masuk Portal — Student · Teacher · Administrator — Aristoteles</title>
	<meta
		name="description"
		content="Masuk ke portal Student, Teacher, atau Administrator Platform Mikrokredensial Aristoteles."
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
				<div
					class="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-1.5 text-xs font-semibold text-cyan-300 backdrop-blur-sm"
				>
					<i class="fa-solid fa-shield-halved" aria-hidden="true"></i> Portal Akademik Terpadu
				</div>

				<h2 class="mb-3 text-3xl leading-tight font-bold text-white xl:text-4xl">
					Satu Gerbang,<br />
					<span class="text-cyan-400">Tiga Portal Peran</span>
				</h2>

				<p class="mb-6 max-w-md text-sm leading-relaxed text-blue-100 xl:text-base">
					Pilih portal sesuai peranmu — Student belajar & sertifikasi, Teacher mengajar &
					menilai, Administrator mengelola platform.
				</p>

				<div class="space-y-2.5">
					{#each DEMO_ACCOUNTS as demo (demo.role)}
						<button
							type="button"
							onclick={() => selectTab(demo.role)}
							aria-pressed={activeTab === demo.role}
							class={`flex w-full max-w-md items-center gap-3 rounded-2xl border p-3.5 text-left backdrop-blur-sm transition-all focus-visible:outline-2 focus-visible:outline-cyan-300 ${activeTab === demo.role ? 'border-cyan-300/60 bg-white/15' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}
						>
							<span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10">
								<i class={`fa-solid ${demo.icon} text-cyan-300`} aria-hidden="true"></i>
							</span>
							<span class="min-w-0 flex-1">
								<span class="block text-sm font-bold text-white">
									Portal {ROLE_LABEL[demo.role]}
									{#if activeTab === demo.role}
										<span class="ml-1.5 rounded-full bg-cyan-400/20 px-2 py-0.5 text-[10px] font-bold text-cyan-200">dipilih</span>
									{/if}
								</span>
								<span class="block truncate text-xs text-blue-200">{demo.description}</span>
							</span>
							<i
								class={`fa-solid fa-chevron-right text-xs ${activeTab === demo.role ? 'text-cyan-300' : 'text-white/30'}`}
								aria-hidden="true"
							></i>
						</button>
					{/each}
				</div>
			</div>

			<div class="grid grid-cols-3 gap-6 border-t border-white/10 pt-5">
				<div>
					<div class="text-2xl font-bold text-white">45.000+</div>
					<div class="text-xs text-blue-200">Mahasiswa</div>
				</div>
				<div>
					<div class="text-2xl font-bold text-white">120+</div>
					<div class="text-xs text-blue-200">Modul</div>
				</div>
				<div>
					<div class="text-2xl font-bold text-white">80+</div>
					<div class="text-xs text-blue-200">Mitra Industri</div>
				</div>
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
						<i class={`fa-solid ${style.icon}`} aria-hidden="true"></i> Portal {ROLE_LABEL[activeTab]}
					</div>
					<h2 class="mb-1 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
						Masuk Portal {ROLE_LABEL[activeTab]}
					</h2>
					<p class="text-xs text-slate-500 sm:text-sm">{account.description}</p>
				</div>

				<!-- Role tabs -->
				<div
					class="mb-5 grid grid-cols-3 gap-1 rounded-2xl border border-slate-200 bg-white p-1"
					role="tablist"
					aria-label="Pilih portal"
				>
					{#each TABS as role (role)}
						<button
							type="button"
							role="tab"
							aria-selected={activeTab === role}
							onclick={() => selectTab(role)}
							class={`inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-[11px] font-bold transition-all focus-visible:outline-2 focus-visible:outline-blue-600 ${activeTab === role ? TAB_STYLE[role].active : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}
						>
							<i class={`fa-solid ${TAB_STYLE[role].icon}`} aria-hidden="true"></i>
							{ROLE_LABEL[role]}
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
							Email {#if activeTab === 'student'} / NIM {/if}
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
								autocomplete="email"
								placeholder={account.email}
								bind:value={email}
								class="w-full rounded-xl border border-slate-200 bg-white py-2.5 pr-4 pl-11 text-sm text-slate-800 transition-all placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
							/>
						</div>
					</div>

					<div>
						<div class="mb-1.5 flex items-center justify-between">
							<label for="login-password" class="block text-sm font-semibold text-slate-700">
								Kata Sandi
							</label>
							<a
								href="/verify"
								class="rounded text-xs font-semibold text-blue-600 transition-colors hover:text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-blue-600"
							>
								Lupa Kata Sandi?
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
								placeholder="Masukkan kata sandi"
								bind:value={password}
								class="w-full rounded-xl border border-slate-200 bg-white py-2.5 pr-12 pl-11 text-sm text-slate-800 transition-all placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
							/>
							<button
								type="button"
								aria-label="Tampilkan atau sembunyikan kata sandi"
								onclick={togglePassword}
								class="absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400 transition-colors hover:text-slate-600 focus-visible:outline-2 focus-visible:outline-blue-600"
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
								class="h-4 w-4 cursor-pointer rounded border-slate-300 text-blue-600 focus:ring-blue-500/20"
							/>
							<label
								for="remember-me"
								class="ml-2 block cursor-pointer text-sm text-slate-600 select-none"
							>
								Ingat saya
							</label>
						</div>
						<a
							href="/register"
							class="rounded text-sm font-semibold text-blue-600 transition-colors hover:text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-blue-600"
						>
							Daftar Akun
						</a>
					</div>

					<button
						type="submit"
						disabled={isLoading}
						class="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/25 transition-all duration-200 hover:bg-blue-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-blue-400"
					>
						{#if isLoading}
							<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i>
							<span>Memproses...</span>
						{:else}
							<span>Masuk Portal {ROLE_LABEL[activeTab]}</span>
							<i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
						{/if}
					</button>

					<div class="relative flex items-center py-1">
						<div class="grow border-t border-slate-200"></div>
						<span
							class="mx-4 shrink text-xs font-semibold tracking-wider text-slate-400 uppercase"
							>atau</span
						>
						<div class="grow border-t border-slate-200"></div>
					</div>

					<!-- Demo account per peran aktif -->
					<div class="rounded-xl border border-dashed border-blue-200 bg-blue-50/60 px-4 py-2.5">
						<div class="flex flex-wrap items-center justify-between gap-2">
							<span>
								<span class="block text-[11px] font-bold text-slate-800">
									{account.badge} — {account.name}
								</span>
								<span class="block font-mono text-[11px] text-blue-700">
									{account.email} · {account.password}
								</span>
							</span>
							<button
								type="button"
								onclick={fillDemo}
								class="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
							>
								<i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i>
								Isi otomatis
							</button>
						</div>
					</div>

					<a
						href="/with_UNIRA"
						class="flex w-full items-center justify-center gap-2.5 rounded-xl border border-slate-200 bg-white px-6 py-2.5 text-sm font-semibold text-slate-700 transition-all duration-200 hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-blue-600"
					>
						<i class="fa-brands fa-google text-red-500" aria-hidden="true"></i>
						<span>Masuk dengan UNIRA</span>
					</a>
				</form>
			</div>

			<div class="mt-4 shrink-0 text-center">
				<a
					href="/"
					class="inline-flex items-center gap-2 rounded text-sm font-medium text-slate-500 transition-colors hover:text-blue-600 focus-visible:outline-2 focus-visible:outline-blue-600"
				>
					<i class="fa-solid fa-arrow-left" aria-hidden="true"></i>
					Kembali ke Beranda
				</a>
			</div>
		</div>
	</div>
</div>
