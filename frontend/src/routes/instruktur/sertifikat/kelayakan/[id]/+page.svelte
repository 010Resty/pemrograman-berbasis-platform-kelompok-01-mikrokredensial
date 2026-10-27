<script lang="ts">
	import { browser } from '$app/environment';
	import { page } from '$app/state';
	import {
		fetchEligibilityDetail as apiDetail,
		eligibilityLabel,
		type EligibilityDetail
	} from '$lib/api/certificates';
	import { mockEligibilityDetail } from '$lib/api/certificates.mock';

	/**
	 * Detail kelayakan satu peserta pada satu modul: rincian materi/kuis/tugas
	 * wajib + alasan belum memenuhi. Seluruh angka dari backend; frontend
	 * tidak menghitung kelulusan sendiri.
	 */

	const eligibilityId = $derived(decodeURIComponent(page.params.id ?? ''));
	const useMock = $derived(
		browser && import.meta.env.DEV && page.url.searchParams.get('mock') === 'sertifikat'
	);
	const mockSuffix = $derived(useMock ? '&mock=sertifikat' : '');

	type Phase = 'loading' | 'error' | 'ready';
	let phase = $state<Phase>('loading');
	let detail = $state<EligibilityDetail | null>(null);
	let loadError = $state('');

	async function load(): Promise<void> {
		phase = 'loading';
		loadError = '';
		try {
			detail = useMock ? await mockEligibilityDetail(eligibilityId) : await apiDetail(eligibilityId);
			phase = 'ready';
		} catch (e) {
			loadError = e instanceof Error ? e.message : 'Gagal memuat detail kelayakan.';
			phase = 'error';
		}
	}

	$effect(() => {
		if (!browser) return;
		void load();
	});

	function itemBadge(state: string): string {
		if (state === 'selesai' || state === 'lulus') return 'bg-emerald-100 text-emerald-700';
		if (state === 'menunggu') return 'bg-amber-100 text-amber-700';
		if (state === 'belum_lulus') return 'bg-red-100 text-red-700';
		return 'bg-slate-100 text-slate-500';
	}
	function itemText(state: string): string {
		if (state === 'selesai') return 'Selesai';
		if (state === 'belum') return 'Belum selesai';
		if (state === 'lulus') return 'Lulus';
		if (state === 'menunggu') return 'Menunggu penilaian';
		return 'Belum lulus';
	}
</script>

<svelte:head>
	<title>Detail Kelayakan — Instruktur Aristoteles</title>
	<meta name="description" content="Rincian persyaratan sertifikat modul per peserta." />
</svelte:head>

