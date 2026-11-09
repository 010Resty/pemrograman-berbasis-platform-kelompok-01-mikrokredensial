<script lang="ts">
	import { resolve } from '$app/paths';
	import type { BackendCourse } from '$lib/api/courses';
	import { formatIDR } from '$lib/data/payment';
	import {
		PATUNGAN_MAX_ANGGOTA,
		PATUNGAN_MIN_ANGGOTA,
		hitungPatungan
	} from '$lib/stores/patungan.svelte';

	interface Props {
		/** Kursus anggota promo patungan aktif saja (tanpa fallback). */
		courses: BackendCourse[];
		loading: boolean;
	}

	let { courses, loading }: Props = $props();

	const paidCourses = $derived(courses.filter((c) => (c.priceNominal ?? 0) > 0));

	let courseId = $state<number | null>(null);
	let anggota = $state(3);

	const selected = $derived(
		paidCourses.find((c) => c.id === Number(courseId)) ?? paidCourses[0] ?? null
	);
	const price = $derived(selected?.priceNominal ?? 0);
	// Tanpa fee fiktif: antrean manual tidak membebankan biaya layanan ke peserta.
	// Nominal resmi ditetapkan server saat grup dibuat.
	const split = $derived(hitungPatungan(price, 0, anggota));

	// Sinkronkan pilihan kursus default.
	$effect(() => {
		if (courseId === null && paidCourses.length > 0) courseId = paidCourses[0].id;
	});

	function setAnggota(n: number): void {
		anggota = Math.min(PATUNGAN_MAX_ANGGOTA, Math.max(PATUNGAN_MIN_ANGGOTA, n));
	}
</script>

