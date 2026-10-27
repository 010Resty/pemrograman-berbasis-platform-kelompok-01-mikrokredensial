<script lang="ts">
	import '../../app.css';
	import Logo from '$lib/components/Logo.svelte';
	import { resolve } from '$app/paths';

	const updatedAt = '27 Oktober 2026';

	const sections = [
		{
			id: 'data',
			icon: 'fa-database',
			title: '1. Data yang Kami Kumpulkan',
			body: [
				'Data akun: nama lengkap, email, peran, dan kata sandi yang Anda masukkan saat mendaftar atau masuk.',
				'Data pembelajaran: progres materi, hasil kuis, pengumpulan tugas beserta nilai dan umpan balik, serta status kelulusan modul.',
				'Data transaksi: kepemilikan kursus, kode voucher yang ditukar, dan riwayat pembayaran.',
				'Data teknis: informasi perangkat dan peramban yang diperlukan untuk menjaga sesi dan keamanan layanan.'
			]
		},
		{
			id: 'tujuan',
			icon: 'fa-bullseye',
			title: '2. Tujuan Penggunaan Data',
			body: [
				'Menyediakan, mengoperasikan, dan mempersonalisasi layanan pembelajaran, termasuk pelacakan progres dan penerbitan sertifikat.',
				'Memvalidasi kelayakan kuis, tugas, voucher, dan sertifikat sesuai aturan yang berlaku di Platform.',
				'Mencegah penyalahgunaan, mendeteksi aktivitas mencurigakan, dan menjaga keamanan akun.',
				'Menyampaikan informasi layanan yang penting, seperti perubahan ketentuan atau status akun — bukan pemasaran tanpa persetujuan.'
			]
		},
		{
			id: 'penyimpanan',
			icon: 'fa-hard-drive',
			title: '3. Penyimpanan di Perangkat Anda',
			body: [
				'Agar dapat berjalan cepat, Platform menyimpan sebagian data sesi dan preferensi di penyimpanan lokal peramban (local storage), antara lain sesi masuk, kepemilikan kursus, draf kurikulum, hasil kuis, dan draf pengumpulan tugas.',
				'Data tersebut tersimpan di perangkat Anda dan ikut terhapus bila Anda keluar (logout), menghapus data situs, atau berganti peramban.',
				'Jangan gunakan opsi “ingat saya” atau menyimpan sesi di perangkat bersama/publik.'
			]
		},
		{
			id: 'berbagi',
			icon: 'fa-share-nodes',
			title: '4. Berbagi Data dengan Pihak Lain',
			body: [
				'Kami tidak menjual data pribadi Anda kepada pihak mana pun.',
				'Data dibagikan secara terbatas hanya untuk menjalankan layanan: misalnya kepada instruktur kursus yang Anda ikuti (untuk penilaian tugas) dan kepada admin Platform (untuk pengelolaan akun, voucher, dan sertifikat).',
				'Integrasi masuk (SSO) UNIRA belum aktif pada versi ini; tidak ada data yang dikirim ke sistem UNIRA melalui tombol terkait.',
				'Data dapat diungkapkan bila diwajibkan oleh hukum atau perintah pejabat yang berwenang.'
			]
		},
		{
			id: 'keamanan',
			icon: 'fa-lock',
			title: '5. Keamanan',
			body: [
				'Kami menerapkan langkah perlindungan yang wajar, termasuk pembatasan akses berbasis peran dan validasi di sisi server untuk operasi penting seperti penilaian, voucher, dan sertifikat.',
				'Anda berperan menjaga keamanan akun: gunakan kata sandi yang kuat dan unik, jangan membagikan kredensial, dan segera laporkan dugaan penyalahgunaan.',
				'Tidak ada sistem yang sepenuhnya kebal; bila terjadi insiden keamanan yang berdampak pada data Anda, kami akan menyampaikannya melalui kanal resmi.'
			]
		},
		{
			id: 'hak',
			icon: 'fa-hand-holding-heart',
			title: '6. Hak Anda atas Data',
			body: [
				'Meminta salinan, perbaikan, atau pembaruan atas data pribadi Anda yang kami simpan.',
				'Meminta penghapusan akun dan data terkait, sepanjang tidak bertentangan dengan kewajiban penyimpanan yang diwajibkan hukum.',
				'Menarik persetujuan pemrosesan data tertentu; penarikan dapat membatasi sebagian fungsi layanan.',
				'Permintaan dapat diajukan melalui kontak resmi di bawah dengan menyertakan email akun dan bukti identitas yang memadai.'
			]
		},
		{
			id: 'retensi',
			icon: 'fa-clock',
			title: '7. Masa Penyimpanan (Retensi)',
			body: [
				'Data akun dan pembelajaran disimpan selama akun aktif dan diperlukan untuk menyelenggarakan layanan.',
				'Data sertifikat dan catatan kelulusan dapat disimpan lebih lama sebagai arsip verifikasi.',
				'Data yang masa simpannya berakhir akan dihapus atau dianonimkan secara berkala.'
			]
		},
		{
			id: 'perubahan',
			icon: 'fa-rotate',
			title: '8. Perubahan Kebijakan',
			body: [
				'Kebijakan ini dapat diperbarui mengikuti perkembangan layanan dan peraturan. Versi terbaru selalu tersedia di halaman ini beserta tanggal pembaruannya.',
				'Perubahan yang bersifat material akan diinformasikan melalui pengumuman di Platform sebelum berlaku.'
			]
		}
	];
