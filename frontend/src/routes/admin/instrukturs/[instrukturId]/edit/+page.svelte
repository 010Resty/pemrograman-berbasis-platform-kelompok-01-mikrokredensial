<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { fetchAdminUser, updateAdminUser, type AdminUserDetail } from '$lib/api/admin';

	/**
	 * Ubah instruktur — data backend asli (PATCH /api/v1/admin/users/:id).
	 * Nama/email/keahlian tersimpan permanen + audit; status via isActive yang sama.
	 */

	const instrukturId = $derived(
		Number.isFinite(Number(page.params.instrukturId)) ? Number(page.params.instrukturId) : NaN
	);

	let user = $state<AdminUserDetail | null>(null);
	let isLoading = $state(true);
	let loadError = $state('');
	let formName = $state('');
	let formEmail = $state('');
	let formExpertise = $state('');
	let formStatus = $state<'Aktif' | 'Nonaktif'>('Aktif');
	let formError = $state('');
	let isSubmitting = $state(false);
	let firstField: HTMLInputElement | null = $state(null);

	function messageOf(e: unknown, fallback: string): string {
		return e instanceof Error && e.message ? e.message : fallback;
	}

	async function load(): Promise<void> {
		isLoading = true;
		loadError = '';
		user = null;
		if (Number.isNaN(instrukturId)) {
			isLoading = false;
			return;
		}
		try {
			const detail = await fetchAdminUser(instrukturId);
			if (detail.role !== 'teacher' && detail.role !== 'admin') {
				loadError = `Akun “${detail.email}” bukan instruktur (peran: ${detail.role}).`;
				return;
			}
			user = detail;
			formName = detail.name;
			formEmail = detail.email;
			formExpertise = detail.expertise ?? '';
			formStatus = detail.isActive ? 'Aktif' : 'Nonaktif';
			firstField?.focus();
		} catch (e) {
			loadError = messageOf(e, 'Gagal memuat data instruktur dari backend.');
		} finally {
			isLoading = false;
		}
	}

	onMount(() => {
		void load();
	});

	async function handleSubmit(event: Event) {
		event.preventDefault();
		if (isSubmitting || !user) return;
		formError = '';
		const name = formName.trim();
		const email = formEmail.trim().toLowerCase();
		if (!name) {
			formError = 'Nama lengkap wajib diisi.';
			return;
		}
		if (!email) {
			formError = 'Email wajib diisi.';
			return;
		}
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
			formError = 'Format email tidak valid (contoh: nama@aristoteles.ac.id).';
			return;
		}
		const patch: { name?: string; email?: string; expertise?: string; isActive?: boolean } = {};
		if (name !== user.name) patch.name = name;
		if (email !== user.email.toLowerCase()) patch.email = email;
		const expertise = formExpertise.trim();
		if (expertise !== (user.expertise ?? '')) patch.expertise = expertise;
		const isActive = formStatus === 'Aktif';
		if (isActive !== user.isActive) patch.isActive = isActive;
		if (Object.keys(patch).length === 0) {
			formError = 'Tidak ada perubahan untuk disimpan.';
			return;
		}
		isSubmitting = true;
		try {
			await updateAdminUser(user.id, patch);
			await goto(`/admin/instrukturs/${user.id}`);
		} catch (e) {
			formError = messageOf(e, 'Perubahan gagal disimpan. Coba lagi.');
		} finally {
			isSubmitting = false;
		}
	}
</script>

<svelte:head>
	<title>
		{user ? `Ubah ${user.name}` : 'Instruktur tidak ditemukan'} — Admin Aristoteles
	</title>
	<meta name="description" content="Ubah data instruktur Aristoteles (tersimpan di backend)." />
</svelte:head>

