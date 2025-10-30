import { json, error } from '@sveltejs/kit';
import { getPriceIdForPlan, getTrialPeriodDays, type PlanTier } from '$lib/server/billing/plans';
import { getStripeClient } from '$lib/server/stripe';
import { getUserSubscription } from '$lib/server/subscriptions';
import { loadUserContext } from '$lib/server/user-context';
import type { RequestHandler } from './$types';

type CheckoutRequestPayload = {
	plan?: string;
};

const FALLBACK_TRIAL_DAYS = 0;

export const POST: RequestHandler = async ({ request, locals, url }) => {
	const body = (await request.json()) as CheckoutRequestPayload;
	const normalizedPlan = String(body.plan ?? '').toLowerCase();
	const supportedPlans: PlanTier[] = ['starter', 'pro', 'enterprise'];
	if (!supportedPlans.includes(normalizedPlan as PlanTier)) {
		return json({ error: 'Unknown plan selected.' }, { status: 400 });
	}

	const requestedPlan = normalizedPlan as PlanTier;

	const { session } = await loadUserContext(locals);
	if (!session) {
		throw error(401, 'Authentication required');
	}

	const priceId = getPriceIdForPlan(requestedPlan);
	if (!priceId) {
		return json(
			{ error: 'Selected plan is not currently available. Please contact support.' },
			{ status: 400 }
		);
	}

	const stripe = getStripeClient();
	const existingSubscription = await getUserSubscription(locals.supabase, session.user.id);
	const trialDays = getTrialPeriodDays(requestedPlan) ?? FALLBACK_TRIAL_DAYS;

	const successUrl = `${url.origin}/billing/success?session_id={CHECKOUT_SESSION_ID}`;
	const cancelUrl = `${url.origin}/pricing?cancelled=1`;

	try {
		const checkoutSession = await stripe.checkout.sessions.create({
			mode: 'subscription',
			client_reference_id: session.user.id,
			customer: existingSubscription?.provider_customer_id ?? undefined,
			customer_email: existingSubscription?.provider_customer_id ? undefined : session.user.email ?? undefined,
			allow_promotion_codes: true,
			automatic_tax: { enabled: true },
			line_items: [
				{
					price: priceId,
					quantity: 1,
				},
			],
			subscription_data: {
				metadata: {
					supabase_user_id: session.user.id,
						plan_tier: requestedPlan,
					},
				trial_period_days: trialDays > 0 ? trialDays : undefined,
			},
			metadata: {
			supabase_user_id: session.user.id,
			plan_tier: requestedPlan,
		},
			success_url: successUrl,
			cancel_url: cancelUrl,
		});

		return json({
			sessionId: checkoutSession.id,
			url: checkoutSession.url,
		});
	} catch (checkoutError) {
		console.error('[billing] checkout session creation failed', checkoutError);
		return json(
			{ error: 'Unable to start checkout right now. Please try again in a few minutes.' },
			{ status: 500 }
		);
	}
};
