<script lang="ts">
	import { browser } from '$app/environment';
	import Pagination from '$lib/components/Pagination.svelte';
	import WarningModal from '$lib/components/WarningModal.svelte';
	import {
		cancelVoucher,
		createVoucher,
		generateCode,
		listVouchers,
		type VoucherKind,
		type VoucherStatus,
		type VoucherView
	} from '$lib/stores/vouchers';
	import { courses } from '$lib/data/courses';

	type KindFilter = 'all' | VoucherKind;
	type StatusFilter = 'all' | VoucherStatus;

	let query = $state('');
	let kindFilter = $state<KindFilter>('all');
	let courseFilter = $state('all');
	let statusFilter = $state<StatusFilter>('all');
	let page = $state(1);
	let perPage = $state(5);
	let version = $state(0);

	/* --- Formulir tambah --- */
	let showAdd = $state(false);
	let formKind = $state<VoucherKind>('Personal');
	let formCourseId = $state('');
	let formMaxUses = $state('10');
	let useExpiry = $state(false);
	let formExpiry = $state('');
	let previewCode = $state('');
	let formError = $state('');
	let isSubmitting = $state(false);
	let addBtn: HTMLButtonElement | null = $state(null);
	let firstField: HTMLInputElement | null = $state(null);
	let modalOpened = false;

	/* --- Detail & pembatalan --- */
	let selectedId = $state<string | null>(null);
	let showDetail = $state(false);
	let pendingCancel = $state<VoucherView | null>(null);
	let showCancel = $state(false);
	let copiedId = $state<string | null>(null);
	let notice = $state('');

	const vouchers = $derived.by<VoucherView[]>(() => {
		void version;
		if (!browser) return [];
		return listVouchers();
	});

	const stats = $derived({
		total: vouchers.length,
		aktif: vouchers.filter((v) => v.status === 'Aktif').length,
		habis: vouchers.filter((v) => v.status === 'Habis digunakan').length,
		kedaluarsa: vouchers.filter((v) => v.status === 'Kedaluarsa').length,
		batal: vouchers.filter((v) => v.status === 'Dibatalkan').length
	});

	const filtered = $derived(
		vouchers.filter((v) => {
			const mKind = kindFilter === 'all' || v.kind === kindFilter;
			const mCourse = courseFilter === 'all' || String(v.courseId) === courseFilter;
			const mStatus = statusFilter === 'all' || v.status === statusFilter;
			const q = query.trim().toLowerCase();
			const mQuery = !q || v.code.toLowerCase().includes(q);
			return mKind && mCourse && mStatus && mQuery;
		})
	);

	/* Kembali ke halaman 1 setiap filter/pencarian/jumlah baris/data berubah. */
	$effect(() => {
		void query;
		void kindFilter;
		void courseFilter;
		void statusFilter;
		void perPage;
		void version;
		page = 1;
	});

	const paged = $derived(filtered.slice((page - 1) * perPage, page * perPage));

	const selected = $derived(vouchers.find((v) => v.id === selectedId) ?? null);

	function statusClass(s: VoucherStatus): string {
		if (s === 'Aktif') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
		if (s === 'Habis digunakan') return 'border-slate-200 bg-slate-100 text-slate-600';
		if (s === 'Kedaluarsa') return 'border-amber-200 bg-amber-50 text-amber-700';
		return 'border-red-200 bg-red-50 text-red-700';
	}

	function formatDate(iso: string): string {
		try {
			return new Date(iso).toLocaleDateString('id-ID', {
				day: 'numeric',
				month: 'short',
				year: 'numeric'
			});
		} catch {
			return '-';
		}
	}

	function formatDateTime(iso: string): string {
		try {
			return new Date(iso).toLocaleString('id-ID', {
				day: 'numeric',
				month: 'short',
				year: 'numeric',
				hour: '2-digit',
				minute: '2-digit'
			});
		} catch {
			return '-';
		}
	}

	/** Tanggal lokal hari ini (YYYY-MM-DD) sebagai batas bawah kedaluwarsa. */
	function todayLocal(): string {
		const d = new Date();
		const m = String(d.getMonth() + 1).padStart(2, '0');
		const day = String(d.getDate()).padStart(2, '0');
		return `${d.getFullYear()}-${m}-${day}`;
	}

	function openAdd() {
		formKind = 'Personal';
		formCourseId = '';
		formMaxUses = '10';
		useExpiry = false;
		formExpiry = '';
		formError = '';
		isSubmitting = false;
		notice = '';
		previewCode = generateCode(new Set(vouchers.map((v) => v.code)));
		showAdd = true;
	}

	function closeAdd() {
		showAdd = false;
		formError = '';
		isSubmitting = false;
	}

	function regenerateCode() {
		previewCode = generateCode(new Set(vouchers.map((v) => v.code)));
	}

	$effect(() => {
		if (showAdd) {
			modalOpened = true;
			firstField?.focus();
		} else if (modalOpened) {
			addBtn?.focus();
		}
	});

	function submitAdd(event: Event) {
		event.preventDefault();
		if (isSubmitting) return;
		formError = '';

		const course = courses.find((c) => String(c.id) === formCourseId);
		if (!course) {
			formError = 'Pilih kursus tujuan. Satu voucher hanya berlaku untuk satu kursus.';
			return;
		}

		let maxUses = 1;
		if (formKind === 'Umum') {
			/* bind:value input number bisags non-string saat kosong — normalisasi dulu. */
			const raw = String(formMaxUses ?? '').trim();
			if (!/^\d+$/.test(raw)) {
				formError = 'Batas penggunaan harus bilangan bulat positif tanpa desimal (contoh: 20).';
				return;
			}
			maxUses = parseInt(raw, 10);
			if (maxUses < 1) {
				formError = 'Batas penggunaan minimal 1.';
				return;
			}
		}

		let expiresAt: string | null = null;
		if (useExpiry) {
			if (!formExpiry) {
				formError = 'Tanggal kedaluwarsa wajib diisi karena masa berlaku diaktifkan.';
				return;
			}
			if (!/^\d{4}-\d{2}-\d{2}$/.test(formExpiry)) {
				formError = 'Format tanggal kedaluwarsa tidak valid.';
				return;
			}
			const picked = new Date(`${formExpiry}T00:00:00`);
			if (Number.isNaN(picked.getTime())) {
				formError = 'Tanggal kedaluwarsa tidak valid.';
				return;
			}
			if (formExpiry < todayLocal()) {
				formError = 'Tanggal kedaluwarsa tidak boleh sebelum hari ini.';
				return;
			}
			expiresAt = new Date(`${formExpiry}T23:59:59`).toISOString();
		}

		isSubmitting = true;
		const created = createVoucher({
			kind: formKind,
			courseId: course.id,
			courseTitle: course.title,
			maxUses,
			expiresAt
		});
		version++;
		closeAdd();
		notice = `Voucher ${created.code} untuk kursus “${created.courseTitle}” dicatat secara lokal (demo). Keunikan global dan pemberian akses membutuhkan backend.`;
	}

	function openDetail(v: VoucherView) {
		selectedId = v.id;
		showDetail = true;
	}

	function closeDetail() {
		showDetail = false;
		selectedId = null;
	}

	async function copyText(text: string, id: string) {
		copiedId = null;
		try {
			await navigator.clipboard.writeText(text);
			copiedId = id;
			setTimeout(() => {
				copiedId = null;
			}, 2000);
		} catch {
			notice = 'Gagal menyalin otomatis. Salin manual dari kolom kode bila diperlukan.';
		}
	}

	function copyCode(v: VoucherView) {
		void copyText(v.code, v.id);
	}

	function copyInfo(v: VoucherView) {
		const lines = [
			`Kode voucher: ${v.code}`,
			`Jenis: ${v.kind}`,
			`Kursus: ${v.courseTitle}`,
			`Dibuat: ${formatDate(v.createdAt)}`,
			`Berlaku sampai: ${v.expiresAt ? formatDate(v.expiresAt) : 'Tanpa batas waktu'}`,
			`Penggunaan: ${v.usedCount}/${v.maxUses}`,
			`Status: ${v.status}`
		].join('\n');
		void copyText(lines, `info-${v.id}`);
	}

	function askCancel(v: VoucherView) {
		pendingCancel = v;
		showCancel = true;
	}

	function confirmCancel() {
		if (pendingCancel) {
			cancelVoucher(pendingCancel.id);
			version++;
			notice = `Voucher ${pendingCancel.code} dibatalkan (data lokal). Riwayat penukaran tetap tersimpan di detail.`;
		}
		pendingCancel = null;
		showCancel = false;
	}
