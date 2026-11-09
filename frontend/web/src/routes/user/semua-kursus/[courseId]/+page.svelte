<script lang="ts">
	import { page } from '$app/state';
	import CoursePreview from '$lib/components/CoursePreview.svelte';

	const courseId = $derived(Number(page.params.courseId));
</script>

<svelte:head>
	<title>Pratinjau Kursus — Aristoteles Platform</title>
	<meta name="description" content="Pratinjau kursus: info singkat, modul, dan materi yang didapat." />
</svelte:head>

<div class="p-4 sm:p-6 lg:p-8">
	<CoursePreview {courseId} mode="user" backHref="/user/semua-kursus" backLabel="Semua Kursus" />
</div>
