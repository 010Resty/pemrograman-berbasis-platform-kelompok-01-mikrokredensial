<script lang="ts">
	import type { CourseModule } from '$lib/data/courses';
	import { isModuleLocked, isSubModuleLocked } from '$lib/data/courses';
	import { doneMaterials } from '$lib/stores/progress.svelte';
	import {
		ROADMAP_DONE_HUE,
		ROADMAP_NODE_H,
		ROADMAP_NODE_W,
		computeRoadmapLayout,
		firstUnfinishedInModule,
		firstUnfinishedInModules,
		firstUnfinishedMaterial,
		moduleProgress,
		resolveRoadmapSelection,
		resolveSubModules,
		roadmapHue,
		subModuleProgress,
		type RoadmapSelection
	} from '$lib/data/training';
	import InfoDrawer from './InfoDrawer.svelte';
	import ProgressBar from '../atoms/ProgressBar.svelte';
	import '../roadmap.css';

	/**
	 * Aurora roadmap terotentikasi: hue cerah per tahap + status
	 * belajar (selesai emerald / terkunci slate / berjalan hue asli).
	 * Mode `preview`: semua terbuka tanpa progres.
	 */
	type NodeStatus = 'todo' | 'done' | 'locked';

	let {
		modules,
		courseId,
		preview = false
	}: {
		modules: CourseModule[];
		courseId: number;
		preview?: boolean;
	} = $props();

	const base = $derived(`/user/kursusku/${courseId}`);
	const isDone = (id: string) => (preview ? false : doneMaterials.has(id));

	let selectedNode = $state<string | null>(null);

	const selection = $derived(resolveRoadmapSelection(modules, selectedNode));

	function openNode(id: string) {
		if (selectedNode === id) {
			closeDrawer();
			return;
		}
		selectedNode = id;
	}

	function closeDrawer() {
		const id = selectedNode;
		selectedNode = null;
		if (id) document.getElementById(`user-node-${id}`)?.focus({ preventScroll: true });
	}

	const geometry = $derived(computeRoadmapLayout(modules));

	const layout = $derived.by(() => {
		const moduleOf = new Map<string, number>();
		const subMeta = new Map<string, { mi: number; si: number }>();
		modules.forEach((m, mi) => {
			moduleOf.set(m.id, mi);
			resolveSubModules(m).forEach((s, si) => subMeta.set(s.id, { mi, si }));
		});
		const nodes = geometry.nodes.map((n) => {
			const mi = n.kind === 'module' ? (moduleOf.get(n.id) ?? 0) : (subMeta.get(n.id)?.mi ?? 0);
			const si = subMeta.get(n.id)?.si ?? 0;
			return { ...n, mi, si, badge: n.kind === 'module' ? `M${mi + 1}` : `${mi + 1}.${si + 1}` };
		});
		const curveColor = new Map<string, string>();
		for (const c of geometry.curves) {
			curveColor.set(c.key, roadmapHue(subMeta.get(c.key)?.mi ?? 0).from);
		}
		return { ...geometry, nodes, curveColor };
	});
	const nodeMap = $derived(new Map(layout.nodes.map((n) => [n.id, n] as const)));

	const statusById = $derived.by(() => {
		const map = new Map<string, NodeStatus>();
		for (const n of layout.nodes) {
			if (preview) {
				map.set(n.id, 'todo');
				continue;
			}
			const sel = resolveRoadmapSelection(modules, n.id);
			if (!sel) continue;
			const locked =
				sel.kind === 'module'
					? isModuleLocked(modules, sel.moduleIndex, isDone)
					: isSubModuleLocked(modules, sel.moduleIndex, sel.subIndex, isDone);
			if (locked) {
				map.set(n.id, 'locked');
				continue;
			}
			const percent =
				sel.kind === 'module'
					? moduleProgress(sel.module, isDone).percent
					: subModuleProgress(sel.sub, isDone).percent;
			map.set(n.id, percent === 100 ? 'done' : 'todo');
		}
		return map;
	});

	const currentId = $derived(
		preview ? null : (layout.nodes.find((n) => statusById.get(n.id) === 'todo')?.id ?? null)
	);

	const overall = $derived.by(() => {
		if (preview) return { done: 0, total: 0, percent: 0 };
		let total = 0;
		let done = 0;
		for (const m of modules) {
			for (const s of resolveSubModules(m)) {
				for (const mat of s.materials) {
					total += 1;
					if (isDone(mat.id)) done += 1;
				}
			}
		}
		return { done, total, percent: total === 0 ? 0 : Math.round((done / total) * 100) };
	});

	const totalSubs = $derived(modules.reduce((n, m) => n + resolveSubModules(m).length, 0));

	function hueFor(mi: number, status: NodeStatus) {
		return status === 'done' ? ROADMAP_DONE_HUE : roadmapHue(mi);
	}

	function ariaLabelFor(label: string, status: NodeStatus, isCurrent: boolean): string | undefined {
		if (status === 'locked') return `Terkunci: ${label}`;
		if (status === 'done') return `Selesai: ${label}`;
		if (isCurrent) return `Lanjutkan: ${label}`;
		return undefined;
	}

	function materialHref(moduleId: string, materialId: string): string {
		return `${base}/${moduleId}/${materialId}`;
	}

	const nodeStatus = (id: string): NodeStatus => statusById.get(id) ?? 'todo';