<section id="patungan" aria-labelledby="patungan-heading" class="scroll-mt-20 bg-abyss py-20 text-white">
	<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
		<div class="mx-auto mb-10 max-w-2xl space-y-3 text-center">
			<span class="rounded-full bg-white/10 px-3 py-1 text-xs font-bold tracking-widest text-ice uppercase"><i class="fa-solid fa-people-group" aria-hidden="true"></i> Promo Patungan</span>
			<h2 id="patungan-heading" class="text-3xl font-extrabold sm:text-4xl">Satu Pelatihan, Bayar Patungan</h2>
			<p class="text-sm text-slate-300">
				Bentuk grup {PATUNGAN_MIN_ANGGOTA}–{PATUNGAN_MAX_ANGGOTA} orang, tiap anggota membayar iurannya
				sendiri-sendiri. Akses kursus dibuka untuk semua setelah <strong class="text-white">semua lunas</strong> —
				tanpa akses parsial.
			</p>
			<p role="note" class="mx-auto max-w-xl rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-xs font-semibold text-slate-200">
				Anggota diidentifikasi lewat <strong class="text-white">username</strong> dan wajib sudah punya akun.
				Iuran resmi dihitung server saat grup dibuat.
			</p>
		</div>

		{#if loading}
			<div class="grid grid-cols-1 gap-6 lg:grid-cols-2" aria-label="Memuat kalkulator patungan">
				<div class="h-64 animate-pulse rounded-2xl bg-white/5"></div>
				<div class="h-64 animate-pulse rounded-2xl bg-white/5"></div>
			</div>
		{:else if paidCourses.length === 0}
			<div class="rounded-2xl border border-dashed border-white/20 bg-white/5 p-12 text-center">
				<i class="fa-solid fa-people-group mb-3 text-3xl text-slate-500" aria-hidden="true"></i>
				<p class="text-sm font-semibold text-white">Belum ada pelatihan promo patungan.</p>
				<p class="mx-auto mt-1 max-w-md text-xs text-slate-400">Promo patungan hanya untuk kursus yang dipilih admin. Cek lagi nanti.</p>
			</div>
		{:else}
			<div class="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
				<!-- Estimator -->
				<div class="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur sm:p-8">
					<div>
						<label for="patungan-course" class="mb-1.5 block text-xs font-bold tracking-wide text-slate-300 uppercase">Pelatihan</label>
						<select
							id="patungan-course"
							bind:value={courseId}
							style="color-scheme: dark"
							class="w-full rounded-xl border border-white/15 bg-abyss px-4 py-2.5 text-sm font-semibold text-white focus:border-ice focus:outline-none"
						>
							{#each paidCourses as c (c.id)}
								<option value={c.id}>{c.title} — {c.priceLabel}</option>
							{/each}
						</select>
					</div>

					<div class="mt-4">
						<span id="patungan-count-label" class="mb-1.5 block text-xs font-bold tracking-wide text-slate-300 uppercase">Jumlah anggota ({PATUNGAN_MIN_ANGGOTA}–{PATUNGAN_MAX_ANGGOTA})</span>
						<div class="flex items-center gap-3" role="group" aria-labelledby="patungan-count-label">
							<button
								type="button"
								onclick={() => setAnggota(anggota - 1)}
								disabled={anggota <= PATUNGAN_MIN_ANGGOTA}
								aria-label="Kurangi anggota"
								class="flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
							>
								<i class="fa-solid fa-minus" aria-hidden="true"></i>
							</button>
							<span class="min-w-10 text-center text-2xl font-black tabular-nums" aria-live="polite">{anggota} orang</span>
							<button
								type="button"
								onclick={() => setAnggota(anggota + 1)}
								disabled={anggota >= PATUNGAN_MAX_ANGGOTA}
								aria-label="Tambah anggota"
								class="flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
							>
								<i class="fa-solid fa-plus" aria-hidden="true"></i>
							</button>
							<p class="ml-auto text-right text-xs text-slate-300">
								<span class="block text-[11px] uppercase">Estimasi iuran per orang</span>
								<span class="text-lg font-black text-ice">{formatIDR(split.perPerson)}</span>
							</p>
						</div>
						<p class="mt-1 text-[11px] text-slate-400">
							Estimasi {formatIDR(split.total)} (harga katalog ÷ {anggota}), dibulatkan ke atas.
							Nominal resmi ditetapkan server saat grup dibuat.
						</p>
					</div>

					{#if selected}
						<a
							href={resolve(`/patungan/setup/${selected.id}?n=${anggota}`)}
							class="mt-6 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-royal px-5 text-sm font-extrabold text-white shadow-lg shadow-royal/25 transition duration-200 hover:bg-royal-hover active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ice"
						>
							<i class="fa-solid fa-people-group" aria-hidden="true"></i>
							Lanjut Buat Grup Patungan
						</a>
						<div class="mt-3 flex items-center justify-center gap-4 text-[11px]">
							<a href={resolve(`/modules/${selected.id}`)} class="font-bold text-ice underline decoration-ice/40 underline-offset-4 hover:text-white">Lihat detail pelatihan</a>
							<span aria-hidden="true" class="text-slate-500">·</span>
							<a href={resolve('/patungan/saya')} class="font-bold text-ice underline decoration-ice/40 underline-offset-4 hover:text-white">Grup patunganku</a>
						</div>
					{/if}
				</div>

				<!-- Cara kerja -->
				<div class="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur sm:p-8">
					<h3 class="font-heading text-base font-extrabold text-white">Cara kerja patungan</h3>
					<ol class="mt-4 space-y-4">
						{#each [{ t: 'Bentuk grup', d: 'Pilih pelatihan promo patungan, tentukan 2–15 anggota. Kamu otomatis jadi anggota #1.' }, { t: 'Masukkan username anggota', d: 'Setiap username dicek ke server — hanya akun yang benar-benar ada yang bisa ikut.' }, { t: 'Tiap anggota bayar sendiri', d: 'Iuran per orang dihitung server. Unggah bukti bayar masing-masing untuk diverifikasi admin.' }, { t: 'Semua lunas → akses dibuka', d: 'Akses kursus diberikan ke seluruh anggota sekaligus. Sebagian lunas = belum ada akses.' }] as s, i (s.t)}
							<li class="flex items-start gap-3.5">
								<span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-ice/15 font-heading text-sm font-extrabold text-ice" aria-hidden="true">{i + 1}</span>
								<div>
									<p class="text-sm font-bold text-white">{s.t}</p>
									<p class="mt-0.5 text-xs leading-relaxed text-slate-300">{s.d}</p>
								</div>
							</li>
						{/each}
					</ol>
				</div>
			</div>
		{/if}
	</div>
</section>
