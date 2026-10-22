<script lang="ts">
	import { goto } from '$app/navigation';
	import '../../app.css';
	import Logo from '$lib/components/Logo.svelte';

	/** Akun dummy untuk simulasi login (sisi klien, tanpa backend) */
	const DUMMY_ACCOUNTS = [
		{
			email: 'farisi@gmail.com',
			password: '1234567',
			name: 'Ahmad Farizi',
			role: 'Mahasiswa UNIRA',
			home: '/user'
		},
		{
			email: 'kevin@aristotle.ac.id',
			password: '1234567',
			name: 'Kevin Perry',
			role: 'Instruktur',
			home: '/instruktur'
		}
	];

	let showPassword = $state(false);
	let email = $state('');
	let password = $state('');
	let rememberMe = $state(false);
	let isLoading = $state(false);
	let errorMessage = $state('');

	function togglePassword() {
		showPassword = !showPassword;
	}

	function fillDemoAccount(account: (typeof DUMMY_ACCOUNTS)[number] = DUMMY_ACCOUNTS[0]) {
		email = account.email;
		password = account.password;
		errorMessage = '';
	}

	function handleSubmit(event: Event) {
		event.preventDefault();
		errorMessage = '';
		isLoading = true;

		const account = DUMMY_ACCOUNTS.find(
			(a) => a.email.toLowerCase() === email.trim().toLowerCase() && a.password === password
		);

		setTimeout(() => {
			isLoading = false;
			if (!account) {
				errorMessage = 'Email atau kata sandi salah. Gunakan akun demo di bawah untuk mencoba.';
				return;
			}
			try {
				const session = {
					email: account.email,
					name: account.name,
					role: account.role,
					loginAt: new Date().toISOString(),
					rememberMe
				};
				(rememberMe ? localStorage : sessionStorage).setItem('aristotle-session', JSON.stringify(session));
			} catch {
				// abaikan bila penyimpanan tidak tersedia
			}
			goto(account.home ?? '/user');
		}, 900);
	}
</script>

