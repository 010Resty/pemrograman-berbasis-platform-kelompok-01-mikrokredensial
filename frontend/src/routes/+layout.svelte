<script lang="ts">
	import { aristotelesLogo as favicon } from '$lib/assets/logo';
	import ToastViewport from '$lib/components/ToastViewport.svelte';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" type="image/png" href={favicon} />
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<!-- Font Awesome dimuat non-blocking agar tidak menahan first paint/LCP
		halaman login dan portal (render-blocking stylesheet = penunda LCP utama
		pada halaman statis). Ikon muncul setelah CSS tiba; tanpa JS fallback noscript. -->
	<link
		rel="stylesheet"
		href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
		media="print"
		onload={(e) => {
			(e.currentTarget as HTMLLinkElement).media = 'all';
		}}
	/>
	<noscript>
		<link
			rel="stylesheet"
			href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
		/>
	</noscript>
</svelte:head>

{@render children()}
<ToastViewport />
