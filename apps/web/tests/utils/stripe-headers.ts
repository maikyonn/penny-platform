import crypto from 'node:crypto';

export function signStripePayload(payload: string, secret?: string) {
	const signingSecret = secret ?? process.env.STRIPE_WEBHOOK_SECRET;
	if (!signingSecret) {
		throw new Error('STRIPE_WEBHOOK_SECRET must be provided to sign Stripe payloads');
	}
	const timestamp = Math.floor(Date.now() / 1000);
	const signature = crypto
		.createHmac('sha256', signingSecret)
		.update(`${timestamp}.${payload}`)
		.digest('hex');
	return `t=${timestamp},v1=${signature}`;
}
