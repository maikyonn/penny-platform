import { STRIPE_WEBHOOK_SECRET } from '$env/static/private';
import Stripe from 'stripe';
import { getPlanByPriceId, type PlanTier } from '$lib/server/billing/plans';
import { getStripeClient } from '$lib/server/stripe';
import { getAdminSupabaseClient } from '$lib/server/supabase-admin';
import type { RequestHandler } from './$types';

const stripe = getStripeClient();

type SubscriptionStatusPayload = {
	user_id: string;
	provider: string;
	provider_customer_id: string | null;
	provider_subscription_id: string;
	plan: PlanTier;
	status: string;
	current_period_end: string | null;
};

const DEFAULT_PLAN: PlanTier = 'starter';

export const POST: RequestHandler = async ({ request }) => {
	if (!STRIPE_WEBHOOK_SECRET) {
		console.error('[stripe webhook] STRIPE_WEBHOOK_SECRET is not configured');
		return new Response('Webhook not configured', { status: 500 });
	}

	const signature = request.headers.get('stripe-signature');
	if (!signature) {
		return new Response('Missing Stripe signature', { status: 400 });
	}

	const body = await request.text();

	let event: Stripe.Event;
	try {
		event = stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET);
	} catch (err) {
		console.error('[stripe webhook] signature verification failed', err);
		return new Response('Invalid signature', { status: 400 });
	}

	try {
		switch (event.type) {
			case 'checkout.session.completed': {
				const session = event.data.object as Stripe.Checkout.Session;
				await handleCheckoutSession(session);
				break;
			}
			case 'customer.subscription.created':
			case 'customer.subscription.updated':
			case 'customer.subscription.deleted': {
				const subscription = event.data.object as Stripe.Subscription;
				await persistSubscription(subscription);
				break;
			}
			default: {
				// We log but intentionally do not treat as an error.
				console.info(`[stripe webhook] Ignored event type: ${event.type}`);
			}
		}
	} catch (handlerError) {
		console.error('[stripe webhook] handler error', handlerError);
		return new Response('Webhook handling error', { status: 500 });
	}

	return new Response('ok', { status: 200 });
};

async function handleCheckoutSession(session: Stripe.Checkout.Session) {
	const subscriptionId =
		typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
	const userId =
		(session.metadata?.supabase_user_id as string | undefined) ??
		(session.client_reference_id ?? null);

	if (!subscriptionId || !userId) {
		console.warn('[stripe webhook] checkout session missing subscription or user metadata');
		return;
	}

	try {
		const subscription = await stripe.subscriptions.retrieve(subscriptionId);
		await persistSubscription(subscription, userId);
	} catch (err) {
		console.error('[stripe webhook] failed to retrieve subscription', err);
	}
}

async function persistSubscription(subscription: Stripe.Subscription, overrideUserId?: string | null) {
	const userId =
		overrideUserId ??
		(subscription.metadata?.supabase_user_id as string | undefined) ??
		null;

	if (!userId) {
		console.warn('[stripe webhook] subscription missing supabase_user_id metadata');
		return;
	}

	const customerId =
		typeof subscription.customer === 'string'
			? subscription.customer
			: subscription.customer?.id ?? null;
	const priceId = subscription.items.data[0]?.price?.id ?? null;
	const planConfig = getPlanByPriceId(priceId);
	const planTier = planConfig?.tier ?? DEFAULT_PLAN;

	const currentPeriodEnd = (subscription as { current_period_end?: number }).current_period_end ?? null;

	const payload: SubscriptionStatusPayload = {
		user_id: userId,
		provider: 'stripe',
		provider_customer_id: customerId,
		provider_subscription_id: subscription.id,
		plan: planTier,
		status: subscription.status,
		current_period_end: currentPeriodEnd
			? new Date(currentPeriodEnd * 1000).toISOString()
			: null,
	};

	const admin = getAdminSupabaseClient();

	const { data: existing, error: fetchError } = await admin
		.from('subscriptions')
		.select('id')
		.eq('user_id', userId)
		.maybeSingle();

	if (fetchError) {
		console.error('[stripe webhook] subscription fetch error', fetchError);
		return;
	}

	if (existing) {
		const { error: updateError } = await admin
			.from('subscriptions')
			.update(payload)
			.eq('id', existing.id);
		if (updateError) {
			console.error('[stripe webhook] subscription update error', updateError);
		}
	} else {
		const { error: insertError } = await admin.from('subscriptions').insert(payload);
		if (insertError) {
			console.error('[stripe webhook] subscription insert error', insertError);
		}
	}
}
