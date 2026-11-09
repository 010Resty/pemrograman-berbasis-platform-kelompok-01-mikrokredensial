<script lang="ts">
	import { aristotelesLogo as favicon } from '$lib/assets/logo';
	import ToastViewport from '$lib/components/ToastViewport.svelte';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" type="image/png" href={favicon} />
	<!-- Font Awesome 6.4.0 self-hosted (static/vendor): tanpa request CDN. Stylesheet biasa agar patuh CSP. -->
	<link rel="stylesheet" href="/vendor/fontawesome/css/all.min.css" />
</svelte:head>

{@render children()}
<ToastViewport />