</script>

<svelte:head>
	<title>Kebijakan Privasi — Aristoteles</title>
	<meta
		name="description"
		content="Kebijakan privasi Platform Mikrokredensial Aristoteles: data yang dikumpulkan, tujuan, penyimpanan, berbagi data, keamanan, dan hak pengguna."
	/>
</svelte:head>

<header class="sticky top-0 z-50 bg-white shadow-sm">
	<div class="mx-auto flex h-16 max-w-4xl items-center justify-between gap-3 px-4 sm:px-6">
		<a
			href={resolve('/')}
			class="rounded-lg focus-visible:outline-2 focus-visible:outline-blue-600"
			aria-label="Aristoteles - Beranda"
		>
			<Logo size="sm" showText={true} textSize="md" />
		</a>
		<nav aria-label="Navigasi" class="flex shrink-0 items-center gap-2 text-xs font-bold">
			<a
				href={resolve('/login')}
				class="rounded-full border border-blue-600 px-4 py-2 text-blue-700 uppercase transition hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
			>
				Masuk
			</a>
			<a
				href={resolve('/register')}
				class="rounded-full bg-blue-600 px-4 py-2 text-white uppercase shadow-lg shadow-blue-500/25 transition hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
			>
				Daftar
			</a>
		</nav>
	</div>
</header>

<main class="bg-slate-50">
	<div class="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
		<div class="mb-8">
			<div
				class="mb-3 inline-flex items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700"
			>
				<i class="fa-solid fa-shield-halved" aria-hidden="true"></i> Dokumen Legal
			</div>
			<h1 class="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
				Kebijakan Privasi
			</h1>
			<p class="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">
				Penjelasan terbuka tentang data apa yang kami kumpulkan, untuk apa data itu dipakai, dan
				hak apa yang Anda miliki — ditulis sejujur kondisi layanan saat ini.
			</p>
			<p class="mt-3 text-xs font-semibold text-slate-400">
				Terakhir diperbarui: {updatedAt} · Berlaku untuk seluruh pengguna Platform.
			</p>
		</div>

		<nav
			aria-label="Daftar isi"
			class="mb-8 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"
		>
			<h2 class="mb-3 text-sm font-bold text-slate-900">Daftar Isi</h2>
			<ol class="grid gap-1.5 text-sm sm:grid-cols-2">
				{#each sections as s (s.id)}
					<li>
						<a
							href={`#${s.id}`}
							class="flex items-center gap-2 rounded-lg px-2 py-1.5 font-medium text-emerald-700 transition hover:bg-emerald-50 hover:underline focus-visible:outline-2 focus-visible:outline-emerald-600"
						>
							<i class={`fa-solid ${s.icon} w-4 text-center text-slate-400`} aria-hidden="true"></i>
							{s.title}
						</a>
					</li>
				{/each}
			</ol>
		</nav>

		<div class="space-y-4">
			{#each sections as s (s.id)}
				<section
					id={s.id}
					aria-labelledby={`${s.id}-title`}
					class="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"
				>
					<h2 id={`${s.id}-title`} class="mb-3 flex items-center gap-2.5 text-base font-bold text-slate-900">
						<span
							class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"
						>
							<i class={`fa-solid ${s.icon} text-sm`} aria-hidden="true"></i>
						</span>
						{s.title}
					</h2>
					<ul class="space-y-2">
						{#each s.body as paragraph (paragraph)}
							<li class="flex items-start gap-2.5 text-sm leading-relaxed text-slate-600">
								<i class="fa-solid fa-check mt-1 shrink-0 text-xs text-emerald-500" aria-hidden="true"></i>
								<span>{paragraph}</span>
							</li>
						{/each}
					</ul>
				</section>
			{/each}

			<section
				aria-labelledby="syarat-title"
				class="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-5 sm:p-6"
			>
				<h2 id="syarat-title" class="mb-2 flex items-center gap-2.5 text-base font-bold text-slate-900">
					<span
						class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white"
					>
						<i class="fa-solid fa-file-contract text-sm" aria-hidden="true"></i>
					</span>
					Dokumen Terkait
				</h2>
				<p class="text-sm leading-relaxed text-slate-600">
					Aturan penggunaan layanan diatur dalam
					<a
						href={resolve('/syarat-ketentuan')}
						class="font-bold text-emerald-700 hover:underline focus-visible:outline-2 focus-visible:outline-emerald-600"
					>
						Syarat & Ketentuan
					</a>
					Aristoteles. Kedua dokumen ini saling melengkapi dan berlaku bersamaan.
				</p>
			</section>
		</div>

		<div class="mt-8 flex flex-wrap items-center justify-between gap-3">
			<a
				href={resolve('/register')}
				class="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-600/25 transition hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
			>
				<i class="fa-solid fa-arrow-left" aria-hidden="true"></i>
				Kembali ke Pendaftaran
			</a>
			<a
				href={resolve('/')}
				class="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600"
			>
				<i class="fa-solid fa-house" aria-hidden="true"></i>
				Beranda
			</a>
		</div>

		<p class="mt-6 text-center text-xs text-slate-400">
			&copy; 2026 Aristoteles Platform Mikrokredensial. Semua hak dilindungi.
		</p>
	</div>
</main>
