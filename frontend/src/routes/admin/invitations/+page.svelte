<script lang="ts">
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import { focusTrap } from '$lib/actions/focusTrap';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import Pagination from '$lib/components/Pagination.svelte';
	import WarningModal from '$lib/components/WarningModal.svelte';
	import {
		createBackendInvitation,
		fetchInvitations,
		reissueBackendInvitation,
		revokeBackendInvitation,
		type BackendInvitation,
		type BackendInvitationStatus
	} from '$lib/api/invitations';

	/**
	 * Undangan instruktur — data backend asli (K-01, admin-only).
	 * Email dikirim server via SMTP Nodemailer saat undangan dibuat.
	 * Token plaintext hanya kembali sekali (saat pembuatan + via email);
	 * daftar tidak memuat token, jadi tautan lama tidak bisa disalin ulang.
	 */

	type Filter = 'all' | BackendInvitationStatus;
	type UiStatus = 'Pending' | 'Accepted' | 'Expired' | 'Cancelled';

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
	let copied = $state(false);

	let items = $state<BackendInvitation[]>([]);
	let isLoading = $state(true);
	let loadError = $state('');
	let notice = $state('');
	let revokeBusyId = $state<number | null>(null);
	let reissueBusyId = $state<number | null>(null);
	let pendingCancel: BackendInvitation | null = $state(null);
	let showCancel = $state(false);

	/** Token sekali-tampil (memori saja, hilang saat refresh). */
	let freshToken = $state<{ id: number; email: string; inviteUrl: string; emailSent: boolean } | null>(null);

	function toUiStatus(inv: BackendInvitation): UiStatus {
		if (inv.status === 'accepted') return 'Accepted';
		if (inv.status === 'revoked') return 'Cancelled';
		if (inv.status === 'expired') return 'Expired';
		try {
			return new Date(inv.expiresAt).getTime() <= Date.now() ? 'Expired' : 'Pending';
		} catch {
			return 'Pending';
		}
	}

	function matchesFilter(inv: BackendInvitation): boolean {
		if (filter === 'all') return true;
		if (filter === 'pending') return toUiStatus(inv) === 'Pending';
		if (filter === 'accepted') return inv.status === 'accepted';
		if (filter === 'revoked') return inv.status === 'revoked';
		return toUiStatus(inv) === 'Expired';
	}

	const filtered = $derived(
		items.filter((inv) => {
			if (!matchesFilter(inv)) return false;
			const q = query.trim().toLowerCase();
			if (!q) return true;
			return (
				(inv.name ?? '').toLowerCase().includes(q) || inv.email.toLowerCase().includes(q)
			);
		})
	);

	/* Kembali ke halaman 1 setiap filter/pencarian/jumlah baris/data berubah. */
	$effect(() => {
		void query;
		void filter;
		void perPage;
		void items;
		page = 1;
	});

	const paged = $derived(filtered.slice((page - 1) * perPage, page * perPage));

	function statusClass(s: UiStatus): string {
		if (s === 'Accepted') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
		if (s === 'Pending') return 'border-amber-200 bg-amber-50 text-amber-700';
		if (s === 'Cancelled') return 'border-red-200 bg-red-50 text-red-700';
		return 'border-slate-200 bg-slate-100 text-slate-600';
	}

	/** Label tampil untuk status undangan. Nilai data tidak diubah. */
	function statusLabel(s: UiStatus | 'all'): string {
		if (s === 'Pending') return 'Menunggu';
		if (s === 'Accepted') return 'Diterima';
		if (s === 'Expired') return 'Kedaluarsa';
		if (s === 'Cancelled') return 'Dibatalkan';
		return 'Semua';
	}

	function filterLabel(f: Filter): string {
		if (f === 'all') return 'Semua';
		if (f === 'pending') return 'Menunggu';
		if (f === 'accepted') return 'Diterima';
		if (f === 'expired') return 'Kedaluarsa';
		return 'Dibatalkan';
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

	function messageOf(e: unknown, fallback: string): string {
		return e instanceof Error && e.message ? e.message : fallback;
	}

	async function load(): Promise<void> {
		isLoading = true;
		loadError = '';
		try {
			items = await fetchInvitations();
		} catch (e) {
			loadError = messageOf(e, 'Gagal memuat undangan dari backend.');
		} finally {
			isLoading = false;
		}
	}

	onMount(() => {
		void load();
	});

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

	async function submitAdd(event: Event) {
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
		const dupe = items.some(
			(i) => i.email.toLowerCase() === email.toLowerCase() && toUiStatus(i) === 'Pending'
		);
		if (dupe) {
			formError = 'Email ini sudah memiliki undangan aktif (Menunggu).';
			return;
		}
		isSubmitting = true;
		try {
			const result = await createBackendInvitation({
				email,
				name,
				note: formNote.trim() || undefined
			});
			freshToken = {
				id: result.id,
				email: result.email,
				inviteUrl: result.inviteUrl,
				emailSent: result.emailSent
			};
			closeAdd();
			notice = result.emailSent
				? `Undangan untuk ${result.email} dibuat dan email terkirim. Token juga tampil sekali di bawah — salin sebagai cadangan.`
				: `Undangan untuk ${result.email} dibuat, tetapi email gagal terkirim. Salin tautan sekali-tampil di bawah dan kirim manual.`;
			await load();
		} catch (e) {
			formError = messageOf(e, 'Gagal membuat undangan. Coba lagi nanti.');
		} finally {
			isSubmitting = false;
		}
	}

	async function copyFreshLink(): Promise<void> {
		copied = false;
		if (!freshToken || !browser) return;
		try {
			await navigator.clipboard.writeText(freshToken.inviteUrl);
			copied = true;
			setTimeout(() => {
				copied = false;
			}, 2000);
		} catch {
			notice = 'Gagal menyalin otomatis. Salin manual dari kolom tautan bila diperlukan.';
		}
	}

	function askCancel(inv: BackendInvitation) {
		pendingCancel = inv;
		showCancel = true;
	}

	async function confirmCancel() {
		if (!pendingCancel) {
			showCancel = false;
			return;
		}
		const target = pendingCancel;
		pendingCancel = null;
		showCancel = false;
		revokeBusyId = target.id;
		try {
			await revokeBackendInvitation(target.id);
			notice = `Undangan untuk ${target.email} dibatalkan.`;
			if (freshToken?.id === target.id) freshToken = null;
			await load();
		} catch (e) {
			notice = messageOf(e, 'Gagal membatalkan undangan.');
		} finally {
			revokeBusyId = null;
		}
	}

	/** Terbitkan token baru + kirim email (token lama hangus). */
	async function handleReissue(inv: BackendInvitation) {
		if (reissueBusyId !== null || revokeBusyId !== null) return;
		reissueBusyId = inv.id;
		try {
			const result = await reissueBackendInvitation(inv.id);
			freshToken = {
				id: result.id,
				email: result.email,
				inviteUrl: result.inviteUrl,
				emailSent: result.emailSent
			};
			notice = result.emailSent
				? `Undangan untuk ${result.email} diterbitkan ulang dan email terkirim. Token lama hangus; tautan baru tampil sekali di bawah.`
				: `Token baru untuk ${result.email} diterbitkan, tetapi email gagal terkirim. Salin tautan sekali-tampil di bawah dan kirim manual.`;
			await load();
		} catch (e) {
			notice = messageOf(e, 'Gagal menerbitkan ulang undangan.');
		} finally {
			reissueBusyId = null;
		}
	}
</script>

<svelte:head>
	<title>Undangan Instruktur — Admin Aristoteles</title>
	<meta
		name="description"
		content="Kelola undangan akun instruktur Aristoteles. Email undangan dikirim otomatis oleh backend."
	/>
</svelte:head>

<div class="page-wrap page-stack">
	<PageHeader
		eyebrow="Admin · Undangan Instruktur"
		title="Undangan Instruktur"
		description={`${filtered.length} dari ${items.length} undangan ditampilkan · tersimpan di backend, email dikirim otomatis via SMTP.`}
	>
		{#snippet actions()}
			<button
				type="button"
				bind:this={addBtn}
				onclick={openAdd}
				class="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-violet-600/25 transition-colors hover:bg-violet-700 focus-visible:outline-2 focus-visible:outline-violet-600"
			>
				<i class="fa-solid fa-envelope-open-text" aria-hidden="true"></i> Undang Instruktur
			</button>
		{/snippet}
	</PageHeader>

	<div
		class="mb-6 flex items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs leading-relaxed text-blue-900"
		role="note"
	>
		<i class="fa-solid fa-circle-info mt-0.5 shrink-0" aria-hidden="true"></i>
		<p>
			<strong>Token sekali-tampil:</strong> tautan aktivasi hanya dikembalikan sekali saat
			undangan dibuat (dan dikirim ke email penerima). Daftar di bawah tidak memuat token,
			jadi tautan lama tidak bisa disalin ulang — buat undangan baru bila diperlukan.
		</p>
	</div>

	{#if freshToken}
		<div
			role="status"
			class="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-900"
		>
			<p class="font-bold">
				Tautan sekali-tampil untuk {freshToken.email}
				{#if !freshToken.emailSent}
					<span class="font-normal">(email gagal terkirim — kirim manual)</span>
				{/if}
			</p>
			<p class="mt-1 font-mono break-all">{freshToken.inviteUrl}</p>
			<button
				type="button"
				onclick={() => void copyFreshLink()}
				class="mt-2 rounded-lg bg-emerald-600 px-4 py-2 font-bold text-white hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-emerald-600"
			>
				{copied ? 'Disalin' : 'Salin tautan'}
			</button>
		</div>
	{/if}

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
			{#each (['all', 'pending', 'accepted', 'expired', 'revoked'] as Filter[]) as s (s)}
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
					{filterLabel(s)}
				</button>
			{/each}
		</div>
	</div>

	<div class="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm">
		<div class="h-1 bg-gradient-to-r from-violet-600 via-fuchsia-500 to-violet-600" aria-hidden="true"></div>
		{#if isLoading}
			<p role="status" class="p-8 text-center text-sm text-slate-500">
				<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i>
				Memuat undangan dari backend…
			</p>
		{:else if loadError}
			<div class="p-8 text-center">
				<p role="alert" class="text-sm font-semibold text-red-600">{loadError}</p>
				<button
					type="button"
					onclick={() => void load()}
					class="mt-3 rounded-xl bg-violet-600 px-5 py-2 text-xs font-bold text-white hover:bg-violet-700 focus-visible:outline-2 focus-visible:outline-violet-600"
				>
					Coba lagi
				</button>
			</div>
		{:else}
			<ol class="divide-y divide-slate-100 rounded-2xl border border-slate-200/70 bg-white md:hidden" aria-label="Daftar undangan">
				{#each paged as inv (inv.id)}
					{@const ui = toUiStatus(inv)}
					<li class="px-4 py-3.5">
						<div class="flex items-start justify-between gap-3">
							<div class="min-w-0 flex-1">
								<p class="truncate font-semibold text-slate-900">{inv.name ?? '-'}</p>
								<p class="truncate text-xs text-slate-500">{inv.email}</p>
								<p class="mt-0.5 text-[11px] text-slate-400">s.d. {formatDate(inv.expiresAt)}</p>
							</div>
							<span class={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${statusClass(ui)}`}>
								<span class="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true"></span>{statusLabel(ui)}
							</span>
						</div>
						{#if ui === 'Pending' || ui === 'Expired'}
							<div class="mt-2.5 flex gap-2">
								<button type="button" onclick={() => void handleReissue(inv)} disabled={reissueBusyId === inv.id || revokeBusyId === inv.id} class="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-60">
									<i class="fa-solid fa-paper-plane" aria-hidden="true"></i> Kirim ulang
								</button>
								{#if ui === 'Pending'}
									<button type="button" onclick={askCancel.bind(null, inv)} disabled={revokeBusyId === inv.id || reissueBusyId === inv.id} class="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-red-200 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-red-500 disabled:cursor-not-allowed disabled:opacity-60">
										<i class="fa-solid fa-xmark" aria-hidden="true"></i> Batalkan
									</button>
								{/if}
							</div>
						{/if}
					</li>
				{/each}
			</ol>
			<div class="hidden overflow-x-auto md:block">
				<table class="w-full min-w-[820px] text-sm">
					<caption class="sr-only">Daftar undangan instruktur</caption>
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
						{#each paged as inv (inv.id)}
							{@const ui = toUiStatus(inv)}
							<tr class="bg-white transition-colors hover:bg-violet-50/50">
								<td class="px-6 py-3.5">
									<span class="block font-semibold text-slate-900">{inv.name ?? '-'}</span>
									<span class="block text-xs text-slate-500">{inv.email}</span>
									{#if inv.note}
										<span class="mt-0.5 block max-w-64 truncate text-[11px] text-slate-400">{inv.note}</span>
									{/if}
								</td>
								<td class="px-6 py-3.5 whitespace-nowrap text-slate-600">{formatDate(inv.createdAt)}</td>
								<td class="px-6 py-3.5 whitespace-nowrap text-slate-600">{formatDate(inv.expiresAt)}</td>
								<td class="px-6 py-3.5 text-center">
									<span class={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${statusClass(ui)}`}>
										<span class="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true"></span>{statusLabel(ui)}
									</span>
								</td>
								<td class="px-6 py-3.5">
									<div class="flex justify-end gap-2">
										{#if ui === 'Pending' || ui === 'Expired'}
											<button
												type="button"
												onclick={() => void handleReissue(inv)}
												disabled={reissueBusyId === inv.id || revokeBusyId === inv.id}
												aria-label={`Terbitkan ulang undangan ${inv.email}`}
												title="Terbitkan token baru + kirim email (token lama hangus)"
												class="flex min-h-9 min-w-9 items-center justify-center rounded-lg border border-slate-200 p-2 text-slate-500 transition-colors hover:bg-slate-50 hover:text-blue-600 focus-visible:outline-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
											>
												<i class="fa-solid fa-paper-plane text-sm" aria-hidden="true"></i>
											</button>
										{/if}
										{#if ui === 'Pending'}
											<button
												type="button"
												onclick={askCancel.bind(null, inv)}
												disabled={revokeBusyId === inv.id || reissueBusyId === inv.id}
												aria-label={`Batalkan undangan ${inv.email}`}
												title="Batalkan undangan"
												class="flex min-h-9 min-w-9 items-center justify-center rounded-lg border border-slate-200 p-2 text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:outline-2 focus-visible:outline-red-500 disabled:cursor-not-allowed disabled:opacity-60"
											>
												<i class="fa-solid fa-xmark text-sm" aria-hidden="true"></i>
											</button>
										{:else if ui === 'Expired'}
											<span class="self-center text-xs font-semibold text-slate-400">Kedaluwarsa</span>
										{:else}
											<span class="self-center text-xs font-semibold text-slate-400">Selesai</span>
										{/if}
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
		{#if !isLoading && !loadError && filtered.length === 0}
			<p class="border-t border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
				{items.length === 0
					? 'Belum ada undangan. Buat undangan pertama lewat tombol Undang Instruktur.'
					: 'Tidak ada undangan yang cocok dengan pencarian.'}
			</p>
		{/if}
		<div class="border-t border-slate-100 bg-slate-50/70">
			<Pagination bind:page bind:perPage totalItems={filtered.length} itemLabel="undangan" label="Navigasi halaman tabel undangan" id="invitation-pagination" activeClass="bg-violet-600 text-white shadow-lg shadow-violet-600/25" />
		</div>
	</div>

	{#if showAdd}
		<!-- svelte-ignore a11y_click_events_have_key_events : keyboard (Escape/Tab) ditangani use:focusTrap -->
		<div
			class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
			role="dialog"
			aria-modal="true"
			aria-labelledby="add-invite-title"
			tabindex="-1"
			use:focusTrap={{ onEscape: () => closeAdd() }}
			onclick={(e) => {
				if (e.target === e.currentTarget) closeAdd();
			}}
		>
			<form
				onsubmit={submitAdd}
				class="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
			>
				<h2 id="add-invite-title" class="text-lg font-bold text-slate-900">Undang Instruktur</h2>
				<p class="mt-0.5 text-xs text-slate-500">
					Email undangan dikirim otomatis oleh backend dan berlaku 7 hari.
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
						{isSubmitting ? 'Mengirim…' : 'Buat & Kirim Undangan'}
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
			? `Undangan untuk ${pendingCancel.email} tidak akan bisa dipakai lagi.`
			: 'Undangan ini tidak akan bisa dipakai lagi.'}
		confirmText="Ya, batalkan"
		cancelText="Kembali"
		oncancel={() => {
			pendingCancel = null;
			showCancel = false;
		}}
		onconfirm={() => void confirmCancel()}
	/>
</div>
