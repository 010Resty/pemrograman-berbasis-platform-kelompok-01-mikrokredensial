<script lang="ts">
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import WarningModal from '$lib/components/WarningModal.svelte';
	import {
		addCourseToPromo,
		approvePromoProposal,
		createPromo,
		deletePromo,
		fetchAdminPromoDetail,
		fetchAdminPromoProposals,
		fetchAdminPromos,
		patchPromo,
		rejectPromoProposal,
		removeCourseFromPromo,
		type AdminPromoCampaign,
		type AdminPromoProposal,
		type PromoStatus,
		type PromoType
	} from '$lib/api/promos';
	import { fetchAdminCourses } from '$lib/api/admin';
	import { uploadFile } from '$lib/api/uploads';
	import { fileUrl } from '$lib/api/courses';
	import type { BackendCourse } from '$lib/api/courses';
	import { toast } from '$lib/stores/toast.svelte';

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
	/** Berkas sampul baru (diunggah saat simpan, kind=cover). */
	let formCoverFile = $state<File | null>(null);
	/** Pratinjau dataURL sampul baru; kosong = belum pilih. */
	let formCoverPreview = $state('');
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
	let memberPatungan = $state(new Map<number, number | null>());
	let memberLoading = $state(false);
	let addCourseId = $state('');
	let addPosition = $state('0');
	let addBadge = $state('');
	let addPatunganPrice = $state('');
	let memberError = $state('');
	let memberBusy = $state(false);
	let pendingRemove = $state<{ slug: string; courseId: number } | null>(null);
	let confirmOpen = $state(false);

	/* --- Hapus kampanye --- */
	let pendingDelete = $state<string | null>(null);
	let deleteOpen = $state(false);
	let deleteBusy = $state(false);
	let slugInput = $state<HTMLInputElement | null>(null);
	let lastFocused = $state<Element | null>(null);

	/* --- Pengajuan instruktur (approve = kursus masuk promo) --- */
	let proposals = $state<AdminPromoProposal[]>([]);
	let proposalFilter = $state<'pending' | 'approved' | 'rejected' | 'all'>('pending');
	let proposalsLoading = $state(false);
	let proposalsError = $state('');
	let pendingApprove = $state<number | null>(null);
	let approveOpen = $state(false);
	let approveBusy = $state(false);
	let pendingReject = $state<number | null>(null);
	let rejectOpen = $state(false);
	let rejectBusy = $state(false);
	let rejectNote = $state('');

	const proposalFilters: { value: typeof proposalFilter; label: string }[] = [
		{ value: 'pending', label: 'Menunggu' },
		{ value: 'approved', label: 'Disetujui' },
		{ value: 'rejected', label: 'Ditolak' },
		{ value: 'all', label: 'Semua' }
	];

	async function loadProposals(): Promise<void> {
		proposalsLoading = true;
		proposalsError = '';
		try {
			proposals = await fetchAdminPromoProposals(
				proposalFilter === 'all' ? undefined : proposalFilter
			);
		} catch (e) {
			proposals = [];
			proposalsError = e instanceof Error ? e.message : 'Gagal memuat pengajuan.';
			toast.error(proposalsError);
		} finally {
			proposalsLoading = false;
		}
	}

	function proposalStatusBadge(status: AdminPromoProposal['status']): string {
		if (status === 'approved') return 'bg-emerald-100 text-emerald-700';
		if (status === 'rejected') return 'bg-red-100 text-red-700';
		return 'bg-amber-100 text-amber-800';
	}

	function askApprove(id: number): void {
		pendingApprove = id;
		approveOpen = true;
	}

	async function confirmApprove(): Promise<void> {
		if (pendingApprove === null || approveBusy) return;
		const id = pendingApprove;
		approveBusy = true;
		try {
			await approvePromoProposal(id);
			pendingApprove = null;
			approveOpen = false;
			notice = `Pengajuan #${id} disetujui, kursus masuk promo.`;
			window.dispatchEvent(new CustomEvent('admin:notif-refresh'));
			await Promise.all([load(), loadProposals()]);
		} catch (e) {
			pendingApprove = null;
			approveOpen = false;
			notice = e instanceof Error ? e.message : 'Gagal menyetujui pengajuan.';
			toast.error(notice);
		} finally {
			approveBusy = false;
		}
	}

	function askReject(id: number): void {
		pendingReject = id;
		rejectNote = '';
		rejectOpen = true;
	}

	async function confirmReject(): Promise<void> {
		if (pendingReject === null || rejectBusy) return;
		const id = pendingReject;
		rejectBusy = true;
		try {
			await rejectPromoProposal(id, rejectNote.trim() || undefined);
			pendingReject = null;
			rejectOpen = false;
			notice = `Pengajuan #${id} ditolak.`;
			window.dispatchEvent(new CustomEvent('admin:notif-refresh'));
			await loadProposals();
		} catch (e) {
			pendingReject = null;
			rejectOpen = false;
			notice = e instanceof Error ? e.message : 'Gagal menolak pengajuan.';
			toast.error(notice);
		} finally {
			rejectBusy = false;
		}
	}

	function askDelete(slug: string): void {
		pendingDelete = slug;
		deleteOpen = true;
	}

	async function confirmDelete(): Promise<void> {
		if (!pendingDelete || deleteBusy) return;
		const slug = pendingDelete;
		deleteBusy = true;
		try {
			await deletePromo(slug);
			pendingDelete = null;
			deleteOpen = false;
			if (openSlug === slug) openSlug = null;
			if (editSlug === slug) editSlug = null;
			notice = `Promo "${slug}" dihapus beserta keanggotaannya.`;
			await load();
		} catch (e) {
			pendingDelete = null;
			deleteOpen = false;
			notice = e instanceof Error ? e.message : 'Gagal menghapus promo.';
			toast.error(notice);		} finally {
			deleteBusy = false;
		}
	}

	function openAdd(): void {
		formError = '';
		showAdd = true;
	}

	function closeAdd(): void {
		if (isSubmitting) return;
		showAdd = false;
	}

	function handleAddKeydown(event: KeyboardEvent): void {
		if (event.key === 'Escape') {
			event.stopPropagation();
			closeAdd();
		}
	}

	function formatIDR(n: number | null | undefined): string {
		if (n === null || n === undefined) return '—';
		return `Rp ${Number(n).toLocaleString('id-ID')}`;
	}

	/* --- Ubah kampanye --- */
	let editSlug = $state<string | null>(null);
	let editTitle = $state('');
	let editBadge = $state('');
	/** Sampul tersimpan (URL http(s) atau path /api/...) — dikosongkan bila dihapus. */
	let editCover = $state('');
	/** Berkas pengganti (diunggah saat simpan). */
	let editCoverFile = $state<File | null>(null);
	/** Pratinjau dataURL pengganti; kosong = tidak ada pengganti. */
	let editCoverPreview = $state('');
	let editType = $state<PromoType>('diskon');
	let editPercent = $state('');
	let editStatus = $state<PromoStatus>('draft');
	let editStartsAt = $state('');
	let editEndsAt = $state('');
	let editError = $state('');
	let editBusy = $state(false);

	/** Samakan tampilan sampul tersimpan (relatif /api/...) ke URL absolut backend. */
	function promoCoverSrc(path: string | null): string {
		if (!path) return '';
		const raw = path.trim();
		if (!raw) return '';
		if (raw.startsWith('data:')) return raw;
		try {
			return fileUrl(raw);
		} catch {
			return raw;
		}
	}

	const formCoverSrc = $derived(formCoverPreview || '');
	const editCoverSrc = $derived(editCoverPreview || promoCoverSrc(editCover));

	function onFormCoverFile(e: Event): void {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0] ?? null;
		formError = '';
		formCoverFile = null;
		formCoverPreview = '';
		if (!file) return;
		if (!file.type.startsWith('image/')) {
			formError = 'Sampul harus berupa gambar (JPG/PNG/WebP).';
			toast.error(formError);
			input.value = '';
			return;
		}
		if (file.size > 4 * 1024 * 1024) {
			formError = 'Ukuran gambar maksimal 4 MB.';
			toast.error(formError);
			input.value = '';
			return;
		}
		formCoverFile = file;
		const reader = new FileReader();
		reader.onload = () => {
			formCoverPreview = String(reader.result ?? '');
		};
		reader.readAsDataURL(file);
	}

	function onEditCoverFile(e: Event): void {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0] ?? null;
		editError = '';
		editCoverFile = null;
		editCoverPreview = '';
		if (!file) return;
		if (!file.type.startsWith('image/')) {
			editError = 'Sampul harus berupa gambar (JPG/PNG/WebP).';
			toast.error(editError);
			input.value = '';
			return;
		}
		if (file.size > 4 * 1024 * 1024) {
			editError = 'Ukuran gambar maksimal 4 MB.';
			toast.error(editError);
			input.value = '';
			return;
		}
		editCoverFile = file;
		const reader = new FileReader();
		reader.onload = () => {
			editCoverPreview = String(reader.result ?? '');
		};
		reader.readAsDataURL(file);
	}

	function toDatetimeLocal(iso: string | null): string {
		if (!iso) return '';
		const d = new Date(iso);
		if (Number.isNaN(d.getTime())) return '';
		const p = (n: number): string => String(n).padStart(2, '0');
		return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
	}

	function openEdit(camp: AdminPromoCampaign): void {
		if (editSlug === camp.slug) {
			editSlug = null;
			return;
		}
		editSlug = camp.slug;
		editTitle = camp.title;
		editBadge = camp.badgeLabel ?? '';
		editCover = camp.coverImage ?? '';
		editCoverFile = null;
		editCoverPreview = '';
		editType = camp.type;
		editPercent = camp.discountPercent !== null ? String(camp.discountPercent) : '';
		editStatus = camp.status === 'archived' ? 'archived' : camp.status;
		editStartsAt = toDatetimeLocal(camp.startsAt);
		editEndsAt = toDatetimeLocal(camp.endsAt);
		editError = '';
	}

	async function submitEdit(e: Event, slug: string): Promise<void> {
		e.preventDefault();
		editError = '';
		if (editTitle.trim().length < 3) {
			editError = 'Judul minimal 3 karakter.';
			toast.error(editError);
			return;
		}
		let percent: number | null = null;
		if (editType === 'diskon') {
			percent = Number(editPercent);
			if (!Number.isInteger(percent) || percent < 1 || percent > 90) {
				editError = 'Diskon persen 1–90.';
				toast.error(editError);
				return;
			}
		}
		if (
			editStartsAt &&
			editEndsAt &&
			new Date(editStartsAt).getTime() > new Date(editEndsAt).getTime()
		) {
			editError = 'Waktu mulai harus sebelum atau sama dengan waktu berakhir.';
			toast.error(editError);
			return;
		}
		editBusy = true;
		try {
			let coverImage: string | null;
			if (editCoverFile && editCoverPreview.startsWith('data:')) {
				const uploaded = await uploadFile(editCoverFile, 'cover');
				coverImage = uploaded.url;
			} else {
				coverImage = editCover.trim() || null;
			}
			await patchPromo(slug, {
				title: editTitle.trim(),
				badgeLabel: editBadge.trim() || null,
				coverImage,
				type: editType,
				discountPercent: percent,
				status: editStatus,
				startsAt: editStartsAt || null,
				endsAt: editEndsAt || null
			});
			editSlug = null;
			notice = `Promo "${slug}" diperbarui (diskon ${editType === 'diskon' ? `${percent}%` : '—'}).`;
			await load();
		} catch (e) {
			editError = e instanceof Error ? e.message : 'Gagal memperbarui promo.';
			toast.error(editError);
		} finally {
			editBusy = false;
		}
	}

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
			toast.error(loadError);
		} finally {
			isLoading = false;
		}
	}

	async function syncMembers(slug: string): Promise<void> {
		const detail = await fetchAdminPromoDetail(slug);
		memberIds = detail.courses.map((m) => m.courseId);
		const next = new Map(memberTitles);
		const nextPrice = new Map(memberPatungan);
		for (const m of detail.courses) {
			next.set(m.courseId, m.title);
			nextPrice.set(m.courseId, m.patunganPrice ?? null);
		}
		memberTitles = next;
		memberPatungan = nextPrice;
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
			await syncMembers(slug);
		} catch (e) {
			memberError = e instanceof Error ? e.message : 'Gagal memuat anggota promo.';
			toast.error(memberError);
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
			toast.error(formError);
			return;
		}
		if (formTitle.trim().length < 3) {
			formError = 'Judul minimal 3 karakter.';
			toast.error(formError);
			return;
		}
		let percent: number | undefined;
		if (formType === 'diskon') {
			percent = Number(formPercent);
			if (!Number.isInteger(percent) || percent < 1 || percent > 90) {
				formError = 'Diskon persen 1–90.';
				toast.error(formError);
				return;
			}
		}
		let cover: string | undefined;
		if (formCoverFile) {
			if (!formCoverPreview.startsWith('data:')) {
				formError = 'Pilih gambar sampul dulu.';
				toast.error(formError);
				return;
			}
			try {
				const uploaded = await uploadFile(formCoverFile, 'cover');
				cover = uploaded.url;
			} catch (e) {
				formError = e instanceof Error ? e.message : 'Gagal mengunggah sampul.';
				toast.error(formError);
				return;
			}
		}
		isSubmitting = true;
		try {
			await createPromo({
				slug,
				title: formTitle.trim(),
				badgeLabel: formBadge.trim() || undefined,
				coverImage: cover,
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
			formCoverFile = null;
			formCoverPreview = '';
			formPercent = '20';
			notice = `Promo "${slug}" dibuat.`;
			await load();
		} catch (e) {
			formError = e instanceof Error ? e.message : 'Gagal membuat promo.';
			toast.error(formError);
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
			toast.error(notice);
		}
	}

	async function submitAddCourse(e: Event, slug: string, isPatungan: boolean): Promise<void> {
		e.preventDefault();
		memberError = '';
		const courseId = Number(addCourseId);
		if (!Number.isInteger(courseId) || courseId <= 0) {
			memberError = 'Pilih kursus dulu.';
			toast.error(memberError);
			return;
		}
		let patunganPrice: number | undefined;
		if (addPatunganPrice.trim() !== '') {
			if (!isPatungan) {
				memberError = 'Harga patungan hanya untuk promo bertipe patungan.';
				toast.error(memberError);
				return;
			}
			patunganPrice = Number(addPatunganPrice.replace(/[^0-9]/g, ''));
			if (!Number.isInteger(patunganPrice) || patunganPrice <= 0) {
				memberError = 'Harga patungan harus angka rupiah > 0.';
				toast.error(memberError);
				return;
			}
		}
		memberBusy = true;
		try {
			await addCourseToPromo(slug, {
				courseId,
				position: Number(addPosition) || 0,
				customBadge: addBadge.trim() || undefined,
				patunganPrice
			});
			addCourseId = '';
			addBadge = '';
			addPatunganPrice = '';
			notice = `Kursus #${courseId} ditambahkan ke "${slug}".`;
			await Promise.all([load(), openMembersRefresh(slug)]);
		} catch (e) {
			memberError = e instanceof Error ? e.message : 'Gagal menambahkan kursus.';
			toast.error(memberError);
		} finally {
			memberBusy = false;
		}
	}

	async function openMembersRefresh(slug: string): Promise<void> {
		try {
			await syncMembers(slug);
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
			toast.error(memberError);
		} finally {
			memberBusy = false;
		}
	}

	$effect(() => {
		void load();
	});

	$effect(() => {
		if (typeof window === 'undefined') return;
		void proposalFilter;
		void loadProposals();
	});

	/* Kunci scroll + fokus awal + kembalikan fokus saat modal tambah ditutup. */
	$effect(() => {
		if (!showAdd) return;
		lastFocused = document.activeElement;
		document.body.style.overflow = 'hidden';
		slugInput?.focus();
		return () => {
			document.body.style.overflow = '';
			if (lastFocused instanceof HTMLElement) lastFocused.focus();
		};
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
		<p
			role="status"
			class="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs font-semibold text-blue-800"
		>
			{notice}
		</p>
	{/if}

	<div class="flex flex-wrap gap-2">
		<button
			type="button"
			onclick={openAdd}
			class="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-blue-600 px-5 text-xs font-bold text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
			aria-haspopup="dialog"
		>
			<i class="fa-solid fa-plus" aria-hidden="true"></i> Buat promo
		</button>
	</div>

	<!-- Pengajuan instruktur: approve = kursus masuk promo -->
	<section
		id="pengajuan-promo"
		aria-labelledby="promo-proposals-heading"
		class="scroll-mt-20 rounded-2xl border border-slate-200/70 bg-white p-5"
	>
		<div class="flex flex-wrap items-center justify-between gap-3">
			<div>
				<h2 id="promo-proposals-heading" class="text-base font-extrabold text-slate-900">
					Pengajuan Instruktur
				</h2>
				<p class="mt-0.5 text-xs text-slate-500">
					Instruktur mengusulkan kursusnya masuk promo; tampil di katalog hanya setelah disetujui.
				</p>
			</div>
			<div class="flex flex-wrap gap-2" role="group" aria-label="Filter status pengajuan">
				{#each proposalFilters as f (f.value)}
					<button
						type="button"
						onclick={() => (proposalFilter = f.value)}
						aria-pressed={proposalFilter === f.value}
						class={`rounded-xl px-4 py-2 text-xs font-bold transition-colors focus-visible:outline-2 focus-visible:outline-blue-600 ${
							proposalFilter === f.value
								? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
								: 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
						}`}
					>
						{f.label}
					</button>
				{/each}
			</div>
		</div>

		{#if proposalsLoading}
			<p class="mt-4 flex items-center gap-2 text-xs font-semibold text-slate-500" role="status">
				<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i> Memuat pengajuan…
			</p>
		{:else if proposalsError}
			<div role="alert" class="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700">
				{proposalsError}
				<button
					type="button"
					onclick={() => void loadProposals()}
					class="ml-2 underline hover:no-underline focus-visible:outline-2 focus-visible:outline-red-600"
				>
					Coba lagi
				</button>
			</div>
		{:else if proposals.length === 0}
			<p class="mt-4 rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-xs text-slate-500">
				Tidak ada pengajuan pada filter ini.
			</p>
		{:else}
			<ul class="mt-4 space-y-2">
				{#each proposals as p (p.id)}
					<li class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
						<div class="min-w-0 flex-1">
							<p class="flex flex-wrap items-center gap-2 text-sm font-bold text-slate-900">
								<span class="truncate">{p.courseTitle}</span>
								<span class="font-mono text-[11px] font-semibold text-slate-400">#{p.courseId}</span>
								<span class={`rounded-md px-2 py-0.5 text-[11px] font-bold ${proposalStatusBadge(p.status)}`}>
									{p.status === 'pending' ? 'Menunggu' : p.status === 'approved' ? 'Disetujui' : 'Ditolak'}
								</span>
							</p>
							<p class="mt-1 text-xs text-slate-500">
								→ {p.campaignTitle}
								<span class="font-mono text-[11px] text-slate-400">/{p.campaignSlug}</span>
								· pengusul: {p.proposerName ?? `#${p.proposedBy ?? '—'}`}
							</p>
							{#if p.customBadge || p.patunganPrice !== null || p.note}
								<p class="mt-1 text-[11px] text-slate-500">
									Usulan:{#if p.customBadge} badge “{p.customBadge}”{/if}{#if p.patunganPrice !== null} · patungan {p.patunganPrice}{/if}{#if p.note} · “{p.note}”{/if}
								</p>
							{/if}
						</div>
						{#if p.status === 'pending'}
							<div class="flex shrink-0 gap-2">
								<button
									type="button"
									onclick={() => askApprove(p.id)}
									class="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-emerald-600 px-4 text-xs font-bold text-white hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-emerald-600"
								>
									<i class="fa-solid fa-check" aria-hidden="true"></i> Setujui
								</button>
								<button
									type="button"
									onclick={() => askReject(p.id)}
									class="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-red-200 px-4 text-xs font-bold text-red-600 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-red-600"
								>
									<i class="fa-solid fa-xmark" aria-hidden="true"></i> Tolak
								</button>
							</div>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</section>

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
				aria-labelledby="promo-add-title"
				onkeydown={handleAddKeydown}
				class="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-6"
			>
				<div class="mb-4 flex items-start justify-between gap-3">
					<div>
						<h2 id="promo-add-title" class="text-base font-extrabold text-slate-900 sm:text-lg">
							Buat promo baru
						</h2>
						<p class="mt-0.5 text-xs text-slate-500">
							Jenis, diskon, dan jendela waktu bisa diubah lagi setelah dibuat.
						</p>
					</div>
					<button
						type="button"
						onclick={closeAdd}
						disabled={isSubmitting}
						aria-label="Tutup formulir promo"
						class="flex min-h-11 min-w-11 items-center justify-center rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
					>
						<i class="fa-solid fa-xmark text-lg" aria-hidden="true"></i>
					</button>
				</div>
				<form
					onsubmit={submitAdd}
					class="grid gap-3 sm:grid-cols-2"
					aria-label="Formulir promo baru"
				>
					<div>
						<label for="promo-slug" class="mb-1.5 block text-xs font-bold text-slate-700"
							>Slug</label
						>
						<input
							id="promo-slug"
							bind:value={formSlug}
							bind:this={slugInput}
							placeholder="promo-akhir-tahun"
							autocomplete="off"
							class="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 font-mono text-sm lowercase focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
						/>
					</div>
					<div>
						<label for="promo-title" class="mb-1.5 block text-xs font-bold text-slate-700"
							>Judul</label
						>
						<input
							id="promo-title"
							bind:value={formTitle}
							placeholder="Promo Akhir Tahun"
							class="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
						/>
					</div>
					<div>
						<label for="promo-badge" class="mb-1.5 block text-xs font-bold text-slate-700"
							>Badge (opsional)</label
						>
						<input
							id="promo-badge"
							bind:value={formBadge}
							placeholder="Hemat Akhir Tahun"
							class="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
						/>
					</div>
					<div>
						<span id="promo-cover-label" class="mb-1.5 block text-xs font-bold text-slate-700">
							Sampul (opsional, unggah gambar)</span
						>
						{#if formCoverSrc}
							<img
								src={formCoverSrc}
								alt="Pratinjau sampul promo baru"
								loading="lazy"
								class="mb-2 h-20 w-full rounded-xl border border-slate-200 object-cover"
							/>
						{/if}
						<input
							id="promo-cover"
							type="file"
							accept="image/*"
							onchange={onFormCoverFile}
							aria-labelledby="promo-cover-label"
							class="w-full cursor-pointer rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2.5 text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-600 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-white hover:file:bg-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
						/>
						<p class="mt-1 text-[11px] text-slate-500">JPG/PNG/WebP, maks 4 MB.</p>
					</div>
					<div class="grid grid-cols-2 gap-3">
						<div>
							<label for="promo-type" class="mb-1.5 block text-xs font-bold text-slate-700"
								>Jenis</label
							>
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
							<label for="promo-percent" class="mb-1.5 block text-xs font-bold text-slate-700"
								>Diskon % (1–90)</label
							>
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
						<label for="promo-status" class="mb-1.5 block text-xs font-bold text-slate-700"
							>Status awal</label
						>
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
							<label for="promo-start" class="mb-1.5 block text-xs font-bold text-slate-700"
								>Mulai (opsional)</label
							>
							<input
								id="promo-start"
								type="datetime-local"
								bind:value={formStartsAt}
								class="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
							/>
						</div>
						<div>
							<label for="promo-end" class="mb-1.5 block text-xs font-bold text-slate-700"
								>Berakhir (opsional)</label
							>
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
							{#if isSubmitting}<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i> Menyimpan…{:else}<i
									class="fa-solid fa-check"
									aria-hidden="true"
								></i> Simpan promo{/if}
						</button>
					</div>
				</form>
			</div>
		</div>
	{/if}

	{#if isLoading}
		<div
			class="rounded-2xl border border-slate-200 bg-white p-12 text-center"
			aria-label="Memuat promo"
		>
			<div
				class="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600"
				aria-hidden="true"
			></div>
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
			<p class="mt-1 text-xs text-slate-500">
				Buat kampanye pertama, lalu tambahkan kursus anggotanya.
			</p>
		</div>
	{:else}
		<div class="space-y-4">
			{#each items as camp (camp.slug)}
				<article class="overflow-hidden rounded-2xl border border-slate-200/70 bg-white">
					<div class="flex flex-wrap items-center justify-between gap-3 p-5">
						<div class="min-w-0">
							<p
								class="flex flex-wrap items-center gap-2 text-[11px] font-bold tracking-wide uppercase"
							>
								<span class="rounded-md bg-slate-900 px-2 py-0.5 font-mono text-white normal-case"
									>/{camp.slug}</span
								>
								<span class="rounded-md bg-slate-100 px-2 py-0.5 text-slate-600">{camp.type}</span>
								<span
									class={`rounded-md px-2 py-0.5 ${camp.status === 'active' ? 'bg-emerald-100 text-emerald-700' : camp.status === 'archived' ? 'bg-slate-200 text-slate-500' : 'bg-amber-100 text-amber-800'}`}
									>{camp.status}</span
								>
								{#if camp.type === 'diskon' && camp.discountPercent !== null}<span
										class="rounded-md bg-red-600 px-2 py-0.5 text-white"
										>−{camp.discountPercent}%</span
									>{/if}
							</p>
							<h2 class="mt-1.5 truncate text-base font-extrabold text-slate-900">{camp.title}</h2>
							<p class="mt-0.5 text-xs text-slate-500">
								{camp.courseCount ?? 0} kursus anggota{#if camp.badgeLabel}
									· {camp.badgeLabel}{/if}
								{#if camp.coverImage}
									<img
										src={promoCoverSrc(camp.coverImage)}
										alt={`Sampul ${camp.title}`}
										loading="lazy"
										class="mt-2 h-16 w-28 rounded-lg border border-slate-200 object-cover"
									/>
								{/if}
							</p>
						</div>
						<div class="flex flex-wrap items-center gap-2">
							<button
								type="button"
								onclick={() => openEdit(camp)}
								class="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-slate-200 px-4 text-xs font-bold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600"
								aria-expanded={editSlug === camp.slug}
							>
								<i class="fa-solid fa-pen" aria-hidden="true"></i>
								{editSlug === camp.slug ? 'Tutup' : 'Ubah'}
							</button>
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
								<button
									type="button"
									onclick={() => askDelete(camp.slug)}
									class="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-red-200 px-4 text-xs font-bold text-red-600 transition-colors hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-red-600"
								>
									<i class="fa-solid fa-trash-can" aria-hidden="true"></i>
									Hapus
								</button>
							{:else}
								<button
									type="button"
									onclick={() => void setStatus(camp.slug, 'archived')}
									class="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-slate-200 px-4 text-xs font-bold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600"
								>
									Arsipkan
								</button>
								<button
									type="button"
									onclick={() => askDelete(camp.slug)}
									class="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-red-200 px-4 text-xs font-bold text-red-600 transition-colors hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-red-600"
								>
									<i class="fa-solid fa-trash-can" aria-hidden="true"></i>
									Hapus
								</button>
							{/if}
						</div>
					</div>
					{#if editSlug === camp.slug}
						<form
							onsubmit={(e) => void submitEdit(e, camp.slug)}
							class="grid gap-3 border-t border-slate-100 bg-white p-5 sm:grid-cols-2"
							aria-label={`Ubah promo ${camp.slug}`}
						>
							<div>
								<label
									for="edit-title-{camp.slug}"
									class="mb-1.5 block text-xs font-bold text-slate-700">Judul</label
								>
								<input
									id="edit-title-{camp.slug}"
									bind:value={editTitle}
									class="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
								/>
							</div>
							<div>
								<label
									for="edit-badge-{camp.slug}"
									class="mb-1.5 block text-xs font-bold text-slate-700"
									>Badge (kosongkan untuk hapus)</label
								>
								<input
									id="edit-badge-{camp.slug}"
									bind:value={editBadge}
									class="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
								/>
							</div>
							<div>
								<span id="edit-sampul-label-{camp.slug}" class="mb-1.5 block text-xs font-bold text-slate-700"
									>Sampul (opsional, unggah gambar)</span
								>
								{#if editCoverSrc}
									<img
										src={editCoverSrc}
										alt={`Pratinjau sampul ${camp.slug}`}
										loading="lazy"
										class="mb-2 h-20 w-full rounded-xl border border-slate-200 object-cover"
									/>
								{/if}
								<input
									id="edit-sampul-{camp.slug}"
									type="file"
									accept="image/*"
									onchange={onEditCoverFile}
									aria-labelledby="edit-sampul-label-{camp.slug}"
									class="w-full cursor-pointer rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2.5 text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-600 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-white hover:file:bg-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
								/>
								<div class="mt-1.5 flex items-center justify-between gap-2">
									<p class="text-[11px] text-slate-500">JPG/PNG/WebP, maks 4 MB.</p>
									{#if editCover || editCoverPreview}
										<button
											type="button"
											onclick={() => {
												editCover = '';
												editCoverFile = null;
												editCoverPreview = '';
											}}
											class="shrink-0 rounded-lg px-2 py-1 text-[11px] font-bold text-red-600 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-red-600"
										>
											Hapus sampul
										</button>
									{/if}
								</div>
							</div>
							<div class="grid grid-cols-2 gap-3">
								<div>
									<label
										for="edit-type-{camp.slug}"
										class="mb-1.5 block text-xs font-bold text-slate-700">Jenis</label
									>
									<select
										id="edit-type-{camp.slug}"
										bind:value={editType}
										class="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
									>
										<option value="diskon">Diskon %</option>
										<option value="kurasi">Pajang</option>
										<option value="patungan">Patungan</option>
									</select>
								</div>
								<div>
									<label
										for="edit-percent-{camp.slug}"
										class="mb-1.5 block text-xs font-bold text-slate-700">Diskon % (1–90)</label
									>
									<input
										id="edit-percent-{camp.slug}"
										bind:value={editPercent}
										disabled={editType !== 'diskon'}
										inputmode="numeric"
										class="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none disabled:bg-slate-100"
									/>
								</div>
							</div>
							<div>
								<label
									for="edit-status-{camp.slug}"
									class="mb-1.5 block text-xs font-bold text-slate-700">Status</label
								>
								<select
									id="edit-status-{camp.slug}"
									bind:value={editStatus}
									class="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
								>
									<option value="draft">Draft</option>
									<option value="active">Aktif</option>
									<option value="archived">Arsip</option>
								</select>
							</div>
							<div class="grid grid-cols-2 gap-3">
								<div>
									<label
										for="edit-start-{camp.slug}"
										class="mb-1.5 block text-xs font-bold text-slate-700">Mulai (opsional)</label
									>
									<input
										id="edit-start-{camp.slug}"
										type="datetime-local"
										bind:value={editStartsAt}
										class="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
									/>
								</div>
								<div>
									<label
										for="edit-end-{camp.slug}"
										class="mb-1.5 block text-xs font-bold text-slate-700">Berakhir (opsional)</label
									>
									<input
										id="edit-end-{camp.slug}"
										type="datetime-local"
										bind:value={editEndsAt}
										class="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
									/>
								</div>
							</div>
							{#if editError}
								<p role="alert" class="text-xs font-semibold text-red-600 sm:col-span-2">
									{editError}
								</p>
							{/if}
							<div class="sm:col-span-2">
								<button
									type="submit"
									disabled={editBusy}
									class="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-blue-600 px-5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-blue-600"
								>
									{#if editBusy}<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i> Menyimpan…{:else}<i
											class="fa-solid fa-check"
											aria-hidden="true"
										></i> Simpan perubahan{/if}
								</button>
							</div>
						</form>
					{/if}
					{#if openSlug === camp.slug}
						<div class="border-t border-slate-100 bg-slate-50/70 p-5">
							{#if memberLoading}
								<p class="text-xs font-semibold text-slate-500">Memuat anggota…</p>
							{:else if memberIds.length === 0}
								<p class="text-xs text-slate-500">
									Belum ada kursus anggota. Tambahkan lewat formulir di bawah.
								</p>
							{:else}
								<ul class="space-y-2">
									{#each memberIds as id (id)}
										<li
											class="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5"
										>
											<span class="min-w-0">
												<span class="block truncate text-sm font-semibold text-slate-800"
													>{courseTitle(id)}
													<span class="font-mono text-[11px] text-slate-400">#{id}</span></span
												>
												{#if memberPatungan.get(id) != null}
													<span class="mt-0.5 block text-[11px] font-bold text-teal-700"
														>Harga patungan: {formatIDR(memberPatungan.get(id))} (total grup)</span
													>
												{/if}
											</span>
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
							<form
								class="mt-3 flex flex-wrap items-end gap-2"
								onsubmit={(e) => void submitAddCourse(e, camp.slug, camp.type === 'patungan')}
							>
								<div class="min-w-48 flex-1">
									<label
										for="add-course-{camp.slug}"
										class="mb-1.5 block text-xs font-bold text-slate-700">Tambah kursus</label
									>
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
									<label
										for="add-pos-{camp.slug}"
										class="mb-1.5 block text-xs font-bold text-slate-700">Urutan</label
									>
									<input
										id="add-pos-{camp.slug}"
										bind:value={addPosition}
										inputmode="numeric"
										class="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
									/>
								</div>
								<div class="min-w-40 flex-1">
									<label
										for="add-badge-{camp.slug}"
										class="mb-1.5 block text-xs font-bold text-slate-700"
										>Badge khusus (opsional)</label
									>
									<input
										id="add-badge-{camp.slug}"
										bind:value={addBadge}
										placeholder="Cth. Best Seller"
										class="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
									/>
								</div>
								{#if camp.type === 'patungan'}
									<div class="min-w-40 flex-1">
										<label
											for="add-patungan-{camp.slug}"
											class="mb-1.5 block text-xs font-bold text-slate-700"
											>Harga patungan (total grup, opsional)</label
										>
										<input
											id="add-patungan-{camp.slug}"
											bind:value={addPatunganPrice}
											inputmode="numeric"
											placeholder="Cth. 300000"
											class="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
										/>
									</div>
								{/if}
								<button
									type="submit"
									disabled={memberBusy}
									class="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-blue-600 px-5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-blue-600"
								>
									{#if memberBusy}<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"
										></i>…{:else}<i class="fa-solid fa-plus" aria-hidden="true"></i> Tambah{/if}
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
	message={pendingRemove
		? `Kursus #${pendingRemove.courseId} dikeluarkan dari "${pendingRemove.slug}". Promo lain dan data kursus tidak berubah.`
		: ''}
	confirmText="Ya, hapus"
	loading={memberBusy}
	onconfirm={() => void confirmRemove()}
	oncancel={() => (pendingRemove = null)}
/>

<WarningModal
	bind:open={deleteOpen}
	type="danger"
	title="Hapus promo ini?"
	message={pendingDelete
		? `Promo "${pendingDelete}" beserta seluruh keanggotaannya akan dihapus permanen dan tidak bisa dikembalikan. Riwayat pembayaran/grup yang sudah terjadi tetap tersimpan; antrean aktif yang masih menunjuk promo ini membuat hapus ditolak.`
		: ''}
	confirmText="Ya, hapus"
	loading={deleteBusy}
	onconfirm={() => void confirmDelete()}
	oncancel={() => {
		pendingDelete = null;
	}}
/>

<WarningModal
	bind:open={approveOpen}
	title="Setujui pengajuan ini?"
	message={pendingApprove !== null
		? `Pengajuan #${pendingApprove} disetujui: kursus masuk promo dan tampil di katalog.`
		: ''}
	confirmText="Ya, setujui"
	loading={approveBusy}
	onconfirm={() => void confirmApprove()}
	oncancel={() => (pendingApprove = null)}
/>

<WarningModal
	bind:open={rejectOpen}
	type="danger"
	title="Tolak pengajuan ini?"
	message={pendingReject !== null
		? `Pengajuan #${pendingReject} ditolak. Instruktur pengusul akan melihat statusnya di halaman Promo.`
		: ''}
	confirmText="Ya, tolak"
	loading={rejectBusy}
	onconfirm={() => void confirmReject()}
	oncancel={() => (pendingReject = null)}
>
	{#snippet extra()}
		<label for="reject-note" class="mb-1.5 block text-left text-xs font-bold text-slate-700">
			Catatan untuk instruktur (opsional)
		</label>
		<textarea
			id="reject-note"
			bind:value={rejectNote}
			rows={3}
			maxlength={500}
			disabled={rejectBusy}
			placeholder="Alasan penolakan…"
			class="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none disabled:bg-slate-100"
		></textarea>
	{/snippet}
</WarningModal>
