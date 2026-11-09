<script lang="ts">
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import ProfileEditor from '$lib/components/training/organisms/ProfileEditor.svelte';
</script>

<svelte:head>
	<title>Profil Saya — Aristoteles Platform</title>
	<meta name="description" content="Kelola profil akun Anda: identitas, kontak, dan foto." />
</svelte:head>

<div class="page-wrap page-stack">
	<PageHeader
		eyebrow="Menu Utama · Profil"
		title="Profil Saya"
		description="Kelola identitas, kontak, tempat tanggal lahir, dan foto profil akun Anda."
	/>
	<ProfileEditor backHref="/user" />
</div>
