<script lang="ts">
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import WarningModal from '$lib/components/WarningModal.svelte';
	import { formatBytes } from '$lib/types/submission';
	import { BackendRequestError } from '$lib/api/backend';
	import {
		deleteApplicationRequest,
		downloadApplicationFile,
		getApplicationRequest,
		inviteApplicationRequest,
		reviewApplicationRequest,
		type ApplicationStatus,
		type InvitationResult,
		type PengajuanInstruktur
	} from '$lib/api/applications';

	/**
	 * Detail pengajuan minat instruktur (DATA BACKEND NYATA).
	 * K-01: tidak membuat akun; tindak lanjut resmi via undangan
	 * (tombol "Undang 1-klik" atau halaman `/admin/invitations`).
	 */

	const pengajuanId = $derived(page.params.id ?? '');

	let data = $state<PengajuanInstruktur | null>(null);
	let loading = $state(true);
	let notFound = $state(false);
	let notice = $state('');
	let noticeOk = $state(true);
	let copied = $state(false);
	let copiedToken = $state(false);
	let showDelete = $state(false);
	let showInvite = $state(false);
	let actionLoading = $state(false);
	let fotoObjectUrl = $state('');
	let inviteResult = $state<InvitationResult | null>(null);
	let requestSeq = 0;

	function showNotice(message: string, ok: boolean): void {
		notice = message;
		noticeOk = ok;
	}

	function statusBadge(status: ApplicationStatus): string {
		if (status === 'approved') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
		if (status === 'rejected') return 'bg-red-50 text-red-700 border-red-200';
		if (status === 'under_review') return 'bg-blue-50 text-blue-700 border-blue-200';
		return 'bg-amber-50 text-amber-700 border-amber-200';
	}

	function statusLabel(status: ApplicationStatus): string {
		if (status === 'approved') return 'Disetujui';
		if (status === 'rejected') return 'Ditolak';
		if (status === 'under_review') return 'Ditinjau';
		return 'Diajukan';
	}

	function formatDate(iso: string): string {
		try {
			return new Date(iso).toLocaleDateString('id-ID', {
				day: 'numeric',
				month: 'long',
				year: 'numeric'
			});
		} catch {
			return '-';
		}
	}

	function initials(nama: string): string {
		return (
			nama.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?'
		);
	}

	function isUrl(v: string): boolean {
		if (!v.trim()) return false;
		try {
			const u = new URL(v.trim());
			return u.protocol === 'http:' || u.protocol === 'https:';
		} catch {
			return false;
		}
	}

	function errorMessage(e: unknown, fallback: string): string {
		return e instanceof BackendRequestError && e.message ? e.message : fallback;
	}

	async function loadFoto(url: string | null): Promise<void> {
		if (fotoObjectUrl) {
			URL.revokeObjectURL(fotoObjectUrl);
			fotoObjectUrl = '';
		}
		if (!url) return;
		try {
			const blob = await downloadApplicationFile(url);
			fotoObjectUrl = URL.createObjectURL(blob);
		} catch {
			// Foto gagal dimuat — halaman tetap tampil dengan inisial.
		}
	}

	async function load(id: string): Promise<void> {
		const numericId = Number(id);
		if (!Number.isInteger(numericId) || numericId <= 0) {
			data = null;
			notFound = true;
			loading = false;
			return;
		}
		const seq = (requestSeq += 1);
		loading = true;
		notFound = false;
		showNotice('', true);
		try {
			const result = await getApplicationRequest(numericId);
			if (seq !== requestSeq) return;
			data = result;
			inviteResult = null;
			await loadFoto(result.fotoUrl);
		} catch (e) {
			if (seq !== requestSeq) return;
			if (e instanceof BackendRequestError && e.httpStatus === 404) {
				data = null;
				notFound = true;
			} else {
				data = null;
				notFound = true;
				showNotice(errorMessage(e, 'Gagal memuat pengajuan.'), false);
			}
		} finally {
			if (seq === requestSeq) loading = false;
		}
	}

	$effect(() => {
		if (!browser) return;
		const id = pengajuanId;
		void load(id);
		return () => {
			requestSeq += 1;
			if (fotoObjectUrl) {
				URL.revokeObjectURL(fotoObjectUrl);
				fotoObjectUrl = '';
			}
		};
	});

	async function copyEmail(): Promise<void> {
		if (!data) return;
		copied = false;
		try {
			await navigator.clipboard.writeText(data.email);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch {
			showNotice('Gagal menyalin otomatis. Salin manual dari kolom email bila diperlukan.', false);
		}
	}

	async function copyToken(): Promise<void> {
		if (!inviteResult) return;
		copiedToken = false;
		try {
			await navigator.clipboard.writeText(inviteResult.token);
			copiedToken = true;
			setTimeout(() => (copiedToken = false), 2000);
		} catch {
			showNotice('Gagal menyalin token. Salin manual dari kotak token.', false);
		}
	}

	async function unduhCv(): Promise<void> {
		if (!data?.cvUrl) return;
		try {
			const blob = await downloadApplicationFile(data.cvUrl);
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = data.cvName || 'cv.pdf';
			document.body.appendChild(a);
			a.click();
			a.remove();
			setTimeout(() => URL.revokeObjectURL(url), 10_000);
		} catch (e) {
			showNotice(errorMessage(e, 'Gagal mengunduh CV.'), false);
		}
	}

	async function setStatus(status: Exclude<ApplicationStatus, 'submitted'>): Promise<void> {
		if (!data || actionLoading) return;
		actionLoading = true;
		try {
			data = await reviewApplicationRequest(data.id, { status });
			showNotice(
				status === 'approved' ? 'Pengajuan disetujui.' : status === 'rejected' ? 'Pengajuan ditolak.' : 'Pengajuan ditandai sedang ditinjau.',
				true
			);
		} catch (e) {
			showNotice(errorMessage(e, 'Gagal memperbarui status.'), false);
		} finally {
			actionLoading = false;
		}
	}

	async function confirmInvite(): Promise<void> {
		if (!data || actionLoading) return;
		actionLoading = true;
		try {
			const result = await inviteApplicationRequest(data.id);
			data = result.application;
			inviteResult = result.invitation;
			showInvite = false;
			showNotice(
				result.invitation.emailSent
					? `Undangan terkirim ke ${result.invitation.email}. Token juga tersedia di bawah bila perlu disalin manual.`
					: 'Undangan dibuat, tetapi email gagal terkirim. Salin token di bawah dan kirim manual ke pendaftar.',
				result.invitation.emailSent
			);
		} catch (e) {
			showNotice(errorMessage(e, 'Gagal menerbitkan undangan.'), false);
			showInvite = false;
		} finally {
			actionLoading = false;
		}
	}

	async function confirmDelete(): Promise<void> {
		if (!data || actionLoading) return;
		actionLoading = true;
		try {
			const ok = await deleteApplicationRequest(data.id);
			if (ok) {
				showDelete = false;
				await goto('/admin/pengajuan-instruktur');
			}
		} catch (e) {
			showNotice(errorMessage(e, 'Pengajuan tidak dapat dihapus.'), false);
			showDelete = false;
		} finally {
			actionLoading = false;
		}
	}
</script>

<svelte:head>
	<title>
		{data ? `${data.nama} — Detail Pengajuan` : 'Pengajuan tidak ditemukan'} — Admin Aristoteles
	</title>
	<meta name="description" content="Detail pengajuan minat instruktur." />
</svelte:head>

<div class="p-4 sm:p-6 lg:p-8">
	{#if loading}
		<div class="animate-pulse" aria-label="Memuat detail pengajuan">
			<div class="mb-6 h-8 w-64 rounded-xl bg-slate-100"></div>
			<div class="overflow-hidden rounded-2xl border border-slate-200/70 bg-white">
				<div class="h-24 bg-slate-100"></div>
				<div class="space-y-2 p-5 sm:p-6">
					<div class="h-6 w-56 rounded bg-slate-100"></div>
					<div class="h-4 w-40 rounded bg-slate-100"></div>
				</div>
			</div>
		</div>
	{:else if !data || notFound}
		<div class="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-10 text-center">
			<i class="fa-solid fa-triangle-exclamation mb-3 text-3xl text-amber-500" aria-hidden="true"></i>
			<h1 class="text-xl font-bold text-slate-900">Pengajuan tidak ditemukan</h1>
			<p class="mt-1 text-sm text-slate-500">
				ID “{pengajuanId}” tidak terdaftar di database.
			</p>
			<a
				href="/admin/pengajuan-instruktur"
				class="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-teal-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-teal-700 focus-visible:outline-2 focus-visible:outline-teal-600"
			>
				<i class="fa-solid fa-arrow-left" aria-hidden="true"></i> Kembali ke Pengajuan
			</a>
		</div>
	{:else}
		<nav aria-label="Navigasi remah roti" class="mb-4 flex items-center gap-2 text-xs text-slate-500">
			<a href="/admin/pengajuan-instruktur" class="rounded font-semibold text-teal-700 hover:text-teal-800 focus-visible:outline-2 focus-visible:outline-teal-600">Pengajuan</a>
			<i class="fa-solid fa-chevron-right text-[10px] text-slate-300" aria-hidden="true"></i>
			<span aria-current="page" class="truncate font-medium text-slate-700">{data.nama}</span>
		</nav>

		{#if notice}
			<p
				role="status"
				class={`mb-4 flex items-start gap-2 rounded-xl border px-4 py-2.5 text-xs font-semibold ${noticeOk ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700'}`}
			>
				<i class={`fa-solid mt-0.5 shrink-0 ${noticeOk ? 'fa-circle-check' : 'fa-circle-exclamation'}`} aria-hidden="true"></i>
				<span>{notice}</span>
			</p>
		{/if}

		{#if inviteResult}
			<div class="mb-4 rounded-2xl border border-teal-200 bg-teal-50 p-4" role="status">
				<p class="text-xs font-bold text-teal-900">
					Undangan diterbitkan untuk {inviteResult.email}.
					{inviteResult.emailSent
						? 'Email undangan terkirim.'
						: 'Email gagal terkirim — kirim token berikut secara manual.'}
				</p>
				<div class="mt-2 flex flex-wrap items-center gap-2">
					<code class="min-w-0 flex-1 truncate rounded-lg bg-white px-3 py-2 font-mono text-xs text-slate-800">{inviteResult.token}</code>
					<button
						type="button"
						onclick={() => void copyToken()}
						class="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-teal-600 px-3.5 text-[11px] font-bold text-white hover:bg-teal-700 focus-visible:outline-2 focus-visible:outline-teal-600"
					>
						<i class={`fa-solid ${copiedToken ? 'fa-check' : 'fa-copy'}`} aria-hidden="true"></i>
						{copiedToken ? 'Disalin' : 'Salin token'}
					</button>
				</div>
			</div>
		{/if}

		<header class="mb-6 overflow-hidden rounded-2xl border border-slate-200/70 bg-white">
			<div class="h-24 bg-gradient-to-r from-teal-800 via-teal-700 to-cyan-700" aria-hidden="true"></div>
			<div class="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
				{#if fotoObjectUrl}
					<img
						src={fotoObjectUrl}
						alt={`Foto ${data.nama}`}
						class="-mt-12 h-20 w-20 shrink-0 rounded-2xl border-4 border-white object-cover shadow-lg sm:-mt-14"
					/>
				{:else}
					<span
						class="-mt-12 flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-teal-600 text-xl font-extrabold text-white shadow-lg sm:-mt-14"
						aria-hidden="true"
					>
						{initials(data.nama)}
					</span>
				{/if}
				<div class="min-w-0 flex-1">
					<div class="flex flex-wrap items-center gap-2">
						<h1 class="text-xl font-extrabold text-slate-900 sm:text-2xl">{data.nama}</h1>
						<span class="inline-flex items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50 px-2.5 py-0.5 font-mono text-[11px] font-bold text-teal-700">
							{data.code}
						</span>
						<span class={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${statusBadge(data.status)}`}>
							{statusLabel(data.status)}
						</span>
					</div>
					<p class="mt-0.5 truncate text-sm text-slate-500">{data.email}</p>
					<p class="mt-1 text-[11px] text-slate-400">Mengajukan {formatDate(data.createdAt)}</p>
				</div>
				<div class="flex flex-wrap gap-2">
					<button
						type="button"
						onclick={() => void copyEmail()}
						disabled={actionLoading}
						class="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-teal-600 disabled:opacity-60"
					>
						<i class={`fa-solid ${copied ? 'fa-check text-emerald-600' : 'fa-copy'}`} aria-hidden="true"></i>
						{copied ? 'Disalin' : 'Salin email'}
					</button>
					<button
						type="button"
						onclick={() => void setStatus('approved')}
						disabled={actionLoading || data.status === 'approved'}
						class="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-emerald-600 disabled:opacity-60"
					>
						<i class="fa-solid fa-check" aria-hidden="true"></i> Setujui
					</button>
					<button
						type="button"
						onclick={() => void setStatus('rejected')}
						disabled={actionLoading || data.status === 'rejected'}
						class="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-amber-300 px-4 py-2.5 text-xs font-bold text-amber-700 hover:bg-amber-50 focus-visible:outline-2 focus-visible:outline-amber-500 disabled:opacity-60"
					>
						<i class="fa-solid fa-xmark" aria-hidden="true"></i> Tolak
					</button>
					<button
						type="button"
						onclick={() => (showInvite = true)}
						disabled={actionLoading}
						title="Setujui dan terbitkan undangan resmi + kirim email (K-01)"
						class="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-teal-700 focus-visible:outline-2 focus-visible:outline-teal-600 disabled:opacity-60"
					>
						<i class="fa-solid fa-envelope-open-text" aria-hidden="true"></i> Undang 1-klik
					</button>
					<a
						href="/admin/invitations"
						title="Kelola undangan resmi (K-01)"
						class="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-teal-600"
					>
						<i class="fa-solid fa-list" aria-hidden="true"></i> Undangan
					</a>
					<button
						type="button"
						onclick={() => (showDelete = true)}
						disabled={actionLoading}
						class="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-red-200 px-4 py-2.5 text-xs font-bold text-red-600 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-red-500 disabled:opacity-60"
					>
						<i class="fa-solid fa-trash-can" aria-hidden="true"></i> Hapus
					</button>
				</div>
			</div>
		</header>

		<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
			<section aria-labelledby="akun-h" class="rounded-2xl border border-slate-200/70 bg-white p-5">
				<h2 id="akun-h" class="text-sm font-bold text-slate-800">Data akun (sesuai form)</h2>
				<dl class="mt-3 space-y-3 text-sm">
					<div>
						<dt class="text-xs font-bold text-slate-500">Nama Lengkap *</dt>
						<dd class="mt-0.5 text-slate-800">{data.nama}</dd>
					</div>
					<div>
						<dt class="text-xs font-bold text-slate-500">Email *</dt>
						<dd class="mt-0.5 break-all text-slate-800">{data.email}</dd>
					</div>
					<div>
						<dt class="text-xs font-bold text-slate-500">Status peninjauan</dt>
						<dd class="mt-1">
							<span class={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${statusBadge(data.status)}`}>
								{statusLabel(data.status)}
							</span>
						</dd>
					</div>
					{#if data.reviewNote}
						<div>
							<dt class="text-xs font-bold text-slate-500">Catatan peninjau</dt>
							<dd class="mt-0.5 leading-relaxed text-slate-700">{data.reviewNote}</dd>
						</div>
					{/if}
				</dl>
			</section>

			<section aria-labelledby="profil-h" class="rounded-2xl border border-slate-200/70 bg-white p-5">
				<h2 id="profil-h" class="text-sm font-bold text-slate-800">Profil</h2>
				<dl class="mt-3 space-y-3 text-sm">
					<div>
						<dt class="text-xs font-bold text-slate-500">Tentang Kamu</dt>
						<dd class="mt-0.5 leading-relaxed text-slate-700">{data.tentang || '-'}</dd>
					</div>
					<div>
						<dt class="text-xs font-bold text-slate-500">Skill / Keahlian</dt>
						<dd class="mt-0.5 text-slate-700">{data.skill || '-'}</dd>
					</div>
				</dl>
			</section>

			<section aria-labelledby="tautan-h" class="rounded-2xl border border-slate-200/70 bg-white p-5">
				<h2 id="tautan-h" class="text-sm font-bold text-slate-800">Portofolio YouTube & LinkedIn</h2>
				<dl class="mt-3 space-y-3 text-sm">
					<div>
						<dt class="text-xs font-bold text-slate-500">URL Video Tutorial YouTube</dt>
						<dd class="mt-0.5 break-all">
							{#if isUrl(data.youtubeTutorial)}
								<a href={data.youtubeTutorial} target="_blank" rel="noreferrer" class="font-semibold text-teal-700 hover:text-teal-800 focus-visible:outline-2 focus-visible:outline-teal-600">{data.youtubeTutorial}</a>
							{:else}
								<span class="text-slate-400">-</span>
							{/if}
						</dd>
						<p class="mt-0.5 text-[11px] text-slate-400">Contoh mengajar dari pendaftar.</p>
					</div>
					<div>
						<dt class="text-xs font-bold text-slate-500">URL Channel YouTube</dt>
						<dd class="mt-0.5 break-all">
							{#if isUrl(data.youtubeChannel)}
								<a href={data.youtubeChannel} target="_blank" rel="noreferrer" class="font-semibold text-teal-700 hover:text-teal-800 focus-visible:outline-2 focus-visible:outline-teal-600">{data.youtubeChannel}</a>
							{:else}
								<span class="text-slate-400">-</span>
							{/if}
						</dd>
					</div>
					<div>
						<dt class="text-xs font-bold text-slate-500">URL LinkedIn</dt>
						<dd class="mt-0.5 break-all">
							{#if isUrl(data.linkedin)}
								<a href={data.linkedin} target="_blank" rel="noreferrer" class="font-semibold text-teal-700 hover:text-teal-800 focus-visible:outline-2 focus-visible:outline-teal-600">{data.linkedin}</a>
							{:else}
								<span class="text-slate-400">-</span>
							{/if}
						</dd>
					</div>
				</dl>
			</section>

			<section aria-labelledby="referral-h" class="rounded-2xl border border-slate-200/70 bg-white p-5">
				<h2 id="referral-h" class="text-sm font-bold text-slate-800">Referral & foto</h2>
				<dl class="mt-3 space-y-3 text-sm">
					<div>
						<dt class="text-xs font-bold text-slate-500">Email Mentor Referral</dt>
						<dd class="mt-0.5 break-all text-slate-700">{data.referralEmail || '-'}</dd>
						<p class="mt-0.5 text-[11px] text-slate-400">Opsional. Kosong bila tidak ada.</p>
					</div>
					<div>
						<dt class="text-xs font-bold text-slate-500">Foto Profil</dt>
						<dd class="mt-1.5">
							{#if fotoObjectUrl}
								<img
									src={fotoObjectUrl}
									alt={`Foto profil ${data.nama}`}
									class="h-20 w-20 rounded-2xl border border-slate-200 object-cover"
								/>
							{:else}
								<span class="flex h-20 w-20 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-slate-400" aria-hidden="true">
									<i class="fa-solid fa-image text-xl"></i>
								</span>
							{/if}
						</dd>
						<p class="mt-1 text-[11px] text-slate-400">Disimpan di server, hanya admin yang dapat melihat.</p>
					</div>
					<div>
						<dt class="text-xs font-bold text-slate-500">CV (PDF)</dt>
						<dd class="mt-1.5">
							{#if data.cvUrl && data.cvName}
								<div class="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5">
									<i class="fa-solid fa-file-pdf text-lg text-red-500" aria-hidden="true"></i>
									<span class="min-w-0 flex-1">
										<span class="block truncate text-xs font-bold text-slate-800">{data.cvName}</span>
										<span class="block text-[11px] text-slate-500">{formatBytes(data.cvSize)}</span>
									</span>
									<button
										type="button"
										onclick={() => void unduhCv()}
										class="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-teal-600 px-3.5 text-[11px] font-bold text-white hover:bg-teal-700 focus-visible:outline-2 focus-visible:outline-teal-600"
									>
										<i class="fa-solid fa-download" aria-hidden="true"></i> Unduh
									</button>
								</div>
							{:else}
								<span class="text-slate-400">-</span>
							{/if}
						</dd>
						<p class="mt-1 text-[11px] text-slate-400">PDF maks. 5MB, tervalidasi header %PDF di server.</p>
					</div>
				</dl>
			</section>
		</div>

		<section
			aria-labelledby="batas-h"
			class="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white p-5"
		>
			<h2 id="batas-h" class="text-sm font-bold text-slate-800">Cakupan data halaman ini</h2>
			<p class="mt-1 text-xs leading-relaxed text-slate-500">
				Menampilkan pengajuan minat dari database. Bukan akun, tidak membuka
				portal instruktur, dan tidak menggantikan undangan resmi admin (K-01).
			</p>
		</section>

		<div class="mt-6">
			<a
				href="/admin/pengajuan-instruktur"
				class="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-slate-500"
			>
				<i class="fa-solid fa-arrow-left" aria-hidden="true"></i> Kembali ke Pengajuan
			</a>
		</div>
	{/if}
</div>

<WarningModal
	bind:open={showDelete}
	type="danger"
	title="Hapus pengajuan?"
	message={data
		? `Pengajuan ${data.nama} (${data.code}) dihapus permanen dari database beserta berkasnya dan tidak bisa dikembalikan.`
		: 'Pengajuan ini dihapus permanen dari database.'}
	confirmText="Ya, hapus"
	cancelText="Batal"
	loading={actionLoading}
	onconfirm={() => void confirmDelete()}
/>

<WarningModal
	bind:open={showInvite}
	type="info"
	title="Terbitkan undangan?"
	message={data
		? `Setujui pengajuan ${data.nama} dan kirim undangan resmi ke ${data.email}? Undangan juga tercatat di /admin/invitations.`
		: 'Terbitkan undangan resmi untuk pengajuan ini?'}
	confirmText="Ya, undang"
	cancelText="Batal"
	loading={actionLoading}
	onconfirm={() => void confirmInvite()}
/>
