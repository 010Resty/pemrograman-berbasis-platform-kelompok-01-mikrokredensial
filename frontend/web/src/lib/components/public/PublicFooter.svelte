<script lang="ts">
	import { resolve } from '$app/paths';
	import Logo from '$lib/components/Logo.svelte';
</script>

<footer class="bg-abyss text-slate-300">
	<div class="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-4 py-14 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
		<div class="space-y-4">
			<Logo size="md" showText={true} textSize="lg" dark={true} />
			<p class="max-w-xs text-sm leading-relaxed text-slate-300">
				Platform pembelajaran mikrokredensial: dari memilih pelatihan hingga memperoleh
				sertifikat. Terstruktur, terukur, dan berkelanjutan.
			</p>
		</div>
		<nav aria-label="Navigasi footer">
			<h2 class="font-heading text-sm font-bold tracking-wide text-white uppercase">Jelajah</h2>
			<ul class="mt-4 space-y-2.5 text-sm">
				<li><a href={resolve('/')} class="transition-colors duration-200 hover:text-white">Promo</a></li>
				<li><a href={resolve('/pelatihan')} class="transition-colors duration-200 hover:text-white">Pelatihan</a></li>
				<li><a href={resolve('/peringkat')} class="transition-colors duration-200 hover:text-white">Peringkat</a></li>
				<li><a href={resolve('/tentang')} class="transition-colors duration-200 hover:text-white">Tentang</a></li>
				<li><a href={resolve('/verifikasi')} class="transition-colors duration-200 hover:text-white">Verifikasi sertifikat</a></li>
			</ul>
		</nav>
		<nav aria-label="Portal footer">
			<h2 class="font-heading text-sm font-bold tracking-wide text-white uppercase">Portal</h2>
			<ul class="mt-4 space-y-2.5 text-sm">
				<li><a href={resolve('/user')} class="transition-colors duration-200 hover:text-white">Portal peserta</a></li>
				<li><a href={resolve('/instruktur')} class="transition-colors duration-200 hover:text-white">Portal instruktur</a></li>
				<li><a href={resolve('/admin')} class="transition-colors duration-200 hover:text-white">Portal admin</a></li>
				<li><a href={resolve('/modules')} class="transition-colors duration-200 hover:text-white">Katalog lengkap</a></li>
			</ul>
		</nav>
		<nav aria-label="Informasi footer">
			<h2 class="font-heading text-sm font-bold tracking-wide text-white uppercase">Informasi</h2>
			<ul class="mt-4 space-y-2.5 text-sm">
				<li><a href={resolve('/tentang')} class="transition-colors duration-200 hover:text-white">Tentang ARISTOTELES</a></li>
				<li><a href={resolve('/syarat-ketentuan')} class="transition-colors duration-200 hover:text-white">Syarat &amp; ketentuan</a></li>
				<li><a href={resolve('/kebijakan-privasi')} class="transition-colors duration-200 hover:text-white">Kebijakan privasi</a></li>
			</ul>
		</nav>
	</div>
	<div class="border-t border-white/10">
		<p class="mx-auto max-w-7xl px-4 py-6 text-center text-xs text-slate-300 sm:px-6 lg:px-8">
			&copy; 2026 Aristoteles Platform Mikrokredensial. Semua hak dilindungi.
		</p>
	</div>
</footer>
