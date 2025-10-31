import { json, error } from "@sveltejs/kit";
import { getPriceIdForPlan, getTrialPeriodDays, type PlanTier } from "$lib/server/billing/plans";
import { getStripeClient } from "$lib/server/stripe";
import { getUserSubscription } from "$lib/server/subscriptions";
import { loadUserContext } from "$lib/server/user-context";
import type { RequestHandler } from "./$types";

type CheckoutRequestPayload = {
	plan?: string;
};

const FALLBACK_TRIAL_DAYS = 0;

export const POST: RequestHandler = async ({ request, locals, url }) => {
	const body = (await request.json()) as CheckoutRequestPayload;
	const normalizedPlan = String(body.plan ?? '').toLowerCase();
	const supportedPlans: PlanTier[] = ['starter', 'pro', 'special_event'];
	if (!supportedPlans.includes(normalizedPlan as PlanTier)) {
		return json({ error: 'Unknown plan selected.' }, { status: 400 });
	}

	const requestedPlan = normalizedPlan as PlanTier;

	if (requestedPlan === 'special_event') {
		return json(
			{ error: 'The event package is coordinated manually. Contact support to book.' },
			{ status: 400 }
		);
	}

	const { firebaseUser } = await loadUserContext(locals);
	if (!firebaseUser) {
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
	const existingSubscription = await getUserSubscription(locals.firestore, firebaseUser.uid);
	const trialDays = getTrialPeriodDays(requestedPlan) ?? FALLBACK_TRIAL_DAYS;

	const successUrl = `${url.origin}/billing/success?session_id={CHECKOUT_SESSION_ID}`;
	const cancelUrl = `${url.origin}/pricing?cancelled=1`;

	try {
		const checkoutSession = await stripe.checkout.sessions.create({
			mode: 'subscription',
			client_reference_id: firebaseUser.uid,
			customer: existingSubscription?.customerId ?? undefined,
			customer_email: existingSubscription?.customerId ? undefined : firebaseUser.email ?? undefined,
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
					firebase_user_id: firebaseUser.uid,
					plan_tier: requestedPlan,
					price_id: priceId,
				},
				trial_period_days: trialDays > 0 ? trialDays : undefined,
			},
			metadata: {
				firebase_user_id: firebaseUser.uid,
				plan_tier: requestedPlan,
				price_id: priceId,
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
