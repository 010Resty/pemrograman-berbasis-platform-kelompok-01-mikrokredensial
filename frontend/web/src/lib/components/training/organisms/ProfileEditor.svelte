<script lang="ts">
	import { browser } from '$app/environment';
	import {
		fetchMyProfile,
		fieldErrors,
		genderLabel,
		roleLabel,
		updateMyProfile,
		type ProfileGender,
		type UserProfile
	} from '$lib/api/profile';
	import { uploadFile } from '$lib/api/uploads';
	import { fileUrl } from '$lib/api/courses';
	import { refreshSession } from '$lib/stores/auth.svelte';

	/**
	 * Editor profil milik sendiri — dipakai halaman profil ketiga portal
	 * (user/instruktur/admin) dengan `backHref` berbeda. Ambil → ubah → simpan;
	 * foto via unggah avatar (kind=avatar, ≤2MB) lalu tautkan id-nya.
	 */
	let { backHref = '/user' }: { backHref?: string } = $props();

	let profile = $state<UserProfile | null>(null);
	let loading = $state(true);
	let loadError = $state('');
	let started = false;
	let loadSeq = 0;

	let name = $state('');
	let username = $state('');
	let phone = $state('');
	let gender = $state<'' | ProfileGender>('');
	let birthPlace = $state('');
	let birthDate = $state('');

	let saving = $state(false);
	let saveMessage = $state('');
	let saveOk = $state(false);
	let fieldMsgs = $state<Record<string, string>>({});

	let uploading = $state(false);
	let uploadError = $state('');
	let editing = $state(false);
	let coverUploading = $state(false);

	function coverSrc(p: UserProfile | null): string | null {
		if (!p?.coverUrl) return null;
		try {
			return fileUrl(p.coverUrl);
		} catch {
			return null;
		}
	}

	async function chooseCover(e: Event): Promise<void> {
		const input = e.currentTarget as HTMLInputElement | null;
		const file = input?.files?.[0];
		if (input) input.value = '';
		if (!editing || !file || coverUploading) return;
		uploadError = '';
		if (!file.type.startsWith('image/')) {
			uploadError = 'Pilih berkas gambar (JPG/PNG/WebP).';
			return;
		}
		if (file.size > 4 * 1024 * 1024) {
			uploadError = 'Ukuran sampul maksimal 4MB.';
			return;
		}
		coverUploading = true;
		try {
			const up = await uploadFile(file, 'profile_cover');
			profile = await updateMyProfile({ coverFileId: up.id });
		} catch (err) {
			uploadError = err instanceof Error ? err.message : 'Gagal mengunggah sampul.';
		} finally {
			coverUploading = false;
		}
	}

	async function deleteCover(): Promise<void> {
		if (coverUploading) return;
		coverUploading = true;
		uploadError = '';
		try {
			profile = await updateMyProfile({ coverFileId: null });
		} catch (err) {
			uploadError = err instanceof Error ? err.message : 'Gagal menghapus sampul.';
		} finally {
			coverUploading = false;
		}
	}

	function initials(n: string): string {
		return (
			n
				.trim()
				.split(/\s+/)
				.map((w) => w[0])
				.slice(0, 2)
				.join('') || 'PG'
		).toUpperCase();
	}

	function formatDate(iso: string | null): string {
		if (!iso) return '—';
		const d = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
		return Number.isNaN(d.getTime())
			? iso
			: d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
	}

	function avatarSrc(p: UserProfile | null): string | null {
		if (!p?.avatarUrl) return null;
		try {
			return fileUrl(p.avatarUrl);
		} catch {
			return null;
		}
	}

	async function load(): Promise<void> {
		const my = ++loadSeq;
		loading = true;
		loadError = '';
		try {
			const p = await fetchMyProfile();
			if (my !== loadSeq) return;
			profile = p;
			name = p.name;
			username = p.username;
			phone = p.phone ?? '';
			gender = p.gender ?? '';
			birthPlace = p.birthPlace ?? '';
			birthDate = p.birthDate ?? '';
		} catch (e) {
			if (my !== loadSeq) return;
			loadError = e instanceof Error ? e.message : 'Gagal memuat profil.';
		} finally {
			if (my === loadSeq) loading = false;
		}
	}

	$effect(() => {
		if (!browser || started) return;
		started = true;
		void load();
	});

	function fieldMsg(field: string): string {
		return fieldMsgs[field] ?? '';
	}

	function startEdit(): void {
		editing = true;
		saveMessage = '';
		saveOk = false;
		fieldMsgs = {};
	}

	function cancelEdit(): void {
		editing = false;
		saveMessage = '';
		saveOk = false;
		fieldMsgs = {};
		if (profile) {
			name = profile.name;
			username = profile.username;
			phone = profile.phone ?? '';
			gender = profile.gender ?? '';
			birthPlace = profile.birthPlace ?? '';
			birthDate = profile.birthDate ?? '';
		}
	}

	async function save(e: SubmitEvent): Promise<void> {
		e.preventDefault();
		if (saving || !profile || !editing) return;
		saving = true;
		saveMessage = '';
		saveOk = false;
		fieldMsgs = {};
		try {
			const updated = await updateMyProfile({
				name: name.trim(),
				username: username.trim(),
				phone: phone.trim() === '' ? null : phone.trim(),
				gender: gender === '' ? null : gender,
				birthPlace: birthPlace.trim() === '' ? null : birthPlace.trim(),
				birthDate: birthDate === '' ? null : birthDate
			});
			profile = updated;
			saveOk = true;
			saveMessage = 'Profil berhasil diperbarui.';
			editing = false;
			// Selaraskan nama di header/sidebar (sesi dibaca ulang dari /me).
			void refreshSession();
		} catch (err) {
			const fields = fieldErrors(err);
			if (fields.length > 0) {
				const map: Record<string, string> = {};
				for (const f of fields) map[f.field] = f.message;
				fieldMsgs = map;
				saveMessage = 'Periksa kembali isian yang ditandai.';
			} else {
				saveMessage = err instanceof Error ? err.message : 'Gagal menyimpan profil.';
			}
		} finally {
			saving = false;
		}
	}

	async function chooseAvatar(e: Event): Promise<void> {
		const input = e.currentTarget as HTMLInputElement | null;
		const file = input?.files?.[0];
		if (input) input.value = '';
		if (!editing || !file || uploading) return;
		uploadError = '';
		if (!file.type.startsWith('image/')) {
			uploadError = 'Pilih berkas gambar (JPG/PNG/WebP).';
			return;
		}
		if (file.size > 2 * 1024 * 1024) {
			uploadError = 'Ukuran foto maksimal 2MB.';
			return;
		}
		uploading = true;
		try {
			const up = await uploadFile(file, 'avatar');
			const updated = await updateMyProfile({ avatarFileId: up.id });
			profile = updated;
			void refreshSession();
		} catch (err) {
			uploadError = err instanceof Error ? err.message : 'Gagal mengunggah foto.';
		} finally {
			uploading = false;
		}
	}

