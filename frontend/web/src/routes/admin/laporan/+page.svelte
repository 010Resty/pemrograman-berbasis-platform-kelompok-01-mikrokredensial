<script lang="ts">
	import { browser } from '$app/environment';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import UiStatCard from '$lib/components/ui/StatCard.svelte';
	import Pagination from '$lib/components/Pagination.svelte';
	import { fetchAdminReports, type AdminReports } from '$lib/api/admin';

	type Preset = 'all' | 'd7' | 'd30' | 'custom';

	const presets: { value: Exclude<Preset, 'custom'>; label: string }[] = [
		{ value: 'all', label: 'Semua' },
		{ value: 'd7', label: '7 hari' },
		{ value: 'd30', label: '30 hari' }
	];

	let preset = $state<Preset>('all');
	let fromInput = $state('');
	let toInput = $state('');
	let courseIdInput = $state('');
	let page = $state(1);
	let perPage = $state(10);
	let data = $state<AdminReports | null>(null);
	let loading = $state(true);
	let loadError = $state('');
	let csvBusy = $state(false);
	let csvError = $state('');
	let started = false;
	let loadSeq = 0;

	function isoDay(d: Date): string {
		const p = (n: number): string => String(n).padStart(2, '0');
		return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
	}

	/** Rentang tanggal efektif sesuai preset (custom = isi manual). */
	function effectiveRange(): { from?: string; to?: string } {
		if (preset === 'd7' || preset === 'd30') {
			const days = preset === 'd7' ? 6 : 29;
			const now = new Date();
			const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days);
			return { from: isoDay(start), to: isoDay(now) };
		}
		if (preset === 'custom') {
			return {
				...(isDay(fromInput) ? { from: fromInput } : {}),
				...(isDay(toInput) ? { to: toInput } : {})
			};
		}
		return {};
	}

	function isDay(v: string): boolean {
		return /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(new Date(`${v}T00:00:00Z`).getTime());
	}

	function effectiveCourseId(): number | undefined {
		if (!/^\d+$/.test(courseIdInput.trim())) return undefined;
		return Number(courseIdInput.trim());
	}

	async function load(): Promise<void> {
		const my = ++loadSeq;
		loading = true;
		loadError = '';
		try {
			const range = effectiveRange();
			const res = await fetchAdminReports({
				...range,
				courseId: effectiveCourseId(),
				limit: perPage,
				page
			});
			if (my !== loadSeq) return;
			data = res;
		} catch (e) {
			if (my !== loadSeq) return;
			data = null;
			loadError = e instanceof Error ? e.message : 'Gagal memuat laporan.';
		} finally {
			if (my === loadSeq) loading = false;
		}
	}

	$effect(() => {
		if (!browser || started) return;
		started = true;
		void load();
	});

	$effect(() => {
		if (!browser || !started) return;
		page;
		perPage;
		void load();
	});

	function setPreset(p: Exclude<Preset, 'custom'>): void {
		preset = p;
		page = 1;
		void load();
	}

	function applyCustom(): void {
		preset = 'custom';
		page = 1;
		void load();
	}

	function fmt(n: number): string {
		return Number(n || 0).toLocaleString('id-ID');
	}

	function formatIDR(n: number): string {
		return `Rp ${Number(n || 0).toLocaleString('id-ID')}`;
	}

	function formatPct(n: number): string {
		return `${Number(n || 0).toLocaleString('id-ID', { maximumFractionDigits: 1 })}%`;
	}

	const funnelStageColors = ['#1d4ed8', '#1e40af', '#2563eb', '#0f766e'];

	/** Indeks tahap dengan penurunan terbesar (selisih % dari awal antar tahap). */
	const biggestDropIndex = $derived.by(() => {
		const f = data?.insights?.funnel;
		if (!f || f.length < 2) return -1;
		let best = -1;
		let bestDrop = 0;
		for (let i = 1; i < f.length; i++) {
			const drop = f[i - 1].pctOfFirst - f[i].pctOfFirst;
			if (drop > bestDrop) {
				bestDrop = drop;
				best = i;
			}
		}
		return bestDrop > 0 ? best : -1;
	});

	const payTotal = $derived(
		(data?.summary.paymentsMenunggu ?? 0) +
			(data?.summary.paymentsDiverifikasi ?? 0) +
			(data?.summary.paymentsDitolak ?? 0)
	);

	const donutStyle = $derived.by(() => {
		if (!data || payTotal === 0) return 'background:#f1f5f9';
		const v = (data.summary.paymentsDiverifikasi / payTotal) * 100;
		const w = (data.summary.paymentsMenunggu / payTotal) * 100;
		return `background:conic-gradient(#059669 0 ${v}%,#f59e0b ${v}% ${v + w}%,#dc2626 ${v + w}% 100%)`;
	});

	const donutLabel = $derived.by(() => {
		if (!data) return 'Belum ada data pembayaran';
		if (payTotal === 0) return 'Belum ada pembayaran pada filter ini';
		return `${fmt(data.summary.paymentsDiverifikasi)} dari ${fmt(payTotal)} pembayaran diverifikasi`;
	});

	function courseStatusLabel(s: string): string {
		if (s === 'published') return 'Diterbitkan';
		if (s === 'draft') return 'Draf';
		if (s === 'archived') return 'Arsip';
		return s;
	}

	function courseStatusClass(s: string): string {
		if (s === 'published') return 'border-blue-200 bg-blue-50 text-blue-700';
		if (s === 'draft') return 'border-amber-200 bg-amber-50 text-amber-700';
		return 'border-slate-200 bg-slate-50 text-slate-600';
	}

	function csvCell(v: string | number): string {
		let s = String(v ?? '');
		// Anti formula-injection: sel spreadsheet mengeksekusi awalan = + - @.
		// Awalan kutip satu ditampilkan Excel sebagai penanda teks (tak terlihat).
		if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
		return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
	}

	/** Unduh CSV: ringkasan periode aktif + seluruh baris per kursus (maks. 100). */
	async function downloadCsv(): Promise<void> {
		if (csvBusy) return;
		csvBusy = true;
		csvError = '';
		try {
			const range = effectiveRange();
			// Ambil halaman penuh agar CSV tidak terpotong paginasi tabel.
			const full = await fetchAdminReports({
				...range,
				courseId: effectiveCourseId(),
				limit: 100,
				page: 1
			});
			const s = full.summary;
			const lines: string[] = ['bagian,metrik,nilai'];
			const row = (bagian: string, metrik: string, nilai: string | number): void => {
				lines.push(`${bagian},${metrik},${csvCell(nilai)}`);
			};
			row('ringkasan', 'totalStudents', s.totalStudents);
			row('ringkasan', 'totalTeachers', s.totalTeachers);
			row('ringkasan', 'totalCourses', s.totalCourses);
			row('ringkasan', 'totalCertificates', s.totalCertificates);
			row('ringkasan', 'activeEnrollments', s.activeEnrollments);
			row('ringkasan', 'completedEnrollments', s.completedEnrollments);
			row('keuangan', 'paymentsMenunggu', s.paymentsMenunggu);
			row('keuangan', 'paymentsDiverifikasi', s.paymentsDiverifikasi);
			row('keuangan', 'paymentsDitolak', s.paymentsDitolak);
			row('keuangan', 'revenueVerified', s.revenueVerified);
			row('keuangan', 'voucherRedemptions', s.voucherRedemptions);
			row('sertifikat', 'issued', full.certificates.issued);
			row('sertifikat', 'revoked', full.certificates.revoked);
			if (full.insights) {
				for (const f of full.insights.funnel) {
					lines.push(
						[
							'insight-funnel',
							csvCell(f.stage),
							csvCell(f.label),
							f.basis,
							f.count,
							f.pctOfFirst,
							f.pctOfPrev ?? ''
						].join(',')
					);
				}
				const r = full.insights.rates;
				row('insight-rates', 'paymentApproval', r.paymentApproval);
				row('insight-rates', 'paymentRejection', r.paymentRejection);
				row('insight-rates', 'enrollmentCompletion', r.enrollmentCompletion);
				row('insight-rates', 'certificatePerEnrollment', r.certificatePerEnrollment);
				row('insight-rates', 'enrollmentCertified', r.enrollmentCertified);
				row('insight-rates', 'certificateRevoke', r.certificateRevoke);
			}
			lines.push(
				'kursus,courseId,title,status,studentCount,avgProgress,pendingReviews,revenueVerified,paymentsMenunggu,paymentsDiverifikasi,certificatesIssued,certificatesRevoked'
			);
			for (const c of full.perCourse) {
				lines.push(
					[
						'kursus',
						c.courseId,
						csvCell(c.title),
						c.status,
						c.studentCount,
						c.avgProgress,
						c.pendingReviews,
						c.revenueVerified,
						c.paymentsMenunggu,
						c.paymentsDiverifikasi,
						c.certificatesIssued,
						c.certificatesRevoked
					].join(',')
				);
			}
			const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `laporan-admin-${range.from ?? 'semua'}-${range.to ?? 'semua'}.csv`;
			document.body.appendChild(a);
			a.click();
			a.remove();
			URL.revokeObjectURL(url);
		} catch (e) {
			csvError = e instanceof Error ? e.message : 'Gagal mengunduh CSV.';
		} finally {
			csvBusy = false;
		}
	}

	const rangeLabel = $derived.by(() => {
		if (!data) return '';
		const f = data.filters;
		if (f.from || f.to) return `${f.from ?? '…'} s.d. ${f.to ?? '…'}`;
		return 'Semua waktu';
	});

	const rateMeters = $derived.by(() => {
		if (!data?.insights) return [];
		const r = data.insights.rates;
		return [
			{ label: 'Persetujuan pembayaran', value: r.paymentApproval, tone: 'bg-emerald-500', text: 'text-emerald-700', meaning: 'Diverifikasi / seluruh pembayaran' },
			{ label: 'Penolakan pembayaran', value: r.paymentRejection, tone: 'bg-red-500', text: 'text-red-700', meaning: 'Ditolak / seluruh pembayaran' },
			{ label: 'Penyelesaian enrollment', value: r.enrollmentCompletion, tone: 'bg-blue-600', text: 'text-slate-800', meaning: 'Selesai / (aktif + selesai)' },
			{ label: 'Sertifikat per 100 enrollment', value: r.certificatePerEnrollment, tone: 'bg-blue-600', text: 'text-slate-800', meaning: 'Terbit / enrollment; bisa >100% karena sertifikat per modul' },
			{ label: 'Enrollment bersertifikat', value: r.enrollmentCertified, tone: 'bg-emerald-500', text: 'text-emerald-700', meaning: 'Pasangan peserta–kursus ber-sertifikat / enrollment (0–100%)' },
			{ label: 'Pencabutan sertifikat', value: r.certificateRevoke, tone: 'bg-slate-400', text: 'text-slate-800', meaning: 'Dicabut / (terbit + dicabut)' }
		];
	});
