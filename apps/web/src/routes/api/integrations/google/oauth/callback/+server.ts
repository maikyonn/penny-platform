import { redirect, json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals, fetch }) => {
	const code = url.searchParams.get('code');
	if (!code) {
		throw redirect(303, '/my-account?google=denied');
	}

	const clientId = env.GOOGLE_OAUTH_CLIENT_ID;
	const clientSecret = env.GOOGLE_OAUTH_CLIENT_SECRET;
	if (!clientId || !clientSecret) {
		return json({ error: 'Google OAuth environment variables are not configured' }, { status: 500 });
	}

	const redirectUri = new URL('/api/integrations/google/oauth/callback', url.origin).toString();
	const session = (await locals.getSession?.()) ?? (await locals.supabase.auth.getSession()).data.session;
	if (!session) {
		throw redirect(303, '/sign-in?redirectTo=/my-account');
	}

	const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
		method: 'POST',
		headers: { 'content-type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({
			code,
			client_id: clientId,
			client_secret: clientSecret,
			redirect_uri: redirectUri,
			grant_type: 'authorization_code'
		})
	});

	if (!tokenResponse.ok) {
		const details = await tokenResponse.text();
		return json({ error: 'Token exchange failed', details }, { status: 400 });
	}

	const token = await tokenResponse.json() as {
		access_token: string;
		expires_in: number;
		refresh_token?: string;
		scope?: string;
		token_type?: string;
	};

	let email = session.user.email ?? '';
	try {
		const meResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
			headers: { Authorization: `Bearer ${token.access_token}` }
		});
		if (meResponse.ok) {
			const me = await meResponse.json() as { email?: string };
			email = me.email ?? email;
		}
	} catch (err) {
		console.warn('gmail oauth userinfo failed', err);
	}

	let refreshToken = token.refresh_token ?? '';
	if (!refreshToken) {
		const { data: existing } = await locals.supabase
			.from('gmail_accounts')
			.select('refresh_token')
			.eq('user_id', session.user.id)
			.maybeSingle();
		refreshToken = existing?.refresh_token ?? refreshToken;
	}

	const expiry = new Date(Date.now() + Math.max(0, (token.expires_in ?? 0) - 60) * 1000).toISOString();

	await locals.supabase.from('gmail_accounts').upsert({
		user_id: session.user.id,
		email,
		access_token: token.access_token,
		refresh_token: refreshToken,
		scope: token.scope ? token.scope.split(' ') : [],
		token_type: token.token_type ?? 'Bearer',
		expiry,
		updated_at: new Date().toISOString()
	});

	throw redirect(303, '/my-account?google=connected');
};
