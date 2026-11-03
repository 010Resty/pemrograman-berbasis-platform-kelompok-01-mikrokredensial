<script lang="ts">
	import { page } from '$app/state';
	import '../../app.css';
	import Logo from '$lib/components/Logo.svelte';
	import OtpInput from '$lib/components/OtpInput.svelte';
	import { resetPasswordWithBackend } from '$lib/stores/auth.svelte';

	type Step = 'otp' | 'password';

	let email = $state('');
	let code = $state('');
	let newPassword = $state('');
	let confirmPassword = $state('');
	let showPassword = $state(false);
	let step = $state<Step>('otp');
	let isLoading = $state(false);
	let errorMessage = $state('');
	let isDone = $state(false);
	/** Gagal simpan beruntun (anti-brute-force sisi UI; backend tetap otoritas). */
	let failCount = $state(0);
	const MAX_FAILS = 5;

	const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	function isValidEmail(value: string): boolean {
		const v = value.trim();
		return v.length > 0 && v.length <= 191 && EMAIL_RE.test(v);
	}
	function isValidCode(value: string): boolean {
		return /^\d{6}$/.test(value.trim());
	}

	// Email dari ?email= (dikirim halaman lupa-password) langsung dikunci:
	// user tidak bisa mengubahnya lagi di halaman OTP ini. Kunci hanya bila
	// formatnya valid; tautan rusak tetap bisa dikoreksi manual.
	const rawQueryEmail = $derived((page.url.searchParams.get('email') ?? '').trim());
	const queryEmail = $derived(isValidEmail(rawQueryEmail) ? rawQueryEmail : '');
	const queryEmailBroken = $derived(rawQueryEmail.length > 0 && queryEmail.length === 0);
	const isEmailLocked = $derived(queryEmail.length > 0);

	$effect(() => {
		if (queryEmail && !email) email = queryEmail;
	});

	function goToOtpStep(event?: Event): void {
		event?.preventDefault();
		errorMessage = '';
		step = 'otp';
		window.scrollTo({ top: 0 });
	}

	function goToPasswordStep(event: Event): void {
		event.preventDefault();
		errorMessage = '';
		if (!isValidEmail(email)) {
			errorMessage = queryEmailBroken
				? 'Tautan email tidak valid. Ulangi dari halaman lupa password.'
				: 'Email tidak valid. Kembali ke halaman lupa password untuk meminta kode.';
			return;
		}
		if (!isValidCode(code)) {
			errorMessage = 'Masukkan 6 digit kode OTP dari email Anda.';
			return;
		}
		step = 'password';
		window.scrollTo({ top: 0 });
	}

	async function handleSubmit(event: Event): Promise<void> {
		event.preventDefault();
		errorMessage = '';
		if (failCount >= MAX_FAILS) {
			errorMessage =
				'Terlalu banyak percobaan gagal. Minta kode baru lewat halaman lupa password.';
			code = '';
			step = 'otp';
			return;
		}
		if (!isValidEmail(email)) {
			errorMessage = 'Email tidak valid.';
			return;
		}
		if (!isValidCode(code)) {
			errorMessage = 'Masukkan 6 digit kode OTP dari email Anda.';
			return;
		}
		if (newPassword.length < 8) {
			errorMessage = 'Kata sandi baru minimal 8 karakter.';
			return;
		}
		if (newPassword.length > 72) {
			errorMessage = 'Kata sandi baru maksimal 72 karakter.';
			return;
		}
		if (newPassword !== confirmPassword) {
			errorMessage = 'Konfirmasi kata sandi tidak cocok.';
			return;
		}
		isLoading = true;
		try {
			const result = await resetPasswordWithBackend(email, code, newPassword);
			if (!result.ok) {
				failCount += 1;
				// Hapus password dari memori tiap gagal; kode dipertahankan agar bisa dibetulkan,
				// kecuali sudah terlalu banyak gagal → buang kode dan minta kode baru.
				newPassword = '';
				confirmPassword = '';
				if (failCount >= MAX_FAILS) {
					code = '';
					step = 'otp';
					errorMessage =
						'Terlalu banyak percobaan gagal. Minta kode baru lewat halaman lupa password.';
					return;
				}
				// Kode salah/kedaluwarsa → kembalikan ke langkah OTP agar bisa dibetulkan.
				if (/kode|otp|kedaluwarsa|tidak valid/i.test(result.error)) step = 'otp';
				errorMessage = result.error;
				return;
			}
			// Sukses TIDAK auto-login — user wajib masuk ulang dengan password baru.
			// Hapus semua rahasia dari memori agar tidak tertinggal di state browser.
			failCount = 0;
			code = '';
			newPassword = '';
			confirmPassword = '';
			isDone = true;
			window.scrollTo({ top: 0, behavior: 'smooth' });
		} finally {
			isLoading = false;
		}
	}
