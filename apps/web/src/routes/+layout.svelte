<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div style="min-height: 100vh; display: block;">
	{@render children?.()}
</div>
