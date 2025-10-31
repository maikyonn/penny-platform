<script lang="ts">
	import Logo from '$lib/components/Logo.svelte';
	import Button from '$lib/components/Button.svelte';

	type SubscriptionInfo = {
		type: string;
		status: string;
		priceId?: string | null;
		productId?: string | null;
		customerId?: string | null;
		currentPeriodEnd?: string | null;
	};

	let { data } = $props();
	const subscription = (data.subscription ?? null) as SubscriptionInfo | null;
</script>

<div class="min-h-screen bg-gray-50">
	<header class="border-b border-gray-200 bg-white">
		<div class="mx-auto flex max-w-5xl items-center justify-between gap-4 px-8 py-6">
			<a class="flex items-center gap-3 text-gray-600 transition hover:text-gray-900" href="/campaign">
				<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
					<path stroke-linecap="round" stroke-linejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
				</svg>
				<span class="text-sm font-medium">Back to dashboard</span>
			</a>
			<Logo size="md" />
		</div>
	</header>

	<main class="mx-auto flex max-w-3xl flex-col gap-6 px-8 py-16 text-center">
		<div class="space-y-4">
			<div class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
				<svg class="h-10 w-10 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
					<path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
				</svg>
			</div>
			<h1 class="text-3xl font-semibold text-gray-900">You're all set!</h1>
			<p class="text-sm text-gray-600">
				Your subscription is active. We've sent a confirmation email with your invoice and trial details.
			</p>
		</div>

		{#if subscription}
			<div class="mx-auto w-full max-w-md rounded-3xl border border-gray-200 bg-white p-6 text-left shadow-sm">
				<h2 class="text-lg font-semibold text-gray-900">Current plan</h2>
				<ul class="mt-4 space-y-2 text-sm text-gray-700">
					<li><span class="text-gray-500">Plan:</span> {subscription.type}</li>
					<li><span class="text-gray-500">Status:</span> {subscription.status}</li>
					<li>
						<span class="text-gray-500">Renews:</span>
						{subscription.currentPeriodEnd
							? new Date(subscription.currentPeriodEnd).toLocaleDateString()
							: '—'}
					</li>
				</ul>
			</div>
		{/if}

		<div class="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
			<Button href="/campaign" class="px-6">Go to dashboard</Button>
			<Button variant="outline" href="/my-account" class="px-6">Manage account</Button>
		</div>
	</main>
</div>
