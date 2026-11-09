<script lang="ts">
	import type { CourseModule } from '$lib/data/courses';
	import {
		ROADMAP_NODE_H,
		ROADMAP_NODE_W,
		computeRoadmapLayout,
		resolveRoadmapSelection,
		resolveSubModules,
		roadmapHue
	} from '$lib/data/training';
	import InfoDrawer from './InfoDrawer.svelte';
	import '../roadmap.css';

	/**
	 * Aurora Learning Journey (publik): modul memakai gradien cerah
	 * per tahap, sub-modul mewarisi hue induknya. Posisi & garis
	 * dihitung deterministik dari data. Node hanya toggle drawer.
	 */

	let { modules, courseId }: { modules: CourseModule[]; courseId?: number } = $props();

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
		if (id) document.getElementById(`roadmap-node-${id}`)?.focus({ preventScroll: true });
	}

	const geometry = $derived(computeRoadmapLayout(modules));

	/** Petakan setiap node ke nomor tahap + hue induk modulnya. */
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
			const hue = roadmapHue(mi);
			const badge = n.kind === 'module' ? `M${mi + 1}` : `${mi + 1}.${si + 1}`;
			return { ...n, mi, hue, badge };
		});
		const curveColor = new Map<string, string>();
		for (const c of geometry.curves) {
			const mi = subMeta.get(c.key)?.mi ?? 0;
			curveColor.set(c.key, roadmapHue(mi).from);
		}
		return { ...geometry, nodes, curveColor };
	});

	const nodeMap = $derived(new Map(layout.nodes.map((n) => [n.id, n] as const)));

	const totalSubs = $derived(modules.reduce((n, m) => n + resolveSubModules(m).length, 0));
</script>

<section
	aria-labelledby="alur-belajar-heading"
	class="overflow-hidden rounded-3xl border border-border bg-white shadow-lg shadow-slate-900/5"
>
	<!-- Header navy akademik -->
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
		<div
			class="pointer-events-none absolute top-4 right-24 hidden gap-1.5 sm:flex"
			aria-hidden="true"
		>
			<span class="h-2 w-2 rounded-full bg-white/50"></span>
			<span class="h-2 w-2 rounded-full bg-white/35"></span>
			<span class="h-2 w-2 rounded-full bg-white/20"></span>
		</div>
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
						Ikuti jalur berwarna dari atas ke bawah — setiap warna adalah satu tahap modul. Klik
						node untuk melihat detailnya.
					</p>
				</div>
				<p
					class="rounded-2xl bg-white/15 px-3.5 py-2 text-center text-[11px] font-bold text-white backdrop-blur"
				>
					<span class="text-base font-extrabold">{modules.length}</span> modul
					<span class="mx-1 text-white/50">·</span>
					<span class="text-base font-extrabold">{totalSubs}</span> sub
				</p>
			</div>
			<ul
				class="mt-3.5 flex flex-wrap gap-2 text-[10px] font-bold"
				aria-label="Legenda alur belajar"
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
					class="inline-flex items-center gap-1.5 rounded-full bg-slate-900/35 px-2.5 py-1 text-white backdrop-blur"
				>
					<i class="fa-solid fa-arrow-pointer text-[10px]" aria-hidden="true"></i>
					Klik node = detail
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
				<p class="mt-1 text-xs text-text-muted">
					Kurikulum akan muncul di sini setelah ditambahkan.
				</p>
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
							<linearGradient id="rm-spine-public" x1="0" y1="0" x2="0" y2="1">
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
								{@const dot = to.hue?.from ?? '#2563eb'}
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
									stroke="url(#rm-spine-public)"
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
							<li
								class="roadmap-node-enter absolute"
								style="left:{node.x}px;top:{node.y}px;width:{ROADMAP_NODE_W}px;animation-delay:{ni *
									60}ms"
							>
								<button
									type="button"
									id={`roadmap-node-${node.id}`}
									class="roadmap-node"
									class:module={node.kind === 'module'}
									class:sub={node.kind === 'sub'}
									class:selected={selectedNode === node.id}
									style="--g1:{node.hue.from};--g2:{node.hue.to};--soft:{node.hue.soft};--ink:{node
										.hue.ink};--ring:{node.hue.ring};--shadow:{node.hue.shadow}"
									onclick={() => openNode(node.id)}
									aria-pressed={selectedNode === node.id}
									title={node.label}
								>
									<span class="rm-badge" aria-hidden="true">{node.badge}</span>
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
				Klik setiap kartu berwarna untuk membuka detail modul & sub-modul
			</p>
		{/if}
	</div>
{#snippet roadmapActions(sel: import('$lib/data/training').RoadmapSelection)}
		{@const href =
			courseId !== undefined
				? sel.kind === 'module'
					? `/modules/${courseId}/${sel.module.id}`
					: `/modules/${courseId}/${sel.module.id}/${sel.sub.id}`
				: '/login'}
		<div class="space-y-2">
			{#if courseId !== undefined}
				<a
					href={href}
					class="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white shadow-lg shadow-primary/25 transition-all duration-200 ease-smooth hover:bg-primary-hover active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-primary"
				>
					<i class="fa-solid fa-route" aria-hidden="true"></i>
					{#if sel.kind === 'module'}
						Buka detail Modul {sel.moduleIndex + 1}
					{:else}
						Buka Sub-modul {sel.moduleIndex + 1}.{sel.subIndex + 1}
					{/if}
				</a>
			{/if}
			<a
				href="/login"
				class={`flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition-all duration-200 ease-smooth active:scale-[0.98] focus-visible:outline-2 ${
					courseId !== undefined
						? 'border border-slate-200 text-slate-700 hover:bg-slate-50 focus-visible:outline-slate-500'
						: 'bg-primary text-white shadow-lg shadow-primary/25 hover:bg-primary-hover focus-visible:outline-primary'
				}`}
			>
				<i class="fa-solid fa-arrow-right-to-bracket" aria-hidden="true"></i>
				Masuk untuk mulai belajar
			</a>
			<p class="text-center text-[11px] text-slate-500">
				Masuk untuk melacak progres dan membuka seluruh materi.
			</p>
		</div>
	{/snippet}

	<InfoDrawer {selection} onclose={closeDrawer} actions={roadmapActions} />
</section>
