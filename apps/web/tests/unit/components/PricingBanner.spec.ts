import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import PricingPage from '../../../src/routes/pricing/+page.svelte';

function renderPricing(subscriptionPlan: string | null) {
	const subscription = subscriptionPlan
		? { plan: subscriptionPlan, type: subscriptionPlan, status: 'active', provider: 'stripe' }
		: null;

	render(PricingPage, {
		props: { data: { subscription } }
	});
}

describe('Pricing subscription banner', () => {
	it('does not show active plan banner when user has no subscription', () => {
		renderPricing(null);
		expect(screen.queryByText(/you are currently on/i)).not.toBeInTheDocument();
	});

	it('shows active plan banner when subscription is present', () => {
		renderPricing('starter');
		expect(screen.getByText(/you are currently on the starter plan/i)).toBeInTheDocument();
	});
});
