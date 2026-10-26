<script lang="ts">
	import { browser } from '$app/environment';
	import { page } from '$app/state';
	import {
		acceptInvitation,
		findByToken,
		type InvitationView
	} from '$lib/stores/invitations';

	type State =
		| { kind: 'checking' }
		| { kind: 'valid'; invitation: InvitationView }
		| { kind: 'invalid' }
		| { kind: 'expired' }
		| { kind: 'used' }
		| { kind: 'cancelled' };

	let password = $state('');
	let confirmPassword = $state('');
	let showPw = $state(false);
	let showPw2 = $state(false);
	let errorMessage = $state('');
	let isLoading = $state(false);
	let acceptedEmail = $state('');
	let pwInput: HTMLInputElement | null = $state(null);

	const token = $derived(page.params.token ?? '');

	/* Validasi token hanya di klien terhadap penyimpanan lokal (demo).
	   Backend wajib memvalidasi ulang token, masa berlaku, dan sekali pakai. */
	const inviteState = $derived.by((): State => {
		if (!browser || !token) return { kind: 'checking' };
		const inv = findByToken(token);
		if (!inv) return { kind: 'invalid' };
		if (inv.status === 'Cancelled') return { kind: 'cancelled' };
		if (inv.status === 'Accepted') return { kind: 'used' };
		if (inv.status === 'Expired') return { kind: 'expired' };
		return { kind: 'valid', invitation: inv };
	});

	const done = $derived(acceptedEmail !== '');

	$effect(() => {
		if (inviteState.kind === 'valid' && !done) pwInput?.focus();
	});

	const expiryLabel = $derived.by(() => {
		if (inviteState.kind !== 'valid') return '';
		try {
			return new Date(inviteState.invitation.expiresAt).toLocaleDateString('id-ID', {
				day: 'numeric',
				month: 'long',
				year: 'numeric'
			});
		} catch {
			return '';
		}
	});

	const pwScore = $derived.by(() => {
		let s = 0;
		if (password.length >= 7) s++;
		if (password.length >= 10) s++;
		if (/[A-Z]/.test(password) && /[a-z]/.test(password)) s++;
		if (/\d/.test(password) || /[^A-Za-z0-9]/.test(password)) s++;
		return Math.min(s, 4);
	});

	const pwLabel = $derived(
		password.length === 0
			? ''
			: pwScore <= 1
				? 'Lemah'
				: pwScore === 2
					? 'Cukup'
					: pwScore === 3
						? 'Kuat'
						: 'Sangat kuat'
	);

	function handleSubmit(event: Event) {
		event.preventDefault();
		errorMessage = '';
		if (inviteState.kind !== 'valid') return;
		if (password !== confirmPassword) {
			errorMessage = 'Kata sandi tidak cocok. Periksa kembali kedua kolom.';
			return;
		}
		if (password.length < 7) {
			errorMessage = 'Kata sandi minimal 7 karakter.';
			return;
		}
		isLoading = true;
		// Simulasi lokal: tandai token terpakai TANPA membuat/mengaktifkan akun
		// dan TANPA menyimpan password di mana pun.
		setTimeout(() => {
			isLoading = false;
			const result = acceptInvitation(token);
			password = '';
			confirmPassword = '';
			showPw = false;
			showPw2 = false;
			if (!result.ok) {
				errorMessage =
					result.reason === 'expired'
						? 'Tautan sudah kedaluwarsa. Minta admin mengirim undangan baru.'
						: 'Tautan tidak dapat dipakai. Minta admin memeriksa status undangan.';
				return;
			}
			acceptedEmail = result.invitation.email;
		}, 500);
	}
</script>

<svelte:head>
	<title>Aktivasi Akun Instruktur — Aristoteles</title>
	<meta name="description" content="Halaman aktivasi akun instruktur melalui undangan admin (simulasi lokal)." />
</svelte:head>

