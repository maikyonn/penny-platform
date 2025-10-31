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
const form = $derived(((data as { form?: any })?.form) ?? null);
const subscription = (data.subscription ?? null) as SubscriptionInfo | null;
	let fullName = $state(data.profile?.full_name ?? '');
	let locale = $state(data.profile?.locale ?? 'en');
	let billingError = $state<string | null>(null);
	let billingLoading = $state(false);

	$effect(() => {
		if (form?.values?.full_name !== undefined) {
			fullName = form.values.full_name;
		}
		if (form?.values?.locale !== undefined) {
			locale = form.values.locale;
		}
	});

	const message = $derived(form?.success ? 'Profile updated.' : null);

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
			console.error('[billing] portal error', error);
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
		<section class="flex flex-col gap-3">
			<h1 class="text-3xl font-semibold text-gray-900">My account</h1>
			<p class="text-sm text-gray-500">Manage your identity, language preferences, and billing details.</p>
			{#if message}
				<div class="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div>
			{/if}
		</section>

		<section class="grid gap-6 md:grid-cols-2">
			<article class="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
				<h2 class="text-lg font-semibold text-gray-900">Profile</h2>
				<p class="mt-2 text-sm text-gray-500">Update how collaborators see you inside the dashboard.</p>
				<form class="mt-6 space-y-4" method="POST" action="?/updateProfile">
					<div>
						<label class="text-xs font-semibold uppercase tracking-wide text-gray-400" for="full_name">Full name</label>
						<input id="full_name" name="full_name" bind:value={fullName} class="mt-1 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#FF6F61]" />
					</div>
			<div>
				<label class="text-xs font-semibold uppercase tracking-wide text-gray-400" for="account_email">Email</label>
				<input
					id="account_email"
					value={data.userEmail ?? ''}
					readonly
					class="mt-1 w-full rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-500"
				/>
			</div>
					<div>
						<label class="text-xs font-semibold uppercase tracking-wide text-gray-400" for="locale">Locale</label>
						<select id="locale" name="locale" bind:value={locale} class="mt-1 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#FF6F61]">
							<option value="en">English</option>
							<option value="id">Bahasa Indonesia</option>
							<option value="es">Spanish</option>
						</select>
					</div>
					<div class="flex justify-end">
						<Button type="submit" class="px-5">Update profile</Button>
					</div>
				</form>
			</article>
			<article class="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
				<h2 class="text-lg font-semibold text-gray-900">Billing</h2>
				<p class="mt-2 text-sm text-gray-500">Status of your current subscription.</p>
		<div class="mt-5 space-y-3 text-sm text-gray-700">
			<p><span class="text-gray-500">Plan:</span> {subscription?.type ?? 'Free'}</p>
			<p><span class="text-gray-500">Status:</span> {subscription?.status ?? 'active'}</p>
			<p><span class="text-gray-500">Next invoice:</span> {subscription?.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleDateString() : '—'}</p>
				</div>
				<div class="mt-6 flex gap-3">
					<Button variant="outline" class="px-5" href="/pricing">View plans</Button>
					<Button class="px-5" onclick={openBillingPortal} disabled={billingLoading}>
						{billingLoading ? 'Opening…' : 'Manage billing'}
					</Button>
				</div>
				{#if billingError}
					<div class="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
						{billingError}
					</div>
				{/if}
			</article>
		</section>
	</main>
</div>
