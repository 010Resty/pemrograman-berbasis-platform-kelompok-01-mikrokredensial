<script lang="ts">
	import { browser } from '$app/environment';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import WarningModal from '$lib/components/WarningModal.svelte';
	import {
		createCategory,
		deleteCategory,
		fetchAdminCategories,
		patchCategory,
		type AdminCategory
	} from '$lib/api/categories';

	/**
	 * Kelola kategori kursus (admin-only): tambah, ganti nama, aktif/nonaktif,
	 * hapus permanen (ditolak bila masih dipakai kursus).
	 * Dropdown/filter di seluruh portal membaca daftar aktif dari server;
	 * nonaktif menyembunyikan dari pilihan tanpa merusak kursus lama.
	 */

	let items = $state<AdminCategory[]>([]);
	let loading = $state(true);
	let loadError = $state('');
	let notice = $state('');

	let newName = $state('');
	let creating = $state(false);
	let createError = $state('');
	let showAdd = $state(false);
	let nameInput = $state<HTMLInputElement | null>(null);
	let lastFocused = $state<Element | null>(null);

	let editId = $state<number | null>(null);
	let editName = $state('');
	let editBusy = $state(false);
	let editError = $state('');

	let pendingDelete = $state<AdminCategory | null>(null);
	let deleteOpen = $state(false);
	let deleteBusy = $state(false);
	/** Galat hapus ditampilkan DI DALAM modal (merah) agar tak terkecoh banner sukses. */
	let deleteError = $state('');

	let pendingToggle = $state<AdminCategory | null>(null);
	let toggleOpen = $state(false);
	let toggleBusy = $state(false);

	let started = false;

	async function load(): Promise<void> {
		loading = true;
		loadError = '';
		try {
			items = await fetchAdminCategories();
		} catch (e) {
			loadError = e instanceof Error ? e.message : 'Gagal memuat kategori.';
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		if (!browser || started) return;
		started = true;
		void load();
	});

	/* Kunci scroll + fokus awal + kembalikan fokus saat modal tambah ditutup. */
	$effect(() => {
		if (!showAdd) return;
		lastFocused = document.activeElement;
		document.body.style.overflow = 'hidden';
		nameInput?.focus();
		return () => {
			document.body.style.overflow = '';
			if (lastFocused instanceof HTMLElement) lastFocused.focus();
		};
	});

	async function submitCreate(e: Event): Promise<void> {
		e.preventDefault();
		createError = '';
		notice = '';
		if (newName.trim().length < 2) {
			createError = 'Nama kategori minimal 2 karakter.';
			return;
		}
		creating = true;
		try {
			await createCategory({ name: newName.trim() });
			newName = '';
			showAdd = false;
			notice = 'Kategori berhasil ditambahkan.';
			await load();
		} catch (e) {
			createError = e instanceof Error ? e.message : 'Gagal menambah kategori.';
		} finally {
			creating = false;
		}
	}

	function openAdd(): void {
		createError = '';
		showAdd = true;
	}

	function closeAdd(): void {
		if (creating) return;
		showAdd = false;
	}

	function handleAddKeydown(event: KeyboardEvent): void {
		if (event.key === 'Escape') {
			event.stopPropagation();
			closeAdd();
		}
	}

	function openEdit(c: AdminCategory): void {
		editId = editId === c.id ? null : c.id;
		editName = c.name;
		editError = '';
	}

	async function submitEdit(c: AdminCategory): Promise<void> {
		editError = '';
		notice = '';
		const name = editName.trim();
		if (name.length < 2) {
			editError = 'Nama kategori minimal 2 karakter.';
			return;
		}
		if (name === c.name) {
			editError = 'Tidak ada perubahan.';
			return;
		}
		editBusy = true;
		try {
			await patchCategory(c.id, { name });
			editId = null;
			notice = `Kategori "${c.name}" diperbarui.`;
			await load();
		} catch (e) {
			editError = e instanceof Error ? e.message : 'Gagal memperbarui kategori.';
		} finally {
			editBusy = false;
		}
	}

	/** Nonaktifkan selalu lewat modal; aktifkan langsung (aman). */
	function askToggle(c: AdminCategory): void {
		if (!c.isActive) {
			void doToggle(c, true);
			return;
		}
		pendingToggle = c;
		toggleOpen = true;
	}

	async function doToggle(c: AdminCategory, toActive: boolean): Promise<void> {
		toggleBusy = true;
		notice = '';
		try {
			await patchCategory(c.id, { isActive: toActive });
			notice = toActive
				? `Kategori "${c.name}" diaktifkan kembali.`
				: `Kategori "${c.name}" dinonaktifkan — hilang dari pilihan, kursus lama tetap tampil.`;
			await load();
		} catch (e) {
			notice = e instanceof Error ? e.message : 'Gagal mengubah status.';
		} finally {
			toggleBusy = false;
		}
	}

	async function confirmToggle(): Promise<void> {
		if (!pendingToggle || toggleBusy) return;
		const target = pendingToggle;
		pendingToggle = null;
		toggleOpen = false;
		await doToggle(target, false);
	}

	async function confirmDelete(): Promise<void> {
		if (!pendingDelete || deleteBusy) return;
		const target = pendingDelete;
		deleteBusy = true;
		deleteError = '';
		notice = '';
		try {
			await deleteCategory(target.id);
			pendingDelete = null;
			deleteOpen = false;
			deleteError = '';
			notice = `Kategori "${target.name}" dihapus.`;
			if (editId === target.id) editId = null;
			await load();
		} catch (e) {
			// Modal SENGAJA tidak ditutup: admin harus sadar hapus gagal
			// (mis. 409 masih dipakai kursus), bukan mengira berhasil.
			deleteError = e instanceof Error ? e.message : 'Gagal menghapus kategori.';
		} finally {
			deleteBusy = false;
		}
	}
