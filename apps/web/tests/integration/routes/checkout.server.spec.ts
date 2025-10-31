import { beforeEach, describe, expect, it, vi } from 'vitest';

const loadUserContextMock = vi.hoisted(() => vi.fn());
const getPriceIdForPlanMock = vi.hoisted(() => vi.fn());
const getTrialPeriodDaysMock = vi.hoisted(() => vi.fn());
const getUserSubscriptionMock = vi.hoisted(() => vi.fn());
const stripeCheckoutMock = vi.hoisted(() => vi.fn());

vi.mock('$lib/server/user-context', () => ({
	loadUserContext: loadUserContextMock
}));

vi.mock('$lib/server/billing/plans', () => ({
	getPriceIdForPlan: getPriceIdForPlanMock,
	getTrialPeriodDays: getTrialPeriodDaysMock
}));

vi.mock('$lib/server/subscriptions', () => ({
	getUserSubscription: getUserSubscriptionMock
}));

vi.mock('$lib/server/stripe', () => ({
	getStripeClient: () => ({
		checkout: {
			sessions: {
				create: stripeCheckoutMock
			}
		}
	})
}));

import { POST } from '../../../src/routes/api/billing/checkout/+server';

describe('billing checkout API', () => {
beforeEach(() => {
	vi.clearAllMocks();
	loadUserContextMock.mockReset();
	getPriceIdForPlanMock.mockReset();
	getTrialPeriodDaysMock.mockReset();
	getUserSubscriptionMock.mockReset();
	stripeCheckoutMock.mockReset();
});

	it('creates a checkout session for a supported plan', async () => {
		loadUserContextMock.mockResolvedValue({
			firebaseUser: { uid: 'user-1', email: 'demo@brand.com' }
		});
		getPriceIdForPlanMock.mockReturnValue('price_starter_123');
		getTrialPeriodDaysMock.mockReturnValue(3);
		getUserSubscriptionMock.mockResolvedValue(null);
		stripeCheckoutMock.mockResolvedValue({
			id: 'cs_test_123',
			url: 'https://stripe.test/checkout/cs_test_123'
		});

		const request = new Request('http://localhost/api/billing/checkout', {
			method: 'POST',
			headers: {
				'content-type': 'application/json'
			},
			body: JSON.stringify({ plan: 'starter' })
		});

		const response = await POST({
			request,
			locals: { firestore: {} } as any,
			url: new URL('http://localhost/pricing')
		} as any);

		const payload = await response.json();

		expect(response.status).toBe(200);
		expect(payload.sessionId).toBe('cs_test_123');
		expect(loadUserContextMock).toHaveBeenCalledTimes(1);
		expect(stripeCheckoutMock).toHaveBeenCalledTimes(1);
		const checkoutArgs = stripeCheckoutMock.mock.calls[0][0];
		expect(checkoutArgs.metadata.plan_tier).toBe('starter');
		expect(checkoutArgs.subscription_data.metadata.firebase_user_id).toBe('user-1');
	});

	it('rejects unsupported plans', async () => {
		loadUserContextMock.mockResolvedValue({
			firebaseUser: { uid: 'user-1', email: 'demo@brand.com' }
		});

		const request = new Request('http://localhost/api/billing/checkout', {
			method: 'POST',
			headers: {
				'content-type': 'application/json'
			},
			body: JSON.stringify({ plan: 'unknown' })
		});

		const response = await POST({
			request,
			locals: { firestore: {} } as any,
			url: new URL('http://localhost/pricing')
		} as any);

		expect(response.status).toBe(400);
		const data = await response.json();
		expect(data.error).toMatch(/unknown plan/i);
		expect(loadUserContextMock).not.toHaveBeenCalled();
		expect(stripeCheckoutMock).not.toHaveBeenCalled();
	});

	it('routes special event purchases to manual flow', async () => {
		loadUserContextMock.mockResolvedValue({
			firebaseUser: { uid: 'user-1', email: 'demo@brand.com' }
		});

		getPriceIdForPlanMock.mockReturnValue(null);
		getTrialPeriodDaysMock.mockReturnValue(0);

		const request = new Request('http://localhost/api/billing/checkout', {
			method: 'POST',
			headers: {
				'content-type': 'application/json'
			},
			body: JSON.stringify({ plan: 'special_event' })
		});

		const response = await POST({
			request,
			locals: { firestore: {} } as any,
			url: new URL('http://localhost/pricing')
		} as any);

		expect(response.status).toBe(400);
		const data = await response.json();
		expect(data.error).toMatch(/contact support/i);
		expect(loadUserContextMock).not.toHaveBeenCalled();
		expect(stripeCheckoutMock).not.toHaveBeenCalled();
	});
});
