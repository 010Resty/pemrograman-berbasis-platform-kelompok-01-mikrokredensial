<!-- UserAvatar — foto profil user lain dengan fallback inisial.
	Menerima avatarUrl relatif backend (/api/v1/files/:id/content) atau null.
	URL diabsolutkan via fileUrl() lalu disaring aman (tolak javascript:/data:).
-->
<script lang="ts">
	import { fileUrl } from '$lib/api/courses';

	let {
		name,
		avatarUrl = null,
		size = 'h-10 w-10',
		text = 'text-xs',
		rounded = 'rounded-full'
	}: {
		name: string;
		avatarUrl?: string | null;
		size?: string;
		text?: string;
		rounded?: string;
	} = $props();

	const initials = $derived(
		name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?'
	);

	const src = $derived.by((): string | null => {
		const raw = (avatarUrl ?? '').trim();
		if (!raw || raw.length > 2048 || /[\s<>"]/.test(raw)) return null;
		if (/^(javascript|data|blob|file):/i.test(raw)) return null;
		try {
			const abs = fileUrl(raw);
			if (abs.startsWith('https://')) return abs;
			if (abs.startsWith('http://localhost') || abs.startsWith('http://127.0.0.1'))
				return abs;
			return null;
		} catch {
			return null;
		}
	});
</script>

{#if src}
	<img
		{src}
		alt=""
		loading="lazy"
		class={`${size} ${rounded} shrink-0 object-cover shadow-sm`}
		aria-hidden="true"
	/>
{:else}
	<span
		class={`flex ${size} ${rounded} shrink-0 items-center justify-center bg-blue-600 font-bold text-white shadow-sm ${text}`}
		aria-hidden="true"
	>
		{initials}
	</span>
{/if}
