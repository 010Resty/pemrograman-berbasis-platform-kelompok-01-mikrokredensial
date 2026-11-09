<script lang="ts">
	import { page } from '$app/state';
	import { tick } from 'svelte';
	import { getCourseById, type Course, type CourseModule } from '$lib/data/courses';
	import { getTrainingStats } from '$lib/data/training';
	import {
		loadCurriculumDraft,
		loadDraftMeta,
		saveCurriculumDraft,
		setDraftEntryKind,
		exportDraft,
		importDraft,
		withSyncedFlat,
		type DraftMeta
	} from '$lib/stores/curriculum';
	import { invalidateCourseTree, invalidateMyCourses } from '$lib/stores/instructor-courses.svelte';
	import {
		resolveServerCourse,
		updateCourse,
		markServerKelola,
		isServerKelola,
		createModule,
		updateModule,
		deleteModule,
		isServerId,
		fetchModules,
		fetchCourseDetail
	} from '$lib/api/courses';
	import { uploadFile } from '$lib/api/uploads';
	import { formatIDR } from '$lib/data/payment';
	import MonthPicker from '$lib/components/MonthPicker.svelte';
	import WarningModal from '$lib/components/WarningModal.svelte';
	import { toast } from '$lib/stores/toast.svelte';
	import LearningPathManager from '$lib/components/training/organisms/LearningPathManager.svelte';
	import CourseRoadmap from '$lib/components/training/organisms/CourseRoadmap.svelte';

	const courseId = $derived(Number(page.params.courseId));
	const serverMode = $derived(
		page.url.searchParams.get('src') === 'server' || isServerKelola(courseId)
	);
	const staticCourse = $derived(getCourseById(courseId));

	let serverCourse = $state<
		(Course & { publishState?: string; instructorNames?: string; period?: string }) | null
	>(null);
	let serverLoading = $state(false);
	let serverLoadedFor = $state<number | null>(null);
	let serverError = $state('');

	$effect(() => {
		if (!serverMode || serverLoadedFor === courseId) return;
		serverLoadedFor = courseId;
		serverLoading = true;
		serverError = '';
		void resolveServerCourse(courseId)
			.then((res) => {
				if (!res) {
					serverError = 'Kursus tidak ditemukan di server.';
					return;
				}
				serverCourse = res;
				markServerKelola(courseId);
				// Navigasi dengan #kurikulum (tombol Kelola Materi) bisa tiba sebelum
				// section ter-render karena data dimuat async: scroll manual setelah DOM siap.
				if (typeof window !== 'undefined' && window.location.hash === '#kurikulum') {
					void tick().then(() => {
						document.getElementById('kurikulum')?.scrollIntoView();
					});
				}
			})
			.catch((e: unknown) => {
				serverError = e instanceof Error ? e.message : 'Gagal memuat kursus dari server.';
			})
			.finally(() => {
				serverLoading = false;
			});
	});

	const course = $derived(serverMode ? serverCourse : staticCourse);
	/** Nama pengampu dari server (detail memuat `instructors[]`); fallback nama tunggal. */
	const instructorNames = $derived(
		serverMode && serverCourse
			? serverCourse.instructorNames || serverCourse.instructor
			: (staticCourse?.instructor ?? '—')
	);

	let editableModules = $state<CourseModule[]>([]);
	let isPublished = $state(true);
	let savedMessage = $state('');
	let initializedFor = $state<number | null>(null);

	/* Muat draf bersama (memori + localStorage) agar suntingan terbawa
	   saat drill-down ke halaman sub-modul / materi. */
	$effect(() => {
		if (!course || initializedFor === courseId) return;
		editableModules = loadCurriculumDraft(courseId).map(withSyncedFlat);
		isPublished = getPublishState(course);
		savedMessage = '';
		initializedFor = courseId;
	});

	/* Simpan setiap perubahan kembali ke draf bersama (+ segarkan versi/log K-08). */
	$effect(() => {
		if (initializedFor !== courseId || !course) return;
		saveCurriculumDraft(courseId, editableModules);
		draftMeta = loadDraftMeta(courseId);
	});

	const totalMats = $derived(editableModules.reduce((n, m) => n + m.materials.length, 0));
	const totalSubs = $derived(editableModules.reduce((n, m) => n + (m.subModules?.length ?? 0), 0));
	const stats = $derived(
		course ? getTrainingStats({ ...course, modules: editableModules }) : undefined
	);

	function markSaved(msg: string) {
		savedMessage = msg;
		draftMeta = loadDraftMeta(courseId);
	}

	/** K-08: versi + jejak draf lokal (bukan versi resmi backend). */
	let draftMeta = $state<DraftMeta>({ version: 0, updatedAt: '', log: [] });
	let backupInput = $state<HTMLInputElement | null>(null);
	let backupMessage = $state('');
	let backupOk = $state(true);

	function markEntryKind(at: string, kind: 'ringan' | 'penting'): void {
		setDraftEntryKind(courseId, at, kind);
		draftMeta = loadDraftMeta(courseId);
	}

	function downloadBackup(): void {
		try {
			const blob = new Blob([JSON.stringify(exportDraft(courseId), null, 2)], {
				type: 'application/json'
			});
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `draf-kurikulum-${courseId}-v${draftMeta.version}.json`;
			document.body.appendChild(a);
			a.click();
			a.remove();
			setTimeout(() => URL.revokeObjectURL(url), 10_000);
			backupMessage = 'Cadangan draf diunduh.';
			backupOk = true;
		} catch {
			backupMessage = 'Gagal membuat berkas cadangan.';
			backupOk = false;
		}
	}

	async function restoreBackup(file: File | undefined): Promise<void> {
		backupMessage = '';
		if (!file) return;
		try {
			const text = await file.text();
			const res = importDraft(courseId, JSON.parse(text));
			backupMessage = res.message;
			backupOk = res.ok;
			if (res.ok) {
				editableModules = loadCurriculumDraft(courseId).map(withSyncedFlat);
				draftMeta = loadDraftMeta(courseId);
				markSaved(res.message);
			}
		} catch {
			backupMessage = 'Berkas bukan JSON valid.';
			backupOk = false;
		} finally {
			if (backupInput) backupInput.value = '';
		}
	}

	/** Persistensi server untuk LearningPathManager (hanya kursus server). */
	function modulePersist() {
		return {
			create: async (input: { title: string; description: string; position: number }) => {
				const m = await createModule(courseId, { ...input, type: 'materi' });
				invalidateCourseTree(courseId);
				return String(m.id);
			},
			update: async (id: string, input: Record<string, unknown>) => {
				if (!isServerId(id)) return;
				await updateModule(Number(id), input);
				invalidateCourseTree(courseId);
			},
			remove: async (id: string) => {
				if (!isServerId(id)) return;
				await deleteModule(Number(id));
				invalidateCourseTree(courseId);
			},
			move: async (orderedIds: string[]) => {
				await Promise.all(
					orderedIds.map((id, i) =>
						isServerId(id) ? updateModule(Number(id), { position: i }) : Promise.resolve()
					)
				);
				invalidateCourseTree(courseId);
			}
		};
	}

	/** Verifikasi simpanan server: hitung ulang modul dari backend. */
	async function verifySaved(): Promise<void> {
		try {
			const remote = await fetchModules(courseId);
			markSaved(`Tersinkron ke server: ${remote.length} modul tercatat.`);
		} catch (e) {
			markSaved(e instanceof Error ? e.message : 'Gagal memeriksa simpanan server.');
		}
	}

	function getPublishState(c: { publishState?: unknown; id: number }): boolean {
		if (c && typeof (c as { publishState?: unknown }).publishState === 'string') {
			return (c as { publishState: string }).publishState === 'published';
		}
		return c.id !== 4;
	}

	/** Label badge status 3 nilai server; arsip tidak boleh tampil sebagai Draft. */
	const publishLabel = $derived.by((): 'Terbit' | 'Draft' | 'Diarsipkan' => {
		const s = serverMode && serverCourse ? serverCourse.publishState : undefined;
		if (s === 'published') return 'Terbit';
		if (s === 'archived') return 'Diarsipkan';
		if (s === 'draft') return 'Draft';
		return isPublished ? 'Terbit' : 'Draft';
	});

	async function togglePublish(): Promise<void> {
		if (serverMode && serverCourse) {
			const next = !isPublished;
			try {
				const updated = await updateCourse(courseId, {
					status: next ? 'published' : 'draft'
				});
				// Status berubah: badge daftar ikut basi (struktur tree tidak berubah).
				invalidateMyCourses();
				serverCourse = { ...serverCourse, publishState: updated.status };
				isPublished = next;
				markSaved(next ? 'Kursus diterbitkan.' : 'Kursus dikembalikan ke draft.');
			} catch (e) {
				markSaved(e instanceof Error ? e.message : 'Gagal mengubah status kursus.');
			}
			return;
		}
		isPublished = !isPublished;
		markSaved(isPublished ? 'Kursus diterbitkan.' : 'Kursus dikembalikan ke draft.');
	}

	/* ---- Fase batch (server saja): upcoming → ongoing → ended, maju searah ---- */
	let phaseBusy = $state(false);
	let phaseConfirm = $state<null | { to: 'ongoing' | 'ended' }>(null);
	let showPhase = $state(false);
	let menuOpen = $state(false);
	let menuRoot: HTMLElement | null = $state(null);

	const serverPeriod = $derived(serverMode && serverCourse ? (serverCourse.period ?? '') : '');
	const serverPublished = $derived(
		serverMode && serverCourse ? serverCourse.publishState === 'published' : false
	);

	/** Aksi fase berikutnya; null = tidak ada (draft/ended/arsip). */
	const nextPhase = $derived.by((): null | {
		to: 'ongoing' | 'ended';
		label: string;
		hint: string;
		confirmTitle: string;
		confirmMessage: string;
		confirmText: string;
	} => {
		if (!serverMode || !serverCourse || !serverPublished) return null;
		if (serverPeriod === 'upcoming') {
			return {
				to: 'ongoing',
				label: 'Mulai Batch',
				hint: 'Buka materi untuk peserta terdaftar',
				confirmTitle: 'Mulai batch?',
				confirmMessage: `Batch “${serverCourse.title}” akan berjalan dan materi terbuka untuk seluruh peserta terdaftar. Peserta baru tetap bisa mendaftar.`,
				confirmText: 'Ya, mulai'
			};
		}
		if (serverPeriod === 'ongoing') {
			return {
				to: 'ended',
				label: 'Akhiri Batch',
				hint: 'Tutup batch (final, tak bisa kembali)',
				confirmTitle: 'Akhiri batch?',
				confirmMessage: `Batch “${serverCourse.title}” akan ditandai selesai. Pendaftaran baru ditutup dan tindakan ini tidak dapat dibatalkan.`,
				confirmText: 'Ya, akhiri'
			};
		}
		return null;
	});

	function askPhase(): void {
		if (!nextPhase || phaseBusy) return;
		phaseConfirm = { to: nextPhase.to };
		showPhase = true;
	}

	async function confirmPhase(): Promise<void> {
		if (!phaseConfirm || phaseBusy || !serverCourse) {
			showPhase = false;
			phaseConfirm = null;
			return;
		}
		const target = phaseConfirm;
		showPhase = false;
		phaseConfirm = null;
		phaseBusy = true;
		try {
			const updated = await updateCourse(courseId, { period: target.to });
			serverCourse = { ...serverCourse, period: updated.period ?? target.to };
			invalidateMyCourses();
			const msg =
				target.to === 'ongoing' ? 'Batch berjalan. Materi terbuka untuk peserta.' : 'Batch diakhiri.';
			markSaved(msg);
			toast.success(msg);
		} catch (e) {
			const msg = e instanceof Error ? e.message : 'Gagal mengubah fase batch.';
			markSaved(msg);
			toast.error(msg);
		} finally {
			phaseBusy = false;
		}
	}

	$effect(() => {
		if (!menuOpen) return;
		const onDown = (e: PointerEvent) => {
			if (menuRoot && !menuRoot.contains(e.target as Node)) menuOpen = false;
		};
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') menuOpen = false;
		};
		window.addEventListener('pointerdown', onDown);
		window.addEventListener('keydown', onKey);
		return () => {
			window.removeEventListener('pointerdown', onDown);
			window.removeEventListener('keydown', onKey);
		};
	});

	/* ---- Ubah info kursus (server saja, field sama seperti form tambah) ---- */
	const EDIT_CATEGORIES = [
		'Pengembangan Web',
		'Basis Data',
		'Jaringan',
		'Keamanan',
		'AI & Data',
		'Infrastruktur',
		'Desain',
		'Bisnis'
	];
	const EDIT_LEVELS = ['Pemula', 'Menengah', 'Lanjutan'];

	let editing = $state(false);
	let editPrefilling = $state(false);
	let editSaving = $state(false);
	let editErrors = $state<Record<string, string>>({});
	let editServerError = $state('');
	let editBtn: HTMLButtonElement | null = $state(null);
	let editTitleEl: HTMLInputElement | null = $state(null);
	let editModalOpened = false;

	function focusEditTitle(): void {
		requestAnimationFrame(() => editTitleEl?.focus());
	}

	/* Kembalikan fokus ke tombol Ubah Info setelah modal ditutup (pola invitations). */
	$effect(() => {
		if (!editing && editModalOpened) {
			editModalOpened = false;
			editBtn?.focus();
		}
	});

	let eTitle = $state('');
	let eCategory = $state('');
	let eLevel = $state('Pemula');
	let eDurationMonths = $state('');
	let eDescription = $state('');
	let eCoverPreview = $state('');
	let eStartMonth = $state('');
	let ePriceDigits = $state('');
	let eOutcomes = $state<string[]>(['', '']);
	let eTools = $state<string[]>(['']);
	/** Label bulan mulai yang tersimpan di server (format tampil, cth "September 2026"). */
	let eStartMonthCurrent = $state('');
	/** Kategori tersimpan bila di luar daftar resmi (data lama) — wajib pilih ulang. */
	let eCategoryCurrent = $state('');

	const ID_MONTHS = [
		'Januari',
		'Februari',
		'Maret',
		'April',
		'Mei',
		'Juni',
		'Juli',
		'Agustus',
		'September',
		'Oktober',
		'November',
		'Desember'
	];

	/** Parse label server ("September 2026") → input MonthPicker ("2026-09"). '' bila tak dikenali. */
	function monthLabelToInput(label: string): string {
		const m = /^\s*([A-Za-z]+)\s+(\d{4})\s*$/.exec(label.trim());
		if (!m) return '';
		const idx = ID_MONTHS.findIndex((n) => n.toLowerCase() === m[1].toLowerCase());
		if (idx < 0) return '';
		return `${m[2]}-${String(idx + 1).padStart(2, '0')}`;
	}

	const eDescCount = $derived(eDescription.trim().length);
	const eValidOutcomes = $derived(eOutcomes.filter((o) => o.trim().length >= 10));
	const eValidTools = $derived(eTools.filter((t) => t.trim().length >= 1));
	const eDurationNum = $derived(Number(eDurationMonths));
	const eDurationLabel = $derived(
		eDurationMonths && Number.isInteger(eDurationNum) && eDurationNum > 0
			? `${eDurationNum} Bulan`
			: ''
	);
	const ePriceNum = $derived(ePriceDigits === '' ? null : Number(ePriceDigits));
	const ePriceLabel = $derived(
		ePriceNum === null ? '' : ePriceNum === 0 ? 'GRATIS' : formatIDR(ePriceNum)
	);

	function eOnlyDigits(value: string): string {
		return value.replace(/\D/g, '');
	}

	const eInputCls = (bad: boolean) =>
		`w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:ring-4 focus:outline-none ${bad ? 'border-red-300 focus:border-red-500 focus:ring-red-500/10' : 'border-slate-200 focus:border-blue-500 focus:ring-blue-500/10'}`;

	/** Buka/tutup form ubah info; prefill dari detail server agar sama seperti form tambah. */
	async function toggleEditInfo(): Promise<void> {
		if (!serverMode || !serverCourse || editSaving) return;
		if (editing) {
			editing = false;
			return;
		}
		editing = true;
		editModalOpened = true;
		editServerError = '';
		editErrors = {};
		if (eTitle || editPrefilling) {
			focusEditTitle();
			return;
		}
		editPrefilling = true;
		try {
			const detail = await fetchCourseDetail(courseId);
			eTitle = detail.title ?? '';
			// Backend z.enum(CATEGORIES) identik dengan daftar form tambah,
			// jadi kategori server selalu resmi; bila tidak, kosongkan + tampilkan
			// nilai lama sebagai hint agar pengguna memilih ulang yang resmi.
			eCategoryCurrent = detail.category ?? '';
			eCategory = EDIT_CATEGORIES.includes(eCategoryCurrent) ? eCategoryCurrent : '';
			eLevel = EDIT_LEVELS.includes(detail.level) ? detail.level : 'Pemula';
			eDurationMonths = /(\d+)/.exec(detail.duration ?? '')?.[1] ?? '';
			eDescription = detail.description ?? '';
			eCoverPreview = detail.image ?? '';
			eStartMonthCurrent = detail.startMonth ?? '';
			eStartMonth = monthLabelToInput(eStartMonthCurrent);
			ePriceDigits =
				detail.priceNominal === null || detail.priceNominal === undefined
					? ''
					: String(detail.priceNominal);
			eOutcomes = detail.outcomes && detail.outcomes.length > 0 ? [...detail.outcomes] : ['', ''];
			eTools = detail.tools && detail.tools.length > 0 ? [...detail.tools] : [''];
		} catch (e) {
			editServerError = e instanceof Error ? e.message : 'Gagal memuat info kursus.';
		} finally {
			editPrefilling = false;
			focusEditTitle();
		}
	}

	function eValidate(): boolean {
		const next: Record<string, string> = {};
		if (eTitle.trim().length < 10)
			next['title'] = 'Judul minimal 10 karakter agar jelas di katalog.';
		if (eTitle.trim().length > 120) next['title'] = 'Judul maksimal 120 karakter.';
		if (!eCategory) next['category'] = 'Pilih kategori pelatihan.';
		if (!Number.isInteger(eDurationNum) || eDurationNum < 1)
			next['duration'] = 'Isi durasi dalam bulan, angka bulat minimal 1 (cth: 6).';
		if (Number.isInteger(eDurationNum) && eDurationNum > 36)
			next['duration'] = 'Durasi maksimal 36 bulan (server menolak di atas itu).';
		if (eDescCount < 30)
			next['description'] = `Deskripsi masih ${eDescCount} karakter, minimal 30 karakter.`;
		if (eDescription.trim().length > 1000)
			next['description'] = 'Deskripsi maksimal 1000 karakter.';
		if (ePriceNum === null || !Number.isInteger(ePriceNum) || ePriceNum < 0)
			next['price'] = 'Isi harga dengan angka bulat ≥ 0 (cth: 0 atau 149000).';
		if (eValidOutcomes.length < 2)
			next['outcomes'] = 'Isi minimal 2 hasil belajar, masing-masing ≥ 10 karakter.';
		if (eValidTools.length < 1) next['tools'] = 'Isi minimal 1 alat yang harus dipersiapkan.';
		editErrors = next;
		return Object.keys(next).length === 0;
	}

	function onEditCoverFile(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (editErrors['cover']) delete editErrors['cover'];
		if (!file) return;
		if (!file.type.startsWith('image/')) {
			editErrors['cover'] = 'Berkas sampul harus berupa gambar (JPG/PNG/WebP).';
			return;
		}
		if (file.size > 2 * 1024 * 1024) {
			editErrors['cover'] = 'Ukuran gambar maksimal 2 MB.';
			return;
		}
		const reader = new FileReader();
		reader.onload = () => {
			eCoverPreview = String(reader.result ?? '');
		};
		reader.readAsDataURL(file);
	}

	function eFileFromDataUrl(dataUrl: string, name: string): Promise<File> {
		return fetch(dataUrl)
			.then((r) => r.blob())
			.then((b) => new File([b], name, { type: b.type || 'image/png' }));
	}

	async function saveEditInfo(e: SubmitEvent): Promise<void> {
		e.preventDefault();
		if (!serverMode || !serverCourse || editSaving) return;
		editServerError = '';
		if (!eValidate()) {
			focusEditTitle();
			return;
		}
		editSaving = true;
		try {
			let imageUrl: string | null = eCoverPreview;
			if (eCoverPreview.startsWith('data:')) {
				const picked = await eFileFromDataUrl(eCoverPreview, 'sampul');
				const uploaded = await uploadFile(picked, 'cover');
				imageUrl = uploaded.url;
			}
			const patch: Record<string, unknown> = {
				title: eTitle.trim(),
				category: eCategory,
				level: eLevel,
				durationMonths: eDurationNum,
				description: eDescription.trim(),
				coverUrl: imageUrl,
				priceNominal: ePriceNum ?? 0,
				outcomes: eValidOutcomes,
				tools: eValidTools
			};
			// Bulan mulai opsional saat edit: kosong = pertahankan yang tersimpan.
			if (eStartMonth) {
				const [y, m] = eStartMonth.split('-').map(Number);
				const names = [
					'Januari',
					'Februari',
					'Maret',
					'April',
					'Mei',
					'Juni',
					'Juli',
					'Agustus',
					'September',
					'Oktober',
					'November',
					'Desember'
				];
				patch.startMonth = y && m ? `${names[m - 1] ?? ''} ${y}`.trim() : eStartMonth;
			}
			const updated = await updateCourse(courseId, patch);
			serverCourse = {
				...serverCourse,
				title: updated.title,
				category: updated.category ?? serverCourse.category,
				level: updated.level,
				duration: updated.duration ?? serverCourse.duration,
				description: updated.description ?? '',
				image: updated.image ?? serverCourse.image
			};
			invalidateMyCourses();
			editing = false;
			markSaved('Info kursus diperbarui.');
		} catch (err) {
			editServerError =
				err instanceof Error ? err.message : 'Gagal menyimpan info kursus. Coba lagi.';
		} finally {
			editSaving = false;
		}
	}
