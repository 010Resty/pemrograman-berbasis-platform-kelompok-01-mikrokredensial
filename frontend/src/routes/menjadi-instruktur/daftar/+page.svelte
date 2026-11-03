<script lang="ts">
	import '../../../app.css';
	import { resolve } from '$app/paths';
	import PublicHeader from '$lib/components/public/PublicHeader.svelte';
	import PublicFooter from '$lib/components/public/PublicFooter.svelte';
	import { reveal } from '$lib/actions/reveal';
	import { submitApplicationRequest, type FilePayload } from '$lib/api/applications';
	import { BackendRequestError } from '$lib/api/backend';
	import { formatBytes } from '$lib/types/submission';

	const MAX_FOTO_BYTES = 2 * 1024 * 1024;
	const FOTO_MIME = ['image/png', 'image/jpeg', 'image/webp'];
	const MAX_CV_BYTES = 5 * 1024 * 1024;

	let nama = $state('');
	let email = $state('');
	let tentang = $state('');
	let skill = $state('');
	let youtubeTutorial = $state('');
	let youtubeChannel = $state('');
	let linkedin = $state('');
	let referralEmail = $state('');
	let fotoPreview = $state('');
	let fotoName = $state('');
	let cvName = $state('');
	let cvSize = $state(0);
	let cvDataUrl = $state('');

	let errors = $state<Record<string, string>>({});
	let formError = $state('');
	let isSubmitting = $state(false);
	let successCode = $state('');
	let successName = $state('');

	const isEmail = (v: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());

	function isUrl(v: string): boolean {
		try {
			const u = new URL(v.trim());
			return u.protocol === 'http:' || u.protocol === 'https:';
		} catch {
			return false;
		}
	}

	function isYoutube(v: string): boolean {
		if (!isUrl(v)) return false;
		const host = new URL(v.trim()).hostname.toLowerCase().replace(/^www\./, '');
		return host === 'youtube.com' || host === 'youtu.be' || host.endsWith('.youtube.com');
	}

	function isLinkedin(v: string): boolean {
		if (!isUrl(v)) return false;
		return new URL(v.trim()).hostname.toLowerCase().replace(/^www\./, '') === 'linkedin.com';
	}

	async function handleFoto(file: File | undefined): Promise<void> {
		errors = { ...errors, foto: '' };
		fotoPreview = '';
		fotoName = '';
		if (!file) return;
		const ext = file.name.split('.').pop()?.toLowerCase();
		if (!FOTO_MIME.includes(file.type) || !['png', 'jpg', 'jpeg', 'webp'].includes(ext ?? '')) {
			errors = { ...errors, foto: 'Format foto harus PNG, JPG, atau WEBP.' };
			return;
		}
		if (file.size > MAX_FOTO_BYTES) {
			errors = { ...errors, foto: 'Ukuran foto maksimal 2MB.' };
			return;
		}
		try {
			const bitmap = await createImageBitmap(file);
			const side = Math.min(bitmap.width, bitmap.height);
			const canvas = document.createElement('canvas');
			canvas.width = 256;
			canvas.height = 256;
			const ctx = canvas.getContext('2d');
			if (!ctx) throw new Error('canvas tidak tersedia');
			ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, 256, 256);
			bitmap.close();
			fotoPreview = canvas.toDataURL('image/jpeg', 0.85);
			fotoName = file.name;
		} catch {
			errors = { ...errors, foto: 'Foto tidak dapat dibaca. Coba berkas lain.' };
		}
	}

	async function handleCv(file: File | undefined): Promise<void> {
		errors = { ...errors, cv: '' };
		cvName = '';
		cvSize = 0;
		cvDataUrl = '';
		if (!file) return;
		if (!file.name.toLowerCase().endsWith('.pdf')) {
			errors = { ...errors, cv: 'Hanya file berekstensi .pdf yang diterima.' };
			return;
		}
		if (file.type && file.type !== 'application/pdf' && file.type !== 'application/octet-stream') {
			errors = { ...errors, cv: `Tipe file "${file.type}" ditolak. Pilih PDF asli.` };
			return;
		}
		if (file.size === 0) {
			errors = { ...errors, cv: 'File kosong. Pilih PDF yang valid.' };
			return;
		}
		if (file.size > MAX_CV_BYTES) {
			errors = { ...errors, cv: `Ukuran ${formatBytes(file.size)} melebihi batas ${formatBytes(MAX_CV_BYTES)}.` };
			return;
		}
		try {
			const head = new Uint8Array(await file.slice(0, 5).arrayBuffer());
			const isPdf =
				head.length >= 5 &&
				head[0] === 0x25 &&
				head[1] === 0x50 &&
				head[2] === 0x44 &&
				head[3] === 0x46 &&
				head[4] === 0x2d;
			if (!isPdf) {
				errors = { ...errors, cv: 'File tidak valid: header %PDF tidak ditemukan.' };
				return;
			}
		} catch {
			errors = { ...errors, cv: 'Gagal membaca file. Coba lagi.' };
			return;
		}
		try {
			cvDataUrl = await new Promise<string>((resolvePromise, rejectPromise) => {
				const reader = new FileReader();
				reader.onerror = () => rejectPromise(new Error('gagal baca'));
				reader.onload = () => resolvePromise(typeof reader.result === 'string' ? reader.result : '');
				reader.readAsDataURL(file);
			});
			if (!cvDataUrl) throw new Error('gagal baca');
			cvName = file.name;
			cvSize = file.size;
		} catch {
			errors = { ...errors, cv: 'CV tidak dapat dibaca. Coba berkas lain.' };
			cvName = '';
			cvSize = 0;
			cvDataUrl = '';
		}
	}

	function hapusCv(): void {
		errors = { ...errors, cv: '' };
		cvName = '';
		cvSize = 0;
		cvDataUrl = '';
	}

	function validate(): boolean {
		const e: Record<string, string> = {};
		if (nama.trim().length < 3) e.nama = 'Masukkan nama lengkap (min. 3 karakter).';
		if (!isEmail(email)) e.email = 'Masukkan alamat email yang valid.';
		if (tentang.trim().length > 1000) e.tentang = 'Maksimal 1000 karakter.';
		if (youtubeTutorial.trim() && !isYoutube(youtubeTutorial)) {
			e.youtubeTutorial = 'Masukkan tautan YouTube yang valid (youtube.com/youtu.be).';
		}
		if (youtubeChannel.trim() && !isYoutube(youtubeChannel)) {
			e.youtubeChannel = 'Masukkan tautan channel YouTube yang valid.';
		}
		if (linkedin.trim() && !isLinkedin(linkedin)) {
			e.linkedin = 'Masukkan tautan profil LinkedIn yang valid (linkedin.com).';
		}
		if (referralEmail.trim() && !isEmail(referralEmail)) {
			e.referralEmail = 'Masukkan alamat email referral yang valid.';
		}
		errors = e;
		return Object.keys(e).length === 0;
	}

	function mimeFromDataUrl(dataUrl: string, fallback: string): string {
		const match = /^data:([^;,]+)[;,]/.exec(dataUrl);
		return match?.[1] ?? fallback;
	}

	async function ajukan(event: Event): Promise<void> {
		event.preventDefault();
		formError = '';
		if (isSubmitting) return;
		if (!validate()) {
			formError = 'Periksa kembali kolom bertanda merah di bawah ini.';
			return;
		}
		isSubmitting = true;
		try {
			const foto: FilePayload | undefined = fotoPreview
				? {
						filename: fotoName || 'foto.jpg',
						mimeType: mimeFromDataUrl(fotoPreview, 'image/jpeg'),
						data: fotoPreview
					}
				: undefined;
			const cv: FilePayload | undefined = cvDataUrl
				? {
						filename: cvName || 'cv.pdf',
						mimeType: 'application/pdf',
						data: cvDataUrl
					}
				: undefined;
			const saved = await submitApplicationRequest({
				nama: nama.trim(),
				email: email.trim(),
				tentang: tentang.trim(),
				skill: skill.trim(),
				youtubeTutorial: youtubeTutorial.trim(),
				youtubeChannel: youtubeChannel.trim(),
				linkedin: linkedin.trim(),
				referralEmail: referralEmail.trim(),
				...(foto ? { foto } : {}),
				...(cv ? { cv } : {})
			});
			successCode = saved.code;
			successName = saved.nama;
			window.scrollTo({ top: 0, behavior: 'smooth' });
		} catch (e) {
			formError =
				e instanceof BackendRequestError && e.message
					? e.message
					: 'Pengajuan gagal dikirim. Periksa koneksi lalu coba lagi.';
		} finally {
			isSubmitting = false;
		}
	}

	function fieldClass(hasError: boolean): string {
		return `w-full rounded-xl border bg-white px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 transition-colors duration-200 focus:outline-none focus:ring-2 ${
			hasError
				? 'border-red-400 focus:border-red-500 focus:ring-red-500/15'
				: 'border-mist focus:border-royal focus:ring-royal/20'
		}`;
	}
