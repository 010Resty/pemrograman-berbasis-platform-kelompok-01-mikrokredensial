<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import roketImg from '$lib/assets/roket.png';

	/**
	 * Halaman error global (404 + error lain). SvelteKit merender berkas ini
	 * otomatis bila rute tidak ditemukan atau `error()` dilempar.
	 */

	const status = $derived(page.status);
	const isNotFound = $derived(status === 404);
	const title = $derived(isNotFound ? 'Halaman tidak ditemukan' : 'Terjadi kesalahan');
	const message = $derived(
		page.error?.message ||
			(isNotFound
				? 'Alamat yang Anda buka tidak terdaftar di ARISTOTELES.'
				: 'Sesuatu tidak beres di sisi kami. Coba lagi nanti.')
	);

	function goBack(): void {
		// Bila tidak ada riwayat (mis. tab baru / tautan langsung),
		// history.back() tidak ke mana-mana — kembali ke beranda saja.
		if (window.history.length > 1) window.history.back();
		else window.location.assign(resolve('/'));
	}
</script>

<svelte:head>
	<title>{status} · {title} — ARISTOTELES</title>
	<meta name="description" content="Halaman error ARISTOTELES." />
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-b from-ice via-white to-slate-50 p-4">
	<div class="pointer-events-none absolute inset-0" aria-hidden="true">
		<div class="absolute -top-24 left-[10%] h-72 w-72 rounded-full bg-royal/15 blur-3xl"></div>
		<div class="absolute right-[6%] bottom-[-6rem] h-72 w-72 rounded-full bg-teal/20 blur-3xl"></div>
		<div class="absolute inset-0 bg-[radial-gradient(rgba(16,42,86,0.1)_1.2px,transparent_1.2px)] bg-[size:22px_22px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_40%,black,transparent)]"></div>
	</div>
	<main
		aria-labelledby="error-title"
		class="relative w-full max-w-md overflow-hidden rounded-[1.75rem] border border-slate-200/70 bg-white text-center shadow-2xl shadow-slate-900/10"
	>
		<div class="h-1.5 bg-gradient-to-r from-abyss via-royal to-teal" aria-hidden="true"></div>
		<div class="p-8 sm:p-10">
			<div class="relative mx-auto w-fit">
				<img
					src={roketImg}
					alt="Ilustrasi roket meluncur"
					loading="eager"
					class="mx-auto h-56 w-auto drop-shadow-2xl"
				/>
				<span class="absolute -right-4 -bottom-3 rounded-full bg-abyss px-3.5 py-1.5 font-mono text-xs font-black text-white tabular-nums shadow-lg">
					{status}
				</span>
			</div>
			<p class="mt-5 text-[11px] font-bold tracking-widest text-royal uppercase">Aristoteles</p>
			<h1 id="error-title" class="mt-1 text-2xl font-extrabold text-slate-900">{title}</h1>
			<p class="mt-2 text-sm leading-relaxed text-slate-500">{message}</p>
			<div class="mt-6 flex flex-col gap-2.5 sm:flex-row">
				<a
					href={resolve('/')}
					class="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-blue-600/25 transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
				>
					<i class="fa-solid fa-house" aria-hidden="true"></i> Beranda
				</a>
				<button
					type="button"
					onclick={goBack}
					class="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-slate-500"
				>
					<i class="fa-solid fa-arrow-left" aria-hidden="true"></i> Kembali
				</button>
			</div>
		</div>
	</main>
</div>
