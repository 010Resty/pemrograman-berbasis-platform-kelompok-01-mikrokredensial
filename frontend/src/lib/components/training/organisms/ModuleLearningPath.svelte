<script lang="ts">
	import type { Course } from '$lib/data/courses';
	import { getModuleMaterials, normalizeMaterialType } from '$lib/data/courses';
	import { resolveSubModules } from '$lib/data/training';
	import { courseCredentialId, moduleCredentialId, moduleHref } from '$lib/data/certificates';
	import { subModuleHref } from '$lib/data/training';

	let { course }: { course: Course } = $props();

	function typeSummary(materials: { type: string }[]): string {
		const order = ['materi', 'kuis', 'tugas'] as const;
		const labels: Record<string, string> = {
			materi: 'Materi',
			kuis: 'Kuis',
			tugas: 'Tugas'
		};
		const counts = new Map<string, number>();
		for (const m of materials) {
			const n = normalizeMaterialType(m.type);
			counts.set(n, (counts.get(n) ?? 0) + 1);
		}
		return order
			.filter((t) => counts.has(t))
			.map((t) => `${counts.get(t)} ${labels[t]}`)
			.join(' · ');
	}
</script>

<section
	aria-labelledby="learning-path-heading"
	class="overflow-hidden rounded-3xl border border-slate-200/70 bg-white shadow-lg shadow-slate-900/5"
