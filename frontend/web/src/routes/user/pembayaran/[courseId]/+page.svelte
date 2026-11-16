<script lang="ts">
	import { browser } from '$app/environment';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { getCourseById } from '$lib/data/courses';
	import { getCourseMeta } from '$lib/data/course-meta';
	import { getTrainingStats } from '$lib/data/training';
	import { formatIDR, parsePrice } from '$lib/data/payment';
	import { canAccessCourse, isCoursePaid, setServerCourseFlags, syncEnrollmentsFromServer } from '$lib/stores/enrollment.svelte';
	import { fetchCourseAccess, fetchCourseDetail, type BackendCourse } from '$lib/api/courses';
	import { getCurrentUser } from '$lib/stores/auth.svelte';
	import {
		cancelPayment,
		createPayment,
		fetchMyPayment,
		fetchPaymentQr,
		markMyPaymentsSeen,
		refreshDokuQr,
		validateDiscountVoucher,
		type MyPayment
	} from '$lib/api/payments';
	import { fetchCoursePromo, type CoursePromoQuote } from '$lib/api/promos';
	import WarningModal from '$lib/components/WarningModal.svelte';

	const courseId = $derived(Number(page.params.courseId));
	const course = $derived(getCourseById(courseId));
	const meta = $derived(course ? getCourseMeta(course.id) : undefined);
	const stats = $derived(course ? getTrainingStats(course) : undefined);

	type Stage = 'checkout' | 'instruction' | 'success';
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

	// QRIS dinamis DOKU (PNG dari server, nominal tampil otomatis saat dipindai)
	let qrUrl = $state<string | null>(null);
	let qrLoading = $state(false);
	let qrError = $state('');
	let refreshingQr = $state(false);
	// Detik berjalan untuk hitung mundur kedaluwarsa QR.
	let nowTs = $state(Date.now());
	let pollTimer: ReturnType<typeof setInterval> | null = null;
	let tickTimer: ReturnType<typeof setInterval> | null = null;

	// Status akses menurut server — null = belum diperiksa.
	let serverAccess = $state<boolean | null>(null);
	let accessChecking = $state(false);

	let headingEl = $state<HTMLElement | null>(null);

	/** Detail kursus dari server (sumber kebenaran harga; fallback ke meta statis bila offline). */
	let serverCourse = $state<BackendCourse | null>(null);

	/** Harga: utamakan `priceNominal` server; meta statis hanya fallback. */
	const price = $derived(
		serverCourse ? Math.max(0, serverCourse.priceNominal ?? 0) : meta ? parsePrice(meta.price) : 0
	);
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
	/** Berbayar: utamakan `priceNominal` server agar selaras dengan katalog; meta statis hanya fallback. */
	const isPaidCourse = $derived(
		serverCourse ? (serverCourse.priceNominal ?? 0) > 0 : course ? isCoursePaid(course.id) : false
	);
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
		// Harga server sebagai kebenaran (perbaiki total 0 bila meta statis GRATIS tapi server berbayar).
		void fetchCourseDetail(course.id)
			.then((d) => {
				serverCourse = d;
				setServerCourseFlags(course.id, {
					paid: (d.priceNominal ?? 0) > 0,
					upcoming: d.period === 'upcoming'
				});
			})
			.catch(() => {});
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
				void dismissPaymentNotice();
			} else if (existing.status === 'ditolak') {
				lastRejection = { reason: existing.rejectReason ?? 'Pembayaran ditolak.' };
				payment = null;
				stage = 'checkout';
				void dismissPaymentNotice();
			} else {
				stage = 'instruction';
				void loadQr(false);
				startPolling();
			}
		} catch {
			// Abaikan: pengguna mulai dari checkout seperti biasa.
		}
	}

	/** Keputusan yang dibaca di sini hilang dari bell (tidak menumpuk). */
	async function dismissPaymentNotice(): Promise<void> {
		try {
			await markMyPaymentsSeen(courseId);
			window.dispatchEvent(new CustomEvent('user:notif-refresh'));
		} catch {
			// Abaikan: bell disegarkan saat navigasi/interval berikutnya.
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
		if (tickTimer !== null) {
			clearInterval(tickTimer);
			tickTimer = null;
		}
	}

	function startPolling(): void {
		stopPolling();
		pollTimer = setInterval(() => {
			void checkPaymentStatus(false);
		}, 5000);
		tickTimer = setInterval(() => {
			nowTs = Date.now();
		}, 1000);
	}

	$effect(() => {
		if (!browser) return;
		if (stage === 'instruction') startPolling();
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
				revokeQrUrl();
				stage = 'success';
				void refreshServerAccess();
				void dismissPaymentNotice();
			} else if (latest.status === 'ditolak') {
				stopPolling();
				revokeQrUrl();
				lastRejection = { reason: latest.rejectReason ?? 'Pembayaran ditolak.' };
				payment = null;
				stage = 'checkout';
				void dismissPaymentNotice();
			}
		} catch {
			if (manual) formError = 'Gagal memeriksa status. Coba lagi.';
		}
	}

	function revokeQrUrl(): void {
		if (qrUrl) URL.revokeObjectURL(qrUrl);
		qrUrl = null;
	}

	/** Unduh PNG QR DOKU dari server → object URL untuk <img>. */
	async function loadQr(silent: boolean): Promise<void> {
		if (!payment || payment.status !== 'menunggu') return;
		revokeQrUrl();
		qrError = '';
		qrLoading = true;
		try {
			const blob = await fetchPaymentQr(payment.id);
			if (!browser) return;
			revokeQrUrl();
			qrUrl = URL.createObjectURL(blob);
		} catch (e) {
			qrError = e instanceof Error ? e.message : 'Gagal memuat QR. Coba lagi.';
			if (!silent) formError = qrError;
		} finally {
			qrLoading = false;
		}
	}

	/** Minta QR baru (kedaluwarsa/hilang) lalu muat ulang gambarnya. */
	async function refreshQr(): Promise<void> {
		if (!payment || refreshingQr) return;
		refreshingQr = true;
		qrError = '';
		try {
			payment = await refreshDokuQr(payment.id);
			nowTs = Date.now();
			await loadQr(true);
		} catch (e) {
			qrError = e instanceof Error ? e.message : 'Gagal memperbarui QR. Coba lagi.';
		} finally {
			refreshingQr = false;
		}
	}

	/** Sisa waktu QR (dari dokuExpiresAt server). Null = tak diketahui. */
	const qrRemainingMs = $derived.by(() => {
		if (!payment?.dokuExpiresAt) return null;
		const left = new Date(payment.dokuExpiresAt).getTime() - nowTs;
		return left > 0 ? left : 0;
	});
	const qrRemainingLabel = $derived.by(() => {
		if (qrRemainingMs === null) return '';
		const s = Math.ceil(qrRemainingMs / 1000);
		const m = Math.floor(s / 60);
		const r = s % 60;
		return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
	});
	const qrExpired = $derived(qrRemainingMs !== null && qrRemainingMs <= 0);

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
				gateway: 'doku',
				voucherCode: appliedVoucher?.code
			});
			lastRejection = null;
			qrError = '';
			stage = 'instruction';
			nowTs = Date.now();
			void loadQr(false);
		} catch (e) {
			if (e instanceof Error && /voucher/i.test(e.message)) appliedVoucher = null;
			formError = e instanceof Error ? e.message : 'Gagal membuat pengajuan pembayaran.';
		} finally {
			creatingPayment = false;
		}
	}

	async function restartPayment(): Promise<void> {
		stopPolling();
		payment = null;
		revokeQrUrl();
		qrError = '';
		lastRejection = null;
		stage = 'checkout';
	}

	// Pembatalan antrean (hard delete di server — baris hilang total).
	let cancelOpen = $state(false);
	let cancelling = $state(false);
	let cancelError = $state('');

	async function confirmCancel(): Promise<void> {
		if (!payment || cancelling) return;
		cancelling = true;
		cancelError = '';
		try {
			await cancelPayment(payment.id);
			cancelOpen = false;
			stopPolling();
			payment = null;
			revokeQrUrl();
			await goto(resolve('/user/pembayaran'));
		} catch (e) {
			cancelError = e instanceof Error ? e.message : 'Gagal membatalkan. Coba lagi.';
		} finally {
			cancelling = false;
		}
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
			: 'Menunggu konfirmasi DOKU — akses dibuka otomatis setelah bayar. Simpan kwitansi ini sebagai arsip.';
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
			'Pindai kode QR di bawah — nominal tampil otomatis, bayar PERSIS sebesar total.',
			'Tunggu: akses kursus dibuka otomatis setelah DOKU mengonfirmasi (tanpa unggah bukti).'
		];
	}
