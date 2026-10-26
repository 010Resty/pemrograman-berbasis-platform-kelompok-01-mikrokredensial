<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { getInstructor, isEmailTaken, updateInstructor } from '$lib/stores/instructors';

	const instrukturId = $derived(Number.isFinite(Number(page.params.instrukturId)) ? Number(page.params.instrukturId) : NaN);
	const existing = $derived(Number.isNaN(instrukturId) ? undefined : getInstructor(instrukturId));

	let formName = $state('');
	let formEmail = $state('');
	let formExpertise = $state('');
	let formStatus = $state<'Aktif' | 'Nonaktif'>('Aktif');
	let formError = $state('');
	let isSubmitting = $state(false);
	let firstField: HTMLInputElement | null = $state(null);
	let initializedFor: number | null = $state(null);

	$effect(() => {
		if (!existing || initializedFor === existing.id) return;
		formName = existing.name;
		formEmail = existing.email;
		formExpertise = existing.expertise;
		formStatus = existing.status;
		formError = '';
		isSubmitting = false;
		initializedFor = existing.id;
		firstField?.focus();
	});

	function handleSubmit(event: Event) {
		event.preventDefault();
		if (isSubmitting || !existing) return;
		formError = '';
		const name = formName.trim();
		const email = formEmail.trim();
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
		if (isEmailTaken(email, existing.id)) {
			formError = 'Email sudah dipakai instruktur lain.';
			return;
		}
		isSubmitting = true;
		const ok = updateInstructor(existing.id, {
			name,
			email,
			expertise: formExpertise.trim() || 'Umum',
		status: formStatus
		});
		isSubmitting = false;
		if (!ok) {
			formError = 'Perubahan gagal disimpan. Coba lagi.';
			return;
		}
		goto(`/admin/instrukturs/${existing.id}`);
	}
</script>

<svelte:head>
	<title>
		{existing ? `Ubah ${existing.name}` : 'Instruktur tidak ditemukan'} — Admin Aristoteles
	</title>
	<meta name="description" content="Ubah data instruktur Aristoteles." />
</svelte:head>

<div class="p-4 sm:p-6 lg:p-8">
	{#if !existing}
		<div class="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-10 text-center">
			<i class="fa-solid fa-triangle-exclamation mb-3 text-3xl text-amber-500" aria-hidden="true"></i>
			<h1 class="text-xl font-bold text-slate-900">Instruktur tidak ditemukan</h1>
			<p class="mt-1 text-sm text-slate-500">
				ID instruktur “{page.params.instrukturId}” tidak terdaftar.
			</p>
			<a
				href="/admin/instrukturs"
				class="mt-5 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-violet-700 focus-visible:outline-2 focus-visible:outline-violet-600"
			>
				<i class="fa-solid fa-arrow-left" aria-hidden="true"></i> Kembali ke Instruktur
			</a>
		</div>
	{:else}
		<nav aria-label="Navigasi remah roti" class="mb-4 flex items-center gap-2 text-xs text-slate-500">
			<a href="/admin/instrukturs" class="rounded font-semibold text-violet-600 hover:text-violet-700 focus-visible:outline-2 focus-visible:outline-violet-600">
				Instruktur
			</a>
			<i class="fa-solid fa-chevron-right text-[10px] text-slate-300" aria-hidden="true"></i>
			<a
				href={`/admin/instrukturs/${existing.id}`}
				class="max-w-40 truncate rounded font-semibold text-violet-600 hover:text-violet-700 focus-visible:outline-2 focus-visible:outline-violet-600"
			>
				{existing.name}
			</a>
			<i class="fa-solid fa-chevron-right text-[10px] text-slate-300" aria-hidden="true"></i>
			<span aria-current="page" class="font-medium text-slate-700">Ubah</span>
		</nav>

		<div class="mx-auto max-w-xl">
			<div class="mb-5">
				<p class="text-xs font-bold tracking-widest text-blue-600 uppercase">Admin · Ubah Instruktur</p>
				<h1 class="mt-1 text-2xl font-bold tracking-tight text-slate-900">Ubah {existing.name}</h1>
				<p class="mt-1 text-sm text-slate-500">
					Perubahan tersimpan sementara di browser (demo) dan belum tersimpan permanen.
				</p>
			</div>

			<form
				onsubmit={handleSubmit}
				novalidate
				aria-label={`Formulir ubah instruktur ${existing.name}`}
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
					</div>
					<div>
						<label for="edit-expertise" class="mb-1 block text-xs font-bold text-slate-700">Keahlian</label>
						<input
							id="edit-expertise"
							type="text"
							bind:value={formExpertise}
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
						href={`/admin/instrukturs/${existing.id}`}
						class="inline-flex flex-1 items-center justify-center rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-slate-500"
					>
						Batal
					</a>
					<button
						type="submit"
						disabled={isSubmitting}
						class="flex-1 rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
					>
						Simpan Perubahan
					</button>
				</div>
			</form>
		</div>
	{/if}
</div>
