<script lang="ts">
	import { browser } from '$app/environment';
	import { fetchMyEnrollments, fetchMyProgressSummary, type MyEnrollment } from '$lib/api/progress';
	import {
		fetchPublicCourses,
		type BackendCourse
	} from '$lib/api/courses';
	import { redeemVoucher } from '$lib/api/vouchers';
	import { periodBadgeClass, periodIcon, type CoursePeriod } from '$lib/data/course-meta';

	type Status = 'all' | 'in-progress' | 'completed' | 'not-started';
	type CardStatus = Exclude<Status, 'all'>;

	interface CourseCard {
		id: number;
		title: string;
		description: string | null;
		category: string | null;
		level: string;
		duration: string | null;
		image: string | null;
		priceNominal: number;
		priceLabel: string;
		period: CoursePeriod;
		startMonth: string | null;
		enrolledAt: string;
		completed: number;
		total: number;
		percent: number;
		status: CardStatus;
	}

	let activeFilter = $state<Status>('all');

	let enrollments = $state<MyEnrollment[]>([]);
	let progressByCourse = $state<Record<number, { completed: number; total: number; percent: number }>>({});
	let catalog = $state<BackendCourse[]>([]);
	let loading = $state(true);
	let loadError = $state('');
	let started = false;
	let loadSeq = 0;

	// Tukar voucher resmi (K-03): backend validasi 4 cocok + anti-race.
	let voucherCode = $state('');
	let voucherCourseId = $state<number | ''>('');
	let voucherStatus = $state<'idle' | 'loading' | 'error' | 'success'>('idle');
	let voucherMessage = $state('');

	function toPeriod(p: unknown): CoursePeriod {
		return p === 'upcoming' || p === 'ongoing' || p === 'ended' ? p : 'ongoing';
	}

	function formatDate(iso: string | null): string {
		if (!iso) return '—';
		const d = new Date(iso);
		return Number.isNaN(d.getTime())
			? iso
			: d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
	}

	async function load(): Promise<void> {
		const my = ++loadSeq;
		loading = true;
		loadError = '';
		try {
			const [enr, summary, cat] = await Promise.all([
				fetchMyEnrollments(),
				fetchMyProgressSummary(),
				fetchPublicCourses(100)
			]);
			if (my !== loadSeq) return;
			enrollments = enr;
			const byCourse: Record<number, { completed: number; total: number; percent: number }> = {};
			for (const c of summary.perCourse) {
				byCourse[c.courseId] = {
					completed: c.completedMaterials,
					total: c.totalMaterials,
					percent: c.percent
				};
			}
			progressByCourse = byCourse;
			catalog = Array.isArray(cat) ? cat : [];
			if (voucherCourseId === '') {
				const firstOpen = catalog.find((c) => !enr.some((e) => e.courseId === c.id));
				if (firstOpen) voucherCourseId = firstOpen.id;
			}
		} catch (e) {
			if (my !== loadSeq) return;
			loadError = e instanceof Error ? e.message : 'Gagal memuat kursus.';
		} finally {
			if (my === loadSeq) loading = false;
		}
	}

	$effect(() => {
		if (!browser || started) return;
		started = true;
		void load();
	});

	const enrolledIds = $derived(new Set(enrollments.map((e) => e.courseId)));

	const cards = $derived<CourseCard[]>(
		enrollments.map((e) => {
			const p = progressByCourse[e.courseId];
			const percent = p?.percent ?? 0;
			const cat = catalog.find((c) => c.id === e.courseId);
			return {
				id: e.courseId,
				title: e.title,
				description: e.description,
				category: e.category,
				level: e.level,
				duration: e.duration,
				image: e.image,
				priceNominal: e.priceNominal,
				priceLabel: e.priceLabel,
				period: toPeriod(e.period),
				startMonth: cat?.startMonth ?? null,
				enrolledAt: e.enrolledAt,
				completed: p?.completed ?? 0,
				total: p?.total ?? 0,
				percent,
				status: (percent >= 100 ? 'completed' : percent > 0 ? 'in-progress' : 'not-started') as CardStatus
			};
		})
	);

	// Kursus katalog yang belum diikuti — pilihan tujuan voucher.
	const openCourses = $derived(catalog.filter((c) => !enrolledIds.has(c.id)));

	const inProgressCount = $derived(cards.filter((c) => c.status === 'in-progress').length);
	const completedCount = $derived(cards.filter((c) => c.status === 'completed').length);

	const filtered = $derived(
		activeFilter === 'all' ? cards : cards.filter((c) => c.status === activeFilter)
	);

	const filters: { value: Status; label: string }[] = [
		{ value: 'all', label: 'Semua' },
		{ value: 'in-progress', label: 'Berjalan' },
		{ value: 'completed', label: 'Selesai' },
		{ value: 'not-started', label: 'Belum Mulai' }
	];

	function badgeClass(status: CardStatus): string {
		if (status === 'completed') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
		if (status === 'in-progress') return 'bg-blue-50 text-blue-700 border-blue-200';
		return 'bg-slate-50 text-slate-600 border-slate-200';
	}

	function badgeText(status: CardStatus): string {
		if (status === 'completed') return 'Selesai';
		if (status === 'in-progress') return 'Berjalan';
		return 'Belum Mulai';
	}

	async function redeemVoucherSubmit(e: SubmitEvent): Promise<void> {
		e.preventDefault();
		voucherMessage = '';
		if (!voucherCode.trim()) {
			voucherStatus = 'error';
			voucherMessage = 'Masukkan kode voucher.';
			return;
		}
		if (voucherCourseId === '') {
			voucherStatus = 'error';
			voucherMessage = 'Pilih kursus tujuan voucher.';
			return;
		}
		voucherStatus = 'loading';
		try {
			await redeemVoucher(voucherCode, voucherCourseId);
			voucherStatus = 'success';
			voucherMessage = 'Voucher berhasil ditukar. Akses kursus dibuka.';
			voucherCode = '';
			await load();
		} catch (err) {
			voucherStatus = 'error';
			voucherMessage = err instanceof Error ? err.message : 'Penukaran gagal. Coba lagi.';
		}
	}
