<script lang="ts">
	import '../../../app.css';
	import { browser } from '$app/environment';
	import { resolve } from '$app/paths';
	import PublicHeader from '$lib/components/public/PublicHeader.svelte';
	import PublicFooter from '$lib/components/public/PublicFooter.svelte';
	import SeoHead from '$lib/components/SeoHead.svelte';
	import { reveal } from '$lib/actions/reveal';
	import {
		adminCancelPatunganGroup,
		cancelPatunganGroup,
		fetchPatunganGroup,
		type PatunganGroupDetail
	} from '$lib/api/patungan';
	import { attachPaymentProof, createPayment, type MyPayment } from '$lib/api/payments';
	import { getAccessToken, getCurrentUser } from '$lib/stores/auth.svelte';
	import { formatIDR } from '$lib/data/payment';

	let { data, params }: { data: { origin: string }; params: { groupId: string } } = $props();

	// svelte-ignore state_referenced_locally -- id rute statis per navigasi; reload halaman bila berpindah grup
	const groupId = Number(params.groupId);

	let group = $state<PatunganGroupDetail | null>(null);
	let loadError = $state('');
	let loading = $state(true);

	let myPayment = $state<MyPayment | null>(null);
	let proofFile = $state<File | null>(null);
	let uploading = $state(false);
	let payError = $state('');
	let payBusy = $state(false);
	let cancelReason = $state('');
	let cancelBusy = $state(false);

	const me = $derived(getCurrentUser());
	const myMembership = $derived(group?.members.find((m) => m.username === me?.username) ?? null);
	const isCreator = $derived(group !== null && group.createdBy !== null && myMembership?.position === 0);
	const isAdmin = $derived(me?.role === 'admin');
	const canCancel = $derived(
		group?.status === 'pending' &&
			(isAdmin || (isCreator && (group?.members.every((m) => m.paymentStatus === 'unpaid') ?? false)))
	);

	const STATUS_LABEL: Record<string, string> = {
		unpaid: 'Belum bayar',
		menunggu: 'Menunggu verifikasi',
		diverifikasi: 'Lunas',
		ditolak: 'Ditolak'
	};

	async function load(): Promise<void> {
		loading = true;
		loadError = '';
		try {
			group = await fetchPatunganGroup(groupId);
			myPayment = null;
			proofFile = null;
			payError = '';
		} catch (e) {
			loadError = e instanceof Error ? e.message : 'Gagal memuat grup.';
		} finally {
			loading = false;
		}
	}

	async function startPay(): Promise<void> {
		payError = '';
		if (!group) return;
		payBusy = true;
		try {
			myPayment = await createPayment(group.course.id, { patunganGroupId: group.id });
		} catch (e) {
			payError = e instanceof Error ? e.message : 'Gagal membuat iuran.';
		} finally {
			payBusy = false;
		}
	}

	async function uploadProof(): Promise<void> {
		payError = '';
		if (!myPayment || !proofFile) {
			payError = 'Pilih foto bukti bayar dulu.';
			return;
		}
		if (proofFile.size > 5 * 1024 * 1024) {
			payError = 'Ukuran gambar melebihi 5 MB.';
			return;
		}
		uploading = true;
		try {
			const fd = new FormData();
			fd.append('file', proofFile, proofFile.name);
			const token = getAccessToken();
			const res = await fetch('/api/payments/proof', {
				method: 'POST',
				headers: token ? { Authorization: `Bearer ${token}` } : {},
				body: fd
			});
			const json = (await res.json().catch(() => null)) as {
				status?: boolean;
				message?: string;
				data?: { id: number };
			} | null;
			if (!res.ok || !json?.status || typeof json.data?.id !== 'number') {
				throw new Error(json?.message ?? `Unggahan gagal (HTTP ${res.status}).`);
			}
			myPayment = await attachPaymentProof(myPayment.id, json.data.id);
			await load();
		} catch (e) {
			payError = e instanceof Error ? e.message : 'Gagal mengunggah bukti.';
		} finally {
			uploading = false;
		}
	}

	async function cancel(): Promise<void> {
		payError = '';
		if (!group) return;
		cancelBusy = true;
		try {
			if (isAdmin && !isCreator) {
				await adminCancelPatunganGroup(group.id, cancelReason.trim() || undefined);
			} else {
				await cancelPatunganGroup(group.id, cancelReason.trim() || undefined);
			}
			await load();
		} catch (e) {
			payError = e instanceof Error ? e.message : 'Gagal membatalkan grup.';
		} finally {
			cancelBusy = false;
		}
	}

	function copyLink(): void {
		if (!browser) return;
		void navigator.clipboard?.writeText(window.location.href).catch(() => {});
	}

	$effect(() => {
		if (!browser) return;
		if (!Number.isInteger(groupId) || groupId <= 0) {
			loading = false;
			loadError = 'ID grup tidak valid.';
			return;
		}
		if (getAccessToken() === null) {
			loading = false;
			return;
		}
		void load();
	});
