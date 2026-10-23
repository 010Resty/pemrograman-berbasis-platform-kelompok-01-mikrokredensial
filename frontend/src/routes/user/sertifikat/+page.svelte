<script lang="ts">
	interface Certificate {
		id: number;
		title: string;
		issuer: string;
		date: string;
		credentialId: string;
		score: string;
		image: string;
	}

	const certificates: Certificate[] = [
		{
			id: 1,
			title: 'Frontend Developer',
			issuer: 'Aristoteles Academy',
			date: '15 Agu 2026',
			credentialId: 'ED-2026-8F3A',
			score: '92/100',
			image: 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?auto=format&fit=crop&w=600&q=80'
		},
		{
			id: 2,
			title: 'Database Administrator',
			issuer: 'Aristoteles Academy',
			date: '28 Jul 2026',
			credentialId: 'ED-2026-71BC',
			score: '96/100',
			image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=600&q=80'
		},
		{
			id: 3,
			title: 'Network Specialist',
			issuer: 'Aristoteles Academy',
			date: '10 Jul 2026',
			credentialId: 'ED-2026-55D0',
			score: '88/100',
			image: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=600&q=80'
		}
	];
</script>

<svelte:head>
	<title>Sertifikat — Aristoteles Platform</title>
	<meta name="description" content="Daftar sertifikat mikrokredensial yang telah diperoleh pengguna." />
</svelte:head>

<div class="p-4 sm:p-6 lg:p-8">
	<div class="mb-6">
		<p class="text-xs font-bold tracking-widest text-blue-600 uppercase">Menu Utama · Sertifikat</p>
		<h1 class="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Sertifikat</h1>
		<p class="mt-1 text-sm text-slate-500">
			{certificates.length} sertifikat terverifikasi. Bagikan ID kredensial ke recruiter untuk validasi.
		</p>
	</div>

	<!-- Summary banner -->
	<div
		class="mb-6 flex flex-col gap-4 rounded-2xl bg-gradient-to-br from-amber-500 via-amber-600 to-orange-700 p-6 text-white sm:flex-row sm:items-center sm:justify-between"
	>
		<div class="flex items-center gap-4">
			<span class="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20">
				<i class="fa-solid fa-award text-xl" aria-hidden="true"></i>
			</span>
			<div>
				<p class="text-lg font-bold">3 Sertifikat Terverifikasi</p>
				<p class="text-sm text-amber-100">Semua tersimpan dengan enkripsi kriptografis & cap digital.</p>
			</div>
		</div>
		<a
			href="/verify"
			class="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-2.5 text-xs font-bold text-amber-700 transition-colors hover:bg-amber-50 focus-visible:outline-2 focus-visible:outline-white"
		>
			<i class="fa-solid fa-shield-halved" aria-hidden="true"></i> Verifikasi Sertifikat
		</a>
	</div>

	<div class="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
		{#each certificates as cert (cert.id)}
			<article
				class="flex flex-col overflow-hidden rounded-2xl border border-slate-200/70 bg-white transition-shadow hover:shadow-xl"
			>
				<!-- Certificate preview -->
				<div class="relative bg-slate-900 p-6 text-center">
					<div
						class="pointer-events-none absolute inset-0 bg-gradient-to-br from-blue-600/30 via-transparent to-amber-500/20"
						aria-hidden="true"
					></div>
					<i class="fa-solid fa-award mb-2 text-4xl text-amber-400" aria-hidden="true"></i>
					<p class="text-[10px] font-bold tracking-widest text-slate-400 uppercase">Sertifikat Kelulusan</p>
					<h2 class="mt-1 text-lg font-extrabold text-white">{cert.title}</h2>
					<p class="mt-0.5 text-xs text-slate-300">Diberikan kepada <strong class="text-white">Ahmad Farizi</strong></p>
					<div class="mt-3 inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-3 py-1 text-[11px] font-bold text-emerald-300">
						<i class="fa-solid fa-circle-check" aria-hidden="true"></i> Terverifikasi
					</div>
				</div>

				<div class="flex flex-1 flex-col gap-3 p-5 text-sm">
					<dl class="space-y-2 text-[13px]">
						<div class="flex justify-between gap-2">
							<dt class="text-slate-500">Penerbit</dt>
							<dd class="font-semibold text-slate-800">{cert.issuer}</dd>
						</div>
						<div class="flex justify-between gap-2">
							<dt class="text-slate-500">Tanggal Terbit</dt>
							<dd class="font-semibold text-slate-800">{cert.date}</dd>
						</div>
						<div class="flex justify-between gap-2">
							<dt class="text-slate-500">ID Kredensial</dt>
							<dd class="font-mono text-xs font-bold text-slate-800">{cert.credentialId}</dd>
						</div>
						<div class="flex justify-between gap-2">
							<dt class="text-slate-500">Skor Akhir</dt>
							<dd class="font-bold text-emerald-600">{cert.score}</dd>
						</div>
					</dl>

					<div class="mt-2 flex gap-2">
						<button
							type="button"
							class="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
						>
							<i class="fa-solid fa-download" aria-hidden="true"></i> Unduh PDF
						</button>
						<button
							type="button"
							class="flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-200 focus-visible:outline-2 focus-visible:outline-slate-500"
						>
							<i class="fa-solid fa-share-nodes" aria-hidden="true"></i> Bagikan
						</button>
					</div>
				</div>
			</article>
		{/each}
	</div>

	<!-- Empty / CTA -->
	<div class="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center sm:text-left">
		<div class="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
			<div class="flex items-center gap-3">
				<span class="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50">
					<i class="fa-solid fa-layer-group text-blue-600" aria-hidden="true"></i>
				</span>
				<div>
					<p class="text-sm font-bold text-slate-900">Ingin menambah sertifikat baru?</p>
					<p class="text-xs text-slate-500">Selesaikan kursus yang sedang berjalan untuk membuka sertifikasi.</p>
				</div>
			</div>
			<a
				href="/user/kursusku"
				class="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white transition-colors hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-slate-900"
			>
				Kembali ke Kursusku <i class="fa-solid fa-arrow-right text-[10px]" aria-hidden="true"></i>
			</a>
		</div>
	</div>
</div>
