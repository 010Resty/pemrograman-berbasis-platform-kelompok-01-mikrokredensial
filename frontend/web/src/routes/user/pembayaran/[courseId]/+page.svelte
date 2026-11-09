<script lang="ts">
	import { browser } from '$app/environment';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { env } from '$env/dynamic/public';
	import { getCourseById } from '$lib/data/courses';
	import { getCourseMeta } from '$lib/data/course-meta';
	import { getTrainingStats } from '$lib/data/training';
	import { formatIDR, parsePrice } from '$lib/data/payment';
	import { canAccessCourse, isCoursePaid, syncEnrollmentsFromServer } from '$lib/stores/enrollment.svelte';
	import { fetchCourseAccess } from '$lib/api/courses';
	import { getAccessToken, getCurrentUser } from '$lib/stores/auth.svelte';
	import {
		attachPaymentProof,
		createPayment,
		fetchMyPayment,
		validateDiscountVoucher,
		type MyPayment
	} from '$lib/api/payments';
	import { fetchCoursePromo, type CoursePromoQuote } from '$lib/api/promos';

	const courseId = $derived(Number(page.params.courseId));
	const course = $derived(getCourseById(courseId));
	const meta = $derived(course ? getCourseMeta(course.id) : undefined);
	const stats = $derived(course ? getTrainingStats(course) : undefined);

	/** QRIS statis platform (dikonfigurasi via env `PUBLIC_QRIS_IMAGE_URL`). */
	const qrisUrl = (env.PUBLIC_QRIS_IMAGE_URL ?? '').trim();

	type Stage = 'checkout' | 'instruction' | 'verifying' | 'success';
	let stage = $state<Stage>('checkout');

	// Data peserta (terisi otomatis dari sesi login — WCAG 3.3.7 hindari entri berulang)
	const me = getCurrentUser();
	let fullName = $state(me?.name ?? '');
	let email = $state(me?.email ?? '');
	let nim = $state('');

	// Voucher diskon (divalidasi di backend, tidak menghanguskan sebelum bayar disetujui)
	let voucherCode = $state('');
	let appliedVoucher = $state<{ code: string; discountAmount: number } | null>(null);
	let applyingVoucher = $state(false);
	let voucherError = $state('');

	// Promo admin percent-only (server = kebenaran; terbesar vs voucher yang menang)
	let promoQuote = $state<CoursePromoQuote | null>(null);
	let agree = $state(false);
	let formError = $state('');
	let copied = $state('');

	// Pengajuan pembayaran aktif (server sebagai sumber kebenaran)
	let payment = $state<MyPayment | null>(null);
	let creatingPayment = $state(false);
	let lastRejection = $state<{ reason: string } | null>(null);

	// Bukti bayar (gambar saja, maks 5 MB — sesuai backend)
	let proofFile = $state<File | null>(null);
	let proofPreview = $state<string | null>(null);
	let uploadingProof = $state(false);
	let proofError = $state('');
	let pollTimer: ReturnType<typeof setInterval> | null = null;

	// Status akses menurut server — null = belum diperiksa.
	let serverAccess = $state<boolean | null>(null);
	let accessChecking = $state(false);

	let headingEl = $state<HTMLElement | null>(null);

	const price = $derived(meta ? parsePrice(meta.price) : 0);
	const voucherDiscount = $derived(appliedVoucher?.discountAmount ?? 0);
	const promoDiscount = $derived(
		promoQuote ? Math.min(price, Math.floor((price * promoQuote.discountPercent) / 100)) : 0
	);
	/** Non-stack: promo vs voucher, terbesar menang (sama seperti server). */
	const promoWins = $derived(promoDiscount > 0 && promoDiscount >= voucherDiscount);
	const discount = $derived(Math.max(voucherDiscount, promoDiscount));
	const total = $derived(Math.max(0, price - discount));
	/** Total otoritatif: pakai server setelah antrean dibuat (mencerminkan promo/voucher pemenang). */
	const displayTotal = $derived(payment ? payment.amountExpected : total);
	const paid = $derived(course ? canAccessCourse(course.id) : false);
	const isPaidCourse = $derived(course ? isCoursePaid(course.id) : false);
	const invoice = $derived(payment?.invoice ?? '');
	/** Waktu pembayaran: verifikasi admin bila sudah lunas, sonst pengajuan. */
	const paidAt = $derived(
		(payment?.verifiedAt ?? payment?.createdAt)
			? new Date((payment?.verifiedAt ?? payment?.createdAt) as string).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
			: ''
	);
	/** Harga & diskon otoritatif dari server setelah antrean dibuat. */
	const serverPrice = $derived(payment ? payment.amountExpected + payment.discountAmount : price);
	const serverDiscount = $derived(payment ? payment.discountAmount : discount);
	const nimLabel = $derived(nim.trim() ? `NIM ${nim.trim()}` : '');

	const canPay = $derived(
		!!course && !!meta && isPaidCourse && !paid && agree && !creatingPayment && meta.period !== 'ended'
	);

	$effect(() => {
		if (stage === 'instruction' || stage === 'success') headingEl?.focus();
	});

	// Muat status pembayaran + promo kursus yang sedang berjalan.
	let started = false;
	$effect(() => {
		if (!browser || started || !course) return;
		started = true;
		void restorePayment();
		void fetchCoursePromo(course.id).then((q) => {
			promoQuote = q;
		});
	});

	async function restorePayment(): Promise<void> {
		try {
			const existing = await fetchMyPayment(courseId);
			if (!existing) return;
			payment = existing;
			if (existing.voucherCode && !appliedVoucher) {
				appliedVoucher = { code: existing.voucherCode, discountAmount: existing.discountAmount };
			}
			if (existing.status === 'diverifikasi') {
				stage = 'success';
				void refreshServerAccess();
			} else if (existing.status === 'ditolak') {
				lastRejection = { reason: existing.rejectReason ?? 'Pengajuan ditolak.' };
				payment = null;
				stage = 'checkout';
			} else {
				stage = existing.proofFileId ? 'verifying' : 'instruction';
				if (existing.proofFileId) startPolling();
			}
		} catch {
			// Abaikan: pengguna mulai dari checkout seperti biasa.
		}
	}

	async function refreshServerAccess(): Promise<void> {
		if (!course || accessChecking) return;
		accessChecking = true;
		try {
			await syncEnrollmentsFromServer();
			const access = await fetchCourseAccess(course.id).catch(() => null);
			serverAccess = access !== null && (access.hasAccess || access.isManager);
		} catch {
			serverAccess = null;
		} finally {
			accessChecking = false;
		}
	}

	function stopPolling(): void {
		if (pollTimer !== null) {
			clearInterval(pollTimer);
			pollTimer = null;
		}
	}

	function startPolling(): void {
		stopPolling();
		pollTimer = setInterval(() => {
			void checkPaymentStatus(false);
		}, 5000);
	}

	$effect(() => {
		if (!browser) return;
		if (stage === 'verifying') startPolling();
		else stopPolling();
		return () => stopPolling();
	});

	async function checkPaymentStatus(manual: boolean): Promise<void> {
		if (!payment) return;
		try {
			const latest = await fetchMyPayment(courseId);
			if (!latest || latest.id !== payment.id) return;
			payment = latest;
			if (latest.status === 'diverifikasi') {
				stopPolling();
				stage = 'success';
				void refreshServerAccess();
			}
		} catch {
			if (manual) formError = 'Gagal memeriksa status. Coba lagi.';
		}
	}

	async function applyVoucher(): Promise<void> {
		voucherError = '';
		if (applyingVoucher) return;
		if (!voucherCode.trim()) {
			voucherError = 'Masukkan kode voucher dulu.';
			return;
		}
		if (!course) return;
		applyingVoucher = true;
		try {
			const res = await validateDiscountVoucher(voucherCode.trim(), course.id);
			appliedVoucher = { code: res.code, discountAmount: res.discountAmount };
			voucherCode = '';
		} catch (e) {
			voucherError = e instanceof Error ? e.message : 'Kode voucher tidak valid.';
		} finally {
			applyingVoucher = false;
		}
	}

	function removeVoucher(): void {
		appliedVoucher = null;
		voucherError = '';
	}

	async function copyText(text: string, label: string): Promise<void> {
		try {
			await navigator.clipboard.writeText(text);
			copied = label;
			setTimeout(() => {
				copied = '';
			}, 2000);
		} catch {
			formError = 'Gagal menyalin. Salin manual ya.';
		}
	}

	async function startPayment(): Promise<void> {
		formError = '';
		if (!course || !meta) return;
		if (!isPaidCourse) return;
		if (meta.period === 'ended') {
			formError = 'Batch pelatihan ini sudah berakhir dan tidak bisa dibayar.';
			return;
		}
		if (!agree) {
			formError = 'Centang persetujuan syarat & ketentuan dulu untuk lanjut bayar.';
			return;
		}
		creatingPayment = true;
		try {
			payment = await createPayment(course.id, {
				voucherCode: appliedVoucher?.code
			});
			lastRejection = null;
			stage = 'instruction';
		} catch (e) {
			if (e instanceof Error && /voucher/i.test(e.message)) appliedVoucher = null;
			formError = e instanceof Error ? e.message : 'Gagal membuat pengajuan pembayaran.';
		} finally {
			creatingPayment = false;
		}
	}

	function pickProof(file: File | undefined): void {
		proofError = '';
		if (proofPreview) URL.revokeObjectURL(proofPreview);
		proofPreview = null;
		proofFile = null;
		if (!file) return;
		const okType = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type);
		const okExt = /\.(jpe?g|png|webp)$/i.test(file.name);
		if (!okType && !okExt) {
			proofError = 'Bukti harus berupa gambar (JPG/PNG/WebP).';
			return;
		}
		if (file.size > 5 * 1024 * 1024) {
			proofError = 'Ukuran gambar melebihi 5 MB.';
			return;
		}
		if (file.size === 0) {
			proofError = 'Berkas kosong.';
			return;
		}
		proofFile = file;
		proofPreview = URL.createObjectURL(file);
	}

	async function uploadProof(file: File): Promise<{ id: number }> {
		const fd = new FormData();
		fd.append('file', file, file.name);
		const token = getAccessToken();
		const res = await fetch('/api/payments/proof', {
			method: 'POST',
			headers: token ? { Authorization: `Bearer ${token}` } : {},
			body: fd
		});
		const json = (await res.json().catch(() => null)) as {
			status?: boolean;
			message?: string;
			data?: { id: number };
		} | null;
		if (!res.ok || !json?.status || typeof json.data?.id !== 'number') {
			throw new Error(json?.message ?? `Unggahan gagal (HTTP ${res.status}).`);
		}
		return { id: json.data.id };
	}

	async function submitProof(): Promise<void> {
		proofError = '';
		formError = '';
		if (!payment) {
			formError = 'Buat pengajuan pembayaran dulu.';
			return;
		}
		if (!proofFile) {
			proofError = 'Pilih foto/screenshot bukti bayar dulu.';
			return;
		}
		uploadingProof = true;
		try {
			const up = await uploadProof(proofFile);
			payment = await attachPaymentProof(payment.id, up.id);
			stage = 'verifying';
		} catch (e) {
			proofError = e instanceof Error ? e.message : 'Gagal mengunggah bukti. Coba lagi.';
		} finally {
			uploadingProof = false;
		}
	}

	async function restartPayment(): Promise<void> {
		stopPolling();
		payment = null;
		if (proofPreview) URL.revokeObjectURL(proofPreview);
		proofPreview = null;
		proofFile = null;
		proofError = '';
		lastRejection = null;
		stage = 'checkout';
	}

	function escapeReceiptHtml(s: string): string {
		return s
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;');
	}

	/** Unduh kwitansi sebagai berkas HTML mandiri (arsip peserta).
	 * Peserta tidak selalu bisa print langsung; unduhan bisa disimpan
	 * dan dibuka/cetak kapan saja tanpa koneksi. */
	function downloadReceipt(): void {
		if (!course) return;
		const e = escapeReceiptHtml;
		const rows = [
			['No. Invoice', e(invoice)],
			['Tanggal', e(paidAt)],
			['Peserta', nimLabel ? `${e(fullName)} · ${e(nimLabel)}` : e(fullName)],
			['Email', e(email)],
			['Pelatihan', e(course.title)],
			['Metode', 'QRIS'],
			['Harga pelatihan', escapeReceiptHtml(formatIDR(serverPrice))],
			['Diskon', escapeReceiptHtml(`${formatIDR(serverDiscount)}${payment?.promoSlug ? ` (promo ${payment.promoSlug})` : payment?.voucherCode ? ` (voucher ${payment.voucherCode})` : appliedVoucher ? ` (voucher ${appliedVoucher.code})` : ''}`)],
			['Total dibayar', escapeReceiptHtml(formatIDR(displayTotal))]
		];
		const accessLine = serverAccess
			? 'Akses kursus terkonfirmasi server.'
			: 'Menunggu verifikasi admin — akses dibuka setelah pembayaran disetujui. Simpan kwitansi ini sebagai arsip.';
		const html = `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Kwitansi ${e(invoice)} — ARISTOTELES</title><style>body{font-family:Arial,Helvetica,sans-serif;color:#0f172a;max-width:640px;margin:32px auto;padding:0 16px}h1{font-size:20px}p.sub{color:#64748b;font-size:13px}table{width:100%;border-collapse:collapse;margin-top:16px;font-size:14px}td{padding:8px;border-bottom:1px solid #e2e8f0}td:first-child{color:#64748b;width:40%}.total td{font-weight:bold}.note{margin-top:16px;font-size:12px;color:#64748b;background:#f8fafc;padding:12px;border-radius:8px}</style></head><body><h1>Kwitansi Pembayaran — ARISTOTELES</h1><p class="sub">Platform Mikrokredensial · simpan sebagai arsip pembayaran Anda.</p><table>${rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}</table><p class="note">${e(accessLine)}</p></body></html>`;
		try {
			const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `kwitansi-${invoice || 'aristoteles'}.html`;
			document.body.appendChild(a);
			a.click();
			a.remove();
			setTimeout(() => URL.revokeObjectURL(url), 10_000);
		} catch {
			// Gagal membuat berkas — pengguna tetap bisa memakai tombol cetak.
		}
	}

	function instructionSteps(): string[] {
		return [
			'Buka m-banking atau e-wallet apa pun, pilih Scan QRIS.',
			'Pindai kode QR di bawah dan bayar PERSIS sebesar total (lebih boleh, kurang ditolak).',
			'Screenshot bukti bayar, lalu unggah di bawah untuk diverifikasi admin.'
		];
	}
