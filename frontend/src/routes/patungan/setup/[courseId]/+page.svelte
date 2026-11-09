<script lang="ts">
	import '../../../../app.css';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import PublicHeader from '$lib/components/public/PublicHeader.svelte';
	import PublicFooter from '$lib/components/public/PublicFooter.svelte';
	import SeoHead from '$lib/components/SeoHead.svelte';
	import { canonicalPath } from '$lib/seo/site';
	import { reveal } from '$lib/actions/reveal';
	import { fetchCourseDetail, type BackendCourse } from '$lib/api/courses';
	import { fetchPromos } from '$lib/api/promos';
	import {
		createPatunganGroup,
		validatePatunganMembers,
		type ValidateMemberRow
	} from '$lib/api/patungan';
	import { getAccessToken, getCurrentUser } from '$lib/stores/auth.svelte';
	import { formatIDR } from '$lib/data/payment';
	import { PATUNGAN_MAX_ANGGOTA, PATUNGAN_MIN_ANGGOTA } from '$lib/stores/patungan.svelte';

	let { data, params }: { data: { origin: string; initialCount: number }; params: { courseId: string } } =
		$props();

	// svelte-ignore state_referenced_locally -- id rute statis per navigasi; reload halaman bila berpindah kursus
	const courseId = Number(params.courseId);
	const loggedIn = $derived(browser && getAccessToken() !== null);

	let course = $state<BackendCourse | null>(null);
	let courseError = $state('');
	let eligible = $state<boolean | null>(null);
	let campaignTitle = $state('');

	// svelte-ignore state_referenced_locally -- seed SSR: snapshot awal, update via interaksi
	let anggota = $state(data.initialCount);
	// svelte-ignore state_referenced_locally -- seed SSR: snapshot awal, update via interaksi
	let usernames = $state<string[]>(Array.from({ length: data.initialCount - 1 }, () => ''));
	let rows = $state<ValidateMemberRow[]>([]);
	let ready = $state(false);
	let shares = $state<Record<string, number>>({});
	let creatorShare = $state(0);
	let totalNominal = $state(0);
	let formCode = $state('');
	let formMessage = $state('');
	let checking = $state(false);
	let submitting = $state(false);
	let checkSeq = 0;

	const CODE_MESSAGE: Record<string, string> = {
		USER_NOT_FOUND: 'Ada username yang belum terdaftar. Minta mereka daftar dulu.',
		ALREADY_HAS_ACCESS: 'Ada username yang sudah punya akses kursus ini.',
		PAYMENT_QUEUE_OPEN: 'Ada anggota yang masih punya pembayaran menunggu di kursus ini.',
		GROUP_ALREADY_PENDING: 'Ada anggota yang masih terikat grup patungan pending di kursus ini.',
		MEMBER_DUPLICATE: 'Ada username yang ditulis dua kali.',
		MEMBER_COUNT_INVALID: `Jumlah anggota harus ${PATUNGAN_MIN_ANGGOTA}–${PATUNGAN_MAX_ANGGOTA} orang termasuk kamu.`,
		SELF_INCLUDED: 'Usernamemu sendiri tidak perlu ditulis — kamu otomatis anggota #1.',
		USERNAME_INVALID: 'Ada username yang formatnya salah (3–30 karakter: huruf kecil, angka, titik, _, -).',
		COURSE_NOT_ELIGIBLE: 'Kursus ini tidak masuk promo patungan aktif.',
		COURSE_FREE: 'Patungan hanya untuk kursus berbayar.',
		COURSE_NOT_FOUND: 'Kursus tidak ditemukan.',
		ENROLLMENT_CLOSED: 'Pendaftaran kursus ini sudah ditutup.'
	};

	function setAnggota(n: number): void {
		anggota = Math.min(PATUNGAN_MAX_ANGGOTA, Math.max(PATUNGAN_MIN_ANGGOTA, n));
		const need = anggota - 1;
		if (usernames.length < need) {
			usernames = [...usernames, ...Array.from({ length: need - usernames.length }, () => '')];
		} else if (usernames.length > need) {
			usernames = usernames.slice(0, need);
		}
	}

	async function loadCourse(): Promise<void> {
		if (!Number.isInteger(courseId) || courseId <= 0) {
			courseError = 'ID kursus tidak valid.';
			return;
		}
		try {
			const [c, promos] = await Promise.all([fetchCourseDetail(courseId), fetchPromos()]);
			course = c;
			const camp = promos.find((p) => p.type === 'patungan' && p.courses.some((m) => m.courseId === courseId));
			eligible = camp !== undefined;
			campaignTitle = camp?.title ?? '';
			if (!eligible) {
				formCode = 'COURSE_NOT_ELIGIBLE';
				formMessage = CODE_MESSAGE.COURSE_NOT_ELIGIBLE ?? 'Kursus tidak eligible.';
			}
		} catch (e) {
			courseError = e instanceof Error ? e.message : 'Gagal memuat kursus.';
		}
	}

	async function checkNow(): Promise<void> {
		const my = ++checkSeq;
		const filled = usernames.map((u) => u.trim()).filter((u) => u.length > 0);
		if (!loggedIn || filled.length === 0 || !eligible) {
			ready = false;
			return;
		}
		checking = true;
		try {
			const res = await validatePatunganMembers(courseId, usernames.map((u) => u.trim()));
			if (my !== checkSeq) return;
			rows = res.members;
			if (res.ready) {
				ready = true;
				shares = res.shares ?? {};
				creatorShare = res.creatorShare ?? 0;
				totalNominal = res.total ?? 0;
				formCode = '';
				formMessage = '';
			} else {
				ready = false;
				formCode = res.error?.code ?? '';
				formMessage = (res.error?.code && CODE_MESSAGE[res.error.code]) || res.error?.message || 'Belum bisa dibuat.';
			}
		} catch (e) {
			if (my !== checkSeq) return;
			ready = false;
			formCode = '';
			formMessage = e instanceof Error ? e.message : 'Gagal memeriksa username.';
		} finally {
			if (my === checkSeq) checking = false;
		}
	}

	let debounce: ReturnType<typeof setTimeout> | undefined;
	function scheduleCheck(): void {
		if (debounce) clearTimeout(debounce);
		debounce = setTimeout(() => void checkNow(), 450);
	}

	async function submit(): Promise<void> {
		formCode = '';
		formMessage = '';
		if (!ready) return;
		submitting = true;
		try {
			const group = await createPatunganGroup(
				courseId,
				usernames.map((u) => u.trim())
			);
			await goto(resolve(`/patungan/${group.id}`));
		} catch (e) {
			const msg = e instanceof Error ? e.message : 'Gagal membuat grup.';
			// Petakan kode backend bila tersedia.
			const code = (e as { code?: string }).code;
			formCode = code ?? '';
			formMessage = (code && CODE_MESSAGE[code]) || msg;
			await checkNow();
		} finally {
			submitting = false;
		}
	}

	$effect(() => {
		if (!browser) return;
		void loadCourse();
	});

	// Cek ulang saat daftar username / jumlah anggota berubah.
	$effect(() => {
		if (!browser) return;
		void usernames;
		void anggota;
		if (course && eligible && loggedIn) scheduleCheck();
	});
