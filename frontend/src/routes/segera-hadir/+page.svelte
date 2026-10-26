<script lang="ts">
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { homeFor, loadSession, type Role } from '$lib/stores/auth.svelte';

	/**
	 * Halaman independen "Segera Hadir".
	 * Menampilkan pemberitahuan selama 10 detik lalu mengembalikan pengunjung
	 * ke dasbor sesuai peran (peserta → /user, instruktur → /instruktur,
	 * admin → /admin) atau ke beranda bila belum masuk.
	 * Query opsional: `?fitur=Nama` untuk menyebut fitur yang dimaksud.
	 */

	const COUNTDOWN_SECONDS = 10;

	const ROLE_LABEL_ID: Record<Role, string> = {
		student: 'Peserta',
		teacher: 'Instruktur',
		admin: 'Admin'
	};

	const featureName = $derived((page.url.searchParams.get('fitur') ?? '').trim() || 'Fitur ini');

	const session = $derived.by(() => {
		if (!browser) return null;
		return loadSession();
	});
	const target = $derived(session ? homeFor(session.role) : '/');
	const targetLabel = $derived(
		session ? `Dasbor ${ROLE_LABEL_ID[session.role]}` : 'Beranda'
	);

	let remaining = $state(COUNTDOWN_SECONDS);
	let navigated = false;

	function goNow() {
		if (navigated) return;
		navigated = true;
		void goto(target);
	}

	$effect(() => {
		if (!browser || navigated) return;
		if (remaining <= 0) {
			goNow();
			return;
		}
		const id = setInterval(() => {
			remaining -= 1;
		}, 1000);
		return () => clearInterval(id);
	});
</script>

<svelte:head>
	<title>Segera Hadir — Aristoteles</title>
	<meta name="description" content="Fitur yang Anda buka sedang disiapkan dan akan segera hadir." />
</svelte:head>

<div class="flex min-h-screen items-center justify-center bg-slate-50 p-4">
	<main
		aria-labelledby="segera-hadir-title"
		class="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200/70 bg-white text-center shadow-xl"
	>
		<div class="h-1.5 bg-gradient-to-r from-blue-600 via-sky-500 to-blue-600" aria-hidden="true"></div>
		<div class="p-8 sm:p-10">
			<span
				class="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-2xl text-blue-600"
				aria-hidden="true"
			>
				<i class="fa-solid fa-hourglass-half"></i>
			</span>
			<p class="mt-5 text-[11px] font-bold tracking-widest text-blue-600 uppercase">
				Aristoteles · Segera Hadir
			</p>
			<h1 id="segera-hadir-title" class="mt-1 text-2xl font-extrabold text-slate-900">
				{featureName} Segera Hadir
			</h1>
			<p class="mt-2 text-sm leading-relaxed text-slate-500">
				Mohon maaf, {featureName.toLowerCase()} masih dalam tahap persiapan dan belum dapat
				digunakan. Anda akan dikembalikan ke {targetLabel} secara otomatis.
			</p>

			<p
				role="timer"
				aria-label={`Kembali otomatis dalam ${remaining} detik ke ${targetLabel}`}
				class="mt-6 font-mono text-5xl font-black text-slate-900 tabular-nums"
			>
				{remaining}
			</p>
			<div
				class="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"
				role="progressbar"
				aria-valuemin={0}
				aria-valuemax={COUNTDOWN_SECONDS}
				aria-valuenow={COUNTDOWN_SECONDS - remaining}
				aria-label="Waktu hingga kembali otomatis"
			>
				<div
					class="h-full rounded-full bg-blue-600 transition-[width] duration-1000 ease-linear"
					style="width: {((COUNTDOWN_SECONDS - remaining) / COUNTDOWN_SECONDS) * 100}%"
				></div>
			</div>
			<p class="mt-2 text-xs text-slate-400" aria-live="polite">
				Mengalihkan ke {targetLabel} dalam {remaining} detik…
			</p>

			<button
				type="button"
				onclick={goNow}
				class="mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-blue-600/25 transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
			>
				<i class="fa-solid fa-arrow-left" aria-hidden="true"></i>
				Kembali ke {targetLabel} Sekarang
			</button>
		</div>
	</main>
</div>
