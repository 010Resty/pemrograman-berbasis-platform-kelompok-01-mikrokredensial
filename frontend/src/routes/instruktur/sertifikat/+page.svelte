<script lang="ts">
	interface IssuedCertificate {
		id: number;
		course: string;
		recipient: string;
		nim: string;
		date: string;
		credentialId: string;
		score: string;
		status: 'Terverifikasi' | 'Menunggu Terbit';
	}

	let certificates = $state<IssuedCertificate[]>([
		{ id: 1, course: 'Pengembangan Web Frontend', recipient: 'Ahmad Farizi', nim: '2101020045', date: '15 Agu 2026', credentialId: 'AR-2026-8F3A', score: '92/100', status: 'Terverifikasi' },
		{ id: 2, course: 'Basis Data & SQL', recipient: 'Dewi Anggraini', nim: '2101020031', date: '28 Jul 2026', credentialId: 'AR-2026-71BC', score: '96/100', status: 'Terverifikasi' },
		{ id: 3, course: 'Jaringan Komputer Dasar', recipient: 'Rian Pratama', nim: '2101020018', date: '10 Jul 2026', credentialId: 'AR-2026-55D0', score: '88/100', status: 'Terverifikasi' },
		{ id: 4, course: 'Machine Learning Dasar', recipient: 'Budi Santoso', nim: '2101020052', date: 'Draf', credentialId: 'AR-2026-91E2', score: '81/100', status: 'Menunggu Terbit' }
	]);

	let message = $state('');

	function publish(id: number) {
		certificates = certificates.map((c) =>
			c.id === id ? { ...c, status: 'Terverifikasi' as const, date: 'Hari ini' } : c
		);
		message = 'Sertifikat diterbitkan dan siap diverifikasi peserta.';
	}
</script>

<svelte:head>
	<title>Sertifikat — Instruktur Aristoteles</title>
	<meta name="description" content="Daftar sertifikat yang diterbitkan instruktur untuk peserta yang lulus." />
</svelte:head>

<div class="p-4 sm:p-6 lg:p-8">
	<div class="mb-6">
		<p class="text-xs font-bold tracking-widest text-blue-600 uppercase">Menu Utama · Sertifikat</p>
		<h1 class="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Sertifikat</h1>
		<p class="mt-1 text-sm text-slate-500">
			{certificates.filter((c) => c.status === 'Terverifikasi').length} terverifikasi ·
			{certificates.filter((c) => c.status !== 'Terverifikasi').length} menunggu terbit.
		</p>
	</div>

	{#if message}
		<p role="status" class="mb-4 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-700">
			<i class="fa-solid fa-circle-check mt-0.5 shrink-0" aria-hidden="true"></i>
			<span>{message}</span>
		</p>
	{/if}

	<div
		class="mb-6 flex flex-col gap-4 rounded-2xl bg-gradient-to-br from-amber-500 via-amber-600 to-orange-700 p-6 text-white sm:flex-row sm:items-center sm:justify-between"
	>
		<div class="flex items-center gap-4">
			<span class="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20">
				<i class="fa-solid fa-award text-xl" aria-hidden="true"></i>
			</span>
			<div>
				<p class="text-lg font-bold">3 Sertifikat Terverifikasi</p>
				<p class="text-sm text-amber-100">Ditandatangani digital oleh Kevin Perry · Aristoteles Academy.</p>
			</div>
		</div>
		<a
			href="/instruktur/penilaian"
			class="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-2.5 text-xs font-bold text-amber-700 transition-colors duration-200 ease-smooth hover:bg-amber-50 focus-visible:outline-2 focus-visible:outline-white"
		>
			<i class="fa-solid fa-clipboard-check" aria-hidden="true"></i> Cek Kelulusan Peserta
		</a>
	</div>

	<div class="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
		{#each certificates as cert (cert.id)}
			<article
				class="flex flex-col overflow-hidden rounded-2xl border border-slate-200/70 bg-white transition-all duration-300 ease-smooth hover:-translate-y-1 hover:shadow-xl"
			>
				<div class="relative bg-slate-900 p-6 text-center">
					<div
						class="pointer-events-none absolute inset-0 bg-gradient-to-br from-blue-600/30 via-transparent to-amber-500/20"
						aria-hidden="true"
					></div>
					<i class="fa-solid fa-award mb-2 text-4xl text-amber-400" aria-hidden="true"></i>
					<p class="text-[10px] font-bold tracking-widest text-slate-400 uppercase">Sertifikat Kelulusan</p>
					<h2 class="mt-1 text-lg font-extrabold text-white">{cert.course}</h2>
					<p class="mt-0.5 text-xs text-slate-300">Diberikan kepada <strong class="text-white">{cert.recipient}</strong></p>
					<div class={`mt-3 inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-bold ${cert.status === 'Terverifikasi' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>
						<i class="fa-solid {cert.status === 'Terverifikasi' ? 'fa-circle-check' : 'fa-hourglass-half'}" aria-hidden="true"></i>
						{cert.status}
					</div>
				</div>

				<div class="flex flex-1 flex-col gap-3 p-5 text-sm">
					<dl class="space-y-2 text-[13px]">
						<div class="flex justify-between gap-2">
							<dt class="text-slate-500">Penerima</dt>
							<dd class="font-semibold text-slate-800">{cert.recipient} · {cert.nim}</dd>
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
						{#if cert.status === 'Terverifikasi'}
							<button
								type="button"
								class="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white transition-all duration-200 ease-smooth hover:bg-blue-700 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-blue-600"
							>
								<i class="fa-solid fa-download" aria-hidden="true"></i> Unduh PDF
							</button>
							<button
								type="button"
								class="flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-700 transition-colors duration-200 ease-smooth hover:bg-slate-200 focus-visible:outline-2 focus-visible:outline-slate-500"
							>
								<i class="fa-solid fa-share-nodes" aria-hidden="true"></i> Bagikan
							</button>
						{:else}
							<button
								type="button"
								onclick={() => publish(cert.id)}
								class="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white transition-all duration-200 ease-smooth hover:bg-emerald-700 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-emerald-600"
							>
								<i class="fa-solid fa-stamp" aria-hidden="true"></i> Terbitkan Sekarang
							</button>
						{/if}
					</div>
				</div>
			</article>
		{/each}
	</div>
</div>
