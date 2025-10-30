<script lang="ts">
	import { page } from '$app/stores';
	import Button from '$lib/components/Button.svelte';

	let { data } = $props();

	const pageStore = page;
	const form = $derived($pageStore.form ?? null);

	let newCampaignName = $state('');
	let newCampaignObjective = $state('');
	let newCampaignUrl = $state('');
	let showAdvancedFields = $state(false);

	$effect(() => {
		if (!form) return;
		if (form?.values) {
			if (form.values.name !== undefined) newCampaignName = form.values.name;
			if (form.values.objective !== undefined) newCampaignObjective = form.values.objective;
			if (form.values.landing_page_url !== undefined) newCampaignUrl = form.values.landing_page_url;
		}
		if (form?.success) {
			newCampaignName = '';
			newCampaignObjective = '';
			newCampaignUrl = '';
			showAdvancedFields = false;
		}
	});
</script>

<div class="w-full max-w-4xl mx-auto px-6 lg:px-12 py-16">
		<section id="new-campaign" class="bg-white border border-gray-200 rounded-3xl shadow-sm">
			<header class="border-b border-gray-100 px-6 py-5">
				<h1 class="text-lg font-semibold text-gray-900">Create a new campaign</h1>
				<p class="text-sm text-gray-500">Keep it simple—add optional details only when you need them.</p>
			</header>

			<form method="POST" action="?/create" class="space-y-4 p-6">
				{#if form?.error}
					<div class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
						{form.error}
					</div>
				{/if}
				{#if form?.success}
					<div class="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
						Campaign created! Open your dashboard or the campaign list to get moving.
					</div>
				{/if}

				<div class="flex flex-col gap-3 md:flex-row md:items-center">
					<label class="sr-only" for="campaign-name">Campaign name</label>
					<input
						id="campaign-name"
						name="name"
						type="text"
						placeholder="Name your next creator campaign"
						class="flex-1 rounded-xl border border-gray-200 px-5 py-4 text-lg text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#FF6F61]"
						required
						bind:value={newCampaignName}
					/>
					<button
						type="submit"
						class="inline-flex items-center justify-center gap-2 rounded-xl bg-[#FF6F61] px-5 py-4 font-medium text-gray-900 transition hover:bg-[#ff846f] hover:shadow-md"
					>
						<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
						</svg>
						<span>Create campaign</span>
					</button>
				</div>

				<div>
					<button
						type="button"
						class="text-sm font-medium text-[#FF6F61] hover:text-[#ff846f]"
						onclick={() => (showAdvancedFields = !showAdvancedFields)}
					>
						{showAdvancedFields ? 'Hide optional details' : 'Add optional details'}
					</button>
				</div>

				{#if showAdvancedFields}
					<div class="grid gap-4 md:grid-cols-2">
						<div>
							<label for="landing-page" class="block text-xs font-medium uppercase tracking-wide text-gray-500">Landing page (optional)</label>
							<input
								id="landing-page"
								name="landing_page_url"
								type="url"
								placeholder="https://yourstore.com"
								class="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-800 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#FF6F61]"
								bind:value={newCampaignUrl}
							/>
						</div>
						<div>
							<label for="objective" class="block text-xs font-medium uppercase tracking-wide text-gray-500">Objective (optional)</label>
							<input
								id="objective"
								name="objective"
								type="text"
								placeholder="Drive 50 creator signups"
								class="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-800 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#FF6F61]"
								bind:value={newCampaignObjective}
							/>
						</div>
					</div>
				{/if}
			</form>
		</section>
</div>