</script>

<svelte:head>
	<title>Kategori — Admin Aristoteles</title>
	<meta name="description" content="Kelola kategori kursus platform Aristoteles." />
</svelte:head>

<div class="page-wrap page-stack">
	<PageHeader
		eyebrow="Admin · Katalog"
		title="Kategori"
		description="Daftar resmi kategori kursus. Dropdown dan filter di seluruh portal membaca daftar aktif ini."
	>
		{#snippet actions()}
			<button
				type="button"
				onclick={openAdd}
				class="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-blue-600 px-5 text-xs font-bold text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
				aria-haspopup="dialog"
			>
				<i class="fa-solid fa-plus" aria-hidden="true"></i> Tambah kategori
			</button>
		{/snippet}
	</PageHeader>

	{#if notice}
		<p
			role="status"
			class="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs font-semibold text-blue-800"
		>
			{notice}
		</p>
	{/if}

	{#if showAdd}
		<div
			class="fixed inset-0 z-[70] flex items-end justify-center bg-slate-900/50 p-4 sm:items-center"
			role="presentation"
			onclick={(e) => {
				if (e.target === e.currentTarget) closeAdd();
			}}
		>
			<div
				tabindex="-1"
				role="dialog"
				aria-modal="true"
				aria-labelledby="cat-add-title"
				onkeydown={handleAddKeydown}
				class="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl sm:p-6"
			>
				<div class="mb-4 flex items-start justify-between gap-3">
					<div>
						<h2 id="cat-add-title" class="text-base font-extrabold text-slate-900">
							Tambah kategori
						</h2>
						<p class="mt-0.5 text-xs text-slate-500">
							Slug dibuat otomatis dari nama. Kategori baru langsung muncul di pilihan.
						</p>
					</div>
					<button
						type="button"
						onclick={closeAdd}
						disabled={creating}
						aria-label="Tutup formulir kategori"
						class="flex min-h-11 min-w-11 items-center justify-center rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
					>
						<i class="fa-solid fa-xmark text-lg" aria-hidden="true"></i>
					</button>
				</div>
				<form onsubmit={submitCreate} aria-label="Formulir kategori baru">
					<label for="cat-name" class="mb-1.5 block text-xs font-bold text-slate-700"
						>Nama kategori</label
					>
					<input
						id="cat-name"
						bind:value={newName}
						bind:this={nameInput}
						placeholder="cth. Fotografi"
						maxlength={100}
						autocomplete="off"
						class="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
					/>
					{#if createError}
						<p role="alert" class="mt-2 text-xs font-semibold text-red-600">{createError}</p>
					{/if}
					<button
						type="submit"
						disabled={creating}
						class="mt-4 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-blue-600"
					>
						{#if creating}<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i> Menyimpan…{:else}<i
								class="fa-solid fa-check"
								aria-hidden="true"
							></i> Simpan kategori{/if}
					</button>
				</form>
			</div>
		</div>
	{/if}

	{#if loading}
		<div class="rounded-2xl border border-slate-200 bg-white p-12 text-center" aria-label="Memuat kategori">
			<div
				class="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600"
				aria-hidden="true"
			></div>
			<p class="mt-3 text-xs font-semibold text-slate-500">Memuat kategori…</p>
		</div>
	{:else if loadError}
		<div role="alert" class="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
			<p class="text-sm font-bold text-red-700">Kategori belum dapat dimuat</p>
			<p class="mx-auto mt-1 max-w-md text-xs text-red-600">{loadError}</p>
			<button
				type="button"
				onclick={() => void load()}
				class="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-red-600"
			>
				Coba lagi
			</button>
		</div>
	{:else if items.length === 0}
		<div class="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
			<p class="text-sm font-semibold text-slate-700">Belum ada kategori.</p>
		</div>
	{:else}
		<div class="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm">
			<ul class="divide-y divide-slate-100">
				{#each items as c (c.id)}
					<li class="p-5">
						<div class="flex flex-wrap items-center justify-between gap-3">
							<div class="min-w-0">
								<p class="flex flex-wrap items-center gap-2 text-sm font-bold text-slate-900">
									<a
										href={`/admin/kategori/${c.id}`}
										class="truncate rounded hover:text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-blue-600"
										aria-label={`Lihat kursus kategori ${c.name}`}
									>
										{c.name}
									</a>
									<span class="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-500">/{c.slug}</span>
									<span
										class={`rounded-md px-2 py-0.5 text-[11px] font-bold ${c.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}
									>
										{c.isActive ? 'Aktif' : 'Nonaktif'}
									</span>
								</p>
								<p class="mt-1 text-xs text-slate-500">
									<a
										href={`/admin/kategori/${c.id}`}
										class="rounded font-semibold text-blue-600 hover:text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-blue-600"
									>
										{c.courseCount} kursus memakai
									</a>
								</p>
							</div>
							<div class="flex flex-wrap items-center gap-2">
								<button
									type="button"
									onclick={() => openEdit(c)}
									aria-expanded={editId === c.id}
									class="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-slate-200 px-4 text-xs font-bold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600"
								>
									<i class="fa-solid fa-pen" aria-hidden="true"></i>
									{editId === c.id ? 'Tutup' : 'Ubah'}
								</button>
								<button
									type="button"
									onclick={() => askToggle(c)}
									class="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-slate-200 px-4 text-xs font-bold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600"
								>
									{c.isActive ? 'Nonaktifkan' : 'Aktifkan'}
								</button>
								<button
									type="button"
									onclick={() => {
										pendingDelete = c;
										deleteOpen = true;
										deleteError = '';
									}}
									class="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-red-200 px-4 text-xs font-bold text-red-600 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-red-600"
								>
									<i class="fa-solid fa-trash-can" aria-hidden="true"></i> Hapus
								</button>
							</div>
						</div>
						{#if editId === c.id}
							<form
								onsubmit={(e) => {
									e.preventDefault();
									void submitEdit(c);
								}}
								class="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-[1fr_auto]"
								aria-label={`Ubah kategori ${c.name}`}
							>
								<div>
									<label for="edit-name-{c.id}" class="mb-1.5 block text-xs font-bold text-slate-700">Nama</label>
									<input
										id="edit-name-{c.id}"
										bind:value={editName}
										maxlength={100}
										class="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
									/>
								</div>
								<div class="flex items-end">
									<button
										type="submit"
										disabled={editBusy}
										class="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-blue-600 px-5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-blue-600"
									>
										{#if editBusy}<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i> Menyimpan…{:else}Simpan{/if}
									</button>
								</div>
							</form>
							{#if editError}
								<p role="alert" class="mt-2 text-xs font-semibold text-red-600">{editError}</p>
							{/if}
							<p class="mt-1.5 text-[11px] text-slate-500">
								Ganti nama ikut mengubah kursus yang memakai kategori ini.
							</p>
						{/if}
					</li>
				{/each}
			</ul>
		</div>
	{/if}
</div>

<WarningModal
	bind:open={toggleOpen}
	title="Nonaktifkan kategori ini?"
	message={pendingToggle
		? `Kategori "${pendingToggle.name}" hilang dari pilihan dropdown dan filter, tapi ${pendingToggle.courseCount} kursus yang memakainya tetap tampil dan tidak ikut nonaktif.`
		: ''}
	confirmText="Ya, nonaktifkan"
	type="warning"
	loading={toggleBusy}
	onconfirm={() => void confirmToggle()}
	oncancel={() => {
		pendingToggle = null;
		toggleOpen = false;
	}}
/>

<WarningModal
	bind:open={deleteOpen}
	title="Hapus kategori ini?"
	message={pendingDelete
		? pendingDelete.courseCount > 0
			? `Tidak dapat dihapus: kategori "${pendingDelete.name}" masih dipakai ${pendingDelete.courseCount} kursus. Nonaktifkan saja agar kursus lama tetap tampil dan kategori hilang dari pilihan.`
			: `Kategori "${pendingDelete.name}" akan dihapus permanen dan tidak bisa dikembalikan.`
		: ''}
	confirmText="Ya, hapus"
	type="danger"
	loading={deleteBusy}
	onconfirm={() => void confirmDelete()}
	oncancel={() => {
		pendingDelete = null;
		deleteOpen = false;
		deleteError = '';
	}}
>
	{#snippet extra()}
		{#if deleteError}
			<p role="alert" class="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-semibold text-red-700">
				<i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i> {deleteError}
			</p>
		{/if}
	{/snippet}
</WarningModal>
