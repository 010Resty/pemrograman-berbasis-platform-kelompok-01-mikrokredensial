<script lang="ts">
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { homeFor, verifySession, type Role } from '$lib/stores/auth.svelte';
	import roketImg from '$lib/assets/roket.png';

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

	// Target kembali memakai peran TERVERIFIKASI server (/me), bukan isi
	// storage mentah — sesi lokal yang dipalsukan tidak boleh mengarahkan
	// ke portal yang bukan haknya (guard portal tetap verifikasi ulang).
	let verifiedRole = $state<Role | null>(null);

	$effect(() => {
		if (!browser) return;
		let cancelled = false;
		(void (async () => {
			const res = await verifySession();
			if (!cancelled && res.ok) verifiedRole = res.session.role;
		})());
		return () => {
			cancelled = true;
		};
	});

	const target = $derived(verifiedRole ? homeFor(verifiedRole) : '/');
	const targetLabel = $derived(
		verifiedRole ? `Dasbor ${ROLE_LABEL_ID[verifiedRole]}` : 'Beranda'
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
	<title>Segera Hadir — ARISTOTELES</title>
	<meta name="description" content="Fitur yang Anda buka sedang disiapkan dan akan segera hadir." />
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-b from-ice via-white to-slate-50 p-4">
	<div class="pointer-events-none absolute inset-0" aria-hidden="true">
		<div class="absolute -top-24 right-[8%] h-72 w-72 rounded-full bg-royal/15 blur-3xl"></div>
		<div class="absolute bottom-[-6rem] left-[4%] h-72 w-72 rounded-full bg-teal/20 blur-3xl"></div>
		<div class="absolute inset-0 bg-[radial-gradient(rgba(16,42,86,0.1)_1.2px,transparent_1.2px)] bg-[size:22px_22px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_40%,black,transparent)]"></div>
	</div>
	<main
		aria-labelledby="segera-hadir-title"
		class="relative w-full max-w-md overflow-hidden rounded-[1.75rem] border border-slate-200/70 bg-white text-center shadow-2xl shadow-slate-900/10"
	>
		<div class="h-1.5 bg-gradient-to-r from-blue-600 via-sky-500 to-teal" aria-hidden="true"></div>
		<div class="p-8 sm:p-10">
			<div class="relative mx-auto w-fit">
				<img
					src={roketImg}
					alt="Ilustrasi roket meluncur — fitur segera hadir"
					loading="eager"
					class="mx-auto h-56 w-auto drop-shadow-2xl"
				/>
				<span class="absolute -right-3 -bottom-3 inline-flex items-center gap-1.5 rounded-full bg-abyss px-3.5 py-1.5 font-heading text-[11px] font-bold tracking-wider text-white uppercase shadow-lg">
					<span class="relative flex h-2 w-2" aria-hidden="true">
						<span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal opacity-70 motion-reduce:hidden"></span>
						<span class="relative inline-flex h-2 w-2 rounded-full bg-teal"></span>
					</span>
					Segera hadir
				</span>
			</div>
			<p class="mt-5 text-[11px] font-bold tracking-widest text-blue-600 uppercase">
				Aristoteles
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
