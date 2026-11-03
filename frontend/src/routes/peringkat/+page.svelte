<script lang="ts">
	import '../../app.css';
	import { resolve } from '$app/paths';
	import PublicHeader from '$lib/components/public/PublicHeader.svelte';
	import PublicFooter from '$lib/components/public/PublicFooter.svelte';
	import SeoHead from '$lib/components/SeoHead.svelte';
	import { canonicalPath, getSiteUrl } from '$lib/seo/site';
	import { reveal } from '$lib/actions/reveal';

	const rankings = [
		{
			rank: 1,
			title: 'Belajar Figma – Pelatihan Desain UI/UX Esensial',
			category: 'Desain UI/UX',
			instructor: 'Kevin Perry',
			rating: '4.8',
			participants: '2.450',
			initials: 'KP'
		},
		{
			rank: 2,
			title: 'Statistik TI, Sains Data, dan Analisis Bisnis',
			category: 'Sains Data',
			instructor: 'Kevin Perry',
			rating: '4.7',
			participants: '2.180',
			initials: 'KP'
		},
		{
			rank: 3,
			title: 'Perangkat Lunak Pendidikan dan Sistem PHP & JS',
			category: 'Pengembangan Web',
			instructor: 'Max Alexix',
			rating: '4.7',
			participants: '1.920',
			initials: 'MA'
		},
		{
			rank: 4,
			title: 'Kursus Pengembangan Android 12 & Kotlin Lanjutan',
			category: 'Pengembangan Mobile',
			instructor: 'Max Alexix',
			rating: '4.7',
			participants: '1.750',
			initials: 'MA'
		},
		{
			rank: 5,
			title: 'Pemasaran Digital untuk Pemula',
			category: 'Pemasaran Digital',
			instructor: 'Sarah Johnson',
			rating: '4.6',
			participants: '1.540',
			initials: 'SJ'
		},
		{
			rank: 6,
			title: 'Copywriting & Content Marketing untuk Brand',
			category: 'Pemasaran Digital',
			instructor: 'Dewi Lestari',
			rating: '4.6',
			participants: '1.320',
			initials: 'DL'
		},
		{
			rank: 7,
			title: 'Analisis Data dengan Python & Visualisasi Dashboard',
			category: 'Sains Data',
			instructor: 'Rizky Pratama',
			rating: '4.5',
			participants: '1.180',
			initials: 'RP'
		},
		{
			rank: 8,
			title: 'Fundamental JavaScript & Frontend Modern',
			category: 'Pengembangan Web',
			instructor: 'Andi Wijaya',
			rating: '4.5',
			participants: '1.050',
			initials: 'AW'
		},
		{
			rank: 9,
			title: 'Manajemen Proyek Agile & Scrum Master',
			category: 'Manajemen',
			instructor: 'Putri Ayu',
			rating: '4.4',
			participants: '980',
			initials: 'PA'
		},
		{
			rank: 10,
			title: 'Fotografi & Editing untuk Kreator Konten',
			category: 'Desain Grafis',
			instructor: 'Bagas Saputra',
			rating: '4.4',
			participants: '870',
			initials: 'BS'
		}
	];

	function participantsCount(value: string): number {
		return Number(value.replace(/[^\d]/g, '')) || 0;
	}

	/**
	 * Leaderboard keseluruhan: 3 nilai tertinggi dari SEMUA pelatihan
	 * (diurutkan berdasarkan rating, lalu jumlah peserta bila seri).
	 */
	const overallLeaderboard = [...rankings].sort(
		(a, b) =>
			Number(b.rating) - Number(a.rating) ||
			participantsCount(b.participants) - participantsCount(a.participants)
	);

	/* Podium tetap: 3 teratas leaderboard keseluruhan (urutan DOM 1–2–3 untuk pembaca layar). */
	const podiumOrder = overallLeaderboard.slice(0, 3).sort((a, b) => a.rank - b.rank);

	/**
	 * Peringkat tiap pelatihan di dalam kategorinya masing-masing.
	 * Turunan deterministik dari daftar yang sama — bukan data penilaian baru.
	 */
	const rankInCategory = new Map<number, number>();
	{
		const counter = new Map<string, number>();
		for (const item of overallLeaderboard) {
			const next = (counter.get(item.category) ?? 0) + 1;
			counter.set(item.category, next);
			rankInCategory.set(item.rank, next);
		}
	}
	/**
	 * Structured data disengaja TANPA AggregateRating: daftar peringkat di halaman
	 * ini adalah data contoh, bukan penilaian peserta nyata. Mengklaim rating
	 * fiktif di JSON-LD melanggar panduan rich result Google + AGENTS §7 (mock
	 * harus dilabeli mock). Naikkan ke ItemList/Course bila data rating nyata ada.
	 */
	const peringkatJsonLd = [
		{
			'@context': 'https://schema.org',
			'@type': 'WebPage',
			name: 'Peringkat Kursus Online Terbaik ARISTOTELES',
			description:
				'Lihat peringkat pelatihan ARISTOTELES per kategori dan leaderboard keseluruhan untuk menemukan kursus yang sesuai tujuan kariermu.',
			url: canonicalPath('/peringkat'),
			inLanguage: 'id-ID',
			isPartOf: { '@type': 'WebSite', name: 'ARISTOTELES', url: getSiteUrl() }
		},
		{
			'@context': 'https://schema.org',
			'@type': 'BreadcrumbList',
			itemListElement: [
				{ '@type': 'ListItem', position: 1, name: 'Beranda', item: canonicalPath('/') },
				{ '@type': 'ListItem', position: 2, name: 'Peringkat', item: canonicalPath('/peringkat') }
			]
		}
	];