<!-- Login satu viewport penuh: h-dvh + overflow-hidden, halaman tidak bisa di-scroll -->
<div class="flex h-dvh flex-col overflow-hidden bg-slate-50 lg:flex-row">

	<!-- Left Panel: Branding & Info (Hidden on mobile) -->
	<div class="relative hidden min-h-0 overflow-hidden bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 lg:flex lg:w-1/2 xl:w-3/5">
		<!-- Background Pattern -->
		<div class="absolute inset-0 opacity-10" aria-hidden="true">
			<div class="absolute top-0 left-0 w-full h-full" style="background-image: url('data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.4\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E');"></div>
		</div>

		<!-- Decorative Circles -->
		<div class="absolute -top-24 -right-24 w-96 h-96 bg-cyan-400/20 rounded-full blur-3xl" aria-hidden="true"></div>
		<div class="absolute -bottom-32 -left-32 w-[500px] h-[500px] bg-blue-400/20 rounded-full blur-3xl" aria-hidden="true"></div>

		<!-- Content -->
		<div class="relative z-10 flex min-h-0 w-full flex-col justify-between p-8 xl:p-10">
			<!-- Logo & Branding -->
			<Logo size="xl" showText={true} textSize="xl" dark={true} />

			<!-- Center Content -->
			<div class="flex min-h-0 flex-col justify-center py-4">
				<div class="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm text-cyan-300 px-4 py-1.5 rounded-full text-xs font-semibold mb-4 w-fit border border-white/10">
					<i class="fa-solid fa-shield-halved" aria-hidden="true"></i> Portal Akademik Terpadu
				</div>

				<h2 class="text-3xl xl:text-4xl font-bold text-white leading-tight mb-3">
					Sistem Pendukung<br />
					<span class="text-cyan-400">Akademik Terpadu</span>
				</h2>

				<p class="text-blue-100 text-sm xl:text-base leading-relaxed mb-6 max-w-md">
					Platform bimbingan skripsi, kerja praktik, KRS, dan layanan akademik mahasiswa secara real-time.
				</p>

				<!-- Features List -->
				<div class="space-y-2.5">
					<div class="flex items-center gap-3 text-white/90">
						<div class="w-9 h-9 shrink-0 bg-white/10 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/10">
							<i class="fa-solid fa-book-open text-cyan-400 text-sm" aria-hidden="true"></i>
						</div>
						<span class="font-medium text-sm">Akses Modul Belajar &amp; Sertifikasi</span>
					</div>
					<div class="flex items-center gap-3 text-white/90">
						<div class="w-9 h-9 shrink-0 bg-white/10 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/10">
							<i class="fa-solid fa-award text-cyan-400 text-sm" aria-hidden="true"></i>
						</div>
						<span class="font-medium text-sm">Sertifikat Terverifikasi &amp; Terakreditasi</span>
					</div>
					<div class="flex items-center gap-3 text-white/90">
						<div class="w-9 h-9 shrink-0 bg-white/10 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/10">
							<i class="fa-solid fa-chart-line text-cyan-400 text-sm" aria-hidden="true"></i>
						</div>
						<span class="font-medium text-sm">Pantau Progres &amp; Peringkat</span>
					</div>
				</div>
			</div>

			<!-- Bottom Stats -->
			<div class="grid grid-cols-3 gap-6 pt-5 border-t border-white/10">
				<div>
					<div class="text-2xl font-bold text-white">45.000+</div>
					<div class="text-blue-200 text-xs">Mahasiswa</div>
				</div>
				<div>
					<div class="text-2xl font-bold text-white">120+</div>
					<div class="text-blue-200 text-xs">Modul</div>
				</div>
				<div>
					<div class="text-2xl font-bold text-white">80+</div>
					<div class="text-blue-200 text-xs">Mitra Industri</div>
				</div>
			</div>
		</div>
	</div>

	<!-- Right Panel: Login Form (tanpa card, form menempel langsung pada background) -->
	<div class="flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-slate-50 p-4 sm:p-6 lg:w-1/2 lg:p-8 xl:w-2/5">
		<div class="flex max-h-full min-h-0 w-full max-w-md flex-col">
			<!-- Mobile Logo (visible only on small screens) -->
			<div class="mb-4 flex items-center justify-center gap-3 lg:hidden">
				<Logo size="lg" showText={true} textSize="lg" />
			</div>

			<div class="min-h-0 shrink p-6 sm:p-7">
				<!-- Header -->
				<div class="mb-5">
					<div class="mb-3 inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
						<i class="fa-solid fa-user-graduate" aria-hidden="true"></i> Portal Mahasiswa
					</div>
					<h2 class="mb-1 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
						Selamat Datang Kembali
					</h2>
					<p class="text-xs text-slate-500 sm:text-sm">
						Masuk untuk melanjutkan progres belajar dan sertifikasi Anda.
					</p>
				</div>

				<!-- Form -->
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
					<!-- Email Input -->
					<div>
						<label for="student-email" class="mb-1.5 block text-sm font-semibold text-slate-700">
							Email / NIM
						</label>
						<div class="relative">
							<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
								<i class="fa-solid fa-envelope" aria-hidden="true"></i>
							</div>
							<input
								id="student-email"
								name="email"
								type="email"
								autocomplete="email"
								placeholder="nim@student.ac.id atau email@anda.com"
								bind:value={email}
								class="w-full rounded-xl border border-slate-200 bg-white py-2.5 pr-4 pl-11 text-sm text-slate-800 transition-all placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
							/>
						</div>
					</div>

					<!-- Password Input -->
					<div>
						<div class="mb-1.5 flex items-center justify-between">
							<label for="student-password" class="block text-sm font-semibold text-slate-700">
								Kata Sandi
							</label>
							<a href="/verify" class="rounded text-xs font-semibold text-blue-600 transition-colors hover:text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-blue-600">
								Lupa Kata Sandi?
							</a>
						</div>
						<div class="relative">
							<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
								<i class="fa-solid fa-lock" aria-hidden="true"></i>
							</div>
							<input
								id="student-password"
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
								<i class="fa-solid {showPassword ? 'fa-eye-slash' : 'fa-eye'}" aria-hidden="true"></i>
							</button>
						</div>
					</div>

					<!-- Remember Me -->
					<div class="flex items-center justify-between">
						<div class="flex items-center">
							<input
								id="remember-me"
								name="remember-me"
								type="checkbox"
								bind:checked={rememberMe}
								class="h-4 w-4 cursor-pointer rounded border-slate-300 text-blue-600 focus:ring-blue-500/20"
							/>
							<label for="remember-me" class="ml-2 block cursor-pointer text-sm text-slate-600 select-none">
								Ingat saya
							</label>
						</div>
						<a href="/register" class="rounded text-sm font-semibold text-blue-600 transition-colors hover:text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-blue-600">
							Daftar Akun
						</a>
					</div>

					<!-- Submit Button -->
					<button
						type="submit"
						disabled={isLoading}
						class="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/25 transition-all duration-200 hover:bg-blue-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-blue-400"
					>
						{#if isLoading}
							<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i>
							<span>Memproses...</span>
						{:else}
							<span>Masuk ke Portal</span>
							<i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
						{/if}
					</button>

					<!-- Divider -->
					<div class="relative flex items-center py-1">
						<div class="grow border-t border-slate-200"></div>
						<span class="mx-4 shrink text-xs font-semibold tracking-wider text-slate-400 uppercase">atau</span>
						<div class="grow border-t border-slate-200"></div>
					</div>

					<!-- Demo account (ringkas agar muat satu layar) -->
					<details class="group rounded-xl border border-dashed border-blue-200 bg-blue-50/60 px-4 py-2.5">
						<summary class="flex cursor-pointer list-none items-center justify-between gap-2 rounded text-xs font-bold text-blue-800 focus-visible:outline-2 focus-visible:outline-blue-600 [&::-webkit-details-marker]:hidden">
							<span class="flex items-center gap-2">
								<i class="fa-solid fa-flask" aria-hidden="true"></i> Akun demo — klik untuk isi otomatis
							</span>
							<i class="fa-solid fa-chevron-down text-[10px] transition-transform group-open:rotate-180" aria-hidden="true"></i>
						</summary>
						<ul class="mt-2 space-y-2 pb-1">
							{#each DUMMY_ACCOUNTS as account (account.email)}
								<li class="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/70 px-3 py-2">
									<span>
										<span class="block text-[11px] font-bold text-slate-800">{account.role} — {account.name}</span>
										<span class="block font-mono text-[11px] text-blue-700">
											{account.email} · {account.password}
										</span>
									</span>
									<button
										type="button"
										onclick={() => fillDemoAccount(account)}
										class="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
									>
										<i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i>
										Isi otomatis
									</button>
								</li>
							{/each}
						</ul>
					</details>

					<!-- SSO Button -->
					<a
						href="/with_UNIRA"
						class="flex w-full items-center justify-center gap-2.5 rounded-xl border border-slate-200 bg-white px-6 py-2.5 text-sm font-semibold text-slate-700 transition-all duration-200 hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-blue-600"
					>
						<i class="fa-brands fa-google text-red-500" aria-hidden="true"></i>
						<span>Masuk dengan UNIRA</span>
					</a>
				</form>
			</div>

			<!-- Back to Home -->
			<div class="mt-4 shrink-0 text-center">
				<a href="/" class="inline-flex items-center gap-2 rounded text-sm font-medium text-slate-500 transition-colors hover:text-blue-600 focus-visible:outline-2 focus-visible:outline-blue-600">
					<i class="fa-solid fa-arrow-left" aria-hidden="true"></i>
					Kembali ke Beranda
				</a>
			</div>
		</div>
	</div>
</div>
