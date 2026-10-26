<script lang="ts">
	import { goto } from '$app/navigation';
	import '../../app.css';
	import Logo from '$lib/components/Logo.svelte';
	import { homeFor, register as registerSession, type Role } from '$lib/stores/auth.svelte';

	let showPassword = $state(false);
	let showConfirmPassword = $state(false);
	let fullName = $state('');
	let email = $state('');
	let password = $state('');
	let confirmPassword = $state('');
	let role = $state<Exclude<Role, 'admin'>>('student');
	let agreeTerms = $state(false);
	let isLoading = $state(false);
	let errorMessage = $state('');

	let passwordStrength = $state(0);
	let passwordStrengthLabel = $state('');
	let passwordStrengthColor = $state('bg-slate-300');

	function togglePassword() {
		showPassword = !showPassword;
	}

	function toggleConfirmPassword() {
		showConfirmPassword = !showConfirmPassword;
	}

	function calculatePasswordStrength(pw: string) {
		let strength = 0;
		if (pw.length >= 8) strength += 1;
		if (/[A-Z]/.test(pw) && /[0-9]/.test(pw)) strength += 1;
		if (/[^A-Za-z0-9]/.test(pw)) strength += 1;

		passwordStrength = strength;

		if (strength === 0) {
			passwordStrengthLabel = pw.length > 0 ? 'Sangat Lemah' : '';
			passwordStrengthColor = 'bg-red-500';
		} else if (strength === 1) {
			passwordStrengthLabel = 'Cukup';
			passwordStrengthColor = 'bg-amber-500';
		} else if (strength === 2) {
			passwordStrengthLabel = 'Kuat';
			passwordStrengthColor = 'bg-blue-500';
		} else {
			passwordStrengthLabel = 'Sangat Aman';
			passwordStrengthColor = 'bg-green-500';
		}
	}

	function handlePasswordInput(event: Event) {
		const value = (event.target as HTMLInputElement).value;
		password = value;
		calculatePasswordStrength(value);
	}

	function handleSubmit(event: Event) {
		event.preventDefault();
		errorMessage = '';
		if (role === 'teacher') {
			errorMessage =
				'Pendaftaran mandiri untuk Teacher belum tersedia. Akun instruktur hanya dapat dibuat melalui undangan admin.';
			return;
		}
		if (!fullName.trim() || !email.trim()) {
			errorMessage = 'Nama lengkap dan email wajib diisi.';
			return;
		}
		if (!agreeTerms) {
			errorMessage = 'Anda harus menyetujui Syarat & Ketentuan.';
			return;
		}
		if (password !== confirmPassword) {
			errorMessage = 'Kata sandi tidak cocok.';
			return;
		}
		if (password.length < 7) {
			errorMessage = 'Kata sandi minimal 7 karakter.';
			return;
		}
		isLoading = true;
		setTimeout(() => {
			isLoading = false;
			const user = registerSession(fullName, email, role, true);
			goto(homeFor(user.role));
		}, 900);
	}
</script>

