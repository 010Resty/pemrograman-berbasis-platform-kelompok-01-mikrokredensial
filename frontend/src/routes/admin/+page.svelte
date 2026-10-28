<script lang="ts">
	import { browser } from '$app/environment';
	import FeatureFlowCard, { type FeatureFlow } from '$lib/components/FeatureFlowCard.svelte';
	import { getCurrentUser } from '$lib/stores/auth.svelte';
	import {
		fetchAdminOverview,
		fetchRecentCourses,
		fetchRecentUsers,
		type AdminOverview,
		type AdminUser
	} from '$lib/api/admin';
	import type { BackendCourse } from '$lib/api/courses';

	interface Stat {
		label: string;
		value: string;
		change: string;
		icon: string;
		color: string;
		bg: string;
	}

	const session = $derived(getCurrentUser());
	const firstName = $derived(session?.name.trim().split(/\s+/)[0] ?? 'Admin');

	let overview = $state<AdminOverview | null>(null);
	let recentUsers = $state<AdminUser[]>([]);
	let recentCourses = $state<BackendCourse[]>([]);
	let loading = $state(true);
	let loadError = $state('');
	let started = false;
	let loadSeq = 0;

	/** Ringkasan + daftar terbaru admin, paralel sekali saat mount. */
	async function load(): Promise<void> {
		const my = ++loadSeq;
		loading = true;
		loadError = '';
		try {
			const [ov, users, courses] = await Promise.all([
				fetchAdminOverview(),
				fetchRecentUsers(4),
				fetchRecentCourses(4)
			]);
			if (my !== loadSeq) return;
			overview = ov;
			recentUsers = users;
			recentCourses = courses;
		} catch (e) {
			if (my !== loadSeq) return;
			loadError = e instanceof Error ? e.message : 'Gagal memuat dasbor.';
		} finally {
			if (my === loadSeq) loading = false;
		}
	}

	$effect(() => {
		if (!browser || started) return;
		started = true;
		void load();
	});

	function fmt(n: number): string {
		return n.toLocaleString('id-ID');
	}

	function roleLabel(role: string): string {
		if (role === 'teacher') return 'Instruktur';
		if (role === 'admin') return 'Administrator';
		return 'Mahasiswa';
	}

	/** Label tampil untuk status kursus backend (published|draft|archived). */
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

	function instructorName(c: BackendCourse): string {
		return c.instructors?.[0]?.name ?? 'Belum ada pengampu';
	}

	function startMonthLabel(c: BackendCourse): string {
		if (c.period === 'upcoming') return ` · Mulai ${c.startMonth ?? 'segera'}`;
		return '';
	}

	const stats = $derived<Stat[]>([
		{ label: 'Total Peserta', value: fmt(overview?.totalStudents ?? 0), change: 'akun terdaftar', icon: 'fa-users', color: 'text-blue-600', bg: 'bg-blue-50' },
		{ label: 'Instruktur', value: fmt(overview?.totalTeachers ?? 0), change: 'akun pengampu', icon: 'fa-chalkboard-user', color: 'text-violet-600', bg: 'bg-violet-50' },
		{ label: 'Kursus', value: fmt(overview?.totalCourses ?? 0), change: 'termasuk draft & arsip', icon: 'fa-layer-group', color: 'text-emerald-600', bg: 'bg-emerald-50' },
		{ label: 'Sertifikat Terbit', value: fmt(overview?.totalCertificates ?? 0), change: 'status aktif', icon: 'fa-award', color: 'text-amber-600', bg: 'bg-amber-50' }
	]);

	const flows: FeatureFlow[] = [
		{
			icon: 'fa-envelope-open-text',
			tile: 'bg-violet-50 text-violet-600',
			title: 'Tambah Instruktur via Undangan',
			description: 'Alur mengundang calon instruktur hingga akunnya siap dipakai.',
			ctaLabel: 'Kelola Undangan',
			href: '/admin/invitations',
			ctaClass: 'bg-violet-600 hover:bg-violet-700 focus-visible:outline-violet-600 shadow-violet-600/25',
			steps: [
				{
					title: 'Admin membuat undangan',
					detail: 'Isi nama, email, dan catatan calon instruktur di halaman Undangan; status awal Menunggu.',
					color: 'bg-violet-600 ring-violet-200'
				},
				{
					title: 'Tautan dikirim via email',
					detail: 'Tautan aktivasi /invite/[token] dikirim otomatis ke email calon instruktur.',
					color: 'bg-indigo-600 ring-indigo-200'
				},
				{
					title: 'Instruktur membuka tautan',
					detail: 'Calon instruktur membuka halaman aktivasi dan membuat kata sandi baru.',
					color: 'bg-blue-600 ring-blue-200'
				},
				{
					title: 'Token ditandai terpakai',
					detail: 'Setiap undangan hanya berlaku satu kali; status berubah menjadi Diterima.',
					color: 'bg-cyan-600 ring-cyan-200'
				},
				{
					title: 'Admin memantau & mengelola',
					detail: 'Kirim ulang undangan yang Menunggu, atau batalkan undangan yang salah alamat.',
					color: 'bg-emerald-600 ring-emerald-200'
				}
			]
		},
		{
			icon: 'fa-ticket',
			tile: 'bg-orange-50 text-orange-600',
			title: 'Tambah Voucher',
			description: 'Alur membuat kode voucher hingga dipakai peserta untuk kursus gratis.',
			ctaLabel: 'Kelola Voucher',
			href: '/admin/vouchers',
			ctaClass: 'bg-orange-600 hover:bg-orange-700 focus-visible:outline-orange-600 shadow-orange-600/25',
			steps: [
				{
					title: 'Admin membuat voucher',
					detail: 'Pilih Personal/Umum, kursus tujuan, batas pakai, dan kedaluwarsa; kode ARISTO-… terbit dengan status Aktif.',
					color: 'bg-amber-600 ring-amber-200'
				},
				{
					title: 'Admin membagikan kode',
					detail: 'Salin kode voucher dan sampaikan ke peserta yang berhak.',
					color: 'bg-orange-500 ring-orange-200'
				},
				{
					title: 'Peserta menukarkan kode',
					detail: 'Peserta memasukkan kode di halaman Kursusku → formulir Tukar.',
					color: 'bg-orange-600 ring-orange-200'
				},
				{
					title: 'Sistem memvalidasi kode',
					detail: 'Dicek kecocokan kode, riwayat tukar, sisa kuota, dan masa berlaku.',
					color: 'bg-rose-500 ring-rose-200'
				},
				{
					title: 'Akses kursus terbuka',
					detail: 'Peserta mendapat kursus tujuan; setiap pemakaian tercatat di riwayat.',
					color: 'bg-rose-600 ring-rose-200'
				},
				{
					title: 'Admin memantau & membatalkan',
					detail: 'Lihat riwayat penukaran tiap voucher dan batalkan bila diperlukan.',
					color: 'bg-emerald-600 ring-emerald-200'
				}
			]
		}
	];
