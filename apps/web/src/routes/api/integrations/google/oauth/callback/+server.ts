import { redirect, json } from "@sveltejs/kit";
import { env } from "$env/dynamic/private";
import { signInWithCustomToken } from "$lib/server/firebase-identity";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ url, locals, fetch }) => {
	const code = url.searchParams.get('code');
	if (!code) {
		throw redirect(303, '/my-account?google=denied');
	}

	const session = await locals.getSession();
	if (!session) {
		throw redirect(303, '/sign-in?redirectTo=/my-account');
	}

	const projectId = env.GOOGLE_CLOUD_PROJECT ?? 'demo-penny-dev';
	const functionsBase = env.FUNCTIONS_EMULATOR === 'true'
		? `http://127.0.0.1:9004/${projectId}/us-central1`
		: `https://us-central1-${projectId}.cloudfunctions.net`;

	let idToken: string;
	try {
		const customToken = await locals.firebaseAuth.createCustomToken(session.user.id);
		const signIn = await signInWithCustomToken(customToken);
		idToken = signIn.idToken;
	} catch (error) {
		console.error('[gmail oauth] failed to mint id token', error);
		return json({ error: 'Unable to authorize Gmail at this time.' }, { status: 500 });
	}

	const redirectUri = new URL('/api/integrations/google/oauth/callback', url.origin).toString();

	const response = await fetch(`${functionsBase}/gmailAuthorize`, {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			Authorization: `Bearer ${idToken}`,
		},
		body: JSON.stringify({ code, redirectUri }),
	});

	if (!response.ok) {
		const details = await response.text();
		return json({ error: 'Gmail authorization failed', details }, { status: 400 });
	}

	throw redirect(303, '/my-account?google=connected');
};