</script>

<svelte:head>
	<title>Manajemen Voucher — Admin Aristoteles</title>
	<meta
		name="description"
		content="Buat dan kelola voucher kursus gratis Aristoteles (simulasi lokal, menunggu backend)."
	/>
</svelte:head>

<div class="p-4 sm:p-6 lg:p-8">
	<div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
		<div>
			<p class="text-xs font-bold tracking-widest text-orange-600 uppercase">Admin · Voucher</p>
			<h1 class="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
				Manajemen Voucher
			</h1>
			<p class="mt-1 text-sm text-slate-500">
				{filtered.length} dari {vouchers.length} voucher ditampilkan · data lokal browser (demo),
				bukan voucher resmi.
			</p>
		</div>
		<button
			type="button"
			bind:this={addBtn}
			onclick={openAdd}
			class="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-orange-600/25 transition-colors hover:bg-orange-700 focus-visible:outline-2 focus-visible:outline-orange-600"
		>
			<i class="fa-solid fa-ticket" aria-hidden="true"></i> Tambah Voucher
		</button>
	</div>

	<div
		class="mb-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-800"
		role="note"
	>
		<i class="fa-solid fa-triangle-exclamation mt-0.5 shrink-0" aria-hidden="true"></i>
		<p>
			<strong>Simulasi lokal:</strong> voucher di halaman ini hanya tersimpan di browser dan memakai
			kode demo (<span class="font-mono">ARISTO-…</span>), bukan token keamanan. Keunikan kode
			global, validasi peserta, batas atomik anti-race, dan pemberian akses kursus membutuhkan
			backend dan belum tersedia.
		</p>
	</div>

	{#if notice}
		<p
			role="status"
			class="mb-4 flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs font-semibold text-blue-800"
		>
			<i class="fa-solid fa-circle-info mt-0.5 shrink-0" aria-hidden="true"></i>
			<span>{notice}</span>
		</p>
	{/if}

	<dl class="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5" aria-label="Ringkasan voucher">
		<div class="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
			<dt class="flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-slate-500 uppercase">
				<i class="fa-solid fa-ticket text-slate-400" aria-hidden="true"></i> Total
			</dt>
			<dd class="mt-1 text-2xl font-extrabold text-slate-900 tabular-nums">{stats.total}</dd>
		</div>
		<div class="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
			<dt class="flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-slate-500 uppercase">
				<i class="fa-solid fa-circle-check text-emerald-500" aria-hidden="true"></i> Aktif
			</dt>
			<dd class="mt-1 text-2xl font-extrabold text-emerald-700 tabular-nums">{stats.aktif}</dd>
		</div>
		<div class="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
			<dt class="flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-slate-500 uppercase">
				<i class="fa-solid fa-circle-minus text-slate-400" aria-hidden="true"></i> Habis digunakan
			</dt>
			<dd class="mt-1 text-2xl font-extrabold text-slate-700 tabular-nums">{stats.habis}</dd>
		</div>
		<div class="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
			<dt class="flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-slate-500 uppercase">
				<i class="fa-solid fa-hourglass-end text-amber-500" aria-hidden="true"></i> Kedaluarsa
			</dt>
			<dd class="mt-1 text-2xl font-extrabold text-amber-700 tabular-nums">{stats.kedaluarsa}</dd>
		</div>
		<div class="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
			<dt class="flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-slate-500 uppercase">
				<i class="fa-solid fa-ban text-red-500" aria-hidden="true"></i> Dibatalkan
			</dt>
			<dd class="mt-1 text-2xl font-extrabold text-red-700 tabular-nums">{stats.batal}</dd>
		</div>
	</dl>

	<div class="mb-5 flex flex-col gap-3">
		<div class="flex flex-col gap-3 lg:flex-row">
			<div class="relative max-w-md flex-1">
				<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
					<i class="fa-solid fa-magnifying-glass text-sm" aria-hidden="true"></i>
				</div>
				<label for="voucher-search" class="sr-only">Cari kode voucher</label>
				<input
					id="voucher-search"
					type="search"
					bind:value={query}
					placeholder="Cari kode voucher..."
					class="w-full rounded-xl border border-slate-200 bg-white py-2.5 pr-4 pl-10 font-mono text-sm focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 focus:outline-none"
				/>
			</div>
			<div class="flex flex-wrap gap-2" role="group" aria-label="Filter jenis voucher">
				{#each (['all', 'Personal', 'Umum'] as KindFilter[]) as k (k)}
					<button
						type="button"
						onclick={() => (kindFilter = k)}
						aria-pressed={kindFilter === k}
						class={`rounded-xl px-4 py-2 text-xs font-bold transition-colors focus-visible:outline-2 focus-visible:outline-orange-600 ${
							kindFilter === k
								? 'bg-orange-600 text-white shadow-lg shadow-orange-600/25'
								: 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
						}`}
					>
						{k === 'all' ? 'Semua jenis' : k}
					</button>
				{/each}
			</div>
		</div>
		<div class="flex flex-col gap-3 lg:flex-row lg:items-center">
			<div class="flex items-center gap-2">
				<label for="voucher-course" class="text-xs font-bold whitespace-nowrap text-slate-600">Kursus</label>
				<select
					id="voucher-course"
					bind:value={courseFilter}
					class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 focus:border-orange-500 focus:outline-none"
				>
					<option value="all">Semua kursus</option>
					{#each courses as c (c.id)}
						<option value={String(c.id)}>{c.title}</option>
					{/each}
				</select>
			</div>
			<div class="flex flex-wrap gap-2" role="group" aria-label="Filter status voucher">
				{#each (['all', 'Aktif', 'Habis digunakan', 'Kedaluarsa', 'Dibatalkan'] as StatusFilter[]) as s (s)}
					<button
						type="button"
						onclick={() => (statusFilter = s)}
						aria-pressed={statusFilter === s}
						class={`rounded-xl px-4 py-2 text-xs font-bold transition-colors focus-visible:outline-2 focus-visible:outline-orange-600 ${
							statusFilter === s
								? 'bg-orange-600 text-white shadow-lg shadow-orange-600/25'
								: 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
						}`}
					>
						{s === 'all' ? 'Semua status' : s}
					</button>
				{/each}
			</div>
		</div>
	</div>

	<div class="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm">
		<div class="h-1 bg-gradient-to-r from-orange-600 via-amber-500 to-orange-600" aria-hidden="true"></div>
		<div class="overflow-x-auto">
			<table class="w-full min-w-[900px] text-sm">
				<caption class="sr-only">Daftar voucher kursus gratis (data lokal)</caption>
				<thead class="bg-orange-700 text-white">
					<tr class="[&_th]:py-3.5 [&_th]:align-middle">
						<th scope="col" class="px-6 text-left text-xs font-bold tracking-wider uppercase">Kode</th>
						<th scope="col" class="px-6 text-left text-xs font-bold tracking-wider uppercase">Jenis</th>
						<th scope="col" class="px-6 text-left text-xs font-bold tracking-wider uppercase">Kursus</th>
						<th scope="col" class="px-6 text-center text-xs font-bold tracking-wider uppercase">Penggunaan</th>
						<th scope="col" class="px-6 text-left text-xs font-bold tracking-wider uppercase">Dibuat</th>
						<th scope="col" class="px-6 text-left text-xs font-bold tracking-wider uppercase">Berlaku s.d.</th>
						<th scope="col" class="px-6 text-center text-xs font-bold tracking-wider uppercase">Status</th>
						<th scope="col" class="px-6 text-right text-xs font-bold tracking-wider uppercase">Aksi</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-100">
					{#each paged as v, i (v.id)}
						<tr class={`transition-colors hover:bg-orange-50/50 ${i % 2 === 1 ? 'bg-slate-50/60' : 'bg-white'}`}>
							<td class="px-6 py-3.5">
								<span class="font-mono text-[13px] font-bold text-slate-900">{v.code}</span>
							</td>
							<td class="px-6 py-3.5">
								<span class={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ${v.kind === 'Personal' ? 'bg-orange-100 text-orange-700' : 'bg-sky-100 text-sky-700'}`}>
									{v.kind}
								</span>
							</td>
							<td class="px-6 py-3.5">
								<span class="block max-w-56 truncate font-semibold text-slate-900">{v.courseTitle}</span>
							</td>
							<td class="px-6 py-3.5">
								<div class="flex min-w-28 flex-col items-center gap-1">
									<span class="text-xs font-extrabold text-slate-800 tabular-nums">{v.usedCount}/{v.maxUses}</span>
									<div
										class="h-1.5 w-full overflow-hidden rounded-full bg-slate-100"
										role="progressbar"
										aria-valuenow={v.usedCount}
										aria-valuemin={0}
										aria-valuemax={v.maxUses}
										aria-label={`Penggunaan voucher ${v.code}`}
									>
										<div
											class={`h-full rounded-full ${v.usedCount >= v.maxUses ? 'bg-slate-400' : 'bg-orange-500'}`}
											style="width: {v.maxUses > 0 ? Math.min(100, Math.round((v.usedCount / v.maxUses) * 100)) : 0}%"
										></div>
									</div>
								</div>
							</td>
							<td class="px-6 py-3.5 whitespace-nowrap text-slate-600">{formatDate(v.createdAt)}</td>
							<td class="px-6 py-3.5 whitespace-nowrap text-slate-600">
								{#if v.expiresAt}
									{formatDate(v.expiresAt)}
								{:else}
									<span class="text-slate-400 italic">Tanpa batas</span>
								{/if}
							</td>
							<td class="px-6 py-3.5 text-center">
								<span class={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold whitespace-nowrap ${statusClass(v.status)}`}>
									<span class="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true"></span>{v.status}
								</span>
							</td>
							<td class="px-6 py-3.5">
								<div class="flex justify-end gap-2">
									<button
										type="button"
										onclick={() => openDetail(v)}
										aria-label={`Lihat detail voucher ${v.code}`}
										title="Lihat detail"
										class="flex min-h-9 min-w-9 items-center justify-center rounded-lg border border-slate-200 p-2 text-slate-500 transition-colors hover:bg-slate-50 hover:text-orange-600 focus-visible:outline-2 focus-visible:outline-orange-600"
									>
										<i class="fa-solid fa-eye text-sm" aria-hidden="true"></i>
									</button>
									<button
										type="button"
										onclick={() => copyCode(v)}
										aria-label={`Salin kode voucher ${v.code}`}
										title="Salin kode voucher (demo)"
										class="flex min-h-9 min-w-9 items-center justify-center rounded-lg border border-slate-200 p-2 text-slate-500 transition-colors hover:bg-slate-50 hover:text-blue-600 focus-visible:outline-2 focus-visible:outline-blue-600"
									>
										<i class={`fa-solid ${copiedId === v.id ? 'fa-check text-emerald-600' : 'fa-copy'} text-sm`} aria-hidden="true"></i>
									</button>
									{#if v.status === 'Aktif'}
										<button
											type="button"
											onclick={() => askCancel(v)}
											aria-label={`Batalkan voucher ${v.code}`}
											title="Batalkan voucher"
											class="flex min-h-9 min-w-9 items-center justify-center rounded-lg border border-slate-200 p-2 text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:outline-2 focus-visible:outline-red-500"
										>
											<i class="fa-solid fa-ban text-sm" aria-hidden="true"></i>
										</button>
									{/if}
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		{#if filtered.length === 0}
			<p class="border-t border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
				{vouchers.length === 0
					? 'Belum ada voucher. Buat voucher pertama lewat tombol Tambah Voucher.'
					: 'Tidak ada voucher yang cocok dengan pencarian atau filter.'}
			</p>
		{/if}
		<div class="border-t border-slate-100 bg-slate-50/70">
			<Pagination bind:page bind:perPage totalItems={filtered.length} itemLabel="voucher" label="Navigasi halaman tabel voucher" id="voucher-pagination" activeClass="bg-orange-600 text-white shadow-lg shadow-orange-600/25" />
		</div>
	</div>

	{#if showAdd}
		<div
			class="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/50 p-4"
			role="dialog"
			aria-modal="true"
			aria-labelledby="add-voucher-title"
			tabindex="-1"
			onclick={(e) => {
				if (e.target === e.currentTarget) closeAdd();
			}}
			onkeydown={(e) => {
				if (e.key === 'Escape') closeAdd();
			}}
		>
			<form
				onsubmit={submitAdd}
				class="my-8 w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
			>
				<h2 id="add-voucher-title" class="text-lg font-bold text-slate-900">Tambah Voucher</h2>
				<p class="mt-0.5 text-xs text-slate-500">
					Voucher tersimpan lokal (demo) untuk satu kursus. Keunikan global dan akses kursus
					 membutuhkan backend.
				</p>
				{#if formError}
					<p role="alert" class="mt-3 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-semibold text-red-700">
						{formError}
					</p>
				{/if}

				<fieldset class="mt-4">
					<legend class="mb-1.5 block text-xs font-bold text-slate-700">Jenis voucher</legend>
					<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
						<label class={`cursor-pointer rounded-xl border-2 p-3 transition-colors focus-within:outline-2 focus-within:outline-orange-600 ${formKind === 'Personal' ? 'border-orange-500 bg-orange-50/60' : 'border-slate-200 hover:border-slate-300'}`}>
							<span class="flex items-center gap-2">
								<input
									type="radio"
									name="voucher-kind"
									value="Personal"
									bind:group={formKind}
									bind:this={firstField}
									class="h-4 w-4 accent-orange-600"
								/>
								<span class="text-sm font-bold text-slate-900">Personal</span>
							</span>
							<span class="mt-1 block pl-6 text-[11px] leading-relaxed text-slate-500">
								Satu kode untuk satu peserta — hanya penukaran berhasil pertama yang dihitung.
							</span>
						</label>
						<label class={`cursor-pointer rounded-xl border-2 p-3 transition-colors focus-within:outline-2 focus-within:outline-orange-600 ${formKind === 'Umum' ? 'border-orange-500 bg-orange-50/60' : 'border-slate-200 hover:border-slate-300'}`}>
							<span class="flex items-center gap-2">
								<input
									type="radio"
									name="voucher-kind"
									value="Umum"
									bind:group={formKind}
									class="h-4 w-4 accent-orange-600"
								/>
								<span class="text-sm font-bold text-slate-900">Umum</span>
							</span>
							<span class="mt-1 block pl-6 text-[11px] leading-relaxed text-slate-500">
								Satu kode untuk banyak peserta — Admin menentukan batas penukaran.
							</span>
						</label>
					</div>
				</fieldset>

				<div class="mt-4 space-y-3">
					<div>
						<label for="voucher-course-add" class="mb-1 block text-xs font-bold text-slate-700">Kursus tujuan</label>
						<select
							id="voucher-course-add"
							bind:value={formCourseId}
							aria-invalid={formError.includes('kursus') ? 'true' : undefined}
							class="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 focus:outline-none"
						>
							<option value="">— Pilih kursus —</option>
							{#each courses as c (c.id)}
								<option value={String(c.id)}>{c.title}</option>
							{/each}
						</select>
					</div>
					<div>
						<label for="voucher-max" class="mb-1 block text-xs font-bold text-slate-700">
							Batas penggunaan {formKind === 'Personal' ? '(otomatis 1)' : ''}
						</label>
						{#if formKind === 'Personal'}
							<input
								id="voucher-max"
								type="text"
								disabled
								value="1"
								aria-describedby="voucher-max-note"
								class="w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-500"
							/>
							<p id="voucher-max-note" class="mt-1 text-[11px] text-slate-400">
								Voucher Personal selalu dibatasi satu kali penukaran.
							</p>
						{:else}
							<input
								id="voucher-max"
								type="number"
								min="1"
								step="1"
								inputmode="numeric"
								bind:value={formMaxUses}
								placeholder="cth. 20"
								aria-describedby="voucher-max-note"
								class="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm tabular-nums focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 focus:outline-none"
							/>
							<p id="voucher-max-note" class="mt-1 text-[11px] text-slate-400">
								Bilangan bulat minimal 1. Setelah batas tercapai voucher tidak dapat ditukarkan lagi.
							</p>
						{/if}
					</div>
					<div class="rounded-xl border border-slate-200 p-3.5">
						<label class="flex cursor-pointer items-center gap-2.5">
							<input
								type="checkbox"
								bind:checked={useExpiry}
								class="h-4 w-4 rounded accent-orange-600"
							/>
							<span class="text-xs font-bold text-slate-700">Aktifkan tanggal kedaluwarsa</span>
						</label>
						{#if useExpiry}
							<div class="mt-2.5">
								<label for="voucher-expiry" class="mb-1 block text-xs font-bold text-slate-700">Berlaku sampai</label>
								<input
									id="voucher-expiry"
									type="date"
									bind:value={formExpiry}
									min={todayLocal()}
									class="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 focus:outline-none"
								/>
							</div>
						{:else}
							<p class="mt-2 text-[11px] leading-relaxed text-slate-400">
								Tanpa centang ini voucher tidak memiliki batas waktu (disimpan sebagai tanpa kedaluwarsa).
							</p>
						{/if}
					</div>
					<div>
						<span id="voucher-code-label" class="mb-1 block text-xs font-bold text-slate-700">Kode voucher (otomatis)</span>
						<div class="flex gap-2">
							<input
								type="text"
								readonly
								value={previewCode}
								aria-labelledby="voucher-code-label"
								aria-describedby="voucher-code-note"
								class="w-full rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3.5 py-2.5 font-mono text-sm font-bold text-slate-700"
							/>
							<button
								type="button"
								onclick={regenerateCode}
								aria-label="Buat ulang kode voucher"
								title="Buat ulang kode"
								class="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 p-2.5 text-slate-500 transition-colors hover:bg-slate-50 hover:text-orange-600 focus-visible:outline-2 focus-visible:outline-orange-600"
							>
								<i class="fa-solid fa-dice text-sm" aria-hidden="true"></i>
							</button>
						</div>
						<p id="voucher-code-note" class="mt-1 text-[11px] text-slate-400">
							Kode demo lokal — keunikan global final dijamin backend nantinya.
						</p>
					</div>
				</div>

				<div class="mt-5 flex gap-2">
					<button
						type="button"
						onclick={closeAdd}
						class="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
					>
						Batal
					</button>
					<button
						type="submit"
						disabled={isSubmitting}
						class="flex-1 rounded-xl bg-orange-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
					>
						Simpan Voucher
					</button>
				</div>
			</form>
		</div>
	{/if}

	{#if showDetail && selected}
		<div
			class="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/50 p-4"
			role="dialog"
			aria-modal="true"
			aria-labelledby="voucher-detail-title"
			tabindex="-1"
			onclick={(e) => {
				if (e.target === e.currentTarget) closeDetail();
			}}
			onkeydown={(e) => {
				if (e.key === 'Escape') closeDetail();
			}}
		>
			<div class="my-8 w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
				<div class="h-1.5 bg-gradient-to-r from-orange-600 via-amber-500 to-orange-600" aria-hidden="true"></div>
				<div class="p-6">
					<div class="flex items-start justify-between gap-3">
						<div>
							<p class="text-[11px] font-bold tracking-widest text-orange-600 uppercase">Detail voucher</p>
							<h2 id="voucher-detail-title" class="mt-0.5 font-mono text-xl font-extrabold break-all text-slate-900">
								{selected.code}
							</h2>
						</div>
						<span class={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold whitespace-nowrap ${statusClass(selected.status)}`}>
							<span class="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true"></span>{selected.status}
						</span>
					</div>

					<dl class="mt-4 grid grid-cols-1 gap-2.5 rounded-2xl bg-slate-50 p-4 text-sm sm:grid-cols-2">
						<div>
							<dt class="text-[10px] font-bold tracking-widest text-slate-400 uppercase">Jenis</dt>
							<dd class="mt-0.5 font-bold text-slate-900">{selected.kind}</dd>
						</div>
						<div>
							<dt class="text-[10px] font-bold tracking-widest text-slate-400 uppercase">Kursus</dt>
							<dd class="mt-0.5 font-bold text-slate-900">{selected.courseTitle}</dd>
						</div>
						<div>
							<dt class="text-[10px] font-bold tracking-widest text-slate-400 uppercase">Dibuat</dt>
							<dd class="mt-0.5 font-semibold text-slate-700">{formatDate(selected.createdAt)}</dd>
						</div>
						<div>
							<dt class="text-[10px] font-bold tracking-widest text-slate-400 uppercase">Berlaku s.d.</dt>
							<dd class="mt-0.5 font-semibold text-slate-700">
								{selected.expiresAt ? formatDate(selected.expiresAt) : 'Tanpa batas waktu'}
							</dd>
						</div>
						<div>
							<dt class="text-[10px] font-bold tracking-widest text-slate-400 uppercase">Penggunaan</dt>
							<dd class="mt-0.5 font-extrabold text-slate-900 tabular-nums">
								{selected.usedCount}/{selected.maxUses}
							</dd>
						</div>
						<div>
							<dt class="text-[10px] font-bold tracking-widest text-slate-400 uppercase">Pembatalan</dt>
							<dd class="mt-0.5 font-semibold text-slate-700">
								{selected.cancelledAt ? `Dibatalkan ${formatDate(selected.cancelledAt)}` : '—'}
							</dd>
						</div>
					</dl>

					<h3 class="mt-5 text-xs font-bold tracking-wider text-slate-500 uppercase">
						Riwayat penukaran ({selected.history.length})
					</h3>
					{#if selected.history.length === 0}
						<p class="mt-2 rounded-xl border border-dashed border-slate-300 p-4 text-center text-xs text-slate-500">
							Belum ada penukaran. Riwayat tercatat setelah penukaran berhasil — pencatatan
							nyata membutuhkan backend.
						</p>
					{:else}
						<ul class="mt-2 max-h-44 space-y-1.5 overflow-y-auto">
							{#each selected.history as h (h.id)}
								<li class="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs">
									<span class="font-semibold text-slate-700">{h.note}</span>
									<time class="shrink-0 font-bold whitespace-nowrap text-slate-500 tabular-nums" datetime={h.redeemedAt}>
										{formatDateTime(h.redeemedAt)}
									</time>
								</li>
							{/each}
						</ul>
					{/if}

					<div class="mt-5 flex flex-col gap-2 sm:flex-row">
						<button
							type="button"
							onclick={() => copyCode(selected)}
							class="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-slate-500"
						>
							<i class={`fa-solid ${copiedId === selected.id ? 'fa-check text-emerald-600' : 'fa-copy'}`} aria-hidden="true"></i>
							{copiedId === selected.id ? 'Tersalin!' : 'Salin kode'}
						</button>
						<button
							type="button"
							onclick={() => copyInfo(selected)}
							class="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-slate-500"
						>
							<i class={`fa-solid ${copiedId === `info-${selected.id}` ? 'fa-check text-emerald-600' : 'fa-clipboard-list'}`} aria-hidden="true"></i>
							{copiedId === `info-${selected.id}` ? 'Tersalin!' : 'Salin info'}
						</button>
						<button
							type="button"
							onclick={closeDetail}
							class="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-orange-700 focus-visible:outline-2 focus-visible:outline-orange-600"
						>
							Tutup
						</button>
					</div>
				</div>
			</div>
		</div>
	{/if}

	<WarningModal
		bind:open={showCancel}
		type="warning"
		title="Batalkan voucher?"
		message={pendingCancel
			? `Voucher ${pendingCancel.code} tidak akan bisa ditukarkan lagi. Riwayat penukaran (${pendingCancel.usedCount}x) tetap tersimpan. Tindakan ini hanya berlaku lokal (demo).`
			: 'Voucher ini tidak akan bisa ditukarkan lagi.'}
		confirmText="Ya, batalkan"
		cancelText="Kembali"
		oncancel={() => {
			pendingCancel = null;
			showCancel = false;
		}}
		onconfirm={confirmCancel}
	/>
</div>
