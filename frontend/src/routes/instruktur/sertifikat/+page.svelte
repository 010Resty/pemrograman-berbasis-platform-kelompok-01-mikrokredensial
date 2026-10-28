<script lang="ts">
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import {
		fetchCertificateSummary as apiSummary,
		fetchModuleCertificateStatus as apiModuleStatus,
		fetchEligibility as apiEligibility,
		fetchCertificates as apiCertificates,
		eligibilityLabel,
		certificateStatusLabel,
		type CertificateRecord,
		type CertificateSummary,
		type EligibilityEntry,
		type EligibilityStatus,
		type ModuleCertificateStatus,
		type CertificateStatus
	} from '$lib/api/certificates';
	import {
		mockSummary,
		mockModuleStatus,
		mockEligibility,
		mockCertificates
	} from '$lib/api/certificates.mock';
	import { fetchMyCourses, fetchModules } from '$lib/api/courses';

	/**
	 * Menu Sertifikat instruktur — 4 tab: ringkasan, kursus, kelayakan, riwayat.
	 *
	 * Sumber kebenaran = backend. Frontend tidak menghitung kelulusan sendiri.
	 * Bila endpoint sertifikat belum tersedia, tiap tab menampilkan state
	 * error jujur + tombol coba lagi (TIDAK ada sukses palsu).
	 *
	 * Mock DEV: hanya bila `import.meta.env.DEV` dan URL `?mock=sertifikat`;
	 * selalu tampil banner penanda dan tidak pernah dipakai di produksi.
	 */

	type TabId = 'ringkasan' | 'kursus' | 'kelayakan' | 'riwayat';
	const TABS: { id: TabId; label: string; icon: string }[] = [
		{ id: 'ringkasan', label: 'Ringkasan', icon: 'fa-gauge-high' },
		{ id: 'kursus', label: 'Per Kursus & Modul', icon: 'fa-layer-group' },
		{ id: 'kelayakan', label: 'Kelayakan Peserta', icon: 'fa-user-check' },
		{ id: 'riwayat', label: 'Riwayat Sertifikat', icon: 'fa-clock-rotate-left' }
	];

	const tab = $derived.by((): TabId => {
		const t = page.url.searchParams.get('tab');
		return t === 'kursus' || t === 'kelayakan' || t === 'riwayat' ? t : 'ringkasan';
	});

	const useMock = $derived(
		browser && import.meta.env.DEV && page.url.searchParams.get('mock') === 'sertifikat'
	);
	/** Diteruskan ke link detail agar mode mock DEV tidak terputus saat navigasi. */
	const mockSuffix = $derived(useMock ? '?mock=sertifikat' : '');

	function switchTab(id: TabId, extra: Record<string, string> = {}): void {
		const sp = new URLSearchParams(page.url.searchParams);
		sp.set('tab', id);
		for (const [k, v] of Object.entries(extra)) {
			if (v) sp.set(k, v);
			else sp.delete(k);
		}
		if (useMock) sp.set('mock', 'sertifikat');
		void goto(`?${sp.toString()}`, { replaceState: true, noScroll: true, keepFocus: true });
		void ensureLoaded(id);
	}

	function tabKeydown(e: KeyboardEvent, index: number): void {
		if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
		e.preventDefault();
		const next =
			e.key === 'ArrowRight' ? (index + 1) % TABS.length : (index - 1 + TABS.length) % TABS.length;
		switchTab(TABS[next].id);
		document.getElementById(`tab-${TABS[next].id}`)?.focus();
	}

	type Phase = 'idle' | 'loading' | 'error' | 'empty' | 'ready';
	class LoadState<T> {
		phase = $state<Phase>('idle');
		data = $state<T | null>(null);
		error = $state('');
	}
	const loadedTabs = $state<Record<TabId, boolean>>({
		ringkasan: false,
		kursus: false,
		kelayakan: false,
		riwayat: false
	});

	// ---------- Data kursus & modul milik instruktur ----------
	interface CourseOpt {
		id: number;
		title: string;
	}
	interface ModuleOpt {
		id: number;
		courseId: number;
		title: string;
	}
	let courses = $state<CourseOpt[]>([]);
	let coursesError = $state('');
	let modulesByCourse = $state<Record<number, ModuleOpt[]>>({});
	let modulesError = $state<Record<number, string>>({});
	let modulesLoading = $state<Record<number, boolean>>({});

	let coursesPending: Promise<void> | null = null;
	async function loadCourses(): Promise<void> {
		if (courses.length > 0 || coursesError) return;
		if (coursesPending) return coursesPending;
		if (useMock) {
			courses = [
				{ id: 1, title: 'Pengembangan Web Frontend' },
				{ id: 2, title: 'Basis Data & SQL' }
			];
			return;
		}
		const task = (async () => {
			try {
				const list = await fetchMyCourses();
				courses = list.map((c) => ({ id: c.id, title: c.title }));
				if (courses.length === 0) coursesError = '';
			} catch (e) {
				coursesError = e instanceof Error ? e.message : 'Gagal memuat kursus.';
			}
		})();
		coursesPending = task;
		try {
			await task;
		} finally {
			if (coursesPending === task) coursesPending = null;
		}
	}

	let modulesPending = new Map<number, Promise<void>>();
	async function loadModules(courseId: number): Promise<void> {
		if (modulesByCourse[courseId]) return;
		const existing = modulesPending.get(courseId);
		if (existing) return existing;
		modulesLoading[courseId] = true;
		const task = (async () => {
			try {
				if (useMock) {
					modulesByCourse[courseId] =
						courseId === 1
							? [
									{ id: 11, courseId: 1, title: 'Dasar HTML & CSS' },
									{ id: 12, courseId: 1, title: 'JavaScript Interaktif' }
								]
							: [{ id: 21, courseId: 2, title: 'Desain Skema Relasional' }];
				} else {
					const mods = await fetchModules(courseId);
					modulesByCourse[courseId] = mods.map((m) => ({
						id: m.id,
						courseId: m.courseId,
						title: m.title
					}));
				}
			} catch (e) {
				modulesError[courseId] = e instanceof Error ? e.message : 'Gagal memuat modul.';
			} finally {
				modulesLoading[courseId] = false;
			}
		})();
		modulesPending.set(courseId, task);
		try {
			await task;
		} finally {
			if (modulesPending.get(courseId) === task) modulesPending.delete(courseId);
		}
	}

	// ---------- A. Ringkasan (stale-guard: respons lama tidak menimpa state baru) ----------
	const summary = new LoadState<CertificateSummary>();
	let summaryReq = 0;
	async function loadSummary(): Promise<void> {
		const my = ++summaryReq;
		summary.phase = 'loading';
		summary.error = '';
		try {
			const data = useMock ? await mockSummary() : await apiSummary();
			if (my !== summaryReq) return;
			summary.data = data;
			summary.phase = 'ready';
		} catch (e) {
			if (my !== summaryReq) return;
			summary.error = e instanceof Error ? e.message : 'Gagal memuat ringkasan.';
			summary.phase = 'error';
		}
	}

	// ---------- B. Per kursus & modul ----------
	let selCourseId = $state<number | ''>('');
	let selModuleId = $state<number | ''>('');
	const moduleStatus = new LoadState<ModuleCertificateStatus>();
	const selCourse = $derived(courses.find((c) => c.id === selCourseId) ?? null);
	const selModules = $derived(selCourseId === '' ? [] : (modulesByCourse[selCourseId] ?? []));

	$effect(() => {
		if (!browser || tab !== 'kursus') return;
		void loadCourses();
	});
	$effect(() => {
		if (typeof selCourseId === 'number') void loadModules(selCourseId);
	});

	let moduleStatusReq = 0;
	async function loadModuleStatus(): Promise<void> {
		if (selModuleId === '') return;
		const my = ++moduleStatusReq;
		const target = selModuleId;
		moduleStatus.phase = 'loading';
		moduleStatus.error = '';
		try {
			const data = useMock
				? await mockModuleStatus(target)
				: await apiModuleStatus(target);
			if (my !== moduleStatusReq || target !== selModuleId) return;
			moduleStatus.data = data;
			moduleStatus.phase = 'ready';
		} catch (e) {
			if (my !== moduleStatusReq || target !== selModuleId) return;
			moduleStatus.error = e instanceof Error ? e.message : 'Gagal memuat status modul.';
			moduleStatus.phase = 'error';
		}
	}
	$effect(() => {
		if (selModuleId !== '') void loadModuleStatus();
		else {
			moduleStatus.phase = 'idle';
			moduleStatus.data = null;
		}
	});

	// ---------- C. Kelayakan ----------
	let kCourseId = $state<number | ''>('');
	let kModuleId = $state<number | ''>('');
	let kStatus = $state<EligibilityStatus | 'semua'>('semua');
	let kQuery = $state('');
	const eligibility = new LoadState<EligibilityEntry[]>();
	const kModules = $derived(kCourseId === '' ? [] : (modulesByCourse[kCourseId] ?? []));

	let eligibilityReq = 0;
	async function loadEligibility(): Promise<void> {
		const my = ++eligibilityReq;
		eligibility.phase = 'loading';
		eligibility.error = '';
		try {
			const rows = useMock
				? await mockEligibility({
						courseId: kCourseId === '' ? undefined : kCourseId,
						moduleId: kModuleId === '' ? undefined : kModuleId,
						status: kStatus,
						q: kQuery
					})
				: await apiEligibility({
						courseId: kCourseId === '' ? undefined : kCourseId,
						moduleId: kModuleId === '' ? undefined : kModuleId,
						status: kStatus,
						q: kQuery
					});
			if (my !== eligibilityReq) return;
			eligibility.data = rows;
			eligibility.phase = rows.length === 0 ? 'empty' : 'ready';
		} catch (e) {
			if (my !== eligibilityReq) return;
			eligibility.error = e instanceof Error ? e.message : 'Gagal memuat kelayakan.';
			eligibility.phase = 'error';
		}
	}

	// ---------- D. Riwayat ----------
	let rCourseId = $state<number | ''>('');
	let rModuleId = $state<number | ''>('');
	let rStatus = $state<CertificateStatus | 'semua'>('semua');
	let rQuery = $state('');
	let rFrom = $state('');
	let rTo = $state('');
	const history = new LoadState<CertificateRecord[]>();
	const rModules = $derived(rCourseId === '' ? [] : (modulesByCourse[rCourseId] ?? []));

	let historyReq = 0;
	async function loadHistory(): Promise<void> {
		const my = ++historyReq;
		history.phase = 'loading';
		history.error = '';
		try {
			const rows = useMock
				? await mockCertificates({
						courseId: rCourseId === '' ? undefined : rCourseId,
						moduleId: rModuleId === '' ? undefined : rModuleId,
						status: rStatus,
						q: rQuery,
						from: rFrom || undefined,
						to: rTo || undefined
					})
				: await apiCertificates({
						courseId: rCourseId === '' ? undefined : rCourseId,
						moduleId: rModuleId === '' ? undefined : rModuleId,
						status: rStatus,
						q: rQuery,
						from: rFrom || undefined,
						to: rTo || undefined
					});
			if (my !== historyReq) return;
			history.data = rows;
			history.phase = rows.length === 0 ? 'empty' : 'ready';
		} catch (e) {
			if (my !== historyReq) return;
			history.error = e instanceof Error ? e.message : 'Gagal memuat riwayat.';
			history.phase = 'error';
		}
	}

	async function ensureLoaded(t: TabId): Promise<void> {
		if (loadedTabs[t]) return;
		loadedTabs[t] = true;
		if (t === 'ringkasan') await loadSummary();
		if (t === 'kursus') {
			await loadCourses();
			if (selCourseId === '' && courses.length > 0) selCourseId = courses[0].id;
		}
		if (t === 'kelayakan') {
			await Promise.all([loadCourses(), loadEligibility()]);
		}
		if (t === 'riwayat') {
			await Promise.all([loadCourses(), loadHistory()]);
		}
	}

	$effect(() => {
		if (!browser) return;
		void ensureLoaded(tab);
	});

	// Preset dari tab kursus
	function gotoEligibility(courseId: number, moduleId: number): void {
		kCourseId = courseId;
		kModuleId = moduleId;
		loadedTabs.kelayakan = false;
		switchTab('kelayakan');
	}
	function gotoHistory(courseId: number, moduleId: number | ''): void {
		rCourseId = courseId;
		rModuleId = moduleId;
		loadedTabs.riwayat = false;
		switchTab('riwayat');
	}

	function eligibilityBadge(s: EligibilityStatus): string {
		switch (s) {
			case 'belum_memenuhi':
				return 'bg-slate-100 text-slate-600';
			case 'menunggu_penilaian':
				return 'bg-amber-100 text-amber-700';
			case 'memenuhi':
				return 'bg-blue-100 text-blue-700';
			case 'sudah_terbit':
				return 'bg-emerald-100 text-emerald-700';
		}
	}
	function certBadge(s: CertificateStatus): string {
		return s === 'aktif' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700';
	}
	function quizBadge(s: string): string {
		if (s === 'lulus') return 'bg-emerald-100 text-emerald-700';
		if (s === 'belum_lulus') return 'bg-red-100 text-red-700';
		return 'bg-slate-100 text-slate-500';
	}
	function taskBadge(s: string): string {
		if (s === 'lulus') return 'bg-emerald-100 text-emerald-700';
		if (s === 'menunggu_penilaian') return 'bg-amber-100 text-amber-700';
		if (s === 'belum_lulus') return 'bg-red-100 text-red-700';
		return 'bg-slate-100 text-slate-500';
	}
	function quizText(s: string): string {
		return s === 'lulus' ? 'Lulus' : s === 'belum_lulus' ? 'Belum lulus' : 'Tidak ada kuis';
	}
	function taskText(s: string): string {
		if (s === 'lulus') return 'Lulus';
		if (s === 'menunggu_penilaian') return 'Menunggu penilaian';
		if (s === 'belum_lulus') return 'Belum lulus';
		return 'Tidak ada tugas';
	}
	function formatDate(iso: string): string {
		const d = new Date(iso);
		return Number.isNaN(d.getTime())
			? iso
			: d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
	}
