<script lang="ts">
	import { goto } from '$app/navigation';
	import { formatIDR } from '$lib/data/payment';
	import MonthPicker from '$lib/components/MonthPicker.svelte';
	import { createCourse } from '$lib/api/courses';
	import { invalidateMyCourses } from '$lib/stores/instructor-courses.svelte';
	import { uploadFile } from '$lib/api/uploads';
	import { BackendRequestError } from '$lib/api/backend';

	const CATEGORIES = [
		'Pengembangan Web',
		'Basis Data',
		'Jaringan',
		'Keamanan',
		'AI & Data',
		'Infrastruktur',
		'Desain',
		'Bisnis'
	];
	const LEVELS = ['Pemula', 'Menengah', 'Lanjutan'];

	let submitted = $state(false);
	let errorSummaryEl = $state<HTMLElement | null>(null);

	// ---- Satu-satunya langkah: info dasar + hasil + langsung upcoming ----
	let title = $state('');
	let category = $state('');
	let level = $state('Pemula');
	/** Durasi dalam bulan (digit saja). */
	let durationMonths = $state('');
	let description = $state('');
	let coverPreview = $state('');
	/** Periode selalu upcoming; instruktur wajib mengisi bulan mulai. */
	const period = 'upcoming' as const;
	let startMonth = $state('');
	/** Harga dalam rupiah (digit saja, tanpa "Rp"). 0 = GRATIS. */
	let priceDigits = $state('');
	let outcomes = $state<string[]>(['', '']);
	/** Alat / tools yang harus dipersiapkan peserta. */
	let tools = $state<string[]>(['']);

	let errors = $state<Record<string, string>>({});
	let createdId = $state<number | null>(null);
	let isLoading = $state(false);

	const coverSrc = $derived(
		coverPreview ||
			'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=800&q=80'
	);
	const descCount = $derived(description.trim().length);
	const validOutcomes = $derived(outcomes.filter((o) => o.trim().length >= 10));
	const validTools = $derived(tools.filter((t) => t.trim().length >= 5));

	const durationNum = $derived(Number(durationMonths));
	const durationLabel = $derived(
		durationMonths && Number.isInteger(durationNum) && durationNum > 0
			? `${durationNum} Bulan`
			: ''
	);

	const priceNum = $derived(priceDigits === '' ? null : Number(priceDigits));
	const priceLabel = $derived(
		priceNum === null ? '' : priceNum === 0 ? 'GRATIS' : formatIDR(priceNum)
	);

	const startMonthLabel = $derived.by(() => {
		if (!startMonth) return '';
		const [y, m] = startMonth.split('-').map(Number);
		if (!y || !m) return startMonth;
		const names = [
			'Januari',
			'Februari',
			'Maret',
			'April',
			'Mei',
			'Juni',
			'Juli',
			'Agustus',
			'September',
			'Oktober',
			'November',
			'Desember'
		];
		return `${names[m - 1] ?? ''} ${y}`.trim();
	});

	const checklist = $derived([
		{ label: 'Judul ≥ 10 karakter', done: title.trim().length >= 10 },
		{ label: 'Kategori dipilih', done: category !== '' },
		{ label: 'Deskripsi ≥ 30 karakter', done: descCount >= 30 },
		{ label: 'Durasi (bulan) diisi', done: durationLabel !== '' },
		{ label: 'Bulan mulai batch diisi', done: startMonth !== '' },
		{ label: 'Harga diisi (0 = gratis)', done: priceNum !== null },
		{ label: 'Minimal 2 hasil belajar', done: validOutcomes.length >= 2 },
		{ label: 'Minimal 1 alat dipersiapkan', done: validTools.length >= 1 }
	]);
	const doneCount = $derived(checklist.filter((c) => c.done).length);
	const progressPct = $derived(Math.round((doneCount / checklist.length) * 100));

	function onlyDigits(value: string): string {
		return value.replace(/\D/g, '');
	}

	function validate(): boolean {
		const next: Record<string, string> = {};
		if (title.trim().length < 10)
			next['title'] = 'Judul minimal 10 karakter agar jelas di katalog.';
		if (title.trim().length > 120) next['title'] = 'Judul maksimal 120 karakter.';
		if (!category) next['category'] = 'Pilih kategori pelatihan.';
		if (!Number.isInteger(durationNum) || durationNum < 1)
			next['duration'] = 'Isi durasi dalam bulan, angka bulat minimal 1 (cth: 6).';
		if (descCount < 30)
			next['description'] = `Deskripsi masih ${descCount} karakter, minimal 30 karakter.`;
		if (description.trim().length > 1000) next['description'] = 'Deskripsi maksimal 1000 karakter.';
		if (!startMonth) next['startMonth'] = 'Batch akan datang wajib punya bulan mulai.';
		if (priceNum === null || !Number.isInteger(priceNum) || priceNum < 0)
			next['price'] = 'Isi harga dengan angka bulat ≥ 0 (cth: 0 atau 149000).';
		if (validOutcomes.length < 2)
			next['outcomes'] = 'Isi minimal 2 hasil belajar, masing-masing ≥ 10 karakter.';
		if (validTools.length < 1) next['tools'] = 'Isi minimal 1 alat yang harus dipersiapkan.';
		errors = next;
		return Object.keys(next).length === 0;
	}

	function onCoverFile(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (errors['cover']) delete errors['cover'];
		if (!file) return;
		if (!file.type.startsWith('image/')) {
			errors['cover'] = 'Berkas sampul harus berupa gambar (JPG/PNG/WebP).';
			return;
		}
		if (file.size > 2 * 1024 * 1024) {
			errors['cover'] = 'Ukuran gambar maksimal 2 MB.';
			return;
		}
		const reader = new FileReader();
		reader.onload = () => {
			coverPreview = String(reader.result ?? '');
		};
		reader.readAsDataURL(file);
	}

	function addOutcome() {
		outcomes = [...outcomes, ''];
	}
	function removeOutcome(i: number) {
		outcomes = outcomes.filter((_, x) => x !== i);
	}

	function addTool() {
		tools = [...tools, ''];
	}
	function removeTool(i: number) {
		tools = tools.filter((_, x) => x !== i);
	}

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		delete errors['server'];
		if (!validate()) {
			requestAnimationFrame(() => errorSummaryEl?.focus());
			window.scrollTo({ top: 0, behavior: 'smooth' });
			return;
		}
		if (isLoading) return;
		isLoading = true;
		try {
			// 1) Unggah sampul bila pengguna memilih berkas (dataURL -> URL server).
			let imageUrl: string | null = null;
			if (coverPreview.startsWith('data:')) {
				const picked = await fileFromDataUrl(coverPreview, 'sampul');
				const uploaded = await uploadFile(picked, 'cover');
				imageUrl = uploaded.url;
			} else {
				imageUrl = coverSrc;
			}
			// 2) Buat kursus di backend (draft). Gagal = tetap di form + pesan error.
			const course = await createCourse({
				title: title.trim(),
				category,
				level,
				durationMonths: durationNum,
				description: description.trim(),
				coverUrl: imageUrl,
				period,
				startMonth: startMonthLabel,
				priceNominal: priceNum ?? 0,
				outcomes: validOutcomes,
				tools: validTools
			});
			createdId = course.id;
			submitted = true;
			// Sukses terkonfirmasi server: daftar kursus wajib memuat kursus baru.
			invalidateMyCourses();
			window.scrollTo({ top: 0, behavior: 'smooth' });
		} catch (err) {
			errors['server'] =
				err instanceof BackendRequestError
					? err.message
					: 'Gagal menyimpan kursus. Periksa koneksi ke backend lalu coba lagi.';
			requestAnimationFrame(() => errorSummaryEl?.focus());
			window.scrollTo({ top: 0, behavior: 'smooth' });
		} finally {
			isLoading = false;
		}
	}

	function fileFromDataUrl(dataUrl: string, name: string): Promise<File> {
		return fetch(dataUrl)
			.then((r) => r.blob())
			.then((b) => new File([b], name, { type: b.type || 'image/png' }));
	}

	const errorList = $derived(Object.entries(errors));
	const inputCls = (bad: boolean) =>
		`w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:ring-4 focus:outline-none ${bad ? 'border-red-300 focus:border-red-500 focus:ring-red-500/10' : 'border-slate-200 focus:border-blue-500 focus:ring-blue-500/10'}`;
