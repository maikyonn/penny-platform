import Stripe from 'stripe';
import { STRIPE_SECRET_KEY } from '$env/static/private';

let stripeClient: Stripe | null = null;

export function getStripeClient(): Stripe {
	if (!STRIPE_SECRET_KEY) {
		throw new Error('Missing STRIPE_SECRET_KEY environment variable');
	}

	if (!stripeClient) {
		stripeClient = new Stripe(STRIPE_SECRET_KEY);
	}

	return stripeClient;
}
