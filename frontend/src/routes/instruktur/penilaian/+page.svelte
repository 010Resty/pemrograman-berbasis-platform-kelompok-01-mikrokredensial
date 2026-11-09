<script lang="ts">
	import { browser } from '$app/environment';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import UiStatCard from '$lib/components/ui/StatCard.svelte';
	import { loadInstructorReviewQueue, type QueueCourse } from '$lib/api/grading-queue';

	/**
	 * Antrean penilaian dari backend (tanpa data contoh).
	 * Agregat per kursus kelola: materi tugas → pengumpulan (Menunggu =
	 * status `submitted`, Dinilai = skor tidak null). Gagal muat = error +
	 * retry; gagal sebagian = spanduk `partial`, bukan angka palsu.
	 */

	let search = $state('');

	let courses = $state<QueueCourse[]>([]);
	let pendingTotal = $state(0);
	let gradedTotal = $state(0);
	let avgScore = $state<number | null>(null);
	let partial = $state(false);
	let loading = $state(true);
	let loadError = $state('');
	let started = false;

	async function load(): Promise<void> {
		loading = true;
		loadError = '';
		try {
			const q = await loadInstructorReviewQueue();
			courses = q.courses;
			pendingTotal = q.pendingTotal;
			gradedTotal = q.gradedTotal;
			avgScore = q.avgScore;
			partial = q.partial;
		} catch (e) {
			loadError = e instanceof Error ? e.message : 'Gagal memuat antrean penilaian.';
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		if (!browser || started) return;
		started = true;
		void load();
	});

	interface CourseCard {
		id: number;
		title: string;
		category: string;
		image: string | null;
		taskCount: number;
		pending: number;
		total: number;
	}

	const cards = $derived.by((): CourseCard[] => {
		const q = search.trim().toLowerCase();
		const list: CourseCard[] = [];
		for (const course of courses) {
			if (q && !course.title.toLowerCase().includes(q) && !course.category.toLowerCase().includes(q)) {
				continue;
			}
			list.push({
				id: course.id,
				title: course.title,
				category: course.category,
				image: course.image,
				taskCount: course.tasks.length,
				pending: course.pending,
				total: course.total
			});
		}
		return list;
	});
</script>

<svelte:head>
	<title>Penilaian — Instruktur Aristoteles</title>
	<meta name="description" content="Daftar course untuk antrean penilaian tugas dan kuis peserta." />
</svelte:head>

