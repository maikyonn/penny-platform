import crypto from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Stripe from 'stripe';
import completedEvent from '../../fixtures/stripe/events/checkout.session.completed.json';
import subscriptionCreated from '../../fixtures/stripe/events/customer.subscription.created.json';
import subscriptionDeleted from '../../fixtures/stripe/events/customer.subscription.deleted.json';
import invoicePaid from '../../fixtures/stripe/events/invoice.paid.json';
import invoiceFailed from '../../fixtures/stripe/events/invoice.payment_failed.json';
import { signStripePayload } from '../../utils/stripe-headers';

invoicePaid.data.object.subscription = 'sub_123';
invoicePaid.data.object.customer = 'cus_123';
invoiceFailed.data.object.subscription = 'sub_123';
invoiceFailed.data.object.customer = 'cus_123';
(subscriptionCreated.data.object as any).metadata = {
	supabase_user_id: '00000000-0000-4000-8000-000000000000'
};
(subscriptionDeleted.data.object as any).metadata = {
	supabase_user_id: '00000000-0000-4000-8000-000000000000'
};

const maybeSingle = vi.fn();
const insertSpy = vi.fn();
const updateSpy = vi.fn();

vi.mock('$lib/server/supabase-admin', () => ({
	getAdminSupabaseClient: () => ({
		from: (table: string) => {
			if (table !== 'subscriptions') {
				throw new Error(`Unexpected table ${table}`);
			}
			return {
				select: () => ({
					eq: () => ({ maybeSingle })
				}),
				update: (payload: unknown) => ({
					eq: vi.fn(async () => {
						updateSpy(payload);
						return { error: null };
					})
				}),
				insert: async (payload: unknown) => {
					insertSpy(payload);
					return { error: null };
				}
			};
		}
	})
}));

vi.mock('$lib/server/billing/plans', async (importOriginal) => {
	const actual = await importOriginal();
	return {
		...actual,
		getPlanByPriceId: vi.fn(() => ({ tier: 'starter' }))
	};
});

let stripeClient: Stripe | undefined;
let retrieveSpy: ReturnType<typeof vi.spyOn<Stripe['subscriptions'], 'retrieve'>> | undefined;

vi.mock('$lib/server/stripe', () => ({
	getStripeClient: () => {
		if (!stripeClient) {
			throw new Error('Stripe client not initialised for tests');
		}
		return stripeClient;
	}
}));

const stripeSecret = process.env.STRIPE_SECRET_KEY;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

if (!stripeSecret || !webhookSecret) {
	describe.skip('POST /api/webhooks/stripe', () => {
		it('requires STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET to run', () => {
			expect(true).toBe(true);
		});
	});
} else {
	stripeClient = new Stripe(stripeSecret, { apiVersion: '2024-06-20' });
	retrieveSpy = vi.spyOn(stripeClient.subscriptions, 'retrieve');

	stripeClient.webhooks.constructEvent = ((payload: string, header: string, secret: string) => {
		const match = header.match(/^t=(\d+),v1=([0-9a-f]+)$/);
		if (!match) throw new Error('Invalid Stripe signature header');
		const [, timestamp, signature] = match;
		const expectedSig = crypto
			.createHmac('sha256', secret)
			.update(`${timestamp}.${payload}`)
			.digest('hex');
		const provided = Buffer.from(signature, 'hex');
		const expected = Buffer.from(expectedSig, 'hex');
		if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
			throw new Error('Signature mismatch');
		}
		return JSON.parse(payload) as Stripe.Event;
	}) as any;

	stripeClient.webhooks.constructEventAsync = async (payload: string, header: string, secret: string) =>
		stripeClient!.webhooks.constructEvent(payload, header, secret);

	const { POST } = await import('../../../src/routes/api/webhooks/stripe/+server');

	describe('POST /api/webhooks/stripe', () => {
		beforeEach(() => {
			vi.clearAllMocks();
			maybeSingle.mockReset();
			insertSpy.mockReset();
			updateSpy.mockReset();
			retrieveSpy!.mockReset();
			maybeSingle.mockResolvedValue({ data: null, error: null });
			retrieveSpy!.mockResolvedValue({
				id: 'sub_123',
				object: 'subscription',
				customer: 'cus_123',
				status: 'active',
				items: {
					object: 'list',
					data: [
						{
							id: 'si_123',
							object: 'subscription_item',
							price: { id: 'price_starter', object: 'price' }
						}
					]
				},
				current_period_end: 1700000500,
				metadata: { supabase_user_id: '00000000-0000-4000-8000-000000000000' }
			} as unknown as Stripe.Subscription);
		});

		it('verifies checkout completion and persists subscription', async () => {
			const payload = JSON.stringify(completedEvent);
			const signature = signStripePayload(payload, webhookSecret);

			const req = new Request('http://localhost/api/webhooks/stripe', {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
					'stripe-signature': signature
				},
				body: payload
			});

			const res = await POST({ request: req } as any);
			expect(res.status).toBe(200);
			expect(insertSpy).toHaveBeenCalledWith({
				user_id: '00000000-0000-4000-8000-000000000000',
				provider: 'stripe',
				provider_customer_id: 'cus_123',
				provider_subscription_id: 'sub_123',
				plan: 'starter',
				status: 'active',
				current_period_end: new Date(1700000500 * 1000).toISOString()
			});
		});

		it('updates existing subscription record', async () => {
			maybeSingle.mockResolvedValue({ data: { id: 'existing-id' }, error: null });
			const payload = JSON.stringify(subscriptionCreated);
			const signature = signStripePayload(payload, webhookSecret);
			const req = new Request('http://localhost/api/webhooks/stripe', {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
					'stripe-signature': signature
				},
				body: payload
			});

			const res = await POST({ request: req } as any);
			expect(res.status).toBe(200);
			expect(updateSpy).toHaveBeenCalled();
			expect(insertSpy).not.toHaveBeenCalled();
		});

		it('handles subscription deletion', async () => {
			maybeSingle.mockResolvedValue({ data: { id: 'existing-id' }, error: null });
			const payload = JSON.stringify(subscriptionDeleted);
			const signature = signStripePayload(payload, webhookSecret);
			const req = new Request('http://localhost/api/webhooks/stripe', {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
					'stripe-signature': signature
				},
				body: payload
			});

			const res = await POST({ request: req } as any);
			expect(res.status).toBe(200);
			expect(updateSpy).toHaveBeenCalledWith(expect.objectContaining({ status: 'canceled' }));
		});

		it('ignores invoice events (paid/failed) and leaves subscriptions untouched', async () => {
			const payloadPaid = JSON.stringify(invoicePaid);
			const signaturePaid = signStripePayload(payloadPaid, webhookSecret);
			await POST({
				request: new Request('http://localhost/api/webhooks/stripe', {
					method: 'POST',
					headers: {
						'content-type': 'application/json',
						'stripe-signature': signaturePaid
					},
					body: payloadPaid
				})
			} as any);

			const payloadFailed = JSON.stringify(invoiceFailed);
			const signatureFailed = signStripePayload(payloadFailed, webhookSecret);
			const res = await POST({
				request: new Request('http://localhost/api/webhooks/stripe', {
					method: 'POST',
					headers: {
						'content-type': 'application/json',
						'stripe-signature': signatureFailed
					},
					body: payloadFailed
				})
			} as any);

			expect(res.status).toBe(200);
			expect(insertSpy).not.toHaveBeenCalled();
			expect(updateSpy).not.toHaveBeenCalled();
		});
	});
}
