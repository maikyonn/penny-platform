<script lang="ts">
	import Logo from '$lib/components/Logo.svelte';
import { loadStripe } from '@stripe/stripe-js';
import type { Stripe as StripeClient } from '@stripe/stripe-js';
import { page } from '$app/stores';
import { get } from 'svelte/store';
import { PUBLIC_STRIPE_PUBLISHABLE_KEY } from '$env/static/public';

let { data } = $props();
const activePlan = (data.subscription?.plan ?? null) as
  | import('$lib/database.types').Database['public']['Enums']['plan_tier']
  | null;

function resolveCancelled() {
  try {
    const store = get(page);
    return store?.url?.searchParams?.get('cancelled') === '1';
  } catch (err) {
    return false;
  }
}

const cancelled = resolveCancelled();
const siteHasStripe = Boolean(PUBLIC_STRIPE_PUBLISHABLE_KEY);
const stripePromise: Promise<StripeClient | null> | null = siteHasStripe
  ? loadStripe(PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null;

	let checkoutInFlight = $state<string | null>(null);
	let checkoutError = $state<string | null>(null);

	type PricingPlan = {
		tier: 'starter' | 'pro' | 'special_event';
		name: string;
		price: number;
		cadence: 'month' | 'one-time';
		description: string;
		target: string;
		estimatedAttendees: string;
		features: string[];
		paywalls: string[];
		badge?: string;
		isSubscription: boolean;
		ctaLabel: string;
		ctaHelpText?: string;
	};

	const plans: PricingPlan[] = [
		{
			tier: 'starter',
			name: 'Starter Plan',
			price: 99,
			cadence: 'month',
			description: 'Launch intimate events or local promos with a focused guest list.',
			target: 'Built for local businesses & pop-up hosts running a single activation.',
			estimatedAttendees: '10 – 60 attendees per activation',
			features: [
				'Access to 300 new influencer profiles every month',
				'1 connected outreach inbox',
				'Send up to 200 outreach emails per month',
				'1 active campaign at a time (upgrade prompt when you hit the limit)',
				'Basic campaign analytics dashboard',
				'Guaranteed initial responses with priority delivery during trial'
			],
			paywalls: [
				'Free 3-day trial: 30 influencer contacts & 10 emails included',
				'CSV export locked behind upgrade',
				'Trial auto-converts to $99/month unless cancelled in 3 days'
			],
			badge: 'Best for local activations',
			isSubscription: true,
			ctaLabel: 'Start 3-Day Trial'
		},
		{
			tier: 'pro',
			name: 'Growth Plan',
			price: 299,
			cadence: 'month',
			description: 'Handle multiple client launches with deeper reach and reporting.',
			target: 'Perfect for agencies or growing brands managing several campaigns.',
			estimatedAttendees: '50 – 120 attendees per activation',
			features: [
				'Access to 1,000 new influencer profiles each month',
				'Connect up to 3 outreach inboxes',
				'Send 700 outreach emails per month',
				'Multiple active campaigns running in parallel',
				'Advanced analytics with performance insights & RSVP tracking',
				'Priority email support and guaranteed initial responses'
			],
			paywalls: [
				'Full CSV export unlocked',
				'Upgrades remove free-tier contact and email caps'
			],
			badge: 'Most popular',
			isSubscription: true,
			ctaLabel: 'Upgrade to Growth'
		},
		{
			tier: 'special_event',
			name: 'Event / Pop-Up Special',
			price: 999,
			cadence: 'one-time',
			description: 'A concierge blast when you need a venue packed with influencers.',
			target: 'For launch parties, festivals, and big activations needing immediate buzz.',
			estimatedAttendees: '500 – 1,500 targeted RSVPs & attendees',
			features: [
				'One-time import of 5,000 curated influencer profiles',
				'Up to 5 connected inboxes for parallel outreach',
				'Send up to 5,000 outreach messages for the event',
				'Full CSV export plus CRM sync included',
				'Concierge onboarding and done-for-you campaign setup',
				'Guaranteed initial responses with accelerated delivery windows'
			],
			paywalls: [
				'Non-recurring purchase—rebook when you need another event push'
			],
			isSubscription: false,
			ctaLabel: 'Book Event Package',
			ctaHelpText: 'We coordinate your one-time blast within 24 hours.'
		}
	];

	const freeTrialHighlights = [
		'3-day access to 20 influencers and 10 outreach emails',
		'Upgrade immediately to unlock the full contact pools and CSV exports',
		'Cancel anytime during the trial—otherwise the Starter Plan activates at $99/month'
	];

	const formatPrice = (value: number) =>
		new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD',
			maximumFractionDigits: 0
		}).format(value);

	async function handleCheckout(plan: PricingPlan) {
		if (!plan.isSubscription) {
			window.location.href = 'mailto:events@penny.ai?subject=Book%20Event%20%2F%20Pop-Up%20Special';
			return;
		}

		if (!siteHasStripe) {
			checkoutError = 'Billing configuration is not complete. Please contact support.';
			return;
		}

		checkoutError = null;
		checkoutInFlight = plan.tier;

		try {
			const response = await fetch('/api/billing/checkout', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					plan: plan.tier
				})
			});

			const payload = await response.json();

			if (!response.ok || !payload?.sessionId) {
				const message = payload?.error ?? 'Unable to start checkout. Please try again.';
				throw new Error(message);
			}

		const stripe = stripePromise ? await stripePromise : null;
		if (stripe) {
			const { error } = await (stripe as any).redirectToCheckout({ sessionId: payload.sessionId });
				if (error) {
					throw new Error(error.message);
				}
			} else if (payload.url) {
				window.location.href = payload.url;
			} else {
				throw new Error('Stripe is unavailable. Please try again.');
			}
		} catch (error) {
			console.error('[pricing] checkout error', error);
			checkoutError =
				error instanceof Error ? error.message : 'Something went wrong while starting checkout.';
		} finally {
			checkoutInFlight = null;
		}
	}
