<script lang="ts">
	import ProfileEditor from '$lib/components/training/organisms/ProfileEditor.svelte';
</script>

<svelte:head>
	<title>Profil Saya — Aristoteles Instruktur</title>
	<meta name="description" content="Kelola profil akun instruktur Anda." />
</svelte:head>

<div class="page-wrap page-stack">
	<div>
		<p class="text-[11px] font-extrabold tracking-widest text-slate-400 uppercase">Instruktur · Profil</p>
		<h1 class="mt-1 text-xl font-extrabold text-slate-900 sm:text-2xl">Profil Saya</h1>
		<p class="mt-1 text-sm text-slate-500">
			Kelola identitas, kontak, tempat tanggal lahir, dan foto profil akun Anda.
		</p>
	</div>
	<ProfileEditor backHref="/instruktur" />
</div>
