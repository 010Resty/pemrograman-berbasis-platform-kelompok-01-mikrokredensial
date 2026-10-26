<script lang="ts">
	import { browser } from '$app/environment';
	import Pagination from '$lib/components/Pagination.svelte';
	import WarningModal from '$lib/components/WarningModal.svelte';
	import {
		cancelInvitation,
		createInvitation,
		hasPendingForEmail,
		inviteLink,
		listInvitations,
		resendInvitation,
		type InvitationStatus,
		type InvitationView
	} from '$lib/stores/invitations';

	type Filter = 'all' | InvitationStatus;

	let query = $state('');
	let filter = $state<Filter>('all');
	let page = $state(1);
	let perPage = $state(5);
	let showAdd = $state(false);
	let formName = $state('');
	let formEmail = $state('');
	let formNote = $state('');
	let formError = $state('');
	let isSubmitting = $state(false);
	let addBtn: HTMLButtonElement | null = $state(null);
	let firstField: HTMLInputElement | null = $state(null);
	let modalOpened = false;
	let copiedId: string | null = $state(null);
	let notice = $state('');
	let pendingCancel: InvitationView | null = $state(null);
	let showCancel = $state(false);
	let version = $state(0);

	const invitations = $derived.by(() => {
		void version;
		if (!browser) return [] as InvitationView[];
		return listInvitations();
	});

	const filtered = $derived(
		invitations.filter((inv) => {
			const mStatus = filter === 'all' || inv.status === filter;
			const q = query.trim().toLowerCase();
			const mQuery =
				!q ||
				inv.name.toLowerCase().includes(q) ||
				inv.email.toLowerCase().includes(q);
			return mStatus && mQuery;
		})
	);

	/* Kembali ke halaman 1 setiap filter/pencarian/jumlah baris/data berubah. */
	$effect(() => {
		void query;
		void filter;
		void perPage;
		void version;
		page = 1;
	});

	const paged = $derived(filtered.slice((page - 1) * perPage, page * perPage));

	function statusClass(s: InvitationStatus): string {
		if (s === 'Accepted') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
		if (s === 'Pending') return 'border-amber-200 bg-amber-50 text-amber-700';
		if (s === 'Cancelled') return 'border-red-200 bg-red-50 text-red-700';
		return 'border-slate-200 bg-slate-100 text-slate-600';
	}

	/** Label tampil untuk status undangan. Nilai data tidak diubah. */
	function statusLabel(s: Filter): string {
		if (s === 'Pending') return 'Menunggu';
		if (s === 'Accepted') return 'Diterima';
		if (s === 'Expired') return 'Kedaluarsa';
		if (s === 'Cancelled') return 'Dibatalkan';
		return 'Semua';
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

	function absoluteInviteLink(token: string): string {
		const base = browser ? window.location.origin : '';
		return `${base}${inviteLink(token)}`;
	}

	function closeAdd() {
		showAdd = false;
		formName = '';
		formEmail = '';
		formNote = '';
		formError = '';
		isSubmitting = false;
	}

	function openAdd() {
		formError = '';
		notice = '';
		showAdd = true;
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
		if (hasPendingForEmail(email)) {
			formError = 'Email ini sudah memiliki undangan aktif (Menunggu).';
			return;
		}
		isSubmitting = true;
		createInvitation({ name, email, note: formNote });
		version++;
		closeAdd();
		notice = `Undangan untuk ${email} dicatat secara lokal (demo). Pengiriman email membutuhkan backend.`;
	}

	async function copyLink(inv: InvitationView) {
		copiedId = null;
		try {
			await navigator.clipboard.writeText(absoluteInviteLink(inv.token));
			copiedId = inv.id;
			setTimeout(() => {
				copiedId = null;
			}, 2000);
		} catch {
			notice = 'Gagal menyalin otomatis. Salin manual dari kolom tautan bila diperlukan.';
		}
	}

	function askCancel(inv: InvitationView) {
		pendingCancel = inv;
		showCancel = true;
	}

	function confirmCancel() {
		if (pendingCancel) {
			cancelInvitation(pendingCancel.id);
			version++;
			notice = `Undangan untuk ${pendingCancel.email} dibatalkan (data lokal).`;
		}
		pendingCancel = null;
		showCancel = false;
	}

	function resend(inv: InvitationView) {
		const next = resendInvitation(inv.id);
		version++;
		if (next) {
			notice = `Undangan untuk ${inv.email} diperbarui dengan masa berlaku baru (data lokal). Pengiriman email membutuhkan backend.`;
		}
	}
</script>

<svelte:head>
	<title>Undangan Instruktur — Admin Aristoteles</title>
	<meta
		name="description"
		content="Kelola undangan akun instruktur Aristoteles (simulasi lokal, menunggu backend email)."
	/>
</svelte:head>

<div class="p-4 sm:p-6 lg:p-8">
	<div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
		<div>
			<p class="text-xs font-bold tracking-widest text-blue-600 uppercase">Admin · Undangan Instruktur</p>
			<h1 class="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
				Undangan Instruktur
			</h1>
			<p class="mt-1 text-sm text-slate-500">
				{filtered.length} dari {invitations.length} undangan ditampilkan · data lokal browser (demo),
				bukan undangan resmi.
			</p>
		</div>
		<button
			type="button"
			bind:this={addBtn}
			onclick={openAdd}
			class="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-violet-600/25 transition-colors hover:bg-violet-700 focus-visible:outline-2 focus-visible:outline-violet-600"
		>
			<i class="fa-solid fa-envelope-open-text" aria-hidden="true"></i> Undang Instruktur
		</button>
	</div>

	<div
		class="mb-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-800"
		role="note"
	>
		<i class="fa-solid fa-triangle-exclamation mt-0.5 shrink-0" aria-hidden="true"></i>
		<p>
			<strong>Simulasi lokal:</strong> undangan di halaman ini hanya tersimpan di browser dan memakai
			tautan demo (<span class="font-mono">demo-…</span>), bukan token keamanan. Pengiriman email,
			validasi token, dan aktivasi akun membutuhkan backend dan belum tersedia.
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

	<div class="mb-5 flex flex-col gap-3 lg:flex-row">
		<div class="relative max-w-md flex-1">
			<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
				<i class="fa-solid fa-magnifying-glass text-sm" aria-hidden="true"></i>
			</div>
			<label for="invite-search" class="sr-only">Cari undangan</label>
			<input
				id="invite-search"
				type="search"
				bind:value={query}
				placeholder="Cari nama atau email..."
				class="w-full rounded-xl border border-slate-200 bg-white py-2.5 pr-4 pl-10 text-sm focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 focus:outline-none"
			/>
		</div>
		<div class="flex flex-wrap gap-2" role="group" aria-label="Filter status undangan">
			{#each (['all', 'Pending', 'Accepted', 'Expired', 'Cancelled'] as Filter[]) as s (s)}
				<button
					type="button"
					onclick={() => (filter = s)}
					aria-pressed={filter === s}
					class={`rounded-xl px-4 py-2 text-xs font-bold transition-colors focus-visible:outline-2 focus-visible:outline-violet-600 ${
						filter === s
							? 'bg-violet-600 text-white shadow-lg shadow-violet-600/25'
							: 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
					}`}
				>
					{statusLabel(s)}
				</button>
			{/each}
		</div>
	</div>

	<div class="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm">
		<div class="h-1 bg-gradient-to-r from-violet-600 via-fuchsia-500 to-violet-600" aria-hidden="true"></div>
		<div class="overflow-x-auto">
			<table class="w-full min-w-[820px] text-sm">
				<caption class="sr-only">Daftar undangan instruktur (data lokal)</caption>
				<thead class="bg-violet-700 text-white">
					<tr class="[&_th]:py-3.5 [&_th]:align-middle">
						<th scope="col" class="px-6 text-left text-xs font-bold tracking-wider uppercase">Penerima</th>
						<th scope="col" class="px-6 text-left text-xs font-bold tracking-wider uppercase">Dibuat</th>
						<th scope="col" class="px-6 text-left text-xs font-bold tracking-wider uppercase">Berlaku s.d.</th>
						<th scope="col" class="px-6 text-center text-xs font-bold tracking-wider uppercase">Status</th>
						<th scope="col" class="px-6 text-right text-xs font-bold tracking-wider uppercase">Aksi</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-100">
					{#each paged as inv, i (inv.id)}
						<tr class={`transition-colors hover:bg-violet-50/50 ${i % 2 === 1 ? 'bg-slate-50/60' : 'bg-white'}`}>
							<td class="px-6 py-3.5">
								<span class="block font-semibold text-slate-900">{inv.name}</span>
								<span class="block text-xs text-slate-500">{inv.email}</span>
								{#if inv.note}
									<span class="mt-0.5 block max-w-64 truncate text-[11px] text-slate-400">{inv.note}</span>
								{/if}
							</td>
							<td class="px-6 py-3.5 whitespace-nowrap text-slate-600">{formatDate(inv.createdAt)}</td>
							<td class="px-6 py-3.5 whitespace-nowrap text-slate-600">{formatDate(inv.expiresAt)}</td>
							<td class="px-6 py-3.5 text-center">
								<span class={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${statusClass(inv.status)}`}>
									<span class="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true"></span>{statusLabel(inv.status)}
								</span>
							</td>
							<td class="px-6 py-3.5">
								<div class="flex justify-end gap-2">
									{#if inv.status === 'Pending'}
										<button
											type="button"
											onclick={() => copyLink(inv)}
											aria-label={`Salin tautan undangan untuk ${inv.email}`}
											title="Salin tautan undangan demo (lokal)"
											class="flex min-h-9 min-w-9 items-center justify-center rounded-lg border border-slate-200 p-2 text-slate-500 transition-colors hover:bg-slate-50 hover:text-violet-600 focus-visible:outline-2 focus-visible:outline-violet-600"
										>
											<i class={`fa-solid ${copiedId === inv.id ? 'fa-check text-emerald-600' : 'fa-link'} text-sm`} aria-hidden="true"></i>
										</button>
										<button
											type="button"
											onclick={() => resend(inv)}
											aria-label={`Perbarui masa berlaku undangan ${inv.email}`}
											title="Perbarui masa berlaku (data lokal)"
											class="flex min-h-9 min-w-9 items-center justify-center rounded-lg border border-slate-200 p-2 text-slate-500 transition-colors hover:bg-slate-50 hover:text-blue-600 focus-visible:outline-2 focus-visible:outline-blue-600"
										>
											<i class="fa-solid fa-rotate-right text-sm" aria-hidden="true"></i>
										</button>
										<button
											type="button"
											onclick={() => askCancel(inv)}
											aria-label={`Batalkan undangan ${inv.email}`}
											title="Batalkan undangan"
											class="flex min-h-9 min-w-9 items-center justify-center rounded-lg border border-slate-200 p-2 text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:outline-2 focus-visible:outline-red-500"
										>
											<i class="fa-solid fa-xmark text-sm" aria-hidden="true"></i>
										</button>
									{:else if inv.status === 'Expired' || inv.status === 'Cancelled'}
										<button
											type="button"
											onclick={() => resend(inv)}
											aria-label={`Kirim ulang undangan ${inv.email}`}
											title="Buat undangan baru (data lokal)"
											class="flex min-h-9 min-w-9 items-center justify-center rounded-lg border border-slate-200 p-2 text-slate-500 transition-colors hover:bg-slate-50 hover:text-blue-600 focus-visible:outline-2 focus-visible:outline-blue-600"
										>
											<i class="fa-solid fa-paper-plane text-sm" aria-hidden="true"></i>
										</button>
									{:else}
										<span class="text-xs font-semibold text-slate-400">Selesai</span>
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
				{invitations.length === 0
					? 'Belum ada undangan. Buat undangan pertama lewat tombol Undang Instruktur.'
					: 'Tidak ada undangan yang cocok dengan pencarian.'}
			</p>
		{/if}
		<div class="border-t border-slate-100 bg-slate-50/70">
			<Pagination bind:page bind:perPage totalItems={filtered.length} itemLabel="undangan" label="Navigasi halaman tabel undangan" id="invitation-pagination" activeClass="bg-violet-600 text-white shadow-lg shadow-violet-600/25" />
		</div>
	</div>

	{#if showAdd}
		<div
			class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
			role="dialog"
			aria-modal="true"
			aria-labelledby="add-invite-title"
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
				class="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
			>
				<h2 id="add-invite-title" class="text-lg font-bold text-slate-900">Undang Instruktur</h2>
				<p class="mt-0.5 text-xs text-slate-500">
					Undangan tersimpan lokal (demo) dan berlaku 7 hari. Email tidak benar-benar dikirim —
					butuh backend.
				</p>
				{#if formError}
					<p role="alert" class="mt-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-semibold text-red-700">
						{formError}
					</p>
				{/if}
				<div class="mt-4 space-y-3">
					<div>
						<label for="inv-name" class="mb-1 block text-xs font-bold text-slate-700">Nama lengkap</label>
						<input
							id="inv-name"
							type="text"
							bind:this={firstField}
							bind:value={formName}
							required
							placeholder="cth. Dewi Anggraini"
							class="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 focus:outline-none"
						/>
					</div>
					<div>
						<label for="inv-email" class="mb-1 block text-xs font-bold text-slate-700">Email</label>
						<input
							id="inv-email"
							type="email"
							bind:value={formEmail}
							required
							placeholder="nama@aristoteles.ac.id"
							class="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 focus:outline-none"
						/>
					</div>
					<div>
						<label for="inv-note" class="mb-1 block text-xs font-bold text-slate-700">
							Catatan <span class="font-normal text-slate-400">(opsional)</span>
						</label>
						<input
							id="inv-note"
							type="text"
							bind:value={formNote}
							maxlength={200}
							placeholder="cth. Undangan gelombang 2"
							class="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 focus:outline-none"
						/>
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
						class="flex-1 rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
					>
						Buat Undangan
					</button>
				</div>
			</form>
		</div>
	{/if}

	<WarningModal
		bind:open={showCancel}
		type="warning"
		title="Batalkan undangan?"
		message={pendingCancel
			? `Undangan untuk ${pendingCancel.email} tidak akan bisa dipakai lagi. Tindakan ini hanya berlaku lokal (demo).`
			: 'Undangan ini tidak akan bisa dipakai lagi.'}
		confirmText="Ya, batalkan"
		cancelText="Kembali"
		oncancel={() => {
			pendingCancel = null;
			showCancel = false;
		}}
		onconfirm={confirmCancel}
	/>
</div>
