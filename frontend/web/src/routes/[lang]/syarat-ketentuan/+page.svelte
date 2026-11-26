<script lang="ts">
	import { page } from '$app/state';
	import Logo from '$lib/components/Logo.svelte';
	import SeoHead from '$lib/components/SeoHead.svelte';
	import { canonicalPath, getSiteUrl, altUrls } from '$lib/seo/site';
	import { lp, jsonLdLang, type Locale } from '$lib/i18n/locale';

	const lang: Locale = $derived(page.params.lang === 'en' ? 'en' : 'id');
	const updatedAt = '15 November 2026';

	const sections = [
		{
			id: 'definisi',
			icon: 'fa-book-open',
			title: '1. Definisi dan Ruang Lingkup',
			body: [
				'“Platform” adalah layanan pembelajaran mikrokredensial ARISTOTELES yang diakses melalui situs web dan aplikasi seluler.',
				'“Pengguna” adalah setiap orang yang membuat akun, mencakup Peserta, Instruktur, dan Admin sesuai peran yang ditetapkan sistem.',
				'“Kursus” adalah paket pembelajaran berbayar maupun gratis yang terdiri atas modul, materi, kuis, tugas, dan sertifikat.',
				'Dengan membuat akun atau melakukan pembayaran, Anda menyatakan telah membaca, memahami, dan menyetujui seluruh ketentuan dalam dokumen ini.'
			]
		},
		{
			id: 'akun',
			icon: 'fa-circle-user',
			title: '2. Akun Pengguna',
			body: [
				'Anda wajib memberikan nama lengkap dan alamat email yang benar serta menjaga kerahasiaan kredensial akun Anda.',
				'Akun bersifat pribadi dan tidak dapat dialihkan; seluruh aktivitas yang terjadi melalui akun Anda menjadi tanggung jawab Anda.',
				'Nama yang terdaftar pada akun digunakan sebagai nama penerima sertifikat, sehingga pastikan data tersebut benar sebelum menyelesaikan pembayaran.',
				'Kami berhak menangguhkan atau menutup akun yang terbukti menyalahgunakan layanan, memalsukan identitas, atau melanggar ketentuan ini.'
			]
		},
		{
			id: 'harga',
			icon: 'fa-tags',
			title: '3. Harga Kursus',
			body: [
				'Harga yang berlaku adalah nominal yang tercantum pada halaman pembayaran pada saat pengajuan dibuat, dihitung otomatis oleh sistem dari harga resmi kursus dikurangi diskon yang berlaku.',
				'Harga dapat berubah sewaktu-waktu mengikuti kebijakan promo; perubahan tidak berlaku surut terhadap pembayaran yang telah disetujui.',
				'Seluruh harga dinyatakan dalam Rupiah (IDR) dan sudah termasuk akses materi, evaluasi, serta sertifikat kelulusan sesuai ketentuan kursus.'
			]
		},
		{
			id: 'pembayaran',
			icon: 'fa-qrcode',
			title: '4. Pembayaran',
			body: [
				'Pembayaran dilakukan melalui QRIS. Setelah memindai kode dan membayar PERSIS sebesar total tagihan, Anda wajib mengunggah bukti bayar melalui halaman pembayaran.',
				'Setiap pengajuan pembayaran diverifikasi oleh admin paling lambat 1×24 jam. Akses kursus dibuka otomatis segera setelah pembayaran disetujui.',
				'Nominal yang kurang dari tagihan mengakibatkan pengajuan ditolak; Anda dapat mengajukan ulang pembayaran tanpa biaya tambahan.',
				'Pengajuan yang tidak disertai bukti bayar tidak dapat diverifikasi dan tidak membuka akses kursus.'
			]
		},
		{
			id: 'voucher',
			icon: 'fa-ticket',
			title: '5. Voucher dan Promo',
			body: [
				'Kode voucher diskon bersifat personal sesuai ketentuan kampanyenya dan baru hangus setelah pembayaran yang menggunakannya disetujui.',
				'Promo dan voucher tidak dapat digabungkan; sistem menerapkan potongan terbesar secara otomatis.',
				'Penyalahgunaan voucher, termasuk pemalsuan atau penggunaan oleh pihak yang tidak berhak, mengakibatkan pembatalan diskon dan dapat berujung penutupan akun.'
			]
		},
		{
			id: 'akses',
			icon: 'fa-graduation-cap',
			title: '6. Akses Materi dan Sertifikat',
			body: [
				'Kursus yang telah lunas memberikan akses selamanya sesuai status penerbitan kursus, kecuali kursus dihentikan karena alasan operasional atau hukum.',
				'Sertifikat diterbitkan per modul apabila seluruh syarat kelulusan modul terpenuhi, serta satu sertifikat tingkat kursus setelah seluruh modul tuntas.',
				'Kelulusan dinilai berdasarkan ketentuan tiap kursus (kuis, tugas, dan rubrik penilaian) dan tidak dapat dinegosiasikan di luar mekanisme yang tersedia.'
			]
		},
		{
			id: 'kewajiban',
			icon: 'fa-scale-balanced',
			title: '7. Kewajiban dan Larangan Pengguna',
			body: [
				'Anda wajib mengerjakan kuis dan tugas secara mandiri serta dilarang melakukan kecurangan akademik dalam bentuk apa pun.',
				'Dilarang membagikan, menjual kembali, mengunduh massal, atau mendistribusikan materi kursus kepada pihak yang tidak memiliki akses resmi.',
				'Dilarang mengganggu keamanan sistem, mengakses data pengguna lain, atau menggunakan layanan untuk tujuan yang melanggar hukum.'
			]
		},
		{
			id: 'hki',
			icon: 'fa-copyright',
			title: '8. Hak Kekayaan Intelektual',
			body: [
				'Seluruh materi, kurikulum, merek, dan tampilan Platform dilindungi hak cipta dan tetap menjadi milik ARISTOTELES atau pemberi lisensinya.',
				'Pembayaran kursus memberikan lisensi pribadi, non-eksklusif, dan tidak dapat dialihkan untuk mengakses materi — bukan pengalihan hak cipta.',
				'Tugas dan karya yang Anda unggah tetap menjadi milik Anda; dengan mengunggahnya Anda memberi kami lisensi untuk menampilkannya dalam rangka penilaian dan layanan.'
			]
		},
		{
			id: 'pengembalian',
			icon: 'fa-rotate-left',
			title: '9. Kebijakan Pengembalian 30 Hari',
			body: [
				'Anda dapat mengajukan pengembalian dana (refund) paling lambat 30 hari kalender sejak pembayaran disetujui, melalui kontak resmi dengan menyertakan nomor invoice dan alasan pengajuan.',
				'Pengajuan disetujui apabila progres belajar di bawah 25% dari total materi kursus dan belum ada sertifikat yang diterbitkan atas kursus tersebut.',
				'Dana dikembalikan ke rekening atau dompet elektronik asal maksimal 14 hari kerja setelah pengajuan disetujui, dikurangi biaya transfer bank atau penyedia pembayaran bila ada.',
				'Pengembalian tidak berlaku apabila akun terbukti melanggar ketentuan (kecurangan, pembajakan materi, atau pemalsuan bukti bayar), atau apabila kursus telah dituntaskan dan sertifikat telah diterbitkan.'
			]
		},
		{
			id: 'pembatalan',
			icon: 'fa-ban',
			title: '10. Pembatalan oleh Platform',
			body: [
				'Kami dapat membatalkan kursus atau menutup akses apabila terjadi pelanggaran berat, kendala operasional, atau kewajiban hukum, dengan pemberitahuan melalui email akun Anda.',
				'Apabila pembatalan berasal dari pihak kami dan bukan karena pelanggaran Anda, Anda berhak atas pengembalian dana penuh sesuai mekanisme pada pasal 9.',
				'Akses yang ditutup karena pelanggaran ketentuan tidak memberikan hak pengembalian dana.'
			]
		},
		{
			id: 'tanggung-jawab',
			icon: 'fa-shield-halved',
			title: '11. Batasan Tanggung Jawab',
			body: [
				'Layanan disediakan sebagaimana adanya; kami berupaya menjaga ketersediaan dan keamanan sistem namun tidak menjamin layanan bebas gangguan setiap saat.',
				'Tanggung jawab kami atas kerugian yang timbul dari penggunaan layanan terbatas pada nilai pembayaran kursus yang terkait.',
				'Kami tidak bertanggung jawab atas kerugian tidak langsung, termasuk kehilangan keuntungan atau data, yang timbul dari penggunaan atau ketidakmampuan menggunakan layanan.'
			]
		},
		{
			id: 'perubahan',
			icon: 'fa-rotate',
			title: '12. Perubahan Ketentuan',
			body: [
				'Ketentuan ini dapat diperbarui mengikuti perkembangan layanan dan peraturan. Versi terbaru selalu tersedia di halaman ini beserta tanggal pembaruannya.',
				'Penggunaan layanan setelah perubahan berlaku dianggap sebagai persetujuan Anda terhadap ketentuan yang baru.'
			]
		},
		{
			id: 'kontak',
			icon: 'fa-envelope',
			title: '13. Hukum yang Berlaku dan Kontak',
			body: [
				'Ketentuan ini diatur dan ditafsirkan berdasarkan hukum Republik Indonesia.',
				'Pertanyaan mengenai ketentuan, pembayaran, maupun pengembalian dana dapat disampaikan ke support@aristoteles.id dengan menyertakan email akun dan nomor invoice bila terkait transaksi.'
			]
		}
	];