</script>

<svelte:head>
	<title>Kursusku — Aristoteles Platform</title>
	<meta
		name="description"
		content="Daftar kursus yang sedang dan telah diikuti pengguna Aristoteles."
	/>
</svelte:head>

<div class="p-4 sm:p-6 lg:p-8">
	<div class="mb-6">
		<p class="text-xs font-bold tracking-widest text-blue-600 uppercase">Menu Utama · Kursusku</p>
		<h1 class="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Kursusku</h1>
		<p class="mt-1 text-sm text-slate-500">
			Lanjutkan pembelajaranmu — {inProgressCount} kursus sedang berjalan,
			{completedCount} selesai.
		</p>
		<p class="mt-1 text-xs text-slate-400">
			Hanya kursus yang sudah Anda ikuti tampil di sini — lihat katalog di
			<a
				href="/user/semua-kursus"
				class="rounded font-semibold text-blue-600 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
				>Semua Kursus</a
			>.
		</p>
	</div>

	<!-- Redeem kode voucher (K-03: validasi 4 cocok + anti-race di backend) -->
	<section
		aria-labelledby="voucher-heading"
		class="relative mb-6 overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-blue-700 to-indigo-800 p-5 text-white sm:p-6"
	>
		<div
			class="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full bg-white/10 blur-2xl"
			aria-hidden="true"
		></div>
		<div
			class="pointer-events-none absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-cyan-400/20 blur-2xl"
			aria-hidden="true"
		></div>
		<div class="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
			<div class="flex items-start gap-3.5">
				<span
					class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15"
					aria-hidden="true"
				>
					<i class="fa-solid fa-ticket text-xl text-amber-300"></i>
				</span>
				<div>
					<h2 id="voucher-heading" class="text-base font-extrabold sm:text-lg">
						Punya kode voucher?
					</h2>
					<p class="mt-0.5 text-xs text-blue-100 sm:text-sm">
						Tukarkan kode dari kampus atau event untuk membuka kursus. Satu kode hanya untuk satu
						akun dan satu kursus.
					</p>
				</div>
			</div>
			<form
				onsubmit={redeemVoucherSubmit}
				class="w-full max-w-md"
				aria-label="Formulir tukar kode voucher"
			>
				<div class="flex flex-col gap-2 sm:flex-row">
					<div class="relative flex-1">
						<label for="voucher-code" class="sr-only">Kode voucher</label>
						<input
							id="voucher-code"
							type="text"
							bind:value={voucherCode}
							placeholder="Contoh: ARISTO-XXXX"
							autocomplete="off"
							spellcheck={false}
							aria-invalid={voucherStatus === 'error'}
							class="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 font-mono text-sm font-bold tracking-widest text-white uppercase placeholder:text-blue-200/60 placeholder:normal-case placeholder:tracking-normal focus:border-white focus:bg-white/15 focus:ring-4 focus:ring-white/20 focus:outline-none"
						/>
					</div>
					<div class="relative flex-1">
						<label for="voucher-course" class="sr-only">Kursus tujuan</label>
						<select
							id="voucher-course"
							bind:value={voucherCourseId}
							class="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white focus:border-white focus:bg-white/15 focus:ring-4 focus:ring-white/20 focus:outline-none [&>option]:text-slate-800"
						>
							<option value="" disabled>Pilih kursus…</option>
							{#each openCourses as c (c.id)}
								<option value={c.id}>{c.title}</option>
							{/each}
						</select>
					</div>
					<button
						type="submit"
						disabled={voucherStatus === 'loading'}
						class="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-amber-400 px-5 py-2.5 text-xs font-extrabold text-slate-900 uppercase transition-all hover:bg-amber-300 focus-visible:outline-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-70"
					>
						{#if voucherStatus === 'loading'}
							<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i> Menukar…
						{:else}
							<i class="fa-solid fa-gift" aria-hidden="true"></i> Tukar
						{/if}
					</button>
				</div>
				<p id="voucher-help" class="mt-1.5 text-[11px] text-blue-200">
					Kode tidak valid, sudah dipakai, atau untuk kursus lain akan ditolak oleh server.
				</p>
				{#if voucherStatus === 'error' || voucherStatus === 'success'}
					<p
						role={voucherStatus === 'error' ? 'alert' : 'status'}
						class={`mt-2 flex items-start gap-2 rounded-xl px-3.5 py-2.5 text-xs font-semibold ${
							voucherStatus === 'error'
								? 'bg-red-500/20 text-red-100'
								: 'bg-emerald-400/20 text-emerald-100'
						}`}
					>
						<i
							class={`fa-solid ${voucherStatus === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check'} mt-0.5 shrink-0`}
							aria-hidden="true"
						></i>
						<span>{voucherMessage}</span>
					</p>
				{/if}
			</form>
		</div>
	</section>

	{#if loading}
		<div class="mb-6 flex flex-wrap gap-2" aria-label="Memuat filter">
			{#each [1, 2, 3, 4] as i (i)}
				<div class="h-9 w-24 animate-pulse rounded-xl bg-slate-100"></div>
			{/each}
		</div>
		<div class="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3" aria-label="Memuat kursus">
			{#each [1, 2, 3] as i (i)}
				<div class="animate-pulse overflow-hidden rounded-2xl border border-slate-200/70 bg-white">
					<div class="h-44 bg-slate-100"></div>
					<div class="space-y-2 p-5">
						<div class="h-4 rounded bg-slate-100"></div>
						<div class="h-4 w-2/3 rounded bg-slate-100"></div>
					</div>
				</div>
			{/each}
		</div>
	{:else if loadError}
		<div role="alert" class="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
			<p class="text-sm font-bold text-red-700">Kursusku belum dapat dimuat</p>
			<p class="mx-auto mt-1 max-w-md text-xs text-red-600">{loadError}</p>
			<button
				type="button"
				onclick={() => void load()}
				class="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-red-600"
			>
				<i class="fa-solid fa-rotate-right" aria-hidden="true"></i> Coba lagi
			</button>
		</div>
	{:else}
		<!-- Filter -->
		<div class="mb-6 flex flex-wrap gap-2" role="group" aria-label="Filter status kursus">
			{#each filters as f (f.value)}
				<button
					type="button"
					onclick={() => (activeFilter = f.value)}
					aria-pressed={activeFilter === f.value}
					class={`rounded-xl px-4 py-2 text-xs font-bold transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
						activeFilter === f.value
							? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
							: 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
					}`}
				>
					{f.label}
				</button>
			{/each}
		</div>

		{#if filtered.length === 0}
			<div class="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
				<i class="fa-solid fa-folder-open mb-3 text-3xl text-slate-300" aria-hidden="true"></i>
				<p class="text-sm font-semibold text-slate-700">
					{enrollments.length === 0
						? 'Anda belum mengikuti kursus apa pun.'
						: 'Tidak ada kursus pada filter ini.'}
				</p>
				<p class="mt-1 text-xs text-slate-500">
					Jelajahi katalog atau tukar kode voucher untuk mulai belajar.
				</p>
			</div>
		{:else}
			<div class="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
				{#each filtered as course (course.id)}
					<article
						class="group flex flex-col overflow-hidden rounded-2xl border border-slate-200/70 bg-white transition-shadow hover:shadow-xl"
					>
						<div class="relative overflow-hidden">
							{#if course.image}
								<img
									src={course.image}
									alt={`Sampul kursus ${course.title}`}
									class="h-44 w-full object-cover transition duration-500 group-hover:scale-105"
									loading="lazy"
								/>
							{:else}
								<div
									class="flex h-44 w-full items-center justify-center bg-gradient-to-br from-blue-700 to-indigo-900"
									aria-hidden="true"
								>
									<i class="fa-solid fa-book-open text-4xl text-white/40"></i>
								</div>
							{/if}
							<span
								class={`absolute top-3 left-3 rounded-md border px-2.5 py-1 text-[10px] font-extrabold uppercase ${badgeClass(course.status)}`}
							>
								{badgeText(course.status)}
							</span>
							<span
								class={`absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[10px] font-extrabold uppercase ${periodBadgeClass(course.period)}`}
							>
								<i class={`fa-solid ${periodIcon(course.period)}`} aria-hidden="true"></i>
								{course.period === 'upcoming'
									? `Mulai ${course.startMonth ?? 'segera'}`
									: course.period === 'ongoing'
										? 'Berjalan'
										: 'Lewat'}
							</span>
						</div>
						<div class="flex flex-1 flex-col p-5">
							<p class="text-[11px] font-bold tracking-wide text-blue-600 uppercase">
								{course.category ?? 'Umum'}
							</p>
							<h2 class="mt-1 line-clamp-2 text-base font-bold text-slate-900">
								<a
									href={`/user/kursusku/${course.id}`}
									class="rounded transition-colors hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
								>
									{course.title}
								</a>
							</h2>
							<p class="mt-1 text-xs text-slate-500">
								{course.level} · Terdaftar: {formatDate(course.enrolledAt)}
							</p>
							<p
								class="mt-1.5 inline-flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-slate-500"
							>
								<span class="rounded-full bg-blue-50 px-2.5 py-0.5 text-blue-700"
									>{course.total} materi</span
								>
								{#if course.priceNominal > 0}
									<span
										class="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-emerald-800"
										><i class="fa-solid fa-check text-[9px]" aria-hidden="true"></i>Lunas</span
									>
								{/if}
							</p>

							<div class="mt-4">
								<div class="mb-1.5 flex justify-between text-xs">
									<span class="text-slate-500"
										>{course.completed}/{course.total} materi</span
									>
									<span class="font-bold text-slate-700">{course.percent}%</span>
								</div>
								<div
									class="h-2 overflow-hidden rounded-full bg-slate-100"
									role="progressbar"
									aria-valuenow={Math.round(course.percent)}
									aria-valuemin={0}
									aria-valuemax={100}
									aria-label={`Progres ${course.title}`}
								>
									<div
										class={`h-full rounded-full ${course.percent >= 100 ? 'bg-emerald-500' : 'bg-blue-500'}`}
										style="width: {course.percent}%"
									></div>
								</div>
							</div>

							<div class="mt-5 flex gap-2">
								{#if course.period === 'upcoming'}
									<div class="flex-1">
										<span
											aria-disabled="true"
											title="Materi terkunci sampai periode berjalan"
											class="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-slate-200 px-4 py-2.5 text-xs font-bold text-slate-500"
										>
											<i class="fa-solid fa-lock" aria-hidden="true"></i>
											Mulai {course.startMonth ?? 'segera'}
										</span>
										<p class="mt-1.5 text-center text-[11px] text-slate-500">
											Sudah terdaftar · materi terkunci sampai periode berjalan
										</p>
									</div>
								{:else if course.status === 'completed'}
									<a
										href={`/user/kursusku/${course.id}`}
										class="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
									>
										<i class="fa-solid fa-book-open" aria-hidden="true"></i> Lihat Modul
									</a>
									<a
										href="/user/sertifikat"
										class="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-emerald-600"
									>
										<i class="fa-solid fa-award" aria-hidden="true"></i> Sertifikat
									</a>
								{:else}
									<a
										href={`/user/kursusku/${course.id}`}
										class="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
									>
										<i class="fa-solid fa-play" aria-hidden="true"></i>
										{course.status === 'not-started' ? 'Mulai Belajar' : 'Lanjutkan'}
									</a>
								{/if}
							</div>
						</div>
					</article>
				{/each}
			</div>
		{/if}
	{/if}
</div>