</script>

<svelte:head>
	<title>Laporan — Admin ARISTOTELES</title>
	<meta name="description" content="Laporan ringkasan, keuangan, dan per kursus platform ARISTOTELES." />
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="page-wrap page-stack">
	<PageHeader
		eyebrow="Admin · Laporan"
		title="Laporan Platform"
		description="Ringkasan, keuangan, dan kinerja per kursus dari data server — tanpa angka contoh. Progres rata-rata & antrean nilai adalah snapshot saat ini."
	/>

	<div class="flex flex-wrap items-center gap-2" role="group" aria-label="Filter periode laporan">
		{#each presets as p (p.value)}
			<button
				type="button"
				onclick={() => setPreset(p.value)}
				aria-pressed={preset === p.value}
				class={`rounded-xl px-4 py-2 text-xs font-bold transition-colors focus-visible:outline-2 focus-visible:outline-blue-600 ${
					preset === p.value
						? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
						: 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
				}`}
			>
				{p.label}
			</button>
		{/each}
		<label class="ml-1 inline-flex items-center gap-1.5 text-xs font-bold text-slate-600">
			Dari
			<input
				type="date"
				bind:value={fromInput}
				class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 focus-visible:outline-2 focus-visible:outline-blue-600"
			/>
		</label>
		<label class="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600">
			S.d.
			<input
				type="date"
				bind:value={toInput}
				class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 focus-visible:outline-2 focus-visible:outline-blue-600"
			/>
		</label>
		<label class="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600">
			Kursus ID
			<input
				type="text"
				inputmode="numeric"
				placeholder="opsional"
				bind:value={courseIdInput}
				class="w-28 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 focus-visible:outline-2 focus-visible:outline-blue-600"
			/>
		</label>
		<button
			type="button"
			onclick={applyCustom}
			class="rounded-xl bg-slate-800 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-slate-900 focus-visible:outline-2 focus-visible:outline-slate-800"
		>
			Terapkan
		</button>
		<button
			type="button"
			onclick={() => void downloadCsv()}
			disabled={csvBusy || data === null}
			class="inline-flex min-h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
		>
			<i class="fa-solid fa-download" aria-hidden="true"></i>
			{csvBusy ? 'Menyiapkan…' : 'Unduh CSV'}
		</button>
	</div>
	{#if csvError}
		<p role="alert" class="text-xs font-semibold text-red-600">{csvError}</p>
	{/if}

	{#if loading}
		<div class="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4" aria-label="Memuat laporan">
			{#each [1, 2, 3, 4, 5, 6, 7, 8] as i (i)}
				<div class="animate-pulse rounded-2xl border border-slate-200/60 bg-white p-5">
					<div class="mb-3 h-11 w-11 rounded-xl bg-slate-100"></div>
					<div class="h-7 w-20 rounded bg-slate-100"></div>
					<div class="mt-0.5 h-3 w-28 rounded bg-slate-100"></div>
				</div>
			{/each}
		</div>
	{:else if loadError}
		<div role="alert" class="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
			<p class="text-sm font-bold text-red-700">Laporan belum dapat dimuat</p>
			<p class="mx-auto mt-1 max-w-md text-xs text-red-600">{loadError}</p>
			<button
				type="button"
				onclick={() => void load()}
				class="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-red-600"
			>
				<i class="fa-solid fa-rotate-right" aria-hidden="true"></i> Coba lagi
			</button>
		</div>
	{:else if data}
		<p class="text-xs text-slate-500" role="status">
			Periode: <span class="font-bold text-slate-700">{rangeLabel}</span>
			{#if data.filters.courseId !== undefined}
				· Kursus ID <span class="font-bold text-slate-700">{data.filters.courseId}</span>
			{/if}
		</p>
		<div class="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
			<UiStatCard label="Total Peserta" value={fmt(data.summary.totalStudents)} sub="akun terdaftar" icon="fa-users" tone="blue" />
			<UiStatCard label="Instruktur" value={fmt(data.summary.totalTeachers)} sub="akun pengampu" icon="fa-chalkboard-user" tone="violet" />
			<UiStatCard label="Kursus" value={fmt(data.summary.totalCourses)} sub="termasuk draf & arsip" icon="fa-layer-group" tone="emerald" />
			<UiStatCard label="Sertifikat Terbit" value={fmt(data.summary.totalCertificates)} sub="status aktif" icon="fa-award" tone="amber" />
			<UiStatCard label="Enrollment Aktif" value={fmt(data.summary.activeEnrollments)} sub="periode filter" icon="fa-book-open" tone="blue" />
			<UiStatCard label="Enrollment Selesai" value={fmt(data.summary.completedEnrollments)} sub="periode filter" icon="fa-circle-check" tone="emerald" />
			<UiStatCard label="Pendapatan Diverifikasi" value={formatIDR(data.summary.revenueVerified)} sub={`${fmt(data.summary.paymentsDiverifikasi)} pembayaran`} icon="fa-money-bill-wave" tone="emerald" />
			<UiStatCard label="Voucher Ditukar" value={fmt(data.summary.voucherRedemptions)} sub="penukaran tercatat" icon="fa-ticket" tone="violet" />
		</div>

		{#if data.insights}
			<section aria-labelledby="h-alur" class="overflow-hidden rounded-2xl border border-slate-200/60 bg-white">
				<div class="border-b border-slate-100 p-6 pb-4">
					<h2 id="h-alur" class="text-lg font-bold text-slate-900">Alur konversi</h2>
					<p class="mt-0.5 text-xs text-slate-500">
						{data.insights.note} Lebar corong = proporsi terhadap tahap pertama.
					</p>
				</div>
				<div
					class="space-y-1 p-6"
					role="img"
					aria-label={`Corong konversi: ${data.insights.funnel.map((f) => `${f.label} ${fmt(f.count)} (${formatPct(f.pctOfFirst)} dari awal)`).join(', ')}`}
				>
					{#each data.insights.funnel as f, i (f.stage)}
						<div>
							<div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
								<p class="flex items-center gap-2 text-sm">
									<span
										class="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-[11px] font-bold text-white"
										aria-hidden="true">{i + 1}</span
									>
									<span class="font-bold text-slate-900">{f.label}</span>
									<span
										class={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${f.basis === 'snapshot' ? 'border-violet-200 bg-violet-50 text-violet-700' : 'border-blue-200 bg-blue-50 text-blue-700'}`}
									>
										{f.basis === 'snapshot' ? 'Snapshot' : 'Filter'}
									</span>
								</p>
								<p class="text-sm text-slate-600 tabular-nums">
									<span class="text-base font-extrabold text-slate-900">{fmt(f.count)}</span>
									<span class="mx-1.5 text-slate-300" aria-hidden="true">•</span>
									<span class="font-bold text-blue-700">{formatPct(f.pctOfFirst)}</span> dari awal
									<span class="mx-1.5 text-slate-300" aria-hidden="true">•</span>
									{#if f.pctOfPrev !== null}
										<span class="font-semibold">{formatPct(f.pctOfPrev)}</span> lanjut
									{:else if i > 0}
										<span class="font-semibold text-slate-400" title="Tak terdefinisi: tahap sebelumnya nol">—</span> lanjut
									{/if}
								</p>
							</div>
							<div class="mt-1.5 h-9 overflow-hidden rounded-lg bg-slate-100">
								<div
									class="flex h-full items-center justify-end rounded-lg px-3 transition-[width]"
									style={`width:${f.count > 0 ? Math.max(14, Math.min(100, f.pctOfFirst)) : 0}%;background:linear-gradient(90deg, ${funnelStageColors[i % funnelStageColors.length]}cc, ${funnelStageColors[i % funnelStageColors.length]})`}
								>
									{#if f.count > 0}
										<span class="text-xs font-bold whitespace-nowrap text-white tabular-nums">{fmt(f.count)}</span>
									{/if}
								</div>
							</div>
						</div>
						{#if i < data.insights.funnel.length - 1}
							<p class="flex items-center justify-center gap-2 py-0.5 text-xs text-slate-500">
								<i class="fa-solid fa-arrow-down" aria-hidden="true"></i>
								{#if biggestDropIndex === i + 1}
									<span class="rounded-full bg-amber-100 px-2.5 py-0.5 font-bold text-amber-800">penurunan terbesar</span>
								{:else}
									<span>lanjut ke tahap {i + 2}</span>
								{/if}
							</p>
						{/if}
					{/each}
				</div>
			</section>

			<section aria-labelledby="h-persen" class="overflow-hidden rounded-2xl border border-slate-200/60 bg-white">
				<div class="border-b border-slate-100 p-6 pb-4">
					<h2 id="h-persen" class="text-lg font-bold text-slate-900">Persentase kunci</h2>
					<p class="mt-0.5 text-xs text-slate-500">
						Seluruh rasio dihitung server dari periode filter yang sama (bukan angka contoh).
					</p>
				</div>
				<ul class="space-y-5 p-6">
					{#each rateMeters as m (m.label)}
						<li>
							<div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
								<p class="text-sm font-bold text-slate-900">{m.label}</p>
								<p class={`text-xl font-extrabold tabular-nums ${m.text}`}>{formatPct(m.value)}</p>
							</div>
							<div
								class="mt-1.5 h-2.5 overflow-hidden rounded-full bg-slate-100"
								role="img"
								aria-label={`${m.label}: ${formatPct(m.value)}`}
							>
								<div class={`h-full rounded-full ${m.tone}`} style={`width:${Math.min(100, m.value)}%`}></div>
							</div>
							<p class="mt-1 text-xs text-slate-500">{m.meaning}</p>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		<div class="grid gap-4 lg:grid-cols-2">
			<section aria-labelledby="h-keuangan" class="rounded-2xl border border-slate-200/60 bg-white p-6">
				<h2 id="h-keuangan" class="text-sm font-bold text-slate-900">Keuangan (periode filter)</h2>
				<p class="mt-1 text-2xl font-extrabold text-slate-900">{formatIDR(data.summary.revenueVerified)}</p>
				<p class="mt-1 text-xs text-slate-500">Pendapatan diverifikasi admin.</p>
				<div class="mt-4 flex items-center gap-4">
					<div
						class="relative h-28 w-28 shrink-0 rounded-full"
						style={donutStyle}
						role="img"
						aria-label={`Komposisi pembayaran: ${donutLabel}`}
					>
						<span class="absolute inset-4 flex items-center justify-center rounded-full bg-white text-center text-[11px] font-extrabold text-slate-800 tabular-nums">
							{payTotal === 0 ? '0' : formatPct((data.summary.paymentsDiverifikasi / payTotal) * 100)}
						</span>
					</div>
					<ul class="min-w-0 flex-1 space-y-2 text-sm">
						<li class="flex items-center justify-between gap-3">
							<span class="flex min-w-0 items-center gap-2 text-slate-600"><span class="h-2.5 w-2.5 shrink-0 rounded-full bg-amber-500" aria-hidden="true"></span>Menunggu verifikasi</span>
							<span class="font-bold text-amber-700 tabular-nums">{fmt(data.summary.paymentsMenunggu)}</span>
						</li>
						<li class="flex items-center justify-between gap-3">
							<span class="flex min-w-0 items-center gap-2 text-slate-600"><span class="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500" aria-hidden="true"></span>Diverifikasi</span>
							<span class="font-bold text-emerald-700 tabular-nums">{fmt(data.summary.paymentsDiverifikasi)}</span>
						</li>
						<li class="flex items-center justify-between gap-3">
							<span class="flex min-w-0 items-center gap-2 text-slate-600"><span class="h-2.5 w-2.5 shrink-0 rounded-full bg-red-500" aria-hidden="true"></span>Ditolak</span>
							<span class="font-bold text-red-700 tabular-nums">{fmt(data.summary.paymentsDitolak)}</span>
						</li>
					</ul>
				</div>
				<p class="mt-3 text-xs text-slate-500" role="status">{donutLabel}.</p>
			</section>
			<section aria-labelledby="h-sertifikat" class="rounded-2xl border border-slate-200/60 bg-white p-6">
				<h2 id="h-sertifikat" class="text-sm font-bold text-slate-900">Sertifikat (periode filter)</h2>
				<p class="mt-1 text-2xl font-extrabold text-slate-900">{fmt(data.certificates.issued)}</p>
				<p class="mt-1 text-xs text-slate-500">Sertifikat terbit pada periode ini.</p>
				<ul class="mt-4 space-y-2 text-sm">
					<li class="flex items-center justify-between gap-3">
						<span class="text-slate-600">Terbit</span>
						<span class="font-bold text-emerald-700">{fmt(data.certificates.issued)}</span>
					</li>
					<li class="flex items-center justify-between gap-3">
						<span class="text-slate-600">Dicabut</span>
						<span class="font-bold text-red-700">{fmt(data.certificates.revoked)}</span>
					</li>
				</ul>
			</section>
		</div>

		<section aria-labelledby="h-perkursus" class="overflow-hidden rounded-2xl border border-slate-200/60 bg-white">
			<div class="border-b border-slate-100 p-6 pb-4">
				<h2 id="h-perkursus" class="text-lg font-bold text-slate-900">Per kursus</h2>
				<p class="mt-0.5 text-xs text-slate-500">
					Progres rata-rata &amp; antrean nilai adalah snapshot saat ini, tidak terpengaruh filter tanggal.
				</p>
			</div>
			{#if data.perCourse.length === 0}
				<EmptyState
					icon="fa-chart-line"
					title="Belum ada kursus pada filter ini"
					description="Ubah periode atau hapus filter Kursus ID, lalu muat ulang."
				/>
			{:else}
				<!-- svelte-ignore a11y_no_noninteractive_tabindex -- scroll region keyboard: tabel lebar perlu tabindex 0 -->
				<div class="overflow-x-auto" tabindex="0" role="region" aria-label="Tabel kinerja per kursus, geser horizontal">
					<table class="w-full min-w-[880px] text-left text-sm">
						<caption class="sr-only">Kinerja per kursus: peserta, progres, antrean, pendapatan, pembayaran, sertifikat</caption>
						<thead>
							<tr class="border-b border-slate-100 text-xs text-slate-500">
								<th scope="col" class="px-6 py-3 font-bold">Kursus</th>
								<th scope="col" class="px-4 py-3 font-bold">Status</th>
								<th scope="col" class="px-4 py-3 text-right font-bold">Peserta</th>
								<th scope="col" class="px-4 py-3 text-right font-bold">Progres</th>
								<th scope="col" class="px-4 py-3 text-right font-bold">Antrean nilai</th>
								<th scope="col" class="px-4 py-3 text-right font-bold">Pendapatan</th>
								<th scope="col" class="px-4 py-3 text-right font-bold">Bayar <abbr title="Menunggu">M</abbr>/<abbr title="Disetujui">D</abbr></th>
								<th scope="col" class="px-4 py-3 text-right font-bold">Sertifikat <abbr title="Terbit">T</abbr>/<abbr title="Cabut">C</abbr></th>
							</tr>
						</thead>
						<tbody class="divide-y divide-slate-100">
							{#each data.perCourse as c (c.courseId)}
								<tr class="transition-colors hover:bg-slate-50">
									<td class="max-w-56 px-6 py-3.5">
										<span class="block truncate font-semibold text-slate-800" title={c.title}>{c.title}</span>
										<span class="block text-xs text-slate-400">ID {c.courseId}</span>
									</td>
									<td class="px-4 py-3.5">
										<span class={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${courseStatusClass(c.status)}`}>
											{courseStatusLabel(c.status)}
										</span>
									</td>
									<td class="px-4 py-3.5 text-right font-bold text-slate-800 tabular-nums">{fmt(c.studentCount)}</td>
									<td class="px-4 py-3.5 text-right text-slate-600 tabular-nums">{c.avgProgress}%</td>
									<td class="px-4 py-3.5 text-right text-slate-600 tabular-nums">{fmt(c.pendingReviews)}</td>
									<td class="px-4 py-3.5 text-right font-bold text-slate-800 tabular-nums">{formatIDR(c.revenueVerified)}</td>
									<td class="px-4 py-3.5 text-right text-slate-600 tabular-nums">{fmt(c.paymentsMenunggu)}/{fmt(c.paymentsDiverifikasi)}</td>
									<td class="px-4 py-3.5 text-right text-slate-600 tabular-nums">{fmt(c.certificatesIssued)}/{fmt(c.certificatesRevoked)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
				<Pagination bind:page bind:perPage totalItems={data.paging.total} itemLabel="kursus" id="laporan-rows" />
			{/if}
		</section>

		<section aria-labelledby="h-konversi" class="overflow-hidden rounded-2xl border border-slate-200/60 bg-white">
			<div class="border-b border-slate-100 p-6 pb-4">
				<h2 id="h-konversi" class="text-lg font-bold text-slate-900">Konversi per kursus</h2>
				<p class="mt-0.5 text-xs text-slate-500">
					Bar per kursus pada halaman ini; "—" berarti belum ada data penyebut pada periode ini.
				</p>
				<p class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-slate-600" aria-label="Legenda">
					<span class="flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-full bg-emerald-500" aria-hidden="true"></span>Sertifikat/peserta</span>
					<span class="flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-full bg-blue-600" aria-hidden="true"></span>Bayar disetujui</span>
				</p>
			</div>
			{#if data.perCourse.length === 0}
				<EmptyState
					icon="fa-percent"
					title="Belum ada kursus pada filter ini"
					description="Ubah periode atau hapus filter Kursus ID, lalu muat ulang."
				/>
			{:else}
				<ul class="space-y-5 p-6">
					{#each data.perCourse as c (c.courseId)}
						{@const payTotal = c.paymentsMenunggu + c.paymentsDiverifikasi + (c.paymentsDitolak ?? 0)}
						{@const certRate = c.studentCount > 0 ? (c.certificatesIssued / c.studentCount) * 100 : null}
						{@const payRate = payTotal > 0 ? (c.paymentsDiverifikasi / payTotal) * 100 : null}
						<li>
							<div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
								<p class="min-w-0 truncate text-sm font-bold text-slate-900" title={`${c.title} (ID ${c.courseId})`}>
									{c.title} <span class="font-normal text-slate-400">ID {c.courseId}</span>
								</p>
								<p class="text-xs font-semibold text-slate-500 tabular-nums">
									{c.studentCount > 0 ? `${formatIDR(Math.round(c.revenueVerified / c.studentCount))}/peserta` : '—'}
								</p>
							</div>
							<div class="mt-2 space-y-1.5">
								<div class="flex items-center gap-3">
									<span class="w-32 shrink-0 truncate text-xs text-slate-500">Sertifikat/peserta</span>
									{#if certRate === null}
										<span class="text-xs font-semibold text-slate-400">—</span>
									{:else}
										<div class="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`${c.title}: sertifikat per peserta ${formatPct(certRate)}`}>
											<div class="h-full rounded-full bg-emerald-500" style={`width:${Math.min(100, certRate)}%`}></div>
										</div>
										<span class="w-14 shrink-0 text-right text-xs font-bold text-slate-800 tabular-nums">{formatPct(certRate)}</span>
									{/if}
								</div>
								<div class="flex items-center gap-3">
									<span class="w-32 shrink-0 truncate text-xs text-slate-500">Bayar disetujui</span>
									{#if payRate === null}
										<span class="text-xs font-semibold text-slate-400">—</span>
									{:else}
										<div class="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`${c.title}: pembayaran disetujui ${formatPct(payRate)}`}>
											<div class="h-full rounded-full bg-blue-600" style={`width:${Math.min(100, payRate)}%`}></div>
										</div>
										<span class="w-14 shrink-0 text-right text-xs font-bold text-slate-800 tabular-nums">{formatPct(payRate)}</span>
									{/if}
								</div>
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	{/if}
</div>
