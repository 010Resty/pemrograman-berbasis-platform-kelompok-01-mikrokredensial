<script lang="ts">
	/**
	 * StatusBadge — lencana status terpusat ARISTOTELES.
	 *
	 * Satu peta label + warna per domain (pembayaran, tugas, undangan,
	 * sertifikat) agar tidak diduplikasi di tiap halaman. Selalu tampilkan
	 * teks (jangan warna saja) demi aksesibilitas.
	 */
	type Kind = 'payment' | 'submission' | 'invitation' | 'certificate';

	let {
		kind,
		status,
		class: extraClass = ''
	}: {
		/** Domain status (menentukan peta label/warna). */
		kind: Kind;
		/** Nilai status mentah dari server. */
		status: string;
		/** Kelas tambahan opsional. */
		class?: string;
	} = $props();

	const AMBER = 'border-amber-200 bg-amber-50 text-amber-700';
	const EMERALD = 'border-emerald-200 bg-emerald-50 text-emerald-700';
	const RED = 'border-red-200 bg-red-50 text-red-700';
	const SLATE = 'border-slate-200 bg-slate-100 text-slate-600';
	const VIOLET = 'border-violet-200 bg-violet-50 text-violet-700';

	function resolve(): { label: string; classes: string } {
		switch (kind) {
			case 'payment':
				if (status === 'diverifikasi') return { label: 'Diverifikasi', classes: EMERALD };
				if (status === 'ditolak') return { label: 'Ditolak', classes: RED };
				return { label: 'Menunggu', classes: AMBER };
			case 'submission':
				if (status === 'passed') return { label: 'Lulus', classes: EMERALD };
				if (status === 'failed') return { label: 'Tidak lulus', classes: RED };
				if (status === 'revision_requested') return { label: 'Minta revisi', classes: VIOLET };
				if (status === 'reviewed') return { label: 'Dinilai', classes: SLATE };
				return { label: 'Menunggu', classes: AMBER };
			case 'invitation': {
				// Terima status mentah backend (pending/accepted/…) maupun
				// label turunan UI (Pending/Accepted/Cancelled/…).
				const s = status.toLowerCase();
				if (s === 'accepted') return { label: 'Diterima', classes: EMERALD };
				if (s === 'revoked' || s === 'cancelled') return { label: 'Dibatalkan', classes: RED };
				if (s === 'expired') return { label: 'Kedaluarsa', classes: SLATE };
				return { label: 'Menunggu', classes: AMBER };
			}
			case 'certificate':
				if (status === 'revoked') return { label: 'Dicabut', classes: RED };
				if (status === 'superseded') return { label: 'Digantikan', classes: SLATE };
				return { label: 'Aktif', classes: EMERALD };
		}
	}

	const meta = $derived(resolve());
</script>

<span
	class={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${meta.classes} ${extraClass}`}
>
	{meta.label}
</span>