</script>

<svelte:head>
	<title>Tambah Pelatihan — Instruktur Aristoteles</title>
	<meta
		name="description"
		content="Buat pelatihan baru dalam satu langkah: isi info dasar dan hasil belajar, otomatis masuk daftar upcoming."
	/>
</svelte:head>

<div class="p-4 sm:p-6 lg:p-8">
	{#if submitted}
		<div
			class="mx-auto max-w-2xl overflow-hidden rounded-2xl border border-slate-200/70 bg-white text-center shadow-sm"
		>
			<div
				class="bg-gradient-to-br from-emerald-600 via-emerald-600 to-teal-600 px-6 py-10 text-white"
			>
				<span
					class="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur"
					aria-hidden="true"
				>
					<i class="fa-solid fa-circle-check text-2xl"></i>
				</span>
				<h1 class="mt-4 text-xl font-extrabold sm:text-2xl">Pelatihan masuk daftar upcoming!</h1>
				<p class="mx-auto mt-1.5 max-w-md text-sm text-emerald-50">
					“{title.trim()}” otomatis terjadwal mulai {startMonthLabel}. Susun modul dan materinya
					dari halaman Kelola Kurikulum.
				</p>
			</div>
			<dl class="grid grid-cols-2 gap-3 p-5 text-left sm:grid-cols-4">
				<div class="rounded-xl bg-slate-50 p-3 text-center">
					<dt class="sr-only">Kategori</dt>
					<dd class="truncate text-sm font-bold text-slate-900">{category}</dd>
					<dd class="text-[10px] font-bold tracking-wide text-slate-500 uppercase">Kategori</dd>
				</div>
				<div class="rounded-xl bg-slate-50 p-3 text-center">
					<dt class="sr-only">Durasi</dt>
					<dd class="text-sm font-bold text-slate-900">{durationLabel}</dd>
					<dd class="text-[10px] font-bold tracking-wide text-slate-500 uppercase">Durasi</dd>
				</div>
				<div class="rounded-xl bg-slate-50 p-3 text-center">
					<dt class="sr-only">Harga</dt>
					<dd class="truncate text-sm font-bold text-slate-900">{priceLabel}</dd>
					<dd class="text-[10px] font-bold tracking-wide text-slate-500 uppercase">Harga</dd>
				</div>
				<div class="rounded-xl bg-slate-50 p-3 text-center">
					<dt class="sr-only">Hasil belajar</dt>
					<dd class="text-sm font-bold text-slate-900">{validOutcomes.length} hasil</dd>
					<dd class="text-[10px] font-bold tracking-wide text-slate-500 uppercase">Hasil</dd>
				</div>
			</dl>
			<div class="flex flex-col gap-2 border-t border-slate-100 p-5 sm:flex-row sm:justify-center">
				{#if createdId !== null}
					<a
						href={`/instruktur/kursusku/${createdId}?src=server`}
						class="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
					>
						<i class="fa-solid fa-list-check" aria-hidden="true"></i> Kelola Kurikulum
					</a>
				{/if}
				<a
					href="/instruktur/kursusku"
					class="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
				>
					<i class="fa-solid fa-arrow-left" aria-hidden="true"></i> Kembali ke Kursusku
				</a>
				<button
					type="button"
					onclick={() => goto('/instruktur/kursusku/tambah')}
					class="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-slate-500"
				>
					<i class="fa-solid fa-plus" aria-hidden="true"></i> Buat Pelatihan Lain
				</button>
			</div>
		</div>
	{:else}
		<nav aria-label="Breadcrumb" class="mb-4 flex items-center gap-2 text-xs text-slate-500">
			<a
				href="/instruktur/kursusku"
				class="rounded font-semibold text-blue-600 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
				>Kursusku</a
			>
			<i class="fa-solid fa-chevron-right text-[10px] text-slate-300" aria-hidden="true"></i>
			<span aria-current="page" class="font-medium text-slate-700">Tambah Pelatihan</span>
		</nav>

		<div class="mb-6">
			<div>
				<p class="text-xs font-bold tracking-widest text-blue-600 uppercase">
					Instruktur · Pelatihan Baru
				</p>
				<h1 class="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
					Tambah Pelatihan
				</h1>
				<p class="mt-1 max-w-xl text-sm text-slate-500">
					Satu formulir saja, otomatis masuk daftar upcoming. Modul dan materi bisa disusun
					belakangan dari Kelola Kurikulum.
				</p>
			</div>
		</div>

		{#if errorList.length > 0}
			<div
				bind:this={errorSummaryEl}
				tabindex="-1"
				role="alert"
				aria-labelledby="err-title"
				class="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 focus:outline-2 focus:outline-red-500 sm:p-5"
			>
				<h2 id="err-title" class="flex items-center gap-2 text-sm font-bold text-red-800">
					<i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
					Ada {errorList.length} hal yang perlu diperbaiki
				</h2>
				<ul class="mt-2 list-disc space-y-1 pl-5 text-xs text-red-700">
					{#each errorList as [k, msg] (k)}<li>{msg}</li>{/each}
				</ul>
			</div>
		{/if}

		<div class="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_330px]">
			<form novalidate onsubmit={handleSubmit} class="min-w-0 space-y-5">
				<section
					aria-labelledby="h-info"
					class="rounded-2xl border border-slate-200/70 bg-white p-5 sm:p-6"
				>
					<h2 id="h-info" class="text-base font-bold text-slate-900">
						Informasi dasar pelatihan
					</h2>
					<p class="mt-0.5 text-xs text-slate-500">Ditampilkan di katalog dan kartu Kursusku.</p>

					<div class="mt-4 space-y-4">
						<div>
							<label for="f-title" class="mb-1.5 block text-xs font-bold text-slate-700"
								>Judul pelatihan <span class="text-red-500" aria-hidden="true">*</span></label
							>
							<input
								id="f-title"
								type="text"
								bind:value={title}
								placeholder="cth: Machine Learning untuk Pemula"
								maxlength={120}
								aria-invalid={!!errors['title']}
								aria-describedby={errors['title'] ? 'e-title' : 'h-title'}
								class={inputCls(!!errors['title'])}
							/>
							<p id="h-title" class="mt-1 text-[11px] text-slate-500">
								{title.trim().length}/120 · minimal 10 karakter, spesifik dan tanpa clickbait.
							</p>
							{#if errors['title']}<p
									id="e-title"
									class="mt-1 flex items-center gap-1.5 text-xs font-semibold text-red-600"
								>
									<i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i>{errors[
										'title'
									]}
								</p>{/if}
						</div>

						<div class="grid gap-4 sm:grid-cols-2">
							<div>
								<label for="f-cat" class="mb-1.5 block text-xs font-bold text-slate-700"
									>Kategori <span class="text-red-500" aria-hidden="true">*</span></label
								>
								<select
									id="f-cat"
									bind:value={category}
									aria-invalid={!!errors['category']}
									aria-describedby={errors['category'] ? 'e-cat' : undefined}
									class={inputCls(!!errors['category'])}
								>
									<option value="">— Pilih kategori —</option>
									{#each CATEGORIES as c (c)}<option value={c}>{c}</option>{/each}
								</select>
								{#if errors['category']}<p
										id="e-cat"
										class="mt-1 flex items-center gap-1.5 text-xs font-semibold text-red-600"
									>
										<i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i>{errors[
											'category'
										]}
									</p>{/if}
							</div>
							<div>
								<label for="f-dur" class="mb-1.5 block text-xs font-bold text-slate-700"
									>Durasi (bulan) <span class="text-red-500" aria-hidden="true">*</span></label
								>
								<input
									id="f-dur"
									type="text"
									inputmode="numeric"
									pattern="[0-9]*"
									value={durationMonths}
									oninput={(e) => (durationMonths = onlyDigits(e.currentTarget.value))}
									placeholder="cth: 6"
									maxlength={3}
									aria-invalid={!!errors['duration']}
									aria-describedby={errors['duration'] ? 'e-dur' : 'h-dur'}
									class={inputCls(!!errors['duration'])}
								/>
								<p id="h-dur" class="mt-1 text-[11px] text-slate-500">
									{#if durationLabel}
										<span class="font-bold text-blue-700">{durationLabel}</span> · hanya angka, tanpa
										satuan lain.
									{:else}
										Hanya angka bulan, contoh: 6 untuk 6 bulan.
									{/if}
								</p>
								{#if errors['duration']}<p
										id="e-dur"
										class="mt-1 flex items-center gap-1.5 text-xs font-semibold text-red-600"
									>
										<i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i>{errors[
											'duration'
										]}
									</p>{/if}
							</div>
						</div>

						<fieldset>
							<legend class="mb-1.5 text-xs font-bold text-slate-700">Level peserta</legend>
							<div class="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Level peserta">
								{#each LEVELS as lv (lv)}
									<label
										class={`flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-bold transition-colors has-focus-visible:outline-2 has-focus-visible:outline-blue-600 ${level === lv ? 'border-blue-600 bg-blue-600 text-white shadow-lg shadow-blue-600/25' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
									>
										<input
											type="radio"
											name="level"
											value={lv}
											bind:group={level}
											class="sr-only"
										/>
										{lv}
									</label>
								{/each}
							</div>
						</fieldset>

						<div>
							<label for="f-desc" class="mb-1.5 block text-xs font-bold text-slate-700"
								>Deskripsi singkat <span class="text-red-500" aria-hidden="true">*</span></label
							>
							<textarea
								id="f-desc"
								bind:value={description}
								rows={4}
								maxlength={1000}
								placeholder="Untuk siapa pelatihan ini, apa yang dipelajari, dan proyek akhirnya apa?"
								aria-invalid={!!errors['description']}
								aria-describedby="h-desc"
								class={`${inputCls(!!errors['description'])} resize-y`}></textarea>
							<p
								id="h-desc"
								class="mt-1 text-[11px] {descCount < 30
									? 'text-amber-600 font-semibold'
									: 'text-slate-500'}"
							>
								{descCount}/1000 · minimal 30 karakter.
							</p>
							{#if errors['description']}<p
									class="mt-1 flex items-center gap-1.5 text-xs font-semibold text-red-600"
								>
									<i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i>{errors[
										'description'
									]}
								</p>{/if}
						</div>

						<div>
							<span id="lg-cover" class="mb-1.5 block text-xs font-bold text-slate-700"
								>Sampul pelatihan</span
							>
							<div class="overflow-hidden rounded-xl border border-slate-200">
								<img
									src={coverSrc}
									alt="Pratinjau sampul pelatihan"
									class="h-32 w-full object-cover"
									loading="lazy"
								/>
							</div>
							<label for="f-cover-file" class="mt-2.5 block text-xs font-bold text-slate-700"
								>Unggah gambar <span class="font-semibold text-slate-500">(JPG/PNG/WebP, maks 2 MB)</span></label
							>
							<input
								id="f-cover-file"
								type="file"
								accept="image/*"
								onchange={onCoverFile}
								aria-invalid={!!errors['cover']}
								aria-describedby={errors['cover'] ? 'e-cover' : 'h-cover'}
								class="mt-1.5 block w-full cursor-pointer rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2.5 text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-600 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-white hover:file:bg-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
							/>
							<p id="h-cover" class="mt-1 text-[11px] text-slate-500">
								Rasio 16:9 paling bagus. Kosongkan untuk memakai gambar bawaan.
							</p>
							{#if errors['cover']}<p
									id="e-cover"
									class="mt-1 flex items-center gap-1.5 text-xs font-semibold text-red-600"
								>
									<i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i>{errors[
										'cover'
									]}
								</p>{/if}
						</div>

						<div class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
							<p class="flex items-start gap-2 text-xs leading-relaxed text-amber-800">
								<i class="fa-solid fa-calendar-plus mt-0.5 shrink-0" aria-hidden="true"></i>
								<span
									>Pelatihan baru otomatis masuk periode <strong>Akan Datang</strong>. Isi bulan
									mulai di bawah agar tampil “Mulai …” di katalog.</span
								>
							</p>
						</div>

						<div>
							<span id="f-start-label" class="mb-1.5 block text-xs font-bold text-slate-700"
								>Bulan mulai batch <span class="text-red-500" aria-hidden="true">*</span></span
							>
							<MonthPicker
								bind:value={startMonth}
								labelledby="f-start-label"
								describedby={errors['startMonth'] ? 'e-start' : 'h-start'}
								invalid={!!errors['startMonth']}
							/>
							<p id="h-start" class="mt-1 text-[11px] text-slate-500">
								{#if startMonthLabel}
									Ditampilkan sebagai <span class="font-bold text-blue-700"
										>“Mulai {startMonthLabel}”</span
									>.
								{:else}
									Wajib diisi karena pelatihan langsung masuk upcoming.
								{/if}
							</p>
							{#if errors['startMonth']}<p
									id="e-start"
									class="mt-1 flex items-center gap-1.5 text-xs font-semibold text-red-600"
								>
									<i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i>{errors[
										'startMonth'
									]}
								</p>{/if}
						</div>

						<div>
							<label for="f-price" class="mb-1.5 block text-xs font-bold text-slate-700"
								>Harga (rupiah, angka saja) <span class="text-red-500" aria-hidden="true">*</span></label
							>
							<div class="relative">
								<span
									class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-sm font-bold text-slate-400"
									aria-hidden="true">Rp</span
								>
								<input
									id="f-price"
									type="text"
									inputmode="numeric"
									pattern="[0-9]*"
									value={priceDigits}
									oninput={(e) => (priceDigits = onlyDigits(e.currentTarget.value))}
									placeholder="0"
									maxlength={12}
									aria-invalid={!!errors['price']}
									aria-describedby="h-price"
									class={`${inputCls(!!errors['price'])} pl-11 font-mono`}
								/>
							</div>
							<div
								id="h-price"
								role="status"
								class="mt-1.5 flex items-start gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold {priceNum === null
									? 'bg-slate-50 text-slate-500'
									: priceNum === 0
										? 'bg-emerald-50 text-emerald-700'
										: 'bg-blue-50 text-blue-700'}"
							>
								<i
									class={`fa-solid mt-0.5 ${priceNum === null ? 'fa-circle-info' : priceNum === 0 ? 'fa-circle-check' : 'fa-tag'}`}
									aria-hidden="true"
								></i>
								<span>
									{#if priceNum === null}
										Isi 0 agar pelatihan GRATIS, atau nominal tanpa titik (cth: 149000).
									{:else if priceNum === 0}
										Pelatihan ini akan GRATIS untuk semua peserta.
									{:else}
										Pelatihan berbayar {priceLabel}, sekali bayar untuk peserta.
									{/if}
								</span>
							</div>
							{#if errors['price']}<p
									class="mt-1 flex items-center gap-1.5 text-xs font-semibold text-red-600"
								>
									<i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i>{errors[
										'price'
									]}
								</p>{/if}
						</div>
					</div>
				</section>

				<section
					aria-labelledby="h-out"
					class="rounded-2xl border border-slate-200/70 bg-white p-5 sm:p-6"
				>
					<div class="flex items-start justify-between gap-3">
						<div>
							<h2 id="h-out" class="text-base font-bold text-slate-900">
								Hasil belajar & alat yang dipersiapkan
							</h2>
							<p class="mt-0.5 text-xs text-slate-500">
								Minimal 2 hasil belajar dan 1 alat yang harus dipersiapkan peserta.
							</p>
						</div>
						<span
							class="shrink-0 rounded-full bg-blue-50 px-3 py-1 text-[11px] font-bold text-blue-700"
							>{validOutcomes.length} hasil · {validTools.length} alat</span
						>
					</div>
					{#if errors['outcomes'] || errors['tools']}
						<p
							role="alert"
							class="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700"
						>
							{errors['outcomes'] ?? errors['tools']}
						</p>
					{/if}
					<div class="mt-4 grid gap-5 lg:grid-cols-2">
						<div>
							<span id="lg-out" class="mb-2 block text-xs font-bold text-slate-700"
								>Yang akan dipelajari</span
							>
							<ol class="space-y-2" aria-labelledby="lg-out">
								<!-- eslint-disable-next-line @typescript-eslint/no-unused-vars -->
								{#each outcomes as out, i (i)}
									<li class="flex gap-2">
										<label for={`out-${i}`} class="sr-only">Hasil belajar {i + 1}</label>
										<input
											id={`out-${i}`}
											type="text"
											bind:value={outcomes[i]}
											placeholder={`Hasil ${i + 1}: cth “Membuat layout responsif…”`}
											class={inputCls(false)}
										/>
										<button
											type="button"
											onclick={() => removeOutcome(i)}
											disabled={outcomes.length <= 1}
											aria-label={`Hapus hasil belajar ${i + 1}`}
											class="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
										>
											<i class="fa-solid fa-trash text-xs" aria-hidden="true"></i>
										</button>
									</li>
								{/each}
							</ol>
							<button
								type="button"
								onclick={addOutcome}
								class="mt-2 inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-dashed border-blue-300 bg-blue-50/60 px-3.5 py-2 text-[11px] font-bold text-blue-700 hover:bg-blue-50"
							>
								<i class="fa-solid fa-plus" aria-hidden="true"></i> Tambah hasil belajar
							</button>
						</div>
						<div>
							<span id="lg-tools" class="mb-2 block text-xs font-bold text-slate-700"
								>Alat yang harus dipersiapkan</span
							>
							<ol class="space-y-2" aria-labelledby="lg-tools">
								<!-- eslint-disable-next-line @typescript-eslint/no-unused-vars -->
								{#each tools as tool, i (i)}
									<li class="flex gap-2">
										<label for={`tool-${i}`} class="sr-only">Alat {i + 1}</label>
										<input
											id={`tool-${i}`}
											type="text"
											bind:value={tools[i]}
											placeholder={`Alat ${i + 1}: cth “Laptop & koneksi internet stabil”`}
											class={inputCls(false)}
										/>
										<button
											type="button"
											onclick={() => removeTool(i)}
											disabled={tools.length <= 1}
											aria-label={`Hapus alat ${i + 1}`}
											class="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
										>
											<i class="fa-solid fa-trash text-xs" aria-hidden="true"></i>
										</button>
									</li>
								{/each}
							</ol>
							<button
								type="button"
								onclick={addTool}
								class="mt-2 inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-dashed border-blue-300 bg-blue-50/60 px-3.5 py-2 text-[11px] font-bold text-blue-700 hover:bg-blue-50"
							>
								<i class="fa-solid fa-plus" aria-hidden="true"></i> Tambah alat
							</button>
						</div>
					</div>
				</section>

				<div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
					<a
						href="/instruktur/kursusku"
						class="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-slate-500"
					>
						<i class="fa-solid fa-arrow-left" aria-hidden="true"></i> Batal
					</a>
					<button
						type="submit"
						disabled={isLoading}
						class="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-600/25 transition-all hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:bg-emerald-400"
					>
						{#if isLoading}
							<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i>
							<span>Menyimpan...</span>
						{:else}
							<i class="fa-solid fa-plus" aria-hidden="true"></i>
							Tambah Kursus
						{/if}
					</button>
				</div>
			</form>

			<!-- Panel samping: pratinjau + checklist -->
			<aside aria-label="Pratinjau dan kelengkapan" class="space-y-4 lg:sticky lg:top-24">
				<div class="overflow-hidden rounded-2xl border border-slate-200/70 bg-white">
					<div class="relative">
						<img
							src={coverSrc}
							alt=""
							aria-hidden="true"
							class="h-36 w-full object-cover"
							loading="lazy"
						/>
						<span
							class="absolute top-3 left-3 rounded-md border border-white/40 bg-slate-900/70 px-2.5 py-1 text-[10px] font-extrabold text-white uppercase backdrop-blur"
							>{level}</span
						>
						<span
							class="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-md bg-amber-500 px-2.5 py-1 text-[10px] font-extrabold text-white uppercase"
						>
							<i class="fa-solid fa-calendar-plus" aria-hidden="true"></i>
							{startMonthLabel ? `Mulai ${startMonthLabel}` : 'Akan Datang'}
						</span>
					</div>
					<div class="p-4">
						<p class="text-[11px] font-bold tracking-wide text-blue-600 uppercase">
							{category || 'Kategori belum dipilih'}
						</p>
						<p class="mt-0.5 line-clamp-2 text-sm font-bold text-slate-900">
							{title.trim() || 'Judul pelatihan akan tampil di sini…'}
						</p>
						<p class="mt-1 text-[11px] text-slate-500">
							{durationLabel || 'durasi …'} · {priceLabel || 'harga …'}
						</p>
						<div
							class="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"
							role="progressbar"
							aria-valuenow={progressPct}
							aria-valuemin={0}
							aria-valuemax={100}
							aria-label="Kelengkapan pelatihan"
						>
							<div
								class="h-full rounded-full bg-blue-600 transition-all"
								style="width: {progressPct}%"
							></div>
						</div>
						<p class="mt-1.5 text-[11px] font-semibold text-slate-600">
							{doneCount}/{checklist.length} lengkap · {progressPct}%
						</p>
					</div>
				</div>

				<div class="rounded-2xl border border-slate-200/70 bg-white p-4">
					<h2 class="text-xs font-bold tracking-wide text-slate-500 uppercase">
						Checklist kelengkapan
					</h2>
					<ul class="mt-2.5 space-y-2">
						{#each checklist as c (c.label)}
							<li
								class="flex items-start gap-2.5 text-xs {c.done
									? 'text-emerald-700'
									: 'text-slate-500'}"
							>
								<i
									class={`fa-solid ${c.done ? 'fa-circle-check text-emerald-500' : 'fa-circle text-slate-300'} mt-0.5`}
									aria-hidden="true"
								></i>
								<span class={c.done ? 'font-semibold' : ''}>{c.label}</span>
								<span class="sr-only">{c.done ? '(selesai)' : '(belum)'}</span>
							</li>
						{/each}
					</ul>
				</div>

				<div
					class="rounded-2xl border border-blue-100 bg-blue-50/60 p-4 text-xs leading-relaxed text-slate-600"
				>
					<p class="flex items-start gap-2">
						<i class="fa-solid fa-lightbulb mt-0.5 text-amber-500" aria-hidden="true"></i><span
							><strong class="text-slate-800">Tips lolos kurasi:</strong> judul spesifik, harga 0
							untuk kelas gratis, dan ≥2 hasil belajar yang terukur.</span
						>
					</p>
				</div>
			</aside>
		</div>
	{/if}
</div>
