<script lang="ts">
	import DashboardShell from '$lib/components/DashboardShell.svelte';

	let { children } = $props();
</script>

<DashboardShell>
	{@render children()}
</DashboardShell>