</script>

<svelte:head>
	<title>Reset Password — ARISTOTELES</title>
	<meta
		name="description"
		content="Masukkan kode OTP lalu buat kata sandi baru untuk akun ARISTOTELES Anda."
	/>
	<meta name="robots" content="noindex,nofollow" />
</svelte:head>

<div class="flex min-h-dvh flex-col items-center justify-center bg-slate-50 p-4 sm:p-6">
	<div class="mb-5">
		<Logo size="lg" showText={true} textSize="lg" />
	</div>
	{#if isDone}
		<div
			role="status"
			class="w-full max-w-md rounded-2xl border border-emerald-200 bg-white p-6 text-center shadow-xl shadow-slate-900/5 sm:p-8"
		>
			<span
				class="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-lg text-emerald-600"
				aria-hidden="true"
			>
				<i class="fa-solid fa-check"></i>
			</span>
			<h1 class="mt-3 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
				Password berhasil diganti
			</h1>
			<p class="mt-1 text-xs text-slate-500 sm:text-sm">
				Silakan masuk kembali menggunakan kata sandi baru Anda.
			</p>
			<a
				href="/login"
				class="mt-5 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-blue-600 px-8 text-sm font-bold text-white shadow-lg shadow-blue-600/25 transition-all duration-200 hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
			>
				Masuk Sekarang <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
			</a>
		</div>
	{:else}
		<div class="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-900/5 sm:p-8">
			<div class="mb-5 text-center">
				<span
					class="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-lg text-blue-600"
					aria-hidden="true"
				>
					<i class="fa-solid fa-lock" aria-hidden="true"></i>
				</span>
				<h1 class="mt-3 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
					{step === 'otp' ? 'Verifikasi Kode OTP' : 'Buat Password Baru'}
				</h1>
				<p class="mt-1 text-xs text-slate-500 sm:text-sm">
					{step === 'otp'
						? 'Masukkan 6 digit kode yang dikirim ke email Anda.'
						: 'Terakhir, buat kata sandi baru untuk akun Anda.'}
				</p>
			</div>

			<ol aria-label="Langkah reset password" class="mb-5 flex items-center gap-1.5 text-[11px] font-bold">
				<li
					aria-current={step === 'otp' ? 'step' : undefined}
					class="flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 {step === 'otp'
						? 'bg-blue-600 text-white'
						: 'bg-emerald-50 text-emerald-700'}"
				>
					{#if step === 'password'}
						<i class="fa-solid fa-check" aria-hidden="true"></i>
					{:else}
						<span aria-hidden="true">1</span>
					{/if}
					Kode OTP
				</li>
				<li aria-hidden="true" class="h-px w-4 bg-slate-300"></li>
				<li
					aria-current={step === 'password' ? 'step' : undefined}
					class="flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 {step === 'password'
						? 'bg-blue-600 text-white'
						: 'bg-slate-100 text-slate-500'}"
				>
					<span aria-hidden="true">2</span>
					Password baru
				</li>
			</ol>

			{#if errorMessage}
				<p
					role="alert"
					class="mb-4 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-700"
				>
					<i class="fa-solid fa-circle-exclamation mt-0.5 shrink-0" aria-hidden="true"></i>
					<span>{errorMessage}</span>
				</p>
			{/if}

			{#if step === 'otp'}
				<form class="space-y-4" onsubmit={goToPasswordStep} novalidate>
					<div>
						<label for="reset-email" class="mb-1.5 block text-sm font-semibold text-slate-700">
							Email akun
						</label>
						<input
							id="reset-email"
							name="email"
							type="email"
							autocomplete="email"
							placeholder="email@anda.com"
							bind:value={email}
							readonly={isEmailLocked}
							aria-readonly={isEmailLocked}
							title={isEmailLocked ? 'Email dikunci dari permintaan lupa password' : undefined}
							class="w-full rounded-xl border border-slate-200 bg-white py-2.5 pr-4 pl-4 text-sm text-slate-800 transition-all placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none {isEmailLocked
								? 'cursor-not-allowed bg-slate-50 text-slate-600'
								: ''}"
						/>
						{#if isEmailLocked}
							<p class="mt-1.5 flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
								<i class="fa-solid fa-lock text-[10px]" aria-hidden="true"></i>
								Email dikunci — kode dikirim ke alamat ini.
								<a
									href="/lupa-password"
									class="rounded font-bold text-blue-600 hover:text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-blue-600"
								>
									Salah email?
								</a>
							</p>
						{/if}
					</div>
					<OtpInput bind:value={code} disabled={isLoading} />
					<button
						type="submit"
						class="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/25 transition-all duration-200 hover:bg-blue-700 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-blue-600"
					>
						<span>Lanjut ke Password Baru</span>
						<i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
					</button>
				</form>
			{:else}
				<div class="mb-4 rounded-xl bg-slate-50 px-4 py-2.5 text-xs text-slate-600">
					Kode untuk <span class="font-bold text-slate-800">{email}</span>
					<button
						type="button"
						onclick={goToOtpStep}
						class="ml-1 rounded font-bold text-blue-600 hover:text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-blue-600"
					>
						Ubah kode
					</button>
				</div>
				<form class="space-y-4" onsubmit={handleSubmit} novalidate>
					<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<div>
							<label for="reset-password" class="mb-1.5 block text-sm font-semibold text-slate-700">
								Password baru
							</label>
							<div class="relative">
								<input
									id="reset-password"
									name="newPassword"
									type={showPassword ? 'text' : 'password'}
									autocomplete="new-password"
									placeholder="Min. 8 karakter"
									bind:value={newPassword}
									class="w-full rounded-xl border border-slate-200 bg-white py-2.5 pr-11 pl-4 text-sm text-slate-800 transition-all placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
								/>
								<button
									type="button"
									aria-label="Tampilkan atau sembunyikan kata sandi"
									onclick={() => (showPassword = !showPassword)}
									class="absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400 transition-colors hover:text-slate-600 focus-visible:outline-2 focus-visible:outline-blue-600"
								>
									<i class="fa-solid {showPassword ? 'fa-eye-slash' : 'fa-eye'}" aria-hidden="true"></i>
								</button>
							</div>
						</div>
						<div>
							<label for="reset-confirm" class="mb-1.5 block text-sm font-semibold text-slate-700">
								Konfirmasi
							</label>
							<input
								id="reset-confirm"
								name="confirmPassword"
								type={showPassword ? 'text' : 'password'}
								autocomplete="new-password"
								placeholder="Ulangi password"
								bind:value={confirmPassword}
								class="w-full rounded-xl border border-slate-200 bg-white py-2.5 pr-4 pl-4 text-sm text-slate-800 transition-all placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
							/>
						</div>
					</div>
					{#if confirmPassword.length > 0 && newPassword !== confirmPassword}
						<p role="alert" class="flex items-center gap-1 text-[11px] font-semibold text-red-500">
							<i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i>
							<span>Kata sandi tidak cocok.</span>
						</p>
					{/if}
					{#if failCount > 0 && failCount < MAX_FAILS}
						<p role="status" class="text-[11px] font-semibold text-amber-700">
							Percobaan gagal {failCount} dari {MAX_FAILS}. Setelah batas, Anda wajib meminta
							kode baru.
						</p>
					{/if}
					<button
						type="submit"
						disabled={isLoading}
						class="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/25 transition-all duration-200 hover:bg-blue-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-blue-400"
					>
						{#if isLoading}
							<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i>
							<span>Menyimpan...</span>
						{:else}
							<span>Simpan Password Baru</span>
							<i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
						{/if}
					</button>
					<button
						type="button"
						onclick={goToOtpStep}
						class="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-6 py-2.5 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600"
					>
						<i class="fa-solid fa-arrow-left" aria-hidden="true"></i> Kembali ke kode OTP
					</button>
				</form>
			{/if}

			<p class="mt-4 text-center text-xs text-slate-500">
				Belum menerima kode?
				<a
					href="/lupa-password"
					class="ml-1 rounded font-bold text-blue-600 hover:text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-blue-600"
				>
					Minta ulang di sini
				</a>
			</p>
		</div>
	{/if}
</div>