>
	<div class="relative overflow-hidden bg-violet-900 p-5 sm:px-7 sm:py-6">
		<div
			class="pointer-events-none absolute -top-16 -right-10 h-48 w-48 rounded-full bg-white/10 blur-2xl"
			aria-hidden="true"
		></div>
		<div
			class="pointer-events-none absolute -bottom-20 left-1/3 h-48 w-64 rounded-full bg-blue-500/20 blur-2xl"
			aria-hidden="true"
		></div>
		<div
			class="pointer-events-none absolute inset-x-0 bottom-0 h-1 bg-amber-400"
			aria-hidden="true"
		></div>
		<div class="relative">
			<p
				class="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[10px] font-extrabold tracking-[0.16em] text-white uppercase backdrop-blur"
			>
				<i class="fa-solid fa-route" aria-hidden="true"></i>
				Learning path
			</p>
			<div class="mt-2.5 flex flex-wrap items-end justify-between gap-3">
				<div>
					<h2 id="learning-path-heading" class="text-xl font-extrabold text-white sm:text-2xl">
						Alur Belajar per Modul
					</h2>
					<p class="mt-1 max-w-xl text-xs leading-relaxed text-slate-300 sm:text-[13px]">
						Selesaikan modul berurutan — setiap modul terdiri dari sub-modul, dan setiap modul
						menerbitkan <strong class="text-white">1 sertifikat modul</strong>. Tuntaskan semua
						modul untuk membuka sertifikat pelatihan.
					</p>
				</div>
				<p class="rounded-2xl bg-white/15 px-3.5 py-2 text-center text-[11px] font-bold text-white backdrop-blur">
					<span class="text-base font-extrabold">{course.modules.length}</span> sertifikat modul
					<span class="mx-1 text-white/50">+</span>
					<span class="text-base font-extrabold">1</span> sertifikat pelatihan
				</p>
			</div>
			<ul class="mt-3.5 flex flex-wrap gap-2 text-[10px] font-bold" aria-label="Legenda learning path">
				<li class="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-slate-900 shadow">
					<span class="h-2.5 w-2.5 rounded-full bg-blue-600" aria-hidden="true"></span>
					Modul
				</li>
				<li class="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-white ring-1 ring-white/40 backdrop-blur">
					<span class="h-2.5 w-2.5 rounded-full border-2 border-white bg-transparent" aria-hidden="true"></span>
					Sub-modul
				</li>
				<li class="inline-flex items-center gap-1.5 rounded-full bg-amber-400 px-2.5 py-1 text-slate-900 shadow">
					<i class="fa-solid fa-award text-[10px]" aria-hidden="true"></i>
					Sertifikat
				</li>
			</ul>
		</div>
	</div>

	<div class="p-4 sm:p-6">
		{#if course.modules.length === 0}
			<div class="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
				<p class="text-sm font-bold text-slate-700">Belum ada modul pada pelatihan ini.</p>
			</div>
		{:else}
			<ol class="relative space-y-6">
				{#each course.modules as mod, mi (mod.id)}
					{@const subs = resolveSubModules(mod)}
					{@const mats = getModuleMaterials(mod)}
					{@const cred = moduleCredentialId(course.id, mi)}
					<li class="relative rounded-2xl border border-slate-200/80 bg-white">
						<div class="flex items-start gap-3 border-b border-slate-100 p-4 sm:p-5">
							<span
								class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-sm font-extrabold text-white shadow-lg shadow-blue-600/25"
								aria-hidden="true"
							>
								{mi + 1}
							</span>
							<div class="min-w-0 flex-1">
								<p class="text-[10px] font-extrabold tracking-[0.14em] text-blue-600 uppercase">
									Modul {mi + 1} · {subs.length} sub-modul · {mats.length} materi
								</p>
								<h3 class="mt-0.5 text-base font-extrabold text-slate-900 sm:text-lg">
									<a
										href={moduleHref(course.id, mod.id)}
										class="rounded transition-colors hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
									>
										{mod.title}
									</a>
								</h3>
								<p class="mt-1 line-clamp-2 text-[13px] leading-relaxed text-slate-600">
									{mod.description}
								</p>
								{#if mats.length > 0}
									<p class="mt-1.5 text-[11px] font-semibold text-slate-500">
										{typeSummary(mats)}
									</p>
								{/if}
							</div>
							<a
								href={moduleHref(course.id, mod.id)}
								class="hidden shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-[11px] font-bold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600 sm:inline-flex"
								aria-label={`Buka detail Modul ${mi + 1}: ${mod.title}`}
							>
								Detail <i class="fa-solid fa-arrow-right text-[10px]" aria-hidden="true"></i>
							</a>
						</div>

						<ol class="relative space-y-0 px-4 py-3 sm:px-5" aria-label={`Sub-modul dalam Modul ${mi + 1}`}>
							{#each subs as sub, si (sub.id)}
								<li class="relative flex gap-3 pb-3 last:pb-1">
									<div class="flex flex-col items-center" aria-hidden="true">
										<span
											class="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100 text-[11px] font-extrabold text-violet-700"
										>
											{mi + 1}.{si + 1}
										</span>
										{#if si < subs.length - 1}
											<span class="mt-1 w-0.5 flex-1 rounded bg-violet-100"></span>
										{/if}
									</div>
									<div class="min-w-0 flex-1 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5 transition-colors hover:border-violet-200 hover:bg-violet-50/50">
										<div class="flex items-start justify-between gap-2">
											<div class="min-w-0">
												<p class="truncate text-[13px] font-bold text-slate-900">
													<a
														href={subModuleHref(course.id, mod.id, sub.id)}
														class="rounded transition-colors hover:text-violet-700 focus-visible:outline-2 focus-visible:outline-violet-600"
													>
														{sub.title}
													</a>
												</p>
												<p class="mt-0.5 line-clamp-1 text-[11px] text-slate-500">
													{sub.description}
												</p>
												<p class="mt-1 text-[11px] font-semibold text-slate-500">
													{sub.materials.length} materi
													{#if sub.materials.length > 0}
														<span class="text-slate-400">· {typeSummary(sub.materials)}</span>
													{/if}
												</p>
											</div>
											<a
												href={subModuleHref(course.id, mod.id, sub.id)}
												class="inline-flex shrink-0 items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-[11px] font-bold text-violet-700 ring-1 ring-violet-200 transition-colors hover:bg-violet-600 hover:text-white focus-visible:outline-2 focus-visible:outline-violet-600"
												aria-label={`Buka Sub-modul ${mi + 1}.${si + 1}: ${sub.title}`}
											>
												Buka <i class="fa-solid fa-chevron-right text-[9px]" aria-hidden="true"></i>
											</a>
										</div>
									</div>
								</li>
							{/each}
						</ol>

						<div class="mx-4 mb-4 flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 sm:mx-5 sm:flex-row sm:items-center sm:justify-between">
							<p class="flex items-start gap-2.5 text-[13px] text-slate-700">
								<span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-400 text-slate-900" aria-hidden="true">
									<i class="fa-solid fa-award" aria-hidden="true"></i>
								</span>
								<span>
									<strong class="block text-[13px] font-extrabold text-slate-900">
										Sertifikat Modul {mi + 1}
									</strong>
									<span class="block text-[11px] text-slate-600">
										Terbuka setelah {mats.length} materi tuntas · ID
										<span class="font-mono font-bold text-slate-800">{cred}</span>
									</span>
								</span>
							</p>
							<a
								href={moduleHref(course.id, mod.id) + '#sertifikat'}
								class="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-[11px] font-bold text-white transition-colors hover:bg-violet-700 focus-visible:outline-2 focus-visible:outline-violet-600"
							>
								<i class="fa-solid fa-eye text-[10px]" aria-hidden="true"></i> Lihat sertifikat
							</a>
						</div>

						{#if mi < course.modules.length - 1}
							<span
								class="absolute -bottom-6 left-8 flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-600/30"
								aria-hidden="true"
							>
								<i class="fa-solid fa-arrow-down text-[10px]"></i>
							</span>
						{/if}
					</li>
				{/each}

				<li class="rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50/60 p-4 text-center sm:p-5">
					<p class="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/25" aria-hidden="true">
						<i class="fa-solid fa-graduation-cap" aria-hidden="true"></i>
					</p>
					<h3 class="mt-2 text-base font-extrabold text-slate-900">Sertifikat Pelatihan</h3>
					<p class="mx-auto mt-1 max-w-md text-xs leading-relaxed text-slate-600">
						Tuntaskan seluruh {course.modules.length} modul untuk membuka sertifikat akhir pelatihan
						· ID <span class="font-mono font-bold text-slate-800">{courseCredentialId(course.id)}</span>
					</p>
				</li>
			</ol>
		{/if}
	</div>
</section>
