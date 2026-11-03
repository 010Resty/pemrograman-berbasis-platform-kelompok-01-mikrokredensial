<script lang="ts">
	import { resolve } from '$app/paths';
	import type { BackendCourse } from '$lib/api/courses';
	import { formatIDR, serviceFee } from '$lib/data/payment';
	import {
		PATUNGAN_MAX_ANGGOTA,
		PATUNGAN_MIN_ANGGOTA,
		createPatunganGroup,
		hapusGrupPatungan,
		hitungPatungan,
		listGrupPatungan,
		toggleAnggotaLunas
	} from '$lib/stores/patungan.svelte';

	interface Props {
		/** Kursus kandidat dari katalog publik (hanya yang berbayar yang dipakai). */
		courses: BackendCourse[];
		loading: boolean;
	}

	let { courses, loading }: Props = $props();

	const paidCourses = $derived(courses.filter((c) => (c.priceNominal ?? 0) > 0));

	let courseId = $state<number | null>(null);
	let anggota = $state(3);
	let names = $state<string[]>(['', '', '']);
	let formError = $state('');
	let groupsVersion = $state(0);

	const selected = $derived(
		paidCourses.find((c) => c.id === Number(courseId)) ?? paidCourses[0] ?? null
	);
	const price = $derived(selected?.priceNominal ?? 0);
	const fee = $derived(serviceFee('qris', price));
	const split = $derived(hitungPatungan(price, fee, anggota));
	// Baca ulang daftar grup setiap ada perubahan (store non-reaktif di level array).
	const groups = $derived((void groupsVersion, listGrupPatungan()));

	// Sinkronkan jumlah input nama + pilihan kursus default.
	$effect(() => {
		if (courseId === null && paidCourses.length > 0) courseId = paidCourses[0].id;
		if (names.length !== anggota) {
			const next = Array.from({ length: anggota }, (_, i) => names[i] ?? '');
			names = next;
		}
	});

	function setAnggota(n: number): void {
		anggota = Math.min(PATUNGAN_MAX_ANGGOTA, Math.max(PATUNGAN_MIN_ANGGOTA, n));
		formError = '';
	}

	function buatGrup(): void {
		formError = '';
		if (!selected) {
			formError = 'Pilih dulu pelatihan berbayar yang ingin diikuti patungan.';
			return;
		}
		const g = createPatunganGroup({
			courseId: selected.id,
			courseTitle: selected.title,
			priceNominal: price,
			feeNominal: fee,
			memberNames: names
		});
		if (!g) {
			formError = `Isi ${anggota} nama anggota yang berbeda (tanpa nama kosong/duplikat). Patungan hanya untuk pelatihan berbayar.`;
			return;
		}
		names = Array.from({ length: anggota }, () => '');
		groupsVersion += 1;
		document.getElementById(`grup-${g.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
	}
</script>

<section id="patungan" aria-labelledby="patungan-heading" class="scroll-mt-20 bg-abyss py-20 text-white">
	<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
		<div class="mx-auto mb-10 max-w-2xl space-y-3 text-center">
			<span class="rounded-full bg-white/10 px-3 py-1 text-xs font-bold tracking-widest text-ice uppercase"><i class="fa-solid fa-people-group" aria-hidden="true"></i> Promo Patungan</span>
			<h2 id="patungan-heading" class="text-3xl font-extrabold sm:text-4xl">Satu Pelatihan, Bayar Patungan</h2>
			<p class="text-sm text-slate-300">
				Ajak {PATUNGAN_MIN_ANGGOTA}–{PATUNGAN_MAX_ANGGOTA} teman dalam satu grup, total harga dibagi rata per orang.
				Kalkulator di bawah memakai nominal katalog + biaya layanan QRIS sebagai acuan.
			</p>
			<p role="note" class="mx-auto max-w-xl rounded-xl border border-amber-300/30 bg-amber-400/10 px-4 py-2.5 text-xs font-semibold text-amber-200">
				Simulasi lokal — grup &amp; status lunas hanya tersimpan di browser dan belum membuka akses kursus untuk siapa pun. Akses resmi tetap per akun lewat pembayaran terverifikasi (butuh backend).
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
				<p class="text-sm font-semibold text-white">Belum ada pelatihan berbayar untuk patungan.</p>
				<p class="mx-auto mt-1 max-w-md text-xs text-slate-400">Katalog saat ini tidak memuat harga, atau belum termuat. Coba muat ulang halaman.</p>
			</div>
		{:else}
			<div class="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
				<!-- Kalkulator + form grup -->
				<form
					aria-label="Kalkulator dan pembuat grup patungan"
					class="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur sm:p-8"
					onsubmit={(e) => {
						e.preventDefault();
						buatGrup();
					}}
				>
					<div>
						<label for="patungan-course" class="mb-1.5 block text-xs font-bold tracking-wide text-slate-300 uppercase">Pelatihan</label>
						<select
							id="patungan-course"
							bind:value={courseId}
							class="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white focus:border-ice focus:outline-none"
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
								<span class="block text-[11px] uppercase">Iuran per orang</span>
								<span class="text-lg font-black text-ice">{formatIDR(split.perPerson)}</span>
							</p>
						</div>
						<p class="mt-1 text-[11px] text-slate-400">
							Total {formatIDR(split.total)} (harga + biaya layanan QRIS {formatIDR(fee)}) ÷ {anggota}, dibulatkan ke atas.
						</p>
					</div>

					<fieldset class="mt-4">
						<legend class="mb-1.5 text-xs font-bold tracking-wide text-slate-300 uppercase">Nama anggota</legend>
						<div class="grid gap-2 sm:grid-cols-2">
							{#each names as name, i (i)}
								<div>
									<label for={`patungan-nama-${i}`} class="sr-only">Nama anggota {i + 1}</label>
									<input
										id={`patungan-nama-${i}`}
										type="text"
										bind:value={names[i]}
										placeholder={`Anggota ${i + 1}`}
										autocomplete="off"
										maxlength={60}
										class="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-ice focus:outline-none"
									/>
								</div>
							{/each}
						</div>
					</fieldset>

					{#if formError}
						<p role="alert" class="mt-3 rounded-xl border border-red-300/30 bg-red-500/10 px-4 py-2.5 text-xs font-semibold text-red-200">{formError}</p>
					{/if}

					<button
						type="submit"
						class="mt-4 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-royal px-5 text-sm font-extrabold text-white shadow-lg shadow-royal/25 transition duration-200 hover:bg-royal-hover active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ice"
					>
						<i class="fa-solid fa-people-group" aria-hidden="true"></i>
						Buat Grup Patungan
					</button>
					{#if selected}
						<p class="mt-3 text-center text-[11px] text-slate-400">
							Untuk {selected.title} —
							<a href={resolve(`/modules/${selected.id}`)} class="font-bold text-ice underline decoration-ice/40 underline-offset-4 hover:text-white">lihat detail pelatihan</a>
						</p>
					{/if}
				</form>

				<!-- Daftar grup simulasi -->
				<div aria-live="polite" class="space-y-4">
					<h3 class="text-sm font-extrabold tracking-wide text-slate-200 uppercase">
						Grup patunganmu (simulasi) — {groups.length}
					</h3>
					{#if groups.length === 0}
						<div class="rounded-2xl border border-dashed border-white/20 bg-white/5 p-8 text-center">
							<p class="text-sm font-semibold text-white">Belum ada grup.</p>
							<p class="mx-auto mt-1 max-w-sm text-xs text-slate-400">Buat grup pertama lewat kalkulator di samping — tersimpan otomatis di browser ini.</p>
						</div>
					{:else}
						<ul class="space-y-4">
							{#each groups as g (g.id)}
								{@const lunas = g.members.filter((m) => m.paid).length}
								<li id={`grup-${g.id}`} class="scroll-mt-24 rounded-2xl border border-white/10 bg-white/5 p-5">
									<div class="flex flex-wrap items-center justify-between gap-2">
										<p class="font-mono text-xs font-bold text-ice">{g.code}</p>
										<button
											type="button"
											onclick={() => {
												hapusGrupPatungan(g.id);
												groupsVersion += 1;
											}}
											aria-label={`Hapus grup ${g.code}`}
											class="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-[11px] font-bold text-slate-300 transition hover:bg-white/10 hover:text-white"
										>
											<i class="fa-solid fa-trash" aria-hidden="true"></i> Hapus
										</button>
									</div>
									<p class="mt-1 text-sm font-extrabold text-white">{g.courseTitle}</p>
									<p class="mt-0.5 text-xs text-slate-300">
										Total {formatIDR(g.totalNominal)} · <span class="font-bold text-ice">{formatIDR(g.perPerson)}/orang</span> · {lunas}/{g.members.length} lunas (simulasi)
									</p>
									<div class="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10" role="img" aria-label={`${lunas} dari ${g.members.length} anggota lunas (simulasi)`}>
										<div class="h-full rounded-full bg-ice" style="width:{(lunas / g.members.length) * 100}%"></div>
									</div>
									<ul class="mt-3 space-y-1.5">
										{#each g.members as m, i (i)}
											<li>
												<label class="flex cursor-pointer items-center gap-2.5 rounded-xl bg-white/5 px-3 py-2 text-xs transition duration-200 hover:bg-white/10">
													<input
														type="checkbox"
														checked={m.paid}
														onchange={() => {
															toggleAnggotaLunas(g.id, i);
															groupsVersion += 1;
														}}
														class="h-4 w-4 shrink-0 accent-royal"
													/>
													<span class="flex-1 font-semibold {m.paid ? 'text-slate-400 line-through' : 'text-white'}">{m.name}</span>
													<span class="font-bold tabular-nums {m.paid ? 'text-emerald-300' : 'text-slate-300'}">
														{m.paid ? 'Lunas' : formatIDR(g.perPerson)}
													</span>
												</label>
											</li>
										{/each}
									</ul>
								</li>
							{/each}
						</ul>
					{/if}
				</div>
			</div>
		{/if}
	</div>
</section>
