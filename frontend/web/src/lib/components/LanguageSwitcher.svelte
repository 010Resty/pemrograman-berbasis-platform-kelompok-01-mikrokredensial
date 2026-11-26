<script lang="ts">
	import { page } from '$app/state';
	import { COOKIE_MAX_AGE, COOKIE_NAME, switchLangPath, type Locale } from '$lib/i18n/locale';
	import { t } from '$lib/i18n/index';

	let { lang }: { lang: Locale } = $props();

	const idHref = $derived(switchLangPath(page.url.pathname, page.url.search, 'id'));
	const enHref = $derived(switchLangPath(page.url.pathname, page.url.search, 'en'));

	function remember(target: Locale): void {
		try {
			document.cookie = `${COOKIE_NAME}=${target}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
		} catch {
			/* Cookie diblokir — URL tetap sumber kebenaran. */
		}
	}
</script>

<!--
	Segmented toggle ID | EN — tombolnya langsung pada teksnya.
	Aktif: pill royal; nonaktif: link biasa ke URL bahasa lawan.
-->
<div
	role="group"
	aria-label={t(lang, 'lang.label')}
	class="inline-flex shrink-0 items-center gap-0.5 rounded-full border border-mist bg-white p-1"
>
	<a
		href={idHref}
		onclick={() => remember('id')}
		hreflang="id"
		aria-current={lang === 'id' ? 'true' : undefined}
		title={t(lang, 'lang.id')}
		class="inline-flex min-h-[36px] items-center rounded-full px-3 text-xs font-bold transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-royal {lang === 'id'
			? 'bg-royal text-white shadow-sm'
			: 'text-slate-500 hover:text-abyss'}"
	>
		ID
	</a>
	<a
		href={enHref}
		onclick={() => remember('en')}
		hreflang="en"
		aria-current={lang === 'en' ? 'true' : undefined}
		title={t(lang, 'lang.en')}
		class="inline-flex min-h-[36px] items-center rounded-full px-3 text-xs font-bold transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-royal {lang === 'en'
			? 'bg-royal text-white shadow-sm'
			: 'text-slate-500 hover:text-abyss'}"
	>
		EN
	</a>
</div>