<!-- Register satu viewport penuh: h-dvh + overflow-hidden, halaman tidak bisa di-scroll -->
<div class="flex h-dvh flex-col overflow-hidden bg-slate-50 lg:flex-row">
	<!-- Left Panel: Branding & Info -->
	<div
		class="relative hidden min-h-0 overflow-hidden bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 lg:flex lg:w-1/2 xl:w-3/5"
	>
		<!-- Background Pattern -->
		<div class="absolute inset-0 opacity-10" aria-hidden="true">
			<div
				class="absolute inset-0"
				style="background-image: url('data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.4\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E');"
			></div>
		</div>

		<!-- Decorative Circles -->
		<div
			class="absolute -top-24 -right-24 w-96 h-96 bg-cyan-400/20 rounded-full blur-3xl"
			aria-hidden="true"
		></div>
		<div
			class="absolute -bottom-32 -left-32 w-[500px] h-[500px] bg-blue-400/20 rounded-full blur-3xl"
			aria-hidden="true"
		></div>

		<!-- Content -->
		<div class="relative z-10 flex min-h-0 w-full flex-col justify-between gap-6 p-8 xl:p-10">
			<!-- Logo & Branding -->
			<Logo size="md" showText={true} textSize="lg" dark={true} />

			<!-- Center Content -->
			<div class="flex min-h-0 flex-col justify-center">
				<!-- Badge -->
				<div
					class="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm text-cyan-300 px-3 py-1.5 rounded-full text-xs font-semibold mb-3 w-fit border border-white/10"
				>
					<i class="fa-solid fa-user-plus" aria-hidden="true"></i>
					Bergabung dengan Kami
				</div>

				<!-- Heading -->
				<h2 class="text-3xl xl:text-4xl font-bold text-white leading-tight mb-3">
					Mulai Perjalanan<br />
					<span class="text-cyan-400">Akademik Anda</span>
				</h2>

				<!-- Description -->
				<p class="text-blue-100 text-sm leading-relaxed mb-5 max-w-md">
					Daftarkan diri Anda dan bergabung dengan ribuan mahasiswa yang telah meraih sertifikat
					kompetensi industri terverifikasi.
				</p>

				<!-- Benefits List -->
				<div class="space-y-2.5">
					<div class="flex items-center gap-3 text-white/90">
						<div
							class="w-8 h-8 bg-white/10 backdrop-blur-sm rounded-lg flex items-center justify-center border border-white/10 shrink-0"
						>
							<i class="fa-solid fa-rocket text-cyan-400 text-sm" aria-hidden="true"></i>
						</div>

						<span class="text-sm font-medium"> Akses 120+ Modul Standar Industri </span>
					</div>

					<div class="flex items-center gap-3 text-white/90">
						<div
							class="w-8 h-8 bg-white/10 backdrop-blur-sm rounded-lg flex items-center justify-center border border-white/10 shrink-0"
						>
							<i class="fa-solid fa-certificate text-cyan-400 text-sm" aria-hidden="true"></i>
						</div>

						<span class="text-sm font-medium"> Sertifikat Terverifikasi & Terakreditasi </span>
					</div>

					<div class="flex items-center gap-3 text-white/90">
						<div
							class="w-8 h-8 bg-white/10 backdrop-blur-sm rounded-lg flex items-center justify-center border border-white/10 shrink-0"
						>
							<i class="fa-solid fa-handshake text-cyan-400 text-sm" aria-hidden="true"></i>
						</div>

						<span class="text-sm font-medium"> Koneksi dengan 80+ Mitra Perekrut </span>
					</div>
				</div>
			</div>

			<!-- Bottom Stats -->
			<div class="grid grid-cols-3 gap-4 pt-5 border-t border-white/10">
				<div>
					<div class="text-xl font-bold text-white">45.000+</div>
					<div class="text-blue-200 text-xs">Mahasiswa Aktif</div>
				</div>

				<div>
					<div class="text-xl font-bold text-white">98.4%</div>
					<div class="text-blue-200 text-xs">Tingkat Kelulusan</div>
				</div>

				<div>
					<div class="text-xl font-bold text-white">4.8/5</div>
					<div class="text-blue-200 text-xs">Rating Platform</div>
				</div>
			</div>
		</div>
	</div>

	<!-- Right Panel: Register Form (tanpa card, form menempel langsung pada background) -->
	<div
		class="flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-slate-50 p-4 sm:p-6 lg:w-1/2 lg:p-8 xl:w-2/5"
	>
		<div class="flex max-h-full min-h-0 w-full max-w-md flex-col">
			<!-- Mobile Logo (visible only on small screens) -->
			<div class="mb-4 flex items-center justify-center gap-3 lg:hidden">
				<Logo size="lg" showText={true} textSize="lg" />
			</div>

			<div class="min-h-0 shrink p-6 sm:p-7">
				<!-- Header -->
				<div class="mb-5">
					<div
						class="mb-3 inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700"
					>
						<i class="fa-solid fa-user-plus" aria-hidden="true"></i> Pendaftaran Portal {role ===
						'teacher'
							? 'Teacher'
							: 'Student'}
					</div>
					<h2 class="mb-1 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
						Buat Akun Baru
					</h2>
					<p class="text-xs text-slate-500 sm:text-sm">
						Daftarkan diri Anda untuk mulai belajar dan meraih sertifikat kompetensi.
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
					<!-- Pilih Portal -->
					<div>
						<span class="mb-1.5 block text-sm font-semibold text-slate-700" id="role-label">
							Daftar sebagai <span class="text-red-500">*</span>
						</span>
						<div class="grid grid-cols-2 gap-2" role="radiogroup" aria-labelledby="role-label">
							<button
								type="button"
								role="radio"
								aria-checked={role === 'student'}
								onclick={() => (role = 'student')}
								class={`flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-left transition-all focus-visible:outline-2 focus-visible:outline-blue-600 ${role === 'student' ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500/20' : 'border-slate-200 bg-white hover:border-slate-300'}`}
							>
								<i class="fa-solid fa-user-graduate text-blue-600" aria-hidden="true"></i>
								<span>
									<span class="block text-xs font-bold text-slate-800">Student</span>
									<span class="block text-[11px] text-slate-500">Belajar & sertifikasi</span>
								</span>
							</button>
							<button
								type="button"
								role="radio"
								aria-checked={role === 'teacher'}
								onclick={() => (role = 'teacher')}
								class={`flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-left transition-all focus-visible:outline-2 focus-visible:outline-emerald-600 ${role === 'teacher' ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/20' : 'border-slate-200 bg-white hover:border-slate-300'}`}
							>
								<i class="fa-solid fa-chalkboard-user text-emerald-600" aria-hidden="true"></i>
								<span>
									<span class="block text-xs font-bold text-slate-800">Teacher</span>
									<span class="block text-[11px] text-slate-500">Mengajar & menilai</span>
								</span>
							</button>
						</div>
						{#if role === 'teacher'}
							<p role="note" class="mt-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-800">
								Akun Teacher memerlukan undangan admin. Minta admin mengirim undangan ke email
								Anda, lalu buka tautan aktivasinya. Pendaftaran mandiri untuk Teacher belum
								tersedia.
							</p>
						{/if}
						<p class="mt-1.5 text-[11px] text-slate-500">
							Akun Administrator hanya dibuat oleh admin melalui portal admin.
						</p>
					</div>
					<!-- Full Name -->
					<div>
						<label for="full-name" class="mb-1.5 block text-sm font-semibold text-slate-700">
							Nama Lengkap <span class="text-red-500">*</span>
						</label>
						<div class="relative">
							<div
								class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400"
							>
								<i class="fa-solid fa-user" aria-hidden="true"></i>
							</div>
							<input
								id="full-name"
								name="fullName"
								type="text"
								autocomplete="name"
								placeholder="cth. Rian Pratama"
								bind:value={fullName}
								class="w-full rounded-xl border border-slate-200 bg-white py-2.5 pr-4 pl-11 text-sm text-slate-800 transition-all placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
							/>
						</div>
					</div>

					<!-- Email -->
					<div>
						<label for="reg-email" class="mb-1.5 block text-sm font-semibold text-slate-700">
							Email <span class="text-red-500">*</span>
						</label>
						<div class="relative">
							<div
								class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400"
							>
								<i class="fa-solid fa-envelope" aria-hidden="true"></i>
							</div>
							<input
								id="reg-email"
								name="email"
								type="email"
								autocomplete="email"
								placeholder="email@anda.com"
								bind:value={email}
								class="w-full rounded-xl border border-slate-200 bg-white py-2.5 pr-4 pl-11 text-sm text-slate-800 transition-all placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
							/>
						</div>
					</div>

					<!-- Password -->
					<div>
						<label for="reg-password" class="mb-1.5 block text-sm font-semibold text-slate-700">
							Kata Sandi <span class="text-red-500">*</span>
						</label>
						<div class="relative">
							<div
								class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400"
							>
								<i class="fa-solid fa-lock" aria-hidden="true"></i>
							</div>
							<input
								id="reg-password"
								name="password"
								type={showPassword ? 'text' : 'password'}
								autocomplete="new-password"
								placeholder="Kombinasi kata sandi kuat"
								bind:value={password}
								oninput={handlePasswordInput}
								class="w-full rounded-xl border border-slate-200 bg-white py-2.5 pr-12 pl-11 text-sm text-slate-800 transition-all placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
							/>
							<button
								type="button"
								aria-label="Tampilkan atau sembunyikan kata sandi"
								onclick={togglePassword}
								class="absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400 transition-colors hover:text-slate-600 focus-visible:outline-2 focus-visible:outline-blue-600"
							>
								<i class="fa-solid {showPassword ? 'fa-eye-slash' : 'fa-eye'}" aria-hidden="true"
								></i>
							</button>
						</div>

						<!-- Password Strength Meter (ringkas) -->
						{#if password.length > 0}
							<div
								class="mt-2 rounded-xl border border-slate-100 bg-slate-50 p-2.5"
								role="status"
								aria-live="polite"
							>
								<div class="mb-1.5 flex items-center justify-between">
									<span class="text-[11px] font-semibold text-slate-500">Kekuatan sandi</span>
									<span class="text-[11px] font-bold text-blue-600">{passwordStrengthLabel}</span>
								</div>
								<div class="h-1.5 overflow-hidden rounded-full bg-slate-200">
									<div
										class="h-full {passwordStrengthColor} rounded-full transition-all duration-300"
										style="width: {passwordStrength === 0 ? '10' : passwordStrength * 33}%"
									></div>
								</div>
							</div>
						{/if}
					</div>

					<!-- Confirm Password -->
					<div>
						<label for="confirm-password" class="mb-1.5 block text-sm font-semibold text-slate-700">
							Konfirmasi Kata Sandi <span class="text-red-500">*</span>
						</label>
						<div class="relative">
							<div
								class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400"
							>
								<i class="fa-solid fa-lock" aria-hidden="true"></i>
							</div>
							<input
								id="confirm-password"
								name="confirmPassword"
								type={showConfirmPassword ? 'text' : 'password'}
								autocomplete="new-password"
								placeholder="Ulangi kata sandi Anda"
								bind:value={confirmPassword}
								class="w-full rounded-xl border border-slate-200 bg-white py-2.5 pr-12 pl-11 text-sm text-slate-800 transition-all placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
							/>
							<button
								type="button"
								aria-label="Tampilkan atau sembunyikan kata sandi"
								onclick={toggleConfirmPassword}
								class="absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400 transition-colors hover:text-slate-600 focus-visible:outline-2 focus-visible:outline-blue-600"
							>
								<i
									class="fa-solid {showConfirmPassword ? 'fa-eye-slash' : 'fa-eye'}"
									aria-hidden="true"
								></i>
							</button>
						</div>
						{#if confirmPassword.length > 0 && password !== confirmPassword}
							<p
								role="alert"
								class="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-red-500"
							>
								<i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i>
								<span>Kata sandi tidak cocok.</span>
							</p>
						{/if}
					</div>

					<!-- Terms Checkbox -->
					<div>
						<label class="flex cursor-pointer items-start gap-2.5 select-none" for="terms-checkbox">
							<input
								id="terms-checkbox"
								name="terms"
								type="checkbox"
								bind:checked={agreeTerms}
								class="mt-0.5 h-4 w-4 cursor-pointer rounded border-slate-300 text-blue-600 focus:ring-blue-500/20"
							/>
							<span class="text-xs leading-snug text-slate-600">
								Saya menyetujui <a
									href="/with_UNIRA"
									class="font-medium text-blue-600 hover:underline">Syarat &amp; Ketentuan</a
								>
								serta
								<a href="/with_UNIRA" class="font-medium text-blue-600 hover:underline"
									>Kebijakan Privasi</a
								> Aristoteles.
							</span>
						</label>
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
							<span>Daftar Akun Sekarang</span>
							<i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
						{/if}
					</button>

					<!-- Divider -->
					<div class="relative flex items-center py-1">
						<div class="grow border-t border-slate-200"></div>
						<span class="mx-4 shrink text-xs font-semibold tracking-wider text-slate-400 uppercase"
							>atau</span
						>
						<div class="grow border-t border-slate-200"></div>
					</div>

					<!-- SSO Button -->
					<a
						href="/with_UNIRA"
						class="flex w-full items-center justify-center gap-2.5 rounded-xl border border-slate-200 bg-white px-6 py-2.5 text-sm font-semibold text-slate-700 transition-all duration-200 hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-blue-600"
					>
						<i class="fa-brands fa-google text-red-500" aria-hidden="true"></i>
						<span>Daftar dengan UNIRA</span>
					</a>
				</form>

				<!-- Sudah memiliki akun -->
				<p class="mt-4 text-center text-xs text-slate-600">
					Sudah memiliki akun?
					<a
						href="/login"
						class="ml-1 rounded font-bold text-blue-600 hover:text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-blue-600"
					>
						Masuk di sini
					</a>
				</p>
			</div>

			<!-- Back to Home -->
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
