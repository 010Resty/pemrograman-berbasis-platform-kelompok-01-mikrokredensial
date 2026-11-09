<script lang="ts">
	import { goto } from '$app/navigation';
	import '../../app.css';
	import Logo from '$lib/components/Logo.svelte';
	import { requestPasswordReset } from '$lib/stores/auth.svelte';

	let email = $state('');
	let isLoading = $state(false);
	let errorMessage = $state('');

	/**
	 * Jejak permintaan kode (bukan kode itu sendiri): email + waktu minta +
	 * umur kode dari server. Dipakai halaman reset untuk hitung mundur
	 * kedaluwarsa. Tidak ada rahasia di sini.
	 */
	function recordResetRequest(forEmail: string, expiresInSeconds: number): void {
		try {
			sessionStorage.setItem(
				'aristoteles:reset-otp-req:v1',
				JSON.stringify({ email: forEmail.trim(), at: Date.now(), expiresIn: expiresInSeconds })
			);
		} catch {
			// Penyimpanan diblokir — halaman reset tampil tanpa hitung mundur.
		}
	}

	async function handleSubmit(event: Event): Promise<void> {
		event.preventDefault();
		errorMessage = '';
		if (!email.trim()) {
			errorMessage = 'Masukkan alamat email akun Anda.';
			return;
		}
		isLoading = true;
		try {
			const result = await requestPasswordReset(email);
			if (!result.ok) {
				// Hanya gagal bila backend/jaringan bermasalah (bukan karena email tak dikenal).
				errorMessage = result.error;
				return;
			}
			// Selalu lanjut ke reset demi tidak membocorkan daftar email terdaftar.
			// Fallback 600 dtk bila backend lama belum mengirim umur kode.
			recordResetRequest(email, result.expiresInSeconds ?? 600);
			await goto(`/reset-password?email=${encodeURIComponent(email.trim())}`);
		} finally {
			isLoading = false;
		}
	}
</script>

<svelte:head>
	<title>Lupa Password — ARISTOTELES</title>
	<meta
		name="description"
		content="Minta kode OTP untuk mengatur ulang kata sandi akun ARISTOTELES Anda."
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
				<i class="fa-solid fa-key"></i>
			</span>
			<h1 class="mt-3 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">Lupa Password</h1>
			<p class="mt-1 text-xs text-slate-500 sm:text-sm">
				Masukkan email akun Anda. Jika email terdaftar, kode OTP 6 digit akan dikirim ke sana.
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
				<label for="forgot-email" class="mb-1.5 block text-sm font-semibold text-slate-700">
					Email akun
				</label>
				<div class="relative">
					<div
						class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400"
					>
						<i class="fa-solid fa-envelope" aria-hidden="true"></i>
					</div>
					<input
						id="forgot-email"
						name="email"
						type="email"
						autocomplete="email"
						placeholder="email@anda.com"
						bind:value={email}
						class="w-full rounded-xl border border-slate-200 bg-white py-2.5 pr-4 pl-11 text-sm text-slate-800 transition-all placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
					/>
				</div>
			</div>
			<button
				type="submit"
				disabled={isLoading}
				class="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/25 transition-all duration-200 hover:bg-blue-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-blue-400"
			>
				{#if isLoading}
					<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i>
					<span>Mengirim...</span>
				{:else}
					<span>Kirim Kode OTP</span>
					<i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
				{/if}
			</button>
		</form>

		<p class="mt-4 text-center text-xs text-slate-500">
			Ingat kata sandi?
			<a
				href="/login"
				class="ml-1 rounded font-bold text-blue-600 hover:text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-blue-600"
			>
				Kembali masuk
			</a>
		</p>
	</div>
</div>