<div class="invite-page">
	<div class="invite-glow" aria-hidden="true"></div>
	<div class="invite-grid" aria-hidden="true"></div>

	<main class="invite-shell" aria-labelledby="invite-title">
		<header class="invite-masthead rise" style="--d: 0ms">
			<p class="invite-kicker">
				<i class="fa-solid fa-award" aria-hidden="true"></i>
				<span>Aristoteles &middot; Surat Penunjukan Instruktur</span>
			</p>
			<span class="invite-sim-badge">
				<i class="fa-solid fa-flask" aria-hidden="true"></i>
				<span>Simulasi lokal</span>
			</span>
		</header>

		{#if inviteState.kind === 'checking'}
			<section class="letter rise" style="--d: 80ms" aria-label="Memeriksa undangan">
				<div class="seal" aria-hidden="true"><i class="fa-solid fa-envelope-open-text"></i></div>
				<h1 id="invite-title" class="letter-title">Membuka surat penunjukan&hellip;</h1>
				<p role="status" class="letter-sub">
					<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i>
					Memeriksa keaslian undangan Anda.
				</p>
			</section>
		{:else if inviteState.kind === 'valid' && !done}
			{@const inv = inviteState.invitation}
			<section class="letter rise" style="--d: 80ms" aria-labelledby="invite-title">
				<div class="seal" aria-hidden="true"><i class="fa-solid fa-award"></i></div>
				<p class="letter-eyebrow">Kepada Yth.</p>
				<h1 id="invite-title" class="letter-title">{inv.name}</h1>
				<p class="letter-sub">
					Anda diundang sebagai <strong>Instruktur Aristoteles</strong> untuk alamat
					<strong>{inv.email}</strong>. Buat kata sandi untuk menyelesaikan aktivasi.
				</p>
				{#if expiryLabel}
					<p class="letter-meta">
						<i class="fa-solid fa-hourglass-half" aria-hidden="true"></i>
						<span>Undangan berlaku hingga {expiryLabel}</span>
					</p>
				{/if}

				<ol class="steps" aria-label="Langkah aktivasi">
					<li class="step is-done">
						<span class="step-dot" aria-hidden="true"><i class="fa-solid fa-check"></i></span>
						<span>Undangan diterima</span>
					</li>
					<li class="step is-now" aria-current="step">
						<span class="step-dot" aria-hidden="true">2</span>
						<span>Buat kata sandi</span>
					</li>
					<li class="step">
						<span class="step-dot" aria-hidden="true">3</span>
						<span>Mulai mengajar</span>
					</li>
				</ol>

				<form class="invite-form" onsubmit={handleSubmit} aria-label="Formulir pembuatan kata sandi">
					<div class="field">
						<label for="inv-password">Kata sandi baru</label>
						<div class="pw-wrap">
							<input
								id="inv-password"
								type={showPw ? 'text' : 'password'}
								bind:this={pwInput}
								bind:value={password}
								autocomplete="new-password"
								minlength={7}
								required
								placeholder="Minimal 7 karakter"
								aria-describedby={pwLabel ? 'pw-strength' : undefined}
								aria-invalid={errorMessage ? true : undefined}
							/>
							<button
								type="button"
								onclick={() => (showPw = !showPw)}
								aria-pressed={showPw}
								aria-label={showPw ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
								class="pw-toggle"
							>
								<i class="fa-solid {showPw ? 'fa-eye-slash' : 'fa-eye'}" aria-hidden="true"></i>
							</button>
						</div>
						{#if pwLabel}
							<div class="meter" id="pw-strength" role="status" aria-label="Kekuatan kata sandi: {pwLabel}">
								<span class="meter-bar" data-on={pwScore >= 1} data-tone={pwScore <= 1 ? 'lemah' : 'kuat'}></span>
								<span class="meter-bar" data-on={pwScore >= 2} data-tone="kuat"></span>
								<span class="meter-bar" data-on={pwScore >= 3} data-tone="kuat"></span>
								<span class="meter-bar" data-on={pwScore >= 4} data-tone="kuat"></span>
								<span class="meter-text">{pwLabel} (penilaian lokal)</span>
							</div>
						{/if}
					</div>
					<div class="field">
						<label for="inv-confirm">Konfirmasi kata sandi</label>
						<div class="pw-wrap">
							<input
								id="inv-confirm"
								type={showPw2 ? 'text' : 'password'}
								bind:value={confirmPassword}
								autocomplete="new-password"
								minlength={7}
								required
								placeholder="Ulangi kata sandi"
								aria-invalid={errorMessage ? true : undefined}
							/>
							<button
								type="button"
								onclick={() => (showPw2 = !showPw2)}
								aria-pressed={showPw2}
								aria-label={showPw2 ? 'Sembunyikan konfirmasi' : 'Tampilkan konfirmasi'}
								class="pw-toggle"
							>
								<i class="fa-solid {showPw2 ? 'fa-eye-slash' : 'fa-eye'}" aria-hidden="true"></i>
							</button>
						</div>
					</div>
					{#if errorMessage}
						<p role="alert" class="alert-error">
							<i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i>
							<span>{errorMessage}</span>
						</p>
					{/if}
					<button type="submit" disabled={isLoading || done} class="cta">
						{#if isLoading}
							<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i>
							<span>Menyegel surat&hellip;</span>
						{:else}
							<i class="fa-solid fa-stamp" aria-hidden="true"></i>
							<span>Terima &amp; Aktifkan Akun</span>
						{/if}
					</button>
				</form>
			</section>
		{:else if done}
			<section class="letter rise" style="--d: 80ms" aria-labelledby="invite-title">
				<div class="seal seal-ok" aria-hidden="true"><i class="fa-solid fa-check"></i></div>
				<p class="letter-eyebrow">Simulasi selesai</p>
				<h1 id="invite-title" class="letter-title">Surat tersegel.</h1>
				<p class="letter-sub">
					Undangan untuk <strong>{acceptedEmail}</strong> telah ditandai terpakai di browser ini.
					Akun <strong>belum aktif</strong> &mdash; penerbitan akun nyata membutuhkan backend.
				</p>
				<ol class="steps" aria-label="Langkah aktivasi">
					<li class="step is-done">
						<span class="step-dot" aria-hidden="true"><i class="fa-solid fa-check"></i></span>
						<span>Undangan diterima</span>
					</li>
					<li class="step is-done">
						<span class="step-dot" aria-hidden="true"><i class="fa-solid fa-check"></i></span>
						<span>Kata sandi dibuat</span>
					</li>
					<li class="step">
						<span class="step-dot" aria-hidden="true">3</span>
						<span>Aktivasi oleh sistem</span>
					</li>
				</ol>
				<a href="/login" class="cta cta-ghost">
					<i class="fa-solid fa-arrow-right-to-bracket" aria-hidden="true"></i>
					<span>Kembali ke halaman masuk</span>
				</a>
			</section>
		{:else if inviteState.kind === 'expired'}
			<section class="letter rise" style="--d: 80ms" aria-labelledby="invite-title">
				<div class="seal seal-muted" aria-hidden="true"><i class="fa-solid fa-hourglass-end"></i></div>
				<p class="letter-eyebrow">Masa berlaku habis</p>
				<h1 id="invite-title" class="letter-title">Tautan kedaluwarsa.</h1>
				<p class="letter-sub">Masa berlaku undangan sudah habis. Minta admin mengirim undangan baru.</p>
				<a href="/login" class="cta cta-ghost">
					<i class="fa-solid fa-arrow-left" aria-hidden="true"></i>
					<span>Kembali ke halaman masuk</span>
				</a>
			</section>
		{:else if inviteState.kind === 'used'}
			<section class="letter rise" style="--d: 80ms" aria-labelledby="invite-title">
				<div class="seal seal-muted" aria-hidden="true"><i class="fa-solid fa-circle-check"></i></div>
				<p class="letter-eyebrow">Satu kali pakai</p>
				<h1 id="invite-title" class="letter-title">Tautan sudah digunakan.</h1>
				<p class="letter-sub">Setiap undangan hanya berlaku satu kali. Minta admin memeriksa status undangan Anda.</p>
				<a href="/login" class="cta cta-ghost">
					<i class="fa-solid fa-arrow-left" aria-hidden="true"></i>
					<span>Kembali ke halaman masuk</span>
				</a>
			</section>
		{:else if inviteState.kind === 'cancelled'}
			<section class="letter rise" style="--d: 80ms" aria-labelledby="invite-title">
				<div class="seal seal-muted" aria-hidden="true"><i class="fa-solid fa-ban"></i></div>
				<p class="letter-eyebrow">Dibatalkan admin</p>
				<h1 id="invite-title" class="letter-title">Undangan dibatalkan.</h1>
				<p class="letter-sub">Undangan ini telah dibatalkan oleh admin.</p>
				<a href="/login" class="cta cta-ghost">
					<i class="fa-solid fa-arrow-left" aria-hidden="true"></i>
					<span>Kembali ke halaman masuk</span>
				</a>
			</section>
		{:else}
			<section class="letter rise" style="--d: 80ms" aria-labelledby="invite-title">
				<div class="seal seal-muted" aria-hidden="true"><i class="fa-solid fa-triangle-exclamation"></i></div>
				<p class="letter-eyebrow">Tidak dikenali</p>
				<h1 id="invite-title" class="letter-title">Undangan tidak valid.</h1>
				<p class="letter-sub">Tautan tidak dikenal. Pastikan Anda membuka tautan lengkap dari admin.</p>
				<a href="/login" class="cta cta-ghost">
					<i class="fa-solid fa-arrow-left" aria-hidden="true"></i>
					<span>Kembali ke halaman masuk</span>
				</a>
			</section>
		{/if}

		<footer class="invite-foot rise" style="--d: 160ms">
			<i class="fa-solid fa-flask" aria-hidden="true"></i>
			<span>
				Halaman simulasi lokal &mdash; kata sandi tidak disimpan dan tidak ada akun yang diaktifkan di
				sini. Penerbitan akun nyata membutuhkan backend.
			</span>
		</footer>
	</main>
</div>

<style>
	.invite-page {
		position: relative;
		display: flex;
		min-height: 100dvh;
		align-items: center;
		justify-content: center;
		padding: 1.5rem 1rem;
		background: #0a1322;
		overflow: clip;
	}
	.invite-glow {
		position: absolute;
		inset: -20%;
		background:
			radial-gradient(42rem 26rem at 50% -6rem, rgba(201, 162, 39, 0.22), transparent 60%),
			radial-gradient(30rem 22rem at 88% 108%, rgba(120, 170, 255, 0.16), transparent 60%),
			radial-gradient(26rem 22rem at 8% 100%, rgba(201, 162, 39, 0.1), transparent 60%);
		pointer-events: none;
	}
	.invite-grid {
		position: absolute;
		inset: 0;
		background-image:
			linear-gradient(rgba(255, 255, 255, 0.045) 1px, transparent 1px),
			linear-gradient(90deg, rgba(255, 255, 255, 0.045) 1px, transparent 1px);
		background-size: 44px 44px;
		mask-image: radial-gradient(46rem 34rem at 50% 40%, black 30%, transparent 75%);
		pointer-events: none;
	}
	.invite-shell {
		position: relative;
		width: 100%;
		max-width: 34rem;
	}
	.invite-masthead {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		margin-bottom: 2.5rem;
	}
	.invite-kicker {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		margin: 0;
		font-size: 0.68rem;
		font-weight: 800;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: #e8c85a;
	}
	.invite-sim-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		border: 1px solid rgba(201, 162, 39, 0.45);
		border-radius: 999px;
		padding: 0.3rem 0.7rem;
		font-size: 0.65rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #f3df9a;
		background: rgba(201, 162, 39, 0.1);
		white-space: nowrap;
	}
	.letter {
		position: relative;
		border-radius: 1.25rem;
		background:
			radial-gradient(120% 60% at 50% 0%, rgba(201, 162, 39, 0.12), transparent 60%),
			#faf7ec;
		border: 1px solid #e7dcc0;
		box-shadow:
			0 30px 80px -20px rgba(0, 0, 0, 0.65),
			0 0 0 6px rgba(201, 162, 39, 0.12);
		padding: 1.75rem 1.75rem 1.75rem;
		text-align: center;
		color: #16213a;
	}
	.seal {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 3.5rem;
		height: 3.5rem;
		margin-top: -3.25rem;
		border-radius: 999px;
		font-size: 1.3rem;
		color: #fff8e6;
		background: radial-gradient(circle at 32% 28%, #e8c85a, #a97e14 72%);
		border: 3px solid #f3df9a;
		box-shadow:
			0 10px 24px -8px rgba(169, 126, 20, 0.8),
			inset 0 0 0 2px rgba(255, 255, 255, 0.25);
	}
	.seal-ok {
		background: radial-gradient(circle at 32% 28%, #34d199, #047857 72%);
		border-color: #a7f3d0;
		box-shadow: 0 10px 24px -8px rgba(4, 120, 87, 0.8);
	}
	.seal-muted {
		background: radial-gradient(circle at 32% 28%, #94a3b8, #475569 72%);
		border-color: #cbd5e1;
		box-shadow: 0 10px 24px -8px rgba(71, 85, 105, 0.7);
	}
	.letter-eyebrow {
		margin: 0.9rem 0 0.25rem;
		font-size: 0.68rem;
		font-weight: 800;
		letter-spacing: 0.22em;
		text-transform: uppercase;
		color: #92690e;
	}
	.letter-title {
		margin: 0;
		font-family: Georgia, 'Times New Roman', serif;
		font-weight: 700;
		font-size: clamp(1.7rem, 5vw, 2.3rem);
		line-height: 1.15;
		letter-spacing: -0.01em;
		color: #16213a;
	}
	.letter-sub {
		margin: 0.6rem auto 0;
		max-width: 26rem;
		font-size: 0.9rem;
		line-height: 1.6;
		color: #43506b;
	}
	.letter-sub strong {
		color: #16213a;
	}
	.letter-meta {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		margin: 0.8rem 0 0;
		border-radius: 999px;
		background: #16213a;
		color: #f3df9a;
		font-size: 0.72rem;
		font-weight: 700;
		padding: 0.4rem 0.9rem;
	}
	.steps {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.5rem;
		list-style: none;
		margin: 1.25rem 0 0;
		padding: 0;
		text-align: left;
	}
	.step {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		border: 1px solid #e7dcc0;
		border-radius: 0.9rem;
		background: rgba(255, 255, 255, 0.65);
		padding: 0.6rem 0.65rem;
		font-size: 0.7rem;
		font-weight: 700;
		line-height: 1.3;
		color: #6b7a99;
	}
	.step-dot {
		display: inline-flex;
		flex-shrink: 0;
		align-items: center;
		justify-content: center;
		width: 1.6rem;
		height: 1.6rem;
		border-radius: 999px;
		font-size: 0.7rem;
		background: #e7dcc0;
		color: #92690e;
	}
	.step.is-done {
		border-color: #bfe6cf;
		background: #eefaf2;
		color: #0c6b3f;
	}
	.step.is-done .step-dot {
		background: #0c6b3f;
		color: #fff;
	}
	.step.is-now {
		border-color: #c9a227;
		background: #fff9e6;
		color: #16213a;
		box-shadow: 0 0 0 3px rgba(201, 162, 39, 0.18);
	}
	.step.is-now .step-dot {
		background: #16213a;
		color: #f3df9a;
	}
	.invite-form {
		margin-top: 1.25rem;
		text-align: left;
	}
	.field {
		margin-bottom: 0.9rem;
	}
	.field label {
		display: block;
		margin-bottom: 0.35rem;
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.04em;
		color: #16213a;
	}
	.pw-wrap {
		position: relative;
	}
	.pw-wrap input {
		width: 100%;
		border: 1px solid #d8cfae;
		border-radius: 0.8rem;
		background: #fff;
		padding: 0.7rem 2.75rem 0.7rem 0.9rem;
		font-size: 0.92rem;
		color: #16213a;
		box-sizing: border-box;
	}
	.pw-wrap input:focus {
		outline: 2px solid #16213a;
		outline-offset: 2px;
		border-color: #16213a;
	}
	.pw-toggle {
		position: absolute;
		top: 50%;
		right: 0.4rem;
		transform: translateY(-50%);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 44px;
		min-height: 44px;
		border: 0;
		border-radius: 0.7rem;
		background: transparent;
		color: #6b7a99;
		cursor: pointer;
	}
	.pw-toggle:hover {
		color: #16213a;
		background: rgba(22, 33, 58, 0.06);
	}
	.pw-toggle:focus-visible {
		outline: 2px solid #16213a;
		outline-offset: 2px;
	}
	.meter {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		margin-top: 0.45rem;
	}
	.meter-bar {
		height: 0.35rem;
		flex: 1;
		border-radius: 999px;
		background: #e7dcc0;
	}
	.meter-bar[data-on='true'][data-tone='lemah'] {
		background: #dc2626;
	}
	.meter-bar[data-on='true'][data-tone='kuat'] {
		background: #0c6b3f;
	}
	.meter-text {
		margin-left: 0.35rem;
		font-size: 0.68rem;
		font-weight: 800;
		color: #43506b;
		white-space: nowrap;
	}
	.alert-error {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		border: 1px solid #f3b8b8;
		border-radius: 0.8rem;
		background: #fef2f2;
		padding: 0.65rem 0.85rem;
		font-size: 0.8rem;
		font-weight: 600;
		color: #991b1b;
	}
	.cta {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.55rem;
		width: 100%;
		box-sizing: border-box;
		min-height: 48px;
		border: 0;
		border-radius: 0.9rem;
		background: linear-gradient(135deg, #16213a, #2b3f6e);
		color: #f8ecc9;
		font-size: 0.85rem;
		font-weight: 800;
		letter-spacing: 0.02em;
		cursor: pointer;
		text-decoration: none;
		box-shadow: 0 14px 30px -12px rgba(22, 33, 58, 0.7);
		transition:
			transform 0.15s ease,
			box-shadow 0.15s ease;
	}
	.cta:hover:not(:disabled) {
		transform: translateY(-1px);
		box-shadow: 0 18px 34px -12px rgba(22, 33, 58, 0.75);
	}
	.cta:disabled {
		cursor: not-allowed;
		opacity: 0.7;
	}
	.cta:focus-visible {
		outline: 3px solid #e8c85a;
		outline-offset: 3px;
	}
	.cta-ghost {
		margin-top: 0.25rem;
	}
	.invite-foot {
		display: flex;
		align-items: flex-start;
		gap: 0.55rem;
		margin: 1rem auto 0;
		max-width: 34rem;
		font-size: 0.72rem;
		line-height: 1.55;
		color: rgba(243, 223, 154, 0.85);
	}
	.rise {
		opacity: 0;
		animation: rise 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards;
		animation-delay: var(--d, 0ms);
	}
	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(14px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
	@media (max-width: 480px) {
		.steps {
			grid-template-columns: minmax(0, 1fr);
		}
		.step {
			font-size: 0.78rem;
		}
		.invite-masthead {
			flex-direction: column;
			align-items: flex-start;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.rise {
			animation: none;
			opacity: 1;
		}
		.cta {
			transition: none;
		}
	}
</style>
