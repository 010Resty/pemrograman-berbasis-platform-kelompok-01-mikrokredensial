<script lang="ts">
	import { aristotelesLogo as favicon } from '$lib/assets/logo';
	import ToastViewport from '$lib/components/ToastViewport.svelte';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" type="image/png" href={favicon} />
	<!-- Font Awesome 6.4.0 self-hosted (static/vendor): tanpa request CDN,
		non-blocking agar tidak menahan first paint/LCP. Ikon muncul setelah
		CSS tiba; tanpa JS fallback noscript. -->
	<link
		rel="stylesheet"
		href="/vendor/fontawesome/css/all.min.css"
		media="print"
		onload={(e) => {
			(e.currentTarget as HTMLLinkElement).media = 'all';
		}}
	/>
	<noscript>
		<link rel="stylesheet" href="/vendor/fontawesome/css/all.min.css" />
	</noscript>
</svelte:head>

{@render children()}
<ToastViewport />
