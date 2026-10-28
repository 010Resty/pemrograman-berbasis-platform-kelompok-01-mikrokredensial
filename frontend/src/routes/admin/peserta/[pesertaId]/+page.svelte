<script lang="ts">
	import { browser } from '$app/environment';
	import { page } from '$app/state';
	import { fetchAdminUser, setAdminUserActive, type AdminUserDetail } from '$lib/api/admin';

	/**
	 * Detail peserta dari backend (GET /api/v1/admin/users/:id).
	 * Tanpa data contoh: nama/email/peran/status/bergabung + hitungan
	 * kursus & sertifikat milik peserta. Rincian nilai/progres per kursus
	 * belum ada endpointnya, jadi tidak ditampilkan.
	 */

	const pesertaId = $derived(Number(page.params.pesertaId));

	let user = $state<AdminUserDetail | null>(null);
	let loading = $state(true);
	let loadError = $state('');
	let notFound = $state(false);
	let toggling = $state(false);
	let actionError = $state('');
	let actionMessage = $state('');
	let started = false;
	let loadSeq = 0;

	async function load(id: number): Promise<void> {
		const my = ++loadSeq;
		loading = true;
		loadError = '';
		notFound = false;
		try {
			const data = await fetchAdminUser(id);
			if (my !== loadSeq) return;
			user = data;
		} catch (e) {
			if (my !== loadSeq) return;
			if (e instanceof Error && /tidak ditemukan|404/.test(e.message)) {
				notFound = true;
				user = null;
			} else {
				loadError = e instanceof Error ? e.message : 'Gagal memuat detail peserta.';
			}
		} finally {
			if (my === loadSeq) loading = false;
		}
	}

	$effect(() => {
		if (!browser || started) return;
		started = true;
		const id = pesertaId;
		if (!Number.isInteger(id) || id <= 0) {
			notFound = true;
			loading = false;
			return;
		}
		void load(id);
	});

	function formatDate(iso: string): string {
		const d = new Date(iso);
		return Number.isNaN(d.getTime())
			? iso
			: d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
	}

	function roleLabel(role: string): string {
		if (role === 'teacher') return 'Instruktur';
		if (role === 'admin') return 'Administrator';
		return 'Mahasiswa';
	}

	function initials(name: string): string {
		return (
			name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?'
		);
	}

	async function toggleActive(): Promise<void> {
		if (!user || toggling) return;
		toggling = true;
		actionError = '';
		actionMessage = '';
		try {
			await setAdminUserActive(user.id, !user.isActive);
			user = { ...user, isActive: !user.isActive };
			actionMessage = user.isActive
				? 'Akun diaktifkan kembali.'
				: 'Akun dinonaktifkan. Pengguna tidak dapat masuk sampai diaktifkan lagi.';
		} catch (e) {
			actionError = e instanceof Error ? e.message : 'Perubahan status gagal.';
		} finally {
			toggling = false;
		}
	}
</script>

<svelte:head>
	<title>
		{user ? `${user.name} — Detail Peserta` : 'Peserta tidak ditemukan'} — Admin Aristoteles
	</title>
	<meta name="description" content="Detail peserta platform Aristoteles." />
</svelte:head>