</script>

<svelte:head>
	<title>Daftar Menjadi Mentor — ARISTOTELES</title>
	<meta
		name="description"
		content="Formulir pengajuan minat menjadi mentor/instruktur ARISTOTELES. Pengajuan ditinjau admin; akun resmi diterbitkan melalui undangan."
	/>
</svelte:head>

<PublicHeader active="menjadi-instruktur" />

<main class="bg-white">
	<section class="relative overflow-hidden">
		<div class="pointer-events-none absolute inset-0" aria-hidden="true">
			<div class="absolute -top-24 left-1/2 h-64 w-[42rem] -translate-x-1/2 rounded-full bg-ice blur-3xl"></div>
		</div>
		<div class="relative mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-16">
			<a href={resolve('/menjadi-instruktur')} class="inline-flex items-center gap-2 font-heading text-sm font-bold text-royal transition-colors duration-200 hover:text-royal-hover focus-visible:outline-2 focus-visible:outline-royal">
				<i class="fa-solid fa-arrow-left text-xs" aria-hidden="true"></i>
				Kembali ke halaman promosi instruktur
			</a>

			{#if successCode}
				<div use:reveal role="status" class="mt-6 rounded-2xl border border-teal/30 bg-teal/5 p-8 text-center sm:p-10">
					<span class="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-teal/15 text-xl text-teal" aria-hidden="true">
						<i class="fa-solid fa-check"></i>
					</span>
					<h1 class="mt-4 font-heading text-2xl font-extrabold tracking-tight text-abyss sm:text-3xl">
						Pengajuan diterima
					</h1>
					<p class="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-600">
						Terima kasih, {successName}. Pengajuan minatmu tercatat dengan kode
						<span class="font-mono font-bold text-abyss">{successCode}</span>.
					</p>
					<div role="note" class="mx-auto mt-4 max-w-md rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs leading-relaxed font-semibold text-blue-800">
						Pengajuan tersimpan di server. Admin akan
						meninjau pengajuan; akun instruktur resmi diterbitkan melalui undangan bila
						memenuhi syarat.
					</div>
					<a
						href={resolve('/menjadi-instruktur')}
						class="mt-6 inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-abyss px-8 font-heading text-sm font-bold text-white transition-colors duration-200 hover:bg-royal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal"
					>
						Kembali ke halaman promosi instruktur
					</a>
				</div>
			{:else}
				<p class="mt-6 flex items-center gap-3 font-heading text-xs font-bold tracking-[0.18em] text-royal uppercase">
					<span class="h-px w-8 bg-royal" aria-hidden="true"></span>
					Pengajuan Instruktur
				</p>
				<h1 class="mt-3 font-heading text-3xl font-extrabold tracking-tight text-abyss sm:text-4xl">
					Daftar Menjadi Mentor
				</h1>
				<p class="mt-2 max-w-xl text-sm leading-relaxed text-slate-600 sm:text-base">
					Lengkapi formulir di bawah ini untuk mengajukan pendaftaran sebagai mentor.
				</p>
				<p class="mt-3 max-w-xl rounded-xl border border-mist bg-ice/60 px-4 py-2.5 text-xs leading-relaxed text-slate-600">
					Formulir ini mencatat <strong class="text-abyss">pengajuan minat</strong>, bukan pembuatan
					akun instan. Akun instruktur resmi diterbitkan melalui undangan admin setelah peninjauan.
				</p>

				<form use:reveal class="mt-8 space-y-5 rounded-2xl border border-mist bg-white p-6 shadow-xl shadow-slate-900/5 sm:p-8" onsubmit={ajukan} novalidate>
					{#if formError}
						<p role="alert" class="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-700">{formError}</p>
					{/if}

					<div>
						<label for="nama" class="mb-1.5 block font-heading text-xs font-bold text-abyss">Nama Lengkap <span class="text-red-600" aria-hidden="true">*</span></label>
						<input id="nama" type="text" bind:value={nama} placeholder="Masukkan nama lengkap" autocomplete="name" aria-required="true" aria-invalid={!!errors.nama} class={fieldClass(!!errors.nama)} />
						{#if errors.nama}<p role="alert" class="mt-1 text-xs font-semibold text-red-600">{errors.nama}</p>{/if}
					</div>

					<div>
						<label for="email" class="mb-1.5 block font-heading text-xs font-bold text-abyss">Email <span class="text-red-600" aria-hidden="true">*</span></label>
						<input id="email" type="email" bind:value={email} placeholder="Masukkan email" autocomplete="email" aria-required="true" aria-invalid={!!errors.email} class={fieldClass(!!errors.email)} />
						{#if errors.email}<p role="alert" class="mt-1 text-xs font-semibold text-red-600">{errors.email}</p>{/if}
					</div>

					<div>
						<label for="tentang" class="mb-1.5 block font-heading text-xs font-bold text-abyss">Tentang Kamu</label>
						<textarea id="tentang" bind:value={tentang} rows={4} maxlength={1000} placeholder="Ceritakan sedikit tentang dirimu" aria-invalid={!!errors.tentang} class={`${fieldClass(!!errors.tentang)} resize-y`}></textarea>
						{#if errors.tentang}<p role="alert" class="mt-1 text-xs font-semibold text-red-600">{errors.tentang}</p>{/if}
					</div>

					<div>
						<label for="skill" class="mb-1.5 block font-heading text-xs font-bold text-abyss">Skill / Keahlian</label>
						<input id="skill" type="text" bind:value={skill} placeholder="Contoh: Web Developer, UI/UX Designer" autocomplete="off" class={fieldClass(false)} />
					</div>

					<div>
						<label for="yt-tutorial" class="mb-1.5 block font-heading text-xs font-bold text-abyss">URL Video Tutorial YouTube</label>
						<input id="yt-tutorial" type="url" bind:value={youtubeTutorial} inputmode="url" placeholder="https://youtube.com/watch?v=..." autocomplete="off" aria-invalid={!!errors.youtubeTutorial} class={fieldClass(!!errors.youtubeTutorial)} />
						{#if errors.youtubeTutorial}<p role="alert" class="mt-1 text-xs font-semibold text-red-600">{errors.youtubeTutorial}</p>{/if}
						<p class="mt-1 text-xs text-slate-500">Paste link video tutorial YouTube kamu sebagai contoh mengajar</p>
					</div>

					<div class="grid grid-cols-1 gap-5 sm:grid-cols-2">
						<div>
							<label for="yt-channel" class="mb-1.5 block font-heading text-xs font-bold text-abyss">URL Channel YouTube</label>
							<input id="yt-channel" type="url" bind:value={youtubeChannel} inputmode="url" placeholder="https://youtube.com/@channelkamu" autocomplete="off" aria-invalid={!!errors.youtubeChannel} class={fieldClass(!!errors.youtubeChannel)} />
							{#if errors.youtubeChannel}<p role="alert" class="mt-1 text-xs font-semibold text-red-600">{errors.youtubeChannel}</p>{/if}
						</div>
						<div>
							<label for="linkedin" class="mb-1.5 block font-heading text-xs font-bold text-abyss">URL LinkedIn</label>
							<input id="linkedin" type="url" bind:value={linkedin} inputmode="url" placeholder="https://linkedin.com/in/usernamekamu" autocomplete="off" aria-invalid={!!errors.linkedin} class={fieldClass(!!errors.linkedin)} />
							{#if errors.linkedin}<p role="alert" class="mt-1 text-xs font-semibold text-red-600">{errors.linkedin}</p>{/if}
						</div>
					</div>

					<div>
						<label for="referral" class="mb-1.5 block font-heading text-xs font-bold text-abyss">Email Mentor Referral</label>
						<input id="referral" type="email" bind:value={referralEmail} placeholder="Email mentor yang mereferensikan kamu (opsional)" autocomplete="off" aria-invalid={!!errors.referralEmail} class={fieldClass(!!errors.referralEmail)} />
						{#if errors.referralEmail}<p role="alert" class="mt-1 text-xs font-semibold text-red-600">{errors.referralEmail}</p>{/if}
						<p class="mt-1 text-xs text-slate-500">Isi jika kamu direferensikan oleh mentor lain. Kosongkan jika tidak ada.</p>
					</div>

					<div>
						<span id="foto-label" class="mb-1.5 block font-heading text-xs font-bold text-abyss">Foto Profil</span>
						<div class="flex items-center gap-4" role="group" aria-labelledby="foto-label">
							{#if fotoPreview}
								<img src={fotoPreview} alt="Pratinjau foto profil persegi" class="h-20 w-20 shrink-0 rounded-2xl border border-mist object-cover" />
							{:else}
								<span class="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border border-dashed border-mist bg-ice/60 text-slate-400" aria-hidden="true">
									<i class="fa-solid fa-image text-xl"></i>
								</span>
							{/if}
							<div class="min-w-0">
								<label for="foto" class="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border border-mist bg-white px-5 font-heading text-xs font-bold text-abyss transition-colors duration-200 hover:border-royal hover:text-royal focus-visible:outline-2 focus-visible:outline-royal">
									<i class="fa-solid fa-upload" aria-hidden="true"></i> Pilih foto
								</label>
								<input id="foto" type="file" accept="image/png,image/jpeg,image/webp" class="sr-only" onchange={(e) => void handleFoto(e.currentTarget.files?.[0])} />
								<p class="mt-1.5 truncate text-xs text-slate-500">{fotoName || 'No file chosen'}</p>
							</div>
						</div>
						{#if errors.foto}<p role="alert" class="mt-1 text-xs font-semibold text-red-600">{errors.foto}</p>{/if}
						<p class="mt-1 text-xs text-slate-500">Format: PNG, JPG, WEBP. Maks. 2MB. Foto akan dipotong persegi.</p>
					</div>

					<div>
						<span id="cv-label" class="mb-1.5 block font-heading text-xs font-bold text-abyss">CV (PDF)</span>
						<div class="flex items-center gap-4" role="group" aria-labelledby="cv-label">
							<span class="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border border-dashed border-mist bg-ice/60 text-slate-400" aria-hidden="true">
								<i class="fa-solid fa-file-pdf text-xl"></i>
							</span>
							<div class="min-w-0 flex-1">
								<div class="flex flex-wrap items-center gap-2">
									<label for="cv" class="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border border-mist bg-white px-5 font-heading text-xs font-bold text-abyss transition-colors duration-200 hover:border-royal hover:text-royal focus-visible:outline-2 focus-visible:outline-royal">
										<i class="fa-solid fa-upload" aria-hidden="true"></i> Pilih CV
									</label>
									{#if cvName}
										<button
											type="button"
											onclick={hapusCv}
											aria-label={`Hapus CV ${cvName}`}
											class="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-red-200 px-4 text-xs font-bold text-red-600 transition-colors hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-red-500"
										>
											<i class="fa-solid fa-trash-can" aria-hidden="true"></i> Hapus
										</button>
									{/if}
								</div>
								<input id="cv" type="file" accept=".pdf,application/pdf" class="sr-only" onchange={(e) => void handleCv(e.currentTarget.files?.[0])} aria-invalid={!!errors.cv} aria-describedby="cv-hint" />
								<p class="mt-1.5 truncate text-xs text-slate-500">
									{cvName ? `${cvName} · ${formatBytes(cvSize)}` : 'No file chosen'}
								</p>
							</div>
						</div>
						{#if errors.cv}<p role="alert" class="mt-1 text-xs font-semibold text-red-600">{errors.cv}</p>{/if}
						<p id="cv-hint" class="mt-1 text-xs text-slate-500">Format wajib PDF, maks. {formatBytes(MAX_CV_BYTES)}. Header %PDF dicek otomatis.</p>
					</div>

					<button
						type="submit"
						disabled={isSubmitting}
						class="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-royal px-8 font-heading text-sm font-bold text-white transition-colors duration-200 hover:bg-royal-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal disabled:cursor-not-allowed disabled:opacity-70"
					>
						{#if isSubmitting}
							<i class="fa-solid fa-circle-notch fa-spin text-xs" aria-hidden="true"></i>
							Mengirim...
						{:else}
							<i class="fa-solid fa-paper-plane text-xs" aria-hidden="true"></i>
							Ajukan Pendaftaran
						{/if}
					</button>
					<p class="text-center text-xs leading-relaxed text-slate-500">
						Dengan mengajukan, kamu memahami bahwa ini adalah pengajuan minat,
						bukan pembuatan akun.
					</p>
				</form>
			{/if}
		</div>
	</section>
</main>

<PublicFooter />