</script>

<svelte:head>
	<title>Pembayaran {course?.title ?? 'Pelatihan'} — Aristoteles Platform</title>
	<meta
		name="description"
		content="Bayar pelatihan Aristoteles via QRIS: pindai kode, unggah bukti, lalu admin verifikasi dan akses dibuka."
	/>
	<meta name="robots" content="noindex,nofollow" />
</svelte:head>

<div lang="id" class="p-4 sm:p-6 lg:p-8">
	{#if !course || !meta || !stats}
		<div class="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-10 text-center">
			<i class="fa-solid fa-triangle-exclamation mb-3 text-3xl text-amber-500" aria-hidden="true"></i>
			<h1 class="text-xl font-bold text-slate-900">Pelatihan tidak ditemukan</h1>
			<p class="mt-1 text-sm text-slate-500">Tautan pembayaran tidak valid atau sudah kedaluwarsa.</p>
			<a
				href={resolve('/user/semua-kursus')}
				class="mt-5 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white transition-all hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
			>
				<i class="fa-solid fa-arrow-left" aria-hidden="true"></i> Kembali ke katalog
			</a>
		</div>
	{:else if !isPaidCourse}
		<div class="mx-auto max-w-lg rounded-2xl border border-emerald-200 bg-emerald-50 p-10 text-center">
			<i class="fa-solid fa-circle-check mb-3 text-3xl text-emerald-600" aria-hidden="true"></i>
			<h1 class="text-xl font-bold text-slate-900">Pelatihan ini gratis</h1>
			<p class="mt-1 text-sm text-slate-600">
				{course.title} tidak butuh pembayaran. Langsung mulai belajar saja.
			</p>
			<a
				href={resolve(`/user/kursusku/${course.id}`)}
				class="mt-5 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white transition-all hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
			>
				<i class="fa-solid fa-play" aria-hidden="true"></i> Mulai Belajar
			</a>
		</div>
	{:else if paid && stage !== 'success'}
		<div class="mx-auto max-w-lg rounded-2xl border border-emerald-200 bg-white p-10 text-center">
			<i class="fa-solid fa-award mb-3 text-3xl text-emerald-600" aria-hidden="true"></i>
			<h1 class="text-xl font-bold text-slate-900">Kamu sudah memiliki akses</h1>
			<p class="mt-1 text-sm text-slate-500">
				Pembayaran {course.title} sudah lunas. Lanjutkan progres belajarmu.
			</p>
			<div class="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
				<a
					href={resolve(`/user/kursusku/${course.id}`)}
					class="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
				>
					<i class="fa-solid fa-play" aria-hidden="true"></i> Lanjut Belajar
				</a>
				<a
					href={resolve('/user/semua-kursus')}
					class="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600"
				>
					Jelajah kursus lain
				</a>
			</div>
		</div>
	{:else if meta.period === 'ended'}
		<div class="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-10 text-center">
			<i class="fa-solid fa-clock-rotate-left mb-3 text-3xl text-slate-400" aria-hidden="true"></i>
			<h1 class="text-xl font-bold text-slate-900">Periode batch sudah berakhir</h1>
			<p class="mt-1 text-sm text-slate-500">
				{course.title} tidak menerima pembayaran baru. Pantau katalog untuk batch berikutnya.
			</p>
			<a
				href={resolve('/user/semua-kursus')}
				class="mt-5 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
			>
				<i class="fa-solid fa-arrow-left" aria-hidden="true"></i> Kembali ke katalog
			</a>
		</div>
	{:else}
		<!-- Breadcrumb -->
		<nav aria-label="Breadcrumb" class="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
			<a href={resolve('/user/semua-kursus')} class="rounded font-semibold text-blue-600 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600">
				Semua Kursus
			</a>
			<i class="fa-solid fa-chevron-right text-[10px] text-slate-300" aria-hidden="true"></i>
			<a href={resolve(`/user/semua-kursus/${course.id}`)} class="max-w-56 truncate rounded font-medium text-slate-600 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-blue-600">
				{course.title}
			</a>
			<i class="fa-solid fa-chevron-right text-[10px] text-slate-300" aria-hidden="true"></i>
			<span aria-current="page" class="font-semibold text-slate-900">Pembayaran</span>
		</nav>

		<!-- Header + stepper -->
		<div class="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
			<div>
				<p class="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-extrabold tracking-widest text-amber-800 uppercase">
					<i class="fa-solid fa-lock" aria-hidden="true"></i> Checkout aman · Pelatihan berbayar
				</p>
				<h1 bind:this={headingEl} tabindex="-1" class="mt-2 text-2xl font-extrabold tracking-tight text-slate-900 focus:outline-none sm:text-3xl">
					{#if stage === 'success'}
						Pembayaran berhasil
					{:else if stage === 'instruction'}
						Selesaikan pembayaranmu
					{:else}
						Pembayaran pelatihan
					{/if}
				</h1>
				<p class="mt-1 max-w-xl text-sm text-slate-500">
					{#if stage === 'success'}
						Pembayaran disetujui admin — kwitansi di bawah dapat diunduh sebagai arsip.
					{:else if stage === 'instruction'}
						Ikuti instruksi QRIS di bawah, lalu unggah bukti bayar.
					{:else}
						Satu langkah lagi menuju akses penuh: cek rincian, buat pengajuan, bayar QRIS.
					{/if}
				</p>
				<p class="mt-2 max-w-xl text-[11px] font-semibold text-amber-700">
					Pembayaran manual via QRIS — akses dibuka setelah admin memverifikasi bukti (maks 1×24 jam).
				</p>
			</div>
			<ol aria-label="Langkah pembayaran" class="flex items-center gap-1.5 text-[11px] font-bold">
				<li class="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-700">
					<i class="fa-solid fa-check" aria-hidden="true"></i> 1. Pilih Pelatihan
				</li>
				<li aria-hidden="true" class="h-px w-4 bg-slate-300"></li>
				<li
					aria-current={stage === 'success' ? undefined : 'step'}
					class="flex items-center gap-1.5 rounded-full px-3 py-1.5 {stage === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-600 text-white'}"
				>
					{#if stage === 'success'}
						<i class="fa-solid fa-check" aria-hidden="true"></i>
					{:else}
						<i class="fa-solid fa-credit-card" aria-hidden="true"></i>
					{/if}
					2. Pembayaran
				</li>
				<li aria-hidden="true" class="h-px w-4 bg-slate-300"></li>
				<li
					aria-current={stage === 'success' ? 'step' : undefined}
					class="flex items-center gap-1.5 rounded-full px-3 py-1.5 {stage === 'success' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}"
				>
					<i class="fa-solid fa-award" aria-hidden="true"></i> 3. Akses Penuh
				</li>
			</ol>
		</div>

		{#if stage === 'success'}
			<!-- SUKSES -->
			<div class="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
				<section aria-labelledby="sukses-judul" class="overflow-hidden rounded-2xl border border-emerald-200 bg-white">
					<div class="bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 p-6 text-white sm:p-8">
						<span class="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15" aria-hidden="true">
							<i class="fa-solid fa-check text-2xl"></i>
						</span>
						<h2 id="sukses-judul" class="mt-4 text-xl font-extrabold sm:text-2xl">Lunas! Selamat belajar, {fullName.split(' ')[0]}.</h2>
						<p class="mt-1 text-sm text-emerald-100">
							{course.title} · QRIS · {paidAt}
						</p>
					</div>
					<div class="border-b border-slate-100 px-6 py-4 sm:px-8" role="status" aria-live="polite">
						{#if accessChecking || serverAccess === null}
							<p class="flex items-center gap-2 text-xs font-semibold text-slate-500">
								<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i>
								Memeriksa akses kursus ke server…
							</p>
						{:else if serverAccess}
							<p class="flex items-center gap-2 text-xs font-bold text-emerald-700">
								<i class="fa-solid fa-circle-check" aria-hidden="true"></i>
								Server mencatat Anda memiliki akses kursus ini.
							</p>
						{:else}
							<div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
								<p class="flex items-start gap-2 text-xs font-semibold text-amber-800">
									<i class="fa-solid fa-triangle-exclamation mt-0.5" aria-hidden="true"></i>
									<span>Pembayaran disetujui, tetapi server belum mencatat akses untuk akun ini. Materi berbayar tetap terkunci sampai akses tersinkron.</span>
								</p>
								<button
									type="button"
									onclick={() => void refreshServerAccess()}
									class="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-800 transition-colors hover:bg-amber-100 focus-visible:outline-2 focus-visible:outline-amber-600"
								>
									<i class="fa-solid fa-rotate-right" aria-hidden="true"></i> Periksa ulang
								</button>
							</div>
						{/if}
					</div>
					<dl class="grid gap-3 p-6 sm:grid-cols-2 sm:p-8">
						<div class="rounded-xl bg-slate-50 p-4">
							<dt class="text-[11px] font-bold tracking-widest text-slate-500 uppercase">No. Invoice</dt>
							<dd class="mt-1 font-mono text-sm font-bold text-slate-900">{invoice}</dd>
						</div>
						<div class="rounded-xl bg-slate-50 p-4">
							<dt class="text-[11px] font-bold tracking-widest text-slate-500 uppercase">Total dibayar</dt>
							<dd class="mt-1 text-sm font-extrabold text-emerald-700">{formatIDR(displayTotal)}</dd>
						</div>
						<div class="rounded-xl bg-slate-50 p-4">
							<dt class="text-[11px] font-bold tracking-widest text-slate-500 uppercase">Peserta</dt>
							<dd class="mt-1 text-sm font-semibold text-slate-800">{nimLabel ? `${fullName} · ${nimLabel}` : fullName}</dd>
							<dd class="text-xs text-slate-500">{email}</dd>
						</div>
						<div class="rounded-xl bg-slate-50 p-4">
							<dt class="text-[11px] font-bold tracking-widest text-slate-500 uppercase">Yang kamu dapat</dt>
							<dd class="mt-1 text-sm text-slate-700">
								{stats.moduleCount} modul · {stats.materialCount} materi · Sertifikat · Akses selamanya
							</dd>
						</div>
					</dl>
					<div class="flex flex-col gap-2.5 border-t border-slate-100 p-6 sm:flex-row sm:p-8 sm:pt-6">
						{#if serverAccess}
							<a
								href={resolve(`/user/kursusku/${course.id}`)}
								class="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white shadow-lg shadow-blue-600/25 hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
							>
								<i class="fa-solid fa-play" aria-hidden="true"></i> Mulai Belajar Sekarang
							</a>
						{:else}
							<a
								href={resolve(`/user/kursusku/${course.id}`)}
								class="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white shadow-lg shadow-blue-600/25 hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
							>
								<i class="fa-solid fa-lock" aria-hidden="true"></i> Cek Status Akses Kursus
							</a>
						{/if}
						<button
							type="button"
							onclick={downloadReceipt}
							class="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 text-sm font-bold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600"
						>
							<i class="fa-solid fa-download" aria-hidden="true"></i> Unduh Kwitansi
						</button>
						<button
							type="button"
							onclick={() => window.print()}
							class="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 text-sm font-bold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600"
						>
							<i class="fa-solid fa-receipt" aria-hidden="true"></i> Cetak Kwitansi
						</button>
					</div>
				</section>
				<aside aria-label="Langkah berikutnya" class="space-y-4 rounded-2xl border border-slate-200/70 bg-white p-6">
					<h2 class="text-sm font-extrabold text-slate-900">Langkah berikutnya</h2>
					<ol class="space-y-3 text-sm text-slate-600">
						<li class="flex gap-2.5">
							<span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[11px] font-bold text-blue-700">1</span>
							Mulai dari modul 1 — materi terbuka berurutan.
						</li>
						<li class="flex gap-2.5">
							<span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[11px] font-bold text-blue-700">2</span>
							Selesaikan kuis & tugas untuk membuka sertifikat.
						</li>
						<li class="flex gap-2.5">
							<span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[11px] font-bold text-blue-700">3</span>
							Butuh bantuan? Hubungi support@aristoteles.id
						</li>
					</ol>
					<a href={resolve('/user/semua-kursus')} class="inline-flex min-h-[44px] items-center gap-2 text-sm font-bold text-blue-600 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600">
						Jelajahi pelatihan lain <i class="fa-solid fa-arrow-right text-xs" aria-hidden="true"></i>
					</a>
				</aside>
			</div>
		{:else if stage === 'instruction' || stage === 'verifying'}
			<!-- INSTRUKSI BAYAR -->
			<div class="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
				<section aria-labelledby="instruksi-judul" class="rounded-2xl border border-slate-200/70 bg-white p-6 sm:p-8">
					<div class="flex flex-wrap items-center justify-between gap-3">
						<h2 id="instruksi-judul" class="text-lg font-extrabold text-slate-900">
							Bayar via QRIS
						</h2>
						<span class="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 font-mono text-[11px] font-bold text-slate-600">
							<i class="fa-solid fa-file-invoice" aria-hidden="true"></i> {invoice || '…'}
						</span>
					</div>

					<div class="mt-5 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6">
						{#if qrisUrl}
							<img
								src={qrisUrl}
								alt={`Kode QRIS ARISTOTELES sebesar ${formatIDR(displayTotal)}`}
								class="h-44 w-44 rounded-xl bg-white object-contain p-2 shadow-inner"
								loading="eager"
							/>
						{:else}
							<p role="note" class="max-w-sm text-center text-xs font-semibold text-amber-800">
								QRIS platform belum dikonfigurasi. Hubungi admin untuk mendapatkan kode bayar sebelum melanjutkan.
							</p>
						{/if}
						<p class="text-2xl font-black text-slate-900">{formatIDR(displayTotal)}</p>
						<p class="text-xs text-slate-500">QRIS · {invoice || '…'} · a.n. Aristoteles Platform</p>
						<button
							type="button"
							onclick={() => copyText(String(displayTotal), 'nominal')}
							class="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600"
						>
							<i class="fa-regular fa-copy" aria-hidden="true"></i>
							{copied === 'nominal' ? 'Nominal tersalin!' : 'Salin nominal'}
						</button>
						<p class="text-center text-[11px] font-semibold text-amber-800">Bayar PERSIS sebesar total (lebih boleh, kurang ditolak saat verifikasi).</p>
					</div>

					<ol class="mt-5 space-y-2.5" aria-label="Langkah penyelesaian pembayaran">
						{#each instructionSteps() as step, i (i)}
							<li class="flex items-start gap-2.5 rounded-xl bg-blue-50/60 px-4 py-3 text-sm text-slate-700">
								<span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[11px] font-bold text-white">{i + 1}</span>
								<span>{step}</span>
							</li>
						{/each}
					</ol>

					{#if stage === 'instruction'}
						<div class="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
							<h3 class="text-sm font-extrabold text-slate-900">Unggah bukti bayar</h3>
							<p class="mt-0.5 text-xs text-slate-500">Foto/screenshot bukti transfer (JPG/PNG/WebP, maks 5 MB). Hanya gambar yang diterima.</p>
							<label for="pay-proof" class="mt-3 flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-100 focus-within:ring-4 focus-within:ring-blue-500/10">
								<i class="fa-solid fa-upload" aria-hidden="true"></i>
								{proofFile ? proofFile.name : 'Pilih gambar bukti bayar'}
							</label>
							<input
								id="pay-proof"
								type="file"
								accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
								class="sr-only"
								onchange={(e) => pickProof(e.currentTarget.files?.[0])}
								aria-describedby={proofError ? 'proof-err' : undefined}
							/>
							{#if proofPreview}
								<img src={proofPreview} alt="Pratinjau bukti bayar" class="mx-auto mt-3 max-h-56 rounded-xl border border-slate-200 object-contain" />
							{/if}
							{#if proofError}
								<p id="proof-err" role="alert" class="mt-2 text-xs font-semibold text-red-600">{proofError}</p>
							{/if}
							<div class="mt-4 flex flex-col gap-2.5 sm:flex-row">
								<button
									type="button"
									onclick={submitProof}
									disabled={uploadingProof || !proofFile}
									class="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white shadow-lg shadow-blue-600/25 transition-all hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-blue-600"
								>
									{#if uploadingProof}
										<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i> Mengunggah…
									{:else}
										<i class="fa-solid fa-check-double" aria-hidden="true"></i> Kirim bukti & ajukan verifikasi
									{/if}
								</button>
								<button
									type="button"
									onclick={() => (stage = 'checkout')}
									class="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 text-sm font-bold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600"
								>
									<i class="fa-solid fa-arrow-left" aria-hidden="true"></i> Kembali
								</button>
							</div>
						</div>
					{:else if payment?.status === 'ditolak'}
						<div role="alert" class="mt-5 rounded-2xl border border-red-200 bg-red-50 p-5">
							<p class="flex items-start gap-2 text-sm font-bold text-red-700">
								<i class="fa-solid fa-circle-xmark mt-0.5" aria-hidden="true"></i>
								<span>Pembayaran ditolak{payment.rejectReason ? `: ${payment.rejectReason}` : '.'}</span>
							</p>
							<button
								type="button"
								onclick={restartPayment}
								class="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-red-600"
							>
								<i class="fa-solid fa-rotate-left" aria-hidden="true"></i> Ajukan ulang pembayaran
							</button>
						</div>
					{:else}
						<div role="status" class="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center">
							<p class="flex items-center justify-center gap-2.5 text-sm font-bold text-amber-800">
								<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i>
								Menunggu verifikasi admin (maks 1×24 jam).
							</p>
							<p class="mx-auto mt-1 max-w-md text-xs text-amber-700">
								Bukti sudah kami terima. Akses kursus dibuka otomatis setelah disetujui. Halaman ini memeriksa status tiap beberapa detik.
							</p>
							<button
								type="button"
								onclick={() => void checkPaymentStatus(true)}
								class="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl border border-amber-300 bg-white px-4 py-2 text-xs font-bold text-amber-800 transition-colors hover:bg-amber-100 focus-visible:outline-2 focus-visible:outline-amber-600"
							>
								<i class="fa-solid fa-rotate" aria-hidden="true"></i> Periksa sekarang
							</button>
						</div>
					{/if}
				</section>

				<aside aria-label="Ringkasan tagihan" class="rounded-2xl border border-slate-200/70 bg-white p-6 lg:sticky lg:top-24">
					<h2 class="text-sm font-extrabold text-slate-900">Ringkasan tagihan</h2>
					<dl class="mt-3 space-y-2 text-sm">
						<div class="flex justify-between gap-3">
							<dt class="text-slate-500">{course.title}</dt>
							<dd class="font-bold text-slate-900">{formatIDR(price)}</dd>
						</div>
						{#if appliedVoucher}
							<div class="flex justify-between gap-3 text-emerald-700">
								<dt>Voucher {appliedVoucher.code}</dt>
								<dd class="font-bold">−{formatIDR(appliedVoucher.discountAmount)}</dd>
							</div>
						{/if}
						{#if promoQuote}
							<div class="flex justify-between gap-3 text-red-700">
								<dt>Promo {promoQuote.badgeLabel ?? promoQuote.title} (−{promoQuote.discountPercent}%)</dt>
								<dd class="font-bold">−{formatIDR(promoDiscount)}</dd>
							</div>
						{/if}
						{#if promoQuote && voucherDiscount > 0}
							<p class="text-[11px] text-slate-500">Promo vs voucher tidak digabung — yang terbesar ({promoWins ? 'promo' : 'voucher'}) yang dipakai.</p>
						{/if}
						<div class="flex justify-between gap-3 border-t border-slate-100 pt-3">
							<dt class="font-extrabold text-slate-900">Total</dt>
							<dd class="text-lg font-black text-blue-700">{formatIDR(total)}</dd>
						</div>
					</dl>
					<p class="mt-3 font-mono text-[11px] text-slate-500">Invoice {invoice || 'dibuat setelah tekan Bayar'}</p>
					<p class="mt-3 flex items-center gap-2 text-[11px] text-slate-500">
						<i class="fa-solid fa-shield-halved text-emerald-600" aria-hidden="true"></i>
						Bukti diverifikasi admin maks 1×24 jam · akses dibuka otomatis
					</p>
				</aside>
			</div>
		{:else}
			<!-- CHECKOUT -->
			<div class="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
				<div class="min-w-0 space-y-6">
					<!-- 01 Data peserta -->
					<section aria-labelledby="h-peserta" class="rounded-2xl border border-slate-200/70 bg-white p-5 sm:p-6">
						<h2 id="h-peserta" class="flex items-center gap-2.5 text-base font-extrabold text-slate-900">
							<span class="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-xs font-black text-white">01</span>
							Data peserta
						</h2>
						<p class="mt-1 mb-4 text-xs text-slate-500">
							Terisi otomatis dari akunmu — atas nama inilah sertifikat diterbitkan.
						</p>
						<div class="grid gap-3 sm:grid-cols-2">
							<div>
								<label for="pay-nama" class="mb-1.5 block text-xs font-bold text-slate-700">Nama lengkap</label>
								<input
									id="pay-nama"
									type="text"
									bind:value={fullName}
									autocomplete="name"
									class="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
								/>
							</div>
							<div>
								<label for="pay-nim" class="mb-1.5 block text-xs font-bold text-slate-700">NIM / ID <span class="font-normal text-slate-400">(opsional)</span></label>
								<input
									id="pay-nim"
									type="text"
									bind:value={nim}
									autocomplete="off"
									class="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
								/>
							</div>
							<div class="sm:col-span-2">
								<label for="pay-email" class="mb-1.5 block text-xs font-bold text-slate-700">Email kwitansi</label>
								<input
									id="pay-email"
									type="email"
									bind:value={email}
									autocomplete="email"
									class="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
								/>
							</div>
						</div>
					</section>

					<!-- 02 Metode -->
					<section aria-labelledby="h-metode" class="rounded-2xl border border-slate-200/70 bg-white p-5 sm:p-6">
						<h2 id="h-metode" class="flex items-center gap-2.5 text-base font-extrabold text-slate-900">
							<span class="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-xs font-black text-white">02</span>
							Metode pembayaran
						</h2>
						<div class="mt-3 flex items-center gap-3 rounded-xl border border-blue-600 bg-blue-50/60 px-4 py-3">
							<span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
								<i class="fa-solid fa-qrcode" aria-hidden="true"></i>
							</span>
							<span class="min-w-0 flex-1">
								<span class="block text-sm font-bold text-slate-900">
									QRIS
									<span class="ml-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700 uppercase">Tersedia</span>
								</span>
								<span class="block text-xs text-slate-500">Scan dari m-banking atau e-wallet apa pun, lalu unggah bukti bayar.</span>
							</span>
							<span class="text-xs font-bold text-slate-500">Tanpa biaya tambahan</span>
						</div>
						<p class="mt-2.5 text-[11px] text-slate-500">
							Metode lain (VA, e-wallet, kartu, gerai) segera hadir. Saat ini pembayaran terverifikasi hanya via QRIS.
						</p>
					</section>

					<!-- 03 Voucher -->
					<section aria-labelledby="h-voucher" class="rounded-2xl border border-slate-200/70 bg-white p-5 sm:p-6">
						<h2 id="h-voucher" class="flex items-center gap-2.5 text-base font-extrabold text-slate-900">
							<span class="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-xs font-black text-white">03</span>
							Voucher promo
						</h2>
						{#if promoQuote}
							<div class="mt-3 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
								<p class="text-sm font-bold text-red-800">
									<i class="fa-solid fa-tags mr-1.5" aria-hidden="true"></i>
									{promoQuote.badgeLabel ?? promoQuote.title} −{promoQuote.discountPercent}% otomatis
								</p>
								<span class="shrink-0 text-xs font-extrabold text-red-700">−{formatIDR(promoDiscount)}</span>
							</div>
						{/if}
						{#if appliedVoucher}
							<div class="mt-3 flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
								<p class="text-sm font-bold text-emerald-800">
									<i class="fa-solid fa-ticket mr-1.5" aria-hidden="true"></i>
									{appliedVoucher.code} · hemat {formatIDR(appliedVoucher.discountAmount)}
									{#if promoQuote && promoWins}
										<span class="font-semibold text-emerald-600">(promo lebih besar — yang dipakai promo)</span>
									{/if}
								</p>
								<button
									type="button"
									onclick={removeVoucher}
									class="inline-flex min-h-[36px] items-center rounded-lg px-3 text-xs font-bold text-emerald-700 hover:bg-emerald-100 focus-visible:outline-2 focus-visible:outline-emerald-600"
									aria-label={`Hapus voucher ${appliedVoucher.code}`}
								>
									Hapus
								</button>
							</div>
						{:else}
							<form class="mt-3 flex gap-2" onsubmit={(e) => { e.preventDefault(); void applyVoucher(); }}>
								<label for="pay-voucher" class="sr-only">Kode voucher diskon</label>
								<input
									id="pay-voucher"
									type="text"
									bind:value={voucherCode}
									placeholder="Punya kode diskon? Masukkan di sini"
									autocomplete="off"
									aria-invalid={voucherError.length > 0}
									aria-describedby={voucherError ? 'voucher-err' : undefined}
									class="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 font-mono text-sm uppercase placeholder:font-sans placeholder:normal-case focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
								/>
								<button
									type="submit"
									disabled={applyingVoucher}
									class="inline-flex min-h-[44px] shrink-0 items-center rounded-xl bg-blue-600 px-5 text-xs font-bold text-white hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-blue-600"
								>
									{#if applyingVoucher}
										<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i> Cek…
									{:else}
										Pakai
									{/if}
								</button>
							</form>
							{#if voucherError}
								<p id="voucher-err" role="alert" class="mt-2 text-xs font-semibold text-red-600">{voucherError}</p>
							{:else}
								<p class="mt-2 text-[11px] text-slate-500">Voucher diskon dicek ke server dan baru hangus setelah pembayaran disetujui. Voucher akses penuh (K-03) ditukar di halaman Kursusku, bukan di sini.</p>
							{/if}
						{/if}
					</section>

					<!-- 04 Konfirmasi -->
					<section aria-labelledby="h-bayar" class="rounded-2xl border border-slate-200/70 bg-white p-5 sm:p-6">
						<h2 id="h-bayar" class="flex items-center gap-2.5 text-base font-extrabold text-slate-900">
							<span class="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-xs font-black text-white">04</span>
							Konfirmasi & bayar
						</h2>
						<label class="mt-3 flex cursor-pointer items-start gap-2.5 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
							<input type="checkbox" bind:checked={agree} class="mt-1 h-5 w-5 shrink-0 accent-blue-600" />
							<span>
								Saya menyetujui <span class="font-bold text-slate-800">Syarat & Ketentuan</span> dan
								<span class="font-bold text-slate-800">Kebijakan Pengembalian 30 hari</span>. Saya paham akses
								aktif otomatis setelah pembayaran terverifikasi.
							</span>
						</label>
						{#if formError}
							<p role="alert" class="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
								<i class="fa-solid fa-circle-exclamation mt-0.5" aria-hidden="true"></i> {formError}
							</p>
						{/if}
						<button
							type="button"
							onclick={startPayment}
							disabled={!canPay}
							aria-describedby="bayar-hint"
							class="mt-4 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl px-5 text-sm font-extrabold text-white shadow-lg transition-all active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 {canPay ? 'bg-blue-600 shadow-blue-600/25 hover:bg-blue-700' : 'cursor-not-allowed bg-slate-300 shadow-none'}"
						>
							<i class="fa-solid fa-lock" aria-hidden="true"></i>
							{#if creatingPayment}Membuat pengajuan…{:else}Bayar {formatIDR(total)}{/if}
						</button>
						<p id="bayar-hint" class="mt-2 text-center text-[11px] text-slate-500">
							{#if !agree}
								Centang persetujuan dulu untuk mengaktifkan tombol bayar.
							{:else}
								Kamu akan diarahkan ke instruksi bayar QRIS + unggah bukti.
							{/if}
						</p>
					</section>
				</div>

				<!-- Ringkasan order -->
				<aside aria-label="Ringkasan pesanan" class="overflow-hidden rounded-2xl border border-slate-200/70 bg-white lg:sticky lg:top-24">
					<div class="relative">
						<img src={course.image} alt="" aria-hidden="true" class="h-36 w-full object-cover" loading="lazy" />
						<div class="absolute inset-0 bg-gradient-to-t from-slate-900/70 to-transparent" aria-hidden="true"></div>
						<p class="absolute bottom-3 left-4 max-w-[90%] truncate text-sm font-extrabold text-white">{course.title}</p>
						<span class="absolute top-3 right-3 inline-flex items-center gap-1 rounded-md bg-amber-400 px-2.5 py-1 text-[10px] font-black text-slate-900 uppercase">
							<i class="fa-solid fa-lock" aria-hidden="true"></i> Berbayar
						</span>
					</div>
					<div class="space-y-4 p-5">
						<dl class="flex items-center gap-3 text-xs text-slate-500">
							<dt class="sr-only">Instruktur dan rating</dt>
							<dd class="font-semibold text-slate-700">{course.instructor}</dd>
							<dd aria-label={`Rating ${meta.rating} dari ${meta.reviews} ulasan`}>★ {meta.rating} ({meta.reviews})</dd>
							<dd>{course.duration}</dd>
						</dl>
						<ul class="space-y-2 border-t border-slate-100 pt-4 text-[13px] text-slate-600">
							<li class="flex items-center gap-2.5">
								<i class="fa-solid fa-layer-group w-4 text-center text-blue-500" aria-hidden="true"></i>
								{stats.moduleCount} modul · {stats.materialCount} materi
							</li>
							<li class="flex items-center gap-2.5">
								<i class="fa-solid fa-infinity w-4 text-center text-blue-500" aria-hidden="true"></i>
								Akses selamanya, sekali bayar
							</li>
							<li class="flex items-center gap-2.5">
								<i class="fa-solid fa-award w-4 text-center text-blue-500" aria-hidden="true"></i>
								Sertifikat kelulusan resmi
							</li>
							<li class="flex items-center gap-2.5">
								<i class="fa-solid fa-rotate-left w-4 text-center text-blue-500" aria-hidden="true"></i>
								Garansi 30 hari uang kembali
							</li>
						</ul>
						<dl aria-live="polite" class="space-y-2 rounded-xl bg-slate-50 p-4 text-sm">
							<div class="flex justify-between gap-3">
								<dt class="text-slate-500">Harga pelatihan</dt>
								<dd class="font-bold text-slate-900">{formatIDR(price)}</dd>
							</div>
							{#if appliedVoucher}
								<div class="flex justify-between gap-3 text-emerald-700">
									<dt>Diskon {appliedVoucher.code}</dt>
									<dd class="font-bold">−{formatIDR(appliedVoucher.discountAmount)}</dd>
								</div>
							{/if}
							{#if promoQuote}
								<div class="flex justify-between gap-3 text-red-700">
									<dt>Promo {promoQuote.badgeLabel ?? promoQuote.title}</dt>
									<dd class="font-bold">−{formatIDR(promoDiscount)}</dd>
								</div>
							{/if}
							<div class="flex items-baseline justify-between gap-3 border-t border-slate-200 pt-2.5">
								<dt class="font-extrabold text-slate-900">Total</dt>
								<dd class="text-xl font-black text-blue-700">{formatIDR(total)}</dd>
							</div>
						</dl>
						<p class="flex items-center justify-center gap-2 text-[11px] font-semibold text-slate-500">
							<i class="fa-solid fa-shield-halved text-emerald-600" aria-hidden="true"></i>
							QRIS manual · verifikasi admin maks 1×24 jam
						</p>
					</div>
				</aside>
			</div>
		{/if}
	{/if}
</div>
