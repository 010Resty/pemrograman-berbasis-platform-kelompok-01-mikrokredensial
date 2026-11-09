<script lang="ts">
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import WarningModal from '$lib/components/WarningModal.svelte';
	import {
		addCourseToPromo,
		createPromo,
		fetchAdminPromoDetail,
		fetchAdminPromos,
		patchPromo,
		removeCourseFromPromo,
		type AdminPromoCampaign,
		type PromoType
	} from '$lib/api/promos';
	import { fetchAdminCourses } from '$lib/api/admin';
	import type { BackendCourse } from '$lib/api/courses';

	/**
	 * Kelola promo kurasi (admin-only): kampanye + keanggotaan kursus per promo.
	 * Diskon percent-only 1–90; non-stack vs voucher (terbesar menang di pembayaran).
	 * Status arsip tidak menghapus riwayat pembayaran (snapshot promoSlug).
	 */

	let items = $state<AdminPromoCampaign[]>([]);
	let courses = $state<BackendCourse[]>([]);
	let isLoading = $state(true);
	let loadError = $state('');
	let notice = $state('');

	/* --- Formulir tambah kampanye --- */
	let showAdd = $state(false);
	let formSlug = $state('');
	let formTitle = $state('');
	let formBadge = $state('');
	let formType = $state<PromoType>('diskon');
	let formPercent = $state('20');
	let formStatus = $state<'draft' | 'active'>('draft');
	let formStartsAt = $state('');
	let formEndsAt = $state('');
	let formError = $state('');
	let isSubmitting = $state(false);

	/* --- Kelola anggota --- */
	let openSlug = $state<string | null>(null);
	let memberIds = $state<number[]>([]);
	let memberTitles = $state(new Map<number, string>());
	let memberLoading = $state(false);
	let addCourseId = $state('');
	let addPosition = $state('0');
	let addBadge = $state('');
	let memberError = $state('');
	let memberBusy = $state(false);
	let pendingRemove = $state<{ slug: string; courseId: number } | null>(null);
	let confirmOpen = $state(false);

	function askRemove(slug: string, courseId: number): void {
		pendingRemove = { slug, courseId };
		confirmOpen = true;
	}

	async function load(): Promise<void> {
		isLoading = true;
		loadError = '';
		try {
			const [promos, list] = await Promise.all([
				fetchAdminPromos(),
				fetchAdminCourses(100).catch((): BackendCourse[] => [])
			]);
			items = promos;
			courses = list;
		} catch (e) {
			loadError = e instanceof Error ? e.message : 'Gagal memuat promo.';
		} finally {
			isLoading = false;
		}
	}

	async function openMembers(slug: string): Promise<void> {
		if (openSlug === slug) {
			openSlug = null;
			return;
		}
		openSlug = slug;
		memberIds = [];
		memberError = '';
		memberLoading = true;
		try {
			const detail = await fetchAdminPromoDetail(slug);
			memberIds = detail.courses.map((m) => m.courseId);
			const next = new Map(memberTitles);
			for (const m of detail.courses) next.set(m.courseId, m.title);
			memberTitles = next;
		} catch (e) {
			memberError = e instanceof Error ? e.message : 'Gagal memuat anggota promo.';
		} finally {
			memberLoading = false;
		}
	}

	function courseTitle(id: number): string {
		return memberTitles.get(id) ?? courses.find((c) => c.id === id)?.title ?? `Kursus #${id}`;
	}

	async function submitAdd(e: Event): Promise<void> {
		e.preventDefault();
		formError = '';
		const slug = formSlug.trim().toLowerCase();
		if (!/^[a-z0-9-]{3,100}$/.test(slug)) {
			formError = 'Slug 3–100 karakter (huruf kecil, angka, tanda -).';
			return;
		}
		if (formTitle.trim().length < 3) {
			formError = 'Judul minimal 3 karakter.';
			return;
		}
		let percent: number | undefined;
		if (formType === 'diskon') {
			percent = Number(formPercent);
			if (!Number.isInteger(percent) || percent < 1 || percent > 90) {
				formError = 'Diskon persen 1–90.';
				return;
			}
		}
		isSubmitting = true;
		try {
			await createPromo({
				slug,
				title: formTitle.trim(),
				badgeLabel: formBadge.trim() || undefined,
				type: formType,
				discountPercent: percent,
				status: formStatus,
				startsAt: formStartsAt || undefined,
				endsAt: formEndsAt || undefined
			});
			showAdd = false;
			formSlug = '';
			formTitle = '';
			formBadge = '';
			formPercent = '20';
			notice = `Promo "${slug}" dibuat.`;
			await load();
		} catch (e) {
			formError = e instanceof Error ? e.message : 'Gagal membuat promo.';
		} finally {
			isSubmitting = false;
		}
	}

	async function setStatus(slug: string, status: 'draft' | 'active' | 'archived'): Promise<void> {
		notice = '';
		try {
			await patchPromo(slug, { status });
			notice = `Promo "${slug}" → ${status}.`;
			await load();
		} catch (e) {
			notice = e instanceof Error ? e.message : 'Gagal mengubah status.';
		}
	}

	async function submitAddCourse(e: Event, slug: string): Promise<void> {
		e.preventDefault();
		memberError = '';
		const courseId = Number(addCourseId);
		if (!Number.isInteger(courseId) || courseId <= 0) {
			memberError = 'Pilih kursus dulu.';
			return;
		}
		memberBusy = true;
		try {
			await addCourseToPromo(slug, {
				courseId,
				position: Number(addPosition) || 0,
				customBadge: addBadge.trim() || undefined
			});
			addCourseId = '';
			addBadge = '';
			notice = `Kursus #${courseId} ditambahkan ke "${slug}".`;
			await Promise.all([load(), openMembersRefresh(slug)]);
		} catch (e) {
			memberError = e instanceof Error ? e.message : 'Gagal menambahkan kursus.';
		} finally {
			memberBusy = false;
		}
	}

	async function openMembersRefresh(slug: string): Promise<void> {
		try {
			const detail = await fetchAdminPromoDetail(slug);
			memberIds = detail.courses.map((m) => m.courseId);
			const next = new Map(memberTitles);
			for (const m of detail.courses) next.set(m.courseId, m.title);
			memberTitles = next;
		} catch {
			// Daftar utama sudah dimuat ulang; anggota menyusul di buka berikutnya.
		}
	}

	async function confirmRemove(): Promise<void> {
		if (!pendingRemove) return;
		const { slug, courseId } = pendingRemove;
		pendingRemove = null;
		confirmOpen = false;
		memberBusy = true;
		try {
			await removeCourseFromPromo(slug, courseId);
			notice = `Kursus #${courseId} dihapus dari "${slug}".`;
			await Promise.all([load(), openMembersRefresh(slug)]);
		} catch (e) {
			memberError = e instanceof Error ? e.message : 'Gagal menghapus kursus.';
		} finally {
			memberBusy = false;
		}
	}

	$effect(() => {
		void load();
	});