</script>

<svelte:head>
	<title
		>{course ? `Kelola ${course.title}` : 'Kursus tidak ditemukan'} — Instruktur Aristoteles</title
	>
	<meta
		name="description"
		content={course
			? `Kelola kurikulum, modul, sub-modul, dan materi ${course.title}`
			: 'Kelola kurikulum kursus'}
	/>
</svelte:head>

<div class="p-4 sm:p-6 lg:p-8">
	{#if serverMode && serverLoading}
		<div
			class="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white p-12 text-sm font-semibold text-slate-500"
			role="status"
			aria-label="Memuat kursus"
		>
			<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i> Memuat kursus dari server...
		</div>
	{:else if !course}
		<div class="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-10 text-center">
			<i class="fa-solid fa-triangle-exclamation mb-3 text-3xl text-amber-500" aria-hidden="true"
			></i>
			<h1 class="text-xl font-bold text-slate-900">Kursus tidak ditemukan</h1>
			<p class="mt-1 text-sm text-slate-500">
				{#if serverError}{serverError}{:else}ID kursus “{page.params.courseId}” tidak terdaftar di
					Kursusku.{/if}
			</p>
			<a
				href="/instruktur/kursusku"
				class="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white transition-all duration-200 ease-smooth hover:bg-blue-700 active:scale-[0.98]"
			>
				<i class="fa-solid fa-arrow-left" aria-hidden="true"></i> Kembali ke Kursusku
			</a>
		</div>
	{:else}
		<nav aria-label="Breadcrumb" class="mb-4 flex items-center gap-2 text-xs text-slate-500">
			<a
				href="/instruktur/kursusku"
				class="rounded font-semibold text-blue-600 transition-colors duration-200 ease-smooth hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
			>
				Kursusku
			</a>
			<i class="fa-solid fa-chevron-right text-[10px] text-slate-300" aria-hidden="true"></i>
			<span aria-current="page" class="truncate font-medium text-slate-700">{course.title}</span>
		</nav>

		<header class="mb-6 rounded-2xl border border-slate-200/70 bg-white">
			<div class="relative flex min-h-48 flex-col justify-end overflow-hidden rounded-t-2xl sm:min-h-56">
				<img
					src={course.image}
					alt={`Sampul pelatihan ${course.title}`}
					class="absolute inset-0 h-full w-full object-cover"
					loading="eager"
				/>
				<div
					class="absolute inset-0 bg-gradient-to-t from-slate-900/85 via-slate-900/40 to-slate-900/10"
					aria-hidden="true"
				></div>
				<div class="relative flex flex-wrap gap-2 p-4 pb-2 sm:px-6">
					<span
						class="rounded-full bg-blue-600 px-3 py-1 text-[11px] font-bold text-white uppercase"
						>{course.category}</span
					>
					<span
						class="rounded-full bg-white/20 px-3 py-1 text-[11px] font-bold text-white uppercase backdrop-blur"
						>{course.level}</span
					>
					<span
						class="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold uppercase {publishLabel ===
						'Terbit'
							? 'border-emerald-200 bg-emerald-50 text-emerald-700'
							: publishLabel === 'Diarsipkan'
								? 'border-white/30 bg-slate-500/40 text-white backdrop-blur'
								: 'border-white/30 bg-white/15 text-white backdrop-blur'}"
					>
						<i
							class="fa-solid {publishLabel === 'Terbit'
								? 'fa-eye'
								: publishLabel === 'Diarsipkan'
									? 'fa-box-archive'
									: 'fa-pen'}"
							aria-hidden="true"
						></i>
						{publishLabel}
					</span>
				</div>
				<div class="relative p-4 pt-1 sm:px-6 sm:pb-5">
					<h1 class="text-xl leading-snug font-extrabold text-white sm:text-2xl">{course.title}</h1>
					<p class="mt-1 text-xs text-slate-200 sm:text-sm">
						Oleh {instructorNames} · {course.duration}
					</p>
					<p class="mt-1 text-[11px] font-semibold tracking-wide text-blue-200 uppercase">
						Kelola · {editableModules.length} modul · {totalSubs} sub-modul · {totalMats} materi
					</p>
				</div>
			</div>
			<div class="flex flex-col gap-3 p-4 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
				<p class="max-w-2xl flex-1 text-sm leading-relaxed text-slate-600">{course.description}</p>
				{#if serverMode && serverCourse}
					<div class="flex shrink-0 flex-wrap items-center gap-2">
						{#if !serverPublished}
							<button
								type="button"
								onclick={() => void togglePublish()}
								class="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-blue-600/25 transition-all hover:bg-blue-700 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-blue-600"
							>
								<i class="fa-solid fa-eye" aria-hidden="true"></i> Terbitkan
							</button>
						{:else if nextPhase?.to === 'ongoing'}
							<button
								type="button"
								onclick={askPhase}
								disabled={phaseBusy}
								title={nextPhase.hint}
								class="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-600/25 transition-all hover:bg-emerald-700 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
							>
								<i class="fa-solid fa-play" aria-hidden="true"></i> {nextPhase.label}
							</button>
						{:else if nextPhase?.to === 'ended'}
							<button
								type="button"
								onclick={askPhase}
								disabled={phaseBusy}
								title={nextPhase.hint}
								class="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-300 bg-white px-5 py-2.5 text-xs font-bold text-amber-700 transition-all hover:bg-amber-50 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
							>
								<i class="fa-solid fa-flag-checkered" aria-hidden="true"></i> {nextPhase.label}
							</button>
						{/if}
						<div class="relative" bind:this={menuRoot}>
							<button
								type="button"
								onclick={() => (menuOpen = !menuOpen)}
								aria-expanded={menuOpen}
								aria-haspopup="menu"
								aria-label="Aksi lainnya"
								title="Aksi lainnya"
								class="flex min-h-10 min-w-10 items-center justify-center rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-slate-500"
							>
								<i class="fa-solid fa-ellipsis-vertical" aria-hidden="true"></i>
							</button>
							{#if menuOpen}
								<div
									role="menu"
									aria-label="Aksi lainnya"
									class="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-2xl border border-slate-200/70 bg-white py-1.5 shadow-xl"
								>
									<button
										type="button"
										role="menuitem"
										bind:this={editBtn}
										onclick={() => {
											menuOpen = false;
											void toggleEditInfo();
										}}
										aria-expanded={editing}
										class="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-xs font-bold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-slate-500"
									>
										<i class="fa-solid fa-pen w-4 text-center text-slate-400" aria-hidden="true"></i>
										Ubah Info
									</button>
									<a
										href="/instruktur/penilaian"
										role="menuitem"
										onclick={() => (menuOpen = false)}
										class="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-xs font-bold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-slate-500"
									>
										<i class="fa-solid fa-clipboard-check w-4 text-center text-slate-400" aria-hidden="true"></i>
										Penilaian
									</a>
									<button
										type="button"
										role="menuitem"
										onclick={() => {
											menuOpen = false;
											serverMode
												? void verifySaved()
												: markSaved('Draf kurikulum tersimpan (simulasi sisi klien).');
										}}
										class="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-xs font-bold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-slate-500"
									>
										<i class="fa-solid fa-floppy-disk w-4 text-center text-slate-400" aria-hidden="true"></i>
										Simpan Kurikulum
									</button>
									{#if serverPublished}
										<button
											type="button"
											role="menuitem"
											onclick={() => {
												menuOpen = false;
												void togglePublish();
											}}
											class="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-xs font-bold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-slate-500"
										>
											<i class="fa-solid fa-eye-slash w-4 text-center text-slate-400" aria-hidden="true"></i>
											Jadikan Draft
										</button>
									{/if}
								</div>
							{/if}
						</div>
					</div>
				{:else}
				<div class="flex shrink-0 flex-wrap items-center gap-2">
					<button
						type="button"
						onclick={() => void togglePublish()}
						aria-pressed={isPublished}
						class="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition-all hover:bg-slate-50 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-slate-500"
					>
						{isPublished ? 'Jadikan Draft' : 'Terbitkan'}
					</button>
					{#if serverMode && serverCourse}
						<button
							type="button"
							bind:this={editBtn}
							onclick={() => void toggleEditInfo()}
							aria-expanded={editing}
							aria-controls="edit-info-section"
							disabled={editSaving}
							class="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition-all hover:bg-slate-50 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
						>
							<i class="fa-solid fa-pen" aria-hidden="true"></i> Ubah Info
						</button>
					{/if}
					<a
						href="/instruktur/penilaian"
						class="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition-all hover:bg-slate-50 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-slate-500"
					>
						<i class="fa-solid fa-clipboard-check" aria-hidden="true"></i> Penilaian
					</a>
					<button
						type="button"
						onclick={() =>
							serverMode
								? void verifySaved()
								: markSaved('Draf kurikulum tersimpan (simulasi sisi klien).')}
						class="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white transition-all hover:bg-blue-700 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-blue-600"
					>
						<i class="fa-solid fa-floppy-disk" aria-hidden="true"></i> Simpan Kurikulum
					</button>
				</div>
				{/if}
			</div>
			{#if savedMessage}
				<p
					role="status"
					class="flex items-center gap-2 border-t border-slate-100 bg-emerald-50/60 px-4 py-2.5 text-xs font-semibold text-emerald-700 sm:px-6"
				>
					<i class="fa-solid fa-circle-check" aria-hidden="true"></i>
					{savedMessage}
				</p>
			{/if}
		</header>

		{#if editing && serverMode && serverCourse}
			<div
				class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
				role="presentation"
				onclick={(e) => {
					if (e.target === e.currentTarget && !editSaving) editing = false;
				}}
				onkeydown={(e) => {
					if (e.key === 'Escape' && !editSaving) editing = false;
				}}
			>
				<div
					id="edit-info-section"
					role="dialog"
					aria-modal="true"
					aria-labelledby="edit-info-heading"
					class="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-6"
				>
					<div class="flex items-start justify-between gap-3">
						<div>
							<h2 id="edit-info-heading" class="text-base font-bold text-slate-900">
								Ubah Info Kursus
							</h2>
							<p class="mt-0.5 text-xs text-slate-500">
								Field sama seperti saat pertama membuat kursus. Perubahan tersimpan langsung ke
								server.
							</p>
						</div>
						<button
							type="button"
							onclick={() => (editing = false)}
							aria-label="Tutup form ubah info"
							class="flex min-h-9 min-w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-slate-500"
						>
							<i class="fa-solid fa-xmark" aria-hidden="true"></i>
						</button>
					</div>

					{#if editPrefilling}
						<p
							role="status"
							class="mt-4 flex items-center gap-2 text-sm font-semibold text-slate-500"
						>
							<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i> Memuat info kursus...
						</p>
					{:else}
						{#if editServerError}
							<p
								role="alert"
								class="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-700"
							>
								<i class="fa-solid fa-triangle-exclamation mr-1.5" aria-hidden="true"
								></i>{editServerError}
							</p>
						{/if}
						<form novalidate onsubmit={(e) => void saveEditInfo(e)} class="mt-4 space-y-4">
							<div>
								<label for="e-title" class="mb-1.5 block text-xs font-bold text-slate-700">
									Judul pelatihan <span class="text-red-500" aria-hidden="true">*</span>
								</label>
								<input
									id="e-title"
									type="text"
									bind:this={editTitleEl}
									bind:value={eTitle}
									placeholder="cth: Machine Learning untuk Pemula"
									maxlength={120}
									aria-invalid={!!editErrors['title']}
									class={eInputCls(!!editErrors['title'])}
								/>
								<p class="mt-1 text-[11px] text-slate-500">
									{eTitle.trim().length}/120 · minimal 10 karakter, spesifik dan tanpa clickbait.
								</p>
								{#if editErrors['title']}
									<p class="mt-1 flex items-center gap-1.5 text-xs font-semibold text-red-600">
										<i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i>{editErrors[
											'title'
										]}
									</p>
								{/if}
							</div>

							<div class="grid gap-4 sm:grid-cols-3">
								<div>
									<label for="e-cat" class="mb-1.5 block text-xs font-bold text-slate-700">
										Kategori <span class="text-red-500" aria-hidden="true">*</span>
									</label>
									<select
										id="e-cat"
										bind:value={eCategory}
										aria-invalid={!!editErrors['category']}
										class={eInputCls(!!editErrors['category'])}
									>
										<option value="">— Pilih kategori —</option>
										{#each EDIT_CATEGORIES as c (c)}
											<option value={c}>{c}</option>
										{/each}
									</select>
									{#if eCategory === '' && eCategoryCurrent}
										<p class="mt-1 text-[11px] font-semibold text-amber-600">
											Saat ini tersimpan: “{eCategoryCurrent}” (di luar daftar resmi) — pilih
											kategori resmi di atas.
										</p>
									{/if}
									{#if editErrors['category']}
										<p class="mt-1 flex items-center gap-1.5 text-xs font-semibold text-red-600">
											<i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i>{editErrors[
												'category'
											]}
										</p>
									{/if}
								</div>
								<div>
									<span id="e-level-label" class="mb-1.5 block text-xs font-bold text-slate-700"
										>Level peserta</span
									>
									<div
										class="grid grid-cols-3 gap-2"
										role="radiogroup"
										aria-labelledby="e-level-label"
									>
										{#each EDIT_LEVELS as lv (lv)}
											<label
												class={`flex min-h-11 cursor-pointer items-center justify-center rounded-xl border px-2 py-2.5 text-xs font-bold transition-colors has-focus-visible:outline-2 has-focus-visible:outline-blue-600 ${eLevel === lv ? 'border-blue-600 bg-blue-600 text-white shadow-lg shadow-blue-600/25' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
											>
												<input
													type="radio"
													name="e-level"
													value={lv}
													bind:group={eLevel}
													class="sr-only"
												/>
												{lv}
											</label>
										{/each}
									</div>
								</div>
								<div>
									<label for="e-dur" class="mb-1.5 block text-xs font-bold text-slate-700">
										Durasi (bulan) <span class="text-red-500" aria-hidden="true">*</span>
									</label>
									<input
										id="e-dur"
										type="text"
										inputmode="numeric"
										pattern="[0-9]*"
										value={eDurationMonths}
										oninput={(e) => (eDurationMonths = eOnlyDigits(e.currentTarget.value))}
										placeholder="cth: 6"
										maxlength={3}
										aria-invalid={!!editErrors['duration']}
										class={eInputCls(!!editErrors['duration'])}
									/>
									<p class="mt-1 text-[11px] text-slate-500">
										{#if eDurationLabel}
											<span class="font-bold text-blue-700">{eDurationLabel}</span> · hanya angka, tanpa
											satuan lain.
										{:else}
											Hanya angka bulan, contoh: 6 untuk 6 bulan.
										{/if}
									</p>
									{#if editErrors['duration']}
										<p class="mt-1 flex items-center gap-1.5 text-xs font-semibold text-red-600">
											<i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i>{editErrors[
												'duration'
											]}
										</p>
									{/if}
								</div>
							</div>

							<div>
								<label for="e-desc" class="mb-1.5 block text-xs font-bold text-slate-700">
									Deskripsi singkat <span class="text-red-500" aria-hidden="true">*</span>
								</label>
								<textarea
									id="e-desc"
									bind:value={eDescription}
									rows={4}
									maxlength={1000}
									placeholder="Untuk siapa pelatihan ini, apa yang dipelajari, dan proyek akhirnya apa?"
									aria-invalid={!!editErrors['description']}
									class={`${eInputCls(!!editErrors['description'])} resize-y`}></textarea>
								<p
									class="mt-1 text-[11px] {eDescCount < 30
										? 'font-semibold text-amber-600'
										: 'text-slate-500'}"
								>
									{eDescCount}/1000 · minimal 30 karakter.
								</p>
								{#if editErrors['description']}
									<p class="mt-1 flex items-center gap-1.5 text-xs font-semibold text-red-600">
										<i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i>{editErrors[
											'description'
										]}
									</p>
								{/if}
							</div>

							<div>
								<span id="e-cover-label" class="mb-1.5 block text-xs font-bold text-slate-700"
									>Foto sampul pelatihan</span
								>
								<div
									class="overflow-hidden rounded-xl border border-slate-200"
									role="group"
									aria-labelledby="e-cover-label"
								>
									{#if eCoverPreview}
										<img
											src={eCoverPreview}
											alt="Pratinjau sampul pelatihan"
											class="h-32 w-full object-cover"
											loading="lazy"
										/>
									{:else}
										<p class="p-4 text-xs text-slate-400">Belum ada sampul.</p>
									{/if}
								</div>
								<label for="e-cover-file" class="mt-2.5 block text-xs font-bold text-slate-700">
									Ganti gambar <span class="font-semibold text-slate-500"
										>(JPG/PNG/WebP, maks 2 MB — kosongkan untuk pertahankan)</span
									>
								</label>
								<input
									id="e-cover-file"
									type="file"
									accept="image/*"
									onchange={onEditCoverFile}
									aria-invalid={!!editErrors['cover']}
									class="mt-1.5 block w-full cursor-pointer rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2.5 text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-600 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-white hover:file:bg-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
								/>
								{#if editErrors['cover']}
									<p class="mt-1 flex items-center gap-1.5 text-xs font-semibold text-red-600">
										<i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i>{editErrors[
											'cover'
										]}
									</p>
								{/if}
							</div>

							<div class="grid gap-4 sm:grid-cols-2">
								<div>
									<span id="e-start-label" class="mb-1.5 block text-xs font-bold text-slate-700"
										>Bulan mulai batch</span
									>
									<MonthPicker
										bind:value={eStartMonth}
										labelledby="e-start-label"
										describedby="e-start-hint"
										invalid={false}
									/>
									<p id="e-start-hint" class="mt-1 text-[11px] text-slate-500">
										{#if eStartMonth}
											Terisi otomatis dari data tersimpan ({eStartMonthCurrent || '—'}). Ubah bila
											perlu, kosongkan untuk pertahankan.
										{:else if eStartMonthCurrent}
											Saat ini: <span class="font-bold text-blue-700">{eStartMonthCurrent}</span> — format
											tak dikenali, pilih bulan untuk mengubah atau kosongkan untuk pertahankan.
										{:else}
											Kosongkan untuk pertahankan bulan mulai yang tersimpan.
										{/if}
									</p>
								</div>
								<div>
									<label for="e-price" class="mb-1.5 block text-xs font-bold text-slate-700">
										Harga (rupiah, angka saja) <span class="text-red-500" aria-hidden="true">*</span
										>
									</label>
									<div class="relative">
										<span
											class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-sm font-bold text-slate-400"
											aria-hidden="true">Rp</span
										>
										<input
											id="e-price"
											type="text"
											inputmode="numeric"
											pattern="[0-9]*"
											value={ePriceDigits}
											oninput={(e) => (ePriceDigits = eOnlyDigits(e.currentTarget.value))}
											placeholder="0"
											maxlength={12}
											aria-invalid={!!editErrors['price']}
											class={`${eInputCls(!!editErrors['price'])} pl-11 font-mono`}
										/>
									</div>
									<p
										class="mt-1 text-[11px] font-semibold {ePriceNum === 0
											? 'text-emerald-700'
											: 'text-slate-500'}"
									>
										{ePriceLabel || 'Isi 0 agar GRATIS.'}
									</p>
									{#if editErrors['price']}
										<p class="mt-1 flex items-center gap-1.5 text-xs font-semibold text-red-600">
											<i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i>{editErrors[
												'price'
											]}
										</p>
									{/if}
								</div>
							</div>

							<div class="grid gap-5 lg:grid-cols-2">
								<div>
									<span id="e-out-label" class="mb-2 block text-xs font-bold text-slate-700"
										>Yang akan dipelajari</span
									>
									<ol class="space-y-2" aria-labelledby="e-out-label">
										<!-- eslint-disable-next-line @typescript-eslint/no-unused-vars -->
										{#each eOutcomes as _out, i (i)}
											<li class="flex gap-2">
												<label for={`e-out-${i}`} class="sr-only">Hasil belajar {i + 1}</label>
												<input
													id={`e-out-${i}`}
													type="text"
													bind:value={eOutcomes[i]}
													placeholder={`Hasil ${i + 1}: cth “Membuat layout responsif…”`}
													class={eInputCls(false)}
												/>
												<button
													type="button"
													onclick={() => (eOutcomes = eOutcomes.filter((_, x) => x !== i))}
													disabled={eOutcomes.length <= 1}
													aria-label={`Hapus hasil belajar ${i + 1}`}
													class="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
												>
													<i class="fa-solid fa-trash text-xs" aria-hidden="true"></i>
												</button>
											</li>
										{/each}
									</ol>
									<button
										type="button"
										onclick={() => (eOutcomes = [...eOutcomes, ''])}
										class="mt-2 inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-dashed border-blue-300 bg-blue-50/60 px-3.5 py-2 text-[11px] font-bold text-blue-700 hover:bg-blue-50"
									>
										<i class="fa-solid fa-plus" aria-hidden="true"></i> Tambah hasil belajar
									</button>
								</div>
								<div>
									<span id="e-tools-label" class="mb-2 block text-xs font-bold text-slate-700"
										>Alat yang harus dipersiapkan</span
									>
									<ol class="space-y-2" aria-labelledby="e-tools-label">
										<!-- eslint-disable-next-line @typescript-eslint/no-unused-vars -->
										{#each eTools as _tool, i (i)}
											<li class="flex gap-2">
												<label for={`e-tool-${i}`} class="sr-only">Alat {i + 1}</label>
												<input
													id={`e-tool-${i}`}
													type="text"
													bind:value={eTools[i]}
													placeholder={`Alat ${i + 1}: cth “Laptop & koneksi internet stabil”`}
													class={eInputCls(false)}
												/>
												<button
													type="button"
													onclick={() => (eTools = eTools.filter((_, x) => x !== i))}
													disabled={eTools.length <= 1}
													aria-label={`Hapus alat ${i + 1}`}
													class="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
												>
													<i class="fa-solid fa-trash text-xs" aria-hidden="true"></i>
												</button>
											</li>
										{/each}
									</ol>
									<button
										type="button"
										onclick={() => (eTools = [...eTools, ''])}
										class="mt-2 inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-dashed border-blue-300 bg-blue-50/60 px-3.5 py-2 text-[11px] font-bold text-blue-700 hover:bg-blue-50"
									>
										<i class="fa-solid fa-plus" aria-hidden="true"></i> Tambah alat
									</button>
								</div>
							</div>
							{#if editErrors['outcomes'] || editErrors['tools']}
								<p
									role="alert"
									class="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700"
								>
									{editErrors['outcomes'] ?? editErrors['tools']}
								</p>
							{/if}

							<div
								class="flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end"
							>
								<button
									type="button"
									onclick={() => (editing = false)}
									disabled={editSaving}
									class="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
								>
									Batal
								</button>
								<button
									type="submit"
									disabled={editSaving || editPrefilling}
									class="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-xs font-bold text-white transition-all hover:bg-blue-700 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
								>
									{#if editSaving}
										<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i> Menyimpan...
									{:else}
										<i class="fa-solid fa-floppy-disk" aria-hidden="true"></i> Simpan Perubahan
									{/if}
								</button>
							</div>
						</form>
					{/if}
				</div>
			</div>
		{/if}

		<!-- Daftar modul kursus -->
		<div id="kurikulum" class="mb-4 scroll-mt-24">
			<h2 class="text-lg font-bold text-slate-900">
				Kurikulum ({editableModules.length} Modul · {totalSubs} Sub-modul)
			</h2>
			<p class="text-xs text-slate-500">
				Susun modul di bawah; sub-modul dan materi diatur di halaman tiap modul.
			</p>
		</div>

		<LearningPathManager
			bind:modules={editableModules}
			onnotice={markSaved}
			persist={serverMode ? modulePersist() : undefined}
			withDefaultSub={!serverMode}
			moduleHref={(mod) =>
				`/instruktur/kursusku/${courseId}/${mod.id}${serverMode ? '?src=server' : ''}`}
		/>

		<!-- ORGANISM: pratinjau alur belajar draf (langsung mengikuti edit) -->
		<section aria-labelledby="roadmap-preview-heading" class="mt-6">
			<div class="mb-3">
				<h2 id="roadmap-preview-heading" class="text-lg font-bold text-slate-900">
					Pratinjau Alur Belajar
				</h2>
				<p class="text-xs text-slate-500">
					Tampilan jalur Modul → Sub-modul seperti yang dilihat peserta. Klik node untuk info.
					{#if stats}
						({stats.estimatedLabel}){/if}
				</p>
			</div>
			<CourseRoadmap modules={editableModules} {courseId} preview />
		</section>

		<div
			class="mt-6 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between"
		>
			<div>
				<p class="text-sm font-bold text-slate-900">
					{serverMode
						? 'Perubahan struktur kurikulum tersimpan langsung ke server'
						: 'Kurikulum tersimpan sebagai draf lokal'}
				</p>
				<p class="text-xs text-slate-500">
					Total {editableModules.length} modul · {totalSubs} sub-modul · {totalMats} materi. {serverMode
						? 'Klik Simpan untuk memverifikasi sinkronisasi.'
						: 'Klik Simpan untuk menerbitkan perubahan.'}
				</p>
			</div>
			<div class="flex gap-2">
				<a
					href="/instruktur/kursusku"
					class="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 transition-all duration-200 ease-smooth hover:bg-slate-50 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-slate-500"
				>
					<i class="fa-solid fa-arrow-left" aria-hidden="true"></i> Kursusku
				</a>
				<button
					type="button"
					onclick={() =>
						serverMode
							? void verifySaved()
							: markSaved('Draf kurikulum tersimpan (simulasi sisi klien).')}
					class="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white transition-all duration-200 ease-smooth hover:bg-blue-700 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-blue-600"
				>
					<i class="fa-solid fa-floppy-disk" aria-hidden="true"></i> Simpan Kurikulum
				</button>
			</div>
		</div>

		<!-- K-08: jejak perubahan draf lokal (bukan versi resmi backend) -->
		<details class="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">
			<summary
				class="flex min-h-11 cursor-pointer list-none items-center gap-2.5 px-5 py-3.5 text-sm font-bold text-slate-800 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-600 [&::-webkit-details-marker]:hidden"
			>
				<i class="fa-solid fa-clock-rotate-left text-slate-400" aria-hidden="true"></i>
				Riwayat perubahan draf
				<span class="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-600"
					>v{draftMeta.version} · lokal</span
				>
			</summary>
			<div class="border-t border-slate-100 px-5 py-4">
				{#if draftMeta.log.length === 0}
					<p class="text-xs text-slate-500">Belum ada perubahan tercatat pada draf ini.</p>
				{:else}
					<ol class="space-y-2">
						{#each draftMeta.log as entry (entry.at)}
							<li
								class="flex flex-col gap-2 rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs sm:flex-row sm:items-center sm:justify-between"
							>
								<div class="min-w-0">
									<p class="font-semibold text-slate-700">{entry.summary}</p>
									<p class="mt-0.5 text-[11px] text-slate-400">
										{new Date(entry.at).toLocaleString('id-ID', {
											day: 'numeric',
											month: 'short',
											hour: '2-digit',
											minute: '2-digit'
										})}
									</p>
								</div>
								<div
									class="flex shrink-0 items-center gap-1.5"
									role="group"
									aria-label={`Klasifikasi perubahan ${entry.summary}`}
								>
									<button
										type="button"
										onclick={() => markEntryKind(entry.at, 'ringan')}
										aria-pressed={entry.kind === 'ringan'}
										title="Ringan: typo/format/sampul/judul — tanpa pengulangan progres"
										class={`rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition-colors focus-visible:outline-2 focus-visible:outline-emerald-600 ${entry.kind === 'ringan' ? 'bg-emerald-600 text-white' : 'border border-slate-200 bg-white text-slate-500 hover:bg-emerald-50 hover:text-emerald-700'}`}
									>
										Ringan
									</button>
									<button
										type="button"
										onclick={() => markEntryKind(entry.at, 'penting')}
										aria-pressed={entry.kind === 'penting'}
										title="Penting: ubah isi kuis/tugas/ambang lulus atau hapus materi"
										class={`rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition-colors focus-visible:outline-2 focus-visible:outline-red-600 ${entry.kind === 'penting' ? 'bg-red-600 text-white' : 'border border-slate-200 bg-white text-slate-500 hover:bg-red-50 hover:text-red-700'}`}
									>
										Penting
									</button>
								</div>
							</li>
						{/each}
					</ol>
				{/if}
				<div class="mt-3 flex flex-wrap gap-2">
					<button
						type="button"
						onclick={downloadBackup}
						class="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600"
					>
						<i class="fa-solid fa-download" aria-hidden="true"></i> Unduh cadangan
					</button>
					<button
						type="button"
						onclick={() => backupInput?.click()}
						class="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600"
					>
						<i class="fa-solid fa-upload" aria-hidden="true"></i> Pulihkan cadangan
					</button>
					<input
						type="file"
						accept="application/json,.json"
						class="sr-only"
						bind:this={backupInput}
						onchange={(e) => void restoreBackup(e.currentTarget.files?.[0])}
						aria-label="Pilih berkas cadangan draf (JSON)"
					/>
				</div>
				{#if backupMessage}
					<p
						role="status"
						class="mt-2 text-xs font-semibold {backupOk ? 'text-emerald-700' : 'text-red-600'}"
					>
						{backupMessage}
					</p>
				{/if}
				<p role="note" class="mt-3 text-[11px] leading-relaxed text-slate-400">
					Catatan perangkat ini saja — progres peserta tidak ikut berubah. Cadangan melindungi draf
					bila penyimpanan browser dibersihkan. Klasifikasi penting vs ringan diputus instruktur
					pemilik kursus.
				</p>
			</div>
		</details>
	{/if}

	<WarningModal
		bind:open={showPhase}
		type="warning"
		title={nextPhase?.to === 'ended' ? 'Akhiri batch?' : 'Mulai batch?'}
		message={nextPhase?.confirmMessage ?? 'Ubah fase batch?'}
		confirmText={nextPhase?.to === 'ended' ? 'Ya, akhiri' : 'Ya, mulai'}
		cancelText="Kembali"
		oncancel={() => {
			phaseConfirm = null;
			showPhase = false;
		}}
		onconfirm={() => void confirmPhase()}
	/>
</div>
