<script lang="ts">
	import { page } from '$app/state';

	interface EnrolledCourse {
		id: number;
		title: string;
		progress: number;
		status: string;
		/** Nilai akhir kursus 0–100 (mock lokal). Null bila belum ada nilai. */
		score: number | null;
	}

	interface ParticipantDetail {
		id: number;
		name: string;
		email: string;
		status: 'Aktif' | 'Nonaktif';
		joined: string;
		lastActive: string;
		courses: EnrolledCourse[];
		certificates: number;
	}

	const DIRECTORY: ParticipantDetail[] = [
		{
			id: 1,
			name: 'Ahmad Farizi',
			email: 'ahmad@student.ac.id',
			status: 'Aktif',
			joined: '12 Jan 2026',
			lastActive: 'Hari ini',
			certificates: 2,
			courses: [
				{ id: 1, title: 'Pengembangan Web Frontend', progress: 75, status: 'Berjalan', score: 82 },
				{ id: 2, title: 'Basis Data & SQL', progress: 100, status: 'Selesai', score: 95 },
				{ id: 5, title: 'Machine Learning Dasar', progress: 30, status: 'Berjalan', score: 84 }
			]
		},
		{
			id: 2,
			name: 'Sarah Johnson',
			email: 'sarah@student.ac.id',
			status: 'Aktif',
			joined: '28 Feb 2026',
			lastActive: 'Kemarin',
			certificates: 1,
			courses: [
				{ id: 2, title: 'Basis Data & SQL', progress: 60, status: 'Berjalan', score: 93 },
				{ id: 8, title: 'Analitik Data & Dashboard', progress: 20, status: 'Berjalan', score: 89 }
			]
		},
		{
			id: 3,
			name: 'Rian Pratama',
			email: 'rian@student.ac.id',
			status: 'Aktif',
			joined: '05 Mar 2026',
			lastActive: '2 hari lalu',
			certificates: 0,
			courses: [{ id: 4, title: 'Keamanan Siber', progress: 0, status: 'Belum mulai', score: 78 }]
		},
		{
			id: 6,
			name: 'Dewi Lestari',
			email: 'dewi@student.ac.id',
			status: 'Nonaktif',
			joined: '02 Feb 2026',
			lastActive: '2 minggu lalu',
			certificates: 0,
			courses: [{ id: 3, title: 'Jaringan Komputer Dasar', progress: 10, status: 'Berjalan', score: null }]
		}
	];

	const pesertaId = $derived(Number(page.params.pesertaId));
	const peserta = $derived(DIRECTORY.find((u) => u.id === pesertaId));

	/** Rata-rata dari nilai per kursus yang sudah ada (abaikan null). */
	const averageScore = $derived.by(() => {
		if (!peserta) return null;
		const done = peserta.courses.map((c) => c.score).filter((s) => s !== null);
		if (done.length === 0) return null;
		return Math.round(done.reduce((n, s) => n + s, 0) / done.length);
	});

	function scoreClass(score: number | null) {
		if (score === null) return 'bg-slate-100 text-slate-400';
		if (score >= 85) return 'bg-emerald-50 text-emerald-700';
		if (score >= 70) return 'bg-blue-50 text-blue-700';
		return 'bg-amber-50 text-amber-700';
	}

	let toast = $state('');

	function flash(message: string) {
		toast = message;
		setTimeout(() => (toast = ''), 2500);
	}

	function statusClass(s: ParticipantDetail['status']) {
		if (s === 'Aktif') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
		return 'border-slate-200 bg-slate-100 text-slate-600';
	}
</script>

<svelte:head>
	<title>
		{peserta ? `${peserta.name} — Detail Peserta` : 'Peserta tidak ditemukan'} — Admin Aristoteles
	</title>
	<meta name="description" content="Detail peserta platform Aristoteles." />
</svelte:head>

