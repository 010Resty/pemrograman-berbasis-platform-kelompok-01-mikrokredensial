<script lang="ts">
	import PromoTypePage from '$lib/components/promo/PromoTypePage.svelte';

	let { data }: { data: { origin: string } } = $props();
</script>

<PromoTypePage type="patungan" {data} />
