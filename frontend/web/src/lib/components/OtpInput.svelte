<script lang="ts">
	import { tick } from 'svelte';
	import { page } from '$app/state';
	import { t } from '$lib/i18n/index';
	import { type Locale } from '$lib/i18n/locale';

	interface Props {
		value?: string;
		length?: number;
		id?: string;
		disabled?: boolean;
		label?: string;
	}

	let {
		value = $bindable(''),
		length = 6,
		id = 'otp',
		disabled = false,
		label
	}: Props = $props();

	const lang: Locale = $derived(page.params.lang === 'en' ? 'en' : 'id');
	const groupLabel = $derived(label ?? t(lang, 'otp.label'));

	// Satu string digit; kotak dirender dari sini agar tidak menangkap nilai awal prop.
	let digits = $state(value);
	let inputs = $state<Array<HTMLInputElement | null>>([]);

	// Fokus kotak pertama saat komponen tampil (tanpa atribut autofocus).
	$effect(() => {
		void tick().then(() => inputs[0]?.focus());
	});

	// Sinkron balik bila parent mengosongkan (mis. setelah kirim ulang).
	$effect(() => {
		if (value === '' && digits !== '') digits = '';
	});

	function sync(next: string): void {
		digits = next;
		value = next;
	}

	function handleInput(i: number, event: Event): void {
		const el = event.currentTarget as HTMLInputElement;
		const digit = el.value.replace(/\D/g, '').slice(-1);
		el.value = digit;
		const arr = digits.split('');
		arr[i] = digit;
		sync(arr.join(''));
		if (digit && i < length - 1) inputs[i + 1]?.focus();
	}

	function handleKeydown(i: number, event: KeyboardEvent): void {
		if (event.key === 'Backspace' && !digits[i] && i > 0) {
			inputs[i - 1]?.focus();
		}
	}

	function handlePaste(event: ClipboardEvent): void {
		const text = event.clipboardData?.getData('text').replace(/\D/g, '').slice(0, length);
		if (!text) return;
		event.preventDefault();
		sync(Array.from({ length }, (_, i) => text[i] ?? '').join(''));
		inputs[Math.min(text.length, length) - 1]?.focus();
	}
</script>

<fieldset>
	<legend class="sr-only">{groupLabel}</legend>
	<div class="flex justify-between gap-2" role="group" aria-label={groupLabel}>
		{#each Array.from({ length }, (_, i) => i) as i (i)}
			<input
				id={i === 0 ? id : `${id}-${i + 1}`}
				type="text"
				inputmode="numeric"
				autocomplete="one-time-code"
				maxlength={1}
				disabled={disabled}
				bind:this={inputs[i]}
				value={digits[i] ?? ''}
				oninput={(e) => handleInput(i, e)}
				onkeydown={(e) => handleKeydown(i, e)}
				onpaste={handlePaste}
				aria-label={t(lang, 'otp.digit', { i: i + 1, n: length })}
				class="h-12 w-full min-w-0 rounded-xl border border-slate-200 bg-white text-center text-lg font-bold text-slate-900 transition-all placeholder:text-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
			/>
		{/each}
	</div>
</fieldset>
