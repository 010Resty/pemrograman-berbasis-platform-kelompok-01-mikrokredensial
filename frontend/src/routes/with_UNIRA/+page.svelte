<script lang="ts">
	import '../../app.css';
	import Logo from '$lib/components/Logo.svelte';
	import { uniraLogo } from '$lib/assets/logo';

	let showPassword = $state(false);
	let nim = $state('');
	let password = $state('');
	let isLoading = $state(false);
	let errorMessage = $state('');

	function togglePassword() {
		showPassword = !showPassword;
	}

	/**
	 * SSO UNIRA belum terhubung backend (mock dilarang untuk deploy).
	 * Form tidak membuat sesi — user diarahkan login email/backend.
	 */
	function handleSubmit(event: Event) {
		event.preventDefault();
		errorMessage = '';
		if (!nim.trim() || !password) {
			errorMessage = 'NIM dan kata sandi wajib diisi.';
			return;
		}
		errorMessage =
			'SSO UNIRA belum terhubung ke backend pada deploy ini. Gunakan Masuk dengan Email / Akun Aristoteles.';
	}
</script>

<svelte:head>
	<title>Masuk Portal UNIRA — Aristoteles</title>
	<meta
		name="description"
		content="Masuk ke Portal UNIRA dengan NIM dan kata sandi akademik untuk mengakses Platform Mikrokredensial Aristoteles."
	/>
</svelte:head>

<!-- Compact Single-Frame Login Layout -->
<div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 p-4 sm:p-6">

	<!-- Background Decorations -->
	<div class="fixed inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
		<div class="absolute -top-24 -right-24 w-96 h-96 bg-cyan-400/20 rounded-full blur-3xl"></div>
		<div class="absolute -bottom-32 -left-32 w-[500px] h-[500px] bg-blue-400/20 rounded-full blur-3xl"></div>
	</div>

	<!-- Login Card -->
	<div class="relative z-10 w-full max-w-md">
		<div class="bg-white rounded-2xl shadow-2xl overflow-hidden">
			<!-- Top Accent Bar -->
			<div class="h-1.5 bg-gradient-to-r from-blue-600 via-cyan-500 to-blue-600" aria-hidden="true"></div>

			<div class="p-6 sm:p-8">
				<!-- Header -->
				<div class="text-center mb-6">
					<div class="flex items-center justify-center gap-4 mb-4">
						<div class="w-px h-10 bg-slate-200" aria-hidden="true"></div>
						<Logo size="md" showText textSize="lg" />
						<img
							src={uniraLogo}
							alt="Logo Universitas Madura"
							class="w-12 h-12 rounded-2xl object-cover shadow-lg ring-1 ring-slate-200"
						/>
					</div>
					<div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold border border-blue-100">
						<i class="fa-solid fa-building-columns" aria-hidden="true"></i> Portal UNIRA
					</div>
					<h1 class="text-xl font-bold text-slate-900 mt-3">Masuk dengan NIM</h1>
					<p class="text-slate-500 text-xs mt-1">Gunakan NIM dan kata sandi akademik UNIRA Anda.</p>
				</div>

				<!-- Form -->
				<form class="space-y-4" onsubmit={handleSubmit}>
					{#if errorMessage}
						<p
							role="alert"
							class="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-semibold text-amber-800"
						>
							<i class="fa-solid fa-circle-exclamation mt-0.5 shrink-0" aria-hidden="true"></i>
							<span>{errorMessage}</span>
						</p>
					{/if}
					<!-- NIM Input -->
					<div>
						<label for="nim" class="block text-sm font-semibold text-slate-700 mb-1.5">
							NIM (Nomor Induk Mahasiswa)
						</label>
						<div class="relative">
							<div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400" aria-hidden="true">
								<i class="fa-solid fa-id-card"></i>
							</div>
							<input
								id="nim"
								name="nim"
								type="text"
								placeholder="Masukkan NIM Anda"
								bind:value={nim}
								required
								inputmode="numeric"
								autocomplete="username"
								class="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all"
							/>
						</div>
					</div>

					<!-- Password Input -->
					<div>
						<div class="flex items-center justify-between mb-1.5">
							<label for="unira-password" class="block text-sm font-semibold text-slate-700">
								Kata Sandi
							</label>
							<a href="/login" class="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline transition-colors">
								Lupa Kata Sandi?
							</a>
						</div>
						<div class="relative">
							<div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400" aria-hidden="true">
								<i class="fa-solid fa-lock"></i>
							</div>
							<input
								id="unira-password"
								name="password"
								type={showPassword ? 'text' : 'password'}
								placeholder="Masukkan kata sandi"
								bind:value={password}
								required
								autocomplete="current-password"
								class="w-full pl-10 pr-11 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all"
							/>
							<button
								type="button"
								aria-label="Tampilkan atau sembunyikan kata sandi"
								aria-pressed={showPassword}
								onclick={togglePassword}
								class="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
							>
								<i class="fa-solid {showPassword ? 'fa-eye-slash' : 'fa-eye'}" aria-hidden="true"></i>
							</button>
						</div>
					</div>

					<!-- Submit Button -->
					<button
						type="submit"
						disabled={isLoading}
						class="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-3 px-6 rounded-xl font-bold text-sm transition-all duration-200 shadow-lg shadow-blue-600/25 active:scale-[0.98] disabled:cursor-not-allowed"
					>
						{#if isLoading}
							<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i>
							<span>Memproses...</span>
						{:else}
							<span>Masuk ke Portal UNIRA</span>
							<i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
						{/if}
					</button>

					<!-- Divider -->
					<div class="relative flex py-2 items-center" aria-hidden="true">
						<div class="flex-grow border-t border-slate-200"></div>
						<span class="flex-shrink mx-3 text-xs text-slate-400 uppercase tracking-wider font-semibold">atau</span>
						<div class="flex-grow border-t border-slate-200"></div>
					</div>

					<!-- Alternative Login Button -->
					<a
						href="/login"
						class="w-full flex items-center justify-center gap-2 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-700 py-2.5 px-6 rounded-xl font-semibold text-sm transition-all duration-200 active:scale-[0.98]"
					>
						<i class="fa-solid fa-graduation-cap text-blue-600" aria-hidden="true"></i>
						<span>Masuk dengan Email / Akun Aristoteles</span>
					</a>
				</form>
			</div>

			<!-- Card Footer -->
			<div class="px-6 sm:px-8 py-3 bg-slate-50 border-t border-slate-100">
				<div class="flex items-center justify-center gap-3 text-xs text-slate-500">
					<span class="flex items-center gap-1">
						<i class="fa-solid fa-shield-halved text-green-500" aria-hidden="true"></i>
						Enkripsi TLS 1.3
					</span>
					<span class="text-slate-300" aria-hidden="true">|</span>
					<span class="flex items-center gap-1">
						<i class="fa-solid fa-certificate text-green-500" aria-hidden="true"></i>
						ISO 27001
					</span>
				</div>
			</div>
		</div>

		<!-- Back to Home -->
		<div class="mt-4 text-center">
			<a href="/" class="inline-flex items-center gap-2 text-sm text-white/70 hover:text-white transition-colors font-medium">
				<i class="fa-solid fa-arrow-left" aria-hidden="true"></i>
				Kembali ke Beranda
			</a>
		</div>

		<!-- Footer -->
		<div class="mt-4 text-center text-xs text-white/50">
			<p>&copy; 2026 Aristoteles Platform Mikrokredensial. Semua hak dilindungi.</p>
		</div>
	</div>
</div>
