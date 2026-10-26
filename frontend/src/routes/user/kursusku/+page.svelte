<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import { courses, type Course } from '$lib/data/courses';
	import { getCourseMeta, periodBadgeClass, periodIcon } from '$lib/data/course-meta';
	import { getTrainingStats } from '$lib/data/training';
	import { canAccessCourse, isCoursePaid, ownedCourses } from '$lib/stores/enrollment.svelte';

	type Status = 'all' | 'in-progress' | 'completed' | 'not-started';

	let activeFilter = $state<Status>('all');

	// Redeem kode voucher (simulasi sisi klien)
	const VALID_CODES: Record<string, string> = {
		'ARISTOTELES-2026': 'Machine Learning Dasar',
		'BELAJAR-GRATIS': 'Keamanan Siber',
		'UNIRA-MKM01': 'Jaringan Komputer Dasar',
		'FULLSTACK-2026': 'Full-Stack Web Development Bootcamp'
	};
	let voucherCode = $state('');
	let voucherStatus = $state<'idle' | 'error' | 'success'>('idle');
	let voucherMessage = $state('');
	let redeemedCodes = new SvelteSet<string>();

	function redeemVoucher(e: SubmitEvent) {
		e.preventDefault();
		const code = voucherCode.trim().toUpperCase().replace(/\s+/g, '');
		if (!/^[A-Z0-9]{4,}-[A-Z0-9]{4,}$/.test(code)) {
			voucherStatus = 'error';
			voucherMessage = 'Format kode salah. Contoh format yang benar: ARISTOTELES-2026.';
			return;
		}
		if (redeemedCodes.has(code)) {
			voucherStatus = 'error';
			voucherMessage = `Kode ${code} sudah pernah ditukar.`;
			return;
		}
		const courseName = VALID_CODES[code];
		if (!courseName) {
			voucherStatus = 'error';
			voucherMessage = `Kode ${code} tidak dikenal atau sudah kedaluwarsa.`;
			return;
		}
		redeemedCodes.add(code);
		voucherStatus = 'success';
		voucherMessage = `Tercatat lokal (simulasi): "${courseName}". Akses kursus belum dibuka — masih perlu validasi server.`;
		voucherCode = '';
	}

	const filters: { value: Status; label: string }[] = [
		{ value: 'all', label: 'Semua' },
		{ value: 'in-progress', label: 'Berjalan' },
		{ value: 'completed', label: 'Selesai' },
		{ value: 'not-started', label: 'Belum Mulai' }
	];

	// Kursus yang diikuti = semua course KECUALI yang berbayar & belum dibayar.
	// `ownedCourses.has` dibaca di sini agar daftar reaktif saat pembayaran sukses.
	const followed = $derived(
		courses.filter((c) => {
			void ownedCourses.has(c.id);
			return canAccessCourse(c.id);
		})
	);

	const filtered = $derived(
		activeFilter === 'all' ? followed : followed.filter((c) => c.status === activeFilter)
	);

	const filteredWithMeta = $derived(
		filtered.map((c) => ({ course: c, meta: getCourseMeta(c.id) }))
	);

	function badgeClass(status: Course['status']) {
		if (status === 'completed') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
		if (status === 'in-progress') return 'bg-blue-50 text-blue-700 border-blue-200';
		return 'bg-slate-50 text-slate-600 border-slate-200';
	}

	function badgeText(status: Course['status']) {
		if (status === 'completed') return 'Selesai';
		if (status === 'in-progress') return 'Berjalan';
		return 'Belum Mulai';
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
			Lanjutkan pembelajaranmu — {followed.filter((c) => c.status === 'in-progress').length} kursus sedang
			berjalan, {followed.filter((c) => c.status === 'completed').length} selesai.
		</p>
		<p class="mt-1 text-xs text-slate-400">
			Kursus berbayar yang belum dibayar tidak tampil di sini — lihat di
			<a
				href="/user/semua-kursus"
				class="rounded font-semibold text-blue-600 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
				>Semua Kursus</a
			>.
		</p>
	</div>

	<!-- Redeem kode voucher -->
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
						Tukarkan kode dari kampus atau event untuk membuka kursus premium gratis.
					</p>
				</div>
			</div>
			<form
				onsubmit={redeemVoucher}
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
							placeholder="Contoh: ARISTOTELES-2026"
							autocomplete="off"
							spellcheck={false}
							aria-describedby="voucher-help"
							aria-invalid={voucherStatus === 'error'}
							class="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 font-mono text-sm font-bold tracking-widest text-white uppercase placeholder:text-blue-200/60 placeholder:normal-case placeholder:tracking-normal focus:border-white focus:bg-white/15 focus:ring-4 focus:ring-white/20 focus:outline-none"
						/>
					</div>
					<button
						type="submit"
						class="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-amber-400 px-5 py-2.5 text-xs font-extrabold text-slate-900 uppercase transition-all hover:bg-amber-300 focus-visible:outline-2 focus-visible:outline-white"
					>
						<i class="fa-solid fa-gift" aria-hidden="true"></i> Tukar
					</button>
				</div>
				<p id="voucher-help" class="mt-1.5 text-[11px] text-blue-200">
					Kode demo: ARISTOTELES-2026 · BELAJAR-GRATIS · UNIRA-MKM01 · FULLSTACK-2026 ·
					simulasi lokal, belum validasi server.
				</p>
				{#if voucherStatus !== 'idle'}
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
			<p class="text-sm font-semibold text-slate-700">Tidak ada kursus pada filter ini.</p>
			<p class="mt-1 text-xs text-slate-500">
				Kursus berbayar yang belum dibayar hanya tampil di
				<a
					href="/user/semua-kursus"
					class="rounded font-semibold text-blue-600 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
					>Semua Kursus</a
				>.
			</p>
		</div>
	{:else}
		<div class="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
			{#each filteredWithMeta as { course, meta: kMeta } (course.id)}
				<article
					class="group flex flex-col overflow-hidden rounded-2xl border border-slate-200/70 bg-white transition-shadow hover:shadow-xl"
				>
					<div class="relative overflow-hidden">
						<img
							src={course.image}
							alt={`Sampul kursus ${course.title}`}
							class="h-44 w-full object-cover transition duration-500 group-hover:scale-105"
							loading="lazy"
						/>
						<span
							class={`absolute top-3 left-3 rounded-md border px-2.5 py-1 text-[10px] font-extrabold uppercase ${badgeClass(course.status)}`}
						>
							{badgeText(course.status)}
						</span>
						<span
							class={`absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[10px] font-extrabold uppercase ${periodBadgeClass(kMeta.period)}`}
						>
							<i class={`fa-solid ${periodIcon(kMeta.period)}`} aria-hidden="true"></i>
							{kMeta.period === 'upcoming'
								? `Mulai ${kMeta.startMonth ?? ''}`.trim()
								: kMeta.period === 'ongoing'
									? 'Berjalan'
									: 'Lewat'}
						</span>
					</div>
					<div class="flex flex-1 flex-col p-5">
						<p class="text-[11px] font-bold tracking-wide text-blue-600 uppercase">
							{course.category}
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
							{course.instructor} · Terakhir diakses: {course.lastAccessed}
						</p>
						<p
							class="mt-1.5 inline-flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-slate-500"
						>
							<span class="rounded-full bg-slate-100 px-2.5 py-0.5"
								>{getTrainingStats(course).moduleCount} modul</span
							>
							<span class="rounded-full bg-violet-100 px-2.5 py-0.5 text-violet-700"
								>{getTrainingStats(course).subModuleCount} sub-modul</span
							>
							<span class="rounded-full bg-blue-50 px-2.5 py-0.5 text-blue-700"
								>{getTrainingStats(course).materialCount} materi</span
							>
							{#if isCoursePaid(course.id)}
								<span
									class="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-emerald-800"
									><i class="fa-solid fa-check text-[9px]" aria-hidden="true"></i>Lunas</span
								>
							{/if}
							{#if getTrainingStats(course).materialCount >= 100}
								<span class="rounded-full bg-amber-100 px-2.5 py-0.5 text-amber-800">Kompleks</span>
							{/if}
						</p>

						<div class="mt-4">
							<div class="mb-1.5 flex justify-between text-xs">
								<span class="text-slate-500"
									>{course.completedMaterials}/{course.totalMaterials} materi</span
								>
								<span class="font-bold text-slate-700">{course.progress}%</span>
							</div>
							<div
								class="h-2 overflow-hidden rounded-full bg-slate-100"
								role="progressbar"
								aria-valuenow={course.progress}
								aria-valuemin={0}
								aria-valuemax={100}
								aria-label={`Progres ${course.title}`}
							>
								<div
									class={`h-full rounded-full ${course.progress === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`}
									style="width: {course.progress}%"
								></div>
							</div>
						</div>

						<div class="mt-5 flex gap-2">
							{#if kMeta.period === 'upcoming'}
								<div class="flex-1">
									<span
										aria-disabled="true"
										title="Materi terkunci sampai batch {kMeta.startMonth ?? ''} dimulai"
										class="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-slate-200 px-4 py-2.5 text-xs font-bold text-slate-500"
									>
										<i class="fa-solid fa-lock" aria-hidden="true"></i>
										Mulai {kMeta.startMonth ?? 'segera'}
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
							{:else if course.status === 'not-started'}
								<a
									href={`/user/kursusku/${course.id}`}
									class="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
								>
									{#if isCoursePaid(course.id) && !canAccessCourse(course.id)}
										<i class="fa-solid fa-lock" aria-hidden="true"></i> Lihat & Beli
									{:else}
										<i class="fa-solid fa-play" aria-hidden="true"></i> Mulai Belajar
									{/if}
								</a>
							{:else}
								<a
									href={`/user/kursusku/${course.id}`}
									class="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
								>
									<i class="fa-solid fa-play" aria-hidden="true"></i> Lanjutkan
								</a>
							{/if}
						</div>
					</div>
				</article>
			{/each}
		</div>
	{/if}
</div>
