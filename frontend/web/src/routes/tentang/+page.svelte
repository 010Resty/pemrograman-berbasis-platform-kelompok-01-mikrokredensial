<script lang="ts">
	import '../../app.css';
	import { resolve } from '$app/paths';
</script>

<svelte:head>
	<title>Mengalihkan… — ARISTOTELES</title>
	<meta http-equiv="refresh" content={`0;url=${resolve('/tentang/arti-nama')}`} />
</svelte:head>

<main class="mx-auto max-w-lg px-4 py-20 text-center">
	<p class="text-sm text-slate-600">
		Mengalihkan ke halaman Tentang…
		<a href={resolve('/tentang/arti-nama')} class="font-bold text-royal hover:underline">
			klik di sini bila tidak berpindah otomatis
		</a>.
	</p>
</main>
