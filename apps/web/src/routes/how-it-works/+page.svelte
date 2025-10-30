<script lang="ts">
	import Logo from '$lib/components/Logo.svelte';
	import Button from '$lib/components/Button.svelte';

	const steps = [
		{
			title: '1. Align on goals',
			description: 'Use the campaign chat to capture objectives, creative direction, and success metrics. Dime turns that input into a structured brief.'
		},
		{
			title: '2. Source perfectly matched influencers',
			description: 'From your brief, Dime searches our curated network and suggests creators that match your audience, platform, and tone.'
		},
		{
			title: '3. Launch outreach & collaborate',
			description: 'Send proposals in bulk, negotiate in the inbox, and auto-generate agreements once you have a yes.'
		},
		{
			title: '4. Measure outcomes',
			description: 'Dashboard velocity cards summarize replies, sentiment, and next steps so the team stays on track.'
		}
	];
</script>

<div class="min-h-screen bg-gray-50">
	<header class="border-b border-gray-200 bg-white">
		<div class="mx-auto flex max-w-6xl items-center justify-between gap-4 px-8 py-6">
			<a class="flex items-center gap-3 text-gray-600 transition hover:text-gray-900" href="/campaign">
				<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
					<path stroke-linecap="round" stroke-linejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
				</svg>
				<span class="text-sm font-medium">Back to dashboard</span>
			</a>
			<Logo size="md" />
		</div>
	</header>

	<main class="mx-auto flex max-w-5xl flex-col gap-12 px-8 py-12">
		<section class="space-y-3 text-center">
			<h1 class="text-3xl font-semibold text-gray-900">How Dime works</h1>
			<p class="text-sm text-gray-500">
				This quick tour mirrors the story we tell on the <a href="/" class="font-semibold text-[#FF6F61] underline decoration-dotted underline-offset-2">landing page</a>:
				launch a campaign, discover influencers, collaborate, and measure everything in one place.
			</p>
			<Button class="mx-auto" href="/">View the full landing experience</Button>
		</section>

		<section class="space-y-6">
			{#each steps as step, i}
				<article class="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white px-6 py-5 shadow-sm md:flex-row md:items-start md:gap-6">
					<div class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#FFF1ED] text-sm font-semibold text-[#FF6F61]">
						{i + 1}
					</div>
					<div>
						<h2 class="text-lg font-semibold text-gray-900">{step.title}</h2>
						<p class="mt-1 text-sm text-gray-500">{step.description}</p>
					</div>
				</article>
			{/each}
		</section>

		<section class="rounded-2xl border border-gray-200 bg-white px-6 py-6 shadow-sm">
			<h2 class="text-lg font-semibold text-gray-900">Need a deeper dive?</h2>
			<p class="mt-2 text-sm text-gray-500">
				Hop back to the homepage to explore the hero, product sections, and testimonials that inspired this walkthrough. Everything on this page maps directly to those modules, so teams new to Dime can move from inspiration to action fast.
			</p>
			<div class="mt-4 flex gap-3">
				<Button variant="outline" href="/pricing">Compare pricing</Button>
				<Button href="/campaign">Start a campaign</Button>
			</div>
		</section>
	</main>
</div>