</script>

<svelte:head>
	<title>Sertifikat — Instruktur Aristoteles</title>
	<meta
		name="description"
		content="Ringkasan, status per modul, kelayakan peserta, dan riwayat sertifikat kursus yang Anda kelola."
	/>
</svelte:head>

<div class="p-4 sm:p-6 lg:p-8">
	<div class="mb-6">
		<p class="text-xs font-bold tracking-widest text-blue-600 uppercase">Menu Utama · Sertifikat</p>
		<h1 class="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Sertifikat</h1>
		<p class="mt-1 text-sm text-slate-500">
			Hanya data kursus yang Anda kelola. Sertifikat terbit otomatis oleh sistem bila seluruh
			syarat modul terpenuhi — tidak ada penerbitan manual.
		</p>
	</div>

	{#if useMock}
		<p
			role="status"
			class="mb-4 flex items-start gap-2 rounded-xl border border-dashed border-amber-400 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-800"
		>
			<i class="fa-solid fa-triangle-exclamation mt-0.5 shrink-0" aria-hidden="true"></i>
			<span
				>Mode demo DEV (<span class="font-mono">?mock=sertifikat</span>) — seluruh angka dan nama di
				halaman ini ilustratif, bukan data produksi.</span
			>
		</p>
	{/if}

	<!-- Tab internal -->
	<div
		role="tablist"
		aria-label="Bagian menu sertifikat"
		class="mb-6 flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5"
	>
		{#each TABS as t, i (t.id)}
			<button
				type="button"
				role="tab"
				id="tab-{t.id}"
				aria-selected={tab === t.id}
				aria-controls="panel-{t.id}"
				tabindex={tab === t.id ? 0 : -1}
				onclick={() => switchTab(t.id)}
				onkeydown={(e) => tabKeydown(e, i)}
				class="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-blue-600 {tab === t.id
					? 'bg-blue-600 text-white shadow-md shadow-blue-600/25'
					: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}"
			>
				<i class="fa-solid {t.icon}" aria-hidden="true"></i> {t.label}
			</button>
		{/each}
	</div>

	{#if tab === 'ringkasan'}
		<div role="tabpanel" id="panel-ringkasan" aria-labelledby="tab-ringkasan" class="space-y-6">
			{#if summary.phase === 'loading' || summary.phase === 'idle'}
				<div class="grid grid-cols-2 gap-4 lg:grid-cols-4" aria-label="Memuat ringkasan">
					{#each [1, 2, 3, 4] as i (i)}
						<div class="animate-pulse rounded-2xl border border-slate-200 bg-white p-5">
							<div class="h-10 w-10 rounded-xl bg-slate-100"></div>
							<div class="mt-3 h-7 w-16 rounded bg-slate-100"></div>
							<div class="mt-2 h-3 w-24 rounded bg-slate-100"></div>
						</div>
					{/each}
				</div>
			{:else if summary.phase === 'error'}
				<div
					role="alert"
					class="rounded-2xl border border-red-200 bg-red-50 p-6 text-center"
				>
					<p class="flex items-center justify-center gap-2 text-sm font-bold text-red-700">
						<i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i> Ringkasan belum dapat
						dimuat
					</p>
					<p class="mx-auto mt-1 max-w-md text-xs text-red-600">{summary.error}</p>
					<p class="mx-auto mt-1 max-w-md text-xs text-red-600/80">
						Endpoint <span class="font-mono">GET /instructor/certificates/summary</span> belum
						tersedia atau backend tidak terjangkau.
					</p>
					<button
						type="button"
						onclick={() => void loadSummary()}
						class="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-red-600"
					>
						<i class="fa-solid fa-rotate-right" aria-hidden="true"></i> Coba lagi
					</button>
				</div>
			{:else if summary.data}
				{@const s = summary.data}
				<div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
					<div class="rounded-2xl border border-blue-200/70 bg-blue-50 p-4 sm:p-5">
						<div class="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white">
							<i class="fa-solid fa-user-check text-sm" aria-hidden="true"></i>
						</div>
						<div class="mt-3 text-2xl font-black tabular-nums text-slate-900">{s.eligibleCount}</div>
						<div class="text-xs font-semibold text-slate-600">Memenuhi syarat</div>
						<p class="mt-1 text-[11px] text-slate-500">Peserta, bukan jumlah sertifikat.</p>
					</div>
					<div class="rounded-2xl border border-emerald-200/70 bg-emerald-50 p-4 sm:p-5">
						<div class="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white">
							<i class="fa-solid fa-award text-sm" aria-hidden="true"></i>
						</div>
						<div class="mt-3 text-2xl font-black tabular-nums text-slate-900">{s.issuedActiveCount}</div>
						<div class="text-xs font-semibold text-slate-600">Terbit &amp; aktif</div>
						<p class="mt-1 text-[11px] text-slate-500">Sertifikat valid saat ini.</p>
					</div>
					<div class="rounded-2xl border border-amber-200/70 bg-amber-50 p-4 sm:p-5">
						<div class="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 text-white">
							<i class="fa-solid fa-hourglass-half text-sm" aria-hidden="true"></i>
						</div>
						<div class="mt-3 text-2xl font-black tabular-nums text-slate-900">{s.notEligibleCount}</div>
						<div class="text-xs font-semibold text-slate-600">Belum memenuhi syarat</div>
						<p class="mt-1 text-[11px] text-slate-500">Perlu pembinaan lanjutan.</p>
					</div>
					<div class="rounded-2xl border border-red-200/70 bg-red-50 p-4 sm:p-5">
						<div class="flex h-10 w-10 items-center justify-center rounded-xl bg-red-600 text-white">
							<i class="fa-solid fa-ban text-sm" aria-hidden="true"></i>
						</div>
						<div class="mt-3 text-2xl font-black tabular-nums text-slate-900">{s.revokedCount}</div>
						<div class="text-xs font-semibold text-slate-600">Dicabut</div>
						<p class="mt-1 text-[11px] text-slate-500">Tetap tercatat di riwayat.</p>
					</div>
				</div>

				<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
					<div class="overflow-hidden rounded-2xl border border-slate-200 bg-white">
						<div class="border-b border-slate-100 px-5 py-4">
							<h2 class="text-sm font-extrabold text-slate-900">Ringkasan per kursus</h2>
						</div>
						{#if s.perCourse.length === 0}
							<p class="px-5 py-6 text-center text-xs text-slate-500">
								Belum ada data kursus. Pastikan Anda tercatat sebagai pengampu kursus.
							</p>
						{:else}
							<ul class="divide-y divide-slate-100">
								{#each s.perCourse as row (row.courseId)}
									<li class="flex items-center justify-between gap-3 px-5 py-3.5">
										<div class="min-w-0">
											<p class="truncate text-sm font-bold text-slate-900">{row.courseTitle}</p>
											<p class="mt-0.5 text-[11px] tabular-nums text-slate-500">
												{row.eligibleCount} memenuhi · {row.issuedActiveCount} aktif ·
												{row.notEligibleCount} belum · {row.revokedCount} dicabut
											</p>
										</div>
										<button
											type="button"
											onclick={() => switchTab('kursus')}
											class="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-[11px] font-bold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600"
											aria-label="Lihat modul {row.courseTitle}"
										>
											Modul <i class="fa-solid fa-arrow-right text-[10px]" aria-hidden="true"></i>
										</button>
									</li>
								{/each}
							</ul>
						{/if}
					</div>

					<div class="overflow-hidden rounded-2xl border border-slate-200 bg-white">
						<div class="flex items-center justify-between border-b border-slate-100 px-5 py-4">
							<h2 class="text-sm font-extrabold text-slate-900">Baru memenuhi syarat</h2>
							<button
								type="button"
								onclick={() => switchTab('kelayakan')}
								class="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-bold text-blue-700 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-blue-600"
							>
								Semua kelayakan <i class="fa-solid fa-arrow-right text-[10px]" aria-hidden="true"></i>
							</button>
						</div>
						{#if s.recentlyEligible.length === 0}
							<p class="px-5 py-6 text-center text-xs text-slate-500">
								Belum ada peserta yang baru memenuhi syarat.
							</p>
						{:else}
							<ul class="divide-y divide-slate-100">
								{#each s.recentlyEligible as r (r.eligibilityId)}
									<li class="px-5 py-3.5">
										<p class="text-sm font-bold text-slate-900">{r.studentName}</p>
										<p class="mt-0.5 text-[11px] text-slate-500">
											{r.courseTitle} · {r.moduleTitle}
										</p>
									</li>
								{/each}
							</ul>
						{/if}
					</div>
				</div>
			{/if}
		</div>
	{/if}

	{#if tab === 'kursus'}
		<div role="tabpanel" id="panel-kursus" aria-labelledby="tab-kursus" class="space-y-4">
			{#if coursesError}
				<div role="alert" class="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
					<p class="text-sm font-bold text-red-700">Kursus Anda belum dapat dimuat</p>
					<p class="mx-auto mt-1 max-w-md text-xs text-red-600">{coursesError}</p>
					<button
						type="button"
						onclick={() => {
							coursesError = '';
							courses = [];
							void loadCourses();
						}}
						class="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-red-600"
					>
						<i class="fa-solid fa-rotate-right" aria-hidden="true"></i> Coba lagi
					</button>
				</div>
			{:else if courses.length === 0}
				<div class="rounded-2xl border border-slate-200 bg-white p-8 text-center">
					<p class="flex items-center justify-center gap-2 text-sm font-bold text-slate-700">
						<i class="fa-solid fa-circle-notch fa-spin text-slate-400" aria-hidden="true"></i>
						Memuat kursus…
					</p>
				</div>
			{:else}
				<div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
					<div class="rounded-2xl border border-slate-200 bg-white p-5">
						<label for="sel-course" class="mb-1.5 block text-xs font-bold text-slate-700">
							Kursus yang Anda kelola
						</label>
						<select
							id="sel-course"
							bind:value={selCourseId}
							onchange={() => {
								selModuleId = '';
							}}
							class="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
						>
							<option value="" disabled>Pilih kursus…</option>
							{#each courses as c (c.id)}
								<option value={c.id}>{c.title}</option>
							{/each}
						</select>

						{#if typeof selCourseId === 'number'}
							<p class="mt-4 mb-1.5 text-xs font-bold text-slate-700">Modul dalam kursus</p>
							{#if modulesLoading[selCourseId]}
								<p class="py-4 text-center text-xs text-slate-500">
									<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i> Memuat modul…
								</p>
							{:else if modulesError[selCourseId]}
								<p role="alert" class="rounded-xl bg-red-50 px-3 py-2.5 text-xs text-red-600">
									{modulesError[selCourseId]}
								</p>
							{:else if selModules.length === 0}
								<p class="rounded-xl bg-slate-50 px-3 py-2.5 text-xs text-slate-500">
									Kursus ini belum memiliki modul.
								</p>
							{:else}
								<ul class="space-y-2">
									{#each selModules as m (m.id)}
										<li>
											<button
												type="button"
												onclick={() => {
													selModuleId = m.id;
												}}
												aria-pressed={selModuleId === m.id}
												class="flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-left text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-blue-600 {selModuleId === m.id
													? 'border-blue-300 bg-blue-50 text-blue-800'
													: 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}"
											>
												<span class="truncate">{m.title}</span>
												{#if selModuleId === m.id}
													<i class="fa-solid fa-circle-check shrink-0 text-blue-600" aria-hidden="true"></i>
												{/if}
											</button>
										</li>
									{/each}
								</ul>
							{/if}
						{/if}
					</div>

					<div class="lg:col-span-2">
						{#if selModuleId === ''}
							<div class="flex h-full min-h-48 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
								<p class="max-w-xs text-xs leading-relaxed text-slate-500">
									Pilih kursus lalu modul untuk melihat status sertifikat dan peserta terkait.
								</p>
							</div>
						{:else if moduleStatus.phase === 'loading' || moduleStatus.phase === 'idle'}
							<div class="animate-pulse rounded-2xl border border-slate-200 bg-white p-6">
								<div class="h-5 w-48 rounded bg-slate-100"></div>
								<div class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
									{#each [1, 2, 3, 4] as i (i)}
										<div class="h-16 rounded-xl bg-slate-100"></div>
									{/each}
								</div>
							</div>
						{:else if moduleStatus.phase === 'error'}
							<div role="alert" class="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
								<p class="text-sm font-bold text-red-700">Status modul belum dapat dimuat</p>
								<p class="mx-auto mt-1 max-w-md text-xs text-red-600">{moduleStatus.error}</p>
								<p class="mx-auto mt-1 max-w-md text-xs text-red-600/80">
									Endpoint
									<span class="font-mono">GET /instructor/modules/{selModuleId}/certificate-status</span>
									belum tersedia atau backend tidak terjangkau.
								</p>
								<button
									type="button"
									onclick={() => void loadModuleStatus()}
									class="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-red-600"
								>
									<i class="fa-solid fa-rotate-right" aria-hidden="true"></i> Coba lagi
								</button>
							</div>
						{:else if moduleStatus.data}
							{@const ms = moduleStatus.data}
							<div class="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
								<p class="text-[11px] font-bold tracking-widest text-slate-400 uppercase">
									{ms.courseTitle}
								</p>
								<h2 class="mt-0.5 text-lg font-extrabold text-slate-900">{ms.moduleTitle}</h2>
								<dl class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
									<div class="rounded-xl bg-blue-50 px-3 py-3 text-center">
										<dd class="text-xl font-black tabular-nums text-slate-900">{ms.eligibleCount}</dd>
										<dt class="mt-0.5 text-[11px] font-semibold text-slate-600">Memenuhi syarat</dt>
									</div>
									<div class="rounded-xl bg-emerald-50 px-3 py-3 text-center">
										<dd class="text-xl font-black tabular-nums text-slate-900">{ms.issuedCount}</dd>
										<dt class="mt-0.5 text-[11px] font-semibold text-slate-600">Sudah diterbitkan</dt>
									</div>
									<div class="rounded-xl bg-amber-50 px-3 py-3 text-center">
										<dd class="text-xl font-black tabular-nums text-slate-900">{ms.notEligibleCount}</dd>
										<dt class="mt-0.5 text-[11px] font-semibold text-slate-600">Belum memenuhi</dt>
									</div>
									<div class="rounded-xl bg-red-50 px-3 py-3 text-center">
										<dd class="text-xl font-black tabular-nums text-slate-900">{ms.revokedCount}</dd>
										<dt class="mt-0.5 text-[11px] font-semibold text-slate-600">Dicabut</dt>
									</div>
								</dl>
								<div class="mt-4 flex flex-col gap-2 sm:flex-row">
									<button
										type="button"
										onclick={() => gotoEligibility(ms.courseId, ms.moduleId)}
										class="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
									>
										<i class="fa-solid fa-user-check" aria-hidden="true"></i> Lihat kelayakan peserta
									</button>
									<button
										type="button"
										onclick={() => gotoHistory(ms.courseId, ms.moduleId)}
										class="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600"
									>
										<i class="fa-solid fa-clock-rotate-left" aria-hidden="true"></i> Lihat riwayat modul
									</button>
								</div>
							</div>
						{/if}
					</div>
				</div>
			{/if}
		</div>
	{/if}

	{#if tab === 'kelayakan'}
		<div role="tabpanel" id="panel-kelayakan" aria-labelledby="tab-kelayakan" class="space-y-4">
			<form
				role="search"
				aria-label="Filter kelayakan peserta"
				class="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-5"
				onsubmit={(e) => {
					e.preventDefault();
					loadedTabs.kelayakan = true;
					void loadEligibility();
				}}
			>
				<div>
					<label for="k-course" class="mb-1.5 block text-xs font-bold text-slate-700">Kursus</label>
					<select
						id="k-course"
						bind:value={kCourseId}
						onchange={() => {
							kModuleId = '';
							if (typeof kCourseId === 'number') void loadModules(kCourseId);
						}}
						class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
					>
						<option value="">Semua kursus saya</option>
						{#each courses as c (c.id)}
							<option value={c.id}>{c.title}</option>
						{/each}
					</select>
				</div>
				<div>
					<label for="k-module" class="mb-1.5 block text-xs font-bold text-slate-700">Modul</label>
					<select
						id="k-module"
						bind:value={kModuleId}
						disabled={kCourseId === ''}
						class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-50"
					>
						<option value="">Semua modul</option>
						{#each kModules as m (m.id)}
							<option value={m.id}>{m.title}</option>
						{/each}
					</select>
				</div>
				<div>
					<label for="k-status" class="mb-1.5 block text-xs font-bold text-slate-700">Status</label>
					<select
						id="k-status"
						bind:value={kStatus}
						class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
					>
						<option value="semua">Semua status</option>
						<option value="belum_memenuhi">{eligibilityLabel('belum_memenuhi')}</option>
						<option value="menunggu_penilaian">{eligibilityLabel('menunggu_penilaian')}</option>
						<option value="memenuhi">{eligibilityLabel('memenuhi')}</option>
						<option value="sudah_terbit">{eligibilityLabel('sudah_terbit')}</option>
					</select>
				</div>
				<div>
					<label for="k-q" class="mb-1.5 block text-xs font-bold text-slate-700">Nama peserta</label>
					<input
						id="k-q"
						type="search"
						bind:value={kQuery}
						placeholder="Cari nama…"
						autocomplete="off"
						class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
					/>
				</div>
				<div class="flex items-end gap-2">
					<button
						type="submit"
						class="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
					>
						<i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i> Terapkan
					</button>
					<button
						type="button"
						onclick={() => {
							kCourseId = '';
							kModuleId = '';
							kStatus = 'semua';
							kQuery = '';
							void loadEligibility();
						}}
						class="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600"
					>
						Reset
					</button>
				</div>
			</form>

			{#if eligibility.phase === 'loading' || eligibility.phase === 'idle'}
				<div class="space-y-2" aria-label="Memuat kelayakan">
					{#each [1, 2, 3] as i (i)}
						<div class="h-16 animate-pulse rounded-2xl border border-slate-200 bg-white"></div>
					{/each}
				</div>
			{:else if eligibility.phase === 'error'}
				<div role="alert" class="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
					<p class="text-sm font-bold text-red-700">Kelayakan belum dapat dimuat</p>
					<p class="mx-auto mt-1 max-w-md text-xs text-red-600">{eligibility.error}</p>
					<p class="mx-auto mt-1 max-w-md text-xs text-red-600/80">
						Endpoint <span class="font-mono">GET /instructor/eligibility</span> belum tersedia atau
						backend tidak terjangkau.
					</p>
					<button
						type="button"
						onclick={() => void loadEligibility()}
						class="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-red-600"
					>
						<i class="fa-solid fa-rotate-right" aria-hidden="true"></i> Coba lagi
					</button>
				</div>
			{:else if eligibility.phase === 'empty'}
				<div class="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
					<p class="text-sm font-bold text-slate-700">Tidak ada data kelayakan</p>
					<p class="mx-auto mt-1 max-w-md text-xs text-slate-500">
						Tidak ada peserta yang cocok dengan filter. Ubah filter atau pastikan peserta sudah
						terdaftar di kursus Anda.
					</p>
				</div>
			{:else if eligibility.data}
				<div class="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white md:block">
					<table class="w-full text-sm">
						<caption class="sr-only">Tabel kelayakan sertifikat peserta</caption>
						<thead>
							<tr class="border-b border-slate-100 text-left text-[11px] font-extrabold tracking-[0.14em] text-slate-400 uppercase">
								<th scope="col" class="px-5 py-4">Peserta</th>
								<th scope="col" class="px-4 py-4">Modul</th>
								<th scope="col" class="px-4 py-4 text-center">Materi wajib</th>
								<th scope="col" class="px-4 py-4 text-center">Kuis</th>
								<th scope="col" class="px-4 py-4 text-center">Tugas</th>
								<th scope="col" class="px-4 py-4">Status</th>
								<th scope="col" class="px-5 py-4 text-right">Aksi</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-slate-100">
							{#each eligibility.data as row (row.id)}
								<tr class="transition-colors hover:bg-blue-50/50">
									<td class="px-5 py-4">
										<p class="font-bold text-slate-900">{row.studentName}</p>
										<p class="text-[11px] text-slate-500">{row.nim ?? '—'} · {row.courseTitle}</p>
									</td>
									<td class="max-w-56 px-4 py-4 text-[13px] font-semibold text-slate-600">{row.moduleTitle}</td>
									<td class="px-4 py-4 text-center text-[13px] font-bold tabular-nums text-slate-700">
										{row.materialDone}/{row.materialTotal}
									</td>
									<td class="px-4 py-4 text-center">
										<span class="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold {quizBadge(row.quizStatus)}">
											{quizText(row.quizStatus)}
										</span>
									</td>
									<td class="px-4 py-4 text-center">
										<span class="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold {taskBadge(row.taskStatus)}">
											{taskText(row.taskStatus)}
										</span>
									</td>
									<td class="px-4 py-4">
										<span class="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold whitespace-nowrap {eligibilityBadge(row.status)}">
											{eligibilityLabel(row.status)}
										</span>
									</td>
									<td class="px-5 py-4 text-right">
										<a
											href="/instruktur/sertifikat/kelayakan/{encodeURIComponent(String(row.id))}{mockSuffix}"
											class="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-[11px] font-bold text-blue-700 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-blue-600"
											aria-label="Lihat detail kelayakan {row.studentName} pada {row.moduleTitle}"
										>
											Detail <i class="fa-solid fa-arrow-right text-[10px]" aria-hidden="true"></i>
										</a>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
				<ol class="space-y-3 md:hidden" aria-label="Daftar kelayakan peserta">
					{#each eligibility.data ?? [] as row (row.id)}
						<li class="rounded-2xl border border-slate-200 bg-white p-4">
							<div class="flex items-start justify-between gap-2">
								<div class="min-w-0">
									<p class="text-sm font-bold text-slate-900">{row.studentName}</p>
									<p class="mt-0.5 text-[11px] text-slate-500">{row.moduleTitle}</p>
								</div>
								<span class="inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[10px] font-bold whitespace-nowrap {eligibilityBadge(row.status)}">
									{eligibilityLabel(row.status)}
								</span>
							</div>
							<p class="mt-2 text-[11px] tabular-nums text-slate-600">
								Materi {row.materialDone}/{row.materialTotal} · Kuis {quizText(row.quizStatus)} ·
								Tugas {taskText(row.taskStatus)}
							</p>
							<a
								href="/instruktur/sertifikat/kelayakan/{encodeURIComponent(String(row.id))}{mockSuffix}"
								class="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-[11px] font-bold text-blue-700 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-blue-600"
								aria-label="Lihat detail kelayakan {row.studentName} pada {row.moduleTitle}"
							>
								Lihat detail <i class="fa-solid fa-arrow-right text-[10px]" aria-hidden="true"></i>
							</a>
						</li>
					{/each}
				</ol>
			{/if}
		</div>
	{/if}

	{#if tab === 'riwayat'}
		<div role="tabpanel" id="panel-riwayat" aria-labelledby="tab-riwayat" class="space-y-4">
			<form
				role="search"
				aria-label="Filter riwayat sertifikat"
				class="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-3"
				onsubmit={(e) => {
					e.preventDefault();
					loadedTabs.riwayat = true;
					void loadHistory();
				}}
			>
				<div class="sm:col-span-2 lg:col-span-1">
					<label for="r-q" class="mb-1.5 block text-xs font-bold text-slate-700">Nama / kode</label>
					<input
						id="r-q"
						type="search"
						bind:value={rQuery}
						placeholder="Nama peserta atau kode sertifikat…"
						autocomplete="off"
						class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
					/>
				</div>
				<div class="grid grid-cols-2 gap-3">
					<div>
						<label for="r-course" class="mb-1.5 block text-xs font-bold text-slate-700">Kursus</label>
						<select
							id="r-course"
							bind:value={rCourseId}
							onchange={() => {
								rModuleId = '';
								if (typeof rCourseId === 'number') void loadModules(rCourseId);
							}}
							class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
						>
							<option value="">Semua</option>
							{#each courses as c (c.id)}
								<option value={c.id}>{c.title}</option>
							{/each}
						</select>
					</div>
					<div>
						<label for="r-module" class="mb-1.5 block text-xs font-bold text-slate-700">Modul</label>
						<select
							id="r-module"
							bind:value={rModuleId}
							disabled={rCourseId === ''}
							class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-50"
						>
							<option value="">Semua</option>
							{#each rModules as m (m.id)}
								<option value={m.id}>{m.title}</option>
							{/each}
						</select>
					</div>
				</div>
				<div class="grid grid-cols-3 gap-3">
					<div>
						<label for="r-status" class="mb-1.5 block text-xs font-bold text-slate-700">Status</label>
						<select
							id="r-status"
							bind:value={rStatus}
							class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
						>
							<option value="semua">Semua</option>
							<option value="aktif">{certificateStatusLabel('aktif')}</option>
							<option value="dicabut">{certificateStatusLabel('dicabut')}</option>
						</select>
					</div>
					<div>
						<label for="r-from" class="mb-1.5 block text-xs font-bold text-slate-700">Dari</label>
						<input
							id="r-from"
							type="date"
							bind:value={rFrom}
							class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
						/>
					</div>
					<div>
						<label for="r-to" class="mb-1.5 block text-xs font-bold text-slate-700">Sampai</label>
						<input
							id="r-to"
							type="date"
							bind:value={rTo}
							class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
						/>
					</div>
				</div>
				<div class="flex items-end gap-2 sm:col-span-2 lg:col-span-3">
					<button
						type="submit"
						class="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600 sm:flex-none sm:px-8"
					>
						<i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i> Terapkan filter
					</button>
					<button
						type="button"
						onclick={() => {
							rCourseId = '';
							rModuleId = '';
							rStatus = 'semua';
							rQuery = '';
							rFrom = '';
							rTo = '';
							void loadHistory();
						}}
						class="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600"
					>
						Reset
					</button>
				</div>
			</form>

			{#if history.phase === 'loading' || history.phase === 'idle'}
				<div class="space-y-2" aria-label="Memuat riwayat">
					{#each [1, 2, 3] as i (i)}
						<div class="h-16 animate-pulse rounded-2xl border border-slate-200 bg-white"></div>
					{/each}
				</div>
			{:else if history.phase === 'error'}
				<div role="alert" class="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
					<p class="text-sm font-bold text-red-700">Riwayat belum dapat dimuat</p>
					<p class="mx-auto mt-1 max-w-md text-xs text-red-600">{history.error}</p>
					<p class="mx-auto mt-1 max-w-md text-xs text-red-600/80">
						Endpoint <span class="font-mono">GET /instructor/certificates</span> belum tersedia atau
						backend tidak terjangkau.
					</p>
					<button
						type="button"
						onclick={() => void loadHistory()}
						class="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-red-600"
					>
						<i class="fa-solid fa-rotate-right" aria-hidden="true"></i> Coba lagi
					</button>
				</div>
			{:else if history.phase === 'empty'}
				<div class="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
					<p class="text-sm font-bold text-slate-700">Belum ada sertifikat pada filter ini</p>
					<p class="mx-auto mt-1 max-w-md text-xs text-slate-500">
						Sertifikat terbit otomatis oleh sistem setelah peserta memenuhi seluruh syarat modul.
						Ubah filter untuk melihat data lain.
					</p>
				</div>
			{:else if history.data}
				<div class="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white md:block">
					<table class="w-full text-sm">
						<caption class="sr-only">Riwayat sertifikat termasuk yang dicabut</caption>
						<thead>
							<tr class="border-b border-slate-100 text-left text-[11px] font-extrabold tracking-[0.14em] text-slate-400 uppercase">
								<th scope="col" class="px-5 py-4">Kode</th>
								<th scope="col" class="px-4 py-4">Peserta</th>
								<th scope="col" class="px-4 py-4">Kursus / Modul</th>
								<th scope="col" class="px-4 py-4">Terbit</th>
								<th scope="col" class="px-4 py-4">Status</th>
								<th scope="col" class="px-5 py-4 text-right">Aksi</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-slate-100">
							{#each history.data as row (row.id)}
								<tr class="transition-colors hover:bg-blue-50/50">
									<td class="px-5 py-4 font-mono text-xs font-bold text-slate-800">{row.code}</td>
									<td class="px-4 py-4">
										<p class="font-bold text-slate-900">{row.studentName}</p>
										<p class="text-[11px] text-slate-500">Tercetak: {row.printedName}</p>
									</td>
									<td class="max-w-56 px-4 py-4 text-[13px] text-slate-600">
										{row.courseTitle}
										<span class="block text-[11px] text-slate-400">{row.moduleTitle}</span>
									</td>
									<td class="px-4 py-4 text-[13px] whitespace-nowrap text-slate-600">{formatDate(row.issuedAt)}</td>
									<td class="px-4 py-4">
										<span class="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold whitespace-nowrap {certBadge(row.status)}">
											{certificateStatusLabel(row.status)}
										</span>
									</td>
									<td class="px-5 py-4 text-right">
										<a
											href="/instruktur/sertifikat/{encodeURIComponent(String(row.id))}{mockSuffix}"
											class="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-[11px] font-bold text-blue-700 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-blue-600"
											aria-label="Lihat detail sertifikat {row.code} milik {row.studentName}"
										>
											Detail <i class="fa-solid fa-arrow-right text-[10px]" aria-hidden="true"></i>
										</a>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
				<ol class="space-y-3 md:hidden" aria-label="Riwayat sertifikat">
					{#each history.data ?? [] as row (row.id)}
						<li class="rounded-2xl border border-slate-200 bg-white p-4">
							<div class="flex items-start justify-between gap-2">
								<div class="min-w-0">
									<p class="font-mono text-xs font-bold text-slate-800">{row.code}</p>
									<p class="mt-0.5 truncate text-sm font-bold text-slate-900">{row.studentName}</p>
									<p class="mt-0.5 text-[11px] text-slate-500">{row.courseTitle} · {row.moduleTitle}</p>
								</div>
								<span class="inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[10px] font-bold whitespace-nowrap {certBadge(row.status)}">
									{certificateStatusLabel(row.status)}
								</span>
							</div>
							<a
								href="/instruktur/sertifikat/{encodeURIComponent(String(row.id))}{mockSuffix}"
								class="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-[11px] font-bold text-blue-700 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-blue-600"
								aria-label="Lihat detail sertifikat {row.code} milik {row.studentName}"
							>
								Lihat detail <i class="fa-solid fa-arrow-right text-[10px]" aria-hidden="true"></i>
							</a>
						</li>
					{/each}
				</ol>
			{/if}
		</div>
	{/if}
</div>