</script>

<div class="min-h-screen bg-gray-50">
	<!-- Header -->
	<div class="bg-white border-b border-gray-200">
		<div class="max-w-7xl mx-auto px-8 py-5 flex items-center justify-between">
			<a
				href="/campaign"
				class="flex items-center gap-3 text-gray-700 hover:text-gray-900 transition"
				aria-label="Back to campaign dashboard"
			>
				<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
				</svg>
			</a>
			<Logo size="md" />
			<div class="w-5"></div>
		</div>
	</div>

	<!-- Pricing Content -->
	<div class="max-w-7xl mx-auto px-8 py-16">
		<div class="mx-auto mb-12 max-w-3xl text-center">
			<h1 class="text-5xl font-bold mb-4">Plans built for every launch</h1>
			<p class="text-lg text-gray-600">
				Whether you're testing a local pop-up or filling a 1,500-person launch, choose the plan that matches your outreach volume and reporting needs.
			</p>
		</div>

		{#if cancelled}
			<div class="mx-auto mb-6 max-w-3xl rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm text-amber-700">
				Checkout was cancelled. You have not been charged.
			</div>
		{/if}

		{#if checkoutError}
			<div class="mx-auto mb-6 max-w-3xl rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-center text-sm text-red-700">
				{checkoutError}
			</div>
		{/if}

		{#if !siteHasStripe}
			<div class="mx-auto mb-6 max-w-3xl rounded-2xl border border-gray-200 bg-gray-100 px-4 py-3 text-center text-sm text-gray-600">
				Billing is not yet configured. Please contact support to activate a subscription.
			</div>
		{/if}

		{#if activePlan}
			<div class="mx-auto mb-6 max-w-3xl rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center text-sm text-emerald-700">
				You are currently on the {activePlan} plan.
			</div>
		{/if}

		<section class="mx-auto mb-12 max-w-4xl rounded-3xl border border-indigo-100 bg-indigo-50 px-8 py-10">
			<h2 class="text-xl font-semibold text-gray-900 mb-4">3-day Penny trial included</h2>
			<p class="text-sm text-gray-600 mb-4">
				Get instant momentum before you commit—your trial delivers guaranteed initial responses and hands-on targeting so you can see results in hours, not weeks.
			</p>
			<ul class="grid gap-3 md:grid-cols-3">
				{#each freeTrialHighlights as highlight}
					<li class="flex items-start gap-3 rounded-2xl bg-white px-4 py-3 text-sm text-gray-700 shadow-sm">
						<svg class="h-5 w-5 text-[#FF6F61] flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
							<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-7.25 7.25a1 1 0 01-1.414 0l-3-3a1 1 0 011.414-1.414L8.75 11.086l6.543-6.543a1 1 0 011.414 0z" clip-rule="evenodd" />
						</svg>
						<span>{highlight}</span>
					</li>
				{/each}
			</ul>
		</section>

		<p class="mb-12 text-center text-sm text-gray-500">
			Starter and Growth renew monthly. The Event / Pop-Up Special is a single $999 concierge activation.
		</p>

		<div class="grid grid-cols-1 gap-6 md:grid-cols-3">
			{#each plans as plan}
				<div class={`relative flex h-full flex-col rounded-3xl border-2 p-8 ${plan.badge ? 'border-[#FF6F61]' : 'border-gray-200'} ${plan.isSubscription && activePlan === plan.tier ? 'ring-2 ring-black ring-offset-2' : ''}`}>
					{#if plan.badge}
						<div class="absolute -top-3 left-1/2 -translate-x-1/2">
							<span class="inline-flex items-center rounded-full bg-gray-900 px-4 py-1 text-xs font-medium text-white">
								{plan.badge}
							</span>
						</div>
					{/if}

					<div class="mb-4 flex items-center gap-3">
						<h3 class="text-2xl font-bold text-gray-900">{plan.name}</h3>
						{#if plan.isSubscription && activePlan === plan.tier}
							<span class="inline-flex items-center rounded-full bg-black px-2.5 py-1 text-xs font-medium uppercase text-white">Current plan</span>
						{/if}
					</div>

					<p class="text-xs font-semibold uppercase tracking-wide text-gray-500">{plan.target}</p>

					<div class="mt-6 flex items-baseline gap-2">
						<span class="text-5xl font-bold text-gray-900">{formatPrice(plan.price)}</span>
						<span class="text-sm text-gray-600">{plan.cadence === 'month' ? '/month' : 'one-time'}</span>
					</div>

					<p class="mt-4 text-sm text-gray-600">{plan.description}</p>
					<p class="mt-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Estimated: {plan.estimatedAttendees}</p>

					<button
						onclick={() => handleCheckout(plan)}
						class="mt-6 w-full rounded-2xl bg-[#FF6F61] py-4 font-medium text-gray-900 transition hover:bg-[#ff846f] disabled:cursor-not-allowed disabled:opacity-60"
						disabled={plan.isSubscription && checkoutInFlight !== null}
					>
						{#if plan.isSubscription}
							{#if checkoutInFlight === plan.tier}
								Redirecting…
							{:else}
								{plan.ctaLabel}
							{/if}
						{:else}
							{plan.ctaLabel}
						{/if}
					</button>

					{#if plan.ctaHelpText}
						<p class="mt-2 text-center text-xs text-gray-500">{plan.ctaHelpText}</p>
					{/if}

					<div class="mt-8 space-y-3">
						<p class="text-sm font-semibold text-gray-900">What you get</p>
						{#each plan.features as feature}
							<div class="flex items-start gap-3">
								<svg class="mt-0.5 h-5 w-5 flex-shrink-0 text-green-500" fill="currentColor" viewBox="0 0 20 20">
									<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
								</svg>
								<span class="text-sm text-gray-700">{feature}</span>
							</div>
						{/each}
					</div>

					<div class="mt-6 space-y-3">
						<p class="text-sm font-semibold text-gray-900">Paywalls & limits</p>
						{#each plan.paywalls as paywall}
							<div class="flex items-start gap-3 text-sm text-gray-600">
								<svg class="mt-0.5 h-5 w-5 flex-shrink-0 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
									<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.536-10.95a1 1 0 010 1.414l-4.243 4.243a1 1 0 01-1.414 0L6.464 12.95a1 1 0 011.414-1.414l1.414 1.414 3.536-3.536a1 1 0 011.414 0z" clip-rule="evenodd" />
								</svg>
								<span>{paywall}</span>
							</div>
						{/each}
					</div>

					<div class="mt-8 border-t border-gray-100 pt-6 text-center text-sm text-gray-600">
						{#if plan.isSubscription}
							<p>3-day free trial included. Cancel anytime before it converts.</p>
						{:else}
							<p>One-time concierge activation. No recurring charges.</p>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	</div>
</div>
