<script lang="ts">
	import { aristotleLogo as logoUrl } from '$lib/assets/logo';

	let {
		size = 'md',
		showText = true,
		textSize = 'lg',
		dark = false
	}: {
		size?: 'sm' | 'md' | 'lg' | 'xl';
		showText?: boolean;
		textSize?: 'sm' | 'md' | 'lg' | 'xl';
		dark?: boolean;
	} = $props();

	const sizeClasses = {
		sm: 'w-8 h-8',
		md: 'w-10 h-10',
		lg: 'w-12 h-12',
		xl: 'w-16 h-16'
	};

	const textSizeClasses = {
		sm: 'text-sm',
		md: 'text-base',
		lg: 'text-xl',
		xl: 'text-2xl'
	};
</script>

<div class="flex items-center gap-3">
	<img
		src={logoUrl}
		alt="Aristotle Logo"
		class="{sizeClasses[size]} rounded-full object-cover shadow-lg"
	/>
	{#if showText}
		<div>
			<h1 class="{textSizeClasses[textSize]} font-bold {dark ? 'text-white' : 'text-slate-900'} tracking-tight">
				Aristotle
			</h1>
			<p class="text-xs {dark ? 'text-blue-200' : 'text-slate-500'} font-medium -mt-0.5">
				Platform Mikrokredensial
			</p>
		</div>
	{/if}
</div>