<div class="page-wrap page-stack">
	<PageHeader
		eyebrow="Menu Utama · Penilaian"
		title="Penilaian"
		description={`${pendingTotal} menunggu dinilai · ${gradedTotal} sudah dinilai · rata-rata nilai ${avgScore ?? '-'}. Pilih course untuk melihat penugasannya.`}
	/>

	<div class="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
		<UiStatCard label="Menunggu" value={String(pendingTotal)} icon="fa-hourglass-half" tone="amber" />
		<UiStatCard label="Dinilai" value={String(gradedTotal)} icon="fa-circle-check" tone="emerald" />
		<UiStatCard label="Rata-rata" value={avgScore === null ? '-' : String(avgScore)} icon="fa-star" tone="blue" />
	</div>

	<div class="mb-4 max-w-md">
		<label for="search-course-penilaian" class="sr-only">Cari course</label>
		<div class="relative">
			<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
				<i class="fa-solid fa-magnifying-glass text-sm" aria-hidden="true"></i>
			</div>
			<input
				id="search-course-penilaian"
				type="search"
				bind:value={search}
				placeholder="Cari course..."
				autocomplete="off"
				class="w-full rounded-xl border border-slate-200 bg-white py-2.5 pr-4 pl-10 text-sm placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
			/>
		</div>
	</div>

	{#if loading}
		<p role="status" class="mb-4 flex items-center gap-2 text-xs font-semibold text-slate-500">
			<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i> Memuat antrean penilaian…
		</p>
	{/if}

	{#if loadError}
		<div role="alert" class="mb-4 rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
			<p class="text-sm font-bold text-red-700">Antrean penilaian belum dapat dimuat</p>
			<p class="mx-auto mt-1 max-w-md text-xs text-red-600">{loadError}</p>
			<button
				type="button"
				onclick={() => void load()}
				class="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-red-600"
			>
				<i class="fa-solid fa-rotate-right" aria-hidden="true"></i> Coba lagi
			</button>
		</div>
	{/if}

	{#if !loading && !loadError && partial}
		<p role="note" class="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-semibold text-amber-800">
			<i class="fa-solid fa-triangle-exclamation mt-0.5 shrink-0" aria-hidden="true"></i>
			<span>Sebagian data gagal dimuat — angka di bawah belum lengkap.</span>
		</p>
	{/if}

	{#if !loading && !loadError && cards.length === 0}
		<div class="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
			<i class="fa-solid fa-folder-open mb-3 text-3xl text-slate-300" aria-hidden="true"></i>
			<p class="text-sm font-semibold text-slate-700">Tidak ada antrean penilaian.</p>
			<p class="mt-1 text-xs text-slate-500">Belum ada course yang Anda kelola atau cocok dengan pencarian.</p>
		</div>
	{:else if cards.length > 0}
		<div class="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
			{#each cards as card (card.id)}
				<a
					href={`/instruktur/penilaian/${card.id}`}
					aria-label={`Buka penilaian ${card.title}: ${card.pending} menunggu dari ${card.total} pengumpulan`}
					class="group flex flex-col overflow-hidden rounded-2xl border border-slate-200/70 bg-white transition-all duration-300 ease-smooth hover:-translate-y-1 hover:shadow-xl focus-visible:outline-2 focus-visible:outline-blue-600"
				>
					<div class="relative overflow-hidden">
						{#if card.image}
							<img
								src={card.image}
								alt=""
								aria-hidden="true"
								class="h-36 w-full object-cover transition-transform duration-700 ease-smooth group-hover:scale-105"
								loading="lazy"
							/>
						{:else}
							<div class="flex h-36 w-full items-center justify-center bg-gradient-to-br from-blue-100 to-indigo-100" aria-hidden="true">
								<i class="fa-solid fa-book-open text-2xl text-blue-300"></i>
							</div>
						{/if}
						<span
							class="absolute top-3 left-3 rounded-md bg-slate-900/80 px-2.5 py-1 text-[10px] font-extrabold text-white uppercase backdrop-blur"
						>
							{card.category}
						</span>
						{#if card.pending > 0}
							<span
								class="absolute top-3 right-3 inline-flex items-center gap-1 rounded-md bg-amber-400 px-2.5 py-1 text-[10px] font-extrabold text-slate-900 uppercase"
							>
								<i class="fa-solid fa-hourglass-half text-[9px]" aria-hidden="true"></i>
								{card.pending} antre
							</span>
						{:else}
							<span
								class="absolute top-3 right-3 inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-[10px] font-extrabold text-white uppercase"
							>
								<i class="fa-solid fa-check text-[9px]" aria-hidden="true"></i> Tuntas
							</span>
						{/if}
					</div>
					<div class="flex flex-1 flex-col p-5">
						<h2 class="line-clamp-2 text-base font-bold text-slate-900 transition-colors group-hover:text-blue-700">
							{card.title}
						</h2>
						<p class="mt-1 text-xs text-slate-500">
							{card.taskCount} materi dinilai · {card.total} pengumpulan · {card.pending} menunggu
						</p>
						<span
							class="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white transition-colors group-hover:bg-blue-700"
						>
							<i class="fa-solid fa-clipboard-check" aria-hidden="true"></i>
							Buka Penugasan
							<i class="fa-solid fa-arrow-right text-[10px]" aria-hidden="true"></i>
						</span>
					</div>
				</a>
			{/each}
		</div>
	{/if}
</div>
