import { json, error } from "@sveltejs/kit";
import { getStripeClient } from "$lib/server/stripe";
import { getUserSubscription } from "$lib/server/subscriptions";
import { loadUserContext } from "$lib/server/user-context";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ locals, url }) => {
	const { firebaseUser } = await loadUserContext(locals);
	if (!firebaseUser) {
		throw error(401, 'Authentication required');
	}

	const subscription = await getUserSubscription(locals.firestore, firebaseUser.uid);
	if (!subscription?.customerId) {
		return json(
			{ error: 'No active subscription to manage. Start a plan first.' },
			{ status: 400 }
		);
	}

	try {
		const portal = await getStripeClient().billingPortal.sessions.create({
			customer: subscription.customerId,
			return_url: `${url.origin}/my-account`,
		});

		return json({ url: portal.url });
	} catch (portalError) {
		console.error('[billing] portal session error', portalError);
		return json(
			{ error: 'Unable to open the billing portal right now. Please try again later.' },
			{ status: 500 }
		);
	}
};
