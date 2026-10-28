<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { getCourseById } from '$lib/data/courses';
	import { getCourseMeta } from '$lib/data/course-meta';
	import { getTrainingStats } from '$lib/data/training';
	import {
		PAYMENT_METHODS,
		findVoucher,
		formatIDR,
		invoiceNumber,
		methodLabel,
		parsePrice,
		paymentReference,
		serviceFee,
		voucherDiscount,
		type PaymentMethodId,
		type Voucher
	} from '$lib/data/payment';
	import { canAccessCourse, isCoursePaid, purchaseCourse } from '$lib/stores/enrollment.svelte';
	import { saveReceipt } from '$lib/stores/payment';
	import { getCurrentUser } from '$lib/stores/auth.svelte';

	const courseId = $derived(Number(page.params.courseId));
	const course = $derived(getCourseById(courseId));
	const meta = $derived(course ? getCourseMeta(course.id) : undefined);
	const stats = $derived(course ? getTrainingStats(course) : undefined);

	type Stage = 'checkout' | 'instruction' | 'verifying' | 'success';
	let stage = $state<Stage>('checkout');

	// Data peserta (terisi otomatis dari sesi login — WCAG 3.3.7 hindari entri berulang)
	const me = getCurrentUser();
	let fullName = $state(me?.name ?? '');
	let email = $state(me?.email ?? '');
	let nim = $state('');

	// Pembayaran
	let method = $state<PaymentMethodId>('qris');
	let channel = $state('bca');
	let voucherCode = $state('');
	let appliedVoucher = $state<Voucher | null>(null);
	let voucherError = $state('');
	let agree = $state(false);
	let formError = $state('');
	let copied = $state('');

	// Kartu
	let cardNumber = $state('');
	let cardName = $state((me?.name ?? '').toUpperCase());
	let cardExpiry = $state('');
	let cardCvv = $state('');

	// E-wallet
	let phone = $state('081234567890');

	// Instruksi & sukses
	let invoice = $state('');
	let paidAt = $state('');
	let remaining = $state(24 * 3600);
	let headingEl = $state<HTMLElement | null>(null);

	const price = $derived(meta ? parsePrice(meta.price) : 0);
	const discount = $derived(voucherDiscount(price, appliedVoucher));
	const subtotal = $derived(Math.max(0, price - discount));
	const fee = $derived(serviceFee(method, subtotal));
	const total = $derived(subtotal + fee);
	const reference = $derived(paymentReference(courseId, method, channel));
	const paid = $derived(course ? canAccessCourse(course.id) : false);
	const isPaidCourse = $derived(course ? isCoursePaid(course.id) : false);

	const activeMethod = $derived(PAYMENT_METHODS.find((m) => m.id === method));
	const needsChannel = $derived((activeMethod?.channels?.length ?? 0) > 0);

	const cardDigits = $derived(cardNumber.replace(/\D/g, ''));
	const cardValid = $derived(
		method !== 'card' ||
			(cardDigits.length === 16 && cardName.trim().length >= 3 && /^\d{2}\/\d{2}$/.test(cardExpiry) && cardCvv.length >= 3)
	);
	const phoneValid = $derived(method !== 'ewallet' || phone.replace(/\D/g, '').length >= 9);
	const channelValid = $derived(!needsChannel || channel.trim().length > 0);
	const canPay = $derived(
		!!course && !!meta && isPaidCourse && !paid && agree && cardValid && phoneValid && channelValid && meta.period !== 'ended'
	);

	const countdown = $derived.by(() => {
		const h = Math.floor(remaining / 3600);
		const m = Math.floor((remaining % 3600) / 60);
		const s = remaining % 60;
		return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
	});

	$effect(() => {
		if (stage === 'instruction' || stage === 'success') headingEl?.focus();
	});

	$effect(() => {
		if (stage !== 'instruction') return;
		remaining = 24 * 3600;
		const t = setInterval(() => {
			remaining = Math.max(0, remaining - 1);
		}, 1000);
		return () => clearInterval(t);
	});

	function selectMethod(id: PaymentMethodId): void {
		method = id;
		formError = '';
		const def = PAYMENT_METHODS.find((m) => m.id === id);
		if (def?.channels?.length) channel = def.channels[0].id;
	}

	function applyVoucher(): void {
		voucherError = '';
		if (!voucherCode.trim()) {
			voucherError = 'Masukkan kode voucher dulu.';
			return;
		}
		const found = findVoucher(voucherCode);
		if (!found) {
			voucherError = `Kode "${voucherCode.trim().toUpperCase()}" tidak dikenal. Coba HEMAT20.`;
			return;
		}
		appliedVoucher = found;
		voucherCode = '';
	}

	function removeVoucher(): void {
		appliedVoucher = null;
		voucherError = '';
	}

	function formatCardInput(value: string): void {
		const digits = value.replace(/\D/g, '').slice(0, 16);
		cardNumber = digits.replace(/(\d{4})(?=\d)/g, '$1 ');
	}

	function formatExpiryInput(value: string): void {
		let digits = value.replace(/\D/g, '').slice(0, 4);
		if (digits.length >= 3) digits = `${digits.slice(0, 2)}/${digits.slice(2)}`;
		cardExpiry = digits;
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

	function startPayment(): void {
		formError = '';
		if (!course || !meta) return;
		if (!isPaidCourse) return;
		if (meta.period === 'ended') {
			formError = 'Batch pelatihan ini sudah berakhir dan tidak bisa dibayar.';
			return;
		}
		if (method === 'card' && !cardValid) {
			formError = 'Lengkapi data kartu: 16 digit nomor, nama, masa berlaku MM/YY, dan CVV.';
			return;
		}
		if (method === 'ewallet' && !phoneValid) {
			formError = 'Nomor e-wallet minimal 9 digit angka.';
			return;
		}
		if (!channelValid) {
			formError = 'Pilih salah satu penyedia / bank dulu.';
			return;
		}
		if (!agree) {
			formError = 'Centang persetujuan syarat & ketentuan dulu untuk lanjut bayar.';
			return;
		}
		invoice = invoiceNumber(course.id);
		stage = 'instruction';
	}

	function confirmPaid(): void {
		if (!course) return;
		stage = 'verifying';
		const snapshot = {
			invoice: invoice || invoiceNumber(course.id),
			courseId: course.id,
			courseTitle: course.title,
			method,
			channel,
			total,
			paidAt: new Date().toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
		};
		invoice = snapshot.invoice;
		paidAt = snapshot.paidAt;
		setTimeout(() => {
			purchaseCourse(course.id);
			saveReceipt(snapshot);
			stage = 'success';
		}, 1800);
	}

	function instructionSteps(): string[] {
		switch (method) {
			case 'qris':
				return [
					'Buka m-banking atau e-wallet apa pun, pilih Scan QRIS.',
					'Pindai kode QR di bawah dan pastikan nominal sama dengan total.',
					'Konfirmasi & masukkan PIN, lalu kembali dan tekan "Saya Sudah Bayar".'
				];
			case 'va':
				return [
					`Buka ATM / m-banking, pilih Transfer ke Virtual Account ${channel.toUpperCase()}.`,
					`Masukkan nomor ${reference} sebesar ${formatIDR(total)} persis.`,
					'Simpan bukti transfer, lalu tekan "Saya Sudah Bayar".'
				];
			case 'ewallet':
				return [
					`Pastikan nomor ${phone} aktif dan saldo cukup ${formatIDR(total)}.`,
					'Tagihan dikirim ke aplikasi e-wallet kamu — setujui dalam 24 jam.',
					'Setelah notifikasi sukses, tekan "Saya Sudah Bayar".'
				];
			case 'card':
				return [
					'Klik "Saya Sudah Bayar" untuk membuka halaman 3D Secure bank.',
					'Masukkan OTP yang dikirim bank penerbit ke HP kamu.',
					'Jangan tutup halaman sampai status berubah sukses.'
				];
			case 'retail':
				return [
					`Datangi kasir ${channel === 'indomaret' ? 'Indomaret' : 'Alfamart'} terdekat.`,
					`Sebutkan kode bayar ${reference} dan bayar tunai ${formatIDR(total)}.`,
					'Simpan struk, lalu tekan "Saya Sudah Bayar".'
				];
		}
	}
</script>

<svelte:head>
	<title>Pembayaran {course?.title ?? 'Pelatihan'} — Aristoteles Platform</title>
	<meta
		name="description"
		content="Halaman pembayaran aman pelatihan berbayar Aristoteles: QRIS, Virtual Account, e-wallet, kartu, dan gerai retail."
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
						Akses penuh {course.title} sudah aktif (simulasi lokal). Kwitansi di bawah hanya tersimpan di browser.
					{:else if stage === 'instruction'}
						Ikuti instruksi {methodLabel(method, channel)} sebelum batas waktu habis.
					{:else}
						Satu langkah lagi menuju akses penuh: pilih metode, cek rincian, bayar.
					{/if}
				</p>
				<p class="mt-2 max-w-xl text-[11px] font-semibold text-amber-700">
					Simulasi lokal — belum terhubung ke bank/gateway, belum verifikasi server.
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
							{course.title} · {methodLabel(method, channel)} · {paidAt}
						</p>
					</div>
					<dl class="grid gap-3 p-6 sm:grid-cols-2 sm:p-8">
						<div class="rounded-xl bg-slate-50 p-4">
							<dt class="text-[11px] font-bold tracking-widest text-slate-500 uppercase">No. Invoice</dt>
							<dd class="mt-1 font-mono text-sm font-bold text-slate-900">{invoice}</dd>
						</div>
						<div class="rounded-xl bg-slate-50 p-4">
							<dt class="text-[11px] font-bold tracking-widest text-slate-500 uppercase">Total dibayar</dt>
							<dd class="mt-1 text-sm font-extrabold text-emerald-700">{formatIDR(total)}</dd>
						</div>
						<div class="rounded-xl bg-slate-50 p-4">
							<dt class="text-[11px] font-bold tracking-widest text-slate-500 uppercase">Peserta</dt>
							<dd class="mt-1 text-sm font-semibold text-slate-800">{fullName} · {nim}</dd>
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
						<a
							href={resolve(`/user/kursusku/${course.id}`)}
							class="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white shadow-lg shadow-blue-600/25 hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
						>
							<i class="fa-solid fa-play" aria-hidden="true"></i> Mulai Belajar Sekarang
						</a>
						<button
							type="button"
							onclick={() => window.print()}
							class="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 text-sm font-bold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600"
						>
							<i class="fa-solid fa-receipt" aria-hidden="true"></i> Cetak Kwitansi Lokal
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
							Bayar via {methodLabel(method, channel)}
						</h2>
						<p role="timer" aria-label={`Batas pembayaran ${countdown}`} title={`Batas pembayaran ${countdown}`} class="inline-flex items-center gap-1.5 rounded-full bg-blue-800 px-3 py-1.5 font-mono text-xs font-bold text-white">
							<i class="fa-regular fa-clock" aria-hidden="true"></i> {countdown}
						</p>
					</div>

					{#if method === 'qris'}
						<div class="mt-5 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6">
							<div role="img" aria-label={`Kode QRIS sebesar ${formatIDR(total)} untuk ${course.title}`} class="grid h-44 w-44 grid-cols-11 gap-[2px] rounded-xl bg-white p-3 shadow-inner">
								<!-- eslint-disable-next-line @typescript-eslint/no-unused-vars -->
								{#each Array(121) as _, i (i)}
									<span class="aspect-square rounded-[1px] {(i * 7919 + courseId * 131) % 3 === 0 ? 'bg-slate-900' : 'bg-slate-200'}" aria-hidden="true"></span>
								{/each}
							</div>
							<p class="text-2xl font-black text-slate-900">{formatIDR(total)}</p>
							<p class="text-xs text-slate-500">QRIS · {invoice} · a.n. Aristoteles Platform</p>
							<button
								type="button"
								onclick={() => copyText(String(total), 'nominal')}
								class="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600"
							>
								<i class="fa-regular fa-copy" aria-hidden="true"></i>
								{copied === 'nominal' ? 'Nominal tersalin!' : 'Salin nominal'}
							</button>
						</div>
					{:else}
						<div class="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center">
							<p class="text-[11px] font-bold tracking-widest text-slate-500 uppercase">
								{method === 'va' ? 'Nomor Virtual Account' : method === 'retail' ? 'Kode pembayaran' : method === 'ewallet' ? 'Tagihan dikirim ke' : 'Total tagihan kartu'}
							</p>
							<p class="mt-1 font-mono text-2xl font-black tracking-wide text-slate-900 sm:text-3xl">
								{method === 'ewallet' ? phone : method === 'card' ? formatIDR(total) : reference}
							</p>
							<p class="mt-1 text-sm font-bold text-blue-700">{formatIDR(total)}</p>
							{#if method !== 'ewallet' && method !== 'card'}
								<button
									type="button"
									onclick={() => copyText(reference, 'kode')}
									class="mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 hover:bg-white focus-visible:outline-2 focus-visible:outline-blue-600"
								>
									<i class="fa-regular fa-copy" aria-hidden="true"></i>
									{copied === 'kode' ? 'Kode tersalin!' : 'Salin kode'}
								</button>
							{/if}
						</div>
					{/if}

					<ol class="mt-5 space-y-2.5" aria-label="Langkah penyelesaian pembayaran">
						{#each instructionSteps() as step, i (i)}
							<li class="flex items-start gap-2.5 rounded-xl bg-blue-50/60 px-4 py-3 text-sm text-slate-700">
								<span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[11px] font-bold text-white">{i + 1}</span>
								<span>{step}</span>
							</li>
						{/each}
					</ol>

					{#if stage === 'verifying'}
						<p role="status" class="mt-5 flex items-center justify-center gap-2.5 rounded-xl bg-amber-50 px-4 py-4 text-sm font-bold text-amber-800">
							<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i>
							Simulasi verifikasi lokal… belum cek ke bank/server.
						</p>
					{:else}
						<div class="mt-5 flex flex-col gap-2.5 sm:flex-row">
							<button
								type="button"
								onclick={confirmPaid}
								class="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white shadow-lg shadow-blue-600/25 hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
							>
								<i class="fa-solid fa-check-double" aria-hidden="true"></i> Saya Sudah Bayar
							</button>
							<button
								type="button"
								onclick={() => (stage = 'checkout')}
								class="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 text-sm font-bold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600"
							>
								<i class="fa-solid fa-arrow-left" aria-hidden="true"></i> Ganti Metode
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
								<dd class="font-bold">−{formatIDR(discount)}</dd>
							</div>
						{/if}
						<div class="flex justify-between gap-3">
							<dt class="text-slate-500">Biaya layanan</dt>
							<dd class="font-bold text-slate-900">{formatIDR(fee)}</dd>
						</div>
						<div class="flex justify-between gap-3 border-t border-slate-100 pt-3">
							<dt class="font-extrabold text-slate-900">Total</dt>
							<dd class="text-lg font-black text-blue-700">{formatIDR(total)}</dd>
						</div>
					</dl>
					<p class="mt-3 font-mono text-[11px] text-slate-500">Invoice {invoice}</p>
					<p class="mt-3 flex items-center gap-2 text-[11px] text-slate-500">
						<i class="fa-solid fa-shield-halved text-emerald-600" aria-hidden="true"></i>
						Enkripsi TLS · Dana diteruskan ke penyelenggara resmi
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
								<label for="pay-nim" class="mb-1.5 block text-xs font-bold text-slate-700">NIM / ID</label>
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
					<fieldset class="rounded-2xl border border-slate-200/70 bg-white p-5 sm:p-6">
						<legend class="px-1 text-base font-extrabold text-slate-900">
							<span class="mr-2 inline-flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 align-middle text-xs font-black text-white">02</span>
							Metode pembayaran
						</legend>
						<div class="mt-2 grid gap-2.5" role="radiogroup" aria-label="Pilih metode pembayaran">
							{#each PAYMENT_METHODS as m (m.id)}
								<label
									class="flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-all focus-within:ring-4 focus-within:ring-blue-500/15 {method === m.id ? 'border-blue-600 bg-blue-50/60 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60'}"
								>
									<input
										type="radio"
										name="pay-method"
										value={m.id}
										checked={method === m.id}
										onchange={() => selectMethod(m.id)}
										class="h-5 w-5 shrink-0 accent-blue-600"
									/>
									<span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl {method === m.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}">
										<i class="fa-solid {m.icon}" aria-hidden="true"></i>
									</span>
									<span class="min-w-0 flex-1">
										<span class="flex flex-wrap items-center gap-2 text-sm font-bold text-slate-900">
											{m.label}
											{#if m.badge}
												<span class="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700 uppercase">{m.badge}</span>
											{/if}
										</span>
										<span class="block truncate text-xs text-slate-500">{m.description}</span>
									</span>
									<span class="text-xs font-bold text-slate-500">{formatIDR(serviceFee(m.id, subtotal))}</span>
								</label>
							{/each}
						</div>

						<!-- Sub-form per metode -->
						<div class="mt-4 rounded-xl bg-slate-50 p-4">
							{#if method === 'va' || method === 'ewallet' || method === 'retail'}
								<p id="ch-label" class="mb-2 text-xs font-bold text-slate-700">
									Pilih {method === 'va' ? 'bank' : method === 'ewallet' ? 'e-wallet' : 'gerai'}:
								</p>
								<div class="flex flex-wrap gap-2" role="group" aria-labelledby="ch-label">
									{#each (activeMethod?.channels ?? []) as ch (ch.id)}
										<button
											type="button"
											onclick={() => (channel = ch.id)}
											aria-pressed={channel === ch.id}
											class="inline-flex min-h-[44px] items-center gap-2 rounded-xl px-4 text-xs font-bold transition-all active:scale-95 focus-visible:outline-2 focus-visible:outline-blue-600 {channel === ch.id ? 'bg-blue-700 text-white shadow shadow-blue-700/25' : 'border border-slate-200 bg-white text-slate-600 hover:bg-white'}"
										>
											<i class="fa-solid {ch.icon} text-[11px]" aria-hidden="true"></i>
											{ch.label}
										</button>
									{/each}
								</div>
							{/if}

							{#if method === 'ewallet'}
								<div class="mt-3">
									<label for="pay-phone" class="mb-1.5 block text-xs font-bold text-slate-700">Nomor e-wallet aktif</label>
									<input
										id="pay-phone"
										type="tel"
										bind:value={phone}
										autocomplete="tel"
										inputmode="numeric"
										placeholder="08xxxxxxxxxx"
										aria-invalid={phone.replace(/\D/g, '').length < 9}
										aria-describedby="phone-hint"
										class="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
									/>
									<p id="phone-hint" class="mt-1 text-[11px] text-slate-500">Tagihan & OTP dikirim ke nomor ini.</p>
								</div>
							{/if}

							{#if method === 'card'}
								<div class="grid gap-3">
									<div>
										<label for="pay-cardnum" class="mb-1.5 block text-xs font-bold text-slate-700">Nomor kartu</label>
										<input
											id="pay-cardnum"
											type="text"
											value={cardNumber}
											oninput={(e) => formatCardInput(e.currentTarget.value)}
											inputmode="numeric"
											autocomplete="cc-number"
											placeholder="4111 2222 3333 4444"
											maxlength={19}
											class="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 font-mono text-sm tracking-wide focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
										/>
									</div>
									<div>
										<label for="pay-cardname" class="mb-1.5 block text-xs font-bold text-slate-700">Nama di kartu</label>
										<input
											id="pay-cardname"
											type="text"
											bind:value={cardName}
											autocomplete="cc-name"
											class="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm uppercase focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
										/>
									</div>
									<div class="grid grid-cols-2 gap-3">
										<div>
											<label for="pay-exp" class="mb-1.5 block text-xs font-bold text-slate-700">Masa berlaku</label>
											<input
												id="pay-exp"
												type="text"
												value={cardExpiry}
												oninput={(e) => formatExpiryInput(e.currentTarget.value)}
												inputmode="numeric"
												autocomplete="cc-exp"
												placeholder="MM/YY"
												maxlength={5}
												class="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 font-mono text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
											/>
										</div>
										<div>
											<label for="pay-cvv" class="mb-1.5 block text-xs font-bold text-slate-700">CVV</label>
											<input
												id="pay-cvv"
												type="password"
												bind:value={cardCvv}
												inputmode="numeric"
												autocomplete="cc-csc"
												placeholder="123"
												maxlength={4}
												class="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 font-mono text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
											/>
										</div>
									</div>
									<p class="flex items-center gap-1.5 text-[11px] text-slate-500">
										<i class="fa-solid fa-lock text-emerald-600" aria-hidden="true"></i>
										Data kartu terenkripsi & tidak disimpan.
									</p>
								</div>
							{/if}

							{#if method === 'qris'}
								<p class="flex items-start gap-2 text-xs text-slate-600">
									<i class="fa-solid fa-circle-info mt-0.5 text-blue-500" aria-hidden="true"></i>
									Kode QR muncul setelah kamu tekan <strong>&nbsp;Bayar {formatIDR(total)}&nbsp;</strong>. Bisa di-scan dari BCA Mobile, GoPay, OVO, DANA, dan lainnya.
								</p>
							{/if}
						</div>
					</fieldset>

					<!-- 03 Voucher -->
					<section aria-labelledby="h-voucher" class="rounded-2xl border border-slate-200/70 bg-white p-5 sm:p-6">
						<h2 id="h-voucher" class="flex items-center gap-2.5 text-base font-extrabold text-slate-900">
							<span class="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-xs font-black text-white">03</span>
							Voucher promo
						</h2>
						{#if appliedVoucher}
							<div class="mt-3 flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
								<p class="text-sm font-bold text-emerald-800">
									<i class="fa-solid fa-ticket mr-1.5" aria-hidden="true"></i>
									{appliedVoucher.code} · hemat {formatIDR(discount)}
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
							<form class="mt-3 flex gap-2" onsubmit={(e) => { e.preventDefault(); applyVoucher(); }}>
								<label for="pay-voucher" class="sr-only">Kode voucher</label>
								<input
									id="pay-voucher"
									type="text"
									bind:value={voucherCode}
									placeholder="Punya kode? Coba HEMAT20"
									autocomplete="off"
									aria-invalid={voucherError.length > 0}
									aria-describedby={voucherError ? 'voucher-err' : undefined}
									class="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 font-mono text-sm uppercase placeholder:font-sans placeholder:normal-case focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
								/>
								<button
									type="submit"
									class="inline-flex min-h-[44px] shrink-0 items-center rounded-xl bg-blue-600 px-5 text-xs font-bold text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
								>
									Pakai
								</button>
							</form>
							{#if voucherError}
								<p id="voucher-err" role="alert" class="mt-2 text-xs font-semibold text-red-600">{voucherError}</p>
							{/if}
							<div class="mt-2.5 flex flex-wrap gap-1.5">
								<span class="text-[11px] text-slate-500">Saran:</span>
								{#each ['HEMAT20', 'PELAJAR10', 'BARU15'] as v (v)}
									<button
										type="button"
										onclick={() => { voucherCode = v; applyVoucher(); }}
										class="rounded-full border border-dashed border-blue-300 bg-blue-50 px-2.5 py-1 font-mono text-[11px] font-bold text-blue-700 hover:bg-blue-100 focus-visible:outline-2 focus-visible:outline-blue-600"
									>
										{v}
									</button>
								{/each}
							</div>
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
							Bayar {formatIDR(total)}
						</button>
						<p id="bayar-hint" class="mt-2 text-center text-[11px] text-slate-500">
							{#if !agree}
								Centang persetujuan dulu untuk mengaktifkan tombol bayar.
							{:else}
								Kamu akan diarahkan ke instruksi {methodLabel(method, channel)}.
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
									<dd class="font-bold">−{formatIDR(discount)}</dd>
								</div>
							{/if}
							<div class="flex justify-between gap-3">
								<dt class="text-slate-500">Biaya layanan</dt>
								<dd class="font-bold text-slate-900">{formatIDR(fee)}</dd>
							</div>
							<div class="flex items-baseline justify-between gap-3 border-t border-slate-200 pt-2.5">
								<dt class="font-extrabold text-slate-900">Total</dt>
								<dd class="text-xl font-black text-blue-700">{formatIDR(total)}</dd>
							</div>
						</dl>
						<p class="flex items-center justify-center gap-2 text-[11px] font-semibold text-slate-500">
							<i class="fa-solid fa-shield-halved text-emerald-600" aria-hidden="true"></i>
							Simulasi — tanpa transaksi bank sungguhan.
						</p>
					</div>
				</aside>
			</div>
		{/if}
	{/if}
</div>
