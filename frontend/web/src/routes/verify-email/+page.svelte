<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import '../../app.css';
	import Logo from '$lib/components/Logo.svelte';
	import OtpInput from '$lib/components/OtpInput.svelte';
	import {
		homeFor,
		resendVerificationCode,
		verifyEmailWithBackend
	} from '$lib/stores/auth.svelte';

	let email = $state('');
	let code = $state('');
	let isLoading = $state(false);
	let isResending = $state(false);
	let errorMessage = $state('');
	let cooldown = $state(60);
	let cooldownTimer: ReturnType<typeof setInterval> | null = null;

	// Sinkronkan bila user datang dengan ?email= setelah state dibuat.
	$effect(() => {
		const q = page.url.searchParams.get('email');
		if (q && !email) email = q;
	});

	function startCooldown(seconds: number): void {
		if (cooldownTimer) clearInterval(cooldownTimer);
		cooldown = Math.max(0, seconds);
		if (cooldown <= 0) return;
		cooldownTimer = setInterval(() => {
			cooldown -= 1;
			if (cooldown <= 0 && cooldownTimer) {
				clearInterval(cooldownTimer);
				cooldownTimer = null;
			}
		}, 1000);
	}

	$effect(() => {
		startCooldown(60);
		return () => {
			if (cooldownTimer) clearInterval(cooldownTimer);
		};
	});

	async function handleSubmit(event: Event): Promise<void> {
		event.preventDefault();
		errorMessage = '';
		if (!email.trim()) {
			errorMessage = 'Email wajib diisi.';
			return;
		}
		if (code.trim().length !== 6) {
			errorMessage = 'Masukkan 6 digit kode OTP yang dikirim ke email Anda.';
			return;
		}
		isLoading = true;
		try {
			const result = await verifyEmailWithBackend(email, code, true);
			if (!result.ok) {
				errorMessage = result.error;
				return;
			}
			// Sukses = akun dibuat server + sesi diterbitkan. Langsung ke portal peran.
			await goto(homeFor(result.user.role));
		} finally {
			isLoading = false;
		}
	}

	async function handleResend(): Promise<void> {
		if (cooldown > 0 || isResending) return;
		errorMessage = '';
		if (!email.trim()) {
			errorMessage = 'Isi email terlebih dahulu untuk mengirim ulang kode.';
			return;
		}
		isResending = true;
		try {
			const result = await resendVerificationCode(email);
			if (!result.ok) {
				errorMessage = result.error;
				return;
			}
			code = '';
			startCooldown(result.resendCooldownSeconds || 60);
		} finally {
			isResending = false;
		}
	}
</script>

<svelte:head>
	<title>Verifikasi Email — ARISTOTELES</title>
	<meta
		name="description"
		content="Masukkan kode OTP 6 digit untuk memverifikasi email dan mengaktifkan akun ARISTOTELES."
	/>
	<meta name="robots" content="noindex,nofollow" />
</svelte:head>

<div class="flex min-h-dvh flex-col items-center justify-center bg-slate-50 p-4 sm:p-6">
	<div class="mb-5">
		<Logo size="lg" showText={true} textSize="lg" />
	</div>
	<div class="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-900/5 sm:p-8">
		<div class="mb-5 text-center">
			<span
				class="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-lg text-blue-600"
				aria-hidden="true"
			>
				<i class="fa-solid fa-envelope-circle-check"></i>
			</span>
			<h1 class="mt-3 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
				Verifikasi Email
			</h1>
			<p class="mt-1 text-xs text-slate-500 sm:text-sm">
				Kode OTP 6 digit dikirim ke email Anda. Akun dibuat setelah kode ini diverifikasi.
			</p>
		</div>

		<form class="space-y-4" onsubmit={handleSubmit} novalidate>
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
				<label for="verify-email" class="mb-1.5 block text-sm font-semibold text-slate-700">
					Email
				</label>
				<input
					id="verify-email"
					name="email"
					type="email"
					autocomplete="email"
					placeholder="email@anda.com"
					bind:value={email}
					class="w-full rounded-xl border border-slate-200 bg-white py-2.5 pr-4 pl-4 text-sm text-slate-800 transition-all placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
				/>
			</div>
			<OtpInput bind:value={code} disabled={isLoading} />
			<button
				type="submit"
				disabled={isLoading}
				class="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/25 transition-all duration-200 hover:bg-blue-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-blue-400"
			>
				{#if isLoading}
					<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i>
					<span>Memverifikasi...</span>
				{:else}
					<span>Verifikasi & Aktifkan Akun</span>
					<i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
				{/if}
			</button>
		</form>

		<div class="mt-4 text-center text-xs text-slate-500">
			{#if cooldown > 0}
				<span role="timer">Kirim ulang kode dalam {cooldown} detik.</span>
			{:else}
				<button
					type="button"
					onclick={handleResend}
					disabled={isResending}
					class="rounded font-bold text-blue-600 hover:text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
				>
					{#if isResending}
						<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i> Mengirim...
					{:else}
						Kirim ulang kode
					{/if}
				</button>
			{/if}
		</div>

		<p class="mt-4 text-center text-xs text-slate-500">
			Salah alamat email?
			<a
				href="/register"
				class="ml-1 rounded font-bold text-blue-600 hover:text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-blue-600"
			>
				Kembali ke pendaftaran
			</a>
		</p>
	</div>
</div>
