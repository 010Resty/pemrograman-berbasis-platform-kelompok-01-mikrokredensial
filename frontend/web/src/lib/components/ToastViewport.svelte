<script lang="ts">
	import { dismissToast, toasts, type ToastItem, type ToastType } from '$lib/stores/toast.svelte';

	/**
	 * ToastViewport — wadah notifikasi terpusat.
	 *
	 * - Kanan atas di desktop, full-width responsif di mobile.
	 * - `pointer-events-none` pada wadah agar tidak menghalangi halaman;
	 *   tiap toast `pointer-events-auto` agar tombol tutup bisa diklik.
	 * - Live region sopan; toast error memakai `role="alert"`.
	 */

	const list = $derived(toasts());

	const CONFIG: Record<ToastType, { icon: string; tile: string; bar: string }> = {
		success: {
			icon: 'fa-circle-check',
			tile: 'bg-emerald-100 text-emerald-600',
			bar: 'bg-emerald-500'
		},
		error: {
			icon: 'fa-circle-exclamation',
			tile: 'bg-red-100 text-red-600',
			bar: 'bg-red-500'
		},
		warning: {
			icon: 'fa-triangle-exclamation',
			tile: 'bg-amber-100 text-amber-600',
			bar: 'bg-amber-500'
		},
		info: {
			icon: 'fa-circle-info',
			tile: 'bg-blue-100 text-blue-600',
			bar: 'bg-blue-600'
		}
	};

	function describe(item: ToastItem): string {
		return `${item.title}: ${item.message}`;
	}
</script>

<div
	aria-live="polite"
	aria-label="Notifikasi"
	class="pointer-events-none fixed inset-x-0 top-0 z-[90] flex flex-col items-stretch gap-2 p-4 sm:inset-x-auto sm:right-0 sm:w-[22rem] sm:p-5"
>
	{#each list as item (item.id)}
		{@const cfg = CONFIG[item.type]}
		<div
			role={item.type === 'error' ? 'alert' : 'status'}
			aria-label={describe(item)}
			class="toast-card pointer-events-auto relative flex items-start gap-3 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-xl shadow-slate-900/10 {item.leaving
				? 'toast-leaving'
				: ''}"
		>
			<span class="absolute inset-y-0 left-0 w-1 {cfg.bar}" aria-hidden="true"></span>
			<span
				class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl {cfg.tile}"
				aria-hidden="true"
			>
				<i class="fa-solid {cfg.icon}"></i>
			</span>
			<div class="min-w-0 flex-1">
				<p class="text-xs font-extrabold text-slate-900">{item.title}</p>
				<p class="mt-0.5 text-xs leading-relaxed break-words text-slate-600">{item.message}</p>
			</div>
			<button
				type="button"
				onclick={() => dismissToast(item.id)}
				aria-label="Tutup notifikasi: {item.title}"
				class="flex min-h-9 min-w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-blue-600"
			>
				<i class="fa-solid fa-xmark text-sm" aria-hidden="true"></i>
			</button>
		</div>
	{/each}
</div>

<style>
	.toast-card {
		animation: toast-in 0.25s cubic-bezier(0.22, 1, 0.36, 1);
	}

	.toast-leaving {
		animation: toast-out 0.18s ease-in forwards;
	}

	@keyframes toast-in {
		from {
			opacity: 0;
			transform: translateY(-8px) scale(0.98);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}

	@keyframes toast-out {
		from {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
		to {
			opacity: 0;
			transform: translateY(-6px) scale(0.98);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.toast-card,
		.toast-leaving {
			animation: none;
		}
	}
</style>