</script>

<SeoHead
	title="Grup Patungan — ARISTOTELES"
	description="Detail grup patungan: anggota, iuran masing-masing, dan progres pelunasan."
	path={`/patungan/${params.groupId}`}
	origin={data.origin}
/>

<PublicHeader active="promo" />

<main class="bg-ice/60">
	<div class="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
		<nav aria-label="Kembali" class="mb-6 flex items-center justify-between gap-3">
			<a href={resolve('/promo#patungan')} class="inline-flex min-h-[44px] items-center gap-2 font-heading text-sm font-bold text-royal hover:text-royal-hover">
				<i class="fa-solid fa-arrow-left text-xs" aria-hidden="true"></i> Kembali ke Promo
			</a>
			<a href={resolve('/patungan/saya')} class="inline-flex min-h-[44px] items-center gap-2 font-heading text-sm font-bold text-slate-600 hover:text-royal">
				Grup patunganku
			</a>
		</nav>

		{#if loading}
			<div class="rounded-2xl border border-mist bg-white p-8" aria-label="Memuat grup">
				<div class="h-5 w-1/2 animate-pulse rounded bg-ice"></div>
				<div class="mt-3 h-3 w-3/4 animate-pulse rounded bg-ice"></div>
			</div>
		{:else if loadError || !group}
			{#if getAccessToken() === null && !loadError}
				<div class="rounded-2xl border border-dashed border-mist bg-white p-8 text-center">
					<p class="font-heading text-sm font-bold text-abyss">Masuk dulu untuk melihat grup ini.</p>
					<p class="mx-auto mt-1 max-w-md text-sm text-slate-500">Detail grup hanya bisa dilihat anggotanya.</p>
					<a href={resolve(`/login?returnTo=${encodeURIComponent(`/patungan/${params.groupId}`)}`)} class="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-royal px-6 py-2.5 font-heading text-xs font-bold text-white hover:bg-royal-hover">
						Masuk & kembali ke grup <i class="fa-solid fa-arrow-right text-xs" aria-hidden="true"></i>
					</a>
				</div>
			{:else}
				<div role="alert" class="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
					<p class="font-heading text-sm font-bold text-red-700">Grup tidak dapat dimuat</p>
					<p class="mx-auto mt-1 max-w-md text-xs text-red-600">{loadError || 'Grup tidak ditemukan.'}</p>
					<button type="button" onclick={() => void load()} class="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-royal px-5 py-2.5 font-heading text-xs font-bold text-white hover:bg-royal-hover">
						<i class="fa-solid fa-rotate-right" aria-hidden="true"></i> Coba lagi
					</button>
				</div>
			{/if}
		{:else}
			<div use:reveal class="overflow-hidden rounded-2xl border border-mist bg-white shadow-xl shadow-slate-900/5">
				<div class="border-b border-mist bg-abyss px-6 py-6 text-white sm:px-8">
					<div class="flex flex-wrap items-center gap-2">
						<span class="rounded-lg bg-white/10 px-3 py-1 font-mono text-xs font-bold text-ice">{group.code}</span>
						{#if group.status === 'pending'}
							<span class="rounded-lg bg-amber-400/20 px-3 py-1 font-heading text-[11px] font-bold tracking-wider text-amber-200 uppercase">Pending · {group.paidCount}/{group.memberCount} lunas</span>
						{:else if group.status === 'complete'}
							<span class="rounded-lg bg-emerald-400/20 px-3 py-1 font-heading text-[11px] font-bold tracking-wider text-emerald-200 uppercase">Complete — akses dibuka</span>
						{:else}
							<span class="rounded-lg bg-white/10 px-3 py-1 font-heading text-[11px] font-bold tracking-wider text-slate-300 uppercase">Dibatalkan</span>
						{/if}
					</div>
					<h1 class="mt-3 font-heading text-2xl font-extrabold">{group.course.title}</h1>
					<p class="mt-1 text-sm text-slate-300">
						Total {formatIDR(group.priceNominal)} · {group.memberCount} anggota · {group.course.priceLabel}
						{#if group.campaign} · {group.campaign.title}{/if}
					</p>
					<div class="mt-3 h-2 overflow-hidden rounded-full bg-white/10" role="img" aria-label={`${group.paidCount} dari ${group.memberCount} anggota lunas`}>
						<div class="h-full rounded-full bg-teal" style="width:{group.memberCount > 0 ? (group.paidCount / group.memberCount) * 100 : 0}%"></div>
					</div>
				</div>

				<div class="space-y-6 px-6 py-6 sm:px-8">
					{#if group.status === 'complete'}
						<div class="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800">
							Semua anggota lunas — akses kursus sudah dibuka untuk semua.
							<a href={resolve(`/modules/${group.course.id}`)} class="ml-1 font-bold underline">Buka pelatihan</a>
						</div>
					{:else if group.status === 'cancelled'}
						<div class="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-600">
							Grup ini dibatalkan{#if group.cancelReason}: {group.cancelReason}{/if}. Iuran yang sudah diverifikasi ditangani manual oleh admin.
						</div>
					{:else}
						<div class="rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800">
							Menunggu pelunasan semua anggota ({group.paidCount}/{group.memberCount}). Belum ada akses kursus sebelum lengkap.
						</div>
					{/if}

					<!-- Anggota -->
					<section aria-label="Anggota grup">
						<h2 class="font-heading text-xs font-bold tracking-wider text-slate-500 uppercase">Anggota</h2>
						<ul class="mt-3 space-y-2">
							{#each group.members as m (m.userId)}
								<li class="flex items-center gap-3 rounded-xl border border-mist px-4 py-3">
									<span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-ice font-heading text-sm font-extrabold text-royal" aria-hidden="true">
										{(m.username?.[0] ?? '?').toUpperCase()}
									</span>
									<div class="min-w-0 flex-1">
										<p class="truncate text-sm font-bold text-abyss">
											@{m.username}
											{#if m.isCreator}<span class="ml-1 rounded-md bg-royal/10 px-1.5 py-0.5 text-[10px] font-bold text-royal uppercase">Ketua</span>{/if}
											{#if m.username === me?.username}<span class="ml-1 rounded-md bg-teal/10 px-1.5 py-0.5 text-[10px] font-bold text-teal uppercase">Kamu</span>{/if}
										</p>
										<p class="truncate text-xs text-slate-500">{m.name}</p>
									</div>
									<div class="shrink-0 text-right">
										<p class="text-xs font-extrabold tabular-nums text-abyss">{formatIDR(m.shareAmount)}</p>
										<p class="text-[11px] font-semibold {m.paymentStatus === 'diverifikasi' ? 'text-teal' : m.paymentStatus === 'ditolak' ? 'text-red-600' : 'text-slate-500'}">
											{STATUS_LABEL[m.paymentStatus]}
										</p>
									</div>
								</li>
							{/each}
						</ul>
					</section>

					<!-- Bayar iuran saya -->
					{#if group.status === 'pending' && myMembership && (myMembership.paymentStatus === 'unpaid' || myMembership.paymentStatus === 'ditolak')}
						<section aria-label="Bayar iuran saya" class="rounded-2xl border border-royal/25 bg-royal/5 p-5">
							<h2 class="font-heading text-sm font-extrabold text-abyss">Bayar iuranmu: {formatIDR(myMembership.shareAmount)}</h2>
							{#if myMembership.paymentStatus === 'ditolak'}
								<p class="mt-1 text-xs font-semibold text-red-600">Bukti sebelumnya ditolak — unggah ulang bukti yang benar.</p>
							{/if}
							<p class="mt-1 text-xs text-slate-500">Transfer via QRIS sesuai nominal iuranmu, lalu unggah buktinya. Tanpa voucher/promo.</p>
							{#if !myPayment}
								<button type="button" onclick={() => void startPay()} disabled={payBusy} class="mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-royal px-6 py-2.5 font-heading text-xs font-bold text-white hover:bg-royal-hover disabled:opacity-50">
									{#if payBusy}<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i>{:else}<i class="fa-solid fa-qrcode" aria-hidden="true"></i>{/if}
									Buat Tagihan Iuran
								</button>
							{:else}
								<div class="mt-3 rounded-xl border border-mist bg-white p-4">
									<p class="font-mono text-xs font-bold text-abyss">{myPayment.invoice}</p>
									<p class="mt-1 font-heading text-lg font-extrabold text-abyss">{formatIDR(myPayment.amountExpected)}</p>
									<label for="grup-proof" class="mt-3 mb-1.5 block text-xs font-bold tracking-wide text-slate-500 uppercase">Bukti bayar (gambar ≤ 5 MB)</label>
									<input id="grup-proof" type="file" accept="image/*" onchange={(e) => { proofFile = (e.target as HTMLInputElement).files?.[0] ?? null; }} class="w-full text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-abyss file:px-4 file:py-2 file:text-xs file:font-bold file:text-white hover:file:bg-royal" />
									<button type="button" onclick={() => void uploadProof()} disabled={uploading || !proofFile} class="mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-abyss px-6 py-2.5 font-heading text-xs font-bold text-white hover:bg-royal disabled:opacity-50">
										{#if uploading}<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i>{:else}<i class="fa-solid fa-upload" aria-hidden="true"></i>{/if}
										Unggah Bukti
									</button>
								</div>
							{/if}
							{#if payError}
								<p role="alert" class="mt-2 text-xs font-semibold text-red-600">{payError}</p>
							{/if}
						</section>
					{:else if group.status === 'pending' && myMembership && myMembership.paymentStatus === 'menunggu'}
						<div class="rounded-xl border border-mist bg-white px-4 py-3 text-xs font-semibold text-slate-600">
							Iuranmu menunggu verifikasi admin. Kamu akan mendapat akses bersamaan saat semua anggota lunas.
							<button type="button" onclick={() => void load()} class="ml-1 font-bold text-royal underline">Muat ulang</button>
						</div>
					{/if}

					<!-- Aksi grup -->
					<div class="flex flex-wrap items-center gap-3 border-t border-mist pt-5">
						<button type="button" onclick={copyLink} class="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-mist px-4 py-2 font-heading text-xs font-bold text-abyss hover:border-royal hover:text-royal">
							<i class="fa-solid fa-link text-[11px]" aria-hidden="true"></i> Salin tautan grup
						</button>
						{#if canCancel}
							<details class="w-full rounded-xl border border-red-200 bg-red-50/50 p-4">
								<summary class="cursor-pointer font-heading text-xs font-bold text-red-700">Batalkan grup</summary>
								<label for="cancel-reason" class="mt-3 mb-1.5 block text-xs font-bold tracking-wide text-slate-500 uppercase">Alasan (opsional)</label>
								<input id="cancel-reason" type="text" bind:value={cancelReason} maxlength={500} placeholder="cth. anggota mengundurkan diri" class="w-full rounded-xl border border-mist bg-white px-4 py-2.5 text-sm text-abyss focus:border-red-400 focus:outline-none" />
								{#if isAdmin && !isCreator}
									<p class="mt-2 text-[11px] text-slate-500">Sebagai admin, pembatalan tetap menyimpan iuran yang sudah masuk — penanganannya manual.</p>
								{/if}
								<button type="button" onclick={() => void cancel()} disabled={cancelBusy} class="mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 font-heading text-xs font-bold text-white hover:bg-red-500 disabled:opacity-50">
									{#if cancelBusy}<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i>{/if}
									Ya, batalkan grup
								</button>
							</details>
						{/if}
					</div>
					{#if payError && group.status !== 'pending'}
						<p role="alert" class="text-xs font-semibold text-red-600">{payError}</p>
					{/if}
				</div>
			</div>
		{/if}
	</div>
</main>

<PublicFooter />