</script>

{#snippet drawerActions(sel: RoadmapSelection)}
	{@const locked =
		!preview &&
		(sel.kind === 'module'
			? isModuleLocked(modules, sel.moduleIndex, isDone)
			: isSubModuleLocked(modules, sel.moduleIndex, sel.subIndex, isDone))}
	{@const prog =
		preview || locked
			? null
			: sel.kind === 'module'
				? moduleProgress(sel.module, isDone)
				: subModuleProgress(sel.sub, isDone)}
	{@const nextInScope =
		preview || locked
			? null
			: sel.kind === 'module'
				? (firstUnfinishedInModule(sel.module, isDone) ?? sel.module.materials[0])
				: (firstUnfinishedMaterial(sel.sub.materials, isDone) ?? sel.sub.materials[0])}
	{@const fallback = !preview && locked ? firstUnfinishedInModules(modules, isDone) : null}
	{#if preview}
		<a
			href={`/user/kursusku/${courseId}`}
			class="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white shadow-lg shadow-primary/25 transition-all duration-200 ease-smooth hover:bg-primary-hover active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-primary"
		>
			<i class="fa-solid fa-eye" aria-hidden="true"></i>
			Buka halaman kursus
		</a>
	{:else if locked}
		<p
			class="flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800"
		>
			<i class="fa-solid fa-lock mt-0.5 shrink-0" aria-hidden="true"></i>
			<span>Selesaikan sub-modul dan materi sebelumnya dalam modul ini untuk membuka bagian ini.</span>
		</p>
		{#if fallback}
			<a
				href={materialHref(fallback.module.id, fallback.material.id)}
				class="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white shadow-lg shadow-primary/25 transition-all duration-200 ease-smooth hover:bg-primary-hover active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-primary"
			>
				<i class="fa-solid fa-play" aria-hidden="true"></i>
				Kerjakan: {fallback.material.title}
			</a>
		{/if}
	{:else}
		{#if prog}
			<ProgressBar
				percent={prog.percent}
				label={`${prog.done}/${prog.total} materi`}
				tone={prog.percent === 100 ? 'emerald' : 'blue'}
			/>
		{/if}
		{#if nextInScope}
			<a
				href={materialHref(sel.module.id, nextInScope.id)}
				class="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-navy px-4 py-3 text-sm font-bold text-white shadow-lg shadow-navy/25 transition-all duration-200 ease-smooth hover:bg-slate-800 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-navy"
			>
				<i class="fa-solid fa-play" aria-hidden="true"></i>
				{prog && prog.percent === 100 ? 'Tinjau ulang' : 'Lanjutkan belajar'}
			</a>
		{/if}
	{/if}
{/snippet}

<section
	aria-labelledby="alur-belajar-heading"
	class="overflow-hidden rounded-3xl border border-border bg-white shadow-lg shadow-slate-900/5"
>
	<div class="relative overflow-hidden bg-navy p-5 sm:px-7 sm:py-6">
		<div
			class="pointer-events-none absolute -top-16 -right-10 h-48 w-48 rounded-full bg-white/10 blur-2xl"
			aria-hidden="true"
		></div>
		<div
			class="pointer-events-none absolute -bottom-20 left-1/3 h-48 w-64 rounded-full bg-accent/20 blur-2xl"
			aria-hidden="true"
		></div>
		<div
			class="pointer-events-none absolute inset-x-0 bottom-0 h-1 bg-accent"
			aria-hidden="true"
		></div>
		<div class="relative">
			<p
				class="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[10px] font-extrabold tracking-[0.16em] text-white uppercase backdrop-blur"
			>
				<i class="fa-solid fa-route" aria-hidden="true"></i>
				Peta perjalanan
			</p>
			<div class="mt-2.5 flex flex-wrap items-end justify-between gap-3">
				<div>
					<h2 id="alur-belajar-heading" class="text-xl font-extrabold text-white sm:text-2xl">
						Alur Belajar
					</h2>
					<p class="mt-1 max-w-xl text-xs leading-relaxed text-slate-300 sm:text-[13px]">
						{#if preview}
							Pratinjau jalur belajar — semua tahap terbuka.
						{:else if overall.total > 0}
							{overall.done} dari {overall.total} materi selesai ({overall.percent}%) — lanjutkan ke
							kartu yang berdenyut.
						{:else}
							Ikuti jalur berwarna dari atas ke bawah, klik node untuk detail.
						{/if}
					</p>
				</div>
				<div class="min-w-44 rounded-2xl bg-white/15 p-3 backdrop-blur">
					<p
						class="flex items-center justify-between text-[10px] font-extrabold tracking-widest text-slate-300 uppercase"
					>
						<span>Progres</span><span>{preview ? '—' : `${overall.percent}%`}</span>
					</p>
					<div
						class="mt-1.5 h-2 overflow-hidden rounded-full bg-white/25"
						role={preview ? undefined : 'progressbar'}
						aria-valuenow={preview ? undefined : overall.percent}
						aria-valuemin={preview ? undefined : 0}
						aria-valuemax={preview ? undefined : 100}
						aria-label="Progres alur belajar"
					>
						<div
							class="h-full rounded-full bg-accent transition-all duration-500"
							style="width:{preview ? 0 : overall.percent}%"
						></div>
					</div>
					<p class="mt-1.5 text-center text-[11px] font-bold text-white">
						{modules.length} modul · {totalSubs} sub
					</p>
				</div>
			</div>
			<ul
				class="mt-3.5 flex flex-wrap gap-2 text-[10px] font-bold"
				aria-label="Legenda status belajar"
			>
				<li
					class="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-navy shadow"
				>
					<span class="h-2.5 w-2.5 rounded-full bg-primary" aria-hidden="true"></span>
					Modul
				</li>
				<li
					class="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-white ring-1 ring-white/40 backdrop-blur"
				>
					<span
						class="h-2.5 w-2.5 rounded-full border-2 border-white bg-transparent"
						aria-hidden="true"
					></span>
					Sub-modul
				</li>
				<li
					class="inline-flex items-center gap-1.5 rounded-full bg-success px-2.5 py-1 text-white shadow"
				>
					<i class="fa-solid fa-check text-[10px]" aria-hidden="true"></i>
					Selesai
				</li>
				<li
					class="inline-flex items-center gap-1.5 rounded-full bg-slate-900/40 px-2.5 py-1 text-white backdrop-blur"
				>
					<i class="fa-solid fa-lock text-[10px]" aria-hidden="true"></i>
					Terkunci
				</li>
			</ul>
		</div>
	</div>

	<div class="p-4 sm:p-6">
		{#if modules.length === 0}
			<div class="rounded-2xl border border-dashed border-border bg-surface p-8 text-center">
				<p
					class="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-navy text-white shadow-lg shadow-navy/25"
				>
					<i class="fa-solid fa-map" aria-hidden="true"></i>
				</p>
				<p class="mt-3 text-sm font-bold text-navy">Belum ada modul pada pelatihan ini.</p>
			</div>
		{:else}
			<div class="roadmap-viewport">
				<div class="roadmap-canvas mx-auto" style="width:{layout.w}px;height:{layout.h}px">
					<svg
						class="connections"
						width={layout.w}
						height={layout.h}
						viewBox="0 0 {layout.w} {layout.h}"
						aria-hidden="true"
					>
						<defs>
							<linearGradient id="rm-spine-user" x1="0" y1="0" x2="0" y2="1">
								<stop offset="0%" stop-color="#2563eb" />
								<stop offset="52%" stop-color="#38bdf8" />
								<stop offset="100%" stop-color="#0f172a" />
							</linearGradient>
						</defs>
						{#each layout.connections as connection (connection[0] + '>' + connection[1])}
							{@const from = nodeMap.get(connection[0])}
							{@const to = nodeMap.get(connection[1])}
							{#if from && to}
								{@const x1 = from.x + ROADMAP_NODE_W / 2}
								{@const y1 = from.y + ROADMAP_NODE_H / 2}
								{@const x2 = to.x + ROADMAP_NODE_W / 2}
								{@const y2 = to.y + ROADMAP_NODE_H / 2}
								{@const mx = (x1 + x2) / 2}
								{@const my = (y1 + y2) / 2}
								{@const dot = roadmapHue(to.mi ?? 0).from}
								<!-- Halo putih agar garis tetap terbaca di atas dot-grid -->
								<line
									{x1}
									{y1}
									{x2}
									{y2}
									stroke="#ffffff"
									stroke-width="10"
									stroke-linecap="round"
									opacity="0.9"
								/>
								<!-- Garis utama antar modul: selalu solid, gradien di atas warna dasar -->
								<line
									{x1}
									{y1}
									{x2}
									{y2}
									stroke="#2563eb"
									stroke-width="4.5"
									stroke-linecap="round"
								/>
								<line
									class="roadmap-spine"
									{x1}
									{y1}
									{x2}
									{y2}
									stroke="url(#rm-spine-user)"
									stroke-width="4"
									stroke-linecap="round"
								/>
								<circle cx={mx} cy={my} r="7.5" fill="#ffffff" stroke={dot} stroke-width="3" />
								<circle cx={mx} cy={my} r="2.6" fill={dot} />
							{/if}
						{/each}
						{#each layout.curves as curve (curve.key)}
							<path
								class="roadmap-curve"
								d={curve.d}
								fill="none"
								stroke={layout.curveColor.get(curve.key) ?? '#94a3b8'}
								stroke-width="3"
								stroke-linecap="round"
								stroke-dasharray="0.5 8"
								opacity="0.85"
							/>
						{/each}
					</svg>
					<ul class="absolute inset-0 m-0 list-none p-0">
						{#each layout.nodes as node, ni (node.id)}
							{@const status = nodeStatus(node.id)}
							{@const isCurrent = currentId === node.id}
							{@const hue = hueFor(node.mi, status)}
							<li
								class="roadmap-node-enter absolute"
								style="left:{node.x}px;top:{node.y}px;width:{ROADMAP_NODE_W}px;animation-delay:{ni *
									60}ms"
							>
								<button
									type="button"
									id={`user-node-${node.id}`}
									class="roadmap-node"
									class:module={node.kind === 'module'}
									class:sub={node.kind === 'sub'}
									class:locked={status === 'locked'}
									class:is-done={status === 'done'}
									class:current={isCurrent}
									class:selected={selectedNode === node.id}
									style="--g1:{hue.from};--g2:{hue.to};--soft:{hue.soft};--ink:{hue.ink};--ring:{hue.ring};--shadow:{hue.shadow}"
									onclick={() => openNode(node.id)}
									aria-pressed={selectedNode === node.id}
									aria-label={ariaLabelFor(node.label, status, isCurrent)}
									title={node.label}
								>
									{#if isCurrent}
										<span class="rm-live"
											><i class="fa-solid fa-circle" aria-hidden="true"></i>Lanjut</span
										>
									{/if}
									<span class="rm-badge" aria-hidden="true">
										{#if status === 'done'}
											<i class="fa-solid fa-check text-xs" aria-hidden="true"></i>
										{:else if status === 'locked'}
											<i class="fa-solid fa-lock text-[11px]" aria-hidden="true"></i>
										{:else}
											{node.badge}
										{/if}
									</span>
									<span class="rm-label">{node.label}</span>
									<i class="fa-solid fa-chevron-right rm-chevron" aria-hidden="true"></i>
								</button>
							</li>
						{/each}
					</ul>
				</div>
			</div>
			<p
				class="mt-3 flex items-center justify-center gap-1.5 text-center text-[11px] font-semibold text-slate-400"
			>
				<i class="fa-solid fa-hand-pointer" aria-hidden="true"></i>
				Klik kartu untuk detail & tombol lanjut belajar
			</p>
		{/if}
	</div>
	<InfoDrawer {selection} onclose={closeDrawer} actions={drawerActions} />
</section>
