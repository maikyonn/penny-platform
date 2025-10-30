<script lang="ts">
	import Logo from '$lib/components/Logo.svelte';
	import Button from '$lib/components/Button.svelte';

	let { data } = $props();
	const subscription = (data.subscription ?? null) as
		| import('$lib/database.types').Database['public']['Tables']['subscriptions']['Row']
		| null;
	const usage = (data.usage ?? []) as Array<{
		metric: string;
		quantity: number;
		recorded_at: string;
	}>;
	let billingError = $state<string | null>(null);
	let billingLoading = $state(false);

	async function openBillingPortal() {
		billingError = null;
		billingLoading = true;

		try {
			const response = await fetch('/api/billing/portal', { method: 'POST' });
			const payload = await response.json();

			if (!response.ok || !payload?.url) {
				const message = payload?.error ?? 'Unable to open billing portal.';
				throw new Error(message);
			}

			window.location.href = payload.url;
		} catch (error) {
			console.error('[settings] portal open error', error);
			billingError =
				error instanceof Error ? error.message : 'Unable to open billing portal right now.';
		} finally {
			billingLoading = false;
		}
	}
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

	<main class="mx-auto flex max-w-6xl flex-col gap-10 px-8 py-12">
		<section>
			<h1 class="text-3xl font-semibold text-gray-900">Account settings</h1>
			<p class="mt-2 text-sm text-gray-500">Manage billing and collaboration preferences for your brand.</p>
		</section>

		<section class="grid gap-6 md:grid-cols-2">
			<article class="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
				<h2 class="text-lg font-semibold text-gray-900">Plan</h2>
				<p class="mt-2 text-sm text-gray-500">Current subscription and renewal information.</p>
				<div class="mt-4 space-y-3 text-sm text-gray-700">
					<p><span class="text-gray-500">Plan:</span> {subscription?.plan ?? 'Free'}</p>
					<p><span class="text-gray-500">Status:</span> {subscription?.status ?? 'active'}</p>
					<p><span class="text-gray-500">Renews:</span> {subscription?.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString() : '—'}</p>
				</div>
				<div class="mt-6 flex gap-3">
					<Button href="/pricing" class="px-5">Change plan</Button>
					<Button variant="outline" class="px-5" onclick={openBillingPortal} disabled={billingLoading}>
						{billingLoading ? 'Opening…' : 'Manage billing'}
					</Button>
				</div>
				{#if billingError}
					<div class="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
						{billingError}
					</div>
				{/if}
			</article>
			<article class="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
				<h2 class="text-lg font-semibold text-gray-900">Team</h2>
				<p class="mt-2 text-sm text-gray-500">Fine-tune collaboration defaults for anyone helping on campaigns.</p>
				<ul class="mt-5 space-y-3 text-sm text-gray-700">
					<li class="flex items-start gap-3">
						<input type="checkbox" class="mt-1 h-4 w-4 rounded border-gray-300 text-[#FF6F61] focus:ring-[#FF6F61]" checked />
						<div>
							<p class="font-medium text-gray-900">Share influencer lists by default</p>
							<p class="text-xs text-gray-500">New matches appear for all collaborators.</p>
						</div>
					</li>
					<li class="flex items-start gap-3">
						<input type="checkbox" class="mt-1 h-4 w-4 rounded border-gray-300 text-[#FF6F61] focus:ring-[#FF6F61]" />
						<div>
							<p class="font-medium text-gray-900">Allow edits to outreach templates</p>
							<p class="text-xs text-gray-500">Teammates can iterate on copy before sending.</p>
						</div>
					</li>
					<li class="flex items-start gap-3">
						<input type="checkbox" class="mt-1 h-4 w-4 rounded border-gray-300 text-[#FF6F61] focus:ring-[#FF6F61]" checked />
						<div>
							<p class="font-medium text-gray-900">Send daily digest</p>
							<p class="text-xs text-gray-500">Summary of replies and next steps at 8am local time.</p>
						</div>
					</li>
				</ul>
	<Button class="mt-6 px-5">Save preferences</Button>
			</article>
		</section>

		<section class="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
			<div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
				<div>
					<h2 class="text-lg font-semibold text-gray-900">Usage</h2>
					<p class="text-sm text-gray-500">Recent tracked activity for billing and reporting.</p>
				</div>
	<Button variant="outline" class="px-5">Export CSV</Button>
			</div>
			{#if usage.length}
				<div class="mt-4 overflow-x-auto">
					<table class="min-w-full text-left text-sm text-gray-700">
						<thead class="text-xs uppercase tracking-wide text-gray-500">
							<tr>
								<th class="px-4 py-2">Metric</th>
								<th class="px-4 py-2">Quantity</th>
								<th class="px-4 py-2">Recorded</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-100">
							{#each usage as row}
								<tr>
									<td class="px-4 py-2">{row.metric}</td>
									<td class="px-4 py-2">{row.quantity}</td>
									<td class="px-4 py-2">{new Date(row.recorded_at).toLocaleString()}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{:else}
				<p class="mt-4 text-sm text-gray-500">No usage data yet.</p>
			{/if}
		</section>
	</main>
</div>