<div class="p-4 sm:p-6 lg:p-8">
	{#if !peserta}
		<div class="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-10 text-center">
			<i class="fa-solid fa-triangle-exclamation mb-3 text-3xl text-amber-500" aria-hidden="true"></i>
			<h1 class="text-xl font-bold text-slate-900">Peserta tidak ditemukan</h1>
			<p class="mt-1 text-sm text-slate-500">
				ID peserta “{page.params.pesertaId}” tidak terdaftar.
			</p>
			<a
				href="/admin/peserta"
				class="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
			>
				<i class="fa-solid fa-arrow-left" aria-hidden="true"></i> Kembali ke Peserta
			</a>
		</div>
	{:else}
		<nav aria-label="Navigasi remah roti" class="mb-4 flex items-center gap-2 text-xs text-slate-500">
			<a href="/admin/peserta" class="rounded font-semibold text-blue-600 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600">Peserta</a>
			<i class="fa-solid fa-chevron-right text-[10px] text-slate-300" aria-hidden="true"></i>
			<span aria-current="page" class="truncate font-medium text-slate-700">{peserta.name}</span>
		</nav>

		{#if toast}
			<p
				role="status"
				class="mb-4 flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs font-semibold text-blue-800"
			>
				<i class="fa-solid fa-circle-info mt-0.5 shrink-0" aria-hidden="true"></i>
				<span>{toast}</span>
			</p>
		{/if}

		<header class="mb-6 overflow-hidden rounded-2xl border border-slate-200/70 bg-white">
			<div class="h-24 bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-800" aria-hidden="true"></div>
			<div class="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
				<span
					class="-mt-12 flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border-4 border-white bg-blue-50 text-xl font-extrabold text-blue-700 shadow-lg sm:-mt-14"
					aria-hidden="true"
				>
					{peserta.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}
				</span>
				<div class="min-w-0 flex-1">
					<div class="flex flex-wrap items-center gap-2">
						<h1 class="text-xl font-extrabold text-slate-900 sm:text-2xl">{peserta.name}</h1>
						<span class={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${statusClass(peserta.status)}`}>
							<span class="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true"></span>{peserta.status}
						</span>
					</div>
					<p class="mt-0.5 text-sm text-slate-500">{peserta.email} · Peserta</p>
					<p class="mt-1 text-[11px] text-slate-400">
						Bergabung {peserta.joined} · Terakhir aktif {peserta.lastActive}
					</p>
				</div>
				<div class="flex flex-wrap gap-2">
					<button
						type="button"
						disabled
						title="Reset sandi membutuhkan backend — segera hadir"
						aria-disabled="true"
						class="inline-flex min-h-[44px] cursor-not-allowed items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-400"
					>
						<i class="fa-solid fa-key" aria-hidden="true"></i> Reset Sandi
					</button>
					<button
						type="button"
						onclick={() =>
							flash(
								'Ubah status akun membutuhkan backend. Gunakan halaman ini hanya untuk melihat data (demo).'
							)}
						class="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-slate-500"
					>
						<i class="fa-solid fa-pen" aria-hidden="true"></i> Ubah Status
					</button>
				</div>
			</div>
			<dl class="grid grid-cols-2 divide-x divide-slate-100 border-t border-slate-100 text-center sm:grid-cols-4">
				<div class="p-4">
					<dt class="text-[10px] font-bold tracking-widest text-slate-400 uppercase">Kursus</dt>
					<dd class="mt-0.5 text-xl font-extrabold text-slate-900 tabular-nums">{peserta.courses.length}</dd>
				</div>
				<div class="p-4">
					<dt class="text-[10px] font-bold tracking-widest text-slate-400 uppercase">Nilai rata-rata</dt>
					<dd class="mt-0.5 text-xl font-extrabold tabular-nums {averageScore === null ? 'text-slate-400' : 'text-emerald-700'}">
						{averageScore ?? '—'}
					</dd>
				</div>
				<div class="p-4">
					<dt class="text-[10px] font-bold tracking-widest text-slate-400 uppercase">Sertifikat</dt>
					<dd class="mt-0.1 text-xl font-extrabold text-amber-600 tabular-nums">{peserta.certificates}</dd>
				</div>
				<div class="p-4">
					<dt class="text-[10px] font-bold tracking-widest text-slate-400 uppercase">Rata-rata progres</dt>
					<dd class="mt-0.5 text-xl font-extrabold text-blue-700 tabular-nums">
						{peserta.courses.length > 0 ? Math.round(peserta.courses.reduce((n, c) => n + c.progress, 0) / peserta.courses.length) : 0}%
					</dd>
				</div>
			</dl>
		</header>

		<section
			aria-labelledby="peserta-kursus"
			class="overflow-hidden rounded-2xl border border-slate-200/70 bg-white"
		>
			<div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 p-5 pb-3">
				<h2 id="peserta-kursus" class="text-lg font-bold text-slate-900">Kursus yang diikuti</h2>
				<p class="text-[11px] text-slate-400">Nilai simulasi lokal (simulasi), bukan dari backend.</p>
			</div>
			<ul class="divide-y divide-slate-100">
				{#each peserta.courses as c (c.id)}
					<li class="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 transition-colors hover:bg-blue-50/40">
						<div class="min-w-0 flex-1 basis-48">
							<p class="truncate text-sm font-bold text-slate-900">{c.title}</p>
							<div
								class="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100"
								role="progressbar"
								aria-valuenow={c.progress}
								aria-valuemin={0}
								aria-valuemax={100}
								aria-label={`Progres ${c.title}`}
							>
								<div class="h-full rounded-full bg-blue-500" style="width: {c.progress}%"></div>
							</div>
						</div>
						<span class="w-12 shrink-0 text-right text-xs font-bold text-slate-600 tabular-nums">{c.progress}%</span>
						<span
							class="hidden shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600 sm:inline-block"
						>
							{c.status}
						</span>
						<span
							class={`inline-flex min-w-16 shrink-0 flex-col items-center rounded-xl px-2.5 py-1 leading-tight ${scoreClass(c.score)}`}
							aria-label={c.score === null ? `Nilai ${c.title}: belum ada` : `Nilai ${c.title}: ${c.score}`}
						>
							<span class="text-[10px] font-bold tracking-widest uppercase opacity-70">Nilai</span>
							<span class="text-sm font-extrabold tabular-nums">{c.score ?? '—'}</span>
						</span>
					</li>
				{/each}
			</ul>
		</section>

		<div class="mt-6">
			<a
				href="/admin/peserta"
				class="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-slate-500"
			>
				<i class="fa-solid fa-arrow-left" aria-hidden="true"></i> Kembali ke Peserta
			</a>
		</div>
	{/if}
</div>
