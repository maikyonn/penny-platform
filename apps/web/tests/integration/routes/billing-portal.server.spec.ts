import { describe, expect, it, vi } from 'vitest';

const loadUserContextMock = vi.hoisted(() => vi.fn());
const getUserSubscriptionMock = vi.hoisted(() => vi.fn());
const stripePortalMock = vi.hoisted(() => vi.fn());

vi.mock('$lib/server/user-context', () => ({
	loadUserContext: loadUserContextMock
}));

vi.mock('$lib/server/subscriptions', () => ({
	getUserSubscription: getUserSubscriptionMock
}));

vi.mock('$lib/server/stripe', () => ({
	getStripeClient: () => ({
		billingPortal: {
			sessions: {
				create: stripePortalMock
			}
		}
	})
}));

import { POST } from '../../../src/routes/api/billing/portal/+server';

describe('billing portal endpoint', () => {
	it('requires authentication', async () => {
		loadUserContextMock.mockResolvedValue({ firebaseUser: null });

		await expect(
			POST({
				locals: {},
				url: new URL('http://localhost/api/billing/portal')
			} as any)
		).rejects.toMatchObject({ status: 401 });
	});

	it('rejects when no subscription exists', async () => {
		loadUserContextMock.mockResolvedValue({ firebaseUser: { uid: 'user-1' } });
		getUserSubscriptionMock.mockResolvedValue(null);

		const response = await POST({
			locals: { firestore: {} },
			url: new URL('http://localhost/api/billing/portal')
		} as any);

		expect(response.status).toBe(400);
		expect(stripePortalMock).not.toHaveBeenCalled();
	});

	it('returns portal url on success', async () => {
		loadUserContextMock.mockResolvedValue({ firebaseUser: { uid: 'user-1' } });
		getUserSubscriptionMock.mockResolvedValue({ customerId: 'cus_123' });
		stripePortalMock.mockResolvedValue({ url: 'https://stripe.test/portal' });

		const response = await POST({
			locals: { firestore: {} },
			url: new URL('http://localhost/api/billing/portal')
		} as any);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.url).toBe('https://stripe.test/portal');
	});
});
