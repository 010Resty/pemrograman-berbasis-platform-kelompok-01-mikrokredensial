<script lang="ts">
	import { page } from '$app/state';
	import Logo from '$lib/components/Logo.svelte';
	import { lp, type Locale } from '$lib/i18n/locale';
	import { t } from '$lib/i18n/index';

	const lang: Locale = $derived(page.params.lang === 'en' ? 'en' : 'id');
</script>

<footer class="bg-abyss text-slate-300">
	<div class="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-4 py-14 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
		<div class="space-y-4">
			<Logo size="md" showText={true} textSize="lg" dark={true} />
			<p class="max-w-xs text-sm leading-relaxed text-slate-300">
				{t(lang, 'footer.tagline')}
			</p>
		</div>
		<nav aria-label={t(lang, 'footer.explore')}>
			<h2 class="font-heading text-sm font-bold tracking-wide text-white uppercase">{t(lang, 'footer.explore')}</h2>
			<ul class="mt-4 space-y-2.5 text-sm">
				<li><a href={lp(lang, '/')} class="transition-colors duration-200 hover:text-white">{t(lang, 'nav.promo')}</a></li>
				<li><a href={lp(lang, '/pelatihan')} class="transition-colors duration-200 hover:text-white">{t(lang, 'nav.pelatihan')}</a></li>
				<li><a href={lp(lang, '/peringkat')} class="transition-colors duration-200 hover:text-white">{t(lang, 'nav.peringkat')}</a></li>
				<li><a href={lp(lang, '/tentang/arti-nama')} class="transition-colors duration-200 hover:text-white">{t(lang, 'nav.tentang')}</a></li>
				<li><a href={lp(lang, '/verifikasi')} class="transition-colors duration-200 hover:text-white">{t(lang, 'footer.verifyCert')}</a></li>
			</ul>
		</nav>
		<nav aria-label={t(lang, 'footer.portalTitle')}>
			<h2 class="font-heading text-sm font-bold tracking-wide text-white uppercase">{t(lang, 'footer.portalTitle')}</h2>
			<ul class="mt-4 space-y-2.5 text-sm">
				<li><a href="/user" class="transition-colors duration-200 hover:text-white">{t(lang, 'footer.student')}</a></li>
				<li><a href="/instruktur" class="transition-colors duration-200 hover:text-white">{t(lang, 'footer.teacher')}</a></li>
				<li><a href="/admin" class="transition-colors duration-200 hover:text-white">{t(lang, 'footer.admin')}</a></li>
				<li><a href={lp(lang, '/pelatihan')} class="transition-colors duration-200 hover:text-white">{t(lang, 'footer.catalog')}</a></li>
			</ul>
		</nav>
		<nav aria-label={t(lang, 'footer.infoTitle')}>
			<h2 class="font-heading text-sm font-bold tracking-wide text-white uppercase">{t(lang, 'footer.infoTitle')}</h2>
			<ul class="mt-4 space-y-2.5 text-sm">
				<li><a href={lp(lang, '/tentang/arti-nama')} class="transition-colors duration-200 hover:text-white">{t(lang, 'footer.about')}</a></li>
				<li><a href={lp(lang, '/tentang/cara-kerja')} class="transition-colors duration-200 hover:text-white">{t(lang, 'footer.how')}</a></li>
				<li><a href={lp(lang, '/tentang/kontak')} class="transition-colors duration-200 hover:text-white">{t(lang, 'footer.contact')}</a></li>
				<li><a href={lp(lang, '/tentang/keunggulan')} class="transition-colors duration-200 hover:text-white">{t(lang, 'footer.advantages')}</a></li>
				<li><a href={lp(lang, '/syarat-ketentuan')} class="transition-colors duration-200 hover:text-white">{t(lang, 'footer.terms')}</a></li>
				<li><a href={lp(lang, '/kebijakan-privasi')} class="transition-colors duration-200 hover:text-white">{t(lang, 'footer.privacy')}</a></li>
			</ul>
		</nav>
	</div>
	<div class="border-t border-white/10">
		<p class="mx-auto max-w-7xl px-4 py-6 text-center text-xs text-slate-300 sm:px-6 lg:px-8">
			&copy; 2026 Aristoteles Platform Mikrokredensial. {t(lang, 'footer.rights')}
		</p>
	</div>
</footer>
