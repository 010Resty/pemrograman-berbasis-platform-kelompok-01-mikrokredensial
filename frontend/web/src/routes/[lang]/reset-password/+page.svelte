<script lang="ts">
	import { page } from '$app/state';
	import Logo from '$lib/components/Logo.svelte';
	import OtpInput from '$lib/components/OtpInput.svelte';
	import { requestPasswordReset, resetPasswordWithBackend, verifyResetCodeWithBackend } from '$lib/stores/auth.svelte';
	import { toast } from '$lib/stores/toast.svelte';
	import { lp, type Locale } from '$lib/i18n/locale';
	import { t } from '$lib/i18n/index';

	const lang: Locale = $derived(page.params.lang === 'en' ? 'en' : 'id');

	type Step = 'otp' | 'password';

	let email = $state('');
	let code = $state('');
	/** Kode yang SUDAH lolos verifikasi server. Layar password hanya untuk nilai ini. */
	let verifiedCode = $state('');
	let newPassword = $state('');
	let confirmPassword = $state('');
	let showPassword = $state(false);
	let step = $state<Step>('otp');
	let isLoading = $state(false);
	let isVerifying = $state(false);
	let errorMessage = $state('');
	let isDone = $state(false);
	/** Panel khusus kode salah/kedaluwarsa — terpisah dari banner error umum. */
	let otpFailed = $state(false);
	let otpFailMessage = $state('');
	/** Gagal simpan beruntun (anti-brute-force sisi UI; backend tetap otoritas). */
	let failCount = $state(0);
	const MAX_FAILS = 5;
	/**
	 * Batas UI persisten per email (sessionStorage, TTL 10 menit mengikuti
	 * umur OTP backend). Refresh tidak me-reset friksi; backend tetap yang
	 * mengikat. Disimpan hanya hitungan + email, bukan kode/password.
	 */
	const FAIL_KEY = 'aristoteles:reset-fails:v1';
	const FAIL_TTL_MS = 10 * 60 * 1000;
	function readFailStore(forEmail: string): number {
		if (typeof window === 'undefined') return 0;
		try {
			const raw = sessionStorage.getItem(FAIL_KEY);
			if (!raw) return 0;
			const p = JSON.parse(raw) as { email?: unknown; count?: unknown; at?: unknown };
			if (typeof p.email !== 'string' || typeof p.count !== 'number' || typeof p.at !== 'number')
				return 0;
			if (p.email.trim().toLowerCase() !== forEmail.trim().toLowerCase()) return 0;
			if (!Number.isFinite(p.count) || p.count <= 0) return 0;
			if (Date.now() - p.at > FAIL_TTL_MS) {
				sessionStorage.removeItem(FAIL_KEY);
				return 0;
			}
			return Math.min(Math.floor(p.count), MAX_FAILS);
		} catch {
			return 0;
		}
	}
	function writeFailStore(forEmail: string, count: number): void {
		if (typeof window === 'undefined') return;
		try {
			if (count <= 0 || !forEmail.trim()) {
				sessionStorage.removeItem(FAIL_KEY);
				return;
			}
			sessionStorage.setItem(
				FAIL_KEY,
				JSON.stringify({ email: forEmail.trim(), count, at: Date.now() })
			);
		} catch {
			// Penyimpanan diblokir — friksi UI hilang, proteksi backend tetap jalan.
		}
	}

	// ---------- Hitung mundur kedaluwarsa + kirim ulang ----------
	const REQ_KEY = 'aristoteles:reset-otp-req:v1';
	let otpDeadline = $state(0);
	let otpValidityMin = $state(10);
	let nowTick = $state(Date.now());
	let resendNote = $state('');
	let isResending = $state(false);
	let resendCooldownUntil = $state(0);
	let expiredShown = $state(false);

	function readReqStore(forEmail: string): { deadline: number; minutes: number } | null {
		if (typeof window === 'undefined') return null;
		try {
			const raw = sessionStorage.getItem(REQ_KEY);
			if (!raw) return null;
			const p = JSON.parse(raw) as { email?: unknown; at?: unknown; expiresIn?: unknown };
			if (typeof p.email !== 'string' || typeof p.at !== 'number' || typeof p.expiresIn !== 'number')
				return null;
			if (p.email.trim().toLowerCase() !== forEmail.trim().toLowerCase()) return null;
			if (!Number.isFinite(p.at) || !Number.isFinite(p.expiresIn) || p.expiresIn <= 0) return null;
			return {
				deadline: p.at + p.expiresIn * 1000,
				minutes: Math.max(1, Math.round(p.expiresIn / 60))
			};
		} catch {
			return null;
		}
	}
	function writeReqStore(forEmail: string, expiresInSeconds: number): void {
		if (typeof window === 'undefined') return;
		try {
			sessionStorage.setItem(
				REQ_KEY,
				JSON.stringify({ email: forEmail.trim(), at: Date.now(), expiresIn: expiresInSeconds })
			);
		} catch {
			// Penyimpanan diblokir — halaman tampil tanpa hitung mundur.
		}
	}

	// Detak tiap detik untuk hitung mundur.
	$effect(() => {
		if (typeof window === 'undefined') return;
		const id = setInterval(() => {
			nowTick = Date.now();
		}, 1000);
		return () => clearInterval(id);
	});

	// Muat tenggat kode untuk email ini (dicatat halaman lupa-password).
	$effect(() => {
		const em = email.trim();
		if (!isValidEmail(em)) return;
		const stored = readReqStore(em);
		if (stored && stored.deadline > 0) {
			otpDeadline = stored.deadline;
			otpValidityMin = stored.minutes;
		}
	});

	const remainingSec = $derived(
		otpDeadline > 0 ? Math.max(0, Math.round((otpDeadline - nowTick) / 1000)) : -1
	);
	/** True bila kode dipastikan sudah lewat masa berlaku. */
	const otpExpired = $derived(otpDeadline > 0 && remainingSec <= 0);
	function formatCountdown(totalSec: number): string {
		const m = Math.floor(totalSec / 60);
		const s = totalSec % 60;
		return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
	}
	const resendCooldownSec = $derived(
		Math.max(0, Math.ceil((resendCooldownUntil - nowTick) / 1000))
	);

	// Waktu habis saat di layar OTP → alihkan ke panel kirim ulang.
	$effect(() => {
		if (!otpExpired || isDone || otpFailed || step !== 'otp' || expiredShown) return;
		expiredShown = true;
		code = '';
		verifiedCode = '';
		window.scrollTo({ top: 0 });
	});

	/** Kirim ulang kode: server menerbitkan kode baru (kode lama hangus). */
	async function resendCode(): Promise<void> {
		errorMessage = '';
		resendNote = '';
		if (isResending || Date.now() < resendCooldownUntil) return;
		if (!isValidEmail(email)) {
			errorMessage = t(lang, 'reset.errEmail');
			toast.error(errorMessage);
			return;
		}
		isResending = true;
		try {
			const result = await requestPasswordReset(email);
			if (!result.ok) {
				errorMessage = result.error;
				toast.error(errorMessage);
				return;
			}
			writeReqStore(email, result.expiresInSeconds ?? 600);
			otpDeadline = Date.now() + (result.expiresInSeconds ?? 600) * 1000;
			otpValidityMin = Math.max(1, Math.round((result.expiresInSeconds ?? 600) / 60));
			resendCooldownUntil = Date.now() + (result.resendCooldownSeconds || 60) * 1000;
			writeFailStore(email, 0);
			failCount = 0;
			code = '';
			verifiedCode = '';
			otpFailed = false;
			otpFailMessage = '';
			expiredShown = false;
			step = 'otp';
			resendNote = t(lang, 'reset.newCodeSent', { email: email.trim() });
			window.scrollTo({ top: 0 });
		} finally {
			isResending = false;
		}
	}

	const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	function isValidEmail(value: string): boolean {
		const v = value.trim();
		return v.length > 0 && v.length <= 191 && EMAIL_RE.test(v);
	}
	function isValidCode(value: string): boolean {
		return /^\d{6}$/.test(value.trim());
	}
	function isOtpError(message: string): boolean {
		// Hanya kegagalan kode (backend: "Kode salah atau kedaluwarsa.").
		// Jangan samakan dengan error validasi umum agar masalah password
		// tidak disangka kode salah.
		return /kode|otp|kedaluwarsa/i.test(message);
	}

	// Email dari ?email= (dikirim halaman lupa-password) langsung dikunci dan
	// ditampilkan sebagai teks — bukan di dalam kotak input. Kunci hanya bila
	// formatnya valid; tautan rusak tetap bisa dikoreksi manual.
	const rawQueryEmail = $derived((page.url.searchParams.get('email') ?? '').trim());
	const queryEmail = $derived(isValidEmail(rawQueryEmail) ? rawQueryEmail : '');
	const queryEmailBroken = $derived(rawQueryEmail.length > 0 && queryEmail.length === 0);
	const isEmailLocked = $derived(queryEmail.length > 0);

	$effect(() => {
		if (queryEmail && !email) email = queryEmail;
	});

	// Pulihkan hitungan gagal untuk email ini (refresh tidak me-reset batas).
	// Dijaga sekali per email agar tidak menimpa hitungan sesi berjalan.
	let restoredFor = $state('');
	$effect(() => {
		const em = email.trim().toLowerCase();
		if (!isValidEmail(em) || em === restoredFor) return;
		restoredFor = em;
		const saved = readFailStore(em);
		if (saved <= 0) return;
		failCount = saved;
		if (failCount >= MAX_FAILS) {
			otpFailMessage = t(lang, 'reset.errLockedOut');
			otpFailed = true;
			code = '';
		}
	});

	// Klik "minta kode baru" = kode lama hangus diganti server (attempts
	// backend di-reset), jadi hitungan UI ikut dibuang.
	function requestNewCode(): void {
		writeFailStore(email, 0);
		failCount = 0;
	}

	function retryCode(): void {
		otpFailed = false;
		otpFailMessage = '';
		errorMessage = '';
		code = '';
		verifiedCode = '';
		step = 'otp';
		window.scrollTo({ top: 0 });
	}

	async function goToPasswordStep(event: Event): Promise<void> {
		event.preventDefault();
		errorMessage = '';
		if (failCount >= MAX_FAILS) {
			otpFailMessage = t(lang, 'reset.errLockedOut');
			otpFailed = true;
			code = '';
			verifiedCode = '';
			toast.error(otpFailMessage);
			return;
		}
		if (!isValidEmail(email)) {
			errorMessage = queryEmailBroken
				? t(lang, 'reset.errLink')
				: t(lang, 'reset.errLink2');
			toast.error(errorMessage);
			return;
		}
		if (!isValidCode(code)) {
			errorMessage = t(lang, 'reset.errCode');
			toast.error(errorMessage);
			return;
		}
		// Gerbang server: kode dicek ke backend DULU. Salah/kedaluwarsa =
		// tetap di layar OTP, layar password tidak akan pernah terbuka.
		isVerifying = true;
		try {
			const result = await verifyResetCodeWithBackend(email, code);
			if (!result.ok) {
				failCount += 1;
				writeFailStore(email, failCount);
				newPassword = '';
				confirmPassword = '';
				verifiedCode = '';
				if (failCount >= MAX_FAILS) code = '';
				otpFailMessage =
					failCount >= MAX_FAILS
						? t(lang, 'reset.errLockedOut')
						: result.error;
				otpFailed = true;
				toast.error(otpFailMessage);
				return;
			}
			verifiedCode = code.trim();
			step = 'password';
			window.scrollTo({ top: 0 });
		} finally {
			isVerifying = false;
		}
	}

	async function handleSubmit(event: Event): Promise<void> {
		event.preventDefault();
		errorMessage = '';
		if (failCount >= MAX_FAILS) {
			otpFailMessage = t(lang, 'reset.errLockedOut');
			otpFailed = true;
			code = '';
			toast.error(otpFailMessage);
			return;
		}
		if (!isValidEmail(email)) {
			errorMessage = t(lang, 'reset.errEmail');
			toast.error(errorMessage);
			return;
		}
		// Pertahanan berlapis: submit hanya untuk kode yang sudah lolos
		// verifikasi server di langkah OTP. Tanpa ini, tolak dan kunci.
		if (!verifiedCode || verifiedCode !== code.trim()) {
			verifiedCode = '';
			errorMessage = t(lang, 'reset.errUnverified');
			step = 'otp';
			window.scrollTo({ top: 0 });
			toast.error(errorMessage);
			return;
		}
		if (!isValidCode(code)) {
			errorMessage = t(lang, 'reset.errCode');
			toast.error(errorMessage);
			return;
		}
		if (newPassword.length < 8) {
			errorMessage = t(lang, 'reset.errMin');
			toast.error(errorMessage);
			return;
		}
		if (newPassword.length > 72) {
			errorMessage = t(lang, 'reset.errMax');
			toast.error(errorMessage);
			return;
		}
		if (newPassword !== confirmPassword) {
			errorMessage = t(lang, 'reset.errConfirm');
			toast.error(errorMessage);
			return;
		}
		isLoading = true;
		try {
			const result = await resetPasswordWithBackend(email, code, newPassword);
			if (!result.ok) {
				failCount += 1;
				writeFailStore(email, failCount);
				// Hapus password dari memori tiap gagal. Kode yang ditolak
				// server langsung dibuang — user wajib ketik ulang, tidak bisa
				// submit ulang kode salah yang sama dari layar password.
				newPassword = '';
				confirmPassword = '';
				if (failCount >= MAX_FAILS || isOtpError(result.error)) {
					code = '';
					otpFailMessage =
						failCount >= MAX_FAILS
							? 'Terlalu banyak percobaan gagal. Minta kode baru lewat halaman lupa password.'
							: result.error;
					otpFailed = true;
					toast.error(otpFailMessage);
					return;
				}
				errorMessage = result.error;
				toast.error(errorMessage);
				return;
			}
			// Sukses TIDAK auto-login — user wajib masuk ulang dengan password baru.
			// Hapus semua rahasia dari memori agar tidak tertinggal di state browser.
			writeFailStore(email, 0);
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
	<title>{t(lang, 'reset.pageTitle')}</title>
	<meta
		name="description"
		content={t(lang, 'reset.pageDesc')}
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
			class="w-full max-w-md overflow-hidden rounded-2xl border border-emerald-200 bg-white text-center shadow-xl shadow-slate-900/5"
		>
			<div class="h-1.5 bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600" aria-hidden="true"></div>
			<div class="p-6 sm:p-8">
				<span
					class="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-lg text-emerald-600"
					aria-hidden="true"
				>
					<i class="fa-solid fa-check"></i>
				</span>
				<h1 class="mt-3 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
					{t(lang, 'reset.doneTitle')}
				</h1>
				<p class="mt-1 text-xs text-slate-500 sm:text-sm">
					{t(lang, 'reset.doneSub')}
				</p>
				<a
					href={lp(lang, '/login')}
					class="mt-5 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-blue-600 px-8 text-sm font-bold text-white shadow-lg shadow-blue-600/25 transition-all duration-200 hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
				>
					{t(lang, 'reset.doneCta')} <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
				</a>
			</div>
		</div>
	{:else if otpFailed}
		<div
			role="alert"
			class="w-full max-w-md overflow-hidden rounded-2xl border border-red-200 bg-white text-center shadow-xl shadow-slate-900/5"
		>
			<div class="h-1.5 bg-gradient-to-r from-red-500 via-red-600 to-orange-500" aria-hidden="true"></div>
			<div class="p-6 sm:p-8">
				<span
					class="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100 text-2xl text-red-600"
					aria-hidden="true"
				>
					<i class="fa-solid fa-circle-xmark"></i>
				</span>
				<h1 class="mt-4 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
					{t(lang, 'reset.failTitle')}
				</h1>
				<p class="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-slate-500 sm:text-sm">
					{otpFailMessage || t(lang, 'reset.failDefault')}
				</p>
				<p class="mt-3 text-xs text-slate-500">
					{t(lang, 'reset.failFor')} <span class="font-bold text-slate-800">{email || t(lang, 'reset.yourEmail')}</span>
					{#if failCount > 0}
						<span class="mt-1 block font-semibold text-amber-700">
							{t(lang, 'reset.failAttempts', { n: Math.min(failCount, MAX_FAILS), max: MAX_FAILS })}
						</span>
					{/if}
				</p>
				<div class="mt-6 flex flex-col gap-2.5">
					<button
						type="button"
						onclick={retryCode}
						class="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/25 transition-all duration-200 hover:bg-blue-700 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-blue-600"
					>
						<i class="fa-solid fa-rotate-left" aria-hidden="true"></i> {t(lang, 'reset.retryCode')}
					</button>
					<a
						href={lp(lang, '/lupa-password')}
						onclick={requestNewCode}
						class="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-6 py-3 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600"
					>
						<i class="fa-solid fa-paper-plane" aria-hidden="true"></i> {t(lang, 'reset.newCode')}
					</a>
				</div>
			</div>
		</div>
	{:else if otpExpired && step === 'otp'}
		<div
			role="alert"
			class="w-full max-w-md overflow-hidden rounded-2xl border border-amber-200 bg-white text-center shadow-xl shadow-slate-900/5"
		>
			<div class="h-1.5 bg-gradient-to-r from-amber-500 via-orange-500 to-red-500" aria-hidden="true"></div>
			<div class="p-6 sm:p-8">
				<span
					class="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-2xl text-amber-600"
					aria-hidden="true"
				>
					<i class="fa-solid fa-clock-rotate-left"></i>
				</span>
				<h1 class="mt-4 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
					{t(lang, 'reset.expiredTitle')}
				</h1>
				<p class="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-slate-500 sm:text-sm">
					{t(lang, 'reset.expiredFor')} <span class="font-bold text-slate-800">{email || t(lang, 'reset.yourEmail')}</span> {t(lang, 'reset.expiredSub', { min: otpValidityMin })}
				</p>
				{#if errorMessage}
					<p
						role="alert"
						class="mt-4 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-left text-xs font-semibold text-red-700"
					>
						<i class="fa-solid fa-circle-exclamation mt-0.5 shrink-0" aria-hidden="true"></i>
						<span>{errorMessage}</span>
					</p>
				{/if}
				<div class="mt-6 flex flex-col gap-2.5">
					<button
						type="button"
						onclick={resendCode}
						disabled={isResending || resendCooldownSec > 0}
						class="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/25 transition-all duration-200 hover:bg-blue-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-blue-400"
					>
						{#if isResending}
							<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i>
							<span>{t(lang, 'reset.sending')}</span>
						{:else if resendCooldownSec > 0}
							<i class="fa-solid fa-hourglass-half" aria-hidden="true"></i>
							<span>{t(lang, 'reset.resendIn', { n: resendCooldownSec })}</span>
						{:else}
							<i class="fa-solid fa-paper-plane" aria-hidden="true"></i>
							<span>{t(lang, 'reset.resend')}</span>
						{/if}
					</button>
					<a
						href={lp(lang, '/lupa-password')}
						class="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-6 py-3 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600"
					>
						<i class="fa-solid fa-envelope" aria-hidden="true"></i> {t(lang, 'reset.changeEmail')}
					</a>
				</div>
			</div>
		</div>
	{:else}
		<div class="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/5">
			<div class="h-1.5 bg-gradient-to-r from-blue-600 via-sky-500 to-teal-500" aria-hidden="true"></div>
			<div class="p-6 sm:p-8">
				<div class="mb-6 text-center">
					<span
						class="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-lg text-blue-600"
						aria-hidden="true"
					>
						<i class="fa-solid fa-key" aria-hidden="true"></i>
					</span>
					<h1 class="mt-3 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
						{step === 'otp' ? t(lang, 'reset.stepOtp') : t(lang, 'reset.stepPassword')}
					</h1>
					<p class="mt-1 text-xs text-slate-500 sm:text-sm">
						{step === 'otp'
							? t(lang, 'reset.stepOtpSub')
							: t(lang, 'reset.stepPasswordSub')}
					</p>
					{#if isEmailLocked}
						<p class="mt-2 flex flex-wrap items-center justify-center gap-1.5 text-sm">
							<i class="fa-solid fa-envelope text-xs text-slate-400" aria-hidden="true"></i>
							<span class="font-bold break-all text-slate-900">{email}</span>
							<span
								class="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold tracking-wide text-slate-500 uppercase"
							>
								<i class="fa-solid fa-lock text-[9px]" aria-hidden="true"></i> {t(lang, 'reset.locked')}
							</span>
						</p>
						<p class="mt-1.5 text-[11px] text-slate-500">
							{t(lang, 'reset.notYourEmail')}
							<a
								href={lp(lang, '/lupa-password')}
								class="rounded font-bold text-blue-600 hover:text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-blue-600"
							>
								{t(lang, 'reset.requestAgain')}
							</a>
						</p>
					{/if}
				</div>

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
					<form class="space-y-5" onsubmit={goToPasswordStep} novalidate>
						{#if !isEmailLocked}
							<div>
								<label for="reset-email" class="mb-1.5 block text-sm font-semibold text-slate-700">
									{t(lang, 'reset.emailLabel')}
								</label>
								<input
									id="reset-email"
									name="email"
									type="email"
									autocomplete="email"
									placeholder={t(lang, 'reset.emailPh')}
									bind:value={email}
									class="w-full rounded-xl border border-slate-200 bg-white py-2.5 pr-4 pl-4 text-sm text-slate-800 transition-all placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
								/>
								{#if queryEmailBroken}
									<p class="mt-1.5 text-[11px] font-medium text-amber-700">
										{t(lang, 'reset.linkBroken')}
									</p>
								{/if}
							</div>
						{/if}
						<OtpInput bind:value={code} disabled={isLoading || isVerifying} />
						{#if remainingSec >= 0}
							<p
								role="timer"
								aria-label={`${t(lang, 'reset.codeExpiredIn')} ${formatCountdown(remainingSec)}`}
								class="flex items-center justify-center gap-1.5 text-xs font-semibold {remainingSec <= 60
									? 'text-red-600'
									: 'text-slate-500'}"
							>
								<i class="fa-solid fa-clock" aria-hidden="true"></i>
								<span
									>{t(lang, 'reset.codeExpiredIn')}
									<span class="font-mono tabular-nums">{formatCountdown(remainingSec)}</span></span
								>
							</p>
						{:else}
							<p class="text-center text-[11px] text-slate-400">
								{t(lang, 'reset.codeLimited')}
							</p>
						{/if}
						{#if resendNote}
							<p
								role="status"
								class="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-semibold text-emerald-700"
							>
								<i class="fa-solid fa-circle-check mt-0.5 shrink-0" aria-hidden="true"></i>
								<span>{resendNote}</span>
							</p>
						{/if}
						<button
							type="submit"
							disabled={!isValidCode(code) || isVerifying}
							class="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/25 transition-all duration-200 hover:bg-blue-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-blue-400"
						>
							{#if isVerifying}
								<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i>
								<span>{t(lang, 'reset.checking')}</span>
							{:else}
								<span>{t(lang, 'reset.next')}</span>
								<i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
							{/if}
						</button>
					</form>
				{:else}
					<p class="mb-4 text-center text-xs text-slate-500">
						{t(lang, 'reset.resettingFor')} <span class="font-bold text-slate-800">{email}</span>
						<button
							type="button"
							onclick={retryCode}
							class="ml-1 rounded font-bold text-blue-600 hover:text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-blue-600"
						>
							{t(lang, 'reset.changeCode')}
						</button>
					</p>
					<form class="space-y-4" onsubmit={handleSubmit} novalidate>
						<div>
							<label for="reset-password" class="mb-1.5 block text-sm font-semibold text-slate-700">
								{t(lang, 'reset.newPassLabel')}
							</label>
							<div class="relative">
								<input
									id="reset-password"
									name="newPassword"
									type={showPassword ? 'text' : 'password'}
									autocomplete="new-password"
									placeholder={t(lang, 'reset.newPassPh')}
									bind:value={newPassword}
									class="w-full rounded-xl border border-slate-200 bg-white py-2.5 pr-11 pl-4 text-sm text-slate-800 transition-all placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
								/>
								<button
									type="button"
									aria-label={t(lang, 'reset.showHide')}
									onclick={() => (showPassword = !showPassword)}
									class="absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400 transition-colors hover:text-slate-600 focus-visible:outline-2 focus-visible:outline-blue-600"
								>
									<i class="fa-solid {showPassword ? 'fa-eye-slash' : 'fa-eye'}" aria-hidden="true"></i>
								</button>
							</div>
						</div>
						<div>
							<label for="reset-confirm" class="mb-1.5 block text-sm font-semibold text-slate-700">
								{t(lang, 'reset.confirmLabel')}
							</label>
							<input
								id="reset-confirm"
								name="confirmPassword"
								type={showPassword ? 'text' : 'password'}
								autocomplete="new-password"
								placeholder={t(lang, 'reset.confirmPh')}
								bind:value={confirmPassword}
								class="w-full rounded-xl border border-slate-200 bg-white py-2.5 pr-4 pl-4 text-sm text-slate-800 transition-all placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
							/>
						</div>
						{#if confirmPassword.length > 0 && newPassword !== confirmPassword}
							<p role="alert" class="flex items-center gap-1 text-[11px] font-semibold text-red-500">
								<i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i>
								<span>{t(lang, 'reset.mismatch')}</span>
							</p>
						{/if}
						<button
							type="submit"
							disabled={isLoading}
							class="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/25 transition-all duration-200 hover:bg-blue-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-blue-400"
						>
							{#if isLoading}
								<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i>
								<span>{t(lang, 'reset.saving')}</span>
							{:else}
								<span>{t(lang, 'reset.saveNew')}</span>
								<i class="fa-solid fa-check" aria-hidden="true"></i>
							{/if}
						</button>
					</form>
				{/if}

				<p class="mt-5 border-t border-slate-100 pt-4 text-center text-xs text-slate-500">
					{t(lang, 'reset.noCode')}
					<a
						href={lp(lang, '/lupa-password')}
						onclick={requestNewCode}
						class="ml-1 rounded font-bold text-blue-600 hover:text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-blue-600"
					>
						{t(lang, 'reset.requestHere')}
					</a>
				</p>
			</div>
		</div>
	{/if}
</div>
