<script lang="ts">
	import { fetchPromos, proposeCourseToPromo, type PromoCampaign } from '$lib/api/promos';

	/**
	 * Formulir pengajuan kursus milik instruktur ke sebuah kampanye promo.
	 * Dipakai di Kursusku (per kartu) dan halaman Promo instruktur.
	 * Kursus tampil di promo hanya setelah disetujui admin.
	 */

	interface Props {
		open: boolean;
		course: { id: number; title: string } | null;
		/** Kampanye yang sudah dipilih (opsional; bila null tampilkan pilihan). */
		preselectedSlug?: string | null;
		onclose: () => void;
		onsuccess?: (courseTitle: string) => void;
	}

	let { open, course, preselectedSlug = null, onclose, onsuccess }: Props = $props();

	let campaigns = $state<PromoCampaign[]>([]);
	let loaded = $state(false);
	let loading = $state(false);
	let slug = $state('');
	let badge = $state('');
	let patungan = $state('');
	let note = $state('');
	let busy = $state(false);
	let error = $state('');

	const selectedType = $derived(campaigns.find((c) => c.slug === slug)?.type ?? null);

	$effect(() => {
		if (!open) return;
		slug = preselectedSlug ?? '';
		badge = '';
		patungan = '';
		note = '';
		error = '';
		if (!loaded) void loadCampaigns();
	});

	async function loadCampaigns(): Promise<void> {
		loading = true;
		try {
			campaigns = await fetchPromos();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Gagal memuat daftar promo.';
		} finally {
			loading = false;
			loaded = true;
		}
	}

	function close(): void {
		if (busy) return;
		onclose();
	}

	async function submit(e: Event): Promise<void> {
		e.preventDefault();
		if (!course || !slug || busy) return;
		error = '';
		let patunganPrice: number | undefined;
		if (patungan.trim() !== '') {
			if (selectedType !== 'patungan') {
				error = 'Harga patungan hanya untuk promo bertipe patungan.';
				return;
			}
			patunganPrice = Number(patungan.replace(/[^0-9]/g, ''));
			if (!Number.isInteger(patunganPrice) || patunganPrice < 1000) {
				error = 'Harga patungan minimal Rp1.000.';
				return;
			}
		}
		busy = true;
		try {
			await proposeCourseToPromo(slug, {
				courseId: course.id,
				customBadge: badge.trim() || undefined,
				patunganPrice,
				note: note.trim() || undefined
			});
			const title = course.title;
			onclose();
			onsuccess?.(title);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Gagal mengajukan ke promo.';
		} finally {
			busy = false;
		}
	}
</script>

{#if open}
	<div
		class="fixed inset-0 z-[70] flex items-end justify-center bg-slate-900/50 p-4 sm:items-center"
		role="presentation"
		onclick={(e) => {
			if (e.target === e.currentTarget) close();
		}}
	>
		<div
			tabindex="-1"
			role="dialog"
			aria-modal="true"
			aria-labelledby="promo-apply-title"
			onkeydown={(e) => {
				if (e.key === 'Escape') {
					e.stopPropagation();
					close();
				}
			}}
			class="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-6"
		>
			<div class="mb-4 flex items-start justify-between gap-3">
				<div>
					<h2 id="promo-apply-title" class="text-base font-extrabold text-slate-900 sm:text-lg">
						Ajukan ke Promo
					</h2>
					<p class="mt-0.5 text-xs text-slate-500">
						{course?.title ?? ''} — tampil di promo setelah disetujui admin.
					</p>
				</div>
				<button
					type="button"
					onclick={close}
					disabled={busy}
					aria-label="Tutup formulir pengajuan promo"
					class="flex min-h-11 min-w-11 items-center justify-center rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
				>
					<i class="fa-solid fa-xmark text-lg" aria-hidden="true"></i>
				</button>
			</div>
			{#if loading}
				<p class="flex items-center gap-2 py-6 text-xs font-semibold text-slate-500" role="status">
					<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i> Memuat daftar promo…
				</p>
			{:else if campaigns.length === 0}
				<p
					class="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-xs text-slate-500"
				>
					Belum ada promo aktif yang bisa diajukan.
				</p>
			{:else}
				<form onsubmit={submit} class="grid gap-3" aria-label="Formulir pengajuan promo">
					<div>
						<label for="promo-campaign" class="mb-1.5 block text-xs font-bold text-slate-700"
							>Pilih promo</label
						>
						<select
							id="promo-campaign"
							bind:value={slug}
							disabled={preselectedSlug !== null}
							class="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none disabled:bg-slate-100"
						>
							<option value="">— Pilih kampanye —</option>
							{#each campaigns as camp (camp.slug)}
								<option value={camp.slug}
									>{camp.title} ({camp.type}{camp.discountPercent !== null
										? ` −${camp.discountPercent}%`
										: ''})</option
								>
							{/each}
						</select>
					</div>
					<div>
						<label for="promo-badge" class="mb-1.5 block text-xs font-bold text-slate-700"
							>Badge usulan (opsional)</label
						>
						<input
							id="promo-badge"
							bind:value={badge}
							placeholder="Cth. Pilihan Editor"
							maxlength={100}
							class="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
						/>
					</div>
					{#if selectedType === 'patungan'}
						<div>
							<label for="promo-patungan" class="mb-1.5 block text-xs font-bold text-slate-700"
								>Harga patungan usulan — total grup (opsional)</label
							>
							<input
								id="promo-patungan"
								bind:value={patungan}
								inputmode="numeric"
								placeholder="Cth. 300000"
								class="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
							/>
						</div>
					{/if}
					<div>
						<label for="promo-note" class="mb-1.5 block text-xs font-bold text-slate-700"
							>Catatan untuk admin (opsional)</label
						>
						<textarea
							id="promo-note"
							bind:value={note}
							rows={3}
							maxlength={500}
							placeholder="Alasan kursus ini cocok untuk promo…"
							class="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
						></textarea>
					</div>
					{#if error}
						<p role="alert" class="text-xs font-semibold text-red-600">{error}</p>
					{/if}
					<button
						type="submit"
						disabled={busy || !slug}
						class="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-xs font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-blue-600"
					>
						{#if busy}<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i> Mengirim…{:else}<i
								class="fa-solid fa-paper-plane"
								aria-hidden="true"
							></i> Kirim pengajuan{/if}
					</button>
				</form>
			{/if}
		</div>
	</div>
{/if}