<div class="p-4 sm:p-6 lg:p-8">
	{#if loading}
		<div class="animate-pulse" aria-label="Memuat detail peserta">
			<div class="mb-6 h-8 w-64 rounded-xl bg-slate-100"></div>
			<div class="overflow-hidden rounded-2xl border border-slate-200/70 bg-white">
				<div class="h-24 bg-slate-100"></div>
				<div class="space-y-2 p-5 sm:p-6">
					<div class="h-6 w-56 rounded bg-slate-100"></div>
					<div class="h-4 w-40 rounded bg-slate-100"></div>
				</div>
			</div>
		</div>
	{:else if loadError}
		<div role="alert" class="mx-auto max-w-lg rounded-2xl border border-red-200 bg-red-50 p-10 text-center">
			<i class="fa-solid fa-triangle-exclamation mb-3 text-3xl text-red-400" aria-hidden="true"></i>
			<h1 class="text-xl font-bold text-slate-900">Detail peserta belum dapat dimuat</h1>
			<p class="mx-auto mt-1 max-w-md text-sm text-red-600">{loadError}</p>
			<button
				type="button"
				onclick={() => {
					const id = Number(page.params.pesertaId);
					if (Number.isInteger(id) && id > 0) void load(id);
				}}
				class="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-red-600"
			>
				<i class="fa-solid fa-rotate-right" aria-hidden="true"></i> Coba lagi
			</button>
		</div>
	{:else if !user || notFound}
		<div class="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-10 text-center">
			<i class="fa-solid fa-triangle-exclamation mb-3 text-3xl text-amber-500" aria-hidden="true"></i>
			<h1 class="text-xl font-bold text-slate-900">Peserta tidak ditemukan</h1>
			<p class="mt-1 text-sm text-slate-500">
				ID peserta “{page.params.pesertaId}” tidak terdaftar.
			</p>
			<a
				href="/admin/peserta"
				class="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
			>
				<i class="fa-solid fa-arrow-left" aria-hidden="true"></i> Kembali ke Peserta
			</a>
		</div>
	{:else}
		<nav aria-label="Navigasi remah roti" class="mb-4 flex items-center gap-2 text-xs text-slate-500">
			<a href="/admin/peserta" class="rounded font-semibold text-blue-600 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600">Peserta</a>
			<i class="fa-solid fa-chevron-right text-[10px] text-slate-300" aria-hidden="true"></i>
			<span aria-current="page" class="truncate font-medium text-slate-700">{user.name}</span>
		</nav>

		{#if actionMessage}
			<p
				role="status"
				class="mb-4 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-semibold text-emerald-800"
			>
				<i class="fa-solid fa-circle-check mt-0.5 shrink-0" aria-hidden="true"></i>
				<span>{actionMessage}</span>
			</p>
		{/if}
		{#if actionError}
			<p
				role="alert"
				class="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-700"
			>
				<i class="fa-solid fa-circle-exclamation mt-0.5 shrink-0" aria-hidden="true"></i>
				<span>{actionError}</span>
			</p>
		{/if}

		<header class="mb-6 overflow-hidden rounded-2xl border border-slate-200/70 bg-white">
			<div class="h-24 bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-800" aria-hidden="true"></div>
			<div class="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
				<span
					class="-mt-12 flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-xl font-extrabold text-white shadow-lg sm:-mt-14"
					aria-hidden="true"
				>
					{initials(user.name)}
				</span>
				<div class="min-w-0 flex-1">
					<div class="flex flex-wrap items-center gap-2">
						<h1 class="text-xl font-extrabold text-slate-900 sm:text-2xl">{user.name}</h1>
						<span class={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${user.isActive ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-600'}`}>
							<span class="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true"></span>{user.isActive ? 'Aktif' : 'Nonaktif'}
						</span>
					</div>
					<p class="mt-0.5 text-sm text-slate-500">{user.email} · {roleLabel(user.role)}</p>
					<p class="mt-1 text-[11px] text-slate-400">
						Bergabung {formatDate(user.createdAt)}
					</p>
				</div>
				<div class="flex flex-wrap gap-2">
					<button
						type="button"
						onclick={() => void toggleActive()}
						disabled={toggling}
						class="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-slate-500"
					>
						{#if toggling}
							<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i> Menyimpan…
						{:else if user.isActive}
							<i class="fa-solid fa-ban" aria-hidden="true"></i> Nonaktifkan Akun
						{:else}
							<i class="fa-solid fa-check" aria-hidden="true"></i> Aktifkan Akun
						{/if}
					</button>
				</div>
			</div>
			<dl class="grid grid-cols-2 divide-x divide-slate-100 border-t border-slate-100 text-center">
				<div class="p-4">
					<dt class="text-[10px] font-bold tracking-widest text-slate-400 uppercase">Kursus diikuti</dt>
					<dd class="mt-0.5 text-xl font-extrabold text-slate-900 tabular-nums">{user.enrollmentCount}</dd>
				</div>
				<div class="p-4">
					<dt class="text-[10px] font-bold tracking-widest text-slate-400 uppercase">Sertifikat terbit</dt>
					<dd class="mt-0.5 text-xl font-extrabold text-amber-600 tabular-nums">{user.certificateCount}</dd>
				</div>
			</dl>
		</header>

		<section
			aria-labelledby="peserta-batas"
			class="rounded-2xl border border-dashed border-slate-300 bg-white p-5"
		>
			<h2 id="peserta-batas" class="text-sm font-bold text-slate-800">Cakupan data halaman ini</h2>
			<p class="mt-1 text-xs leading-relaxed text-slate-500">
				Menampilkan identitas dan status akun dari server. Rincian nilai dan progres
				per kursus belum tersedia di API sehingga tidak ditampilkan di sini.
			</p>
		</section>

		<div class="mt-6">
			<a
				href="/admin/peserta"
				class="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-slate-500"
			>
				<i class="fa-solid fa-arrow-left" aria-hidden="true"></i> Kembali ke Peserta
			</a>
		</div>
	{/if}
</div>