</script>

<svelte:head>
	<title>Promo — Admin Aristoteles</title>
	<meta name="description" content="Kelola kampanye promo dan keanggotaan kursus (admin)." />
</svelte:head>

<div class="page-wrap page-stack">
	<PageHeader
		eyebrow="Admin · Pemasaran"
		title="Promo"
		description="Kurasi per kursus: diskon persen otomatis di pembayaran, pajang di landing/katalog, atau syarat patungan."
	/>

	{#if notice}
		<p role="status" class="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs font-semibold text-blue-800">{notice}</p>
	{/if}

	<div class="flex flex-wrap gap-2">
		<button
			type="button"
			onclick={() => (showAdd = !showAdd)}
			class="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-blue-600 px-5 text-xs font-bold text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
			aria-expanded={showAdd}
		>
			<i class="fa-solid fa-plus" aria-hidden="true"></i> {showAdd ? 'Tutup formulir' : 'Buat promo'}
		</button>
	</div>

	{#if showAdd}
		<form
			onsubmit={submitAdd}
			class="grid gap-3 rounded-2xl border border-slate-200 bg-white p-5 sm:grid-cols-2"
			aria-label="Formulir promo baru"
		>
			<div>
				<label for="promo-slug" class="mb-1.5 block text-xs font-bold text-slate-700">Slug</label>
				<input
					id="promo-slug"
					bind:value={formSlug}
					placeholder="promo-akhir-tahun"
					autocomplete="off"
					class="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 font-mono text-sm lowercase focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
				/>
			</div>
			<div>
				<label for="promo-title" class="mb-1.5 block text-xs font-bold text-slate-700">Judul</label>
				<input
					id="promo-title"
					bind:value={formTitle}
					placeholder="Promo Akhir Tahun"
					class="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
				/>
			</div>
			<div>
				<label for="promo-badge" class="mb-1.5 block text-xs font-bold text-slate-700">Badge (opsional)</label>
				<input
					id="promo-badge"
					bind:value={formBadge}
					placeholder="Hemat Akhir Tahun"
					class="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
				/>
			</div>
			<div class="grid grid-cols-2 gap-3">
				<div>
					<label for="promo-type" class="mb-1.5 block text-xs font-bold text-slate-700">Jenis</label>
					<select
						id="promo-type"
						bind:value={formType}
						class="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
					>
						<option value="diskon">Diskon %</option>
						<option value="kurasi">Pajang</option>
						<option value="patungan">Patungan</option>
					</select>
				</div>
				<div>
					<label for="promo-percent" class="mb-1.5 block text-xs font-bold text-slate-700">Diskon % (1–90)</label>
					<input
						id="promo-percent"
						bind:value={formPercent}
						disabled={formType !== 'diskon'}
						inputmode="numeric"
						class="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none disabled:bg-slate-100"
					/>
				</div>
			</div>
			<div>
				<label for="promo-status" class="mb-1.5 block text-xs font-bold text-slate-700">Status awal</label>
				<select
					id="promo-status"
					bind:value={formStatus}
					class="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
				>
					<option value="draft">Draft</option>
					<option value="active">Aktif</option>
				</select>
			</div>
			<div class="grid grid-cols-2 gap-3">
				<div>
					<label for="promo-start" class="mb-1.5 block text-xs font-bold text-slate-700">Mulai (opsional)</label>
					<input
						id="promo-start"
						type="datetime-local"
						bind:value={formStartsAt}
						class="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
					/>
				</div>
				<div>
					<label for="promo-end" class="mb-1.5 block text-xs font-bold text-slate-700">Berakhir (opsional)</label>
					<input
						id="promo-end"
						type="datetime-local"
						bind:value={formEndsAt}
						class="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
					/>
				</div>
			</div>
			{#if formError}
				<p role="alert" class="text-xs font-semibold text-red-600 sm:col-span-2">{formError}</p>
			{/if}
			<div class="sm:col-span-2">
				<button
					type="submit"
					disabled={isSubmitting}
					class="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-blue-600 px-5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-blue-600"
				>
					{#if isSubmitting}<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i> Menyimpan…{:else}<i class="fa-solid fa-check" aria-hidden="true"></i> Simpan promo{/if}
				</button>
			</div>
		</form>
	{/if}

	{#if isLoading}
		<div class="rounded-2xl border border-slate-200 bg-white p-12 text-center" aria-label="Memuat promo">
			<div class="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" aria-hidden="true"></div>
			<p class="mt-3 text-xs font-semibold text-slate-500">Memuat kampanye promo…</p>
		</div>
	{:else if loadError}
		<div role="alert" class="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
			<p class="text-sm font-bold text-red-700">Promo belum dapat dimuat</p>
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
			<i class="fa-solid fa-tags mb-3 text-3xl text-slate-300" aria-hidden="true"></i>
			<p class="text-sm font-semibold text-slate-700">Belum ada promo.</p>
			<p class="mt-1 text-xs text-slate-500">Buat kampanye pertama, lalu tambahkan kursus anggotanya.</p>
		</div>
	{:else}
		<div class="space-y-4">
			{#each items as camp (camp.slug)}
				<article class="overflow-hidden rounded-2xl border border-slate-200/70 bg-white">
					<div class="flex flex-wrap items-center justify-between gap-3 p-5">
						<div class="min-w-0">
							<p class="flex flex-wrap items-center gap-2 text-[11px] font-bold tracking-wide uppercase">
								<span class="rounded-md bg-slate-900 px-2 py-0.5 font-mono text-white normal-case">/{camp.slug}</span>
								<span class="rounded-md bg-slate-100 px-2 py-0.5 text-slate-600">{camp.type}</span>
								<span class={`rounded-md px-2 py-0.5 ${camp.status === 'active' ? 'bg-emerald-100 text-emerald-700' : camp.status === 'archived' ? 'bg-slate-200 text-slate-500' : 'bg-amber-100 text-amber-800'}`}>{camp.status}</span>
								{#if camp.type === 'diskon' && camp.discountPercent !== null}<span class="rounded-md bg-red-600 px-2 py-0.5 text-white">−{camp.discountPercent}%</span>{/if}
							</p>
							<h2 class="mt-1.5 truncate text-base font-extrabold text-slate-900">{camp.title}</h2>
							<p class="mt-0.5 text-xs text-slate-500">{camp.courseCount ?? 0} kursus anggota{#if camp.badgeLabel} · {camp.badgeLabel}{/if}</p>
						</div>
						<div class="flex flex-wrap items-center gap-2">
							<button
								type="button"
								onclick={() => void openMembers(camp.slug)}
								class="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-slate-200 px-4 text-xs font-bold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600"
								aria-expanded={openSlug === camp.slug}
							>
								<i class="fa-solid fa-list" aria-hidden="true"></i>
								{openSlug === camp.slug ? 'Tutup' : 'Kelola kursus'}
							</button>
							{#if camp.status !== 'active'}
								<button
									type="button"
									onclick={() => void setStatus(camp.slug, 'active')}
									class="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-emerald-600 px-4 text-xs font-bold text-white hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-emerald-600"
								>
									Aktifkan
								</button>
							{:else}
								<button
									type="button"
									onclick={() => void setStatus(camp.slug, 'archived')}
									class="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-slate-200 px-4 text-xs font-bold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600"
								>
									Arsipkan
								</button>
							{/if}
						</div>
					</div>
					{#if openSlug === camp.slug}
						<div class="border-t border-slate-100 bg-slate-50/70 p-5">
							{#if memberLoading}
								<p class="text-xs font-semibold text-slate-500">Memuat anggota…</p>
							{:else if memberIds.length === 0}
								<p class="text-xs text-slate-500">Belum ada kursus anggota. Tambahkan lewat formulir di bawah.</p>
							{:else}
								<ul class="space-y-2">
									{#each memberIds as id (id)}
										<li class="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5">
											<span class="min-w-0 truncate text-sm font-semibold text-slate-800">{courseTitle(id)} <span class="font-mono text-[11px] text-slate-400">#{id}</span></span>
											<button
												type="button"
												onclick={() => askRemove(camp.slug, id)}
												disabled={memberBusy}
												class="inline-flex min-h-[36px] shrink-0 items-center rounded-lg px-3 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-red-600"
											>
												Hapus
											</button>
										</li>
									{/each}
								</ul>
							{/if}
							{#if memberError}
								<p role="alert" class="mt-2 text-xs font-semibold text-red-600">{memberError}</p>
							{/if}
							<form class="mt-3 flex flex-wrap items-end gap-2" onsubmit={(e) => void submitAddCourse(e, camp.slug)}>
								<div class="min-w-48 flex-1">
									<label for="add-course-{camp.slug}" class="mb-1.5 block text-xs font-bold text-slate-700">Tambah kursus</label>
									<select
										id="add-course-{camp.slug}"
										bind:value={addCourseId}
										class="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
									>
										<option value="">— Pilih kursus —</option>
										{#each courses as c (c.id)}
											<option value={String(c.id)}>{c.title} (#{c.id})</option>
										{/each}
									</select>
								</div>
								<div class="w-28">
									<label for="add-pos-{camp.slug}" class="mb-1.5 block text-xs font-bold text-slate-700">Urutan</label>
									<input
										id="add-pos-{camp.slug}"
										bind:value={addPosition}
										inputmode="numeric"
										class="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
									/>
								</div>
								<div class="min-w-40 flex-1">
									<label for="add-badge-{camp.slug}" class="mb-1.5 block text-xs font-bold text-slate-700">Badge khusus (opsional)</label>
									<input
										id="add-badge-{camp.slug}"
										bind:value={addBadge}
										placeholder="Cth. Best Seller"
										class="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
									/>
								</div>
								<button
									type="submit"
									disabled={memberBusy}
									class="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-blue-600 px-5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-blue-600"
								>
									{#if memberBusy}<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i>…{:else}<i class="fa-solid fa-plus" aria-hidden="true"></i> Tambah{/if}
								</button>
							</form>
						</div>
					{/if}
				</article>
			{/each}
		</div>
	{/if}
</div>

<WarningModal
	bind:open={confirmOpen}
	title="Hapus kursus dari promo?"
	message={pendingRemove ? `Kursus #${pendingRemove.courseId} dikeluarkan dari "${pendingRemove.slug}". Promo lain dan data kursus tidak berubah.` : ''}
	confirmText="Ya, hapus"
	loading={memberBusy}
	onconfirm={() => void confirmRemove()}
	oncancel={() => (pendingRemove = null)}
/>