</script>

<SeoHead
	title="Peringkat Kursus Online Terbaik — ARISTOTELES"
	description="Bandingkan pelatihan ARISTOTELES per kategori: desain, data, web, mobile & pemasaran. Temukan kursus online terbaik sesuai tujuan kariermu."
	path="/peringkat"
	jsonLd={peringkatJsonLd}
/>

<PublicHeader active="peringkat" />

<main>
	<section class="relative overflow-hidden bg-white">
		<div class="pointer-events-none absolute inset-0" aria-hidden="true">
			<div class="absolute -top-32 left-1/2 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-ice blur-3xl"></div>
		</div>
		<div class="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
			<p class="flex items-center gap-3 font-heading text-xs font-bold tracking-[0.18em] text-royal uppercase">
				<span class="h-px w-8 bg-royal" aria-hidden="true"></span>
				Peringkat
			</p>
			<h1 class="mt-3 max-w-2xl font-heading text-4xl font-extrabold tracking-tight text-abyss sm:text-5xl">
				Peringkat pelatihan terbaik
			</h1>
			<p class="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
				Pelatihan dengan peringkat tertinggi berdasarkan penilaian peserta dan popularitas.
			</p>
		</div>
	</section>

	<section aria-labelledby="peringkat-heading" class="border-t border-mist bg-white pb-20">
		<div class="mx-auto max-w-7xl px-4 pt-10 sm:px-6 lg:px-8">
			<h2 id="peringkat-heading" class="sr-only">Daftar 10 pelatihan peringkat teratas</h2>
			<dl
				class="mx-auto mb-12 grid max-w-3xl grid-cols-3 divide-x divide-mist rounded-2xl border border-mist bg-ice/60"
			>
				<div class="px-4 py-4 text-center">
					<dt class="mt-1 block font-heading text-[10px] font-bold tracking-[0.16em] text-slate-500 uppercase">
						Kurasi teratas
					</dt>
					<dd class="font-heading text-xl font-extrabold tabular-nums text-abyss sm:text-2xl">10</dd>
				</div>
				<div class="px-4 py-4 text-center">
					<dt class="mt-1 block font-heading text-[10px] font-bold tracking-[0.16em] text-slate-500 uppercase">
						Rata-rata rating
					</dt>
					<dd class="font-heading text-xl font-extrabold tabular-nums text-royal sm:text-2xl">
						4,6<span class="text-sm font-bold text-slate-400">/5</span>
					</dd>
				</div>
				<div class="px-4 py-4 text-center">
					<dt class="mt-1 block font-heading text-[10px] font-bold tracking-[0.16em] text-slate-500 uppercase">
						Total peserta
					</dt>
					<dd class="font-heading text-xl font-extrabold tabular-nums text-abyss sm:text-2xl">15.240</dd>
				</div>
			</dl>

			<div class="mx-auto mb-6 max-w-2xl text-center">
				<h3 class="font-heading text-xl font-extrabold tracking-tight text-abyss">Leaderboard keseluruhan</h3>
				<p class="mt-1 text-sm text-slate-500">Tiga nilai tertinggi dari semua pelatihan.</p>
			</div>
			<ol
				aria-label="Leaderboard keseluruhan: tiga nilai tertinggi dari semua pelatihan"
				class="mx-auto mb-4 grid max-w-5xl gap-5 md:grid-cols-3 md:items-stretch lg:gap-6"
			>
				{#each podiumOrder as item, i (item.rank)}
					{@const isFirst = item.rank === 1}
					{@const score = (Number(item.rating) / 5) * 100}
					{@const code = String(item.rank).padStart(2, '0')}
					<li
						use:reveal={{ delay: i * 80 }}
						class={isFirst ? 'md:order-2' : item.rank === 2 ? 'md:order-1' : 'md:order-3'}
					>
						{#if isFirst}
							<article
								class="relative h-full overflow-hidden rounded-2xl bg-abyss p-6 text-white sm:p-7"
							>
								<div class="relative flex h-full flex-col overflow-hidden">
									<span
										class="pointer-events-none absolute -top-8 right-0 text-[6.5rem] leading-none font-black tabular-nums text-white/10 select-none"
										aria-hidden="true">{code}</span
									>
									<div class="relative flex items-center justify-between gap-3">
										<span
											class="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-royal text-white"
											aria-hidden="true"
										>
											<i class="fa-solid fa-crown text-lg"></i>
										</span>
										<span
											class="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1 font-heading text-[10px] font-bold tracking-[0.18em] text-ice uppercase"
										>
											Peringkat {item.rank}
										</span>
									</div>
									<h3 class="relative mt-5 text-left font-heading text-lg leading-snug font-bold text-white sm:text-xl">
										{item.title}
									</h3>
									<p class="relative mt-2 flex items-center gap-2.5 text-left">
										<span
											class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 font-heading text-[11px] font-bold text-white"
											aria-hidden="true">{item.initials}</span
										>
										<span class="text-xs font-semibold text-slate-300">
											{item.instructor}
											<span class="text-slate-400">· {item.category}</span>
										</span>
									</p>
									<div class="relative mt-5 border-t border-white/15 pt-4">
										<div class="flex items-end justify-between gap-3">
											<p class="flex items-center gap-1.5 font-heading text-sm font-bold text-white">
												<i class="fa-solid fa-star text-amber-400" aria-hidden="true"></i>
												{item.rating}<span class="text-xs font-bold text-slate-400">/5</span>
											</p>
											<p class="flex items-center gap-1.5 text-xs font-bold text-slate-300">
												<i class="fa-solid fa-users text-slate-400" aria-hidden="true"></i>
												<span class="tabular-nums">{item.participants}</span> peserta
											</p>
										</div>
										<div
											class="mt-2 h-1.5 overflow-hidden rounded-full bg-white/15"
											role="img"
											aria-label="Skor rating {item.rating} dari 5"
										>
											<div class="h-full rounded-full bg-royal" style="width:{score}%"></div>
										</div>
									</div>
									<a
										href={resolve('/pelatihan')}
										class="relative mt-5 inline-flex items-center gap-2 font-heading text-xs font-bold tracking-wide text-ice uppercase underline decoration-white/30 underline-offset-4 transition duration-200 hover:text-white focus-visible:rounded focus-visible:outline-2 focus-visible:outline-ice"
										aria-label="Lihat {item.title} di daftar pelatihan"
									>
										Lihat di daftar pelatihan <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
									</a>
								</div>
							</article>
						{:else}
							<article
								class="relative flex h-full flex-col overflow-hidden rounded-2xl border border-mist bg-white p-6 pt-8 transition-all duration-200 hover:-translate-y-1 hover:border-royal/40 hover:shadow-xl hover:shadow-slate-900/10 sm:p-7 sm:pt-10"
							>
								<span
									class="pointer-events-none absolute -top-4 right-3 text-[5.5rem] leading-none font-black tabular-nums text-ice select-none"
									aria-hidden="true">{code}</span
								>
								<div class="relative flex items-center justify-between gap-3">
									<span
										class="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-ice text-royal"
										aria-hidden="true"
									>
										<i class="fa-solid {item.rank === 2 ? 'fa-medal' : 'fa-award'}"></i>
									</span>
									<span
										class="inline-flex items-center gap-1.5 rounded-lg bg-ice px-3 py-1 font-heading text-[10px] font-bold tracking-[0.18em] text-abyss uppercase"
									>
										Peringkat {item.rank}
									</span>
								</div>
								<h3 class="relative mt-5 text-left font-heading text-base leading-snug font-bold text-abyss sm:text-lg">
									{item.title}
								</h3>
								<p class="relative mt-2 flex items-center gap-2.5 text-left">
									<span
										class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ice font-heading text-[11px] font-bold text-royal"
										aria-hidden="true">{item.initials}</span
									>
									<span class="text-xs font-semibold text-slate-600">
										{item.instructor}
										<span class="text-slate-400">· {item.category}</span>
									</span>
								</p>
								<div class="relative mt-5 border-t border-mist pt-4">
									<div class="flex items-end justify-between gap-3">
										<p class="flex items-center gap-1.5 font-heading text-sm font-bold text-abyss">
											<i class="fa-solid fa-star text-amber-400" aria-hidden="true"></i>
											{item.rating}<span class="text-xs font-bold text-slate-400">/5</span>
										</p>
										<p class="flex items-center gap-1.5 text-xs font-bold text-slate-500">
											<i class="fa-solid fa-users text-slate-400" aria-hidden="true"></i>
											<span class="tabular-nums">{item.participants}</span> peserta
										</p>
									</div>
									<div
										class="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"
										role="img"
										aria-label="Skor rating {item.rating} dari 5"
									>
										<div
											class="h-full rounded-full bg-royal"
											style="width:{score}%"
										></div>
									</div>
								</div>
							</article>
						{/if}
					</li>
				{/each}
			</ol>

			<div class="mx-auto mb-14 hidden max-w-5xl grid-cols-3 items-end gap-6 px-10 md:grid" aria-hidden="true">
				<div class="h-8 rounded-t-xl border-x border-t border-mist bg-white"></div>
				<div class="h-14 rounded-t-xl bg-abyss"></div>
				<div class="h-8 rounded-t-xl border-x border-t border-mist bg-white"></div>
			</div>

			<div use:reveal class="overflow-hidden rounded-2xl border border-mist bg-white">
				<div class="flex flex-wrap items-center justify-between gap-3 border-b border-mist bg-ice/60 px-6 py-5 sm:px-8">
					<h3 class="flex items-center gap-2.5 font-heading text-sm font-bold text-abyss">
						<span class="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-abyss text-xs text-white" aria-hidden="true">
							<i class="fa-solid fa-list-ol"></i>
						</span>
						Top 10
					</h3>
					<p class="flex items-center gap-2 text-xs font-semibold text-slate-500">
						<i class="fa-solid fa-star text-amber-400" aria-hidden="true"></i>
						Peringkat per pelatihan — lengkap dengan posisi di kategorinya
					</p>
				</div>

				<div class="hidden overflow-x-auto md:block">
					<table class="w-full text-sm">
						<caption class="sr-only">Tabel 10 pelatihan peringkat teratas</caption>
						<thead>
							<tr class="border-b border-mist text-left font-heading text-[11px] font-bold tracking-[0.14em] text-slate-400 uppercase">
								<th scope="col" class="px-8 py-4 font-extrabold">Peringkat</th>
								<th scope="col" class="px-6 py-4 font-extrabold">Nama Pelatihan</th>
								<th scope="col" class="px-6 py-4 font-extrabold">Kategori</th>
								<th scope="col" class="px-6 py-4 font-extrabold">Instruktur</th>
								<th scope="col" class="px-6 py-4 text-right font-extrabold">Rating</th>
								<th scope="col" class="px-8 py-4 text-right font-extrabold">Peserta</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-mist">
							{#each rankings as row (row.rank)}
								{@const score = (Number(row.rating) / 5) * 100}
								{@const medal =
									row.rank === 1
										? 'bg-abyss text-white'
										: row.rank === 2
											? 'bg-slate-200 text-slate-700'
											: row.rank === 3
												? 'bg-ice text-royal'
												: row.rank <= 5
													? 'bg-royal text-white'
													: 'bg-slate-100 text-slate-600'}
								<tr
									class="group transition-colors duration-200 {row.rank === 1
										? 'bg-ice/60 hover:bg-ice'
										: 'hover:bg-ice/60'}"
								>
									<td class="px-8 py-4">
										<span
											class="inline-flex h-9 w-9 items-center justify-center rounded-xl font-heading text-sm font-bold tabular-nums {medal}"
											>{row.rank}</span
										>
									</td>
									<td class="max-w-72 px-6 py-4">
										<p class="flex items-center gap-2 font-heading font-bold text-abyss transition-colors duration-200 group-hover:text-royal">
											{#if row.rank === 1}
												<i class="fa-solid fa-crown text-sm text-royal" aria-hidden="true"></i>
											{:else if row.rank === 2}
												<i class="fa-solid fa-medal text-sm text-slate-400" aria-hidden="true"></i>
											{:else if row.rank === 3}
												<i class="fa-solid fa-award text-sm text-royal" aria-hidden="true"></i>
											{/if}
											{row.title}
										</p>
									</td>
									<td class="px-6 py-4 whitespace-nowrap">
										<span class="inline-flex items-center rounded-md bg-ice px-2.5 py-1 text-[11px] font-bold text-abyss">
											{row.category}
										</span>
										<p class="mt-1 text-[11px] font-semibold text-slate-400">
											#{rankInCategory.get(row.rank)} di kategori ini
										</p>
									</td>
									<td class="px-6 py-4 whitespace-nowrap">
										<span class="inline-flex items-center gap-2 text-[13px] font-semibold text-slate-600">
											<span
												class="inline-flex h-7 w-7 items-center justify-center rounded-full bg-ice font-heading text-[10px] font-bold text-royal"
												aria-hidden="true">{row.initials}</span
											>
											{row.instructor}
										</span>
									</td>
									<td class="px-6 py-4">
										<div class="flex items-center justify-end gap-2">
											<div
												class="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100"
												role="img"
												aria-label="Skor rating {row.rating} dari 5"
											>
												<div class="h-full rounded-full bg-royal" style="width:{score}%"></div>
											</div>
											<span class="inline-flex items-center gap-1 font-heading font-bold tabular-nums text-abyss">
												<i class="fa-solid fa-star text-xs text-amber-400" aria-hidden="true"></i>
												{row.rating}
											</span>
										</div>
									</td>
									<td class="px-8 py-4 text-right">
										<span class="inline-flex items-center gap-1.5 text-[13px] font-bold tabular-nums text-slate-500">
											<i class="fa-solid fa-users text-xs text-slate-300" aria-hidden="true"></i>
											{row.participants}
										</span>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				<ol class="divide-y divide-mist md:hidden" aria-label="10 pelatihan peringkat teratas">
					{#each rankings as row (row.rank)}
						{@const score = (Number(row.rating) / 5) * 100}
						{@const medal =
							row.rank === 1
								? 'bg-abyss text-white'
								: row.rank === 2
									? 'bg-slate-200 text-slate-700'
									: row.rank === 3
										? 'bg-ice text-royal'
										: row.rank <= 5
											? 'bg-royal text-white'
											: 'bg-slate-100 text-slate-600'}
						<li class="flex gap-4 px-5 py-4 {row.rank === 1 ? 'bg-ice/60' : ''}">
							<span
								class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-heading text-sm font-bold tabular-nums {medal}"
								aria-label="Peringkat {row.rank}">{row.rank}</span
							>
							<div class="min-w-0 flex-1">
								<p class="font-heading text-sm leading-snug font-bold text-abyss">{row.title}</p>
								<p class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-semibold text-slate-500">
									<span class="inline-flex items-center rounded-md bg-ice px-2 py-0.5 text-[10px] font-bold text-abyss">
										{row.category}
									</span>
									<span>{row.instructor}</span>
									<span class="inline-flex items-center rounded-md bg-royal/10 px-2 py-0.5 text-[10px] font-bold text-royal">
										#{rankInCategory.get(row.rank)} kategori
									</span>
								</p>
								<div class="mt-2 flex items-center justify-between gap-3">
									<span class="inline-flex items-center gap-1.5 font-heading text-xs font-bold tabular-nums text-abyss">
										<i class="fa-solid fa-star text-amber-400" aria-hidden="true"></i>
										{row.rating}
										<span class="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
											<span class="block h-full rounded-full bg-royal" style="width:{score}%"></span>
										</span>
									</span>
									<span class="inline-flex items-center gap-1 text-[11px] font-bold tabular-nums text-slate-500">
										<i class="fa-solid fa-users text-slate-300" aria-hidden="true"></i>
										{row.participants} peserta
									</span>
								</div>
							</div>
						</li>
					{/each}
				</ol>

				<div class="flex flex-col items-center justify-between gap-4 border-t border-mist bg-ice/60 px-6 py-5 sm:flex-row sm:px-8">
					<p class="text-[11px] leading-relaxed text-slate-500">
						Data peringkat ilustratif untuk tampilan — bukan data penilaian live.
					</p>
					<a
						href={resolve('/pelatihan')}
						class="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-royal px-6 py-3 font-heading text-xs font-bold tracking-wide text-white uppercase transition-colors duration-200 hover:bg-royal-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal"
					>
						Jelajahi pelatihan <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
					</a>
				</div>
			</div>
		</div>
	</section>
</main>

<PublicFooter />
