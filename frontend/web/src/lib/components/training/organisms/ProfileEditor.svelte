<script lang="ts">
	import { browser } from '$app/environment';
	import { tick } from 'svelte';
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
	import { toast } from '$lib/stores/toast.svelte';

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
	let phoneCode = $state('+62');
	let phoneNational = $state('');

	/** Kode negara — Indonesia default. */
	const DIAL_CODES = [
		{ code: '+62', country: 'Indonesia' },
		{ code: '+60', country: 'Malaysia' },
		{ code: '+65', country: 'Singapura' },
		{ code: '+673', country: 'Brunei' },
		{ code: '+66', country: 'Thailand' },
		{ code: '+63', country: 'Filipina' },
		{ code: '+84', country: 'Vietnam' },
		{ code: '+855', country: 'Kamboja' },
		{ code: '+856', country: 'Laos' },
		{ code: '+95', country: 'Myanmar' },
		{ code: '+670', country: 'Timor Leste' },
		{ code: '+61', country: 'Australia' },
		{ code: '+81', country: 'Jepang' },
		{ code: '+82', country: 'Korea Selatan' },
		{ code: '+86', country: 'Tiongkok' },
		{ code: '+91', country: 'India' },
		{ code: '+966', country: 'Arab Saudi' },
		{ code: '+971', country: 'UEA' },
		{ code: '+1', country: 'Amerika Serikat' },
		{ code: '+44', country: 'Inggris' },
		{ code: '+31', country: 'Belanda' },
		{ code: '+49', country: 'Jerman' }
	] as const;

	/** Pecah string backend (“+62 812…”, “0812…”, kosong) ke kode + nomor lokal. */
	function splitPhone(raw: string | null | undefined): void {
		const v = (raw ?? '').trim();
		if (!v) {
			phoneCode = '+62';
			phoneNational = '';
			return;
		}
		const digits = v.replace(/[\s\-.()]/g, '');
		const codes = [...DIAL_CODES].sort((a, b) => b.code.length - a.code.length);
		for (const c of codes) {
			if (digits.startsWith(c.code)) {
				phoneCode = c.code;
				phoneNational = digits.slice(c.code.length).replace(/^0/, '');
				return;
			}
		}
		if (v.startsWith('+')) {
			phoneCode = '';
			phoneNational = v;
			return;
		}
		phoneCode = '+62';
		phoneNational = digits.replace(/^0/, '');
	}

	/** Gabung untuk backend: satu string atau null bila kosong. */
	function combinedPhone(): string | null {
		const national = phoneNational.trim();
		if (!national) return null;
		return phoneCode ? `${phoneCode} ${national}` : national;
	}

	/** Nama negara dari awalan kode nomor tersimpan (tampilan saja). */
	function phoneCountry(raw: string | null | undefined): string {
		const v = (raw ?? '').trim();
		if (!v) return '';
		const digits = v.replace(/[\s\-.()]/g, '');
		const codes = [...DIAL_CODES].sort((a, b) => b.code.length - a.code.length);
		for (const c of codes) {
			if (digits.startsWith(c.code)) return c.country;
		}
		return '';
	}

	/* Tanggal lahir sebagai 3 dropdown (pengganti date picker bawaan
	 * yang popup kalendernya tidak bisa di-style). Satu sumber: birthDate ISO. */
	const BIRTH_MONTHS = [
		{ value: '01', label: 'Januari' },
		{ value: '02', label: 'Februari' },
		{ value: '03', label: 'Maret' },
		{ value: '04', label: 'April' },
		{ value: '05', label: 'Mei' },
		{ value: '06', label: 'Juni' },
		{ value: '07', label: 'Juli' },
		{ value: '08', label: 'Agustus' },
		{ value: '09', label: 'September' },
		{ value: '10', label: 'Oktober' },
		{ value: '11', label: 'November' },
		{ value: '12', label: 'Desember' }
	];
	const BIRTH_YEARS: string[] = (() => {
		const current = new Date().getFullYear();
		const out: string[] = [];
		for (let y = current; y >= 1900; y--) out.push(String(y));
		return out;
	})();

	function birthParts(): { y: string; m: string; d: string } {
		const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate);
		return m ? { y: m[1], m: m[2], d: m[3] } : { y: '', m: '', d: '' };
	}

	/** Jumlah hari mengikuti bulan+tahun (kabisat benar). */
	const birthDays = $derived.by(() => {
		const p = birthParts();
		const y = Number(p.y);
		const mo = Number(p.m);
		const count = y > 0 && mo >= 1 && mo <= 12 ? new Date(y, mo, 0).getDate() : 31;
		return Array.from({ length: count }, (_, i) => String(i + 1).padStart(2, '0'));
	});

	function setBirthPart(part: 'y' | 'm' | 'd', value: string): void {
		const next = { ...birthParts(), [part]: value };
		if ((part === 'y' || part === 'm') && next.d) {
			const y = Number(next.y);
			const mo = Number(next.m);
			if (y > 0 && mo >= 1 && mo <= 12) {
				const max = new Date(y, mo, 0).getDate();
				if (Number(next.d) > max) next.d = String(max).padStart(2, '0');
			}
		}
		birthDate = next.y && next.m && next.d ? `${next.y}-${next.m}-${next.d}` : '';
	}
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
	/** Mode ubah khusus bagian Identitas (nama + username) tanpa membuka seluruh form. */
	let editingIdentity = $state(false);
	let coverUploading = $state(false);
	let nameInput: HTMLInputElement | null = $state(null);

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
			toast.error(uploadError);
			return;
		}
		if (file.size > 4 * 1024 * 1024) {
			uploadError = 'Ukuran sampul maksimal 4MB.';
			toast.error(uploadError);
			return;
		}
		coverUploading = true;
		try {
			const up = await uploadFile(file, 'profile_cover');
			profile = await updateMyProfile({ coverFileId: up.id });
		} catch (err) {
			uploadError = err instanceof Error ? err.message : 'Gagal mengunggah sampul.';
			toast.error(uploadError);
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
			toast.error(uploadError);
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
			splitPhone(p.phone);
			gender = p.gender ?? '';
			birthPlace = p.birthPlace ?? '';
			birthDate = p.birthDate ?? '';
		} catch (e) {
			if (my !== loadSeq) return;
			loadError = e instanceof Error ? e.message : 'Gagal memuat profil.';
			toast.error(loadError);
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
		void tick().then(() => nameInput?.focus());
	}

	function cancelEdit(): void {
		editing = false;
		editingIdentity = false;
		saveMessage = '';
		saveOk = false;
		fieldMsgs = {};
		if (profile) {
			name = profile.name;
			username = profile.username;
			splitPhone(profile.phone);
			gender = profile.gender ?? '';
			birthPlace = profile.birthPlace ?? '';
			birthDate = profile.birthDate ?? '';
		}
	}

	function startIdentityEdit(): void {
		editingIdentity = true;
		saveMessage = '';
		saveOk = false;
		fieldMsgs = {};
		void tick().then(() => nameInput?.focus());
	}

	function cancelIdentityEdit(): void {
		editingIdentity = false;
		saveMessage = '';
		saveOk = false;
		fieldMsgs = {};
		if (profile) {
			name = profile.name;
			username = profile.username;
		}
	}

	async function save(e: SubmitEvent): Promise<void> {
		e.preventDefault();
		if (saving || !profile || (!editing && !editingIdentity)) return;
		saving = true;
		saveMessage = '';
		saveOk = false;
		fieldMsgs = {};
		try {
			const bp = birthParts();
			const input: {
				name: string;
				username: string;
				phone: string | null;
				gender: ProfileGender | null;
				birthPlace: string | null;
				birthDate?: string | null;
			} = {
				name: name.trim(),
				username: username.trim(),
				phone: combinedPhone(),
				gender: gender === '' ? null : gender,
				birthPlace: birthPlace.trim() === '' ? null : birthPlace.trim()
			};
			if (bp.y && bp.m && bp.d) {
				input.birthDate = `${bp.y}-${bp.m}-${bp.d}`;
			} else if (!bp.y && !bp.m && !bp.d) {
				// Semua kosong = hapus eksplisit; parsial = jangan kirim
				// agar nilai server tidak terhapus diam-diam.
				input.birthDate = null;
			}
			const updated = await updateMyProfile(input);
			// Jangan percaya respons PATCH untuk tampilan: baca ulang dari
			// server agar data yang tampil = kebenaran server. Bila baca ulang
			// gagal (mis. jaringan putus tepat setelah simpan), pakai respons PATCH.
			try {
				profile = await fetchMyProfile();
			} catch {
				profile = updated;
			}
			name = profile.name;
			username = profile.username;
			splitPhone(profile.phone);
			gender = profile.gender ?? '';
			birthPlace = profile.birthPlace ?? '';
			birthDate = profile.birthDate ?? '';
			saveOk = true;
			saveMessage = 'Profil berhasil diperbarui.';
			editing = false;
			editingIdentity = false;
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
			toast.error(saveMessage);
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
			toast.error(uploadError);
			return;
		}
		if (file.size > 2 * 1024 * 1024) {
			uploadError = 'Ukuran foto maksimal 2MB.';
			toast.error(uploadError);
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
			toast.error(uploadError);
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
		<div class="absolute top-4 right-4 z-10 sm:top-6 sm:right-6">
			{#if !editing}
				<button
					type="button"
					onclick={() => startEdit()}
					class="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 text-xs font-bold text-white backdrop-blur transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-white"
				>
					<i class="fa-solid fa-pen" aria-hidden="true"></i> Edit profil
				</button>
			{:else}
				<button
					type="button"
					onclick={() => cancelEdit()}
					class="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 text-xs font-bold text-white backdrop-blur transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-white"
				>
					<i class="fa-solid fa-xmark" aria-hidden="true"></i> Batal
				</button>
			{/if}
		</div>
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
				<h2 class="text-balance text-xl font-extrabold tracking-tight sm:text-2xl">{profile.name}</h2>
				<div class="mt-2.5 flex flex-wrap items-center justify-center gap-2">
					<span class="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-bold">
						<i class="fa-solid fa-user" aria-hidden="true"></i> {roleLabel(profile.role)}
					</span>
					{#if profile.emailVerified}
						<span class="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/20 px-3 py-1 text-xs font-bold text-emerald-100 ring-1 ring-emerald-300/30">
							<i class="fa-solid fa-circle-check" aria-hidden="true"></i> Email terverifikasi
						</span>
					{/if}
				</div>
				<p class="mt-2 text-sm font-semibold text-white">@{profile.username}</p>
				<p class="mx-auto max-w-full truncate text-xs text-blue-100" title={profile.email}>{profile.email}</p>
				<p class="mt-1.5 text-xs font-medium text-blue-100/80">Anggota sejak {formatDate(profile.createdAt)}</p>
			</div>
			<div class="flex flex-wrap items-center justify-center gap-2">
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
		{#snippet infoRow(icon: string, label: string, value: string, filled = true)}
			<div class="flex items-center gap-3 py-3">
				<span
					class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 ring-1 ring-blue-100"
					aria-hidden="true"
				>
					<i class="fa-solid {icon} text-xs"></i>
				</span>
				<div class="min-w-0">
					<dt class="text-[11px] font-bold tracking-wider text-slate-400 uppercase">{label}</dt>
					<dd
						class="truncate text-sm {filled ? 'font-semibold text-slate-800' : 'font-medium text-slate-400 italic'}"
					>
						{value}
					</dd>
				</div>
			</div>
		{/snippet}
		{#snippet contactView()}
			<section
				aria-labelledby="kontak-view-heading"
				class="overflow-hidden rounded-2xl border border-slate-200/70 bg-white"
			>
				<div class="flex items-center justify-between gap-2 border-b border-slate-100 bg-gradient-to-r from-teal-50/60 to-transparent px-5 py-4 sm:px-6">
					<h3 id="kontak-view-heading" class="flex items-center gap-2.5 text-sm font-extrabold text-slate-900">
						<span class="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-500 text-xs text-white shadow-md shadow-teal-500/25" aria-hidden="true">
							<i class="fa-solid fa-address-book"></i>
						</span>
						Kontak &amp; pribadi
					</h3>
					<span class="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-500">
						<i class="fa-solid fa-lock" aria-hidden="true"></i> Lihat saja
					</span>
				</div>
				<dl class="divide-y divide-slate-100 px-5 sm:px-6">
					{@render infoRow('fa-phone', 'Nomor telepon', profile?.phone ? `${phoneCountry(profile.phone) ? `${phoneCountry(profile.phone)} · ` : ''}${profile.phone}` : 'Belum diisi', !!profile?.phone)}
					{@render infoRow('fa-venus-mars', 'Jenis kelamin', genderLabel(profile?.gender), !!profile?.gender)}
					{@render infoRow('fa-location-dot', 'Tempat lahir', profile?.birthPlace || 'Belum diisi', !!profile?.birthPlace)}
					{@render infoRow('fa-cake-candles', 'Tanggal lahir', profile?.birthDate ? formatDate(profile.birthDate) : 'Belum diisi', !!profile?.birthDate)}
				</dl>
			</section>
		{/snippet}
		{#if !editing && !editingIdentity}
			<!-- Tampil data: tanpa input, tanpa placeholder -->
			<div class="grid grid-cols-1 gap-5 xl:grid-cols-2">
				<section
					aria-labelledby="identitas-view-heading"
					class="overflow-hidden rounded-2xl border border-slate-200/70 bg-white"
				>
					<div class="flex items-center justify-between gap-2 border-b border-slate-100 bg-gradient-to-r from-blue-50/70 to-transparent px-5 py-4 sm:px-6">
						<h3 id="identitas-view-heading" class="flex items-center gap-2.5 text-sm font-extrabold text-slate-900">
							<span class="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-xs text-white shadow-md shadow-blue-600/25" aria-hidden="true">
								<i class="fa-solid fa-id-card"></i>
							</span>
							Identitas
						</h3>
						<button
							type="button"
							onclick={() => startIdentityEdit()}
							class="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-blue-200 bg-white px-3.5 text-xs font-bold text-blue-700 shadow-sm transition-all hover:-translate-y-px hover:bg-blue-50 hover:shadow focus-visible:outline-2 focus-visible:outline-blue-600"
						>
							<i class="fa-solid fa-pen text-[10px]" aria-hidden="true"></i> Ubah identitas
						</button>
					</div>
					<dl class="divide-y divide-slate-100 px-5 sm:px-6">
						{@render infoRow('fa-user', 'Nama lengkap', profile.name)}
						{@render infoRow('fa-at', 'Username', `@${profile.username}`)}
						<div class="flex items-center gap-3 py-3">
							<span
								class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 ring-1 ring-blue-100"
								aria-hidden="true"
							>
								<i class="fa-solid fa-envelope text-xs"></i>
							</span>
							<div class="min-w-0">
								<dt class="text-[11px] font-bold tracking-wider text-slate-400 uppercase">Email (tidak dapat diubah)</dt>
								<dd class="flex flex-wrap items-center gap-2 truncate text-sm font-semibold text-slate-800">
									<span class="truncate">{profile.email}</span>
									{#if profile.emailVerified}
										<span class="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
											<i class="fa-solid fa-check" aria-hidden="true"></i> Terverifikasi
										</span>
									{:else}
										<span class="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
											<i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i> Belum terverifikasi
										</span>
									{/if}
								</dd>
							</div>
						</div>
					</dl>
				</section>
				{@render contactView()}
			</div>
		{:else}
		<!-- Formulir -->
		<form
			onsubmit={save}
			aria-label="Formulir profil"
			class="space-y-5 rounded-2xl border border-slate-200/70 bg-white p-5 sm:p-6"
		>
			<p class="flex items-start gap-2.5 rounded-xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-xs leading-relaxed text-blue-800">
				<i class="fa-solid fa-circle-info mt-0.5 shrink-0" aria-hidden="true"></i>
				<span>
					<strong>Mode ubah aktif</strong> — ubah kolom yang diperlukan, lalu tekan
					<strong>Simpan</strong>.
				</span>
			</p>
			<fieldset aria-labelledby="identitas-heading">
				<div class="flex items-center justify-between gap-2">
					<div class="flex items-center gap-2.5">
						<span class="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-xs text-white shadow-md shadow-blue-600/25" aria-hidden="true">
							<i class="fa-solid fa-id-card"></i>
						</span>
						<div>
							<h3 id="identitas-heading" class="text-sm font-extrabold text-slate-900">1. Identitas</h3>
							<p class="text-[11px] text-slate-500">Nama tampil di sertifikat &amp; header.</p>
						</div>
					</div>
					{#if editingIdentity && !editing}
						<span class="flex items-center gap-2">
							<button
								type="button"
								onclick={() => cancelIdentityEdit()}
								class="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-xs font-bold text-slate-500 transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-slate-500"
							>
								Batal
							</button>
							<button
								type="submit"
								disabled={saving}
								class="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-blue-600 px-4 text-xs font-bold text-white transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-70"
							>
								{#if saving}
									<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i> Menyimpan…
								{:else}
									<i class="fa-solid fa-check" aria-hidden="true"></i> Simpan
								{/if}
							</button>
						</span>
					{/if}
				</div>
				<div class="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
					<div>
						<label for="profile-name" class="mb-1.5 block text-xs font-bold text-slate-700">
							Nama lengkap <span class="text-red-500" aria-hidden="true">*</span>
						</label>
						<div class="relative">
							<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400" aria-hidden="true">
								<i class="fa-solid fa-user text-xs"></i>
							</div>
							<input
								id="profile-name"
								type="text"
								bind:value={name}
								bind:this={nameInput}
								maxlength={100}
								autocomplete="name"
								required
								aria-invalid={fieldMsg('name') !== ''}
								aria-describedby="profile-name-hint"
								class="w-full rounded-xl border border-slate-200 py-2.5 pr-3.5 pl-10 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
							/>
						</div>
						{#if fieldMsg('name')}<p class="mt-1 text-xs font-semibold text-red-600">{fieldMsg('name')}</p>{/if}
						<p id="profile-name-hint" class="mt-1.5 text-[11px] text-slate-500">Wajib — tampil di sertifikat &amp; header.</p>
					</div>
					<div>
						<label for="profile-username" class="mb-1.5 block text-xs font-bold text-slate-700">
							Username <span class="text-red-500" aria-hidden="true">*</span>
						</label>
						<div class="relative">
							<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400" aria-hidden="true">
								<i class="fa-solid fa-at text-xs"></i>
							</div>
							<input
								id="profile-username"
								type="text"
								bind:value={username}
								maxlength={30}
								autocomplete="username"
								required
								aria-invalid={fieldMsg('username') !== ''}
								aria-describedby="profile-username-hint"
								class="w-full rounded-xl border border-slate-200 py-2.5 pr-3.5 pl-10 font-mono text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
							/>
						</div>
						{#if fieldMsg('username')}<p class="mt-1 text-xs font-semibold text-red-600">{fieldMsg('username')}</p>{/if}
						<p id="profile-username-hint" class="mt-1.5 text-[11px] text-slate-500">Wajib — 3–30 karakter: huruf kecil, angka, titik, underscore, strip.</p>
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
				<legend class="flex items-center gap-2.5">
					<span class="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-500 text-xs text-white shadow-md shadow-teal-500/25" aria-hidden="true">
						<i class="fa-solid fa-address-book"></i>
					</span>
					<span>
						<span class="block text-sm font-extrabold text-slate-900">2. Kontak &amp; pribadi</span>
						<span class="block text-[11px] font-normal text-slate-500">Opsional — melengkapi profil &amp; verifikasi.</span>
					</span>
				</legend>
				<div class="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
					<div>
						<span id="profile-phone-label" class="mb-1.5 block text-xs font-bold text-slate-700">Nomor telepon</span>
						<div class="flex gap-2" role="group" aria-labelledby="profile-phone-label">
							<div class="relative w-44 shrink-0">
								<select
									id="profile-phone-code"
									aria-label="Kode negara"
									title="Kode negara"
									bind:value={phoneCode}
									class="min-h-[44px] w-full cursor-pointer appearance-none truncate rounded-xl border border-slate-200 bg-white py-2.5 pr-8 pl-3 text-sm font-semibold focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
								>
									{#each DIAL_CODES as d (d.code)}
										<option value={d.code}>{d.country} ({d.code})</option>
									{/each}
									<option value="">+ Lainnya</option>
								</select>
								<i class="fa-solid fa-chevron-down pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[10px] text-slate-400" aria-hidden="true"></i>
							</div>
							<div class="relative min-w-0 flex-1">
								<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400" aria-hidden="true">
									<i class="fa-solid fa-phone text-xs"></i>
								</div>
								<input
									id="profile-phone"
									type="tel"
									inputmode="tel"
									bind:value={phoneNational}
									maxlength={24}
									autocomplete="tel-national"
									aria-invalid={fieldMsg('phone') !== ''}
									aria-describedby="profile-phone-hint"
									class="w-full rounded-xl border border-slate-200 py-2.5 pr-3.5 pl-10 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
								/>
							</div>
						</div>
						{#if fieldMsg('phone')}<p class="mt-1 text-xs font-semibold text-red-600">{fieldMsg('phone')}</p>{/if}
						<p id="profile-phone-hint" class="mt-1.5 text-[11px] text-slate-500">Opsional — pilih kode negara lalu isi nomor tanpa awalan 0.</p>
					</div>
					<div>
						<label for="profile-gender" class="mb-1.5 block text-xs font-bold text-slate-700">Jenis kelamin</label>
						<div class="relative">
							<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400" aria-hidden="true">
								<i class="fa-solid fa-venus-mars text-xs"></i>
							</div>
							<select
								id="profile-gender"
								bind:value={gender}
								class="w-full cursor-pointer appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pr-9 pl-10 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
							>
								<option value="">Belum diisi</option>
								<option value="L">Laki-laki</option>
								<option value="P">Perempuan</option>
							</select>
							<i class="fa-solid fa-chevron-down pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-[10px] text-slate-400" aria-hidden="true"></i>
						</div>
					</div>
					<div>
						<label for="profile-birthplace" class="mb-1.5 block text-xs font-bold text-slate-700">Tempat lahir</label>
						<div class="relative">
							<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400" aria-hidden="true">
								<i class="fa-solid fa-location-dot text-xs"></i>
							</div>
							<input
								id="profile-birthplace"
								type="text"
								bind:value={birthPlace}
								maxlength={100}
								aria-describedby="profile-birthplace-hint"
								class="w-full rounded-xl border border-slate-200 py-2.5 pr-3.5 pl-10 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
							/>
						</div>
						<p id="profile-birthplace-hint" class="mt-1.5 text-[11px] text-slate-500">Opsional — kota kelahiran.</p>
					</div>
					<div>
						<span id="profile-birthdate-label" class="mb-1.5 block text-xs font-bold text-slate-700">Tanggal lahir</span>
						<div class="grid grid-cols-3 gap-2" role="group" aria-labelledby="profile-birthdate-label" aria-describedby="profile-birthdate-hint">
							<select
								id="profile-birthdate-day"
								aria-label="Tanggal"
								value={birthParts().d}
								onchange={(e) => setBirthPart('d', e.currentTarget.value)}
								class="filter-select filter-select-compact"
							>
								<button type="button">
									<selectedcontent></selectedcontent>
									<i class="fa-solid fa-chevron-down filter-chev" aria-hidden="true"></i>
								</button>
								<option value="">Tgl</option>
								{#each birthDays as d (d)}
									<option value={d}>{d}</option>
								{/each}
							</select>
							<select
								id="profile-birthdate-month"
								aria-label="Bulan"
								value={birthParts().m}
								onchange={(e) => setBirthPart('m', e.currentTarget.value)}
								class="filter-select filter-select-compact"
							>
								<button type="button">
									<selectedcontent></selectedcontent>
									<i class="fa-solid fa-chevron-down filter-chev" aria-hidden="true"></i>
								</button>
								<option value="">Bulan</option>
								{#each BIRTH_MONTHS as mo (mo.value)}
									<option value={mo.value}>{mo.label}</option>
								{/each}
							</select>
							<select
								id="profile-birthdate-year"
								aria-label="Tahun"
								value={birthParts().y}
								onchange={(e) => setBirthPart('y', e.currentTarget.value)}
								class="filter-select filter-select-compact"
							>
								<button type="button">
									<selectedcontent></selectedcontent>
									<i class="fa-solid fa-chevron-down filter-chev" aria-hidden="true"></i>
								</button>
								<option value="">Tahun</option>
								{#each BIRTH_YEARS as y (y)}
									<option value={y}>{y}</option>
								{/each}
							</select>
						</div>
						{#if fieldMsg('birthDate')}<p class="mt-1 text-xs font-semibold text-red-600">{fieldMsg('birthDate')}</p>{/if}
						<p id="profile-birthdate-hint" class="mt-1.5 text-[11px] text-slate-500">Opsional — dipakai verifikasi identitas.</p>
					</div>
				</div>
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
			<div class="sticky bottom-3 rounded-2xl border border-slate-200/80 bg-white/95 p-2 shadow-xl shadow-slate-900/10 backdrop-blur">
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
			</div>
			{/if}
		</form>
		{/if}
{/if}