</script>

<svelte:head>
	<title>Pembayaran {course?.title ?? 'Pelatihan'} — Aristoteles Platform</title>
	<meta
		name="description"
		content="Bayar pelatihan Aristoteles via QRIS dinamis DOKU: pindai kode, nominal tampil otomatis, akses dibuka otomatis."
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
			<a href={resolve('/user/pembayaran')} class="rounded font-medium text-slate-600 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-blue-600">
				Riwayat Pembayaran
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
						Pembayaran terverifikasi DOKU — kwitansi di bawah dapat diunduh sebagai arsip.
					{:else if stage === 'instruction'}
						Pindai QRIS dinamis di bawah — nominal tampil otomatis, tanpa unggah bukti.
					{:else}
						Satu langkah lagi menuju akses penuh: cek rincian, buat QR bayar, pindai.
					{/if}
				</p>
				<p class="mt-2 max-w-xl text-[11px] font-semibold text-emerald-700">
					Pembayaran QRIS dinamis via DOKU — akses dibuka otomatis setelah terkonfirmasi.
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
							{course.title} · QRIS dinamis · {paidAt}
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
		{:else if stage === 'instruction'}
			<!-- INSTRUKSI BAYAR -->
			<div class="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
				<section aria-labelledby="instruksi-judul" class="rounded-2xl border border-slate-200/70 bg-white p-6 sm:p-8">
					<div class="flex flex-wrap items-center justify-between gap-3">
						<h2 id="instruksi-judul" class="text-lg font-extrabold text-slate-900">
							Bayar via QRIS dinamis
						</h2>
						<span class="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 font-mono text-[11px] font-bold text-slate-600">
							<i class="fa-solid fa-file-invoice" aria-hidden="true"></i> {invoice || '…'}
						</span>
					</div>

					<div class="mt-5 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6">
						{#if qrLoading}
							<p class="flex h-44 w-44 items-center justify-center rounded-xl bg-white shadow-inner" role="status">
								<i class="fa-solid fa-circle-notch fa-spin text-2xl text-slate-400" aria-hidden="true"></i>
								<span class="sr-only">Memuat QR…</span>
							</p>
						{:else if qrUrl}
							<img
								src={qrUrl}
								alt={`Kode QRIS dinamis sebesar ${formatIDR(displayTotal)} — pindai, nominal tampil otomatis`}
								class="h-44 w-44 rounded-xl bg-white object-contain p-2 shadow-inner"
								loading="eager"
							/>
						{:else}
							<p role="alert" class="max-w-sm text-center text-xs font-semibold text-red-700">
								{qrError || 'QR belum tersedia.'}
							</p>
							<button
								type="button"
								onclick={() => void (payment ? loadQr(false) : null)}
								class="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600"
							>
								<i class="fa-solid fa-rotate-right" aria-hidden="true"></i> Muat ulang QR
							</button>
						{/if}
						<p class="text-2xl font-black text-slate-900">{formatIDR(displayTotal)}</p>
						<p class="text-xs text-slate-500">QRIS dinamis · {invoice || '…'} · a.n. Aristoteles Platform</p>
						{#if qrRemainingMs !== null && !qrExpired}
							<p class="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1 text-[11px] font-bold text-blue-800">
								<i class="fa-solid fa-hourglass-half" aria-hidden="true"></i> QR berlaku {qrRemainingLabel}
							</p>
						{:else if qrExpired}
							<p class="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-[11px] font-bold text-red-700">
								<i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i> QR kedaluwarsa
							</p>
							<button
								type="button"
								onclick={() => void refreshQr()}
								disabled={refreshingQr}
								class="inline-flex min-h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-blue-600"
							>
								{#if refreshingQr}
									<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i> Memperbarui…
								{:else}
									<i class="fa-solid fa-rotate-right" aria-hidden="true"></i> Buat QR baru
								{/if}
							</button>
						{/if}
						<button
							type="button"
							onclick={() => copyText(String(displayTotal), 'nominal')}
							class="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600"
						>
							<i class="fa-regular fa-copy" aria-hidden="true"></i>
							{copied === 'nominal' ? 'Nominal tersalin!' : 'Salin nominal'}
						</button>
						<p class="text-center text-[11px] font-semibold text-amber-800">Nominal tampil otomatis saat dipindai — cukup bayar sesuai yang tertera.</p>
					</div>

					<ol class="mt-5 space-y-2.5" aria-label="Langkah penyelesaian pembayaran">
						{#each instructionSteps() as step, i (i)}
							<li class="flex items-start gap-2.5 rounded-xl bg-blue-50/60 px-4 py-3 text-sm text-slate-700">
								<span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[11px] font-bold text-white">{i + 1}</span>
								<span>{step}</span>
							</li>
						{/each}
					</ol>

					{#if payment?.status === 'ditolak'}
						<div role="alert" class="mt-5 rounded-2xl border border-red-200 bg-red-50 p-5">
							<p class="flex items-start gap-2 text-sm font-bold text-red-700">
								<i class="fa-solid fa-circle-xmark mt-0.5" aria-hidden="true"></i>
								<span>Pembayaran gagal{payment.rejectReason ? `: ${payment.rejectReason}` : '.'}</span>
							</p>
							<button
								type="button"
								onclick={restartPayment}
								class="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-red-600"
							>
								<i class="fa-solid fa-rotate-left" aria-hidden="true"></i> Buat QR baru
							</button>
						</div>
					{:else}
						<div role="status" class="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center">
							<p class="flex items-center justify-center gap-2.5 text-sm font-bold text-amber-800">
								<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i>
								Menunggu pembayaran DOKU — akses dibuka otomatis.
							</p>
							<p class="mx-auto mt-1 max-w-md text-xs text-amber-700">
								Tidak perlu unggah bukti. Halaman ini memeriksa status tiap beberapa detik.
								{#if qrExpired}
									QR kedaluwarsa — buat QR baru di atas.
								{/if}
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
					{#if stage === 'instruction' && payment?.status === 'menunggu'}
						<div class="mt-4 text-center">
							<button
								type="button"
								onclick={() => (cancelOpen = true)}
								class="inline-flex min-h-10 items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold text-red-600 transition-colors hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-red-600"
							>
								<i class="fa-solid fa-trash-can" aria-hidden="true"></i> Batalkan pengajuan ini
							</button>
							{#if cancelError}
								<p role="alert" class="mx-auto mt-2 max-w-md text-xs font-semibold text-red-600">{cancelError}</p>
							{/if}
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
					<!-- 01 Metode -->
					<section aria-labelledby="h-metode" class="rounded-2xl border border-slate-200/70 bg-white p-5 sm:p-6">
						<h2 id="h-metode" class="text-base font-extrabold text-slate-900">
							Metode pembayaran
						</h2>
						<div class="mt-3 flex items-center gap-3 rounded-xl border border-blue-600 bg-blue-50/60 px-4 py-3">
							<span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
								<i class="fa-solid fa-qrcode" aria-hidden="true"></i>
							</span>
							<span class="min-w-0 flex-1">
								<span class="block text-sm font-bold text-slate-900">
									QRIS dinamis
									<span class="ml-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700 uppercase">Otomatis</span>
								</span>
								<span class="block text-xs text-slate-500">Scan dari m-banking atau e-wallet apa pun — nominal tampil otomatis, tanpa unggah bukti.</span>
							</span>
							<span class="text-xs font-bold text-slate-500">Tanpa biaya tambahan</span>
						</div>
						<p class="mt-2.5 text-[11px] text-slate-500">
							QRIS dinamis via DOKU — nominal tampil otomatis saat dipindai. Pilihan lain segera hadir.
						</p>
						<div class="mt-3 grid gap-2" role="group" aria-label="Metode pembayaran lain (segera hadir)">
							{#each [{ icon: 'fa-building-columns', label: 'Transfer Bank (VA)', desc: 'BRI · BCA · Mandiri · BNI' }, { icon: 'fa-wallet', label: 'E-Wallet', desc: 'GoPay · OVO · DANA · ShopeePay' }, { icon: 'fa-credit-card', label: 'Kartu Kredit / Debit', desc: 'Visa · Mastercard · JCB' }, { icon: 'fa-store', label: 'Gerai Retail', desc: 'Indomaret · Alfamart' }] as m (m.label)}
								<div
									aria-disabled="true"
									title={`${m.label} — segera hadir`}
									class="flex cursor-not-allowed items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 opacity-70"
								>
									<span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-200 text-slate-500">
										<i class={`fa-solid ${m.icon}`} aria-hidden="true"></i>
									</span>
									<span class="min-w-0 flex-1">
										<span class="block text-sm font-bold text-slate-500">
											{m.label}
											<span class="ml-1 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-extrabold text-slate-500 uppercase">Segera hadir</span>
										</span>
										<span class="block text-xs text-slate-400">{m.desc}</span>
									</span>
								</div>
							{/each}
						</div>
					</section>

					<!-- 02 Konfirmasi -->
					<section aria-labelledby="h-bayar" class="rounded-2xl border border-slate-200/70 bg-white p-5 sm:p-6">
						<h2 id="h-bayar" class="text-base font-extrabold text-slate-900">
							Konfirmasi & bayar
						</h2>
						<label class="mt-3 flex cursor-pointer items-start gap-2.5 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
							<input type="checkbox" bind:checked={agree} class="mt-1 h-5 w-5 shrink-0 accent-blue-600" />
							<span>
								Saya menyetujui
								<a href={resolve('/syarat-ketentuan')} target="_blank" rel="noopener noreferrer" class="font-bold text-blue-700 underline decoration-blue-300 underline-offset-2 hover:text-blue-800 focus-visible:outline-2 focus-visible:outline-blue-600" onclick={(e) => e.stopPropagation()}>Syarat & Ketentuan</a>
								dan
								<a href={resolve('/syarat-ketentuan#pengembalian')} target="_blank" rel="noopener noreferrer" class="font-bold text-blue-700 underline decoration-blue-300 underline-offset-2 hover:text-blue-800 focus-visible:outline-2 focus-visible:outline-blue-600" onclick={(e) => e.stopPropagation()}>Kebijakan Pengembalian 30 hari</a>. Saya paham akses
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
								Kamu akan diarahkan ke QRIS dinamis — pindai, nominal tampil otomatis.
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
							QRIS dinamis · verifikasi otomatis DOKU
						</p>
					</div>
				</aside>
			</div>
		{/if}
	{/if}
</div>

<WarningModal
	bind:open={cancelOpen}
	type="danger"
	title="Batalkan pengajuan ini?"
	message="Antrean QRIS dinamis ini akan dihapus permanen. Anda bisa membuat QR baru kapan pun."
	confirmText="Ya, batalkan"
	loading={cancelling}
	onconfirm={() => void confirmCancel()}
/>