</script>

<SeoHead
	title="Syarat & Ketentuan — ARISTOTELES"
	description="Syarat dan ketentuan ARISTOTELES: akun, harga, pembayaran QRIS, voucher, akses materi, sertifikat, serta kebijakan pengembalian dana 30 hari."
	path={lp(lang, '/syarat-ketentuan')}
	lang={lang}
	alternates={altUrls(lp(lang, '/syarat-ketentuan'))}
	jsonLd={[
		{
			'@context': 'https://schema.org',
			'@type': 'WebPage',
			name: 'Syarat dan Ketentuan ARISTOTELES',
			url: canonicalPath(lp(lang, '/syarat-ketentuan')),
			inLanguage: jsonLdLang(lang),
			isPartOf: { '@type': 'WebSite', name: 'ARISTOTELES', url: getSiteUrl() }
		},
		{
			'@type': 'BreadcrumbList',
			itemListElement: [
				{ '@type': 'ListItem', position: 1, name: 'Beranda', item: canonicalPath(lp(lang, '/')) },
				{
					'@type': 'ListItem',
					position: 2,
					name: 'Syarat dan Ketentuan',
					item: canonicalPath(lp(lang, '/syarat-ketentuan'))
				}
			]
		}
	]}
/>

<header class="sticky top-0 z-50 bg-white shadow-sm">
	<div class="mx-auto flex h-16 max-w-4xl items-center justify-between gap-3 px-4 sm:px-6">
		<a
			href={lp(lang, '/')}
			class="rounded-lg focus-visible:outline-2 focus-visible:outline-blue-600"
			aria-label="Aristoteles - Beranda"
		>
			<Logo size="sm" showText={true} textSize="md" />
		</a>
		<nav aria-label="Navigasi" class="flex shrink-0 items-center gap-2 text-xs font-bold">
			<a
				href={lp(lang, '/login')}
				class="rounded-full border border-blue-600 px-4 py-2 text-blue-700 uppercase transition hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
			>
				Masuk
			</a>
			<a
				href={lp(lang, '/register')}
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
				class="mb-3 inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700"
			>
				<i class="fa-solid fa-file-contract" aria-hidden="true"></i> Dokumen Legal
			</div>
			<h1 class="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
				Syarat & Ketentuan
			</h1>
			<p class="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">
				Aturan main menggunakan ARISTOTELES — dari akun, pembayaran QRIS, hingga
				kebijakan pengembalian dana 30 hari. Mohon dibaca sebelum mencentang
				persetujuan pada halaman pembayaran.
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
							class="flex items-center gap-2 rounded-lg px-2 py-1.5 font-medium text-blue-700 transition hover:bg-blue-50 hover:underline focus-visible:outline-2 focus-visible:outline-blue-600"
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
							class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white"
							aria-hidden="true"
						>
							<i class={`fa-solid ${s.icon} text-sm`}></i>
						</span>
						{s.title}
					</h2>
					<ul class="space-y-2.5 text-sm leading-relaxed text-slate-600">
						{#each s.body as paragraph (paragraph)}
							<li class="flex gap-2.5">
								<i class="fa-solid fa-check mt-1 shrink-0 text-xs text-emerald-500" aria-hidden="true"></i>
								<span>{paragraph}</span>
							</li>
						{/each}
					</ul>
				</section>
			{/each}
		</div>

		<div class="mt-8 flex flex-col gap-2.5 sm:flex-row">
			<a
				href="#pengembalian"
				class="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-2.5 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100 focus-visible:outline-2 focus-visible:outline-emerald-600"
			>
				<i class="fa-solid fa-rotate-left" aria-hidden="true"></i> Kebijakan Pengembalian Dana
			</a>
			<a
				href="/user/semua-kursus"
				class="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white transition hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
			>
				<i class="fa-solid fa-layer-group" aria-hidden="true"></i> Jelajahi Kursus
			</a>
		</div>
	</div>
</main>
