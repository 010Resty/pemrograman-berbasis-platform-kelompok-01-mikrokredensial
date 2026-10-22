<script lang="ts">
	import type { Course, Material } from '$lib/data/courses';
	import { getMaterialDetail } from '$lib/data/material-details';
	import TextMaterial from './TextMaterial.svelte';
	import PhotoMaterial from './PhotoMaterial.svelte';
	import AudioMaterial from './AudioMaterial.svelte';
	import VideoMaterial from './VideoMaterial.svelte';
	import QuizMaterial from './QuizMaterial.svelte';
	import AssignmentMaterial from './AssignmentMaterial.svelte';

	let {
		material,
		course,
		moduleTitle,
		moduleId = '',
		onComplete
	}: {
		material: Material;
		course: Course;
		moduleTitle: string;
		moduleId?: string;
		onComplete?: (id: string) => void;
	} = $props();

	const detail = $derived(getMaterialDetail(material, course, moduleTitle));
</script>

{#if material.type === 'video' && detail.mediaUrl}
	<VideoMaterial
		src={detail.mediaUrl}
		title={material.title}
		poster={detail.posterUrl}
		intro={detail.intro}
		chapters={detail.chapters ?? []}
		points={detail.points ?? []}
	/>
{:else if material.type === 'audio' && detail.mediaUrl}
	<AudioMaterial
		src={detail.mediaUrl}
		title={material.title}
		intro={detail.intro}
		transcript={detail.transcript}
	/>
{:else if material.type === 'foto' && detail.mediaUrl}
	<PhotoMaterial
		src={detail.mediaUrl}
		alt={`Ilustrasi materi: ${material.title}`}
		caption={detail.caption}
		intro={detail.intro}
		points={detail.points ?? []}
	/>
{:else if material.type === 'kuis' && detail.questions}
	<QuizMaterial
		questions={detail.questions}
		intro={detail.intro}
		materialId={material.id}
		courseId={String(course.id)}
		moduleId={moduleId || moduleTitle}
		onPass={() => onComplete?.(material.id)}
	/>
{:else if material.type === 'tugas' && detail.assignment}
	<AssignmentMaterial assignment={detail.assignment} materialId={material.id} courseId={String(course.id)} moduleId={moduleId || moduleTitle} moduleTitle={moduleTitle} courseTitle={course.title} onSubmit={() => onComplete?.(material.id)} />
{:else}
	<TextMaterial intro={detail.intro} paragraphs={detail.paragraphs ?? []} points={detail.points ?? []} />
{/if}