</script>

{#if loading}
	<div class="space-y-5" aria-label="Memuat profil">
		<div class="h-44 animate-pulse rounded-2xl bg-slate-200"></div>
		<div class="grid grid-cols-1 gap-5 lg:grid-cols-[20rem_minmax(0,1fr)]">
			<div class="h-64 animate-pulse rounded-2xl bg-slate-200"></div>
			<div class="h-96 animate-pulse rounded-2xl bg-slate-200"></div>
		</div>
	</div>
{:else if loadError || !profile}
	<div role="alert" class="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
		<p class="text-sm font-bold text-red-700">Profil belum dapat dimuat</p>
		<p class="mx-auto mt-1 max-w-md text-xs text-red-600">{loadError || 'Data tidak tersedia.'}</p>
		<button
			type="button"
			onclick={() => void load()}
			class="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-red-600"
		>
			<i class="fa-solid fa-rotate-right" aria-hidden="true"></i> Coba lagi
		</button>
	</div>
{:else}
	{@const src = avatarSrc(profile)}
	{@const cover = coverSrc(profile)}
	<!-- Sampul identitas -->
	<section aria-label="Ringkasan profil" class="relative overflow-hidden rounded-2xl bg-navy p-8 text-white sm:p-12">
		{#if cover}
			<img src={cover} alt="" aria-hidden="true" class="absolute inset-0 h-full w-full object-cover" />
			<div class="absolute inset-0 bg-gradient-to-t from-slate-900/85 via-slate-900/45 to-slate-900/25" aria-hidden="true"></div>
		{/if}
		<div class="relative flex flex-col items-center gap-4 text-center">
			<label
				for="avatar-file"
				class="group relative block h-28 w-28 shrink-0 overflow-hidden {editing ? 'cursor-pointer' : 'cursor-default'} rounded-2xl bg-white/15 text-3xl font-extrabold ring-1 ring-white/25 transition-shadow hover:shadow-lg focus-within:ring-4 focus-within:ring-white/40 focus-within:outline-none {uploading ? 'pointer-events-none opacity-70' : ''}"
				title={editing ? 'Ganti foto profil' : 'Foto profil'}
				inert={!editing}
			>
				<span class="sr-only">Ganti foto profil</span>
				<span class="flex h-full w-full items-center justify-center text-3xl font-extrabold" aria-hidden="true">
					{#if src}
						<img src={src} alt="" class="h-full w-full object-cover" />
					{:else}
						{initials(profile.name)}
					{/if}
				</span>
				<span class="absolute right-1.5 bottom-1.5 flex h-9 w-9 items-center justify-center rounded-full bg-white text-blue-700 shadow-md transition-transform group-hover:scale-110 {editing ? '' : 'hidden'}" aria-hidden="true">
					{#if uploading}
						<i class="fa-solid fa-circle-notch fa-spin text-xs"></i>
					{:else}
						<i class="fa-solid fa-paintbrush text-xs"></i>
					{/if}
				</span>
				<input
					id="avatar-file"
					type="file"
					accept="image/jpeg,image/png,image/webp"
					class="sr-only"
					onchange={chooseAvatar}
					disabled={!editing || uploading}
				/>
			</label>
			<div>
				<h2 class="text-xl font-extrabold sm:text-2xl">{profile.name}</h2>
				<div class="mt-2 flex flex-wrap items-center justify-center gap-2">
					<span class="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-bold">
						<i class="fa-solid fa-user" aria-hidden="true"></i> {roleLabel(profile.role)}
					</span>
					{#if profile.emailVerified}
						<span class="inline-flex items-center gap-1 rounded-full bg-emerald-400/20 px-2.5 py-0.5 text-[11px] font-bold text-emerald-100">
<i class="fa-solid fa-circle-check" aria-hidden="true"></i> Email terverifikasi
						</span>
					{/if}
				</div>
				<p class="mt-1 max-w-full truncate text-sm text-blue-100">@{profile.username} · {profile.email}</p>
				<p class="mt-0.5 text-[11px] text-blue-200/80">Anggota sejak {formatDate(profile.createdAt)}</p>
			</div>
			<div class="flex flex-wrap items-center justify-center gap-2">
				{#if !editing}
					<button
						type="button"
						onclick={() => startEdit()}
						class="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-white/25 px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white"
						>
					<i class="fa-solid fa-pen" aria-hidden="true"></i> Edit profil
					</button>
				{/if}
				{#if editing}
					<label
						for="cover-file"
						class="inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-2 rounded-xl border border-white/25 px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-white/10 focus-within:outline-2 focus-within:outline-white {coverUploading ? 'pointer-events-none opacity-70' : ''}"
						>
							<span class="sr-only">Ganti gambar sampul</span>
							{#if coverUploading}
<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i> Mengunggah…
							{:else}
<i class="fa-solid fa-image" aria-hidden="true"></i> Ganti sampul
							{/if}
					</label>
					{#if cover}
						<button type="button" onclick={() => void deleteCover()} disabled={coverUploading} class="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-white/25 px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-60">
							<i class="fa-solid fa-trash-can" aria-hidden="true"></i> Hapus
						</button>
					{/if}
				{/if}
			</div>
			{#if uploadError}
				<p role="alert" class="relative mt-1 w-full rounded-xl bg-red-500/20 px-3.5 py-2 text-center text-xs font-semibold text-red-100">{uploadError}</p>
			{/if}
		</div>
		<input
			id="cover-file"
			type="file"
			accept="image/jpeg,image/png,image/webp"
			class="sr-only"
			onchange={chooseCover}
			disabled={coverUploading}
		/>
</section>
		<!-- Formulir -->
		<form
			onsubmit={save}
			aria-label="Formulir profil"
			class="space-y-5 rounded-2xl border border-slate-200/70 bg-white p-5 sm:p-6"
		>
			<fieldset>
				<legend class="text-sm font-extrabold text-slate-900">Identitas</legend>
				<div class="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
					<div>
						<label for="profile-name" class="mb-1.5 block text-xs font-bold text-slate-700">Nama lengkap</label>
						<input
							id="profile-name"
							type="text"
							bind:value={name}
							maxlength={100}
							autocomplete="name"
							disabled={!editing}
							aria-invalid={fieldMsg('name') !== ''}
							class="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none disabled:border-transparent disabled:bg-transparent disabled:px-0 disabled:font-semibold disabled:text-slate-800"
						/>
						{#if fieldMsg('name')}<p class="mt-1 text-xs font-semibold text-red-600">{fieldMsg('name')}</p>{/if}
					</div>
					<div>
						<label for="profile-username" class="mb-1.5 block text-xs font-bold text-slate-700">Username</label>
						<input
							id="profile-username"
							type="text"
							bind:value={username}
							maxlength={30}
							autocomplete="username"
							disabled={!editing}
							aria-invalid={fieldMsg('username') !== ''}
							class="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 font-mono text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none disabled:border-transparent disabled:bg-transparent disabled:px-0 disabled:font-semibold disabled:text-slate-800"
						/>
						{#if fieldMsg('username')}<p class="mt-1 text-xs font-semibold text-red-600">{fieldMsg('username')}</p>{/if}
					</div>
				</div>
				<div class="mt-4">
					<span class="mb-1.5 block text-xs font-bold text-slate-700">Email (tidak dapat diubah)</span>
					<p class="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 px-3.5 py-2.5 text-sm text-slate-600 ring-1 ring-slate-200">
						<i class="fa-solid fa-envelope text-slate-400" aria-hidden="true"></i> {profile.email}
						{#if profile.emailVerified}
							<span class="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
								<i class="fa-solid fa-check" aria-hidden="true"></i> Terverifikasi
							</span>
						{/if}
					</p>
				</div>
			</fieldset>

			<fieldset>
				<legend class="text-sm font-extrabold text-slate-900">Kontak &amp; pribadi</legend>
				<div class="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
					<div>
						<label for="profile-phone" class="mb-1.5 block text-xs font-bold text-slate-700">Nomor telepon</label>
						<input
							id="profile-phone"
							type="tel"
							bind:value={phone}
							maxlength={30}
							autocomplete="tel"
							disabled={!editing}
							placeholder="Contoh: +62 81234567890"
							aria-invalid={fieldMsg('phone') !== ''}
							class="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none disabled:border-transparent disabled:bg-transparent disabled:px-0 disabled:font-semibold disabled:text-slate-800"
						/>
						{#if fieldMsg('phone')}<p class="mt-1 text-xs font-semibold text-red-600">{fieldMsg('phone')}</p>{/if}
					</div>
					<div>
						<label for="profile-gender" class="mb-1.5 block text-xs font-bold text-slate-700">Jenis kelamin</label>
						<select
							id="profile-gender"
							bind:value={gender}
							disabled={!editing}
							class="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none disabled:border-transparent disabled:bg-transparent disabled:px-0 disabled:font-semibold disabled:text-slate-800"
						>
							<option value="">Belum diisi</option>
							<option value="L">Laki-laki</option>
							<option value="P">Perempuan</option>
						</select>
					</div>
					<div>
						<label for="profile-birthplace" class="mb-1.5 block text-xs font-bold text-slate-700">Tempat lahir</label>
						<input
							id="profile-birthplace"
							type="text"
							bind:value={birthPlace}
							maxlength={100}
							placeholder="Contoh: Bangkalan"
							disabled={!editing}
							class="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none disabled:border-transparent disabled:bg-transparent disabled:px-0 disabled:font-semibold disabled:text-slate-800"
						/>
					</div>
					<div>
						<label for="profile-birthdate" class="mb-1.5 block text-xs font-bold text-slate-700">Tanggal lahir</label>
						<input
							id="profile-birthdate"
							type="date"
							bind:value={birthDate}
							min="1900-01-01"
							disabled={!editing}
							aria-invalid={fieldMsg('birthDate') !== '' || fieldMsg('birthdate') !== ''}
							class="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none disabled:border-transparent disabled:bg-transparent disabled:px-0 disabled:font-semibold disabled:text-slate-800"
						/>
						{#if fieldMsg('birthDate')}<p class="mt-1 text-xs font-semibold text-red-600">{fieldMsg('birthDate')}</p>{/if}
					</div>
				</div>
				<p class="mt-2 text-[11px] text-slate-400">
					Jenis kelamin saat ini: <strong class="text-slate-600">{genderLabel(profile.gender)}</strong>
				</p>
			</fieldset>

			{#if saveMessage}
				<p
					role={saveOk ? 'status' : 'alert'}
					class={`rounded-xl px-3.5 py-2.5 text-xs font-semibold ${saveOk ? 'border border-emerald-200 bg-emerald-50 text-emerald-700' : 'border border-red-200 bg-red-50 text-red-700'}`}
				>
					{saveMessage}
				</p>
			{/if}

			{#if editing}
			<div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
				<button
					type="button"
					class="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 py-2.5 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600"
				onclick={() => cancelEdit()}
				>
					Batal
				</button>
				<button
					type="submit"
					disabled={saving}
					class="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-xs font-bold text-white transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-70"
				>
					{#if saving}
						<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i> Menyimpan…
					{:else}
						<i class="fa-solid fa-floppy-disk" aria-hidden="true"></i> Simpan profil
					{/if}
				</button>
			</div>
			{/if}
		</form>
{/if}
