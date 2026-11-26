<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import {
		acceptBackendInvitation,
		validateBackendInvitation,
		type ValidateInvitationResult
	} from '$lib/api/invitations';
	import { BackendRequestError } from '$lib/api/backend';
	import { toast } from '$lib/stores/toast.svelte';
	import { lp, type Locale } from '$lib/i18n/locale';
	import { intlLocale, t } from '$lib/i18n/index';

	const lang: Locale = $derived(page.params.lang === 'en' ? 'en' : 'id');

	/**
	 * Aktivasi akun instruktur — validasi + aktivasi 100% backend.
	 * Token dicek ke GET /invitations/validate, akun dibuat via
	 * POST /invitations/accept. Sukses TIDAK auto-login — user masuk
	 * manual dengan password baru (pola sama seperti reset-password).
	 */

	type State =
		| { kind: 'checking' }
		| { kind: 'valid'; invitation: ValidateInvitationResult }
		| { kind: 'invalid'; message: string }
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

	let inviteState = $state<State>({ kind: 'checking' });

	const token = $derived(page.params.token ?? '');

	function statusOf(e: unknown): number | null {
		return e instanceof BackendRequestError ? e.httpStatus : null;
	}

	async function checkInvitation(tok: string): Promise<void> {
		inviteState = { kind: 'checking' };
		if (!tok) {
			inviteState = { kind: 'invalid', message: t(lang, 'invite.errIncomplete') };
			return;
		}
		try {
			const invitation = await validateBackendInvitation(tok);
			inviteState = { kind: 'valid', invitation };
		} catch (e) {
			const http = statusOf(e);
			const message = e instanceof Error ? e.message : '';
			if (http === 409) inviteState = { kind: 'used' };
			else if (http === 410) inviteState = { kind: 'expired' };
			else inviteState = { kind: 'invalid', message };
		}
	}

	onMount(() => {
		void checkInvitation(page.params.token ?? '');
	});

	$effect(() => {
		if (inviteState.kind === 'valid' && !done) pwInput?.focus();
	});

	const done = $derived(acceptedEmail !== '');

	$effect(() => {
		if (inviteState.kind === 'valid' && !done) pwInput?.focus();
	});

	const expiryLabel = $derived.by(() => {
		if (inviteState.kind !== 'valid') return '';
		try {
			return new Date(inviteState.invitation.expiresAt).toLocaleDateString(intlLocale(lang), {
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
				? t(lang, 'invite.pw0')
				: pwScore === 2
					? t(lang, 'invite.pw1')
					: pwScore === 3
						? t(lang, 'invite.pw2')
						: t(lang, 'invite.pw3')
	);

	function messageOf(e: unknown, fallback: string): string {
		return e instanceof Error && e.message ? e.message : fallback;
	}

	async function handleSubmit(event: Event) {
		event.preventDefault();
		errorMessage = '';
		if (inviteState.kind !== 'valid') return;
		if (password !== confirmPassword) {
			errorMessage = t(lang, 'invite.errMismatch');
			toast.error(errorMessage);
			return;
		}
		if (password.length < 8) {
			errorMessage = t(lang, 'invite.errMin');
			toast.error(errorMessage);
			return;
		}
		isLoading = true;
		try {
			const result = await acceptBackendInvitation({ token, password });
			password = '';
			confirmPassword = '';
			showPw = false;
			showPw2 = false;
			// Sukses = akun instruktur aktif di server. TIDAK auto-login —
			// user masuk manual dengan password baru.
			acceptedEmail = result.user.email;
		} catch (e) {
			const http = statusOf(e);
			errorMessage =
				http === 410
					? t(lang, 'invite.errExpired')
					: messageOf(e, t(lang, 'invite.errUnusable'));
			toast.error(errorMessage);
			// Token mungkin berubah status di server — cek ulang.
			void checkInvitation(token);
		} finally {
			isLoading = false;
		}
	}
</script>

<svelte:head>
	<title>{t(lang, 'invite.pageTitle')}</title>
	<meta name="description" content={t(lang, 'invite.pageDesc')} />
</svelte:head>

<div class="invite-page">
	<div class="invite-glow" aria-hidden="true"></div>
	<div class="invite-grid" aria-hidden="true"></div>

	<main class="invite-shell" aria-labelledby="invite-title">
		<header class="invite-masthead rise" style="--d: 0ms">
			<p class="invite-kicker">
				<i class="fa-solid fa-award" aria-hidden="true"></i>
				<span>{t(lang, 'invite.masthead')}</span>
			</p>
			<span class="invite-sim-badge">
				<i class="fa-solid fa-shield-halved" aria-hidden="true"></i>
				<span>{t(lang, 'invite.official')}</span>
			</span>
		</header>

		{#if inviteState.kind === 'checking'}
			<section class="letter rise" style="--d: 80ms" aria-label={t(lang, 'invite.checkingAria')}>
				<div class="seal" aria-hidden="true"><i class="fa-solid fa-envelope-open-text"></i></div>
				<h1 id="invite-title" class="letter-title">{t(lang, 'invite.checkingTitle')}</h1>
				<p role="status" class="letter-sub">
					<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i>
					{t(lang, 'invite.checkingSub')}
				</p>
			</section>
		{:else if inviteState.kind === 'valid' && !done}
			{@const inv = inviteState.invitation}
			<section class="letter rise" style="--d: 80ms" aria-labelledby="invite-title">
				<div class="seal" aria-hidden="true"><i class="fa-solid fa-award"></i></div>
				<p class="letter-eyebrow">{t(lang, 'invite.to')}</p>
				<h1 id="invite-title" class="letter-title">{inv.name ?? t(lang, 'invite.fallbackName')}</h1>
				<p class="letter-sub">
					{t(lang, 'invite.invitedA')} <strong>{t(lang, 'invite.invitedRole')}</strong> {t(lang, 'invite.invitedB')}
					<strong>{inv.email}</strong>. {t(lang, 'invite.invitedC')}
				</p>
				{#if expiryLabel}
					<p class="letter-meta">
						<i class="fa-solid fa-hourglass-half" aria-hidden="true"></i>
						<span>{t(lang, 'invite.validUntil', { date: expiryLabel })}</span>
					</p>
				{/if}

				<ol class="steps" aria-label={t(lang, 'invite.stepsLabel')}>
					<li class="step is-done">
						<span class="step-dot" aria-hidden="true"><i class="fa-solid fa-check"></i></span>
						<span>{t(lang, 'invite.step1')}</span>
					</li>
					<li class="step is-now" aria-current="step">
						<span class="step-dot" aria-hidden="true">2</span>
						<span>{t(lang, 'invite.step2')}</span>
					</li>
					<li class="step">
						<span class="step-dot" aria-hidden="true">3</span>
						<span>{t(lang, 'invite.step3')}</span>
					</li>
				</ol>

				<form class="invite-form" onsubmit={handleSubmit} aria-label={t(lang, 'invite.formLabel')}>
					<div class="field">
						<label for="inv-password">{t(lang, 'invite.newPass')}</label>
						<div class="pw-wrap">
							<input
								id="inv-password"
								type={showPw ? 'text' : 'password'}
								bind:this={pwInput}
								bind:value={password}
								autocomplete="new-password"
								minlength={8}
								required
								placeholder={t(lang, 'invite.newPassPh')}
								aria-describedby={pwLabel ? 'pw-strength' : undefined}
								aria-invalid={errorMessage ? true : undefined}
							/>
							<button
								type="button"
								onclick={() => (showPw = !showPw)}
								aria-pressed={showPw}
								aria-label={showPw ? t(lang, 'auth.hidePw') : t(lang, 'auth.showPw')}
								class="pw-toggle"
							>
								<i class="fa-solid {showPw ? 'fa-eye-slash' : 'fa-eye'}" aria-hidden="true"></i>
							</button>
						</div>
						{#if pwLabel}
							<div class="meter" id="pw-strength" role="status" aria-label="{t(lang, 'invite.meter')}: {pwLabel}">
								<span class="meter-bar" data-on={pwScore >= 1} data-tone={pwScore <= 1 ? 'lemah' : 'kuat'}></span>
								<span class="meter-bar" data-on={pwScore >= 2} data-tone="kuat"></span>
								<span class="meter-bar" data-on={pwScore >= 3} data-tone="kuat"></span>
								<span class="meter-bar" data-on={pwScore >= 4} data-tone="kuat"></span>
								<span class="meter-text">{pwLabel} {t(lang, 'invite.localNote')}</span>
							</div>
						{/if}
					</div>
					<div class="field">
						<label for="inv-confirm">{t(lang, 'invite.confirmLabel')}</label>
						<div class="pw-wrap">
							<input
								id="inv-confirm"
								type={showPw2 ? 'text' : 'password'}
								bind:value={confirmPassword}
								autocomplete="new-password"
								minlength={8}
								required
								placeholder={t(lang, 'invite.confirmPh')}
								aria-invalid={errorMessage ? true : undefined}
							/>
							<button
								type="button"
								onclick={() => (showPw2 = !showPw2)}
								aria-pressed={showPw2}
								aria-label={showPw2 ? t(lang, 'invite.hideConfirm') : t(lang, 'invite.showConfirm')}
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
							<span>{t(lang, 'invite.sealing')}</span>
						{:else}
							<i class="fa-solid fa-stamp" aria-hidden="true"></i>
							<span>{t(lang, 'invite.accept')}</span>
						{/if}
					</button>
				</form>
			</section>
		{:else if done}
			<section class="letter rise" style="--d: 80ms" aria-labelledby="invite-title">
				<div class="seal seal-ok" aria-hidden="true"><i class="fa-solid fa-check"></i></div>
				<p class="letter-eyebrow">{t(lang, 'invite.doneEyebrow')}</p>
				<h1 id="invite-title" class="letter-title">{t(lang, 'invite.doneTitle')}</h1>
				<p class="letter-sub">
					{t(lang, 'invite.doneA')} <strong>{acceptedEmail}</strong> {t(lang, 'invite.doneB')}
					{t(lang, 'invite.doneC')}
				</p>
				<ol class="steps" aria-label="{t(lang, 'invite.stepsLabel')}">
					<li class="step is-done">
						<span class="step-dot" aria-hidden="true"><i class="fa-solid fa-check"></i></span>
						<span>{t(lang, 'invite.step1')}</span>
					</li>
					<li class="step is-done">
						<span class="step-dot" aria-hidden="true"><i class="fa-solid fa-check"></i></span>
						<span>{t(lang, 'invite.doneStepNew')}</span>
					</li>
					<li class="step">
						<span class="step-dot" aria-hidden="true">3</span>
						<span>{t(lang, 'invite.doneStepActivate')}</span>
					</li>
				</ol>
				<a href={lp(lang, '/login')} class="cta cta-ghost">
					<i class="fa-solid fa-arrow-right-to-bracket" aria-hidden="true"></i>
					<span>{t(lang, 'invite.signinNow')}</span>
				</a>
			</section>
		{:else if inviteState.kind === 'expired'}
			<section class="letter rise" style="--d: 80ms" aria-labelledby="invite-title">
				<div class="seal seal-muted" aria-hidden="true"><i class="fa-solid fa-hourglass-end"></i></div>
				<p class="letter-eyebrow">{t(lang, 'invite.expiredEyebrow')}</p>
				<h1 id="invite-title" class="letter-title">{t(lang, 'invite.expiredTitle')}</h1>
				<p class="letter-sub">{t(lang, 'invite.expiredSub')}</p>
				<a href={lp(lang, '/login')} class="cta cta-ghost">
					<i class="fa-solid fa-arrow-left" aria-hidden="true"></i>
					<span>{t(lang, 'invite.backLogin')}</span>
				</a>
			</section>
		{:else if inviteState.kind === 'used'}
			<section class="letter rise" style="--d: 80ms" aria-labelledby="invite-title">
				<div class="seal seal-muted" aria-hidden="true"><i class="fa-solid fa-circle-check"></i></div>
				<p class="letter-eyebrow">{t(lang, 'invite.usedEyebrow')}</p>
				<h1 id="invite-title" class="letter-title">{t(lang, 'invite.usedTitle')}</h1>
				<p class="letter-sub">{t(lang, 'invite.usedSub')}</p>
				<a href={lp(lang, '/login')} class="cta cta-ghost">
					<i class="fa-solid fa-arrow-left" aria-hidden="true"></i>
					<span>{t(lang, 'invite.backLogin')}</span>
				</a>
			</section>
		{:else if inviteState.kind === 'cancelled'}
			<section class="letter rise" style="--d: 80ms" aria-labelledby="invite-title">
				<div class="seal seal-muted" aria-hidden="true"><i class="fa-solid fa-ban"></i></div>
				<p class="letter-eyebrow">{t(lang, 'invite.cancelledEyebrow')}</p>
				<h1 id="invite-title" class="letter-title">{t(lang, 'invite.cancelledTitle')}</h1>
				<p class="letter-sub">{t(lang, 'invite.cancelledSub')}</p>
				<a href={lp(lang, '/login')} class="cta cta-ghost">
					<i class="fa-solid fa-arrow-left" aria-hidden="true"></i>
					<span>{t(lang, 'invite.backLogin')}</span>
				</a>
			</section>
		{:else}
			{@const invalidMsg =
				inviteState.kind === 'invalid' && inviteState.message ? inviteState.message : ''}
			<section class="letter rise" style="--d: 80ms" aria-labelledby="invite-title">
				<div class="seal seal-muted" aria-hidden="true"><i class="fa-solid fa-triangle-exclamation"></i></div>
				<p class="letter-eyebrow">{t(lang, 'invite.invalidEyebrow')}</p>
				<h1 id="invite-title" class="letter-title">{t(lang, 'invite.invalidTitle')}</h1>
				<p class="letter-sub">{invalidMsg || t(lang, 'invite.invalidFallback')}</p>
				<a href={lp(lang, '/login')} class="cta cta-ghost">
					<i class="fa-solid fa-arrow-left" aria-hidden="true"></i>
					<span>{t(lang, 'invite.backLogin')}</span>
				</a>
			</section>
		{/if}

		<footer class="invite-foot rise" style="--d: 160ms">
			<i class="fa-solid fa-shield-halved" aria-hidden="true"></i>
			<span>
				{t(lang, 'invite.footNote')}
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
		background: var(--color-abyss);
		overflow: clip;
	}
	.invite-glow {
		position: absolute;
		inset: -20%;
		background:
			radial-gradient(42rem 26rem at 50% -6rem, rgba(56, 189, 248, 0.2), transparent 60%),
			radial-gradient(30rem 22rem at 88% 108%, rgba(120, 170, 255, 0.16), transparent 60%),
			radial-gradient(26rem 22rem at 8% 100%, rgba(56, 189, 248, 0.1), transparent 60%);
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
		color: var(--color-accent);
	}
	.invite-sim-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		border: 1px solid rgba(56, 189, 248, 0.45);
		border-radius: 999px;
		padding: 0.3rem 0.7rem;
		font-size: 0.65rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #e0f2fe;
		background: rgba(56, 189, 248, 0.12);
		white-space: nowrap;
	}
	.letter {
		position: relative;
		border-radius: 1.25rem;
		background:
			radial-gradient(120% 60% at 50% 0%, rgba(37, 99, 235, 0.1), transparent 60%),
			#ffffff;
		border: 1px solid var(--color-border);
		box-shadow:
			0 30px 80px -20px rgba(0, 0, 0, 0.65),
			0 0 0 6px rgba(37, 99, 235, 0.12);
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
		color: #eff6ff;
		background: radial-gradient(circle at 32% 28%, #60a5fa, #1d4ed8 72%);
		border: 3px solid #bfdbfe;
		box-shadow:
			0 10px 24px -8px rgba(29, 78, 216, 0.8),
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
		color: var(--color-primary);
	}
	.letter-title {
		margin: 0;
		font-family: var(--font-heading);
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
		background: var(--color-navy);
		color: #e0f2fe;
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
		border: 1px solid var(--color-border);
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
		background: var(--color-mist);
		color: var(--color-primary);
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
		border-color: var(--color-primary);
		background: var(--color-primary-soft);
		color: #16213a;
		box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.18);
	}
	.step.is-now .step-dot {
		background: var(--color-navy);
		color: #fff;
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
		border: 1px solid var(--color-border);
		border-radius: 0.8rem;
		background: #fff;
		padding: 0.7rem 2.75rem 0.7rem 0.9rem;
		font-size: 0.92rem;
		color: #16213a;
		box-sizing: border-box;
	}
	.pw-wrap input:focus {
		outline: 2px solid var(--color-ring);
		outline-offset: 2px;
		border-color: var(--color-ring);
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
		outline: 2px solid var(--color-ring);
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
		background: var(--color-mist);
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
		background: linear-gradient(135deg, var(--color-primary-hover), var(--color-primary));
		color: #fff;
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
		outline: 3px solid var(--color-ring);
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
		color: rgba(224, 242, 254, 0.85);
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