<div class="p-4 sm:p-6 lg:p-8">
	<div class="mb-6">
		<a
			href="/instruktur/sertifikat?tab=kelayakan{mockSuffix}"
			class="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600"
		>
			<i class="fa-solid fa-arrow-left" aria-hidden="true"></i> Kembali ke kelayakan
		</a>
		<p class="mt-4 text-xs font-bold tracking-widest text-blue-600 uppercase">
			Menu Utama · Sertifikat · Kelayakan
		</p>
		<h1 class="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Detail Kelayakan</h1>
	</div>

	{#if useMock}
		<p
			role="status"
			class="mb-4 flex items-start gap-2 rounded-xl border border-dashed border-amber-400 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-800"
		>
			<i class="fa-solid fa-triangle-exclamation mt-0.5 shrink-0" aria-hidden="true"></i>
			<span>Mode demo DEV — data ilustratif, bukan data produksi.</span>
		</p>
	{/if}

	{#if phase === 'loading'}
		<div class="animate-pulse rounded-2xl border border-slate-200 bg-white p-6" aria-label="Memuat detail">
			<div class="h-6 w-56 rounded bg-slate-100"></div>
			<div class="mt-4 space-y-2">
				{#each [1, 2, 3, 4] as i (i)}
					<div class="h-4 rounded bg-slate-100"></div>
				{/each}
			</div>
		</div>
	{:else if phase === 'error'}
		<div role="alert" class="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
			<p class="text-sm font-bold text-red-700">Detail belum dapat dimuat</p>
			<p class="mx-auto mt-1 max-w-md text-xs text-red-600">{loadError}</p>
			<p class="mx-auto mt-1 max-w-md text-xs text-red-600/80">
				Endpoint <span class="font-mono">GET /instructor/eligibility/{eligibilityId}</span> belum
				tersedia atau backend tidak terjangkau.
			</p>
			<button
				type="button"
				onclick={() => void load()}
				class="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-red-600"
			>
				<i class="fa-solid fa-rotate-right" aria-hidden="true"></i> Coba lagi
			</button>
		</div>
	{:else if detail}
		<div class="mb-4 rounded-2xl border border-slate-200 bg-white p-5">
			<div class="flex flex-wrap items-start justify-between gap-3">
				<div>
					<h2 class="text-lg font-extrabold text-slate-900">{detail.studentName}</h2>
					<p class="mt-0.5 text-xs text-slate-500">
						{detail.nim ?? '—'} · {detail.courseTitle} · {detail.moduleTitle}
					</p>
					<p class="mt-1 text-xs tabular-nums text-slate-600">
						Materi wajib {detail.materialDone}/{detail.materialTotal} selesai
					</p>
				</div>
				<span
					class="inline-flex items-center rounded-full px-3 py-1.5 text-[11px] font-bold whitespace-nowrap {detail.status === 'sudah_terbit' || detail.status === 'memenuhi'
						? 'bg-emerald-100 text-emerald-700'
						: detail.status === 'menunggu_penilaian'
							? 'bg-amber-100 text-amber-700'
							: 'bg-slate-100 text-slate-600'}"
				>
					{eligibilityLabel(detail.status)}
				</span>
			</div>

			{#if detail.failReasons.length > 0}
				<div role="status" class="mt-4 rounded-xl bg-amber-50 px-4 py-3">
					<p class="text-xs font-extrabold text-amber-800">Alasan belum memenuhi syarat:</p>
					<ul class="mt-1.5 list-disc space-y-1 pl-5 text-xs text-amber-700">
						{#each detail.failReasons as r (r)}
							<li>{r}</li>
						{/each}
					</ul>
				</div>
			{/if}

			<div class="mt-4 flex flex-col gap-2 sm:flex-row">
				<a
					href="/instruktur/penilaian/{detail.courseId}"
					class="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
				>
					<i class="fa-solid fa-clipboard-check" aria-hidden="true"></i> Buka penilaian tugas kursus ini
				</a>
				{#if detail.certificateId !== null}
					<a
						href="/instruktur/sertifikat/{encodeURIComponent(String(detail.certificateId))}{mockSuffix}"
						class="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600"
					>
						<i class="fa-solid fa-award" aria-hidden="true"></i> Lihat sertifikat terbit
					</a>
				{/if}
			</div>
			<p class="mt-2 text-[11px] text-slate-400">
				Penilaian tugas tetap dilakukan di halaman Penilaian — halaman ini hanya membaca statusnya.
			</p>
		</div>

		<div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
			{#each [{ title: 'Materi wajib', icon: 'fa-book-open', items: detail.materials }, { title: 'Kuis wajib', icon: 'fa-circle-question', items: detail.quizzes }, { title: 'Tugas wajib', icon: 'fa-pen-to-square', items: detail.tasks }] as group (group.title)}
				<section aria-label={group.title} class="overflow-hidden rounded-2xl border border-slate-200 bg-white">
					<h3 class="flex items-center gap-2 border-b border-slate-100 px-5 py-3.5 text-sm font-extrabold text-slate-900">
						<i class="fa-solid {group.icon} text-slate-400" aria-hidden="true"></i> {group.title}
					</h3>
					{#if group.items.length === 0}
						<p class="px-5 py-4 text-xs text-slate-500">Tidak ada item wajib pada modul ini.</p>
					{:else}
						<ul class="divide-y divide-slate-100">
							{#each group.items as item (item.id)}
								<li class="flex items-start justify-between gap-2 px-5 py-3">
									<div class="min-w-0">
										<p class="text-[13px] font-semibold text-slate-800">{item.title}</p>
										{#if item.extra}
											<p class="mt-0.5 text-[11px] text-slate-500">{item.extra}</p>
										{/if}
									</div>
									<span class="inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-bold whitespace-nowrap {itemBadge(item.state)}">
										{itemText(item.state)}
									</span>
								</li>
							{/each}
						</ul>
					{/if}
				</section>
			{/each}
		</div>
	{/if}
</div>
