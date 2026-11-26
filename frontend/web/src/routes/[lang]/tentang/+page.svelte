<script lang="ts">
	import { page } from '$app/state';
	import { lp, type Locale } from '$lib/i18n/locale';
	import { t } from '$lib/i18n/index';

	const lang: Locale = $derived(page.params.lang === 'en' ? 'en' : 'id');
	const target = $derived(lp(lang, '/tentang/arti-nama'));
</script>

<svelte:head>
	<title>{t(lang, 'about.redirectTitle')} — ARISTOTELES</title>
	<meta http-equiv="refresh" content={`0;url=${target}`} />
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<main class="mx-auto max-w-lg px-4 py-20 text-center">
	<p class="text-sm text-slate-600">
		{t(lang, 'about.redirectBody')}
		<a href={target} class="font-bold text-royal hover:underline">
			{t(lang, 'about.redirectLink')}
		</a>.
	</p>
</main>