</script>

<svelte:head>
	<title>Dasbor Admin — Aristoteles Platform</title>
	<meta name="description" content="Dasbor admin Aristoteles untuk mengelola peserta, instruktur, dan kursus." />
</svelte:head>

<div class="p-4 sm:p-6 lg:p-8">
	<div class="mb-8">
		<p class="text-xs font-bold tracking-widest text-blue-600 uppercase">Admin · Dasbor</p>
		<h1 class="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
			Selamat Datang, {firstName}!
		</h1>
		<p class="mt-1 text-sm text-slate-500">Ringkasan aktivitas platform mikrokredensial hari ini.</p>
	</div>

	{#if loading}
		<div class="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4" aria-label="Memuat ringkasan">
			{#each [1, 2, 3, 4] as i (i)}
				<div class="animate-pulse rounded-2xl border border-slate-200/60 bg-white p-5">
					<div class="mb-3 h-11 w-11 rounded-xl bg-slate-100"></div>
					<div class="h-7 w-20 rounded bg-slate-100"></div>
					<div class="mt-0.5 h-3 w-28 rounded bg-slate-100"></div>
				</div>
			{/each}
		</div>
		<div class="grid gap-6 lg:grid-cols-2" aria-label="Memuat daftar">
			{#each [1, 2] as i (i)}
				<div class="animate-pulse rounded-2xl border border-slate-200/60 bg-white p-6">
					<div class="mb-4 h-5 w-40 rounded bg-slate-100"></div>
					<div class="space-y-3">
						<div class="h-4 rounded bg-slate-100"></div>
						<div class="h-4 rounded bg-slate-100"></div>
						<div class="h-4 rounded bg-slate-100"></div>
					</div>
				</div>
			{/each}
		</div>
	{:else if loadError}
		<div role="alert" class="mb-6 rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
			<p class="text-sm font-bold text-red-700">Dasbor belum dapat dimuat</p>
			<p class="mx-auto mt-1 max-w-md text-xs text-red-600">{loadError}</p>
			<button
				type="button"
				onclick={() => void load()}
				class="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-red-600"
			>
				<i class="fa-solid fa-rotate-right" aria-hidden="true"></i> Coba lagi
			</button>
		</div>
	{:else}
	<div class="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
		{#each stats as s (s.label)}
			<div class="rounded-2xl border border-slate-200/60 bg-white p-5 transition-shadow hover:shadow-lg">
				<div class="mb-3 flex h-11 w-11 items-center justify-center rounded-xl {s.bg}">
					<i class="fa-solid {s.icon} {s.color} text-lg" aria-hidden="true"></i>
				</div>
				<div class="text-2xl font-bold text-slate-900">{s.value}</div>
				<div class="mt-0.5 text-xs font-medium text-slate-500">{s.label}</div>
				<div class="mt-1 text-[11px] font-semibold text-emerald-600">{s.change}</div>
			</div>
		{/each}
	</div>

	<div class="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
		<a href="/admin/peserta" class="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-xs font-bold text-white shadow-lg shadow-blue-600/25 transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600">
			<i class="fa-solid fa-user-plus" aria-hidden="true"></i> Tambah Peserta
		</a>
		<a href="/admin/invitations" class="flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-xs font-bold text-white shadow-lg shadow-violet-600/25 transition-colors hover:bg-violet-700 focus-visible:outline-2 focus-visible:outline-violet-600">
			<i class="fa-solid fa-envelope-open-text" aria-hidden="true"></i> Undang Instruktur
		</a>
		<a href="/admin/courses" class="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-xs font-bold text-white shadow-lg shadow-emerald-600/25 transition-colors hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-emerald-600">
			<i class="fa-solid fa-plus" aria-hidden="true"></i> Buat Kursus
		</a>
		<a
			href="/segera-hadir?fitur=Laporan"
			class="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-slate-500"
		>
			<i class="fa-solid fa-chart-line" aria-hidden="true"></i> Lihat Laporan
		</a>
	</div>

	<section aria-labelledby="h-panduan" class="mb-6">
		<div class="mb-4">
			<h2 id="h-panduan" class="text-lg font-bold text-slate-900">Panduan Fitur Admin</h2>
			<p class="mt-0.5 text-sm text-slate-500">
				Klik tiap fitur untuk melihat alur langkahnya — dari tindakan admin hingga sampai ke penerima.
			</p>
		</div>
		<FeatureFlowCard {flows} />
	</section>

	<div class="grid gap-6 lg:grid-cols-2">
		<section aria-labelledby="h-users" class="overflow-hidden rounded-2xl border border-slate-200/60 bg-white">
			<div class="flex items-center justify-between p-6 pb-4">
				<h2 id="h-users" class="text-lg font-bold text-slate-900">Peserta Terbaru</h2>
				<a href="/admin/peserta" class="text-sm font-semibold text-blue-600 hover:text-blue-700">Lihat Semua</a>
			</div>
			<ul class="divide-y divide-slate-100">
				{#if recentUsers.length === 0}
					<li class="px-6 py-6 text-center text-xs text-slate-500">Belum ada pengguna terdaftar.</li>
				{:else}
				{#each recentUsers as u (u.id)}
					<li class="flex items-center gap-3 px-6 py-3.5">
						<span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600" aria-hidden="true">
							{u.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}
						</span>
						<span class="min-w-0 flex-1">
							<span class="block truncate text-sm font-semibold text-slate-800">{u.name}</span>
							<span class="block truncate text-xs text-slate-500">{u.email} · {roleLabel(u.role)}</span>
						</span>
						<span class={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${u.isActive ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
							{u.isActive ? 'Aktif' : 'Nonaktif'}
						</span>
					</li>
				{/each}
				{/if}
			</ul>
		</section>

		<section aria-labelledby="h-courses" class="overflow-hidden rounded-2xl border border-slate-200/60 bg-white">
			<div class="flex items-center justify-between p-6 pb-4">
				<h2 id="h-courses" class="text-lg font-bold text-slate-900">Kursus Terbaru</h2>
				<a href="/admin/courses" class="text-sm font-semibold text-blue-600 hover:text-blue-700">Kelola</a>
			</div>
			<ul class="divide-y divide-slate-100">
				{#if recentCourses.length === 0}
					<li class="px-6 py-6 text-center text-xs text-slate-500">Belum ada kursus di platform.</li>
				{:else}
				{#each recentCourses as c (c.id)}
					<li class="px-6 py-3.5">
						<div class="flex items-center justify-between gap-3">
							<span class="min-w-0 flex-1">
								<span class="block truncate text-sm font-semibold text-slate-800">{c.title}</span>
								<span class="block text-xs text-slate-500">{instructorName(c)}{startMonthLabel(c)}</span>
							</span>
							<span class={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${courseStatusClass(c.status)}`}>
								{courseStatusLabel(c.status)}
							</span>
						</div>
					</li>
				{/each}
				{/if}
			</ul>
		</section>
	</div>
	{/if}
</div>