<div class="p-4 sm:p-6 lg:p-8">
	{#if isLoading}
		<p role="status" class="mx-auto max-w-lg p-10 text-center text-sm text-slate-500">
			<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i>
			Memuat data instruktur…
		</p>
	{:else if !user}
		<div class="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-10 text-center">
			<i class="fa-solid fa-triangle-exclamation mb-3 text-3xl text-amber-500" aria-hidden="true"></i>
			<h1 class="text-xl font-bold text-slate-900">Instruktur tidak ditemukan</h1>
			<p class="mt-1 text-sm text-slate-500">
				{loadError || `ID instruktur “${page.params.instrukturId}” tidak terdaftar.`}
			</p>
			<div class="mt-5 flex justify-center gap-2">
				{#if loadError && !loadError.includes('bukan instruktur')}
					<button
						type="button"
						onclick={() => void load()}
						class="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-violet-700 focus-visible:outline-2 focus-visible:outline-violet-600"
					>
						Coba lagi
					</button>
				{/if}
				<a
					href="/admin/instrukturs"
					class="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-violet-700 focus-visible:outline-2 focus-visible:outline-violet-600"
				>
					<i class="fa-solid fa-arrow-left" aria-hidden="true"></i> Kembali ke Instruktur
				</a>
			</div>
		</div>
	{:else}
		<nav aria-label="Navigasi remah roti" class="mb-4 flex items-center gap-2 text-xs text-slate-500">
			<a href="/admin/instrukturs" class="rounded font-semibold text-violet-600 hover:text-violet-700 focus-visible:outline-2 focus-visible:outline-violet-600">
				Instruktur
			</a>
			<i class="fa-solid fa-chevron-right text-[10px] text-slate-300" aria-hidden="true"></i>
			<a
				href={`/admin/instrukturs/${user.id}`}
				class="max-w-40 truncate rounded font-semibold text-violet-600 hover:text-violet-700 focus-visible:outline-2 focus-visible:outline-violet-600"
			>
				{user.name}
			</a>
			<i class="fa-solid fa-chevron-right text-[10px] text-slate-300" aria-hidden="true"></i>
			<span aria-current="page" class="font-medium text-slate-700">Ubah</span>
		</nav>

		<div class="mx-auto max-w-xl">
			<div class="mb-5">
				<p class="text-xs font-bold tracking-widest text-blue-600 uppercase">Admin · Ubah Instruktur</p>
				<h1 class="mt-1 text-2xl font-bold tracking-tight text-slate-900">Ubah {user.name}</h1>
				<p class="mt-1 text-sm text-slate-500">
					Perubahan tersimpan permanen di backend dan tercatat di audit.
				</p>
			</div>

			<form
				onsubmit={handleSubmit}
				novalidate
				aria-label={`Formulir ubah instruktur ${user.name}`}
				class="rounded-2xl border border-slate-200/70 bg-white p-5 sm:p-6"
			>
				{#if formError}
					<p role="alert" class="mb-4 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-semibold text-red-700">
						{formError}
					</p>
				{/if}
				<div class="space-y-3">
					<div>
						<label for="edit-name" class="mb-1 block text-xs font-bold text-slate-700">
							Nama lengkap <span class="text-red-500" aria-hidden="true">*</span>
						</label>
						<input
							id="edit-name"
							type="text"
							bind:this={firstField}
							bind:value={formName}
							required
							autocomplete="name"
							placeholder="cth. Kevin Perry"
							class="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 focus:outline-none"
						/>
					</div>
					<div>
						<label for="edit-email" class="mb-1 block text-xs font-bold text-slate-700">
							Email <span class="text-red-500" aria-hidden="true">*</span>
						</label>
						<input
							id="edit-email"
							type="email"
							bind:value={formEmail}
							required
							autocomplete="email"
							placeholder="nama@aristoteles.ac.id"
							class="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 focus:outline-none"
						/>
						<p class="mt-1 text-[11px] text-slate-400">
							Email dipakai untuk masuk — pastikan alamat baru valid dan belum dipakai akun lain.
						</p>
					</div>
					<div>
						<label for="edit-expertise" class="mb-1 block text-xs font-bold text-slate-700">
							Keahlian <span class="font-normal text-slate-400">(opsional)</span>
						</label>
						<input
							id="edit-expertise"
							type="text"
							bind:value={formExpertise}
							maxlength={100}
							placeholder="cth. Sains Data & AI"
							class="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 focus:outline-none"
						/>
					</div>
					<div>
						<label for="edit-status" class="mb-1 block text-xs font-bold text-slate-700">Status</label>
						<select
							id="edit-status"
							bind:value={formStatus}
							class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-violet-500 focus:outline-none"
						>
							<option value="Aktif">Aktif</option>
							<option value="Nonaktif">Nonaktif</option>
						</select>
					</div>
				</div>
				<div class="mt-5 flex gap-2">
					<a
						href={`/admin/instrukturs/${user.id}`}
						class="inline-flex flex-1 items-center justify-center rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-slate-500"
					>
						Batal
					</a>
					<button
						type="submit"
						disabled={isSubmitting}
						class="flex-1 rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
					>
						{isSubmitting ? 'Menyimpan…' : 'Simpan Perubahan'}
					</button>
				</div>
			</form>
		</div>
	{/if}
</div>