</script>

<SeoHead
	title="Buat Grup Patungan — ARISTOTELES"
	description="Buat grup patungan: masukkan username anggota, sistem memeriksa keberadaannya sebelum grup tersimpan."
	path={`/patungan/setup/${params.courseId}`}
	origin={data.origin}
/>

<PublicHeader active="promo" />

<main class="bg-ice/60">
	<div class="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
		<nav aria-label="Kembali" class="mb-6">
			<a href={resolve('/promo#patungan')} class="inline-flex min-h-[44px] items-center gap-2 font-heading text-sm font-bold text-royal hover:text-royal-hover">
				<i class="fa-solid fa-arrow-left text-xs" aria-hidden="true"></i> Kembali ke Promo
			</a>
		</nav>

		<div use:reveal class="overflow-hidden rounded-2xl border border-mist bg-white shadow-xl shadow-slate-900/5">
			<div class="border-b border-mist bg-abyss px-6 py-6 text-white sm:px-8">
				<p class="flex items-center gap-2 font-heading text-[11px] font-bold tracking-[0.18em] text-teal uppercase">
					<i class="fa-solid fa-people-group" aria-hidden="true"></i> Setup Patungan
				</p>
				<h1 class="mt-2 font-heading text-2xl font-extrabold sm:text-3xl">Buat Grup Patungan</h1>
				{#if course}
					<p class="mt-1 text-sm text-slate-300">{course.title} · {course.priceLabel}</p>
				{/if}
				{#if campaignTitle}
					<p class="mt-1 text-xs text-teal">Promo: {campaignTitle}</p>
				{/if}
			</div>

			<div class="space-y-6 px-6 py-6 sm:px-8">
				{#if courseError}
					<div role="alert" class="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
						<p class="font-heading text-sm font-bold text-red-700">Kursus tidak dapat dimuat</p>
						<p class="mx-auto mt-1 max-w-md text-xs text-red-600">{courseError}</p>
					</div>
				{:else if eligible === false}
					<div class="rounded-2xl border border-dashed border-mist bg-white p-8 text-center">
						<p class="font-heading text-sm font-bold text-abyss">Kursus ini tidak masuk promo patungan.</p>
						<p class="mx-auto mt-1 max-w-md text-sm text-slate-500">Hanya kursus yang dipilih admin yang bisa ikut patungan.</p>
						<a href={resolve('/promo#patungan')} class="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-royal px-6 py-2.5 font-heading text-xs font-bold text-white hover:bg-royal-hover">
							Lihat promo patungan
						</a>
					</div>
				{:else if !loggedIn}
					<div class="rounded-2xl border border-dashed border-mist bg-white p-8 text-center">
						<p class="font-heading text-sm font-bold text-abyss">Masuk dulu untuk buat grup.</p>
						<p class="mx-auto mt-1 max-w-md text-sm text-slate-500">Pembuat grup otomatis jadi anggota #1, jadi kami perlu tahu siapa kamu. Setelah masuk, kamu kembali ke sini.</p>
						<a href={resolve(`/login?returnTo=${encodeURIComponent(`/patungan/setup/${params.courseId}?n=${anggota}`)}`)} class="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-royal px-6 py-2.5 font-heading text-xs font-bold text-white hover:bg-royal-hover">
							Masuk & kembali ke setup <i class="fa-solid fa-arrow-right text-xs" aria-hidden="true"></i>
						</a>
					</div>
				{:else}
					<!-- Jumlah anggota -->
					<div>
						<span id="setup-count-label" class="mb-1.5 block font-heading text-xs font-bold tracking-wider text-slate-500 uppercase">
							Jumlah anggota ({PATUNGAN_MIN_ANGGOTA}–{PATUNGAN_MAX_ANGGOTA}, termasuk kamu)
						</span>
						<div class="flex items-center gap-3" role="group" aria-labelledby="setup-count-label">
							<button type="button" onclick={() => { setAnggota(anggota - 1); scheduleCheck(); }} disabled={anggota <= PATUNGAN_MIN_ANGGOTA} aria-label="Kurangi anggota" class="flex h-11 w-11 items-center justify-center rounded-xl border border-mist bg-white text-abyss transition hover:border-royal hover:text-royal disabled:cursor-not-allowed disabled:opacity-40">
								<i class="fa-solid fa-minus" aria-hidden="true"></i>
							</button>
							<span class="min-w-10 text-center text-xl font-black tabular-nums" aria-live="polite">{anggota} orang</span>
							<button type="button" onclick={() => { setAnggota(anggota + 1); scheduleCheck(); }} disabled={anggota >= PATUNGAN_MAX_ANGGOTA} aria-label="Tambah anggota" class="flex h-11 w-11 items-center justify-center rounded-xl border border-mist bg-white text-abyss transition hover:border-royal hover:text-royal disabled:cursor-not-allowed disabled:opacity-40">
								<i class="fa-solid fa-plus" aria-hidden="true"></i>
							</button>
							{#if totalNominal > 0 && ready}
								<p class="ml-auto text-right text-xs text-slate-500">
									<span class="block text-[11px] uppercase">Total {formatIDR(totalNominal)}</span>
									<span class="font-heading text-base font-extrabold text-abyss">Iuranmu {formatIDR(creatorShare)}</span>
								</p>
							{/if}
						</div>
					</div>

					<!-- Anggota #1 = kamu -->
					<div class="flex items-center gap-3 rounded-2xl border border-teal/30 bg-teal/5 px-4 py-3">
						<span class="flex h-9 w-9 items-center justify-center rounded-xl bg-teal/15 font-heading text-sm font-extrabold text-teal" aria-hidden="true">1</span>
						<div class="min-w-0">
							<p class="truncate text-sm font-bold text-abyss">
								{getCurrentUser()?.username ?? getCurrentUser()?.name ?? 'Kamu'} (anggota #1, otomatis)
							</p>
							<p class="text-xs text-slate-500">Tidak perlu mengetik usernamemu sendiri.</p>
						</div>
					</div>

					<!-- Username anggota lain -->
					<fieldset>
						<legend class="mb-1.5 font-heading text-xs font-bold tracking-wider text-slate-500 uppercase">
							Username anggota lain
						</legend>
						<div class="space-y-2.5">
							{#each usernames as uname, i (i)}
								{@const row = rows.find((r) => r.username === uname.trim().toLowerCase())}
								<div>
									<label for={`patungan-user-${i}`} class="sr-only">Username anggota {i + 2}</label>
									<div class="relative">
										<span class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400" aria-hidden="true">
											<i class="fa-solid fa-at text-xs"></i>
										</span>
										<input
											id={`patungan-user-${i}`}
											type="text"
											bind:value={usernames[i]}
											oninput={scheduleCheck}
											autocomplete="off"
											maxlength={30}
											placeholder={`username anggota ${i + 2}`}
											class="w-full rounded-xl border border-mist bg-white py-2.5 pr-11 pl-10 text-sm font-semibold text-abyss placeholder:font-normal placeholder:text-slate-400 focus:border-royal focus:outline-none"
										/>
										<span class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4" aria-hidden="true">
											{#if checking}
												<i class="fa-solid fa-circle-notch fa-spin text-xs text-slate-400"></i>
											{:else if row && uname.trim()}
												{#if row.exists}
													<i class="fa-solid fa-circle-check text-sm text-teal" title={row.displayName ?? 'Terdaftar'}></i>
												{:else}
													<i class="fa-solid fa-circle-xmark text-sm text-red-500" title="Belum terdaftar"></i>
												{/if}
											{/if}
										</span>
									</div>
									{#if row && uname.trim()}
										<p class="mt-1 text-xs {row.exists ? 'text-slate-500' : 'font-semibold text-red-600'}">
											{#if row.exists}
												{row.displayName} · iuran {formatIDR(shares[row.username] ?? 0)}
											{:else}
												Username belum terdaftar — minta mereka daftar dulu.
											{/if}
										</p>
									{/if}
								</div>
							{/each}
						</div>
					</fieldset>

					{#if formMessage}
						<div role="alert" class="rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-2.5 text-xs font-semibold text-amber-800">
							{formMessage}
						</div>
					{/if}

					<button
						type="button"
						onclick={() => void submit()}
						disabled={!ready || submitting}
						class="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-royal px-5 font-heading text-sm font-bold text-white transition-colors duration-200 hover:bg-royal-hover disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-royal"
					>
						{#if submitting}
							<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i> Membuat grup…
						{:else}
							<i class="fa-solid fa-people-group" aria-hidden="true"></i> Buat Grup & Masuk Database
						{/if}
					</button>
					<p class="text-center text-[11px] leading-relaxed text-slate-500">
						Grup tersimpan sebagai pending. Tiap anggota membayar iurannya sendiri;
						akses dibuka setelah semua lunas.
					</p>
				{/if}
			</div>
		</div>
	</div>
</main>

<PublicFooter />
