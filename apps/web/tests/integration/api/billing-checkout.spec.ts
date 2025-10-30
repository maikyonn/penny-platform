import { beforeEach, describe, expect, it, vi } from 'vitest';
import type Stripe from 'stripe';
import { POST } from '../../../src/routes/api/billing/checkout/+server';

type SupabaseClient = {
	auth: Record<string, unknown>;
};

vi.mock('$lib/server/user-context', () => ({
	loadUserContext: vi.fn().mockResolvedValue({ session: { user: { id: 'user_123', email: 'user@example.com' } } })
}));

vi.mock('$lib/server/subscriptions', () => ({
	getUserSubscription: vi.fn().mockResolvedValue(null)
}));

const createSessionMock = vi.fn();

vi.mock('$lib/server/stripe', () => ({
	getStripeClient: vi.fn(() => ({
		checkout: {
			sessions: { create: createSessionMock }
		}
	}) as unknown as Stripe)
}));

vi.mock('$lib/server/billing/plans', async (importOriginal) => {
	const actual = await importOriginal();
	return {
		...actual,
		getPriceIdForPlan: vi.fn((tier: string) => `price_${tier}`),
		getTrialPeriodDays: vi.fn(() => 3)
	};
});

describe('POST /api/billing/checkout', () => {
	beforeEach(() => {
		createSessionMock.mockReset();
		createSessionMock.mockResolvedValue({
			id: 'cs_test_123',
			url: 'https://checkout.stripe.com/c/pay/cs_test_123'
		});
	});

	it('creates stripe checkout session for valid plan', async () => {
		const locals = { supabase: {} } as unknown as { supabase: SupabaseClient };
		const body = JSON.stringify({ plan: 'starter' });
		const req = new Request('http://localhost/api/billing/checkout', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body
		});

		const response = await POST({ request: req, locals, url: new URL('http://localhost/pricing') } as any);

		expect(response.status).toBe(200);
		const json = await response.json();
		expect(json).toEqual({ sessionId: 'cs_test_123', url: 'https://checkout.stripe.com/c/pay/cs_test_123' });
		expect(createSessionMock).toHaveBeenCalledWith(expect.objectContaining({
			line_items: [expect.objectContaining({ price: 'price_starter' })]
		}));
	});

	it('returns 400 for unknown plan', async () => {
		const locals = { supabase: {} } as unknown as { supabase: SupabaseClient };
		const req = new Request('http://localhost/api/billing/checkout', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ plan: 'invalid' })
		});

		const res = await POST({ request: req, locals, url: new URL('http://localhost/pricing') } as any);
		expect(res.status).toBe(400);
	});
});
