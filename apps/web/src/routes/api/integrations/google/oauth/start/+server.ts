import { redirect, json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const clientId = env.GOOGLE_OAUTH_CLIENT_ID;
	if (!clientId) {
		return json({ error: 'GOOGLE_OAUTH_CLIENT_ID is not configured' }, { status: 500 });
	}

	const redirectUri = new URL('/api/integrations/google/oauth/callback', url.origin).toString();
	const scope = [
		'https://www.googleapis.com/auth/gmail.send'
	].join(' ');

	const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
	authUrl.searchParams.set('client_id', clientId);
	authUrl.searchParams.set('redirect_uri', redirectUri);
	authUrl.searchParams.set('response_type', 'code');
	authUrl.searchParams.set('access_type', 'offline');
	authUrl.searchParams.set('prompt', 'consent');
	authUrl.searchParams.set('scope', scope);

	throw redirect(302, authUrl.toString());
};
